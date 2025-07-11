/**
 * Plugin system for the benchmark engine
 */

import { Benchmark, Task, Result } from './models';
import { DateTime } from 'luxon';

/**
 * Base class for engine plugins
 */
export class EnginePlugin {
  /**
   * Called before benchmark execution
   * @param benchmark The benchmark being executed
   */
  async preBenchmark(benchmark: Benchmark): Promise<void> {
    // Empty implementation - override in subclasses
  }
  
  /**
   * Called after benchmark execution
   * @param benchmark The benchmark that was executed
   */
  async postBenchmark(benchmark: Benchmark): Promise<void> {
    // Empty implementation - override in subclasses
  }
  
  /**
   * Called before task execution
   * @param task The task being executed
   */
  async preTask(task: Task): Promise<void> {
    // Empty implementation - override in subclasses
  }
  
  /**
   * Called after task execution with the result
   * @param task The task that was executed
   * @param result The result of the task execution
   * @returns The result, potentially modified
   */
  async postTask(task: Task, result: Result): Promise<Result> {
    return result; // Default implementation returns the result unchanged
  }
}

/**
 * Plugin for optimized execution
 */
export class OptimizationPlugin extends EnginePlugin {
  private cache: Record<string, any> = {};
  private executionHistory: any[] = [];
  
  constructor(private config: Record<string, any> = {}) {
    super();
  }
  
  override async preBenchmark(benchmark: Benchmark): Promise<void> {
    // Setup optimization for benchmark
    benchmark.metadata.optimized = true;
  }
  
  override async postBenchmark(benchmark: Benchmark): Promise<void> {
    // Log optimization metrics
    benchmark.metadata.optimization_metrics = {
      cache_hits: Object.keys(this.cache).length,
      execution_history: this.executionHistory.length
    };
  }
  
  override async preTask(task: Task): Promise<void> {
    // Apply task-level optimizations
    task.parameters.optimized = true;
    
    // Check cache for similar tasks
    const cacheKey = `${task.strategy}-${task.objective}`;
    if (this.cache[cacheKey]) {
      task.metadata.cache_hit = true;
      task.metadata.cache_key = cacheKey;
    }
  }
  
  override async postTask(task: Task, result: Result): Promise<Result> {
    // Cache result for reuse
    const cacheKey = `${task.strategy}-${task.objective}`;
    this.cache[cacheKey] = {
      result_id: result.id,
      timestamp: new Date().toISOString()
    };
    
    // Record execution for metrics
    this.executionHistory.push({
      task_id: task.id,
      execution_time: result.performanceMetrics.executionTime,
      timestamp: new Date().toISOString()
    });
    
    return result;
  }
}

/**
 * Plugin for metrics collection
 */
export class MetricsCollectionPlugin extends EnginePlugin {
  private metricsBuffer: any[] = [];
  private activeCollectors: Record<string, any> = {};
  
  constructor(private samplingInterval: number = 0.1) {
    super();
  }
  
  override async preBenchmark(benchmark: Benchmark): Promise<void> {
    // Initialize metrics collection for benchmark
    benchmark.metadata.metrics_collection = {
      started_at: new Date().toISOString(),
      sampling_interval: this.samplingInterval
    };
  }
  
  override async postBenchmark(benchmark: Benchmark): Promise<void> {
    // Finalize metrics collection and aggregate results
    benchmark.metadata.metrics_collection.completed_at = new Date().toISOString();
    
    // Aggregate metrics across all tasks
    if (benchmark.results && benchmark.results.length > 0) {
      const peakMemory = Math.max(...benchmark.results.map(r => r.resourceUsage.peakMemoryMb));
      const avgCpu = benchmark.results.reduce((sum, r) => sum + r.resourceUsage.averageCpuPercent, 0) / benchmark.results.length;
      
      benchmark.metadata.metrics_collection.peak_memory_mb = peakMemory;
      benchmark.metadata.metrics_collection.avg_cpu_percent = avgCpu;
    }
  }
  
  override async preTask(task: Task): Promise<void> {
    // Start performance collector for this task
    const collectorId = `task_${task.id}`;
    this.activeCollectors[collectorId] = {
      start_time: new Date(),
      metrics: []
    };
  }
  
  override async postTask(task: Task, result: Result): Promise<Result> {
    // Get collector for this task
    const collectorId = `task_${task.id}`;
    if (this.activeCollectors[collectorId]) {
      const collector = this.activeCollectors[collectorId];
      collector.end_time = new Date();
      
      // Calculate execution time
      const executionTime = (collector.end_time.getTime() - collector.start_time.getTime()) / 1000;
      result.performanceMetrics.executionTime = executionTime;
      
      // Clean up
      this.metricsBuffer.push(...collector.metrics);
      delete this.activeCollectors[collectorId];
    }
    
    return result;
  }
}