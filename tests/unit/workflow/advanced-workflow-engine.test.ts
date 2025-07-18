/**
 * Advanced Workflow Engine Tests
 * Comprehensive test suite for enhanced workflow capabilities
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AdvancedWorkflowEngine } from '../../../src/workflow/advanced-workflow-engine.js';
import { Logger } from '../../../src/core/logger.js';
import { EventBus } from '../../../src/core/event-bus.js';

describe('Advanced Workflow Engine', () => {
  let engine: AdvancedWorkflowEngine;
  let logger: Logger;
  let eventBus: EventBus;

  beforeEach(async () => {
    logger = new Logger({ level: 'error', format: 'text', destination: 'console' }, { component: 'test' });
    eventBus = EventBus.getInstance();
    engine = new AdvancedWorkflowEngine(logger, eventBus);
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
    eventBus.removeAllListeners();
  });

  describe('Basic Workflow Operations', () => {
    it('should create a workflow', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Test Workflow',
        description: 'A test workflow',
        steps: [],
        globalVariables: { testVar: 'value' }
      });

      expect(workflowId).toBeDefined();
      expect(workflowId).toContain('workflow');

      const workflow = engine.getWorkflow(workflowId);
      expect(workflow).toBeDefined();
      expect(workflow!.name).toBe('Test Workflow');
      expect(workflow!.globalVariables).toEqual({ testVar: 'value' });
    });

    it('should execute a simple workflow', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Simple Workflow',
        steps: [
          {
            id: 'step1',
            name: 'First Step',
            type: 'task',
            command: 'echo hello',
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId, { input: 'test' });

      expect(executionId).toBeDefined();
      expect(executionId).toContain('execution');

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      expect(execution).toBeDefined();
      expect(execution!.status).toBe('completed');
      expect(execution!.stepResults['step1']).toBeDefined();
      expect(execution!.stepResults['step1'].status).toBe('completed');
    });

    it('should list workflows', async () => {
      const workflowId1 = await engine.createWorkflow({ name: 'Workflow 1' });
      const workflowId2 = await engine.createWorkflow({ name: 'Workflow 2' });

      const workflows = engine.listWorkflows();
      expect(workflows).toHaveLength(2);
      expect(workflows.map(w => w.name)).toEqual(['Workflow 1', 'Workflow 2']);
    });
  });

  describe('Conditional Logic', () => {
    it('should execute if-else workflow with true condition', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'If-Else Workflow',
        steps: [
          {
            id: 'conditional',
            name: 'Conditional Step',
            type: 'if-else',
            branches: [
              {
                id: 'true-branch',
                name: 'True Branch',
                condition: {
                  type: 'expression',
                  expression: 'testValue === true'
                },
                steps: [
                  {
                    id: 'true-step',
                    name: 'Execute when true',
                    type: 'task',
                    dependencies: [],
                    metadata: {}
                  }
                ],
                priority: 1
              },
              {
                id: 'false-branch',
                name: 'False Branch',
                condition: {
                  type: 'expression',
                  expression: 'testValue === false'
                },
                steps: [
                  {
                    id: 'false-step',
                    name: 'Execute when false',
                    type: 'task',
                    dependencies: [],
                    metadata: {}
                  }
                ],
                priority: 2
              }
            ],
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId, { testValue: true });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['conditional'].output.executedBranch).toBe('true-branch');
    });

    it('should execute switch workflow', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Switch Workflow',
        steps: [
          {
            id: 'switch',
            name: 'Switch Step',
            type: 'switch',
            branches: [
              {
                id: 'case1',
                name: 'Case 1',
                condition: {
                  type: 'expression',
                  expression: 'switchValue === "option1"'
                },
                steps: [],
                priority: 1
              },
              {
                id: 'case2',
                name: 'Case 2',
                condition: {
                  type: 'expression',
                  expression: 'switchValue === "option2"'
                },
                steps: [],
                priority: 2
              }
            ],
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId, { switchValue: 'option2' });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['switch'].output.executedBranch).toBe('case2');
    });

    it('should skip step when condition is false', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Conditional Skip Workflow',
        steps: [
          {
            id: 'conditional-step',
            name: 'Conditional Step',
            type: 'task',
            condition: {
              type: 'expression',
              expression: 'shouldExecute === true'
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId, { shouldExecute: false });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['conditional-step'].status).toBe('skipped');
    });
  });

  describe('Loop Operations', () => {
    it('should execute while loop', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'While Loop Workflow',
        steps: [
          {
            id: 'while-loop',
            name: 'While Loop',
            type: 'while',
            loop: {
              type: 'while',
              condition: {
                type: 'expression',
                expression: '__loop_index < 3'
              },
              maxIterations: 5
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId, { __loop_index: 0 });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 300));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['while-loop'].output.type).toBe('while-loop');
      expect(execution!.stepResults['while-loop'].output.iterations).toBeGreaterThan(0);
    });

    it('should execute for loop', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'For Loop Workflow',
        steps: [
          {
            id: 'for-loop',
            name: 'For Loop',
            type: 'for',
            loop: {
              type: 'for',
              maxIterations: 3
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['for-loop'].output.type).toBe('for-loop');
      expect(execution!.stepResults['for-loop'].output.iterations).toBe(3);
    });

    it('should execute foreach loop', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Foreach Loop Workflow',
        steps: [
          {
            id: 'foreach-loop',
            name: 'Foreach Loop',
            type: 'for',
            loop: {
              type: 'foreach',
              itemsExpression: 'items',
              maxIterations: 10
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId, {
        items: ['item1', 'item2', 'item3']
      });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['foreach-loop'].output.type).toBe('for-loop');
      expect(execution!.stepResults['foreach-loop'].output.iterations).toBe(3);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute parallel branches', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Parallel Workflow',
        steps: [
          {
            id: 'parallel',
            name: 'Parallel Execution',
            type: 'parallel',
            branches: [
              {
                id: 'branch1',
                name: 'Branch 1',
                condition: { type: 'expression', expression: 'true' },
                steps: [
                  {
                    id: 'task1',
                    name: 'Task 1',
                    type: 'task',
                    dependencies: [],
                    metadata: {}
                  }
                ],
                priority: 1
              },
              {
                id: 'branch2',
                name: 'Branch 2',
                condition: { type: 'expression', expression: 'true' },
                steps: [
                  {
                    id: 'task2',
                    name: 'Task 2',
                    type: 'task',
                    dependencies: [],
                    metadata: {}
                  }
                ],
                priority: 2
              }
            ],
            loop: {
              type: 'for',
              maxConcurrency: 2,
              maxIterations: 2
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 300));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['parallel'].output.type).toBe('parallel');
      expect(execution!.stepResults['parallel'].output.branches).toBe(2);
      expect(execution!.stepResults['parallel'].output.successful).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should execute try-catch workflow', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Try-Catch Workflow',
        steps: [
          {
            id: 'try-catch',
            name: 'Try-Catch',
            type: 'try-catch',
            branches: [
              {
                id: 'try',
                name: 'try',
                condition: { type: 'expression', expression: 'true' },
                steps: [
                  {
                    id: 'risky-task',
                    name: 'Risky Task',
                    type: 'task',
                    dependencies: [],
                    metadata: {}
                  }
                ],
                priority: 1
              },
              {
                id: 'catch',
                name: 'catch',
                condition: { type: 'expression', expression: 'true' },
                steps: [
                  {
                    id: 'error-handler',
                    name: 'Error Handler',
                    type: 'task',
                    dependencies: [],
                    metadata: {}
                  }
                ],
                priority: 2
              },
              {
                id: 'finally',
                name: 'finally',
                condition: { type: 'expression', expression: 'true' },
                steps: [
                  {
                    id: 'cleanup-task',
                    name: 'Cleanup Task',
                    type: 'task',
                    dependencies: [],
                    metadata: {}
                  }
                ],
                priority: 3
              }
            ],
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['try-catch'].output.type).toBe('try-catch');
      expect(execution!.stepResults['try-catch'].output.executedFinally).toBe(true);
    });

    it('should handle step retry on failure', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Retry Workflow',
        globalErrorHandling: {
          strategy: 'retry',
          maxRetries: 2,
          retryDelay: 100,
          retryBackoff: 'linear'
        },
        steps: [
          {
            id: 'failing-step',
            name: 'Failing Step',
            type: 'task',
            dependencies: [],
            metadata: {}
          }
        ]
      });

      // Mock a failing task
      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['failing-step']).toBeDefined();
    });
  });

  describe('Dynamic Task Generation', () => {
    it('should execute dynamic task step', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Dynamic Task Workflow',
        steps: [
          {
            id: 'dynamic',
            name: 'Dynamic Task Generator',
            type: 'dynamic-task',
            dynamicTaskConfig: {
              taskGenerator: 'expression',
              generator: 'count * 2',
              parameters: { count: 2 }
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['dynamic'].output.type).toBe('dynamic-task');
      expect(execution!.stepResults['dynamic'].output.generatedTasks).toBeGreaterThan(0);
    });

    it('should generate tasks from template', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Template-based Dynamic Workflow',
        steps: [
          {
            id: 'template-dynamic',
            name: 'Template Task Generator',
            type: 'dynamic-task',
            dynamicTaskConfig: {
              taskGenerator: 'template',
              generator: 'data-processing',
              parameters: {}
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['template-dynamic'].output.type).toBe('dynamic-task');
      expect(execution!.stepResults['template-dynamic'].output.generatedTasks).toBe(3); // data-processing template has 3 tasks
    });
  });

  describe('Dynamic Workflow Modification', () => {
    it('should add dynamic step to running workflow', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Modifiable Workflow',
        steps: [
          {
            id: 'initial-step',
            name: 'Initial Step',
            type: 'task',
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Add dynamic step
      const dynamicStepId = await engine.addDynamicStep(executionId, {
        name: 'Dynamic Step',
        type: 'task',
        command: 'dynamic command'
      }, 'initial-step');

      expect(dynamicStepId).toBeDefined();
      expect(dynamicStepId).toContain('dynamic-step');

      const workflow = engine.getWorkflow(workflowId);
      expect(workflow!.steps).toHaveLength(2);
      expect(workflow!.steps[1].metadata.dynamic).toBe(true);
    });

    it('should remove step from workflow', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Removable Workflow',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'task',
            dependencies: [],
            metadata: {}
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: 'task',
            dependencies: ['step1'],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Remove step before it executes
      await engine.removeStep(executionId, 'step2');

      const workflow = engine.getWorkflow(workflowId);
      expect(workflow!.steps).toHaveLength(1);
      expect(workflow!.steps[0].id).toBe('step1');
    });

    it('should pause and resume workflow execution', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Pausable Workflow',
        steps: [
          {
            id: 'long-step',
            name: 'Long Running Step',
            type: 'task',
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Pause execution
      await engine.pauseExecution(executionId);
      
      let execution = engine.getExecution(executionId);
      expect(execution!.status).toBe('paused');
      expect(execution!.pausedAt).toBeDefined();

      // Resume execution
      await engine.resumeExecution(executionId);
      
      execution = engine.getExecution(executionId);
      expect(execution!.status).toBe('running');
      expect(execution!.pausedAt).toBeUndefined();
    });
  });

  describe('Advanced Conditions', () => {
    it('should evaluate expression conditions', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Expression Condition Workflow',
        steps: [
          {
            id: 'complex-condition',
            name: 'Complex Condition Step',
            type: 'task',
            condition: {
              type: 'expression',
              expression: 'value > 10 && status === "active"'
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId, {
        value: 15,
        status: 'active'
      });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['complex-condition'].status).toBe('completed');
    });

    it('should evaluate function conditions', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Function Condition Workflow',
        steps: [
          {
            id: 'function-condition',
            name: 'Function Condition Step',
            type: 'task',
            condition: {
              type: 'function',
              function: 'hasRequiredData'
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId, {
        data: { required: true }
      });

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['function-condition'].status).toBe('completed');
    });

    it('should handle condition evaluation failures with fallback', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Fallback Condition Workflow',
        steps: [
          {
            id: 'fallback-condition',
            name: 'Fallback Condition Step',
            type: 'task',
            condition: {
              type: 'expression',
              expression: 'nonexistent.property.value',
              fallback: true
            },
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      expect(execution!.stepResults['fallback-condition'].status).toBe('completed');
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track execution performance metrics', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Performance Tracking Workflow',
        steps: [
          {
            id: 'timed-step',
            name: 'Timed Step',
            type: 'task',
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 150));

      const execution = engine.getExecution(executionId);
      expect(execution!.performance.totalDuration).toBeGreaterThan(0);
      expect(execution!.performance.stepDurations['timed-step']).toBeGreaterThan(0);
      expect(execution!.stepResults['timed-step'].duration).toBeGreaterThan(0);
    });

    it('should maintain execution logs', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Logged Workflow',
        steps: [
          {
            id: 'logged-step',
            name: 'Logged Step',
            type: 'task',
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      expect(execution!.logs.length).toBeGreaterThan(0);
      expect(execution!.logs.some(log => log.message.includes('Starting workflow execution'))).toBe(true);
      expect(execution!.stepResults['logged-step'].logs.length).toBeGreaterThan(0);
    });

    it('should emit workflow events', async () => {
      const events: string[] = [];
      
      engine.on('execution:started', () => events.push('started'));
      engine.on('step:completed', () => events.push('step-completed'));
      engine.on('execution:completed', () => events.push('completed'));

      const workflowId = await engine.createWorkflow({
        name: 'Event Emitting Workflow',
        steps: [
          {
            id: 'event-step',
            name: 'Event Step',
            type: 'task',
            dependencies: [],
            metadata: {}
          }
        ]
      });

      await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(events).toContain('started');
      expect(events).toContain('step-completed');
      expect(events).toContain('completed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle workflow not found', async () => {
      await expect(
        engine.executeWorkflow('nonexistent-workflow')
      ).rejects.toThrow('Workflow not found');
    });

    it('should handle invalid step types gracefully', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Invalid Step Workflow',
        steps: [
          {
            id: 'invalid-step',
            name: 'Invalid Step',
            type: 'unknown-type' as any,
            dependencies: [],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      expect(execution!.status).toBe('failed');
    });

    it('should handle circular dependencies', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Circular Dependencies Workflow',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            type: 'task',
            dependencies: ['step2'],
            metadata: {}
          },
          {
            id: 'step2',
            name: 'Step 2',
            type: 'task',
            dependencies: ['step1'],
            metadata: {}
          }
        ]
      });

      const executionId = await engine.executeWorkflow(workflowId);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = engine.getExecution(executionId);
      // Both steps should remain pending due to circular dependencies
      expect(execution!.stepResults['step1']).toBeUndefined();
      expect(execution!.stepResults['step2']).toBeUndefined();
    });

    it('should handle concurrent executions', async () => {
      const workflowId = await engine.createWorkflow({
        name: 'Concurrent Workflow',
        steps: [
          {
            id: 'concurrent-step',
            name: 'Concurrent Step',
            type: 'task',
            dependencies: [],
            metadata: {}
          }
        ]
      });

      // Start multiple executions concurrently
      const executionPromises = [
        engine.executeWorkflow(workflowId, { instance: 1 }),
        engine.executeWorkflow(workflowId, { instance: 2 }),
        engine.executeWorkflow(workflowId, { instance: 3 })
      ];

      const executionIds = await Promise.all(executionPromises);

      expect(executionIds).toHaveLength(3);
      expect(new Set(executionIds).size).toBe(3); // All should be unique

      // Wait for executions
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check all executions completed
      executionIds.forEach(id => {
        const execution = engine.getExecution(id);
        expect(execution!.status).toBe('completed');
      });
    });
  });
}); 