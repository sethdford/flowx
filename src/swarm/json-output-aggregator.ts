/**
 * JSON Output Aggregator for Non-Interactive Swarm Execution
 * Collects and formats swarm results into a comprehensive JSON structure.
 * This is a critical component for auditing, analysis, and non-interactive environments.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'node:fs';
import { generateId } from '../utils/helpers.js';
import { Logger } from '../core/logger.js';
import type {
  SwarmId,
  AgentId,
  TaskId,
  AgentState,
  TaskDefinition,
  SwarmResults,
  SwarmMetrics,
  TaskResult,
} from './types.js';

export interface SwarmOutputAggregate {
  swarmId: string;
  objective: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  summary: {
    totalAgents: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    successRate: number;
  };
  agents: AgentOutputData[];
  tasks: TaskOutputData[];
  results: {
    artifacts: Record<string, any>;
    outputs: string[];
    errors: string[];
    insights: string[];
  };
  metrics: SwarmMetrics;
  metadata: {
    strategy: string;
    mode: string;
    configuration: Record<string, any>;
    version: string;
  };
}

export interface AgentOutputData {
  agentId: string;
  name: string;
  type: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  tasksCompleted: number;
  outputs: string[];
  errors: string[];
  metrics: {
    tokensUsed?: number;
    memoryAccess: number;
    operationsPerformed: number;
  };
}

export interface TaskOutputData {
  taskId: string;
  name: string;
  type: string;
  status: string;
  assignedAgent?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  priority: string;
  output?: string;
  result?: TaskResult;
  artifacts?: Record<string, any>;
  error?: string;
}

export class SwarmJsonOutputAggregator extends EventEmitter {
  private logger: Logger;
  private swarmId: string;
  private objective: string;
  private startTime: Date;
  private endTime?: Date;
  private configuration: Record<string, any>;

  private agents: Map<string, AgentOutputData> = new Map();
  private tasks: Map<string, TaskOutputData> = new Map();
  private outputs: string[] = [];
  private errors: string[] = [];
  private insights: string[] = [];
  private artifacts: Record<string, any> = {};
  private metrics: SwarmMetrics = this.initializeMetrics();

  constructor(swarmId: string, objective: string, configuration: Record<string, any> = {}) {
    super();
    this.swarmId = swarmId;
    this.objective = objective;
    this.configuration = configuration;
    this.startTime = new Date();

    this.logger = new Logger(
      { level: 'info', format: 'json', destination: 'console' },
      { component: 'SwarmJsonAggregator' },
    );

    this.logger.info('JSON output aggregator initialized', {
      swarmId,
      objective,
    });
  }

  addAgent(agent: AgentState): void {
    if (!agent || !agent.id) return;
    const agentIdStr = agent.id.id;
    const agentData: AgentOutputData = {
      agentId: agentIdStr,
      name: agent.name || agentIdStr,
      type: agent.type,
      status: agent.status,
      startTime: new Date().toISOString(),
      tasksCompleted: 0,
      outputs: [],
      errors: [],
      metrics: { memoryAccess: 0, operationsPerformed: 0 },
    };
    this.agents.set(agentIdStr, agentData);
  }

  updateTask(taskId: string, updates: Partial<TaskOutputData>): void {
    const task = this.tasks.get(taskId);
    if (task) {
      Object.assign(task, updates);
    }
  }

  completeTask(taskId: string, result: TaskResult): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.endTime = new Date().toISOString();
      task.duration = task.startTime ? Date.now() - new Date(task.startTime).getTime() : 0;
      task.result = result;
      // ... more logic here
    }
  }

  finalize(status: 'completed' | 'failed' | 'timeout' | 'cancelled' = 'completed'): SwarmOutputAggregate {
    this.endTime = new Date();
    const duration = this.endTime.getTime() - this.startTime.getTime();
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed').length;
    const failedTasks = this.tasks.size - completedTasks;

    return {
      swarmId: this.swarmId,
      objective: this.objective,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime.toISOString(),
      duration,
      status,
      summary: {
        totalAgents: this.agents.size,
        totalTasks: this.tasks.size,
        completedTasks,
        failedTasks,
        successRate: this.tasks.size > 0 ? completedTasks / this.tasks.size : 0,
      },
      agents: Array.from(this.agents.values()),
      tasks: Array.from(this.tasks.values()),
      results: {
        artifacts: this.artifacts,
        outputs: this.outputs,
        errors: this.errors,
        insights: this.insights,
      },
      metrics: this.metrics,
      metadata: {
        strategy: this.configuration.strategy || 'unknown',
        mode: this.configuration.mode || 'unknown',
        configuration: this.configuration,
        version: '1.0.0',
      },
    };
  }

  async saveToFile(filePath: string, status: 'completed' | 'failed' | 'timeout' | 'cancelled' = 'completed'): Promise<void> {
    const output = this.finalize(status);
    await fs.writeFile(filePath, JSON.stringify(output, this.circularReplacer(), 2));
    this.logger.info('Swarm output saved to file', { filePath });
  }

  private circularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  }

  private initializeMetrics(): SwarmMetrics {
    return {
      throughput: 0,
      latency: 0,
      efficiency: 0,
      reliability: 0,
      averageQuality: 0,
      defectRate: 0,
      reworkRate: 0,
      resourceUtilization: {},
      costEfficiency: 0,
      agentUtilization: 0,
      agentSatisfaction: 0,
      collaborationEffectiveness: 0,
      scheduleVariance: 0,
      deadlineAdherence: 0,
    };
  }
} 