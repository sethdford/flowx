/**
 * Central mock file for commonly missing modules
 * This helps reduce TypeScript errors across test files
 */

// Mock @cliffy/ansi/colors
export const colors = {
  green: (text: string) => text,
  red: (text: string) => text,
  yellow: (text: string) => text,
  blue: (text: string) => text,
  cyan: (text: string) => text,
  magenta: (text: string) => text,
  gray: (text: string) => text,
  bold: (text: string) => text,
  dim: (text: string) => text,
  white: (text: string) => text,
  black: (text: string) => text
};

// Mock real-task-executor
export const RealTaskExecutor = class {
  async executeTask(task: any, agent: any) {
    return {
      success: true,
      output: 'Mock output',
      files: new Map(),
      artifacts: [],
      metrics: {}
    };
  }
};

// Mock engine types and classes
export const TaskEngine = class {
  async getTaskStatus() { return null; }
  async createTask() { return 'mock-task-id'; }
  async listTasks() { return { tasks: [], total: 0, hasMore: false }; }
};

export const TaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const WorkflowTask = {};

// Mock sparc-executor
export const SparcTaskExecutor = class {
  async executeTask() {
    return {
      output: 'Mock SPARC output',
      artifacts: {},
      metadata: {},
      quality: 1.0,
      completeness: 1.0,
      accuracy: 1.0,
      executionTime: 100,
      resourcesUsed: {},
      validated: true
    };
  }
};

// Mock types
export interface TaskDefinition {
  id: any;
  name: string;
  description: string;
  type: string;
  status: string;
  [key: string]: any;
}

export interface AgentState {
  id: any;
  name: string;
  type: string;
  status: string;
  [key: string]: any;
}

export interface TaskResult {
  output: any;
  artifacts: any;
  metadata: any;
  quality: number;
  completeness: number;
  accuracy: number;
  executionTime: number;
  resourcesUsed: any;
  validated: boolean;
}

// Mock logger
export const Logger = class {
  info() {}
  warn() {}
  error() {}
  debug() {}
};

// Mock prompt managers
export const PromptManager = class {
  async sync() { return { success: true }; }
};

export const PromptConfigManager = class {
  async load() { return {}; }
};

// Mock specialized executors
export const DirectExecutor = class {
  async execute() { return 'Direct execution result'; }
};

export const SparcExecutor = class {
  async execute() { return 'SPARC execution result'; }
};

export const TaskExecutorFactory = class {
  static create() { return new DirectExecutor(); }
};

export const executorFactory = {
  create: () => new DirectExecutor()
};

// Mock agent capability index
export const AgentCapabilityIndex = class {
  registerAgent() {}
  findMatchingAgents() { return []; }
  updatePerformance() {}
  on() {}
  emit() {}
};

export const CapabilityMatch = {};
export const AgentPerformanceMetrics = {};
export const CapabilityRequirement = {};

// Mock commands
export const createTaskCreateCommand = () => ({});
export const createTaskListCommand = () => ({});
export const createTaskStatusCommand = () => ({});
export const createTaskCancelCommand = () => ({});
export const createTaskWorkflowCommand = () => ({});

export const TaskCommandContext = {};

// Mock infrastructure manager
export const InfrastructureManager = class {
  async deploy() { return { success: true }; }
  async monitor() { return {}; }
};

// Export all as default for wildcard imports
export default {
  colors,
  RealTaskExecutor,
  TaskEngine,
  TaskStatus,
  WorkflowTask,
  SparcTaskExecutor,
  Logger,
  PromptManager,
  PromptConfigManager,
  DirectExecutor,
  SparcExecutor,
  TaskExecutorFactory,
  executorFactory,
  AgentCapabilityIndex,
  CapabilityMatch,
  AgentPerformanceMetrics,
  CapabilityRequirement,
  createTaskCreateCommand,
  createTaskListCommand,
  createTaskStatusCommand,
  createTaskCancelCommand,
  createTaskWorkflowCommand,
  TaskCommandContext,
  InfrastructureManager
}; 