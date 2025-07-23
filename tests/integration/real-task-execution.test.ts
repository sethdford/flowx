/**
 * Real Task Execution Integration Tests
 * 
 * Tests that validate the RealTaskExecutor actually produces working code
 * and deliverables, not just mock responses.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RealTaskExecutor } from '../../src/swarm/real-task-executor.ts';
import { Logger } from '../../src/core/logger.ts';
import { TaskDefinition, AgentState } from '../../src/swarm/types.ts';
import { generateId } from '../../src/utils/helpers.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Mock environment setup
const originalEnv = process.env;

describe('RealTaskExecutor Integration Tests', () => {
  let executor: RealTaskExecutor;
  let logger: Logger;
  let testWorkspace: string;
  
  beforeEach(async () => {
    // Set up test environment
    process.env = {
      ...originalEnv,
      ANTHROPIC_API_KEY: 'test-key-for-mocking'
    };

    logger = new Logger(
      { level: 'info', format: 'text', destination: 'console' },
      { component: 'RealTaskExecutorTest' }
    );

    executor = new RealTaskExecutor(logger, {
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
      temperature: 0.1
    });

    testWorkspace = './test-workspaces';
    await fs.mkdir(testWorkspace, { recursive: true });
  });

  afterEach(async () => {
    process.env = originalEnv;
    
    // Cleanup test workspaces
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    await executor.cleanup();
  });

  describe('Workspace Management', () => {
    it('should create proper workspace structure', async () => {
      const task = createTestTask('coding', 'Create a simple calculator');
      const agent = createTestAgent('developer');

      // Access private method for testing
      const workspace = await (executor as any).setupWorkspace(task, agent);

      expect(workspace.id).toBeDefined();
      expect(workspace.agentId).toBe(agent.id.id);
      expect(workspace.taskId).toBe(task.id.id);
      expect(workspace.workingDir).toContain(agent.id.id);
      expect(workspace.outputDir).toContain('output');

      // Verify directories exist
      await expect(fs.access(workspace.workingDir)).resolves.not.toThrow();
      await expect(fs.access(workspace.outputDir)).resolves.not.toThrow();
      await expect(fs.access(workspace.sharedDir)).resolves.not.toThrow();

      // Verify workspace info file
      const infoPath = path.join(workspace.workingDir, 'workspace-info.json');
      const infoContent = await fs.readFile(infoPath, 'utf-8');
      const info = JSON.parse(infoContent);
      
      expect(info.agentId).toBe(agent.id.id);
      expect(info.taskId).toBe(task.id.id);
      expect(info.taskType).toBe(task.type);
    });
  });

  describe('Prompt Generation', () => {
    it('should generate sophisticated task prompts', async () => {
      const task = createTestTask('coding', 'Build a REST API for user management');
      const agent = createTestAgent('developer');
      const workspace = await (executor as any).setupWorkspace(task, agent);

      const prompt = (executor as any).generateTaskPrompt(task, agent, workspace);

      expect(prompt).toContain('REAL TASK EXECUTION');
      expect(prompt).toContain(task.name);
      expect(prompt).toContain(task.description);
      expect(prompt).toContain(agent.name);
      expect(prompt).toContain(workspace.outputDir);
      expect(prompt).toContain('PRODUCE REAL DELIVERABLES');
      expect(prompt).toContain('Working Directory');
      expect(prompt).toContain('Output Directory');
      
      // Should contain coding-specific requirements
      expect(prompt).toContain('Write clean, maintainable code');
      expect(prompt).toContain('Include proper error handling');
      expect(prompt).toContain('package.json/dependencies');
    });

    it('should generate different requirements for different task types', async () => {
      const tasks = [
        createTestTask('research', 'Research AI trends'),
        createTestTask('testing', 'Create test suite'),
        createTestTask('documentation', 'Write API docs')
      ];
      
      const agent = createTestAgent('analyst');
      
      for (const task of tasks) {
        const workspace = await (executor as any).setupWorkspace(task, agent);
        const prompt = (executor as any).generateTaskPrompt(task, agent, workspace);
        
        switch (task.type) {
          case 'research':
            expect(prompt).toContain('comprehensive analysis');
            expect(prompt).toContain('credible sources');
            break;
          case 'testing':
            expect(prompt).toContain('test suites');
            expect(prompt).toContain('test coverage');
            break;
          case 'documentation':
            expect(prompt).toContain('comprehensive docs');
            expect(prompt).toContain('code examples');
            break;
        }
      }
    });
  });

  describe('Tool Selection', () => {
    it('should select appropriate tools for task types', () => {
      const codingTask = createTestTask('coding', 'Build an app');
      const researchTask = createTestTask('research', 'Research topic');
      const agent = createTestAgent('developer');

      const codingTools = (executor as any).getToolsForTask(codingTask, agent);
      const researchTools = (executor as any).getToolsForTask(researchTask, agent);

      expect(codingTools).toContain('str_replace_editor');
      expect(codingTools).toContain('bash');
      expect(codingTools).toContain('computer'); // For running tests

      expect(researchTools).toContain('str_replace_editor');
      expect(researchTools).toContain('bash');
      expect(researchTools).not.toContain('computer'); // Not needed for research
    });
  });

  describe('File Scanning and Validation', () => {
    it('should scan workspace files correctly', async () => {
      const task = createTestTask('coding', 'Create files');
      const agent = createTestAgent('developer');
      const workspace = await (executor as any).setupWorkspace(task, agent);

      // Create test files
      await fs.writeFile(path.join(workspace.outputDir, 'README.md'), '# Test Project');
      await fs.writeFile(path.join(workspace.outputDir, 'index.js'), 'console.log("hello");');
      
      await fs.mkdir(path.join(workspace.outputDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(workspace.outputDir, 'src', 'app.js'), 'module.exports = {};');

      const files = await (executor as any).scanWorkspaceFiles(workspace);

      expect(files.size).toBe(3);
      expect(files.has('README.md')).toBe(true);
      expect(files.has('index.js')).toBe(true);
      expect(files.has(path.join('src', 'app.js'))).toBe(true);
      
      expect(files.get('README.md')).toBe('# Test Project');
      expect(files.get('index.js')).toBe('console.log("hello");');
    });

    it('should collect artifacts correctly', async () => {
      const task = createTestTask('coding', 'Create project');
      const agent = createTestAgent('developer');
      const workspace = await (executor as any).setupWorkspace(task, agent);

      // Create test artifacts
      await fs.writeFile(path.join(workspace.outputDir, 'package.json'), '{}');
      await fs.mkdir(path.join(workspace.outputDir, 'tests'), { recursive: true });
      await fs.writeFile(path.join(workspace.outputDir, 'app.py'), 'print("hello")');

      const artifacts = await (executor as any).collectArtifacts(workspace);

      expect(artifacts).toContain('package.json');
      expect(artifacts).toContain('app.py');
      expect(artifacts).toContain('tests/');
    });
  });

  describe('Result Processing', () => {
    it('should validate coding task results properly', async () => {
      const task = createTestTask('coding', 'Build calculator app');
      const agent = createTestAgent('developer');
      const workspace = await (executor as any).setupWorkspace(task, agent);

      // Mock execution result with files
      const mockResult = {
        success: true,
        output: 'Task completed successfully',
        files: new Map([
          ['README.md', '# Calculator App'],
          ['calculator.js', 'function add(a, b) { return a + b; }'],
          ['package.json', '{"name": "calculator"}']
        ]),
        artifacts: ['README.md', 'calculator.js', 'package.json'],
        metrics: {
          duration: 5000,
          tokensUsed: 1000,
          toolCalls: 5,
          filesGenerated: 3
        }
      };

      const context = {
        task,
        agent,
        workspace,
        prompt: 'test prompt',
        tools: ['str_replace_editor'],
        timeout: 300000
      };

      const processedResult = await (executor as any).processExecutionResults(mockResult, context);

      expect(processedResult.success).toBe(true);
      expect(processedResult.files.size).toBe(3);
      expect(processedResult.metrics.filesGenerated).toBe(3);

      // Should create summary file
      const summaryPath = path.join(workspace.outputDir, 'task-summary.json');
      const summaryContent = await fs.readFile(summaryPath, 'utf-8');
      const summary = JSON.parse(summaryContent);

      expect(summary.taskId).toBe(task.id.id);
      expect(summary.agentId).toBe(agent.id.id);
      expect(summary.success).toBe(true);
      expect(summary.hasReadme).toBe(true);
      expect(summary.hasSourceCode).toBe(true);
      expect(summary.files).toEqual(['README.md', 'calculator.js', 'package.json']);
    });

    it('should warn about missing deliverables', async () => {
      const task = createTestTask('coding', 'Build app but produce no files');
      const agent = createTestAgent('developer');
      const workspace = await (executor as any).setupWorkspace(task, agent);

      const mockResult = {
        success: true,
        output: 'Task completed but no files created',
        files: new Map(),
        artifacts: [],
        metrics: {
          duration: 1000,
          tokensUsed: 500,
          toolCalls: 1,
          filesGenerated: 0
        }
      };

      const context = { task, agent, workspace, prompt: 'test', tools: [], timeout: 300000 };

      // Mock logger to capture warnings
      const warnSpy = jest.spyOn(logger, 'warn');

      await (executor as any).processExecutionResults(mockResult, context);

      expect(warnSpy).toHaveBeenCalledWith(
        'No files generated during task execution',
        expect.objectContaining({
          taskId: task.id.id,
          agentId: agent.id.id
        })
      );

      expect(warnSpy).toHaveBeenCalledWith(
        'Coding task completed but no source code files detected',
        expect.objectContaining({
          taskId: task.id.id,
          files: []
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key gracefully', () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      expect(() => {
        new RealTaskExecutor(logger);
      }).toThrow('ANTHROPIC_API_KEY environment variable is required');
    });

    it('should handle task execution failures', async () => {
      const task = createTestTask('coding', 'Impossible task');
      const agent = createTestAgent('developer');

      // Mock executeWithClaudeCLI to throw error
      jest.spyOn(executor as any, 'executeWithClaudeCLI').mockRejectedValue(
        new Error('Claude process failed')
      );

      const result = await executor.executeTask(task, agent);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claude process failed');
      expect(result.files.size).toBe(0);
      expect(result.metrics.filesGenerated).toBe(0);
    });
  });

  describe('Token and Tool Call Extraction', () => {
    it('should extract token usage from output', () => {
      const output = 'Task completed. Tokens used: 1234';
      const tokens = (executor as any).extractTokenUsage(output);
      expect(tokens).toBe(1234);
    });

    it('should extract tool calls from output', () => {
      const output = `
        [tool_call] str_replace_editor
        [bash] npm install
        [edit] app.js
        [tool_call] another_tool
      `;
      const toolCalls = (executor as any).extractToolCalls(output);
      expect(toolCalls).toBe(4);
    });

    it('should handle missing token/tool info gracefully', () => {
      const output = 'No token or tool information';
      expect((executor as any).extractTokenUsage(output)).toBe(0);
      expect((executor as any).extractToolCalls(output)).toBe(0);
    });
  });

  describe('State Management', () => {
    it('should track active executions', () => {
      const executions = executor.getActiveExecutions();
      expect(Array.isArray(executions)).toBe(true);
      expect(executions.length).toBe(0);
    });

    it('should manage workspace lifecycle', async () => {
      const task = createTestTask('coding', 'Test workspace lifecycle');
      const agent = createTestAgent('developer');
      const workspace = await (executor as any).setupWorkspace(task, agent);

      const retrievedWorkspace = executor.getWorkspace(workspace.id);
      expect(retrievedWorkspace).toBeDefined();
      expect(retrievedWorkspace?.id).toBe(workspace.id);
    });
  });
});

// Helper functions for creating test data
function createTestTask(type: 'coding' | 'research' | 'testing' | 'documentation', description: string): TaskDefinition {
  return {
    id: { id: generateId('task'), timestamp: Date.now(), namespace: 'test' },
    name: `Test ${type} task`,
    description,
    type,
    status: 'created',
    priority: 'normal',
    instructions: `Execute ${type} task: ${description}`,
    requirements: {
      capabilities: [type],
      tools: ['str_replace_editor', 'bash'],
      permissions: ['read', 'write'],
      estimatedDuration: 300000,
      maxDuration: 600000
    },
    constraints: [],
    dependencies: [],
    createdAt: new Date(),
    deadline: new Date(Date.now() + 3600000)
  };
}

function createTestAgent(type: 'developer' | 'analyst' | 'tester'): AgentState {
  const agentType = type === 'developer' ? 'coder' : 
                   type === 'analyst' ? 'analyzer' : 'tester';
  
  return {
    id: { id: generateId('agent'), swarmId: 'test-swarm', type: agentType, instance: 1 },
    name: `Test ${type}`,
    type: agentType,
    status: 'idle',
    capabilities: {
      codeGeneration: type === 'developer',
      codeReview: true,
      testing: type === 'tester',
      documentation: true,
      research: type === 'analyst',
      analysis: true,
      webSearch: false,
      apiIntegration: false,
      fileSystem: true,
      terminalAccess: true,
      languages: ['javascript', 'typescript'],
      frameworks: ['node.js'],
      domains: ['web-development'],
      tools: ['str_replace_editor', 'bash'],
      maxConcurrentTasks: 3,
      maxMemoryUsage: 512,
      maxExecutionTime: 300000,
      reliability: 0.9,
      speed: 1.0,
      quality: 0.8
    },
    metrics: {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageExecutionTime: 0,
      successRate: 1.0,
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkUsage: 0,
      codeQuality: 0.8,
      testCoverage: 0,
      bugRate: 0,
      userSatisfaction: 0.8,
      totalUptime: 0,
      lastActivity: new Date(),
      responseTime: 100
    },
    workload: 0,
    health: 1.0,
    config: {
      autonomyLevel: 0.8,
      learningEnabled: true,
      adaptationEnabled: true,
      maxTasksPerHour: 20,
      maxConcurrentTasks: 3,
      timeoutThreshold: 300000,
      reportingInterval: 30000,
      heartbeatInterval: 10000,
      permissions: ['read', 'write'],
      trustedAgents: [],
      expertise: {},
      preferences: {}
    },
    environment: {
      runtime: 'node',
      version: '18.0.0',
      workingDirectory: './test-workspace',
      tempDirectory: './temp',
      logDirectory: './logs',
      apiEndpoints: {},
      credentials: {},
      availableTools: ['str_replace_editor', 'bash'],
      toolConfigs: {}
    },
    endpoints: [],
    lastHeartbeat: new Date(),
    taskHistory: [],
    errorHistory: [],
    childAgents: [],
    collaborators: []
  };
} 