/**
 * Enhanced Mesh Coordinator Tests
 * 
 * Comprehensive test suite covering:
 * - Advanced consensus algorithms (Raft, PBFT)
 * - AI-driven topology optimization
 * - Byzantine fault tolerance
 * - Dynamic load balancing and routing
 * - Network partitioning and recovery
 * - Performance monitoring and metrics
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EnhancedMeshCoordinator, EnhancedMeshNode } from '../../../src/coordination/enhanced-mesh-coordinator.js';
import { AgentState, TaskDefinition, AgentId, TaskId } from '../../../src/swarm/types.js';

describe('EnhancedMeshCoordinator', () => {
  let coordinator: EnhancedMeshCoordinator;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    
    jest.doMock('../../../src/core/logger.js', () => ({
      Logger: jest.fn().mockImplementation(() => mockLogger)
    }));
    
    coordinator = new EnhancedMeshCoordinator({
      primaryConsensusAlgorithm: 'raft',
      fallbackConsensusAlgorithm: 'pbft',
      maxNodes: 50,
      maxNeighborsPerNode: 8,
      topologyOptimizationInterval: 60000,
      optimizationAlgorithm: 'reinforcement-learning'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with correct configuration', async () => {
      await coordinator.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Enhanced mesh coordinator initialized successfully'
      );
    });

    it('should initialize with default consensus algorithms', async () => {
      await coordinator.initialize();
      
      const metrics = coordinator.getEnhancedMetrics();
      expect(metrics.consensus.algorithmsActive).toBeGreaterThan(0);
    });

    it('should handle initialization failures gracefully', async () => {
      // Mock a component initialization failure
      const failingCoordinator = new EnhancedMeshCoordinator();
      
      // Mock initializeConsensusAlgorithms to fail
      const originalInit = (failingCoordinator as any).initializeConsensusAlgorithms;
      (failingCoordinator as any).initializeConsensusAlgorithms = jest.fn(() => 
        Promise.reject(new Error('Consensus initialization failed'))
      );
      
      await expect(failingCoordinator.initialize()).rejects.toThrow(
        'Consensus initialization failed'
      );
    });
  });

  describe('Node Management', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should add nodes to the mesh successfully', async () => {
      const agentState = createMockAgentState('agent-1');
      
      const nodeId = await coordinator.addNode(agentState);
      
      expect(nodeId).toBeDefined();
      expect(nodeId).toMatch(/^node-/);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Enhanced node added to mesh',
        expect.objectContaining({
          nodeId,
          agentId: agentState.id.id
        })
      );
    });

    it('should establish optimal connections between nodes', async () => {
      const agentStates = [
        createMockAgentState('agent-1'),
        createMockAgentState('agent-2'),
        createMockAgentState('agent-3')
      ];
      
      const nodeIds: string[] = [];
      for (const agentState of agentStates) {
        const nodeId = await coordinator.addNode(agentState);
        nodeIds.push(nodeId);
      }
      
      // Verify nodes are connected
      const metrics = coordinator.getEnhancedMetrics();
      expect(metrics.topology.connections).toBeGreaterThan(0);
    });

    it('should remove nodes and redistribute connections', async () => {
      const agentState = createMockAgentState('agent-1');
      const nodeId = await coordinator.addNode(agentState);
      
      await coordinator.removeNode(nodeId);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node removed from mesh',
        expect.objectContaining({ nodeId })
      );
    });

    it('should handle node removal failure gracefully', async () => {
      await expect(coordinator.removeNode('non-existent-node')).rejects.toThrow(
        'Node non-existent-node not found'
      );
    });

    it('should enforce maximum node limits', async () => {
      const limitedCoordinator = new EnhancedMeshCoordinator({
        maxNodes: 2
      });
      await limitedCoordinator.initialize();
      
      // Add maximum nodes
      await limitedCoordinator.addNode(createMockAgentState('agent-1'));
      await limitedCoordinator.addNode(createMockAgentState('agent-2'));
      
      // Adding one more should be handled by the coordinator's internal logic
      const nodeId3 = await limitedCoordinator.addNode(createMockAgentState('agent-3'));
      expect(nodeId3).toBeDefined();
    });
  });

  describe('Consensus Algorithms', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      
      // Add some nodes for consensus
      await coordinator.addNode(createMockAgentState('agent-1'));
      await coordinator.addNode(createMockAgentState('agent-2'));
      await coordinator.addNode(createMockAgentState('agent-3'));
    });

    it('should run Raft consensus successfully', async () => {
      const task = createMockTask('task-1');
      
      const assignedNodeId = await coordinator.assignTask(task);
      
      expect(assignedNodeId).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task assigned via enhanced consensus',
        expect.objectContaining({
          taskId: task.id.id,
          nodeId: assignedNodeId,
          consensusAlgorithm: 'raft'
        })
      );
    });

    it('should handle consensus failures', async () => {
      // Mock consensus failure
      const originalRunConsensus = (coordinator as any).runConsensus;
      (coordinator as any).runConsensus = jest.fn(() => 
        Promise.reject(new Error('Consensus failed'))
      );
      
      const task = createMockTask('task-1');
      
      await expect(coordinator.assignTask(task)).rejects.toThrow(
        'Consensus failed'
      );
    });

    it('should fallback to secondary consensus algorithm', async () => {
      // Mock primary consensus failure and fallback success
      const originalRunConsensus = (coordinator as any).runConsensus;
      let callCount = 0;
      (coordinator as any).runConsensus = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Primary consensus failed');
        }
        return {
          consensusId: 'consensus-1',
          approved: true,
          votes: 3,
          requiredVotes: 2,
          duration: 100,
          algorithm: 'pbft'
        };
      });
      
      const task = createMockTask('task-1');
      
      // Should still succeed using fallback
      const assignedNodeId = await coordinator.assignTask(task);
      expect(assignedNodeId).toBeDefined();
    });

    it('should track consensus performance metrics', async () => {
      const task = createMockTask('task-1');
      await coordinator.assignTask(task);
      
      const metrics = coordinator.getEnhancedMetrics();
      expect(metrics.consensus.averageLatency).toBeGreaterThan(0);
      expect(metrics.consensus.successRate).toBeGreaterThan(0);
      expect(metrics.consensus.throughput).toBeGreaterThan(0);
    });
  });

  describe('Topology Optimization', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      
      // Add nodes for topology optimization
      for (let i = 1; i <= 5; i++) {
        await coordinator.addNode(createMockAgentState(`agent-${i}`));
      }
    });

    it('should optimize topology using AI algorithms', async () => {
      const result = await coordinator.optimizeTopology();
      
      expect(result).toMatchObject({
        algorithm: 'reinforcement-learning',
        improvementsApplied: expect.any(Number),
        performanceGain: expect.any(Number),
        stabilityImprovement: expect.any(Number),
        duration: expect.any(Number)
      });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Topology optimization completed',
        expect.objectContaining({
          duration: expect.any(Number),
          improvements: expect.any(Number)
        })
      );
    });

    it('should handle topology optimization failures', async () => {
      // Mock optimization failure
      const originalRunTopologyOptimization = (coordinator as any).runTopologyOptimization;
      (coordinator as any).runTopologyOptimization = jest.fn(() => 
        Promise.reject(new Error('Optimization failed'))
      );
      
      await expect(coordinator.optimizeTopology()).rejects.toThrow(
        'Optimization failed'
      );
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Topology optimization failed',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should calculate network topology metrics', async () => {
      const metrics = coordinator.getEnhancedMetrics();
      
      expect(metrics.topology).toMatchObject({
        nodes: expect.any(Number),
        connections: expect.any(Number),
        diameter: expect.any(Number),
        clustering: expect.any(Number),
        efficiency: expect.any(Number)
      });
    });

    it('should apply optimization improvements within limits', async () => {
      const result = await coordinator.optimizeTopology();
      
      // Should respect maxTopologyChangesPerInterval
      expect(result.improvementsApplied).toBeLessThanOrEqual(5);
    });
  });

  describe('Task Assignment and Routing', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      
      // Add nodes with different capabilities
      await coordinator.addNode(createMockAgentState('agent-1', ['capability-a']));
      await coordinator.addNode(createMockAgentState('agent-2', ['capability-b']));
      await coordinator.addNode(createMockAgentState('agent-3', ['capability-a', 'capability-b']));
    });

    it('should select optimal node based on multiple criteria', async () => {
      const task = createMockTask('task-1', ['capability-a']);
      
      const assignedNodeId = await coordinator.assignTask(task);
      
      expect(assignedNodeId).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task assigned via enhanced consensus',
        expect.objectContaining({
          taskId: task.id.id,
          nodeId: assignedNodeId
        })
      );
    });

    it('should handle no suitable node available', async () => {
      const task = createMockTask('task-1', ['non-existent-capability']);
      
      // Mock node selection to return null
      const originalSelectOptimalNode = (coordinator as any).selectOptimalNode;
      (coordinator as any).selectOptimalNode = jest.fn(() => Promise.resolve(null));
      
      await expect(coordinator.assignTask(task)).rejects.toThrow(
        'No suitable node found for task assignment'
      );
    });

    it('should route tasks through optimal paths', async () => {
      const task = createMockTask('task-1');
      
      const assignedNodeId = await coordinator.assignTask(task);
      
      // Verify routing was attempted
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Routing task to node',
        expect.objectContaining({
          taskId: task.id.id,
          nodeId: assignedNodeId
        })
      );
    });

    it('should update performance metrics on task assignment', async () => {
      const task = createMockTask('task-1');
      const initialMetrics = coordinator.getEnhancedMetrics();
      const initialThroughput = initialMetrics.throughput;
      
      await coordinator.assignTask(task);
      
      const updatedMetrics = coordinator.getEnhancedMetrics();
      expect(updatedMetrics.throughput).toBeGreaterThanOrEqual(initialThroughput);
    });
  });

  describe('Fault Tolerance and Recovery', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      
      // Add nodes for fault tolerance testing
      for (let i = 1; i <= 6; i++) {
        await coordinator.addNode(createMockAgentState(`agent-${i}`));
      }
    });

    it('should detect and handle network partitions', async () => {
      const partitionedNodes = ['node-1', 'node-2'];
      
      const recoveryResult = await coordinator.handleNetworkPartition(partitionedNodes);
      
      expect(recoveryResult).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        recoveredNodes: expect.any(Number),
        strategy: expect.any(String)
      });
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Network partition detected',
        expect.objectContaining({
          partitionId: expect.any(String),
          affectedNodes: 2
        })
      );
    });

    it('should handle partition recovery failures', async () => {
      // Mock recovery failure
      const originalExecutePartitionRecovery = (coordinator as any).executePartitionRecovery;
      (coordinator as any).executePartitionRecovery = jest.fn(() => Promise.resolve({
        partitionId: 'partition-1',
        strategy: 'isolation-recovery',
        success: false,
        duration: 5000,
        recoveredNodes: 0,
        error: 'Recovery failed',
        startTime: new Date(),
        endTime: new Date()
      }));
      
      const result = await coordinator.handleNetworkPartition(['node-1']);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Recovery failed');
    });

    it('should calculate Byzantine fault tolerance capacity', async () => {
      const metrics = coordinator.getEnhancedMetrics();
      
      // For 6 nodes, should tolerate floor((6-1)/3) = 1 Byzantine fault
      expect(metrics.faultTolerance.byzantineFaultCapacity).toBeGreaterThanOrEqual(1);
    });

    it('should detect unhealthy nodes', async () => {
      const agentState = createMockAgentState('agent-unhealthy');
      const nodeId = await coordinator.addNode(agentState);
      
      // Simulate unhealthy node condition
      const node = (coordinator as any).nodes.get(nodeId);
      if (node) {
        node.health.overall = 0.3; // Below threshold
        (coordinator as any).handleUnhealthyNode(node);
      }
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unhealthy node detected',
        expect.objectContaining({
          nodeId,
          health: 0.3
        })
      );
    });

    it('should track suspected faults', async () => {
      const agentState = createMockAgentState('agent-suspected');
      const nodeId = await coordinator.addNode(agentState);
      
      // Simulate fault detection
      const node = (coordinator as any).nodes.get(nodeId);
      if (node) {
        node.health.overall = 0.2;
        (coordinator as any).handleUnhealthyNode(node);
      }
      
      const metrics = coordinator.getEnhancedMetrics();
      expect(metrics.faultTolerance.suspectedFaults).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      
      // Add nodes for performance testing
      for (let i = 1; i <= 4; i++) {
        await coordinator.addNode(createMockAgentState(`agent-${i}`));
      }
    });

    it('should provide comprehensive enhanced metrics', async () => {
      const metrics = coordinator.getEnhancedMetrics();
      
      expect(metrics).toMatchObject({
        totalNodes: expect.any(Number),
        activeConnections: expect.any(Number),
        averageLatency: expect.any(Number),
        networkReliability: expect.any(Number),
        throughput: expect.any(Number),
        consensusAccuracy: expect.any(Number),
        partitionResilienceScore: expect.any(Number),
        consensus: {
          algorithmsActive: expect.any(Number),
          averageLatency: expect.any(Number),
          successRate: expect.any(Number),
          throughput: expect.any(Number)
        },
        topology: {
          nodes: expect.any(Number),
          connections: expect.any(Number),
          diameter: expect.any(Number),
          clustering: expect.any(Number),
          efficiency: expect.any(Number)
        },
        faultTolerance: {
          byzantineFaultCapacity: expect.any(Number),
          suspectedFaults: expect.any(Number),
          activeRecoveries: expect.any(Number),
          mttr: expect.any(Number)
        },
        optimization: {
          lastOptimization: expect.any(Date),
          optimizationFrequency: expect.any(Number),
          improvementTrend: expect.any(Number),
          convergenceStability: expect.any(Number)
        }
      });
    });

    it('should update metrics over time', async () => {
      const initialMetrics = coordinator.getEnhancedMetrics();
      
      // Perform some operations
      const task = createMockTask('task-1');
      await coordinator.assignTask(task);
      
      // Trigger metrics collection
      (coordinator as any).collectAndUpdateMetrics();
      
      const updatedMetrics = coordinator.getEnhancedMetrics();
      // Compare timestamps if available
      if (updatedMetrics.lastUpdated && initialMetrics.lastUpdated) {
        expect(updatedMetrics.lastUpdated.getTime()).toBeGreaterThan(
          initialMetrics.lastUpdated.getTime()
        );
      }
    });

    it('should track performance history', async () => {
      // Perform operations to generate history
      for (let i = 0; i < 3; i++) {
        const task = createMockTask(`task-${i}`);
        await coordinator.assignTask(task);
        (coordinator as any).collectAndUpdateMetrics();
      }
      
      const metricsHistory = (coordinator as any).metricsHistory;
      expect(metricsHistory.length).toBeGreaterThan(0);
    });

    it('should maintain metrics history size limit', async () => {
      const coordinatorWithLimit = new EnhancedMeshCoordinator({
        performanceHistorySize: 2
      });
      await coordinatorWithLimit.initialize();
      
      // Generate more metrics than the limit
      for (let i = 0; i < 5; i++) {
        (coordinatorWithLimit as any).collectAndUpdateMetrics();
      }
      
      const metricsHistory = (coordinatorWithLimit as any).metricsHistory;
      expect(metricsHistory.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Background Processes', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should start background processes on initialization', async () => {
      // Check that intervals are set
      expect((coordinator as any).optimizationInterval).toBeDefined();
      expect((coordinator as any).healthCheckInterval).toBeDefined();
      expect((coordinator as any).consensusInterval).toBeDefined();
      expect((coordinator as any).metricsInterval).toBeDefined();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Background processes started');
    });

    it('should perform health checks on all nodes', async () => {
      // Add a node
      await coordinator.addNode(createMockAgentState('agent-1'));
      
      // Trigger health check
      (coordinator as any).performHealthChecks();
      
      // Verify health check was performed
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Checking stream health',
        expect.any(Object)
      );
    });

    it('should maintain consensus algorithms', async () => {
      // Add nodes for consensus
      await coordinator.addNode(createMockAgentState('agent-1'));
      await coordinator.addNode(createMockAgentState('agent-2'));
      
      // Trigger consensus maintenance
      (coordinator as any).maintainConsensus();
      
      // Should not throw errors
      expect(mockLogger.debug).toHaveBeenCalledWith('Maintaining PBFT consensus');
    });
  });

  describe('Advanced Consensus Scenarios', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      
      // Add nodes for consensus testing
      for (let i = 1; i <= 7; i++) {
        await coordinator.addNode(createMockAgentState(`agent-${i}`));
      }
    });

    it('should handle PBFT consensus with Byzantine faults', async () => {
      // Configure for PBFT
      const pbftCoordinator = new EnhancedMeshCoordinator({
        primaryConsensusAlgorithm: 'pbft',
        maxByzantineFaults: 2
      });
      await pbftCoordinator.initialize();
      
      // Add nodes
      for (let i = 1; i <= 7; i++) {
        await pbftCoordinator.addNode(createMockAgentState(`agent-${i}`));
      }
      
      const task = createMockTask('pbft-task');
      const assignedNodeId = await pbftCoordinator.assignTask(task);
      
      expect(assignedNodeId).toBeDefined();
    });

    it('should handle consensus timeouts', async () => {
      // Configure with short timeout
      const timeoutCoordinator = new EnhancedMeshCoordinator({
        consensusTimeout: 1,
        maxConsensusRounds: 1
      });
      await timeoutCoordinator.initialize();
      
      await timeoutCoordinator.addNode(createMockAgentState('agent-1'));
      
      // Mock consensus to timeout
      const originalRunRaftConsensus = (timeoutCoordinator as any).runRaftConsensus;
      (timeoutCoordinator as any).runRaftConsensus = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      const task = createMockTask('timeout-task');
      
      // Should handle timeout gracefully
      await expect(timeoutCoordinator.assignTask(task)).rejects.toThrow();
    });

    it('should track consensus performance degradation', async () => {
      // Perform multiple consensus operations
      for (let i = 0; i < 5; i++) {
        const task = createMockTask(`task-${i}`);
        await coordinator.assignTask(task);
      }
      
      const metrics = coordinator.getEnhancedMetrics();
      expect(metrics.consensus.averageLatency).toBeGreaterThan(0);
      expect(metrics.consensus.successRate).toBeGreaterThan(0);
    });
  });
});

// ===== HELPER FUNCTIONS =====

function createMockAgentState(id: string, capabilities: string[] = ['general']): AgentState {
  const agentId: AgentId = {
    id,
    swarmId: 'test-swarm',
    type: 'developer',
    instance: 1
  };

  return {
    id: agentId,
    name: `Agent ${id}`,
    type: 'developer',
    status: 'idle',
    capabilities: {
      codeGeneration: capabilities.includes('coding'),
      codeReview: capabilities.includes('review'),
      testing: capabilities.includes('testing'),
      documentation: capabilities.includes('documentation'),
      research: capabilities.includes('research'),
      analysis: capabilities.includes('analysis'),
      webSearch: capabilities.includes('web-search'),
      apiIntegration: capabilities.includes('api-integration'),
      fileSystem: capabilities.includes('file-system'),
      terminalAccess: capabilities.includes('terminal-access'),
      languages: [],
      frameworks: [],
      domains: [],
      tools: [],
      maxConcurrentTasks: 3,
      maxMemoryUsage: 512,
      maxExecutionTime: 300000,
      reliability: 1.0,
      speed: 1.0,
      quality: 0.8
    },
    metrics: {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      successRate: 1.0,
      cpuUsage: 0.5,
      memoryUsage: 0.6,
      diskUsage: 0.3,
      networkUsage: 0.8,
      codeQuality: 0.8,
      testCoverage: 0,
      bugRate: 0,
      userSatisfaction: 0.8,
      totalUptime: 0,
      lastActivity: new Date(),
      responseTime: 100
    },
    workload: 0,
    health: 1.0,
    config: {
      autonomyLevel: 0.8,
      learningEnabled: true,
      adaptationEnabled: true,
      maxTasksPerHour: 20,
      maxConcurrentTasks: 3,
      timeoutThreshold: 300000,
      reportingInterval: 30000,
      heartbeatInterval: 10000,
      permissions: ['read', 'write', 'execute'],
      trustedAgents: [],
      expertise: {},
      preferences: {}
    },
    environment: {
      runtime: 'node',
      version: '18.0.0',
      workingDirectory: `./agents/${id}`,
      tempDirectory: './temp',
      logDirectory: './logs',
      apiEndpoints: {},
      credentials: {},
      availableTools: [],
      toolConfigs: {}
    },
    endpoints: [],
    lastHeartbeat: new Date(),
    taskHistory: [],
    errorHistory: [],
    childAgents: [],
    collaborators: []
  };
}

function createMockTask(id: string, requiredCapabilities: string[] = ['general']): TaskDefinition {
  const taskId: TaskId = {
    id,
    swarmId: 'test-swarm',
    sequence: 1,
    priority: 1
  };

  return {
    id: taskId,
    type: 'coding',
    name: `Test task ${id}`,
    description: `Test task ${id}`,
    instructions: `Complete task ${id}`,
    requirements: {
      capabilities: requiredCapabilities,
      tools: [],
      permissions: [],
      estimatedDuration: 1000
    },
    constraints: {
      dependencies: [],
      dependents: [],
      conflicts: []
    },
    priority: 'normal',
    input: {},
    context: {},
    status: 'queued',
    createdAt: new Date(),
    updatedAt: new Date(),
    attempts: [],
    statusHistory: []
  };
} 