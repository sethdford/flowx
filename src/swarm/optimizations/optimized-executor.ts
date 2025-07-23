/**
 * Optimized Task Executor
 * Implements async execution with connection pooling and caching
 */

import { EventEmitter } from 'node:events';
import { Logger } from "../../core/logger.js";
import { ClaudeConnectionPool } from "./connection-pool.js";
import { AsyncFileManager } from "./async-file-manager.js";
import { TTLMap } from "./ttl-map.js";
import { CircularBuffer } from "./circular-buffer.js";
import { AgentCapabilityIndex } from "./agent-capability-index.js";
import PQueue from 'p-queue';
import { 
  TaskDefinition, 
  TaskResult, 
  AgentId,
  TaskStatus,
  TaskType,
  TaskPriority
} from "../types.js";

export interface ExecutorConfig {
  connectionPool?: {
    min?: number;
    max?: number;
  };
  concurrency?: number;
  caching?: {
    enabled?: boolean;
    ttl?: number;
    maxSize?: number;
  };
  fileOperations?: {
    outputDir?: string;
    concurrency?: number;
  };
  monitoring?: {
    metricsInterval?: number;
    slowTaskThreshold?: number;
  };
  parallelExecution?: {
    enabled?: boolean;
    maxParallelTasks?: number;
    adaptiveThrottling?: boolean;
  };
  retryLogic?: {
    maxRetries?: number;
    exponentialBackoff?: boolean;
    baseDelay?: number;
  };
  workloadBalancing?: {
    enabled?: boolean;
    agentLoadThreshold?: number;
    predictiveScaling?: boolean;
  };
}

export interface ExecutionMetrics {
  totalExecuted: number;
  totalSucceeded: number;
  totalFailed: number;
  avgExecutionTime: number;
  cacheHitRate: number;
  queueLength: number;
  activeExecutions: number;
  parallelEfficiency: number;
  retryRate: number;
  predictedExecutionTime: number;
  workloadDistribution: Record<string, number>;
}

export interface TaskBatch {
  id: string;
  tasks: TaskDefinition[];
  priority: TaskPriority;
  estimatedDuration: number;
  parallelizable: boolean;
}

export interface ExecutionPrediction {
  estimatedDuration: number;
  confidence: number;
  recommendedAgent: AgentId | null;
  optimalConcurrency: number;
}

export class OptimizedExecutor extends EventEmitter {
  private logger: Logger;
  private connectionPool: ClaudeConnectionPool;
  private fileManager: AsyncFileManager;
  private capabilityIndex: AgentCapabilityIndex;
  private executionQueue: PQueue;
  private parallelExecutionQueue: PQueue;
  private resultCache: TTLMap<string, TaskResult>;
  private executionHistory: CircularBuffer<{
    taskId: string;
    duration: number;
    status: 'success' | 'failed' | 'retry';
    timestamp: Date;
    agentId: string;
    retryCount: number;
  }>;
  private workloadTracker: Map<string, number>; // AgentId -> current load
  private taskPredictionCache: TTLMap<string, ExecutionPrediction>;
  
  private metrics = {
    totalExecuted: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalRetries: 0,
    totalExecutionTime: 0,
    parallelTasksExecuted: 0,
    cacheHits: 0,
    cacheMisses: 0,
    workloadBalancingActions: 0
  };
  
  private activeExecutions = new Set<string>();
  private agentWorkloads = new Map<string, Set<string>>(); // AgentId -> Set of TaskIds
  private config: ExecutorConfig;
  
  constructor(config: ExecutorConfig = {}) {
    super();
    this.config = {
      ...config,
      parallelExecution: {
        enabled: true,
        maxParallelTasks: 5,
        adaptiveThrottling: true,
        ...config.parallelExecution
      },
      retryLogic: {
        maxRetries: 3,
        exponentialBackoff: true,
        baseDelay: 1000,
        ...config.retryLogic
      },
      workloadBalancing: {
        enabled: true,
        agentLoadThreshold: 3,
        predictiveScaling: true,
        ...config.workloadBalancing
      }
    };
    
    this.logger = new Logger(
      { level: 'info', format: 'json', destination: 'console' },
      { component: 'OptimizedExecutor' }
    );
    
    // Initialize connection pool
    this.connectionPool = new ClaudeConnectionPool({
      max: config.connectionPool?.max || 10
    } as any);
    
    // Initialize file manager
    this.fileManager = new AsyncFileManager({
      write: config.fileOperations?.concurrency || 10,
      read: config.fileOperations?.concurrency || 20
    });
    
    // Initialize capability index
    this.capabilityIndex = new AgentCapabilityIndex({
      performanceHistorySize: 100,
      capabilityCacheTimeout: 300000, // 5 minutes
      minConfidenceThreshold: 0.7
    });
    
    // Initialize execution queues
    this.executionQueue = new PQueue({ 
      concurrency: config.concurrency || 10 
    });
    
    this.parallelExecutionQueue = new PQueue({
      concurrency: this.config.parallelExecution?.maxParallelTasks || 5
    });
    
    // Initialize result cache
    this.resultCache = new TTLMap({
      defaultTTL: config.caching?.ttl || 3600000, // 1 hour
      maxSize: config.caching?.maxSize || 1000,
      onExpire: (key, value) => {
        this.logger.debug('Cache entry expired', { taskId: key });
      }
    });
    
    // Initialize prediction cache
    this.taskPredictionCache = new TTLMap({
      defaultTTL: 300000, // 5 minutes
      maxSize: 500
    });
    
    // Initialize execution history
    this.executionHistory = new CircularBuffer(1000);
    
    // Initialize workload tracking
    this.workloadTracker = new Map();
    
    // Start monitoring if configured
    if (config.monitoring?.metricsInterval) {
      setInterval(() => {
        this.emitMetrics();
      }, config.monitoring.metricsInterval);
    }
    
    // Start adaptive throttling if enabled
    if (this.config.parallelExecution?.adaptiveThrottling) {
      setInterval(() => {
        this.adjustParallelConcurrency();
      }, 30000); // Every 30 seconds
    }
  }
  
  async executeTask(task: TaskDefinition, agentId: AgentId): Promise<TaskResult> {
    const startTime = Date.now();
    const taskKey = this.getTaskCacheKey(task);
    
    // Check cache if enabled
    if (this.config.caching?.enabled) {
      const cached = this.resultCache.get(taskKey);
      if (cached) {
        this.metrics.cacheHits++;
        this.logger.debug('Cache hit for task', { taskId: task.id.id });
        return cached;
      }
      this.metrics.cacheMisses++;
    }
    
    // Add to active executions
    this.activeExecutions.add(task.id.id);
    
    // Queue the execution
    const result = await this.executionQueue.add(async (): Promise<TaskResult> => {
      try {
        // Execute with connection pool
        const executionResult = await this.connectionPool.execute(async (api) => {
          const response = await (api as any).messages.create({
            messages: this.buildMessages(task),
            model: (task.context as any)?.model || 'claude-3-5-sonnet-20241022',
            max_tokens: (task.constraints as any)?.maxTokens || 4096,
            temperature: (task.context as any)?.temperature || 0.7
          });
          
          return {
            success: true,
            output: response.content[0]?.text || '',
            usage: {
              inputTokens: response.usage?.input_tokens || 0,
              outputTokens: response.usage?.output_tokens || 0
            }
          };
        });
        
        // Save result to file asynchronously
        if (this.config.fileOperations?.outputDir) {
          const outputPath = `${this.config.fileOperations.outputDir}/${task.id.id}.tson`;
          await this.fileManager.writeJSON(outputPath, {
            taskId: task.id.id,
            agentId: agentId.id,
            result: executionResult,
            timestamp: new Date()
          });
        }
        
        // Create task result
        const taskResult: TaskResult = {
          output: executionResult.output,
          artifacts: {},
          metadata: {
            taskId: task.id.id,
            agentId: agentId.id,
            success: executionResult.success,
            executionTime: Date.now() - startTime,
            tokensUsed: executionResult.usage,
            timestamp: new Date()
          },
          quality: 1.0,
          completeness: 1.0,
          accuracy: 1.0,
          executionTime: Date.now() - startTime,
          resourcesUsed: {
            cpu: 0,
            memory: 0,
            tokens: executionResult.usage.inputTokens + executionResult.usage.outputTokens
          },
          validated: false
        };
        
        // Cache result if enabled
        if (this.config.caching?.enabled && executionResult.success) {
          this.resultCache.set(taskKey, taskResult);
        }
        
        // Update metrics
        this.metrics.totalExecuted++;
        this.metrics.totalSucceeded++;
        this.metrics.totalExecutionTime += taskResult.executionTime;
        
        // Record in history
        this.executionHistory.push({
          taskId: task.id.id,
          duration: taskResult.executionTime,
          status: 'success',
          timestamp: new Date(),
          agentId: agentId.id,
          retryCount: 0
        });
        
        // Check if slow task
        if (this.config.monitoring?.slowTaskThreshold && 
            taskResult.executionTime > this.config.monitoring.slowTaskThreshold) {
          this.logger.warn('Slow task detected', {
            taskId: task.id.id,
            duration: taskResult.executionTime,
            threshold: this.config.monitoring.slowTaskThreshold
          });
        }
        
        this.emit('task:completed', taskResult);
        return taskResult;
        
      } catch (error) {
        this.metrics.totalExecuted++;
        this.metrics.totalFailed++;
        
        const errorResult: TaskResult = {
          output: '',
          artifacts: {},
          metadata: {
            taskId: task.id.id,
            agentId: agentId.id,
            success: false,
            error: {
              type: error instanceof Error ? error.constructor.name : 'UnknownError',
              message: error instanceof Error ? error.message : String(error),
              code: (error as any).code,
              stack: error instanceof Error ? error.stack : undefined,
              context: { taskId: task.id.id, agentId: agentId.id },
              recoverable: this.isRecoverableError(error),
              retryable: this.isRetryableError(error)
            },
            executionTime: Date.now() - startTime,
            timestamp: new Date()
          },
          quality: 0,
          completeness: 0,
          accuracy: 0,
          executionTime: Date.now() - startTime,
          resourcesUsed: {
            cpu: 0,
            memory: 0,
            tokens: 0
          },
          validated: false
        };
        
        // Record in history
        this.executionHistory.push({
          taskId: task.id.id,
          duration: errorResult.executionTime,
          status: 'failed',
          timestamp: new Date(),
          agentId: agentId.id,
          retryCount: 0
        });
        
        this.emit('task:failed', errorResult);
        return errorResult;
      } finally {
        this.activeExecutions.delete(task.id.id);
      }
    });
    
    return result || {
      success: false,
      error: 'Task execution returned no result',
      duration: Date.now() - startTime,
      output: '',
      artifacts: {},
      metadata: {
        taskId: task.id.id,
        agentId: agentId.id,
        success: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      },
      quality: 0,
      completeness: 0,
      accuracy: 0,
      executionTime: Date.now() - startTime,
      resourcesUsed: {
        cpu: 0,
        memory: 0,
        tokens: 0
      },
      validated: false
    } as TaskResult;
  }
  
  async executeBatch(
    tasks: TaskDefinition[], 
    agentId: AgentId
  ): Promise<TaskResult[]> {
    return Promise.all(
      tasks.map(task => this.executeTask(task, agentId))
    );
  }

  /**
   * Execute multiple tasks in parallel with advanced optimization
   */
  async executeTaskBatch(batch: TaskBatch, agents: AgentId[]): Promise<TaskResult[]> {
    if (!this.config.parallelExecution?.enabled) {
      // Fallback to sequential execution
      const results: TaskResult[] = [];
      for (let i = 0; i < batch.tasks.length; i++) {
        const task = batch.tasks[i];
        const agent = agents[i % agents.length];
        const result = await this.executeTask(task, agent);
        results.push(result);
      }
      return results;
    }

    this.logger.info('Executing task batch in parallel', {
      batchId: batch.id,
      taskCount: batch.tasks.length,
      agentCount: agents.length,
      estimatedDuration: batch.estimatedDuration
    });

    // Track parallel execution metrics
    this.metrics.parallelTasksExecuted += batch.tasks.length;

    // Execute all tasks in parallel using the parallel queue
    const promises = batch.tasks.map((task, index) => {
      const agent = this.selectOptimalAgent(task, agents);
      return this.parallelExecutionQueue.add(async (): Promise<TaskResult> => {
        const startTime = Date.now();
        try {
          const result = await this.executeTaskWithRetry(task, agent);
          const executionTime = Date.now() - startTime;
          
          // Update agent workload tracking
          this.updateAgentWorkload(agent, task.id.id, 'remove');
          
          this.logger.debug('Parallel task completed', {
            taskId: task.id.id,
            agentId: agent.id,
            executionTime,
            batchId: batch.id
          });
          
          return result;
        } catch (error) {
          this.updateAgentWorkload(agent, task.id.id, 'remove');
          throw error;
        }
      });
    });

    const promiseResults = await Promise.all(promises);
    const results = promiseResults.filter((result): result is TaskResult => result !== undefined);
    
    this.logger.info('Task batch execution completed', {
      batchId: batch.id,
      successCount: results.filter(r => r && r.metadata && r.metadata.success).length,
      failureCount: results.filter(r => r && r.metadata && !r.metadata.success).length,
      totalDuration: Math.max(...results.map(r => r ? r.executionTime : 0))
    });

    return results;
  }

  /**
   * Execute task with intelligent retry logic
   */
  private async executeTaskWithRetry(task: TaskDefinition, agentId: AgentId, retryCount = 0): Promise<TaskResult> {
    try {
      const result = await this.executeTask(task, agentId);
      
      if (!result.metadata.success && this.shouldRetry(result, retryCount)) {
        return this.retryTask(task, agentId, retryCount + 1);
      }
      
      return result;
    } catch (error) {
      if (this.isRetryableError(error) && retryCount < (this.config.retryLogic?.maxRetries || 3)) {
        return this.retryTask(task, agentId, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Retry task with exponential backoff
   */
  private async retryTask(task: TaskDefinition, agentId: AgentId, retryCount: number): Promise<TaskResult> {
    this.metrics.totalRetries++;
    
    const delay = this.config.retryLogic?.exponentialBackoff 
      ? (this.config.retryLogic?.baseDelay || 1000) * Math.pow(2, retryCount - 1)
      : (this.config.retryLogic?.baseDelay || 1000);

    this.logger.info('Retrying task', {
      taskId: task.id.id,
      agentId: agentId.id,
      retryCount,
      delay
    });

    // Record retry in history
    this.executionHistory.push({
      taskId: task.id.id,
      duration: 0,
      status: 'retry',
      timestamp: new Date(),
      agentId: agentId.id,
      retryCount
    });

    await new Promise(resolve => setTimeout(resolve, delay));
    return this.executeTaskWithRetry(task, agentId, retryCount);
  }

  /**
   * Predict task execution time and recommend optimal agent
   */
  async predictTaskExecution(task: TaskDefinition, availableAgents: AgentId[]): Promise<ExecutionPrediction> {
    const cacheKey = this.getTaskCacheKey(task);
    const cached = this.taskPredictionCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Find similar tasks in execution history
    const similarTasks = this.executionHistory.getAll()
      .filter((h: any) => h.status === 'success')
      .slice(-50); // Last 50 successful tasks

    let estimatedDuration = 30000; // Default 30 seconds
    let confidence = 0.5;

    if (similarTasks.length > 0) {
      const avgDuration = similarTasks.reduce((sum: number, t: any) => sum + t.duration, 0) / similarTasks.length;
      estimatedDuration = avgDuration;
      confidence = Math.min(0.9, similarTasks.length / 20); // Higher confidence with more data
    }

    // Find optimal agent using capability index
    const optimalMatches = await this.capabilityIndex.findBestAgents(
      task.type,
      task.priority,
      this.estimateTaskComplexity(task)
    );

    const recommendedAgent = optimalMatches.length > 0 ? optimalMatches[0].agentId : availableAgents[0];
    
    // Calculate optimal concurrency based on task type and complexity
    const optimalConcurrency = this.calculateOptimalConcurrency(task, availableAgents.length);

    const prediction: ExecutionPrediction = {
      estimatedDuration,
      confidence,
      recommendedAgent,
      optimalConcurrency
    };

    // Cache the prediction
    this.taskPredictionCache.set(cacheKey, prediction);

    return prediction;
  }
  
  private buildMessages(task: TaskDefinition): any[] {
    const messages = [];
    
    // Add system message if needed
    if ((task.context as any)?.systemPrompt) {
      messages.push({
        role: 'system',
        content: (task.context as any).systemPrompt
      });
    }
    
    // Add main task objective using instructions field
    messages.push({
      role: 'user',
      content: task.instructions
    });
    
    // Add context if available
    if (task.context) {
      if ((task.context as any).previousResults?.length) {
        messages.push({
          role: 'assistant',
          content: 'Previous results:\n' + 
            (task.context as any).previousResults.map((r: any) => r.output).join('\n\n')
        });
      }
      
      if ((task.context as any).relatedTasks?.length) {
        messages.push({
          role: 'user',
          content: 'Related context:\n' + 
            (task.context as any).relatedTasks.map((t: any) => t.instructions).join('\n')
        });
      }
    }
    
    return messages;
  }
  
  private getTaskCacheKey(task: TaskDefinition): string {
    // Create a cache key based on task properties
    return `${task.type}-${task.instructions}-${JSON.stringify(task.context || {})}`;
  }
  
  private isRecoverableError(error: any): boolean {
    if (!error) return false;
    
    // Network errors are often recoverable
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }
    
    // Rate limit errors are recoverable with backoff
    if (error.status === 429) {
      return true;
    }
    
    return false;
  }
  
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    // Most recoverable errors are retryable
    if (this.isRecoverableError(error)) {
      return true;
    }
    
    // Server errors might be temporary
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    return false;
  }

  /**
   * Select optimal agent based on workload and capabilities
   */
  private selectOptimalAgent(task: TaskDefinition, availableAgents: AgentId[]): AgentId {
    if (!this.config.workloadBalancing?.enabled) {
      return availableAgents[0];
    }

    // Check current workloads
    const agentLoads = availableAgents.map(agent => ({
      agent,
      load: this.agentWorkloads.get(agent.id)?.size || 0
    }));

    // Sort by load (ascending)
    agentLoads.sort((a, b) => a.load - b.load);

    // Select agent with lowest load that's under threshold
    const threshold = this.config.workloadBalancing?.agentLoadThreshold || 3;
    const selectedAgent = agentLoads.find(al => al.load < threshold)?.agent || agentLoads[0].agent;

    // Update workload tracking
    this.updateAgentWorkload(selectedAgent, task.id.id, 'add');
    this.metrics.workloadBalancingActions++;

    this.logger.debug('Selected optimal agent', {
      taskId: task.id.id,
      selectedAgentId: selectedAgent.id,
      agentLoad: this.agentWorkloads.get(selectedAgent.id)?.size || 0,
      availableAgents: agentLoads.map(al => ({ id: al.agent.id, load: al.load }))
    });

    return selectedAgent;
  }

  /**
   * Update agent workload tracking
   */
  private updateAgentWorkload(agentId: AgentId, taskId: string, action: 'add' | 'remove'): void {
    const agentIdStr = agentId.id;
    
    if (!this.agentWorkloads.has(agentIdStr)) {
      this.agentWorkloads.set(agentIdStr, new Set());
    }

    const workload = this.agentWorkloads.get(agentIdStr)!;
    
    if (action === 'add') {
      workload.add(taskId);
    } else {
      workload.delete(taskId);
    }

    // Update workload tracker
    this.workloadTracker.set(agentIdStr, workload.size);
  }

  /**
   * Estimate task complexity based on task definition
   */
  private estimateTaskComplexity(task: TaskDefinition): 'low' | 'medium' | 'high' {
    const promptLength = (task.description + task.instructions).length;
    const hasContext = Object.keys(task.context || {}).length > 0;
    const hasConstraints = Object.keys(task.constraints || {}).length > 0;

    if (promptLength > 2000 || (hasContext && hasConstraints)) {
      return 'high';
    } else if (promptLength > 500 || hasContext || hasConstraints) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Calculate optimal concurrency for task execution
   */
  private calculateOptimalConcurrency(task: TaskDefinition, availableAgents: number): number {
    const complexity = this.estimateTaskComplexity(task);
    const maxParallel = this.config.parallelExecution?.maxParallelTasks || 5;
    
    switch (complexity) {
      case 'high':
        return Math.min(2, availableAgents, maxParallel);
      case 'medium':
        return Math.min(3, availableAgents, maxParallel);
      case 'low':
        return Math.min(5, availableAgents, maxParallel);
      default:
        return 1;
    }
  }

  /**
   * Check if task should be retried
   */
  private shouldRetry(result: TaskResult, retryCount: number): boolean {
    const maxRetries = this.config.retryLogic?.maxRetries || 3;
    
    if (retryCount >= maxRetries) {
      return false;
    }

    const error = result.metadata.error;
    if (!error) {
      return false;
    }

    return error.retryable || this.isRetryableError(new Error(error.message));
  }

  /**
   * Enhanced metrics with performance analytics
   */
  getMetrics(): ExecutionMetrics {
    const totalTasks = this.metrics.totalExecuted || 1; // Avoid division by zero
    const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;
    
    // Calculate parallel efficiency
    const parallelEfficiency = this.metrics.parallelTasksExecuted > 0 
      ? (this.metrics.totalSucceeded / this.metrics.parallelTasksExecuted) 
      : 0;
    
    // Calculate retry rate
    const retryRate = this.metrics.totalRetries / totalTasks;
    
    // Calculate predicted execution time based on recent history
    const recentTasks = this.executionHistory.getAll().slice(-10);
    const predictedExecutionTime = recentTasks.length > 0
      ? recentTasks.reduce((sum: number, t: any) => sum + t.duration, 0) / recentTasks.length
      : 0;
    
    // Generate workload distribution
    const workloadDistribution: Record<string, number> = {};
    this.workloadTracker.forEach((load, agentId) => {
      workloadDistribution[agentId] = load;
    });

    return {
      totalExecuted: this.metrics.totalExecuted,
      totalSucceeded: this.metrics.totalSucceeded,
      totalFailed: this.metrics.totalFailed,
      avgExecutionTime: this.metrics.totalExecutionTime / totalTasks,
      cacheHitRate,
      queueLength: this.executionQueue.size,
      activeExecutions: this.activeExecutions.size,
      parallelEfficiency,
      retryRate,
      predictedExecutionTime,
      workloadDistribution
    };
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): {
    metrics: ExecutionMetrics;
    optimization: {
      cacheEffectiveness: number;
      parallelizationGains: number;
      workloadBalance: number;
      retryImpact: number;
    };
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];
    
    // Calculate optimization metrics
    const cacheEffectiveness = metrics.cacheHitRate;
    const parallelizationGains = metrics.parallelEfficiency;
    
    // Calculate workload balance (lower variance = better balance)
    const loads = Object.values(metrics.workloadDistribution);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
    const workloadBalance = Math.max(0, 1 - (variance / (avgLoad || 1)));
    
    const retryImpact = 1 - metrics.retryRate; // Lower retry rate = less impact
    
    // Generate recommendations
    if (cacheEffectiveness < 0.3) {
      recommendations.push("Consider increasing cache TTL or improving task similarity detection");
    }
    
    if (parallelizationGains < 0.7) {
      recommendations.push("Optimize parallel task distribution or increase concurrency limits");
    }
    
    if (workloadBalance < 0.8) {
      recommendations.push("Improve workload balancing by adjusting agent load thresholds");
    }
    
    if (metrics.retryRate > 0.1) {
      recommendations.push("Investigate frequent task failures and improve error handling");
    }
    
    if (metrics.avgExecutionTime > 60000) {
      recommendations.push("Consider breaking down complex tasks or optimizing agent capabilities");
    }

    return {
      metrics,
      optimization: {
        cacheEffectiveness,
        parallelizationGains,
        workloadBalance,
        retryImpact
      },
      recommendations
    };
  }
  
  private emitMetrics(): void {
    const metrics = this.getMetrics();
    this.emit('metrics', metrics);
    
    // Also log if configured
    this.logger.info('Executor metrics', metrics);
  }
  
  async waitForPendingExecutions(): Promise<void> {
    await this.executionQueue.onIdle();
    await this.fileManager.waitForPendingOperations();
  }
  
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down optimized executor');
    
    // Clear the queue
    this.executionQueue.clear();
    
    // Wait for active executions
    await this.waitForPendingExecutions();
    
    // Drain connection pool
    await this.connectionPool.drain();
    
    // Clear caches
    this.resultCache.destroy();
    
    this.logger.info('Optimized executor shut down');
  }
  
  /**
   * Get execution history for analysis
   */
  getExecutionHistory() {
    return this.executionHistory.snapshot();
  }
  
  /**
   * Get connection pool statistics
   */
  getConnectionPoolStats() {
    return this.connectionPool.getStats();
  }
  
  /**
   * Get file manager metrics
   */
  getFileManagerMetrics() {
    return this.fileManager.getMetrics();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.resultCache.getStats();
  }

  private async adjustParallelConcurrency() {
    if (!this.config.parallelExecution?.adaptiveThrottling) {
      return;
    }

    const currentParallelTasks = this.parallelExecutionQueue.size;
    const maxParallelTasks = this.config.parallelExecution?.maxParallelTasks || 5;
    const currentActiveExecutions = this.activeExecutions.size;

    if (currentParallelTasks < maxParallelTasks && currentActiveExecutions > 0) {
      const newConcurrency = Math.min(maxParallelTasks, currentActiveExecutions);
      this.parallelExecutionQueue.concurrency = newConcurrency;
      this.logger.debug('Adjusted parallel execution queue concurrency', {
        currentParallelTasks,
        maxParallelTasks,
        newConcurrency
      });
    } else if (currentParallelTasks > 0 && currentActiveExecutions === 0) {
      // If no active tasks, try to reduce concurrency to save resources
      const newConcurrency = Math.max(1, Math.floor(currentParallelTasks / 2));
      this.parallelExecutionQueue.concurrency = newConcurrency;
      this.logger.debug('Reduced parallel execution queue concurrency', {
        currentParallelTasks,
        newConcurrency
      });
    }
  }
}