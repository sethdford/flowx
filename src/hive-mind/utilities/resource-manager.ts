/**
 * Resource Manager for Hive Mind
 * 
 * Manages system resources, handles cleanup, and provides graceful termination.
 * Ensures proper resource allocation and deallocation for the collective intelligence system.
 */

import { EventEmitter } from 'node:events';
import { Logger } from '../../core/logger.js';
import { EventBus } from '../../core/event-bus.js';
import { HiveCoordinator } from '../hive-coordinator.js';

// Resource limits configuration
export interface ResourceLimitsConfig {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxConcurrentTasks: number;
  maxAgentProcesses: number;
  maxNetworkConnections: number;
  shutdownTimeoutMs: number;
  cleanupIntervalMs: number;
  monitoringIntervalMs: number;
  enableLeakDetection: boolean;
  enableHealthMonitoring: boolean;
}

// Default resource limits
const DEFAULT_RESOURCE_LIMITS: ResourceLimitsConfig = {
  maxMemoryMB: 1024,
  maxCpuPercent: 80,
  maxConcurrentTasks: 50,
  maxAgentProcesses: 20,
  maxNetworkConnections: 100,
  shutdownTimeoutMs: 10000,
  cleanupIntervalMs: 60000,
  monitoringIntervalMs: 30000,
  enableLeakDetection: true,
  enableHealthMonitoring: true
};

// Resource usage metrics
interface ResourceMetrics {
  memoryUsageMB: number;
  cpuPercent: number;
  activeAgents: number;
  activeTasks: number;
  networkConnections: number;
  totalLeaks: number;
  lastCleanup: Date;
}

/**
 * Resource Manager - Manages system resources and cleanup
 */
export class ResourceManager extends EventEmitter {
  private logger: Logger;
  private eventBus: EventBus;
  private config: ResourceLimitsConfig;
  
  // Resource tracking
  private resourceMetrics: ResourceMetrics;
  
  // Tracking objects to cleanup
  private registeredResources: Map<string, {
    type: string;
    resource: any;
    cleanup: () => Promise<void>;
    priority: number;
  }> = new Map();
  
  // Intervals
  private cleanupInterval?: NodeJS.Timeout;
  private monitoringInterval?: NodeJS.Timeout;
  
  // System state
  private isTerminating: boolean = false;
  
  constructor(config: Partial<ResourceLimitsConfig> = {}) {
    super();
    this.logger = new Logger('ResourceManager');
    this.eventBus = EventBus.getInstance();
    this.config = { ...DEFAULT_RESOURCE_LIMITS, ...config };
    
    // Initialize metrics
    this.resourceMetrics = {
      memoryUsageMB: 0,
      cpuPercent: 0,
      activeAgents: 0,
      activeTasks: 0,
      networkConnections: 0,
      totalLeaks: 0,
      lastCleanup: new Date()
    };
    
    this.setupEventListeners();
  }

  /**
   * Start the resource manager
   */
  public start(): void {
    this.logger.info('Starting resource manager');
    
    // Register process exit handlers
    this.registerExitHandlers();
    
    // Set up cleanup interval
    if (this.config.cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.performPeriodicCleanup().catch(error => {
          this.logger.error('Periodic cleanup failed', { error });
        });
      }, this.config.cleanupIntervalMs);
    }
    
    // Set up monitoring interval
    if (this.config.enableHealthMonitoring && this.config.monitoringIntervalMs > 0) {
      this.monitoringInterval = setInterval(() => {
        this.monitorResourceUsage().catch(error => {
          this.logger.error('Resource monitoring failed', { error });
        });
      }, this.config.monitoringIntervalMs);
    }
    
    this.logger.info('Resource manager started');
  }

  /**
   * Register exit handlers
   */
  private registerExitHandlers(): void {
    // Handle normal process termination
    process.on('exit', () => {
      this.logger.info('Process exit detected');
      // Note: At this point, only synchronous operations will work
      // This is for logging only
    });
    
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT').catch(error => {
        this.logger.error('Graceful shutdown failed', { error });
        process.exit(1);
      });
    });
    
    // Handle SIGTERM (process kill)
    process.on('SIGTERM', () => {
      this.logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM').catch(error => {
        this.logger.error('Graceful shutdown failed', { error });
        process.exit(1);
      });
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.gracefulShutdown('uncaughtException').catch(() => {
        process.exit(1);
      });
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection', { reason, promise });
      // Don't shut down for unhandled rejections, but log them
    });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for agent spawned events
    this.eventBus.on('agent:spawned', () => {
      this.resourceMetrics.activeAgents++;
      this.checkResourceLimits();
    });
    
    // Listen for agent termination events
    this.eventBus.on('agent:terminated', () => {
      if (this.resourceMetrics.activeAgents > 0) {
        this.resourceMetrics.activeAgents--;
      }
    });
    
    // Listen for task creation events
    this.eventBus.on('task:submitted', () => {
      this.resourceMetrics.activeTasks++;
      this.checkResourceLimits();
    });
    
    // Listen for task completion events
    this.eventBus.on('task:completed', () => {
      if (this.resourceMetrics.activeTasks > 0) {
        this.resourceMetrics.activeTasks--;
      }
    });
    
    // Listen for task failure events
    this.eventBus.on('task:failed', () => {
      if (this.resourceMetrics.activeTasks > 0) {
        this.resourceMetrics.activeTasks--;
      }
    });
    
    // Listen for network connection events
    this.eventBus.on('connection:opened', () => {
      this.resourceMetrics.networkConnections++;
      this.checkResourceLimits();
    });
    
    // Listen for network disconnection events
    this.eventBus.on('connection:closed', () => {
      if (this.resourceMetrics.networkConnections > 0) {
        this.resourceMetrics.networkConnections--;
      }
    });
    
    // Listen for potential memory leak warnings
    if (this.config.enableLeakDetection) {
      this.eventBus.on('memory:leak_detected', (data: { source: string; size: number }) => {
        this.resourceMetrics.totalLeaks++;
        this.logger.warn('Potential memory leak detected', {
          source: data.source,
          size: data.size,
          totalLeaks: this.resourceMetrics.totalLeaks
        });
      });
    }
  }

  /**
   * Monitor resource usage
   */
  private async monitorResourceUsage(): Promise<void> {
    try {
      // Get memory usage
      const memUsage = process.memoryUsage();
      this.resourceMetrics.memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // CPU usage is not directly available in Node.js
      // In a real implementation, this would use a library like pidusage
      // For now, we'll set a placeholder value
      this.resourceMetrics.cpuPercent = 0;
      
      // Check resource limits
      this.checkResourceLimits();
      
      // Emit resource metrics event
      this.eventBus.emit('resources:metrics', { ...this.resourceMetrics });
    } catch (error) {
      this.logger.error('Failed to monitor resource usage', { error });
    }
  }

  /**
   * Check if resource limits are exceeded
   */
  private checkResourceLimits(): void {
    const violations = [];
    
    // Check memory usage
    if (this.resourceMetrics.memoryUsageMB > this.config.maxMemoryMB) {
      violations.push({
        resource: 'memory',
        current: this.resourceMetrics.memoryUsageMB,
        limit: this.config.maxMemoryMB
      });
    }
    
    // Check CPU usage
    if (this.resourceMetrics.cpuPercent > this.config.maxCpuPercent) {
      violations.push({
        resource: 'cpu',
        current: this.resourceMetrics.cpuPercent,
        limit: this.config.maxCpuPercent
      });
    }
    
    // Check agent count
    if (this.resourceMetrics.activeAgents > this.config.maxAgentProcesses) {
      violations.push({
        resource: 'agents',
        current: this.resourceMetrics.activeAgents,
        limit: this.config.maxAgentProcesses
      });
    }
    
    // Check task count
    if (this.resourceMetrics.activeTasks > this.config.maxConcurrentTasks) {
      violations.push({
        resource: 'tasks',
        current: this.resourceMetrics.activeTasks,
        limit: this.config.maxConcurrentTasks
      });
    }
    
    // Check network connections
    if (this.resourceMetrics.networkConnections > this.config.maxNetworkConnections) {
      violations.push({
        resource: 'connections',
        current: this.resourceMetrics.networkConnections,
        limit: this.config.maxNetworkConnections
      });
    }
    
    // Handle violations
    if (violations.length > 0) {
      this.logger.warn('Resource limits exceeded', { violations });
      
      // Emit resource limit violation event
      this.eventBus.emit('resources:limits_exceeded', { violations });
    }
  }

  /**
   * Register a resource for cleanup
   */
  public registerResource(
    resourceId: string,
    type: string,
    resource: any,
    cleanup: () => Promise<void>,
    priority: number = 0
  ): void {
    this.registeredResources.set(resourceId, {
      type,
      resource,
      cleanup,
      priority
    });
    
    this.logger.debug('Resource registered for cleanup', {
      resourceId,
      type
    });
  }

  /**
   * Unregister a resource
   */
  public unregisterResource(resourceId: string): void {
    if (this.registeredResources.has(resourceId)) {
      this.registeredResources.delete(resourceId);
      
      this.logger.debug('Resource unregistered', {
        resourceId
      });
    }
  }

  /**
   * Perform periodic cleanup of resources
   */
  private async performPeriodicCleanup(): Promise<void> {
    if (this.isTerminating) return;
    
    this.logger.debug('Performing periodic cleanup');
    
    try {
      // Update last cleanup time
      this.resourceMetrics.lastCleanup = new Date();
      
      // Emit cleanup event
      this.eventBus.emit('resources:cleanup_started');
      
      // Run garbage collection if available
      if (global.gc) {
        try {
          global.gc();
          this.logger.debug('Garbage collection triggered');
        } catch (error) {
          this.logger.warn('Garbage collection failed', { error });
        }
      }
      
      // Emit cleanup completed event
      this.eventBus.emit('resources:cleanup_completed');
      
      this.logger.debug('Periodic cleanup completed');
    } catch (error) {
      this.logger.error('Periodic cleanup failed', { error });
      this.eventBus.emit('resources:cleanup_failed', { error });
    }
  }

  /**
   * Register a Hive Coordinator for cleanup
   */
  public registerHiveCoordinator(
    coordinator: HiveCoordinator, 
    priority: number = 10
  ): void {
    const resourceId = `hive-coordinator-${Date.now()}`;
    
    this.registerResource(
      resourceId,
      'hive-coordinator',
      coordinator,
      async () => {
        this.logger.info('Shutting down Hive Coordinator');
        try {
          await coordinator.stop();
          this.logger.info('Hive Coordinator shutdown complete');
        } catch (error) {
          this.logger.error('Failed to shutdown Hive Coordinator', { error });
          throw error;
        }
      },
      priority
    );
    
    this.logger.info('Hive Coordinator registered for cleanup', {
      resourceId
    });
  }

  /**
   * Graceful system shutdown
   */
  public async gracefulShutdown(reason: string = 'manual'): Promise<void> {
    if (this.isTerminating) {
      this.logger.info('Shutdown already in progress, skipping');
      return;
    }
    
    this.isTerminating = true;
    this.logger.info('Initiating graceful shutdown', { reason });
    
    // Set timeout for forced exit
    const forceExitTimeout = setTimeout(() => {
      this.logger.error('Forced exit due to shutdown timeout');
      process.exit(1);
    }, this.config.shutdownTimeoutMs);
    
    try {
      // Emit shutdown event
      this.eventBus.emit('system:shutdown_initiated', { reason });
      
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }
      
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }
      
      // Clean up registered resources in priority order (higher priority first)
      const resourceEntries = Array.from(this.registeredResources.entries())
        .sort((a, b) => b[1].priority - a[1].priority);
      
      this.logger.info(`Cleaning up ${resourceEntries.length} registered resources`);
      
      for (const [resourceId, resourceInfo] of resourceEntries) {
        try {
          this.logger.debug(`Cleaning up resource: ${resourceId} (${resourceInfo.type})`);
          await resourceInfo.cleanup();
          this.registeredResources.delete(resourceId);
        } catch (error) {
          this.logger.error(`Failed to clean up resource: ${resourceId}`, { 
            type: resourceInfo.type,
            error
          });
        }
      }
      
      // Run final garbage collection
      if (global.gc) {
        try {
          global.gc();
        } catch (error) {
          this.logger.warn('Final garbage collection failed', { error });
        }
      }
      
      // Emit shutdown completed event
      this.eventBus.emit('system:shutdown_completed');
      
      this.logger.info('Graceful shutdown completed');
      
      // Clear force exit timeout
      clearTimeout(forceExitTimeout);
      
      // In a real application, we might want to exit the process here
      // but for a library, we'll let the caller decide
    } catch (error) {
      this.logger.error('Error during graceful shutdown', { error });
      
      // Clear force exit timeout
      clearTimeout(forceExitTimeout);
      
      // Re-throw error
      throw error;
    }
  }

  /**
   * Get resource usage metrics
   */
  public getResourceMetrics(): ResourceMetrics {
    return { ...this.resourceMetrics };
  }

  /**
   * Check if system is within resource limits
   */
  public isHealthy(): boolean {
    return (
      this.resourceMetrics.memoryUsageMB <= this.config.maxMemoryMB &&
      this.resourceMetrics.cpuPercent <= this.config.maxCpuPercent &&
      this.resourceMetrics.activeAgents <= this.config.maxAgentProcesses &&
      this.resourceMetrics.activeTasks <= this.config.maxConcurrentTasks &&
      this.resourceMetrics.networkConnections <= this.config.maxNetworkConnections
    );
  }

  /**
   * Stop the resource manager
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping resource manager');
    
    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    // Unregister exit handlers (not possible directly, but we can set flags)
    this.isTerminating = true;
    
    this.logger.info('Resource manager stopped');
  }
}

/**
 * Create and start a resource manager
 */
export function createResourceManager(
  config: Partial<ResourceLimitsConfig> = {}
): ResourceManager {
  const manager = new ResourceManager(config);
  manager.start();
  return manager;
}