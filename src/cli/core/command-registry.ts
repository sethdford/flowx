/**
 * Command Registry
 * Central registry for all CLI commands
 */

import type { CLICommand } from '../interfaces/index.ts';

// System Commands
import { statusCommand } from '../commands/system/status-command.ts';
import { configCommand } from '../commands/system/config-command.ts';
import { monitorCommand } from '../commands/system/monitor-command.ts';
import { logsCommand } from '../commands/system/logs-command.ts';
import { initCommand } from '../commands/system/initialization-command.ts';
import { startCommand } from '../commands/system/start-command-integration.ts';
import { stopCommand } from '../commands/system/stop-command.ts';
import { restartCommand } from '../commands/system/restart-command.ts';
import { sparcCommand } from '../commands/system/sparc-command.ts';
import { batchCommand } from '../commands/system/batch-command.ts';
import { taskCommand } from '../commands/tasks/unified-task-command-simple.ts';
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

// Agent Commands
import { agentCommand } from '../commands/agents/agent-management-command.ts';

// Swarm Commands
import { swarmCommand } from '../commands/swarm/swarm-management-command.ts';

// Memory Commands
import { memoryCommand } from '../commands/memory/memory-management-command.ts';

/**
 * Command Registry
 * Maps command names to their implementations
 */
export const commandRegistry = new Map<string, CLICommand>([
  // System Commands
  ['status', statusCommand],
  ['config', configCommand],
  ['monitor', monitorCommand],
  ['logs', logsCommand],
  ['init', initCommand],
  ['start', startCommand],
  ['stop', stopCommand],
  ['restart', restartCommand],
  ['sparc', sparcCommand],
  ['batch', batchCommand],
  ['task', taskCommand],
  ['workflow', workflowCommand],
  ['migration', migrationCommand],
  ['ui', uiCommand],
  ['terminal', terminalCommand],
  ['benchmark', benchmarkCommand],
  ['health', healthCommand],
  ['validate', validateCommand],
  ['scale', scaleCommand],
  ['backup', backupCommand],
  ['restore', restoreCommand],
  ['daemon', daemonCommand],
  ['services', servicesCommand],
  ['system', systemCommand],

  // Agent Commands
  ['agent', agentCommand],

  // Swarm Commands
  ['swarm', swarmCommand],

  // Memory Commands
  ['memory', memoryCommand]
]);

// Command aliases
const aliases = new Map<string, string>([
  ['ps', 'agent'],
  ['agents', 'agent'],
  ['swarms', 'swarm'],
  ['mem', 'memory'],
  ['cfg', 'config'],
  ['conf', 'config'],
  ['svc', 'services'],
  ['service', 'services'],
  ['sys', 'system'],
  ['systemctl', 'services']
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
  return commandRegistry.get(name);
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