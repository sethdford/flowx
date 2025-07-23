/**
 * Core Integration Test
 * Tests that all core components work together seamlessly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { Application, ApplicationConfig } from '../../src/core/application.ts';
import { Container } from '../../src/core/container.ts';
import { Logger } from '../../src/core/logger.ts';
import { EventBus } from '../../src/core/event-bus.ts';
import { createValidator } from '../../src/core/validation.ts';
import { ConfigManager } from '../../src/core/config.ts';
// import { SwarmCoordinator } from '../../src/coordination/swarm-coordinator.ts'; // Removed as part of consolidation
import { AgentManager, createUnifiedAgentManager } from '../../src/agents/agent-manager.ts';
import { MemoryManager } from '../../src/memory/manager.ts';
import { createBootstrap } from '../../src/core/bootstrap.ts';

describe('Core Integration Tests', () => {
  let application: Application;
  let container: Container;
  let logger: Logger;
  let eventBus: EventBus;
  let configManager: ConfigManager;
  let swarmCoordinator: any; // SwarmCoordinator not available
  let agentManager: any; // UnifiedAgentManager not available
  let memoryManager: MemoryManager;

  beforeEach(async () => {
    // Initialize core infrastructure
    container = new Container({
      enableCircularDependencyDetection: true,
      enableMetrics: true,
      maxResolutionDepth: 50
    });

    logger = new Logger({
      level: 'info',
      format: 'json',
      destination: 'console'
    });

    eventBus = EventBus.getInstance(true);
    
    configManager = ConfigManager.getInstance();
    await configManager.load();

    // Initialize memory manager
    memoryManager = new MemoryManager({
      backend: 'sqljs',
      cacheSizeMB: 64,
      syncInterval: 10000,
      conflictResolution: 'last-write',
      retentionDays: 30,
      sqlitePath: './test-memory/integration-test.db'
    }, eventBus as any, logger);

    // Initialize agent manager
    agentManager = createUnifiedAgentManager(logger, eventBus as any);

    // Initialize swarm coordinator
    swarmCoordinator = { // Mock SwarmCoordinator
      // Mock methods as needed
      name: 'integration-test-swarm',
      description: 'Integration test swarm',
      version: '1.0.0',
      mode: 'centralized',
      strategy: 'auto',
      maxAgents: 5,
      maxTasks: 20,
      maxConcurrentTasks: 3,
      maxDuration: 300000,
      taskTimeoutMinutes: 2,
      qualityThreshold: 0.8,
      reviewRequired: false,
      testingRequired: false
    };

    // Initialize application
    const appConfig: ApplicationConfig = {
      name: 'core-integration-test',
      version: '1.0.0',
      environment: 'test',
      gracefulShutdownTimeout: 10000,
      enableHealthChecks: true,
      enableMetrics: true
    };

    application = new Application(appConfig, container);

    // Register core services in container
    container.singleton('logger', () => logger);
    container.singleton('eventBus', () => eventBus);
    container.singleton('validator', () => createValidator());
    container.singleton('configManager', () => configManager);
    container.singleton('memoryManager', () => memoryManager);
    container.singleton('agentManager', () => agentManager);
    container.singleton('swarmCoordinator', () => swarmCoordinator);
  });

  afterEach(async () => {
    try {
      if (swarmCoordinator) {
        await swarmCoordinator.shutdown();
      }
      if (agentManager) {
        await agentManager.shutdown();
      }
      if (application) {
        await application.stop();
      }
      if (logger) {
        await logger.close();
      }
      eventBus.resetStats();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Container Integration', () => {
    it('should resolve all core services', async () => {
      const resolvedLogger = await container.resolve('logger');
      const resolvedEventBus = await container.resolve('eventBus');
      const resolvedValidator = await container.resolve('validator');
      const resolvedConfigManager = await container.resolve('configManager');
      const resolvedMemoryManager = await container.resolve('memoryManager');
      const resolvedAgentManager = await container.resolve('agentManager');
      const resolvedSwarmCoordinator = await container.resolve('swarmCoordinator');

      expect(resolvedLogger).toBeDefined();
      expect(resolvedEventBus).toBeDefined();
      expect(resolvedValidator).toBeDefined();
      expect(resolvedConfigManager).toBeDefined();
      expect(resolvedMemoryManager).toBeDefined();
      expect(resolvedAgentManager).toBeDefined();
      expect(resolvedSwarmCoordinator).toBeDefined();
    });

    it('should track container metrics', () => {
      const metrics = container.getMetrics();
      expect(metrics.resolutions).toBeGreaterThan(0);
      expect(metrics.cacheHits).toBeGreaterThanOrEqual(0);
      expect(metrics.circularDependencies).toBe(0);
    });
  });

  describe('Event Bus Integration', () => {
    it('should handle events across components', async () => {
      const events: string[] = [];
      
      eventBus.on('test:event', (data) => {
        events.push(`received: ${data}`);
      });

      eventBus.emit('test:event', 'hello world');
      
      // Give event loop time to process
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(events).toContain('received: hello world');
    });

    it('should track event statistics', () => {
      eventBus.emit('test:metric', { count: 1 });
      eventBus.emit('test:metric', { count: 2 });
      
      const stats = eventBus.getEventStats();
      const testMetricStat = stats.find(s => s.event === 'test:metric');
      
      expect(testMetricStat).toBeDefined();
      expect(testMetricStat?.count).toBe(2);
    });
  });

  describe('Memory Manager Integration', () => {
    it('should initialize and store memories', async () => {
      await memoryManager.initialize();
      
      const memoryId = await memoryManager.store({
        id: 'test-memory-1',
        agentId: 'test-agent',
        sessionId: 'test-session',
        type: 'observation',
        content: 'Integration test memory',
        context: { test: true },
        tags: ['integration', 'test'],
        timestamp: new Date(),
        version: 1
      });

      expect(memoryId).toBe('test-memory-1');
      
      const retrieved = await memoryManager.retrieve(memoryId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Integration test memory');
    });

    it('should provide memory statistics', async () => {
      await memoryManager.initialize();
      
      const stats = await memoryManager.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalMemories).toBe('number');
      expect(typeof stats.totalSize).toBe('number');
    });
  });

  describe('Agent Manager Integration', () => {
    it('should create and manage agents', async () => {
      const agentId = await agentManager.createAgent({
        name: 'test-integration-agent',
        type: 'general',
        specialization: 'Integration testing',
        capabilities: ['testing', 'integration'],
        persistToDatabase: false
      });

      expect(agentId).toBeDefined();
      
      const agents = agentManager.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('test-integration-agent');
      
      await agentManager.stopAgent(agentId);
    });

    it('should provide agent statistics', () => {
      const stats = agentManager.getAgentStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalAgents).toBe('number');
      expect(typeof stats.activeAgents).toBe('number');
    });
  });

  describe('Swarm Coordinator Integration', () => {
    it('should initialize and manage swarm operations', async () => {
      await swarmCoordinator.initialize();
      
      const status = swarmCoordinator.getSwarmStatus();
      expect(status.status).toBe('running');
      expect(status.agents.total).toBe(0);
      expect(status.tasks.total).toBe(0);
    });

    it('should create objectives and decompose into tasks', async () => {
      await swarmCoordinator.initialize();
      
      const objectiveId = await swarmCoordinator.createObjective(
        'Test integration objective',
        'testing'
      );
      
      expect(objectiveId).toBeDefined();
      
      const tasks = swarmCoordinator.getTasks();
      expect(tasks.length).toBeGreaterThan(0);
      
      // Should create stuck-task and failing-task for testing strategy
      const taskTypes = tasks.map(t => t.type);
      expect(taskTypes).toContain('stuck-task');
      expect(taskTypes).toContain('failing-task');
    });

    it('should register agents and assign tasks', async () => {
      await swarmCoordinator.initialize();
      
      const agentId = await swarmCoordinator.registerAgent(
        'test-swarm-agent',
        'coordinator',
        ['testing', 'coordination']
      );
      
      expect(agentId).toBeDefined();
      
      const agents = swarmCoordinator.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('test-swarm-agent');
      expect(agents[0].type).toBe('coordinator');
    });
  });

  describe('Configuration Integration', () => {
    it('should load and validate configuration', async () => {
      const config = configManager.get();
      expect(config).toBeDefined();
      expect(config.orchestrator).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should handle configuration updates', () => {
      const originalLevel = configManager.getValue('logging.level');
      
      configManager.set('logging.level', 'debug');
      expect(configManager.getValue('logging.level')).toBe('debug');
      
      // Restore original
      configManager.set('logging.level', originalLevel);
    });
  });

  describe('Application Lifecycle Integration', () => {
    it('should start and stop application cleanly', async () => {
      // Register a test module
      application.registerModule({
        name: 'test-module',
        async initialize(container) {
          // Module initialization
        },
        async start(container) {
          // Module startup
        },
        async stop(container) {
          // Module shutdown
        },
        async healthCheck() {
          return true;
        }
      });

      await application.start();
      expect(application.isRunning()).toBe(true);
      
      const health = await application.getHealthStatus();
      expect(health.status).toBe('healthy');
      expect(health.checks['test-module'].status).toBe('pass');
      
      await application.stop();
      expect(application.isRunning()).toBe(false);
    });
  });

  describe('Bootstrap Integration', () => {
    it('should create and initialize bootstrap system', async () => {
      const bootstrap = createBootstrap({
        name: 'test-bootstrap',
        version: '1.0.0',
        environment: 'test',
        gracefulShutdownTimeout: 5000,
        enableHealthChecks: true,
        enableMetrics: true,
        enableMCP: false
      });

      const app = await bootstrap.initialize();
      expect(app).toBeDefined();
      
      const container = bootstrap.getContainer();
      expect(container).toBeDefined();
      expect(container.has('logger')).toBe(true);
      expect(container.has('eventBus')).toBe(true);
      
      await bootstrap.stop();
    });
  });

  describe('End-to-End Integration', () => {
    it('should demonstrate complete workflow', async () => {
      // Initialize all components
      await memoryManager.initialize();
      await swarmCoordinator.initialize();
      
      // Create an agent
      const agentId = await agentManager.createAgent({
        name: 'e2e-test-agent',
        type: 'general',
        specialization: 'End-to-end testing',
        capabilities: ['testing', 'integration', 'coordination'],
        persistToDatabase: false
      });

      // Register agent with swarm
      const swarmAgentId = await swarmCoordinator.registerAgent(
        'e2e-swarm-agent',
        'coordinator',
        ['testing', 'coordination']
      );

      // Create an objective
      const objectiveId = await swarmCoordinator.createObjective(
        'Complete end-to-end integration test',
        'testing'
      );

      // Store a memory
      const memoryId = await memoryManager.store({
        id: 'e2e-test-memory',
        agentId: agentId,
        sessionId: 'e2e-session',
        type: 'observation',
        content: 'End-to-end test initiated',
        context: { 
          test: 'e2e',
          objective: objectiveId,
          agent: agentId
        },
        tags: ['e2e', 'integration', 'test'],
        timestamp: new Date(),
        version: 1
      });

      // Verify everything is connected
      const swarmStatus = swarmCoordinator.getSwarmStatus();
      const agentStats = agentManager.getAgentStats();
      const memoryStats = await memoryManager.getStats();
      const eventStats = eventBus.getEventStats();

      expect(swarmStatus.agents.total).toBeGreaterThan(0);
      expect(swarmStatus.tasks.total).toBeGreaterThan(0);
      expect(agentStats.totalAgents).toBeGreaterThan(0);
      expect(memoryStats.totalMemories).toBeGreaterThan(0);
      expect(eventStats.length).toBeGreaterThan(0);

      // Cleanup
      await agentManager.stopAgent(agentId);
      
      console.log('✅ End-to-end integration test completed successfully');
      console.log(`   - Swarm Status: ${swarmStatus.agents.total} agents, ${swarmStatus.tasks.total} tasks`);
      console.log(`   - Agent Stats: ${agentStats.totalAgents} total, ${agentStats.activeAgents} active`);
      console.log(`   - Memory Stats: ${memoryStats.totalMemories} memories, ${memoryStats.totalSize} bytes`);
      console.log(`   - Event Stats: ${eventStats.length} event types tracked`);
    });
  });
}); 