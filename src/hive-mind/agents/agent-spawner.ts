/**
 * Agent Spawner for Hive Mind
 * 
 * Manages agent spawning, lifecycle, and coordination for the Hive Mind system.
 * Integrates with the agent factory to create agents with specialized capabilities.
 */

import { Logger } from '../../core/logger.js';
import { EventBus } from '../../core/event-bus.js';
import { AgentFactory, EnhancedAgentSpawnOptions } from './agent-factory.js';
import { HiveMind } from '../core/hive-mind.js';
import { 
  AgentType, 
  AgentConfig, 
  SwarmTopology, 
  AgentSpawnOptions,
  TaskPriority
} from '../types.js';

// Configuration for agent spawning
export interface AgentSpawnerConfig {
  maxAgents: number;
  autoScaling: boolean;
  balancedDistribution: boolean;
  specialistPriority: AgentType[];
  defaultSpecializationLevel: 'basic' | 'advanced' | 'expert';
  enableEnhancedCapabilities: boolean;
}

// Default agent spawner configuration
const DEFAULT_CONFIG: AgentSpawnerConfig = {
  maxAgents: 8,
  autoScaling: true,
  balancedDistribution: true,
  specialistPriority: ['coordinator', 'researcher', 'coder'],
  defaultSpecializationLevel: 'advanced',
  enableEnhancedCapabilities: true
};

// Topology-based agent templates
const TOPOLOGY_TEMPLATES: Record<SwarmTopology, Array<{ type: AgentType; count: number; options?: Partial<EnhancedAgentSpawnOptions> }>> = {
  hierarchical: [
    { type: 'queen', count: 1 },
    { type: 'coordinator', count: 1 },
    { type: 'researcher', count: 1 },
    { type: 'coder', count: 2 },
    { type: 'analyst', count: 1 },
    { type: 'tester', count: 1 },
    { type: 'reviewer', count: 1 }
  ],
  mesh: [
    { type: 'queen', count: 1 },
    { type: 'coordinator', count: 2 },
    { type: 'researcher', count: 2 },
    { type: 'coder', count: 2 },
    { type: 'specialist', count: 1 }
  ],
  ring: [
    { type: 'queen', count: 1 },
    { type: 'coordinator', count: 1 },
    { type: 'coder', count: 2 },
    { type: 'reviewer', count: 1 },
    { type: 'tester', count: 1 },
    { type: 'documenter', count: 1 },
    { type: 'specialist', count: 1 }
  ],
  star: [
    { type: 'queen', count: 1 },
    { type: 'coordinator', count: 1 },
    { type: 'specialist', count: 6 }
  ]
};

/**
 * Agent Spawner - Handles creation and lifecycle of agents in the Hive Mind
 */
export class AgentSpawner {
  private logger: Logger;
  private eventBus: EventBus;
  private hiveMind: HiveMind;
  private agentFactory: AgentFactory;
  private config: AgentSpawnerConfig;
  
  private spawnedAgents: Map<string, AgentConfig> = new Map();
  private agentCountByType: Map<AgentType, number> = new Map();
  
  constructor(hiveMind: HiveMind, config: Partial<AgentSpawnerConfig> = {}) {
    this.logger = new Logger('AgentSpawner');
    this.eventBus = EventBus.getInstance();
    this.hiveMind = hiveMind;
    this.agentFactory = new AgentFactory();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for agent spawn requests
    this.eventBus.on('agent:spawn_request', async (data: {
      type: AgentType;
      name?: string;
      reason?: string;
      options?: Partial<EnhancedAgentSpawnOptions>;
    }) => {
      await this.spawnAgent({
        type: data.type,
        name: data.name,
        ...data.options
      });
    });
    
    // Listen for auto-scaling events if enabled
    if (this.config.autoScaling) {
      this.eventBus.on('swarm:metrics_update', (data: {
        loadFactor: number;
        pendingTasks: number;
        agentUtilization: number;
      }) => {
        this.evaluateAutoScaling(data);
      });
    }
  }

  /**
   * Spawn a new agent in the hive
   */
  public async spawnAgent(options: EnhancedAgentSpawnOptions): Promise<AgentConfig> {
    // Check if we've reached the maximum number of agents
    if (this.spawnedAgents.size >= this.config.maxAgents) {
      this.logger.warn('Cannot spawn agent: Maximum agent limit reached', {
        currentCount: this.spawnedAgents.size,
        maxAgents: this.config.maxAgents
      });
      throw new Error('Maximum agent limit reached');
    }
    
    try {
      // Set default specialization level if not provided
      if (!options.specializationLevel) {
        options.specializationLevel = this.config.defaultSpecializationLevel;
      }
      
      // Set enhanced capabilities flag if not provided
      if (options.enhancedCapabilities === undefined) {
        options.enhancedCapabilities = this.config.enableEnhancedCapabilities;
      }
      
      // Create agent config using the factory
      const agentConfig = this.agentFactory.createAgent(
        this.hiveMind.getId(),
        options
      );
      
      // Spawn agent in the hive mind
      await this.hiveMind.spawnAgent({
        type: agentConfig.type,
        name: agentConfig.name,
        capabilities: agentConfig.capabilities,
        specialization: agentConfig.specialization,
        systemPrompt: agentConfig.systemPrompt,
        autoAssign: true
      });
      
      // Track agent in local store
      this.spawnedAgents.set(agentConfig.id!, agentConfig);
      
      // Update count by type
      const currentCount = this.agentCountByType.get(agentConfig.type) || 0;
      this.agentCountByType.set(agentConfig.type, currentCount + 1);
      
      this.logger.info('Agent spawned successfully', {
        agentId: agentConfig.id,
        type: agentConfig.type,
        name: agentConfig.name
      });
      
      // Emit event
      this.eventBus.emit('agent:spawned', { agent: agentConfig });
      
      return agentConfig;
    } catch (error) {
      this.logger.error('Failed to spawn agent', {
        type: options.type,
        name: options.name,
        error
      });
      throw error;
    }
  }

  /**
   * Spawn multiple agents according to a template
   */
  public async spawnAgentsByTemplate(
    topology: SwarmTopology,
    customTemplate?: Array<{ type: AgentType; count: number; options?: Partial<EnhancedAgentSpawnOptions> }>
  ): Promise<AgentConfig[]> {
    try {
      const template = customTemplate || TOPOLOGY_TEMPLATES[topology];
      const spawnedAgents: AgentConfig[] = [];
      
      for (const agentSpec of template) {
        for (let i = 0; i < agentSpec.count; i++) {
          try {
            // Skip if we would exceed the max agent count
            if (this.spawnedAgents.size + spawnedAgents.length >= this.config.maxAgents) {
              this.logger.warn('Skipping agent spawn: Would exceed maximum agent limit', {
                type: agentSpec.type,
                currentCount: this.spawnedAgents.size + spawnedAgents.length,
                maxAgents: this.config.maxAgents
              });
              continue;
            }
            
            // Set agent name
            const name = `${agentSpec.type}-${i + 1}`;
            
            // Spawn agent
            const agent = await this.spawnAgent({
              type: agentSpec.type,
              name,
              ...(agentSpec.options || {})
            });
            
            spawnedAgents.push(agent);
          } catch (error) {
            this.logger.error('Failed to spawn agent in template', {
              type: agentSpec.type,
              index: i,
              error
            });
            // Continue with other agents
          }
        }
      }
      
      this.logger.info('Agents spawned by template', {
        topology,
        spawnedCount: spawnedAgents.length,
        totalAgents: this.spawnedAgents.size
      });
      
      return spawnedAgents;
    } catch (error) {
      this.logger.error('Failed to spawn agents by template', {
        topology,
        error
      });
      throw error;
    }
  }

  /**
   * Spawn a replacement agent when an existing agent fails
   */
  public async spawnReplacementAgent(
    failedAgentId: string,
    failedAgentType: AgentType
  ): Promise<AgentConfig | null> {
    this.logger.info('Spawning replacement agent', {
      failedAgentId,
      failedAgentType
    });
    
    try {
      // Remove the failed agent from our tracking
      this.spawnedAgents.delete(failedAgentId);
      
      // Update count by type
      const currentCount = this.agentCountByType.get(failedAgentType) || 0;
      if (currentCount > 0) {
        this.agentCountByType.set(failedAgentType, currentCount - 1);
      }
      
      // Spawn a replacement of the same type
      const replacementAgent = await this.spawnAgent({
        type: failedAgentType,
        name: `${failedAgentType}-replacement-${Date.now().toString(36)}`,
        specializationLevel: this.config.defaultSpecializationLevel,
        enhancedCapabilities: this.config.enableEnhancedCapabilities
      });
      
      this.logger.info('Replacement agent spawned', {
        newAgentId: replacementAgent.id,
        replacedAgentId: failedAgentId
      });
      
      return replacementAgent;
    } catch (error) {
      this.logger.error('Failed to spawn replacement agent', {
        failedAgentId,
        failedAgentType,
        error
      });
      return null;
    }
  }

  /**
   * Evaluate if we need to auto-scale agents based on metrics
   */
  private async evaluateAutoScaling(metrics: {
    loadFactor: number;
    pendingTasks: number;
    agentUtilization: number;
  }): Promise<void> {
    if (!this.config.autoScaling) return;
    
    try {
      // Scale up if load factor is high and we have capacity
      if (metrics.loadFactor > 0.8 && metrics.pendingTasks > 0 && 
          this.spawnedAgents.size < this.config.maxAgents) {
        this.logger.info('Auto-scaling: Adding agent due to high load factor', {
          loadFactor: metrics.loadFactor,
          pendingTasks: metrics.pendingTasks,
          currentAgents: this.spawnedAgents.size
        });
        
        // Determine which agent type to spawn based on pending tasks
        // This is a placeholder - in a real implementation, we would analyze
        // the pending tasks to determine which agent type is most needed
        const agentType = this.determineOptimalAgentType(metrics);
        
        await this.spawnAgent({
          type: agentType,
          name: `${agentType}-autoscale-${Date.now().toString(36)}`,
          specializationLevel: this.config.defaultSpecializationLevel
        });
      }
      
      // Scale down logic would go here if implemented
    } catch (error) {
      this.logger.error('Error during auto-scaling evaluation', { error });
    }
  }

  /**
   * Determine the optimal agent type to spawn based on current needs
   */
  private determineOptimalAgentType(metrics: any): AgentType {
    // This is a placeholder implementation
    // In a real system, we would analyze the pending tasks, current agent distribution,
    // and other factors to determine the optimal agent type
    
    // For now, we'll use a simple approach based on the current agent distribution
    // and the specialist priority configuration
    
    // Check if we're missing any specialists from our priority list
    for (const priorityType of this.config.specialistPriority) {
      const count = this.agentCountByType.get(priorityType) || 0;
      if (count === 0) {
        return priorityType;
      }
    }
    
    // Find the type with the lowest count
    let lowestCount = Infinity;
    let lowestType: AgentType = 'coder'; // Default
    
    for (const priorityType of this.config.specialistPriority) {
      const count = this.agentCountByType.get(priorityType) || 0;
      if (count < lowestCount) {
        lowestCount = count;
        lowestType = priorityType;
      }
    }
    
    return lowestType;
  }

  /**
   * Get all spawned agents
   */
  public getSpawnedAgents(): AgentConfig[] {
    return Array.from(this.spawnedAgents.values());
  }

  /**
   * Get agent counts by type
   */
  public getAgentCountsByType(): Record<AgentType, number> {
    const result: Partial<Record<AgentType, number>> = {};
    
    Array.from(this.agentCountByType.entries()).forEach(([type, count]) => {
      result[type] = count;
    });
    
    return result as Record<AgentType, number>;
  }

  /**
   * Submit a task to create new agents
   */
  public async submitAgentCreationTask(
    agentType: AgentType,
    count: number,
    priority: TaskPriority = 'medium',
    options: Partial<EnhancedAgentSpawnOptions> = {}
  ): Promise<string> {
    const taskDescription = `Create ${count} ${agentType} agent(s)`;
    
    try {
      // Submit task to the hive mind
      const task = await this.hiveMind.submitTask({
        description: taskDescription,
        priority,
        strategy: 'sequential',
        metadata: {
          agentType,
          count,
          options
        }
      });
      
      this.logger.info('Submitted agent creation task', {
        taskId: task.id,
        agentType,
        count
      });
      
      // Listen for task completion
      this.eventBus.once(`task:completed:${task.id}`, async () => {
        // Spawn agents
        try {
          for (let i = 0; i < count; i++) {
            await this.spawnAgent({
              type: agentType,
              ...options
            });
          }
        } catch (error) {
          this.logger.error('Failed to spawn agents after task completion', {
            taskId: task.id,
            error
          });
        }
      });
      
      return task.id;
    } catch (error) {
      this.logger.error('Failed to submit agent creation task', {
        agentType,
        count,
        error
      });
      throw error;
    }
  }
}

/**
 * Create an agent spawner for a hive mind
 */
export function createAgentSpawner(
  hiveMind: HiveMind,
  config: Partial<AgentSpawnerConfig> = {}
): AgentSpawner {
  return new AgentSpawner(hiveMind, config);
}