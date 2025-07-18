import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import PipelineHooksSystem, { 
  HookDefinition, 
  HookContext, 
  HookResult, 
  PipelinePhase, 
  HookEvent,
  PipelineWorkflow
} from '../../../../../src/cli/pipeline/hooks/pipeline-hooks-system';
import { Logger } from '../../../../../src/core/logger';
import { writeFile, mkdir } from 'fs/promises';

// Mock dependencies
jest.mock('../../../../../src/core/logger');
jest.mock('fs/promises');

describe('PipelineHooksSystem', () => {
  let hooksSystem: PipelineHooksSystem;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    hooksSystem = new PipelineHooksSystem({ initializeBuiltInHooks: false });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('hook registration', () => {
    it('should register a new hook successfully', async () => {
      const hook: HookDefinition = {
        id: 'test-hook',
        name: 'Test Hook',
        description: 'A test hook for validation',
        phase: 'discovery',
        event: 'before_phase',
        priority: 100,
        async: true,
        implementation: async (context: HookContext): Promise<HookResult> => ({
          success: true,
          data: { processed: true }
        })
      };

      await hooksSystem.registerHook(hook);

      expect(mockLogger.info).toHaveBeenCalledWith('Registering pipeline hook', {
        hookId: 'test-hook',
        phase: 'discovery',
        event: 'before_phase'
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Pipeline hook registered successfully', {
        hookId: 'test-hook'
      });

      const registeredHooks = hooksSystem.listHooks();
      const testHook = registeredHooks.find(h => h.id === 'test-hook');
      expect(testHook).toBeDefined();
      expect(testHook?.name).toBe('Test Hook');
    });

    it('should prevent duplicate hook registration', async () => {
      const hook: HookDefinition = {
        id: 'duplicate-hook',
        name: 'Duplicate Hook',
        description: 'A duplicate hook',
        phase: 'design',
        event: 'after_phase',
        priority: 80,
        async: true,
        implementation: async () => ({ success: true })
      };

      await hooksSystem.registerHook(hook);
      
      await expect(hooksSystem.registerHook(hook)).rejects.toThrow(
        'Hook with id \'duplicate-hook\' already exists'
      );
    });

    it('should validate hook definition requirements', async () => {
      const invalidHook = {
        name: 'Invalid Hook'
        // Missing required fields
      } as HookDefinition;

      await expect(hooksSystem.registerHook(invalidHook)).rejects.toThrow(
        'Hook must have id, name, and implementation'
      );
    });

    it('should validate hook implementation is a function', async () => {
      const invalidHook: HookDefinition = {
        id: 'invalid-impl',
        name: 'Invalid Implementation',
        description: 'Hook with invalid implementation',
        phase: 'validation',
        event: 'before_phase',
        priority: 50,
        async: true,
        implementation: 'not a function' as any
      };

      await expect(hooksSystem.registerHook(invalidHook)).rejects.toThrow(
        'Hook implementation must be a function'
      );
    });
  });

  describe('hook execution', () => {
    beforeEach(async () => {
      // Register test hooks
      await hooksSystem.registerHook({
        id: 'validation-hook',
        name: 'Validation Hook',
        description: 'Validates data before processing',
        phase: 'validation',
        event: 'before_phase',
        priority: 100,
        async: true,
        implementation: async (context: HookContext): Promise<HookResult> => ({
          success: true,
          data: { validated: true },
          recommendations: ['Data validation passed']
        })
      });

      await hooksSystem.registerHook({
        id: 'performance-hook',
        name: 'Performance Hook',
        description: 'Monitors performance metrics',
        phase: 'all',
        event: 'after_phase',
        priority: 80,
        async: true,
        implementation: async (context: HookContext): Promise<HookResult> => ({
          success: true,
          data: { 
            duration: 150,
            memoryUsage: 4.2 
          },
          recommendations: ['Performance is within acceptable limits']
        })
      });
    });

    it('should execute hooks for specific phase and event', async () => {
      const results = await hooksSystem.executeHooks('validation', 'before_phase', {
        pipelineId: 'test-pipeline',
        data: { inputData: 'test' }
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].data?.validated).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Executing pipeline hooks', expect.objectContaining({
        phase: 'validation',
        event: 'before_phase',
        pipelineId: 'test-pipeline'
      }));
    });

    it('should execute all applicable hooks including global ones', async () => {
      const results = await hooksSystem.executeHooks('validation', 'after_phase', {
        pipelineId: 'test-pipeline',
        data: { processed: true }
      });

      // Should execute the 'all' phase performance hook
      expect(results).toHaveLength(1);
      expect(results[0].data?.duration).toBe(150);
    });

    it('should handle hook execution errors gracefully', async () => {
      await hooksSystem.registerHook({
        id: 'failing-hook',
        name: 'Failing Hook',
        description: 'A hook that always fails',
        phase: 'extraction',
        event: 'before_phase',
        priority: 50,
        async: true,
        implementation: async (): Promise<HookResult> => {
          throw new Error('Hook execution failed');
        }
      });

      const results = await hooksSystem.executeHooks('extraction', 'before_phase', {
        pipelineId: 'test-pipeline'
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errors).toContain('Hook execution failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Hook execution failed', expect.any(Object));
    });

    it('should execute hooks in priority order', async () => {
      const executionOrder: string[] = [];

      await hooksSystem.registerHook({
        id: 'low-priority',
        name: 'Low Priority Hook',
        description: 'Low priority hook',
        phase: 'loading',
        event: 'before_phase',
        priority: 30,
        async: true,
        implementation: async (): Promise<HookResult> => {
          executionOrder.push('low-priority');
          return { success: true };
        }
      });

      await hooksSystem.registerHook({
        id: 'high-priority',
        name: 'High Priority Hook',
        description: 'High priority hook',
        phase: 'loading',
        event: 'before_phase',
        priority: 90,
        async: true,
        implementation: async (): Promise<HookResult> => {
          executionOrder.push('high-priority');
          return { success: true };
        }
      });

      await hooksSystem.executeHooks('loading', 'before_phase', {
        pipelineId: 'test-pipeline'
      });

      expect(executionOrder).toEqual(['high-priority', 'low-priority']);
    });

    it('should update context with successful hook results', async () => {
      await hooksSystem.registerHook({
        id: 'context-updater',
        name: 'Context Updater',
        description: 'Updates context data',
        phase: 'transformation',
        event: 'before_phase',
        priority: 100,
        async: true,
        implementation: async (context: HookContext): Promise<HookResult> => ({
          success: true,
          data: { 
            originalData: context.data,
            enhanced: true,
            timestamp: new Date().toISOString()
          }
        })
      });

      const results = await hooksSystem.executeHooks('transformation', 'before_phase', {
        pipelineId: 'test-pipeline',
        data: { initial: 'value' }
      });

      expect(results[0].success).toBe(true);
      expect(results[0].data?.enhanced).toBe(true);
      // originalData is a circular reference to the context data
      expect(results[0].data?.originalData).toBeTruthy();
    });
  });

  describe('workflow management', () => {
    it('should create a new workflow successfully', async () => {
      const phases: PipelinePhase[] = ['discovery', 'design', 'extraction'];
      const metadata = { project: 'test-project', user: 'test-user' };

      const workflowId = await hooksSystem.createWorkflow(phases, metadata);

      expect(workflowId).toMatch(/^hook-\d+-[a-z0-9]+$/);
      expect(mockLogger.info).toHaveBeenCalledWith('Pipeline workflow created', {
        workflowId,
        phases
      });

      const workflow = hooksSystem.getWorkflowStatus(workflowId);
      expect(workflow).toBeDefined();
      expect(workflow?.phases).toHaveLength(3);
      expect(workflow?.metadata).toEqual(metadata);
    });

    it('should execute complete workflow with hooks', async () => {
      const phases: PipelinePhase[] = ['discovery', 'design'];
      const workflowId = await hooksSystem.createWorkflow(phases);

      const completedWorkflow = await hooksSystem.executeWorkflow(workflowId, {
        discovery: { data: 'discovery-data' },
        design: { data: 'design-data' }
      });

      expect(completedWorkflow.phases.every(p => p.status === 'completed')).toBe(true);
      expect(completedWorkflow.phases.every(p => p.startTime && p.endTime)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting pipeline workflow execution', {
        workflowId
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Pipeline workflow completed successfully', {
        workflowId
      });
    });

    it('should handle workflow execution errors', async () => {
      // Mock the simulatePhaseExecution method to throw an error for the 'design' phase
      const simulatePhaseExecution = jest.spyOn(
        hooksSystem as any, 
        'simulatePhaseExecution'
      ).mockImplementation(function(this: any, phase: any) {
        if (phase === 'design') {
          throw new Error('Phase execution failed');
        }
        return Promise.resolve();
      });

      const phases: PipelinePhase[] = ['discovery', 'design'];
      const workflowId = await hooksSystem.createWorkflow(phases);

      await expect(hooksSystem.executeWorkflow(workflowId)).rejects.toThrow();

      const workflow = hooksSystem.getWorkflowStatus(workflowId);
      const failedPhase = workflow?.phases.find(p => p.phase === 'design');
      expect(failedPhase?.status).toBe('failed');
      
      // Clean up mock
      simulatePhaseExecution.mockRestore();
    });

    it('should return undefined for non-existent workflow', () => {
      const nonExistentWorkflow = hooksSystem.getWorkflowStatus('non-existent-id');
      expect(nonExistentWorkflow).toBeUndefined();
    });

    it('should throw error for non-existent workflow execution', async () => {
      await expect(hooksSystem.executeWorkflow('non-existent-id')).rejects.toThrow(
        'Workflow not found: non-existent-id'
      );
    });
  });

  describe('hook execution results', () => {
    it('should retrieve hook execution results for specific pipeline and phase', async () => {
      const pipelineId = 'test-pipeline';
      
      await hooksSystem.executeHooks('validation', 'before_phase', {
        pipelineId,
        data: { test: 'data' }
      });

      const results = hooksSystem.getHookExecutions(pipelineId, 'validation', 'before_phase');
      expect(results).toHaveLength(0); // No hooks registered for this specific case
    });

    it('should retrieve all hook executions for a pipeline', async () => {
      const pipelineId = 'comprehensive-test-pipeline';
      
      // Execute hooks for multiple phases
      await hooksSystem.executeHooks('discovery', 'before_phase', { pipelineId });
      await hooksSystem.executeHooks('design', 'after_phase', { pipelineId });

      const allResults = hooksSystem.getHookExecutions(pipelineId);
      expect(allResults).toBeDefined();
    });
  });

  describe('hook listing and filtering', () => {
    beforeEach(async () => {
      await hooksSystem.registerHook({
        id: 'discovery-hook',
        name: 'Discovery Hook',
        description: 'Hook for discovery phase',
        phase: 'discovery',
        event: 'before_phase',
        priority: 100,
        async: true,
        implementation: async () => ({ success: true })
      });

      await hooksSystem.registerHook({
        id: 'global-hook',
        name: 'Global Hook',
        description: 'Hook for all phases',
        phase: 'all',
        event: 'after_phase',
        priority: 80,
        async: true,
        implementation: async () => ({ success: true })
      });
    });

    it('should list all registered hooks', () => {
      const allHooks = hooksSystem.listHooks();
      // Just check the hooks we registered in the test
      expect(allHooks.length).toBe(2); 
      
      const hookIds = allHooks.map(h => h.id);
      expect(hookIds).toContain('discovery-hook');
      expect(hookIds).toContain('global-hook');
    });

    it('should filter hooks by phase', () => {
      const discoveryHooks = hooksSystem.listHooks('discovery');
      expect(discoveryHooks.some(h => h.id === 'discovery-hook')).toBe(true);
      expect(discoveryHooks.some(h => h.phase === 'all')).toBe(true); // Global hooks included
    });

    it('should filter hooks by event', () => {
      const beforePhaseHooks = hooksSystem.listHooks(undefined, 'before_phase');
      expect(beforePhaseHooks.some(h => h.event === 'before_phase')).toBe(true);
      expect(beforePhaseHooks.every(h => h.event === 'before_phase')).toBe(true);
    });

    it('should filter hooks by both phase and event', () => {
      const specificHooks = hooksSystem.listHooks('discovery', 'before_phase');
      expect(specificHooks.some(h => h.id === 'discovery-hook')).toBe(true);
      // Should not include global hooks with different events
      expect(specificHooks.every(h => h.event === 'before_phase')).toBe(true);
    });
  });

  describe('hook unregistration', () => {
    it('should unregister existing hook', async () => {
      await hooksSystem.registerHook({
        id: 'removable-hook',
        name: 'Removable Hook',
        description: 'A hook that can be removed',
        phase: 'monitoring',
        event: 'before_phase',
        priority: 60,
        async: true,
        implementation: async () => ({ success: true })
      });

      let hooks = hooksSystem.listHooks();
      expect(hooks.some(h => h.id === 'removable-hook')).toBe(true);

      await hooksSystem.unregisterHook('removable-hook');

      hooks = hooksSystem.listHooks();
      expect(hooks.some(h => h.id === 'removable-hook')).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Hook unregistered', { hookId: 'removable-hook' });
    });

    it('should handle unregistering non-existent hook', async () => {
      await hooksSystem.unregisterHook('non-existent-hook');
      // Should not throw error or log anything for non-existent hooks
    });
  });

  describe('hooks configuration persistence', () => {
    it('should save hooks configuration to file', async () => {
      (mkdir as jest.MockedFunction<typeof mkdir>).mockResolvedValue(undefined);
      (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

      const filePath = './test-hooks-config.json';
      await hooksSystem.saveHooksConfig(filePath);

      expect(mkdir).toHaveBeenCalledWith('.', { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(filePath, expect.stringContaining('"hooks"'));
      expect(mockLogger.info).toHaveBeenCalledWith('Hooks configuration saved', { filePath });
    });

    it('should handle file save errors', async () => {
      (mkdir as jest.MockedFunction<typeof mkdir>).mockRejectedValue(new Error('Permission denied'));

      const filePath = './restricted/hooks-config.json';
      
      await expect(hooksSystem.saveHooksConfig(filePath)).rejects.toThrow('Permission denied');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to save hooks configuration', 
        expect.objectContaining({ filePath })
      );
    });
  });

  describe('built-in hooks', () => {
    it('should initialize built-in hooks on construction', () => {
      // Create a new instance with built-in hooks
      const hooksSystemWithBuiltIns = new PipelineHooksSystem();
      const builtInHooks = hooksSystemWithBuiltIns.listHooks();
      
      // Check for expected built-in hooks
      const hookIds = builtInHooks.map(h => h.id);
      expect(hookIds).toContain('data-quality-validation');
      expect(hookIds).toContain('compliance-validation');
      expect(hookIds).toContain('performance-monitoring');
      expect(hookIds).toContain('data-lineage-tracking');
    });

    it('should execute data quality validation hook', async () => {
      const hooksSystemWithBuiltIns = new PipelineHooksSystem();
      const results = await hooksSystemWithBuiltIns.executeHooks('validation', 'after_phase', {
        pipelineId: 'test-pipeline',
        data: { dataQuality: 96.5 }
      });

      const qualityHook = results.find(r => (r as any).hookId === 'data-quality-validation');
      expect(qualityHook).toBeDefined();
      expect(qualityHook?.success).toBeDefined();
    });

    it('should execute compliance validation hook', async () => {
      const hooksSystemWithBuiltIns = new PipelineHooksSystem();
      const results = await hooksSystemWithBuiltIns.executeHooks('design', 'before_phase', {
        pipelineId: 'test-pipeline',
        metadata: { environment: 'production' }
      });

      const complianceHook = results.find(r => (r as any).hookId === 'compliance-validation');
      expect(complianceHook).toBeDefined();
      expect(complianceHook?.data).toHaveProperty('complianceChecks');
    });

    it('should execute performance monitoring hook', async () => {
      const hooksSystemWithBuiltIns = new PipelineHooksSystem();
      const results = await hooksSystemWithBuiltIns.executeHooks('loading', 'after_phase', {
        pipelineId: 'test-pipeline'
      });

      const performanceHook = results.find(r => (r as any).hookId === 'performance-monitoring');
      expect(performanceHook).toBeDefined();
      expect(performanceHook?.data).toHaveProperty('performanceMetrics');
    });

    it('should execute data lineage tracking hook on phase transitions', async () => {
      const hooksSystemWithBuiltIns = new PipelineHooksSystem();
      const results = await hooksSystemWithBuiltIns.executeHooks('transformation', 'cross_phase_transition', {
        pipelineId: 'test-pipeline',
        data: {
          fromPhase: 'extraction',
          toPhase: 'transformation'
        }
      });

      const lineageHook = results.find(r => (r as any).hookId === 'data-lineage-tracking');
      expect(lineageHook).toBeDefined();
      expect(lineageHook?.data).toHaveProperty('lineageInfo');
    });
  });

  describe('hook conditions evaluation', () => {
    it('should execute hooks when conditions are met', async () => {
      await hooksSystem.registerHook({
        id: 'conditional-hook',
        name: 'Conditional Hook',
        description: 'Hook with execution conditions',
        phase: 'validation',
        event: 'before_phase',
        priority: 90,
        async: true,
        conditions: [
          { field: 'metadata.environment', operator: 'equals', value: 'production' }
        ],
        implementation: async () => ({ success: true, data: { conditional: true } })
      });

      // Should execute when condition is met
      const results1 = await hooksSystem.executeHooks('validation', 'before_phase', {
        pipelineId: 'test-pipeline',
        metadata: { environment: 'production' }
      });

      expect(results1.some(r => (r as any).hookId === 'conditional-hook')).toBe(true);

      // Should not execute when condition is not met
      const results2 = await hooksSystem.executeHooks('validation', 'before_phase', {
        pipelineId: 'test-pipeline',
        metadata: { environment: 'development' }
      });

      expect(results2.some(r => (r as any).hookId === 'conditional-hook')).toBe(false);
    });

    it('should handle different condition operators', async () => {
      await hooksSystem.registerHook({
        id: 'complex-conditions-hook',
        name: 'Complex Conditions Hook',
        description: 'Hook with multiple condition types',
        phase: 'loading',
        event: 'before_phase',
        priority: 85,
        async: true,
        conditions: [
          { field: 'data.recordCount', operator: 'greater_than', value: 1000 },
          { field: 'data.source', operator: 'contains', value: 'database' }
        ],
        implementation: async () => ({ success: true, data: { complexConditions: true } })
      });

      const results = await hooksSystem.executeHooks('loading', 'before_phase', {
        pipelineId: 'test-pipeline',
        data: {
          recordCount: 5000,
          source: 'database_primary'
        }
      });

      expect(results.some(r => (r as any).hookId === 'complex-conditions-hook')).toBe(true);
    });
  });

  describe('event emission', () => {
    it('should emit events during hook registration and execution', async () => {
      let registrationEvent: any = null;
      let executionEvent: any = null;

      hooksSystem.on('hook_registered', (event) => {
        registrationEvent = event;
      });

      hooksSystem.on('hook_executed', (event) => {
        executionEvent = event;
      });

      await hooksSystem.registerHook({
        id: 'event-test-hook',
        name: 'Event Test Hook',
        description: 'Hook for testing events',
        phase: 'monitoring',
        event: 'after_phase',
        priority: 70,
        async: true,
        implementation: async () => ({ success: true })
      });

      expect(registrationEvent).toEqual({
        hookId: 'event-test-hook',
        hook: expect.objectContaining({ id: 'event-test-hook' })
      });

      await hooksSystem.executeHooks('monitoring', 'after_phase', {
        pipelineId: 'test-pipeline'
      });

      expect(executionEvent).toEqual(expect.objectContaining({
        hookId: 'event-test-hook',
        phase: 'monitoring',
        event: 'after_phase'
      }));
    });
  });
}); 