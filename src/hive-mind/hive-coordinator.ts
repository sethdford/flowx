/**
 * Hive Mind Coordinator
 * 
 * Main entry point for the Hive Mind collective intelligence system.
 * Initializes and coordinates all components of the system.
 */

import { EventEmitter } from 'node:events';
import { Logger } from '../core/logger.js';
import { EventBus } from '../core/event-bus.js';
import { HiveInitializer, HiveInitOptions } from './hive-initializer.js';
import { AgentSpawner, AgentSpawnerConfig } from './agents/agent-spawner.js';
import { NeuralIntegration, NeuralIntegrationConfig } from './neural/neural-integration.js';
import { TaskExecutor, TaskExecutorConfig } from './tasks/task-executor.js';
import { ConsensusEngine, ConsensusEngineConfig } from './consensus/consensus-engine.js';
import { SwarmTopology, QueenMode, AgentType, TaskPriority, TaskStrategy, AgentCapability } from './types.js';

// System coordination configuration
export interface HiveCoordinatorConfig {
  name: string;
  topology: SwarmTopology;
  maxAgents: number;
  queenMode: QueenMode;
  autoSpawn: boolean;
  autoStartTasks: boolean;
  enableNeuralPatterns: boolean;
  enableConsensus: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  shutdownTimeout: number;
  healthCheckInterval: number;
  initialAgents?: Array<{ type: AgentType; count: number }>;
  agentSpawnerConfig?: Partial<AgentSpawnerConfig>;
  neuralConfig?: Partial<NeuralIntegrationConfig>;
  taskExecutorConfig?: Partial<TaskExecutorConfig>;
  consensusConfig?: Partial<ConsensusEngineConfig>;
}

// Default configuration
const DEFAULT_CONFIG: HiveCoordinatorConfig = {
  name: 'HiveMind-Collective',
  topology: 'hierarchical',
  maxAgents: 8,
  queenMode: 'centralized',
  autoSpawn: true,
  autoStartTasks: true,
  enableNeuralPatterns: true,
  enableConsensus: true,
  logLevel: 'info',
  shutdownTimeout: 10000, // 10 seconds
  healthCheckInterval: 30000, // 30 seconds
  initialAgents: [
    { type: 'coordinator', count: 1 },
    { type: 'researcher', count: 1 },
    { type: 'coder', count: 2 },
    { type: 'analyst', count: 1 },
    { type: 'tester', count: 1 }
  ]
};

// System health status
export type SystemHealthStatus = 'starting' | 'healthy' | 'degraded' | 'critical' | 'stopping' | 'stopped';

// System statistics
export interface SystemStats {
  uptime: number;
  agents: {
    total: number;
    active: number;
    byType: Record<AgentType, number>;
  };
  tasks: {
    total: number;
    pending: number;
    active: number;
    completed: number;
    failed: number;
  };
  consensus: {
    totalProposals: number;
    achievedConsensus: number;
    failedConsensus: number;
  };
  memory: {
    usage: number;
    entries: number;
  };
  performance: {
    averageTaskTime: number;
    successRate: number;
    neuralAccuracy: number;
  };
}

/**
 * Hive Mind Coordinator - Main entry point for the collective intelligence system
 */
export class HiveCoordinator extends EventEmitter {
  private logger: Logger;
  private eventBus: EventBus;
  private config: HiveCoordinatorConfig;
  
  // System components
  private initializer?: HiveInitializer;
  private agentSpawner?: AgentSpawner;
  private neuralIntegration?: NeuralIntegration;
  private taskExecutor?: TaskExecutor;
  private consensusEngine?: ConsensusEngine;
  
  // System state
  private startTime: number = 0;
  private health: SystemHealthStatus = 'stopped';
  private hiveId?: string;
  private healthCheckInterval?: NodeJS.Timeout;
  
  constructor(config: Partial<HiveCoordinatorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger('HiveCoordinator');
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Start the Hive Mind system
   */
  public async start(): Promise<string> {
    try {
      if (this.health !== 'stopped') {
        throw new Error('System is already running');
      }
      
      this.health = 'starting';
      this.startTime = Date.now();
      
      this.logger.info('Starting Hive Mind system', {
        name: this.config.name,
        topology: this.config.topology,
        maxAgents: this.config.maxAgents
      });
      
      // Initialize core components
      await this.initializeComponents();
      
      // Set up system monitoring
      this.setupMonitoring();
      
      // System is healthy
      this.health = 'healthy';
      
      // Emit started event
      this.emit('system:started', {
        hiveId: this.hiveId,
        startTime: this.startTime,
        config: {
          name: this.config.name,
          topology: this.config.topology,
          maxAgents: this.config.maxAgents,
          queenMode: this.config.queenMode
        }
      });
      
      this.logger.info('Hive Mind system started successfully', {
        hiveId: this.hiveId,
        agents: this.agentSpawner ? 
          Object.entries(await this.agentSpawner.getAgentCountsByType()).length : 0
      });
      
      return this.hiveId!;
    } catch (error) {
      this.logger.error('Failed to start Hive Mind system', { error });
      this.health = 'stopped';
      throw error;
    }
  }

  /**
   * Initialize system components
   */
  private async initializeComponents(): Promise<void> {
    // 1. Initialize Hive Mind core
    this.logger.info('Initializing Hive Mind core');
    const initOptions: Partial<HiveInitOptions> = {
      name: this.config.name,
      topology: this.config.topology,
      maxAgents: this.config.maxAgents,
      queenMode: this.config.queenMode,
      autoSpawn: this.config.autoSpawn
    };
    
    this.initializer = new HiveInitializer();
    this.hiveId = await this.initializer.initialize(initOptions);
    
    const hiveMind = this.initializer.getHiveMind();
    if (!hiveMind) {
      throw new Error('Failed to initialize Hive Mind core');
    }
    
    // 2. Initialize agent spawner
    this.logger.info('Initializing agent spawner');
    this.agentSpawner = new AgentSpawner(
      hiveMind,
      this.config.agentSpawnerConfig
    );
    
    // 3. Initialize neural integration if enabled
    if (this.config.enableNeuralPatterns) {
      this.logger.info('Initializing neural integration');
      const neuralEngine = this.initializer.getNeuralEngine();
      
      if (neuralEngine) {
        this.neuralIntegration = new NeuralIntegration(
          neuralEngine,
          this.config.neuralConfig
        );
      } else {
        this.logger.warn('Neural engine not available, skipping neural integration');
      }
    }
    
    // 4. Initialize task executor
    this.logger.info('Initializing task executor');
    this.taskExecutor = new TaskExecutor(
      hiveMind,
      this.config.taskExecutorConfig
    );
    
    // 5. Initialize consensus engine if enabled
    if (this.config.enableConsensus) {
      this.logger.info('Initializing consensus engine');
      this.consensusEngine = new ConsensusEngine(
        this.config.consensusConfig
      );
    }
    
    // 6. Start services
    if (this.taskExecutor && this.config.autoStartTasks) {
      this.taskExecutor.start();
    }
    
    // 7. Spawn initial agents if configured
    if (this.agentSpawner && this.config.initialAgents && this.config.initialAgents.length > 0) {
      this.logger.info('Spawning initial agents');
      await this.agentSpawner.spawnAgentsByTemplate(this.config.topology, this.config.initialAgents);
    }
  }

  /**
   * Set up system monitoring
   */
  private setupMonitoring(): void {
    // Set up health check interval
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck();
      }, this.config.healthCheckInterval);
    }
    
    // Listen for critical events
    this.eventBus.on('system:error', (data: { component: string; error: any }) => {
      this.logger.error('System error detected', {
        component: data.component,
        error: data.error
      });
      
      // Update health status
      if (this.health === 'healthy') {
        this.health = 'degraded';
        this.emit('system:health_changed', { status: this.health });
      }
    });
    
    // Listen for agent failures
    this.eventBus.on('agent:failed', (data: { agentId: string; reason: string }) => {
      this.logger.warn('Agent failure detected', {
        agentId: data.agentId,
        reason: data.reason
      });
      
      // Try to replace failed agent
      if (this.agentSpawner && this.health !== 'stopping' && this.health !== 'stopped') {
        this.agentSpawner.spawnReplacementAgent(data.agentId, 'specialist')
          .catch(error => {
            this.logger.error('Failed to spawn replacement agent', {
              agentId: data.agentId,
              error
            });
          });
      }
    });
  }

  /**
   * Perform a system health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      if (this.health === 'stopping' || this.health === 'stopped') {
        return;
      }
      
      this.logger.debug('Performing health check');
      
      // Check hive mind status
      if (!this.initializer || !this.initializer.getHiveMind()) {
        this.health = 'critical';
        this.emit('system:health_changed', { status: this.health });
        this.logger.error('Health check failed: Hive Mind not initialized');
        return;
      }
      
      // Get system statistics
      const stats = await this.getSystemStats();
      
      // Evaluate system health
      let newHealth: SystemHealthStatus = 'healthy';
      
      // Check agent health
      if (stats.agents.active === 0) {
        newHealth = 'critical';
      } else if (stats.agents.active < stats.agents.total * 0.5) {
        newHealth = 'degraded';
      }
      
      // Check task health
      if (stats.tasks.failed > stats.tasks.completed && stats.tasks.total > 5) {
        newHealth = Math.min(newHealth === 'critical' ? 0 : 1, 1) === 0 ? 'critical' : 'degraded';
      }
      
      // Update health status if changed
      if (newHealth !== this.health) {
        this.health = newHealth;
        this.emit('system:health_changed', { status: this.health });
        this.logger.info('System health status changed', { status: this.health });
      }
      
      // Emit health check event
      this.emit('system:health_check', {
        status: this.health,
        stats
      });
    } catch (error) {
      this.logger.error('Health check failed', { error });
      this.health = 'degraded';
      this.emit('system:health_changed', { status: this.health });
    }
  }

  /**
   * Get system statistics
   */
  public async getSystemStats(): Promise<SystemStats> {
    try {
      const uptime = Date.now() - this.startTime;
      
      // Get agent statistics
      const agentStats = {
        total: 0,
        active: 0,
        byType: {} as Record<AgentType, number>
      };
      
      if (this.agentSpawner) {
        const agentCounts = await this.agentSpawner.getAgentCountsByType();
        agentStats.byType = agentCounts;
        agentStats.total = Object.values(agentCounts).reduce((sum, count) => sum + count, 0);
        agentStats.active = agentStats.total; // Simplified - in a real system we'd track actual active agents
      }
      
      // Get task statistics
      const taskStats = {
        total: 0,
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0
      };
      
      if (this.taskExecutor) {
        const metrics = this.taskExecutor.getMetrics();
        taskStats.total = metrics.totalSubmitted;
        taskStats.completed = metrics.totalCompleted;
        taskStats.failed = metrics.totalFailed;
        taskStats.active = this.taskExecutor.getActiveTasks().length;
        taskStats.pending = this.taskExecutor.getPendingTasks().length;
      }
      
      // Get consensus statistics
      let consensusStats = {
        totalProposals: 0,
        achievedConsensus: 0,
        failedConsensus: 0
      };
      
      if (this.consensusEngine) {
        const metrics = this.consensusEngine.getMetrics();
        consensusStats = metrics;
      }
      
      // Memory statistics are placeholder in this implementation
      const memoryStats = {
        usage: 0,
        entries: 0
      };
      
      // Performance statistics
      const performanceStats = {
        averageTaskTime: this.taskExecutor?.getMetrics().averageExecutionTime || 0,
        successRate: taskStats.total > 0 ? 
          taskStats.completed / taskStats.total : 0,
        neuralAccuracy: 0 // Placeholder
      };
      
      return {
        uptime,
        agents: agentStats,
        tasks: taskStats,
        consensus: consensusStats,
        memory: memoryStats,
        performance: performanceStats
      };
    } catch (error) {
      this.logger.error('Failed to get system statistics', { error });
      throw error;
    }
  }

  /**
   * Submit a task to the hive mind
   */
  public async submitTask(options: {
    description: string;
    priority?: TaskPriority;
    strategy?: TaskStrategy;
    capabilities?: AgentCapability[];
  }): Promise<string> {
    try {
      if (!this.taskExecutor) {
        throw new Error('Task executor not initialized');
      }
      
      const task = await this.taskExecutor.submitTask({
        description: options.description,
        priority: options.priority || 'medium',
        strategy: options.strategy || 'parallel',
        requiredCapabilities: options.capabilities || []
      });
      
      return task.id;
    } catch (error) {
      this.logger.error('Failed to submit task', {
        description: options.description,
        error
      });
      throw error;
    }
  }

  /**
   * Spawn an agent in the hive mind
   */
  public async spawnAgent(options: {
    type: AgentType;
    name?: string;
    capabilities?: AgentCapability[];
    specialization?: string;
  }): Promise<string> {
    try {
      if (!this.agentSpawner) {
        throw new Error('Agent spawner not initialized');
      }
      
      const agent = await this.agentSpawner.spawnAgent({
        type: options.type,
        name: options.name,
        capabilities: options.capabilities,
        specialization: options.specialization
      });
      
      return agent.id!;
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
   * Create a consensus proposal
   */
  public async createConsensusProposal(options: {
    proposal: any;
    requiredThreshold?: number;
    votingStrategy?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    try {
      if (!this.consensusEngine) {
        throw new Error('Consensus engine not initialized or disabled');
      }
      
      if (!this.hiveId) {
        throw new Error('Hive Mind not initialized');
      }
      
      const proposal = await this.consensusEngine.createProposal({
        swarmId: this.hiveId,
        proposal: options.proposal,
        requiredThreshold: options.requiredThreshold,
        votingStrategy: options.votingStrategy as any,
        metadata: options.metadata
      });
      
      return proposal.id;
    } catch (error) {
      this.logger.error('Failed to create consensus proposal', {
        proposal: options.proposal,
        error
      });
      throw error;
    }
  }

  /**
   * Get system health status
   */
  public getHealthStatus(): SystemHealthStatus {
    return this.health;
  }

  /**
   * Stop the Hive Mind system
   */
  public async stop(): Promise<void> {
    try {
      if (this.health === 'stopped') {
        return;
      }
      
      this.health = 'stopping';
      this.logger.info('Stopping Hive Mind system');
      
      // Clear health check interval
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }
      
      // Stop task executor
      if (this.taskExecutor) {
        this.taskExecutor.stop();
      }
      
      // Shutdown initializer (which will also shutdown hive mind, queen, and neural engine)
      if (this.initializer) {
        await Promise.race([
          this.initializer.shutdown(),
          new Promise(resolve => setTimeout(resolve, this.config.shutdownTimeout))
        ]);
      }
      
      // Reset state
      this.health = 'stopped';
      this.hiveId = undefined;
      this.initializer = undefined;
      this.agentSpawner = undefined;
      this.neuralIntegration = undefined;
      this.taskExecutor = undefined;
      this.consensusEngine = undefined;
      
      // Emit stopped event
      this.emit('system:stopped', {
        uptime: Date.now() - this.startTime
      });
      
      this.logger.info('Hive Mind system stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping Hive Mind system', { error });
      this.health = 'stopped'; // Force stopped state
      throw error;
    }
  }
}

/**
 * Create and start a Hive Mind system
 */
export async function createAndStartHiveMind(
  config: Partial<HiveCoordinatorConfig> = {}
): Promise<HiveCoordinator> {
  const coordinator = new HiveCoordinator(config);
  await coordinator.start();
  return coordinator;
}