/**
 * Task Engine Core - Comprehensive task management with orchestration features
 * Integrates with TodoWrite/TodoRead for coordination and Memory for persistence
 */

import { EventEmitter } from 'node:events';
import { Task, TaskStatus, AgentProfile, Resource } from "../utils/types.js";
import { generateId } from "../utils/helpers.js";

export interface TaskDependency {
  taskId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  lag?: number; // delay in milliseconds
}

export interface ResourceRequirement {
  resourceId: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'custom';
  amount: number;
  unit: string;
  exclusive?: boolean;
  priority?: number;
}

export interface TaskSchedule {
  startTime?: Date;
  endTime?: Date;
  deadline?: Date;
  recurring?: {
    interval: 'daily' | 'weekly' | 'monthly';
    count?: number;
    until?: Date;
  };
  timezone?: string;
}

export interface WorkflowTask extends Omit<Task, 'dependencies'> {
  dependencies: TaskDependency[];
  resourceRequirements: ResourceRequirement[];
  schedule?: TaskSchedule;
  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  timeout?: number;
  tags: string[];
  estimatedDurationMs?: number;
  actualDurationMs?: number;
  progressPercentage: number;
  checkpoints: TaskCheckpoint[];
  rollbackStrategy?: 'previous-checkpoint' | 'initial-state' | 'custom';
  customRollbackHandler?: string;
}

export interface TaskCheckpoint {
  id: string;
  timestamp: Date;
  description: string;
  state: Record<string, unknown>;
  artifacts: string[];
}

export interface TaskExecution {
  id: string;
  taskId: string;
  agentId: string;
  startedAt: Date;
  completedAt?: Date;
  status: TaskStatus;
  progress: number;
  metrics: TaskMetrics;
  logs: TaskLog[];
}

export interface TaskMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskIO: number;
  networkIO: number;
  customMetrics: Record<string, number>;
}

export interface TaskLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  tasks: WorkflowTask[];
  variables: Record<string, unknown>;
  parallelism: {
    maxConcurrent: number;
    strategy: 'breadth-first' | 'depth-first' | 'priority-based';
  };
  errorHandling: {
    strategy: 'fail-fast' | 'continue-on-error' | 'retry-failed';
    maxRetries: number;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TaskFilter {
  status?: TaskStatus[];
  assignedAgent?: string[];
  priority?: { min?: number; max?: number };
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  dueBefore?: Date;
  search?: string;
}

export interface TaskSort {
  field: 'createdAt' | 'priority' | 'deadline' | 'status' | 'estimatedDuration';
  direction: 'asc' | 'desc';
}

// Extended Resource interface for task engine
export interface ExtendedResource extends Resource {
  capacity?: number;
  inUseBy?: string[];
}

export class TaskEngine extends EventEmitter {
  private tasks = new Map<string, WorkflowTask>();
  private executions = new Map<string, TaskExecution>();
  private workflows = new Map<string, Workflow>();
  private resources = new Map<string, ExtendedResource>();
  private dependencyGraph = new Map<string, Set<string>>();
  private readyQueue: string[] = [];
  private runningTasks = new Set<string>();
  private cancelledTasks = new Set<string>();
  private taskState = new Map<string, Record<string, unknown>>();

  private maxConcurrent: number;
  private memoryManager?: any; // Memory interface for persistence

  // Scheduler properties
  private schedulerTimer: NodeJS.Timeout | null = null;
  private schedulerRunning: boolean = false;
  private lastSchedulerRun: number = 0;
  private schedulerIntervalMs: number = 1000; // 1 second default scheduler interval
  private logger?: any;

  constructor(
    maxConcurrent: number = 10,
    memoryManager?: any, // Memory interface for persistence
    logger?: any
  ) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.memoryManager = memoryManager;
    this.logger = logger;
    this.setupEventHandlers();
    
    // Only start scheduler if not in test environment
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      this.startTaskScheduler();
    }
  }

  private setupEventHandlers(): void {
    this.on('task:created', this.handleTaskCreated.bind(this));
    this.on('task:completed', this.handleTaskCompleted.bind(this));
    this.on('task:failed', this.handleTaskFailed.bind(this));
    this.on('task:cancelled', this.handleTaskCancelled.bind(this));
    this.on('task:progress', this.handleTaskProgress.bind(this));
    this.on('task:checkpoint', this.handleTaskCheckpoint.bind(this));
  }

  /**
   * Create a new task with comprehensive options
   */
  async createTask(taskData: Partial<WorkflowTask>): Promise<WorkflowTask> {
    const task: WorkflowTask = {
      id: taskData.id || generateId('task'),
      type: taskData.type || 'general',
      description: taskData.description || '',
      priority: taskData.priority || 0,
      status: 'pending',
      input: taskData.input || {},
      createdAt: new Date(),
      dependencies: taskData.dependencies || [],
      resourceRequirements: taskData.resourceRequirements || [],
      ...(taskData.schedule && { schedule: taskData.schedule }),
      retryPolicy: taskData.retryPolicy || {
        maxAttempts: 3,
        backoffMs: 1000,
        backoffMultiplier: 2
      },
      timeout: taskData.timeout || 300000, // 5 minutes default
      tags: taskData.tags || [],
      estimatedDurationMs: taskData.estimatedDurationMs || 0,
      progressPercentage: 0,
      checkpoints: [],
      rollbackStrategy: taskData.rollbackStrategy || 'previous-checkpoint',
      metadata: taskData.metadata || {}
    };

    this.tasks.set(task.id, task);
    this.updateDependencyGraph(task);
    
    // Store in memory if manager available
    if (this.memoryManager) {
      await this.memoryManager.store(`task:${task.id}`, task);
    }

    // Emit creation event
    this.emit('task:created', { task });
    
    // Automatically schedule tasks that are ready to run
    await this.scheduleTask(task);

    return task;
  }

  /**
   * List tasks with filtering and sorting
   */
  async listTasks(
    filter?: TaskFilter,
    sort?: TaskSort,
    limit?: number,
    offset?: number
  ): Promise<{ tasks: WorkflowTask[]; total: number; hasMore: boolean }> {
    let filteredTasks = Array.from(this.tasks.values());

    // Apply filters
    if (filter) {
      filteredTasks = filteredTasks.filter(task => {
        if (filter.status && !filter.status.includes(task.status)) return false;
        if (filter.assignedAgent && !filter.assignedAgent.includes(task.assignedAgent || '')) return false;
        if (filter.priority) {
          if (filter.priority.min !== undefined && task.priority < filter.priority.min) return false;
          if (filter.priority.max !== undefined && task.priority > filter.priority.max) return false;
        }
        if (filter.tags && !filter.tags.some(tag => task.tags.includes(tag))) return false;
        if (filter.createdAfter && task.createdAt < filter.createdAfter) return false;
        if (filter.createdBefore && task.createdAt > filter.createdBefore) return false;
        if (filter.dueBefore && task.schedule?.deadline && task.schedule.deadline > filter.dueBefore) return false;
        if (filter.search && !this.matchesSearch(task, filter.search)) return false;
        return true;
      });
    }

    // Apply sorting
    if (sort) {
      filteredTasks.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case 'createdAt':
            comparison = a.createdAt.getTime() - b.createdAt.getTime();
            break;
          case 'priority':
            comparison = a.priority - b.priority;
            break;
          case 'deadline':
            const aDeadline = a.schedule?.deadline?.getTime() || 0;
            const bDeadline = b.schedule?.deadline?.getTime() || 0;
            comparison = aDeadline - bDeadline;
            break;
          case 'estimatedDuration':
            comparison = (a.estimatedDurationMs || 0) - (b.estimatedDurationMs || 0);
            break;
          default:
            comparison = 0;
        }
        
        // Apply direction
        return sort.direction === 'desc' ? -comparison : comparison;
      });
    }

    const total = filteredTasks.length;
    const startIndex = offset || 0;
    const endIndex = limit ? startIndex + limit : filteredTasks.length;
    const tasks = filteredTasks.slice(startIndex, endIndex);

    return {
      tasks,
      total,
      hasMore: endIndex < total
    };
  }

  /**
   * Get detailed task status with progress and metrics
   */
  async getTaskStatus(taskId: string): Promise<{
    task: WorkflowTask;
    execution?: TaskExecution;
    dependencies: { task: WorkflowTask; satisfied: boolean }[];
    dependents: WorkflowTask[];
    resourceStatus: { required: ResourceRequirement; available: boolean; allocated: boolean }[];
  } | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const execution = this.executions.get(taskId);
    
    // Get dependency status
    const dependencies = await Promise.all(
      task.dependencies.map(async dep => {
        const depTask = this.tasks.get(dep.taskId);
        if (!depTask) throw new Error(`Dependency task ${dep.taskId} not found`);
        const satisfied = this.isDependencySatisfied(dep, depTask);
        return { task: depTask, satisfied };
      })
    );

    // Get dependent tasks
    const dependents = Array.from(this.tasks.values()).filter(t => 
      t.dependencies.some(dep => dep.taskId === taskId)
    );

    // Get resource status
    const resourceStatus = task.resourceRequirements.map(req => {
      const resource = this.resources.get(req.resourceId);
      return {
        required: req,
        available: !!resource,
        allocated: resource?.lockedBy === taskId
      };
    });

    return {
      task,
      ...(execution && { execution }),
      dependencies,
      dependents,
      resourceStatus
    };
  }

  /**
   * Cancel task with rollback and cleanup
   */
  async cancelTask(taskId: string, reason: string = 'User requested', rollback: boolean = true, _cancelledInThisChain: Set<string> = new Set()): Promise<void> {
    // Prevent circular cancellation
    if (_cancelledInThisChain.has(taskId)) {
      return;
    }
    _cancelledInThisChain.add(taskId);

    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.status === 'completed') {
      throw new Error(`Cannot cancel completed task ${taskId}`);
    }

    this.cancelledTasks.add(taskId);
    
    // Stop running execution
    if (this.runningTasks.has(taskId)) {
      this.runningTasks.delete(taskId);
      const execution = this.executions.get(taskId);
      if (execution) {
        execution.status = 'cancelled';
        execution.completedAt = new Date();
      }
    }

    // Release resources
    await this.releaseTaskResources(taskId);

    // Perform rollback if requested
    if (rollback && task.checkpoints.length > 0) {
      await this.rollbackTask(task);
    }

    // Update task status
    task.status = 'cancelled';
    task.metadata = { ...task.metadata, cancellationReason: reason, cancelledAt: new Date() };

    // Update memory
    if (this.memoryManager) {
      await this.memoryManager.store(`task:${taskId}`, task);
    }

    // Remove event emission to prevent circular dependencies
    // this.emit('task:cancelled', { taskId, reason });

    // Cancel dependent tasks if configured
    const dependents = Array.from(this.tasks.values()).filter(t => 
      t.dependencies.some(dep => dep.taskId === taskId)
    );

    for (const dependent of dependents) {
      if (dependent.status === 'pending' || dependent.status === 'queued') {
        await this.cancelTask(dependent.id, `Dependency ${taskId} was cancelled`, true, _cancelledInThisChain);
      }
    }
  }

  /**
   * Execute workflow with parallel processing
   */
  async executeWorkflow(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    
    // Add all workflow tasks
    for (const task of workflow.tasks) {
      this.tasks.set(task.id, task);
      this.updateDependencyGraph(task);
    }

    // Start execution with parallel processing
    await this.processWorkflow(workflow);
  }

  /**
   * Create workflow from tasks
   */
  async createWorkflow(workflowData: Partial<Workflow>): Promise<Workflow> {
    const workflow: Workflow = {
      id: workflowData.id || generateId('workflow'),
      name: workflowData.name || 'Unnamed Workflow',
      description: workflowData.description || '',
      version: workflowData.version || '1.0.0',
      tasks: workflowData.tasks || [],
      variables: workflowData.variables || {},
      parallelism: workflowData.parallelism || {
        maxConcurrent: this.maxConcurrent,
        strategy: 'priority-based'
      },
      errorHandling: workflowData.errorHandling || {
        strategy: 'fail-fast',
        maxRetries: 3
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: workflowData.createdBy || 'system'
    };

    this.workflows.set(workflow.id, workflow);
    
    if (this.memoryManager) {
      await this.memoryManager.store(`workflow:${workflow.id}`, workflow);
    }

    return workflow;
  }

  /**
   * List all workflows
   */
  async listWorkflows(): Promise<Workflow[]> {
    return Array.from(this.workflows.values());
  }

  /**
   * Start the task scheduler
   */
  public startTaskScheduler(): void {
    if (this.schedulerTimer !== null) {
      return;
    }
    
    this.log('info', 'Starting task scheduler');
    
    this.schedulerTimer = setInterval(() => {
      this.runScheduler();
    }, this.schedulerIntervalMs);
  }
  
  /**
   * Stop the task scheduler
   */
  public stopTaskScheduler(): void {
    if (this.schedulerTimer === null) {
      return;
    }
    
    this.log('info', 'Stopping task scheduler');
    
    clearInterval(this.schedulerTimer);
    this.schedulerTimer = null;
  }
  
  /**
   * Main scheduler run function
   */
  private async runScheduler(): Promise<void> {
    if (this.schedulerRunning) {
      return;
    }
    
    try {
      this.schedulerRunning = true;
      this.lastSchedulerRun = Date.now();
      
      // Process scheduled tasks
      await this.processScheduledTasks();
      
      // Process ready tasks
      await this.processReadyTasks();
      
      // Check for timed out tasks
      await this.checkTimeoutTasks();
      
    } catch (error) {
      this.log('error', 'Scheduler error', error);
    } finally {
      this.schedulerRunning = false;
    }
  }
  
  /**
   * Process scheduled tasks that are ready to start
   */
  private async processScheduledTasks(): Promise<void> {
    const now = new Date();
    
    for (const task of Array.from(this.tasks.values())) {
      // Skip tasks that are already queued or running
      if (task.status !== 'pending') continue;
      
      // Check if task is scheduled to start now
      if (task.schedule?.startTime && task.schedule.startTime <= now) {
        await this.scheduleTask(task);
      }
    }
  }
  
  /**
   * Process tasks in ready queue
   */
  private async processReadyTasks(): Promise<void> {
    // Stop if we're already at max concurrent tasks
    if (this.runningTasks.size >= this.maxConcurrent) {
      return;
    }
    
    // Get tasks from ready queue, respecting max concurrent limit
    const availableSlots = this.maxConcurrent - this.runningTasks.size;
    const tasksToRun = Math.min(availableSlots, this.readyQueue.length);
    
    if (tasksToRun <= 0) return;
    
    // Sort queue by priority before processing
    this.sortReadyQueue();
    
    for (let i = 0; i < tasksToRun; i++) {
      const taskId = this.readyQueue.shift();
      if (!taskId) break;
      
      const task = this.tasks.get(taskId);
      if (!task) continue;
      
      // Execute task
      await this.executeTask(task);
    }
  }
  
  /**
   * Sort the ready queue by priority
   */
  private sortReadyQueue(): void {
    // Create a sorted copy of the queue
    const sortedQueue = [...this.readyQueue].sort((a, b) => {
      const taskA = this.tasks.get(a);
      const taskB = this.tasks.get(b);
      
      if (!taskA || !taskB) return 0;
      
      // Sort by priority (higher priority first)
      return taskB.priority - taskA.priority;
    });
    
    // Replace the queue with the sorted version
    this.readyQueue = sortedQueue;
  }
  
  /**
   * Check and acquire required resources for a task
   */
  private async checkResourceAvailability(task: WorkflowTask): Promise<boolean> {
    // Check each required resource
    for (const req of task.resourceRequirements) {
      const resource = this.resources.get(req.resourceId);
      
      // Resource doesn't exist
      if (!resource) {
        return false;
      }
      
      // Resource is locked exclusively by another task
      if (resource.lockedBy && resource.lockedBy !== task.id) {
        return false;
      }
      
      // For exclusive resources, check if they're in use
      if (req.exclusive && resource.inUseBy && resource.inUseBy.length > 0) {
        return false;
      }
      
      // Check capacity for non-exclusive resources
      if (!req.exclusive && resource.capacity !== undefined) {
        const inUse = resource.inUseBy?.length || 0;
        if (inUse >= resource.capacity) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Acquire resources needed for a task
   */
  private async acquireTaskResources(task: WorkflowTask): Promise<boolean> {
    // First check if all resources are available
    const allAvailable = await this.checkResourceAvailability(task);
    if (!allAvailable) return false;
    
    // Then acquire each resource
    for (const req of task.resourceRequirements) {
      const resource = this.resources.get(req.resourceId);
      if (!resource) continue;
      
      if (req.exclusive) {
        resource.lockedBy = task.id;
      }
      
      if (!resource.inUseBy) {
        resource.inUseBy = [];
      }
      
      resource.inUseBy.push(task.id);
    }
    
    return true;
  }
  
  /**
   * Execute a task
   */
  private async executeTask(task: WorkflowTask): Promise<void> {
    // Mark task as running
    task.status = 'running';
    this.runningTasks.add(task.id);
    
    // Create execution record
    const execution: TaskExecution = {
      id: generateId('exec'),
      taskId: task.id,
      agentId: task.assignedAgent || 'system',
      startedAt: new Date(),
      status: 'running',
      progress: 0,
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskIO: 0,
        networkIO: 0,
        customMetrics: {}
      },
      logs: []
    };
    
    this.executions.set(task.id, execution);
    
    // Update in memory store
    if (this.memoryManager) {
      await this.memoryManager.store(`task:${task.id}`, task);
      await this.memoryManager.store(`execution:${task.id}`, execution);
    }
    
    try {
      // Acquire required resources
      const resourcesAcquired = await this.acquireTaskResources(task);
      if (!resourcesAcquired) {
        throw new Error(`Failed to acquire resources for task ${task.id}`);
      }
      
      // Create initial checkpoint
      await this.createTaskCheckpoint(task, 'Execution started', {});
      
      // Emit event that task has started
      this.emit('task:running', { taskId: task.id, execution });
      
      this.log('info', `Task ${task.id} started execution`);
      
      // In a real implementation, this would actually execute the task via an agent
      // or external system. This is an abstract base implementation.
      // Subclasses should override simulateTaskExecution() for actual execution.
      
      let result;
      try {
        result = await this.simulateTaskExecution(task, execution);
      } catch (executionError) {
        const errorMessage = executionError instanceof Error ? executionError.message : String(executionError);
        throw new Error(`Task execution error: ${errorMessage}`);
      }
      
      // Task completed successfully
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.progress = 100;
      
      task.status = 'completed';
      task.progressPercentage = 100;
      task.actualDurationMs = execution.completedAt.getTime() - execution.startedAt.getTime();
      
      // Create final checkpoint
      await this.createTaskCheckpoint(task, 'Execution completed', { result });
      
      // Update in memory store
      if (this.memoryManager) {
        await this.memoryManager.store(`task:${task.id}`, task);
        await this.memoryManager.store(`execution:${task.id}`, execution);
      }
      
      // Release task resources
      await this.releaseTaskResources(task.id);
      
      // Remove from running tasks
      this.runningTasks.delete(task.id);
      
      // Emit completion event
      this.emit('task:completed', { taskId: task.id, result });
      
      this.log('info', `Task ${task.id} completed successfully`);
      
      // Check if any pending tasks can now be scheduled
      await this.checkDependentTasks(task.id);
      
    } catch (error) {
      // Task failed
      execution.status = 'failed';
      execution.completedAt = new Date();
      
      task.status = 'failed';
      const errorMessage = error instanceof Error ? error.message : String(error);
      task.metadata = { 
        ...task.metadata, 
        error: errorMessage,
        failedAt: new Date()
      };
      
      // Update in memory store
      if (this.memoryManager) {
        await this.memoryManager.store(`task:${task.id}`, task);
        await this.memoryManager.store(`execution:${task.id}`, execution);
      }
      
      // Release task resources
      await this.releaseTaskResources(task.id);
      
      // Remove from running tasks
      this.runningTasks.delete(task.id);
      
      // Add log entry
      this.addExecutionLog(execution, 'error', `Task failed: ${errorMessage}`);
      
      // Emit failure event
      this.emit('task:failed', { taskId: task.id, error });
      
      this.log('error', `Task ${task.id} failed`, error);
      
      // Check if task should be retried
      const taskError = error instanceof Error ? error : new Error(String(error));
      await this.handleTaskRetry(task, taskError);
    }
  }
  
  /**
   * Handle task retry logic
   */
  private async handleTaskRetry(task: WorkflowTask, error: Error): Promise<void> {
    const retryCount = (task.metadata?.retryCount as number) || 0;
    
    if (retryCount >= task.retryPolicy!.maxAttempts) {
      this.log('info', `Task ${task.id} retry limit reached, giving up`);
      return;
    }
    
    // Calculate backoff time
    const backoffMs = task.retryPolicy!.backoffMs * Math.pow(
      task.retryPolicy!.backoffMultiplier,
      retryCount
    );
    
    // Update retry count
    task.metadata = { ...task.metadata, retryCount: retryCount + 1 };
    
    // Schedule retry after backoff
    this.log('info', `Scheduling retry for task ${task.id} in ${backoffMs}ms`);
    
    setTimeout(async () => {
      // Reset task state for retry
      task.status = 'pending';
      if (task.metadata) {
        delete task.metadata.error;
        delete task.metadata.failedAt;
      }
      
      if (this.memoryManager) {
        await this.memoryManager.store(`task:${task.id}`, task);
      }
      
      // Schedule the task again
      await this.scheduleTask(task);
      
      this.log('info', `Task ${task.id} scheduled for retry ${retryCount + 1}/${task.retryPolicy!.maxAttempts}`);
    }, backoffMs);
  }
  
  /**
   * Simulate actual task execution
   */
  private async simulateTaskExecution(task: WorkflowTask, execution: TaskExecution): Promise<any> {
    // For simulation, we'll use the estimated duration or default to a random duration
    const duration = task.estimatedDurationMs || (1000 + Math.random() * 5000);
    
    // Simulate progress updates
    const progressInterval = Math.max(duration / 10, 100); // Update at least 10 times or every 100ms
    
    const startTime = Date.now();
    let lastProgressUpdate = startTime;
    
    // Add initial log
    this.addExecutionLog(execution, 'info', `Starting task execution: ${task.description}`);
    
    return new Promise((resolve, reject) => {
      // Set up progress tracking
      const progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(Math.floor((elapsed / duration) * 100), 99); // Cap at 99% until complete
        
        execution.progress = progress;
        task.progressPercentage = progress;
        
        // Update metrics
        execution.metrics = {
          ...execution.metrics,
          cpuUsage: 10 + Math.random() * 90, // Simulate varying CPU usage
          memoryUsage: 50 + Math.random() * 50, // Simulate memory usage
          diskIO: Math.random() * 100,
          networkIO: Math.random() * 100
        };
        
        // Add log entry for significant progress changes
        if (Date.now() - lastProgressUpdate > 1000) { // Max once per second
          this.addExecutionLog(execution, 'info', `Task progress: ${progress}%`);
          lastProgressUpdate = Date.now();
          
          // Emit progress event
          this.emit('task:progress', { 
            taskId: task.id, 
            progress, 
            metrics: execution.metrics 
          });
        }
        
        // Simulate checkpoint at 50%
        if (progress >= 50 && !task.checkpoints.some(cp => cp.description.includes('50%'))) {
          this.createTaskCheckpoint(task, 'Execution 50% complete', { 
            progress, 
            timestamp: new Date() 
          });
        }
        
      }, progressInterval);
      
      // Simulate task completion or failure
      setTimeout(() => {
        clearInterval(progressTimer);
        
        // 90% success rate in simulation
        if (Math.random() < 0.9) {
          // Success
          const result = {
            success: true,
            data: { taskId: task.id, executionTime: Date.now() - startTime }
          };
          resolve(result);
        } else {
          // Simulated failure
          reject(new Error('Simulated task failure'));
        }
      }, duration);
      
      // Also handle timeout
      if (task.timeout) {
        setTimeout(() => {
          clearInterval(progressTimer);
          reject(new Error('Task execution timed out'));
        }, task.timeout);
      }
    });
  }
  
  /**
   * Create a task checkpoint
   */
  private async createTaskCheckpoint(
    task: WorkflowTask, 
    description: string, 
    state: Record<string, unknown>
  ): Promise<TaskCheckpoint> {
    const checkpoint: TaskCheckpoint = {
      id: generateId('checkpoint'),
      timestamp: new Date(),
      description,
      state,
      artifacts: []
    };
    
    task.checkpoints.push(checkpoint);
    
    // Update in memory
    if (this.memoryManager) {
      await this.memoryManager.store(`task:${task.id}`, task);
    }
    
    // Emit event
    this.emit('task:checkpoint', { taskId: task.id, checkpoint });
    
    return checkpoint;
  }
  
  /**
   * Add a log entry to an execution
   */
  private addExecutionLog(
    execution: TaskExecution, 
    level: 'debug' | 'info' | 'warn' | 'error', 
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const log: TaskLog = {
      timestamp: new Date(),
      level,
      message,
      metadata
    };
    
    execution.logs.push(log);
    
    // Limit log size
    if (execution.logs.length > 1000) {
      execution.logs = execution.logs.slice(-1000);
    }
  }
  
  /**
   * Check for tasks that have timed out
   */
  private async checkTimeoutTasks(): Promise<void> {
    const now = Date.now();
    
    for (const taskId of Array.from(this.runningTasks)) {
      const task = this.tasks.get(taskId);
      const execution = this.executions.get(taskId);
      
      if (!task || !execution || !execution.startedAt || !task.timeout) continue;
      
      const runningTime = now - execution.startedAt.getTime();
      
      if (runningTime > task.timeout) {
        this.log('warn', `Task ${taskId} timed out after ${runningTime}ms`);
        
        // Add log entry
        this.addExecutionLog(execution, 'error', `Task timed out after ${runningTime}ms`);
        
        // Mark as failed
        execution.status = 'failed';
        execution.completedAt = new Date();
        
        task.status = 'failed';
        task.metadata = { 
          ...task.metadata, 
          error: 'Task execution timed out', 
          failedAt: new Date() 
        };
        
        // Update in memory store
        if (this.memoryManager) {
          await this.memoryManager.store(`task:${task.id}`, task);
          await this.memoryManager.store(`execution:${task.id}`, execution);
        }
        
        // Release resources
        await this.releaseTaskResources(taskId);
        
        // Remove from running tasks
        this.runningTasks.delete(taskId);
        
        // Emit failure event
        this.emit('task:failed', { 
          taskId, 
          error: new Error('Task execution timed out') 
        });
        
        // Check if task should be retried
        await this.handleTaskRetry(task, new Error('Task execution timed out'));
      }
    }
  }
  
  /**
   * Check for dependent tasks that can be scheduled
   */
  private async checkDependentTasks(taskId: string): Promise<void> {
    const dependents = this.dependencyGraph.get(taskId);
    if (!dependents || dependents.size === 0) return;
    
    // Check each dependent task to see if it can be scheduled
    for (const depTaskId of Array.from(dependents)) {
      const depTask = this.tasks.get(depTaskId);
      if (!depTask || depTask.status !== 'pending') continue;
      
      // Check if all dependencies are satisfied
      if (this.areDependenciesMet(depTask)) {
        await this.scheduleTask(depTask);
      }
    }
  }
  
  /**
   * Handle task progress updates
   */
  private handleTaskProgress(data: { taskId: string; progress: number; metrics: TaskMetrics }): void {
    const { taskId, progress, metrics } = data;
    
    const task = this.tasks.get(taskId);
    if (task) {
      task.progressPercentage = progress;
      
      // No need to store progress updates to memory - too frequent
    }
  }
  
  /**
   * Handle task checkpoint events
   */
  private handleTaskCheckpoint(data: { taskId: string; checkpoint: TaskCheckpoint }): void {
    // This is already handled directly in createTaskCheckpoint
    // Keeping the handler for completeness of event system
  }
  
  /**
   * Simplified logging function
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, error?: any): void {
    if (!this.logger) return;
    
    switch (level) {
      case 'debug':
        this.logger.debug?.(message, error);
        break;
      case 'info':
        this.logger.info?.(message, error);
        break;
      case 'warn':
        this.logger.warn?.(message, error);
        break;
      case 'error':
        this.logger.error?.(message, error);
        break;
    }
  }

  private handleTaskCreated(data: { task: WorkflowTask }): void {
    this.log('info', `Task created: ${data.task.id} - ${data.task.description}`);
  }

  private handleTaskCompleted(data: { taskId: string; result: any }): void {
    const task = this.tasks.get(data.taskId);
    if (task) {
      task.status = 'completed';
      task.progressPercentage = 100;
      task.actualDurationMs = Date.now() - task.createdAt.getTime();
      
      this.log('info', `Task completed: ${task.id} - ${task.description}`);
      
      // Trigger scheduler to process next tasks
      this.processReadyTasks();
    }
  }

  private handleTaskFailed(data: { taskId: string; error: Error }): void {
    const task = this.tasks.get(data.taskId);
    if (task) {
      task.status = 'failed';
      this.log('error', `Task failed: ${task.id} - ${data.error.message}`);
      
      // Trigger scheduler to process next tasks
      this.processReadyTasks();
    }
  }

  private handleTaskCancelled(data: { taskId: string; reason: string }): void {
    const task = this.tasks.get(data.taskId);
    if (task) {
      task.status = 'cancelled';
      this.log('info', `Task cancelled: ${task.id} - ${data.reason}`);
      
      // Trigger scheduler to process next tasks
      this.processReadyTasks();
    }
  }

  private updateDependencyGraph(task: WorkflowTask): void {
    // Create edges for dependencies
    for (const dep of task.dependencies) {
      if (!this.dependencyGraph.has(dep.taskId)) {
        this.dependencyGraph.set(dep.taskId, new Set());
      }
      this.dependencyGraph.get(dep.taskId)!.add(task.id);
    }
    
    // Ensure task exists in graph
    if (!this.dependencyGraph.has(task.id)) {
      this.dependencyGraph.set(task.id, new Set());
    }
  }

  /**
   * Schedule a task for execution if it's ready to run
   */
  private async scheduleTask(task: WorkflowTask): Promise<void> {
    // Skip if task is already queued, running or completed
    if (['queued', 'running', 'completed', 'failed', 'cancelled'].includes(task.status)) {
      return;
    }
    
    // Add to ready queue if no dependencies or all dependencies met
    if (task.dependencies.length === 0 || this.areDependenciesMet(task)) {
      // Check if task has scheduled start time that's in the future
      if (task.schedule?.startTime && task.schedule.startTime > new Date()) {
        this.log('debug', `Task ${task.id} scheduled to start at ${task.schedule.startTime}`);
        return;
      }
      
      // Check resource availability if the task has resource requirements
      if (task.resourceRequirements.length > 0) {
        const resourcesAvailable = await this.checkResourceAvailability(task);
        if (!resourcesAvailable) {
          this.log('debug', `Task ${task.id} waiting for resources`);
          return;
        }
      }
      
      // Queue the task
      this.readyQueue.push(task.id);
      task.status = 'queued';
      
      if (this.memoryManager) {
        await this.memoryManager.store(`task:${task.id}`, task);
      }
      
      this.log('info', `Task ${task.id} added to ready queue`);
      
      // Trigger scheduler to process queued tasks
      this.processReadyTasks();
    } else {
      this.log('debug', `Task ${task.id} waiting for dependencies`);
    }
  }

  private matchesSearch(task: WorkflowTask, search: string): boolean {
    const searchLower = search.toLowerCase();
    return (
      task.description.toLowerCase().includes(searchLower) ||
      task.type.toLowerCase().includes(searchLower) ||
      task.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
      (task.assignedAgent ? task.assignedAgent.toLowerCase().includes(searchLower) : false)
    );
  }

  private isDependencySatisfied(dependency: TaskDependency, depTask: WorkflowTask): boolean {
    switch (dependency.type) {
      case 'finish-to-start':
        return depTask.status === 'completed';
      case 'start-to-start':
        return ['running', 'completed'].includes(depTask.status);
      case 'finish-to-finish':
        return depTask.status === 'completed';
      case 'start-to-finish':
        return ['running', 'completed'].includes(depTask.status);
      default:
        return depTask.status === 'completed';
    }
  }

  private async releaseTaskResources(taskId: string): Promise<void> {
    // Release all resources locked by this task
    for (const [resourceId, resource] of Array.from(this.resources.entries())) {
      if (resource.lockedBy === taskId) {
        resource.lockedBy = undefined;
        (resource as any).lastUsed = new Date();
      }
    }
  }

  private async rollbackTask(task: WorkflowTask): Promise<void> {
    if (task.checkpoints.length === 0) {
      return;
    }

    const lastCheckpoint = task.checkpoints[task.checkpoints.length - 1];
    
    switch (task.rollbackStrategy) {
      case 'previous-checkpoint':
        // Restore state from last checkpoint
        this.taskState.set(task.id, { ...lastCheckpoint.state });
        break;
      case 'initial-state':
        // Restore to initial state (first checkpoint or empty)
        const initialCheckpoint = task.checkpoints[0];
        this.taskState.set(task.id, initialCheckpoint ? { ...initialCheckpoint.state } : {});
        break;
      case 'custom':
        // Handle custom rollback logic
        if (task.customRollbackHandler) {
          // In a real implementation, this would call the custom handler
          this.logger?.info(`Custom rollback handler: ${task.customRollbackHandler}`);
        }
        break;
    }
  }

  private areDependenciesMet(task: WorkflowTask): boolean {
    return task.dependencies.every(dep => {
      const depTask = this.tasks.get(dep.taskId);
      return depTask && this.isDependencySatisfied(dep, depTask);
    });
  }

  private async processWorkflow(workflow: Workflow): Promise<void> {
    // Simple workflow processing - in a real implementation this would be more sophisticated
    const pendingTasks = workflow.tasks.filter(t => t.status === 'pending');
    
    for (const task of pendingTasks) {
      if (this.areDependenciesMet(task)) {
        this.scheduleTask(task);
      }
    }
  }
}