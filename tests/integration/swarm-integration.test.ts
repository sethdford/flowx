/**
 * Swarm Integration Tests
 * Tests the integration between SwarmCoordinator, memory system, and neural coordination
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SwarmCoordinator } from '../../src/swarm/coordinator.ts';
import { SwarmMemoryManager } from '../../src/swarm/memory.ts';
import type { EnhancedSwarmConfig } from '../../src/swarm/coordinator.ts';

// Mock external dependencies
jest.mock('../../src/coordination/neural-pattern-engine.ts', () => ({
  NeuralPatternEngine: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    detectPatterns: jest.fn().mockResolvedValue([]),
    predictOptimalAgent: jest.fn().mockResolvedValue('agent-1')
  }))
}));

jest.mock('../../src/coordination/background-executor.ts', () => ({
  BackgroundExecutor: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    executeTask: jest.fn().mockResolvedValue({ success: true })
  }))
}));

jest.mock('../../src/swarm/mesh-coordinator.js', () => ({
  MeshCoordinator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    addNode: jest.fn().mockResolvedValue('node-1'),
    coordinateTask: jest.fn().mockResolvedValue('agent-1')
  }))
}));

jest.mock('../../src/agents/agent-process-manager.ts', () => ({
  AgentProcessManager: jest.fn().mockImplementation(() => ({
    createAgent: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    emit: jest.fn()
  }))
}));

describe('Swarm Integration Tests', () => {
  let swarmCoordinator: SwarmCoordinator;
  let testConfig: Partial<EnhancedSwarmConfig>;

  beforeEach(() => {
    testConfig = {
      name: 'TestSwarm',
      maxAgents: 5,
      maxConcurrentTasks: 3,
      memory: {
        namespace: 'test-swarm',
        persistencePath: './test-memory',
        maxMemorySize: 1000000,
        maxEntrySize: 10000,
        defaultTtl: 3600000,
        enableCompression: false,
        enableEncryption: false,
        consistencyLevel: 'eventual',
        syncInterval: 60000,
        backupInterval: 300000,
        maxBackups: 5,
        enableDistribution: false,
        distributionNodes: [],
        replicationFactor: 1,
        enableCaching: true,
        cacheSize: 1000,
        cacheTtl: 300000
      }
    };
  });

  afterEach(async () => {
    if (swarmCoordinator) {
      try {
        await swarmCoordinator.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('SwarmCoordinator Integration', () => {
    it('should initialize with enhanced coordination features', async () => {
      swarmCoordinator = new SwarmCoordinator(testConfig);
      
      expect(swarmCoordinator).toBeInstanceOf(SwarmCoordinator);
      expect(swarmCoordinator.getSwarmStatus).toBeDefined();
    });

    it('should initialize all subsystems successfully', async () => {
      swarmCoordinator = new SwarmCoordinator(testConfig);
      
      // Mock memory initialization to avoid file system dependencies
      const mockMemoryManager = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      };
      (swarmCoordinator as any).memoryManager = mockMemoryManager;
      
      await expect(swarmCoordinator.initialize()).resolves.not.toThrow();
      expect(mockMemoryManager.initialize).toHaveBeenCalled();
    });

    it('should register agents with enhanced capabilities', async () => {
      swarmCoordinator = new SwarmCoordinator(testConfig);
      
      // Mock subsystems
      (swarmCoordinator as any).memoryManager = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      };
      
      await swarmCoordinator.initialize();
      
      const agentId = await swarmCoordinator.registerAgent(
        'TestAgent',
        'developer',
        ['code-generation', 'testing']
      );
      
      expect(agentId).toBeDefined();
      expect(typeof agentId).toBe('string');
      
      const status = swarmCoordinator.getSwarmStatus();
      expect(status.agents.total).toBe(1);
    });

    it('should create objectives with neural pattern detection', async () => {
      swarmCoordinator = new SwarmCoordinator(testConfig);
      
      // Mock subsystems
      (swarmCoordinator as any).memoryManager = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      };
      
      await swarmCoordinator.initialize();
      
      const objectiveId = await swarmCoordinator.createObjective(
        'Create a simple hello world function',
        'development'
      );
      
      expect(objectiveId).toBeDefined();
      expect(typeof objectiveId).toBe('string');
      
      const status = swarmCoordinator.getSwarmStatus();
      expect(status.objectives).toBe(1);
    });

    it('should handle graceful shutdown', async () => {
      swarmCoordinator = new SwarmCoordinator(testConfig);
      
      // Mock subsystems
      (swarmCoordinator as any).memoryManager = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      };
      
      await swarmCoordinator.initialize();
      await expect(swarmCoordinator.stop()).resolves.not.toThrow();
      
      const status = swarmCoordinator.getSwarmStatus();
      expect(status.status).toBe('completed');
    });
  });

  describe('Memory System Integration', () => {
    it('should integrate with memory manager', async () => {
      const memoryManager = new SwarmMemoryManager({
        namespace: 'test',
        persistencePath: './test-memory',
        maxMemorySize: 1000000,
        maxEntrySize: 10000,
        defaultTtl: 3600000,
        enableCompression: false,
        enableEncryption: false,
        consistencyLevel: 'eventual',
        syncInterval: 60000,
        backupInterval: 300000,
        maxBackups: 5,
        enableDistribution: false,
        distributionNodes: [],
        replicationFactor: 1,
        enableCaching: true,
        cacheSize: 1000,
        cacheTtl: 300000
      });

      // Mock file system operations
      const mockPersistence = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined),
        saveState: jest.fn().mockResolvedValue(undefined),
        loadState: jest.fn().mockResolvedValue({ entries: [], partitions: [] })
      };
      (memoryManager as any).persistence = mockPersistence;

      const mockEncryption = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      };
      (memoryManager as any).encryption = mockEncryption;

      const mockReplication = {
        initialize: jest.fn().mockResolvedValue(undefined),
        shutdown: jest.fn().mockResolvedValue(undefined)
      };
      (memoryManager as any).replication = mockReplication;

      await expect(memoryManager.initialize()).resolves.not.toThrow();
      await expect(memoryManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Enhanced Coordination Features', () => {
    it('should utilize neural pattern engine for task optimization', async () => {
      swarmCoordinator = new SwarmCoordinator(testConfig);
      
      // Access the neural engine mock
      const neuralEngine = (swarmCoordinator as any).neuralEngine;
      expect(neuralEngine.initialize).toBeDefined();
    });

    it('should support adaptive topology switching', async () => {
      swarmCoordinator = new SwarmCoordinator(testConfig);
      
      // Test topology switching capability
      const status = swarmCoordinator.getEnhancedCoordinationStatus();
      expect(status.topology).toBeDefined();
      expect(['hierarchical', 'mesh', 'hybrid']).toContain(status.topology);
    });
  });
}); 