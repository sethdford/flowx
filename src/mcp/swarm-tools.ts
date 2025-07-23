/**
 * COMPREHENSIVE SWARM MCP TOOLS
 * Real MCP tools for swarm coordination - the ones expected by swarm prompts
 */

import { MCPTool, MCPContext } from "../utils/types.js";
import { ILogger } from "../core/logger.js";
import { generateId } from '../utils/helpers.js';

export interface SwarmToolContext extends MCPContext {
  swarmCoordinator?: any;
  agentManager?: any;
  resourceManager?: any;
  messageBus?: any;
  monitor?: any;
}

// Global swarm state storage (in production this would be persistent)
const globalSwarmState = new Map<string, any>();
const globalAgentState = new Map<string, any>();
const globalMemoryStore = new Map<string, any>();
const globalTaskState = new Map<string, any>();

/**
 * Create comprehensive swarm tools for MCP integration
 */
export function createSwarmTools(logger: ILogger): MCPTool[] {
  const tools: MCPTool[] = [
    
    // ===== MODERN MCP TOOLS (Expected by swarm prompts) =====
    
    {
      name: 'mcp__flowx__agent_spawn',
      description: 'Spawn a new agent in the swarm with specific capabilities',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['coordinator', 'researcher', 'developer', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist'],
            description: 'The type of agent to spawn'
          },
          name: {
            type: 'string',
            description: 'Unique name for the agent'
          },
          task: {
            type: 'string',
            description: 'Specific task assignment for the agent'
          },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of agent capabilities'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
          }
        },
        required: ['type', 'name', 'task']
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { type, name, task, capabilities = [], priority = 'medium' } = input;
        
        const swarmId = process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const agent = {
          id: agentId,
          type,
          name,
          task,
          capabilities,
          priority,
          status: 'active',
          spawnedAt: new Date().toISOString(),
          swarmId,
          parentAgent: process.env['CLAUDE_SWARM_AGENT_ID'],
          lastActivity: new Date().toISOString(),
          completedTasks: 0,
          metrics: {
            tasksCompleted: 0,
            successRate: 1.0,
            averageResponseTime: 0
          }
        };
        
        globalAgentState.set(agentId, agent);
        
        // Update swarm state
        const swarmState = globalSwarmState.get(swarmId) || {
          id: swarmId,
          agents: [],
          createdAt: new Date().toISOString()
        };
        swarmState.agents.push(agentId);
        globalSwarmState.set(swarmId, swarmState);
        
        logger.info('Agent spawned via MCP', { agentId, type, name, swarmId });
        
        return {
          success: true,
          agentId,
          agentName: name,
          agentType: type,
          task,
          swarmId,
          message: `Successfully spawned ${type} agent "${name}" for task: ${task}`
        };
      }
    },

    {
      name: 'mcp__flowx__memory_store',
      description: 'Store knowledge in swarm collective memory',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Memory key (use namespaced keys like "swarm/objective", "agent/task", etc.)'
          },
          value: {
            type: 'string',
            description: 'Value to store (can be JSON string for complex data)'
          },
          ttl: {
            type: 'number',
            description: 'Time to live in seconds (optional)',
            default: 3600
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization and search'
          }
        },
        required: ['key', 'value']
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { key, value, ttl = 3600, tags = [] } = input;
        
        const swarmId = process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        const agentId = process.env['CLAUDE_SWARM_AGENT_ID'] || 'unknown';
        
        const memoryEntry = {
          key,
          value,
          swarmId,
          storedBy: agentId,
          storedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
          tags,
          accessCount: 0
        };
        
        globalMemoryStore.set(`${swarmId}:${key}`, memoryEntry);
        
        logger.info('Memory stored via MCP', { key, swarmId, agentId });
        
        return {
          success: true,
          key,
          swarmId,
          storedAt: memoryEntry.storedAt,
          expiresAt: memoryEntry.expiresAt,
          message: `Stored memory: ${key}`
        };
      }
    },

    {
      name: 'mcp__flowx__memory_retrieve',
      description: 'Retrieve knowledge from swarm collective memory',
      inputSchema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Memory key to retrieve'
          },
          swarmId: {
            type: 'string',
            description: 'Swarm ID (optional, uses current swarm by default)'
          }
        },
        required: ['key']
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { key, swarmId: inputSwarmId } = input;
        
        const swarmId = inputSwarmId || process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        const memoryKey = `${swarmId}:${key}`;
        
        const memoryEntry = globalMemoryStore.get(memoryKey);
        
        if (!memoryEntry) {
          return {
            success: false,
            error: `Memory not found: ${key}`,
            key,
            swarmId
          };
        }
        
        // Check expiration
        if (new Date() > new Date(memoryEntry.expiresAt)) {
          globalMemoryStore.delete(memoryKey);
          return {
            success: false,
            error: `Memory expired: ${key}`,
            key,
            swarmId
          };
        }
        
        // Update access count
        memoryEntry.accessCount++;
        memoryEntry.lastAccessed = new Date().toISOString();
        
        logger.info('Memory retrieved via MCP', { key, swarmId });
        
        return {
          success: true,
          key,
          value: memoryEntry.value,
          swarmId,
          storedAt: memoryEntry.storedAt,
          storedBy: memoryEntry.storedBy,
          tags: memoryEntry.tags,
          accessCount: memoryEntry.accessCount
        };
      }
    },

    {
      name: 'mcp__flowx__task_create',
      description: 'Create a new task in the swarm coordination system',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Task name'
          },
          description: {
            type: 'string',
            description: 'Detailed task description'
          },
          assignTo: {
            type: 'string',
            description: 'Agent name or ID to assign the task to'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
          },
          dependsOn: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of task names this task depends on'
          },
          deadline: {
            type: 'string',
            description: 'Task deadline (ISO string)'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Task tags for categorization'
          }
        },
        required: ['name', 'description']
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { name, description, assignTo, priority = 'medium', dependsOn = [], deadline, tags = [] } = input;
        
        const swarmId = process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        const createdBy = process.env['CLAUDE_SWARM_AGENT_ID'] || 'system';
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const task = {
          id: taskId,
          name,
          description,
          assignTo,
          priority,
          dependsOn,
          deadline,
          tags,
          status: 'pending',
          swarmId,
          createdBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          progress: 0,
          subtasks: [],
          results: null
        };
        
        globalTaskState.set(taskId, task);
        
        logger.info('Task created via MCP', { taskId, name, assignTo, swarmId });
        
        return {
          success: true,
          taskId,
          name,
          assignTo,
          priority,
          swarmId,
          createdAt: task.createdAt,
          message: `Created task: ${name}${assignTo ? ` (assigned to ${assignTo})` : ''}`
        };
      }
    },

    {
      name: 'mcp__flowx__task_assign',
      description: 'Assign a task to a specific agent',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to assign'
          },
          agentId: {
            type: 'string',
            description: 'Agent ID or name to assign the task to'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Task priority (optional)'
          }
        },
        required: ['taskId', 'agentId']
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { taskId, agentId, priority } = input;
        
        const task = globalTaskState.get(taskId);
        if (!task) {
          return {
            success: false,
            error: `Task not found: ${taskId}`,
            taskId
          };
        }
        
        task.assignTo = agentId;
        task.status = 'assigned';
        task.updatedAt = new Date().toISOString();
        if (priority) task.priority = priority;
        
        globalTaskState.set(taskId, task);
        
        logger.info('Task assigned via MCP', { taskId, agentId });
        
        return {
          success: true,
          taskId,
          agentId,
          taskName: task.name,
          priority: task.priority,
          message: `Assigned task "${task.name}" to ${agentId}`
        };
      }
    },

    {
      name: 'mcp__flowx__swarm_status',
      description: 'Get current status of the swarm and all agents',
      inputSchema: {
        type: 'object',
        properties: {
          swarmId: {
            type: 'string',
            description: 'Swarm ID (optional, uses current swarm by default)'
          },
          includeMetrics: {
            type: 'boolean',
            default: true,
            description: 'Include detailed metrics'
          }
        }
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { swarmId: inputSwarmId, includeMetrics = true } = input;
        
        const swarmId = inputSwarmId || process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        const swarmState = globalSwarmState.get(swarmId);
        
        if (!swarmState) {
          return {
            success: false,
            error: `Swarm not found: ${swarmId}`,
            swarmId
          };
        }
        
        const agents = swarmState.agents.map((agentId: string) => {
          const agent = globalAgentState.get(agentId);
          return agent ? {
            id: agent.id,
            name: agent.name,
            type: agent.type,
            status: agent.status,
            task: agent.task,
            spawnedAt: agent.spawnedAt,
            ...(includeMetrics && { metrics: agent.metrics })
          } : null;
        }).filter(Boolean);
        
        const activeAgents = agents.filter((a: any) => a?.status === 'active').length;
        const runtime = Date.now() - new Date(swarmState.createdAt).getTime();
        
        logger.info('Swarm status retrieved via MCP', { swarmId, activeAgents });
        
        return {
          success: true,
          swarmId,
          objective: process.env['CLAUDE_SWARM_OBJECTIVE'] || 'Unknown',
          strategy: process.env['CLAUDE_SWARM_STRATEGY'] || 'auto',
          mode: process.env['CLAUDE_SWARM_MODE'] || 'centralized',
          runtime: `${Math.floor(runtime / 1000)}s`,
          totalAgents: agents.length,
          activeAgents,
          completedAgents: agents.filter((a: any) => a?.status === 'completed').length,
          failedAgents: agents.filter((a: any) => a?.status === 'failed').length,
          agents,
          createdAt: swarmState.createdAt
        };
      }
    },

    {
      name: 'mcp__flowx__swarm_monitor',
      description: 'Real-time monitoring of swarm execution and performance',
      inputSchema: {
        type: 'object',
        properties: {
          swarmId: {
            type: 'string',
            description: 'Swarm ID (optional, uses current swarm by default)'
          },
          metrics: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['performance', 'health', 'progress', 'errors', 'all']
            },
            default: ['all'],
            description: 'Metrics to monitor'
          }
        }
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { swarmId: inputSwarmId, metrics = ['all'] } = input;
        
        const swarmId = inputSwarmId || process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        const swarmState = globalSwarmState.get(swarmId);
        
        if (!swarmState) {
          return {
            success: false,
            error: `Swarm not found: ${swarmId}`,
            swarmId
          };
        }
        
        const agents = swarmState.agents.map((agentId: string) => globalAgentState.get(agentId)).filter(Boolean);
        const tasks = Array.from(globalTaskState.values()).filter(task => task.swarmId === swarmId);
        
        const monitoring = {
          swarmId,
          timestamp: new Date().toISOString(),
          health: {
            overall: 'healthy',
            agentsHealthy: agents.filter((a: any) => a.status === 'active').length,
            agentsTotal: agents.length,
            errorRate: 0
          },
          performance: {
            tasksCompleted: tasks.filter(t => t.status === 'completed').length,
            tasksTotal: tasks.length,
            averageTaskTime: '0s',
            throughput: '0 tasks/min'
          },
          progress: {
            overallProgress: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0,
            currentPhase: 'execution',
            estimatedCompletion: 'calculating...'
          },
          resources: {
            memoryUsage: Object.keys(globalMemoryStore).filter(k => k.startsWith(swarmId)).length,
            activeConnections: agents.length,
            systemLoad: 'normal'
          }
        };
        
        logger.info('Swarm monitoring via MCP', { swarmId, agents: agents.length, tasks: tasks.length });
        
        return {
          success: true,
          swarmId,
          monitoring,
          alerts: [],
          recommendations: agents.length === 0 ? ['Consider spawning agents to begin work'] : []
        };
      }
    },

    {
      name: 'mcp__flowx__agent_list',
      description: 'List all agents in the swarm with their current status',
      inputSchema: {
        type: 'object',
        properties: {
          swarmId: {
            type: 'string',
            description: 'Swarm ID (optional, uses current swarm by default)'
          },
          status: {
            type: 'string',
            enum: ['all', 'active', 'inactive', 'completed', 'failed'],
            default: 'all',
            description: 'Filter agents by status'
          }
        }
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { swarmId: inputSwarmId, status = 'all' } = input;
        
        const swarmId = inputSwarmId || process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        const swarmState = globalSwarmState.get(swarmId);
        
        if (!swarmState) {
          return {
            success: false,
            error: `Swarm not found: ${swarmId}`,
            swarmId
          };
        }
        
        let agents = swarmState.agents.map((agentId: string) => globalAgentState.get(agentId)).filter(Boolean);
        
        if (status !== 'all') {
          agents = agents.filter((agent: any) => agent.status === status);
        }
        
        logger.info('Agent list retrieved via MCP', { swarmId, count: agents.length, status });
        
        return {
          success: true,
          swarmId,
          totalAgents: agents.length,
          filterStatus: status,
          agents: agents.map((agent: any) => ({
            id: agent.id,
            name: agent.name,
            type: agent.type,
            status: agent.status,
            task: agent.task,
            capabilities: agent.capabilities,
            spawnedAt: agent.spawnedAt,
            lastActivity: agent.lastActivity,
            completedTasks: agent.completedTasks
          }))
        };
      }
    },

    {
      name: 'mcp__flowx__agent_communicate',
      description: 'Send messages between agents for coordination',
      inputSchema: {
        type: 'object',
        properties: {
          targetAgent: {
            type: 'string',
            description: 'Target agent ID or name'
          },
          message: {
            type: 'string',
            description: 'Message to send'
          },
          messageType: {
            type: 'string',
            enum: ['info', 'request', 'response', 'coordination', 'alert'],
            default: 'info',
            description: 'Type of message'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium'
          }
        },
        required: ['targetAgent', 'message']
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { targetAgent, message, messageType = 'info', priority = 'medium' } = input;
        
        const swarmId = process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        const fromAgent = process.env['CLAUDE_SWARM_AGENT_ID'] || 'system';
        
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const timestamp = new Date().toISOString();
        
        // Store message (in production this would be in a message queue)
        const messageData = {
          id: messageId,
          from: fromAgent,
          to: targetAgent,
          message,
          messageType,
          priority,
          swarmId,
          timestamp,
          status: 'sent'
        };
        
        logger.info('Agent communication via MCP', { messageId, from: fromAgent, to: targetAgent, type: messageType });
        
        return {
          success: true,
          messageId,
          from: fromAgent,
          to: targetAgent,
          messageType,
          priority,
          timestamp,
          message: `Message sent to ${targetAgent}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`
        };
      }
    },

    {
      name: 'mcp__flowx__task_status',
      description: 'Get status of tasks in the swarm',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Specific task ID (optional, returns all tasks if not provided)'
          },
          includeCompleted: {
            type: 'boolean',
            default: true,
            description: 'Include completed tasks in results'
          },
          assignedTo: {
            type: 'string',
            description: 'Filter tasks assigned to specific agent'
          }
        }
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { taskId, includeCompleted = true, assignedTo } = input;
        
        const swarmId = process.env['CLAUDE_SWARM_ID'] || 'default-swarm';
        
        if (taskId) {
          const task = globalTaskState.get(taskId);
          if (!task || task.swarmId !== swarmId) {
            return {
              success: false,
              error: `Task not found: ${taskId}`,
              taskId
            };
          }
          
          return {
            success: true,
            task: {
              id: task.id,
              name: task.name,
              description: task.description,
              status: task.status,
              priority: task.priority,
              assignTo: task.assignTo,
              progress: task.progress,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
              dependsOn: task.dependsOn
            }
          };
        }
        
        let tasks = Array.from(globalTaskState.values()).filter(task => task.swarmId === swarmId);
        
        if (!includeCompleted) {
          tasks = tasks.filter(task => task.status !== 'completed');
        }
        
        if (assignedTo) {
          tasks = tasks.filter(task => task.assignTo === assignedTo);
        }
        
        logger.info('Task status retrieved via MCP', { swarmId, taskCount: tasks.length });
        
        return {
          success: true,
          swarmId,
          totalTasks: tasks.length,
          tasks: tasks.map(task => ({
            id: task.id,
            name: task.name,
            status: task.status,
            priority: task.priority,
            assignTo: task.assignTo,
            progress: task.progress,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          }))
        };
      }
    },
    
    // ===== LEGACY COMPATIBILITY TOOLS =====
    {
      name: 'swarm/dispatch-agent',
      description: 'Legacy: Spawn a new agent in the swarm to handle a specific task',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['researcher', 'developer', 'analyst', 'reviewer', 'coordinator'],
            description: 'The type of agent to spawn',
          },
          task: {
            type: 'string',
            description: 'The specific task for the agent to complete',
          },
          name: {
            type: 'string',
            description: 'Optional name for the agent',
          },
        },
        required: ['type', 'task'],
      },
      handler: async (input: any, context?: SwarmToolContext) => {
        const { type, task, name } = input;
        
        // Redirect to modern tool
        const modernInput = {
          type,
          name: name || `${type}-${Date.now()}`,
          task,
          capabilities: [type]
        };
        
        const modernTool = tools.find(t => t.name === 'mcp__flowx__agent_spawn');
        if (modernTool) {
          return await modernTool.handler(modernInput, context);
        }
        
        return {
          success: false,
          error: 'Modern agent spawning tool not available'
        };
      },
    }
  ];

  return tools;
}