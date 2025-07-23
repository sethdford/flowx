/**
 * Service Initializer - Initialize all backend services for CLI
 * Connects CLI commands to real persistence, config, and agent management
 */

import { PersistenceManager } from '../../core/persistence.js';
import { ConfigManager } from '../../core/config.js';
import { AgentManager } from '../../agents/agent-manager.js';
import { Logger } from '../../core/logger.js';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

export interface ServiceContainer {
  persistence: PersistenceManager;
  config: ConfigManager;
  agentManager: AgentManager;
  logger: Logger;
  eventBus: EventEmitter;
}

export class ServiceInitializer {
  private static instance: ServiceInitializer;
  private container: ServiceContainer | null = null;
  private initialized = false;

  static getInstance(): ServiceInitializer {
    if (!this.instance) {
      this.instance = new ServiceInitializer();
    }
    return this.instance;
  }

  async initialize(): Promise<ServiceContainer> {
    if (this.initialized && this.container) {
      return this.container;
    }

    // Create data directory
    const dataDir = join(process.cwd(), '.flowx');
    await mkdir(dataDir, { recursive: true });

    // Initialize logger
    const logger = new Logger(
      { level: 'info', format: 'text', destination: 'console' },
      { component: 'ServiceInitializer' }
    );

    // Initialize event bus
    const eventBus = new EventEmitter();

    // Initialize persistence manager
    const dbPath = join(dataDir, 'agents.db');
    const persistence = new PersistenceManager(dbPath);
    await persistence.initialize();
    logger.info('PersistenceManager initialized', { dbPath });

    // Initialize config manager
    const config = ConfigManager.getInstance();
    const configPath = join(dataDir, 'config.tson');
    
    try {
      await config.load(configPath);
      logger.info('Configuration loaded', { configPath });
    } catch (error) {
      // Create default config if none exists
      config.loadDefault();
      await config.save(configPath);
      logger.info('Default configuration created', { configPath });
    }

    // Initialize agent manager - For now, we'll create a minimal memory system
    // In a full implementation, this would be a proper DistributedMemorySystem
    const mockMemorySystem = {
      // Minimal interface to satisfy AgentManager requirements
      logger,
      eventBus,
      config: { backend: 'sqlite' as const },
      store: async () => {},
      retrieve: async () => null,
      query: async () => [],
      initialize: async () => {},
      shutdown: async () => {}
    } as any; // Type assertion to bypass strict typing for now

    const agentManagerConfig = {
      maxAgents: 50,
      defaultTimeout: 30000,
      heartbeatInterval: 30000,
      healthCheckInterval: 60000,
      autoRestart: true,
      resourceLimits: {
        memory: 512 * 1024 * 1024, // 512MB
        cpu: 2,
        disk: 1024 * 1024 * 1024 // 1GB
      },
      agentDefaults: {
        autonomyLevel: 0.8,
        learningEnabled: true,
        adaptationEnabled: true
      },
      environmentDefaults: {
        runtime: 'node' as const,
        workingDirectory: process.cwd(),
        tempDirectory: join(dataDir, 'temp'),
        logDirectory: join(dataDir, 'logs')
      }
    };

    const agentManager = new AgentManager(
      agentManagerConfig,
      logger,
      eventBus,
      mockMemorySystem
    );

    await agentManager.initialize();
    logger.info('AgentManager initialized');

    // Create service container
    this.container = {
      persistence,
      config,
      agentManager,
      logger,
      eventBus
    };

    this.initialized = true;
    logger.info('All services initialized successfully');

    return this.container;
  }

  getContainer(): ServiceContainer | null {
    return this.container;
  }

  async shutdown(): Promise<void> {
    if (!this.container) return;

    const { persistence, agentManager, logger } = this.container;

    try {
      // Shutdown agent manager
      await agentManager.shutdown();
      logger.info('AgentManager shutdown');

      // Shutdown persistence
      persistence.close();
      logger.info('PersistenceManager shutdown');

      logger.info('All services shutdown successfully');
    } catch (error) {
      logger.error('Error during service shutdown', error);
    } finally {
      this.container = null;
      this.initialized = false;
    }
  }
}

// Global service container for CLI commands
let globalContainer: ServiceContainer | null = null;

export async function initializeServices(): Promise<ServiceContainer> {
  if (!globalContainer) {
    const initializer = ServiceInitializer.getInstance();
    globalContainer = await initializer.initialize();
  }
  return globalContainer;
}

export function getServices(): ServiceContainer | null {
  return globalContainer;
}

export async function shutdownServices(): Promise<void> {
  if (globalContainer) {
    const initializer = ServiceInitializer.getInstance();
    await initializer.shutdown();
    globalContainer = null;
  }
} 