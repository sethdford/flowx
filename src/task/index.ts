/**
 * Task Management System - Main Export
 * Comprehensive task management with orchestration features
 * Integrates with TodoWrite/TodoRead for coordination and Memory for persistence
 */

export { TaskEngine } from "./engine.ts";
export type { WorkflowTask } from "./engine.ts";

export type { TaskCommandContext } from "./commands.ts";

export { TaskCoordinator } from "./coordination.ts";
export type { CoordinationContext, TodoItem } from "./coordination.ts";

export { TodoSyncService, type TodoTaskMapping, type SyncConfiguration } from "./todo-sync-service.js";
export { TodoSyncIntegration, createTodoSyncIntegration, enableTodoTaskSync } from "./todo-sync-integration.js";
export { VisualProgressFormatter, type ProgressOverview, type VisualTaskGroup, type FormattingOptions } from "./visual-progress-formatter.js";


// Import the types we need for the functions below
import { TaskEngine } from "./engine.ts";
import { TaskCoordinator, TodoItem, CoordinationContext } from "./coordination.ts";
import { TaskCommandContext } from "./commands.ts";
import { 
  createTaskCreateCommand,
  createTaskListCommand,
  createTaskStatusCommand,
  createTaskCancelCommand,
  createTaskWorkflowCommand
} from "./commands.ts";

/**
 * Initialize the complete task management system
 */
export async function initializeTaskManagement(
  config: {
    maxConcurrentTasks?: number;
    memoryManager?: any;
    logger?: any;
  } = {}
): Promise<{
  taskEngine: TaskEngine;
  taskCoordinator: TaskCoordinator;
  commands: {
    create: any;
    list: any;
    status: any;
    cancel: any;
    workflow: any;
  };
}> {
  const taskEngine = new TaskEngine(
    config.maxConcurrentTasks || 10,
    config.memoryManager
  );

  const taskCoordinator = new TaskCoordinator(
    taskEngine,
    config.memoryManager
  );

  const commandContext: TaskCommandContext = {
    taskEngine,
    memoryManager: config.memoryManager,
    logger: config.logger
  };

  const commands = {
    create: createTaskCreateCommand(commandContext),
    list: createTaskListCommand(commandContext),
    status: createTaskStatusCommand(commandContext),
    cancel: createTaskCancelCommand(commandContext),
    workflow: createTaskWorkflowCommand(commandContext)
  };

  return {
    taskEngine,
    taskCoordinator,
    commands
  };
}

/**
 * Helper function to create TodoWrite-style task breakdown
 */
export async function createTaskTodos(
  objective: string,
  options: {
    strategy?: 'research' | 'development' | 'analysis' | 'testing' | 'optimization' | 'maintenance';
    maxTasks?: number;
    batchOptimized?: boolean;
    parallelExecution?: boolean;
    memoryCoordination?: boolean;
  } = {},
  coordinator?: TaskCoordinator
): Promise<TodoItem[]> {
  // Create a default coordinator if none provided
  if (!coordinator) {
    const taskEngine = new TaskEngine(10); // Default max concurrent tasks
    coordinator = new TaskCoordinator(taskEngine);
  }

  const context: CoordinationContext = {
    sessionId: `session-${Date.now()}`,
    coordinationMode: options.batchOptimized ? 'distributed' : 'centralized'
  };

  return await coordinator.createTaskTodos(objective, context, options);
}

/**
 * Helper function to launch parallel agents (Task tool pattern)
 */
export async function launchParallelAgents(
  tasks: Array<{
    agentType: string;
    objective: string;
    mode?: string;
    configuration?: Record<string, unknown>;
    memoryKey?: string;
    batchOptimized?: boolean;
  }>,
  coordinator?: TaskCoordinator
): Promise<string[]> {
  if (!coordinator) {
    throw new Error('TaskCoordinator instance required for agent launching');
  }

  const context: CoordinationContext = {
    sessionId: `session-${Date.now()}`,
    coordinationMode: 'distributed'
  };

  return await coordinator.launchParallelAgents(tasks, context);
}

/**
 * Helper function to store coordination data in Memory
 */
export async function storeCoordinationData(
  key: string,
  value: any,
  options: {
    namespace?: string;
    tags?: string[];
    expiresAt?: Date;
  } = {},
  coordinator?: TaskCoordinator
): Promise<void> {
  if (!coordinator) {
    throw new Error('TaskCoordinator instance required for memory storage');
  }

  await coordinator.storeInMemory(key, value, options);
}

/**
 * Helper function to retrieve coordination data from Memory
 */
export async function retrieveCoordinationData(
  key: string,
  namespace?: string,
  coordinator?: TaskCoordinator
): Promise<any | null> {
  if (!coordinator) {
    throw new Error('TaskCoordinator instance required for memory retrieval');
  }

  return await coordinator.retrieveFromMemory(key, namespace);
}

/**
 * Examples and usage patterns for Claude Code integration
 */
export const USAGE_EXAMPLES = {
  todoWrite: `
// Example: Using TodoWrite for task coordination
import { createTaskTodos } from './task.ts';

const todos = await createTaskTodos(
  "Build e-commerce platform",
  {
    strategy: 'development',
    batchOptimized: true,
    parallelExecution: true,
    memoryCoordination: true
  },
  coordinator
);

// This creates a structured todo list with:
// - System architecture design (high priority)
// - Frontend development (parallel execution)
// - Backend development (parallel execution) 
// - Testing and integration (depends on frontend/backend)
`,

  taskTool: `
// Example: Using Task tool pattern for parallel agents
import { launchParallelAgents } from './task.ts';

const agentIds = await launchParallelAgents([
  {
    agentType: 'researcher',
    objective: 'Research best practices for microservices',
    mode: 'researcher',
    memoryKey: 'microservices_research',
    batchOptimized: true
  },
  {
    agentType: 'architect',
    objective: 'Design system architecture based on research',
    mode: 'architect',
    memoryKey: 'system_architecture',
    batchOptimized: true
  },
  {
    agentType: 'coder',
    objective: 'Implement core services',
    mode: 'coder',
    memoryKey: 'core_implementation',
    batchOptimized: true
  }
], coordinator);
`,

  memoryCoordination: `
// Example: Using Memory for cross-agent coordination
import { storeCoordinationData, retrieveCoordinationData } from './task.ts';

// Store research findings for other agents
await storeCoordinationData(
  'research_findings',
  {
    bestPractices: [...],
    technologies: [...],
    patterns: [...]
  },
  {
    namespace: 'project_coordination',
    tags: ['research', 'architecture']
  },
  coordinator
);

// Retrieve findings in another agent
const findings = await retrieveCoordinationData(
  'research_findings',
  'project_coordination',
  coordinator
);
`,

  batchOperations: `
// Example: Coordinated batch operations
import { TaskCoordinator } from './task.ts';

const results = await coordinator.coordinateBatchOperations([
  {
    type: 'read',
    targets: ['src/**/*.ts'],
    configuration: { pattern: 'class.*{' }
  },
  {
    type: 'analyze',
    targets: ['package.tson', 'tsconfig.tson'],
    configuration: { focus: 'dependencies' }
  },
  {
    type: 'search',
    targets: ['docs/**/*.md'],
    configuration: { term: 'API documentation' }
  }
], context);
`,

  swarmCoordination: `
// Example: Swarm coordination patterns
import { TaskCoordinator } from './task.ts';

await coordinator.coordinateSwarm(
  "Comprehensive system development",
  {
    sessionId: 'dev-session-1',
    coordinationMode: 'hierarchical'
  },
  [
    { type: 'lead-architect', role: 'team-lead', capabilities: ['design', 'coordination'] },
    { type: 'frontend-dev-1', role: 'developer', capabilities: ['react', 'ui'] },
    { type: 'frontend-dev-2', role: 'developer', capabilities: ['react', 'testing'] },
    { type: 'backend-dev-1', role: 'developer', capabilities: ['nodejs', 'api'] },
    { type: 'backend-dev-2', role: 'developer', capabilities: ['database', 'scaling'] },
    { type: 'devops-engineer', role: 'specialist', capabilities: ['deployment', 'monitoring'] }
  ]
);
`
};

/**
 * Command line usage examples
 */
export const CLI_EXAMPLES = {
  taskCreate: `
# Create a complex task with dependencies and scheduling
claude-flow task create development "Implement user authentication system" \\
  --priority 80 \\
  --dependencies "task-123,task-456" \\
  --dep-type finish-to-start \\
  --assign backend-team \\
  --tags "auth,security,backend" \\
  --deadline "2024-02-15T18:00:00Z" \\
  --cpu 2 \\
  --memory 1024 \\
  --max-retries 5 \\
  --rollback previous-checkpoint
`,

  taskList: `
# List tasks with advanced filtering and visualization
claude-flow task list \\
  --status running,pending \\
  --priority 70-100 \\
  --tags auth,security \\
  --sort deadline \\
  --sort-dir asc \\
  --format table \\
  --show-dependencies \\
  --show-progress \\
  --limit 20
`,

  taskStatus: `
# Get detailed task status with all metrics
claude-flow task status task-789 \\
  --show-logs \\
  --show-checkpoints \\
  --show-metrics \\
  --show-dependencies \\
  --show-resources \\
  --watch
`,

  taskCancel: `
# Cancel task with safe rollback and cascade
claude-flow task cancel task-789 \\
  --reason "Requirements changed" \\
  --cascade \\
  --dry-run
`,

  taskWorkflow: `
# Create and execute workflows
claude-flow task workflow create "E-commerce Platform" \\
  --description "Complete e-commerce development workflow" \\
  --max-concurrent 8 \\
  --strategy priority-based \\
  --error-handling continue-on-error

claude-flow task workflow execute workflow-123 \\
  --variables '{"environment":"staging","version":"2.1.0"}' \\
  --monitor

claude-flow task workflow visualize workflow-123 \\
  --format dot \\
  --output workflow-graph.dot
`
};

export default {
  TaskEngine,
  TaskCoordinator,
  initializeTaskManagement,
  createTaskTodos,
  launchParallelAgents,
  storeCoordinationData,
  retrieveCoordinationData,
  USAGE_EXAMPLES,
  CLI_EXAMPLES
};