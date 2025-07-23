/**
 * UI Command
 * Launch and manage the web console interface
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import express, { Express, Request, Response } from 'express';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface UIServerConfig {
  port: number;
  host: string;
  enableAuth: boolean;
  authToken?: string;
  enableHTTPS: boolean;
  sslCert?: string;
  sslKey?: string;
  staticPath: string;
  maxConnections: number;
  enableCORS: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;
  clientInfo: {
    userAgent?: string;
    ip: string;
    sessionId?: string;
    subscriptions?: string[];
  };
}

let uiServer: UIServer | null = null;

export const uiCommand: CLICommand = {
  name: 'ui',
  description: 'Launch and manage the web console interface',
  category: 'System',
  usage: 'flowx ui <subcommand> [OPTIONS]',
  examples: [
    'flowx ui start',
    'flowx ui start --port 8080',
    'flowx ui stop',
    'flowx ui status',
    'flowx ui open --browser'
  ],
  options: [
    {
      name: 'port',
      short: 'p',
      description: 'Server port',
      type: 'number',
      default: 3001
    },
    {
      name: 'host',
      short: 'h',
      description: 'Server host',
      type: 'string',
      default: 'localhost'
    },
    {
      name: 'auth',
      short: 'a',
      description: 'Enable authentication',
      type: 'boolean'
    },
    {
      name: 'token',
      short: 't',
      description: 'Authentication token',
      type: 'string'
    },
    {
      name: 'browser',
      short: 'b',
      description: 'Open in browser',
      type: 'boolean'
    },
    {
      name: 'daemon',
      short: 'd',
      description: 'Run as daemon',
      type: 'boolean'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose logging',
      type: 'boolean'
    }
  ],
  subcommands: [
    {
      name: 'start',
      description: 'Start the web console server',
      handler: async (context: CLIContext) => await startUIServer(context)
    },
    {
      name: 'stop',
      description: 'Stop the web console server',
      handler: async (context: CLIContext) => await stopUIServer(context)
    },
    {
      name: 'restart',
      description: 'Restart the web console server',
      handler: async (context: CLIContext) => await restartUIServer(context)
    },
    {
      name: 'status',
      description: 'Show server status',
      handler: async (context: CLIContext) => await showUIStatus(context)
    },
    {
      name: 'open',
      description: 'Open console in browser',
      handler: async (context: CLIContext) => await openInBrowser(context)
    },
    {
      name: 'connections',
      description: 'List active connections',
      handler: async (context: CLIContext) => await listConnections(context)
    },
    {
      name: 'logs',
      description: 'Show server logs',
      handler: async (context: CLIContext) => await showServerLogs(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { args } = context;
    
    if (args.length === 0) {
      await showUIStatus(context);
      return;
    }
    
    printError('Invalid subcommand. Use "flowx ui --help" for usage information.');
  }
};

class UIServer {
  private app!: express.Application;
  private server!: http.Server;
  private wss!: WebSocketServer;
  private config: UIServerConfig;
  private connections = new Map<string, WebSocketConnection>();
  private isRunning = false;
  private startTime?: Date;
  private logs: string[] = [];
  private maxLogs = 1000;

  constructor(config: Partial<UIServerConfig>) {
    this.config = {
      port: 3001,
      host: 'localhost',
      enableAuth: false,
      enableHTTPS: false,
      staticPath: this.getStaticPath(),
      maxConnections: 100,
      enableCORS: true,
      logLevel: 'info',
      ...config
    };

    this.setupExpress();
    this.setupWebSocket();
  }

  private getStaticPath(): string {
    // Get the path to the UI console files
    const currentDir = process.cwd();
    return path.join(currentDir, 'src', 'ui', 'console');
  }

  private setupExpress(): void {
    this.app = express();

    // Middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    if (this.config.enableCORS) {
      this.app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        next();
      });
    }

    // Static files with proper MIME types
    this.app.use(express.static(this.config.staticPath, {
      setHeaders: (res, filePath) => {
        // Set correct MIME type for JavaScript modules
        if (filePath.endsWith('.ts')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.ts')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
      }
    }));

    // API routes
    this.setupAPIRoutes();

    // Fallback to index.html for SPA
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(this.config.staticPath, 'index.html'));
    });
  }

  private setupAPIRoutes(): void {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: this.getUptime(),
        connections: this.connections.size,
        version: '1.0.0'
      });
    });

    // Server status
    this.app.get('/api/status', (req, res) => {
      res.json({
        running: this.isRunning,
        startTime: this.startTime,
        uptime: this.getUptime(),
        connections: this.connections.size,
        config: {
          port: this.config.port,
          host: this.config.host,
          enableAuth: this.config.enableAuth
        }
      });
    });

    // Execute CLI command
    this.app.post('/api/execute', async (req, res) => {
      try {
        const { command } = req.body;
        
        if (!command) {
          return res.status(400).json({ error: 'Command is required' });
        }

        // Execute CLI command
        const result = await this.executeCLICommand(command);
        
        // Broadcast to WebSocket clients
        this.broadcastToClients({
          type: 'command_result',
          command,
          result
        });

        res.json({ success: true, result });
        return;
      } catch (error) {
        return res.status(500).json({ 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    // Get connections
    this.app.get('/api/connections', (req, res) => {
      const connectionList = Array.from(this.connections.values()).map(conn => ({
        id: conn.id,
        authenticated: conn.authenticated,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity,
        clientInfo: conn.clientInfo
      }));

      res.json({ connections: connectionList });
    });
  }

  private setupWebSocket(): void {
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleNewConnection(ws, req);
    });
  }

  private handleNewConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const clientIP = req.socket.remoteAddress || 'unknown';
    
    const connection: WebSocketConnection = {
      id: connectionId,
      ws,
      authenticated: !this.config.enableAuth, // Auto-auth if auth disabled
      connectedAt: new Date(),
      lastActivity: new Date(),
      clientInfo: {
        userAgent: req.headers['user-agent'],
        ip: clientIP
      }
    };

    this.connections.set(connectionId, connection);
    this.log(`New WebSocket connection: ${connectionId} from ${clientIP}`);

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'welcome',
      connectionId,
      serverTime: new Date(),
      authenticated: connection.authenticated
    });

    // Handle messages
    ws.on('message', (data) => {
      this.handleWebSocketMessage(connectionId, data);
    });

    // Handle disconnect
    ws.on('close', (code, reason) => {
      this.log(`WebSocket connection closed: ${connectionId} (${code}: ${reason})`);
      this.connections.delete(connectionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      this.log(`WebSocket error for ${connectionId}: ${error.message}`, 'error');
    });

    // Limit connections
    if (this.connections.size > this.config.maxConnections) {
      ws.close(1008, 'Too many connections');
      this.connections.delete(connectionId);
    }
  }

  private handleWebSocketMessage(connectionId: string, data: any): void {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      connection.lastActivity = new Date();

      const message = JSON.parse(data.toString());
      this.log(`Received message from ${connectionId}: ${message.type}`);

      switch (message.type) {
        case 'authenticate':
          this.handleAuthentication(connectionId, message);
          break;

        case 'execute_command':
          this.handleCommandExecution(connectionId, message);
          break;

        case 'ping':
          this.sendToConnection(connectionId, { type: 'pong', timestamp: new Date() });
          break;

        case 'subscribe':
          this.handleSubscription(connectionId, message);
          break;

        default:
          this.log(`Unknown message type: ${message.type}`, 'warn');
      }
    } catch (error) {
      this.log(`Error handling WebSocket message: ${error}`, 'error');
    }
  }

  private async handleCommandExecution(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.authenticated) {
      this.sendToConnection(connectionId, {
        type: 'error',
        message: 'Not authenticated'
      });
      return;
    }

    try {
      const { command, id } = message;
      this.log(`Executing command: ${command}`);

      // Execute CLI command
      const result = await this.executeCLICommand(command);

      // Send result back
      this.sendToConnection(connectionId, {
        type: 'command_result',
        id,
        command,
        result,
        timestamp: new Date()
      });

    } catch (error) {
      this.sendToConnection(connectionId, {
        type: 'command_error',
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
    }
  }

  private handleAuthentication(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (!this.config.enableAuth) {
      connection.authenticated = true;
      this.sendToConnection(connectionId, {
        type: 'auth_success',
        message: 'Authentication not required'
      });
      return;
    }

    const { token } = message;
    if (token === this.config.authToken) {
      connection.authenticated = true;
      this.sendToConnection(connectionId, {
        type: 'auth_success',
        message: 'Authentication successful'
      });
    } else {
      this.sendToConnection(connectionId, {
        type: 'auth_failed',
        message: 'Invalid token'
      });
    }
  }

  private handleSubscription(connectionId: string, message: any): void {
    // Handle event subscriptions (status updates, logs, etc.)
    const { events } = message;
    this.log(`Client ${connectionId} subscribed to: ${events.join(', ')}`);
    
    // Store subscription preferences in connection metadata
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.clientInfo.subscriptions = events;
    }
  }

  private async executeCLICommand(command: string): Promise<any> {
    try {
      // Execute the CLI command using the actual CLI
      const cliPath = path.join(process.cwd(), 'cli.ts');
      const fullCommand = `node ${cliPath} ${command}`;
      
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        timestamp: new Date()
      };
    }
  }

  private sendToConnection(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  private broadcastToClients(message: any): void {
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN && connection.authenticated) {
        connection.ws.send(JSON.stringify(message));
      }
    }
  }

  private generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private getUptime(): number {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0;
  }

  private log(message: string, level: 'debug' | 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console based on level
    if (this.shouldLog(level)) {
      console.log(logEntry);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    // Verify static files exist
    try {
      await fs.access(this.config.staticPath);
      await fs.access(path.join(this.config.staticPath, 'index.html'));
    } catch (error) {
      throw new Error(`UI static files not found at ${this.config.staticPath}`);
    }

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        this.startTime = new Date();
        this.log(`UI Server started on http://${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        this.log(`Server error: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Close all WebSocket connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();

    // Close server
    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        this.log('UI Server stopped');
        resolve();
      });
    });
  }

  getStatus(): any {
    return {
      running: this.isRunning,
      startTime: this.startTime,
      uptime: this.getUptime(),
      connections: this.connections.size,
      config: this.config,
      logs: this.logs.slice(-10) // Last 10 log entries
    };
  }

  getConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}

// Subcommand handlers

async function startUIServer(context: CLIContext): Promise<void> {
  console.log('🔥 DEBUG: startUIServer called!');
  const { options } = context;
  console.log('🔥 DEBUG: options.daemon =', options.daemon);
  console.log('🔥 DEBUG: options =', JSON.stringify(options, null, 2));

  if (uiServer && uiServer.getStatus().running) {
    printWarning('UI server is already running');
    await showUIStatus(context);
    return;
  }

  try {
    // Handle daemon mode FIRST - before starting in-process server
    if (options.daemon) {
      printInfo('Starting UI server in daemon mode...');
      
      // Create a detached daemon process
      const { spawn } = await import('node:child_process');
      const path = await import('node:path');
      const fs = await import('node:fs/promises');
      
      // Create daemon script content
      const daemonScript = `
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class UIServer {
  constructor(config) {
    this.config = {
      port: 3001,
      host: 'localhost',
      enableAuth: false,
      enableHTTPS: false,
      staticPath: path.join(__dirname, '../src/ui/console'),
      maxConnections: 100,
      enableCORS: true,
      logLevel: 'info',
      ...config
    };
    this.connections = new Map();
    this.isRunning = false;
    this.logs = [];
    this.maxLogs = 1000;
  }

  async start() {
    if (this.isRunning) return;
    
    this.app = express();
    this.setupExpress();
    this.setupAPIRoutes();
    
    this.server = http.createServer(this.app);
    this.setupWebSocket();
    
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        this.startTime = new Date();
        this.log(\`UI Server started on http://\${this.config.host}:\${this.config.port}\`);
        resolve();
      });
      
      this.server.on('error', reject);
    });
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Close WebSocket connections
    if (this.wss) {
      this.wss.close();
    }
    
    // Close HTTP server
    if (this.server) {
      this.server.close();
    }
    
    this.log('UI Server stopped');
  }

  setupExpress() {
    if (this.config.enableCORS) {
      this.app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }
    
    this.app.use(express.json());
    this.app.use(express.static(this.config.staticPath));
  }

  setupAPIRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', uptime: this.getUptime() });
    });
    
    this.app.get('/console', (req, res) => {
      res.sendFile(path.join(this.config.staticPath, 'index.html'));
    });
  }

  setupWebSocket() {
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });
    
    this.wss.on('connection', (ws, req) => {
      const connectionId = this.generateConnectionId();
      const connection = {
        id: connectionId,
        ws: ws,
        authenticated: !this.config.enableAuth,
        connectedAt: new Date(),
        lastActivity: new Date(),
        clientInfo: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      };
      
      this.connections.set(connectionId, connection);
      this.log(\`New WebSocket connection: \${connectionId}\`);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        connectionId: connectionId,
        serverTime: new Date().toISOString(),
        authenticated: connection.authenticated
      }));
      
      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(connectionId, message);
        } catch (error) {
          this.log(\`Invalid WebSocket message from \${connectionId}: \${error.message}\`, 'error');
        }
      });
      
      ws.on('close', () => {
        this.connections.delete(connectionId);
        this.log(\`WebSocket connection closed: \${connectionId}\`);
      });
      
      ws.on('error', (error) => {
        this.log(\`WebSocket error for \${connectionId}: \${error.message}\`, 'error');
      });
    });
  }
  
  handleWebSocketMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.lastActivity = new Date();
    
    // Echo message back for now (can be extended for actual command handling)
    connection.ws.send(JSON.stringify({
      type: 'response',
      id: message.id || Date.now(),
      result: { received: message, timestamp: new Date().toISOString() }
    }));
  }

  generateConnectionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  getUptime() {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = \`[\${timestamp}] \${level.toUpperCase()}: \${message}\`;
    
    console.log(logEntry);
    
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }
}

// Create and start the server
const server = new UIServer({
  port: ${options.port || 3001},
  host: '${options.host || 'localhost'}',
  enableCORS: ${options.enableCors || true}
});

server.start().then(() => {
  console.log('UI server started successfully in daemon mode');
  
  // Write PID file
  fs.writeFile('.flowx/ui-daemon.pid', process.pid.toString());
  
  // Keep process alive
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
  
}).catch(error => {
  console.error('Failed to start UI server daemon:', error);
  process.exit(1);
});
`;

      // Ensure .flowx directory exists
      await fs.mkdir('.flowx', { recursive: true });
      
      // Write daemon script
      const daemonPath = '.flowx/ui-daemon.js';
      await fs.writeFile(daemonPath, daemonScript);
      
      // Spawn detached daemon process
      const daemon = spawn('node', [daemonPath], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd()
      });
      
      // Write PID file
      await fs.writeFile('.flowx/ui-daemon.pid', daemon.pid?.toString() || '');
      
      // Set up log files
      const logFile = await fs.open('.flowx/ui-daemon.log', 'a');
      const errorFile = await fs.open('.flowx/ui-daemon.error.log', 'a');
      
      daemon.stdout?.pipe(logFile.createWriteStream());
      daemon.stderr?.pipe(errorFile.createWriteStream());
      
      // Detach from parent process
      daemon.unref();
      
      printSuccess(`✅ UI server daemon started with PID ${daemon.pid}`);
      printInfo(`📊 Web console available at: http://${options.host || 'localhost'}:${options.port || 3001}/console`);
      printInfo(`📝 Logs: .flowx/ui-daemon.log`);
      printInfo(`🛑 Stop with: flowx ui stop`);
      
      // Exit the CLI process immediately - daemon is now independent
      return;
    } else {
      // Non-daemon mode - start in-process server
      const config: Partial<UIServerConfig> = {
        port: options.port || 3001,
        host: options.host || 'localhost',
        enableAuth: options.auth || false,
        authToken: options.token,
        logLevel: options.verbose ? 'debug' : 'info'
      };

      uiServer = new UIServer(config);
      
      printInfo('Starting UI server...');
      await uiServer.start();
      
      const url = `http://${config.host}:${config.port}`;
      printSuccess(`✅ UI server started successfully!`);
      printInfo(`🌐 Web console available at: ${url}`);
      printInfo(`🔗 WebSocket endpoint: ws://${config.host}:${config.port}/ws`);
      
      if (config.enableAuth) {
        printInfo(`🔐 Authentication enabled with token: ${config.authToken}`);
      }

      // Open in browser if requested
      if (options.browser) {
        await openBrowser(url);
      }
    }

  } catch (error) {
    printError(`Failed to start UI server: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function stopUIServer(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const fs = await import('node:fs/promises');
    
    // Check for daemon mode first
    const pidFile = '.flowx/ui-daemon.pid';
    try {
      const pidData = await fs.readFile(pidFile, 'utf8');
      const pid = parseInt(pidData.trim());
      
      printInfo(`Stopping UI daemon (PID: ${pid})...`);
      
      // Check if process exists
      try {
        process.kill(pid, 0);
      } catch (error) {
        printWarning('UI daemon process not found - may already be stopped');
        await fs.unlink(pidFile).catch(() => {});
        return;
      }
      
      // Send termination signal
      if (options.force) {
        process.kill(pid, 'SIGKILL');
      } else {
        process.kill(pid, 'SIGTERM');
        
        // Wait for graceful shutdown
        const timeout = (options.timeout || 10) * 1000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          try {
            process.kill(pid, 0);
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch {
            // Process has exited
            break;
          }
        }
        
        // Force kill if still running
        try {
          process.kill(pid, 0);
          printWarning('Graceful shutdown timed out, force killing...');
          process.kill(pid, 'SIGKILL');
        } catch {
          // Process already exited
        }
      }
      
      // Clean up PID file
      await fs.unlink(pidFile).catch(() => {});
      
      printSuccess('✅ UI daemon stopped successfully');
      return;
      
    } catch (error) {
      // No daemon running, check in-process server
      if (!uiServer || !uiServer.getStatus().running) {
        printWarning('UI server is not running');
        return;
      }

      printInfo('Stopping UI server...');
      await uiServer.stop();
      printSuccess('✅ UI server stopped successfully');
      uiServer = null;
    }
    
  } catch (error) {
    printError(`Failed to stop UI server: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function restartUIServer(context: CLIContext): Promise<void> {
  printInfo('Restarting UI server...');
  
  if (uiServer && uiServer.getStatus().running) {
    await stopUIServer(context);
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  await startUIServer(context);
}

async function showUIStatus(context: CLIContext): Promise<void> {
  printInfo('🖥️  UI Server Status');
  console.log('─'.repeat(50));

  try {
    const fs = await import('node:fs/promises');
    
    // Check for daemon mode first
    const pidFile = '.flowx/ui-daemon.pid';
    try {
      const pidData = await fs.readFile(pidFile, 'utf8');
      const pid = parseInt(pidData.trim());
      
      // Check if process is running
      try {
        process.kill(pid, 0);
        printSuccess(`✅ UI daemon is running (PID: ${pid})`);
        
        const statusData = [
          { label: 'Mode', value: '🔄 Daemon' },
          { label: 'PID', value: pid },
          { label: 'Host', value: 'localhost' },
          { label: 'Port', value: '3001' },
          { label: 'Logs', value: '.flowx/ui-daemon.log' },
          { label: 'Error Logs', value: '.flowx/ui-daemon.error.log' }
        ];

        statusData.forEach(({ label, value }) => {
          console.log(`${label.padEnd(15)}: ${value}`);
        });
        
        // Try to get server info
        const http = await import('node:http');
        const options = {
          hostname: 'localhost',
          port: 3001,
          path: '/health',
          method: 'GET',
          timeout: 2000,
        };
        
        const req = http.request(options, (res) => {
          if (res.statusCode === 200) {
            console.log();
            printInfo('📊 Web console: http://localhost:3001/console');
            printInfo('🔗 WebSocket: ws://localhost:3001/ws');
          }
        });
        
        req.on('error', () => {
          console.log();
          printWarning('UI daemon process running but not responding to HTTP requests');
        });
        
        req.end();
        
      } catch (error) {
        printWarning(`UI daemon PID file exists but process is not running (PID: ${pid})`);
        await fs.unlink(pidFile).catch(() => {});
      }
      
    } catch (error) {
      // No daemon running, check in-process server
      if (!uiServer) {
        printWarning('UI server is not running');
        printInfo('Use "flowx ui start" to start the server');
        return;
      }

      const status = uiServer.getStatus();
      
      const statusData = [
        { label: 'Mode', value: '🔄 In-Process' },
        { label: 'Status', value: status.running ? '🟢 Running' : '🔴 Stopped' },
        { label: 'Host', value: status.config.host },
        { label: 'Port', value: status.config.port },
        { label: 'Started', value: status.startTime ? status.startTime.toLocaleString() : 'N/A' },
        { label: 'Uptime', value: status.running ? formatUptime(status.uptime) : 'N/A' },
        { label: 'Connections', value: status.connections },
        { label: 'Authentication', value: status.config.enableAuth ? '🔐 Enabled' : '🔓 Disabled' },
        { label: 'Static Path', value: status.config.staticPath }
      ];

      statusData.forEach(({ label, value }) => {
        console.log(`${label.padEnd(15)}: ${value}`);
      });

      if (status.running) {
        const url = `http://${status.config.host}:${status.config.port}`;
        console.log();
        printInfo(`🌐 Web console: ${url}`);
        printInfo(`🔗 WebSocket: ws://${status.config.host}:${status.config.port}/ws`);
      }
    }
    
  } catch (error) {
    printError(`Failed to check UI server status: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log();
}

async function openInBrowser(context: CLIContext): Promise<void> {
  const { options } = context;

  if (!uiServer || !uiServer.getStatus().running) {
    printError('UI server is not running. Start it first with "flowx ui start"');
    return;
  }

  const status = uiServer.getStatus();
  const url = `http://${status.config.host}:${status.config.port}`;
  
  await openBrowser(url);
}

async function listConnections(context: CLIContext): Promise<void> {
  if (!uiServer) {
    printWarning('UI server is not initialized');
    return;
  }

  const connections = uiServer.getConnections();
  
  if (connections.length === 0) {
    printInfo('No active connections');
    return;
  }

  console.log(successBold('\n🔗 Active WebSocket Connections\n'));

  const tableData = connections.map(conn => ({
    id: conn.id,
    ip: conn.clientInfo.ip,
    authenticated: conn.authenticated ? '✅' : '❌',
    connected: conn.connectedAt.toLocaleTimeString(),
    lastActivity: conn.lastActivity.toLocaleTimeString(),
    userAgent: (conn.clientInfo.userAgent || '').substring(0, 40) + '...'
  }));

  console.log(formatTable(tableData, [
    { header: 'ID', key: 'id' },
    { header: 'IP', key: 'ip' },
    { header: 'Auth', key: 'authenticated' },
    { header: 'Connected', key: 'connected' },
    { header: 'Last Activity', key: 'lastActivity' },
    { header: 'User Agent', key: 'userAgent' }
  ]));

  console.log();
  printSuccess(`Total connections: ${connections.length}`);
}

async function showServerLogs(context: CLIContext): Promise<void> {
  const { options } = context;

  if (!uiServer) {
    printWarning('UI server is not initialized');
    return;
  }

  const logs = uiServer.getLogs();
  const limit = options.limit || 50;
  const recentLogs = logs.slice(-limit);

  console.log(successBold(`\n📋 Server Logs (last ${recentLogs.length})\n`));

  recentLogs.forEach(log => {
    console.log(log);
  });

  if (logs.length > limit) {
    console.log();
    printInfo(`Showing ${limit} of ${logs.length} total log entries`);
  }
}

// Helper functions

async function openBrowser(url: string): Promise<void> {
  try {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin':
        command = `open "${url}"`;
        break;
      case 'win32':
        command = `start "${url}"`;
        break;
      default:
        command = `xdg-open "${url}"`;
    }

    await execAsync(command);
    printSuccess(`🌐 Opened ${url} in browser`);
  } catch (error) {
    printWarning(`Could not open browser automatically. Please visit: ${url}`);
  }
}

function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default uiCommand; 