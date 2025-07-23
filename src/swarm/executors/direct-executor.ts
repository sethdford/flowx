/**
 * Direct Task Executor
 * Provides immediate task execution without queuing for high-priority tasks
 */

import { EventEmitter } from 'node:events';
import { Logger } from "../../core/logger.js";
import { ClaudeConnectionPool } from "../optimizations/connection-pool.js";
import { AsyncFileManager } from "../optimizations/async-file-manager.js";
import { 
  TaskDefinition, 
  TaskResult, 
  AgentId,
  TaskStatus,
  TaskType,
  TaskPriority
} from "../types.js";

export interface DirectExecutorConfig {
  connectionPool?: {
    min?: number;
    max?: number;
  };
  fileOperations?: {
    outputDir?: string;
    concurrency?: number;
  };
  monitoring?: {
    metricsInterval?: number;
    slowTaskThreshold?: number;
  };
  immediateExecution?: {
    timeout?: number;
    retryOnFailure?: boolean;
    maxRetries?: number;
  };
}

export interface DirectExecutionMetrics {
  totalExecuted: number;
  totalSucceeded: number;
  totalFailed: number;
  avgExecutionTime: number;
  immediateExecutions: number;
  timeoutErrors: number;
  priorityBypass: number;
}

export class DirectExecutor extends EventEmitter {
  private logger: Logger;
  private connectionPool: ClaudeConnectionPool;
  private fileManager: AsyncFileManager;
  private config: DirectExecutorConfig;
  
  private metrics = {
    totalExecuted: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalExecutionTime: 0,
    immediateExecutions: 0,
    timeoutErrors: 0,
    priorityBypass: 0
  };
  
  private activeExecutions = new Set<string>();
  
  constructor(config: DirectExecutorConfig = {}) {
    super();
    this.config = {
      ...config,
      immediateExecution: {
        timeout: 60000, // 1 minute default
        retryOnFailure: false, // Direct execution typically shouldn't retry
        maxRetries: 1,
        ...config.immediateExecution
      }
    };
    
    this.logger = new Logger(
      { level: 'info', format: 'json', destination: 'console' },
      { component: 'DirectExecutor' }
    );
    
    // Initialize connection pool with immediate availability
    this.connectionPool = new ClaudeConnectionPool({
      min: config.connectionPool?.min || 2,
      max: config.connectionPool?.max || 5
    } as any);
    
    // Initialize file manager
    this.fileManager = new AsyncFileManager({
      write: config.fileOperations?.concurrency || 5,
      read: config.fileOperations?.concurrency || 10
    });
    
    // Start monitoring if configured
    if (config.monitoring?.metricsInterval) {
      setInterval(() => {
        this.emitMetrics();
      }, config.monitoring.metricsInterval);
    }
  }
  
  /**
   * Execute task immediately without queuing
   */
  async executeTaskImmediate(task: TaskDefinition, agentId: AgentId): Promise<TaskResult> {
    const startTime = Date.now();
    const executionId = `${task.id.id}-${Date.now()}`;
    
    this.logger.info('Starting immediate task execution', {
      taskId: task.id.id,
      agentId: agentId.id,
      executionId,
      priority: task.priority
    });
    
    // Track metrics
    this.metrics.totalExecuted++;
    this.metrics.immediateExecutions++;
    this.activeExecutions.add(executionId);
    
    // Check if this is a priority bypass (critical/high priority)
    if (task.priority === 'critical' || task.priority === 'high') {
      this.metrics.priorityBypass++;
      this.logger.info('Priority bypass activated', {
        taskId: task.id.id,
        priority: task.priority
      });
    }
    
    try {
      // Execute with timeout
      const result = await Promise.race([
        this.executeWithConnection(task, agentId, startTime),
        this.createTimeoutPromise(executionId)
      ]);
      
      // Update success metrics
      this.metrics.totalSucceeded++;
      this.metrics.totalExecutionTime += Date.now() - startTime;
      
      this.logger.info('Immediate task execution completed successfully', {
        taskId: task.id.id,
        agentId: agentId.id,
        executionTime: Date.now() - startTime,
        executionId
      });
      
      this.emit('task:completed', result);
      return result;
      
    } catch (error) {
      this.metrics.totalFailed++;
      
      if (error instanceof Error && error.message.includes('timeout')) {
        this.metrics.timeoutErrors++;
      }
      
      const errorResult = this.createErrorResult(task, agentId, error, startTime);
      
      this.logger.error('Immediate task execution failed', {
        taskId: task.id.id,
        agentId: agentId.id,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        executionId
      });
      
      this.emit('task:failed', errorResult);
      return errorResult;
      
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }
  
  /**
   * Execute multiple tasks immediately in parallel
   */
  async executeTasksImmediate(tasks: TaskDefinition[], agentIds: AgentId[]): Promise<TaskResult[]> {
    this.logger.info('Starting immediate parallel task execution', {
      taskCount: tasks.length,
      agentCount: agentIds.length
    });
    
    const promises = tasks.map((task, index) => {
      const agentId = agentIds[index % agentIds.length];
      return this.executeTaskImmediate(task, agentId);
    });
    
    const results = await Promise.all(promises);
    
    this.logger.info('Immediate parallel task execution completed', {
      taskCount: tasks.length,
      successCount: results.filter(r => r.metadata.success).length,
      failureCount: results.filter(r => !r.metadata.success).length
    });
    
    return results;
  }
  
  /**
   * Execute task with connection pool
   */
  private async executeWithConnection(
    task: TaskDefinition, 
    agentId: AgentId, 
    startTime: number
  ): Promise<TaskResult> {
    return this.connectionPool.execute(async (api) => {
      const response = await (api as any).messages.create({
        messages: this.buildMessages(task),
        model: (task.context as any)?.model || 'claude-3-5-sonnet-20241022',
        max_tokens: (task.constraints as any)?.maxTokens || 4096,
        temperature: (task.context as any)?.temperature || 0.7
      });
      
      const executionResult = {
        success: true,
        output: response.content[0]?.text || '',
        usage: {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0
        }
      };
      
      // Save result to file asynchronously if configured
      if (this.config.fileOperations?.outputDir) {
        const outputPath = `${this.config.fileOperations.outputDir}/${task.id.id}-direct.json`;
        await this.fileManager.writeJSON(outputPath, {
          taskId: task.id.id,
          agentId: agentId.id,
          result: executionResult,
          executionType: 'direct',
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
          timestamp: new Date(),
          executionType: 'direct'
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
      
      return taskResult;
    });
  }
  
  /**
   * Create timeout promise for immediate execution
   */
  private createTimeoutPromise(executionId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Direct execution timeout for ${executionId}`));
      }, this.config.immediateExecution?.timeout || 60000);
    });
  }
  
  /**
   * Build messages for Claude API
   */
  private buildMessages(task: TaskDefinition): any[] {
    const messages = [];
    
    // Add system context if available
    if (task.context?.system) {
      messages.push({
        role: 'system',
        content: task.context.system
      });
    }
    
    // Add main instruction
    messages.push({
      role: 'user',
      content: task.instructions
    });
    
    // Add examples if available
    if (task.examples?.length) {
      task.examples.forEach((example, index) => {
        messages.push({
          role: 'user',
          content: `Example ${index + 1}: ${JSON.stringify(example)}`
        });
      });
    }
    
    return messages;
  }
  
  /**
   * Create error result
   */
  private createErrorResult(
    task: TaskDefinition, 
    agentId: AgentId, 
    error: any, 
    startTime: number
  ): TaskResult {
    return {
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
          recoverable: false, // Direct execution errors typically aren't recoverable
          retryable: false    // Direct execution shouldn't retry
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
        executionType: 'direct'
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
  }
  
  /**
   * Get current execution metrics
   */
  getMetrics(): DirectExecutionMetrics {
    const totalTasks = this.metrics.totalExecuted || 1;
    
    return {
      totalExecuted: this.metrics.totalExecuted,
      totalSucceeded: this.metrics.totalSucceeded,
      totalFailed: this.metrics.totalFailed,
      avgExecutionTime: this.metrics.totalExecutionTime / totalTasks,
      immediateExecutions: this.metrics.immediateExecutions,
      timeoutErrors: this.metrics.timeoutErrors,
      priorityBypass: this.metrics.priorityBypass
    };
  }
  
  /**
   * Get current status
   */
  getStatus(): {
    isReady: boolean;
    activeExecutions: number;
    connectionPoolStatus: any;
    metrics: DirectExecutionMetrics;
  } {
    return {
      isReady: this.activeExecutions.size < 10, // Ready if not too many concurrent
      activeExecutions: this.activeExecutions.size,
      connectionPoolStatus: this.connectionPool.getStats(),
      metrics: this.getMetrics()
    };
  }
  
  /**
   * Emit metrics event
   */
  private emitMetrics(): void {
    const metrics = this.getMetrics();
    this.emit('metrics', metrics);
    
    this.logger.debug('Direct executor metrics', metrics);
  }
  
  /**
   * Shutdown executor gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down DirectExecutor', {
      activeExecutions: this.activeExecutions.size
    });
    
    // Wait for active executions to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeExecutions.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeExecutions.size > 0) {
      this.logger.warn('Forcefully shutting down with active executions', {
        activeExecutions: this.activeExecutions.size
      });
    }
    
    this.emit('shutdown');
  }
} 