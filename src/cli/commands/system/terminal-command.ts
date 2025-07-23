/**
 * Terminal Command
 * Manage terminal sessions and execution environments
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { TerminalManager } from '../../../terminal/manager.js';
import { TerminalConfig, AgentProfile } from '../../../utils/types.js';
import { EventBus } from '../../../core/event-bus.js';
import { createConsoleLogger } from '../../../utils/logger.js';
import { generateId } from '../../../utils/helpers.js';

// Global terminal manager instance
let terminalManager: TerminalManager | null = null;

async function getTerminalManager(): Promise<TerminalManager> {
  if (!terminalManager) {
    const config: TerminalConfig = {
      type: 'native',
      poolSize: 5,
      recycleAfter: 100,
      healthCheckInterval: 30000,
      commandTimeout: 30000
    };

    const eventBus = EventBus.getInstance();
    const logger = createConsoleLogger('terminal-manager');

    terminalManager = new TerminalManager(config, eventBus, logger);
    await terminalManager.initialize();
  }

  return terminalManager;
}

export const terminalCommand: CLICommand = {
  name: 'terminal',
  description: 'Manage terminal sessions and execution environments',
  category: 'System',
  usage: 'flowx terminal <subcommand> [OPTIONS]',
  examples: [
    'flowx terminal list',
    'flowx terminal spawn --agent researcher',
    'flowx terminal exec <terminal-id> "ls -la"',
    'flowx terminal kill <terminal-id>',
    'flowx terminal health',
    'flowx terminal maintenance'
  ],
  options: [
    {
      name: 'agent',
      short: 'a',
      description: 'Agent profile for terminal',
      type: 'string'
    },
    {
      name: 'shell',
      short: 's',
      description: 'Shell type (bash, zsh, sh, powershell, cmd)',
      type: 'string'
    },
    {
      name: 'timeout',
      short: 't',
      description: 'Command timeout in milliseconds',
      type: 'number',
      default: 30000
    },
    {
      name: 'follow',
      short: 'f',
      description: 'Follow terminal output',
      type: 'boolean'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output',
      type: 'boolean'
    }
  ],
  subcommands: [
    {
      name: 'list',
      description: 'List all active terminal sessions',
      handler: async (context: CLIContext) => await listTerminals(context)
    },
    {
      name: 'spawn',
      description: 'Spawn a new terminal session',
      handler: async (context: CLIContext) => await spawnTerminal(context)
    },
    {
      name: 'exec',
      description: 'Execute command in terminal',
      handler: async (context: CLIContext) => await executeCommand(context)
    },
    {
      name: 'kill',
      description: 'Terminate a terminal session',
      handler: async (context: CLIContext) => await killTerminal(context)
    },
    {
      name: 'health',
      description: 'Check terminal manager health',
      handler: async (context: CLIContext) => await checkHealth(context)
    },
    {
      name: 'maintenance',
      description: 'Perform terminal maintenance',
      handler: async (context: CLIContext) => await performMaintenance(context)
    },
    {
      name: 'stream',
      description: 'Stream terminal output',
      handler: async (context: CLIContext) => await streamOutput(context)
    },
    {
      name: 'history',
      description: 'Show command history for terminal',
      handler: async (context: CLIContext) => await showHistory(context)
    },
    {
      name: 'status',
      description: 'Show terminal status',
      handler: async (context: CLIContext) => await showStatus(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { args } = context;
    
    if (args.length === 0) {
      await listTerminals(context);
      return;
    }
    
    printError('Invalid subcommand. Use "flowx terminal --help" for usage information.');
  }
};

// Subcommand handlers

async function listTerminals(context: CLIContext): Promise<void> {
  try {
    const manager = await getTerminalManager();
    const sessions = manager.getActiveSessions();
    
    if (sessions.length === 0) {
      printInfo('No active terminal sessions');
      return;
    }

    console.log(successBold('\n🖥️  Active Terminal Sessions\n'));

    const tableData = sessions.map(session => ({
      id: session.id,
      agentId: session.agentId,
      status: session.status === 'active' ? '🟢 Active' : '🔴 Error',
      started: session.startTime.toLocaleString(),
      lastActivity: session.lastActivity ? session.lastActivity.toLocaleString() : 'N/A',
      terminalId: session.terminalId
    }));

    console.log(formatTable(tableData, [
      { header: 'Session ID', key: 'id' },
      { header: 'Agent', key: 'agentId' },
      { header: 'Status', key: 'status' },
      { header: 'Started', key: 'started' },
      { header: 'Last Activity', key: 'lastActivity' },
      { header: 'Terminal ID', key: 'terminalId' }
    ]));

    console.log();
    printSuccess(`Total sessions: ${sessions.length}`);

  } catch (error) {
    printError(`Failed to list terminals: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function spawnTerminal(context: CLIContext): Promise<void> {
  const { options } = context;

  try {
    const manager = await getTerminalManager();
    
    // Create agent profile
    const agentProfile: AgentProfile = {
      id: options.agent || generateId('agent'),
      name: options.agent || 'default',
      type: 'custom',
      capabilities: ['terminal'],
      systemPrompt: 'You are a terminal execution agent',
      maxConcurrentTasks: 1,
      priority: 1,
      shell: options.shell || (process.platform === 'win32' ? 'powershell' : 'bash'),
      metadata: {
        shell: options.shell,
        initCommands: options.shell === 'bash' ? ['export PS1="[flowx]$ "'] : undefined
      }
    };

    printInfo('Spawning new terminal session...');
    const terminalId = await manager.spawnTerminal(agentProfile);
    
    printSuccess(`✅ Terminal spawned successfully!`);
    printInfo(`Terminal ID: ${terminalId}`);
    printInfo(`Agent: ${agentProfile.name}`);
    printInfo(`Shell: ${options.shell || 'default'}`);
    
    if (options.follow) {
      printInfo('Following terminal output (Ctrl+C to stop)...');
      await streamTerminalOutput(terminalId, manager);
    }

  } catch (error) {
    printError(`Failed to spawn terminal: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function executeCommand(context: CLIContext): Promise<void> {
  const { args, options } = context;

  if (args.length < 2) {
    printError('Usage: flowx terminal exec <terminal-id> <command>');
    return;
  }

  const terminalId = args[0];
  const command = args.slice(1).join(' ');

  try {
    const manager = await getTerminalManager();
    
    printInfo(`Executing command in terminal ${terminalId}...`);
    if (options.verbose) {
      printInfo(`Command: ${command}`);
    }

    const result = await manager.executeCommand(terminalId, command);
    
    console.log(successBold('\n📋 Command Output\n'));
    console.log(result);
    
    printSuccess('✅ Command executed successfully');

  } catch (error) {
    printError(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function killTerminal(context: CLIContext): Promise<void> {
  const { args } = context;

  if (args.length === 0) {
    printError('Usage: flowx terminal kill <terminal-id>');
    return;
  }

  const terminalId = args[0];

  try {
    const manager = await getTerminalManager();
    
    printInfo(`Terminating terminal ${terminalId}...`);
    await manager.terminateTerminal(terminalId);
    
    printSuccess(`✅ Terminal ${terminalId} terminated successfully`);

  } catch (error) {
    printError(`Failed to terminate terminal: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkHealth(context: CLIContext): Promise<void> {
  try {
    const manager = await getTerminalManager();
    const health = await manager.getHealthStatus();
    
    console.log(successBold('\n🏥 Terminal Manager Health Status\n'));
    
    const status = health.healthy ? '🟢 Healthy' : '🔴 Unhealthy';
    console.log(`Status: ${status}`);
    
    if (health.error) {
      console.log(`Error: ${health.error}`);
    }
    
    if (health.metrics) {
      console.log('\nMetrics:');
      Object.entries(health.metrics).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    console.log();

  } catch (error) {
    printError(`Failed to check health: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function performMaintenance(context: CLIContext): Promise<void> {
  try {
    const manager = await getTerminalManager();
    
    printInfo('Performing terminal maintenance...');
    await manager.performMaintenance();
    
    printSuccess('✅ Terminal maintenance completed');

  } catch (error) {
    printError(`Failed to perform maintenance: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function streamOutput(context: CLIContext): Promise<void> {
  const { args } = context;

  if (args.length === 0) {
    printError('Usage: flowx terminal stream <terminal-id>');
    return;
  }

  const terminalId = args[0];

  try {
    const manager = await getTerminalManager();
    
    printInfo(`Streaming output from terminal ${terminalId} (Ctrl+C to stop)...`);
    console.log('─'.repeat(50));
    
    await streamTerminalOutput(terminalId, manager);

  } catch (error) {
    printError(`Failed to stream output: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function showHistory(context: CLIContext): Promise<void> {
  const { args } = context;

  if (args.length === 0) {
    printError('Usage: flowx terminal history <terminal-id>');
    return;
  }

  const terminalId = args[0];

  try {
    const manager = await getTerminalManager();
    const session = manager.getSession(terminalId);
    
    if (!session) {
      printError(`Terminal session not found: ${terminalId}`);
      return;
    }

    const history = session.getCommandHistory();
    
    if (history.length === 0) {
      printInfo('No command history for this terminal');
      return;
    }

    console.log(successBold(`\n📜 Command History for ${terminalId}\n`));
    
    history.forEach((command, index) => {
      console.log(`${(index + 1).toString().padStart(3)}: ${command}`);
    });
    
    console.log();
    printSuccess(`Total commands: ${history.length}`);

  } catch (error) {
    printError(`Failed to show history: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function showStatus(context: CLIContext): Promise<void> {
  try {
    const manager = await getTerminalManager();
    const health = await manager.getHealthStatus();
    const sessions = manager.getActiveSessions();
    
    console.log(successBold('\n🖥️  Terminal Manager Status\n'));
    
    const statusData = [
      { label: 'Health', value: health.healthy ? '🟢 Healthy' : '🔴 Unhealthy' },
      { label: 'Active Sessions', value: sessions.length },
      { label: 'Pool Size', value: health.metrics?.poolSize || 'N/A' },
      { label: 'Available Terminals', value: health.metrics?.availableTerminals || 'N/A' },
      { label: 'Recycled Terminals', value: health.metrics?.recycledTerminals || 'N/A' }
    ];

    statusData.forEach(({ label, value }) => {
      console.log(`${label.padEnd(20)}: ${value}`);
    });

    if (health.error) {
      console.log();
      printWarning(`Error: ${health.error}`);
    }

    console.log();

  } catch (error) {
    printError(`Failed to show status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper functions

async function streamTerminalOutput(terminalId: string, manager: TerminalManager): Promise<void> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    
    const cleanup = () => {
      if (unsubscribe) {
        unsubscribe();
      }
      resolve();
    };

    // Handle Ctrl+C
    const handleExit = () => {
      console.log('\n\nStream interrupted by user');
      cleanup();
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    manager.streamOutput(terminalId, (output: string) => {
      process.stdout.write(output);
    }).then((unsub) => {
      unsubscribe = unsub;
    }).catch(reject);
  });
}

export default terminalCommand; 