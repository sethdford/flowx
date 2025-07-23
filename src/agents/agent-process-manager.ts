/**
 * Agent Process Manager
 * Spawns and manages real Node.ts processes for each agent
 */

import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { ILogger } from '../core/logger.js';
import { ClaudeApiClient, createClaudeClient } from './claude-api-client.js';

export interface AgentProcessConfig {
  id: string;
  type: 'backend' | 'frontend' | 'devops' | 'test' | 'security' | 'documentation' | 'general';
  specialization?: string;
  maxMemory?: number; // MB
  maxConcurrentTasks?: number;
  timeout?: number; // ms
  retryAttempts?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  claudeConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AgentProcessInfo {
  id: string;
  pid?: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'crashed';
  type: string;
  startTime?: Date;
  lastActivity?: Date;
  memoryUsage?: number;
  cpuUsage?: number;
  tasksCompleted: number;
  tasksFailed: number;
  restartCount: number;
  config: AgentProcessConfig;
}

export interface AgentMessage {
  id: string;
  type: 'task' | 'command' | 'status' | 'result' | 'error' | 'heartbeat';
  timestamp: Date;
  from?: string;
  to?: string;
  data: Record<string, unknown>;
  correlationId?: string;
}

export interface TaskRequest {
  id: string;
  type: string;
  description: string;
  requirements: Record<string, unknown>;
  files?: Array<{
    path: string;
    content?: string;
    operation: 'read' | 'write' | 'create' | 'delete';
  }>;
  dependencies?: string[];
  timeout?: number;
  priority?: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  files?: Array<{
    path: string;
    content: string;
    operation: string;
  }>;
  duration: number;
  tokensUsed?: number;
}

/**
 * Manages real agent processes with lifecycle management
 */
export class AgentProcessManager extends EventEmitter {
  private logger: ILogger;
  private processes = new Map<string, {
    info: AgentProcessInfo;
    process?: ChildProcess;
    claudeClient?: ClaudeApiClient;
    messageQueue: AgentMessage[];
    pendingTasks: Map<string, {
      request: TaskRequest;
      resolve: (value: TaskResult | PromiseLike<TaskResult>) => void;
      reject: (reason?: Error) => void;
      timeout: NodeJS.Timeout;
    }>;
  }>();

  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private processTemplate: string;

  constructor(logger: ILogger) {
    super();
    this.logger = logger;
    this.processTemplate = this.generateAgentProcessTemplate();
    
    this.setupCleanupHandlers();
    
    // Only start heartbeat monitoring if not in test environment
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      this.startHeartbeatMonitoring();
    }
  }

  /**
   * Create and start a new agent process
   */
  async createAgent(config: AgentProcessConfig): Promise<string> {
    if (this.processes.has(config.id)) {
      throw new Error(`Agent with ID ${config.id} already exists`);
    }

    const agentInfo: AgentProcessInfo = {
      id: config.id,
      status: 'starting',
      type: config.type,
      tasksCompleted: 0,
      tasksFailed: 0,
      restartCount: 0,
      config
    };

    const agentData = {
      info: agentInfo,
      process: undefined as ChildProcess | undefined,
      messageQueue: [] as AgentMessage[],
      pendingTasks: new Map<string, {
        request: TaskRequest;
        resolve: (value: TaskResult | PromiseLike<TaskResult>) => void;
        reject: (reason?: Error) => void;
        timeout: NodeJS.Timeout;
      }>(),
      claudeClient: undefined as ClaudeApiClient | undefined
    };

    this.processes.set(config.id, agentData);

    try {
      // Create working directory
      const workDir = config.workingDirectory || join(process.cwd(), 'agents', config.id);
      await mkdir(workDir, { recursive: true });

      // Create agent script file with better error handling
      try {
        const agentScript = this.generateAgentScript();
        const scriptPath = join(workDir, 'agent.ts');
        await writeFile(scriptPath, agentScript);
        this.logger.info('Agent script created successfully', { scriptPath });
      } catch (writeError) {
        this.logger.error('Failed to create agent script', { workDir, error: writeError });
        throw new Error(`Failed to create agent script: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
      }

      // Create Claude client for this agent
      try {
        const claudeClient = createClaudeClient(this.logger, config.claudeConfig);
        agentData.claudeClient = claudeClient;
        this.logger.info('Claude client created successfully');
      } catch (clientError) {
        this.logger.error('Failed to create Claude client', { error: clientError });
        // Continue without Claude client - will use fallback
      }

      // Spawn the process (use relative path since we set cwd)
      const childProcess = this.spawnAgentProcess(config, 'agent.ts', workDir);
      agentData.process = childProcess;

      agentInfo.pid = childProcess.pid;
      agentInfo.startTime = new Date();
      agentInfo.status = 'running';

      this.setupProcessHandlers(config.id, childProcess);

      this.logger.info('Agent process started', {
        agentId: config.id,
        pid: childProcess.pid,
        workDir
      });

      this.emit('agent:started', { agentId: config.id, pid: childProcess.pid });
      return config.id;

    } catch (error) {
      agentInfo.status = 'error';
      this.logger.error('Failed to create agent process', { agentId: config.id, error });
      this.emit('agent:error', { agentId: config.id, error });
      throw error;
    }
  }

  /**
   * Stop an agent process gracefully
   */
  async stopAgent(agentId: string, force = false): Promise<void> {
    const agentData = this.processes.get(agentId);
    if (!agentData) {
      throw new Error(`Agent ${agentId} not found`);
    }

    this.logger.info('Stopping agent process', { agentId, force });

    agentData.info.status = 'stopping';

    if (agentData.process) {
      // Cancel pending tasks
      for (const [, pending] of agentData.pendingTasks) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Agent stopping'));
        agentData.pendingTasks.delete(pending.request.id);
      }

      // Send shutdown signal
      if (!force) {
        await this.sendMessage(agentId, {
          id: `shutdown-${Date.now()}`,
          type: 'command',
          timestamp: new Date(),
          data: { command: 'shutdown' }
        });

        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Force kill if still running
      if (!agentData.process.killed) {
        agentData.process.kill(force ? 'SIGKILL' : 'SIGTERM');
      }
    }

    // Cleanup Claude client
    if (agentData.claudeClient) {
      await agentData.claudeClient.shutdown();
    }

    agentData.info.status = 'stopped';
    this.emit('agent:stopped', { agentId });
  }

  /**
   * Restart an agent process
   */
  async restartAgent(agentId: string): Promise<void> {
    const agentData = this.processes.get(agentId);
    if (!agentData) {
      throw new Error(`Agent ${agentId} not found`);
    }

    this.logger.info('Restarting agent process', { agentId });

    const config = agentData.info.config;
    const currentRestartCount = agentData.info.restartCount;

    // Stop current process
    await this.stopAgent(agentId, true);

    // Remove the old agent data completely
    this.processes.delete(agentId);

    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create new agent with incremented restart count
    const newConfig = { 
      ...config, 
      id: agentId // Ensure we keep the same ID
    };
    
    await this.createAgent(newConfig);
    
    // Update restart count on the new agent
    const newAgentData = this.processes.get(agentId);
    if (newAgentData) {
      newAgentData.info.restartCount = currentRestartCount + 1;
    }
  }

  /**
   * Execute a task on a specific agent
   */
  async executeTask(agentId: string, task: TaskRequest): Promise<TaskResult> {
    const agentData = this.processes.get(agentId);
    if (!agentData) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agentData.info.status !== 'running') {
      throw new Error(`Agent ${agentId} is not running (status: ${agentData.info.status})`);
    }

    this.logger.debug('Executing task on agent', { agentId, taskId: task.id, type: task.type });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        agentData.pendingTasks.delete(task.id);
        agentData.info.tasksFailed++;
        reject(new Error(`Task ${task.id} timed out`));
      }, task.timeout || 300000); // 5 minute default timeout

      agentData.pendingTasks.set(task.id, {
        request: task,
        resolve,
        reject,
        timeout
      });

      // Send task to agent - convert TaskRequest to Record<string, unknown>
      const taskData: Record<string, unknown> = {
        id: task.id,
        type: task.type,
        description: task.description,
        requirements: task.requirements,
        files: task.files,
        dependencies: task.dependencies,
        timeout: task.timeout,
        priority: task.priority
      };

      this.sendMessage(agentId, {
        id: `task-${task.id}`,
        type: 'task',
        timestamp: new Date(),
        data: taskData,
        correlationId: task.id
      }).catch(reject);
    });
  }

  /**
   * Send a message to an agent process
   */
  async sendMessage(agentId: string, message: AgentMessage): Promise<void> {
    const agentData = this.processes.get(agentId);
    if (!agentData || !agentData.process) {
      throw new Error(`Agent process ${agentId} not found or not running`);
    }

    const messageStr = JSON.stringify(message) + '\n';
    
    return new Promise((resolve, reject) => {
      agentData.process!.stdin?.write(messageStr, (error) => {
        if (error) {
          this.logger.error('Failed to send message to agent', { agentId, error });
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get information about all agents
   */
  getAgents(): AgentProcessInfo[] {
    return Array.from(this.processes.values()).map(data => ({ ...data.info }));
  }

  /**
   * Get information about a specific agent
   */
  getAgent(agentId: string): AgentProcessInfo | undefined {
    const agentData = this.processes.get(agentId);
    return agentData ? { ...agentData.info } : undefined;
  }

  /**
   * Get agent statistics
   */
  getAgentStats(): {
    total: number;
    running: number;
    stopped: number;
    error: number;
    totalTasks: number;
    totalFailures: number;
  } {
    const agents = this.getAgents();
    return {
      total: agents.length,
      running: agents.filter(a => a.status === 'running').length,
      stopped: agents.filter(a => a.status === 'stopped').length,
      error: agents.filter(a => a.status === 'error' || a.status === 'crashed').length,
      totalTasks: agents.reduce((sum, a) => sum + a.tasksCompleted, 0),
      totalFailures: agents.reduce((sum, a) => sum + a.tasksFailed, 0)
    };
  }

  /**
   * Shutdown all agents and cleanup
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down agent process manager');

    // Stop monitoring
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Stop all agents
    const stopPromises = Array.from(this.processes.keys()).map(agentId =>
      this.stopAgent(agentId, true).catch(error =>
        this.logger.error('Error stopping agent during shutdown', { agentId, error })
      )
    );

    await Promise.allSettled(stopPromises);

    this.processes.clear();
    this.emit('shutdown');
  }

  // === PRIVATE METHODS ===

  private spawnAgentProcess(config: AgentProcessConfig, scriptPath: string, workDir: string): ChildProcess {
    this.logger.info('Spawning agent process', { agentId: config.id, scriptPath, workDir });
    
    // Base environment
    const baseEnv = {
      ...process.env,
      AGENT_ID: config.id,
      AGENT_TYPE: config.type,
      AGENT_SPECIALIZATION: config.specialization || '',
      ...config.environment
    };

    // SECURITY INTEGRATION: Add security context to agent environment
    const securityEnv = {
      SECURE_AGENT_MODE: 'true',
      SECURITY_LEVEL: 'standard',
      OWASP_COMPLIANCE: 'TOP_10_2023',
      ENFORCE_CLEAN_ARCHITECTURE: 'true',
      ENFORCE_SOLID: 'true',
      MIN_TEST_COVERAGE: '85',
      REQUIRE_TESTS: 'true',
      SECURITY_VALIDATION: 'real-time',
      CLAUDE_AGENT_ID: config.id,
      CLAUDE_AGENT_TYPE: config.type,
      CLAUDE_AGENT_MODE: 'true'
    };
    
    const env = { ...baseEnv, ...securityEnv };

    const nodeArgs = [];
    if (config.maxMemory) {
      nodeArgs.push(`--max-old-space-size=${config.maxMemory}`);
    }

    // Check for node executable
    let nodeExecutable = 'node';
    try {
      const { execSync } = require('child_process');
      const whichResult = execSync('which node', { encoding: 'utf8' }).toString().trim();
      if (whichResult) {
        nodeExecutable = whichResult;
      }
    } catch (error) {
      this.logger.warn('Failed to find node executable, using default', { error });
    }
    
    this.logger.info(`Spawning agent with ${nodeExecutable}`, { args: [...nodeArgs, scriptPath] });
    
    const childProcess = spawn(nodeExecutable, [...nodeArgs, scriptPath], {
      cwd: workDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    return childProcess;
  }

  private setupProcessHandlers(agentId: string, childProcess: ChildProcess): void {
    const agentData = this.processes.get(agentId)!;

    // Handle stdout (messages from agent)
    childProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        try {
          const message: AgentMessage = JSON.parse(line);
          this.handleAgentMessage(agentId, message);
        } catch (error) {
          this.logger.debug('Agent stdout (not JSON)', { agentId, data: line });
        }
      }
    });

    // Handle stderr (errors and logs)
    childProcess.stderr?.on('data', (data) => {
      this.logger.warn('Agent stderr', { agentId, data: data.toString() });
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      this.logger.info('Agent process exited', { agentId, code, signal });
      
      const previousStatus = agentData.info.status;
      agentData.info.status = code === 0 ? 'stopped' : 'crashed';
      
      // Cancel pending tasks
      for (const [taskId, pending] of agentData.pendingTasks) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(`Agent process exited (code: ${code})`));
      }
      agentData.pendingTasks.clear();

      this.emit('agent:exited', { agentId, code, signal });

      // Auto-restart if crashed and not intentionally stopped
      if (code !== 0 && previousStatus !== 'stopping') {
        this.scheduleRestart(agentId);
      }
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      this.logger.error('Agent process error', { agentId, error });
      agentData.info.status = 'error';
      this.emit('agent:error', { agentId, error });
    });
  }

  private handleAgentMessage(agentId: string, message: AgentMessage): void {
    const agentData = this.processes.get(agentId);
    if (!agentData) return;

    agentData.info.lastActivity = new Date();

    switch (message.type) {
      case 'result':
        this.handleTaskResult(agentId, message);
        break;
      
      case 'status':
        this.handleStatusUpdate(agentId, message);
        break;
      
      case 'heartbeat':
        // Remove message parameter from handleHeartbeat call
        this.handleHeartbeat(agentId);
        break;
      
      case 'error':
        this.handleAgentError(agentId, message);
        break;
      
      default:
        this.logger.debug('Unknown message type from agent', { agentId, type: message.type });
    }

    this.emit('agent:message', { agentId, message });
  }

  private handleTaskResult(agentId: string, message: AgentMessage): void {
    const agentData = this.processes.get(agentId)!;
    
    // Safe conversion of message.data to TaskResult
    const data = message.data;
    if (!data || typeof data !== 'object') {
      this.logger.error('Invalid task result data', { agentId, data });
      return;
    }

    const result: TaskResult = {
      taskId: String(data.taskId || ''),
      success: Boolean(data.success),
      result: data.result as Record<string, unknown>,
      error: data.error ? String(data.error) : undefined,
      files: data.files as Array<{
        path: string;
        content: string;
        operation: string;
      }>,
      duration: Number(data.duration || 0),
      tokensUsed: data.tokensUsed ? Number(data.tokensUsed) : undefined
    };
    
    const pending = agentData.pendingTasks.get(result.taskId);
    if (pending) {
      clearTimeout(pending.timeout);
      agentData.pendingTasks.delete(result.taskId);
      
      if (result.success) {
        agentData.info.tasksCompleted++;
        pending.resolve(result);
        
        // Emit task completion event for SwarmCoordinator
        this.emit('task:completed', {
          agentId,
          taskId: result.taskId,
          result: result
        });
        
      } else {
        agentData.info.tasksFailed++;
        pending.reject(new Error(result.error || 'Task failed'));
        
        // Emit task failure event for SwarmCoordinator
        this.emit('task:failed', {
          agentId,
          taskId: result.taskId,
          error: result.error || 'Task failed'
        });
      }
    }
  }

  private handleStatusUpdate(agentId: string, message: AgentMessage): void {
    const agentData = this.processes.get(agentId)!;
    const status = message.data;
    
    // Fix memory and CPU usage type assignments
    if (status.memoryUsage && typeof status.memoryUsage === 'number') {
      agentData.info.memoryUsage = status.memoryUsage;
    }
    if (status.cpuUsage && typeof status.cpuUsage === 'number') {
      agentData.info.cpuUsage = status.cpuUsage;
    }
  }

  private handleHeartbeat(agentId: string): void {
    // Heartbeat received, agent is alive
    this.logger.debug('Heartbeat received', { agentId });
  }

  private handleAgentError(agentId: string, message: AgentMessage): void {
    this.logger.error('Agent reported error', { agentId, error: message.data });
    this.emit('agent:error', { agentId, error: message.data });
  }

  private scheduleRestart(agentId: string): void {
    const agentData = this.processes.get(agentId);
    if (!agentData) return;

    const maxRestarts = 3;
    if (agentData.info.restartCount >= maxRestarts) {
      this.logger.error('Agent exceeded max restarts', { agentId, restarts: agentData.info.restartCount });
      agentData.info.status = 'error';
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, agentData.info.restartCount), 30000); // Exponential backoff, max 30s
    
    this.logger.info('Scheduling agent restart', { agentId, delay, attempt: agentData.info.restartCount + 1 });
    
    setTimeout(() => {
      this.restartAgent(agentId).catch(error =>
        this.logger.error('Failed to restart agent', { agentId, error })
      );
    }, delay);
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [agentId, agentData] of this.processes) {
        if (agentData.info.status === 'running' && agentData.info.lastActivity) {
          const timeSinceActivity = now - agentData.info.lastActivity.getTime();
          
          // If no activity for 2 minutes, consider agent unresponsive
          if (timeSinceActivity > 120000) {
            this.logger.warn('Agent appears unresponsive', { agentId, timeSinceActivity });
            this.emit('agent:unresponsive', { agentId, timeSinceActivity });
          }
        }
      }
    }, 30000) as any; // Check every 30 seconds
  }

  private setupCleanupHandlers(): void {
    const cleanup = () => {
      this.shutdown().catch(error =>
        this.logger.error('Error during cleanup', { error })
      );
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }

  private generateAgentProcessTemplate(): string {
    return `
/**
 * Agent Process Template - FIXED VERSION
 * This template is used to generate individual agent processes
 * Uses ES modules syntax for compatibility with package.tson "type": "module"
 */

import { EventEmitter } from 'node:events';

class Agent extends EventEmitter {
  constructor() {
    super();
    this.id = process.env.AGENT_ID;
    this.type = process.env.AGENT_TYPE;
    this.specialization = process.env.AGENT_SPECIALIZATION;
    this.running = true;
    this.currentTask = null;
    
    console.log('Agent starting:', { id: this.id, type: this.type });
    
    this.setupCommunication();
    this.startHeartbeat();
  }

  setupCommunication() {
    // Listen for messages from parent process
    process.stdin.on('data', (data) => {
      const lines = data.toString().split('\\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          this.sendError('Invalid message format', error);
        }
      }
    });
  }

  async handleMessage(message) {
    console.log('Agent received message:', { type: message.type, id: message.id });
    
    switch (message.type) {
      case 'task':
        await this.executeTask(message.data);
        break;
      case 'command':
        await this.handleCommand(message.data);
        break;
      default:
        this.sendError('Unknown message type', message.type);
    }
  }

  async executeTask(task) {
    console.log('Agent executing task:', { taskId: task.id, type: task.type });
    
    this.currentTask = task;
    const startTime = Date.now();
    
    try {
      // Simulate some actual work
      await this.sleep(2000); // 2 second delay to simulate work
      
      const result = await this.processTask(task);
      
      console.log('Task completed successfully:', { taskId: task.id });
      
      this.sendResult({
        taskId: task.id,
        success: true,
        result,
        duration: Date.now() - startTime
      });
    } catch (error) {
      console.error('Task failed:', { taskId: task.id, error: error.message });
      
      this.sendResult({
        taskId: task.id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
    } finally {
      this.currentTask = null;
    }
  }

  async processTask(task) {
    // Simulate actual task processing based on task type
    const taskResults = {
      'coding': {
        message: 'Code generation completed',
        files: [
          { path: 'index.html', content: '<html><body><h1>Hello World</h1></body></html>' },
          { path: 'style.css', content: 'body { font-family: Arial, sans-serif; }' }
        ]
      },
      'documentation': {
        message: 'Documentation created',
        files: [
          { path: 'README.md', content: '# Project Documentation\\n\\nThis is a sample project.' }
        ]
      },
      'testing': {
        message: 'Tests completed',
        files: [
          { path: 'test.ts', content: 'console.log("All tests passed!");' }
        ]
      }
    };
    
    return taskResults[task.type] || { message: 'Task completed successfully', files: [] };
  }

  async handleCommand(command) {
    switch (command.command) {
      case 'shutdown':
        this.shutdown();
        break;
      case 'status':
        this.sendStatus();
        break;
      default:
        this.sendError('Unknown command', command.command);
    }
  }

  sendMessage(type, data, correlationId) {
    const message = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2),
      type,
      timestamp: new Date(),
      from: this.id,
      data,
      correlationId
    };
    
    console.log(JSON.stringify(message));
  }

  sendResult(result) {
    this.sendMessage('result', result);
  }

  sendStatus() {
    const memUsage = process.memoryUsage();
    this.sendMessage('status', {
      memoryUsage: Math.round(memUsage.heapUsed / 1024 / 1024),
      cpuUsage: process.cpuUsage(),
      currentTask: this.currentTask?.id
    });
  }

  sendError(message, details) {
    this.sendMessage('error', { message, details });
  }

  startHeartbeat() {
    setInterval(() => {
      if (this.running) {
        this.sendMessage('heartbeat', { timestamp: Date.now() });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  shutdown() {
    console.log('Agent shutting down:', this.id);
    this.running = false;
    process.exit(0);
  }
}

// Start the agent
const agent = new Agent();
`;
  }

  private generateAgentScript(): string {
    // Add diagnostic code to the template to help with debugging
    let template = this.processTemplate;
    
    // Add extra diagnostics
    template = template.replace(
      'console.log(\'Agent starting:\',', 
      'console.log(\'Agent starting with diagnostics:\','
    );
    
    template = template.replace(
      'this.setupCommunication();', 
      `this.setupCommunication();
      // Print diagnostic info
      console.log('Agent environment:', process.env);
      console.log('Agent cwd:', process.cwd());
      try {
        console.log('Agent files:', require('fs').readdirSync(process.cwd()));
      } catch (e) {
        console.log('Failed to read directory:', e);  
      }`
    );
    
    return template;
  }
}

export default AgentProcessManager; 