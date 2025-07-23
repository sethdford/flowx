/**
 * Daemon Command
 * Background service management with real process control and monitoring
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getPersistenceManager } from '../../core/global-initialization.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { homedir } from 'os';

interface DaemonConfig {
  name: string;
  command: string;
  args: string[];
  workingDirectory: string;
  environment: Record<string, string>;
  user?: string;
  group?: string;
  pidFile: string;
  logFile: string;
  errorFile: string;
  autoRestart: boolean;
  restartDelay: number;
  maxRestarts: number;
  startTimeout: number;
  stopTimeout: number;
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retries: number;
    command?: string;
    http?: {
      url: string;
      expectedStatus: number;
    };
  };
}

interface DaemonStatus {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'starting' | 'stopping' | 'unknown';
  pid?: number;
  uptime?: number;
  restartCount: number;
  lastStarted?: number;
  lastStopped?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
  lastError?: string;
}

interface DaemonProcess {
  config: DaemonConfig;
  process?: ChildProcess;
  status: DaemonStatus;
  restartTimer?: NodeJS.Timeout;
  healthCheckTimer?: NodeJS.Timeout;
  startTime?: number;
}

export const daemonCommand: CLICommand = {
  name: 'daemon',
  description: 'Manage background services and daemon processes',
  category: 'System',
  usage: 'flowx daemon <subcommand> [OPTIONS]',
  examples: [
    'flowx daemon start flowx-server',
    'flowx daemon stop all',
    'flowx daemon status',
    'flowx daemon create --name web-server --command "node server.ts"',
    'flowx daemon logs flowx-server --follow'
  ],
  subcommands: [
    {
      name: 'start',
      description: 'Start daemon service(s)',
      handler: async (context: CLIContext) => await startDaemon(context),
      options: [
        {
          name: 'force',
          short: 'f',
          description: 'Force start even if already running',
          type: 'boolean'
        },
        {
          name: 'wait',
          short: 'w',
          description: 'Wait for service to be ready',
          type: 'boolean'
        },
        {
          name: 'timeout',
          short: 't',
          description: 'Startup timeout in seconds',
          type: 'number',
          default: 30
        }
      ]
    },
    {
      name: 'stop',
      description: 'Stop daemon service(s)',
      handler: async (context: CLIContext) => await stopDaemon(context),
      options: [
        {
          name: 'force',
          short: 'f',
          description: 'Force stop (SIGKILL)',
          type: 'boolean'
        },
        {
          name: 'timeout',
          short: 't',
          description: 'Stop timeout in seconds',
          type: 'number',
          default: 10
        }
      ]
    },
    {
      name: 'restart',
      description: 'Restart daemon service(s)',
      handler: async (context: CLIContext) => await restartDaemon(context),
      options: [
        {
          name: 'force',
          short: 'f',
          description: 'Force restart',
          type: 'boolean'
        },
        {
          name: 'wait',
          short: 'w',
          description: 'Wait for service to be ready',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'status',
      description: 'Show daemon status',
      handler: async (context: CLIContext) => await showDaemonStatus(context),
      options: [
        {
          name: 'detailed',
          short: 'd',
          description: 'Show detailed status information',
          type: 'boolean'
        },
        {
          name: 'json',
          short: 'j',
          description: 'Output in JSON format',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'create',
      description: 'Create new daemon configuration',
      handler: async (context: CLIContext) => await createDaemon(context),
      options: [
        {
          name: 'name',
          short: 'n',
          description: 'Daemon name',
          type: 'string',
          required: true
        },
        {
          name: 'command',
          short: 'c',
          description: 'Command to run',
          type: 'string',
          required: true
        },
        {
          name: 'args',
          short: 'a',
          description: 'Command arguments (JSON array)',
          type: 'string'
        },
        {
          name: 'working-dir',
          short: 'w',
          description: 'Working directory',
          type: 'string'
        },
        {
          name: 'auto-restart',
          description: 'Enable auto-restart on failure',
          type: 'boolean',
          default: true
        },
        {
          name: 'health-check',
          description: 'Enable health checking',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'remove',
      description: 'Remove daemon configuration',
      handler: async (context: CLIContext) => await removeDaemon(context),
      options: [
        {
          name: 'force',
          short: 'f',
          description: 'Force removal even if running',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'logs',
      description: 'Show daemon logs',
      handler: async (context: CLIContext) => await showDaemonLogs(context),
      options: [
        {
          name: 'follow',
          short: 'f',
          description: 'Follow log output',
          type: 'boolean'
        },
        {
          name: 'lines',
          short: 'n',
          description: 'Number of lines to show',
          type: 'number',
          default: 50
        },
        {
          name: 'error',
          short: 'e',
          description: 'Show error logs',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'enable',
      description: 'Enable daemon auto-start',
      handler: async (context: CLIContext) => await enableDaemon(context)
    },
    {
      name: 'disable',
      description: 'Disable daemon auto-start',
      handler: async (context: CLIContext) => await disableDaemon(context)
    },
    {
      name: 'reload',
      description: 'Reload daemon configuration',
      handler: async (context: CLIContext) => await reloadDaemon(context)
    }
  ],
  handler: async (context: CLIContext) => {
    return await showDaemonStatus(context);
  }
};

// Global daemon manager
class DaemonManager {
  private static instance: DaemonManager;
  private daemons = new Map<string, DaemonProcess>();
  private configDir: string;
  private dataDir: string;

  private constructor() {
    this.configDir = path.join(homedir(), '.flowx', 'daemons');
    this.dataDir = path.join(homedir(), '.flowx', 'daemon-data');
  }

  static getInstance(): DaemonManager {
    if (!DaemonManager.instance) {
      DaemonManager.instance = new DaemonManager();
    }
    return DaemonManager.instance;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.loadDaemonConfigs();
  }

  async loadDaemonConfigs(): Promise<void> {
    try {
      const files = await fs.readdir(this.configDir);
      
      for (const file of files) {
        if (file.endsWith('.tson')) {
          const configPath = path.join(this.configDir, file);
          const configData = await fs.readFile(configPath, 'utf8');
          const config: DaemonConfig = JSON.parse(configData);
          
          this.daemons.set(config.name, {
            config,
            status: {
              name: config.name,
              status: 'stopped',
              restartCount: 0
            }
          });
        }
      }
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }

  async saveDaemonConfig(config: DaemonConfig): Promise<void> {
    const configPath = path.join(this.configDir, `${config.name}.tson`);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  async removeDaemonConfig(name: string): Promise<void> {
    const configPath = path.join(this.configDir, `${name}.tson`);
    await fs.unlink(configPath);
  }

  async startDaemon(name: string, options: any = {}): Promise<void> {
    const daemon = this.daemons.get(name);
    if (!daemon) {
      throw new Error(`Daemon '${name}' not found`);
    }

    if (daemon.status.status === 'running' && !options.force) {
      throw new Error(`Daemon '${name}' is already running`);
    }

    if (daemon.process) {
      await this.stopDaemon(name, { force: true });
    }

    daemon.status.status = 'starting';
    daemon.startTime = Date.now();

    try {
      const childProcess = spawn(daemon.config.command, daemon.config.args, {
        cwd: daemon.config.workingDirectory,
        env: { ...process.env, ...daemon.config.environment },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      daemon.process = childProcess;
      daemon.status.pid = childProcess.pid;
      daemon.status.lastStarted = Date.now();

      // Write PID file
      await fs.writeFile(daemon.config.pidFile, childProcess.pid?.toString() || '');

      // Setup log files
      if (childProcess.stdout) {
        const logStream = await fs.open(daemon.config.logFile, 'a');
        childProcess.stdout.pipe(logStream.createWriteStream());
      }

      if (childProcess.stderr) {
        const errorStream = await fs.open(daemon.config.errorFile, 'a');
        childProcess.stderr.pipe(errorStream.createWriteStream());
      }

      // Setup process event handlers
      childProcess.on('exit', (code: number | null, signal: string | null) => {
        daemon.status.status = code === 0 ? 'stopped' : 'failed';
        daemon.status.lastStopped = Date.now();
        daemon.status.pid = undefined;
        daemon.process = undefined;

        if (code !== 0 && daemon.config.autoRestart) {
          this.scheduleRestart(name);
        }

        // Remove PID file
        fs.unlink(daemon.config.pidFile).catch(() => {});
      });

      childProcess.on('error', (error: Error) => {
        daemon.status.status = 'failed';
        daemon.status.lastError = error.message;
      });

      // Wait for startup if requested
      if (options.wait) {
        await this.waitForDaemonReady(name, options.timeout || 30);
      }

      daemon.status.status = 'running';
      
      // Start health checks if enabled
      if (daemon.config.healthCheck?.enabled) {
        this.startHealthCheck(name);
      }

    } catch (error) {
      daemon.status.status = 'failed';
      daemon.status.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async stopDaemon(name: string, options: any = {}): Promise<void> {
    const daemon = this.daemons.get(name);
    if (!daemon) {
      throw new Error(`Daemon '${name}' not found`);
    }

    if (!daemon.process) {
      daemon.status.status = 'stopped';
      return;
    }

    daemon.status.status = 'stopping';

    // Clear timers
    if (daemon.restartTimer) {
      clearTimeout(daemon.restartTimer);
      daemon.restartTimer = undefined;
    }

    if (daemon.healthCheckTimer) {
      clearInterval(daemon.healthCheckTimer);
      daemon.healthCheckTimer = undefined;
    }

    try {
      if (options.force) {
        daemon.process.kill('SIGKILL');
      } else {
        daemon.process.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            daemon.process?.kill('SIGKILL');
            reject(new Error('Stop timeout exceeded'));
          }, (options.timeout || 10) * 1000);

          daemon.process?.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
    } catch (error) {
      // Process might already be dead
    }

    daemon.status.status = 'stopped';
    daemon.status.lastStopped = Date.now();
    daemon.status.pid = undefined;
    daemon.process = undefined;

    // Remove PID file
    await fs.unlink(daemon.config.pidFile).catch(() => {});
  }

  async restartDaemon(name: string, options: any = {}): Promise<void> {
    await this.stopDaemon(name, options);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.startDaemon(name, options);
  }

  getDaemonStatus(name?: string): DaemonStatus[] {
    if (name) {
      const daemon = this.daemons.get(name);
      return daemon ? [this.updateDaemonStatus(daemon)] : [];
    }

    return Array.from(this.daemons.values()).map(daemon => this.updateDaemonStatus(daemon));
  }

  private updateDaemonStatus(daemon: DaemonProcess): DaemonStatus {
    const status = { ...daemon.status };
    
    if (daemon.process && daemon.status.lastStarted) {
      status.uptime = Date.now() - daemon.status.lastStarted;
    }

    // Update process info if available
    if (daemon.process?.pid) {
      try {
        const usage = process.cpuUsage();
        status.cpuUsage = (usage.user + usage.system) / 1000000; // Convert to seconds
        status.memoryUsage = process.memoryUsage().heapUsed;
      } catch (error) {
        // Ignore if process info not available
      }
    }

    return status;
  }

  async createDaemon(config: DaemonConfig): Promise<void> {
    if (this.daemons.has(config.name)) {
      throw new Error(`Daemon '${config.name}' already exists`);
    }

    // Set default paths
    config.pidFile = config.pidFile || path.join(this.dataDir, `${config.name}.pid`);
    config.logFile = config.logFile || path.join(this.dataDir, `${config.name}.log`);
    config.errorFile = config.errorFile || path.join(this.dataDir, `${config.name}.error.log`);

    await this.saveDaemonConfig(config);

    this.daemons.set(config.name, {
      config,
      status: {
        name: config.name,
        status: 'stopped',
        restartCount: 0
      }
    });
  }

  async removeDaemon(name: string, force: boolean = false): Promise<void> {
    const daemon = this.daemons.get(name);
    if (!daemon) {
      throw new Error(`Daemon '${name}' not found`);
    }

    if (daemon.status.status === 'running' && !force) {
      throw new Error(`Daemon '${name}' is running. Stop it first or use --force`);
    }

    if (daemon.status.status === 'running') {
      await this.stopDaemon(name, { force: true });
    }

    await this.removeDaemonConfig(name);
    this.daemons.delete(name);
  }

  private async waitForDaemonReady(name: string, timeout: number): Promise<void> {
    const daemon = this.daemons.get(name);
    if (!daemon) return;

    const startTime = Date.now();
    const checkInterval = 1000;

    while (Date.now() - startTime < timeout * 1000) {
      if (daemon.status.status === 'running') {
        // Perform health check if configured
        if (daemon.config.healthCheck?.enabled) {
          const healthy = await this.performHealthCheck(name);
          if (healthy) return;
        } else {
          return;
        }
      }

      if (daemon.status.status === 'failed') {
        throw new Error(`Daemon failed to start: ${daemon.status.lastError}`);
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Daemon startup timeout exceeded`);
  }

  private scheduleRestart(name: string): void {
    const daemon = this.daemons.get(name);
    if (!daemon) return;

    daemon.status.restartCount++;

    if (daemon.status.restartCount > daemon.config.maxRestarts) {
      daemon.status.status = 'failed';
      daemon.status.lastError = 'Max restart attempts exceeded';
      return;
    }

    daemon.restartTimer = setTimeout(() => {
      this.startDaemon(name).catch(error => {
        daemon.status.status = 'failed';
        daemon.status.lastError = error.message;
      });
    }, daemon.config.restartDelay);
  }

  private startHealthCheck(name: string): void {
    const daemon = this.daemons.get(name);
    if (!daemon?.config.healthCheck) return;

    daemon.healthCheckTimer = setInterval(async () => {
      const healthy = await this.performHealthCheck(name);
      daemon.status.healthStatus = healthy ? 'healthy' : 'unhealthy';
      
      if (!healthy && daemon.config.autoRestart) {
        await this.restartDaemon(name);
      }
    }, daemon.config.healthCheck.interval);
  }

  private async performHealthCheck(name: string): Promise<boolean> {
    const daemon = this.daemons.get(name);
    if (!daemon?.config.healthCheck) return true;

    try {
      const healthConfig = daemon.config.healthCheck;
      
      if (healthConfig.command) {
        // Execute health check command
        const result = await new Promise<boolean>((resolve) => {
          const healthProcess = spawn('sh', ['-c', healthConfig.command!], {
            timeout: healthConfig.timeout
          });
          
          healthProcess.on('exit', (code) => {
            resolve(code === 0);
          });
          
          healthProcess.on('error', () => {
            resolve(false);
          });
        });
        
        return result;
      }
      
      if (healthConfig.http) {
        // HTTP health check
        const response = await fetch(healthConfig.http.url, {
          signal: AbortSignal.timeout(healthConfig.timeout)
        });
        
        return response.status === healthConfig.http.expectedStatus;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async getDaemonLogs(name: string, options: any = {}): Promise<string[]> {
    const daemon = this.daemons.get(name);
    if (!daemon) {
      throw new Error(`Daemon '${name}' not found`);
    }

    const logFile = options.error ? daemon.config.errorFile : daemon.config.logFile;
    
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      return options.lines ? lines.slice(-options.lines) : lines;
    } catch (error) {
      return [];
    }
  }
}

// Command handlers

async function startDaemon(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const manager = DaemonManager.getInstance();
  await manager.initialize();

  if (args.length === 0) {
    printError('Daemon name is required');
    printInfo('Usage: flowx daemon start <daemon-name> [options]');
    return;
  }

  const daemonName = args[0];

  try {
    if (daemonName === 'all') {
      const statuses = manager.getDaemonStatus();
      for (const status of statuses) {
        if (status.status !== 'running') {
          await manager.startDaemon(status.name, options);
          printSuccess(`✅ Started daemon: ${status.name}`);
        }
      }
    } else {
      await manager.startDaemon(daemonName, options);
      printSuccess(`✅ Started daemon: ${daemonName}`);
      
      if (options.wait) {
        printInfo('Waiting for daemon to be ready...');
      }
    }
  } catch (error) {
    printError(`Failed to start daemon: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function stopDaemon(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const manager = DaemonManager.getInstance();
  await manager.initialize();

  if (args.length === 0) {
    printError('Daemon name is required');
    printInfo('Usage: flowx daemon stop <daemon-name> [options]');
    return;
  }

  const daemonName = args[0];

  try {
    if (daemonName === 'all') {
      const statuses = manager.getDaemonStatus();
      for (const status of statuses) {
        if (status.status === 'running') {
          await manager.stopDaemon(status.name, options);
          printSuccess(`✅ Stopped daemon: ${status.name}`);
        }
      }
    } else {
      await manager.stopDaemon(daemonName, options);
      printSuccess(`✅ Stopped daemon: ${daemonName}`);
    }
  } catch (error) {
    printError(`Failed to stop daemon: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function restartDaemon(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const manager = DaemonManager.getInstance();
  await manager.initialize();

  if (args.length === 0) {
    printError('Daemon name is required');
    printInfo('Usage: flowx daemon restart <daemon-name> [options]');
    return;
  }

  const daemonName = args[0];

  try {
    if (daemonName === 'all') {
      const statuses = manager.getDaemonStatus();
      for (const status of statuses) {
        await manager.restartDaemon(status.name, options);
        printSuccess(`✅ Restarted daemon: ${status.name}`);
      }
    } else {
      await manager.restartDaemon(daemonName, options);
      printSuccess(`✅ Restarted daemon: ${daemonName}`);
    }
  } catch (error) {
    printError(`Failed to restart daemon: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showDaemonStatus(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const manager = DaemonManager.getInstance();
  await manager.initialize();

  try {
    const daemonName = args[0];
    const statuses = manager.getDaemonStatus(daemonName);

    if (statuses.length === 0) {
      printInfo('No daemons found');
      return;
    }

    if (options.tson) {
      console.log(JSON.stringify(statuses, null, 2));
      return;
    }

    printInfo('🔧 Daemon Status');
    console.log('─'.repeat(60));

    const tableData = statuses.map(status => ({
      name: status.name,
      status: getStatusDisplay(status.status),
      pid: status.pid?.toString() || '-',
      uptime: status.uptime ? formatDuration(status.uptime) : '-',
      restarts: status.restartCount.toString(),
      health: status.healthStatus || 'N/A'
    }));

    console.log(formatTable(tableData, [
      { header: 'Name', key: 'name' },
      { header: 'Status', key: 'status' },
      { header: 'PID', key: 'pid' },
      { header: 'Uptime', key: 'uptime' },
      { header: 'Restarts', key: 'restarts' },
      { header: 'Health', key: 'health' }
    ]));

    if (options.detailed) {
      console.log('\nDetailed Information:');
      statuses.forEach(status => {
        console.log(`\n${status.name}:`);
        console.log(`  Status: ${status.status}`);
        console.log(`  PID: ${status.pid || 'N/A'}`);
        console.log(`  Memory: ${status.memoryUsage ? Math.round(status.memoryUsage / 1024 / 1024) + 'MB' : 'N/A'}`);
        console.log(`  CPU: ${status.cpuUsage ? status.cpuUsage.toFixed(2) + 's' : 'N/A'}`);
        if (status.lastStarted) {
          console.log(`  Last Started: ${new Date(status.lastStarted).toLocaleString()}`);
        }
        if (status.lastError) {
          console.log(`  Last Error: ${status.lastError}`);
        }
      });
    }
  } catch (error) {
    printError(`Failed to get daemon status: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function createDaemon(context: CLIContext): Promise<void> {
  const { options } = context;
  const manager = DaemonManager.getInstance();
  await manager.initialize();

  if (!options.name || !options.command) {
    printError('Daemon name and command are required');
    printInfo('Usage: flowx daemon create --name <name> --command <command> [options]');
    return;
  }

  try {
    const config: DaemonConfig = {
      name: options.name,
      command: options.command,
      args: options.args ? JSON.parse(options.args) : [],
      workingDirectory: options.workingDir || process.cwd(),
      environment: {},
      pidFile: '',
      logFile: '',
      errorFile: '',
      autoRestart: options.autoRestart !== false,
      restartDelay: 5000,
      maxRestarts: 3,
      startTimeout: 30000,
      stopTimeout: 10000
    };

    if (options.healthCheck) {
      config.healthCheck = {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        retries: 3
      };
    }

    await manager.createDaemon(config);
    printSuccess(`✅ Created daemon: ${config.name}`);
    printInfo(`Command: ${config.command}`);
    printInfo(`Auto-restart: ${config.autoRestart ? 'enabled' : 'disabled'}`);
    
  } catch (error) {
    printError(`Failed to create daemon: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function removeDaemon(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const manager = DaemonManager.getInstance();
  await manager.initialize();

  if (args.length === 0) {
    printError('Daemon name is required');
    printInfo('Usage: flowx daemon remove <daemon-name> [options]');
    return;
  }

  const daemonName = args[0];

  try {
    await manager.removeDaemon(daemonName, options.force);
    printSuccess(`✅ Removed daemon: ${daemonName}`);
  } catch (error) {
    printError(`Failed to remove daemon: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showDaemonLogs(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const manager = DaemonManager.getInstance();
  await manager.initialize();

  if (args.length === 0) {
    printError('Daemon name is required');
    printInfo('Usage: flowx daemon logs <daemon-name> [options]');
    return;
  }

  const daemonName = args[0];

  try {
    const logs = await manager.getDaemonLogs(daemonName, options);
    
    if (logs.length === 0) {
      printInfo('No logs available');
      return;
    }

    console.log(successBold(`\n📄 Daemon Logs: ${daemonName}\n`));
    logs.forEach(log => console.log(log));

    if (options.follow) {
      printInfo('\nFollowing logs (Ctrl+C to stop)...');
      // In a real implementation, this would tail the log file
      printInfo('Real-time log following not implemented in this demo');
    }
  } catch (error) {
    printError(`Failed to show daemon logs: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function enableDaemon(context: CLIContext): Promise<void> {
  printInfo('Daemon auto-start enable/disable not implemented in this demo');
}

async function disableDaemon(context: CLIContext): Promise<void> {
  printInfo('Daemon auto-start enable/disable not implemented in this demo');
}

async function reloadDaemon(context: CLIContext): Promise<void> {
  printInfo('Daemon configuration reload not implemented in this demo');
}

// Helper functions

function getStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    running: '🟢 Running',
    stopped: '🔴 Stopped',
    failed: '❌ Failed',
    starting: '🟡 Starting',
    stopping: '🟠 Stopping',
    unknown: '⚪ Unknown'
  };
  return statusMap[status] || status;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default daemonCommand; 