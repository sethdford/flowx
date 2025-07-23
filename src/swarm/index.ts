// Main exports for the swarm system
export * from './executor.js';
export { FlowXExecutor } from './flowx-executor.js';
export type { FlowXExecutorConfig, FlowXExecutionOptions, FlowXExecutionResult } from './flowx-executor.js';
export * from './types.js';
// Export from coordinator.ts without TaskPattern
import { 
  SwarmCoordinator
  // Explicitly not exporting TaskPattern to avoid duplicate exports
} from './coordinator.js';

// Export types
export * from './types.js';
export { SwarmCoordinator };

// Export executors
export * from './executors/index.js';

// Export memory
export * from './memory.js';

// Export prompt system
export * from './prompt-copier.js';
export * from './prompt-utils.js';
export * from './prompt-manager.js';
export * from './prompt-cli.js';

// Optimizations - fix naming conflicts with selective exports
export { 
  ClaudeConnectionPool, 
  AsyncFileManager, 
  CircularBuffer, 
  TTLMap, 
  OptimizedExecutor, 
  AgentCapabilityIndex 
} from './optimizations/index.js';

export type { 
  PoolConfig, 
  PooledConnection, 
  FileOperationResult, 
  TTLMapOptions, 
  ExecutorConfig, 
  OptimizedExecutionMetrics, 
  AgentCapability, 
  AgentPerformanceMetrics, 
  CapabilityMatch, 
  IndexConfig 
} from './optimizations/index.js';

// Utility function to get all exports
export function getSwarmComponents() {
  return {
    // Core components
    coordinator: () => import('./coordinator.ts'),
    executor: () => import('./executor.ts'),
    types: () => import('./types.ts'),
    
    // Strategies
    strategies: {
      base: () => import('./strategies/base.ts'),
      auto: () => import('./strategies/auto.ts'),
      research: () => import('./strategies/research.ts')
    },
    
    // Memory
    memory: () => import('./memory.ts'),
    
    // Prompt system
    promptCopier: () => import('./prompt-copier.ts'),
    promptUtils: () => import('./prompt-utils.ts'),
    promptManager: () => import('./prompt-manager.ts'),
    promptCli: () => import('./prompt-cli.ts'),
    
    // Optimizations - now available
    optimizations: () => import('./optimizations/index.ts')
  };
}