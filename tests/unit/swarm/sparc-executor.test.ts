/**
 * Unit tests for SPARC Task Executor
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SparcTaskExecutor, SparcExecutorConfig } from '../../../src/swarm/sparc-executor.js';
import { TaskDefinition, AgentState, TaskResult } from '../../../src/swarm/types.js';
import { Logger } from '../../../src/core/logger.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('../../core/logger.ts');

describe('SparcTaskExecutor', () => {
  let executor: SparcTaskExecutor;
  let mockLogger: jest.Mocked<Logger>;
  let mockTask: TaskDefinition;
  let mockAgent: AgentState;
  let tempDir: string;

  beforeEach(() => {
    // Setup mocks
    mockLogger = new Logger({
    level: 'debug',
    format: 'json',
    destination: 'console'
  }) as jest.Mocked<Logger>;
    mockLogger.info = jest.fn();
    mockLogger.error = jest.fn();

    // Create temp dir for tests
    tempDir = '/tmp/sparc-test';
    
    // Initialize executor with mocked dependencies
    const config: SparcExecutorConfig = {
      logger: mockLogger,
      enableTDD: true,
      qualityThreshold: 0.8,
      enableMemory: true
    };
    
    executor = new SparcTaskExecutor(config);

    // Mock task and agent
    mockTask = {
      id: { 
        id: 'task-123', 
        swarmId: 'swarm-1', 
        sequence: 1,
        priority: 4
      },
      name: 'Test Task',
      description: 'A test task for the SPARC executor',
      type: 'coding',
      priority: 'high',
      status: 'queued',
      requirements: { capabilities: [], tools: [], permissions: [] },
      constraints: { dependencies: [], dependents: [], conflicts: [] },
      assignedTo: { 
        id: 'agent-456', 
        swarmId: 'swarm-1',
        type: 'developer',
        instance: 1
      },
      input: {},
      instructions: 'Complete the test task',
      context: {},
      attempts: [],
      statusHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    } as TaskDefinition;

    mockAgent = {
      id: { 
        id: 'agent-456', 
        swarmId: 'swarm-1',
        type: 'developer',
        instance: 1
      },
      name: 'Test Agent',
      type: 'developer',
      status: 'idle',
      capabilities: {
        codeGeneration: true,
        codeReview: false,
        testing: false,
        documentation: false,
        research: false,
        analysis: false,
        webSearch: false,
        apiIntegration: false,
        fileSystem: true,
        terminalAccess: false,
        languages: ['typescript'],
        frameworks: ['react'],
        domains: [],
        tools: [],
        maxConcurrentTasks: 3,
        maxMemoryUsage: 512,
        maxExecutionTime: 300000,
        reliability: 1.0,
        speed: 1.0,
        quality: 0.8
      },
      metrics: {} as any,
      workload: 0,
      health: 1.0,
      config: {} as any,
      environment: {} as any,
      endpoints: [],
      lastHeartbeat: new Date(),
      taskHistory: [],
      errorHistory: [],
      childAgents: [],
      collaborators: []
    } as AgentState;

    // Reset all mocks
    jest.resetAllMocks();

    // Mock fs.mkdir to succeed
    (fs.mkdir as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('constructor initializes with default values when no config is provided', () => {
    const defaultExecutor = new SparcTaskExecutor();
    
    expect(defaultExecutor).toBeInstanceOf(SparcTaskExecutor);
    // We can't directly test private properties, but we can test their effects through methods
  });

  test('constructor initializes with provided config values', () => {
    const config: SparcExecutorConfig = {
      logger: mockLogger,
      enableTDD: false,
      qualityThreshold: 0.9,
      enableMemory: false
    };
    
    const configuredExecutor = new SparcTaskExecutor(config);
    expect(configuredExecutor).toBeInstanceOf(SparcTaskExecutor);
  });

  test('executeTask logs the start of execution', async () => {
    // Mock executeSparcPhase to avoid testing all internal logic
    jest.spyOn(executor as any, 'executeSparcPhase').mockResolvedValue({
      phase: 'test',
      artifacts: { test: 'artifact' },
      quality: 0.9
    });
    
    await executor.executeTask(mockTask, mockAgent, tempDir);
    
    expect(mockLogger.info).toHaveBeenCalledWith('Executing SPARC-enhanced task', {
      taskId: mockTask.id.id,
      taskName: mockTask.name,
      agentType: mockAgent.type,
      targetDir: tempDir
    });
  });

  test('executeTask creates target directory if provided', async () => {
    // Mock executeSparcPhase to avoid testing all internal logic
    jest.spyOn(executor as any, 'executeSparcPhase').mockResolvedValue({
      phase: 'test',
      artifacts: { test: 'artifact' },
      quality: 0.9
    });
    
    await executor.executeTask(mockTask, mockAgent, tempDir);
    
    expect(fs.mkdir).toHaveBeenCalledWith(tempDir, { recursive: true });
  });

  test('executeTask does not create directory if not provided', async () => {
    // Mock executeSparcPhase to avoid testing all internal logic
    jest.spyOn(executor as any, 'executeSparcPhase').mockResolvedValue({
      phase: 'test',
      artifacts: { test: 'artifact' },
      quality: 0.9
    });
    
    await executor.executeTask(mockTask, mockAgent);
    
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  test('executeTask returns correct result structure', async () => {
    // Mock executeSparcPhase to avoid testing all internal logic
    jest.spyOn(executor as any, 'executeSparcPhase').mockResolvedValue({
      phase: 'test',
      artifacts: { test: 'artifact' },
      quality: 0.9,
      completeness: 0.95
    });
    
    const result = await executor.executeTask(mockTask, mockAgent);
    
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('artifacts');
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('quality');
    expect(result).toHaveProperty('completeness');
    expect(result).toHaveProperty('accuracy');
    expect(result).toHaveProperty('executionTime');
    expect(result).toHaveProperty('resourcesUsed');
    expect(result).toHaveProperty('validated');
    
    expect(result.metadata).toHaveProperty('agentId', mockAgent.id.id);
    expect(result.metadata).toHaveProperty('agentType', mockAgent.type);
    expect(result.metadata).toHaveProperty('sparcPhase', 'test');
  });

  test('executeTask handles errors properly', async () => {
    // Mock executeSparcPhase to throw an error
    const error = new Error('Test error');
    jest.spyOn(executor as any, 'executeSparcPhase').mockRejectedValue(error);
    
    await expect(executor.executeTask(mockTask, mockAgent)).rejects.toThrow(error);
    
    expect(mockLogger.error).toHaveBeenCalledWith('SPARC task execution failed', {
      taskId: mockTask.id.id,
      error: error.message
    });
  });

  test('executeSparcPhase selects correct phase based on agent type and task', async () => {
    // Test with analyzer agent
    const analyzerAgent = { ...mockAgent, type: 'analyzer' };
    const specPhase = jest.spyOn(executor as any, 'executeSpecificationPhase').mockResolvedValue({});
    const analysisPhase = jest.spyOn(executor as any, 'executeAnalysisPhase').mockResolvedValue({});
    
    // Task with "Requirements" in name should trigger specification phase
    await (executor as any).executeSparcPhase({ ...mockTask, name: 'Requirements Analysis' }, analyzerAgent);
    expect(specPhase).toHaveBeenCalled();
    
    // Regular task should trigger analysis phase
    await (executor as any).executeSparcPhase(mockTask, analyzerAgent);
    expect(analysisPhase).toHaveBeenCalled();
  });

  test('executeSparcPhase selects TDD phase when enabled for implementation tasks', async () => {
    // Setup mocks
    const tddPhase = jest.spyOn(executor as any, 'executeTDDPhase').mockResolvedValue({});
    const implPhase = jest.spyOn(executor as any, 'executeImplementationPhase').mockResolvedValue({});
    
    // Task with "Implement" in name should trigger TDD phase when TDD is enabled
    const implementTask = { ...mockTask, name: 'Implement Feature' };
    await (executor as any).executeSparcPhase(implementTask, mockAgent);
    
    expect(tddPhase).toHaveBeenCalled();
    expect(implPhase).not.toHaveBeenCalled();
  });

  test('determineAppType correctly identifies application types', () => {
    const appTypes = [
      { desc: 'Build a REST API for user management', expected: 'rest-api' },
      { desc: 'Create a Flask application', expected: 'python-web' },
      { desc: 'Implement a pandas data processing pipeline', expected: 'data-pipeline' },
      { desc: 'Develop a machine learning model', expected: 'ml-app' },
      { desc: 'Build a CLI tool', expected: 'cli-tool' },
      { desc: 'Create a web scraper', expected: 'web-scraper' },
      { desc: 'Implement a analytics dashboard', expected: 'dashboard' },
      { desc: 'Generic application', expected: 'generic' }
    ];
    
    appTypes.forEach(({ desc, expected }) => {
      const result = (executor as any).determineAppType(desc);
      expect(result).toBe(expected);
    });
  });

  test('detectLanguage correctly identifies programming languages', () => {
    const languages = [
      { desc: 'Build a Python application', expected: 'python' },
      { desc: 'Create a TypeScript React app', expected: 'typescript' },
      { desc: 'Implement a Java Spring Boot service', expected: 'java' },
      { desc: 'Build something', expected: 'javascript' } // default
    ];
    
    languages.forEach(({ desc, expected }) => {
      const result = (executor as any).detectLanguage(desc);
      expect(result).toBe(expected);
    });
  });

  test('executeSpecificationPhase creates files in target directory when provided', async () => {
    // Mock file writing functions
    const formatRequirementsMock = jest.spyOn(executor as any, 'formatRequirements').mockReturnValue('requirements');
    const formatUserStoriesMock = jest.spyOn(executor as any, 'formatUserStories').mockReturnValue('user stories');
    const formatAcceptanceCriteriaMock = jest.spyOn(executor as any, 'formatAcceptanceCriteria').mockReturnValue('criteria');
    
    // Execute the phase with a target directory
    await (executor as any).executeSpecificationPhase(mockTask, tempDir);
    
    // Check that the directory was created
    const specsDir = path.join(tempDir, 'specs');
    expect(fs.mkdir).toHaveBeenCalledWith(specsDir, { recursive: true });
    
    // Check that the files were written
    expect(fs.writeFile).toHaveBeenCalledTimes(3);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(specsDir, 'requirements.md'), 'requirements');
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(specsDir, 'user-stories.md'), 'user stories');
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(specsDir, 'acceptance-criteria.md'), 'criteria');
  });

  test('executeSpecificationPhase returns correctly structured results', async () => {
    // Mock methods used in the phase
    jest.spyOn(executor as any, 'determineAppType').mockReturnValue('test-app');
    jest.spyOn(executor as any, 'generateRequirements').mockReturnValue('requirements');
    jest.spyOn(executor as any, 'generateUserStories').mockReturnValue('user stories');
    jest.spyOn(executor as any, 'generateAcceptanceCriteria').mockReturnValue('criteria');
    jest.spyOn(executor as any, 'identifyConstraints').mockReturnValue('constraints');
    
    // Execute the phase without a target directory
    const result = await (executor as any).executeSpecificationPhase(mockTask);
    
    // Check the structure of the result
    expect(result).toHaveProperty('phase', 'specification');
    expect(result).toHaveProperty('requirements', 'requirements');
    expect(result).toHaveProperty('userStories', 'user stories');
    expect(result).toHaveProperty('acceptanceCriteria', 'criteria');
    expect(result).toHaveProperty('constraints', 'constraints');
    expect(result).toHaveProperty('quality');
    expect(result).toHaveProperty('completeness');
  });
});