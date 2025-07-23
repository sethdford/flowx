/**
 * Coordination System Exports
 */

// Core coordination components
export { CoordinationManager } from './manager.js';
export { TaskCoordinator } from './task-coordinator.js';
export { WorkStealingCoordinator } from './work-stealing.js';
export { CircuitBreakerManager, CircuitBreaker } from './circuit-breaker.js';

// Task execution and orchestration
export { TaskExecutionEngine } from './task-execution-engine.js';
export { BackgroundExecutor } from './background-executor.js';
export { LoadBalancer } from './load-balancer.js';

// Resource and conflict management
export { ResourceManager } from './resources.js';
export { ConflictResolver } from './conflict-resolution.js';
export { DependencyGraph } from './dependency-graph.js';

// Messaging and communication
export { MessageCoordinator } from './message-coordinator.js';

// Metrics and monitoring
export { CoordinationMetricsCollector } from './metrics.js';

// Types and interfaces
export type { ICoordinationManager, EnhancedCoordinationConfig } from './manager.js';
export type { CoordinationConfig, SchedulingStrategy } from './task-coordinator.js';
export type { WorkStealingConfig } from './work-stealing.js';
export type { CircuitBreakerConfig } from './circuit-breaker.js';
export type { LoadBalancerConfig } from './load-balancer.js';
export type { CoordinationMetrics } from './metrics.js';