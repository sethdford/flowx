/**
 * Bootstrap System
 * Orchestrates the initialization of all architectural components
 */

import { Application, ApplicationModule, ApplicationConfig } from './application.ts';
import { Container } from './container.ts';
import { PluginManager } from './plugin-system.ts';
import { createValidator } from './validation.ts';
import { CLIApplication } from '../cli/core/application.ts';
import { ILogger } from './logger.ts';
import { IEventBus, EventBus } from './event-bus.ts';

export interface BootstrapConfig extends ApplicationConfig {
  modules?: string[];
  plugins?: string[];
  cli?: {
    commands?: string[];
    middleware?: string[];
  };
  mcp?: any;
  enableMCP?: boolean;
  gracefulShutdownTimeout: number;
  enableHealthChecks: boolean;
  enableMetrics: boolean;
}

export class Bootstrap {
  private application?: Application;
  private container: Container;
  private pluginManager?: PluginManager;
  private cliApp?: CLIApplication;
  private config: BootstrapConfig;

  constructor(config: BootstrapConfig) {
    this.config = config;
    this.container = new Container({
      enableCircularDependencyDetection: true,
      enableMetrics: true,
      maxResolutionDepth: 50
    });
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<Application> {
    // Register core services
    await this.registerCoreServices();

    // Create application
    this.application = new Application(this.config, this.container);

    // Register core modules
    await this.registerCoreModules();

    // Register user modules
    if (this.config.modules) {
      await this.registerUserModules(this.config.modules);
    }

    // Initialize plugins
    if (this.config.plugins) {
      await this.initializePlugins(this.config.plugins);
    }

    // Initialize CLI
    await this.initializeCLI();

    return this.application;
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    if (!this.application) {
      throw new Error('Application not initialized. Call initialize() first.');
    }

    await this.application.start();
  }

  /**
   * Stop the application
   */
  async stop(): Promise<void> {
    if (this.application) {
      await this.application.stop();
    }
  }

  /**
   * Get the dependency injection container
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Get the CLI application
   */
  getCLI(): CLIApplication | undefined {
    return this.cliApp;
  }

  private async registerCoreServices(): Promise<void> {
    // Register logger
    this.container.singleton('logger', async () => {
      const { Logger } = await import('./logger.ts');
      return new Logger({
        level: this.config.environment === 'development' ? 'debug' : 'info',
        format: 'json',
        destination: 'console'
      });
    });

    // Register event bus
    this.container.singleton('eventBus', () => {
      return EventBus.getInstance();
    });

    // Register validator
    this.container.singleton('validator', () => {
      return createValidator();
    });

    // Register configuration
    this.container.singleton('config', () => this.config);
  }

  private async registerCoreModules(): Promise<void> {
    if (!this.application) return;

    // Core module
    const coreModule: ApplicationModule = {
      name: 'core',
      async initialize(container) {
        // Core services are already registered
      },
      async start(container) {
        const logger = await container.resolve<ILogger>('logger');
        logger.info('Core module started');
      },
      async healthCheck() {
        return true;
      }
    };

    // Monitoring module
    const monitoringModule: ApplicationModule = {
      name: 'monitoring',
      dependencies: ['core'],
      async initialize(container) {
        const logger = await container.resolve<ILogger>('logger');
        const eventBus = await container.resolve<IEventBus>('eventBus');
        
        // Register monitoring services
        container.singleton('monitor', async () => {
          const { RealTimeMonitor } = await import('../monitoring/real-time-monitor.ts');
          const config = await container.resolve('config') as BootstrapConfig;
          const logger = await container.resolve<ILogger>('logger');
          const eventBus = await container.resolve<IEventBus>('eventBus');
          const memory = await container.resolve('memory') as any;
          return new RealTimeMonitor({
            updateInterval: 5000,
            retentionPeriod: 86400000,
            alertingEnabled: true,
            alertThresholds: {
              cpu: { warning: 70, critical: 80 },
              memory: { warning: 75, critical: 85 },
              errorRate: { warning: 3, critical: 5 },
              disk: { warning: 80, critical: 90 },
              responseTime: { warning: 1000, critical: 2000 },
              queueDepth: { warning: 100, critical: 200 },
              agentHealth: { warning: 80, critical: 60 },
              swarmUtilization: { warning: 85, critical: 95 }
            },
            metricsEnabled: true,
            tracingEnabled: true,
            dashboardEnabled: true,
            exportEnabled: false,
            exportFormat: 'json',
            debugMode: false
          }, logger, eventBus, memory);
        });
      },
      async start(container) {
        const monitor = await container.resolve('monitor') as any;
        if (monitor && typeof monitor.start === 'function') {
          await monitor.start();
        }
      },
      async healthCheck() {
        return true;
      }
    };

    // MCP module
    const mcpModule: ApplicationModule = {
      name: 'mcp',
      dependencies: ['core', 'monitoring'],
      async initialize(container) {
        const logger = await container.resolve<ILogger>('logger');
        const eventBus = await container.resolve<IEventBus>('eventBus');
        
        // Register MCP services
        container.singleton('mcpServer', async () => {
          const { MCPServer } = await import('../mcp/server.ts');
          const config = await container.resolve('config') as BootstrapConfig;
          const logger = await container.resolve<ILogger>('logger');
          const eventBus = await container.resolve<IEventBus>('eventBus');
          return new MCPServer(config.mcp || {}, eventBus, logger);
        });
      },
      async start(container) {
        const config = await container.resolve('config') as BootstrapConfig;
        if (config.enableMCP) {
          const mcpServer = await container.resolve('mcpServer') as any;
          if (mcpServer && typeof mcpServer.start === 'function') {
            await mcpServer.start();
          }
        }
      },
      async healthCheck() {
        return true;
      }
    };

    // Register modules
    await this.application.registerModule(coreModule);
    await this.application.registerModule(monitoringModule);
    await this.application.registerModule(mcpModule);
  }

  private async registerUserModules(moduleNames: string[]): Promise<void> {
    if (!this.application) return;

    for (const moduleName of moduleNames) {
      try {
        const moduleExports = await import(moduleName);
        const moduleInstance = moduleExports.default || moduleExports;
        
        if (this.isApplicationModule(moduleInstance)) {
          await this.application.registerModule(moduleInstance);
        } else if (typeof moduleInstance === 'function') {
          // Module factory function
          const logger = await this.container.resolve<ILogger>('logger');
          const eventBus = await this.container.resolve<IEventBus>('eventBus');
          const module = await moduleInstance(this.container);
          if (this.isApplicationModule(module)) {
            await this.application.registerModule(module);
          }
        }
      } catch (error) {
        const logger = await this.container.resolve<ILogger>('logger');
        logger.error(`Failed to load module ${moduleName}:`, error);
      }
    }
  }

  private async initializePlugins(pluginPaths: string[]): Promise<void> {
    const logger = await this.container.resolve<ILogger>('logger');
    const eventBus = await this.container.resolve<IEventBus>('eventBus');
    this.pluginManager = new PluginManager(this.container, logger);
    
    for (const pluginPath of pluginPaths) {
      try {
        await this.pluginManager.loadPlugin({ name: pluginPath, version: '1.0.0', main: pluginPath }, pluginPath);
      } catch (error) {
        logger.error(`Failed to load plugin ${pluginPath}:`, error);
      }
    }
  }

  private async initializeCLI(): Promise<void> {
    this.cliApp = new CLIApplication(
      'flowx',
      'Claude Flow CLI',
      this.container,
      await this.container.resolve<ILogger>('logger')
    );

    await this.registerCoreCommands();
  }

  private async registerCoreCommands(): Promise<void> {
    if (!this.cliApp) return;

    // Info command
    this.cliApp.command({
      name: 'info',
      description: 'Show application information',
      async handler(context: any): Promise<any> {
        const config = await context.container.resolve('config');
        return {
          name: config.name,
          version: config.version,
          environment: config.environment
        };
      }
    });

    // Health command
    this.cliApp.command({
      name: 'health',
      description: 'Check application health',
      async handler(context: any): Promise<any> {
        if (!context.application) {
          return { status: 'error', message: 'Application not available' };
        }
        
        const health = await context.application.healthCheck();
        return { status: health ? 'healthy' : 'unhealthy' };
      }
    });

    // Modules command
    this.cliApp.command({
      name: 'modules',
      description: 'List registered modules',
      async handler(context: any): Promise<any> {
        if (!context.application) {
          return { modules: [] };
        }
        
        const modules = context.application.getModules();
        return {
          modules: modules.map((m: ApplicationModule) => ({
            name: m.name,
            dependencies: m.dependencies || []
          }))
        };
      }
    });

    // Container command
    this.cliApp.command({
      name: 'container',
      description: 'Show container information',
      async handler(context: any): Promise<any> {
        if (!context.container) {
          return { services: [] };
        }
        
        return {
          services: context.container.getRegisteredServices(),
          metrics: context.container.getMetrics()
        };
      }
    });

    // Plugins command
    this.cliApp.command({
      name: 'plugins',
      description: 'List loaded plugins',
      async handler(context: any): Promise<any> {
        if (!context.pluginManager) {
          return { plugins: [] };
        }
        
        return {
          plugins: context.pluginManager.getLoadedPlugins()
        };
      }
    });
  }

  private isApplicationModule(obj: any): obj is ApplicationModule {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.name === 'string' &&
      typeof obj.initialize === 'function'
    );
  }
}

/**
 * Create and configure the bootstrap system
 */
export function createBootstrap(config: BootstrapConfig): Bootstrap {
  return new Bootstrap(config);
}

/**
 * Quick start function for common use cases
 */
export async function quickStart(config: Partial<BootstrapConfig> = {}): Promise<Application> {
  const bootstrap = createBootstrap({
    name: 'flowx',
    version: '1.0.0',
    environment: 'development',
    gracefulShutdownTimeout: 30000,
    enableHealthChecks: true,
    enableMetrics: true,
    ...config
  });

  const app = await bootstrap.initialize();
  await bootstrap.start();
  
  return app;
} 