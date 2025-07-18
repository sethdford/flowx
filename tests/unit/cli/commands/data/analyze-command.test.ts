/**
 * Unit tests for Analyze Command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.mock('../../../../../src/cli/core/output-formatter', () => ({
  printSuccess: jest.fn(),
  printError: jest.fn(),
  printInfo: jest.fn(),
  printWarning: jest.fn(),
  formatTable: jest.fn()
}));

jest.mock('../../../../../src/swarm/coordinator', () => ({
  SwarmCoordinator: jest.fn().mockImplementation(() => ({
    getAnalytics: jest.fn(),
    analyzePerformance: jest.fn(),
    getAgentMetrics: jest.fn(),
    getTaskMetrics: jest.fn()
  }))
}));

jest.mock('../../../../../src/memory/manager', () => ({
  MemoryManager: jest.fn().mockImplementation(() => ({
    analyzeMemoryUsage: jest.fn(),
    getMemoryStatistics: jest.fn(),
    analyzePatterns: jest.fn()
  }))
}));

// Mock global initialization
jest.mock('../../../../../src/cli/core/global-initialization', () => ({
  getLogger: jest.fn(() => Promise.resolve({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  getMemoryManager: jest.fn(() => Promise.resolve({
    query: jest.fn(() => Promise.resolve([])),
    search: jest.fn(() => Promise.resolve([])),
    getMemoryBanks: jest.fn(() => Promise.resolve([])),
    analyzeMemoryUsage: jest.fn(() => Promise.resolve({}))
  })),
  getPersistenceManager: jest.fn(() => Promise.resolve({
    getActiveTasks: jest.fn(() => Promise.resolve([])),
    getActiveAgents: jest.fn(() => Promise.resolve([])),
    getTaskHistory: jest.fn(() => Promise.resolve([])),
    getAgentHistory: jest.fn(() => Promise.resolve([])),
    getSystemLogs: jest.fn(() => Promise.resolve([])),
    query: jest.fn(() => Promise.resolve([])),
    search: jest.fn(() => Promise.resolve([])),
    store: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getMetrics: jest.fn(() => Promise.resolve({})),
    executeQuery: jest.fn(() => Promise.resolve([])),
    getSchema: jest.fn(() => Promise.resolve({})),
    getIndices: jest.fn(() => Promise.resolve([]))
  }))
}));

// Create a proper mock TaskEngine class
class MockTaskEngine {
  listTasks = jest.fn(() => Promise.resolve({ tasks: [], total: 0, hasMore: false }));
  analyzeTask = jest.fn(() => Promise.resolve({}));
  getTaskStatistics = jest.fn(() => Promise.resolve({}));
  getTaskMetrics = jest.fn(() => Promise.resolve({}));
  getActiveTasks = jest.fn(() => Promise.resolve([]));
  createTask = jest.fn(() => Promise.resolve({}));
  getTaskStatus = jest.fn(() => Promise.resolve(null));
  cancelTask = jest.fn(() => Promise.resolve());
  executeWorkflow = jest.fn(() => Promise.resolve());
  listWorkflows = jest.fn(() => Promise.resolve([]));
  on = jest.fn();
  emit = jest.fn();
  removeListener = jest.fn();
  
  constructor() {
    // Mock constructor - no implementation needed
  }
}

jest.mock('../../../../../src/task/engine', () => ({
  TaskEngine: MockTaskEngine
}));

// Mock filesystem
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn()
}));

describe('Analyze Command', () => {
  let mockOutputFormatter: any;
  let mockSwarmCoordinator: any;
  let mockMemoryManager: any;
  let analyzeCommand: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mocked modules
    mockOutputFormatter = require('../../../../../src/cli/core/output-formatter');
    const { SwarmCoordinator } = require('../../../../../src/swarm/coordinator');
    const { MemoryManager } = require('../../../../../src/memory/manager');
    
    mockSwarmCoordinator = new SwarmCoordinator();
    mockMemoryManager = new MemoryManager();
    
    // Ensure mock methods exist and setup default mock responses
    if (mockSwarmCoordinator.getAnalytics) {
      mockSwarmCoordinator.getAnalytics.mockResolvedValue({
        totalAgents: 5,
        activeAgents: 3,
        taskMetrics: { completed: 10, failed: 2, pending: 3 }
      });
    }
    
    if (mockMemoryManager.analyzeMemoryUsage) {
      mockMemoryManager.analyzeMemoryUsage.mockResolvedValue({
        totalMemory: 1000,
        usedMemory: 600,
        freeMemory: 400
      });
    }

    // Reset TaskEngine mock methods
    MockTaskEngine.prototype.listTasks = jest.fn(() => Promise.resolve({ tasks: [], total: 0, hasMore: false }));
    MockTaskEngine.prototype.analyzeTask = jest.fn(() => Promise.resolve({}));
    MockTaskEngine.prototype.getTaskStatistics = jest.fn(() => Promise.resolve({}));
    MockTaskEngine.prototype.getTaskMetrics = jest.fn(() => Promise.resolve({}));
    MockTaskEngine.prototype.getActiveTasks = jest.fn(() => Promise.resolve([]));
    
    // Ensure global initialization mocks return proper instances
    const globalInit = require('../../../../../src/cli/core/global-initialization');
    globalInit.getPersistenceManager.mockResolvedValue({
      getActiveTasks: jest.fn(() => Promise.resolve([])),
      getActiveAgents: jest.fn(() => Promise.resolve([])),
      getTaskHistory: jest.fn(() => Promise.resolve([])),
      getAgentHistory: jest.fn(() => Promise.resolve([])),
      getSystemLogs: jest.fn(() => Promise.resolve([]))
    });
    
    // Import the command after mocks are set up
    analyzeCommand = require('../../../../../src/cli/commands/system/analyze-command').analyzeCommand;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('command structure', () => {
    it('should have correct command structure', async () => {
      
      expect(analyzeCommand).toBeDefined();
      expect(analyzeCommand.name).toBe('analyze');
      expect(analyzeCommand.description).toContain('Comprehensive data analysis');
      expect(analyzeCommand.options).toBeDefined();
      expect(analyzeCommand.handler).toBeDefined();
    });

    it('should have system analysis support via target argument', async () => {
      
      // System analysis is done via target argument, not option
      expect(analyzeCommand.arguments[0].name).toBe('target');
      expect(analyzeCommand.arguments[0].description).toContain('system');
    });

    it('should have performance analysis option', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const performanceOption = analyzeCommand.options.find((opt: any) => opt.name === 'performance');
      expect(performanceOption).toBeDefined();
    });

    it('should have output format options', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const formatOption = analyzeCommand.options.find((opt: any) => opt.name === 'format');
      expect(formatOption).toBeDefined();
    });
  });

  describe('analysis types', () => {
    it('should support system analysis', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['system'],
        options: { system: true }
      };
      
      // Test should not throw
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });

    it('should support performance analysis', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['performance'],
        options: { performance: true }
      };
      
      // Test should not throw
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });

    it('should support log analysis', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['logs'],
        options: { logs: true }
      };
      
      // Test should not throw
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });

    it('should support task analysis', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['tasks'],
        options: { tasks: true }
      };
      
      // Test should not throw
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });

    it('should support agent analysis', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['agents'],
        options: { agents: true }
      };
      
      // Test should not throw
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });
  });

  describe('output formats', () => {
    it('should support JSON output format', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['system'],
        options: { system: true, format: 'json' }
      };
      
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });

    it('should support table output format', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['system'],
        options: { system: true, format: 'table' }
      };
      
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });

    it('should support CSV output format', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['system'],
        options: { system: true, format: 'csv' }
      };
      
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle invalid analysis type', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: ['invalid'],
        options: { invalid: true }
      };
      
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });

    it('should handle missing arguments', async () => {
      const { analyzeCommand } = require('../../../../../src/cli/commands/data/analyze-command');
      
      const mockContext = {
        args: [],
        options: {}
      };
      
      await expect(analyzeCommand.handler(mockContext)).resolves.not.toThrow();
    });
  });
}); 