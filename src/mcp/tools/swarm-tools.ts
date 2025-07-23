/**
 * FlowX Swarm MCP Tools
 * Real MCP tools for swarm coordination and agent management
 */

import type { MCPTool } from '../../utils/types.js';
import type { SwarmCoordinator } from '../../coordination/swarm-coordinator.js';
import type { BackgroundExecutor } from '../../coordination/background-executor.js';
import type { SwarmMemoryManager } from '../../coordination/swarm-memory-manager.js';
import { getCapabilitiesForType, getSystemPromptForType } from '../../coordination/agent-strategy-helpers.js';

// Global swarm instances (in a real implementation, these would be managed differently)
let globalCoordinator: SwarmCoordinator | null = null;
let globalExecutor: BackgroundExecutor | null = null;
let globalMemory: SwarmMemoryManager | null = null;

/**
 * Initialize swarm systems
 */
export function initializeSwarmSystems(
  coordinator: SwarmCoordinator,
  executor: BackgroundExecutor,
  memory: SwarmMemoryManager
): void {
  globalCoordinator = coordinator;
  globalExecutor = executor;
  globalMemory = memory;
}

/**
 * Agent Management Tools
 */
export const agentSpawnTool: MCPTool = {
  name: 'agents/spawn',
  description: 'Spawn a new agent in the swarm with specified type and capabilities',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist'],
        description: 'Type of agent to spawn'
      },
      name: {
        type: 'string',
        description: 'Name for the agent (optional, will be auto-generated if not provided)'
      },
      capabilities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Custom capabilities (optional, will use defaults for agent type if not provided)'
      },
      systemPrompt: {
        type: 'string',
        description: 'Custom system prompt (optional)'
      }
    },
    required: ['type']
  },
  handler: async (args: any) => {
    if (!globalCoordinator) {
      throw new Error('Swarm coordinator not initialized');
    }

    const { type, name, capabilities, systemPrompt } = args;
    const agentName = name || `${type}-${Date.now()}`;
    const agentCapabilities = capabilities || getCapabilitiesForType(type);
    const agentSystemPrompt = systemPrompt || getSystemPromptForType(type);

    const agentId = await globalCoordinator.registerAgent(
      agentName,
      type,
      agentCapabilities,
      agentSystemPrompt
    );

    // Also register as worker in executor
    if (globalExecutor) {
      globalExecutor.registerWorker(agentId, agentCapabilities);
    }

    return {
      success: true,
      agentId,
      name: agentName,
      type,
      capabilities: agentCapabilities,
      message: `Agent ${agentName} (${type}) spawned successfully`
    };
  }
};

export const agentListTool: MCPTool = {
  name: 'agents/list',
  description: 'List all active agents in the swarm',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['idle', 'busy', 'error', 'offline'],
        description: 'Filter agents by status (optional)'
      },
      type: {
        type: 'string',
        description: 'Filter agents by type (optional)'
      }
    }
  },
  handler: async (args: any) => {
    if (!globalCoordinator) {
      throw new Error('Swarm coordinator not initialized');
    }

    const status = globalCoordinator.getSystemStatus();
    const agents = (globalCoordinator as any).agents as Map<string, any>;
    
    let agentList = Array.from(agents.values());

    // Apply filters
    if (args.status) {
      agentList = agentList.filter(agent => agent.status === args.status);
    }
    if (args.type) {
      agentList = agentList.filter(agent => agent.type === args.type);
    }

    return {
      success: true,
      agents: agentList.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        capabilities: agent.capabilities,
        performance: agent.performance,
        currentTask: agent.currentTask
      })),
      total: agentList.length,
      summary: status.agents
    };
  }
};

/**
 * Task Management Tools
 */
export const taskCreateTool: MCPTool = {
  name: 'tasks/create',
  description: 'Create a new task or objective in the swarm',
  inputSchema: {
    type: 'object',
    properties: {
      objective: {
        type: 'string',
        description: 'The main objective or task description'
      },
      strategy: {
        type: 'string',
        enum: ['auto', 'research', 'development', 'analysis', 'testing', 'optimization'],
        default: 'auto',
        description: 'Strategy for completing the objective'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        description: 'Priority level for the task'
      },
      assignTo: {
        type: 'string',
        description: 'Specific agent ID to assign to (optional)'
      }
    },
    required: ['objective']
  },
  handler: async (args: any) => {
    if (!globalCoordinator) {
      throw new Error('Swarm coordinator not initialized');
    }

    const { objective, strategy = 'auto', priority = 'medium', assignTo } = args;

    const objectiveId = await globalCoordinator.createObjective(objective, strategy);

    // If assignTo is specified, try to assign the first task
    if (assignTo) {
      const tasks = (globalCoordinator as any).tasks as Map<string, any>;
      const firstTask = Array.from(tasks.values()).find(task => 
        task.status === 'pending'
      );
      
      if (firstTask) {
        await globalCoordinator.assignTask(firstTask.id, assignTo);
      }
    }

    return {
      success: true,
      objectiveId,
      objective,
      strategy,
      priority,
      message: `Objective created: ${objective}`,
      assignedTo: assignTo || null
    };
  }
};

export const taskListTool: MCPTool = {
  name: 'tasks/list',
  description: 'List all tasks in the swarm',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'assigned', 'executing', 'completed', 'failed'],
        description: 'Filter tasks by status (optional)'
      },
      agentId: {
        type: 'string',
        description: 'Filter tasks by assigned agent (optional)'
      }
    }
  },
  handler: async (args: any) => {
    if (!globalCoordinator) {
      throw new Error('Swarm coordinator not initialized');
    }

    const tasks = (globalCoordinator as any).tasks as Map<string, any>;
    let taskList = Array.from(tasks.values());

    // Apply filters
    if (args.status) {
      taskList = taskList.filter(task => task.status === args.status);
    }
    if (args.agentId) {
      taskList = taskList.filter(task => task.assignedAgent === args.agentId);
    }

    return {
      success: true,
      tasks: taskList.map(task => ({
        id: task.id,
        type: task.type,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedAgent: task.assignedAgent,
        dependencies: task.dependencies,
        estimatedTime: task.estimatedTime,
        actualTime: task.actualTime
      })),
      total: taskList.length
    };
  }
};

export const taskAssignTool: MCPTool = {
  name: 'tasks/assign',
  description: 'Assign a task to a specific agent',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'ID of the task to assign'
      },
      agentId: {
        type: 'string',
        description: 'ID of the agent to assign to (optional for auto-assignment)'
      }
    },
    required: ['taskId']
  },
  handler: async (args: any) => {
    if (!globalCoordinator) {
      throw new Error('Swarm coordinator not initialized');
    }

    const { taskId, agentId } = args;
    const success = await globalCoordinator.assignTask(taskId, agentId);

    if (success) {
      return {
        success: true,
        taskId,
        agentId: agentId || 'auto-assigned',
        message: `Task ${taskId} assigned successfully`
      };
    } else {
      return {
        success: false,
        taskId,
        message: `Failed to assign task ${taskId}`
      };
    }
  }
};

/**
 * Memory Management Tools
 */
export const memoryStoreTool: MCPTool = {
  name: 'memory/store',
  description: 'Store information in swarm memory',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Key for the memory entry'
      },
      value: {
        description: 'Value to store (any type)'
      },
      type: {
        type: 'string',
        enum: ['data', 'knowledge', 'pattern', 'learning', 'context'],
        default: 'data',
        description: 'Type of memory entry'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization (optional)'
      },
      ttl: {
        type: 'number',
        description: 'Time to live in milliseconds (optional)'
      }
    },
    required: ['key', 'value']
  },
  handler: async (args: any) => {
    if (!globalMemory) {
      throw new Error('Swarm memory not initialized');
    }

    const { key, value, type = 'data', tags = [], ttl } = args;

    const entryId = await globalMemory.store(key, value, {
      type,
      tags,
      ttl
    });

    return {
      success: true,
      entryId,
      key,
      type,
      message: `Stored in memory: ${key}`
    };
  }
};

export const memoryRetrieveTool: MCPTool = {
  name: 'memory/retrieve',
  description: 'Retrieve information from swarm memory',
  inputSchema: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Key of the memory entry to retrieve'
      },
      namespace: {
        type: 'string',
        description: 'Namespace to search in (optional)'
      }
    },
    required: ['key']
  },
  handler: async (args: any) => {
    if (!globalMemory) {
      throw new Error('Swarm memory not initialized');
    }

    const { key, namespace } = args;
    const entry = await globalMemory.retrieve(key, namespace);

    if (entry) {
      return {
        success: true,
        entry: {
          id: entry.id,
          key: entry.key,
          value: entry.value,
          type: entry.type,
          tags: entry.tags,
          metadata: entry.metadata
        },
        message: `Retrieved from memory: ${key}`
      };
    } else {
      return {
        success: false,
        key,
        message: `Memory entry not found: ${key}`
      };
    }
  }
};

export const memoryQueryTool: MCPTool = {
  name: 'memory/query',
  description: 'Query swarm memory with filters',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['data', 'knowledge', 'pattern', 'learning', 'context'],
        description: 'Filter by memory type (optional)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (optional)'
      },
      search: {
        type: 'string',
        description: 'Search in keys and values (optional)'
      },
      limit: {
        type: 'number',
        default: 10,
        description: 'Maximum number of results'
      }
    }
  },
  handler: async (args: any) => {
    if (!globalMemory) {
      throw new Error('Swarm memory not initialized');
    }

    const entries = await globalMemory.query(args);

    return {
      success: true,
      entries: entries.map(entry => ({
        id: entry.id,
        key: entry.key,
        value: entry.value,
        type: entry.type,
        tags: entry.tags,
        metadata: entry.metadata
      })),
      total: entries.length,
      query: args
    };
  }
};

/**
 * System Status Tools
 */
export const swarmStatusTool: MCPTool = {
  name: 'swarm/status',
  description: 'Get comprehensive swarm system status',
  inputSchema: {
    type: 'object',
    properties: {
      detailed: {
        type: 'boolean',
        default: false,
        description: 'Include detailed information'
      }
    }
  },
  handler: async (args: any) => {
    const status: any = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (globalCoordinator) {
      status.coordinator = globalCoordinator.getSystemStatus();
    }

    if (globalExecutor) {
      status.executor = globalExecutor.getSystemMetrics();
    }

    if (globalMemory) {
      status.memory = globalMemory.getMemoryStats();
    }

    if (args.detailed) {
      status.detailed = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      };
    }

    return status;
  }
};

export const swarmMonitorTool: MCPTool = {
  name: 'swarm/monitor',
  description: 'Monitor swarm performance and health',
  inputSchema: {
    type: 'object',
    properties: {
      duration: {
        type: 'number',
        default: 10,
        description: 'Monitoring duration in seconds'
      }
    }
  },
  handler: async (args: any) => {
    const { duration = 10 } = args;
    const startTime = Date.now();
    const samples: any[] = [];

    // Take samples over the duration
    for (let i = 0; i < duration; i++) {
      const sample: any = {
        timestamp: new Date().toISOString(),
        time: Date.now() - startTime
      };

      if (globalCoordinator) {
        sample.coordinator = globalCoordinator.getSystemStatus();
      }

      if (globalExecutor) {
        sample.executor = globalExecutor.getSystemMetrics();
      }

      samples.push(sample);

      // Wait 1 second between samples
      if (i < duration - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success: true,
      duration,
      samples,
      summary: {
        totalSamples: samples.length,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString()
      }
    };
  }
};

/**
 * All FlowX Swarm MCP Tools
 */
export const flowxSwarmTools: MCPTool[] = [
  // Agent Management
  agentSpawnTool,
  agentListTool,
  
  // Task Management
  taskCreateTool,
  taskListTool,
  taskAssignTool,
  
  // Memory Management
  memoryStoreTool,
  memoryRetrieveTool,
  memoryQueryTool,
  
  // System Status
  swarmStatusTool,
  swarmMonitorTool
];

export default flowxSwarmTools; 