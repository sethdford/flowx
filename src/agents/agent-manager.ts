/**
 * FIXED Agent Manager - Using Claude Code + MCP Approach (Superior Strategy)
 * 
 * This replaces our broken TypeScript template approach with the original 
 * flowx strategy: spawn Claude Code directly with MCP tools for coordination.
 */

import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ILogger } from '../core/logger.js';
import { generateId } from '../utils/helpers.js';

export interface AgentProfile {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  systemPrompt?: string;
  priority: number;
  maxConcurrentTasks: number;
  workingDirectory: string;
  environment?: Record<string, string>;
}

export interface SpawnedAgent {
  id: string;
  name: string;
  type: string;
  process: ChildProcess;
  workingDirectory: string;
  spawnedAt: Date;
  status: 'starting' | 'active' | 'idle' | 'terminated';
}

/**
 * FIXED Agent Manager using Claude Code + MCP (Superior Approach)
 */
export class AgentManager extends EventEmitter {
  private agents = new Map<string, SpawnedAgent>();
  private logger: ILogger;

  constructor(logger: ILogger) {
    super();
    this.logger = logger;
  }

  /**
   * Spawn agent using Claude Code + MCP tools (SUPERIOR APPROACH)
   */
  async spawnAgent(profile: AgentProfile): Promise<string> {
    this.logger.info('🚀 Spawning agent with Claude Code + MCP', {
      id: profile.id,
      name: profile.name,
      type: profile.type
    });

    // Create working directory
    await fs.mkdir(profile.workingDirectory, { recursive: true });

    // Create the Claude Code prompt for the agent
    const agentPrompt = this.createClaudeCodePrompt(profile);

    // Create .clauderc with MCP tools
    await this.createClaudeRC(profile);

    // Spawn Claude Code process directly
    const claudeProcess = await this.spawnClaudeCode(profile, agentPrompt);

    // Register the spawned agent
    const spawnedAgent: SpawnedAgent = {
      id: profile.id,
      name: profile.name,
      type: profile.type,
      process: claudeProcess,
      workingDirectory: profile.workingDirectory,
      spawnedAt: new Date(),
      status: 'starting'
    };

    this.agents.set(profile.id, spawnedAgent);

    this.logger.info('✅ Agent spawned successfully with Claude Code', {
      id: profile.id,
      pid: claudeProcess.pid,
      workingDir: profile.workingDirectory
    });

    this.emit('agent:spawned', spawnedAgent);
    return profile.id;
  }

  /**
   * Create Claude Code prompt for agent (MUCH BETTER than TypeScript templates)
   */
  private createClaudeCodePrompt(profile: AgentProfile): string {
    const systemPrompt = profile.systemPrompt || this.getDefaultSystemPrompt(profile.type);
    
    return `# ${profile.name} - ${profile.type.toUpperCase()} Agent

## Your Identity
You are ${profile.name}, a specialized ${profile.type} agent in a FlowX swarm.

## Your Role & Capabilities
${systemPrompt}

**Capabilities**: ${profile.capabilities.join(', ')}
**Priority Level**: ${profile.priority}
**Max Concurrent Tasks**: ${profile.maxConcurrentTasks}

## MCP Tools Available
You have access to FlowX MCP tools for coordination:

### Agent Coordination
- \`mcp__flowx__agent_spawn\` - Spawn new specialized agents
- \`mcp__flowx__agent_list\` - List all agents in swarm
- \`mcp__flowx__agent_communicate\` - Send messages between agents

### Task Management
- \`mcp__flowx__task_create\` - Create new tasks
- \`mcp__flowx__task_assign\` - Assign tasks to agents
- \`mcp__flowx__task_list\` - List current tasks
- \`mcp__flowx__task_update\` - Update task progress

### Memory & Knowledge
- \`mcp__flowx__memory_store\` - Store information in swarm memory
- \`mcp__flowx__memory_retrieve\` - Retrieve stored information
- \`mcp__flowx__memory_query\` - Search swarm knowledge base

### System Status
- \`mcp__flowx__swarm_status\` - Get swarm overview
- \`mcp__flowx__swarm_monitor\` - Monitor swarm performance

## Instructions
1. **Check swarm status first**: Use \`mcp__flowx__swarm_status\` to understand current state
2. **Coordinate with other agents**: Use \`mcp__flowx__agent_communicate\` for collaboration
3. **Store important findings**: Use \`mcp__flowx__memory_store\` to share knowledge
4. **Spawn specialists when needed**: Use \`mcp__flowx__agent_spawn\` for specialized tasks
5. **Update task progress**: Use \`mcp__flowx__task_update\` to track work

## Working Environment
- **Working Directory**: ${profile.workingDirectory}
- **Agent ID**: ${profile.id}

Begin by checking the swarm status and coordinating with other agents to understand your role in the current objective.
`;
  }

  /**
   * Create .clauderc file with MCP server configuration
   */
  private async createClaudeRC(profile: AgentProfile): Promise<void> {
    const clauderc = {
      mcp: {
        servers: {
          "flowx-swarm": {
            command: "node",
            args: [join(process.cwd(), "src/mcp/server.js")],
            env: {
              AGENT_ID: profile.id,
              AGENT_TYPE: profile.type,
              AGENT_NAME: profile.name,
              WORKING_DIR: profile.workingDirectory,
              ...profile.environment
            }
          }
        }
      },
      tools: [
        "mcp__flowx__agent_spawn",
        "mcp__flowx__agent_list", 
        "mcp__flowx__agent_communicate",
        "mcp__flowx__task_create",
        "mcp__flowx__task_assign",
        "mcp__flowx__task_list",
        "mcp__flowx__task_update",
        "mcp__flowx__memory_store",
        "mcp__flowx__memory_retrieve",
        "mcp__flowx__memory_query",
        "mcp__flowx__swarm_status",
        "mcp__flowx__swarm_monitor"
      ]
    };

    const claudercPath = join(profile.workingDirectory, '.clauderc');
    await fs.writeFile(claudercPath, JSON.stringify(clauderc, null, 2));
    
    this.logger.info('📝 Created .clauderc with MCP configuration', {
      agentId: profile.id,
      configPath: claudercPath
    });
  }

  /**
   * Spawn Claude Code process (MUCH BETTER than Node.js templates)
   */
  private async spawnClaudeCode(profile: AgentProfile, prompt: string): Promise<ChildProcess> {
    // Use Claude Code with the mandatory pattern [[memory:3798523]]
    const claudeArgs = [
      prompt,
      '--print',
      '--dangerously-skip-permissions'
    ];

    this.logger.info('🚀 Launching Claude Code process', {
      agentId: profile.id,
      args: claudeArgs.slice(1), // Don't log the full prompt
      workingDir: profile.workingDirectory
    });

    const claudeProcess = spawn('claude', claudeArgs, {
      cwd: profile.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AGENT_ID: profile.id,
        AGENT_TYPE: profile.type,
        AGENT_NAME: profile.name,
        WORKING_DIR: profile.workingDirectory,
        ...profile.environment
      }
    });

    // CRITICAL: Close stdin to prevent hanging [[memory:3798511]]
    if (claudeProcess.stdin) {
      claudeProcess.stdin.end();
    }

    // Set up process event handlers
    this.setupProcessHandlers(profile.id, claudeProcess);

    return claudeProcess;
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(agentId: string, process: ChildProcess): void {
    process.on('spawn', () => {
      this.logger.info('✅ Claude Code agent process started', {
        agentId,
        pid: process.pid
      });
      
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = 'active';
        this.emit('agent:active', agent);
      }
    });

    process.on('exit', (code, signal) => {
      this.logger.info('🔄 Claude Code agent process exited', {
        agentId,
        code,
        signal
      });
      
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = 'terminated';
        this.emit('agent:terminated', agent);
      }
      
      this.agents.delete(agentId);
    });

    process.on('error', (error) => {
      this.logger.error('❌ Claude Code agent process error', {
        agentId,
        error: error.message
      });
      
      this.emit('agent:error', { agentId, error });
    });

    // Log output for debugging
    if (process.stdout) {
      process.stdout.on('data', (data) => {
        this.logger.debug('Agent stdout', {
          agentId,
          output: data.toString().trim()
        });
      });
    }

    if (process.stderr) {
      process.stderr.on('data', (data) => {
        this.logger.warn('Agent stderr', {
          agentId,
          error: data.toString().trim()
        });
      });
    }
  }

  /**
   * Get default system prompt for agent type
   */
  private getDefaultSystemPrompt(type: string): string {
    const prompts = {
      coordinator: 'You coordinate swarm activities, assign tasks, and ensure efficient collaboration between agents.',
      researcher: 'You research information, analyze requirements, and provide insights to guide development.',
      coder: 'You write high-quality code, implement features, and ensure technical excellence.',
      architect: 'You design system architecture, define patterns, and ensure scalable solutions.',
      tester: 'You create tests, verify functionality, and ensure quality assurance.',
      analyst: 'You analyze data, identify patterns, and provide actionable insights.',
      reviewer: 'You review code, documentation, and ensure quality standards.',
      optimizer: 'You optimize performance, improve efficiency, and reduce resource usage.',
      documenter: 'You create clear documentation, guides, and knowledge resources.',
      monitor: 'You monitor system performance, track metrics, and report status.'
    };

    return prompts[type as keyof typeof prompts] || 
           'You are a specialized agent that contributes to swarm objectives using your unique capabilities.';
  }

  /**
   * List all active agents
   */
  listAgents(): SpawnedAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): SpawnedAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    this.logger.info('🛑 Terminating agent', { agentId, name: agent.name });

    // Gracefully terminate Claude Code process
    agent.process.kill('SIGTERM');
    
    // Force kill after timeout
    setTimeout(() => {
      if (!agent.process.killed) {
        agent.process.kill('SIGKILL');
      }
    }, 5000);

    return true;
  }

  /**
   * Terminate all agents
   */
  async terminateAll(): Promise<void> {
    this.logger.info('🛑 Terminating all agents', { count: this.agents.size });
    
    const terminations = Array.from(this.agents.keys()).map(id => 
      this.terminateAgent(id)
    );
    
    await Promise.all(terminations);
  }

  /**
   * Get agent statistics
   */
  getStats() {
    const agents = this.listAgents();
    const byStatus = agents.reduce((acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = agents.reduce((acc, agent) => {
      acc[agent.type] = (acc[agent.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: agents.length,
      byStatus,
      byType,
      oldest: agents.length > 0 ? Math.min(...agents.map(a => a.spawnedAt.getTime())) : null,
      newest: agents.length > 0 ? Math.max(...agents.map(a => a.spawnedAt.getTime())) : null
    };
  }
}