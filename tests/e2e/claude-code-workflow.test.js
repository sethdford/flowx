/**
 * Comprehensive Claude Code Workflow E2E Test
 * Tests a complete end-to-end workflow using Claude Code with flowx
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createCommandTestRunner } from '../utils/command-test-base.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('Claude Code Complete Workflow E2E', () => {
  let runner;
  let workDir;
  let projectDir;
  
  beforeAll(async () => {
    // Create test runner with extended timeout
    runner = createCommandTestRunner({
      debug: false,
      timeout: 180000 // 3 minutes timeout for the comprehensive workflow
    });
    
    workDir = await runner.setup();
    console.log(`Test working directory: ${workDir}`);
    
    // Create project directory
    projectDir = path.join(workDir, 'sample-project');
    await fs.mkdir(projectDir, { recursive: true });
    
    // Create workflow file for testing
    const workflowFile = path.join(workDir, 'test-workflow.json');
    const workflowContent = JSON.stringify({
      name: "Test Development Workflow",
      description: "A comprehensive workflow for testing Claude Code integration",
      steps: [
        {
          name: "setup-project",
          type: "system",
          action: "create-directories",
          params: {
            directories: ["src", "tests", "docs", "config"]
          }
        },
        {
          name: "store-context",
          type: "memory",
          action: "store",
          params: {
            key: "project/tech-stack",
            value: { 
              frontend: "React", 
              backend: "Express", 
              database: "MongoDB",
              testing: "Jest"
            }
          }
        },
        {
          name: "design-architecture",
          type: "sparc",
          action: "run",
          params: {
            mode: "architect",
            task: "Design a user authentication system"
          }
        },
        {
          name: "create-tests",
          type: "sparc",
          action: "run",
          params: {
            mode: "tdd",
            task: "Create tests for user authentication"
          }
        },
        {
          name: "implement-code",
          type: "sparc",
          action: "run",
          params: {
            mode: "code",
            task: "Implement user authentication"
          }
        }
      ]
    }, null, 2);
    
    await fs.writeFile(workflowFile, workflowContent);
    
    // Create a package.json file in the project directory
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJsonContent = JSON.stringify({
      name: "sample-project",
      version: "1.0.0",
      description: "Test project for Claude Code workflow testing",
      main: "index.js",
      scripts: {
        "test": "jest",
        "start": "node src/index.js",
        "dev": "nodemon src/index.js"
      }
    }, null, 2);
    
    await fs.writeFile(packageJsonPath, packageJsonContent);
  });
  
  afterAll(async () => {
    await runner.teardown();
  });
  
  test('should execute complete development workflow with Claude Code', async () => {
    // Step 1: System Status - Ensure everything is working
    console.log('Step 1: Checking system status');
    const statusResult = await runner.runCommand([
      '--claude-code',
      'status',
      '--json'
    ]);
    
    expect(statusResult.code).toBe(0);
    let systemStatus;
    try {
      systemStatus = runner.parseJsonOutput(statusResult.stdout);
      expect(systemStatus).toHaveProperty('health');
    } catch (e) {
      console.error('Failed to parse system status JSON:', statusResult.stdout);
      throw e;
    }
    
    // Step 2: Store project context in memory
    console.log('Step 2: Storing project context in memory');
    const memoryStoreResult = await runner.runCommand([
      '--claude-code',
      'memory', 'store',
      '--key', 'project/requirements',
      '--value', JSON.stringify({
        name: "Authentication System",
        features: [
          "User registration",
          "Login/logout",
          "Password reset",
          "JWT token management",
          "Role-based access control"
        ],
        requirements: {
          security: "High",
          performance: "Medium",
          scalability: "Medium"
        }
      }),
      '--type', 'context',
      '--test-mode'
    ]);
    
    expect(memoryStoreResult.code).toBe(0);
    expect(memoryStoreResult.stdout).toContain('Memory stored');
    
    // Step 3: Initialize a swarm for collaborative development
    console.log('Step 3: Initializing development swarm');
    const swarmResult = await runner.runCommand([
      '--claude-code',
      'swarm',
      '"Develop authentication system"',
      '--topology', 'hierarchical',
      '--strategy', 'development',
      '--max-agents', '5',
      '--test-mode'
    ]);
    
    expect(swarmResult.code).toBe(0);
    expect(swarmResult.stdout).toContain('Swarm initialized');
    const swarmId = runner.extractId(swarmResult.stdout);
    expect(swarmId).not.toBeNull();
    
    // Step 4: Spawn specialized agents
    console.log('Step 4: Spawning specialized agents');
    const agentTypes = [
      { type: 'architect', name: 'system-designer' },
      { type: 'coder', name: 'auth-developer' },
      { type: 'tester', name: 'security-tester' },
      { type: 'reviewer', name: 'code-reviewer' },
      { type: 'coordinator', name: 'project-manager' }
    ];
    
    const agentIds = {};
    
    for (const agent of agentTypes) {
      const agentResult = await runner.runCommand([
        '--claude-code',
        'agent', 'spawn',
        agent.type,
        '--name', agent.name,
        '--swarm-id', swarmId,
        '--test-mode'
      ]);
      
      expect(agentResult.code).toBe(0);
      expect(agentResult.stdout).toContain('Agent spawned successfully');
      
      const agentId = runner.extractId(agentResult.stdout);
      expect(agentId).not.toBeNull();
      agentIds[agent.type] = agentId;
    }
    
    // Step 5: Use SPARC architect mode for system design
    console.log('Step 5: Running SPARC architect mode');
    const architectResult = await runner.runCommand([
      '--claude-code',
      'sparc',
      'run',
      'architect',
      '"Design JWT-based authentication system with role-based access control"',
      '--use-memory',
      '--test-mode'
    ]);
    
    expect(architectResult.code).toBe(0);
    expect(architectResult.stdout).toContain('SPARC architect mode executing');
    
    // Step 6: Store architecture decisions in memory
    console.log('Step 6: Storing architecture decisions');
    const architectureMemoryResult = await runner.runCommand([
      '--claude-code',
      'memory', 'store',
      '--key', 'project/architecture',
      '--value', JSON.stringify({
        components: [
          "UserService - User management and authentication",
          "TokenService - JWT token generation and validation",
          "RoleService - Role-based access control",
          "SecurityMiddleware - Request validation and protection"
        ],
        dataModel: {
          User: { username: "String", passwordHash: "String", roles: "Array" },
          Role: { name: "String", permissions: "Array" },
          Token: { value: "String", expires: "Date", user: "Reference" }
        },
        apis: [
          "/auth/register - User registration",
          "/auth/login - User login",
          "/auth/logout - User logout",
          "/auth/reset-password - Password reset",
          "/auth/token/refresh - Token refresh"
        ]
      }),
      '--type', 'architecture',
      '--tags', 'jwt,authentication,design',
      '--test-mode'
    ]);
    
    expect(architectureMemoryResult.code).toBe(0);
    expect(architectureMemoryResult.stdout).toContain('Memory stored');
    
    // Step 7: Create tasks for development
    console.log('Step 7: Creating development tasks');
    const tasks = [
      { type: 'development', description: 'Implement user registration and login' },
      { type: 'development', description: 'Implement JWT token management' },
      { type: 'testing', description: 'Create security tests for authentication' },
      { type: 'documentation', description: 'Document API endpoints' }
    ];
    
    const taskIds = {};
    
    for (const task of tasks) {
      const taskResult = await runner.runCommand([
        '--claude-code',
        'task', 'create',
        task.type,
        `"${task.description}"`,
        '--test-mode'
      ]);
      
      expect(taskResult.code).toBe(0);
      expect(taskResult.stdout).toContain('Task created successfully');
      
      const taskId = runner.extractId(taskResult.stdout);
      expect(taskId).not.toBeNull();
      taskIds[task.description] = taskId;
    }
    
    // Step 8: Assign and execute first task
    console.log('Step 8: Assigning and executing first task');
    const firstTaskId = taskIds['Implement user registration and login'];
    
    const assignResult = await runner.runCommand([
      '--claude-code',
      'task', 'assign',
      firstTaskId,
      '--agent-id', agentIds.coder,
      '--test-mode'
    ]);
    
    expect(assignResult.code).toBe(0);
    
    const executeResult = await runner.runCommand([
      '--claude-code',
      'task', 'execute',
      firstTaskId,
      '--test-mode'
    ]);
    
    expect(executeResult.code).toBe(0);
    expect(executeResult.stdout).toContain('Task execution started');
    
    // Step 9: Run SPARC TDD mode for test creation
    console.log('Step 9: Running SPARC TDD mode');
    const tddResult = await runner.runCommand([
      '--claude-code',
      'sparc',
      'tdd',
      '"Create tests for JWT authentication logic"',
      '--dir', projectDir,
      '--test-mode'
    ]);
    
    expect(tddResult.code).toBe(0);
    expect(tddResult.stdout).toContain('SPARC tdd mode executing');
    
    // Step 10: Create a workflow for the development process
    console.log('Step 10: Creating development workflow');
    const workflowName = 'auth-development';
    const workflowResult = await runner.runCommand([
      '--claude-code',
      'workflow', 'create',
      '--name', workflowName,
      '--template', 'development',
      '--test-mode'
    ]);
    
    expect(workflowResult.code).toBe(0);
    expect(workflowResult.stdout).toContain('Workflow created');
    
    const workflowId = runner.extractId(workflowResult.stdout);
    expect(workflowId).not.toBeNull();
    
    // Step 11: Run the workflow (dry run mode in test)
    console.log('Step 11: Executing workflow');
    const runWorkflowResult = await runner.runCommand([
      '--claude-code',
      'workflow', 'run',
      workflowId,
      '--dry-run', // Use dry-run in testing
      '--test-mode'
    ]);
    
    expect(runWorkflowResult.code).toBe(0);
    expect(runWorkflowResult.stdout).toContain('Workflow execution started');
    
    // Step 12: Check workflow status
    console.log('Step 12: Checking workflow status');
    const workflowExecutionId = runner.extractId(runWorkflowResult.stdout);
    
    const workflowStatusResult = await runner.runCommand([
      '--claude-code',
      'workflow', 'status',
      workflowExecutionId,
      '--test-mode'
    ]);
    
    expect(workflowStatusResult.code).toBe(0);
    expect(workflowStatusResult.stdout).toContain('Execution Status');
    
    // Step 13: Use SPARC security mode for security analysis
    console.log('Step 13: Running security analysis with SPARC');
    const securityResult = await runner.runCommand([
      '--claude-code',
      'sparc',
      'run',
      'security',
      '"Analyze authentication system for security vulnerabilities"',
      '--test-mode'
    ]);
    
    expect(securityResult.code).toBe(0);
    expect(securityResult.stdout).toContain('SPARC security mode executing');
    
    // Step 14: Store results in memory
    console.log('Step 14: Storing project status in memory');
    const statusMemoryResult = await runner.runCommand([
      '--claude-code',
      'memory', 'store',
      '--key', 'project/status',
      '--value', JSON.stringify({
        phase: 'Development',
        completedTasks: ['Architecture design', 'Test creation'],
        inProgressTasks: ['Authentication implementation'],
        pendingTasks: ['Security review', 'Documentation'],
        issues: [],
        lastUpdated: new Date().toISOString()
      }),
      '--type', 'status',
      '--test-mode'
    ]);
    
    expect(statusMemoryResult.code).toBe(0);
    expect(statusMemoryResult.stdout).toContain('Memory stored');
    
    // Step 15: Check swarm status after operations
    console.log('Step 15: Checking swarm status');
    const finalSwarmStatus = await runner.runCommand([
      '--claude-code',
      'swarm', 'status',
      swarmId,
      '--test-mode'
    ]);
    
    expect(finalSwarmStatus.code).toBe(0);
    expect(finalSwarmStatus.stdout).toContain('Swarm Status');
    
    // Final step: Check system health after all operations
    console.log('Final step: Checking system health');
    const finalHealthResult = await runner.runCommand([
      '--claude-code',
      'health',
      '--test-mode'
    ]);
    
    expect(finalHealthResult.code).toBe(0);
    expect(finalHealthResult.stdout).toContain('Health Status');
  });
});