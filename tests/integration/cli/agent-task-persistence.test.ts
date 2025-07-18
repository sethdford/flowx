/**
 * CLI Agent and Task Persistence Integration Tests
 * Tests to validate that CLI commands properly persist and retrieve agents and tasks
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, mkdir } from 'node:fs/promises';

// Mock the global initialization to use test directory
const testDir = join(tmpdir(), `flowx-cli-test-${Date.now()}`);

jest.mock('../../../src/cli/core/global-initialization.ts', () => {
  const { PersistenceManager } = require('../../../src/core/persistence.ts');
  const { Logger } = require('../../../src/core/logger.ts');
  
  let persistenceManager: any;
  let logger: any;
  
  return {
    getPersistenceManager: jest.fn().mockImplementation(async () => {
      if (!persistenceManager) {
        persistenceManager = new PersistenceManager(testDir);
        await persistenceManager.initialize();
      }
      return persistenceManager;
    }),
    getLogger: jest.fn().mockImplementation(async () => {
      if (!logger) {
        logger = new Logger('test');
      }
      return logger;
    }),
    getMemoryManager: jest.fn().mockResolvedValue({
      initialize: jest.fn(),
      createBank: jest.fn().mockResolvedValue('mock-bank-id'),
      getBank: jest.fn().mockResolvedValue({}),
      deleteBank: jest.fn()
    } as any)
  };
});

// Mock AgentProcessManager to prevent actual process spawning
jest.mock('../../../src/agents/agent-process-manager.ts', () => ({
  AgentProcessManager: jest.fn().mockImplementation(() => ({
    createAgent: jest.fn().mockResolvedValue('mock-agent-id'),
    getAgent: jest.fn().mockReturnValue({
      id: 'mock-agent-id',
      pid: 12345,
      status: 'running',
      type: 'researcher',
      startTime: new Date(),
      tasksCompleted: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      lastActivity: new Date()
    }),
    getAgents: jest.fn().mockReturnValue([]),
    getAgentStats: jest.fn().mockReturnValue({
      total: 0,
      running: 0,
      stopped: 0,
      error: 0,
      totalTasks: 0,
      totalFailures: 0
    }),
    stopAgent: jest.fn(),
    removeAgent: jest.fn()
  }))
}));

// Mock TaskEngine to prevent actual task execution
jest.mock('../../../src/task/engine.ts', () => ({
  TaskEngine: jest.fn().mockImplementation(() => ({
    createTask: jest.fn().mockImplementation(async (options: any) => ({
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: options.type,
      description: options.description,
      priority: options.priority,
      status: 'pending',
      tags: options.tags || [],
      dependencies: options.dependencies || [],
      metadata: options.metadata || {}
    })),
    listTasks: jest.fn().mockResolvedValue({
      tasks: [],
      total: 0
    }),
    getTask: jest.fn().mockResolvedValue(null),
    updateTask: jest.fn(),
    deleteTask: jest.fn()
  }))
}));

// Mock SwarmCoordinator
jest.mock('../../../src/swarm/coordinator.ts', () => ({
  SwarmCoordinator: jest.fn().mockImplementation(() => ({
    registerAgent: jest.fn(),
    assignTask: jest.fn(),
    listTasks: jest.fn().mockResolvedValue([]),
    getTask: jest.fn().mockResolvedValue(null),
    updateTask: jest.fn(),
    deleteTask: jest.fn()
  }))
}));

describe('CLI Agent and Task Persistence Integration Tests', () => {
  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Agent Persistence via CLI', () => {
    it('should create an agent and persist it to database', async () => {
      // Import the agent command after mocks are set up
      const { agentCommand } = await import('../../../src/cli/commands/agents/agent-management-command.ts');
      const { getPersistenceManager } = await import('../../../src/cli/core/global-initialization.ts');
      
      // Mock CLI context for spawning agent
      const spawnContext = {
        args: ['researcher'],
        options: {
          name: 'Test Agent',
          specialization: 'testing persistence',
          capabilities: 'research,analysis'
        }
      };

      // Execute spawn command
      const spawnSubcommand = agentCommand.subcommands?.find(sub => sub.name === 'spawn');
      expect(spawnSubcommand).toBeDefined();
      
      await spawnSubcommand!.handler(spawnContext);

      // Verify agent was saved to persistence
      const persistenceManager = await getPersistenceManager();
      const allAgents = await persistenceManager.getAllAgents();
      
      expect(allAgents).toHaveLength(1);
      expect(allAgents[0].name).toBe('Test Agent');
      expect(allAgents[0].type).toBe('researcher');
      expect(allAgents[0].status).toBe('active');
    });

    it('should list agents from persistence layer', async () => {
      const { agentCommand } = await import('../../../src/cli/commands/agents/agent-management-command.ts');
      const { getPersistenceManager } = await import('../../../src/cli/core/global-initialization.ts');
      
      // First, create some agents directly in persistence
      const persistenceManager = await getPersistenceManager();
      const testAgents = [
        {
          id: 'test-agent-001',
          type: 'researcher',
          name: 'Test Agent 1',
          status: 'active',
          capabilities: JSON.stringify(['research']),
          systemPrompt: 'Test agent prompt',
          maxConcurrentTasks: 3,
          priority: 1,
          createdAt: Date.now()
        },
        {
          id: 'test-agent-002',
          type: 'developer',
          name: 'Test Agent 2',
          status: 'idle',
          capabilities: JSON.stringify(['coding']),
          systemPrompt: 'Test agent prompt',
          maxConcurrentTasks: 2,
          priority: 2,
          createdAt: Date.now() + 1000
        }
      ];

      for (const agent of testAgents) {
        await persistenceManager.saveAgent(agent);
      }

      // Mock console.log to capture output
      const originalLog = console.log;
      const logOutput: string[] = [];
      console.log = jest.fn().mockImplementation((message) => {
        logOutput.push(message);
      });

      try {
        // Execute list command
        const listSubcommand = agentCommand.subcommands?.find(sub => sub.name === 'list');
        expect(listSubcommand).toBeDefined();
        
        await listSubcommand!.handler({ args: [], options: {} });

        // Verify agents are listed
        const output = logOutput.join('\n');
        expect(output).toContain('Test Agent 1');
        expect(output).toContain('Test Agent 2');
        expect(output).toContain('researcher');
        expect(output).toContain('developer');
      } finally {
        console.log = originalLog;
      }
    });

    it('should demonstrate the persistence issue - agents not showing after spawn', async () => {
      const { agentCommand } = await import('../../../src/cli/commands/agents/agent-management-command.ts');
      const { getPersistenceManager } = await import('../../../src/cli/core/global-initialization.ts');
      
      // Mock console.log to capture output
      const originalLog = console.log;
      const logOutput: string[] = [];
      console.log = jest.fn().mockImplementation((message) => {
        logOutput.push(message);
      });

      try {
        // First, spawn an agent
        const spawnContext = {
          args: ['researcher'],
          options: {
            name: 'Persistence Test Agent',
            specialization: 'testing'
          }
        };

        const spawnSubcommand = agentCommand.subcommands?.find(sub => sub.name === 'spawn');
        await spawnSubcommand!.handler(spawnContext);

        // Clear log output
        logOutput.length = 0;

        // Now try to list agents
        const listSubcommand = agentCommand.subcommands?.find(sub => sub.name === 'list');
        await listSubcommand!.handler({ args: [], options: {} });

        // Check if agent appears in list
        const output = logOutput.join('\n');
        const agentAppearsInList = output.includes('Persistence Test Agent');

        // Verify agent was saved to persistence
        const persistenceManager = await getPersistenceManager();
        const allAgents = await persistenceManager.getAllAgents();
        const agentInDatabase = allAgents.some(a => a.name === 'Persistence Test Agent');

        console.log('\n=== PERSISTENCE ISSUE DIAGNOSIS ===');
        console.log(`Agent saved to database: ${agentInDatabase}`);
        console.log(`Agent appears in list output: ${agentAppearsInList}`);
        console.log(`Database contains ${allAgents.length} agents`);
        console.log(`List command output:\n${output}`);

        // This test will help identify the issue
        expect(agentInDatabase).toBe(true); // Agent should be in database
        // The following assertion might fail, revealing the issue
        expect(agentAppearsInList).toBe(true); // Agent should appear in list
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Task Persistence via CLI', () => {
    it('should create a task and persist it to database', async () => {
      const { taskCommand } = await import('../../../src/cli/commands/tasks/task-command.ts');
      const { getPersistenceManager } = await import('../../../src/cli/core/global-initialization.ts');
      
      // Mock CLI context for creating task
      const createContext = {
        args: ['research', 'Test task for persistence'],
        options: {
          priority: 5,
          tags: 'test,persistence'
        }
      };

      // Execute create command
      const createSubcommand = taskCommand.subcommands?.find(sub => sub.name === 'create');
      expect(createSubcommand).toBeDefined();
      
      await createSubcommand!.handler(createContext);

      // Verify task was saved to persistence
      const persistenceManager = await getPersistenceManager();
      const activeTasks = await persistenceManager.getActiveTasks();
      
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].description).toBe('Test task for persistence');
      expect(activeTasks[0].type).toBe('research');
      expect(activeTasks[0].status).toBe('pending');
      expect(activeTasks[0].priority).toBe(5);
    });

    it('should list tasks from persistence layer', async () => {
      const { taskCommand } = await import('../../../src/cli/commands/tasks/task-command.ts');
      const { getPersistenceManager } = await import('../../../src/cli/core/global-initialization.ts');
      
      // First, create some tasks directly in persistence
      const persistenceManager = await getPersistenceManager();
      const testTasks = [
        {
          id: 'test-task-001',
          type: 'research',
          description: 'Test Task 1',
          status: 'pending',
          priority: 5,
          dependencies: '',
          metadata: JSON.stringify({ source: 'test' }),
          progress: 0,
          createdAt: Date.now()
        },
        {
          id: 'test-task-002',
          type: 'development',
          description: 'Test Task 2',
          status: 'in_progress',
          priority: 7,
          dependencies: '',
          metadata: JSON.stringify({ source: 'test' }),
          progress: 25,
          createdAt: Date.now() + 1000
        }
      ];

      for (const task of testTasks) {
        await persistenceManager.saveTask(task);
      }

      // Mock console.log to capture output
      const originalLog = console.log;
      const logOutput: string[] = [];
      console.log = jest.fn().mockImplementation((message) => {
        logOutput.push(message);
      });

      try {
        // Execute list command
        const listSubcommand = taskCommand.subcommands?.find(sub => sub.name === 'list');
        expect(listSubcommand).toBeDefined();
        
        await listSubcommand!.handler({ args: [], options: {} });

        // Verify tasks are listed
        const output = logOutput.join('\n');
        expect(output).toContain('Test Task 1');
        expect(output).toContain('Test Task 2');
        expect(output).toContain('research');
        expect(output).toContain('development');
      } finally {
        console.log = originalLog;
      }
    });

    it('should demonstrate the persistence issue - tasks not showing after create', async () => {
      const { taskCommand } = await import('../../../src/cli/commands/tasks/task-command.ts');
      const { getPersistenceManager } = await import('../../../src/cli/core/global-initialization.ts');
      
      // Mock console.log to capture output
      const originalLog = console.log;
      const logOutput: string[] = [];
      console.log = jest.fn().mockImplementation((message) => {
        logOutput.push(message);
      });

      try {
        // First, create a task
        const createContext = {
          args: ['research', 'Persistence Test Task'],
          options: {
            priority: 8,
            tags: 'persistence,test'
          }
        };

        const createSubcommand = taskCommand.subcommands?.find(sub => sub.name === 'create');
        await createSubcommand!.handler(createContext);

        // Clear log output
        logOutput.length = 0;

        // Now try to list tasks
        const listSubcommand = taskCommand.subcommands?.find(sub => sub.name === 'list');
        await listSubcommand!.handler({ args: [], options: {} });

        // Check if task appears in list
        const output = logOutput.join('\n');
        const taskAppearsInList = output.includes('Persistence Test Task');

        // Verify task was saved to persistence
        const persistenceManager = await getPersistenceManager();
        const activeTasks = await persistenceManager.getActiveTasks();
        const taskInDatabase = activeTasks.some(t => t.description === 'Persistence Test Task');

        console.log('\n=== TASK PERSISTENCE ISSUE DIAGNOSIS ===');
        console.log(`Task saved to database: ${taskInDatabase}`);
        console.log(`Task appears in list output: ${taskAppearsInList}`);
        console.log(`Database contains ${activeTasks.length} tasks`);
        console.log(`List command output:\n${output}`);

        // This test will help identify the issue
        expect(taskInDatabase).toBe(true); // Task should be in database
        // The following assertion might fail, revealing the issue
        expect(taskAppearsInList).toBe(true); // Task should appear in list
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Cross-Command Persistence', () => {
    it('should maintain persistence across different command invocations', async () => {
      // Set environment variable for consistent database path during tests
      process.env.FLOWX_DATA_PATH = testDir;
      
      const { agentCommand } = await import('../../../src/cli/commands/agents/agent-management-command.ts');
      const { taskCommand } = await import('../../../src/cli/commands/tasks/task-command.ts');
      const { getPersistenceManager, initializeGlobalServices } = await import('../../../src/cli/core/global-initialization.ts');
      
      // Initialize services to ensure database is properly set up
      await initializeGlobalServices();
      
      // Create an agent
      const spawnContext = {
        args: ['researcher'],
        options: { name: 'Cross Command Agent' }
      };
      const spawnSubcommand = agentCommand.subcommands?.find(sub => sub.name === 'spawn');
      await spawnSubcommand!.handler(spawnContext);

      // Create a task
      const createContext = {
        args: ['research', 'Cross Command Task'],
        options: { priority: 6 }
      };
      const createSubcommand = taskCommand.subcommands?.find(sub => sub.name === 'create');
      await createSubcommand!.handler(createContext);

      // Simulate a new command invocation by closing and reopening the database
      const persistenceManager = await getPersistenceManager();
      await persistenceManager.close();
      
      // Reinitialize services to simulate a new command
      await initializeGlobalServices();
      
      // Get a new persistence manager
      const newPersistenceManager = await getPersistenceManager();
      
      // Verify data persisted across "command invocations"
      const allAgents = await newPersistenceManager.getAllAgents();
      const activeTasks = await newPersistenceManager.getActiveTasks();

      expect(allAgents).toHaveLength(1);
      expect(allAgents[0].name).toBe('Cross Command Agent');
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].description).toBe('Cross Command Task');
    });
  });

  describe('Database Initialization and State', () => {
    it('should verify database is properly initialized', async () => {
      // Set environment variable for consistent database path during tests
      process.env.FLOWX_DATA_PATH = testDir;
      
      const { getPersistenceManager, initializeGlobalServices } = await import('../../../src/cli/core/global-initialization.ts');
      
      // Initialize services explicitly to ensure database is set up
      await initializeGlobalServices();
      
      // Get persistence manager
      const persistenceManager = await getPersistenceManager();
      
      // Verify database is initialized
      expect(persistenceManager).toBeDefined();
      expect(persistenceManager.initialized).toBe(true);
      expect(persistenceManager.db).toBeDefined();
      
      // Verify tables exist by running queries
      const agentCount = persistenceManager.db.prepare("SELECT COUNT(*) as count FROM agents").getAsObject();
      const taskCount = persistenceManager.db.prepare("SELECT COUNT(*) as count FROM tasks").getAsObject();
      const sessionCount = persistenceManager.db.prepare("SELECT COUNT(*) as count FROM sessions").getAsObject();
      
      expect(agentCount.count).toBeDefined();
      expect(taskCount.count).toBeDefined();
      expect(sessionCount.count).toBeDefined();
    });

    it('should verify table schemas are correct', async () => {
      // Set environment variable for consistent database path during tests
      process.env.FLOWX_DATA_PATH = testDir;
      
      const { getPersistenceManager, initializeGlobalServices } = await import('../../../src/cli/core/global-initialization.ts');
      
      // Initialize services explicitly to ensure database is set up
      await initializeGlobalServices();
      
      const persistenceManager = await getPersistenceManager();
      
      // Check agent table schema
      const agentSchema = persistenceManager.db.prepare("PRAGMA table_info(agents)").all();
      const agentColumns = agentSchema.map((col: any) => col.name);
      
      // Verify all required columns exist
      const expectedAgentColumns = [
        'id', 'type', 'name', 'status', 'capabilities', 
        'system_prompt', 'max_concurrent_tasks', 'priority', 'created_at'
      ];
      
      expectedAgentColumns.forEach(column => {
        expect(agentColumns).toContain(column);
      });
      
      // Check task table schema
      const taskSchema = persistenceManager.db.prepare("PRAGMA table_info(tasks)").all();
      const taskColumns = taskSchema.map((col: any) => col.name);
      
      // Verify all required columns exist
      const expectedTaskColumns = [
        'id', 'type', 'description', 'status', 'priority', 
        'dependencies', 'metadata', 'assigned_agent', 'progress',
        'created_at', 'completed_at', 'error'
      ];
      
      expectedTaskColumns.forEach(column => {
        expect(taskColumns).toContain(column);
      });
      
      // Check sessions table schema
      const sessionSchema = persistenceManager.db.prepare("PRAGMA table_info(sessions)").all();
      const sessionColumns = sessionSchema.map((col: any) => col.name);
      
      // Verify all required columns exist
      const expectedSessionColumns = [
        'id', 'agent_id', 'terminal_id', 'status', 'created_at'
      ];
      
      expectedSessionColumns.forEach(column => {
        expect(sessionColumns).toContain(column);
      });
      
      // Verify indices exist
      const indices = persistenceManager.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
      const indexNames = indices.map((idx: any) => idx.name);
      
      expect(indexNames).toContain('idx_agents_status');
      expect(indexNames).toContain('idx_tasks_status');
      expect(indexNames).toContain('idx_tasks_priority');
    });
  });
}); 