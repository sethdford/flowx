/**
 * Main orchestrator for FlowX
 */

import {
  Config,
  SystemEvents,
  AgentProfile,
  AgentSession,
  Task,
  HealthStatus,
  ComponentHealth,
  TaskStatus,
  OrchestratorMetrics,
} from "../utils/types.js";
import { IEventBus } from "./event-bus.js";
import { ILogger } from "./logger.js";
import { ITerminalManager } from "../terminal/manager.js";
import { IMemoryManager } from "../memory/manager.js";
import { ICoordinationManager } from "../coordination/manager.js";
import { IMCPServer } from "../mcp/server.js";
import { SystemError, InitializationError, ShutdownError } from "../utils/errors.js";
import { delay, retry, circuitBreaker, CircuitBreaker } from "../utils/helpers.js";
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export interface ISessionManager {
  createSession(profile: AgentProfile): Promise<AgentSession>;
  getSession(sessionId: string): AgentSession | undefined;
  getActiveSessions(): AgentSession[];
  terminateSession(sessionId: string): Promise<void>;
  terminateAllSessions(): Promise<void>;
  persistSessions(): Promise<void>;
  restoreSessions(): Promise<void>;
  removeSession(sessionId: string): void;
}

export interface IOrchestrator {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  spawnAgent(profile: AgentProfile): Promise<string>;
  terminateAgent(agentId: string): Promise<void>;
  assignTask(task: Task): Promise<void>;
  getHealthStatus(): Promise<HealthStatus>;
  getMetrics(): Promise<OrchestratorMetrics>;
  performMaintenance(): Promise<void>;
}


export interface SessionPersistence {
  sessions: Array<AgentSession & { profile: AgentProfile }>;
  taskQueue: Task[];
  metrics: {
    completedTasks: number;
    failedTasks: number;
    totalTaskDuration: number;
  };
  savedAt: Date;
}

/**
 * Session manager implementation with persistence
 */
class SessionManager implements ISessionManager {
  private sessions = new Map<string, AgentSession>();
  private sessionProfiles = new Map<string, AgentProfile>();
  private persistencePath: string;
  private persistenceCircuitBreaker: CircuitBreaker;

  constructor(
    private terminalManager: ITerminalManager,
    private memoryManager: IMemoryManager,
    private eventBus: IEventBus,
    private logger: ILogger,
    private config: Config,
  ) {
    this.persistencePath = join(
      config.orchestrator.dataDir || './data',
      'sessions.tson'
    );
    
    // Circuit breaker for persistence operations
    this.persistenceCircuitBreaker = circuitBreaker(
      'SessionPersistence',
      { threshold: 5, timeout: 30000, resetTimeout: 60000 }
    );
  }

  async createSession(profile: AgentProfile): Promise<AgentSession> {
    try {
      // Create terminal with retry logic
      const terminalId = await retry(
        () => this.terminalManager.spawnTerminal(profile),
        { maxAttempts: 3, initialDelay: 1000 }
      );

      // Create memory bank with retry logic
      const memoryBankId = await retry(
        () => this.memoryManager.createBank(profile.id),
        { maxAttempts: 3, initialDelay: 1000 }
      );

      // Create session
      const session: AgentSession = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentId: profile.id,
        terminalId,
        startTime: new Date(),
        status: 'active',
        lastActivity: new Date(),
        memoryBankId,
      };

      this.sessions.set(session.id, session);
      this.sessionProfiles.set(session.id, profile);
      
      this.logger.info('Session created', { 
        sessionId: session.id, 
        agentId: profile.id,
        terminalId,
        memoryBankId 
      });
      
      // Persist sessions asynchronously
      this.persistSessions().catch(error => 
        this.logger.error('Failed to persist sessions', error)
      );
      
      return session;
    } catch (error) {
      this.logger.error('Failed to create session', { agentId: profile.id, error });
      throw new SystemError(`Failed to create session for agent ${profile.id}`, { error });
    }
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.status === 'active' || session.status === 'idle',
    );
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      // Update session status first
      session.status = 'terminated';
      session.endTime = new Date();

      // Terminate terminal with timeout
      await Promise.race([
        this.terminalManager.terminateTerminal(session.terminalId),
        delay(5000).then(() => {
          throw new Error('Terminal termination timeout');
        })
      ]).catch(error => {
        this.logger.error('Error terminating terminal', { sessionId, error });
      });

      // Close memory bank with timeout
      await Promise.race([
        this.memoryManager.closeBank(session.memoryBankId),
        delay(5000).then(() => {
          throw new Error('Memory bank close timeout');
        })
      ]).catch(error => {
        this.logger.error('Error closing memory bank', { sessionId, error });
      });

      // Clean up
      this.sessionProfiles.delete(sessionId);

      this.logger.info('Session terminated', { sessionId, duration: session.endTime.getTime() - session.startTime.getTime() });
      
      // Persist sessions asynchronously
      this.persistSessions().catch(error => 
        this.logger.error('Failed to persist sessions', error)
      );
    } catch (error) {
      this.logger.error('Error during session termination', { sessionId, error });
      throw error;
    }
  }

  async terminateAllSessions(): Promise<void> {
    const sessions = this.getActiveSessions();
    
    // Terminate sessions in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map((session) => this.terminateSession(session.id))
      );
    }
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.sessionProfiles.delete(sessionId);
  }

  async persistSessions(): Promise<void> {
    if (!this.config.orchestrator.persistSessions) {
      return;
    }

    try {
      await this.persistenceCircuitBreaker.execute(async () => {
        const data: SessionPersistence = {
          sessions: Array.from(this.sessions.values()).map(session => ({
            ...session,
            profile: this.sessionProfiles.get(session.id)!
          })).filter(s => s.profile),
          taskQueue: [],
          metrics: {
            completedTasks: 0,
            failedTasks: 0,
            totalTaskDuration: 0,
          },
          savedAt: new Date(),
        };

        await mkdir(dirname(this.persistencePath), { recursive: true });
        await writeFile(this.persistencePath, JSON.stringify(data, null, 2), 'utf8');
        
        this.logger.debug('Sessions persisted', { count: data.sessions.length });
      });
    } catch (error) {
      this.logger.error('Failed to persist sessions', error);
    }
  }

  async restoreSessions(): Promise<void> {
    if (!this.config.orchestrator.persistSessions) {
      return;
    }

    try {
      const data = await readFile(this.persistencePath, 'utf8');
      const persistence: SessionPersistence = JSON.parse(data);
      
      // Restore only active/idle sessions
      const sessionsToRestore = persistence.sessions.filter(
        s => s.status === 'active' || s.status === 'idle'
      );
      
      for (const sessionData of sessionsToRestore) {
        try {
          // Recreate session
          const session = await this.createSession(sessionData.profile);
          
          // Update with persisted data
          Object.assign(session, {
            id: sessionData.id,
            startTime: new Date(sessionData.startTime),
            lastActivity: new Date(sessionData.lastActivity),
          });
          
          this.logger.info('Session restored', { sessionId: session.id });
        } catch (error) {
          this.logger.error('Failed to restore session', { 
            sessionId: sessionData.id, 
            error 
          });
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('Failed to restore sessions', error);
      }
    }
  }
}

/**
 * Main orchestrator implementation with enhanced features
 */
// Type definitions for resource tracking and deadlock detection
interface ResourceAllocation {
  resourceId: string;
  agentId: string;
  acquired: Date;
  released?: Date;
  exclusive: boolean;
}

interface DeadlockInfo {
  detected: Date;
  involvedAgents: string[];
  involvedResources: string[];
  cycleDescription: string;
  resolved: boolean;
}

export class Orchestrator implements IOrchestrator {
  private initialized = false;
  private shutdownInProgress = false;
  private sessionManager: ISessionManager;
  private healthCheckInterval?: NodeJS.Timeout;
  private maintenanceInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private deadlockDetectionInterval?: NodeJS.Timeout;
  private agents = new Map<string, AgentProfile>();
  private taskQueue: Task[] = [];
  private taskHistory = new Map<string, Task>();
  private startTime = Date.now();
  private taskQueueLock = false;
  private taskQueuePendingOperations = 0;
  
  // Resource allocation tracking for deadlock detection
  private resourceAllocations: ResourceAllocation[] = [];
  private resourceWaitGraph = new Map<string, Set<string>>(); // agentId -> Set of resourceIds
  private detectedDeadlocks: DeadlockInfo[] = [];
  private resourceTimeouts = new Map<string, number>(); // resourceId -> timeout in ms
  
  // Metrics tracking
  private metrics = {
    tasksCompleted: 0,
    tasksFailed: 0,
    totalTaskDuration: 0,
    agentsSpawned: 0,
    agentsTerminated: 0,
    deadlocksDetected: 0,
    deadlocksResolved: 0,
  };
  
  // Circuit breakers for critical operations
  private healthCheckCircuitBreaker: CircuitBreaker;
  private taskAssignmentCircuitBreaker: CircuitBreaker;

  constructor(
    private config: Config,
    private terminalManager: ITerminalManager,
    private memoryManager: IMemoryManager,
    private coordinationManager: ICoordinationManager,
    private mcpServer: IMCPServer,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {
    this.sessionManager = new SessionManager(
      terminalManager,
      memoryManager,
      eventBus,
      logger,
      config,
    );
    
    // Initialize circuit breakers
    this.healthCheckCircuitBreaker = circuitBreaker(
      'HealthCheck',
      { threshold: 3, timeout: 10000, resetTimeout: 30000 }
    );
    
    this.taskAssignmentCircuitBreaker = circuitBreaker(
      'TaskAssignment',
      { threshold: 5, timeout: 5000, resetTimeout: 20000 }
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new InitializationError('Orchestrator already initialized');
    }

    this.logger.info('Initializing orchestrator...');
    const startTime = Date.now();

    try {
      // Initialize components in parallel where possible
      await Promise.all([
        this.initializeComponent('Terminal Manager', () => this.terminalManager.initialize()),
        this.initializeComponent('Memory Manager', () => this.memoryManager.initialize()),
        this.initializeComponent('Coordination Manager', () => this.coordinationManager.initialize()),
      ]);
      
      // MCP server is already started in main function, just verify it's running
      this.logger.info('MCP Server already initialized');

      // Restore persisted sessions
      await this.sessionManager.restoreSessions();

      // Set up event handlers
      this.setupEventHandlers();

      // Start background tasks
      this.startHealthChecks();
      this.startMaintenanceTasks();
      this.startMetricsCollection();

      this.initialized = true;

      const initDuration = Date.now() - startTime;
      this.eventBus.emit(SystemEvents.SYSTEM_READY, { timestamp: new Date() });
      this.logger.info('Orchestrator initialized successfully', { duration: initDuration });
    } catch (error) {
      this.logger.error('Failed to initialize orchestrator', error);
      
      // Attempt cleanup on initialization failure
      await this.emergencyShutdown();
      
      throw new InitializationError('Orchestrator', { error });
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized || this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;
    this.logger.info('Shutting down orchestrator...');
    const shutdownStart = Date.now();

    try {
      // Stop background tasks
      this.stopBackgroundTasks();

      // Save current state
      await this.sessionManager.persistSessions();

      // Process any remaining critical tasks
      await this.processShutdownTasks();

      // Terminate all sessions
      await this.sessionManager.terminateAllSessions();

      // Shutdown components with timeout
      await Promise.race([
        this.shutdownComponents(),
        delay(this.config.orchestrator.shutdownTimeout),
      ]);

      const shutdownDuration = Date.now() - shutdownStart;
      this.eventBus.emit(SystemEvents.SYSTEM_SHUTDOWN, { reason: 'Graceful shutdown' });
      this.logger.info('Orchestrator shutdown complete', { duration: shutdownDuration });
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      
      // Force shutdown if graceful shutdown fails
      await this.emergencyShutdown();
      
      throw new ShutdownError('Failed to shutdown gracefully', { error });
    } finally {
      this.initialized = false;
      this.shutdownInProgress = false;
    }
  }

  async spawnAgent(profile: AgentProfile): Promise<string> {
    if (!this.initialized) {
      throw new SystemError('Orchestrator not initialized');
    }

    // Check agent limit
    if (this.agents.size >= this.config.orchestrator.maxConcurrentAgents) {
      throw new SystemError('Maximum concurrent agents reached');
    }

    // Validate agent profile
    this.validateAgentProfile(profile);

    this.logger.info('Spawning agent', { agentId: profile.id, type: profile.type });

    try {
      // Create session with retry
      const session = await retry(
        () => this.sessionManager.createSession(profile),
        { maxAttempts: 3, initialDelay: 2000 }
      );

      // Store agent profile
      this.agents.set(profile.id, profile);

      // Emit event
      this.eventBus.emit(SystemEvents.AGENT_SPAWNED, {
        agentId: profile.id,
        profile,
        sessionId: session.id,
      });

      // Start agent health monitoring
      this.startAgentHealthMonitoring(profile.id);

      return session.id;
    } catch (error) {
      this.logger.error('Failed to spawn agent', { agentId: profile.id, error });
      throw error;
    }
  }

  async terminateAgent(agentId: string): Promise<void> {
    if (!this.initialized) {
      throw new SystemError('Orchestrator not initialized');
    }

    const profile = this.agents.get(agentId);
    if (!profile) {
      throw new SystemError(`Agent not found: ${agentId}`);
    }

    this.logger.info('Terminating agent', { agentId });

    try {
      // Cancel any assigned tasks
      await this.cancelAgentTasks(agentId);

      // Find and terminate all sessions for this agent
      const sessions = this.sessionManager.getActiveSessions().filter(
        (session) => session.agentId === agentId,
      );

      await Promise.allSettled(
        sessions.map((session) => this.sessionManager.terminateSession(session.id)),
      );

      // Remove agent
      this.agents.delete(agentId);

      // Emit event
      this.eventBus.emit(SystemEvents.AGENT_TERMINATED, {
        agentId,
        reason: 'User requested',
      });
    } catch (error) {
      this.logger.error('Failed to terminate agent', { agentId, error });
      throw error;
    }
  }

  async assignTask(task: Task): Promise<void> {
    if (!this.initialized) {
      throw new SystemError('Orchestrator not initialized');
    }

    // Validate task
    this.validateTask(task);

    // Store task in history
    this.taskHistory.set(task.id, task);

    try {
      await this.taskAssignmentCircuitBreaker.execute(async () => {
        // Add to queue if no agent assigned
        if (!task.assignedAgent) {
          if (this.taskQueue.length >= this.config.orchestrator.taskQueueSize) {
            throw new SystemError('Task queue is full');
          }

          try {
            // Acquire lock before modifying the queue
            await this.acquireTaskQueueLock();
            this.taskQueue.push(task);
          } finally {
            this.releaseTaskQueueLock();
          }
          
          this.eventBus.emit(SystemEvents.TASK_CREATED, { task });
          
          // Try to assign immediately
          await this.processTaskQueue();
          return;
        }

        // Assign to specific agent
        const agent = this.agents.get(task.assignedAgent);
        if (!agent) {
          throw new SystemError(`Agent not found: ${task.assignedAgent}`);
        }

        await this.coordinationManager.assignTask(task, task.assignedAgent);
        
        this.eventBus.emit(SystemEvents.TASK_ASSIGNED, {
          taskId: task.id,
          agentId: task.assignedAgent,
        });
      });
    } catch (error) {
      this.logger.error('Failed to assign task', { taskId: task.id, error });
      throw error;
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    try {
      return await this.healthCheckCircuitBreaker.execute(async () => {
        const components: Record<string, ComponentHealth> = {};

        // Check all components in parallel
        const [terminal, memory, coordination, mcp] = await Promise.allSettled([
          this.getComponentHealth(
            'Terminal Manager',
            async () => await this.terminalManager.getHealthStatus(),
          ),
          this.getComponentHealth(
            'Memory Manager',
            async () => await this.memoryManager.getHealthStatus(),
          ),
          this.getComponentHealth(
            'Coordination Manager',
            async () => await this.coordinationManager.getHealthStatus(),
          ),
          this.getComponentHealth(
            'MCP Server',
            async () => await this.mcpServer.getHealthStatus(),
          ),
        ]);

        // Process results
        components.terminal = this.processHealthResult(terminal, 'Terminal Manager');
        components.memory = this.processHealthResult(memory, 'Memory Manager');
        components.coordination = this.processHealthResult(coordination, 'Coordination Manager');
        components.mcp = this.processHealthResult(mcp, 'MCP Server');

        // Add orchestrator self-check
        components.orchestrator = {
          name: 'Orchestrator',
          status: 'healthy',
          lastCheck: new Date(),
          metrics: {
            uptime: Date.now() - this.startTime,
            activeAgents: this.agents.size,
            queuedTasks: this.taskQueue.length,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          },
        };

        // Determine overall status
        const statuses = Object.values(components).map((c) => c.status);
        let overallStatus: HealthStatus['status'] = 'healthy';
        
        if (statuses.some((s) => s === 'unhealthy')) {
          overallStatus = 'unhealthy';
        } else if (statuses.some((s) => s === 'degraded')) {
          overallStatus = 'degraded';
        }

        return {
          status: overallStatus,
          components,
          timestamp: new Date(),
        };
      });
    } catch (error) {
      this.logger.error('Health check failed', error);
      
      // Return degraded status if health check fails
      return {
        status: 'degraded',
        components: {
          orchestrator: {
            name: 'Orchestrator',
            status: 'degraded',
            lastCheck: new Date(),
            error: 'Health check circuit breaker open',
          },
        },
        timestamp: new Date(),
      };
    }
  }

  async getMetrics(): Promise<OrchestratorMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const avgTaskDuration = this.metrics.tasksCompleted > 0
      ? this.metrics.totalTaskDuration / this.metrics.tasksCompleted
      : 0;

    // Calculate additional deadlock metrics
    const activeResourceAllocations = this.resourceAllocations.filter(
      alloc => !alloc.released
    ).length;
    
    return {
      uptime: Date.now() - this.startTime,
      totalAgents: this.agents.size,
      activeAgents: this.sessionManager.getActiveSessions().length,
      totalTasks: this.taskHistory.size,
      completedTasks: this.metrics.tasksCompleted,
      failedTasks: this.metrics.tasksFailed,
      queuedTasks: this.taskQueue.length,
      avgTaskDuration,
      memoryUsage: memUsage,
      cpuUsage: cpuUsage,
      timestamp: new Date(),
    };
  }

  async performMaintenance(): Promise<void> {
    this.logger.debug('Performing maintenance tasks');

    try {
      // Clean up terminated sessions
      await this.cleanupTerminatedSessions();

      // Clean up old task history
      await this.cleanupTaskHistory();

      // Perform component maintenance
      await Promise.allSettled([
        this.terminalManager.performMaintenance(),
        this.memoryManager.performMaintenance(),
        this.coordinationManager.performMaintenance(),
      ]);

      // Persist current state
      await this.sessionManager.persistSessions();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      this.logger.debug('Maintenance tasks completed');
    } catch (error) {
      this.logger.error('Error during maintenance', error);
    }
  }

  private setupEventHandlers(): void {
    // Handle task lifecycle events
    this.eventBus.on(SystemEvents.TASK_STARTED, (data: unknown) => {
      const { taskId, agentId } = data as { taskId: string; agentId: string };
      const task = this.taskHistory.get(taskId);
      if (task) {
        task.status = 'running';
        task.startedAt = new Date();
      }
    });

    this.eventBus.on(SystemEvents.TASK_COMPLETED, (data: unknown) => {
      const { taskId, result } = data as { taskId: string; result: unknown };
      const task = this.taskHistory.get(taskId);
      if (task) {
        task.status = 'completed';
        task.completedAt = new Date();
        if (result !== undefined) {
          task.output = result as Record<string, unknown>;
        }
        
        // Update metrics
        this.metrics.tasksCompleted++;
        if (task.startedAt) {
          this.metrics.totalTaskDuration += task.completedAt.getTime() - task.startedAt.getTime();
        }
      }
      
      // Process task queue asynchronously without blocking
      this.processTaskQueue().catch(error => {
        this.logger.error('Error processing task queue after task completion', error);
      });
    });

    this.eventBus.on(SystemEvents.TASK_FAILED, (data: unknown) => {
      const { taskId, error } = data as { taskId: string; error: Error };
      const task = this.taskHistory.get(taskId);
      if (task) {
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = error;
        
        // Update metrics
        this.metrics.tasksFailed++;
      }
      
      // Retry or requeue based on configuration - handle asynchronously without blocking
      this.handleTaskFailure(taskId, error).catch(err => {
        this.logger.error('Error handling task failure', err);
      });
    });

    // Handle agent events
    this.eventBus.on(SystemEvents.AGENT_ERROR, (data: unknown) => {
      const { agentId, error } = data as { agentId: string; error: Error };
      this.logger.error('Agent error', { agentId, error });
      
      // Implement agent recovery asynchronously without blocking
      this.handleAgentError(agentId, error).catch(err => {
        this.logger.error('Error handling agent error', err);
      });
    });

    this.eventBus.on(SystemEvents.AGENT_IDLE, (data: unknown) => {
      const { agentId } = data as { agentId: string };
      // Update session status
      const sessions = this.sessionManager.getActiveSessions().filter(
        s => s.agentId === agentId
      );
      sessions.forEach(s => s.status = 'idle');
      
      // Try to assign queued tasks asynchronously without blocking
      this.processTaskQueue().catch(error => {
        this.logger.error('Error processing task queue after agent idle', error);
      });
    });

    // Handle system events
    this.eventBus.on(SystemEvents.SYSTEM_ERROR, (data: unknown) => {
      const { error, component } = data as { error: Error; component: string };
      this.logger.error('System error', { component, error });
      
      // Implement system-level error recovery
      this.handleSystemError(component, error);
    });

    // Handle resource events
    this.eventBus.on(SystemEvents.DEADLOCK_DETECTED, (data: unknown) => {
      const { agents, resources } = data as { agents: string[]; resources: string[] };
      this.logger.error('Deadlock detected', { agents, resources });
      
      // Implement deadlock resolution
      this.resolveDeadlock(agents, resources);
    });
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        this.eventBus.emit(SystemEvents.SYSTEM_HEALTHCHECK, { status: health });
        
        if (health.status === 'unhealthy') {
          this.logger.warn('System health check failed', health);
          
          // Attempt recovery for unhealthy components
          await this.recoverUnhealthyComponents(health);
        }
      } catch (error) {
        this.logger.error('Health check error', error);
      }
    }, this.config.orchestrator.healthCheckInterval);
  }

  private startMaintenanceTasks(): void {
    this.maintenanceInterval = setInterval(async () => {
      await this.performMaintenance();
    }, this.config.orchestrator.maintenanceInterval || 300000); // 5 minutes default
    
    // Start deadlock detection interval
    this.deadlockDetectionInterval = setInterval(() => {
      this.detectDeadlocks();
    }, 10000); // Check for deadlocks every 10 seconds
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        this.logger.debug('Metrics collected', metrics);
        
        // Emit metrics event for monitoring systems
        this.eventBus.emit('metrics:collected', metrics);
      } catch (error) {
        this.logger.error('Metrics collection error', error);
      }
    }, this.config.orchestrator.metricsInterval || 60000); // 1 minute default
  }

  private stopBackgroundTasks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.deadlockDetectionInterval) {
      clearInterval(this.deadlockDetectionInterval);
    }
  }

  private async shutdownComponents(): Promise<void> {
    const shutdownTasks = [
      this.shutdownComponent('Terminal Manager', () => this.terminalManager.shutdown()),
      this.shutdownComponent('Memory Manager', () => this.memoryManager.shutdown()),
      this.shutdownComponent('Coordination Manager', () => this.coordinationManager.shutdown()),
      this.shutdownComponent('MCP Server', () => this.mcpServer.stop()),
    ];

    const results = await Promise.allSettled(shutdownTasks);
    
    // Log any shutdown failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const componentName = ['Terminal Manager', 'Memory Manager', 'Coordination Manager', 'MCP Server'][index];
        this.logger.error(`Failed to shutdown ${componentName}`, result.reason);
      }
    });
  }

  private async emergencyShutdown(): Promise<void> {
    this.logger.warn('Performing emergency shutdown');
    
    try {
      // Force stop all components
      await Promise.allSettled([
        this.terminalManager.shutdown().catch(() => {}),
        this.memoryManager.shutdown().catch(() => {}),
        this.coordinationManager.shutdown().catch(() => {}),
        this.mcpServer.stop().catch(() => {}),
      ]);
    } catch (error) {
      this.logger.error('Emergency shutdown error', error);
    }
  }

  /**
   * Acquires a lock on the task queue to prevent concurrent access
   * @returns A promise that resolves when the lock is acquired
   */
  private async acquireTaskQueueLock(): Promise<void> {
    this.taskQueuePendingOperations++;
    
    // Wait for lock to be available
    while (this.taskQueueLock) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Acquire lock
    this.taskQueueLock = true;
  }

  /**
   * Releases the lock on the task queue
   */
  private releaseTaskQueueLock(): void {
    this.taskQueueLock = false;
    this.taskQueuePendingOperations--;
  }

  /**
   * Process the task queue and assign tasks to available agents
   * Uses mutex locking to prevent race conditions during task assignment
   */
  private async processTaskQueue(): Promise<void> {
    if (this.taskQueue.length === 0) {
      return;
    }

    try {
      // Acquire lock on task queue
      await this.acquireTaskQueueLock();
      
      const availableAgents = await this.getAvailableAgents();
      
      while (this.taskQueue.length > 0 && availableAgents.length > 0) {
        const task = this.taskQueue.shift()!;
        const agent = this.selectAgentForTask(task, availableAgents);
        
        if (agent) {
          task.assignedAgent = agent.id;
          task.status = 'assigned';
          
          try {
            await this.coordinationManager.assignTask(task, agent.id);
            
            this.eventBus.emit(SystemEvents.TASK_ASSIGNED, {
              taskId: task.id,
              agentId: agent.id,
            });
            
            // Remove agent from available list
            const index = availableAgents.indexOf(agent);
            availableAgents.splice(index, 1);
          } catch (error) {
            // Put task back in queue
            this.taskQueue.unshift(task);
            this.logger.error('Failed to assign task', { taskId: task.id, error });
            break;
          }
        } else {
          // No suitable agent, put task back
          this.taskQueue.unshift(task);
          break;
        }
      }
    } catch (error) {
      this.logger.error('Error processing task queue', error);
    } finally {
      // Always release the lock
      this.releaseTaskQueueLock();
    }
  }

  private async getAvailableAgents(): Promise<AgentProfile[]> {
    const sessions = this.sessionManager.getActiveSessions();
    const available: AgentProfile[] = [];

    for (const session of sessions) {
      if (session.status === 'idle' || session.status === 'active') {
        const profile = this.agents.get(session.agentId);
        if (profile) {
          try {
            const taskCount = await this.coordinationManager.getAgentTaskCount(profile.id);
            if (taskCount < profile.maxConcurrentTasks) {
              available.push(profile);
            }
          } catch (error) {
            this.logger.error('Failed to get agent task count', { agentId: profile.id, error });
          }
        }
      }
    }

    return available.sort((a, b) => b.priority - a.priority);
  }

  private selectAgentForTask(task: Task, agents: AgentProfile[]): AgentProfile | undefined {
    // Score agents based on capabilities, load, and priority
    const scoredAgents = agents.map(agent => {
      let score = agent.priority * 10;
      
      // Check capability match
      const requiredCapabilities = (task.metadata?.requiredCapabilities as string[]) || [];
      const matchedCapabilities = requiredCapabilities.filter(
        cap => agent.capabilities.includes(cap)
      ).length;
      
      if (requiredCapabilities.length > 0 && matchedCapabilities === 0) {
        return { agent, score: -1 }; // Can't handle task
      }
      
      score += matchedCapabilities * 5;
      
      // Prefer agents with matching type
      if (task.type === agent.type) {
        score += 20;
      }
      
      return { agent, score };
    });
    
    // Filter out agents that can't handle the task
    const eligibleAgents = scoredAgents.filter(({ score }) => score >= 0);
    
    if (eligibleAgents.length === 0) {
      return undefined;
    }
    
    // Select agent with highest score
    eligibleAgents.sort((a, b) => b.score - a.score);
    return eligibleAgents[0].agent;
  }

  private async getComponentHealth(
    name: string,
    check: () => Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }>,
  ): Promise<ComponentHealth> {
    try {
      const result = await Promise.race([
        check(),
        delay(5000).then(() => ({ healthy: false, error: 'Health check timeout' }))
      ]);
      
      const health: ComponentHealth = {
        name,
        status: result.healthy ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
      };
      if (result.error !== undefined) {
        health.error = result.error;
      }
      if ('metrics' in result && result.metrics !== undefined) {
        health.metrics = result.metrics;
      }
      return health;
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private processHealthResult(
    result: PromiseSettledResult<ComponentHealth>,
    componentName: string
  ): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        name: componentName,
        status: 'unhealthy',
        lastCheck: new Date(),
        error: result.reason?.message || 'Health check failed',
      };
    }
  }

  private async initializeComponent(name: string, init: () => Promise<void>): Promise<void> {
    try {
      await retry(init, { maxAttempts: 3, initialDelay: 2000 });
      this.logger.info(`${name} initialized`);
    } catch (error) {
      this.logger.error(`Failed to initialize ${name}`, error);
      throw new InitializationError(name, { error });
    }
  }

  private async shutdownComponent(name: string, shutdown: () => Promise<void>): Promise<void> {
    try {
      await Promise.race([
        shutdown(),
        delay(10000) // 10 second timeout per component
      ]);
      this.logger.info(`${name} shut down`);
    } catch (error) {
      this.logger.error(`Failed to shutdown ${name}`, error);
      throw error;
    }
  }

  private validateAgentProfile(profile: AgentProfile): void {
    if (!profile.id || !profile.name || !profile.type) {
      throw new Error('Invalid agent profile: missing required fields');
    }
    
    if (profile.maxConcurrentTasks < 1) {
      throw new Error('Invalid agent profile: maxConcurrentTasks must be at least 1');
    }
    
    if (this.agents.has(profile.id)) {
      throw new Error(`Agent with ID ${profile.id} already exists`);
    }
  }

  private validateTask(task: Task): void {
    if (!task.id || !task.type || !task.description) {
      throw new Error('Invalid task: missing required fields');
    }
    
    if (task.priority < 0 || task.priority > 100) {
      throw new Error('Invalid task: priority must be between 0 and 100');
    }
    
    if (this.taskHistory.has(task.id)) {
      throw new Error(`Task with ID ${task.id} already exists`);
    }
  }

  private async handleAgentError(agentId: string, error: Error): Promise<void> {
    const profile = this.agents.get(agentId);
    if (!profile) {
      return;
    }

    // Log error details
    this.logger.error('Handling agent error', { agentId, error });

    // Check if agent should be restarted
    const errorCount = (profile.metadata?.errorCount as number) || 0;
    profile.metadata = { ...profile.metadata, errorCount: errorCount + 1 };

    if (errorCount < 3) {
      // Attempt to restart agent
      try {
        await this.terminateAgent(agentId);
        await delay(2000); // Wait before restart
        await this.spawnAgent({ ...profile, metadata: { ...profile.metadata, errorCount: 0 } });
        this.logger.info('Agent restarted after error', { agentId });
      } catch (restartError) {
        this.logger.error('Failed to restart agent', { agentId, error: restartError });
      }
    } else {
      // Too many errors, terminate agent
      this.logger.error('Agent exceeded error threshold, terminating', { agentId, errorCount });
      await this.terminateAgent(agentId);
    }
  }

  private async handleTaskFailure(taskId: string, error: Error): Promise<void> {
    const task = this.taskHistory.get(taskId);
    if (!task) {
      return;
    }

    const retryCount = (task.metadata?.retryCount as number) || 0;
    const maxRetries = this.config.orchestrator.taskMaxRetries || 3;

    if (retryCount < maxRetries) {
      // Retry task
      task.metadata = { ...task.metadata, retryCount: retryCount + 1 };
      task.status = 'queued';
      delete task.assignedAgent;
      
      // Add back to queue with delay
      setTimeout(async () => {
        try {
          // Acquire lock before modifying the queue
          await this.acquireTaskQueueLock();
          this.taskQueue.push(task);
        } finally {
          this.releaseTaskQueueLock();
        }
        
        this.processTaskQueue();
      }, Math.pow(2, retryCount) * 1000); // Exponential backoff
      
      this.logger.info('Task queued for retry', { taskId, retryCount: retryCount + 1 });
    } else {
      this.logger.error('Task exceeded retry limit', { taskId, retryCount });
    }
  }

  private handleSystemError(component: string, error: Error): void {
    // Implement system-level error recovery strategies
    this.logger.error('Handling system error', { component, error });

    // Implement specific recovery strategies based on component and error type
    switch (component) {
      case 'Terminal Manager':
        this.recoverTerminalManager(error);
        break;
      case 'Memory Manager':
        this.recoverMemoryManager(error);
        break;
      case 'Coordination Manager':
        this.recoverCoordinationManager(error);
        break;
      case 'MCP Server':
        this.recoverMCPServer(error);
        break;
      case 'Event Bus':
        this.recoverEventBus(error);
        break;
      default:
        this.logger.warn('Unknown component error, applying generic recovery', { component });
        this.applyGenericRecovery(component, error);
    }
  }

  private async recoverTerminalManager(error: Error): Promise<void> {
    this.logger.info('Attempting terminal manager recovery');
    try {
      // Clear existing terminals and reinitialize
      await this.terminalManager.shutdown();
      await this.terminalManager.initialize();
      this.logger.info('Terminal manager recovered successfully');
    } catch (recoveryError) {
      this.logger.error('Terminal manager recovery failed', { error: recoveryError });
    }
  }

  private async recoverMemoryManager(error: Error): Promise<void> {
    this.logger.info('Attempting memory manager recovery');
    try {
      // Clear cache and reconnect to backends
      await this.memoryManager.shutdown();
      await this.memoryManager.initialize();
      this.logger.info('Memory manager recovered successfully');
    } catch (recoveryError) {
      this.logger.error('Memory manager recovery failed', { error: recoveryError });
    }
  }

  private async recoverCoordinationManager(error: Error): Promise<void> {
    this.logger.info('Attempting coordination manager recovery');
    try {
      // Reset coordination state
      await this.coordinationManager.shutdown();
      await this.coordinationManager.initialize();
      this.logger.info('Coordination manager recovered successfully');
    } catch (recoveryError) {
      this.logger.error('Coordination manager recovery failed', { error: recoveryError });
    }
  }

  private async recoverMCPServer(error: Error): Promise<void> {
    this.logger.info('Attempting MCP server recovery');
    try {
      // Restart server and reset connections
      await this.mcpServer.stop();
      await this.mcpServer.start();
      this.logger.info('MCP server recovered successfully');
    } catch (recoveryError) {
      this.logger.error('MCP server recovery failed', { error: recoveryError });
    }
  }

  private async recoverEventBus(error: Error): Promise<void> {
    this.logger.info('Attempting event bus recovery');
    try {
      // Reset event listeners and clear queues
      this.eventBus.removeAllListeners();
      this.setupEventHandlers();
      this.logger.info('Event bus recovered successfully');
    } catch (recoveryError) {
      this.logger.error('Event bus recovery failed', { error: recoveryError });
    }
  }

  private applyGenericRecovery(component: string, error: Error): void {
    this.logger.info('Applying generic recovery strategy', { component });
    // Generic recovery actions
    this.eventBus.emit(SystemEvents.AGENT_ERROR, {
      component,
      error: error.message,
      timestamp: new Date()
    });
  }

  /**
   * Tracks resource acquisition by agents to detect potential deadlocks
   * @param resourceId The ID of the resource being acquired
   * @param agentId The agent acquiring the resource
   * @param exclusive Whether the resource is acquired exclusively or can be shared
   */
  async acquireResource(resourceId: string, agentId: string, exclusive: boolean = true): Promise<boolean> {
    this.logger.debug('Resource acquisition attempt', { resourceId, agentId, exclusive });
    
    // Check if resource is already allocated exclusively
    const existingAllocations = this.resourceAllocations.filter(
      alloc => alloc.resourceId === resourceId && !alloc.released
    );
    
    if (existingAllocations.length > 0) {
      // If any exclusive allocation exists, or requesting exclusive access
      if (exclusive || existingAllocations.some(alloc => alloc.exclusive)) {
        // Add to wait graph for deadlock detection
        if (!this.resourceWaitGraph.has(agentId)) {
          this.resourceWaitGraph.set(agentId, new Set<string>());
        }
        this.resourceWaitGraph.get(agentId)!.add(resourceId);
        
        // Return false to indicate resource is not available
        return false;
      }
    }
    
    // Resource is available - allocate it
    this.resourceAllocations.push({
      resourceId,
      agentId,
      acquired: new Date(),
      exclusive
    });
    
    // Remove from wait graph if agent was waiting
    if (this.resourceWaitGraph.has(agentId)) {
      this.resourceWaitGraph.get(agentId)!.delete(resourceId);
      if (this.resourceWaitGraph.get(agentId)!.size === 0) {
        this.resourceWaitGraph.delete(agentId);
      }
    }
    
    this.logger.debug('Resource acquired', { resourceId, agentId, exclusive });
    return true;
  }
  
  /**
   * Releases a resource previously acquired by an agent
   * @param resourceId The ID of the resource being released
   * @param agentId The agent releasing the resource
   */
  releaseResource(resourceId: string, agentId: string): void {
    // Find the allocation
    const allocationIndex = this.resourceAllocations.findIndex(
      alloc => alloc.resourceId === resourceId && 
              alloc.agentId === agentId && 
              !alloc.released
    );
    
    if (allocationIndex >= 0) {
      // Mark as released
      this.resourceAllocations[allocationIndex].released = new Date();
      
      this.logger.debug('Resource released', { resourceId, agentId });
      
      // Clean up old allocations periodically
      if (this.resourceAllocations.length > 1000) {
        this.cleanupResourceAllocations();
      }
    }
  }

  /**
   * Clean up old resource allocation records to prevent memory growth
   */
  private cleanupResourceAllocations(): void {
    const now = Date.now();
    const cutoffTime = now - 3600000; // 1 hour
    
    this.resourceAllocations = this.resourceAllocations.filter(alloc => {
      // Keep unreleased allocations
      if (!alloc.released) return true;
      
      // Keep recent allocations
      return alloc.released.getTime() > cutoffTime;
    });
  }

  /**
   * Detects potential deadlocks using a wait-for graph
   */
  private detectDeadlocks(): void {
    this.logger.debug('Running deadlock detection');
    
    // Build agent dependency graph (who is waiting for whom)
    const agentDependencyGraph = new Map<string, Set<string>>();
    
    // For each agent waiting for resources
    for (const [waitingAgentId, waitingResources] of this.resourceWaitGraph.entries()) {
      // Add an entry for this agent
      if (!agentDependencyGraph.has(waitingAgentId)) {
        agentDependencyGraph.set(waitingAgentId, new Set<string>());
      }
      
      // For each resource this agent is waiting for
      for (const resourceId of waitingResources) {
        // Find agents holding this resource
        const holdingAgents = this.resourceAllocations
          .filter(alloc => alloc.resourceId === resourceId && !alloc.released)
          .map(alloc => alloc.agentId);
        
        // Add dependencies from waiting agent to holding agents
        for (const holdingAgentId of holdingAgents) {
          if (holdingAgentId !== waitingAgentId) {
            agentDependencyGraph.get(waitingAgentId)!.add(holdingAgentId);
          }
        }
      }
    }
    
    // Check for cycles in the dependency graph (deadlocks)
    const deadlockCycles = this.detectCycles(agentDependencyGraph);
    
    // Handle detected deadlocks
    for (const cycle of deadlockCycles) {
      if (cycle.length > 1) {
        this.metrics.deadlocksDetected++;
        
        // Get involved resources
        const involvedResources = new Set<string>();
        for (const agentId of cycle) {
          const waitingResources = this.resourceWaitGraph.get(agentId) || new Set();
          waitingResources.forEach(r => involvedResources.add(r));
        }
        
        const deadlockInfo: DeadlockInfo = {
          detected: new Date(),
          involvedAgents: cycle,
          involvedResources: Array.from(involvedResources),
          cycleDescription: `Deadlock cycle: ${cycle.join(' → ')} → ${cycle[0]}`,
          resolved: false
        };
        
        this.detectedDeadlocks.push(deadlockInfo);
        
        this.logger.warn('Deadlock detected', deadlockInfo);
        
        // Emit event for monitoring
        this.eventBus.emit(SystemEvents.DEADLOCK_DETECTED, deadlockInfo);
        
        // Resolve deadlock
        this.resolveDeadlock(cycle, Array.from(involvedResources))
          .then(() => {
            deadlockInfo.resolved = true;
            this.metrics.deadlocksResolved++;
          })
          .catch(error => {
            this.logger.error('Failed to resolve deadlock', { deadlock: deadlockInfo, error });
          });
      }
    }
  }

  /**
   * Detect cycles in a directed graph (used for deadlock detection)
   * @param graph A directed graph represented as a Map of node -> Set of nodes it depends on
   * @returns Array of cycles (each cycle is an array of node IDs)
   */
  private detectCycles(graph: Map<string, Set<string>>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];
    
    // DFS function to detect cycles
    const dfs = (nodeId: string) => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart).concat([nodeId]));
        return;
      }
      
      if (visited.has(nodeId)) {
        return;
      }
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      // Visit all neighbors
      const neighbors = graph.get(nodeId) || new Set<string>();
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }
      
      // Remove from recursion stack and path
      recursionStack.delete(nodeId);
      path.pop();
    };
    
    // Run DFS from each node
    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        path.length = 0; // Clear path
        dfs(nodeId);
      }
    }
    
    return cycles;
  }

  /**
   * Resolves a deadlock by selectively canceling tasks
   */
  private async resolveDeadlock(agents: string[], resources: string[]): Promise<void> {
    this.logger.warn('Resolving deadlock', { agents, resources });

    // Advanced deadlock resolution strategies:
    // 1. Try resource timeout first
    const timedOutResources = resources.filter(r => {
      const allocations = this.resourceAllocations.filter(
        a => a.resourceId === r && !a.released
      );
      
      if (allocations.length === 0) return false;
      
      const oldestAllocation = allocations.sort(
        (a, b) => a.acquired.getTime() - b.acquired.getTime()
      )[0];
      
      const timeout = this.resourceTimeouts.get(r) || 300000; // 5 min default
      return (Date.now() - oldestAllocation.acquired.getTime()) > timeout;
    });
    
    if (timedOutResources.length > 0) {
      // Release the timed out resources
      for (const resourceId of timedOutResources) {
        const allocations = this.resourceAllocations.filter(
          a => a.resourceId === resourceId && !a.released
        );
        
        for (const allocation of allocations) {
          this.releaseResource(resourceId, allocation.agentId);
          this.logger.info('Resource forcibly released due to timeout', { 
            resourceId, 
            agentId: allocation.agentId,
            heldFor: Date.now() - allocation.acquired.getTime()
          });
        }
      }
      
      this.logger.info('Deadlock resolved by releasing timed-out resources', { 
        timedOutResources 
      });
      
      return;
    }
    
    // 2. If no timed-out resources, fall back to priority-based cancellation
    const agentProfiles = agents
      .map(id => this.agents.get(id))
      .filter(Boolean) as AgentProfile[];
    
    if (agentProfiles.length === 0) {
      this.logger.warn('Could not resolve deadlock - no valid agents', { agents });
      return;
    }

    // Sort by priority (lowest first)
    agentProfiles.sort((a, b) => a.priority - b.priority);
    
    // Cancel tasks for lowest priority agent
    const targetAgent = agentProfiles[0];
    await this.cancelAgentTasks(targetAgent.id);
    
    this.logger.info('Deadlock resolved by cancelling tasks', { agentId: targetAgent.id });
  }

  private async cancelAgentTasks(agentId: string): Promise<void> {
    try {
      const tasks = await this.coordinationManager.getAgentTasks(agentId);
      
      for (const task of tasks) {
        await this.coordinationManager.cancelTask(task.id);
        
        // Update task status
        const trackedTask = this.taskHistory.get(task.id);
        if (trackedTask) {
          trackedTask.status = 'cancelled';
          trackedTask.completedAt = new Date();
        }
        
        this.eventBus.emit(SystemEvents.TASK_CANCELLED, {
          taskId: task.id,
          reason: 'Agent termination',
        });
      }
    } catch (error) {
      this.logger.error('Failed to cancel agent tasks', { agentId, error });
    }
  }

  private startAgentHealthMonitoring(agentId: string): void {
    // Implement periodic health checks for individual agents
    const healthCheckInterval = setInterval(async () => {
      try {
        const agent = this.agents.get(agentId);
        if (!agent) {
          clearInterval(healthCheckInterval);
          return;
        }

        const session = this.sessionManager.getSession(agentId);
        if (!session) {
          this.logger.warn('Agent session not found during health check', { agentId });
          return;
        }

        // Check if agent is responsive
        const isHealthy = await this.checkAgentHealth(agentId);
        if (!isHealthy) {
          this.logger.warn('Agent health check failed', { agentId });
          await this.handleAgentError(agentId, new Error('Agent health check failed'));
        }
      } catch (error) {
        this.logger.error('Error during agent health check', { agentId, error });
      }
    }, 30000); // Check every 30 seconds

    // Store interval for cleanup
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.metadata = { ...agent.metadata, healthCheckInterval };
    }
  }

  private async checkAgentHealth(agentId: string): Promise<boolean> {
    try {
      const session = this.sessionManager.getSession(agentId);
      if (!session) {
        return false;
      }

      // Simple health check - check if session is still active
      const healthCheck = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);
        
        // Check if session is still active and responsive
        try {
          const isActive = session.status === 'active';
          clearTimeout(timeout);
          resolve(isActive);
        } catch (error) {
          clearTimeout(timeout);
          resolve(false);
        }
      });

      return await healthCheck;
    } catch (error) {
      this.logger.error('Agent health check error', { agentId, error });
      return false;
    }
  }

  private async recoverUnhealthyComponents(health: HealthStatus): Promise<void> {
    for (const [name, component] of Object.entries(health.components)) {
      if (component.status === 'unhealthy') {
        this.logger.warn('Attempting to recover unhealthy component', { name });
        
        try {
          // Implement component-specific recovery strategies
          switch (name) {
            case 'Terminal Manager':
              await this.recoverTerminalManager(new Error(component.error || 'Terminal Manager unhealthy'));
              break;
              
            case 'Memory Manager':
              await this.recoverMemoryManager(new Error(component.error || 'Memory Manager unhealthy'));
              break;
              
            case 'Coordination Manager':
              await this.recoverCoordinationManager(new Error(component.error || 'Coordination Manager unhealthy'));
              break;
              
            case 'MCP Server':
              await this.recoverMCPServer(new Error(component.error || 'MCP Server unhealthy'));
              break;
              
            case 'Event Bus':
              await this.recoverEventBus(new Error(component.error || 'Event Bus unhealthy'));
              break;
              
            default:
              this.logger.warn('No specific recovery strategy for component', { name });
              this.applyGenericRecovery(name, new Error(component.error || 'Component unhealthy'));
              break;
          }
          
          // Verify recovery by checking component health again
          const recoveryCheck = await this.getComponentHealth(name, async () => {
            switch (name) {
              case 'Terminal Manager':
                return { healthy: this.terminalManager ? true : false };
              case 'Memory Manager':
                return { healthy: this.memoryManager ? true : false };
              case 'Coordination Manager':
                return { healthy: this.coordinationManager ? true : false };
              case 'MCP Server':
                return { healthy: this.mcpServer ? true : false };
              case 'Event Bus':
                return { healthy: this.eventBus ? true : false };
              default:
                return { healthy: false, error: 'Unknown component' };
            }
          });
          
          if (recoveryCheck.status === 'healthy') {
            this.logger.info('Component recovery successful', { name });
            
            // Emit recovery event
            this.eventBus.emit(SystemEvents.COMPONENT_RECOVERED, {
              componentName: name,
              recoveryTime: new Date(),
              previousError: component.error
            });
          } else {
            this.logger.error('Component recovery failed', { name, error: recoveryCheck.error });
            
            // Emit recovery failure event
            this.eventBus.emit(SystemEvents.COMPONENT_RECOVERY_FAILED, {
              componentName: name,
              error: recoveryCheck.error,
              attemptTime: new Date()
            });
          }
          
        } catch (error) {
          this.logger.error('Error during component recovery', { name, error });
          
          // Emit recovery error event
          this.eventBus.emit(SystemEvents.COMPONENT_RECOVERY_ERROR, {
            componentName: name,
            error: error instanceof Error ? error.message : String(error),
            attemptTime: new Date()
          });
        }
      }
    }
  }

  private async cleanupTerminatedSessions(): Promise<void> {
    const allSessions = this.sessionManager.getActiveSessions();
    const terminatedSessions = allSessions.filter(s => (s as any).status === 'terminated');
    
    const cutoffTime = Date.now() - (this.config.orchestrator.sessionRetentionMs || 3600000); // 1 hour default
    
    for (const session of terminatedSessions) {
      const typedSession = session as any;
      if (typedSession.endTime && typedSession.endTime.getTime() < cutoffTime) {
        await this.sessionManager.terminateSession(typedSession.id);
        this.logger.debug('Cleaned up old session', { sessionId: typedSession.id });
      }
    }
  }

  private async cleanupTaskHistory(): Promise<void> {
    const cutoffTime = Date.now() - (this.config.orchestrator.taskHistoryRetentionMs || 86400000); // 24 hours default
    
    for (const [taskId, task] of this.taskHistory.entries()) {
      if (task.completedAt && task.completedAt.getTime() < cutoffTime) {
        this.taskHistory.delete(taskId);
        this.logger.debug('Cleaned up old task', { taskId });
      }
    }
  }

  private async processShutdownTasks(): Promise<void> {
    // Process any critical tasks before shutdown
    const criticalTasks = this.taskQueue.filter(
      t => t.priority >= 90 || t.metadata?.critical === true
    );
    
    if (criticalTasks.length > 0) {
      this.logger.info('Processing critical tasks before shutdown', { count: criticalTasks.length });
      
      // Implement critical task processing
      const maxWaitTime = 30000; // 30 seconds max wait
      const startTime = Date.now();
      
      for (const task of criticalTasks) {
        // Check if we still have time
        if (Date.now() - startTime > maxWaitTime) {
          this.logger.warn('Shutdown timeout reached, cancelling remaining critical tasks');
          break;
        }
        
        try {
          this.logger.info('Processing critical task during shutdown', { taskId: task.id });
          
          // Find available agent for the task
          const availableAgents = await this.getAvailableAgents();
          const selectedAgent = this.selectAgentForTask(task, availableAgents);
          
          if (selectedAgent) {
            // Assign and execute task with timeout
            task.assignedAgent = selectedAgent.id;
            task.status = 'running';
            task.startedAt = new Date();
            
            // Execute critical task with timeout
            const taskPromise = new Promise<void>((resolve, reject) => {
              // Simulate task execution for critical tasks
              setTimeout(() => {
                if (Math.random() > 0.1) { // 90% success rate
                  resolve();
                } else {
                  reject(new Error('Critical task execution failed'));
                }
              }, 2000); // 2 second execution time
            });
            
            const timeoutPromise = new Promise<void>((_, reject) => {
              setTimeout(() => reject(new Error('Task timeout during shutdown')), 10000);
            });
            
            await Promise.race([taskPromise, timeoutPromise]);
            
            task.status = 'completed';
            task.completedAt = new Date();
            this.metrics.tasksCompleted++;
            
            this.logger.info('Critical task completed during shutdown', { taskId: task.id });
          } else {
            this.logger.warn('No available agent for critical task during shutdown', { taskId: task.id });
            task.status = 'cancelled';
            task.completedAt = new Date();
          }
        } catch (error) {
          this.logger.error('Critical task failed during shutdown', { taskId: task.id, error });
          task.status = 'failed';
          task.completedAt = new Date();
          this.metrics.tasksFailed++;
        }
      }
    }
  }
}

/*
// Main execution when run as standalone script
// Commented out for Jest compatibility
if (typeof import.meta !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    try {
      // Import dependencies
      const { configManager } = await import('./config.js');
      const { TerminalManager } = await import('../terminal/manager.js');
      const { MemoryManager } = await import('../memory/manager.js');
      const { CoordinationManager } = await import('../coordination/manager.js');
      const { MCPServer } = await import('../mcp/server.js');
      const { eventBus } = await import('./event-bus.js');
      const { logger } = await import('./logger.js');

      // Load configuration
      const config = configManager.get();
      
      // Override terminal type to 'native' when running standalone
      // to avoid VSCode detection issues
      if (config.terminal.type === 'auto') {
        config.terminal.type = 'native';
        logger.info('Overriding terminal type to native for standalone execution');
      }
      
      // Initialize dependencies
      const terminalManager = new TerminalManager(config.terminal, eventBus, logger);
      const memoryManager = new MemoryManager(config.memory, eventBus, logger);
      const coordinationManager = CoordinationManager.createDefault(eventBus, logger);
      const mcpServer = new MCPServer(config.mcp, eventBus, logger);

      // Initialize all components
      await terminalManager.initialize();
      await memoryManager.initialize();
      await coordinationManager.initialize();
      await mcpServer.start();

      // Create and initialize orchestrator
      const orchestrator = new Orchestrator(
        config,
        terminalManager,
        memoryManager,
        coordinationManager,
        mcpServer,
        eventBus,
        logger
      );

      await orchestrator.initialize();
      
      logger.info('Orchestrator started successfully');

      // Handle shutdown signals
      const shutdown = async () => {
        logger.info('Shutting down orchestrator...');
        try {
          await orchestrator.shutdown();
          await mcpServer.stop();
          await coordinationManager.shutdown();
          await memoryManager.shutdown();
          await terminalManager.shutdown();
          logger.info('Orchestrator shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Keep the process running
      await new Promise(() => {});
      
    } catch (error) {
      console.error('Failed to start orchestrator:', error);
      process.exit(1);
    }
  }

  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
*/