/**
 * Specialized Task Executors
 * Provides different execution strategies for various task types and requirements
 */

// Direct Executor - Immediate execution without queuing
export { DirectExecutor } from "./direct-executor.js";
export type { 
  DirectExecutorConfig, 
  DirectExecutionMetrics 
} from "./direct-executor.js";

// SPARC Executor - Systematic methodology execution
export { SparcExecutor } from "./sparc-executor.js";
export type { 
  SparcExecutorConfig, 
  SparcPhase,
  SparcPhaseResult,
  SparcExecutionResult,
  SparcExecutionMetrics 
} from "./sparc-executor.js";

// Import for internal use
import { DirectExecutor } from "./direct-executor.js";
import { SparcExecutor } from "./sparc-executor.js";

// Unified executor types
export type ExecutorType = 
  | 'direct'     // Immediate execution
  | 'sparc'      // SPARC methodology
  | 'claude'     // Claude Flow integration (coming soon)
  | 'v2'         // Enhanced environment handling (coming soon)
  | 'optimized'; // Performance optimized (available)

export interface ExecutorFactory {
  createDirectExecutor(config?: any): DirectExecutor;
  createSparcExecutor(config?: any): SparcExecutor;
  getAvailableExecutors(): ExecutorType[];
  getExecutorCapabilities(type: ExecutorType): string[];
}

/**
 * Factory for creating specialized executors
 */
export class TaskExecutorFactory implements ExecutorFactory {
  
  /**
   * Create a DirectExecutor instance
   */
  createDirectExecutor(config?: any): DirectExecutor {
    return new DirectExecutor(config);
  }
  
  /**
   * Create a SparcExecutor instance
   */
  createSparcExecutor(config?: any): SparcExecutor {
    return new SparcExecutor(config);
  }
  
  /**
   * Get list of available executor types
   */
  getAvailableExecutors(): ExecutorType[] {
    return ['direct', 'sparc', 'optimized'];
  }
  
  /**
   * Get capabilities for each executor type
   */
  getExecutorCapabilities(type: ExecutorType): string[] {
    switch (type) {
      case 'direct':
        return [
          'immediate_execution',
          'priority_bypass',
          'timeout_handling',
          'parallel_immediate_tasks',
          'connection_pooling'
        ];
        
      case 'sparc':
        return [
          'systematic_methodology',
          'five_phase_execution',
          'quality_evaluation',
          'phase_by_phase_analysis',
          'comprehensive_documentation',
          'review_validation',
          'architecture_design'
        ];
        
      case 'optimized':
        return [
          'performance_optimization',
          'connection_pooling',
          'result_caching',
          'parallel_execution',
          'workload_balancing',
          'retry_logic',
          'metrics_collection'
        ];
        
      case 'claude':
        return [
          'flowx_integration', // Coming soon
          'full_sparc_integration',
          'advanced_context_handling'
        ];
        
      case 'v2':
        return [
          'enhanced_environment', // Coming soon
          'improved_error_handling',
          'advanced_resource_management'
        ];
        
      default:
        return [];
    }
  }
  
  /**
   * Get recommended executor for task type
   */
  getRecommendedExecutor(taskType: string, priority: string): ExecutorType {
    // High priority tasks should use direct execution
    if (priority === 'critical' || priority === 'high') {
      return 'direct';
    }
    
    // Complex development tasks should use SPARC methodology
    if (taskType === 'coding' || taskType === 'architecture' || taskType === 'documentation') {
      return 'sparc';
    }
    
    // Analysis and research tasks work well with optimized executor
    if (taskType === 'analysis' || taskType === 'research') {
      return 'optimized';
    }
    
    // Default to optimized for best performance
    return 'optimized';
  }
  
  /**
   * Create executor based on task requirements
   */
  createRecommendedExecutor(taskType: string, priority: string, config?: any): DirectExecutor | SparcExecutor {
    const recommendedType = this.getRecommendedExecutor(taskType, priority);
    
    switch (recommendedType) {
      case 'direct':
        return this.createDirectExecutor(config);
      case 'sparc':
        return this.createSparcExecutor(config);
      default:
        return this.createDirectExecutor(config); // Fallback
    }
  }
}

// Export singleton factory instance
export const executorFactory = new TaskExecutorFactory(); 