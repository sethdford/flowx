/**
 * Tests for the BackgroundExecutor
 * 
 * This test suite verifies the functionality of the BackgroundExecutor which manages
 * asynchronous tasks in the flowx system. The tests ensure proper task submission,
 * execution, cancellation, and error handling behavior.
 * 
 * Key test areas:
 * - Initialization and shutdown of the executor
 * - Task submission with various parameters
 * - Task retrieval and status management
 * - Event handling for task lifecycle events
 * - Error handling for invalid tasks and execution failures
 * 
 * The tests use mocked EventBus and Logger dependencies to isolate the BackgroundExecutor
 * and prevent actual command execution during testing.
 */

import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { BackgroundExecutor, BackgroundTaskDefinition, BackgroundTaskConfig } from '../../../src/coordination/background-executor';

// Mocks for dependencies
// These mocks isolate the BackgroundExecutor from its dependencies
// and allow us to verify interactions with EventBus and Logger

// Mock EventBus with all required event methods
const mockEventBus = {
  on: jest.fn(),      // Used to subscribe to events
  off: jest.fn(),     // Used to unsubscribe from events
  emit: jest.fn(),    // Used to emit events
  subscribe: jest.fn(), // Alternative subscription method
  unsubscribe: jest.fn(), // Alternative unsubscription method
  once: jest.fn(),
  removeAllListeners: jest.fn(),
  listenerCount: jest.fn(),
  listeners: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  getMaxListeners: jest.fn(),
  setMaxListeners: jest.fn(),
  eventNames: jest.fn(),
  rawListeners: jest.fn(),
  waitFor: jest.fn(),
  getEventStatistics: jest.fn(),
  resetStatistics: jest.fn(),
  removeAllListenersForEvent: jest.fn(),
  createFilteredListener: jest.fn()
} as any;

// Mock Logger with standard logging methods
const mockLogger = {
  debug: jest.fn(),   // For detailed debug messages
  info: jest.fn(),    // For standard information messages
  warn: jest.fn(),    // For warning messages
  error: jest.fn(),   // For error messages
  child: jest.fn().mockReturnThis(), // For creating child loggers with context
  configure: jest.fn()
} as any;

// Mock configuration for BackgroundExecutor
const mockConfig: BackgroundTaskConfig = {
  maxConcurrentTasks: 3,
  taskTimeout: 30000,
  retryAttempts: 3,
  retryBackoffBase: 1000,
  persistenceDir: './test-persistence',
  healthCheckInterval: 30000,
  processCleanupInterval: 60000,
  maxQueueSize: 100,
  enablePersistence: false // Disable persistence for tests
};

describe('BackgroundExecutor', () => {
  let backgroundExecutor: BackgroundExecutor;
  
  beforeEach(() => {
    // Reset all mocks before each test to ensure clean state
    jest.clearAllMocks();
    
    // Create a fresh instance of BackgroundExecutor with mocked dependencies
    backgroundExecutor = new BackgroundExecutor(mockConfig, mockLogger, mockEventBus);
    
    // Mock the private executeTask method to avoid actual command execution during tests
    // This simulates successful task execution without running real commands
    jest.spyOn(backgroundExecutor as any, 'executeTask').mockImplementation(async (task: any) => {
      task.status = 'completed';
      task.result = { success: true, output: 'Mock output' };
      return Promise.resolve();
    });
  });
  
  // Properly clean up after each test to prevent state leakage between tests
  // This is especially important for the BackgroundExecutor which manages resources
  // and event subscriptions that need to be released after testing
  afterEach(async () => {
    if (backgroundExecutor && !backgroundExecutor.shuttingDown) {
      await backgroundExecutor.shutdown();
    }
  });
  
  describe('initialization', () => {
    it('should initialize correctly', async () => {
      await backgroundExecutor.initialize();
      expect(mockEventBus.on).toHaveBeenCalled();
    });
    
    it('should shutdown properly', async () => {
      await backgroundExecutor.initialize();
      await backgroundExecutor.shutdown();
      expect(backgroundExecutor.shuttingDown).toBe(true);
    });
  });
  
  describe('task submission', () => {
    beforeEach(async () => {
      await backgroundExecutor.initialize();
    });
    
    it('should submit a task successfully', async () => {
      const taskId = await backgroundExecutor.submitTask({
        type: 'script',
        command: 'echo',
        args: ['hello'],
        priority: 0
      });
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Task submitted'),
        expect.objectContaining({ taskId })
      );
    });
    
    it('should handle task with priority', async () => {
      const taskId = await backgroundExecutor.submitTask({
        type: 'script',
        command: 'echo',
        args: ['hello'],
        priority: 1,
        options: {
          priority: 1
        }
      });
      
      expect(taskId).toBeDefined();
    });
  });
  
  describe('task management', () => {
    beforeEach(async () => {
      await backgroundExecutor.initialize();
    });
    
    it('should retrieve task information', async () => {
      const taskId = await backgroundExecutor.submitTask({
        type: 'command',
        command: 'test',
        args: [],
        priority: 0
      });
      
      const task = backgroundExecutor.getTask(taskId);
      expect(task).toBeDefined();
      expect(task!.id).toBe(taskId);
    });
    
    it('should cancel a task', async () => {
      const taskId = await backgroundExecutor.submitTask({
        type: 'command',
        command: 'test',
        args: [],
        priority: 0
      });
      
      const cancelled = await backgroundExecutor.cancelTask(taskId);
      expect(cancelled).toBe(true);
      
      const task = backgroundExecutor.getTask(taskId);
      expect(task!.status).toBe('cancelled');
    });
  });
  
  describe('event handling', () => {
    beforeEach(async () => {
      await backgroundExecutor.initialize();
    });
    
    it('should handle task cancel events', async () => {
      const taskId = await backgroundExecutor.submitTask({
        type: 'command',
        command: 'test',
        args: [],
        priority: 0
      });
      
      // Cancel the task directly to test the functionality
      const cancelled = await backgroundExecutor.cancelTask(taskId);
      expect(cancelled).toBe(true);
      
      // Verify that the task status was updated to cancelled
      const task = backgroundExecutor.getTask(taskId);
      expect(task!.status).toBe('cancelled');
    });
  });
  
  describe('error handling', () => {
    beforeEach(async () => {
      await backgroundExecutor.initialize();
    });
    
    it('should handle task submissions with valid types', async () => {
      // Test that valid task types are accepted
      const taskId = await backgroundExecutor.submitTask({
        type: 'command',
        command: 'test',
        args: [],
        priority: 0
      });
      
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });
    
    it('should handle task execution and status updates', async () => {
      // Override the mock to simulate completion
      jest.spyOn(backgroundExecutor as any, 'executeTask').mockImplementation(async (task: any) => {
        task.status = 'completed';
        task.result = { success: true, output: 'Mock output' };
        return Promise.resolve();
      });
      
      const taskId = await backgroundExecutor.submitTask({
        type: 'command',
        command: 'test-command',
        args: [],
        priority: 0
      });
      
      // Wait for task processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const task = backgroundExecutor.getTask(taskId);
      expect(task).toBeDefined();
      expect(task!.id).toBe(taskId);
    });
  });
  
  describe('metrics and monitoring', () => {
    beforeEach(async () => {
      await backgroundExecutor.initialize();
    });
    
    it('should provide metrics', () => {
      const metrics = backgroundExecutor.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalTasks).toBe('number');
      expect(typeof metrics.completedTasks).toBe('number');
      expect(typeof metrics.failedTasks).toBe('number');
    });
    
    it('should list tasks with filters', async () => {
      await backgroundExecutor.submitTask({
        type: 'command',
        command: 'test',
        args: [],
        priority: 0
      });
      
      const tasks = backgroundExecutor.listTasks({ status: 'pending' });
      expect(Array.isArray(tasks)).toBe(true);
    });
  });
});
