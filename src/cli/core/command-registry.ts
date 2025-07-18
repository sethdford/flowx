/**
 * Command Registry
 * Central registry for all CLI commands
 */

import type { CLICommand, CLIContext } from '../interfaces/index.ts';

// System Commands
import { statusCommand } from '../commands/system/status-command.ts';
import { configCommand } from '../commands/system/config-command.ts';
import { monitorCommand } from '../commands/system/monitor-command.ts';
import { monitorDashboardCommand } from '../commands/system/monitor-dashboard-command.ts';
import { webUICommand } from '../commands/system/web-ui-command.ts';
import { workflowDesignerCommand } from '../commands/system/workflow-designer-command.ts';
import { logsCommand } from '../commands/system/logs-command.ts';
import { initCommand } from '../commands/system/initialization-command.ts';
import { startCommand } from '../commands/system/start-command-integration.ts';
import { stopCommand } from '../commands/system/stop-command.ts';
import { restartCommand } from '../commands/system/restart-command.ts';
import { sparcCommand } from '../commands/system/sparc-command.ts';
import { batchCommand } from '../commands/system/batch-command.ts';
import { taskCommand } from '../commands/tasks/task-command.ts';
import { todoCommand } from '../commands/todo/todo-command-simple.ts';
import { workflowCommand } from '../commands/system/workflow-command.ts';
import { migrationCommand } from '../commands/system/migration-command.ts';
import { uiCommand } from '../commands/system/ui-command.ts';
import { terminalCommand } from '../commands/system/terminal-command.ts';
import { benchmarkCommand } from '../commands/system/benchmark-command.ts';
import { healthCommand } from '../commands/system/health-command.ts';
import { validateCommand } from '../commands/system/validate-command.ts';
import { scaleCommand } from '../commands/system/scale-command.ts';
import { backupCommand } from '../commands/system/backup-command.ts';
import { restoreCommand } from '../commands/system/restore-command.ts';
import { daemonCommand } from '../commands/system/daemon-command.ts';
import { servicesCommand } from '../commands/system/services-command.ts';
import { systemCommand } from '../commands/system/system-command.ts';
import { runCommand } from '../commands/system/run-command.ts';
import { claudeCommand } from '../commands/system/claude-command.ts';
import { sessionCommand } from '../commands/system/session-command.ts';
import { infrastructureCommand } from '../commands/system/infrastructure-command.ts';

// MCP Commands
import { mcpCommand } from '../commands/system/mcp-command.ts';
import mcpToolsCommand from '../commands/system/mcp-tools-command.ts';

// Neural Commands
import { neuralCommand } from '../commands/neural/neural-command.ts';

// Claude API Commands
import { claudeApiCommand } from '../commands/claude/claude-api-command.ts';

// Agent Commands
import { agentCommand } from '../commands/agents/agent-management-command.ts';
import { spawnCommand } from '../commands/agents/spawn-command.ts';
import { killCommand } from '../commands/agents/kill-command.ts';
import { execCommand } from '../commands/agents/exec-command.ts';

// Swarm Commands
import { swarmCommand } from '../commands/swarm/swarm-claude-launcher.ts';

// Memory Commands
import { memoryCommand } from '../commands/memory/memory-management-command.ts';

// Data Commands
import { queryCommand } from '../commands/data/query-command.ts';
import { analyzeCommand } from '../commands/system/analyze-command.ts';
import { debugCommand } from '../commands/system/debug-command.ts';

// Refactor Commands
import { refactorCommand } from '../commands/refactor/refactor-command.ts';
import { architectCommand } from '../commands/refactor/architect-command.ts';
import { qualityCommand } from '../commands/refactor/quality-command.ts';

  // GitHub Commands
  import githubAutomationCommand from '../commands/github/github-automation.ts';
  import visualWorkflowDesignerCommand from '../commands/system/visual-workflow-designer.ts';

// Hive-Mind Commands
import { hiveMindCommand } from '../commands/hive-mind/hive-mind-command.ts';

// Hooks Commands (simplified interface compatible with strip-only mode)
import { hooksCommand as hooksCommandSimple } from '../commands/system/hooks-command.ts';

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
import { fixHookVariablesCommand } from '../commands/system/fix-hook-variables-command.ts';

// Import REPL command
import { replCommand } from '../commands/system/repl-command.ts';

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
  ['check', 'quality']
]);

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