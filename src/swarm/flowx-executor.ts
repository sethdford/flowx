/**
 * FlowX Executor - Enhanced Task Executor with SPARC Integration
 * 
 * Combines the best of:
 * 1. Original claude-flow SPARC methodology 
 * 2. Our enhanced timeout configuration system
 * 3. Improved error handling and resource management
 * 4. Enterprise-grade logging and monitoring
 */

import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { Logger } from '../core/logger.js';
import { generateId } from '../utils/helpers.js';
import { getClaudeTimeout, getTaskTimeout } from '../config/timeout-config.js';
import {
  TaskDefinition,
  AgentState,
  TaskResult,
} from './types.js';
import {
  ExecutionContext,
  ExecutionResources,
  ExecutionResult,
  ResourceUsage,
} from './executor.js';

export interface FlowXExecutorConfig {
  timeoutMs?: number;
  retryAttempts?: number;
  killTimeout?: number;
  enableSparc?: boolean;
  verbose?: boolean;
  flowxPath?: string;
  resourceLimits?: ExecutionResources;
  sandboxed?: boolean;
  logLevel?: string;
  captureOutput?: boolean;
  streamOutput?: boolean;
  enableMetrics?: boolean;
  sparc?: {
    enableAllPhases?: boolean;
    skipPhases?: SparcPhase[];
    phaseTimeout?: number;
    requireReview?: boolean;
    generateTests?: boolean;
  };
}

export interface FlowXExecutionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  useStdin?: boolean;
  detached?: boolean;
  outputFormat?: string;
  nonInteractive?: boolean;
  autoApprove?: boolean;
  targetDir?: string;
  sparcMode?: string;
  environmentOverride?: Record<string, string>;
}

export interface FlowXCommand {
  command: string;
  args: string[];
  input?: string;
}

export interface SparcPhaseResult {
  phase: SparcPhase;
  output: string;
  success: boolean;
  duration: number;
  quality: number;
  completeness: number;
  issues: string[];
  recommendations: string[];
}

export interface FlowXExecutionResult extends ExecutionResult {
  sparcPhases?: SparcPhaseResult[];
  methodology?: {
    phasesCompleted: SparcPhase[];
    totalPhases: number;
    overallQuality: number;
    systemicApproach: boolean;
  };
}

export type SparcPhase = 'specification' | 'pseudocode' | 'architecture' | 'review' | 'code';

export class FlowXExecutor extends EventEmitter {
  private logger: Logger;
  private config: FlowXExecutorConfig;
  private activeExecutions: Map<string, ExecutionSession> = new Map();
  private flowxPath: string;

  constructor(config: Partial<FlowXExecutorConfig> = {}) {
    super();

    this.config = this.mergeWithDefaults(config);
    this.logger = new Logger(
      { level: this.config.logLevel || 'info', format: 'json', destination: 'console' },
      { component: 'FlowXExecutor' },
    );
    
    this.flowxPath = config.flowxPath || this.detectFlowXPath();

    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing FlowX executor with SPARC integration...');
    
    // Verify flowx binary is available
    await this.verifyFlowXAvailability();
    
    this.logger.info('FlowX executor initialized with SPARC capabilities');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down FlowX executor...');

    // Stop all active executions
    const stopPromises = Array.from(this.activeExecutions.values()).map((session) =>
      this.stopExecution(session.id, 'Executor shutdown'),
    );

    await Promise.allSettled(stopPromises);

    this.logger.info('FlowX executor shut down');
  }

  async executeTask(
    task: TaskDefinition,
    agent: AgentState,
    options: Partial<FlowXExecutionOptions> = {},
  ): Promise<FlowXExecutionResult> {
    const sessionId = generateId('flowx-execution');
    const context = await this.createExecutionContext(task, agent);

    this.logger.info('Starting FlowX task execution', {
      sessionId,
      taskId: task.id.id,
      agentId: agent.id.id,
      enableSparc: this.config.enableSparc,
      timeout: this.config.timeoutMs,
    });

    const session = new ExecutionSession(
      sessionId, 
      task, 
      agent, 
      context, 
      this.config, 
      this.logger
    );

    this.activeExecutions.set(sessionId, session);

    try {
      let result: FlowXExecutionResult;

      if (this.config.enableSparc && this.shouldUseSparc(task, agent)) {
        // Use SPARC methodology for complex tasks
        result = await this.executeWithSparc(session, options);
      } else {
        // Use enhanced Claude Code execution for simpler tasks
        result = await this.executeWithClaudeCode(session, options);
      }

      // Cleanup
      await this.cleanupExecution(session);

      this.logger.info('FlowX task execution completed', {
        sessionId,
        success: result.success,
        duration: result.duration,
        methodology: result.methodology ? 'SPARC' : 'Claude Code',
      });

      return result;
    } catch (error) {
      this.logger.error('FlowX task execution failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      await this.cleanupExecution(session);
      throw error;
    } finally {
      this.activeExecutions.delete(sessionId);
    }
  }

  async stopExecution(sessionId: string, reason: string): Promise<void> {
    const session = this.activeExecutions.get(sessionId);
    if (!session) {
      return;
    }

    this.logger.info('Stopping FlowX execution', { sessionId, reason });

    try {
      await session.stop(reason);
    } catch (error) {
      this.logger.error('Error stopping FlowX execution', { sessionId, error });
    }
  }

  private async executeWithSparc(
    session: ExecutionSession,
    options: Partial<FlowXExecutionOptions>,
  ): Promise<FlowXExecutionResult> {
    const sparcMode = this.determineSparcMode(session.task, session.agent);

    this.logger.info('Executing with SPARC methodology', {
      sessionId: session.id,
      sparcMode,
      taskType: session.task.type,
      agentType: session.agent.type,
    });

    try {
      const result = await this.executeFlowXSparc(
        session,
        sparcMode,
        options
      );

      return {
        ...result,
        methodology: {
          phasesCompleted: [sparcMode as SparcPhase],
          totalPhases: 1,
          overallQuality: this.calculateQuality(result.output || '', result.exitCode || 0),
          systemicApproach: true,
        },
      };
    } catch (error) {
      this.logger.error('SPARC execution failed', {
        sessionId: session.id,
        sparcMode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeWithClaudeCode(
    session: ExecutionSession,
    options: Partial<FlowXExecutionOptions>,
  ): Promise<FlowXExecutionResult> {
    this.logger.info('Executing with enhanced Claude Code', {
      sessionId: session.id,
      taskType: session.task.type,
      agentType: session.agent.type,
    });

    const result = await this.executeClaudeCodeWithTimeout(session, options);

    return {
      ...result,
      methodology: undefined, // No SPARC phases for direct execution
    };
  }

  private async executeFlowXSparc(
    session: ExecutionSession,
    sparcMode: string,
    options: Partial<FlowXExecutionOptions>,
  ): Promise<FlowXExecutionResult> {
    const command = this.buildSparcCommand(session.task, sparcMode, options);
    const timeout = getTaskTimeout(session.task.type) || this.config.timeoutMs!;

    return this.executeCommandWithTimeout(session, command, timeout, options);
  }

  private async executeClaudeCodeWithTimeout(
    session: ExecutionSession,
    options: Partial<FlowXExecutionOptions>,
  ): Promise<FlowXExecutionResult> {
    const command = this.buildClaudeCodeCommand(session.task, session.agent, options);
    const timeout = getClaudeTimeout(session.task.type) || this.config.timeoutMs!;

    return this.executeCommandWithTimeout(session, command, timeout, options);
  }

  private async executeCommandWithTimeout(
    session: ExecutionSession,
    command: FlowXCommand,
    timeout: number,
    options: Partial<FlowXExecutionOptions>,
  ): Promise<FlowXExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      let errorBuffer = '';
      let isTimeout = false;
      let childProcess: ChildProcess | null = null;

      // Setup timeout with enhanced configuration
      const timeoutHandle = setTimeout(() => {
        isTimeout = true;
        if (childProcess) {
          this.logger.warn('FlowX execution timeout, killing process', {
            sessionId: session.id,
            pid: childProcess.pid,
            timeout,
            command: command.command,
          });

          // Graceful shutdown first
          childProcess.kill('SIGTERM');

          // Force kill after grace period
          setTimeout(() => {
            if (childProcess && !childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, this.config.killTimeout || 5000);
        }
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutHandle);
      };

      try {
        // Enhanced environment for FlowX execution
        const env = {
          ...process.env,
          ...session.context.environment,
          ...options.environmentOverride,
          CLAUDE_TASK_ID: session.task.id.id,
          CLAUDE_AGENT_ID: session.agent.id.id,
          CLAUDE_SESSION_ID: session.id,
          CLAUDE_WORKING_DIR: session.context.workingDirectory,
          CLAUDE_FLOWX_MODE: 'true',
          CLAUDE_NON_INTERACTIVE: (options.nonInteractive || true).toString(),
          CLAUDE_AUTO_APPROVE: (options.autoApprove || true).toString(),
          // Enhanced timeout configuration
          CLAUDE_TIMEOUT: timeout.toString(),
          FLOWX_EXECUTION_MODE: this.config.enableSparc ? 'sparc' : 'direct',
        };

        // Spawn process
        childProcess = spawn(command.command, command.args, {
          cwd: session.context.workingDirectory,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: options.detached || false,
        });

        if (!childProcess.pid) {
          cleanup();
          reject(new Error('Failed to spawn FlowX process'));
          return;
        }

        this.logger.info('FlowX process started', {
          sessionId: session.id,
          pid: childProcess.pid,
          command: command.command,
          timeout,
        });

        // Handle process output with enhanced logging
        if (childProcess.stdout) {
          childProcess.stdout.on('data', (data: Buffer) => {
            const chunk = data.toString();
            outputBuffer += chunk;

            // Enhanced progress detection
            if (this.isProgressUpdate(chunk)) {
              this.logger.info('FlowX progress update', {
                sessionId: session.id,
                progress: chunk.trim().substring(0, 100),
              });
            }

            if (this.config.streamOutput) {
              this.emit('output', {
                sessionId: session.id,
                type: 'stdout',
                data: chunk,
              });
            }
          });
        }

        if (childProcess.stderr) {
          childProcess.stderr.on('data', (data: Buffer) => {
            const chunk = data.toString();
            errorBuffer += chunk;

            // Enhanced error detection and logging
            this.logger.warn('FlowX stderr output', {
              sessionId: session.id,
              stderr: chunk.trim().substring(0, 200),
            });

            if (this.config.streamOutput) {
              this.emit('output', {
                sessionId: session.id,
                type: 'stderr',
                data: chunk,
              });
            }
          });
        }

        // Handle process completion
        childProcess.on('close', async (code: number | null, signal: string | null) => {
          cleanup();

          const duration = Date.now() - startTime;
          const exitCode = code || 0;

          this.logger.info('FlowX process completed', {
            sessionId: session.id,
            exitCode,
            signal,
            duration,
            isTimeout,
          });

          try {
            // Collect enhanced artifacts
            const artifacts = await this.collectEnhancedArtifacts(session.context, outputBuffer);

            // Collect resource usage
            const resourceUsage = await this.collectResourceUsage(session.id);

            const result: FlowXExecutionResult = {
              success: !isTimeout && exitCode === 0,
              output: outputBuffer,
              error: errorBuffer,
              exitCode,
              duration,
              resourcesUsed: resourceUsage,
              artifacts,
              metadata: {
                sessionId: session.id,
                timeout: isTimeout,
                signal,
                command: command.command,
                args: command.args,
                quality: this.calculateQuality(outputBuffer, exitCode),
                completeness: this.calculateCompleteness(outputBuffer, artifacts),
              },
            };

            if (isTimeout) {
              reject(new Error(`FlowX execution timed out after ${timeout}ms`));
            } else if (exitCode !== 0) {
              reject(
                new Error(`FlowX execution failed with exit code ${exitCode}: ${errorBuffer}`)
              );
            } else {
              resolve(result);
            }
          } catch (error) {
            reject(error);
          }
        });

        // Handle process errors
        childProcess.on('error', (error: Error) => {
          cleanup();
          this.logger.error('FlowX process error', {
            sessionId: session.id,
            error: error.message,
          });
          reject(error);
        });

        // Send input if provided
        if (command.input && childProcess.stdin) {
          childProcess.stdin.write(command.input);
          childProcess.stdin.end();
        }

        // If detached, unreference to allow parent to exit
        if (options.detached) {
          childProcess.unref();
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  private shouldUseSparc(task: TaskDefinition, agent: AgentState): boolean {
    // Use SPARC for complex tasks that benefit from systematic methodology
    const complexTaskTypes = ['coding', 'architecture', 'setup', 'integration', 'documentation'];
    const complexAgentTypes = ['architect', 'developer', 'coordinator'];

    const isComplexTask = complexTaskTypes.includes(task.type);
    const isComplexAgent = complexAgentTypes.includes(agent.type);
    const isLongRunningTask = (task.constraints.timeoutAfter || 0) > 600000; // > 10 minutes

    return isComplexTask || isComplexAgent || isLongRunningTask;
  }

  private determineSparcMode(task: TaskDefinition, agent: AgentState): string {
    // Enhanced SPARC mode detection based on task and agent analysis
    const modeMap: Record<string, string> = {
      // Task type mappings
      coding: 'code',
      testing: 'tdd',
      analysis: 'spec-pseudocode',
      documentation: 'docs-writer',
      research: 'spec-pseudocode',
      review: 'refinement-optimization-mode',
      deployment: 'devops',
      optimization: 'refinement-optimization-mode',
      integration: 'integration',
      setup: 'architect',

      // Agent type overrides
      coder: 'code',
      developer: 'code',
      tester: 'tdd',
      analyst: 'spec-pseudocode',
      documenter: 'docs-writer',
      reviewer: 'refinement-optimization-mode',
      researcher: 'spec-pseudocode',
      coordinator: 'architect',
      architect: 'architect',
    };

    // Check for specific keywords in task description
    const description = task.description.toLowerCase();
    if (description.includes('architecture') || description.includes('design')) {
      return 'architect';
    }
    if (description.includes('security')) {
      return 'security-review';
    }
    if (description.includes('debug')) {
      return 'debug';
    }
    if (description.includes('test')) {
      return 'tdd';
    }
    if (description.includes('document')) {
      return 'docs-writer';
    }
    if (description.includes('integrate')) {
      return 'integration';
    }
    if (description.includes('maven') || description.includes('setup')) {
      return 'architect';
    }

    // Use agent type first, then task type
    return modeMap[agent.type] || modeMap[task.type] || 'code';
  }

  private buildSparcCommand(
    task: TaskDefinition,
    mode: string,
    options: Partial<FlowXExecutionOptions>,
  ): FlowXCommand {
    const args = [
      'sparc',
      'run',
      mode,
      `"${this.formatTaskDescription(task)}"`,
    ];

    // Add options
    if (options.targetDir) {
      args.push('--target-dir', options.targetDir);
    }

    if (this.config.verbose) {
      args.push('--verbose');
    }

    // Add non-interactive flags for automation
    args.push('--non-interactive');
    args.push('--yes');

    // Add timeout
    const timeout = options.timeout || getTaskTimeout(task.type);
    if (timeout) {
      args.push('--timeout', Math.floor(timeout / 1000).toString()); // Convert to seconds
    }

    return {
      command: this.flowxPath,
      args,
    };
  }

  private buildClaudeCodeCommand(
    task: TaskDefinition,
    agent: AgentState,
    options: Partial<FlowXExecutionOptions>,
  ): FlowXCommand {
    const args: string[] = [];
    let input = '';

    // Build enhanced prompt
    const prompt = this.buildEnhancedPrompt(task, agent);

    if (options.useStdin) {
      input = prompt;
    } else {
      args.push(prompt);
    }

    // Add enhanced flags
    args.push('--print');
    args.push('--dangerously-skip-permissions');

    if (options.outputFormat) {
      args.push('--output-format', options.outputFormat);
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    if (options.maxTokens) {
      args.push('--max-tokens', options.maxTokens.toString());
    }

    if (options.temperature !== undefined) {
      args.push('--temperature', options.temperature.toString());
    }

    return {
      command: 'claude',
      args,
      input,
    };
  }

  private formatTaskDescription(task: TaskDefinition): string {
    let description = task.description;

    // Include instructions if different
    if (task.instructions && task.instructions !== task.description) {
      description = `${task.description}. ${task.instructions}`;
    }

    // Add context information
    if (task.context?.targetDir) {
      description += ` in ${task.context.targetDir}`;
    }

    return description.replace(/"/g, '\\"');
  }

  private buildEnhancedPrompt(task: TaskDefinition, agent: AgentState): string {
    const sections: string[] = [];

    // Enhanced agent identification
    sections.push(`You are ${agent.name}, a specialized ${agent.type} agent in the FlowX swarm system.`);
    sections.push(`Agent ID: ${agent.id.id}`);
    sections.push(`Swarm ID: ${agent.id.swarmId}`);
    sections.push('');

    // Enhanced task information
    sections.push(`TASK: ${task.name}`);
    sections.push(`Type: ${task.type}`);
    sections.push(`Priority: ${task.priority}`);
    sections.push('');

    // Task description and instructions
    sections.push('DESCRIPTION:');
    sections.push(task.description);
    sections.push('');

    if (task.instructions && task.instructions !== task.description) {
      sections.push('DETAILED INSTRUCTIONS:');
      sections.push(task.instructions);
      sections.push('');
    }

    // Enhanced context handling
    if (Object.keys(task.context).length > 0) {
      sections.push('CONTEXT:');
      sections.push(JSON.stringify(task.context, null, 2));
      sections.push('');
    }

    // FlowX-specific guidance
    sections.push('FLOWX EXECUTION GUIDELINES:');
    sections.push('1. Follow systematic problem-solving approach');
    sections.push('2. Create high-quality, maintainable deliverables');
    sections.push('3. Provide comprehensive documentation');
    sections.push('4. Handle errors gracefully and report issues clearly');
    sections.push('5. Ensure deliverables meet enterprise standards');
    sections.push('');

    sections.push('Begin your task execution now with FlowX methodology.');

    return sections.join('\n');
  }

  private detectFlowXPath(): string {
    // Try to detect flowx binary location
    const possiblePaths = [
      'flowx',
      './original-flowx/bin/flowx',
      path.join(process.cwd(), 'original-flowx', 'bin', 'flowx'),
    ];

    // For now, fall back to claude if flowx isn't available
    return 'claude';
  }

  private async verifyFlowXAvailability(): Promise<void> {
    // If SPARC is enabled, verify flowx is available
    if (this.config.enableSparc) {
      this.logger.info('SPARC mode enabled, FlowX integration active');
      // TODO: Add actual verification when flowx binary is available
    } else {
      this.logger.info('Using enhanced Claude Code execution mode');
    }
  }

  private isProgressUpdate(chunk: string): boolean {
    const progressIndicators = [
      'Creating',
      'Writing',
      'Generating',
      'Setting up',
      'Configuring',
      'Installing',
      'Building',
      'Compiling',
      'Testing',
      'Deploying',
    ];

    return progressIndicators.some(indicator => 
      chunk.includes(indicator) || chunk.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  private async collectEnhancedArtifacts(
    context: ExecutionContext,
    output: string,
  ): Promise<Record<string, any>> {
    const artifacts: Record<string, any> = {};

    try {
      // Scan working directory for files
      const files = await this.scanDirectory(context.workingDirectory);
      artifacts.files = files;

      // Parse artifacts from output (enhanced detection)
      const artifactPatterns = [
        /Created file: (.+)/g,
        /Generated: (.+)/g,
        /Written to: (.+)/g,
        /Output saved to: (.+)/g,
      ];

      for (const pattern of artifactPatterns) {
        const matches = output.matchAll(pattern);
        for (const match of matches) {
          const filePath = match[1].trim();
          artifacts[filePath] = true;
        }
      }

      // Collect logs and outputs
      artifacts.logs = await this.collectLogs(context.logDirectory);
      artifacts.outputs = await this.collectOutputs(context.workingDirectory);
    } catch (error) {
      this.logger.warn('Error collecting enhanced artifacts', {
        workingDir: context.workingDirectory,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return artifacts;
  }

  private calculateQuality(output: string, exitCode: number): number {
    // Enhanced quality calculation
    let quality = exitCode === 0 ? 0.8 : 0.2;

    // Bonus for comprehensive output
    if (output.length > 1000) quality += 0.1;
    if (output.includes('Success') || output.includes('Complete')) quality += 0.1;

    return Math.min(quality, 1.0);
  }

  private calculateCompleteness(output: string, artifacts: Record<string, any>): number {
    // Enhanced completeness calculation
    let completeness = 0.5;

    // Bonus for output length
    if (output.length > 500) completeness += 0.2;
    if (output.length > 2000) completeness += 0.1;

    // Bonus for artifacts created
    const fileCount = Object.keys(artifacts.files || {}).length;
    if (fileCount > 0) completeness += Math.min(fileCount * 0.1, 0.2);

    return Math.min(completeness, 1.0);
  }

  // Utility methods (reused from TaskExecutor)
  private async createExecutionContext(
    task: TaskDefinition,
    agent: AgentState,
  ): Promise<ExecutionContext> {
    const baseDir = path.join(os.tmpdir(), 'flowx-execution', task.id.id);
    const workingDir = path.join(baseDir, 'work');
    const tempDir = path.join(baseDir, 'temp');
    const logDir = path.join(baseDir, 'logs');

    // Create directories
    await fs.mkdir(workingDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(logDir, { recursive: true });

    return {
      task,
      agent,
      workingDirectory: workingDir,
      tempDirectory: tempDir,
      logDirectory: logDir,
      environment: {
        NODE_ENV: 'production',
        SWARM_MODE: 'execution',
        AGENT_TYPE: agent.type,
        TASK_TYPE: task.type,
        FLOWX_MODE: 'true',
        ...agent.environment.credentials,
      },
      resources: {
        maxMemory: task.requirements.memoryRequired || 1024 * 1024 * 1024, // 1GB
        maxCpuTime: task.requirements.maxDuration || getTaskTimeout(task.type) || 1800000, // 30min
        maxDiskSpace: 2 * 1024 * 1024 * 1024, // 2GB
        maxNetworkConnections: 10,
        maxFileHandles: 100,
        priority: this.getPriorityNumber(task.priority),
      },
    };
  }

  private async cleanupExecution(session: ExecutionSession): Promise<void> {
    try {
      await session.cleanup();
      this.logger.debug('FlowX execution cleanup completed', { sessionId: session.id });
    } catch (error) {
      this.logger.warn('Error during FlowX execution cleanup', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async collectResourceUsage(sessionId: string): Promise<ResourceUsage> {
    // Enhanced resource usage collection
    return {
      cpuTime: Math.random() * 5000, // Mock data - would be real in production
      maxMemory: Math.random() * 512 * 1024 * 1024, // Mock data
      diskIO: Math.random() * 10240, // Mock data
      networkIO: Math.random() * 5120, // Mock data
      fileHandles: Math.floor(Math.random() * 20), // Mock data
    };
  }

  private async scanDirectory(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error) {
      return [];
    }
  }

  private async collectLogs(logDir: string): Promise<Record<string, string>> {
    const logs: Record<string, string> = {};

    try {
      const files = await fs.readdir(logDir);
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          logs[file] = content;
        }
      }
    } catch (error) {
      // Log directory might not exist
    }

    return logs;
  }

  private async collectOutputs(workingDir: string): Promise<Record<string, any>> {
    const outputs: Record<string, any> = {};

    try {
      // Look for common output files
      const outputFiles = ['output.json', 'result.json', 'response.json', 'pom.xml', 'package.json'];

      for (const fileName of outputFiles) {
        const filePath = path.join(workingDir, fileName);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          if (fileName.endsWith('.json')) {
            outputs[fileName] = JSON.parse(content);
          } else {
            outputs[fileName] = content;
          }
        } catch (error) {
          // File doesn't exist or isn't valid JSON
        }
      }
    } catch (error) {
      // Working directory might not exist
    }

    return outputs;
  }

  private getPriorityNumber(priority: string): number {
    switch (priority) {
      case 'critical':
        return 0;
      case 'high':
        return 1;
      case 'normal':
        return 2;
      case 'low':
        return 3;
      case 'background':
        return 4;
      default:
        return 2;
    }
  }

  private mergeWithDefaults(config: Partial<FlowXExecutorConfig>): FlowXExecutorConfig {
    return {
      timeoutMs: getTaskTimeout('default') || 1800000, // 30 minutes default
      retryAttempts: 3,
      killTimeout: 10000, // 10 seconds
      enableSparc: true, // Enable SPARC by default
      verbose: false,
      flowxPath: 'claude',
      resourceLimits: {
        maxMemory: 1024 * 1024 * 1024, // 1GB
        maxCpuTime: 1800000, // 30 minutes
        maxDiskSpace: 2 * 1024 * 1024 * 1024, // 2GB
        maxNetworkConnections: 10,
        maxFileHandles: 100,
        priority: 2,
      },
      sandboxed: true,
      logLevel: 'info',
      captureOutput: true,
      streamOutput: false,
      enableMetrics: true,
      sparc: {
        enableAllPhases: true,
        skipPhases: [],
        phaseTimeout: 600000, // 10 minutes per phase
        requireReview: true,
        generateTests: true,
      },
      ...config,
    };
  }

  private setupEventHandlers(): void {
    // Enhanced event handling for FlowX executor
    this.on('output', (data) => {
      this.logger.debug('FlowX output event', {
        sessionId: data.sessionId,
        type: data.type,
        dataLength: data.data?.length || 0,
      });
    });
  }

  // Public API methods
  getActiveExecutions(): ExecutionSession[] {
    return Array.from(this.activeExecutions.values());
  }

  getExecutionMetrics(): any {
    return {
      activeExecutions: this.activeExecutions.size,
      sparcEnabled: this.config.enableSparc,
      defaultTimeout: this.config.timeoutMs,
      flowxPath: this.flowxPath,
    };
  }
}

// Supporting class (simplified version of ExecutionSession)
class ExecutionSession {
  public id: string;
  public task: TaskDefinition;
  public agent: AgentState;
  public context: ExecutionContext;
  public config: FlowXExecutorConfig;
  private logger: Logger;
  private process?: ChildProcess;
  private startTime?: Date;
  private endTime?: Date;

  constructor(
    id: string,
    task: TaskDefinition,
    agent: AgentState,
    context: ExecutionContext,
    config: FlowXExecutorConfig,
    logger: Logger,
  ) {
    this.id = id;
    this.task = task;
    this.agent = agent;
    this.context = context;
    this.config = config;
    this.logger = logger;
  }

  async stop(reason: string): Promise<void> {
    this.logger.info('Stopping FlowX execution session', { sessionId: this.id, reason });

    if (this.process) {
      this.process.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, this.config.killTimeout || 5000);
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup temporary files and resources
    try {
      await fs.rm(this.context.tempDirectory, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

export default FlowXExecutor; 