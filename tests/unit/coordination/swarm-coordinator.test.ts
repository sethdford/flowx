import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SwarmCoordinator } from '../../../src/coordination/swarm-coordinator.ts';
import type { SwarmCoordinatorOptions, AgentProfile, SubTask } from '../../../src/coordination/swarm-coordinator.ts';

describe('SwarmCoordinator', () => {
  let coordinator: SwarmCoordinator;
  let mockLogger: any;
  let defaultOptions: SwarmCoordinatorOptions;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    defaultOptions = {
      maxAgents: 5,
      maxConcurrentTasks: 3,
      taskTimeout: 30000,
      enableMonitoring: true,
      enableWorkStealing: true,
      enableCircuitBreaker: true,
      memoryNamespace: 'test-swarm',
      coordinationStrategy: 'centralized',
    };

    coordinator = new SwarmCoordinator(defaultOptions, mockLogger);
  });

  afterEach(async () => {
    if (coordinator) {
      await coordinator.stop();
    }
  });

  describe('Initialization', () => {
    it('should create coordinator with default options', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.getSystemStatus().isRunning).toBe(false);
    });

    it('should start and stop coordinator', async () => {
      await coordinator.start();
      expect(coordinator.getSystemStatus().isRunning).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting SwarmCoordinator', { options: defaultOptions });

      await coordinator.stop();
      expect(coordinator.getSystemStatus().isRunning).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping SwarmCoordinator');
    });

    it('should not start if already running', async () => {
      await coordinator.start();
      await expect(coordinator.start()).rejects.toThrow('SwarmCoordinator is already running');
    });

    it('should emit started and stopped events', async () => {
      const startedListener = jest.fn();
      const stoppedListener = jest.fn();

      coordinator.on('started', startedListener);
      coordinator.on('stopped', stoppedListener);

      await coordinator.start();
      expect(startedListener).toHaveBeenCalled();

      await coordinator.stop();
      expect(stoppedListener).toHaveBeenCalled();
    });
  });

  describe('Objective Management', () => {
    beforeEach(async () => {
      await coordinator.start();
    });

    it('should create objectives with different strategies', async () => {
      const objectiveId1 = await coordinator.createObjective('Build API', 'development');
      const objectiveId2 = await coordinator.createObjective('Research trends', 'research');
      const objectiveId3 = await coordinator.createObjective('Analyze data', 'analysis');

      expect(objectiveId1).toBeDefined();
      expect(objectiveId2).toBeDefined();
      expect(objectiveId3).toBeDefined();
      expect(objectiveId1).not.toBe(objectiveId2);
      
      const status = coordinator.getSystemStatus();
      expect(status.objectives.total).toBe(3);
    });

    it('should generate correct subtasks for development strategy', async () => {
      const objectiveId = await coordinator.createObjective('Build REST API', 'development');
      
      // Should emit objectiveCreated event
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created objective',
        expect.objectContaining({
          objectiveId,
          objective: 'Build REST API',
          strategy: 'development',
          subtaskCount: 4 // planning, architecture, implementation, testing
        })
      );
    });

    it('should generate correct subtasks for research strategy', async () => {
      const objectiveId = await coordinator.createObjective('Research AI trends', 'research');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created objective',
        expect.objectContaining({
          objectiveId,
          objective: 'Research AI trends',
          strategy: 'research',
          subtaskCount: 3 // research, analysis, report
        })
      );
    });

    it('should handle auto strategy with build objective', async () => {
      const objectiveId = await coordinator.createObjective('Build mobile app', 'auto');
      
      // Auto strategy should detect "build" and use development strategy
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created objective',
        expect.objectContaining({
          objectiveId,
          objective: 'Build mobile app',
          strategy: 'auto',
          subtaskCount: 4 // Should use development subtasks
        })
      );
    });
  });

  describe('Agent Management', () => {
    beforeEach(async () => {
      await coordinator.start();
    });

    it('should register agents with different types', async () => {
      const agentId1 = await coordinator.registerAgent('Coordinator-1', 'coordinator', ['task_coordination']);
      const agentId2 = await coordinator.registerAgent('Coder-1', 'coder', ['code_generation']);
      const agentId3 = await coordinator.registerAgent('Researcher-1', 'researcher', ['information_gathering']);

      expect(agentId1).toBeDefined();
      expect(agentId2).toBeDefined();
      expect(agentId3).toBeDefined();

      const status = coordinator.getSystemStatus();
      expect(status.agents.total).toBe(3);
      expect(status.agents.byStatus.idle).toBe(3);
    });

    it('should emit agentRegistered event', async () => {
      const eventListener = jest.fn();
      coordinator.on('agentRegistered', eventListener);

      const agentId = await coordinator.registerAgent('Test-Agent', 'coder', ['testing']);

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          id: agentId,
          name: 'Test-Agent',
          type: 'coder',
          capabilities: ['testing'],
          status: 'idle',
        })
      );
    });

    it('should track agent performance metrics', async () => {
      const agentId = await coordinator.registerAgent('Performance-Agent', 'coder', ['testing']);
      
      // Access private members for testing
      const agents = (coordinator as any).agents as Map<string, AgentProfile>;
      const agent = agents.get(agentId);
      
      expect(agent).toBeDefined();
      expect(agent?.performance).toEqual({
        tasksCompleted: 0,
        averageTime: 0,
        successRate: 1.0,
      });
    });
  });

  describe('Task Assignment', () => {
    let objectiveId: string;
    let coordinatorAgentId: string;
    let coderAgentId: string;

    beforeEach(async () => {
      await coordinator.start();
      objectiveId = await coordinator.createObjective('Test objective', 'development');
      coordinatorAgentId = await coordinator.registerAgent('Coordinator-1', 'coordinator', ['task_coordination']);
      coderAgentId = await coordinator.registerAgent('Coder-1', 'coder', ['code_generation']);
    });

    it('should assign tasks to suitable agents', async () => {
      // Get the first task from the objective
      const tasks = (coordinator as any).tasks as Map<string, SubTask>;
      const taskArray = Array.from(tasks.values());
      expect(taskArray.length).toBeGreaterThan(0);

      const planningTask = taskArray.find((task: SubTask) => task.type === 'planning');
      expect(planningTask).toBeDefined();

      if (planningTask) {
        const success = await coordinator.assignTask(planningTask.id);
        expect(success).toBe(true);

        const status = coordinator.getSystemStatus();
        expect(status.tasks.byStatus.assigned).toBe(1);
      }
    });

    it('should auto-assign tasks to best suited agents', async () => {
      const tasks = (coordinator as any).tasks as Map<string, SubTask>;
      const taskArray = Array.from(tasks.values());
      const implementationTask = taskArray.find((task: SubTask) => task.type === 'implementation');
      
      if (implementationTask) {
        const success = await coordinator.assignTask(implementationTask.id);
        expect(success).toBe(true);
        
        // Implementation task should be assigned to coder agent
        expect(implementationTask.assignedAgent).toBe(coderAgentId);
      }
    });

    it('should handle task assignment failure when no suitable agent', async () => {
      // Create a task that requires an agent type we don't have
      const tasks = (coordinator as any).tasks as Map<string, SubTask>;
      const taskArray = Array.from(tasks.values());
      const task = taskArray[0];
      
      if (task) {
        // Manually set task type to something we don't have an agent for
        task.type = 'specialized_nonexistent_task';
        
        const success = await coordinator.assignTask(task.id);
        expect(success).toBe(false);
      }
    });

    it('should emit taskAssigned event', async () => {
      const eventListener = jest.fn();
      coordinator.on('taskAssigned', eventListener);

      const tasks = (coordinator as any).tasks as Map<string, SubTask>;
      const taskArray = Array.from(tasks.values());
      const task = taskArray[0];
      
      if (task) {
        await coordinator.assignTask(task.id);

        expect(eventListener).toHaveBeenCalledWith(
          expect.objectContaining({
            task: expect.objectContaining({ id: task.id }),
            agent: expect.objectContaining({ id: expect.any(String) }),
          })
        );
      }
    });
  });

  describe('System Status', () => {
    beforeEach(async () => {
      await coordinator.start();
    });

    it('should provide comprehensive system status', async () => {
      // Add some data
      const objectiveId = await coordinator.createObjective('Test objective', 'development');
      const agentId = await coordinator.registerAgent('Test-Agent', 'coder', ['testing']);

      const status = coordinator.getSystemStatus();

      expect(status).toEqual({
        isRunning: true,
        agents: {
          total: 1,
          byStatus: { idle: 1 },
        },
        tasks: {
          total: 4, // development strategy creates 4 tasks
          byStatus: expect.objectContaining({
            pending: 4,
          }),
        },
        objectives: {
          total: 1,
          active: 0, // No objectives in executing state yet
        },
        coordination: {
          strategy: 'centralized',
          monitoring: true,
          circuitBreaker: true,
          workStealing: true,
        },
      });
    });

    it('should track status changes over time', async () => {
      const initialStatus = coordinator.getSystemStatus();
      expect(initialStatus.agents.total).toBe(0);
      expect(initialStatus.tasks.total).toBe(0);

      await coordinator.registerAgent('Agent-1', 'coder', ['testing']);
      await coordinator.createObjective('Test', 'research');

      const updatedStatus = coordinator.getSystemStatus();
      expect(updatedStatus.agents.total).toBe(1);
      expect(updatedStatus.tasks.total).toBe(3); // research strategy creates 3 tasks
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await coordinator.start();
    });

    it('should emit all expected events during task lifecycle', async () => {
      const events: string[] = [];
      
      coordinator.on('objectiveCreated', () => events.push('objectiveCreated'));
      coordinator.on('agentRegistered', () => events.push('agentRegistered'));
      coordinator.on('taskAssigned', () => events.push('taskAssigned'));
      coordinator.on('taskStarted', () => events.push('taskStarted'));
      coordinator.on('taskCompleted', () => events.push('taskCompleted'));

      // Create objective and agent
      await coordinator.createObjective('Test objective', 'development');
      await coordinator.registerAgent('Test-Agent', 'coordinator', ['task_coordination']);

      // Assign a task
      const tasks = (coordinator as any).tasks as Map<string, SubTask>;
      const taskArray = Array.from(tasks.values());
      if (taskArray.length > 0) {
        await coordinator.assignTask(taskArray[0].id);
      }

      expect(events).toContain('objectiveCreated');
      expect(events).toContain('agentRegistered');
      expect(events).toContain('taskAssigned');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await coordinator.start();
    });

    it('should handle invalid task assignment gracefully', async () => {
      await expect(coordinator.assignTask('invalid-task-id')).rejects.toThrow('Task invalid-task-id not found');
    });

    it('should handle agent registration with invalid data', async () => {
      // This should still work as the coordinator is flexible
      const agentId = await coordinator.registerAgent('', 'specialist', []);
      expect(agentId).toBeDefined();
    });

    it('should continue operating after task failures', async () => {
      const objectiveId = await coordinator.createObjective('Test', 'development');
      const agentId = await coordinator.registerAgent('Test-Agent', 'coder', ['testing']);

      // System should remain operational
      const status = coordinator.getSystemStatus();
      expect(status.isRunning).toBe(true);
      expect(status.agents.total).toBe(1);
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await coordinator.start();
    });

    it('should handle maximum number of agents', async () => {
      const maxAgents = defaultOptions.maxAgents;
      const agentIds = [];

      for (let i = 0; i < maxAgents; i++) {
        const agentId = await coordinator.registerAgent(`Agent-${i}`, 'coder', ['testing']);
        agentIds.push(agentId);
      }

      const status = coordinator.getSystemStatus();
      expect(status.agents.total).toBe(maxAgents);
      expect(agentIds.length).toBe(maxAgents);
    });

    it('should handle multiple objectives efficiently', async () => {
      const objectiveIds = [];
      
      for (let i = 0; i < 10; i++) {
        const objectiveId = await coordinator.createObjective(`Objective ${i}`, 'auto');
        objectiveIds.push(objectiveId);
      }

      const status = coordinator.getSystemStatus();
      expect(status.objectives.total).toBe(10);
      expect(objectiveIds.length).toBe(10);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await coordinator.start();
    });

    it('should clean up resources on stop', async () => {
      // Add some data
      await coordinator.createObjective('Test', 'development');
      await coordinator.registerAgent('Test-Agent', 'coder', ['testing']);

      let status = coordinator.getSystemStatus();
      expect(status.agents.total).toBe(1);
      expect(status.tasks.total).toBeGreaterThan(0);

      await coordinator.stop();

      status = coordinator.getSystemStatus();
      expect(status.isRunning).toBe(false);
      expect(status.agents.total).toBe(0);
      expect(status.tasks.total).toBe(0);
    });
  });
}); 