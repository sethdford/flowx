import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SwarmCoordinator } from '../../../src/swarm/coordinator.js';
import type { EnhancedSwarmConfig } from '../../../src/swarm/coordinator.js';

// Mock the mesh coordinator
jest.mock('../../../src/swarm/mesh-coordinator.js', () => ({
  MeshCoordinator: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    shutdown: jest.fn(() => Promise.resolve()),
    addNode: jest.fn(() => Promise.resolve()),
    coordinateTask: jest.fn(() => Promise.resolve()),
    getNetworkStatus: jest.fn().mockReturnValue({
      metrics: { averageLatency: 50 },
      nodes: []
    })
  }))
}));

// Mock the agent process manager
jest.mock('../../../src/agents/agent-process-manager.ts', () => ({
  AgentProcessManager: jest.fn().mockImplementation(() => ({
    createAgent: jest.fn(() => Promise.resolve()),
    executeTask: jest.fn(() => Promise.resolve()),
    shutdown: jest.fn(() => Promise.resolve()),
    on: jest.fn()
  }))
}));

// Mock the logger
jest.mock('../../../src/core/logger.ts', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock the helpers
jest.mock('../../../src/utils/helpers.ts', () => ({
  generateId: jest.fn(() => 'test-id-' + Math.random().toString(36).substr(2, 9))
}));

describe('Enhanced SwarmCoordinator', () => {
  let coordinator: SwarmCoordinator;
  let config: Partial<EnhancedSwarmConfig>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      name: 'test-swarm',
      topologyMode: 'auto',
      maxAgents: 5,
      adaptiveThresholds: {
        meshActivationNodeCount: 3,
        hierarchicalMaxDepth: 2,
        hybridSwitchingLatency: 50,
        faultToleranceLevel: 0.8
      },
      performanceTargets: {
        maxLatency: 100,
        minThroughput: 5,
        minReliability: 0.9,
        maxLoadImbalance: 0.3
      }
    };

    coordinator = new SwarmCoordinator(config);
  });

  afterEach(async () => {
    if (coordinator) {
      try {
        await coordinator.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with enhanced swarm configuration', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.getSwarmStatus).toBeDefined();
      expect(coordinator.getEnhancedCoordinationStatus).toBeDefined();
    });

    it('should support adaptive topology configuration', () => {
      const coordinatorWithMesh = new SwarmCoordinator({
        ...config,
        topologyMode: 'mesh'
      });
      expect(coordinatorWithMesh).toBeDefined();
    });

    it('should support hierarchical topology configuration', () => {
      const coordinatorWithHierarchical = new SwarmCoordinator({
        ...config,
        topologyMode: 'hierarchical'
      });
      expect(coordinatorWithHierarchical).toBeDefined();
    });

    it('should support hybrid topology configuration', () => {
      const coordinatorWithHybrid = new SwarmCoordinator({
        ...config,
        topologyMode: 'hybrid'
      });
      expect(coordinatorWithHybrid).toBeDefined();
    });
  });

  describe('Adaptive Topology Management', () => {
    it('should initialize adaptive features', async () => {
      await coordinator.initialize();
      
      const status = coordinator.getEnhancedCoordinationStatus();
      expect(status).toHaveProperty('topology');
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('adaptiveHistory');
    });

    it('should support topology switching', async () => {
      await coordinator.initialize();
      
      await coordinator.switchTopology('mesh', 'Test topology switch');
      
      const status = coordinator.getEnhancedCoordinationStatus();
      expect(status.topology).toBe('mesh');
      expect(status.adaptiveHistory.length).toBeGreaterThan(0);
    });

    it('should include network status for mesh topology', async () => {
      await coordinator.initialize();
      await coordinator.switchTopology('mesh', 'Enable mesh for test');
      
      const status = coordinator.getEnhancedCoordinationStatus();
      expect(status.networkStatus).toBeDefined();
    });
  });

  describe('Agent Registration with Adaptive Features', () => {
    it('should register agents with topology awareness', async () => {
      await coordinator.initialize();
      
      const agentId = await coordinator.registerAgent(
        'test-agent',
        'developer',
        ['coding', 'testing']
      );
      
      expect(agentId).toBeDefined();
      expect(typeof agentId).toBe('string');
      
      const agents = coordinator.getAgents();
      expect(agents.length).toBe(1);
      expect(agents[0].name).toBe('test-agent');
      expect(agents[0].type).toBe('developer');
    });

    it('should register agents with mesh coordination when using mesh topology', async () => {
      const meshCoordinator = new SwarmCoordinator({
        ...config,
        topologyMode: 'mesh'
      });
      
      await meshCoordinator.initialize();
      
      const agentId = await meshCoordinator.registerAgent(
        'mesh-agent',
        'developer',
        ['coding', 'analysis']
      );
      
      expect(agentId).toBeDefined();
      
      await meshCoordinator.stop();
    });

    it('should trigger topology adaptation when agent count changes', async () => {
      await coordinator.initialize();
      
      // Add multiple agents to trigger adaptation
      await coordinator.registerAgent('agent1', 'developer', ['coding']);
      await coordinator.registerAgent('agent2', 'tester', ['testing']);
      await coordinator.registerAgent('agent3', 'analyzer', ['analysis']);
      await coordinator.registerAgent('agent4', 'reviewer', ['review']);
      
      const agents = coordinator.getAgents();
      expect(agents.length).toBe(4);
    });
  });

  describe('Enhanced Objective Creation', () => {
    it('should create objectives with pattern detection', async () => {
      await coordinator.initialize();
      
      const objectiveId = await coordinator.createObjective(
        'Create a REST API with testing and documentation',
        'auto'
      );
      
      expect(objectiveId).toBeDefined();
      
      const objectives = coordinator.getObjectives();
      expect(objectives.length).toBe(1);
      expect(objectives[0].description).toContain('REST API');
    });

    it('should analyze task complexity for topology selection', async () => {
      await coordinator.initialize();
      
      const complexObjectiveId = await coordinator.createObjective(
        'Build a distributed machine learning optimization system with real-time performance monitoring',
        'auto'
      );
      
      expect(complexObjectiveId).toBeDefined();
      
      const objectives = coordinator.getObjectives();
      expect(objectives.length).toBe(1);
    });

    it('should decompose objectives into appropriate tasks', async () => {
      await coordinator.initialize();
      
      const objectiveId = await coordinator.createObjective(
        'Create a comprehensive testing automation framework',
        'auto'
      );
      
      const tasks = coordinator.getTasks();
      expect(tasks.length).toBeGreaterThan(0);
      
      // Should have tasks related to testing
      const testingTasks = tasks.filter(task => 
        task.type === 'testing' || 
        task.description.toLowerCase().includes('test')
      );
      expect(testingTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Swarm Intelligence and ML Features', () => {
    it('should provide comprehensive coordination status', async () => {
      await coordinator.initialize();
      
      // Add some agents and objectives
      await coordinator.registerAgent('agent1', 'developer', ['coding']);
      await coordinator.createObjective('Test objective for ML features');
      
      const status = coordinator.getEnhancedCoordinationStatus();
      
      expect(status).toHaveProperty('topology');
      expect(status).toHaveProperty('agents');
      expect(status).toHaveProperty('tasks');
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('adaptiveHistory');
      
      expect(status.agents.length).toBe(1);
      expect(status.tasks.length).toBeGreaterThan(0);
    });

    it('should track topology metrics', async () => {
      await coordinator.initialize();
      
      const status = coordinator.getEnhancedCoordinationStatus();
      const metrics = status.metrics;
      
      expect(metrics).toHaveProperty('coordinationType');
      expect(metrics).toHaveProperty('nodeCount');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('reliability');
      expect(metrics).toHaveProperty('loadBalance');
      expect(metrics).toHaveProperty('faultTolerance');
      expect(metrics).toHaveProperty('resourceUtilization');
    });

    it('should maintain adaptive decision history', async () => {
      await coordinator.initialize();
      
      // Trigger a topology switch
      await coordinator.switchTopology('mesh', 'Test decision tracking');
      await coordinator.switchTopology('hierarchical', 'Test decision tracking 2');
      
      const status = coordinator.getEnhancedCoordinationStatus();
      expect(status.adaptiveHistory.length).toBe(2);
      
      const lastDecision = status.adaptiveHistory[1];
      expect(lastDecision).toHaveProperty('timestamp');
      expect(lastDecision).toHaveProperty('currentTopology');
      expect(lastDecision).toHaveProperty('recommendedTopology');
      expect(lastDecision).toHaveProperty('reason');
      expect(lastDecision.reason).toBe('Test decision tracking 2');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should calculate load balance metrics', async () => {
      await coordinator.initialize();
      
      // Add agents with different workloads
      await coordinator.registerAgent('light-agent', 'developer', ['coding']);
      await coordinator.registerAgent('heavy-agent', 'analyzer', ['analysis']);
      
      const status = coordinator.getEnhancedCoordinationStatus();
      expect(status.metrics.loadBalance).toBeGreaterThanOrEqual(0);
    });

    it('should calculate resource utilization', async () => {
      await coordinator.initialize();
      
      await coordinator.registerAgent('test-agent', 'developer', ['coding']);
      
      const status = coordinator.getEnhancedCoordinationStatus();
      expect(status.metrics.resourceUtilization).toBeGreaterThanOrEqual(0);
      expect(status.metrics.resourceUtilization).toBeLessThanOrEqual(1);
    });
  });

  describe('Integration with Existing Features', () => {
    it('should maintain compatibility with basic swarm status', async () => {
      await coordinator.initialize();
      
      const basicStatus = coordinator.getSwarmStatus();
      
      expect(basicStatus).toHaveProperty('status');
      expect(basicStatus).toHaveProperty('objectives');
      expect(basicStatus).toHaveProperty('tasks');
      expect(basicStatus).toHaveProperty('agents');
      expect(basicStatus).toHaveProperty('uptime');
    });

    it('should provide both basic and enhanced status methods', async () => {
      await coordinator.initialize();
      
      const basicStatus = coordinator.getSwarmStatus();
      const enhancedStatus = coordinator.getEnhancedCoordinationStatus();
      
      // Basic status should be subset of enhanced status
      expect(enhancedStatus.agents.length).toBe(basicStatus.agents.total);
    });

    it('should support all existing agent types', async () => {
      await coordinator.initialize();
      
      const agentTypes = [
        'coordinator',
        'researcher', 
        'developer',
        'analyzer',
        'reviewer',
        'tester',
        'documenter',
        'monitor',
        'specialist'
      ] as const;
      
      for (const type of agentTypes) {
        const agentId = await coordinator.registerAgent(
          `${type}-agent`,
          type,
          ['custom']
        );
        expect(agentId).toBeDefined();
      }
      
      const agents = coordinator.getAgents();
      expect(agents.length).toBe(agentTypes.length);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should properly shutdown all components', async () => {
      await coordinator.initialize();
      
      await coordinator.registerAgent('test-agent', 'developer', ['coding']);
      await coordinator.createObjective('Test objective for shutdown');
      
      // Should not throw
      await coordinator.stop();
      
      const status = coordinator.getSwarmStatus();
      expect(status.status).toBe('completed');
    });

    it('should handle shutdown without initialization', async () => {
      // Should not throw even if not initialized
      await coordinator.stop();
    });
  });
}); 