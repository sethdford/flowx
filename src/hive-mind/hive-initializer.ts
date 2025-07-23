/**
 * Hive Mind Initializer
 * 
 * Main entry point for setting up a Hive Mind collective intelligence system.
 * Configures and orchestrates multiple agents in a swarm topology.
 */

import { HiveMind, HiveMindConfig } from './core/hive-mind.js';
import { NeuralPatternEngine } from '../coordination/neural-pattern-engine.js';
import { Logger } from '../core/logger.js';
import { EventBus } from '../core/event-bus.js';
import { QueenAgent } from '../agents/queen-agent.js';
import { generateId } from '../utils/helpers.js';
import { AgentType, SwarmTopology, QueenMode, Task, TaskPriority, TaskStrategy, AgentCapability } from './types.js';

// Hive Mind initialization options
export interface HiveInitOptions {
  name: string;
  topology: SwarmTopology;
  maxAgents: number;
  queenMode: QueenMode;
  autoSpawn: boolean;
  initialAgents?: {
    type: AgentType;
    count: number;
  }[];
  initialTasks?: {
    description: string;
    priority: TaskPriority;
    strategy: TaskStrategy;
    capabilities?: AgentCapability[];
  }[];
}

// Default configuration options
const DEFAULT_OPTIONS: HiveInitOptions = {
  name: 'DefaultHive',
  topology: 'hierarchical',
  maxAgents: 8,
  queenMode: 'centralized',
  autoSpawn: true,
  initialAgents: [
    { type: 'coordinator', count: 1 },
    { type: 'researcher', count: 1 },
    { type: 'coder', count: 1 }
  ]
};

/**
 * HiveMind Initializer - Creates and configures a hive mind collective intelligence system
 */
export class HiveInitializer {
  private logger: Logger;
  private eventBus: EventBus;
  private neuralEngine?: NeuralPatternEngine;
  private queen?: QueenAgent;
  private hiveMind?: HiveMind;
  private hiveId?: string;

  constructor() {
    this.logger = new Logger('HiveInitializer');
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Initialize the Hive Mind system
   */
  public async initialize(options: Partial<HiveInitOptions> = {}): Promise<string> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    this.logger.info('Initializing Hive Mind', { name: config.name, topology: config.topology });

    try {
      // Initialize neural pattern engine
      await this.setupNeuralEngine();

      // Initialize Hive Mind core
      this.hiveId = await this.setupHiveCore(config);

      // Initialize Queen agent
      await this.setupQueenAgent(config);

      // Spawn initial agents if configured
      if (config.autoSpawn && config.initialAgents && config.initialAgents.length > 0) {
        await this.spawnInitialAgents(config.initialAgents);
      }

      // Create initial tasks if provided
      if (config.initialTasks && config.initialTasks.length > 0) {
        await this.createInitialTasks(config.initialTasks);
      }

      this.logger.info('Hive Mind initialization completed successfully', {
        hiveId: this.hiveId,
        name: config.name,
        topology: config.topology,
      });

      return this.hiveId;
    } catch (error) {
      this.logger.error('Hive Mind initialization failed', { error });
      throw error;
    }
  }

  /**
   * Set up the neural pattern engine
   */
  private async setupNeuralEngine(): Promise<void> {
    try {
      this.neuralEngine = new NeuralPatternEngine({
        enableWasm: true,
        learningRate: 0.001,
        patternThreshold: 0.7,
        maxPatterns: 1000,
        cacheTTL: 300000,
        batchSize: 32,
        enableDistribution: false,
        computeBackend: 'wasm',
        modelPath: './models'
      });

      this.logger.info('Neural pattern engine initialized');
    } catch (error) {
      this.logger.error('Failed to initialize neural pattern engine', { error });
      throw new Error('Neural engine initialization failed: ' + error);
    }
  }

  /**
   * Set up the Hive Mind core
   */
  private async setupHiveCore(options: HiveInitOptions): Promise<string> {
    try {
      // Import required neural components
      const { NeuralIntegration } = await import('./neural/neural-integration.js');
      const { NeuralPatternEngine } = await import('../coordination/neural-pattern-engine.js');
      const { Logger } = await import('../core/logger.js');
      const { EventBus } = await import('../core/event-bus.js');
      
      // Create neural components
      const logger = new Logger('NeuralPatternEngine');
      const eventBus = EventBus.getInstance();
      const neuralEngine = new NeuralPatternEngine({
        enableWasm: true,
        learningRate: 0.001,
        patternThreshold: 0.7,
        maxPatterns: 1000,
        cacheTTL: 300000,
        batchSize: 32,
        enableDistribution: false,
        computeBackend: 'wasm',
        modelPath: './models'
      });
      
      const neuralIntegration = new NeuralIntegration(neuralEngine, {
        taskLearningEnabled: true,
        behaviorAnalysisEnabled: true,
        coordinationOptimizationEnabled: true,
        emergentPatternDetectionEnabled: true,
        confidenceThreshold: 0.6,
        adaptiveLearning: true,
        continuousOptimization: true,
        transferLearningEnabled: true
      });
      
      const hiveMindConfig: HiveMindConfig = {
        neuralIntegration,
        maxAgents: options.maxAgents,
        enableConsensus: true,
        enableDynamicScaling: false,
        resourceMonitoringInterval: 60000
      };

      this.hiveMind = new HiveMind(hiveMindConfig);
      await this.hiveMind.initialize();
      
      // Generate a hive ID
      const hiveId = `hive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.logger.info('Hive Mind core initialized', { hiveId });
      return hiveId;
    } catch (error) {
      this.logger.error('Failed to initialize Hive Mind core', { error });
      throw new Error('Hive Mind initialization failed: ' + error);
    }
  }

  /**
   * Set up the Queen agent
   */
  private async setupQueenAgent(options: HiveInitOptions): Promise<void> {
    if (!this.hiveMind || !this.hiveId || !this.neuralEngine) {
      throw new Error('Cannot set up Queen agent: Hive Mind not initialized');
    }

    try {
      this.queen = new QueenAgent(
        this.hiveId,
        {
          consensusThreshold: 0.7,
          maxDecisionTime: 30000,
          intelligenceWeighting: true,
          emergentBehaviorDetection: true,
          adaptiveLearning: true,
          democraticVoting: true,
          expertiseWeighting: true,
          realTimeConsensus: true,
          conflictResolution: 'neural',
          decisionCaching: true
        },
        this.logger,
        this.eventBus,
        this.neuralEngine
      );

      this.logger.info('Queen agent initialized for Hive Mind', { 
        hiveId: this.hiveId,
        queenMode: options.queenMode
      });
    } catch (error) {
      this.logger.error('Failed to initialize Queen agent', { error });
      throw new Error('Queen agent initialization failed: ' + error);
    }
  }

  /**
   * Spawn the initial set of agents
   */
  private async spawnInitialAgents(agents: { type: AgentType; count: number }[]): Promise<void> {
    if (!this.hiveMind) {
      throw new Error('Cannot spawn agents: Hive Mind not initialized');
    }

    try {
      for (const agentConfig of agents) {
        for (let i = 0; i < agentConfig.count; i++) {
          const agentId = await this.hiveMind.spawnAgent({
            type: agentConfig.type,
            name: `${agentConfig.type}-${i + 1}`,
            autoAssign: true
          });
          
          this.logger.info(`Spawned ${agentConfig.type} agent`, { agentId });
        }
      }

      this.logger.info('Initial agents spawned successfully');
    } catch (error) {
      this.logger.error('Failed to spawn initial agents', { error });
      throw new Error('Agent spawning failed: ' + error);
    }
  }

  /**
   * Create initial tasks
   */
  private async createInitialTasks(tasks: { 
    description: string; 
    priority: TaskPriority;
    strategy: TaskStrategy;
    capabilities?: AgentCapability[];
  }[]): Promise<void> {
    if (!this.hiveMind) {
      throw new Error('Cannot create tasks: Hive Mind not initialized');
    }

    try {
      for (const taskConfig of tasks) {
        const task = await this.hiveMind.submitTask({
          description: taskConfig.description,
          priority: taskConfig.priority,
          strategy: taskConfig.strategy,
          requiredCapabilities: taskConfig.capabilities || []
        });
        
        this.logger.info('Created initial task', { 
          taskId: task.id,
          description: task.description,
          priority: task.priority
        });
      }

      this.logger.info('Initial tasks created successfully');
    } catch (error) {
      this.logger.error('Failed to create initial tasks', { error });
      throw new Error('Task creation failed: ' + error);
    }
  }

  /**
   * Get the initialized Hive Mind instance
   */
  public getHiveMind(): HiveMind | undefined {
    return this.hiveMind;
  }

  /**
   * Get the Queen agent
   */
  public getQueenAgent(): QueenAgent | undefined {
    return this.queen;
  }

  /**
   * Get the neural pattern engine
   */
  public getNeuralEngine(): NeuralPatternEngine | undefined {
    return this.neuralEngine;
  }

  /**
   * Get status information about the Hive Mind system
   */
  public async getStatus(): Promise<any> {
    if (!this.hiveMind) {
      return { initialized: false };
    }

    try {
      const status = await this.hiveMind.getFullStatus();
      return status;
    } catch (error) {
      this.logger.error('Failed to get Hive Mind status', { error });
      throw new Error('Status retrieval failed: ' + error);
    }
  }

  /**
   * Shut down the Hive Mind system
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Hive Mind system');

    try {
      // Shut down in reverse order of initialization
      if (this.queen) {
        await this.queen.shutdown();
        this.logger.info('Queen agent shut down successfully');
      }

      if (this.hiveMind) {
        await this.hiveMind.shutdown();
        this.logger.info('Hive Mind core shut down successfully');
      }

      if (this.neuralEngine) {
        await this.neuralEngine.shutdown();
        this.logger.info('Neural pattern engine shut down successfully');
      }

      this.logger.info('Hive Mind system shut down successfully');
    } catch (error) {
      this.logger.error('Failed to shut down Hive Mind system cleanly', { error });
      throw new Error('Shutdown failed: ' + error);
    }
  }
}

/**
 * Create and initialize a new Hive Mind system
 */
export async function createHiveMind(options: Partial<HiveInitOptions> = {}): Promise<HiveInitializer> {
  const initializer = new HiveInitializer();
  await initializer.initialize(options);
  return initializer;
}