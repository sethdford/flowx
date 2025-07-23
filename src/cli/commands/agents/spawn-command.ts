/**
 * FIXED Agent Spawn Command - Using Claude Code + MCP (Superior Strategy)
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { printSuccess, printError, printInfo } from '../../core/output-formatter.js';
import { AgentManager, AgentProfile } from '../../../agents/agent-manager.js';
import { Logger } from '../../../core/logger.js';
import { generateId } from '../../../utils/helpers.js';

const logger = new Logger('spawn-command');
const agentManager = new AgentManager(logger);

export const spawnCommand: CLICommand = {
  name: 'spawn',
  description: 'Spawn a specialized agent using Claude Code + MCP (FIXED)',
  category: 'Agents',
  usage: 'flowx spawn <type> [name] [OPTIONS]',
  examples: [
    'flowx spawn researcher "Data Analyst"',
    'flowx spawn coder "Backend Developer" --capabilities "node.js,database"',
    'flowx spawn architect "System Designer" --priority 9',
    'flowx spawn coordinator "Team Lead" --max-tasks 5'
  ],
  options: [
    {
      name: 'capabilities',
      short: 'c',
      description: 'Comma-separated list of agent capabilities',
      type: 'string'
    },
    {
      name: 'priority',
      short: 'p',
      description: 'Agent priority level (1-10)',
      type: 'number',
      default: 5
    },
    {
      name: 'max-tasks',
      short: 'm',
      description: 'Maximum concurrent tasks',
      type: 'number',
      default: 3
    },
    {
      name: 'system-prompt',
      short: 's',
      description: 'Custom system prompt for the agent',
      type: 'string'
    },
    {
      name: 'working-dir',
      short: 'w',
      description: 'Working directory for the agent',
      type: 'string'
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;

    printInfo('🚀 Spawning agent with Claude Code + MCP (FIXED approach)');

    // Validate arguments
    if (args.length === 0) {
      printError('Agent type is required');
      printInfo('Usage: flowx spawn <type> [name]');
      printInfo('Types: coordinator, researcher, coder, architect, tester, analyst, reviewer, optimizer, documenter, monitor');
      return;
    }

    const agentType = args[0];
    const agentName = args[1] || `${agentType}-${Date.now()}`;
    
    // Parse capabilities
    const capabilities = options.capabilities 
      ? options.capabilities.split(',').map((c: string) => c.trim())
      : getDefaultCapabilities(agentType);

    // Create agent profile
    const agentId = generateId();
    const workingDir = options['working-dir'] || `./agents/${agentId}`;

    const profile: AgentProfile = {
      id: agentId,
      name: agentName,
      type: agentType,
      capabilities,
      systemPrompt: options['system-prompt'],
      priority: options.priority || 5,
      maxConcurrentTasks: options['max-tasks'] || 3,
      workingDirectory: workingDir,
      environment: {
        SPAWNED_BY: 'spawn-command',
        SPAWN_TIME: new Date().toISOString()
      }
    };

    try {
      printInfo(`Creating ${agentType} agent: ${agentName}`);
      printInfo(`Working directory: ${workingDir}`);
      printInfo(`Capabilities: ${capabilities.join(', ')}`);
      
      // Spawn agent using Claude Code + MCP (SUPERIOR APPROACH)
      const spawnedAgentId = await agentManager.spawnAgent(profile);
      
      printSuccess('✅ Agent spawned successfully with Claude Code!');
      console.log(`
📋 Agent Details:
   ID: ${spawnedAgentId}
   Name: ${agentName}
   Type: ${agentType}
   Priority: ${profile.priority}
   Max Tasks: ${profile.maxConcurrentTasks}
   Working Dir: ${workingDir}
   Capabilities: ${capabilities.join(', ')}

🎯 The agent is now running as a Claude Code process with MCP tools for coordination.
   It can spawn other agents, manage tasks, and coordinate with the swarm.

💡 Monitor agent status with: flowx agent list
   Communicate with agents through the swarm coordination system.
`);

    } catch (error) {
      printError(`Failed to spawn agent: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Agent spawn failed', { error, profile });
      throw error;
    }
  }
};

/**
 * Get default capabilities for agent type
 */
function getDefaultCapabilities(type: string): string[] {
  const defaultCapabilities = {
    coordinator: ['task-management', 'agent-coordination', 'planning', 'communication'],
    researcher: ['web-search', 'analysis', 'documentation', 'data-gathering'],
    coder: ['code-generation', 'debugging', 'testing', 'file-system'],
    architect: ['system-design', 'documentation', 'code-review', 'planning'],
    tester: ['testing', 'quality-assurance', 'automation', 'code-review'],
    analyst: ['data-analysis', 'research', 'documentation', 'insights'],
    reviewer: ['code-review', 'quality-assurance', 'documentation', 'analysis'],
    optimizer: ['performance-analysis', 'code-optimization', 'monitoring', 'metrics'],
    documenter: ['documentation', 'writing', 'research', 'knowledge-management'],
    monitor: ['monitoring', 'alerting', 'metrics', 'system-analysis']
  };

  return defaultCapabilities[type as keyof typeof defaultCapabilities] || ['general'];
} 