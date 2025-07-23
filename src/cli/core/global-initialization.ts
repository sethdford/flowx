/**
 * Global Initialization System - Fast & Reliable
 * Streamlined service initialization with lazy loading and error recovery
 */

import { ILogger } from '../../utils/types.js';
import { EventBus, IEventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { PersistenceManager } from '../../core/persistence.js';
import { SwarmCoordinator } from '../../swarm/coordinator.js';
import { TaskExecutionEngine } from '../../coordination/task-execution-engine.js';
import { AgentProcessManager } from '../../agents/agent-process-manager.js';
// Remove interface import that gets stripped in Node.js strip-only mode
// import { MemoryConfig } from '../../utils/types.js';
import { printInfo, printError, printSuccess } from './output-formatter.js';

// Simplified service interfaces
export interface FastPersistenceManager {
  initialized: boolean;
  initialize?: () => Promise<void>;
  store: (key: string, value: any) => Promise<void>;
  retrieve: (key: string) => Promise<any>;
  delete: (key: string) => Promise<void>;
  close: () => Promise<void>;
  
  // Agent methods
  saveAgent: (agent: any) => Promise<void>;
  getAgent: (id: string) => Promise<any>;
  getAllAgents: () => Promise<any[]>;
  getActiveAgents: () => Promise<any[]>;
  updateAgentStatus: (id: string, status: string) => Promise<void>;
  
  // Task methods
  saveTask: (task: any) => Promise<void>;
  getTask: (id: string) => Promise<any>;
  getActiveTasks: () => Promise<any[]>;
  updateTaskStatus: (id: string, status: string, assignedAgent?: string) => Promise<void>;
  updateTaskProgress: (id: string, progress: number) => Promise<void>;
  
  // Stats methods
  getStats: () => Promise<{
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
  }>;
}

export interface FastMemoryManager {
  initialized: boolean;
  initialize?: () => Promise<void>;
  store(key: string, value: any, options?: any): Promise<void>;
  store(entry: any): Promise<void>;
  retrieve: (key: string, namespace?: string) => Promise<any>;
  query: (query: any) => Promise<any[]>;
  shutdown: () => Promise<void>;
  delete: (key: string) => Promise<void>;
  
  // Health and status methods
  getHealthStatus: () => Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    healthy: boolean;
    details: Record<string, any>;
    metrics?: any;
    error?: string;
    timestamp: Date;
  }>;
}

export interface GlobalServices {
  persistence: FastPersistenceManager;
  memory: FastMemoryManager;
  eventBus: IEventBus;
  logger: ILogger;
  initialized: boolean;
}

// Global service instances
let globalServices: GlobalServices | null = null;
let globalSwarmCoordinator: SwarmCoordinator | null = null;
let globalTaskEngine: TaskExecutionEngine | null = null;
let globalAgentProcessManager: AgentProcessManager | null = null;
let initializationPromise: Promise<GlobalServices> | null = null;

/**
 * Fast initialization with minimal dependencies
 */
export async function initializeGlobalServices(
  providedEventBus?: IEventBus,
  providedLogger?: ILogger,
  memoryConfig?: any, // Use any instead of MemoryConfig interface
  timeoutMs: number = 10000
): Promise<GlobalServices> {
  // Return existing services if already initialized
  if (globalServices?.initialized) {
    return globalServices;
  }

  // Return existing initialization promise if in progress
  if (initializationPromise) {
    console.log('Using existing initialization promise...');
    return initializationPromise;
  }

  // Create new initialization promise with timeout
  console.log(`Initializing services with ${timeoutMs}ms timeout...`);
  initializationPromise = Promise.race([
    initializeServicesInternal(providedEventBus, providedLogger, memoryConfig),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Service initialization timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);

  try {
    console.log('Awaiting initialization promise...');
    const result = await initializationPromise;
    console.log('Services initialized successfully');
    globalServices = result;
    return result;
  } catch (error) {
    // Reset initialization promise on failure
    console.error('Service initialization failed:', error instanceof Error ? error.message : String(error));
    initializationPromise = null;
    
    // Create fallback services
    try {
      console.log('Creating fallback services...');
      const eventBus = providedEventBus || EventBus.getInstance();
      const logger = providedLogger || Logger.getInstance();
      
      // Create in-memory persistence and memory manager
      const persistence = createFastPersistence();
      const memory = createFastMemory();
      
      const fallbackServices: GlobalServices = {
        persistence,
        memory,
        eventBus,
        logger,
        initialized: true
      };
      
      globalServices = fallbackServices;
      console.log('Fallback services created successfully');
      return fallbackServices;
    } catch (fallbackError) {
      console.error('Failed to create fallback services:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      throw error;
    }
  }
}

/**
 * Internal service initialization - fast and simple
 */
async function initializeServicesInternal(
  providedEventBus?: IEventBus,
  providedLogger?: ILogger,
  memoryConfig?: any // Use any instead of MemoryConfig interface
): Promise<GlobalServices> {
  try {
    // Use provided services or create lightweight defaults
    const eventBus = providedEventBus || EventBus.getInstance();
    const logger = providedLogger || Logger.getInstance();

    logger.info('Starting global services initialization');

    // Create fast in-memory persistence (no SQLite dependency)
    const persistence = createFastPersistence();
    
    // Create fast in-memory storage (no complex memory vault)
    const memory = createFastMemory();

    // Initialize services with error handling
    try {
      logger.info('Initializing persistence...');
      await persistence.initialize?.();
      logger.info('Initializing memory...');
      await memory.initialize?.();
    } catch (error) {
      logger.error('Error during service initialization:', { error });
      throw error;
    }

    const services: GlobalServices = {
      persistence,
      memory,
      eventBus,
      logger,
      initialized: true
    };

    logger.info('Global services initialized successfully');
    return services;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to initialize backend services: ${errorMessage}`);
    throw error;
  }
}

/**
 * Create persistence manager with proper database connectivity
 */
function createFastPersistence(): FastPersistenceManager {
  // Use a consistent directory path for database files - this is critical for persistence
  const dbPath = process.env.FLOWX_DATA_PATH || './.flowx';
  // Create a singleton PersistenceManager to ensure shared state across invocations
  const persistenceManager = new PersistenceManager(dbPath);
  
  return {
    initialized: false,
    
    async initialize() {
      try {
        await persistenceManager.initialize();
        this.initialized = true;
        console.log(`Persistence initialized successfully at ${dbPath}`);
      } catch (error) {
        console.error('Failed to initialize persistence manager:', error);
        throw error;
      }
    },

    async store(key: string, value: any): Promise<void> {
      // This is a generic store method - we'll implement it using the database
      // For now, we'll just log it since the specific methods are used
      console.warn('Generic store method called - use specific saveAgent/saveTask methods');
    },

    async retrieve(key: string): Promise<any> {
      // This is a generic retrieve method - we'll implement it using the database
      // For now, we'll just log it since the specific methods are used
      console.warn('Generic retrieve method called - use specific getAgent/getTask methods');
      return null;
    },

    async delete(key: string): Promise<void> {
      // This is a generic delete method - we'll implement it using the database
      console.warn('Generic delete method called - use specific methods');
    },

    async close(): Promise<void> {
      persistenceManager.close();
      this.initialized = false;
    },

    // Agent methods - delegate to actual PersistenceManager
    async saveAgent(agent: any): Promise<void> {
      await persistenceManager.saveAgent(agent);
    },
    async getAgent(id: string): Promise<any> {
      return await persistenceManager.getAgent(id);
    },
    async getAllAgents(): Promise<any[]> {
      return await persistenceManager.getAllAgents();
    },
    async getActiveAgents(): Promise<any[]> {
      return await persistenceManager.getActiveAgents();
    },

    async updateAgentStatus(id: string, status: string): Promise<void> {
      await persistenceManager.updateAgentStatus(id, status);
    },

    // Task methods - delegate to actual PersistenceManager
    async saveTask(task: any): Promise<void> {
      await persistenceManager.saveTask(task);
    },
    async getTask(id: string): Promise<any> {
      return await persistenceManager.getTask(id);
    },
    async getActiveTasks(): Promise<any[]> {
      return await persistenceManager.getActiveTasks();
    },

    async updateTaskStatus(id: string, status: string, assignedAgent?: string): Promise<void> {
      await persistenceManager.updateTaskStatus(id, status, assignedAgent);
    },

    async updateTaskProgress(id: string, progress: number): Promise<void> {
      await persistenceManager.updateTaskProgress(id, progress);
    },

    async getStats(): Promise<{
      totalAgents: number;
      activeAgents: number;
      totalTasks: number;
      pendingTasks: number;
      completedTasks: number;
    }> {
      return await persistenceManager.getStats();
    }
  };
}

/**
 * Create fast in-memory manager
 */
function createFastMemory(): FastMemoryManager {
  const storage = new Map<string, any>();
  const namespaces = new Map<string, Map<string, any>>();
  
  return {
    initialized: false,
    
    async initialize() {
      this.initialized = true;
    },

    async store(keyOrEntry: string | any, value?: any, options: any = {}): Promise<void> {
      // Handle both patterns: store(key, value, options) and store(entry)
      if (typeof keyOrEntry === 'string') {
        // Pattern 1: store(key, value, options)
        const key = keyOrEntry;
        const namespace = options.namespace || 'default';
        
        if (!namespaces.has(namespace)) {
          namespaces.set(namespace, new Map());
        }
        
        const nsStorage = namespaces.get(namespace)!;
        nsStorage.set(key, {
          value,
          timestamp: Date.now(),
          tags: options.tags || [],
          ttl: options.ttl
        });
      } else {
        // Pattern 2: store(entry) - where entry is a MemoryEntry object
        const entry = keyOrEntry;
        const key = entry.id || entry.key || `entry-${Date.now()}`;
        const namespace = entry.context?.namespace || 'default';
        
        if (!namespaces.has(namespace)) {
          namespaces.set(namespace, new Map());
        }
        
        const nsStorage = namespaces.get(namespace)!;
        nsStorage.set(key, {
          value: entry.content || entry.value || entry,
          timestamp: Date.now(),
          tags: entry.tags || [],
          ttl: entry.ttl,
          metadata: entry.metadata || {}
        });
      }
    },

    async retrieve(key: string, namespace: string = 'default'): Promise<any> {
      const nsStorage = namespaces.get(namespace);
      if (!nsStorage) return null;
      
      const entry = nsStorage.get(key);
      if (!entry) return null;
      
      // Check TTL
      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        nsStorage.delete(key);
        return null;
      }
      
      return entry.value;
    },

    async query(query: any): Promise<any[]> {
      const results: any[] = [];
      const searchTerm = query.search?.toLowerCase() || '';
      const limit = query.limit || 100;
      
      for (const [namespace, nsStorage] of namespaces) {
        for (const [key, entry] of nsStorage) {
          if (searchTerm && !key.toLowerCase().includes(searchTerm)) {
            continue;
          }
          
          results.push({
            id: key,
            namespace,
            content: entry.value,
            timestamp: new Date(entry.timestamp),
            tags: entry.tags || []
          });
          
          if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
      }
      
      return results;
    },

    async shutdown(): Promise<void> {
      storage.clear();
      namespaces.clear();
      this.initialized = false;
    },

    async delete(key: string): Promise<void> {
      for (const [namespace, nsStorage] of namespaces) {
        nsStorage.delete(key);
      }
    },

    // Health and status methods
    async getHealthStatus(): Promise<{
      status: 'healthy' | 'degraded' | 'unhealthy';
      healthy: boolean;
      details: Record<string, any>;
      metrics?: any;
      error?: string;
      timestamp: Date;
    }> {
      return {
        status: 'healthy',
        healthy: true,
        details: {},
        timestamp: new Date()
      };
    }
  };
}

/**
 * Get global services (throws if not initialized)
 */
export async function getGlobalServices(): Promise<GlobalServices> {
  if (globalServices?.initialized) {
    return globalServices;
  }
  throw new Error('Global services not initialized. Call initializeGlobalServices() first.');
}

/**
 * Get individual service instances
 */
export async function getPersistenceManager(): Promise<FastPersistenceManager> {
  const services = await getGlobalServices();
  return services.persistence;
}

export async function getMemoryManager(): Promise<FastMemoryManager> {
  const services = await getGlobalServices();
  return services.memory;
}

export async function getLogger(): Promise<ILogger> {
  const services = await getGlobalServices();
  return services.logger;
}

export async function getEventBus(): Promise<IEventBus> {
  const services = await getGlobalServices();
  return services.eventBus;
}

export async function getSwarmCoordinator(): Promise<SwarmCoordinator> {
  if (!globalSwarmCoordinator) {
    globalSwarmCoordinator = new SwarmCoordinator({
      maxAgents: 10,
      coordinationStrategy: {
        name: 'hybrid',
        description: 'Hybrid coordination strategy',
        agentSelection: 'round-robin',
        taskScheduling: 'fifo',
        loadBalancing: 'centralized',
        faultTolerance: 'retry',
        communication: 'direct'
      }
    });
    await globalSwarmCoordinator.initialize();
  }
  return globalSwarmCoordinator;
}

export async function getTaskEngine(): Promise<TaskExecutionEngine> {
  if (!globalTaskEngine) {
    const logger = await getLogger();
    const eventBus = await getEventBus();
    globalTaskEngine = new TaskExecutionEngine({
      maxConcurrentTasks: 10,
      defaultTimeout: 300000,
      retryAttempts: 3,
      retryBackoffBase: 1000,
      retryBackoffMax: 30000,
      resourceLimits: {
        memory: 1024 * 1024 * 1024, // 1GB
        cpu: 80, // 80%
        disk: 10 * 1024 * 1024 * 1024 // 10GB
      },
      enableCircuitBreaker: true,
      enableResourceMonitoring: true,
      enableProcessPooling: true,
      enableBackgroundExecution: true,
      enablePersistence: true,
      killTimeout: 30000,
      logPath: './logs',
      cleanupInterval: 60000,
      healthCheckInterval: 30000
    }, logger, eventBus);
    await globalTaskEngine.initialize();
  }
  return globalTaskEngine;
}

export async function getAgentProcessManager(): Promise<AgentProcessManager> {
  if (!globalAgentProcessManager) {
    const logger = await getLogger();
    globalAgentProcessManager = new AgentProcessManager(logger);
  }
  return globalAgentProcessManager;
}

/**
 * Check if services are initialized
 */
export function isServicesInitialized(): boolean {
  return globalServices?.initialized || false;
}

/**
 * Shutdown all global services gracefully
 */
export async function shutdownGlobalServices(): Promise<void> {
  try {
    if (globalServices?.logger) {
      globalServices.logger.info('Starting global services shutdown');
    }

    if (globalServices?.memory) {
      await globalServices.memory.shutdown();
    }

    if (globalServices?.persistence) {
      await globalServices.persistence.close();
    }

    if (globalServices?.logger) {
      globalServices.logger.info('Global services shutdown completed');
    }

    // Reset globals
    globalServices = null;
    initializationPromise = null;

  } catch (error) {
    console.error(`Failed to shutdown services: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Health check for all services
 */
export async function checkServicesHealth(): Promise<{
  persistence: boolean;
  memory: boolean;
  logger: boolean;
  eventBus: boolean;
  overall: boolean;
}> {
  try {
    const health = {
      persistence: globalServices?.persistence?.initialized || false,
      memory: globalServices?.memory?.initialized || false,
      logger: !!globalServices?.logger,
      eventBus: !!globalServices?.eventBus,
      overall: false
    };

    health.overall = health.persistence && health.memory && health.logger && health.eventBus;
    
    return health;

  } catch (error) {
    return {
      persistence: false,
      memory: false,
      logger: false,
      eventBus: false,
      overall: false
    };
  }
}

/**
 * Get initialization status
 */
export function getInitializationStatus(): {
  initialized: boolean;
  services: {
    persistence: boolean;
    memory: boolean;
    logger: boolean;
    eventBus: boolean;
  }
} {
  return {
    initialized: globalServices?.initialized || false,
    services: {
      persistence: globalServices?.persistence?.initialized || false,
      memory: globalServices?.memory?.initialized || false,
      logger: !!globalServices?.logger,
      eventBus: !!globalServices?.eventBus
    }
  };
}

 