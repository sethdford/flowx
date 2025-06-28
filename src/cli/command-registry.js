// command-registry.js - Extensible command registration system
import { initCommand } from "./simple-commands/init.ts";
import { memoryCommand } from "./simple-commands/memory.ts";
import { sparcCommand } from "./simple-commands/sparc.ts";
import { agentCommand } from "./simple-commands/agent.ts";
import { taskCommand } from "./simple-commands/task.ts";
import { configCommand } from "./simple-commands/config.ts";
import { statusCommand } from "./simple-commands/status.ts";
import { mcpCommand } from "./simple-commands/mcp.ts";
import { monitorCommand } from "./simple-commands/monitor.ts";
import { startCommand } from "./simple-commands/start.ts";
import { swarmCommand } from "./simple-commands/swarm.ts";
import { batchManagerCommand } from "./simple-commands/batch-manager.ts";

// Command registry for extensible CLI
export const commandRegistry = new Map();

// Register core commands
export function registerCoreCommands() {
  commandRegistry.set('init', {
    handler: initCommand,
    description: 'Initialize Claude Code integration files and SPARC development environment',
    usage: 'init [--force] [--minimal] [--sparc]',
    examples: [
      'npx claude-flow@latest init --sparc  # Recommended: Full SPARC setup',
      'init --sparc                         # Initialize with SPARC modes',
      'init --force --minimal               # Minimal setup, overwrite existing',
      'init --sparc --force                 # Force SPARC setup'
    ],
    details: `
The --sparc flag creates a complete development environment:
  • .roomodes file containing 17 specialized SPARC modes
  • CLAUDE.md for AI-readable project instructions
  • Pre-configured modes: architect, code, tdd, debug, security, and more
  • Ready for TDD workflows and automated code generation
  
First-time users should run: npx claude-flow@latest init --sparc`
  });

  commandRegistry.set('start', {
    handler: startCommand,
    description: 'Start the Claude-Flow orchestration system',
    usage: 'start [--daemon] [--port <port>] [--verbose]',
    examples: [
      'start                    # Start in interactive mode',
      'start --daemon           # Start as background daemon',
      'start --port 8080        # Use custom MCP port',
      'start --verbose          # Show detailed system activity'
    ]
  });

  commandRegistry.set('memory', {
    handler: memoryCommand,
    description: 'Memory management operations',
    usage: 'memory <subcommand> [options]',
    examples: [
      'memory store key "value"',
      'memory query search_term',
      'memory stats',
      'memory export backup.json'
    ]
  });

  commandRegistry.set('sparc', {
    handler: sparcCommand,
    description: 'SPARC development mode operations',
    usage: 'sparc [subcommand] [options]',
    examples: [
      'sparc "orchestrate full app development"  # Default: sparc orchestrator',
      'sparc modes                               # List available modes',
      'sparc run code "implement feature"        # Run specific mode',
      'sparc tdd "feature description"           # TDD workflow',
      'sparc info architect                      # Mode details'
    ]
  });

  commandRegistry.set('agent', {
    handler: agentCommand,
    description: 'Manage AI agents and hierarchies',
    usage: 'agent <subcommand> [options]',
    examples: [
      'agent spawn researcher --name "DataBot"',
      'agent list --verbose',
      'agent hierarchy create enterprise',
      'agent ecosystem status'
    ]
  });

  commandRegistry.set('task', {
    handler: taskCommand,
    description: 'Manage tasks and workflows',
    usage: 'task <subcommand> [options]',
    examples: [
      'task create research "Market analysis"',
      'task list --filter running',
      'task workflow examples/dev-flow.json',
      'task coordination status'
    ]
  });

  commandRegistry.set('config', {
    handler: configCommand,
    description: 'Manage system configuration',
    usage: 'config <subcommand> [options]',
    examples: [
      'config init',
      'config set terminal.poolSize 15',
      'config get orchestrator.maxConcurrentTasks',
      'config validate'
    ]
  });

  commandRegistry.set('status', {
    handler: statusCommand,
    description: 'Show system status and health',
    usage: 'status [--verbose] [--json]',
    examples: [
      'status',
      'status --verbose',
      'status --json'
    ]
  });

  commandRegistry.set('mcp', {
    handler: mcpCommand,
    description: 'Manage MCP server and tools',
    usage: 'mcp <subcommand> [options]',
    examples: [
      'mcp status',
      'mcp start --port 8080',
      'mcp tools --verbose',
      'mcp auth setup'
    ]
  });

  commandRegistry.set('monitor', {
    handler: monitorCommand,
    description: 'Real-time system monitoring',
    usage: 'monitor [--watch] [--interval <ms>]',
    examples: [
      'monitor',
      'monitor --watch',
      'monitor --interval 1000 --watch',
      'monitor --format json'
    ]
  });

  commandRegistry.set('swarm', {
    handler: swarmCommand,
    description: 'Swarm-based AI agent coordination',
    usage: 'swarm <objective> [options]',
    examples: [
      'swarm "Build a REST API"',
      'swarm "Research cloud architecture" --strategy research',
      'swarm "Analyze data" --max-agents 3 --parallel',
      'swarm "Development task" --ui --monitor --background'
    ]
  });

  commandRegistry.set('batch', {
    handler: batchManagerCommand,
    description: 'Batch operation management and configuration utilities',
    usage: 'batch <command> [options]',
    examples: [
      'batch create-config my-batch.json',
      'batch create-config --interactive',
      'batch validate-config my-batch.json',
      'batch estimate my-batch.json',
      'batch list-templates',
      'batch list-environments'
    ],
    details: `
Batch operations support:
  • Multiple project initialization with templates
  • Environment-specific configurations (dev, staging, prod)
  • Parallel processing with resource management
  • Progress tracking and detailed reporting
  • Configuration validation and estimation tools
  
Use with init command:
  claude-flow init --batch-init project1,project2,project3
  claude-flow init --config batch-config.json --parallel`
  });
}

// Register a new command
export function registerCommand(name, command) {
  if (commandRegistry.has(name)) {
    console.warn(`Command '${name}' already exists and will be overwritten`);
  }
  
  commandRegistry.set(name, {
    handler: command.handler,
    description: command.description || 'No description available',
    usage: command.usage || `${name} [options]`,
    examples: command.examples || [],
    hidden: command.hidden || false
  });
}

// Get command handler
export function getCommand(name) {
  return commandRegistry.get(name);
}

// List all registered commands
export function listCommands(includeHidden = false) {
  const commands = [];
  for (const [name, command] of commandRegistry.entries()) {
    if (includeHidden || !command.hidden) {
      commands.push({
        name,
        ...command
      });
    }
  }
  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

// Check if command exists
export function hasCommand(name) {
  return commandRegistry.has(name);
}

// Execute a command
export async function executeCommand(name, subArgs, flags) {
  const command = commandRegistry.get(name);
  if (!command) {
    throw new Error(`Unknown command: ${name}`);
  }
  
  try {
    await command.handler(subArgs, flags);
  } catch (err) {
    throw new Error(`Command '${name}' failed: ${err.message}`);
  }
}

// Helper to show command help
export function showCommandHelp(name) {
  const command = commandRegistry.get(name);
  if (!command) {
    console.log(`Unknown command: ${name}`);
    return;
  }
  
  console.log(`Command: ${name}`);
  console.log(`Description: ${command.description}`);
  console.log(`Usage: claude-flow ${command.usage}`);
  
  if (command.details) {
    console.log(command.details);
  }
  
  if (command.examples.length > 0) {
    console.log('\nExamples:');
    for (const example of command.examples) {
      if (example.startsWith('npx')) {
        console.log(`  ${example}`);
      } else {
        console.log(`  claude-flow ${example}`);
      }
    }
  }
}

// Helper to show all commands
export function showAllCommands() {
  const commands = listCommands();
  
  console.log('Available commands:');
  console.log();
  
  for (const command of commands) {
    console.log(`  ${command.name.padEnd(12)} ${command.description}`);
  }
  
  console.log();
  console.log('Use "claude-flow help <command>" for detailed usage information');
}

// Initialize the command registry
registerCoreCommands();