/**
 * Hive Mind Collective Intelligence System
 * 
 * Main entry point and exports for the Hive Mind collective intelligence system
 * Based on original flowx v2.0.0 Alpha architecture
 */

// Core components
export { HiveMind } from './core/hive-mind.js';
export { DatabaseManager } from './database/database-manager.ts';
export { HiveInitializer } from './hive-initializer.js';
export { HiveCoordinator, createAndStartHiveMind } from './hive-coordinator.js';

// Agent system
export { AgentFactory, getAgentFactory } from './agents/agent-factory.js';
export { AgentSpawner, createAgentSpawner } from './agents/agent-spawner.js';

// Task system
export { TaskExecutor, createTaskExecutor } from './tasks/task-executor.js';

// Consensus system
export { ConsensusEngine, createConsensusEngine } from './consensus/consensus-engine.js';

// Neural integration
export { NeuralIntegration } from './neural/neural-integration.js';

// Resource management
export { ResourceManager, createResourceManager } from './utilities/resource-manager.js';

// Types - export all types
export * from './types.ts';

// Original factory functions (maintained for backward compatibility)
export const HiveMindFactory = {
  /**
   * Create a new hive mind with default configuration
   */
  async createDefault(name: string): Promise<import('./core/hive-mind.ts').HiveMind> {
    const { HiveMind } = await import('./core/hive-mind.ts');
    const { NeuralIntegration } = await import('./neural/neural-integration.ts');
    const { NeuralPatternEngine } = await import('../coordination/neural-pattern-engine.ts');
    const { Logger } = await import('../core/logger.ts');
    const { EventBus } = await import('../core/event-bus.ts');
    
    // Create neural components
    const logger = new Logger('NeuralPatternEngine');
    const eventBus = EventBus.getInstance();
    const neuralEngine = new NeuralPatternEngine({
      modelUpdateInterval: 300000,
      confidenceThreshold: 0.7,
      trainingBatchSize: 32,
      maxTrainingEpochs: 50,
      learningRate: 0.001,
      enableWasmAcceleration: true,
      patternCacheSize: 1000,
      autoRetraining: true,
      qualityThreshold: 0.7
    }, logger, eventBus);
    
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
    
    const config = {
      neuralIntegration,
      maxAgents: 10,
      enableConsensus: true,
      enableDynamicScaling: false,
      resourceMonitoringInterval: 60000
    };
    
    const hiveMind = new HiveMind(config);
    await hiveMind.initialize();
    
    return hiveMind;
  },

  /**
   * Create a development hive mind with minimal agents
   */
  async createDevelopment(name: string): Promise<import('./core/hive-mind.ts').HiveMind> {
    const { HiveMind } = await import('./core/hive-mind.ts');
    const { NeuralIntegration } = await import('./neural/neural-integration.ts');
    const { NeuralPatternEngine } = await import('../coordination/neural-pattern-engine.ts');
    const { Logger } = await import('../core/logger.ts');
    const { EventBus } = await import('../core/event-bus.ts');
    
    // Create neural components
    const logger = new Logger('NeuralPatternEngine');
    const eventBus = EventBus.getInstance();
    const neuralEngine = new NeuralPatternEngine({
      modelUpdateInterval: 300000,
      confidenceThreshold: 0.7,
      trainingBatchSize: 16,
      maxTrainingEpochs: 25,
      learningRate: 0.001,
      enableWasmAcceleration: false,
      patternCacheSize: 500,
      autoRetraining: true,
      qualityThreshold: 0.6
    }, logger, eventBus);
    
    const neuralIntegration = new NeuralIntegration(neuralEngine, {
      taskLearningEnabled: true,
      behaviorAnalysisEnabled: false,
      coordinationOptimizationEnabled: true,
      emergentPatternDetectionEnabled: false,
      confidenceThreshold: 0.5,
      adaptiveLearning: true,
      continuousOptimization: false,
      transferLearningEnabled: false
    });
    
    const config = {
      neuralIntegration,
      maxAgents: 5,
      enableConsensus: false,
      enableDynamicScaling: false,
      resourceMonitoringInterval: 120000
    };
    
    const hiveMind = new HiveMind(config);
    await hiveMind.initialize();
    
    return hiveMind;
  },

  /**
   * Create an enterprise hive mind with advanced features
   */
  async createEnterprise(name: string): Promise<import('./core/hive-mind.ts').HiveMind> {
    const { HiveMind } = await import('./core/hive-mind.ts');
    const { NeuralIntegration } = await import('./neural/neural-integration.ts');
    const { NeuralPatternEngine } = await import('../coordination/neural-pattern-engine.ts');
    const { Logger } = await import('../core/logger.ts');
    const { EventBus } = await import('../core/event-bus.ts');
    
    // Create neural components with enterprise features
    const logger = new Logger('NeuralPatternEngine');
    const eventBus = EventBus.getInstance();
    const neuralEngine = new NeuralPatternEngine({
      modelUpdateInterval: 180000, // 3 minutes
      confidenceThreshold: 0.8,
      trainingBatchSize: 64,
      maxTrainingEpochs: 100,
      learningRate: 0.0005,
      enableWasmAcceleration: true,
      patternCacheSize: 2000,
      autoRetraining: true,
      qualityThreshold: 0.8
    }, logger, eventBus);
    
    const neuralIntegration = new NeuralIntegration(neuralEngine, {
      taskLearningEnabled: true,
      behaviorAnalysisEnabled: true,
      coordinationOptimizationEnabled: true,
      emergentPatternDetectionEnabled: true,
      confidenceThreshold: 0.7,
      adaptiveLearning: true,
      continuousOptimization: true,
      transferLearningEnabled: true
    });
    
    const config = {
      neuralIntegration,
      maxAgents: 50,
      enableConsensus: true,
      enableDynamicScaling: true,
      resourceMonitoringInterval: 30000
    };
    
    const hiveMind = new HiveMind(config);
    await hiveMind.initialize();
    
    return hiveMind;
  },

  /**
   * Load an existing hive mind from the database
   */
  async load(swarmId: string): Promise<import('./core/hive-mind.ts').HiveMind> {
    const { HiveMind } = await import('./core/hive-mind.ts');
    return await HiveMind.load(swarmId);
  }
};

// New enhanced factory functions

/**
 * Initialize a complete Hive Mind system with resource management
 */
export async function initializeHiveMindSystem(
  hiveConfig: any = {},
  resourceConfig: any = {}
): Promise<{
  hiveCoordinator: any;
  resourceManager: any;
  hiveId: string;
}> {
  // Import required components
  const { createResourceManager } = await import('./utilities/resource-manager.js');
  const { createAndStartHiveMind } = await import('./hive-coordinator.js');
  
  // Create resource manager first
  const resourceManager = createResourceManager(resourceConfig);
  
  // Create and start hive mind system
  const hiveCoordinator = await createAndStartHiveMind(hiveConfig);
  
  // Register hive coordinator with resource manager
  resourceManager.registerHiveCoordinator(hiveCoordinator);
  
  return {
    hiveCoordinator,
    resourceManager,
    hiveId: hiveCoordinator['hiveId'] || 'unknown'
  };
}

/**
 * Shut down a running Hive Mind system
 */
export async function shutdownHiveMindSystem(
  coordinator: any,
  resourceManager: any
): Promise<void> {
  try {
    // Initiate graceful shutdown
    await resourceManager.gracefulShutdown('system_shutdown');
  } catch (error) {
    console.error('Error during system shutdown:', error);
    
    // Try to shutdown components individually
    try {
      await coordinator.stop();
    } catch (err) {
      console.error('Failed to stop coordinator:', err);
    }
    
    try {
      await resourceManager.stop();
    } catch (err) {
      console.error('Failed to stop resource manager:', err);
    }
    
    throw error;
  }
}

// Default export for convenience
export default HiveMindFactory;

// Status functions for CLI commands
export function getNeuralStatus(): any {
  // Mock implementation for testing and development
  return {
    neuralManager: {
      totalPatterns: 0,
      recognitionAccuracy: 0.0,
      learningSessions: 0,
      optimizationCycles: 0
    },
    patternRecognizer: {
      activeModels: 0,
      config: {
        confidenceThreshold: 0.7,
        learningRate: 0.01,
        tensorFlowModels: {
          sequence: { accuracy: 0.0 },
          classification: { accuracy: 0.0 },
          regression: { accuracy: 0.0 }
        }
      }
    }
  };
}

export function getDatabaseStatus(): any {
  // Mock implementation for testing and development
  return {
    totalTables: 0,
    totalRecords: 0,
    lastBackup: new Date().toISOString(),
    status: 'healthy'
  };
}

export function getQueenStatus(): any {
  // Mock implementation for testing and development
  return {
    queenId: 'queen-001',
    collectives: 0,
    totalAgents: 0,
    consensusAlgorithm: 'raft',
    leaderElection: 'inactive'
  };
}

export function getCoordinationStatus(): any {
  // Mock implementation for testing and development
  return {
    activeNodes: 0,
    networkHealth: 'good',
    messageLatency: 0,
    syncStatus: 'idle'
  };
}