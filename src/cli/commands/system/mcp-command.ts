/**
 * MCP Command with Real Implementation
 * Master Control Program server for Claude Flow
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as express from 'express';
import { Logger } from '../../../core/logger.js';
import { getMemoryManager } from '../../core/global-initialization.js';

// Type definitions for MCP
interface McpTool {
  name: string;
  description: string;
  type: 'function' | 'service' | 'utility';
  category: string;
  status: 'active' | 'inactive';
  handler?: Function;
}

interface McpServer {
  app: any;
  server: any;
  io: any;
  tools: Map<string, McpTool>;
  isRunning: boolean;
  port: number;
  host: string;
  logger: Logger;
}

// Global MCP server instance
let mcpServer: McpServer | null = null;

export const mcpCommand: CLICommand = {
  name: 'mcp',
  description: 'Master Control Program server management',
  category: 'System',
  usage: 'flowx mcp <subcommand> [OPTIONS]',
  examples: [
    'flowx mcp start',
    'flowx mcp start --port 3030',
    'flowx mcp start --wrapper',
    'flowx mcp stop',
    'flowx mcp status',
    'flowx mcp tools'
  ],
  subcommands: [
    {
      name: 'start',
      description: 'Start the MCP server',
      handler: async (context: CLIContext) => await startMcpServer(context),
      options: [
        {
          name: 'port',
          short: 'p',
          description: 'Port to run the server on',
          type: 'number',
          default: 3000
        },
        {
          name: 'host',
          short: 'h',
          description: 'Host to bind the server to',
          type: 'string',
          default: 'localhost'
        },
        {
          name: 'background',
          short: 'b',
          description: 'Run server in background',
          type: 'boolean',
          default: false
        },
        {
          name: 'wrapper',
          short: 'w',
          description: 'Use Claude Code wrapper mode for passing context to Claude Code',
          type: 'boolean',
          default: false
        },
        {
          name: 'transport',
          short: 't',
          description: 'Transport type (stdio, http)',
          type: 'string',
          choices: ['stdio', 'http'],
          default: 'stdio'
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Verbose output',
          type: 'boolean',
          default: false
        }
      ]
    },
    {
      name: 'stop',
      description: 'Stop the MCP server',
      handler: async (context: CLIContext) => await stopMcpServer(context)
    },
    {
      name: 'status',
      description: 'Check MCP server status',
      handler: async (context: CLIContext) => await checkMcpStatus(context),
      options: [
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['table', 'json'],
          default: 'table'
        }
      ]
    },
    {
      name: 'tools',
      description: 'List available MCP tools',
      handler: async (context: CLIContext) => await listMcpTools(context),
      options: [
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['table', 'json'],
          default: 'table'
        },
        {
          name: 'category',
          short: 'c',
          description: 'Filter tools by category',
          type: 'string'
        }
      ]
    },
    {
      name: 'serve',
      description: 'Start MCP server in serve mode for Claude Code integration',
      handler: async (context: CLIContext) => await serveMcpServer(context),
      options: [
        {
          name: 'port',
          short: 'p',
          description: 'Port to run the server on',
          type: 'number',
          default: 3000
        },
        {
          name: 'transport',
          short: 't',
          description: 'Transport type (stdio, http)',
          type: 'string',
          choices: ['stdio', 'http'],
          default: 'stdio'
        },
        {
          name: 'config',
          short: 'c',
          description: 'Configuration file path',
          type: 'string'
        },
        {
          name: 'minimal',
          description: 'Run in minimal mode',
          type: 'boolean',
          default: false
        },
        {
          name: 'log-level',
          description: 'Log level (debug, info, warn, error)',
          type: 'string',
          choices: ['debug', 'info', 'warn', 'error'],
          default: 'info'
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Verbose output',
          type: 'boolean',
          default: false
        }
      ]
    }
  ],
  handler: async (context: CLIContext) => {
    // Default to showing status if no subcommand provided
    return await checkMcpStatus(context);
  }
};

async function startMcpServer(context: CLIContext): Promise<void> {
  const { options } = context;
  const port = options.port || 3000;
  const host = options.host || 'localhost';
  
  try {
    if (mcpServer?.isRunning) {
      printWarning(`MCP server is already running on ${mcpServer.host}:${mcpServer.port}`);
      printInfo('Use "flowx mcp stop" to stop it first');
      return;
    }

    printInfo(`🚀 Starting MCP server on ${host}:${port}...`);

    // Create logger
    const logger = new Logger(
      { level: 'info', format: 'text', destination: 'console' },
      { component: 'MCP-Server' }
    );
    
    // Create Express app
    const { default: express } = await import('express');
    const app = express();
    
    // Create HTTP server
    const server = createServer(app);
    
    // Create Socket.IO server
    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    // Configure Express middleware
    const { default: cors } = await import('cors');
    app.use(cors());
    app.use(express.json());
    
    // Initialize MCP server
    mcpServer = {
      app,
      server,
      io,
      tools: new Map(),
      isRunning: false,
      port,
      host,
      logger
    };
    
    // Register built-in tools
    registerBuiltInTools();
    
    // Setup API routes
    await setupApiRoutes();
    
    // Setup socket events
    setupSocketEvents();
    
    // Start the server
    await new Promise<void>((resolve, reject) => {
      mcpServer!.server.listen(port, host, () => {
        mcpServer!.isRunning = true;
        resolve();
      }).on('error', (err: Error) => {
        reject(err);
      });
    });
    
    printSuccess(`✅ MCP server started at http://${host}:${port}/`);
    printInfo('WebSocket endpoint: ws://${host}:${port}/');
    printInfo('API endpoint: http://${host}:${port}/api/');
    
    // If not in background mode, keep process alive
    if (!options.background) {
      printInfo('Press Ctrl+C to stop the server');
      
      // Keep process running
      process.on('SIGINT', async () => {
        printInfo('\nReceived SIGINT. Shutting down MCP server...');
        await stopMcpServer(context);
        process.exit(0);
      });
      
      // Keep the process alive by waiting indefinitely
      await new Promise(() => {}); // This will never resolve, keeping the process alive
    }
    
  } catch (error) {
    printError(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
    
    // Clean up if needed
    if (mcpServer) {
      try {
        mcpServer.server.close();
      } catch (e) {
        // Ignore cleanup errors
      }
      mcpServer = null;
    }
    
    throw error;
  }
}

async function stopMcpServer(context: CLIContext): Promise<void> {
  try {
    if (!mcpServer || !mcpServer.isRunning) {
      printWarning('MCP server is not running');
      return;
    }

    printInfo('🛑 Stopping MCP server...');
    
    // Close socket connections
    mcpServer.io.close();
    
    // Close HTTP server
    await new Promise<void>((resolve) => {
      mcpServer!.server.close(() => resolve());
    });
    
    mcpServer.isRunning = false;
    printSuccess('✅ MCP server stopped');
    
  } catch (error) {
    printError(`Failed to stop MCP server: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function checkMcpStatus(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const isRunning = mcpServer?.isRunning || false;
    const statusText = isRunning ? successBold('Running') : errorBold('Stopped');
    
    if (options.format === 'json') {
      const status = {
        status: isRunning ? 'running' : 'stopped',
        port: mcpServer?.port,
        host: mcpServer?.host,
        uptime: isRunning ? process.uptime() : 0,
        connections: isRunning ? Object.keys(mcpServer!.io.sockets.sockets).length : 0,
        toolCount: isRunning ? mcpServer!.tools.size : 0
      };
      
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    
    console.log(infoBold('\n🖥️  MCP Server Status\n'));
    console.log(`Status: ${statusText}`);
    
    if (isRunning) {
      console.log(`URL: http://${mcpServer!.host}:${mcpServer!.port}/`);
      console.log(`WebSocket: ws://${mcpServer!.host}:${mcpServer!.port}/`);
      console.log(`Uptime: ${formatUptime(process.uptime())}`);
      console.log(`Active Connections: ${Object.keys(mcpServer!.io.sockets.sockets).length}`);
      console.log(`Available Tools: ${mcpServer!.tools.size}`);
      console.log();
      printInfo('Use "flowx mcp tools" to list available tools');
    } else {
      console.log();
      printInfo('Use "flowx mcp start" to start the server');
    }
    
  } catch (error) {
    printError(`Failed to check MCP status: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function listMcpTools(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    if (!mcpServer || !mcpServer.isRunning) {
      printWarning('MCP server is not running');
      printInfo('Use "flowx mcp start" to start the server');
      return;
    }

    const tools = Array.from(mcpServer.tools.values());
    
    // Apply category filter if specified
    const filteredTools = options.category 
      ? tools.filter(tool => tool.category === options.category)
      : tools;
    
    if (options.format === 'json') {
      console.log(JSON.stringify(filteredTools, null, 2));
      return;
    }
    
    console.log(successBold('\n🛠️  Available MCP Tools\n'));
    
    if (filteredTools.length === 0) {
      printWarning('No tools available');
      return;
    }
    
    const toolTable = formatTable(filteredTools, [
      { header: 'Name', key: 'name' },
      { header: 'Description', key: 'description' },
      { header: 'Type', key: 'type' },
      { header: 'Category', key: 'category' },
      { header: 'Status', key: 'status', formatter: (v) => v === 'active' ? successBold('Active') : warningBold('Inactive') }
    ]);
    
    console.log(toolTable);
    console.log();
    printInfo(`Total tools: ${filteredTools.length}`);
    
    // List categories if no filter is applied
    if (!options.category) {
      const categories = [...new Set(tools.map(tool => tool.category))];
      console.log('\nCategories:');
      categories.forEach(category => {
        console.log(`- ${category} (${tools.filter(t => t.category === category).length} tools)`);
      });
    }
    
  } catch (error) {
    printError(`Failed to list MCP tools: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper functions

function registerBuiltInTools(): void {
  if (!mcpServer) return;
  
  // Memory tools
  mcpServer.tools.set('memory.store', {
    name: 'memory.store',
    description: 'Store data in memory',
    type: 'function',
    category: 'Memory',
    status: 'active',
    handler: async (data: any) => {
      try {
        const memoryManager = await getMemoryManager();
        await memoryManager.store(data);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  
  mcpServer.tools.set('memory.retrieve', {
    name: 'memory.retrieve',
    description: 'Retrieve data from memory',
    type: 'function',
    category: 'Memory',
    status: 'active',
    handler: async (id: string) => {
      try {
        const memoryManager = await getMemoryManager();
        const result = await memoryManager.retrieve(id);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  
  mcpServer.tools.set('memory.query', {
    name: 'memory.query',
    description: 'Query memory with filters',
    type: 'function',
    category: 'Memory',
    status: 'active',
    handler: async (query: any) => {
      try {
        const memoryManager = await getMemoryManager();
        const results = await memoryManager.query(query);
        return { success: true, data: results };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  
  // File system tools
  mcpServer.tools.set('fs.readFile', {
    name: 'fs.readFile',
    description: 'Read file from the file system',
    type: 'function',
    category: 'FileSystem',
    status: 'active',
    handler: async (filePath: string) => {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return { success: true, content };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  
  mcpServer.tools.set('fs.writeFile', {
    name: 'fs.writeFile',
    description: 'Write file to the file system',
    type: 'function',
    category: 'FileSystem',
    status: 'active',
    handler: async ({ filePath, content }: { filePath: string, content: string }) => {
      try {
        await fs.writeFile(filePath, content);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  
  mcpServer.tools.set('fs.listDir', {
    name: 'fs.listDir',
    description: 'List directory contents',
    type: 'function',
    category: 'FileSystem',
    status: 'active',
    handler: async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const result = entries.map(entry => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile()
        }));
        return { success: true, entries: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  
  // Utility tools
  mcpServer.tools.set('util.echo', {
    name: 'util.echo',
    description: 'Echo back the input',
    type: 'utility',
    category: 'Utility',
    status: 'active',
    handler: async (data: any) => {
      return { success: true, data };
    }
  });
  
  mcpServer.tools.set('util.timestamp', {
    name: 'util.timestamp',
    description: 'Get current timestamp',
    type: 'utility',
    category: 'Utility',
    status: 'active',
    handler: async () => {
      return {
        success: true,
        timestamp: Date.now(),
        iso: new Date().toISOString()
      };
    }
  });
  
  // Log tools
  mcpServer.tools.set('log.info', {
    name: 'log.info',
    description: 'Log informational message',
    type: 'function',
    category: 'Logging',
    status: 'active',
    handler: async (message: string) => {
      mcpServer?.logger.info(message);
      return { success: true };
    }
  });
  
  mcpServer.tools.set('log.error', {
    name: 'log.error',
    description: 'Log error message',
    type: 'function',
    category: 'Logging',
    status: 'active',
    handler: async (message: string) => {
      mcpServer?.logger.error(message);
      return { success: true };
    }
  });
}

async function setupApiRoutes(): Promise<void> {
  if (!mcpServer) return;
  
  const { app } = mcpServer;
  
  // Serve static files for the web console
  const currentDir = path.dirname(new URL(import.meta.url).pathname);
  const consoleDir = path.join(currentDir, '../../../ui/console');
  const { default: express } = await import('express');
  app.use('/console', express.static(consoleDir));
  
  // Web console route
  app.get('/', (req: any, res: any) => {
    res.redirect('/console');
  });
  
  app.get('/console', (req: any, res: any) => {
    res.sendFile(path.join(consoleDir, 'index.html'));
  });
  
  // Health endpoint
  app.get('/health', (req: any, res: any) => {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });
  
  // API routes
  app.get('/api', (req: any, res: any) => {
    res.json({
      name: 'MCP API',
      version: '1.0.0',
      endpoints: [
        '/api/tools',
        '/api/memory',
        '/api/exec/:toolName'
      ]
    });
  });
  
  // List tools
  app.get('/api/tools', (req: any, res: any) => {
    const tools = Array.from(mcpServer!.tools.values());
    res.json(tools);
  });
  
  // Get tool by name
  app.get('/api/tools/:name', (req: any, res: any) => {
    const { name } = req.params;
    const tool = mcpServer!.tools.get(name);
    
    if (!tool) {
      return res.status(404).tson({ error: `Tool not found: ${name}` });
    }
    
    res.json(tool);
  });
  
  // Execute tool
  app.post('/api/exec/:toolName', async (req: any, res: any) => {
    try {
      const { toolName } = req.params;
      const tool = mcpServer!.tools.get(toolName);
      
      if (!tool) {
        return res.status(404).tson({ error: `Tool not found: ${toolName}` });
      }
      
      if (!tool.handler || tool.status !== 'active') {
        return res.status(400).tson({ error: `Tool not available: ${toolName}` });
      }
      
      const result = await tool.handler(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).tson({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Memory routes
  app.get('/api/memory', async (req: any, res: any) => {
    try {
      const memoryManager = await getMemoryManager();
      const query = req.query;
      const results = await memoryManager.query(query);
      
      res.json(results);
    } catch (error) {
      res.status(500).tson({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.get('/api/memory/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const memoryManager = await getMemoryManager();
      const result = await memoryManager.retrieve(id);
      
      if (!result) {
        return res.status(404).tson({ error: `Memory entry not found: ${id}` });
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).tson({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  app.post('/api/memory', async (req: any, res: any) => {
    try {
      const memoryManager = await getMemoryManager();
      await memoryManager.store(req.body);
      
      res.json({ success: true, id: req.body.id });
    } catch (error) {
      res.status(500).tson({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Static files
  app.get('/', (req: any, res: any) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Claude Flow MCP Server</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            line-height: 1.5;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #4a6cf7;
          }
          .tools {
            margin-top: 20px;
          }
          .tool {
            margin-bottom: 10px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .tool h3 {
            margin-top: 0;
          }
          .tool .type {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            background-color: #f0f0f0;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <h1>Claude Flow MCP Server</h1>
        <p>Master Control Program server is running.</p>
        
        <h2>API Endpoints</h2>
        <ul>
          <li><code>/api/tools</code> - List all available tools</li>
          <li><code>/api/tools/:name</code> - Get tool details</li>
          <li><code>/api/exec/:toolName</code> - Execute a tool (POST)</li>
          <li><code>/api/memory</code> - Query memory entries</li>
          <li><code>/api/memory/:id</code> - Get memory entry by ID</li>
          <li><code>/health</code> - Server health check</li>
        </ul>
        
        <h2>Available Tools</h2>
        <div class="tools">
          ${Array.from(mcpServer!.tools.values()).map(tool => `
            <div class="tool">
              <h3>${tool.name}</h3>
              <span class="type">${tool.type}</span>
              <span class="category">${tool.category}</span>
              <p>${tool.description}</p>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `);
  });
}

function setupSocketEvents(): void {
  if (!mcpServer) return;
  
  const { io } = mcpServer;
  
  io.on('connection', (socket: any) => {
    mcpServer?.logger.info(`Client connected: ${socket.id}`);
    
    // Register event handlers
    socket.on('tool:exec', async (data: any) => {
      try {
        const { name, params } = data;
        const tool = mcpServer?.tools.get(name);
        
        if (!tool || !tool.handler || tool.status !== 'active') {
          socket.emit('tool:result', {
            id: data.id,
            success: false,
            error: `Tool not available: ${name}`
          });
          return;
        }
        
        const result = await tool.handler(params);
        socket.emit('tool:result', {
          id: data.id,
          success: true,
          result
        });
      } catch (error) {
        socket.emit('tool:result', {
          id: data.id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    socket.on('disconnect', () => {
      mcpServer?.logger.info(`Client disconnected: ${socket.id}`);
    });
  });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${remainingSeconds}s`);
  
  return parts.join(' ');
}

/**
 * Start MCP server in serve mode for Claude Code integration
 */
async function serveMcpServer(context: CLIContext): Promise<void> {
  const { options } = context;
  const port = options.port || 3000;
  const transport = options.transport || 'stdio';
  const logLevel = options.logLevel || 'info';
  const verbose = options.verbose || false;
  const minimal = options.minimal || false;
  
  try {
    if (mcpServer?.isRunning) {
      if (verbose) {
        printInfo(`MCP server already running on ${mcpServer.host}:${mcpServer.port}`);
      }
      return;
    }

    if (verbose) {
      printInfo(`🚀 Starting MCP server in serve mode (${transport})...`);
      printInfo(`Port: ${port}, Log Level: ${logLevel}, Minimal: ${minimal}`);
    }

    // Create logger with specified log level
    const logger = new Logger(
      { level: logLevel as any, format: 'json', destination: 'console' },
      { component: 'MCP-Server' }
    );
    
    if (transport === 'stdio') {
      // STDIO transport for Claude Code integration
      if (verbose) {
        printInfo('📡 Using STDIO transport for Claude Code integration');
        printInfo('🔧 Initializing orchestration components...');
      }
      
      // Initialize core components for full orchestration
      const { EventBus } = await import('../../../core/event-bus.ts');
      const { TerminalManager } = await import('../../../terminal/manager.ts');
      const { MemoryManager } = await import('../../../memory/manager.ts');
      const { CoordinationManager } = await import('../../../coordination/manager.ts');
      const { SwarmCoordinator } = await import('../../../swarm/coordinator.ts');
      const { AgentProcessManager } = await import('../../../agents/agent-process-manager.ts');
      const { Orchestrator } = await import('../../../core/orchestrator.ts');
      const { MCPServer } = await import('../../../mcp/server.ts');
      const { configManager } = await import('../../../core/config.ts');
      
      const eventBus = EventBus.getInstance();
      const config = configManager.get();
      
      // Initialize all orchestration components
      if (verbose) {
        printInfo('🔧 Initializing terminal manager...');
      }
      // FIXED: Ensure terminal type is explicitly set to native
      const terminalConfig = {
        // Start with config defaults
        ...(config.terminal || {}),
        // Override critical settings to avoid VSCode detection issues
        type: 'native' as const,
        poolSize: (config.terminal?.poolSize) || 5,
        recycleAfter: (config.terminal?.recycleAfter) || 10,
        healthCheckInterval: (config.terminal?.healthCheckInterval) || 60000,
        commandTimeout: (config.terminal?.commandTimeout) || 300000
      };
      
      const terminalManager = new TerminalManager(
        terminalConfig,
        eventBus,
        logger
      );
      await terminalManager.initialize();
      
      if (verbose) {
        printInfo('🧠 Initializing memory manager...');
      }
             const memoryManager = new MemoryManager(
         { 
           ...(config.memory || {}),
           backend: 'markdown', // Use markdown backend to avoid SQLite issues
           markdownDir: './memory'
         },
         eventBus,
         logger
       );
      await memoryManager.initialize();
      
      if (verbose) {
        printInfo('⚡ Initializing coordination manager...');
      }
             const coordinationManager = new CoordinationManager(
         {
           coordination: {
             ...(config.coordination || {}),
             maxConcurrentTasks: 10,
             defaultTimeout: 30000,
             enableWorkStealing: true,
             enableCircuitBreaker: true,
             retryAttempts: 3,
             schedulingStrategy: 'capability',
             maxRetries: 3,
             retryDelay: 1000,
             resourceTimeout: 30000
           },
           workStealing: {
             enabled: true,
             stealThreshold: 3,
             maxStealBatch: 2,
             stealInterval: 10000,
             minTasksToSteal: 1,
           },
           circuitBreaker: {
             failureThreshold: 5,
             successThreshold: 3,
             timeout: 60000,
             halfOpenLimit: 2,
           },
           enableAdvancedFeatures: true,
         },
         eventBus,
         logger
       );
      await coordinationManager.initialize();
      
      if (verbose) {
        printInfo('🤖 Initializing swarm coordinator...');
      }
      const swarmCoordinator = new SwarmCoordinator({
        name: 'FlowX-Swarm',
        maxAgents: 10,
        maxConcurrentTasks: 5
      });
      
      if (verbose) {
        printInfo('👥 Initializing agent manager...');
      }
      const agentManager = new AgentProcessManager(logger);
      
      if (verbose) {
        printInfo('🎯 Initializing main orchestrator...');
      }
      const mcpConfig = {
        transport: 'stdio' as const,
        host: 'localhost',
        port,
        tlsEnabled: false,
        sessionTimeout: 3600000,
        maxSessions: 100,
        enableMetrics: !minimal,
        corsEnabled: false,
        corsOrigins: [],
        auth: {
          enabled: false,
          method: 'token' as const,
        },
      };
      
      // Create MCP server with ALL orchestration components wired in
      const server = new MCPServer(
        mcpConfig,
        eventBus,
        logger,
        // THIS IS THE FIX: Wire in all the orchestration components
        null, // orchestrator - will be initialized below
        swarmCoordinator,
        agentManager,
        coordinationManager, // resourceManager
        eventBus, // messageBus
        null, // monitor - can be added later
      );
      
      // Create orchestrator with all components
      const orchestrator = new Orchestrator(
        config,
        terminalManager,
        memoryManager,
        coordinationManager,
        server,
        eventBus,
        logger
      );
      await orchestrator.initialize();
      
      // Update server with orchestrator reference
      (server as any).orchestrator = orchestrator;
      
      // Register server for cleanup
      mcpServer = {
        app: null,
        server: server as any,
        io: null,
        tools: new Map(),
        isRunning: false,
        port,
        host: 'localhost',
        logger
      };
      
      // Start MCP server (this sets up request handlers and registers tools)
      await server.start();
      mcpServer.isRunning = true;
      
      if (verbose) {
        printSuccess('✅ MCP server started in STDIO mode with full orchestration');
        printInfo('🔗 Ready for Claude Code integration');
        printSuccess('🎯 Orchestrator components initialized');
        printSuccess('🤖 Swarm coordination enabled');
        printSuccess('👥 Agent management ready');
        printSuccess('🧠 Memory system active');
        printSuccess('⚡ Task coordination online');
      }
      
      // Handle process termination gracefully
      process.on('SIGINT', async () => {
        if (verbose) {
          logger.info('Shutting down MCP server with orchestration...');
        }
        if (mcpServer?.isRunning) {
          await orchestrator.shutdown();
          await (server as any).stop();
          await coordinationManager.shutdown();
          await memoryManager.shutdown();
          await terminalManager.shutdown();
          mcpServer.isRunning = false;
        }
        process.exit(0);
      });
      
      // Keep the process alive
      return new Promise(() => {
        // This promise never resolves, keeping the process running
      });
      
    } else {
      // HTTP transport
      if (verbose) {
        printInfo(`📡 Using HTTP transport on ${port}`);
      }
      
      // For HTTP, use the existing Express-based implementation
      return await startMcpServer(context);
    }
  } catch (error) {
    printError(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
 
 export default mcpCommand;