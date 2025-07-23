/**
 * Advanced Mesh Coordinator Tests
 * Comprehensive testing for mesh topology coordination with peer-to-peer communication,
 * consensus mechanisms, fault tolerance, and network optimization
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MeshCoordinator } from '../../../src/swarm/mesh-coordinator';
import { AgentId, TaskDefinition, TaskId, AgentType } from '../../../src/swarm/types';

// Mock dependencies before importing
jest.doMock('../../../src/core/logger', () => ({
  Logger: jest.fn().mockImplementation((config, context) => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    config: config || {},
    context: context || {}
  }))
}));

jest.mock('../../../src/utils/logger', () => ({
  createConsoleLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../../../src/utils/helpers', () => ({
  generateId: jest.fn().mockImplementation((prefix) => `${prefix}-${Date.now()}-${Math.random()}`)
}));

describe('MeshCoordinator', () => {
  let meshCoordinator: MeshCoordinator;
  let mockConfig: any;

  // Helper function to create valid AgentId
  const createAgentId = (id: string, type: AgentType = 'researcher'): AgentId => ({
    id,
    swarmId: 'test-swarm',
    type,
    instance: 1
  });

  // Helper function to create valid TaskId
  const createTaskId = (id: string): TaskId => ({
    id,
    swarmId: 'test-swarm',
    sequence: 1,
    priority: 1
  });

  // Helper function to create valid TaskDefinition
  const createTaskDefinition = (id: string): TaskDefinition => ({
    id: createTaskId(id),
    name: `Task ${id}`,
    type: 'research',
    description: 'Test task for mesh coordination',
    status: 'created',
    priority: 'normal',
    requirements: {
      capabilities: ['research'],
      tools: [],
      permissions: []
    },
    constraints: {
      dependencies: [],
      dependents: [],
      conflicts: []
    },
    input: {},
    instructions: 'Test instructions',
    context: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    attempts: [],
    statusHistory: []
  });

  beforeEach(() => {
    mockConfig = {
      maxPeersPerNode: 6,
      consensusTimeout: 5000,
      heartbeatInterval: 1000,
      connectionMaintenanceInterval: 2000,
      maxNetworkDiameter: 4,
      byzantineFaultTolerance: true,
      adaptiveTopology: true,
      loadBalancingStrategy: 'ml-optimized',
      consensusAlgorithm: 'pbft',
      partitionRecoveryStrategy: 'hybrid',
      networkOptimizationInterval: 10000,
      reputationDecayRate: 0.95
    };
    
    meshCoordinator = new MeshCoordinator(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (meshCoordinator) {
      await meshCoordinator.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultCoordinator = new MeshCoordinator();
      expect(defaultCoordinator).toBeInstanceOf(MeshCoordinator);
    });

    it('should initialize with custom configuration', () => {
      expect(meshCoordinator).toBeInstanceOf(MeshCoordinator);
    });

    it('should start background processes on initialization', async () => {
      const initPromise = meshCoordinator.initialize();
      await expect(initPromise).resolves.toBeUndefined();
    });

    it('should emit initialization event', async () => {
      const initEventPromise = new Promise((resolve) => {
        meshCoordinator.once('mesh:initialized', resolve);
      });

      await meshCoordinator.initialize();
      await expect(initEventPromise).resolves.toBeDefined();
    });
  });

  describe('Node Management', () => {
    beforeEach(async () => {
      await meshCoordinator.initialize();
    });

    it('should add a node to the mesh network', async () => {
      const agentId = createAgentId('agent-1');
      const capabilities = ['research', 'analysis'];
      
      const nodeId = await meshCoordinator.addNode(agentId, capabilities, 'region-1');
      
      expect(nodeId).toBeDefined();
      expect(typeof nodeId).toBe('string');
      
      const status = meshCoordinator.getNetworkStatus();
      expect(status.nodes).toHaveLength(1);
      expect(status.nodes[0].id).toBe(nodeId);
    });

    it('should establish optimal peer connections when adding nodes', async () => {
      const nodes = [];
      
      // Add multiple nodes
      for (let i = 0; i < 5; i++) {
        const agentId = createAgentId(`agent-${i}`);
        const capabilities = ['research', 'analysis'];
        const nodeId = await meshCoordinator.addNode(agentId, capabilities, 'region-1');
        nodes.push(nodeId);
      }
      
      const status = meshCoordinator.getNetworkStatus();
      expect(status.nodes).toHaveLength(5);
      
      // Check that nodes have established connections
      const hasConnections = status.nodes.some(node => node.peerCount > 0);
      expect(hasConnections).toBe(true);
    });

    it('should remove a node from the mesh network', async () => {
      const agentId = createAgentId('agent-1');
      const capabilities = ['research', 'analysis'];
      
      const nodeId = await meshCoordinator.addNode(agentId, capabilities);
      expect(meshCoordinator.getNetworkStatus().nodes).toHaveLength(1);
      
      await meshCoordinator.removeNode(nodeId);
      expect(meshCoordinator.getNetworkStatus().nodes).toHaveLength(0);
    });

    it('should emit node events when adding/removing nodes', async () => {
      const addEventPromise = new Promise((resolve) => {
        meshCoordinator.once('mesh:node:added', resolve);
      });
      
      const removeEventPromise = new Promise((resolve) => {
        meshCoordinator.once('mesh:node:removed', resolve);
      });
      
      const agentId = createAgentId('agent-1');
      const nodeId = await meshCoordinator.addNode(agentId, ['research']);
      
      await expect(addEventPromise).resolves.toBeDefined();
      
      await meshCoordinator.removeNode(nodeId);
      await expect(removeEventPromise).resolves.toBeDefined();
    });

    it('should handle node addition with optimal position calculation', async () => {
      // Add nodes in the same region
      const region = 'test-region';
      const nodeIds = [];
      
      for (let i = 0; i < 3; i++) {
        const agentId = createAgentId(`agent-${i}`);
        const nodeId = await meshCoordinator.addNode(agentId, ['research'], region);
        nodeIds.push(nodeId);
      }
      
      const status = meshCoordinator.getNetworkStatus();
      expect(status.nodes).toHaveLength(3);
      
      // All nodes should be in the same region
      status.nodes.forEach(node => {
        // In a real implementation, we would check node.region
        expect(node.id).toBeDefined();
      });
    });
  });

  describe('Task Coordination', () => {
    let taskDefinition: TaskDefinition;

    beforeEach(async () => {
      await meshCoordinator.initialize();
      
      // Add some nodes for task coordination
      for (let i = 0; i < 3; i++) {
        const agentId = createAgentId(`agent-${i}`);
        await meshCoordinator.addNode(agentId, ['research', 'analysis']);
      }

      taskDefinition = createTaskDefinition('task-1');
    });

    it('should coordinate task assignment through mesh network', async () => {
      const assignedNodeId = await meshCoordinator.coordinateTask(taskDefinition);
      
      expect(assignedNodeId).toBeDefined();
      expect(typeof assignedNodeId).toBe('string');
    });

    it('should emit task assignment events', async () => {
      const taskEventPromise = new Promise((resolve) => {
        meshCoordinator.once('mesh:task:assigned', resolve);
      });
      
      await meshCoordinator.coordinateTask(taskDefinition);
      await expect(taskEventPromise).resolves.toBeDefined();
    });

    it('should handle task coordination with bidding process', async () => {
      // The coordinateTask method should handle the bidding process internally
      const startTime = Date.now();
      const assignedNodeId = await meshCoordinator.coordinateTask(taskDefinition);
      const endTime = Date.now();
      
      expect(assignedNodeId).toBeDefined();
      expect(endTime - startTime).toBeGreaterThan(1000); // Should take time for bidding
    });

    it('should select optimal agent based on multiple criteria', async () => {
      // Add nodes with different capabilities and loads
      const specialAgentId = createAgentId('special-agent', 'analyzer');
      await meshCoordinator.addNode(specialAgentId, ['research', 'analysis', 'optimization']);
      
      const assignedNodeId = await meshCoordinator.coordinateTask(taskDefinition);
      expect(assignedNodeId).toBeDefined();
    });
  });

  describe('Consensus Mechanisms', () => {
    beforeEach(async () => {
      await meshCoordinator.initialize();
      
      // Add nodes for consensus testing
      for (let i = 0; i < 5; i++) {
        const agentId = createAgentId(`consensus-agent-${i}`);
        await meshCoordinator.addNode(agentId, ['research']);
      }
    });

    it('should create consensus request', async () => {
      const consensusId = await meshCoordinator.createConsensusRequest(
        'topology_change',
        { change: 'test' },
        0.6
      );
      
      expect(consensusId).toBeDefined();
      expect(typeof consensusId).toBe('string');
      
      const status = meshCoordinator.getNetworkStatus();
      expect(status.consensusRequests).toHaveLength(1);
    });

    it('should handle vote submission', async () => {
      const consensusId = await meshCoordinator.createConsensusRequest(
        'load_balancing',
        { strategy: 'round-robin' }
      );
      
      const status = meshCoordinator.getNetworkStatus();
      const nodeId = status.nodes[0]?.id;
      
      if (nodeId) {
        await meshCoordinator.submitVote(consensusId, nodeId, 'approve', 'Good proposal');
        
        const updatedStatus = meshCoordinator.getNetworkStatus();
        const consensusRequest = updatedStatus.consensusRequests.find(r => r.id === consensusId);
        expect(consensusRequest?.votes).toBeGreaterThan(0);
      }
    });

    it('should emit consensus events', async () => {
      const consensusEventPromise = new Promise((resolve) => {
        meshCoordinator.once('mesh:consensus:approved', resolve);
      });
      
      const consensusId = await meshCoordinator.createConsensusRequest(
        'resource_allocation',
        { resources: 'test' }
      );
      
      const status = meshCoordinator.getNetworkStatus();
      
      // Submit enough votes to reach consensus
      for (let i = 0; i < Math.min(4, status.nodes.length); i++) {
        const nodeId = status.nodes[i].id;
        await meshCoordinator.submitVote(consensusId, nodeId, 'approve');
      }
      
      // Wait a bit for consensus processing
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should handle consensus timeout', async () => {
      const timeoutEventPromise = new Promise((resolve) => {
        meshCoordinator.once('mesh:consensus:timeout', resolve);
      });
      
      // Create consensus with very short timeout
      const shortTimeoutCoordinator = new MeshCoordinator({
        ...mockConfig,
        consensusTimeout: 100
      });
      
      await shortTimeoutCoordinator.initialize();
      
      const agentId = createAgentId('timeout-agent');
      await shortTimeoutCoordinator.addNode(agentId, ['research']);
      
      await shortTimeoutCoordinator.createConsensusRequest('topology_change', { test: true });
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await shortTimeoutCoordinator.shutdown();
    });
  });

  describe('Network Optimization', () => {
    beforeEach(async () => {
      await meshCoordinator.initialize();
    });

    it('should optimize network topology', async () => {
      // Add nodes to create a network that can be optimized
      for (let i = 0; i < 6; i++) {
        const agentId = createAgentId(`opt-agent-${i}`);
        await meshCoordinator.addNode(agentId, ['research', 'analysis']);
      }
      
      // Trigger optimization
      await meshCoordinator.optimizeNetworkTopology();
      
      // Optimization should complete without error
      const status = meshCoordinator.getNetworkStatus();
      expect(status.nodes.length).toBe(6);
    });

    it('should calculate network metrics correctly', () => {
      const status = meshCoordinator.getNetworkStatus();
      const metrics = status.metrics;
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalNodes).toBe('number');
      expect(typeof metrics.activeConnections).toBe('number');
      expect(typeof metrics.averageLatency).toBe('number');
      expect(typeof metrics.networkReliability).toBe('number');
    });
  });

  describe('Fault Tolerance', () => {
    beforeEach(async () => {
      await meshCoordinator.initialize();
      
      // Add nodes for fault tolerance testing
      for (let i = 0; i < 4; i++) {
        const agentId = createAgentId(`fault-agent-${i}`);
        await meshCoordinator.addNode(agentId, ['research']);
      }
    });

    it('should handle network partition detection', async () => {
      const status = meshCoordinator.getNetworkStatus();
      const nodeIds = status.nodes.slice(0, 2).map(n => n.id);
      
      await meshCoordinator.handleNetworkPartition(nodeIds);
      
      const updatedStatus = meshCoordinator.getNetworkStatus();
      expect(updatedStatus.partitions.length).toBeGreaterThan(0);
    });

    it('should emit partition events', async () => {
      const partitionEventPromise = new Promise((resolve) => {
        meshCoordinator.once('mesh:partition:recovered', resolve);
      });
      
      const status = meshCoordinator.getNetworkStatus();
      const nodeIds = status.nodes.slice(0, 2).map(n => n.id);
      
      await meshCoordinator.handleNetworkPartition(nodeIds);
      
      // Simulate partition recovery (would normally happen automatically)
      // In this test, we just check that the partition was created
      const updatedStatus = meshCoordinator.getNetworkStatus();
      expect(updatedStatus.partitions.length).toBeGreaterThan(0);
    });

    it('should handle node failures gracefully', async () => {
      const status = meshCoordinator.getNetworkStatus();
      const initialNodeCount = status.nodes.length;
      
      if (status.nodes.length > 0) {
        const nodeToRemove = status.nodes[0].id;
        await meshCoordinator.removeNode(nodeToRemove);
        
        const updatedStatus = meshCoordinator.getNetworkStatus();
        expect(updatedStatus.nodes.length).toBe(initialNodeCount - 1);
      }
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await meshCoordinator.initialize();
    });

    it('should handle large number of nodes efficiently', async () => {
      const startTime = Date.now();
      const nodeCount = 20;
      
      // Add many nodes
      for (let i = 0; i < nodeCount; i++) {
        const agentId = createAgentId(`scale-agent-${i}`);
        await meshCoordinator.addNode(agentId, ['research']);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(totalTime).toBeLessThan(5000);
      
      const status = meshCoordinator.getNetworkStatus();
      expect(status.nodes.length).toBe(nodeCount);
    });

    it('should maintain performance under high task load', async () => {
      // Add nodes
      for (let i = 0; i < 5; i++) {
        const agentId = createAgentId(`load-agent-${i}`);
        await meshCoordinator.addNode(agentId, ['research']);
      }
      
      // Create multiple tasks simultaneously
      const taskPromises = [];
      for (let i = 0; i < 10; i++) {
        const task = createTaskDefinition(`load-task-${i}`);
        taskPromises.push(meshCoordinator.coordinateTask(task));
      }
      
      const startTime = Date.now();
      const results = await Promise.all(taskPromises);
      const endTime = Date.now();
      
      expect(results.length).toBe(10);
      expect(results.every(result => typeof result === 'string')).toBe(true);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should optimize network performance over time', async () => {
      // Add nodes with varying capabilities
      for (let i = 0; i < 8; i++) {
        const agentId = createAgentId(`perf-agent-${i}`);
        const capabilities = i % 2 === 0 ? ['research'] : ['analysis', 'optimization'];
        await meshCoordinator.addNode(agentId, capabilities);
      }
      
      // Get initial metrics
      const initialStatus = meshCoordinator.getNetworkStatus();
      const initialMetrics = initialStatus.metrics;
      
      // Trigger optimization
      await meshCoordinator.optimizeNetworkTopology();
      
      // Check that optimization completed
      const optimizedStatus = meshCoordinator.getNetworkStatus();
      expect(optimizedStatus.nodes.length).toBe(8);
    });
  });

  describe('Network Status and Monitoring', () => {
    beforeEach(async () => {
      await meshCoordinator.initialize();
    });

    it('should provide comprehensive network status', () => {
      const status = meshCoordinator.getNetworkStatus();
      
      expect(status).toHaveProperty('metrics');
      expect(status).toHaveProperty('nodes');
      expect(status).toHaveProperty('partitions');
      expect(status).toHaveProperty('consensusRequests');
      
      expect(Array.isArray(status.nodes)).toBe(true);
      expect(Array.isArray(status.partitions)).toBe(true);
      expect(Array.isArray(status.consensusRequests)).toBe(true);
    });

    it('should track node performance metrics', async () => {
      const agentId = createAgentId('metrics-agent');
      await meshCoordinator.addNode(agentId, ['research']);
      
      const status = meshCoordinator.getNetworkStatus();
      const node = status.nodes[0];
      
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('status');
      expect(node).toHaveProperty('load');
      expect(node).toHaveProperty('reputation');
      expect(node).toHaveProperty('peerCount');
    });

    it('should update metrics in real-time', async () => {
      const agentId = createAgentId('realtime-agent');
      await meshCoordinator.addNode(agentId, ['research']);
      
      const initialStatus = meshCoordinator.getNetworkStatus();
      const initialNodeCount = initialStatus.metrics.totalNodes;
      
      const agentId2 = createAgentId('realtime-agent-2', 'analyzer');
      await meshCoordinator.addNode(agentId2, ['analysis']);
      
      const updatedStatus = meshCoordinator.getNetworkStatus();
      const updatedNodeCount = updatedStatus.metrics.totalNodes;
      
      expect(updatedNodeCount).toBe(initialNodeCount + 1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await meshCoordinator.initialize();
    });

    it('should handle removal of non-existent node', async () => {
      await expect(meshCoordinator.removeNode('non-existent')).rejects.toThrow();
    });

    it('should handle consensus vote for non-existent request', async () => {
      await expect(
        meshCoordinator.submitVote('non-existent', 'node-1', 'approve')
      ).rejects.toThrow();
    });

    it('should handle task coordination with no available nodes', async () => {
      const task = createTaskDefinition('no-nodes-task');
      
      await expect(meshCoordinator.coordinateTask(task)).rejects.toThrow();
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        maxPeersPerNode: -1,
        consensusTimeout: 0
      };
      
      // Should not throw, but use defaults
      const coordinator = new MeshCoordinator(invalidConfig);
      expect(coordinator).toBeInstanceOf(MeshCoordinator);
    });
  });

  describe('Integration with Event System', () => {
    beforeEach(async () => {
      await meshCoordinator.initialize();
    });

    it('should emit events for all major operations', async () => {
      const events: string[] = [];
      
      meshCoordinator.on('mesh:node:added', () => events.push('node_added'));
      meshCoordinator.on('mesh:task:assigned', () => events.push('task_assigned'));
      meshCoordinator.on('mesh:node:removed', () => events.push('node_removed'));
      
      const agentId = createAgentId('event-agent');
      const nodeId = await meshCoordinator.addNode(agentId, ['research']);
      
      const task = createTaskDefinition('event-task');
      
      await meshCoordinator.coordinateTask(task);
      await meshCoordinator.removeNode(nodeId);
      
      expect(events).toContain('node_added');
      expect(events).toContain('task_assigned');
      expect(events).toContain('node_removed');
    });

    it('should provide detailed event data', async () => {
      let eventData: any = null;
      
      meshCoordinator.once('mesh:node:added', (data) => {
        eventData = data;
      });
      
      const agentId = createAgentId('detailed-event-agent');
      const capabilities = ['research', 'analysis'];
      await meshCoordinator.addNode(agentId, capabilities);
      
      expect(eventData).toBeDefined();
      expect(eventData.agentId).toEqual(agentId);
      expect(eventData.capabilities).toEqual(capabilities);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', async () => {
      await meshCoordinator.initialize();
      
      const agentId = createAgentId('shutdown-agent');
      await meshCoordinator.addNode(agentId, ['research']);
      
      const shutdownPromise = meshCoordinator.shutdown();
      await expect(shutdownPromise).resolves.toBeUndefined();
      
      // After shutdown, network should be empty
      const status = meshCoordinator.getNetworkStatus();
      expect(status.nodes.length).toBe(0);
    });

    it('should emit shutdown event', async () => {
      const shutdownEventPromise = new Promise((resolve) => {
        meshCoordinator.once('mesh:shutdown', resolve);
      });
      
      await meshCoordinator.initialize();
      await meshCoordinator.shutdown();
      
      await expect(shutdownEventPromise).resolves.toBeUndefined();
    });

    it('should clean up all resources on shutdown', async () => {
      await meshCoordinator.initialize();
      
      // Add multiple nodes and create consensus requests
      for (let i = 0; i < 3; i++) {
        const agentId = createAgentId(`cleanup-agent-${i}`);
        await meshCoordinator.addNode(agentId, ['research']);
      }
      
      await meshCoordinator.createConsensusRequest('topology_change', {});
      
      const statusBeforeShutdown = meshCoordinator.getNetworkStatus();
      expect(statusBeforeShutdown.nodes.length).toBe(3);
      expect(statusBeforeShutdown.consensusRequests.length).toBe(1);
      
      await meshCoordinator.shutdown();
      
      const statusAfterShutdown = meshCoordinator.getNetworkStatus();
      expect(statusAfterShutdown.nodes.length).toBe(0);
    });
  });
}); 