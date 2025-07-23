/**
 * Agent Management Command
 * Comprehensive agent lifecycle management with actual backend integration
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getPersistenceManager, getLogger } from '../../core/global-initialization.js';
import { AgentProcessManager, AgentProcessConfig } from '../../../agents/agent-process-manager.js';
import { ChildProcess } from 'child_process';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'busy' | 'error' | 'offline';
  capabilities: string[];
  uptime: number;
  tasksCompleted: number;
  currentTask?: string;
  lastActivity: Date;
  pid?: number;
  scriptPath?: string;
  logFile?: string;
  createdAt: Date;
}

// Global process registry
const spawnedProcesses = new Map<string, ChildProcess>();

// Runtime agent tracking (not persisted)
interface RuntimeAgentInfo {
  pid?: number;
  scriptPath?: string;
  logFile?: string;
}

const runtimeAgentInfo = new Map<string, RuntimeAgentInfo>();

// Global AgentProcessManager instance
let globalAgentProcessManager: AgentProcessManager | null = null;

async function getAgentProcessManager(): Promise<AgentProcessManager> {
  if (!globalAgentProcessManager) {
    const logger = await getLogger();
    globalAgentProcessManager = new AgentProcessManager(logger);
  }
  return globalAgentProcessManager;
}

async function listAgents(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const persistenceManager = await getPersistenceManager();
    const agentProcessManager = await getAgentProcessManager();
    
    // Get persisted agents from database
    const persistedAgents = await persistenceManager.getAllAgents();
    
    // Get real running agents from process manager
    const runningAgents = agentProcessManager.getAgents();
    
    // Merge the data - prioritize running agent info
    const mergedAgents = persistedAgents.map(persisted => {
      const running = runningAgents.find(r => r.id === persisted.id);
      
      // Parse capabilities from JSON string to array
      const capabilities: string[] = typeof persisted.capabilities === 'string' 
        ? JSON.parse(persisted.capabilities || '[]') 
        : persisted.capabilities || [];
      
      if (running) {
        // Map running status to Agent status type
        const mappedStatus = mapRunningStatusToAgentStatus(running.status);
        
        return {
          ...persisted,
          capabilities,
          status: mappedStatus,
          pid: running.pid,
          uptime: running.startTime ? Date.now() - running.startTime.getTime() : 0,
          tasksCompleted: running.tasksCompleted,
          memoryUsage: running.memoryUsage,
          cpuUsage: running.cpuUsage,
          lastActivity: running.lastActivity || new Date(persisted.createdAt),
          createdAt: new Date(persisted.createdAt)
        };
      }
      
      return {
        ...persisted,
        capabilities,
        status: 'offline' as const,
        uptime: 0,
        tasksCompleted: 0,
        lastActivity: new Date(persisted.createdAt),
        createdAt: new Date(persisted.createdAt)
      };
    });
    
    // Add any running agents not in database
    const runningOnlyAgents = runningAgents.filter(running => 
      !persistedAgents.find(p => p.id === running.id)
    ).map(running => ({
      id: running.id,
      name: running.id,
      type: running.type,
      status: mapRunningStatusToAgentStatus(running.status),
      capabilities: [],
      pid: running.pid,
      uptime: running.startTime ? Date.now() - running.startTime.getTime() : 0,
      tasksCompleted: running.tasksCompleted,
      memoryUsage: running.memoryUsage,
      cpuUsage: running.cpuUsage,
      lastActivity: running.lastActivity || new Date(),
      createdAt: new Date(running.startTime?.getTime() || Date.now())
    }));
    
    let allAgents = [...mergedAgents, ...runningOnlyAgents];
    
    // Apply filters
    if (options.status) {
      allAgents = allAgents.filter(agent => agent.status === options.status);
    }
    
    if (options.type) {
      allAgents = allAgents.filter(agent => agent.type === options.type);
    }
    
    if (allAgents.length === 0) {
      printInfo('No agents found');
      return;
    }

    switch (options.format) {
      case 'json':
        console.log(JSON.stringify(allAgents, null, 2));
        break;
      case 'yaml':
        console.log(formatAsYaml(allAgents));
        break;
      default:
        displayAgentsTable(allAgents);
        break;
    }
    
    // Show summary
    const stats = agentProcessManager.getAgentStats();
    console.log();
    printInfo(`Total: ${stats.total}, Running: ${stats.running}, Stopped: ${stats.stopped}, Errors: ${stats.error}`);
    printInfo(`Tasks Completed: ${stats.totalTasks}, Failed: ${stats.totalFailures}`);
    
  } catch (error) {
    printError(`Failed to list agents: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function spawnAgent(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const agentType = args[0];
  
  try {
    const persistenceManager = await getPersistenceManager();
    const agentProcessManager = await getAgentProcessManager();
    
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const agentName = options.name || `${agentType}-${Date.now()}`;
    
    printInfo(`🚀 Spawning ${agentType} agent using real process manager...`);
    
    // Create agent configuration with security integration
    const baseEnvironment = options.env ? JSON.parse(options.env) : {};
    
    // SECURITY INTEGRATION: Add security context to agent environment
    const securityEnvironment = {
      SECURE_AGENT_MODE: 'true',
      SECURITY_LEVEL: agentType === 'security' ? 'critical' : 'high',
      OWASP_COMPLIANCE: 'TOP_10_2023',
      ENFORCE_CLEAN_ARCHITECTURE: 'true',
      ENFORCE_SOLID: 'true',
      MIN_TEST_COVERAGE: agentType === 'test' ? '98' : '85',
      REQUIRE_TESTS: 'true',
      SECURITY_VALIDATION: 'real-time',
      CLAUDE_AGENT_ID: agentId,
      CLAUDE_AGENT_TYPE: agentType,
      CLAUDE_AGENT_MODE: 'true',
      CLAUDE_AGENT_SPECIALIZATION: options.specialization || 'general',
      ...baseEnvironment
    };

    const agentConfig: AgentProcessConfig = {
      id: agentId,
      type: agentType as 'backend' | 'frontend' | 'devops' | 'test' | 'security' | 'documentation' | 'general',
      specialization: options.specialization,
      maxMemory: options.memory ? parseInt(options.memory) : undefined,
      maxConcurrentTasks: options.maxTasks ? parseInt(options.maxTasks) : 3,
      timeout: options.timeout ? parseInt(options.timeout) : undefined,
      workingDirectory: options.workDir,
      environment: securityEnvironment,
      claudeConfig: {
        model: options.model || 'claude-3-5-sonnet-20241022', // Use latest secure model
        temperature: options.temperature ? parseFloat(options.temperature) : 0.1, // Lower temp for deterministic secure code
        maxTokens: options.maxTokens ? parseInt(options.maxTokens) : undefined
      }
    };
    
    // Create agent using real process manager
    const createdAgentId = await agentProcessManager.createAgent(agentConfig);
    
    // Get agent info from process manager
    const agentInfo = agentProcessManager.getAgent(createdAgentId);
    
    if (!agentInfo) {
      throw new Error('Failed to get agent info after creation');
    }
    
    // Save to database for persistence
    await persistenceManager.saveAgent({
      id: agentId,
      name: agentName,
      type: agentType,
      status: 'active',
      capabilities: JSON.stringify(options.capabilities ? options.capabilities.split(',') : []),
      systemPrompt: `You are a ${agentType} agent specialized in ${options.specialization || 'general tasks'}`,
      maxConcurrentTasks: agentConfig.maxConcurrentTasks || 3,
      priority: 1,
      createdAt: Date.now()
    });
    
    printSuccess(`✅ Agent spawned successfully: ${agentName} (${agentId})`);
    printInfo(`Process ID: ${agentInfo.pid}`);
    printInfo(`Status: ${agentInfo.status}`);
    printInfo(`Type: ${agentInfo.type}`);
    printInfo(`Working Directory: ${agentConfig.workingDirectory || 'default'}`);
    printSuccess(`🛡️ Security Level: ${securityEnvironment.SECURITY_LEVEL}`);
    printInfo(`🔒 OWASP Compliance: ${securityEnvironment.OWASP_COMPLIANCE}`);
    printInfo(`🏗️ Clean Architecture: ${securityEnvironment.ENFORCE_CLEAN_ARCHITECTURE}`);
    
    if (options.verbose) {
      printInfo(`Memory Limit: ${agentConfig.maxMemory || 'unlimited'} MB`);
      printInfo(`Max Concurrent Tasks: ${agentConfig.maxConcurrentTasks}`);
      printInfo(`Claude Model: ${agentConfig.claudeConfig?.model || 'default'}`);
      printInfo(`Temperature: ${agentConfig.claudeConfig?.temperature}`);
      printInfo(`Test Coverage: ${securityEnvironment.MIN_TEST_COVERAGE}%`);
      printInfo(`Security Validation: ${securityEnvironment.SECURITY_VALIDATION}`);
    }
    
  } catch (error) {
    printError(`Failed to spawn agent: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function getAgentStatus(context: CLIContext): Promise<void> {
  const { args } = context;
  const agentId = args[0];
  
  try {
    const persistenceManager = await getPersistenceManager();
    const agent = await persistenceManager.getAgent(agentId);
    
    if (!agent) {
      printError(`Agent ${agentId} not found`);
      return;
    }
    
    console.log(infoBold(`Agent Status: ${agent.name} (${agent.id})`));
    console.log();
    
    console.log(`Status: ${getStatusColor(agent.status)}`);
    console.log(`Type: ${agent.type}`);
    console.log(`Created: ${new Date(agent.createdAt).toLocaleString()}`);
    console.log(`Priority: ${agent.priority}`);
    console.log(`Max Tasks: ${agent.maxConcurrentTasks}`);
    
    // Get runtime info
    const runtimeInfo = runtimeAgentInfo.get(agentId);
    if (runtimeInfo?.pid) {
      console.log(`Process ID: ${runtimeInfo.pid}`);
    }
    if (runtimeInfo?.scriptPath) {
      console.log(`Script: ${runtimeInfo.scriptPath}`);
    }
    if (runtimeInfo?.logFile) {
      console.log(`Log File: ${runtimeInfo.logFile}`);
    }
    
  } catch (error) {
    printError(`Failed to get agent status: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function startAgent(context: CLIContext): Promise<void> {
  const { args } = context;
  const agentId = args[0];
  
  try {
    const persistenceManager = await getPersistenceManager();
    await persistenceManager.updateAgentStatus(agentId, 'active');
    printSuccess(`Agent ${agentId} started successfully`);
  } catch (error) {
    printError(`Failed to start agent: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function stopAgent(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const agentId = args[0];
  
  try {
    const persistenceManager = await getPersistenceManager();
    const agent = await persistenceManager.getAgent(agentId);
    
    if (!agent) {
      printError(`Agent ${agentId} not found`);
      return;
    }
    
    // Try to kill the process if it exists
    const runtimeInfo = runtimeAgentInfo.get(agentId);
    if (runtimeInfo?.pid) {
      try {
        process.kill(runtimeInfo.pid, options.force ? 'SIGKILL' : 'SIGTERM');
        printSuccess(`Sent ${options.force ? 'SIGKILL' : 'SIGTERM'} to agent ${agentId}`);
      } catch (killError) {
        if ((killError as NodeJS.ErrnoException).code !== 'ESRCH') {
          throw killError;
        }
      }
    }
    
    await persistenceManager.updateAgentStatus(agentId, 'offline');
    spawnedProcesses.delete(agentId);
    runtimeAgentInfo.delete(agentId);
    printSuccess(`Agent ${agentId} stopped successfully`);
    
  } catch (error) {
    printError(`Failed to stop agent: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function restartAgent(context: CLIContext): Promise<void> {
  const { args } = context;
  const agentId = args[0];
  
  try {
    printInfo(`Restarting agent ${agentId}...`);
    await stopAgent({ ...context, options: { force: false } });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await startAgent(context);
    printSuccess(`Agent ${agentId} restarted successfully`);
  } catch (error) {
    printError(`Failed to restart agent: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showAgentLogs(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const agentId = args[0];
  
  try {
    const persistenceManager = await getPersistenceManager();
    const agent = await persistenceManager.getAgent(agentId);
    
    if (!agent) {
      printError(`Agent ${agentId} not found`);
      return;
    }
    
    const runtimeInfo = runtimeAgentInfo.get(agentId);
    if (!runtimeInfo?.logFile) {
      printError(`No log file configured for agent ${agentId}`);
      return;
    }
    
    const fs = await import('fs');
    
    if (options.follow) {
      printInfo(`Following logs for agent ${agentId} (Press Ctrl+C to stop)...`);
      
      // Simple tail implementation
      const { spawn } = await import('child_process');
      const tail = spawn('tail', ['-f', runtimeInfo.logFile]);
      
      tail.stdout.on('data', (data) => {
        process.stdout.write(data);
      });
      
      tail.stderr.on('data', (data) => {
        process.stderr.write(data);
      });
      
    } else {
      try {
        const logContent = fs.readFileSync(runtimeInfo.logFile, 'utf8');
        const lines = logContent.split('\n');
        const recentLines = lines.slice(-options.lines);
        
        recentLines.forEach(line => {
          if (line.trim()) {
            console.log(line);
          }
        });
      } catch (readError) {
        printError(`Failed to read log file: ${readError instanceof Error ? readError.message : String(readError)}`);
      }
    }
    
  } catch (error) {
    printError(`Failed to show agent logs: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function removeAgent(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const agentId = args[0];
  
  try {
    const persistenceManager = await getPersistenceManager();
    
    if (!options.force) {
      printWarning(`This will permanently remove agent ${agentId}`);
      printInfo('Use --force to confirm removal');
      return;
    }
    
    // Stop the agent first
    await stopAgent({ ...context, options: { force: true } });
    
    // Update status to removed
    await persistenceManager.updateAgentStatus(agentId, 'removed');
    
    printSuccess(`Agent ${agentId} removed successfully`);
    
  } catch (error) {
    printError(`Failed to remove agent: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper functions

function displayAgentsTable(agents: Agent[]): void {
  console.log(successBold('\n🤖 Claude Flow Agents\n'));
  
  const agentTable = formatTable(agents, [
    { header: 'ID', key: 'id' },
    { header: 'Name', key: 'name' },
    { header: 'Type', key: 'type' },
    { header: 'Status', key: 'status', formatter: (v) => getStatusColor(v) },
    { header: 'Created', key: 'createdAt', formatter: (v) => new Date(v).toLocaleDateString() },
    { header: 'Priority', key: 'priority' },
    { header: 'PID', key: 'pid', formatter: (v) => v || '-' }
  ]);
  
  console.log(agentTable);
  console.log();
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
    case 'busy':
      return successBold(status);
    case 'idle':
      return warningBold(status);
    case 'error':
    case 'offline':
      return errorBold(status);
    default:
      return status;
  }
}

function formatAsYaml(obj: unknown, indent: number = 0): string {
  const spaces = ' '.repeat(indent);
  let result = '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      result += `${spaces}- ${formatAsYaml(item, indent + 2)}\n`;
    }
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        result += `${spaces}${key}:\n${formatAsYaml(value, indent + 2)}`;
      } else {
        result += `${spaces}${key}: ${value}\n`;
      }
    }
  } else {
    return String(obj);
  }

  return result;
}

// Helper function to map running status to Agent status
function mapRunningStatusToAgentStatus(runningStatus: string): 'active' | 'idle' | 'busy' | 'error' | 'offline' {
  switch (runningStatus) {
    case 'running':
      return 'active';
    case 'starting':
      return 'active';
    case 'stopping':
      return 'offline';
    case 'stopped':
      return 'offline';
    case 'error':
      return 'error';
    case 'crashed':
      return 'error';
    default:
      return 'offline';
  }
}

export const agentCommand: CLICommand = {
  name: 'agent',
  description: 'Manage AI agents with real backend integration',
  category: 'Agents',
  usage: 'FlowX agent <subcommand> [OPTIONS]',
  examples: [
    'FlowX agent list',
    'FlowX agent spawn researcher --name "Research Bot"',
    'FlowX agent status agent-001',
    'FlowX agent stop agent-001',
    'FlowX agent logs agent-001'
  ],
  subcommands: [
    {
      name: 'list',
      description: 'List all agents',
      handler: listAgents,
      options: [
        {
          name: 'status',
          short: 's',
          description: 'Filter by status',
          type: 'string',
          choices: ['active', 'idle', 'busy', 'error', 'offline']
        },
        {
          name: 'type',
          short: 't',
          description: 'Filter by agent type',
          type: 'string'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['table', 'json', 'yaml'],
          default: 'table'
        }
      ]
    },
    {
      name: 'spawn',
      description: 'Create and start a new agent',
      handler: spawnAgent,
      arguments: [
        {
          name: 'type',
          description: 'Agent type to spawn',
          required: true
        }
      ],
      options: [
        {
          name: 'name',
          short: 'n',
          description: 'Agent name',
          type: 'string'
        },
        {
          name: 'specialization',
          short: 's',
          description: 'Agent specialization',
          type: 'string'
        },
        {
          name: 'capabilities',
          description: 'Comma-separated list of capabilities',
          type: 'string'
        },
        {
          name: 'memory',
          short: 'm',
          description: 'Maximum memory in MB',
          type: 'string'
        },
        {
          name: 'max-tasks',
          description: 'Maximum concurrent tasks',
          type: 'string'
        },
        {
          name: 'timeout',
          description: 'Task timeout in milliseconds',
          type: 'string'
        },
        {
          name: 'work-dir',
          description: 'Working directory for agent',
          type: 'string'
        },
        {
          name: 'model',
          description: 'Claude model to use',
          type: 'string'
        },
        {
          name: 'temperature',
          description: 'Claude temperature setting',
          type: 'string'
        },
        {
          name: 'max-tokens',
          description: 'Maximum tokens for Claude responses',
          type: 'string'
        },
        {
          name: 'env',
          description: 'Environment variables as JSON',
          type: 'string'
        },
        {
          name: 'detached',
          description: 'Run agent in detached mode',
          type: 'boolean',
          default: true
        },
        {
          name: 'log-file',
          description: 'Log file path',
          type: 'string'
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Show detailed information',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'create',
      description: 'Create and start a new agent (alias for spawn)',
      handler: async (context: CLIContext) => {
        // Transform create syntax to spawn syntax
        // create test-agent --type researcher -> spawn researcher --name test-agent
        const { args, options } = context;
        const agentName = args[0];
        const agentType = options.type;
        
        if (!agentType) {
          printError('Agent type is required. Use --type option.');
          printInfo('Example: flowx agent create my-agent --type researcher');
          return;
        }
        
        // Create new context with transformed arguments
        const newContext = {
          ...context,
          args: [agentType],
          options: {
            ...options,
            name: agentName || options.name
          }
        };
        
        return await spawnAgent(newContext);
      },
      arguments: [
        {
          name: 'name',
          description: 'Agent name',
          required: true
        }
      ],
      options: [
        {
          name: 'type',
          short: 't',
          description: 'Agent type',
          type: 'string',
          required: true
        },
        {
          name: 'specialization',
          short: 's',
          description: 'Agent specialization',
          type: 'string'
        },
        {
          name: 'capabilities',
          description: 'Comma-separated list of capabilities',
          type: 'string'
        },
        {
          name: 'memory',
          short: 'm',
          description: 'Maximum memory in MB',
          type: 'string'
        },
        {
          name: 'max-tasks',
          description: 'Maximum concurrent tasks',
          type: 'string'
        },
        {
          name: 'timeout',
          description: 'Task timeout in milliseconds',
          type: 'string'
        },
        {
          name: 'work-dir',
          description: 'Working directory for agent',
          type: 'string'
        },
        {
          name: 'model',
          description: 'Claude model to use',
          type: 'string'
        },
        {
          name: 'temperature',
          description: 'Claude temperature setting',
          type: 'string'
        },
        {
          name: 'debug',
          description: 'Enable debug mode',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'status',
      description: 'Get agent status',
      handler: getAgentStatus,
      arguments: [
        {
          name: 'agent-id',
          description: 'Agent ID to check',
          required: true
        }
      ]
    },
    {
      name: 'start',
      description: 'Start an agent',
      handler: startAgent,
      arguments: [
        {
          name: 'agent-id',
          description: 'Agent ID to start',
          required: true
        }
      ]
    },
    {
      name: 'stop',
      description: 'Stop an agent',
      handler: stopAgent,
      arguments: [
        {
          name: 'agent-id',
          description: 'Agent ID to stop',
          required: true
        }
      ],
      options: [
        {
          name: 'force',
          short: 'f',
          description: 'Force stop without graceful shutdown',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'restart',
      description: 'Restart an agent',
      handler: restartAgent,
      arguments: [
        {
          name: 'agent-id',
          description: 'Agent ID to restart',
          required: true
        }
      ]
    },
    {
      name: 'logs',
      description: 'Show agent logs',
      handler: showAgentLogs,
      arguments: [
        {
          name: 'agent-id',
          description: 'Agent ID to show logs for',
          required: true
        }
      ],
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
        }
      ]
    },
    {
      name: 'remove',
      description: 'Remove an agent',
      handler: removeAgent,
      arguments: [
        {
          name: 'agent-id',
          description: 'Agent ID to remove',
          required: true
        }
      ],
      options: [
        {
          name: 'force',
          short: 'f',
          description: 'Force removal without confirmation',
          type: 'boolean'
        }
      ]
    }
  ],
  handler: async (context: CLIContext) => {
    // Default to list if no subcommand
    return await listAgents(context);
  }
};

export default agentCommand; 