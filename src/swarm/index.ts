// Main exports for the swarm system
export * from './executor.ts';
export * from './types.ts';
// Export from coordinator.ts without TaskPattern
import { 
  SwarmCoordinator
  // Explicitly not exporting TaskPattern to avoid duplicate exports
} from './coordinator.ts';

// Export types
export { SwarmCoordinator };
export * from './strategies/base.ts';
export * from './strategies/auto.ts';
export * from './strategies/research.ts';
export * from './memory.ts';

// Prompt copying system exports
export * from './prompt-copier.ts';
export * from './prompt-utils.ts';
export * from './prompt-manager.ts';
export * from './prompt-cli.ts';

// Optimizations - commented out due to ExecutionMetrics naming conflict
// export * from './optimizations/index.ts';

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
    
    // Optimizations - commented out due to ExecutionMetrics naming conflict
    // optimizations: () => import('./optimizations/index.ts')
  };
}