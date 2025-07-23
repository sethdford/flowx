/**
 * Task execution engine with timeout handling, retry logic, and resource management
 * Comprehensive execution system with circuit breakers, resource monitoring, and queue management
 */

import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import { TaskDefinition, TaskResult, AgentState, TaskError } from "../swarm/types.js";
import { ILogger } from "../core/logger.js";
import { IEventBus } from "../core/event-bus.js";
import { CircuitBreaker, CircuitBreakerManager } from "./circuit-breaker.js";
import { generateId } from "../utils/helpers.js";
import { getTaskTimeout } from '../config/timeout-config.js';

export interface TaskExecutorConfig {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  retryAttempts: number;
  retryBackoffBase: number;
  retryBackoffMax: number;
  resourceLimits: {
    memory: number;
    cpu: number;
    disk: number;
  };
  enableCircuitBreaker: boolean;
  enableResourceMonitoring: boolean;
  enableProcessPooling: boolean;
  enableBackgroundExecution: boolean;
  enablePersistence: boolean;
  killTimeout: number;
  logPath: string;
  cleanupInterval: number;
  healthCheckInterval: number;
}

export interface ExecutionContext {
  taskId: string;
  agentId: string;
  process?: ChildProcess;
  startTime: Date;
  timeout?: NodeJS.Timeout;
  resources: ResourceUsage;
  circuitBreaker?: CircuitBreaker;
  priority: number;
  detached: boolean;
  persistenceEnabled: boolean;
}

export interface ResourceUsage {
  memory: number;
  cpu: number;
  disk: number;
  network: number;
  lastUpdated: Date;
}

export interface TaskExecutionResult {
  success: boolean;
  result?: TaskResult;
  error?: TaskError;
  executionTime: number;
  resourcesUsed: ResourceUsage;
  retryCount: number;
  queueTime?: number;
  processId?: number;
}

export interface BackgroundTask {
  id: string;
  type: 'claude-spawn' | 'script' | 'command' | 'workflow';
  command: string;
  args: string[];
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
    retries?: number;
    detached?: boolean;
    priority?: number;
    task?: TaskDefinition;
    agent?: AgentState;
  };
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  pid?: number;
  output?: string;
  error?: string;
  result?: TaskResult;
  startTime?: Date;
  endTime?: Date;
  retryCount: number;
  queueTime?: number;
  executionTime?: number;
  resourcesUsed?: ResourceUsage;
  processId?: number;
}

export interface ProcessPool {
  available: ChildProcess[];
  busy: Map<string, ChildProcess>;
  maxSize: number;
  createProcess: () => ChildProcess;
  destroyProcess: (process: ChildProcess) => void;
}

/**
 * Comprehensive task execution engine with resource management and background processing
 */
export class TaskExecutionEngine extends EventEmitter {
  private logger: ILogger;
  private eventBus: IEventBus;
  private config: TaskExecutorConfig;
  
  // Core execution tracking
  private runningTasks = new Map<string, ExecutionContext>();
  private queuedTasks: TaskDefinition[] = [];
  private backgroundTasks = new Map<string, BackgroundTask>();
  private backgroundProcesses = new Map<string, ChildProcess>();
  private backgroundQueue: string[] = [];
  
  // Resource management
  private circuitBreakerManager: CircuitBreakerManager;
  private processPools = new Map<string, ProcessPool>();
  private resourceMonitor?: number | null;
  private healthCheckTimer?: number | null;
  private cleanupTimer?: number | null;
  
  // State management
  private isShuttingDown = false;
  private isInitialized = false;
  
  // Performance metrics
  private metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgExecutionTime: 0,
    avgQueueTime: 0,
    resourceUtilization: 0,
    circuitBreakerTrips: 0,
  };

  constructor(
    config: Partial<TaskExecutorConfig>,
    logger: ILogger,
    eventBus: IEventBus
  ) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    
    this.config = {
      maxConcurrentTasks: 10,
      defaultTimeout: getTaskTimeout(), // Use centralized timeout
      retryAttempts: 3,
      retryBackoffBase: 1000,
      retryBackoffMax: 30000,
      resourceLimits: {
        memory: 512 * 1024 * 1024, // 512MB
        cpu: 1.0, // 1 CPU core
        disk: 1024 * 1024 * 1024, // 1GB
      },
      enableCircuitBreaker: true,
      enableResourceMonitoring: true,
      enableProcessPooling: false,
      enableBackgroundExecution: true,
      enablePersistence: true,
      killTimeout: 5000,
      logPath: './task-logs',
      cleanupInterval: 60000, // 1 minute
      healthCheckInterval: 30000, // 30 seconds
      ...config
    };

    // Initialize circuit breaker manager
    this.circuitBreakerManager = new CircuitBreakerManager(
      {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000, // 1 minute
        halfOpenLimit: 2,
      },
      this.logger,
      this.eventBus
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle process events
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());

    // Handle circuit breaker events
    this.eventBus.on('circuitbreaker:state-change', (event: { name: string; state: string; reason?: string }) => {
      this.metrics.circuitBreakerTrips++;
      this.logger.info('Circuit breaker state changed', event);
      this.emit('circuit-breaker-changed', event);
    });

    // Handle task lifecycle events
    this.eventBus.on('task:queued', (data: { taskId: string; queueSize: number }) => {
      this.emit('task-queued', data);
    });

    this.eventBus.on('task:started', (data: { taskId: string; agentId: string }) => {
      this.emit('task-started', data);
    });

    this.eventBus.on('task:completed', (data: { taskId: string; result?: TaskResult }) => {
      this.metrics.successfulExecutions++;
      this.emit('task-completed', data);
    });

    this.eventBus.on('task:failed', (data: { taskId: string; error: string }) => {
      this.metrics.failedExecutions++;
      this.emit('task-failed', data);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.logger.info('Initializing task execution engine', {
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      defaultTimeout: this.config.defaultTimeout,
      resourceLimits: this.config.resourceLimits,
      backgroundExecution: this.config.enableBackgroundExecution,
      processPooling: this.config.enableProcessPooling,
      persistence: this.config.enablePersistence
    });

    // Initialize subsystems
    await this.circuitBreakerManager.initialize();

    if (this.config.enableProcessPooling) {
      this.initializeProcessPools();
    }

    if (this.config.enableResourceMonitoring) {
      this.startResourceMonitoring();
    }

    if (this.config.enableBackgroundExecution) {
      this.startBackgroundProcessing();
    }

    // Start health checks
    this.startHealthChecks();
    this.startCleanupTasks();

    this.isInitialized = true;
    this.emit('executor-initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down task execution engine');
    this.isShuttingDown = true;

    // Stop all timers
    if (this.resourceMonitor) clearInterval(this.resourceMonitor);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    // Cancel all running tasks
    const cancelPromises = Array.from(this.runningTasks.values()).map(ctx =>
      this.cancelTask(ctx.taskId, 'Shutdown requested')
    );

    // Cancel all background tasks
    const backgroundCancelPromises = Array.from(this.backgroundTasks.values()).map(task =>
      this.cancelBackgroundTask(task.id, 'Shutdown requested')
    );

    await Promise.all([...cancelPromises, ...backgroundCancelPromises]);

    // Shutdown process pools
    this.shutdownProcessPools();

    // Shutdown circuit breakers
    await this.circuitBreakerManager.shutdown();

    this.isInitialized = false;
    this.emit('executor-shutdown');
  }

  /**
   * Execute a task with comprehensive error handling and resource management
   */
  async executeTask(
    task: TaskDefinition,
    agent: AgentState,
    options: {
      timeout?: number;
      retryAttempts?: number;
      priority?: number;
      detached?: boolean;
      background?: boolean;
    } = {}
  ): Promise<TaskExecutionResult> {
    const queueStartTime = Date.now();
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = options.retryAttempts ?? this.config.retryAttempts;
    const timeout = options.timeout ?? this.config.defaultTimeout;
    const priority = options.priority ?? 0;

    this.metrics.totalExecutions++;

    this.logger.info('Starting task execution', {
      taskId: task.id.id,
      agentId: agent.id.id,
      type: task.type,
      timeout,
      maxRetries,
      priority,
      background: options.background
    });

    // Handle background execution
    if (options.background) {
      return this.executeBackgroundTask(task, agent, options);
    }

    // Check if we have capacity
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      this.queuedTasks.push(task);
      this.logger.info('Task queued due to capacity limits', {
        taskId: task.id.id,
        queueSize: this.queuedTasks.length
      });
      
      this.eventBus.emit('task:queued', { taskId: task.id.id, queueSize: this.queuedTasks.length });
      
      // Wait for capacity
      await this.waitForCapacity();
    }

    const queueTime = Date.now() - queueStartTime;
    this.updateQueueTimeMetrics(queueTime);

    while (retryCount <= maxRetries) {
      try {
        const result = await this.executeSingleAttempt(task, agent, timeout, retryCount, priority);
        
        const executionTime = Date.now() - startTime;
        this.updateExecutionTimeMetrics(executionTime);
        
        this.logger.info('Task completed successfully', {
          taskId: task.id.id,
          executionTime,
          queueTime,
          retryCount
        });

        return {
          success: true,
          result: result.result,
          executionTime,
          queueTime,
          resourcesUsed: result.resourcesUsed,
          retryCount
        };

      } catch (error) {
        retryCount++;
        
        this.logger.warn('Task attempt failed', {
          taskId: task.id.id,
          attempt: retryCount,
          maxRetries,
          error: error instanceof Error ? error.message : String(error)
        });

        // Check if we should retry
        if (retryCount > maxRetries) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          const taskError: TaskError = {
            type: 'execution_failed',
            message: errorMessage,
            stack: error instanceof Error ? error.stack : '',
            context: {
              retryCount,
              maxRetries,
              taskType: task.type,
              queueTime
            },
            recoverable: false,
            retryable: false
          };

          return {
            success: false,
            error: taskError,
            executionTime: Date.now() - startTime,
            queueTime,
            resourcesUsed: this.getDefaultResourceUsage(),
            retryCount
          };
        }

        // Calculate backoff delay
        const backoffDelay = Math.min(
          this.config.retryBackoffBase * Math.pow(2, retryCount - 1),
          this.config.retryBackoffMax
        );

        this.logger.info('Retrying task after backoff', {
          taskId: task.id.id,
          backoffDelay,
          attempt: retryCount + 1
        });

        await this.delay(backoffDelay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Execute a background task with detached process support
   */
  async executeBackgroundTask(
    task: TaskDefinition,
    agent: AgentState,
    options: {
      timeout?: number;
      retryAttempts?: number;
      priority?: number;
      detached?: boolean;
    } = {}
  ): Promise<TaskExecutionResult> {
    const backgroundTask: BackgroundTask = {
      id: generateId('bgtask'),
      type: 'workflow',
      command: 'deno',
      args: ['run', '--allow-all', './src/cli/commands/task-executor.ts'],
      options: {
        timeout: options.timeout ?? this.config.defaultTimeout,
        retries: options.retryAttempts ?? this.config.retryAttempts,
        detached: options.detached ?? true,
        priority: options.priority ?? 0,
        task: task,
        agent: agent
      },
      status: 'pending',
      retryCount: 0,
      queueTime: Date.now()
    };

    this.backgroundTasks.set(backgroundTask.id, backgroundTask);
    this.backgroundQueue.push(backgroundTask.id);

    this.logger.info('Background task submitted', {
      backgroundTaskId: backgroundTask.id,
      originalTaskId: task.id.id,
      queueSize: this.backgroundQueue.length
    });

    // Process immediately if possible
    this.processBackgroundQueue();

    // Return immediate result for background tasks
    return {
      success: true,
      executionTime: 0,
      resourcesUsed: this.getDefaultResourceUsage(),
      retryCount: 0,
      processId: backgroundTask.pid
    };
  }

  /**
   * Submit a Claude-specific background task
   */
  async submitClaudeTask(
    prompt: string,
    tools: string[] = [],
    options: Partial<{
      cwd: string;
      env: Record<string, string>;
      timeout: number;
      model?: string;
      maxTokens?: number;
      priority?: number;
    }> = {}
  ): Promise<string> {
    const args = ['-p', prompt];
    
    if (tools.length > 0) {
      args.push('--allowedTools', tools.join(','));
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    // Claude CLI doesn't support --max-tokens option, only the API does
    // if (options.maxTokens) {
    //   args.push('--max-tokens', options.maxTokens.toString());
    // }

    args.push('--dangerously-skip-permissions');

    const backgroundTask: BackgroundTask = {
      id: generateId('claude'),
      type: 'claude-spawn',
      command: 'claude',
      args,
      options: {
        ...options,
        detached: true,
        priority: options.priority ?? 0
      },
      status: 'pending',
      retryCount: 0
    };

    this.backgroundTasks.set(backgroundTask.id, backgroundTask);
    this.backgroundQueue.push(backgroundTask.id);

    this.processBackgroundQueue();

    return backgroundTask.id;
  }

  private async executeSingleAttempt(
    task: TaskDefinition,
    agent: AgentState,
    timeout: number,
    retryCount: number,
    priority: number
  ): Promise<{ result: TaskResult; resourcesUsed: ResourceUsage }> {
    const executionContext: ExecutionContext = {
      taskId: task.id.id,
      agentId: agent.id.id,
      startTime: new Date(),
      resources: this.getDefaultResourceUsage(),
      priority: priority,
      detached: false, // Default to false for direct execution
      persistenceEnabled: false // Default to false for direct execution
    };

    this.runningTasks.set(task.id.id, executionContext);

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        executionContext.timeout = setTimeout(() => {
          reject(new Error(`Task timeout after ${timeout}ms`));
        }, timeout) as unknown as NodeJS.Timeout;
      });

      // Set up circuit breaker if enabled
      if (this.config.enableCircuitBreaker) {
        executionContext.circuitBreaker = this.circuitBreakerManager.getBreaker(
          `agent-${agent.id.id}`
        );
      }

      // Execute task with circuit breaker protection
      const executionPromise = this.config.enableCircuitBreaker && executionContext.circuitBreaker
        ? executionContext.circuitBreaker.execute(() => this.performTaskExecution(task, agent, executionContext))
        : this.performTaskExecution(task, agent, executionContext);

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Clear timeout
      if (executionContext.timeout) {
        clearTimeout(executionContext.timeout as unknown as number);
      }

      return result;

    } finally {
      // Cleanup
      this.runningTasks.delete(task.id.id);
      
      // Process queued tasks
      this.processQueuedTasks();
    }
  }

  private async performTaskExecution(
    task: TaskDefinition,
    agent: AgentState,
    context: ExecutionContext
  ): Promise<{ result: TaskResult; resourcesUsed: ResourceUsage }> {
    const startTime = Date.now();

    // Create task execution command
    const command = this.buildExecutionCommand(task, agent);
    
    this.logger.debug('Executing task command', {
      taskId: task.id.id,
      command: command.cmd,
      args: command.args
    });

    // Spawn process
    const childProcess = spawn(command.cmd, command.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...command.env,
        TASK_ID: task.id.id,
        AGENT_ID: agent.id.id,
        TASK_TYPE: task.type
      }
    });

    context.process = childProcess;

    // Collect output
    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Send input if provided
    if (task.input && childProcess.stdin) {
      childProcess.stdin.write(JSON.stringify({
        task: task,
        agent: agent,
        input: task.input
      }));
      childProcess.stdin.end();
    }

    // Wait for process completion
    const exitCode = await new Promise<number>((resolve, reject) => {
      childProcess.on('exit', (code) => {
        resolve(code ?? 0);
      });

      childProcess.on('error', (error) => {
        reject(new Error(`Process error: ${error.message}`));
      });
    });

    const executionTime = Date.now() - startTime;

    // Parse result
    let taskResult: TaskResult;
    
    if (exitCode === 0) {
      try {
        const output = JSON.parse(stdout);
        taskResult = {
          output: output.result || output,
          artifacts: output.artifacts || {},
          metadata: output.metadata || {},
          quality: output.quality || 0.8,
          completeness: output.completeness || 1.0,
          accuracy: output.accuracy || 0.9,
          executionTime,
          resourcesUsed: {
            memory: context.resources.memory,
            cpu: context.resources.cpu,
            disk: context.resources.disk,
            network: context.resources.network,
          },
          validated: false
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.logger.error('Task execution failed:', error instanceof Error ? error.message : String(error));

        // Initialize taskResult for error case
        taskResult = {
          output: null,
          artifacts: {},
          metadata: { 
            error: errorMessage,
            stack: error instanceof Error ? error.stack : ''
          },
          quality: 0,
          completeness: 0,
          accuracy: 0,
          executionTime,
          resourcesUsed: {
            memory: context.resources.memory,
            cpu: context.resources.cpu,
            disk: context.resources.disk,
            network: context.resources.network,
          },
          validated: false
        };

        return {
          result: taskResult,
          resourcesUsed: {
            memory: context.resources.memory,
            cpu: context.resources.cpu,
            disk: context.resources.disk,
            network: context.resources.network,
            lastUpdated: context.resources.lastUpdated
          }
        };
      }
    } else {
      // Initialize taskResult for failed exit code
      taskResult = {
        output: null,
        artifacts: {},
        metadata: { exitCode, stderr },
        quality: 0,
        completeness: 0,
        accuracy: 0,
        executionTime,
        resourcesUsed: {
          memory: context.resources.memory,
          cpu: context.resources.cpu,
          disk: context.resources.disk,
          network: context.resources.network,
        },
        validated: false
      };
      throw new Error(`Task execution failed with exit code ${exitCode}: ${stderr}`);
    }

    return {
      result: taskResult,
      resourcesUsed: {
        memory: context.resources.memory,
        cpu: context.resources.cpu,
        disk: context.resources.disk,
        network: context.resources.network,
        lastUpdated: context.resources.lastUpdated
      }
    };
  }

  private buildExecutionCommand(task: TaskDefinition, agent: AgentState): {
    cmd: string;
    args: string[];
    env: Record<string, string>;
  } {
    // This would be customized based on task type and agent capabilities
    // For now, return a default Claude execution command
    
    const cmd = 'deno';
    const args = [
      'run',
      '--allow-all',
      '--no-check',
      './src/cli/commands/task-executor.ts',
      '--task-type',
      task.type,
      '--agent-type',
      agent.type
    ];

    const env = {
      TASK_TIMEOUT: (task.constraints.timeoutAfter || this.config.defaultTimeout).toString(),
      MEMORY_LIMIT: this.config.resourceLimits.memory.toString(),
      CPU_LIMIT: this.config.resourceLimits.cpu.toString()
    };

    return { cmd, args, env };
  }

  private async cancelTask(taskId: string, reason: string): Promise<void> {
    const context = this.runningTasks.get(taskId);
    if (!context) {
      return;
    }

    this.logger.info('Cancelling task', { taskId, reason });

    // Clear timeout
    if (context.timeout) {
      clearTimeout(context.timeout as unknown as number);
    }

    // Kill process if running
    if (context.process && !context.process.killed) {
      context.process.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (context.process && !context.process.killed) {
          context.process.kill('SIGKILL');
        }
      }, this.config.killTimeout);
    }

    // Remove from running tasks
    this.runningTasks.delete(taskId);

    this.emit('task-cancelled', { taskId, reason });
  }

  private async cancelBackgroundTask(taskId: string, reason: string): Promise<void> {
    const backgroundTask = this.backgroundTasks.get(taskId);
    if (!backgroundTask) {
      return;
    }

    this.logger.info('Cancelling background task', { backgroundTaskId: taskId, reason });

    // Mark as cancelled
    backgroundTask.status = 'cancelled';
    backgroundTask.endTime = new Date();

    // Kill process if running
    if (backgroundTask.pid && !this.backgroundProcesses.get(taskId)?.killed) {
      this.backgroundProcesses.get(taskId)?.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (this.backgroundProcesses.get(taskId) && !this.backgroundProcesses.get(taskId)?.killed) {
          this.backgroundProcesses.get(taskId)?.kill('SIGKILL');
        }
      }, this.config.killTimeout);
    }

    // Remove from background tasks and processes
    this.backgroundTasks.delete(taskId);
    this.backgroundProcesses.delete(taskId);

    this.emit('background-task-cancelled', { backgroundTaskId: taskId, reason });
  }

  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      this.updateResourceUsage();
    }, 5000) as unknown as number; // Update every 5 seconds
  }

  private async updateResourceUsage(): Promise<void> {
    for (const [taskId, context] of Array.from(this.runningTasks.entries())) {
      if (context.process) {
        try {
          const usage = await this.getProcessResourceUsage(context.process.pid!);
          context.resources = {
            memory: usage.memory,
            cpu: usage.cpu,
            disk: usage.disk,
            network: usage.network,
            lastUpdated: usage.lastUpdated
          };

          // Check resource limits
          this.checkResourceLimits(taskId, context);
        } catch (error) {
          this.logger.error('Resource monitoring failed', { error: error as Error });
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getProcessResourceUsage(_pid: number): Promise<ResourceUsage> {
    // In a real implementation, this would use system APIs to get resource usage for the specific PID
    // For now, return mock data
    return {
      memory: Math.random() * this.config.resourceLimits.memory,
      cpu: Math.random() * 100,
      disk: Math.random() * this.config.resourceLimits.disk,
      network: Math.random() * 1024 * 1024,
      lastUpdated: new Date()
    };
  }

  private checkResourceLimits(taskId: string, context: ExecutionContext): void {
    const { memory, cpu } = context.resources;
    const limits = this.config.resourceLimits;

    if (memory > limits.memory) {
      this.logger.warn('Task exceeding memory limit', {
        taskId,
        current: memory,
        limit: limits.memory
      });
      
      this.cancelTask(taskId, 'Memory limit exceeded');
    }

    if (cpu > limits.cpu * 100) { // CPU is in percentage
      this.logger.warn('Task exceeding CPU limit', {
        taskId,
        current: cpu,
        limit: limits.cpu * 100
      });
    }
  }

  private getDefaultResourceUsage(): ResourceUsage {
    return {
      memory: 0,
      cpu: 0,
      disk: 0,
      network: 0,
      lastUpdated: new Date()
    };
  }

  private async waitForCapacity(): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = (): void => {
        if (this.runningTasks.size < this.config.maxConcurrentTasks) {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      };
      check();
    });
  }

  private processQueuedTasks(): void {
    while (
      this.queuedTasks.length > 0 &&
      this.runningTasks.size < this.config.maxConcurrentTasks
    ) {
      const task = this.queuedTasks.shift();
      if (task) {
        this.emit('task-dequeued', { taskId: task.id.id });
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async gracefulShutdown(): Promise<void> {
    this.logger.info('Received shutdown signal, initiating graceful shutdown');
    await this.shutdown();
    process.exit(0);
  }

  // Public API methods

  getRunningTasks(): string[] {
    return Array.from(this.runningTasks.keys());
  }

  getTaskContext(taskId: string): ExecutionContext | undefined {
    return this.runningTasks.get(taskId);
  }

  getQueuedTasks(): TaskDefinition[] {
    return [...this.queuedTasks];
  }

  getExecutorStats(): {
    runningTasks: number;
    queuedTasks: number;
    maxConcurrentTasks: number;
    totalCapacity: number;
    resourceLimits: { memory: number; cpu: number; disk: number; };
    circuitBreakers: Record<string, { state: string; failures: number; successes: number; nextAttempt?: Date }>;
  } {
    return {
      runningTasks: this.runningTasks.size,
      queuedTasks: this.queuedTasks.length,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      totalCapacity: this.config.maxConcurrentTasks,
      resourceLimits: this.config.resourceLimits,
      circuitBreakers: this.circuitBreakerManager.getAllMetrics()
    };
  }

  async forceKillTask(taskId: string): Promise<void> {
    await this.cancelTask(taskId, 'Force killed by user');
  }

  updateConfig(newConfig: Partial<TaskExecutorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Task executor configuration updated', { newConfig });
  }

  private async collectResourceUsage(taskId: string): Promise<ResourceUsage> {
    const context = this.runningTasks.get(taskId);
    if (context && context.process) {
      try {
        return await this.getProcessResourceUsage(context.process.pid!);
      } catch (error) {
        this.logger.error('Failed to collect resource usage', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    return this.getDefaultResourceUsage();
  }

  private async initializeProcessPools(): Promise<void> {
    // This would involve creating multiple process pools based on agent types
    // For now, we'll just create one mock pool
    const mockPool: ProcessPool = {
      available: [],
      busy: new Map(),
      maxSize: 5, // Example max size
      createProcess: () => {
        const process = spawn('echo', ['Hello from mock process'], { stdio: 'pipe' });
        return process;
      },
      destroyProcess: (process) => {
        process.kill('SIGTERM');
      }
    };
    this.processPools.set('default', mockPool);
    this.logger.info('Mock process pools initialized');
  }

  private async shutdownProcessPools(): Promise<void> {
    for (const pool of this.processPools.values()) {
      for (const process of pool.available) {
        pool.destroyProcess(process);
      }
      for (const process of pool.busy.values()) {
        pool.destroyProcess(process);
      }
    }
    this.processPools.clear();
    this.logger.info('All process pools shut down');
  }

  private async startBackgroundProcessing(): Promise<void> {
    if (!this.config.enableBackgroundExecution) {
      this.logger.warn('Background execution is disabled in config, skipping background processing.');
      return;
    }

    this.logger.info('Starting background processing queue processor');
    this.processBackgroundQueue();
  }

  private async processBackgroundQueue(): Promise<void> {
    if (this.backgroundQueue.length === 0 || this.isShuttingDown) {
      return;
    }

    const taskId = this.backgroundQueue.shift();
    if (!taskId) {
      return;
    }

    const backgroundTask = this.backgroundTasks.get(taskId);
    if (!backgroundTask || !backgroundTask.options) {
      this.logger.warn('Background task not found or missing options', { backgroundTaskId: taskId });
      return;
    }

    if (backgroundTask.status !== 'pending') {
      this.logger.warn('Background task is not in pending state', { backgroundTaskId: taskId, status: backgroundTask.status });
      return;
    }

    this.logger.info('Processing background task', { backgroundTaskId: taskId });

    backgroundTask.status = 'running';
    backgroundTask.startTime = new Date();

    try {
      // For background tasks, we'll just execute the command directly
      const childProcess = spawn(backgroundTask.command, backgroundTask.args, {
        cwd: backgroundTask.options.cwd,
        env: { ...process.env, ...backgroundTask.options.env },
        detached: backgroundTask.options.detached,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      backgroundTask.pid = childProcess.pid;
      this.backgroundProcesses.set(taskId, childProcess);

      // Collect output
      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        this.emit('task:output', { taskId: backgroundTask.id, data: data.toString() });
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        this.emit('task:error', { taskId: backgroundTask.id, data: data.toString() });
      });

      // Handle process completion
      childProcess.on('close', (code: number | null) => {
        backgroundTask.endTime = new Date();
        backgroundTask.output = stdout;
        backgroundTask.error = stderr;

        if (code === 0) {
          backgroundTask.status = 'completed';
          this.logger.info('Background task completed', { backgroundTaskId: taskId });
          this.emit('task:completed', { taskId: backgroundTask.id });
        } else {
          backgroundTask.status = 'failed';
          this.logger.error('Background task failed', { backgroundTaskId: taskId, exitCode: code });
          this.emit('task:failed', { taskId: backgroundTask.id, error: stderr });
        }

        this.backgroundProcesses.delete(taskId);
      });

      // Set timeout if specified
      if (backgroundTask.options.timeout) {
        setTimeout(() => {
          if (this.backgroundProcesses.has(taskId)) {
            this.logger.warn(`Background task ${taskId} timed out after ${backgroundTask.options!.timeout}ms`);
            childProcess.kill('SIGTERM');
          }
        }, backgroundTask.options.timeout);
      }

      // For detached processes, unref to allow main process to exit
      if (backgroundTask.options.detached) {
        childProcess.unref();
      }

    } catch (error) {
      backgroundTask.status = 'failed';
      backgroundTask.endTime = new Date();
      backgroundTask.error = error instanceof Error ? error.message : String(error);

      this.logger.error('Background task execution failed', { backgroundTaskId: taskId, error: backgroundTask.error });
      this.emit('task:failed', { taskId: backgroundTask.id, error: backgroundTask.error });
    }
  }

  private startHealthChecks(): void {
    if (!this.config.enableResourceMonitoring) {
      this.logger.warn('Resource monitoring is disabled, skipping health checks.');
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      this.updateHealthMetrics();
      this.checkResourceLimitsForAllTasks();
    }, this.config.healthCheckInterval) as unknown as number;
    this.logger.info('Health checks started', { interval: this.config.healthCheckInterval });
  }

  private updateQueueTimeMetrics(queueTime: number): void {
    const currentCount = this.metrics.totalExecutions || 1;
    this.metrics.avgQueueTime = (this.metrics.avgQueueTime * (currentCount - 1) + queueTime) / currentCount;
  }

  private updateExecutionTimeMetrics(executionTime: number): void {
    const currentCount = this.metrics.totalExecutions || 1;
    this.metrics.avgExecutionTime = (this.metrics.avgExecutionTime * (currentCount - 1) + executionTime) / currentCount;
  }

  private startCleanupTasks(): void {
    if (!this.config.enablePersistence) {
      this.logger.warn('Persistence is disabled, skipping cleanup tasks.');
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupOldTasks();
    }, this.config.cleanupInterval) as unknown as number;
    this.logger.info('Cleanup tasks started', { interval: this.config.cleanupInterval });
  }

  private async cleanupOldTasks(): Promise<void> {
    const now = Date.now();
    const cleanupTasks: string[] = [];

    for (const [taskId, context] of Array.from(this.runningTasks.entries())) {
      if (now - context.startTime.getTime() > this.config.defaultTimeout) {
        this.logger.warn('Task timed out', { taskId, timeout: this.config.defaultTimeout });
        await this.cancelTask(taskId, 'Task timed out');
        cleanupTasks.push(taskId);
      }
    }

    for (const [taskId, backgroundTask] of Array.from(this.backgroundTasks.entries())) {
      if (backgroundTask.status === 'running' && now - backgroundTask.startTime!.getTime() > this.config.defaultTimeout) {
        this.logger.warn('Background task timed out', { backgroundTaskId: taskId, timeout: this.config.defaultTimeout });
        await this.cancelBackgroundTask(taskId, 'Background task timed out');
        cleanupTasks.push(taskId);
      }
    }

    for (const taskId of cleanupTasks) {
      this.logger.info('Cleaning up task from queue', { taskId });
      this.eventBus.emit('task:completed', { taskId, result: { output: 'Task timed out', error: 'Task timed out' } });
    }
  }

  private async updateHealthMetrics(): Promise<void> {
    const totalMemory = this.config.resourceLimits.memory;
    const totalCpu = this.config.resourceLimits.cpu * 100; // CPU is in percentage
    const totalDisk = this.config.resourceLimits.disk;

    let usedMemory = 0;
    let usedCpu = 0;
    let usedDisk = 0;

    for (const context of this.runningTasks.values()) {
      usedMemory += context.resources.memory;
      usedCpu += context.resources.cpu;
      usedDisk += context.resources.disk;
    }

    for (const backgroundTask of this.backgroundTasks.values()) {
      if (backgroundTask.pid) {
        try {
          const usage = await this.getProcessResourceUsage(backgroundTask.pid);
          usedMemory += usage.memory;
          usedCpu += usage.cpu;
          usedDisk += usage.disk;
        } catch (error) {
          this.logger.error('Failed to get resource usage for background process', { backgroundTaskId: backgroundTask.id, error: error as Error });
        }
      }
    }

    this.metrics.resourceUtilization = (usedMemory / totalMemory) * 100;
    this.logger.info('Health metrics updated', {
      totalMemory,
      usedMemory,
      totalCpu,
      usedCpu,
      totalDisk,
      usedDisk,
      resourceUtilization: this.metrics.resourceUtilization
    });
  }

  private async checkResourceLimitsForAllTasks(): Promise<void> {
    for (const [taskId, context] of Array.from(this.runningTasks.entries())) {
      this.checkResourceLimits(taskId, context);
    }
    for (const [taskId, backgroundTask] of Array.from(this.backgroundTasks.entries())) {
      if (backgroundTask.pid) {
        try {
          const usage = await this.getProcessResourceUsage(backgroundTask.pid);
          if (usage.memory > this.config.resourceLimits.memory) {
            this.logger.warn('Background task exceeding memory limit', { backgroundTaskId: taskId, current: usage.memory, limit: this.config.resourceLimits.memory });
            this.cancelBackgroundTask(taskId, 'Memory limit exceeded');
          }
          if (usage.cpu > this.config.resourceLimits.cpu * 100) {
            this.logger.warn('Background task exceeding CPU limit', { backgroundTaskId: taskId, current: usage.cpu, limit: this.config.resourceLimits.cpu * 100 });
            this.cancelBackgroundTask(taskId, 'CPU limit exceeded');
          }
        } catch (error) {
          this.logger.error('Failed to check resource limits for background task', { backgroundTaskId: taskId, error: error as Error });
        }
      }
    }
  }
}