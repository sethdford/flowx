/**
 * Tests for Specialized Task Executors
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DirectExecutor } from "../../../../src/swarm/executors/direct-executor.js";
import { SparcExecutor } from "../../../../src/swarm/executors/sparc-executor.js";
import { TaskExecutorFactory, executorFactory } from "../../../../src/swarm/executors/index.js";
import type { TaskDefinition, AgentId } from "../../../../src/swarm/types.js";

// Mock the dependencies
jest.mock("../../../../src/core/logger.ts");
jest.mock("../../../../src/swarm/optimizations/connection-pool.ts");
jest.mock("../../../../src/swarm/optimizations/async-file-manager.ts");

// Create mock task and agent for testing
const createMockTask = (overrides?: Partial<TaskDefinition>): TaskDefinition => ({
  id: { 
    id: 'test-task-001', 
    swarmId: 'test-swarm', 
    sequence: 1, 
    priority: 3 
  },
  type: 'coding',
  name: 'Test Task',
  description: 'Test task for executor testing',
  requirements: { capabilities: [], tools: [], permissions: [] },
  constraints: { dependencies: [], dependents: [], conflicts: [] },
  priority: 'normal',
  input: { test: 'data' },
  instructions: 'Create a simple function that adds two numbers',
  context: { model: 'claude-3-5-sonnet-20241022' },
  status: 'created',
  createdAt: new Date(),
  updatedAt: new Date(),
  attempts: [],
  statusHistory: [],
  ...overrides
});

const createMockAgent = (): AgentId => ({
  id: 'test-agent-001',
  swarmId: 'test-swarm',
  type: 'developer',
  instance: 1
});

describe('DirectExecutor', () => {
  let directExecutor: DirectExecutor;
  let mockTask: TaskDefinition;
  let mockAgent: AgentId;

  beforeEach(() => {
    directExecutor = new DirectExecutor({
      immediateExecution: {
        timeout: 30000,
        retryOnFailure: false
      }
    });
    mockTask = createMockTask();
    mockAgent = createMockAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const executor = new DirectExecutor();
      expect(executor).toBeInstanceOf(DirectExecutor);
    });

    it('should initialize with custom configuration', () => {
      const config = {
        immediateExecution: { timeout: 60000 },
        connectionPool: { min: 1, max: 3 }
      };
      const executor = new DirectExecutor(config);
      expect(executor).toBeInstanceOf(DirectExecutor);
    });
  });

  describe('Immediate Task Execution', () => {
    it('should execute task immediately', async () => {
      // Mock the connection pool execution
      const mockConnectionPool = {
        execute: jest.fn().mockResolvedValue('Test output')
      };
      (directExecutor as any).connectionPool = mockConnectionPool;

      const result = await directExecutor.executeTaskImmediate(mockTask, mockAgent);

      expect(result).toBeDefined();
      expect(result.metadata.taskId).toBe(mockTask.id.id);
      expect(result.metadata.agentId).toBe(mockAgent.id);
      expect(result.metadata.executionType).toBe('direct');
    });

    it('should handle high priority tasks with priority bypass', async () => {
      const highPriorityTask = createMockTask({ priority: 'critical' });
      
      const mockConnectionPool = {
        execute: jest.fn().mockResolvedValue('High priority output')
      };
      (directExecutor as any).connectionPool = mockConnectionPool;

      const result = await directExecutor.executeTaskImmediate(highPriorityTask, mockAgent);

      expect(result).toBeDefined();
      expect(result.metadata.taskId).toBe(highPriorityTask.id.id);
      
      const metrics = directExecutor.getMetrics();
      expect(metrics.priorityBypass).toBe(1);
    });

    it('should handle execution timeout', async () => {
      const shortTimeoutExecutor = new DirectExecutor({
        immediateExecution: { timeout: 1 } // 1ms timeout
      });

      const mockConnectionPool = {
        execute: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 100)) // Takes 100ms
        )
      };
      (shortTimeoutExecutor as any).connectionPool = mockConnectionPool;

      const result = await shortTimeoutExecutor.executeTaskImmediate(mockTask, mockAgent);

      expect(result.metadata.success).toBe(false);
      expect(result.metadata.error?.message).toContain('timeout');
      
      const metrics = shortTimeoutExecutor.getMetrics();
      expect(metrics.timeoutErrors).toBe(1);
    });

    it('should execute multiple tasks in parallel', async () => {
      const tasks = [
        createMockTask({ id: { id: 'task-1', swarmId: 'test-swarm', sequence: 1, priority: 3 } }),
        createMockTask({ id: { id: 'task-2', swarmId: 'test-swarm', sequence: 2, priority: 3 } }),
        createMockTask({ id: { id: 'task-3', swarmId: 'test-swarm', sequence: 3, priority: 3 } })
      ];

      const mockConnectionPool = {
        execute: jest.fn().mockResolvedValue('Parallel output')
      };
      (directExecutor as any).connectionPool = mockConnectionPool;

      const results = await directExecutor.executeTasksImmediate(tasks, [mockAgent]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.metadata.executionType === 'direct')).toBe(true);
      expect(mockConnectionPool.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('Metrics and Status', () => {
    it('should track execution metrics', () => {
      const metrics = directExecutor.getMetrics();

      expect(metrics).toMatchObject({
        totalExecuted: 0,
        totalSucceeded: 0,
        totalFailed: 0,
        avgExecutionTime: expect.any(Number),
        immediateExecutions: 0,
        timeoutErrors: 0,
        priorityBypass: 0
      });
    });

    it('should provide status information', () => {
      const status = directExecutor.getStatus();

      expect(status).toMatchObject({
        isReady: expect.any(Boolean),
        activeExecutions: expect.any(Number),
        connectionPoolStatus: expect.any(Object),
        metrics: expect.any(Object)
      });
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const shutdownPromise = directExecutor.shutdown();
      await expect(shutdownPromise).resolves.toBeUndefined();
    });
  });
});

describe('SparcExecutor', () => {
  let sparcExecutor: SparcExecutor;
  let mockTask: TaskDefinition;
  let mockAgent: AgentId;

  beforeEach(() => {
    sparcExecutor = new SparcExecutor({
      sparc: {
        enableAllPhases: true,
        phaseTimeout: 30000
      }
    });
    mockTask = createMockTask();
    mockAgent = createMockAgent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default SPARC configuration', () => {
      const executor = new SparcExecutor();
      expect(executor).toBeInstanceOf(SparcExecutor);
    });

    it('should initialize with custom SPARC configuration', () => {
      const config = {
        sparc: {
          enableAllPhases: false,
          skipPhases: ['review' as const],
          phaseTimeout: 60000
        }
      };
      const executor = new SparcExecutor(config);
      expect(executor).toBeInstanceOf(SparcExecutor);
    });
  });

  describe('SPARC Methodology Execution', () => {
    it('should execute all SPARC phases', async () => {
      // Mock the connection pool to return different outputs for each phase
      const mockConnectionPool = {
        execute: jest.fn()
          .mockResolvedValueOnce('Specification output')
          .mockResolvedValueOnce('Pseudocode output')
          .mockResolvedValueOnce('Architecture output')
          .mockResolvedValueOnce('Review output')
          .mockResolvedValueOnce('Code output')
      };
      (sparcExecutor as any).connectionPool = mockConnectionPool;

      const result = await sparcExecutor.executeTaskSparc(mockTask, mockAgent);

      expect(result).toBeDefined();
      expect(result.sparcPhases).toHaveLength(5);
      expect(result.methodology.phasesCompleted).toHaveLength(5);
      expect(result.methodology.systemicApproach).toBe(true);
      expect(mockConnectionPool.execute).toHaveBeenCalledTimes(5);

      // Check that all phases are present
      const phaseTypes = result.sparcPhases.map(p => p.phase);
      expect(phaseTypes).toContain('specification');
      expect(phaseTypes).toContain('pseudocode');
      expect(phaseTypes).toContain('architecture');
      expect(phaseTypes).toContain('review');
      expect(phaseTypes).toContain('code');
    });

    it('should handle minimal SPARC execution', async () => {
      const minimalExecutor = new SparcExecutor({
        sparc: { enableAllPhases: false }
      });

      const mockConnectionPool = {
        execute: jest.fn()
          .mockResolvedValueOnce('Specification output')
          .mockResolvedValueOnce('Code output')
      };
      (minimalExecutor as any).connectionPool = mockConnectionPool;

      const result = await minimalExecutor.executeTaskSparc(mockTask, mockAgent);

      expect(result.sparcPhases).toHaveLength(2);
      expect(result.methodology.phasesCompleted).toEqual(['specification', 'code']);
      expect(result.methodology.systemicApproach).toBe(false);
    });

    it('should continue execution even if some phases fail', async () => {
      const mockConnectionPool = {
        execute: jest.fn()
          .mockResolvedValueOnce('Specification output')
          .mockRejectedValueOnce(new Error('Pseudocode failed'))
          .mockResolvedValueOnce('Architecture output')
          .mockResolvedValueOnce('Review output')
          .mockResolvedValueOnce('Code output')
      };
      (sparcExecutor as any).connectionPool = mockConnectionPool;

      const result = await sparcExecutor.executeTaskSparc(mockTask, mockAgent);

      expect(result.sparcPhases).toHaveLength(5);
      expect(result.sparcPhases[1].success).toBe(false); // Pseudocode phase failed
      expect(result.sparcPhases[0].success).toBe(true);  // Specification succeeded
      expect(result.sparcPhases[2].success).toBe(true);  // Architecture succeeded
    });

    it('should evaluate phase quality and completeness', async () => {
      const mockConnectionPool = {
        execute: jest.fn().mockResolvedValue('Detailed output with requirements, constraints, and success criteria')
      };
      (sparcExecutor as any).connectionPool = mockConnectionPool;

      const result = await sparcExecutor.executeTaskSparc(mockTask, mockAgent);

      result.sparcPhases.forEach(phase => {
        expect(phase.quality).toBeGreaterThan(0);
        expect(phase.completeness).toBeGreaterThan(0);
        expect(phase.duration).toBeGreaterThan(0);
      });
    });
  });

  describe('Phase Quality Evaluation', () => {
    it('should properly evaluate specification phase quality', async () => {
      const sparcExecutor = new SparcExecutor();
      
      // Test high quality output
      const highQualityOutput = `
        1. Requirements: Clear input/output specifications
        2. Constraints: Performance and memory limitations
        3. Success criteria: Functional correctness and efficiency
        4. Edge cases: Invalid inputs, boundary conditions
        5. Performance requirements: Sub-second response time
      `;

      const quality = await (sparcExecutor as any).evaluatePhaseQuality('specification', highQualityOutput, mockTask);
      expect(quality).toBeGreaterThan(0.8);

      // Test low quality output
      const lowQualityOutput = 'Simple task';
      const lowQuality = await (sparcExecutor as any).evaluatePhaseQuality('specification', lowQualityOutput, mockTask);
      expect(lowQuality).toBeLessThan(0.7);
    });
  });

  describe('Metrics and Reporting', () => {
    it('should track SPARC execution metrics', () => {
      const metrics = sparcExecutor.getMetrics();

      expect(metrics).toMatchObject({
        totalExecuted: 0,
        totalSucceeded: 0,
        totalFailed: 0,
        avgExecutionTime: expect.any(Number),
        phaseSuccessRates: expect.any(Object),
        methodologyCompleteness: expect.any(Number),
        qualityScores: expect.any(Array)
      });
    });

    it('should track phase success rates', async () => {
      const mockConnectionPool = {
        execute: jest.fn().mockResolvedValue('Phase output')
      };
      (sparcExecutor as any).connectionPool = mockConnectionPool;

      await sparcExecutor.executeTaskSparc(mockTask, mockAgent);

      const metrics = sparcExecutor.getMetrics();
      expect(metrics.phaseSuccessRates.specification).toBe(1);
      expect(metrics.phaseSuccessRates.code).toBe(1);
    });
  });
});

describe('TaskExecutorFactory', () => {
  let factory: TaskExecutorFactory;

  beforeEach(() => {
    factory = new TaskExecutorFactory();
  });

  describe('Executor Creation', () => {
    it('should create DirectExecutor', () => {
      const executor = factory.createDirectExecutor();
      expect(executor).toBeInstanceOf(DirectExecutor);
    });

    it('should create SparcExecutor', () => {
      const executor = factory.createSparcExecutor();
      expect(executor).toBeInstanceOf(SparcExecutor);
    });

    it('should create executor with custom configuration', () => {
      const config = { immediateExecution: { timeout: 60000 } };
      const executor = factory.createDirectExecutor(config);
      expect(executor).toBeInstanceOf(DirectExecutor);
    });
  });

  describe('Executor Capabilities', () => {
    it('should return available executor types', () => {
      const types = factory.getAvailableExecutors();
      expect(types).toContain('direct');
      expect(types).toContain('sparc');
      expect(types).toContain('optimized');
    });

    it('should return capabilities for each executor type', () => {
      const directCapabilities = factory.getExecutorCapabilities('direct');
      expect(directCapabilities).toContain('immediate_execution');
      expect(directCapabilities).toContain('priority_bypass');

      const sparcCapabilities = factory.getExecutorCapabilities('sparc');
      expect(sparcCapabilities).toContain('systematic_methodology');
      expect(sparcCapabilities).toContain('five_phase_execution');
    });
  });

  describe('Executor Recommendations', () => {
    it('should recommend direct executor for critical priority tasks', () => {
      const recommendation = factory.getRecommendedExecutor('analysis', 'critical');
      expect(recommendation).toBe('direct');
    });

    it('should recommend SPARC executor for coding tasks', () => {
      const recommendation = factory.getRecommendedExecutor('coding', 'medium');
      expect(recommendation).toBe('sparc');
    });

    it('should recommend optimized executor for research tasks', () => {
      const recommendation = factory.getRecommendedExecutor('research', 'low');
      expect(recommendation).toBe('optimized');
    });

    it('should create recommended executor', () => {
      const executor = factory.createRecommendedExecutor('coding', 'medium');
      expect(executor).toBeInstanceOf(SparcExecutor);

      const directExecutor = factory.createRecommendedExecutor('analysis', 'critical');
      expect(directExecutor).toBeInstanceOf(DirectExecutor);
    });
  });
});

describe('Executor Integration', () => {
  it('should use singleton factory instance', () => {
    expect(executorFactory).toBeInstanceOf(TaskExecutorFactory);
    
    const executor1 = executorFactory.createDirectExecutor();
    const executor2 = executorFactory.createSparcExecutor();
    
    expect(executor1).toBeInstanceOf(DirectExecutor);
    expect(executor2).toBeInstanceOf(SparcExecutor);
  });

  it('should handle error scenarios gracefully', async () => {
    const directExecutor = new DirectExecutor();
    const mockAgent = createMockAgent();
    const mockTask = createMockTask();

    // Mock connection pool to throw error
    const mockConnectionPool = {
      execute: jest.fn().mockRejectedValue(new Error('Connection failed'))
    };
    (directExecutor as any).connectionPool = mockConnectionPool;

    const result = await directExecutor.executeTaskImmediate(mockTask, mockAgent);

    expect(result.metadata.success).toBe(false);
    expect(result.metadata.error).toBeDefined();
    expect(result.metadata.error?.message).toBe('Connection failed');
  });
}); 