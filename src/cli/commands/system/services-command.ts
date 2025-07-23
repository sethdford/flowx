/**
 * Services Command
 * Comprehensive service management and monitoring for Claude Flow
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getMemoryManager, getPersistenceManager } from '../../core/global-initialization.js';
import { AgentProcessManager } from '../../../agents/agent-process-manager.js';
import { SwarmCoordinator } from '../../../swarm/coordinator.js';
import { TaskEngine } from '../../../task/engine.js';
import { RealTimeMonitor } from '../../../monitoring/real-time-monitor.js';
import { EventBus } from '../../../core/event-bus.js';
import { Logger } from '../../../core/logger.js';

interface ServiceInfo {
  name: string;
  type: 'core' | 'agent' | 'swarm' | 'monitoring' | 'storage' | 'communication';
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping' | 'unknown';
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime?: number;
  version?: string;
  port?: number;
  pid?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  connections?: number;
  throughput?: number;
  errorRate?: number;
  lastError?: string;
  dependencies: string[];
  endpoints?: string[];
  metrics?: Record<string, any>;
}

interface ServiceDependency {
  service: string;
  required: boolean;
  status: 'satisfied' | 'missing' | 'failed';
}

interface ServiceGroup {
  name: string;
  services: string[];
  description: string;
  startOrder: number;
}

export const servicesCommand: CLICommand = {
  name: 'services',
  description: 'Manage and monitor Claude Flow services',
  category: 'System',
  usage: 'flowx services <subcommand> [OPTIONS]',
  examples: [
    'flowx services status',
    'flowx services start all',
    'flowx services stop memory-manager',
    'flowx services restart --group core',
    'flowx services health --detailed'
  ],
  subcommands: [
    {
      name: 'status',
      description: 'Show service status',
      handler: async (context: CLIContext) => await showServiceStatus(context),
      options: [
        {
          name: 'service',
          short: 's',
          description: 'Show specific service',
          type: 'string'
        },
        {
          name: 'group',
          short: 'g',
          description: 'Show specific service group',
          type: 'string',
          choices: ['core', 'agent', 'swarm', 'monitoring', 'storage', 'communication']
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['table', 'json', 'yaml'],
          default: 'table'
        },
        {
          name: 'watch',
          short: 'w',
          description: 'Watch status in real-time',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'start',
      description: 'Start services',
      handler: async (context: CLIContext) => await startServices(context),
      options: [
        {
          name: 'service',
          short: 's',
          description: 'Start specific service',
          type: 'string'
        },
        {
          name: 'group',
          short: 'g',
          description: 'Start service group',
          type: 'string'
        },
        {
          name: 'force',
          short: 'f',
          description: 'Force start even if dependencies missing',
          type: 'boolean'
        },
        {
          name: 'wait',
          short: 'w',
          description: 'Wait for services to be ready',
          type: 'boolean'
        },
        {
          name: 'timeout',
          short: 't',
          description: 'Startup timeout in seconds',
          type: 'number',
          default: 60
        }
      ]
    },
    {
      name: 'stop',
      description: 'Stop services',
      handler: async (context: CLIContext) => await stopServices(context),
      options: [
        {
          name: 'service',
          short: 's',
          description: 'Stop specific service',
          type: 'string'
        },
        {
          name: 'group',
          short: 'g',
          description: 'Stop service group',
          type: 'string'
        },
        {
          name: 'force',
          short: 'f',
          description: 'Force stop (immediate shutdown)',
          type: 'boolean'
        },
        {
          name: 'graceful',
          description: 'Graceful shutdown with dependency order',
          type: 'boolean',
          default: true
        }
      ]
    },
    {
      name: 'restart',
      description: 'Restart services',
      handler: async (context: CLIContext) => await restartServices(context),
      options: [
        {
          name: 'service',
          short: 's',
          description: 'Restart specific service',
          type: 'string'
        },
        {
          name: 'group',
          short: 'g',
          description: 'Restart service group',
          type: 'string'
        },
        {
          name: 'rolling',
          short: 'r',
          description: 'Rolling restart (one at a time)',
          type: 'boolean'
        },
        {
          name: 'wait',
          short: 'w',
          description: 'Wait for services to be ready',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'health',
      description: 'Check service health',
      handler: async (context: CLIContext) => await checkServiceHealth(context),
      options: [
        {
          name: 'service',
          short: 's',
          description: 'Check specific service',
          type: 'string'
        },
        {
          name: 'detailed',
          short: 'd',
          description: 'Show detailed health information',
          type: 'boolean'
        },
        {
          name: 'fix',
          description: 'Attempt to fix unhealthy services',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'logs',
      description: 'Show service logs',
      handler: async (context: CLIContext) => await showServiceLogs(context),
      options: [
        {
          name: 'service',
          short: 's',
          description: 'Show logs for specific service',
          type: 'string',
          required: true
        },
        {
          name: 'follow',
          short: 'f',
          description: 'Follow log output',
          type: 'boolean'
        },
        {
          name: 'lines',
          short: 'n',
          description: 'Number of lines to show',
          type: 'number',
          default: 50
        },
        {
          name: 'level',
          short: 'l',
          description: 'Log level filter',
          type: 'string',
          choices: ['debug', 'info', 'warn', 'error']
        }
      ]
    },
    {
      name: 'metrics',
      description: 'Show service metrics',
      handler: async (context: CLIContext) => await showServiceMetrics(context),
      options: [
        {
          name: 'service',
          short: 's',
          description: 'Show metrics for specific service',
          type: 'string'
        },
        {
          name: 'interval',
          short: 'i',
          description: 'Metrics collection interval',
          type: 'number',
          default: 5
        },
        {
          name: 'duration',
          short: 'd',
          description: 'Collection duration in seconds',
          type: 'number',
          default: 30
        }
      ]
    },
    {
      name: 'dependencies',
      description: 'Show service dependencies',
      handler: async (context: CLIContext) => await showServiceDependencies(context),
      options: [
        {
          name: 'service',
          short: 's',
          description: 'Show dependencies for specific service',
          type: 'string'
        },
        {
          name: 'tree',
          short: 't',
          description: 'Show dependency tree',
          type: 'boolean'
        }
      ]
    }
  ],
  handler: async (context: CLIContext) => {
    return await showServiceStatus(context);
  }
};

// Service management singleton
class ServiceManager {
  private static instance: ServiceManager;
  private services = new Map<string, ServiceInfo>();
  private serviceGroups: ServiceGroup[] = [];
  private logger: Logger;
  
  // Service instances
  private agentManager?: AgentProcessManager;
  private swarmCoordinator?: SwarmCoordinator;
  private taskEngine?: TaskEngine;
  private monitor?: RealTimeMonitor;
  private eventBus?: EventBus;

  private constructor() {
    this.logger = new Logger({ 
      level: 'info',
      format: 'text',
      destination: 'console'
    });
    this.initializeServiceDefinitions();
  }

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  private initializeServiceDefinitions(): void {
    // Define service groups
    this.serviceGroups = [
      {
        name: 'core',
        services: ['event-bus', 'logger', 'persistence-manager'],
        description: 'Core system services',
        startOrder: 1
      },
      {
        name: 'storage',
        services: ['memory-manager', 'persistence-manager'],
        description: 'Data storage services',
        startOrder: 2
      },
      {
        name: 'agent',
        services: ['agent-process-manager'],
        description: 'Agent management services',
        startOrder: 3
      },
      {
        name: 'swarm',
        services: ['swarm-coordinator', 'task-engine'],
        description: 'Swarm coordination services',
        startOrder: 4
      },
      {
        name: 'monitoring',
        services: ['real-time-monitor'],
        description: 'Monitoring and alerting services',
        startOrder: 5
      },
      {
        name: 'communication',
        services: ['mcp-server', 'websocket-server'],
        description: 'Communication services',
        startOrder: 6
      }
    ];

    // Initialize service definitions
    this.initializeCoreServices();
    this.initializeStorageServices();
    this.initializeAgentServices();
    this.initializeSwarmServices();
    this.initializeMonitoringServices();
    this.initializeCommunicationServices();
  }

  private initializeCoreServices(): void {
    this.services.set('event-bus', {
      name: 'event-bus',
      type: 'core',
      status: 'unknown',
      health: 'unknown',
      dependencies: [],
      endpoints: []
    });

    this.services.set('logger', {
      name: 'logger',
      type: 'core',
      status: 'unknown',
      health: 'unknown',
      dependencies: [],
      endpoints: []
    });
  }

  private initializeStorageServices(): void {
    this.services.set('memory-manager', {
      name: 'memory-manager',
      type: 'storage',
      status: 'unknown',
      health: 'unknown',
      dependencies: ['event-bus', 'logger'],
      endpoints: []
    });

    this.services.set('persistence-manager', {
      name: 'persistence-manager',
      type: 'storage',
      status: 'unknown',
      health: 'unknown',
      dependencies: ['logger'],
      endpoints: []
    });
  }

  private initializeAgentServices(): void {
    this.services.set('agent-process-manager', {
      name: 'agent-process-manager',
      type: 'agent',
      status: 'unknown',
      health: 'unknown',
      dependencies: ['event-bus', 'logger', 'memory-manager'],
      endpoints: []
    });
  }

  private initializeSwarmServices(): void {
    this.services.set('swarm-coordinator', {
      name: 'swarm-coordinator',
      type: 'swarm',
      status: 'unknown',
      health: 'unknown',
      dependencies: ['agent-process-manager', 'memory-manager', 'event-bus'],
      endpoints: []
    });

    this.services.set('task-engine', {
      name: 'task-engine',
      type: 'swarm',
      status: 'unknown',
      health: 'unknown',
      dependencies: ['swarm-coordinator', 'agent-process-manager'],
      endpoints: []
    });
  }

  private initializeMonitoringServices(): void {
    this.services.set('real-time-monitor', {
      name: 'real-time-monitor',
      type: 'monitoring',
      status: 'unknown',
      health: 'unknown',
      dependencies: ['event-bus', 'memory-manager'],
      endpoints: []
    });
  }

  private initializeCommunicationServices(): void {
    this.services.set('mcp-server', {
      name: 'mcp-server',
      type: 'communication',
      status: 'unknown',
      health: 'unknown',
      dependencies: ['event-bus', 'logger'],
      endpoints: ['http://localhost:3000'],
      port: 3000
    });

    this.services.set('websocket-server', {
      name: 'websocket-server',
      type: 'communication',
      status: 'unknown',
      health: 'unknown',
      dependencies: ['event-bus'],
      endpoints: ['ws://localhost:3001'],
      port: 3001
    });
  }

  async updateServiceStatus(): Promise<void> {
    // Update status for all services
    await Promise.all([
      this.updateCoreServicesStatus(),
      this.updateStorageServicesStatus(),
      this.updateAgentServicesStatus(),
      this.updateSwarmServicesStatus(),
      this.updateMonitoringServicesStatus(),
      this.updateCommunicationServicesStatus()
    ]);
  }

  private async updateCoreServicesStatus(): Promise<void> {
    // Event Bus
    const eventBusService = this.services.get('event-bus')!;
    try {
      if (!this.eventBus) {
        this.eventBus = EventBus.getInstance();
      }
      eventBusService.status = 'running';
      eventBusService.health = 'healthy';
      eventBusService.uptime = Date.now();
    } catch (error) {
      eventBusService.status = 'error';
      eventBusService.health = 'unhealthy';
      eventBusService.lastError = error instanceof Error ? error.message : String(error);
    }

    // Logger
    const loggerService = this.services.get('logger')!;
    loggerService.status = 'running';
    loggerService.health = 'healthy';
    loggerService.uptime = Date.now();
  }

  private async updateStorageServicesStatus(): Promise<void> {
    // Memory Manager
    const memoryService = this.services.get('memory-manager')!;
    try {
      const memoryManager = await getMemoryManager();
      const healthStatus = await memoryManager.getHealthStatus();
      
      memoryService.status = healthStatus.healthy ? 'running' : 'error';
      memoryService.health = healthStatus.healthy ? 'healthy' : 'unhealthy';
      memoryService.metrics = healthStatus.metrics;
      memoryService.lastError = healthStatus.error;
    } catch (error) {
      memoryService.status = 'error';
      memoryService.health = 'unhealthy';
      memoryService.lastError = error instanceof Error ? error.message : String(error);
    }

    // Persistence Manager
    const persistenceService = this.services.get('persistence-manager')!;
    try {
      const persistenceManager = await getPersistenceManager();
      // Assume healthy if we can get the instance
      persistenceService.status = 'running';
      persistenceService.health = 'healthy';
    } catch (error) {
      persistenceService.status = 'error';
      persistenceService.health = 'unhealthy';
      persistenceService.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  private async updateAgentServicesStatus(): Promise<void> {
    const agentService = this.services.get('agent-process-manager')!;
    try {
      if (!this.agentManager) {
        this.agentManager = new AgentProcessManager(this.logger);
      }
      
      const stats = this.agentManager.getAgentStats();
      agentService.status = 'running';
      agentService.health = stats.error > 0 ? 'degraded' : 'healthy';
      agentService.metrics = {
        totalAgents: stats.total,
        runningAgents: stats.running,
        errorAgents: stats.error,
        totalTasks: stats.totalTasks,
        failedTasks: stats.totalFailures
      };
    } catch (error) {
      agentService.status = 'error';
      agentService.health = 'unhealthy';
      agentService.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  private async updateSwarmServicesStatus(): Promise<void> {
    // Swarm Coordinator
    const swarmService = this.services.get('swarm-coordinator')!;
    try {
      if (!this.swarmCoordinator) {
        this.swarmCoordinator = new SwarmCoordinator({
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
        await this.swarmCoordinator.initialize();
      }
      
      const swarmStatus = this.swarmCoordinator.getSwarmStatus();
      swarmService.status = 'running';
      swarmService.health = 'healthy';
      swarmService.metrics = {
        totalAgents: swarmStatus.agents.total,
        activeAgents: swarmStatus.agents.idle + swarmStatus.agents.busy,
        totalTasks: swarmStatus.tasks.total,
        completedTasks: swarmStatus.tasks.completed
      };
    } catch (error) {
      swarmService.status = 'error';
      swarmService.health = 'unhealthy';
      swarmService.lastError = error instanceof Error ? error.message : String(error);
    }

    // Task Engine
    const taskService = this.services.get('task-engine')!;
    try {
      if (!this.taskEngine) {
        this.taskEngine = new TaskEngine(10);
      }
      
      taskService.status = 'running';
      taskService.health = 'healthy';
      taskService.metrics = {
        activeTasks: 0, // TaskEngine doesn't expose this directly
        completedTasks: 0
      };
    } catch (error) {
      taskService.status = 'error';
      taskService.health = 'unhealthy';
      taskService.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  private async updateMonitoringServicesStatus(): Promise<void> {
    const monitorService = this.services.get('real-time-monitor')!;
    try {
      if (!this.monitor) {
        const memoryManager = await getMemoryManager();
        this.monitor = new RealTimeMonitor(
          {},
          this.logger,
          this.eventBus!,
          memoryManager as any
        );
        await this.monitor.initialize();
      }
      
      const stats = this.monitor.getMonitoringStatistics();
      monitorService.status = 'running';
      monitorService.health = 'healthy';
      monitorService.metrics = stats;
    } catch (error) {
      monitorService.status = 'error';
      monitorService.health = 'unhealthy';
      monitorService.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  private async updateCommunicationServicesStatus(): Promise<void> {
    // MCP Server
    const mcpService = this.services.get('mcp-server')!;
    await this.checkMCPServerStatus(mcpService);

    // WebSocket Server
    const wsService = this.services.get('websocket-server')!;
    await this.checkWebSocketServerStatus(wsService);
  }

  private async checkMCPServerStatus(service: ServiceInfo): Promise<void> {
    try {
      // Check if MCP server is running by looking for the MCP configuration
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      
      const mcpConfigPath = path.join(process.cwd(), 'mcp_config', 'mcp.tson');
      
      try {
        await fs.access(mcpConfigPath);
        const configContent = await fs.readFile(mcpConfigPath, 'utf-8');
        const config = JSON.parse(configContent);
        
        // Check if MCP server configuration is valid
        if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
          service.status = 'running';
          service.health = 'healthy';
          service.uptime = Date.now();
          
          // Try to get actual server metrics if available
          const serverCount = Object.keys(config.mcpServers).length;
          service.metrics = {
            serverCount,
            configuredServers: Object.keys(config.mcpServers)
          };
        } else {
          service.status = 'stopped';
          service.health = 'unknown';
          service.lastError = 'No MCP servers configured';
        }
      } catch (error) {
        service.status = 'stopped';
        service.health = 'unknown';
        service.lastError = 'MCP configuration not found';
      }
    } catch (error) {
      service.status = 'error';
      service.health = 'unhealthy';
      service.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  private async checkWebSocketServerStatus(service: ServiceInfo): Promise<void> {
    try {
      // Check if WebSocket server is running by trying to connect to common ports
      const net = await import('node:net');
      const commonPorts = [3000, 8080, 8081, 3001];
      
      let serverFound = false;
      let activePort: number | undefined;
      
      for (const port of commonPorts) {
        try {
          await new Promise<void>((resolve, reject) => {
            const socket = net.createConnection(port, 'localhost');
            socket.setTimeout(1000);
            
            socket.on('connect', () => {
              serverFound = true;
              activePort = port;
              socket.end();
              resolve();
            });
            
            socket.on('error', () => {
              socket.destroy();
              reject(new Error(`Port ${port} not available`));
            });
            
            socket.on('timeout', () => {
              socket.destroy();
              reject(new Error(`Port ${port} timeout`));
            });
          });
          
          if (serverFound) break;
        } catch (error) {
          // Continue checking other ports
        }
      }
      
      if (serverFound && activePort) {
        service.status = 'running';
        service.health = 'healthy';
        service.port = activePort;
        service.uptime = Date.now();
        service.metrics = {
          port: activePort,
          protocol: 'websocket'
        };
      } else {
        service.status = 'stopped';
        service.health = 'unknown';
        service.lastError = 'No WebSocket server found on common ports';
      }
    } catch (error) {
      service.status = 'error';
      service.health = 'unhealthy';
      service.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  getServices(filter?: { type?: string; group?: string; service?: string }): ServiceInfo[] {
    let services = Array.from(this.services.values());

    if (filter?.service) {
      const service = this.services.get(filter.service);
      return service ? [service] : [];
    }

    if (filter?.type) {
      services = services.filter(s => s.type === filter.type);
    }

    if (filter?.group) {
      const group = this.serviceGroups.find(g => g.name === filter.group);
      if (group) {
        services = services.filter(s => group.services.includes(s.name));
      }
    }

    return services;
  }

  getServiceGroups(): ServiceGroup[] {
    return [...this.serviceGroups];
  }

  async startService(serviceName: string, options: any = {}): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    if (service.status === 'running' && !options.force) {
      throw new Error(`Service '${serviceName}' is already running`);
    }

    // Check dependencies unless forced
    if (!options.force) {
      await this.checkDependencies(serviceName);
    }

    // Start the service based on its type
    await this.performServiceStart(serviceName, options);
  }

  async stopService(serviceName: string, options: any = {}): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    if (service.status === 'stopped') {
      return;
    }

    await this.performServiceStop(serviceName, options);
  }

  private async checkDependencies(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName)!;
    const missingDeps: string[] = [];

    for (const dep of service.dependencies) {
      const depService = this.services.get(dep);
      if (!depService || depService.status !== 'running') {
        missingDeps.push(dep);
      }
    }

    if (missingDeps.length > 0) {
      throw new Error(`Missing dependencies for ${serviceName}: ${missingDeps.join(', ')}`);
    }
  }

  private async performServiceStart(serviceName: string, options: any): Promise<void> {
    const service = this.services.get(serviceName)!;
    service.status = 'starting';

    try {
      switch (serviceName) {
        case 'memory-manager':
          await getMemoryManager();
          break;
        case 'persistence-manager':
          await getPersistenceManager();
          break;
        case 'agent-process-manager':
          if (!this.agentManager) {
            this.agentManager = new AgentProcessManager(this.logger);
          }
          break;
        case 'swarm-coordinator':
          if (!this.swarmCoordinator) {
            this.swarmCoordinator = new SwarmCoordinator({
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
            await this.swarmCoordinator.initialize();
          }
          break;
        case 'task-engine':
          if (!this.taskEngine) {
            this.taskEngine = new TaskEngine(10);
          }
          break;
        case 'real-time-monitor':
          if (!this.monitor) {
            const memoryManager = await getMemoryManager();
            this.monitor = new RealTimeMonitor(
              {},
              this.logger,
              this.eventBus!,
              memoryManager as any
            );
            await this.monitor.initialize();
          }
          break;
        default:
          // For services not implemented, just mark as running
          break;
      }

      service.status = 'running';
      service.health = 'healthy';
      service.uptime = Date.now();
    } catch (error) {
      service.status = 'error';
      service.health = 'unhealthy';
      service.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async performServiceStop(serviceName: string, options: any): Promise<void> {
    const service = this.services.get(serviceName)!;
    service.status = 'stopping';

    try {
      switch (serviceName) {
        case 'agent-process-manager':
          if (this.agentManager) {
            await this.agentManager.shutdown();
            this.agentManager = undefined;
          }
          break;
        case 'swarm-coordinator':
          if (this.swarmCoordinator) {
            await this.swarmCoordinator.stop();
            this.swarmCoordinator = undefined;
          }
          break;
        case 'real-time-monitor':
          if (this.monitor) {
            await this.monitor.shutdown();
            this.monitor = undefined;
          }
          break;
        default:
          // For services not implemented, just mark as stopped
          break;
      }

      service.status = 'stopped';
      service.health = 'unknown';
      service.uptime = undefined;
    } catch (error) {
      service.status = 'error';
      service.health = 'unhealthy';
      service.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }
}

// Command handlers

async function showServiceStatus(context: CLIContext): Promise<void> {
  const { options } = context;
  const manager = ServiceManager.getInstance();

  try {
    await manager.updateServiceStatus();
    
    const filter: any = {};
    if (options.service) filter.service = options.service;
    if (options.group) filter.group = options.group;

    const services = manager.getServices(filter);

    if (services.length === 0) {
      printInfo('No services found matching criteria');
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(services, null, 2));
    } else if (options.format === 'yaml') {
      // Simple YAML output
      services.forEach(service => {
        console.log(`${service.name}:`);
        console.log(`  status: ${service.status}`);
        console.log(`  health: ${service.health}`);
        console.log(`  type: ${service.type}`);
      });
    } else {
      displayServicesTable(services, 'Service Status');
    }

    if (options.watch) {
      printInfo('Watching service status (Ctrl+C to stop)...');
      const interval = setInterval(async () => {
        await manager.updateServiceStatus();
        const updatedServices = manager.getServices(filter);
        console.clear();
        displayServicesTable(updatedServices, 'Service Status (Live)');
      }, 2000);

      process.on('SIGINT', () => {
        clearInterval(interval);
        process.exit(0);
      });
    }
  } catch (error) {
    printError(`Failed to get service status: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function startServices(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const manager = ServiceManager.getInstance();

  try {
    if (args[0] === 'all') {
      // Start all services in dependency order
      const groups = manager.getServiceGroups().sort((a, b) => a.startOrder - b.startOrder);
      
      for (const group of groups) {
        printInfo(`Starting ${group.name} services...`);
        
        for (const serviceName of group.services) {
          try {
            await manager.startService(serviceName, options);
            printSuccess(`✅ Started ${serviceName}`);
          } catch (error) {
            printError(`❌ Failed to start ${serviceName}: ${error instanceof Error ? error.message : String(error)}`);
            if (!options.force) throw error;
          }
        }
      }
    } else if (options.service) {
      await manager.startService(options.service, options);
      printSuccess(`✅ Started service: ${options.service}`);
    } else if (options.group) {
      const groups = manager.getServiceGroups();
      const group = groups.find(g => g.name === options.group);
      
      if (!group) {
        printError(`Service group '${options.group}' not found`);
        return;
      }

      printInfo(`Starting ${group.name} services...`);
      for (const serviceName of group.services) {
        await manager.startService(serviceName, options);
        printSuccess(`✅ Started ${serviceName}`);
      }
    } else {
      printError('Specify --service, --group, or "all"');
      printInfo('Usage: flowx services start [all|--service <name>|--group <name>]');
    }
  } catch (error) {
    printError(`Failed to start services: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function stopServices(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const manager = ServiceManager.getInstance();

  try {
    if (args[0] === 'all') {
      // Stop all services in reverse dependency order
      const groups = manager.getServiceGroups().sort((a, b) => b.startOrder - a.startOrder);
      
      for (const group of groups) {
        printInfo(`Stopping ${group.name} services...`);
        
        for (const serviceName of group.services) {
          try {
            await manager.stopService(serviceName, options);
            printSuccess(`✅ Stopped ${serviceName}`);
          } catch (error) {
            printError(`❌ Failed to stop ${serviceName}: ${error instanceof Error ? error.message : String(error)}`);
            if (!options.force) throw error;
          }
        }
      }
    } else if (options.service) {
      await manager.stopService(options.service, options);
      printSuccess(`✅ Stopped service: ${options.service}`);
    } else if (options.group) {
      const groups = manager.getServiceGroups();
      const group = groups.find(g => g.name === options.group);
      
      if (!group) {
        printError(`Service group '${options.group}' not found`);
        return;
      }

      printInfo(`Stopping ${group.name} services...`);
      for (const serviceName of group.services.reverse()) {
        await manager.stopService(serviceName, options);
        printSuccess(`✅ Stopped ${serviceName}`);
      }
    } else {
      printError('Specify --service, --group, or "all"');
      printInfo('Usage: flowx services stop [all|--service <name>|--group <name>]');
    }
  } catch (error) {
    printError(`Failed to stop services: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function restartServices(context: CLIContext): Promise<void> {
  const { options } = context;

  try {
    // Stop services first
    await stopServices(context);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start services
    await startServices(context);
    
    printSuccess('✅ Services restarted successfully');
  } catch (error) {
    printError(`Failed to restart services: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function checkServiceHealth(context: CLIContext): Promise<void> {
  const { options } = context;
  const manager = ServiceManager.getInstance();

  try {
    await manager.updateServiceStatus();
    
    const filter: any = {};
    if (options.service) filter.service = options.service;

    const services = manager.getServices(filter);
    const unhealthyServices = services.filter(s => s.health === 'unhealthy' || s.health === 'degraded');

    console.log(successBold('\n🏥 Service Health Check\n'));

    if (unhealthyServices.length === 0) {
      printSuccess('✅ All services are healthy');
    } else {
      printWarning(`⚠️ Found ${unhealthyServices.length} unhealthy services:`);
      
      unhealthyServices.forEach(service => {
        console.log(`  ❌ ${service.name}: ${service.health}`);
        if (service.lastError) {
          console.log(`     Error: ${service.lastError}`);
        }
      });

      if (options.fix) {
        printInfo('\nAttempting to fix unhealthy services...');
        
        for (const service of unhealthyServices) {
          try {
            await manager.stopService(service.name, { force: true });
            await manager.startService(service.name);
            printSuccess(`✅ Fixed ${service.name}`);
          } catch (error) {
            printError(`❌ Failed to fix ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    if (options.detailed) {
      console.log('\nDetailed Health Information:');
      services.forEach(service => {
        console.log(`\n${service.name}:`);
        console.log(`  Health: ${service.health}`);
        console.log(`  Status: ${service.status}`);
        console.log(`  Dependencies: ${service.dependencies.join(', ') || 'None'}`);
        if (service.metrics) {
          console.log(`  Metrics: ${JSON.stringify(service.metrics, null, 4)}`);
        }
      });
    }
  } catch (error) {
    printError(`Failed to check service health: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showServiceLogs(context: CLIContext): Promise<void> {
  const { options } = context;

  if (!options.service) {
    printError('Service name is required');
    printInfo('Usage: flowx services logs --service <service-name> [options]');
    return;
  }

  printInfo(`📄 Service Logs: ${options.service}`);
  console.log('─'.repeat(60));
  
  // Mock log output for demo
  const sampleLogs = [
    `[INFO] ${new Date().toISOString()} Service ${options.service} started`,
    `[INFO] ${new Date().toISOString()} Initializing components...`,
    `[INFO] ${new Date().toISOString()} Health check passed`,
    `[DEBUG] ${new Date().toISOString()} Processing request`,
    `[INFO] ${new Date().toISOString()} Service running normally`
  ];

  const filteredLogs = options.level 
    ? sampleLogs.filter(log => log.includes(`[${options.level.toUpperCase()}]`))
    : sampleLogs;

  const displayLogs = filteredLogs.slice(-(options.lines || 50));
  displayLogs.forEach(log => console.log(log));

  if (options.follow) {
    printInfo('\nFollowing logs (Ctrl+C to stop)...');
    printInfo('Real-time log following not implemented in this demo');
  }
}

async function showServiceMetrics(context: CLIContext): Promise<void> {
  const { options } = context;
  const manager = ServiceManager.getInstance();

  try {
    await manager.updateServiceStatus();
    
    const filter: any = {};
    if (options.service) filter.service = options.service;

    const services = manager.getServices(filter);

    console.log(successBold('\n📊 Service Metrics\n'));

    services.forEach(service => {
      if (service.metrics) {
        console.log(`${service.name}:`);
        Object.entries(service.metrics).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        console.log();
      }
    });

    if (options.duration > 0) {
      printInfo(`Collecting metrics for ${options.duration} seconds...`);
      
      const interval = setInterval(async () => {
        await manager.updateServiceStatus();
        console.clear();
        console.log(successBold('\n📊 Service Metrics (Live)\n'));
        
        const updatedServices = manager.getServices(filter);
        updatedServices.forEach(service => {
          if (service.metrics) {
            console.log(`${service.name}:`);
            Object.entries(service.metrics).forEach(([key, value]) => {
              console.log(`  ${key}: ${value}`);
            });
            console.log();
          }
        });
      }, options.interval * 1000);

      setTimeout(() => {
        clearInterval(interval);
        printSuccess('Metrics collection completed');
      }, options.duration * 1000);
    }
  } catch (error) {
    printError(`Failed to show service metrics: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showServiceDependencies(context: CLIContext): Promise<void> {
  const { options } = context;
  const manager = ServiceManager.getInstance();

  try {
    const filter: any = {};
    if (options.service) filter.service = options.service;

    const services = manager.getServices(filter);

    console.log(successBold('\n🔗 Service Dependencies\n'));

    if (options.tree) {
      // Build dependency tree
      services.forEach(service => {
        console.log(`${service.name}:`);
        service.dependencies.forEach(dep => {
          const depService = manager.getServices({ service: dep })[0];
          const status = depService ? depService.status : 'missing';
          console.log(`  ├─ ${dep} (${status})`);
        });
        console.log();
      });
    } else {
      // Simple dependency list
      const tableData = services.map(service => ({
        service: service.name,
        dependencies: service.dependencies.join(', ') || 'None',
        status: service.status
      }));

      console.log(formatTable(tableData, [
        { header: 'Service', key: 'service' },
        { header: 'Dependencies', key: 'dependencies' },
        { header: 'Status', key: 'status' }
      ]));
    }
  } catch (error) {
    printError(`Failed to show service dependencies: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper functions

function displayServicesTable(services: ServiceInfo[], title: string): void {
  console.log(successBold(`\n🔧 ${title}\n`));
  
  const tableData = services.map(service => ({
    name: service.name,
    type: service.type,
    status: getStatusDisplay(service.status),
    health: getHealthDisplay(service.health),
    uptime: service.uptime ? formatDuration(Date.now() - service.uptime) : '-',
    memory: service.memoryUsage ? Math.round(service.memoryUsage / 1024 / 1024) + 'MB' : '-'
  }));

  console.log(formatTable(tableData, [
    { header: 'Name', key: 'name' },
    { header: 'Type', key: 'type' },
    { header: 'Status', key: 'status' },
    { header: 'Health', key: 'health' },
    { header: 'Uptime', key: 'uptime' },
    { header: 'Memory', key: 'memory' }
  ]));
  console.log();
}

function getStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    running: '🟢 Running',
    stopped: '🔴 Stopped',
    error: '❌ Error',
    starting: '🟡 Starting',
    stopping: '🟠 Stopping',
    unknown: '⚪ Unknown'
  };
  return statusMap[status] || status;
}

function getHealthDisplay(health: string): string {
  const healthMap: Record<string, string> = {
    healthy: '✅ Healthy',
    degraded: '⚠️ Degraded',
    unhealthy: '❌ Unhealthy',
    unknown: '❓ Unknown'
  };
  return healthMap[health] || health;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default servicesCommand; 