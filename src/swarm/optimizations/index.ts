/**
 * Swarm Optimizations
 * Export all optimization components
 */

export { ClaudeConnectionPool } from "./connection-pool.js";
export type { PoolConfig, PooledConnection } from "./connection-pool.js";

export { AsyncFileManager } from "./async-file-manager.js";
export type { FileOperationResult } from "./async-file-manager.js";

export { CircularBuffer } from "./circular-buffer.js";

export { TTLMap } from "./ttl-map.js";
export type { TTLMapOptions } from "./ttl-map.js";

export { OptimizedExecutor } from "./optimized-executor.js";
export type { ExecutorConfig, ExecutionMetrics as OptimizedExecutionMetrics } from "./optimized-executor.js";

export { AgentCapabilityIndex } from "./agent-capability-index.js";
export type { 
  AgentCapability, 
  AgentPerformanceMetrics, 
  CapabilityMatch, 
  IndexConfig 
} from "./agent-capability-index.js";

