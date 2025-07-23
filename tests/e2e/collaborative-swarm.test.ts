import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SwarmCoordinator } from '../../src/swarm/coordinator';
import { AgentType, TaskPriority, TaskType } from '../../src/swarm/types';
import { Logger } from '../../src/core/logger';
import { RealTaskExecutor } from '../../src/swarm/real-task-executor';
import * as fs from 'fs/promises';

// Mock the RealTaskExecutor to avoid actual Claude API calls
jest.mock('../../src/swarm/real-task-executor', () => ({
  RealTaskExecutor: jest.fn().mockImplementation(() => ({
    executeTask: jest.fn(async (task: any, agent: any) => {
      // Simulate task execution based on type
      if (task.type === 'coding') {
        return {
          success: true,
          output: 'Generated a simple Express.js server.',
          files: new Map([
            ['index.js', 'console.log("Hello World!");'],
            ['package.json', '{"name": "test-project"}'],
          ]),
          artifacts: ['index.js', 'package.json'],
          metrics: {
            duration: 1000,
            tokensUsed: 500,
            toolCalls: 2,
            filesGenerated: 2,
          },
        };
      } else if ((task as any).type === 'review') {
        return {
          success: true,
          output: 'Code review completed. LGTM!',
          files: new Map(),
          artifacts: [],
          metrics: {
            duration: 500,
            tokensUsed: 200,
            toolCalls: 0,
            filesGenerated: 0,
          },
        };
      }
      return { success: false, error: 'Unknown task type for mock' };
    }),
  })),
}));

describe('Swarm Coordinator - Collaborative Workflow E2E Test', () => {
  let coordinator: SwarmCoordinator;
  let logger: Logger;

  beforeEach(async () => {
    logger = new Logger({ level: 'silent', format: 'text', destination: 'console' });
    coordinator = new SwarmCoordinator({
      maxAgents: 5,
      maxConcurrentTasks: 2,
      strategy: 'development',
    });
    await coordinator.initialize();
  });

  afterEach(async () => {
    await coordinator.stop();
    // Clean up any test artifacts if necessary
    try {
      await fs.rm('./shared-workspaces', { recursive: true, force: true });
      await fs.rm('./agent-workspaces', { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  it('should execute a collaborative coding and review workflow between two agents', async () => {
    // 1. Register a developer and a reviewer agent
    const developerId = await coordinator.registerAgent('Developer', 'developer', ['code-generation']);
    const reviewerId = await coordinator.registerAgent('Reviewer', 'reviewer', ['code-review']);

    expect(coordinator.getAgents().length).toBe(2);

    // 2. Create an initial coding task for the developer
    const objectiveId = await coordinator.createObjective('Build a simple web server', 'development');
    const objectives = coordinator.getObjectives();
    const objective = objectives.find((o) => o.id === objectiveId);
    const initialTask = objective?.tasks[0];

    if (!initialTask) {
      throw new Error('Initial task was not created');
    }
    
    initialTask.type = 'coding';
    initialTask.requirements.reviewRequired = true; // IMPORTANT: This triggers collaboration

    // 3. Start the swarm
    await coordinator.start();

    // Give the coordinator a moment to assign and execute the first task
    await new Promise(resolve => setTimeout(resolve, 200));

    // 4. Verify the developer executed the task and shared files
    const developer = coordinator.getAgents().find(a => a.id.id === developerId);
    expect(developer?.metrics.tasksCompleted).toBe(1);
    
    // Check for the review task created by the handoff
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const tasks = coordinator.getTasks();
    const reviewTask = tasks.find(t => t.type === 'review');
    
    expect(reviewTask).toBeDefined();
    expect(reviewTask?.name).toContain('Review:');
    expect(reviewTask?.assignedTo?.id).toBe(reviewerId);

    // Give the coordinator a moment to assign and execute the review task
    await new Promise(resolve => setTimeout(resolve, 200));

    // 5. Verify the reviewer completed the review task
    const reviewer = coordinator.getAgents().find(a => a.id.id === reviewerId);
    expect(reviewer?.metrics.tasksCompleted).toBe(1);
    
    // 6. Verify the shared workspace was used
    const workspaceCoordinator = coordinator.getWorkspaceCoordinator();
    const developerWorkspaces = workspaceCoordinator.getAgentWorkspaces(developerId);
    expect(developerWorkspaces.length).toBe(1);

    const workspaceId = developerWorkspaces[0].id;
    const workspaceFiles = workspaceCoordinator.getWorkspaceFiles(workspaceId);
    expect(workspaceFiles.length).toBe(2);
    
    const sharedFile = workspaceFiles.find(f => f.path === 'index.js');
    expect(sharedFile).toBeDefined();
    expect(sharedFile?.author).toBe(developerId);
    expect(sharedFile?.status).toBe('approved'); // It was reviewed and auto-approved
    expect(sharedFile?.reviews.length).toBe(1);
    expect(sharedFile?.reviews[0].reviewerId).toBe(reviewerId);
  }, 10000); // Increase timeout for this E2E test
}); 