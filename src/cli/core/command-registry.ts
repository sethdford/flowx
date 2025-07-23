/**
 * Command Registry
 * Central registry for all CLI commands
 */

import type { CLICommand, CLIContext } from '../interfaces/index.js';

// System Commands
import { statusCommand } from '../commands/system/status-command.js';
import { configCommand } from '../commands/system/config-command.js';
import { monitorCommand } from '../commands/system/monitor-command.js';
import { monitorDashboardCommand } from '../commands/system/monitor-dashboard-command.js';
import { webUICommand } from '../commands/system/web-ui-command.js';
import { workflowDesignerCommand } from '../commands/system/workflow-designer-command.js';
import { logsCommand } from '../commands/system/logs-command.js';
import { initCommand } from '../commands/system/initialization-command.js';
import { startCommand } from '../commands/system/start-command-integration.js';
import { stopCommand } from '../commands/system/stop-command.js';
import { restartCommand } from '../commands/system/restart-command.js';
import { sparcCommand } from '../commands/system/sparc-command.js';
import { batchCommand } from '../commands/system/batch-command.js';
import { taskCommand } from '../commands/tasks/task-command.js';
import { todoCommand } from '../commands/todo/todo-command-simple.js';
import { workflowCommand } from '../commands/system/workflow-command.js';
import { migrationCommand } from '../commands/system/migration-command.js';
import { uiCommand } from '../commands/system/ui-command.js';
import { terminalCommand } from '../commands/system/terminal-command.js';
import { benchmarkCommand } from '../commands/system/benchmark-command.js';
import { healthCommand } from '../commands/system/health-command.js';
import { validateCommand } from '../commands/system/validate-command.js';
import { scaleCommand } from '../commands/system/scale-command.js';
import { backupCommand } from '../commands/system/backup-command.js';
import { restoreCommand } from '../commands/system/restore-command.js';
import { daemonCommand } from '../commands/system/daemon-command.js';
import { servicesCommand } from '../commands/system/services-command.js';
import { systemCommand } from '../commands/system/system-command.js';
import { runCommand } from '../commands/system/run-command.js';
import { claudeCommand } from '../commands/system/claude-command.js';
import { sessionCommand } from '../commands/system/session-command.js';
import { infrastructureCommand } from '../commands/system/infrastructure-command.js';

// MCP Commands
import { mcpCommand } from '../commands/system/mcp-command.js';
import mcpToolsCommand from '../commands/system/mcp-tools-command.js';

// Neural Commands
import { neuralCommand } from '../commands/neural/neural-command.js';

// Claude API Commands
import { claudeApiCommand } from '../commands/claude/claude-api-command.js';

// Agent Commands
import { agentCommand } from '../commands/agents/agent-management-command.js';
import { spawnCommand } from '../commands/agents/spawn-command.js';
import { killCommand } from '../commands/agents/kill-command.js';
import { execCommand } from '../commands/agents/exec-command.js';

// Swarm Commands
import { swarmCommand } from '../commands/swarm.js';

// Memory Commands
import { memoryCommand } from '../commands/memory/memory-management-command.js';

// Data Commands
import { queryCommand } from '../commands/data/query-command.js';
import { analyzeCommand } from '../commands/system/analyze-command.js';
import { debugCommand } from '../commands/system/debug-command.js';

// Refactor Commands
import { refactorCommand } from '../commands/refactor/refactor-command.js';
import { architectCommand } from '../commands/refactor/architect-command.js';
import { qualityCommand } from '../commands/refactor/quality-command.js';

  // GitHub Commands
  import githubAutomationCommand from '../commands/github/github-automation.js';
  import visualWorkflowDesignerCommand from '../commands/system/visual-workflow-designer.js';

// Hive-Mind Commands
import { hiveMindCommand } from '../commands/hive-mind/hive-mind-command.js';

// Hooks Commands (simplified interface compatible with strip-only mode)
import { hooksCommand as hooksCommandSimple } from '../commands/system/hooks-command.js';

// Create a compatibility wrapper for the hooks command
const hooksCommand: CLICommand = {
  name: hooksCommandSimple.name,
  description: hooksCommandSimple.description,
  usage: hooksCommandSimple.usage,
  examples: hooksCommandSimple.examples,
  handler: async (context: CLIContext) => {
    // Convert CLIContext to SimpleCLIContext
    const simpleContext = {
      args: context.args,
      options: context.options
    };
    return hooksCommandSimple.handler(simpleContext);
  }
};

// Import fix-hook-variables command
import { fixHookVariablesCommand } from '../commands/system/fix-hook-variables-command.js';

// Import REPL command
import { replCommand } from '../commands/system/repl-command.js';

/**
 * Command Registry
 * Maps command names to their implementations
 */
export const commandRegistry = new Map<string, any>();

// Initialize the command registry
commandRegistry.set('status', statusCommand);
commandRegistry.set('config', configCommand);
commandRegistry.set('monitor', monitorCommand);
commandRegistry.set('monitor-dashboard', monitorDashboardCommand);
commandRegistry.set('web-ui', webUICommand);
commandRegistry.set('workflow-designer', workflowDesignerCommand);
commandRegistry.set('logs', logsCommand);
commandRegistry.set('init', initCommand);
commandRegistry.set('start', startCommand);
commandRegistry.set('stop', stopCommand);
commandRegistry.set('restart', restartCommand);
commandRegistry.set('sparc', sparcCommand);
commandRegistry.set('batch', batchCommand);
commandRegistry.set('task', taskCommand);
commandRegistry.set('todo', todoCommand);
commandRegistry.set('workflow', workflowCommand);
commandRegistry.set('migration', migrationCommand);
commandRegistry.set('ui', uiCommand);
commandRegistry.set('terminal', terminalCommand);
commandRegistry.set('benchmark', benchmarkCommand);
commandRegistry.set('health', healthCommand);
commandRegistry.set('validate', validateCommand);
commandRegistry.set('scale', scaleCommand);
commandRegistry.set('backup', backupCommand);
commandRegistry.set('restore', restoreCommand);
commandRegistry.set('daemon', daemonCommand);
commandRegistry.set('services', servicesCommand);
commandRegistry.set('system', systemCommand);
commandRegistry.set('run', runCommand);
commandRegistry.set('claude', claudeCommand);
commandRegistry.set('session', sessionCommand);
commandRegistry.set('infrastructure', infrastructureCommand);
commandRegistry.set('repl', replCommand);

// MCP Commands
commandRegistry.set('mcp', mcpCommand);
commandRegistry.set('mcp-tools', mcpToolsCommand);

// Neural Commands
commandRegistry.set('neural', neuralCommand);

// Claude API Commands
commandRegistry.set('claude-api', claudeApiCommand);

// Agent Commands
commandRegistry.set('agent', agentCommand);
commandRegistry.set('spawn', spawnCommand);
commandRegistry.set('kill', killCommand);
commandRegistry.set('exec', execCommand);

// Swarm Commands
commandRegistry.set('swarm', swarmCommand);

// Memory Commands
commandRegistry.set('memory', memoryCommand);

// Data Commands
commandRegistry.set('query', queryCommand);
commandRegistry.set('analyze', analyzeCommand);
commandRegistry.set('debug', debugCommand);

// Refactor Commands  
commandRegistry.set('refactor', refactorCommand);
commandRegistry.set('architect', architectCommand);
commandRegistry.set('quality', qualityCommand);

// GitHub Commands
commandRegistry.set('github', githubAutomationCommand);
commandRegistry.set('visual-workflow', visualWorkflowDesignerCommand);

// Hive-Mind Commands
commandRegistry.set('hive-mind', hiveMindCommand);

// Hooks Commands
commandRegistry.set('hooks', hooksCommand);
commandRegistry.set('fix-hook-variables', fixHookVariablesCommand);

// Add compatibility commands for backward compatibility with original flowx
const compatibilityCommands = createCompatibilityCommands();
compatibilityCommands.forEach(cmd => {
  commandRegistry.set(cmd.name, cmd);
});

// Command aliases
const aliases = new Map<string, string>([
  ['ps', 'agent'],
  ['ls', 'agent'],
  ['agents', 'agent'],
  ['ps-agent', 'agent'],
  ['kill-agent', 'kill'],
  ['exec-agent', 'exec'],
  ['spawn-agent', 'spawn'],
  ['log', 'logs'],
  ['cfg', 'config'],
  ['conf', 'config'],
  ['sys', 'system'],
  ['svc', 'services'],
  ['db', 'query'],
  ['q', 'query'],
  ['stats', 'status'],
  ['st', 'status'],
  ['mem', 'memory'],
  ['mem-stats', 'memory'],
  ['brain', 'hive-mind'],
  ['hm', 'hive-mind'],
  ['arch', 'architect'],
  ['ref', 'refactor'],
  ['qa', 'quality'],
  ['check', 'quality'],
  // Backward compatibility aliases for original flowx
  ['terminal', 'terminal'],  // Original terminal command  
  ['monitor', 'monitor'],    // Original monitor command
  ['workflow', 'workflow'],  // Original workflow command
  ['repl', 'repl'],         // Original REPL command
]);

/**
 * Create compatibility wrapper commands for original flowx commands
 */
function createCompatibilityCommands(): CLICommand[] {
  // Create a compatibility wrapper for the direct 'project' command
  const projectCompatCommand: CLICommand = {
    name: 'project',
    description: 'Project management (compatibility wrapper)',
    usage: 'project <subcommand> [options]',
    examples: [
      'flowx project create myproject',
      'flowx project list',
      'flowx project switch myproject'
    ],
    handler: async (context: CLIContext) => {
      const subcommand = context.args[0];
      
      switch (subcommand) {
        case 'create':
          // Map to init command
          const initContext = {
            ...context,
            args: context.args.slice(1),
            command: 'init'
          };
          return initCommand.handler(initContext);
          
        case 'list':
          console.log('📋 Available projects managed by FlowX');
          console.log('Use "flowx init --help" to create new projects');
          break;
          
        case 'switch':
          console.log('🔄 Project switching in FlowX');
          console.log('Use "flowx start" in the target project directory');
          break;
          
        default:
          console.log('Available project commands: create, list, switch');
          console.log('Use "flowx project <command> --help" for details');
      }
    }
  };

  return [projectCompatCommand];
}

/**
 * Get all registered commands
 */
export function getAllCommands(): CLICommand[] {
  return Array.from(commandRegistry.values());
}

/**
 * Get command by name
 */
export function getCommand(name: string): CLICommand | undefined {
  // Try direct command name first
  let command = commandRegistry.get(name);
  
  if (!command) {
    // Try alias
    const aliasTarget = aliases.get(name);
    if (aliasTarget) {
      command = commandRegistry.get(aliasTarget);
    }
  }
  
  return command;
}

/**
 * Get a command by name or alias
 */
export function getCommandByNameOrAlias(name: string): CLICommand | undefined {
  // Check direct command name
  if (commandRegistry.has(name)) {
    return commandRegistry.get(name);
  }
  
  // Check aliases
  const aliasTarget = aliases.get(name);
  if (aliasTarget && commandRegistry.has(aliasTarget)) {
    return commandRegistry.get(aliasTarget);
  }
  
  return undefined;
}

/**
 * Get commands grouped by category
 */
export function getCommandsByCategory(): Map<string, CLICommand[]> {
  const categorized = new Map<string, CLICommand[]>();
  
  for (const command of commandRegistry.values()) {
    const category = command.category || 'General';
    if (!categorized.has(category)) {
      categorized.set(category, []);
    }
    categorized.get(category)!.push(command);
  }
  
  return categorized;
}

/**
 * Register a new command
 */
export function registerCommand(name: string, command: CLICommand): void {
  commandRegistry.set(name, command);
}

/**
 * Unregister a command
 */
export function unregisterCommand(name: string): boolean {
  return commandRegistry.delete(name);
}

export default {
  commandRegistry,
  getAllCommands,
  getCommand,
  getCommandByNameOrAlias,
  getCommandsByCategory,
  registerCommand,
  unregisterCommand
}; 