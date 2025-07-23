/**
 * Task Executor for Hive Mind
 * 
 * Manages task submission, execution, and lifecycle for the Hive Mind collective intelligence system.
 * Provides workflow orchestration and task distribution.
 */

import { EventEmitter } from 'node:events';
import { Logger } from '../../core/logger.js';
import { EventBus } from '../../core/event-bus.js';
import {
  Task,
  TaskPriority,
  TaskStrategy,
  TaskStatus,
  AgentCapability,
  AgentType,
  ExecutionPlan,
  ExecutionResult,
  TaskSubmitOptions
} from '../types.js';
import { HiveMind } from '../core/hive-mind.js';
import { generateId } from '../../utils/helpers.js';

// Task execution configuration
export interface TaskExecutorConfig {
  maxConcurrentTasks: number;
  executionTimeout: number;
  retryFailedTasks: boolean;
  maxRetries: number;
  priorityWeights: Record<TaskPriority, number>;
  defaultStrategy: TaskStrategy;
  enableConsensus: boolean;
  taskProgressInterval: number;
}

// Default configuration
const DEFAULT_CONFIG: TaskExecutorConfig = {
  maxConcurrentTasks: 10,
  executionTimeout: 300000, // 5 minutes
  retryFailedTasks: true,
  maxRetries: 3,
  priorityWeights: {
    'low': 1,
    'medium': 3,
    'high': 5,
    'critical': 10
  },
  defaultStrategy: 'parallel',
  enableConsensus: true,
  taskProgressInterval: 5000 // 5 seconds
};

// Task execution context
interface TaskExecutionContext {
  task: Task;
  startTime: number;
  progressInterval?: NodeJS.Timeout;
  timeoutTimer?: NodeJS.Timeout;
  retries: number;
  assignedAgents: string[];
  executionPlan?: ExecutionPlan;
  phaseResults: any[];
  currentPhase: number;
}

/**
 * Task Executor - Manages task submission and execution in the Hive Mind
 */
export class TaskExecutor extends EventEmitter {
  private logger: Logger;
  private eventBus: EventBus;
  private hiveMind: HiveMind;
  private config: TaskExecutorConfig;
  
  // Task tracking
  private activeTasks: Map<string, TaskExecutionContext> = new Map();
  private pendingTasks: Task[] = [];
  private completedTasks: Map<string, { task: Task; result: any }> = new Map();
  
  // Status tracking
  private isRunning: boolean = false;
  private metrics = {
    totalSubmitted: 0,
    totalCompleted: 0,
    totalFailed: 0,
    averageExecutionTime: 0
  };
  
  constructor(hiveMind: HiveMind, config: Partial<TaskExecutorConfig> = {}) {
    super();
    this.logger = new Logger('TaskExecutor');
    this.eventBus = EventBus.getInstance();
    this.hiveMind = hiveMind;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for agent task completion
    this.eventBus.on('agent:task_completed', (data: {
      agentId: string;
      taskId: string;
      result: any;
      success: boolean;
      executionTime: number;
    }) => {
      this.handleAgentTaskCompletion(data);
    });
    
    // Listen for agent task failure
    this.eventBus.on('agent:task_failed', (data: {
      agentId: string;
      taskId: string;
      error: string;
      executionTime: number;
    }) => {
      this.handleAgentTaskFailure(data);
    });
    
    // Listen for consensus results
    if (this.config.enableConsensus) {
      this.eventBus.on('consensus:achieved', (data: {
        taskId: string;
        result: any;
        confidence: number;
      }) => {
        this.handleConsensusAchieved(data);
      });
      
      this.eventBus.on('consensus:failed', (data: {
        taskId: string;
        reason: string;
      }) => {
        this.handleConsensusFailed(data);
      });
    }
  }

  /**
   * Start the task executor
   */
  public start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.logger.info('Task executor started');
    
    // Start task processing loop
    this.processNextTasks();
  }

  /**
   * Stop the task executor
   */
  public stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Cancel all progress intervals and timeout timers
    for (const context of this.activeTasks.values()) {
      if (context.progressInterval) {
        clearInterval(context.progressInterval);
      }
      
      if (context.timeoutTimer) {
        clearTimeout(context.timeoutTimer);
      }
    }
    
    this.logger.info('Task executor stopped');
  }

  /**
   * Submit a new task to be executed
   */
  public async submitTask(options: TaskSubmitOptions): Promise<Task> {
    this.metrics.totalSubmitted++;
    
    // Set default strategy if not provided
    if (!options.strategy) {
      options.strategy = this.config.defaultStrategy;
    }
    
    try {
      // Create task directly instead of calling back to HiveMind (fixes circular dependency)
      const task: Task = {
        id: generateId('task'),
        swarmId: this.hiveMind.getId(),
        description: options.description,
        priority: options.priority || 'medium',
        strategy: options.strategy,
        progress: 0,
        dependencies: options.dependencies || [],
        assignedAgents: [],
        result: undefined,
        error: undefined,
        status: 'pending',
        requireConsensus: options.requireConsensus || false,
        maxAgents: options.maxAgents || 1,
        requiredCapabilities: options.requiredCapabilities || [],
        metadata: options.metadata || {},
        createdAt: new Date()
      };
      
      // Add to pending tasks
      this.pendingTasks.push(task);
      
      // Sort pending tasks by priority
      this.sortPendingTasks();
      
      this.logger.info('Task submitted', {
        taskId: task.id,
        description: task.description,
        priority: task.priority
      });
      
      // Emit task submitted event
      this.emit('task:submitted', { task });
      
      // Process next tasks if executor is running
      if (this.isRunning) {
        this.processNextTasks();
      }
      
      return task;
    } catch (error) {
      this.logger.error('Failed to submit task', {
        description: options.description,
        error
      });
      throw error;
    }
  }

  /**
   * Submit multiple tasks at once
   */
  public async submitTasks(taskOptions: TaskSubmitOptions[]): Promise<Task[]> {
    const tasks: Task[] = [];
    
    try {
      // Submit each task
      for (const options of taskOptions) {
        const task = await this.submitTask(options);
        tasks.push(task);
      }
      
      this.logger.info(`Submitted ${tasks.length} tasks`);
      
      return tasks;
    } catch (error) {
      this.logger.error('Failed to submit tasks batch', { error });
      throw error;
    }
  }

  /**
   * Process next tasks from the queue
   */
  private async processNextTasks(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      // Check how many slots are available for new tasks
      const availableSlots = this.config.maxConcurrentTasks - this.activeTasks.size;
      
      if (availableSlots <= 0 || this.pendingTasks.length === 0) {
        return;
      }
      
      // Start execution of next tasks
      const tasksToStart = Math.min(availableSlots, this.pendingTasks.length);
      
      for (let i = 0; i < tasksToStart; i++) {
        const nextTask = this.pendingTasks.shift();
        if (nextTask) {
          await this.startTaskExecution(nextTask);
        }
      }
    } catch (error) {
      this.logger.error('Error processing next tasks', { error });
    }
  }

  /**
   * Start execution of a task
   */
  private async startTaskExecution(task: Task): Promise<void> {
    try {
      // Create execution context
      const context: TaskExecutionContext = {
        task,
        startTime: Date.now(),
        retries: 0,
        assignedAgents: [],
        phaseResults: [],
        currentPhase: 0
      };
      
      // Update task status
      await this.hiveMind.updateTaskStatus(task.id, 'in_progress');
      task.status = 'in_progress';
      
      // Create execution plan
      const executionPlan = await this.createExecutionPlan(task);
      context.executionPlan = executionPlan;
      
      // Assign agents
      await this.assignAgentsToTask(task, executionPlan);
      
      // Set up progress reporting interval
      context.progressInterval = setInterval(() => {
        this.updateTaskProgress(task.id);
      }, this.config.taskProgressInterval);
      
      // Set up timeout
      context.timeoutTimer = setTimeout(() => {
        this.handleTaskTimeout(task.id);
      }, this.config.executionTimeout);
      
      // Store execution context
      this.activeTasks.set(task.id, context);
      
      this.logger.info('Task execution started', {
        taskId: task.id,
        strategy: task.strategy,
        assignedAgents: context.assignedAgents.length
      });
      
      // Emit task started event
      this.emit('task:started', { task, assignedAgents: context.assignedAgents });
      
      // If no agents were assigned, fail the task
      if (context.assignedAgents.length === 0) {
        this.handleTaskFailure(task.id, 'No suitable agents available');
        return;
      }
      
      // Emit task to agents
      for (const agentId of context.assignedAgents) {
        this.eventBus.emit(`agent:${agentId}:task_assigned`, {
          task,
          executionPlan
        });
      }
      
    } catch (error) {
      this.logger.error('Failed to start task execution', {
        taskId: task.id,
        error
      });
      
      // Mark task as failed
      this.handleTaskFailure(task.id, String(error));
    }
  }

  /**
   * Create an execution plan for a task
   */
  private async createExecutionPlan(task: Task): Promise<ExecutionPlan> {
    // This would be more sophisticated in a real implementation
    // For now, we'll create a simple execution plan
    
    const executionPlan: ExecutionPlan = {
      taskId: task.id,
      strategy: task.strategy,
      phases: ['preparation', 'execution', 'validation'],
      phaseAssignments: [
        [{
          role: 'preparer',
          requiredCapabilities: task.requiredCapabilities,
          responsibilities: ['Analyze task requirements', 'Prepare execution environment'],
          expectedOutput: 'Prepared task context',
          timeout: 30000,
          canRunParallel: false
        }],
        [{
          role: 'executor',
          requiredCapabilities: task.requiredCapabilities,
          responsibilities: ['Execute core task logic', 'Process task inputs'],
          expectedOutput: 'Task execution result',
          timeout: 120000,
          canRunParallel: task.strategy === 'parallel'
        }],
        [{
          role: 'validator',
          requiredCapabilities: ['quality_assurance', ...task.requiredCapabilities],
          responsibilities: ['Validate task output', 'Ensure quality standards'],
          expectedOutput: 'Validation report',
          timeout: 30000,
          canRunParallel: false
        }]
      ],
      dependencies: task.dependencies,
      checkpoints: [
        { phase: 'preparation', condition: 'success', nextPhase: 'execution' },
        { phase: 'execution', condition: 'success', nextPhase: 'validation' }
      ],
      parallelizable: task.strategy === 'parallel',
      estimatedDuration: 180000, // 3 minutes
      resourceRequirements: task.resourceRequirements || {}
    };
    
    return executionPlan;
  }

  /**
   * Assign agents to a task
   */
  private async assignAgentsToTask(task: Task, executionPlan: ExecutionPlan): Promise<string[]> {
    try {
      // Get context to update
      const context = this.activeTasks.get(task.id);
      if (!context) {
        throw new Error('Task context not found');
      }
      
      // Determine how many agents to assign
      const agentCount = task.strategy === 'parallel' ? 
        Math.min(task.maxAgents || 3, 5) : 1;
      
      // Get suitable agents for the task
      const agentIds = await this.hiveMind.getAvailableAgentsForTask(
        'task', // taskType
        { requiredCapabilities: task.requiredCapabilities, agentCount }
      );
      
      if (agentIds.length === 0) {
        this.logger.warn('No suitable agents available for task', {
          taskId: task.id,
          requiredCapabilities: task.requiredCapabilities
        });
        return [];
      }
      
      // Assign agents - agentIds are already strings
      const assignedAgents: string[] = agentIds.slice(0, agentCount);
      
      // Update context
      context.assignedAgents = assignedAgents;
      
      this.logger.info('Agents assigned to task', {
        taskId: task.id,
        agentCount: assignedAgents.length
      });
      
      // Update task in hive mind
      await this.hiveMind.assignAgentsToTask(task.id, assignedAgents);
      
      return assignedAgents;
    } catch (error) {
      this.logger.error('Failed to assign agents to task', {
        taskId: task.id,
        error
      });
      return [];
    }
  }

  /**
   * Update task progress
   */
  private async updateTaskProgress(taskId: string): Promise<void> {
    const context = this.activeTasks.get(taskId);
    if (!context) return;
    
    try {
      // Calculate progress based on phases completed
      const totalPhases = context.executionPlan?.phases.length || 3;
      const completedPhases = context.currentPhase;
      
      // Calculate progress as percentage
      const progress = Math.floor((completedPhases / totalPhases) * 100);
      
      // Update task progress in hive mind
      await this.hiveMind.updateTaskProgress(taskId, progress);
      
      // Emit progress event
      this.emit('task:progress', {
        taskId,
        progress,
        currentPhase: context.currentPhase,
        totalPhases,
        elapsedTime: Date.now() - context.startTime
      });
    } catch (error) {
      this.logger.error('Failed to update task progress', {
        taskId,
        error
      });
    }
  }

  /**
   * Handle task timeout
   */
  private async handleTaskTimeout(taskId: string): Promise<void> {
    const context = this.activeTasks.get(taskId);
    if (!context) return;
    
    this.logger.warn('Task execution timed out', {
      taskId,
      elapsedTime: Date.now() - context.startTime,
      timeout: this.config.executionTimeout
    });
    
    // Mark task as failed
    await this.handleTaskFailure(taskId, 'Task execution timed out');
  }

  /**
   * Handle agent task completion
   */
  private async handleAgentTaskCompletion(data: {
    agentId: string;
    taskId: string;
    result: any;
    success: boolean;
    executionTime: number;
  }): Promise<void> {
    const context = this.activeTasks.get(data.taskId);
    if (!context) return;
    
    try {
      this.logger.info('Agent completed task', {
        taskId: data.taskId,
        agentId: data.agentId,
        success: data.success,
        executionTime: data.executionTime
      });
      
      // If consensus is required, collect result for consensus
      if (context.task.requireConsensus) {
        await this.addConsensusResult(
          data.taskId,
          data.agentId,
          data.result,
          data.success
        );
        return;
      }
      
      // For parallel strategy, we need to wait for all agents to complete
      if (context.task.strategy === 'parallel' && 
          context.assignedAgents.length > 1) {
        
        // Store phase result
        context.phaseResults.push({
          agentId: data.agentId,
          result: data.result,
          success: data.success,
          executionTime: data.executionTime
        });
        
        // Check if all agents have completed
        if (context.phaseResults.length >= context.assignedAgents.length) {
          // Combine results
          const combinedResult = this.combineResults(context.phaseResults);
          
          // Complete the task
          await this.completeTask(data.taskId, combinedResult);
        }
        
        return;
      }
      
      // For sequential strategy, just complete the task
      await this.completeTask(data.taskId, data.result);
      
    } catch (error) {
      this.logger.error('Error handling agent task completion', {
        taskId: data.taskId,
        agentId: data.agentId,
        error
      });
    }
  }

  /**
   * Handle agent task failure
   */
  private async handleAgentTaskFailure(data: {
    agentId: string;
    taskId: string;
    error: string;
    executionTime: number;
  }): Promise<void> {
    const context = this.activeTasks.get(data.taskId);
    if (!context) return;
    
    try {
      this.logger.warn('Agent task execution failed', {
        taskId: data.taskId,
        agentId: data.agentId,
        error: data.error
      });
      
      // If consensus is required, collect failure for consensus
      if (context.task.requireConsensus) {
        await this.addConsensusResult(
          data.taskId,
          data.agentId,
          { error: data.error },
          false
        );
        return;
      }
      
      // For parallel strategy, we need to wait for all agents to complete
      if (context.task.strategy === 'parallel' && 
          context.assignedAgents.length > 1) {
        
        // Store phase result
        context.phaseResults.push({
          agentId: data.agentId,
          error: data.error,
          success: false,
          executionTime: data.executionTime
        });
        
        // Check if all agents have completed
        if (context.phaseResults.length >= context.assignedAgents.length) {
          // Check if any agent succeeded
          const successfulResults = context.phaseResults.filter(r => r.success);
          
          if (successfulResults.length > 0) {
            // Combine successful results
            const combinedResult = this.combineResults(successfulResults);
            await this.completeTask(data.taskId, combinedResult);
          } else {
            // All agents failed, fail the task
            await this.handleTaskFailure(data.taskId, 'All agents failed to execute task');
          }
        }
        
        return;
      }
      
      // For sequential strategy with retries
      if (this.config.retryFailedTasks && context.retries < this.config.maxRetries) {
        // Increment retry count
        context.retries++;
        
        this.logger.info('Retrying failed task', {
          taskId: data.taskId,
          retryCount: context.retries,
          maxRetries: this.config.maxRetries
        });
        
        // Find a different agent
        const excludeAgentIds = [data.agentId];
        const newAgentId = await this.hiveMind.findAlternativeAgentForTask(
          context.task.id,
          data.agentId
        );
        
        if (newAgentId) {
          // Assign new agent
          context.assignedAgents = [newAgentId];
          
          // Emit task to new agent
          this.eventBus.emit(`agent:${newAgentId}:task_assigned`, {
            task: context.task,
            executionPlan: context.executionPlan
          });
          
          this.logger.info('Task reassigned to alternative agent', {
            taskId: data.taskId,
            newAgentId: newAgentId
          });
          
          return;
        }
      }
      
      // No retries or no alternative agent, fail the task
      await this.handleTaskFailure(data.taskId, data.error);
      
    } catch (error) {
      this.logger.error('Error handling agent task failure', {
        taskId: data.taskId,
        agentId: data.agentId,
        error
      });
    }
  }

  /**
   * Add a result for consensus
   */
  private async addConsensusResult(
    taskId: string,
    agentId: string,
    result: any,
    success: boolean
  ): Promise<void> {
    try {
      // Submit result for consensus
      await this.hiveMind.addConsensusResult(taskId, agentId, result, success);
      
      // Check if consensus can be reached
      await this.checkConsensusStatus(taskId);
    } catch (error) {
      this.logger.error('Failed to add consensus result', {
        taskId,
        agentId,
        error
      });
    }
  }

  /**
   * Check consensus status for a task
   */
  private async checkConsensusStatus(taskId: string): Promise<void> {
    try {
      const consensusStatus = await this.hiveMind.getConsensusStatus(taskId);
      
      if (consensusStatus.complete) {
        if (consensusStatus.achieved) {
          // Consensus achieved
          this.logger.info('Consensus achieved for task', {
            taskId,
            confidence: consensusStatus.confidence,
            participationRate: consensusStatus.participationRate
          });
          
          // Complete the task with consensus result
          await this.completeTask(taskId, consensusStatus.result);
        } else {
          // Consensus failed
          this.logger.warn('Consensus failed for task', {
            taskId,
            reason: consensusStatus.failureReason
          });
          
          // Fail the task
          await this.handleTaskFailure(taskId, `Consensus failed: ${consensusStatus.failureReason}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to check consensus status', {
        taskId,
        error
      });
    }
  }

  /**
   * Handle consensus achieved event
   */
  private async handleConsensusAchieved(data: {
    taskId: string;
    result: any;
    confidence: number;
  }): Promise<void> {
    await this.completeTask(data.taskId, data.result);
  }

  /**
   * Handle consensus failed event
   */
  private async handleConsensusFailed(data: {
    taskId: string;
    reason: string;
  }): Promise<void> {
    await this.handleTaskFailure(data.taskId, `Consensus failed: ${data.reason}`);
  }

  /**
   * Complete a task successfully
   */
  private async completeTask(taskId: string, result: any): Promise<void> {
    const context = this.activeTasks.get(taskId);
    if (!context) return;
    
    try {
      // Clear intervals and timers
      if (context.progressInterval) {
        clearInterval(context.progressInterval);
      }
      
      if (context.timeoutTimer) {
        clearTimeout(context.timeoutTimer);
      }
      
      // Calculate execution time
      const executionTime = Date.now() - context.startTime;
      
      // Update metrics
      this.metrics.totalCompleted++;
      this.updateAverageExecutionTime(executionTime);
      
      // Update task status in hive mind
      await this.hiveMind.completeTask(taskId, result);
      
      // Store in completed tasks
      this.completedTasks.set(taskId, {
        task: context.task,
        result
      });
      
      this.logger.info('Task completed successfully', {
        taskId,
        executionTime,
        resultSize: typeof result === 'string' ? result.length : 
                    (result ? Object.keys(result).length : 0)
      });
      
      // Remove from active tasks
      this.activeTasks.delete(taskId);
      
      // Emit task completed event
      this.emit('task:completed', {
        taskId,
        task: context.task,
        result,
        executionTime
      });
      
      // Process next tasks
      this.processNextTasks();
    } catch (error) {
      this.logger.error('Failed to complete task', {
        taskId,
        error
      });
    }
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(taskId: string, error: string): Promise<void> {
    const context = this.activeTasks.get(taskId);
    if (!context) return;
    
    try {
      // Clear intervals and timers
      if (context.progressInterval) {
        clearInterval(context.progressInterval);
      }
      
      if (context.timeoutTimer) {
        clearTimeout(context.timeoutTimer);
      }
      
      // Calculate execution time
      const executionTime = Date.now() - context.startTime;
      
      // Update metrics
      this.metrics.totalFailed++;
      
      // Update task status in hive mind
      await this.hiveMind.failTask(taskId, error);
      
      this.logger.warn('Task failed', {
        taskId,
        error,
        executionTime
      });
      
      // Remove from active tasks
      this.activeTasks.delete(taskId);
      
      // Emit task failed event
      this.emit('task:failed', {
        taskId,
        task: context.task,
        error,
        executionTime
      });
      
      // Process next tasks
      this.processNextTasks();
    } catch (err) {
      this.logger.error('Failed to handle task failure', {
        taskId,
        originalError: error,
        handlingError: err
      });
    }
  }

  /**
   * Combine results from multiple agents
   */
  private combineResults(results: any[]): any {
    // This would be more sophisticated in a real implementation
    // For now, we'll just return the first successful result
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return { error: 'No successful results to combine' };
    }
    
    return successfulResults[0].result;
  }

  /**
   * Sort pending tasks by priority
   */
  private sortPendingTasks(): void {
    this.pendingTasks.sort((a, b) => {
      const priorityA = this.config.priorityWeights[a.priority] || 1;
      const priorityB = this.config.priorityWeights[b.priority] || 1;
      
      // Higher priority first
      return priorityB - priorityA;
    });
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(executionTime: number): void {
    if (this.metrics.totalCompleted === 1) {
      this.metrics.averageExecutionTime = executionTime;
    } else {
      const prevTotal = this.metrics.averageExecutionTime * (this.metrics.totalCompleted - 1);
      this.metrics.averageExecutionTime = (prevTotal + executionTime) / this.metrics.totalCompleted;
    }
  }

  /**
   * Cancel a task
   */
  public async cancelTask(taskId: string): Promise<void> {
    try {
      const context = this.activeTasks.get(taskId);
      
      if (!context) {
        // Check if it's a pending task
        const pendingTaskIndex = this.pendingTasks.findIndex(t => t.id === taskId);
        
        if (pendingTaskIndex >= 0) {
          // Remove from pending tasks
          const task = this.pendingTasks.splice(pendingTaskIndex, 1)[0];
          
          // Update task status in hive mind
          await this.hiveMind.cancelTask(taskId);
          
          this.logger.info('Pending task cancelled', {
            taskId,
            description: task.description
          });
          
          // Emit task cancelled event
          this.emit('task:cancelled', { taskId, task });
          
          return;
        }
        
        throw new Error('Task not found in active or pending tasks');
      }
      
      // Clear intervals and timers
      if (context.progressInterval) {
        clearInterval(context.progressInterval);
      }
      
      if (context.timeoutTimer) {
        clearTimeout(context.timeoutTimer);
      }
      
      // Update task status in hive mind
      await this.hiveMind.cancelTask(taskId);
      
      // Notify assigned agents
      for (const agentId of context.assignedAgents) {
        this.eventBus.emit(`agent:${agentId}:task_cancelled`, {
          taskId,
          reason: 'Task cancelled by system'
        });
      }
      
      this.logger.info('Active task cancelled', {
        taskId,
        description: context.task.description,
        elapsedTime: Date.now() - context.startTime
      });
      
      // Remove from active tasks
      this.activeTasks.delete(taskId);
      
      // Emit task cancelled event
      this.emit('task:cancelled', { taskId, task: context.task });
      
      // Process next tasks
      this.processNextTasks();
    } catch (error) {
      this.logger.error('Failed to cancel task', {
        taskId,
        error
      });
      throw error;
    }
  }

  /**
   * Get active tasks
   */
  public getActiveTasks(): Task[] {
    return Array.from(this.activeTasks.values()).map(context => context.task);
  }

  /**
   * Get pending tasks
   */
  public getPendingTasks(): Task[] {
    return [...this.pendingTasks];
  }

  /**
   * Get completed tasks
   */
  public getCompletedTasks(): { task: Task; result: any }[] {
    return Array.from(this.completedTasks.values());
  }

  /**
   * Get task execution metrics
   */
  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get task by ID
   */
  public async getTaskById(taskId: string): Promise<Task | null> {
    try {
      // Check active tasks
      const activeContext = this.activeTasks.get(taskId);
      if (activeContext) {
        return activeContext.task;
      }
      
      // Check pending tasks
      const pendingTask = this.pendingTasks.find(t => t.id === taskId);
      if (pendingTask) {
        return pendingTask;
      }
      
      // Check completed tasks
      const completedTask = this.completedTasks.get(taskId);
      if (completedTask) {
        return completedTask.task;
      }
      
      // If not found locally, try to get from hive mind
      return await this.hiveMind.getTask(taskId);
    } catch (error) {
      this.logger.error('Failed to get task by ID', {
        taskId,
        error
      });
      return null;
    }
  }
}

/**
 * Create a task executor for a hive mind
 */
export function createTaskExecutor(
  hiveMind: HiveMind,
  config: Partial<TaskExecutorConfig> = {}
): TaskExecutor {
  return new TaskExecutor(hiveMind, config);
}