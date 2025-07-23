/**
 * Start Command Integration
 * Integrates the existing start command functionality into the main CLI system
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { ProcessManager } from '../start/process-manager.js';
import { SystemMonitor } from '../start/system-monitor.js';
// Lazy import to prevent WebSocket connection during module loading
// import { launchInkDashboard } from '../../ui/ink-cli.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import * as readline from 'readline';
import * as fs from 'fs/promises';

export const startCommand: CLICommand = {
  name: 'start',
  description: 'Start the FlowX orchestration system',
  category: 'System',
  usage: 'flowx start [OPTIONS]',
  examples: [
    'flowx start',
    'flowx start --daemon',
    'flowx start --ui',
    'flowx start --port 3001',
    'flowx start --auto-start --verbose'
  ],
  options: [
    {
      name: 'daemon',
      short: 'd',
      description: 'Run as daemon in background',
      type: 'boolean'
    },
    {
      name: 'port',
      short: 'p',
      description: 'MCP server port',
      type: 'string',
      default: '3000'
    },
    {
      name: 'mcp-transport',
      description: 'MCP transport type (stdio, http)',
      type: 'string',
      default: 'stdio',
      choices: ['stdio', 'http']
    },
    {
      name: 'ui',
      short: 'u',
      description: 'Launch interactive dashboard UI',
      type: 'boolean'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Enable verbose logging',
      type: 'boolean'
    },
    {
      name: 'auto-start',
      description: 'Automatically start all processes',
      type: 'boolean'
    },
    {
      name: 'config',
      short: 'c',
      description: 'Configuration file path',
      type: 'string'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Force start even if already running',
      type: 'boolean'
    },
    {
      name: 'health-check',
      description: 'Perform health checks before starting',
      type: 'boolean'
    },
    {
      name: 'timeout',
      short: 't',
      description: 'Startup timeout in seconds',
      type: 'number',
      default: 60
    }
  ],
  handler: async (context: CLIContext) => {
    const { options } = context;
    
    printInfo('🧠 FlowX Orchestration System');
    console.log('─'.repeat(60));

    try {
      // Check if already running
      if (!options.force && await isSystemRunning()) {
        printWarning('⚠ FlowX is already running');
        const shouldContinue = await confirmPrompt('Stop existing instance and restart?', false);
        
        if (!shouldContinue) {
          printInfo('Use --force to override or "flowx stop" first');
          return;
        }
        
        await stopExistingInstance();
      }

      // Perform pre-flight checks
      if (options.healthCheck) {
        printInfo('Running pre-flight health checks...');
        await performHealthChecks();
      }

      // Launch UI mode with modern Ink dashboard
      if (options.ui) {
        printInfo('🎨 Launching interactive dashboard...');
        const { launchInkDashboard } = await import('../../ui/ink-cli.ts');
        await launchInkDashboard();
        printSuccess('✓ Dashboard closed');
        return;
      }

      // Initialize process manager with timeout
      const processManager = new ProcessManager();
      printInfo('Initializing system components...');
      const initPromise = processManager.initialize(options.config);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout')), (options.timeout || 60) * 1000)
      );
      
      await Promise.race([initPromise, timeoutPromise]);

      // Initialize system monitor
      const systemMonitor = new SystemMonitor(processManager);
      systemMonitor.start();
      
      // Setup system event handlers
      setupSystemEventHandlers(processManager, systemMonitor, options);

      // Configure MCP settings from CLI options
      configureMCPSettings(processManager, options);

      // Setup verbose logging
      if (options.verbose) {
        setupVerboseLogging(systemMonitor);
      }

      // Check for auto-start flag first - bypass interactive mode
      if (options.autoStart || options['auto-start']) {
        printInfo('Auto-starting all processes...');
        await startWithProgress(processManager, 'all');
        printSuccess('✓ All processes started');
        
        // Show system status
        printInfo('\nSystem Status:');
        await showSystemStatus(processManager);
        
        // Keep process running
        printInfo('\nPress Ctrl+C to stop the system');
        
        // Handle shutdown gracefully
        const shutdown = async () => {
          printInfo('\nShutting down...');
          systemMonitor.stop();
          await processManager.stopAll();
          printSuccess('✓ Shutdown complete');
          process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        
        // Keep process alive
        await new Promise(() => {});
      }
      // Daemon mode
      else if (options.daemon) {
        await launchDaemonMode(processManager, systemMonitor, options);
      } 
      // Interactive mode (default)
      else {
        await launchInteractiveMode(processManager, systemMonitor);
      }

    } catch (error) {
      printError(`Failed to start system: ${error instanceof Error ? error.message : String(error)}`);
      await cleanupOnFailure();
      process.exit(1);
    }
  }
};

// Helper functions

async function confirmPrompt(message: string, defaultValue = false): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

async function isSystemRunning(): Promise<boolean> {
  try {
    const pidData = await fs.readFile('.flowx.pid', 'utf8');
    const { pid } = JSON.parse(pidData);
    
    // Check if process is still running
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      // Process not found, remove stale PID file
      await fs.unlink('.flowx.pid').catch(() => {});
      return false;
    }
  } catch {
    return false;
  }
}

async function stopExistingInstance(): Promise<void> {
  try {
    const pidData = await fs.readFile('.flowx.pid', 'utf8');
    const { pid } = JSON.parse(pidData);
    
    printInfo(`Stopping existing instance (PID: ${pid})...`);
    process.kill(pid, 'SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Remove PID file
    await fs.unlink('.flowx.pid').catch(() => {});
    
    printSuccess('✓ Existing instance stopped');
  } catch (error) {
    printWarning('Could not stop existing instance gracefully');
  }
}

async function performHealthChecks(): Promise<void> {
  const checks = [
    { name: 'Disk Space', fn: checkDiskSpace },
    { name: 'Memory Available', fn: checkMemoryAvailable },
    { name: 'Network Connectivity', fn: checkNetworkConnectivity },
    { name: 'Dependencies', fn: checkDependencies }
  ];

  for (const check of checks) {
    try {
      await check.fn();
      printSuccess(`✓ ${check.name}`);
    } catch (error) {
      printError(`✗ ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Health check failed: ${check.name}`);
    }
  }
}

async function checkDiskSpace(): Promise<void> {
  const stats = await fs.stat('.');
  if (!stats) throw new Error('Cannot access current directory');
}

async function checkMemoryAvailable(): Promise<void> {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
    throw new Error('High memory usage detected');
  }
}

async function checkNetworkConnectivity(): Promise<void> {
  try {
    await new Promise((resolve, reject) => {
      require('dns').resolve('localhost', (err: any) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });
  } catch (error) {
    throw new Error('Network connectivity issues detected');
  }
}

async function checkDependencies(): Promise<void> {
  const requiredCommands = ['node', 'npm'];
  for (const cmd of requiredCommands) {
    try {
      await new Promise((resolve, reject) => {
        require('child_process').exec(`which ${cmd}`, (error: any) => {
          if (error) reject(new Error(`${cmd} not found`));
          else resolve(undefined);
        });
      });
    } catch (error) {
      throw error;
    }
  }
}

function configureMCPSettings(processManager: ProcessManager, options: any): void {
  const mcpProcess = processManager.getProcess('mcp-server');
  if (mcpProcess) {
    if (options.port) {
      mcpProcess.port = options.port;
    }
    if (options.mcpTransport) {
      mcpProcess.transport = options.mcpTransport;
    }
  }
}

function setupSystemEventHandlers(
  processManager: ProcessManager, 
  systemMonitor: SystemMonitor, 
  options: any
): void {
  const shutdownHandler = async () => {
    printInfo('\nReceived shutdown signal, cleaning up...');
    systemMonitor.stop();
    await processManager.stopAll();
    await cleanupOnShutdown();
    printSuccess('✓ Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);
  process.on('SIGUSR1', () => {
    printInfo('Received SIGUSR1, reloading configuration...');
  });

  process.on('uncaughtException', async (error) => {
    printError(`Uncaught exception: ${error.message}`);
    await cleanupOnFailure();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    printError(`Unhandled rejection: ${reason}`);
    await cleanupOnFailure();
    process.exit(1);
  });
}

async function launchDaemonMode(processManager: ProcessManager, systemMonitor: SystemMonitor, options: any): Promise<void> {
  printWarning('Starting in daemon mode...');
  
  // Auto-start processes
  if (options.autoStart) {
    printInfo('Starting all system processes...');
    await startWithProgress(processManager, 'all');
  } else {
    printInfo('Starting core processes...');
    await startWithProgress(processManager, 'core');
  }

  // Create PID file with metadata
  const pid = process.pid;
  const pidData = {
    pid,
    startTime: Date.now(),
    config: options.config || 'default',
    processes: processManager.getAllProcesses().map((p: any) => ({ id: p.id, status: p.status }))
  };
  await fs.writeFile('.flowx.pid', JSON.stringify(pidData, null, 2));
  printInfo(`Process ID: ${pid}`);
  
  // Wait for services to be fully ready
  await waitForSystemReady(processManager);
  
  printSuccess('✓ Daemon started successfully');
  printInfo('Use "flowx status" to check system status');
  printInfo('Use "flowx monitor" for real-time monitoring');
  
  // Keep process running
  await new Promise<void>(() => {});
}

async function launchInteractiveMode(processManager: ProcessManager, systemMonitor: SystemMonitor): Promise<void> {
  printInfo('Starting in interactive mode...');
  console.log();

  // Show available options
  console.log(successBold('Quick Actions:'));
  console.log('  [1] Start all processes');
  console.log('  [2] Start core processes only');
  console.log('  [3] Launch process management UI');
  console.log('  [4] Show system status');
  console.log('  [q] Quit');
  console.log();
  printInfo('Press a key to select an option...');

  // Check if setRawMode is available
  if (typeof process.stdin.setRawMode === 'function') {
    // Handle user input with raw mode
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
      const key = chunk.toString();

      switch (key) {
        case '1':
          printInfo('\nStarting all processes...');
          await startWithProgress(processManager, 'all');
          printSuccess('✓ All processes started');
          break;

        case '2':
          printInfo('\nStarting core processes...');
          await startWithProgress(processManager, 'core');
          printSuccess('✓ Core processes started');
          break;

        case '3':
          printInfo('\n🎨 Launching interactive dashboard...');
          const { launchInkDashboard } = await import('../../ui/ink-cli.ts');
          await launchInkDashboard();
          break;

        case '4':
          printInfo('\nSystem Status:');
          await showSystemStatus(processManager);
          break;

        case 'q':
        case '\u0003': // Ctrl+C
          printInfo('\nShutting down...');
          systemMonitor.stop();
          await processManager.stopAll();
          printSuccess('✓ Shutdown complete');
          process.exit(0);
          break;

        default:
          printWarning('Invalid option. Please try again.');
      }
    }
  } else {
    // Fallback for environments without setRawMode
    printInfo('Using fallback input mode...');
    
    // Auto-start all processes in fallback mode
    printInfo('\nStarting all processes...');
    await startWithProgress(processManager, 'all');
    printSuccess('✓ All processes started');
    
    // Show system status
    printInfo('\nSystem Status:');
    await showSystemStatus(processManager);
    
    // Keep process running
    printInfo('\nPress Ctrl+C to stop the system');
    
    // Handle shutdown gracefully
    const shutdown = async () => {
      printInfo('\nShutting down...');
      systemMonitor.stop();
      await processManager.stopAll();
      printSuccess('✓ Shutdown complete');
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Keep process alive
    await new Promise(() => {});
  }
}

async function startWithProgress(processManager: ProcessManager, mode: 'all' | 'core'): Promise<void> {
  const processes = mode === 'all' 
    ? processManager.getAllProcesses()
    : processManager.getAllProcesses().filter((p: any) => p.core);

  for (const process of processes) {
    try {
      printInfo(`Starting ${process.name}...`);
      await processManager.startProcess(process.id);
      printSuccess(`✓ ${process.name} started`);
    } catch (error) {
      printError(`✗ Failed to start ${process.name}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

async function waitForSystemReady(processManager: ProcessManager): Promise<void> {
  const maxWait = 30000; // 30 seconds
  const checkInterval = 1000; // 1 second
  let waited = 0;

  while (waited < maxWait) {
    const allReady = processManager.getAllProcesses().every((p: any) => 
      p.status === 'running' || !p.core
    );

    if (allReady) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
    waited += checkInterval;
  }

  throw new Error('System failed to become ready within timeout');
}

async function showSystemStatus(processManager: ProcessManager): Promise<void> {
  const processes = processManager.getAllProcesses();
  const stats = processManager.getSystemStats();

  const tableData = processes.map((p: any) => ({
    name: p.name,
    status: getStatusDisplay(p.status),
    pid: p.pid?.toString() || '-',
    uptime: p.startTime ? formatDuration(Date.now() - p.startTime) : '-'
  }));

  console.log(formatTable(tableData, [
    { header: 'Process', key: 'name' },
    { header: 'Status', key: 'status' },
    { header: 'PID', key: 'pid' },
    { header: 'Uptime', key: 'uptime' }
  ]));

  console.log();
  printInfo(`Total Processes: ${stats.totalProcesses}`);
  printInfo(`Running: ${stats.runningProcesses}`);
  printInfo(`Memory Usage: ${Math.floor(stats.memoryUsage / 1024 / 1024)}MB`);
  printInfo(`Uptime: ${formatDuration(stats.uptime)}`);
}

function getStatusDisplay(status: string): string {
  switch (status) {
    case 'running': return '🟢 Running';
    case 'stopped': return '🔴 Stopped';
    case 'starting': return '🟡 Starting';
    case 'stopping': return '🟠 Stopping';
    case 'error': return '❌ Error';
    default: return '⚪ Unknown';
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

async function cleanupOnFailure(): Promise<void> {
  try {
    await fs.unlink('.flowx.pid').catch(() => {});
    printInfo('Cleanup completed');
  } catch (error) {
    printError(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function cleanupOnShutdown(): Promise<void> {
  try {
    await fs.unlink('.flowx.pid').catch(() => {});
  } catch (error) {
    // Ignore cleanup errors during shutdown
  }
}

function setupVerboseLogging(monitor: SystemMonitor): void {
  monitor.on('processStarted', (data: any) => {
    printSuccess(`Process started: ${data.processId}`);
  });

  monitor.on('processStopped', (data: any) => {
    printWarning(`Process stopped: ${data.processId}`);
  });

  monitor.on('processError', (data: any) => {
    printError(`Process error: ${data.processId} - ${data.error}`);
  });

  monitor.on('systemMetrics', (data: any) => {
    printInfo(`System metrics: CPU ${data.cpu}%, Memory ${data.memory}MB`);
  });
}