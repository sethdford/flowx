/**
 * Optimized Task Executor
 * Implements async execution with connection pooling and caching
 */

import { EventEmitter } from 'node:events';
import { Logger } from "../../core/logger.ts";
import { ClaudeConnectionPool } from "./connection-pool.ts";
import { AsyncFileManager } from "./async-file-manager.ts";
import { TTLMap } from "./ttl-map.ts";
import { CircularBuffer } from "./circular-buffer.ts";
import PQueue from 'p-queue';
import { 
  TaskDefinition, 
  TaskResult, 
  AgentId,
  TaskStatus,
  TaskType,
  TaskPriority
} from "../types.ts";

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
}

export interface ExecutionMetrics {
  totalExecuted: number;
  totalSucceeded: number;
  totalFailed: number;
  avgExecutionTime: number;
  cacheHitRate: number;
  queueLength: number;
  activeExecutions: number;
}

export class OptimizedExecutor extends EventEmitter {
  private logger: Logger;
  private connectionPool: ClaudeConnectionPool;
  private fileManager: AsyncFileManager;
  private executionQueue: PQueue;
  private resultCache: TTLMap<string, TaskResult>;
  private executionHistory: CircularBuffer<{
    taskId: string;
    duration: number;
    status: 'success' | 'failed';
    timestamp: Date;
  }>;
  
  private metrics = {
    totalExecuted: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalExecutionTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  
  private activeExecutions = new Set<string>();
  private config: ExecutorConfig;
  
  constructor(config: ExecutorConfig = {}) {
    super();
    this.config = config;
    
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
    
    // Initialize execution queue
    this.executionQueue = new PQueue({ 
      concurrency: config.concurrency || 10 
    });
    
    // Initialize result cache
    this.resultCache = new TTLMap({
      defaultTTL: config.caching?.ttl || 3600000, // 1 hour
      maxSize: config.caching?.maxSize || 1000,
      onExpire: (key, value) => {
        this.logger.debug('Cache entry expired', { taskId: key });
      }
    });
    
    // Initialize execution history
    this.executionHistory = new CircularBuffer(1000);
    
    // Start monitoring if configured
    if (config.monitoring?.metricsInterval) {
      setInterval(() => {
        this.emitMetrics();
      }, config.monitoring.metricsInterval);
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
          timestamp: new Date()
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
          timestamp: new Date()
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
  
  getMetrics(): ExecutionMetrics {
    const history = this.executionHistory.getAll();
    const avgExecutionTime = this.metrics.totalExecuted > 0
      ? this.metrics.totalExecutionTime / this.metrics.totalExecuted
      : 0;
    
    const cacheTotal = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = cacheTotal > 0
      ? this.metrics.cacheHits / cacheTotal
      : 0;
    
    return {
      totalExecuted: this.metrics.totalExecuted,
      totalSucceeded: this.metrics.totalSucceeded,
      totalFailed: this.metrics.totalFailed,
      avgExecutionTime,
      cacheHitRate,
      queueLength: this.executionQueue.size,
      activeExecutions: this.activeExecutions.size
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
}