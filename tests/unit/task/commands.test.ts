/**
 * Unit tests for Task Commands
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createTaskCreateCommand,
  createTaskListCommand,
  createTaskStatusCommand,
  createTaskCancelCommand,
  createTaskWorkflowCommand,
  TaskCommandContext
} from '../../../src/task/commands.js';
import { TaskEngine, WorkflowTask } from '../../../src/task/engine.js';
import { TaskStatus } from '../../../src/utils/types.js';
import { Command } from 'commander';

// Mock dependencies
jest.mock('../engine.ts');
jest.mock('commander');

describe('Task Commands', () => {
  let mockTaskEngine: jest.Mocked<TaskEngine>;
  let mockMemoryManager: any;
  let mockLogger: any;
  let context: TaskCommandContext;
  let mockConsoleLog: any;
  let mockConsoleError: any;

  beforeEach(() => {
    // Set up mocks
    mockTaskEngine = {
      createTask: jest.fn(),
      listTasks: jest.fn(),
      getTaskStatus: jest.fn(),
      cancelTask: jest.fn(),
      createWorkflow: jest.fn()
    } as unknown as jest.Mocked<TaskEngine>;

    mockMemoryManager = {
      store: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      delete: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    };

    context = {
      taskEngine: mockTaskEngine,
      memoryManager: mockMemoryManager,
      logger: mockLogger
    };

    // Spy on console methods
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createTaskCreateCommand', () => {
    test('returns a Commander command object', () => {
      const command = createTaskCreateCommand(context);
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(Command);
    });

    test('creates task with basic options', async () => {
      // Setup mock response
      const mockTask = {
        id: 'task-123',
        type: 'development',
        description: 'Create a new feature',
        priority: 50,
        dependencies: [],
        tags: ['feature'],
        status: 'pending' as TaskStatus,
        assignedAgent: undefined,
        progressPercentage: 0,
        createdAt: new Date(),
        checkpoints: []
      };
      mockTaskEngine.createTask.mockResolvedValue(mockTask as WorkflowTask);

      // Create command
      const command = createTaskCreateCommand(context);
      
      // Simulate command action directly
      const action = (command as any)._actionHandler;
      const options = {
        priority: '50',
        tags: 'feature'
      };
      
      await action('development', 'Create a new feature', options);
      
      // Verify task creation
      expect(mockTaskEngine.createTask).toHaveBeenCalled();
      const taskData = mockTaskEngine.createTask.mock.calls[0][0];
      expect(taskData.type).toBe('development');
      expect(taskData.description).toBe('Create a new feature');
      expect(taskData.priority).toBe(50);
      expect(taskData.tags).toEqual(['feature']);
    });

    test('stores task creation in memory when memory manager exists', async () => {
      // Setup mock response
      mockTaskEngine.createTask.mockResolvedValue({
        id: 'task-123',
        type: 'development',
        description: 'Create a new feature',
        priority: 50
      } as unknown as WorkflowTask);

      // Create command
      const command = createTaskCreateCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action('development', 'Create a new feature', {
        priority: '50'
      });
      
      // Verify memory storage
      expect(mockMemoryManager.store).toHaveBeenCalled();
      const storeArgs = mockMemoryManager.store.mock.calls[0];
      expect(storeArgs[0]).toBe('task:creation');
      expect(storeArgs[1].action).toBe('create_task');
      expect(storeArgs[1].taskData.type).toBe('development');
    });

    test('handles errors during task creation', async () => {
      // Setup error response
      const error = new Error('Task creation failed');
      mockTaskEngine.createTask.mockRejectedValue(error);

      // Create command
      const command = createTaskCreateCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action('development', 'Create a new feature', {
        priority: '50'
      });
      
      // Verify error handling
      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockConsoleError.mock.calls[0][1]).toBe('Task creation failed');
    });

    test('performs dry run without creating task', async () => {
      // Create command
      const command = createTaskCreateCommand(context);
      
      // Simulate command action with dry run
      const action = (command as any)._actionHandler;
      await action('development', 'Create a new feature', {
        priority: '50',
        dryRun: true
      });
      
      // Verify task not created
      expect(mockTaskEngine.createTask).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('createTaskListCommand', () => {
    test('returns a Commander command object', () => {
      const command = createTaskListCommand(context);
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(Command);
    });

    test('lists tasks with default options', async () => {
      // Setup mock response
      const mockTasks = {
        tasks: [
          {
            id: 'task-123',
            type: 'development',
            description: 'Create a new feature',
            priority: 50,
            status: 'pending' as TaskStatus,
            tags: [],
            progressPercentage: 0,
            createdAt: new Date()
          }
        ],
        total: 1,
        hasMore: false
      };
      mockTaskEngine.listTasks.mockResolvedValue(mockTasks);

      // Create command
      const command = createTaskListCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action({
        limit: '50',
        offset: '0',
        sort: 'createdAt',
        sortDir: 'desc',
        format: 'table'
      });
      
      // Verify task listing
      expect(mockTaskEngine.listTasks).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    test('applies filters based on options', async () => {
      // Setup mock response
      mockTaskEngine.listTasks.mockResolvedValue({
        tasks: [],
        total: 0,
        hasMore: false
      });

      // Create command
      const command = createTaskListCommand(context);
      
      // Simulate command action with filters
      const action = (command as any)._actionHandler;
      await action({
        status: 'pending,running',
        agent: 'agent-123',
        priority: '50-100',
        tags: 'feature,ui',
        createdAfter: '2023-01-01',
        search: 'test',
        limit: '10',
        offset: '0',
        sort: 'priority',
        sortDir: 'desc'
      });
      
      // Verify filters applied
      expect(mockTaskEngine.listTasks).toHaveBeenCalled();
      const [filter, sort, limit, offset] = mockTaskEngine.listTasks.mock.calls[0];
      expect(filter?.status).toEqual(['pending', 'running']);
      expect(filter?.assignedAgent).toEqual(['agent-123']);
      expect(filter?.priority).toEqual({ min: 50, max: 100 });
      expect(filter?.tags).toEqual(['feature', 'ui']);
      expect(filter?.createdAfter).toBeInstanceOf(Date);
      expect(filter?.search).toBe('test');
      expect(sort?.field).toBe('priority');
      expect(sort?.direction).toBe('desc');
      expect(limit).toBe(10);
      expect(offset).toBe(0);
    });

    test('handles empty result set', async () => {
      // Setup empty response
      mockTaskEngine.listTasks.mockResolvedValue({
        tasks: [],
        total: 0,
        hasMore: false
      });

      // Create command
      const command = createTaskListCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action({
        limit: '50',
        offset: '0',
        sort: 'createdAt',
        sortDir: 'desc'
      });
      
      // Verify empty message
      expect(mockConsoleLog).toHaveBeenCalled();
      const logCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(logCalls).toContain('No tasks found');
    });

    test('stores query in memory when memory manager exists', async () => {
      // Setup mock response
      mockTaskEngine.listTasks.mockResolvedValue({
        tasks: [],
        total: 0,
        hasMore: false
      });

      // Create command
      const command = createTaskListCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action({
        limit: '50',
        offset: '0',
        sort: 'createdAt',
        sortDir: 'desc'
      });
      
      // Verify memory storage
      expect(mockMemoryManager.store).toHaveBeenCalled();
      const storeArgs = mockMemoryManager.store.mock.calls[0];
      expect(storeArgs[0]).toBe('task:query:latest');
      expect(storeArgs[1].results).toBe(0);
    });
  });

  describe('createTaskStatusCommand', () => {
    test('returns a Commander command object', () => {
      const command = createTaskStatusCommand(context);
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(Command);
    });

    test('shows task status', async () => {
      // Setup mock response
      const mockStatus = {
        task: {
          id: 'task-123',
          type: 'development',
          description: 'Create a new feature',
          priority: 50,
          status: 'running' as TaskStatus,
          tags: ['feature'],
          progressPercentage: 60,
          createdAt: new Date(),
          startedAt: new Date(),
          checkpoints: []
        },
        dependencies: [],
        dependents: [],
        resourceStatus: [],
        execution: {
          logs: [],
          metrics: {
            cpuUsage: 10,
            memoryUsage: 50 * 1024 * 1024,
            diskIO: 5 * 1024 * 1024,
            networkIO: 2 * 1024 * 1024
          }
        }
      };
      mockTaskEngine.getTaskStatus.mockResolvedValue(mockStatus);

      // Mock console.clear to avoid clearing test output
      const mockClear = jest.spyOn(console, 'clear').mockImplementation(() => {});

      // Create command
      const command = createTaskStatusCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action('task-123', {
        showMetrics: true,
        format: 'detailed'
      });
      
      // Verify status displayed
      expect(mockTaskEngine.getTaskStatus).toHaveBeenCalledWith('task-123');
      expect(mockConsoleLog).toHaveBeenCalled();

      // Restore mock
      mockClear.mockRestore();
    });

    test('handles task not found', async () => {
      // Setup null response
      mockTaskEngine.getTaskStatus.mockResolvedValue(null);

      // Create command
      const command = createTaskStatusCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action('task-123', {});
      
      // Verify not found message
      expect(mockConsoleLog).toHaveBeenCalled();
      const logCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(logCalls).toContain('not found');
    });

    test('stores status check in memory when memory manager exists', async () => {
      // Setup mock response
      mockTaskEngine.getTaskStatus.mockResolvedValue({
        task: {
          id: 'task-123',
          status: 'running' as TaskStatus,
          description: 'Test task',
          type: 'test',
          priority: 50,
          tags: [],
          createdAt: new Date(),
          progressPercentage: 0,
          checkpoints: []
        },
        dependencies: [],
        dependents: [],
        resourceStatus: []
      });

      // Mock console.clear to avoid clearing test output
      const mockClear = jest.spyOn(console, 'clear').mockImplementation(() => {});

      // Create command
      const command = createTaskStatusCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action('task-123', {});
      
      // Verify memory storage
      expect(mockMemoryManager.store).toHaveBeenCalled();
      const storeArgs = mockMemoryManager.store.mock.calls[0];
      expect(storeArgs[0]).toBe('task:status:task-123');
      expect(storeArgs[1].checkedBy).toBe('cli');

      // Restore mock
      mockClear.mockRestore();
    });
  });

  describe('createTaskCancelCommand', () => {
    test('returns a Commander command object', () => {
      const command = createTaskCancelCommand(context);
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(Command);
    });

    test('cancels task with default options', async () => {
      // Setup mock response
      mockTaskEngine.getTaskStatus.mockResolvedValue({
        task: {
          id: 'task-123',
          type: 'development',
          description: 'Create a new feature',
          status: 'running' as TaskStatus,
          priority: 50,
          tags: [],
          progressPercentage: 30,
          createdAt: new Date(),
          checkpoints: []
        },
        dependencies: [],
        dependents: [],
        resourceStatus: []
      });

      // Create command
      const command = createTaskCancelCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action('task-123', {
        reason: 'User requested',
        noRollback: false,
        force: false,
        cascade: false
      });
      
      // Verify task cancellation
      expect(mockTaskEngine.cancelTask).toHaveBeenCalledWith(
        'task-123',
        'User requested',
        true // rollback
      );
    });

    test('handles task not found', async () => {
      // Setup null response
      mockTaskEngine.getTaskStatus.mockResolvedValue(null);

      // Create command
      const command = createTaskCancelCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action('task-123', {
        reason: 'User requested'
      });
      
      // Verify not found message
      expect(mockConsoleLog).toHaveBeenCalled();
      const logCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(logCalls).toContain('not found');
      expect(mockTaskEngine.cancelTask).not.toHaveBeenCalled();
    });

    test('prevents cancellation of completed tasks without force option', async () => {
      // Setup completed task status
      mockTaskEngine.getTaskStatus.mockResolvedValue({
        task: {
          id: 'task-123',
          status: 'completed' as TaskStatus,
          description: 'Test task',
          type: 'test',
          priority: 50,
          tags: [],
          createdAt: new Date(),
          progressPercentage: 100,
          checkpoints: []
        },
        dependencies: [],
        dependents: [],
        resourceStatus: []
      });

      // Create command
      const command = createTaskCancelCommand(context);
      
      // Simulate command action without force option
      const action = (command as any)._actionHandler;
      await action('task-123', {
        reason: 'User requested',
        force: false
      });
      
      // Verify warning and no cancellation
      expect(mockConsoleLog).toHaveBeenCalled();
      const logCalls = mockConsoleLog.mock.calls.flat().join(' ');
      expect(logCalls).toContain('already completed');
      expect(mockTaskEngine.cancelTask).not.toHaveBeenCalled();
    });

    test('stores cancellation request in memory when memory manager exists', async () => {
      // Setup mock response
      mockTaskEngine.getTaskStatus.mockResolvedValue({
        task: {
          id: 'task-123',
          status: 'running' as TaskStatus,
          description: 'Test task',
          type: 'test',
          priority: 50,
          tags: [],
          createdAt: new Date(),
          progressPercentage: 50,
          checkpoints: []
        },
        dependencies: [],
        dependents: [],
        resourceStatus: []
      });

      // Create command
      const command = createTaskCancelCommand(context);
      
      // Simulate command action
      const action = (command as any)._actionHandler;
      await action('task-123', {
        reason: 'User requested',
        noRollback: false,
        cascade: true
      });
      
      // Verify memory storage
      expect(mockMemoryManager.store).toHaveBeenCalled();
      const storeArgs = mockMemoryManager.store.mock.calls[0];
      expect(storeArgs[0]).toBe('task:cancellation:task-123');
      expect(storeArgs[1].reason).toBe('User requested');
      expect(storeArgs[1].rollback).toBe(true);
      expect(storeArgs[1].cascade).toBe(true);
    });
  });

  describe('createTaskWorkflowCommand', () => {
    test('returns a Commander command object', () => {
      const command = createTaskWorkflowCommand(context);
      expect(command).toBeDefined();
      expect(command).toBeInstanceOf(Command);
    });

    test('has create subcommand', () => {
      const command = createTaskWorkflowCommand(context);
      expect((command as any)._commands.length).toBeGreaterThan(0);
      
      const subcommandNames = (command as any)._commands.map((cmd: Command) => cmd.name());
      expect(subcommandNames).toContain('create');
    });
  });
});