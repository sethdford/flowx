/**
 * Background executor for long-running tasks with detached processes and persistence
 * Handles task queuing, process management, and state persistence
 */

import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { generateId } from '../utils/helpers.js';
import type { CLILogger } from '../cli/core/application.js';

export interface BackgroundExecutorOptions {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  logPath: string;
  enablePersistence: boolean;
  enableWorkStealing?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ExecutorTask {
  id: string;
  name: string;
  type: string;
  payload: any;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  retryAttempts: number;
  currentRetry: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  executorId?: string;
  result?: any;
  error?: string;
  dependencies: string[];
  tags: string[];
}

export interface ExecutorWorker {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'offline';
  currentTask?: string;
  capabilities: string[];
  performance: {
    tasksCompleted: number;
    averageTime: number;
    successRate: number;
    lastActivity: Date;
  };
}

export class BackgroundExecutor extends EventEmitter {
  private tasks = new Map<string, ExecutorTask>();
  private workers = new Map<string, ExecutorWorker>();
  private queue: string[] = [];
  private running = new Set<string>();
  private options: BackgroundExecutorOptions;
  private logger?: CLILogger;
  private isStarted = false;
  private persistenceInterval?: NodeJS.Timeout;

  constructor(options: BackgroundExecutorOptions, logger?: CLILogger) {
    super();
    this.options = {
      retryAttempts: 3,
      retryDelay: 1000,
      enableWorkStealing: true,
      ...options,
    };
    this.logger = logger;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('BackgroundExecutor is already started');
    }

    this.logger?.info('Starting BackgroundExecutor', { options: this.options });
    
    // Ensure log directory exists
    if (this.options.enablePersistence) {
      await fs.mkdir(this.options.logPath, { recursive: true });
      await this.loadPersistedTasks();
      this.startPersistenceInterval();
    }

    this.isStarted = true;
    this.processQueue();
    
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.logger?.info('Stopping BackgroundExecutor');
    this.isStarted = false;

    // Cancel all running tasks
    for (const taskId of this.running) {
      await this.cancelTask(taskId);
    }

    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
    }

    if (this.options.enablePersistence) {
      await this.persistTasks();
    }

    this.emit('stopped');
  }

  async submitTask(task: Omit<ExecutorTask, 'id' | 'status' | 'createdAt' | 'currentRetry'>): Promise<string> {
    const taskId = generateId('task');
    
         const executorTask: ExecutorTask = {
       id: taskId,
       status: 'queued',
       createdAt: new Date(),
       currentRetry: 0,
       ...task,
       dependencies: task.dependencies || [],
       tags: task.tags || [],
     };

    this.tasks.set(taskId, executorTask);
    
    // Check if dependencies are satisfied
    if (this.areDependenciesSatisfied(executorTask)) {
      this.queue.push(taskId);
      this.logger?.info('Task queued', { taskId, name: task.name, type: task.type });
    } else {
      this.logger?.info('Task waiting for dependencies', { taskId, dependencies: task.dependencies });
    }

    this.emit('taskSubmitted', executorTask);
    
    if (this.isStarted) {
      this.processQueue();
    }

    return taskId;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return false;
    }

    task.status = 'cancelled';
    task.completedAt = new Date();

    // Remove from queue if queued
    const queueIndex = this.queue.indexOf(taskId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
    }

    // Remove from running if running
    this.running.delete(taskId);

    // Free up worker if assigned
    if (task.executorId) {
      const worker = this.workers.get(task.executorId);
      if (worker) {
        worker.status = 'idle';
        worker.currentTask = undefined;
      }
    }

    this.logger?.info('Task cancelled', { taskId });
    this.emit('taskCancelled', task);

    return true;
  }

  async getTaskStatus(taskId: string): Promise<ExecutorTask | null> {
    return this.tasks.get(taskId) || null;
  }

  getSystemMetrics(): any {
    const taskStats = Array.from(this.tasks.values()).reduce(
      (stats, task) => {
        stats[task.status] = (stats[task.status] || 0) + 1;
        return stats;
      },
      {} as Record<string, number>
    );

    const workerStats = Array.from(this.workers.values()).reduce(
      (stats, worker) => {
        stats[worker.status] = (stats[worker.status] || 0) + 1;
        return stats;
      },
      {} as Record<string, number>
    );

    return {
      isStarted: this.isStarted,
      tasks: {
        total: this.tasks.size,
        queued: this.queue.length,
        running: this.running.size,
        byStatus: taskStats,
      },
      workers: {
        total: this.workers.size,
        byStatus: workerStats,
      },
      performance: {
        averageTaskTime: this.calculateAverageTaskTime(),
        successRate: this.calculateSuccessRate(),
        throughput: this.calculateThroughput(),
      },
    };
  }

  registerWorker(name: string, capabilities: string[] = []): string {
    const workerId = generateId('worker');
    
    const worker: ExecutorWorker = {
      id: workerId,
      name,
      status: 'idle',
      capabilities,
      performance: {
        tasksCompleted: 0,
        averageTime: 0,
        successRate: 1.0,
        lastActivity: new Date(),
      },
    };

    this.workers.set(workerId, worker);
    
    this.logger?.info('Worker registered', { workerId, name, capabilities });
    this.emit('workerRegistered', worker);

    // Try to assign tasks to new worker
    if (this.isStarted) {
      this.processQueue();
    }

    return workerId;
  }

  unregisterWorker(workerId: string): boolean {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return false;
    }

    // Cancel current task if any
    if (worker.currentTask) {
      this.cancelTask(worker.currentTask);
    }

    this.workers.delete(workerId);
    
    this.logger?.info('Worker unregistered', { workerId });
    this.emit('workerUnregistered', worker);

    return true;
  }

  private async processQueue(): Promise<void> {
    if (!this.isStarted || this.queue.length === 0) {
      return;
    }

    // Get available workers
    const availableWorkers = Array.from(this.workers.values()).filter(w => w.status === 'idle');
    
    if (availableWorkers.length === 0) {
      return;
    }

    // Process tasks up to the number of available workers
    const tasksToProcess = Math.min(
      this.queue.length,
      availableWorkers.length,
      this.options.maxConcurrentTasks - this.running.size
    );

    for (let i = 0; i < tasksToProcess; i++) {
      const taskId = this.queue.shift();
      if (!taskId) break;

      const task = this.tasks.get(taskId);
      if (!task) continue;

      // Find best worker for this task
      const worker = this.findBestWorkerForTask(task, availableWorkers);
      if (!worker) {
        // Put task back in queue
        this.queue.unshift(taskId);
        break;
      }

      // Assign task to worker
      task.status = 'running';
      task.startedAt = new Date();
      task.executorId = worker.id;
      worker.status = 'busy';
      worker.currentTask = taskId;
      worker.performance.lastActivity = new Date();

      this.running.add(taskId);

      this.logger?.info('Task started', { taskId, workerId: worker.id, taskName: task.name });
      this.emit('taskStarted', { task, worker });

      // Execute task asynchronously
      this.executeTask(task, worker).catch(error => {
        this.logger?.error('Task execution error', { taskId, error });
      });

      // Remove worker from available list
      const workerIndex = availableWorkers.indexOf(worker);
      if (workerIndex >= 0) {
        availableWorkers.splice(workerIndex, 1);
      }
    }
  }

  private async executeTask(task: ExecutorTask, worker: ExecutorWorker): Promise<void> {
    const startTime = Date.now();

    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), task.timeout);
      });

      // Execute the actual task (this would call the real task function)
      const resultPromise = this.executeTaskFunction(task);

      // Race between timeout and execution
      const result = await Promise.race([resultPromise, timeoutPromise]);

      // Task completed successfully
      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();
      
      const duration = Date.now() - startTime;
      
      // Update worker performance
      worker.performance.tasksCompleted++;
      worker.performance.averageTime = 
        (worker.performance.averageTime * (worker.performance.tasksCompleted - 1) + duration) / 
        worker.performance.tasksCompleted;
      worker.performance.lastActivity = new Date();

      this.logger?.info('Task completed', { taskId: task.id, duration, workerId: worker.id });
      this.emit('taskCompleted', { task, worker, duration });

    } catch (error) {
      // Task failed
      task.error = error instanceof Error ? error.message : String(error);
      
      // Retry logic
      if (task.currentRetry < task.retryAttempts) {
        task.currentRetry++;
        task.status = 'queued';
        
        // Delay before retry
        setTimeout(() => {
          this.queue.push(task.id);
          this.processQueue();
        }, this.options.retryDelay! * task.currentRetry);

        this.logger?.info('Task retry scheduled', { 
          taskId: task.id, 
          retry: task.currentRetry, 
          maxRetries: task.retryAttempts 
        });
        
      } else {
        task.status = 'failed';
        task.completedAt = new Date();
        
        // Update worker failure rate
        worker.performance.successRate = Math.max(0, worker.performance.successRate - 0.1);

        this.logger?.error('Task failed', { taskId: task.id, error: task.error, workerId: worker.id });
        this.emit('taskFailed', { task, worker, error });
      }
    } finally {
      // Free up worker
      worker.status = 'idle';
      worker.currentTask = undefined;
      this.running.delete(task.id);

      // Check for dependent tasks
      this.checkDependentTasks(task.id);

      // Continue processing queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private async executeTaskFunction(task: ExecutorTask): Promise<any> {
    // This is where we would execute the actual task
    // For now, simulate task execution
    
    const baseTime = 500; // 500ms base time
    const complexityMultiplier = task.priority === 'critical' ? 3 : task.priority === 'high' ? 2 : 1;
    const executionTime = baseTime * complexityMultiplier * (0.5 + Math.random());
    
    await new Promise(resolve => setTimeout(resolve, executionTime));
    
    // Simulate occasional failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error(`Simulated failure in ${task.type} task`);
    }

    return { 
      message: `Task ${task.name} completed successfully`,
      executionTime,
      payload: task.payload 
    };
  }

  private findBestWorkerForTask(task: ExecutorTask, availableWorkers: ExecutorWorker[]): ExecutorWorker | null {
    if (availableWorkers.length === 0) {
      return null;
    }

    // Score workers based on capabilities and performance
    const scoredWorkers = availableWorkers.map(worker => {
      let score = 0;
      
      // Capability matching
      if (worker.capabilities.includes(task.type)) {
        score += 10;
      }
      
      // Performance bonus
      score += worker.performance.successRate * 5;
      
      // Experience bonus
      score += Math.min(worker.performance.tasksCompleted / 10, 3);
      
      // Penalty for recent activity (load balancing)
      const timeSinceLastActivity = Date.now() - worker.performance.lastActivity.getTime();
      if (timeSinceLastActivity < 10000) { // 10 seconds
        score -= 2;
      }
      
      return { worker, score };
    });

    // Sort by score and return best worker
    scoredWorkers.sort((a, b) => b.score - a.score);
    return scoredWorkers[0]?.worker || null;
  }

  private areDependenciesSatisfied(task: ExecutorTask): boolean {
    return task.dependencies.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask?.status === 'completed';
    });
  }

  private checkDependentTasks(completedTaskId: string): void {
    // Find tasks waiting for this dependency
    const waitingTasks = Array.from(this.tasks.values()).filter(task => 
      task.status === 'queued' && 
      !this.queue.includes(task.id) &&
      task.dependencies.includes(completedTaskId)
    );

    for (const task of waitingTasks) {
      if (this.areDependenciesSatisfied(task)) {
        this.queue.push(task.id);
        this.logger?.info('Task dependencies satisfied', { taskId: task.id });
      }
    }
  }

  private calculateAverageTaskTime(): number {
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed');
    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const startTime = task.startedAt?.getTime() || 0;
      const endTime = task.completedAt?.getTime() || 0;
      return sum + (endTime - startTime);
    }, 0);

    return totalTime / completedTasks.length;
  }

  private calculateSuccessRate(): number {
    const finishedTasks = Array.from(this.tasks.values()).filter(t => 
      t.status === 'completed' || t.status === 'failed'
    );
    if (finishedTasks.length === 0) return 1.0;

    const successfulTasks = finishedTasks.filter(t => t.status === 'completed').length;
    return successfulTasks / finishedTasks.length;
  }

  private calculateThroughput(): number {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentTasks = Array.from(this.tasks.values()).filter(task => 
      task.completedAt && 
      task.completedAt.getTime() > oneHourAgo &&
      task.status === 'completed'
    );

    return recentTasks.length; // Tasks completed in the last hour
  }

  private async loadPersistedTasks(): Promise<void> {
    try {
      const tasksFile = path.join(this.options.logPath, 'tasks.json');
      const data = await fs.readFile(tasksFile, 'utf-8');
      const persistedTasks = JSON.parse(data);

      for (const taskData of persistedTasks) {
        // Convert date strings back to Date objects
        taskData.createdAt = new Date(taskData.createdAt);
        if (taskData.startedAt) taskData.startedAt = new Date(taskData.startedAt);
        if (taskData.completedAt) taskData.completedAt = new Date(taskData.completedAt);

        this.tasks.set(taskData.id, taskData);

        // Re-queue incomplete tasks
        if (taskData.status === 'queued' || taskData.status === 'running') {
          taskData.status = 'queued';
          if (this.areDependenciesSatisfied(taskData)) {
            this.queue.push(taskData.id);
          }
        }
      }

      this.logger?.info('Loaded persisted tasks', { count: persistedTasks.length });

    } catch (error) {
      this.logger?.warn('Failed to load persisted tasks', { error });
    }
  }

  private async persistTasks(): Promise<void> {
    try {
      const tasksFile = path.join(this.options.logPath, 'tasks.json');
      const tasksArray = Array.from(this.tasks.values());
      await fs.writeFile(tasksFile, JSON.stringify(tasksArray, null, 2));
      
      this.logger?.debug('Tasks persisted', { count: tasksArray.length });

    } catch (error) {
      this.logger?.error('Failed to persist tasks', { error });
    }
  }

  private startPersistenceInterval(): void {
    this.persistenceInterval = setInterval(() => {
      this.persistTasks();
    }, 30000); // Persist every 30 seconds
  }
}