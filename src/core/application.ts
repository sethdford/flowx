/**
 * Application Framework
 * Provides lifecycle management, service orchestration, and clean shutdown
 */

import { Container } from './container.js';
import { ILogger } from './logger.js';
import { IEventBus } from './event-bus.js';
import { EventEmitter } from 'node:events';

export interface ApplicationConfig {
  name: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  gracefulShutdownTimeout: number;
  enableHealthChecks: boolean;
  enableMetrics: boolean;
}

export interface ApplicationModule {
  name: string;
  dependencies?: string[];
  initialize(container: Container, config: ApplicationConfig): Promise<void>;
  start?(container: Container): Promise<void>;
  stop?(container: Container): Promise<void>;
  healthCheck?(): Promise<boolean>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
  }>;
  uptime: number;
  version: string;
}

export class Application extends EventEmitter {
  private container: Container;
  private modules = new Map<string, ApplicationModule>();
  private moduleOrder: string[] = [];
  private isStarted = false;
  private startTime = Date.now();
  private shutdownInProgress = false;

  constructor(
    private config: ApplicationConfig,
    container?: Container
  ) {
    super();
    this.container = container || new Container();
    this.setupGracefulShutdown();
    this.registerCoreServices();
  }

  /**
   * Register an application module
   */
  registerModule(module: ApplicationModule): this {
    if (this.isStarted) {
      throw new Error('Cannot register modules after application has started');
    }

    this.modules.set(module.name, module);
    return this;
  }

  /**
   * Register multiple modules
   */
  registerModules(modules: ApplicationModule[]): this {
    modules.forEach(module => this.registerModule(module));
    return this;
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Application is already started');
    }

    try {
      const logger = await this.container.resolve<ILogger>('logger');
      logger.info('Starting application', { 
        name: this.config.name, 
        version: this.config.version,
        environment: this.config.environment 
      });

      // Resolve module dependencies and determine startup order
      this.moduleOrder = this.resolveDependencyOrder();

      // Initialize modules in dependency order
      for (const moduleName of this.moduleOrder) {
        const module = this.modules.get(moduleName)!;
        logger.info(`Initializing module: ${moduleName}`);
        await module.initialize(this.container, this.config);
      }

      // Start modules
      for (const moduleName of this.moduleOrder) {
        const module = this.modules.get(moduleName)!;
        if (module.start) {
          logger.info(`Starting module: ${moduleName}`);
          await module.start(this.container);
        }
      }

      this.isStarted = true;
      this.emit('started');
      
      logger.info('Application started successfully', {
        modules: this.moduleOrder.length,
        startupTime: Date.now() - this.startTime
      });

    } catch (error) {
      try {
        const logger = await this.container.resolve<ILogger>('logger');
        logger.error('Failed to start application', error);
      } catch {
        console.error('Failed to start application', error);
      }
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   */
  async stop(): Promise<void> {
    if (!this.isStarted || this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;
    const logger = await this.container.resolve<ILogger>('logger');
    
    try {
      logger.info('Stopping application gracefully');
      this.emit('stopping');

      // Stop modules in reverse order
      const reverseOrder = [...this.moduleOrder].reverse();
      
      for (const moduleName of reverseOrder) {
        const module = this.modules.get(moduleName)!;
        if (module.stop) {
          try {
            logger.info(`Stopping module: ${moduleName}`);
            await Promise.race([
              module.stop(this.container),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Module stop timeout')), 
                  this.config.gracefulShutdownTimeout)
              )
            ]);
          } catch (error) {
            logger.error(`Error stopping module ${moduleName}`, error);
          }
        }
      }

      this.isStarted = false;
      this.emit('stopped');
      logger.info('Application stopped gracefully');

    } catch (error) {
      logger.error('Error during application shutdown', error);
      this.emit('error', error);
      throw error;
    } finally {
      this.shutdownInProgress = false;
    }
  }

  /**
   * Get application health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const checks: Record<string, any> = {};
    
    // Check each module's health
    for (const [name, module] of this.modules) {
      if (module.healthCheck) {
        const start = Date.now();
        try {
          const healthy = await Promise.race([
            module.healthCheck(),
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('Health check timeout')), 5000)
            )
          ]);
          
          checks[name] = {
            status: healthy ? 'pass' : 'fail',
            duration: Date.now() - start
          };
        } catch (error) {
          checks[name] = {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - start
          };
        }
      }
    }

    // Determine overall status
    const hasFailures = Object.values(checks).some((check: any) => check.status === 'fail');
    const hasWarnings = Object.values(checks).some((check: any) => check.status === 'warn');
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailures) {
      status = 'unhealthy';
    } else if (hasWarnings) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      checks,
      uptime: Date.now() - this.startTime,
      version: this.config.version
    };
  }

  /**
   * Get the dependency injection container
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Check if application is running
   */
  isRunning(): boolean {
    return this.isStarted && !this.shutdownInProgress;
  }

  private registerCoreServices(): void {
    // Register application instance
    this.container.singleton('application', () => this);
    
    // Register configuration
    this.container.singleton('config', () => this.config);
  }

  private resolveDependencyOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (moduleName: string) => {
      if (visiting.has(moduleName)) {
        throw new Error(`Circular dependency detected involving module: ${moduleName}`);
      }
      
      if (visited.has(moduleName)) {
        return;
      }

      visiting.add(moduleName);
      
      const module = this.modules.get(moduleName);
      if (!module) {
        throw new Error(`Module not found: ${moduleName}`);
      }

      // Visit dependencies first
      if (module.dependencies) {
        for (const dep of module.dependencies) {
          if (!this.modules.has(dep)) {
            throw new Error(`Dependency not found: ${dep} (required by ${moduleName})`);
          }
          visit(dep);
        }
      }

      visiting.delete(moduleName);
      visited.add(moduleName);
      order.push(moduleName);
    };

    // Visit all modules
    for (const moduleName of this.modules.keys()) {
      visit(moduleName);
    }

    return order;
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      try {
        await this.stop();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      console.error('Unhandled rejection:', reason);
      try {
        await this.stop();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
      process.exit(1);
    });
  }
} 