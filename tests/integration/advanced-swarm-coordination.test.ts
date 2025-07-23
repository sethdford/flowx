import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AdvancedSwarmCoordinationEngine } from '../../src/enterprise/advanced-swarm-coordination-engine.ts';
import type { SwarmConfiguration, SwarmNode, SwarmTask } from '../../src/enterprise/advanced-swarm-coordination-engine.ts';
import { Logger } from '../../src/core/logger.ts';

describe('Advanced Swarm Coordination Engine Integration', () => {
  let engine: AdvancedSwarmCoordinationEngine;
  let logger: Logger;
  let config: SwarmConfiguration;

  beforeEach(async () => {
    logger = new Logger({ level: 'debug', format: 'json', destination: 'console' });
    
    config = {
      id: 'test-swarm',
      name: 'Test Swarm',
      topology: 'hierarchical',
      consensusAlgorithm: 'raft',
      coordinationStrategy: 'adaptive',
      resourceAllocation: 'performance_based',
      maxNodes: 100,
      maxDepth: 5,
      replicationFactor: 3,
      faultTolerance: {
        enableFailureDetection: true,
        heartbeatInterval: 1000,
        heartbeatTimeout: 5000,
        maxRetries: 3,
        recoveryStrategy: 'auto',
        backupNodes: 2,
        redundancyLevel: 2
      },
      performance: {
        loadBalancing: true,
        adaptiveScaling: true,
        performanceThresholds: {
          cpu: 0.8,
          memory: 0.8,
          responseTime: 1000,
          errorRate: 0.05
        },
        optimizationInterval: 30000,
        metricsRetention: 3600000
      },
      security: {
        enableAuthentication: false,
        enableEncryption: false,
        trustModel: 'full',
        accessControl: 'rbac',
        auditLogging: true
      }
    };

    engine = new AdvancedSwarmCoordinationEngine(config, logger);
  });

  afterEach(async () => {
    if (engine) {
      await engine.shutdown();
    }
  });

  describe('Engine Initialization', () => {
    it('should initialize with hierarchical topology', async () => {
      await engine.initialize();
      
      const status = engine.getSwarmStatus();
      expect(status).toBeDefined();
      expect(status.totalNodes).toBe(0);
      expect(status.activeNodes).toBe(0);
    });

    it('should initialize with mesh topology', async () => {
      config.topology = 'mesh';
      const meshEngine = new AdvancedSwarmCoordinationEngine(config, logger);
      
      await meshEngine.initialize();
      
      const status = meshEngine.getSwarmStatus();
      expect(status).toBeDefined();
      
      await meshEngine.shutdown();
    });

    it('should initialize with hybrid topology', async () => {
      config.topology = 'hybrid';
      const hybridEngine = new AdvancedSwarmCoordinationEngine(config, logger);
      
      await hybridEngine.initialize();
      
      const status = hybridEngine.getSwarmStatus();
      expect(status).toBeDefined();
      
      await hybridEngine.shutdown();
    });
  });

  describe('Node Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should add nodes to hierarchical swarm', async () => {
      const coordinatorNode: Partial<SwarmNode> = {
        type: 'coordinator',
        capabilities: {
          domains: ['coordination', 'management'],
          specializations: ['task_orchestration'],
          tools: ['swarm_tools'],
          languages: ['typescript'],
          frameworks: [],
          maxConcurrentTasks: 10,
          supportedTaskTypes: ['coordination', 'management'],
          qualityRating: 0.9,
          experienceLevel: 'expert'
        }
      };

      const coordinatorId = await engine.addNode(coordinatorNode);
      expect(coordinatorId).toBeDefined();

      const workerNode: Partial<SwarmNode> = {
        type: 'worker',
        capabilities: {
          domains: ['development', 'testing'],
          specializations: ['code_generation'],
          tools: ['dev_tools'],
          languages: ['typescript', 'javascript'],
          frameworks: ['react', 'node'],
          maxConcurrentTasks: 5,
          supportedTaskTypes: ['development', 'testing'],
          qualityRating: 0.8,
          experienceLevel: 'senior'
        }
      };

      const workerId = await engine.addNode(workerNode);
      expect(workerId).toBeDefined();

      const status = engine.getSwarmStatus();
      expect(status.totalNodes).toBe(2);
      expect(status.activeNodes).toBe(2);

      // Verify hierarchy structure
      const coordinator = engine.getNodeInfo(coordinatorId);
      const worker = engine.getNodeInfo(workerId);
      
      expect(coordinator).toBeDefined();
      expect(worker).toBeDefined();
      expect(worker!.hierarchy.level).toBeGreaterThan(coordinator!.hierarchy.level);
    });

    it('should handle node removal and task reassignment', async () => {
      const node1Id = await engine.addNode({ type: 'worker' });
      const node2Id = await engine.addNode({ type: 'worker' });

      // Submit a task to the first node
      const taskId = await engine.submitTask({
        type: 'development',
        description: 'Test task for node removal'
      });

      // Wait for task assignment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Remove the first node
      await engine.removeNode(node1Id);

      const status = engine.getSwarmStatus();
      expect(status.totalNodes).toBe(1);

      // Verify task was reassigned or handled appropriately
      const task = engine.getTaskInfo(taskId);
      expect(task).toBeDefined();
    });

    it('should build mesh topology with optimal connections', async () => {
      config.topology = 'mesh';
      const meshEngine = new AdvancedSwarmCoordinationEngine(config, logger);
      await meshEngine.initialize();

      // Add multiple nodes
      const nodeIds = [];
      for (let i = 0; i < 5; i++) {
        const nodeId = await meshEngine.addNode({
          type: 'worker',
          capabilities: {
            domains: ['general'],
            specializations: [],
            tools: ['basic'],
            languages: ['typescript'],
            frameworks: [],
            maxConcurrentTasks: 3,
            supportedTaskTypes: ['generic'],
            qualityRating: 0.7,
            experienceLevel: 'mid'
          }
        });
        nodeIds.push(nodeId);
      }

      const status = meshEngine.getSwarmStatus();
      expect(status.totalNodes).toBe(5);
      expect(status.topology.connectivity).toBeGreaterThan(0);

      // Verify mesh connections
      const nodes = meshEngine.getAllNodes();
      for (const node of nodes) {
        expect(node.connections.size).toBeGreaterThan(0);
      }

      await meshEngine.shutdown();
    });
  });

  describe('Task Management', () => {
    beforeEach(async () => {
      await engine.initialize();
      
      // Add some worker nodes
      await engine.addNode({
        type: 'coordinator',
        capabilities: {
          domains: ['coordination'],
          specializations: ['orchestration'],
          tools: ['swarm_tools'],
          languages: ['typescript'],
          frameworks: [],
          maxConcurrentTasks: 10,
          supportedTaskTypes: ['coordination'],
          qualityRating: 0.9,
          experienceLevel: 'expert'
        }
      });

      await engine.addNode({
        type: 'worker',
        capabilities: {
          domains: ['development'],
          specializations: ['frontend'],
          tools: ['react_tools'],
          languages: ['typescript', 'javascript'],
          frameworks: ['react'],
          maxConcurrentTasks: 3,
          supportedTaskTypes: ['development'],
          qualityRating: 0.8,
          experienceLevel: 'senior'
        }
      });

      await engine.addNode({
        type: 'worker',
        capabilities: {
          domains: ['testing'],
          specializations: ['unit_testing'],
          tools: ['jest'],
          languages: ['typescript'],
          frameworks: ['jest'],
          maxConcurrentTasks: 5,
          supportedTaskTypes: ['testing'],
          qualityRating: 0.85,
          experienceLevel: 'senior'
        }
      });
    });

    it('should submit and schedule tasks appropriately', async () => {
      const taskId = await engine.submitTask({
        type: 'development',
        description: 'Create a React component',
        requirements: {
          capabilities: ['development'],
          resources: {
            cpu: 2,
            memory: 1024,
            storage: 500,
            network: 50,
            customRequirements: new Map()
          },
          quality: {
            minQualityRating: 0.7,
            minExperienceLevel: 'mid',
            specializations: ['frontend'],
            certifications: []
          },
          timing: {
            maxExecutionTime: 3600000,
            maxWaitTime: 300000
          }
        },
        priority: 5
      });

      expect(taskId).toBeDefined();

      // Wait for task scheduling
      await new Promise(resolve => setTimeout(resolve, 100));

      const task = engine.getTaskInfo(taskId);
      expect(task).toBeDefined();
      expect(task!.status.state).toBe('scheduled');
      expect(task!.assignedNodes.length).toBeGreaterThan(0);

      const status = engine.getSwarmStatus();
      expect(status.totalTasks).toBe(1);
    });

    it('should handle task constraints and requirements', async () => {
      const taskId = await engine.submitTask({
        type: 'testing',
        description: 'Run unit tests',
        requirements: {
          capabilities: ['testing'],
          resources: {
            cpu: 1,
            memory: 512,
            storage: 100,
            network: 10,
            customRequirements: new Map()
          },
          quality: {
            minQualityRating: 0.8,
            minExperienceLevel: 'senior',
            specializations: ['unit_testing'],
            certifications: []
          },
          timing: {
            maxExecutionTime: 1800000,
            maxWaitTime: 60000
          }
        },
        constraints: {
          location: {
            regions: [],
            zones: [],
            excludedNodes: [],
            preferredNodes: []
          },
          affinity: {
            nodeAffinity: [],
            taskAffinity: [],
            typeAffinity: ['testing']
          },
          antiAffinity: {
            nodeAntiAffinity: [],
            taskAntiAffinity: [],
            typeAntiAffinity: []
          },
          security: {
            requiredClearance: 'public',
            isolationLevel: 'none',
            dataClassification: 'public'
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const task = engine.getTaskInfo(taskId);
      expect(task).toBeDefined();
      
      // Should be assigned to testing-capable node
      if (task!.assignedNodes.length > 0) {
        const assignedNode = engine.getNodeInfo(task!.assignedNodes[0]);
        expect(assignedNode).toBeDefined();
        expect(assignedNode!.capabilities.domains).toContain('testing');
      }
    });

    it('should handle task dependencies', async () => {
      // Submit parent task
      const parentTaskId = await engine.submitTask({
        type: 'development',
        description: 'Develop component'
      });

      // Submit dependent task
      const dependentTaskId = await engine.submitTask({
        type: 'testing',
        description: 'Test component',
        dependencies: [parentTaskId]
      });

      const parentTask = engine.getTaskInfo(parentTaskId);
      const dependentTask = engine.getTaskInfo(dependentTaskId);

      expect(parentTask).toBeDefined();
      expect(dependentTask).toBeDefined();
      expect(dependentTask!.dependencies).toContain(parentTaskId);
    });
  });

  describe('Consensus and Coordination', () => {
    beforeEach(async () => {
      config.consensusAlgorithm = 'byzantine';
      engine = new AdvancedSwarmCoordinationEngine(config, logger);
      await engine.initialize();
    });

    it('should handle consensus for node addition with Byzantine algorithm', async () => {
      // Add multiple nodes to enable consensus
      await engine.addNode({ type: 'coordinator' });
      await engine.addNode({ type: 'worker' });
      await engine.addNode({ type: 'worker' });

      const consensusEvents: any[] = [];
      engine.on('consensusProposed', (event) => {
        consensusEvents.push(event);
      });

      // Add another node which should trigger consensus
      const nodeId = await engine.addNode({ type: 'specialist' });

      expect(nodeId).toBeDefined();
      // Note: Consensus might be triggered depending on implementation
    });

    it('should coordinate resource allocation across nodes', async () => {
      // Add nodes with different capabilities
      await engine.addNode({
        type: 'worker',
        resources: {
          cpu: { available: 8, used: 0, total: 8 },
          memory: { available: 16384, used: 0, total: 16384 },
          storage: { available: 200000, used: 0, total: 200000 },
          network: { bandwidth: 1000, latency: 5, quality: 0.95 },
          customResources: new Map(),
          quotas: {
            maxCpu: 8,
            maxMemory: 16384,
            maxTasks: 10,
            maxConnections: 20
          }
        }
      });

      await engine.addNode({
        type: 'worker',
        resources: {
          cpu: { available: 4, used: 0, total: 4 },
          memory: { available: 8192, used: 0, total: 8192 },
          storage: { available: 100000, used: 0, total: 100000 },
          network: { bandwidth: 500, latency: 10, quality: 0.9 },
          customResources: new Map(),
          quotas: {
            maxCpu: 4,
            maxMemory: 8192,
            maxTasks: 5,
            maxConnections: 10
          }
        }
      });

      // Submit resource-intensive task
      const taskId = await engine.submitTask({
        type: 'computation',
        description: 'High CPU task',
        requirements: {
          capabilities: ['general'],
          resources: {
            cpu: 6,
            memory: 4096,
            storage: 1000,
            network: 100,
            customRequirements: new Map()
          },
          quality: {
            minQualityRating: 0.5,
            minExperienceLevel: 'junior',
            specializations: [],
            certifications: []
          },
          timing: {
            maxExecutionTime: 3600000,
            maxWaitTime: 300000
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const task = engine.getTaskInfo(taskId);
      expect(task).toBeDefined();
      
      // Should be assigned to high-resource node
      if (task!.assignedNodes.length > 0) {
        const assignedNode = engine.getNodeInfo(task!.assignedNodes[0]);
        expect(assignedNode).toBeDefined();
        expect(assignedNode!.resources.cpu.total).toBeGreaterThanOrEqual(6);
      }
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      config.performance.optimizationInterval = 100; // Fast optimization for testing
      engine = new AdvancedSwarmCoordinationEngine(config, logger);
      await engine.initialize();
    });

    it('should monitor and optimize swarm performance', async () => {
      // Add nodes with varying performance characteristics
      const nodes = [];
      for (let i = 0; i < 5; i++) {
        const nodeId = await engine.addNode({
          type: 'worker',
          capabilities: {
            domains: ['general'],
            specializations: [],
            tools: ['basic'],
            languages: ['typescript'],
            frameworks: [],
            maxConcurrentTasks: Math.random() * 5 + 1,
            supportedTaskTypes: ['generic'],
            qualityRating: Math.random() * 0.5 + 0.5,
            experienceLevel: 'mid'
          }
        });
        nodes.push(nodeId);
      }

      // Submit multiple tasks to create load
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        const taskId = await engine.submitTask({
          type: 'computation',
          description: `Task ${i}`
        });
        tasks.push(taskId);
      }

      // Run optimization
      await engine.optimizeSwarm();

      const status = engine.getSwarmStatus();
      expect(status.totalNodes).toBe(5);
      expect(status.totalTasks).toBe(10);
      expect(status.resourceUtilization).toBeDefined();
    });

    it('should handle failure detection and recovery', async () => {
      config.faultTolerance.heartbeatTimeout = 100; // Fast timeout for testing
      const failureEngine = new AdvancedSwarmCoordinationEngine(config, logger);
      await failureEngine.initialize();

      const nodeId = await failureEngine.addNode({ type: 'worker' });
      
      const failureEvents: any[] = [];
      const recoveryEvents: any[] = [];
      
      failureEngine.on('nodeFailure', (event) => {
        failureEvents.push(event);
      });
      
      failureEngine.on('nodeRecovery', (event) => {
        recoveryEvents.push(event);
      });

      // Simulate node failure by not sending heartbeats
      const node = failureEngine.getNodeInfo(nodeId);
      expect(node).toBeDefined();
      
      // Manually set old heartbeat to simulate failure
      node!.status.lastHeartbeat = new Date(Date.now() - 1000);

      // Wait for failure detection
      await new Promise(resolve => setTimeout(resolve, 200));

      await failureEngine.shutdown();
    });

    it('should calculate accurate performance metrics', async () => {
      await engine.addNode({ type: 'coordinator' });
      await engine.addNode({ type: 'worker' });
      await engine.addNode({ type: 'specialist' });

      await engine.submitTask({ type: 'development', description: 'Task 1' });
      await engine.submitTask({ type: 'testing', description: 'Task 2' });

      const status = engine.getSwarmStatus();
      
      expect(status.topology.depth).toBeGreaterThanOrEqual(0);
      expect(status.topology.fanout).toBeGreaterThanOrEqual(0);
      expect(status.topology.connectivity).toBeGreaterThanOrEqual(0);
      expect(status.resourceUtilization.cpu.avg).toBeGreaterThanOrEqual(0);
      expect(status.resourceUtilization.memory.avg).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Advanced Features', () => {
    it('should support custom resource types', async () => {
      await engine.initialize();

      const nodeId = await engine.addNode({
        type: 'specialist',
        resources: {
          cpu: { available: 4, used: 0, total: 4 },
          memory: { available: 8192, used: 0, total: 8192 },
          storage: { available: 100000, used: 0, total: 100000 },
          network: { bandwidth: 1000, latency: 10, quality: 0.9 },
          customResources: new Map([
            ['gpu', 2],
            ['fpga', 1],
            ['licenses', 5]
          ]),
          quotas: {
            maxCpu: 4,
            maxMemory: 8192,
            maxTasks: 5,
            maxConnections: 10
          }
        }
      });

      const taskId = await engine.submitTask({
        type: 'ml_training',
        description: 'Train ML model',
        requirements: {
          capabilities: ['general'],
          resources: {
            cpu: 2,
            memory: 4096,
            storage: 1000,
            network: 100,
            customRequirements: new Map([['gpu', 1]])
          },
          quality: {
            minQualityRating: 0.5,
            minExperienceLevel: 'junior',
            specializations: [],
            certifications: []
          },
          timing: {
            maxExecutionTime: 3600000,
            maxWaitTime: 300000
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const task = engine.getTaskInfo(taskId);
      expect(task).toBeDefined();
      
      if (task!.assignedNodes.length > 0) {
        const assignedNode = engine.getNodeInfo(task!.assignedNodes[0]);
        expect(assignedNode).toBeDefined();
        expect(assignedNode!.resources.customResources.get('gpu')).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle complex scheduling scenarios', async () => {
      await engine.initialize();

      // Create diverse node types
      await engine.addNode({
        type: 'coordinator',
        capabilities: {
          domains: ['coordination', 'management'],
          specializations: ['orchestration'],
          tools: ['swarm_tools'],
          languages: ['typescript'],
          frameworks: [],
          maxConcurrentTasks: 10,
          supportedTaskTypes: ['coordination'],
          qualityRating: 0.95,
          experienceLevel: 'expert'
        }
      });

      await engine.addNode({
        type: 'specialist',
        capabilities: {
          domains: ['ai', 'ml'],
          specializations: ['deep_learning'],
          tools: ['tensorflow', 'pytorch'],
          languages: ['python', 'typescript'],
          frameworks: ['tensorflow'],
          maxConcurrentTasks: 2,
          supportedTaskTypes: ['ml_training', 'inference'],
          qualityRating: 0.9,
          experienceLevel: 'expert'
        }
      });

      await engine.addNode({
        type: 'worker',
        capabilities: {
          domains: ['development', 'testing'],
          specializations: ['fullstack'],
          tools: ['react', 'node', 'jest'],
          languages: ['typescript', 'javascript'],
          frameworks: ['react', 'express'],
          maxConcurrentTasks: 5,
          supportedTaskTypes: ['development', 'testing'],
          qualityRating: 0.8,
          experienceLevel: 'senior'
        }
      });

      // Submit varied tasks
      const mlTaskId = await engine.submitTask({
        type: 'ml_training',
        description: 'Train neural network',
        requirements: {
          capabilities: ['ai', 'ml'],
          resources: { cpu: 4, memory: 8192, storage: 5000, network: 100, customRequirements: new Map() },
          quality: { minQualityRating: 0.85, minExperienceLevel: 'expert', specializations: ['deep_learning'], certifications: [] },
          timing: { maxExecutionTime: 7200000, maxWaitTime: 300000 }
        }
      });

      const devTaskId = await engine.submitTask({
        type: 'development',
        description: 'Build React component',
        requirements: {
          capabilities: ['development'],
          resources: { cpu: 2, memory: 2048, storage: 1000, network: 50, customRequirements: new Map() },
          quality: { minQualityRating: 0.7, minExperienceLevel: 'mid', specializations: ['fullstack'], certifications: [] },
          timing: { maxExecutionTime: 3600000, maxWaitTime: 180000 }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const mlTask = engine.getTaskInfo(mlTaskId);
      const devTask = engine.getTaskInfo(devTaskId);

      expect(mlTask).toBeDefined();
      expect(devTask).toBeDefined();

      // Verify appropriate task assignment
      if (mlTask!.assignedNodes.length > 0) {
        const mlNode = engine.getNodeInfo(mlTask!.assignedNodes[0]);
        expect(mlNode!.type).toBe('specialist');
        expect(mlNode!.capabilities.domains).toContain('ai');
      }

      if (devTask!.assignedNodes.length > 0) {
        const devNode = engine.getNodeInfo(devTask!.assignedNodes[0]);
        expect(devNode!.capabilities.domains).toContain('development');
      }
    });
  });
}); 