/**
 * MCP (Model Context Protocol) server implementation
 * Enterprise-grade implementation with comprehensive features
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

import { 
  MCPConfig, 
  MCPRequest, 
  MCPResponse, 
  MCPError,
  MCPTool,
  MCPInitializeParams,
  MCPInitializeResult,
  MCPSession,
  MCPMetrics,
  MCPProtocolVersion,
  MCPCapabilities,
  MCPContext,
} from "../utils/types";
import { IEventBus } from "../core/event-bus";
import { ILogger } from "../core/logger";
import { MCPError as MCPErrorClass, MCPMethodNotFoundError } from "../utils/errors";
import { ITransport } from "./transports/base";
import { StdioTransport } from "./transports/stdio";
import { HttpTransport } from "./transports/http";
import { ToolRegistry } from "./tools";
import { RequestRouter } from "./router";
import { SessionManager, ISessionManager } from "./session-manager";
import { AuthManager, IAuthManager } from "./auth";
import { LoadBalancer, ILoadBalancer, RequestQueue } from "./load-balancer";

import { createFlowXTools, FlowXToolContext } from "./flowx-tools";
import { createSwarmTools, SwarmToolContext } from "./swarm-tools";
import { createNeuralTools } from "./neural-tools";
import { createEnterpriseSwarmTools } from "./enterprise-swarm-tools";
import { createFilesystemTools } from "./tools/filesystem/index";
import { createWebTools } from "./tools/web/index";
import { createDatabaseTools } from "./tools/database/index";
import { platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';

export interface IMCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  registerTool(tool: MCPTool): void;
  getHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }>;
  getMetrics(): MCPMetrics;
  getSessions(): MCPSession[];
  getSession(sessionId: string): MCPSession | undefined;
  terminateSession(sessionId: string): void;
}

/**
 * Enterprise-grade MCP server implementation
 */
export class MCPServer implements IMCPServer {
  private transport: ITransport;
  private toolRegistry: ToolRegistry;
  private router: RequestRouter;
  private sessionManager: ISessionManager;
  private authManager: IAuthManager;
  private loadBalancer?: ILoadBalancer;
  private requestQueue?: RequestQueue;
  private running = false;
  private currentSession?: MCPSession | undefined;

  private readonly serverInfo = {
    name: 'FlowX MCP Server',
    version: '2.0.0-alpha.56',
  };

  private readonly supportedProtocolVersion: MCPProtocolVersion = {
    major: 2024,
    minor: 11,
    patch: 5,
  };

  private readonly serverCapabilities: MCPCapabilities = {
    logging: {
      level: 'info',
    },
    tools: {
      listChanged: true,
    },
    resources: {
      listChanged: true,
      subscribe: true,
    },
    prompts: {
      listChanged: false,
    },
  };

  constructor(
    private config: MCPConfig,
    private eventBus: IEventBus,
    private logger: ILogger,
    private orchestrator?: any, // Reference to orchestrator instance
    private swarmCoordinator?: any, // Reference to swarm coordinator instance
    private agentManager?: any, // Reference to agent manager instance
    private resourceManager?: any, // Reference to resource manager instance
    private messagebus?: any, // Reference to message bus instance
    private monitor?: any, // Reference to real-time monitor instance
  ) {
    // Initialize transport
    this.transport = this.createTransport();
    
    // Initialize enhanced tool registry
    this.toolRegistry = new ToolRegistry(logger);
    
    // Initialize session manager
    this.sessionManager = new SessionManager(config, logger);
    
    // Initialize auth manager
    this.authManager = new AuthManager(config.auth || { enabled: false, method: 'token' }, logger);
    
    // Initialize load balancer if enabled
    if (config.loadBalancer?.enabled) {
      this.loadBalancer = new LoadBalancer(config.loadBalancer, logger);
      this.requestQueue = new RequestQueue(1000, 30000, logger);
    }
    
    // Initialize request router
    this.router = new RequestRouter(this.toolRegistry, logger);
  }

      async start(): Promise<void> {
      if (this.running) {
        throw new MCPErrorClass('MCP server already running');
      }

    this.logger.info('Starting enterprise MCP server', { 
      transport: this.config.transport,
      version: this.serverInfo.version,
      capabilities: this.serverCapabilities
    });

    try {
      // Set up request handler
      this.transport.onRequest(async (request) => {
        return await this.handleRequest(request);
      });

      // Start transport
      await this.transport.start();

      // Register comprehensive tool ecosystem
      this.registerEnterpriseTools();

      this.running = true;
      this.logger.info('Enterprise MCP server started successfully', {
        toolCount: this.toolRegistry.getToolCount(),
        transport: this.config.transport,
        port: this.config.port,
        host: this.config.host
      });
          } catch (error) {
        this.logger.error('Failed to start MCP server', error);
        throw new MCPErrorClass('Failed to start MCP server', { error });
      }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.logger.info('Stopping enterprise MCP server');

    try {
      // Stop transport
      await this.transport.stop();

      // Clean up session manager
      if (this.sessionManager && 'destroy' in this.sessionManager) {
        (this.sessionManager as any).destroy();
      }

      // Clean up all sessions
      for (const session of this.sessionManager.getActiveSessions()) {
        this.sessionManager.removeSession(session.id);
      }

      this.running = false;
      this.currentSession = undefined;
      this.logger.info('Enterprise MCP server stopped');
    } catch (error) {
      this.logger.error('Error stopping MCP server', error);
      throw error;
    }
  }

  registerTool(tool: MCPTool): void {
    this.toolRegistry.register(tool);
    this.logger.info('Tool registered', { name: tool.name });
  }

  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    try {
      const transportHealth = await this.transport.getHealthStatus();
      const registeredTools = this.toolRegistry.getToolCount();
      const { totalRequests, successfulRequests, failedRequests } = this.router.getMetrics();
      const sessionMetrics = this.sessionManager.getSessionMetrics();

      const metrics: Record<string, number> = {
        registeredTools,
        totalRequests,
        successfulRequests,
        failedRequests,
        totalSessions: sessionMetrics.total,
        activeSessions: sessionMetrics.active,
        authenticatedSessions: sessionMetrics.authenticated,
        expiredSessions: sessionMetrics.expired,
        ...transportHealth.metrics,
      };

      if (this.loadBalancer) {
        const lbMetrics = this.loadBalancer.getMetrics();
        metrics.rateLimitedRequests = lbMetrics.rateLimitedRequests;
        metrics.averageResponseTime = lbMetrics.averageResponseTime;
        metrics.requestsPerSecond = lbMetrics.requestsPerSecond;
        metrics.circuitBreakerTrips = lbMetrics.circuitBreakerTrips;
      }

      const status: { healthy: boolean; error?: string; metrics?: Record<string, number> } = {
        healthy: this.running && transportHealth.healthy,
        metrics,
      };
      if (transportHealth.error !== undefined) {
        status.error = transportHealth.error;
      }
      return status;
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getMetrics(): MCPMetrics {
    const routerMetrics = this.router.getMetrics();
    const sessionMetrics = this.sessionManager.getSessionMetrics();
    const lbMetrics = this.loadBalancer?.getMetrics();
    const toolMetricsArray = this.toolRegistry.getToolMetrics() as any[];

    // Convert tool metrics to record format
    const toolInvocations: Record<string, number> = {};
    for (const metric of toolMetricsArray) {
      toolInvocations[metric.name] = metric.totalInvocations;
    }

    return {
      totalRequests: routerMetrics.totalRequests,
      successfulRequests: routerMetrics.successfulRequests,
      failedRequests: routerMetrics.failedRequests,
      averageResponseTime: lbMetrics?.averageResponseTime || 0,
      activeSessions: sessionMetrics.active,
      toolInvocations,
      errors: {}, // TODO: Implement error categorization
      lastReset: lbMetrics?.lastReset || new Date(),
    };
  }

  getSessions(): MCPSession[] {
    return this.sessionManager.getActiveSessions();
  }

  getSession(sessionId: string): MCPSession | undefined {
    return this.sessionManager.getSession(sessionId);
  }

  terminateSession(sessionId: string): void {
    this.sessionManager.removeSession(sessionId);
    if (this.currentSession?.id === sessionId) {
      this.currentSession = undefined;
    }
  }

  private async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    this.logger.debug('Handling MCP request', { 
      id: request.id,
      method: request.method,
    });

    try {
      // Handle initialization request separately
      if (request.method === 'initialize') {
        return await this.handleInitialize(request);
      }

      // Get or create session
      const session = this.getOrCreateSession();
      
      // Check if session is initialized for non-initialize requests
      if (!session.isInitialized) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32002,
            message: 'Server not initialized',
          },
        };
      }

      // Update session activity
      this.sessionManager.updateActivity(session.id);

      // Check authentication if enabled (simplified for now)
      // TODO: Implement proper authentication checking when auth manager is enhanced

      // Check load balancer constraints
      if (this.loadBalancer) {
        const allowed = await this.loadBalancer.shouldAllowRequest(session, request);
        if (!allowed) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32000,
              message: 'Rate limit exceeded or circuit breaker open',
            },
          };
        }
      }

      // Record request start
      const requestMetrics = this.loadBalancer?.recordRequestStart(session, request);

      try {
        // Process request through router
        const result = await this.router.route(request);
        
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: request.id,
          result,
        };

        // Record success
        if (requestMetrics) {
          this.loadBalancer?.recordRequestEnd(requestMetrics, response);
        }

        return response;
      } catch (error) {
        // Record failure
        if (requestMetrics) {
          this.loadBalancer?.recordRequestEnd(requestMetrics, undefined, error as Error);
        }
        throw error;
      }
    } catch (error) {
      this.logger.error('Error handling MCP request', { 
        id: request.id,
        method: request.method,
        error,
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: this.errorToMCPError(error),
      };
    }
  }

  private async handleInitialize(request: MCPRequest): Promise<MCPResponse> {
    try {
      const params = request.params as MCPInitializeParams;
      
      if (!params) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: 'Invalid params',
          },
        };
      }

      // Create session
      const session = this.sessionManager.createSession(this.config.transport);
      this.currentSession = session;

      // Initialize session
      this.sessionManager.initializeSession(session.id, params);

      // Prepare response with enhanced capabilities
      const result: MCPInitializeResult = {
        protocolVersion: this.supportedProtocolVersion,
        capabilities: this.serverCapabilities,
        serverInfo: this.serverInfo,
        instructions: 'FlowX Enterprise MCP Server ready for advanced tool execution',
      };

      this.logger.info('Session initialized', {
        sessionId: session.id,
        clientInfo: params.clientInfo,
        protocolVersion: params.protocolVersion,
        toolCount: this.toolRegistry.getToolCount()
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
    } catch (error) {
      this.logger.error('Error during initialization', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: this.errorToMCPError(error),
      };
    }
  }

  private getOrCreateSession(): MCPSession {
    if (this.currentSession) {
      return this.currentSession;
    }

    // For stdio transport, create a default session
    const session = this.sessionManager.createSession(this.config.transport);
    this.currentSession = session;
    return session;
  }

  private createTransport(): ITransport {
    switch (this.config.transport) {
      case 'stdio':
        return new StdioTransport(this.logger);
      
      case 'http':
        return new HttpTransport(
          this.config.host || 'localhost',
          this.config.port || 3000,
          this.config.tlsEnabled || false,
          this.logger,
        );
      
              default:
          throw new MCPErrorClass(`Unknown transport type: ${this.config.transport}`);
    }
  }

  private registerEnterpriseTools(): void {
    this.logger.info('Registering enterprise tool ecosystem...');

    // Register core system tools
    this.registerSystemTools();

    // Register FlowX specific tools if orchestrator is available
    if (this.orchestrator) {
      const flowxTools = createFlowXTools(
        this.orchestrator,
        this.swarmCoordinator,
        this.agentManager,
        this.resourceManager,
        this.messagebus,
        this.monitor
      );
      
      for (const tool of flowxTools) {
        this.registerTool(tool);
      }
      
      this.logger.info('Registered FlowX tools', { count: flowxTools.length });
    } else {
      this.logger.warn('Orchestrator not available - FlowX tools not registered');
    }

    // Register Swarm-specific tools if swarm components are available
    if (this.swarmCoordinator || this.agentManager || this.resourceManager) {
      const swarmTools = createSwarmTools(this.logger);
      
      for (const tool of swarmTools) {
        // Wrap the handler to inject swarm context
        const originalHandler = tool.handler;
        tool.handler = async (input: unknown, context?: MCPContext) => {
          const swarmContext: SwarmToolContext = {
            ...context,
            swarmCoordinator: this.swarmCoordinator,
            agentManager: this.agentManager,
            resourceManager: this.resourceManager,
            messageBus: this.messagebus,
            monitor: this.monitor,
          } as SwarmToolContext;
          
          return await originalHandler(input, swarmContext);
        };
        
        this.registerTool(tool);
      }
      
      this.logger.info('Registered Swarm tools', { count: swarmTools.length });
    } else {
      this.logger.warn('Swarm components not available - Swarm tools not registered');
    }

    // Register Neural Network Tools (15 tools)
    const neuralTools = createNeuralTools(this.logger);
    for (const tool of neuralTools) {
      this.registerTool(tool);
    }
    this.logger.info('Registered Neural Network tools', { count: neuralTools.length });

    // Register Enterprise Swarm Tools (87 tools) - Advanced swarm coordination and neural patterns
    const enterpriseSwarmTools = createEnterpriseSwarmTools(this.logger);
    for (const tool of enterpriseSwarmTools) {
      this.registerTool(tool);
    }
    this.logger.info('Registered Enterprise Swarm tools', { count: enterpriseSwarmTools.length });

    // Register Filesystem Tools
    const filesystemTools = createFilesystemTools(this.logger);
    for (const tool of filesystemTools) {
      this.registerTool(tool);
    }
    this.logger.info('Registered Filesystem tools', { count: filesystemTools.length });

    // Register Web Tools
    const webTools = createWebTools(this.logger);
    for (const tool of webTools) {
      this.registerTool(tool);
    }
    this.logger.info('Registered Web tools', { count: webTools.length });

    // Register Database Tools
    const databaseTools = createDatabaseTools(this.logger);
    for (const tool of databaseTools) {
      this.registerTool(tool);
    }
    this.logger.info('Registered Database tools', { count: databaseTools.length });

    const totalTools = this.toolRegistry.getToolCount();
    this.logger.info('Enterprise tool ecosystem registered', { 
      totalTools,
      categories: this.toolRegistry.getCategories().length,
      capabilities: ['neural', 'swarm', 'filesystem', 'web', 'database', 'enterprise']
    });
  }

  private registerSystemTools(): void {
    // System information tool
    this.registerTool({
      name: 'system/info',
      description: 'Get comprehensive system information',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        return {
          version: this.serverInfo.version,
          platform: platform(),
          arch: arch(),
          runtime: 'Node.js',
          uptime: performance.now(),
          capabilities: this.serverCapabilities,
          toolCount: this.toolRegistry.getToolCount(),
          sessionCount: this.sessionManager.getActiveSessions().length,
          healthStatus: await this.getHealthStatus()
        };
      },
    });

    // Health check tool
    this.registerTool({
      name: 'system/health',
      description: 'Get comprehensive system health status',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        return await this.getHealthStatus();
      },
    });

    // List tools with enhanced information
    this.registerTool({
      name: 'tools/list',
      description: 'List all available tools with capabilities',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category' },
          tag: { type: 'string', description: 'Filter by tag' }
        },
      },
      handler: async (input: any) => {
        const filters = {
          category: input?.category,
          tags: input?.tag ? [input.tag] : undefined
        };
        return this.toolRegistry.discoverTools(filters);
      },
    });

    // Tool schema with capability information
    this.registerTool({
      name: 'tools/schema',
      description: 'Get detailed schema and capability info for a specific tool',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
             handler: async (input: any) => {
         const tool = this.toolRegistry.getTool(input.name);
         const capability = this.toolRegistry.getToolCapability(input.name);
         if (!tool) {
           throw new Error(`Tool not found: ${input.name}`);
         }
         const toolMetrics = this.toolRegistry.getToolMetrics(input.name) as any;
         return {
           name: tool.name,
           description: tool.description,
           inputSchema: tool.inputSchema,
           capability,
           metrics: toolMetrics
         };
       },
    });

    // Tool metrics
    this.registerTool({
      name: 'tools/metrics',
      description: 'Get performance metrics for all tools',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        return this.toolRegistry.getToolMetrics();
      },
    });

    // Session management
    this.registerTool({
      name: 'session/info',
      description: 'Get current session information',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        return {
          currentSession: this.currentSession,
          activeSessions: this.sessionManager.getActiveSessions().length,
          sessionMetrics: this.sessionManager.getSessionMetrics()
        };
      },
    });
  }

  private errorToMCPError(error: any): MCPError {
    if (error instanceof MCPMethodNotFoundError) {
      return {
        code: -32601,
        message: (error instanceof Error ? error.message : String(error)),
        data: error.details,
      };
    }

          if (error instanceof MCPErrorClass) {
        return {
          code: -32603,
        message: (error instanceof Error ? error.message : String(error)),
        data: error.details,
      };
    }

    if (error instanceof Error) {
      return {
        code: -32603,
        message: (error instanceof Error ? error.message : String(error)),
      };
    }

    return {
      code: -32603,
      message: 'Internal error',
      data: error,
    };
  }
}