/**
 * Claude CLI Client
 * Integration with the installed Claude CLI for powerful agent communication
 * Leverages the full power of Claude CLI including file operations, tools, and advanced features
 */

import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ILogger } from '../core/logger.ts';

export interface ClaudeCliConfig {
  claudePath?: string; // Path to claude executable
  workingDirectory?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryAttempts?: number;
  verbose?: boolean;
  allowedTools?: string[];
  dangerouslySkipPermissions?: boolean;
}

export interface ClaudeRequest {
  prompt: string;
  files?: Array<{
    path: string;
    content?: string;
    operation: 'read' | 'write' | 'create' | 'edit';
  }>;
  tools?: string[];
  systemPrompt?: string;
  context?: Record<string, unknown>;
  outputFormat?: 'text' | 'json' | 'markdown';
}

export interface ClaudeResponse {
  success: boolean;
  output: string;
  files?: Array<{
    path: string;
    content: string;
    operation: string;
  }>;
  tokensUsed?: number;
  duration: number;
  error?: string;
  exitCode?: number;
}

export interface TaskExecutionOptions {
  workingDirectory?: string;
  timeout?: number;
  allowFileOperations?: boolean;
  allowNetworkAccess?: boolean;
  allowCodeExecution?: boolean;
  maxFileSize?: number;
}

/**
 * Claude CLI Client for powerful agent operations
 */
export class ClaudeApiClient extends EventEmitter {
  private config: Required<ClaudeCliConfig>;
  private logger: ILogger;
  private activeProcesses = new Map<string, ChildProcess>();
  private requestQueue: Array<{
    id: string;
    request: ClaudeRequest;
    options: TaskExecutionOptions;
    resolve: (value: ClaudeResponse | PromiseLike<ClaudeResponse>) => void;
    reject: (reason?: Error) => void;
  }> = [];
  private isProcessing = false;

  constructor(config: ClaudeCliConfig, logger: ILogger) {
    super();
    
    this.config = {
      claudePath: config.claudePath || 'claude',
      workingDirectory: config.workingDirectory || process.cwd(),
      model: config.model || 'claude-3-sonnet-20240229',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 8192,
      timeout: config.timeout || 300000, // 5 minutes
      retryAttempts: config.retryAttempts || 2,
      verbose: config.verbose || false,
      allowedTools: config.allowedTools || ['file_editor', 'bash', 'computer'],
      dangerouslySkipPermissions: config.dangerouslySkipPermissions || true // Default to true for automation
    };

    this.logger = logger;
    this.startRequestProcessor();
  }

  /**
   * Execute a task using Claude CLI
   */
  async sendMessage(request: ClaudeRequest, options: TaskExecutionOptions = {}): Promise<ClaudeResponse> {
    const requestId = this.generateRequestId();
    
    this.logger.debug('Queuing Claude CLI task', { 
      requestId, 
      promptLength: request.prompt.length,
      filesCount: request.files?.length || 0
    });

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        id: requestId,
        request,
        options,
        resolve,
        reject
      });

      this.processRequestQueue();
    });
  }

  /**
   * Execute a simple prompt with Claude CLI
   */
  async chat(prompt: string, options: TaskExecutionOptions = {}): Promise<ClaudeResponse> {
    return this.sendMessage({ prompt }, options);
  }

  /**
   * Execute a file operation task
   */
  async executeFileTask(
    prompt: string, 
    files: Array<{ path: string; content?: string; operation: 'read' | 'write' | 'create' | 'edit' }>,
    options: TaskExecutionOptions = {}
  ): Promise<ClaudeResponse> {
    return this.sendMessage({ prompt, files }, options);
  }

  /**
   * Execute a coding task with full file access
   */
  async executeCodingTask(
    description: string,
    targetDirectory: string,
    options: TaskExecutionOptions = {}
  ): Promise<ClaudeResponse> {
    const prompt = `
# Coding Task

${description}

## Instructions
- Work in the directory: ${targetDirectory}
- Create all necessary files and directories
- Follow best practices for the technology being used
- Ensure the implementation is complete and functional
- Test your implementation if possible

## Working Directory
All files should be created in: ${targetDirectory}

Please implement this requirement completely.
`;

    return this.sendMessage({ prompt }, {
      ...options,
      workingDirectory: targetDirectory,
      allowFileOperations: true,
      allowCodeExecution: true
    });
  }

  /**
   * Check if Claude CLI is available
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      const result = await this.runClaudeCommand(['--version'], { timeout: 5000 });
      return {
        healthy: result.exitCode === 0,
        details: {
          version: result.output.trim(),
          claudePath: this.config.claudePath,
          workingDirectory: this.config.workingDirectory
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
          claudePath: this.config.claudePath
        }
      };
    }
  }

  /**
   * Get Claude CLI version and capabilities
   */
  async getInfo(): Promise<{ version: string; features: string[] }> {
    try {
      const versionResult = await this.runClaudeCommand(['--version'], { timeout: 5000 });
      const helpResult = await this.runClaudeCommand(['--help'], { timeout: 5000 });
      
      return {
        version: versionResult.output.trim(),
        features: this.parseFeatures(helpResult.output)
      };
    } catch (error) {
      throw new Error(`Failed to get Claude CLI info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cancel all running processes
   */
  cancelAllRequests(): void {
    for (const [requestId, process] of this.activeProcesses) {
      this.logger.info('Cancelling Claude CLI process', { requestId });
      process.kill('SIGTERM');
    }
    
    // Reject queued requests
    for (const queued of this.requestQueue) {
      queued.reject(new Error('Task cancelled'));
    }
    this.requestQueue = [];
  }

  /**
   * Shutdown the client gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Claude CLI client');
    
    this.cancelAllRequests();
    
    // Wait for active processes to complete
    const timeout = 30000;
    const startTime = Date.now();
    
    while (this.activeProcesses.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.emit('shutdown');
  }

  // === PRIVATE METHODS ===

  private startRequestProcessor(): void {
    // Process requests every 100ms
    setInterval(() => {
      if (!this.isProcessing && this.requestQueue.length > 0) {
        this.processRequestQueue();
      }
    }, 100);
  }

  private async processRequestQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const queued = this.requestQueue.shift()!;

    try {
      const result = await this.executeClaudeTask(queued.request, queued.options, queued.id);
      queued.resolve(result);
    } catch (error) {
      // Fix: Ensure error is typed as Error
      const errorToReject = error instanceof Error ? error : new Error(String(error));
      queued.reject(errorToReject);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeClaudeTask(
    request: ClaudeRequest,
    options: TaskExecutionOptions,
    requestId: string
  ): Promise<ClaudeResponse> {
    const startTime = Date.now();
    
    // Store state of working directory before execution for more accurate change detection
    const workDir = options.workingDirectory || this.config.workingDirectory;
    let beforeFiles: Set<string> = new Set();
    
    try {
      // Prepare working directory
      await mkdir(workDir, { recursive: true });

      // Capture state of directory before making changes
      if (options.allowFileOperations !== false) {
        beforeFiles = await this.captureDirectoryState(workDir);
      }

      // Prepare files if needed
      if (request.files) {
        await this.prepareFiles(request.files, workDir);
      }

      // Build Claude CLI command
      const args = await this.buildClaudeArgs(request, options, workDir);
      
      this.logger.debug('Executing Claude CLI command', { requestId, args: args.slice(0, 3) });

      // Execute Claude CLI
      const result = await this.runClaudeCommand(args, {
        cwd: workDir,
        timeout: options.timeout || this.config.timeout
      });

      // Parse response
      const response: ClaudeResponse = {
        success: result.exitCode === 0,
        output: result.output,
        duration: Date.now() - startTime,
        exitCode: result.exitCode
      };

      if (!response.success) {
        response.error = result.error || 'Claude CLI execution failed';
      }

      // Check for created/modified files
      if (options.allowFileOperations !== false) {
        // Use both beforeFiles state and other detection methods for comprehensive change tracking
        response.files = await this.detectFileChanges();
        
        // If no changes detected by standard methods, check for differences based on directory state
        if (response.files.length === 0) {
          const changedFiles = await this.detectFileChangesByComparison(workDir, beforeFiles);
          if (changedFiles.length > 0) {
            response.files = changedFiles;
          }
        }
      }

      this.logger.info('Claude CLI task completed', {
        requestId,
        success: response.success,
        duration: response.duration,
        filesChanged: response.files?.length || 0
      });

      this.emit('request:success', { requestId, response });
      return response;

    } catch (error) {
      const response: ClaudeResponse = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };

      this.logger.error('Claude CLI task failed', { requestId, error });
      this.emit('request:error', { requestId, error });
      return response;
    }
  }

  private async buildClaudeArgs(request: ClaudeRequest, options: TaskExecutionOptions, workDir: string): Promise<string[]> {
    // Check for Claude CLI version to use appropriate args
    let isV1 = false;
    try {
      const versionCheck = require('child_process').spawnSync('claude', ['--version']);
      const versionOutput = versionCheck.stdout.toString().trim();
      isV1 = versionOutput.includes('1.') || !versionOutput.includes('2.');
      this.logger.info(`Detected Claude CLI version: ${versionOutput}`);
    } catch (error) {
      this.logger.warn('Failed to detect Claude CLI version, assuming latest', { error });
    }
    
    // Base arguments
    const baseArgs: string[] = [request.prompt];

    // Always use non-interactive mode for automation
    baseArgs.push(isV1 ? '--message' : '--print');
    
    // Output format
    if (request.outputFormat) {
      baseArgs.push('--output-format', request.outputFormat);
    } else {
      baseArgs.push('--output-format', 'text');
    }

    // Skip permissions for automation (repository pattern)
    if (this.config.dangerouslySkipPermissions) {
      baseArgs.push('--dangerously-skip-permissions');
    }

    // Add working directory context (repository pattern)
    if (workDir && workDir !== process.cwd()) {
      baseArgs.push('--add-dir', workDir);
    }

    // Model selection
    if (this.config.model) {
      baseArgs.push('--model', this.config.model);
    }

    // Temperature
    if (this.config.temperature !== undefined) {
      baseArgs.push('--temperature', this.config.temperature.toString());
    }

    // Max tokens
    if (this.config.maxTokens) {
      baseArgs.push('--max-tokens', this.config.maxTokens.toString());
    }

    // Tools configuration (repository pattern)
    if (this.config.allowedTools && this.config.allowedTools.length > 0) {
      baseArgs.push('--allowed-tools', this.config.allowedTools.join(','));
    }

    // SECURITY INTEGRATION: Enhance arguments with security context
    try {
      const { enhanceClaudeArgsWithSecurity } = await import('./claude-process-integration.js');
      
      const context = {
        instanceId: `claude-api-${Date.now()}`,
        task: request.prompt,
        workingDirectory: workDir,
        isAgentMode: true,
        agentType: 'api-client'
      };

      const enhanced = await enhanceClaudeArgsWithSecurity(baseArgs, context);
      
      // Use enhanced arguments and environment
      this.logger.info('Enhanced Claude arguments with security context', {
        originalArgsLength: baseArgs.length,
        enhancedArgsLength: enhanced.args.length,
        templatePaths: enhanced.templatePaths.length
      });

      return enhanced.args;
      
    } catch (error) {
      this.logger.warn('Failed to enhance arguments with security, using base args', { error });
      return baseArgs;
    }
  }

  private async runClaudeCommand(
    args: string[],
    options: { cwd?: string; timeout?: number; env?: Record<string, string> } = {}
  ): Promise<{ output: string; error: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      // Prepare environment variables (repository pattern)
      const processEnv: Record<string, string> = {
        ...process.env,
        CLAUDE_INSTANCE_ID: `claude-api-${Date.now()}`,
        FLOWX_MODE: 'api-client',
        FLOWX_MEMORY_ENABLED: 'true',
        CLAUDE_WORKING_DIRECTORY: options.cwd || this.config.workingDirectory,
        // Add any additional environment variables
        ...options.env
      };

      // Try to detect claude CLI path if not provided
      let claudePath = this.config.claudePath;
      let finalArgs = args;
      if (claudePath === 'claude' || !claudePath) {
        try {
          // Check for claude in common locations
          const whichResult = require('child_process').spawnSync('which', ['claude']);
          if (whichResult.status === 0) {
            claudePath = whichResult.stdout.toString().trim();
            this.logger.info(`Found Claude CLI at: ${claudePath}`);
          } else {
            // Try npx
            claudePath = 'npx';
            finalArgs = ['claude', ...args];
            this.logger.info('Using npx to run Claude CLI');
          }
        } catch (error) {
          this.logger.warn('Could not detect Claude CLI path, using default', { error });
          claudePath = 'claude'; // Fallback
        }
      }
      
      const claudeProcess = spawn(claudePath, finalArgs, {
        cwd: options.cwd || this.config.workingDirectory,
        env: processEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let error = '';

      claudeProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      claudeProcess.stderr?.on('data', (data: Buffer) => {
        error += data.toString();
      });

      claudeProcess.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        resolve({
          output: output.trim(),
          error: error.trim(),
          exitCode: code || 0
        });
      });

      claudeProcess.on('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
      });

      // Set timeout with proper cleanup (repository uses longer timeouts)
      const timeoutHandle = setTimeout(() => {
        claudeProcess.kill('SIGTERM');
        reject(new Error(`Claude CLI timeout after ${options.timeout || this.config.timeout}ms`));
      }, options.timeout || this.config.timeout);
    });
  }

  private async prepareFiles(
    files: Array<{ path: string; content?: string; operation: string }>,
    workDir: string
  ): Promise<void> {
    for (const file of files) {
      const fullPath = join(workDir, file.path);
      
      if (file.operation === 'write' || file.operation === 'create') {
        if (file.content !== undefined) {
          await mkdir(join(fullPath, '..'), { recursive: true });
          await writeFile(fullPath, file.content);
        }
      }
    }
  }

  /**
   * Detects file changes made during Claude CLI execution
   * Uses various strategies including git diff and direct file monitoring
   */
  private async detectFileChanges(): Promise<Array<{ path: string; content: string; operation: string }>> {
    const files: Array<{ path: string; content: string; operation: string }> = [];
    const workDir = this.config.workingDirectory;
    
    try {
      // Try git-based detection if in a git repository
      const gitChanges = await this.detectGitChanges(workDir);
      if (gitChanges.length > 0) {
        return gitChanges;
      }
      
      // Fall back to filesystem-based detection
      return await this.detectFilesystemChanges(workDir);
    } catch (error) {
      this.logger.warn('Failed to detect file changes', { error });
      return files;
    }
  }
  
  /**
   * Detects file changes using git diff
   */
  private async detectGitChanges(workDir: string): Promise<Array<{ path: string; content: string; operation: string }>> {
    const files: Array<{ path: string; content: string; operation: string }> = [];
    
    try {
      // Check if directory is a git repository
      const isGitRepo = await this.runCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd: workDir });
      if (isGitRepo.exitCode !== 0) {
        return [];
      }
      
      // Get list of unstaged files
      const { output: statusOutput } = await this.runCommand('git', ['status', '--porcelain'], { cwd: workDir });
      if (!statusOutput.trim()) {
        return [];
      }
      
      const changedFiles = statusOutput
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const status = line.substring(0, 2);
          const path = line.substring(3);
          
          let operation = 'edit';
          if (status.includes('A')) operation = 'create';
          if (status.includes('D')) operation = 'delete';
          if (status.includes('R')) operation = 'rename';
          if (status.includes('M')) operation = 'edit';
          
          return { status, path, operation };
        });
      
      // Process each changed file
      for (const file of changedFiles) {
        if (file.operation === 'delete') {
          files.push({
            path: file.path,
            content: '',
            operation: 'delete'
          });
          continue;
        }
        
        try {
          // Read file content
          const { output: fileContent } = await this.runCommand('cat', [file.path], { cwd: workDir });
          
          files.push({
            path: file.path,
            content: fileContent,
            operation: file.operation
          });
        } catch (error) {
          this.logger.warn(`Failed to read file ${file.path}`, { error });
        }
      }
      
      return files;
    } catch (error) {
      this.logger.warn('Git-based file change detection failed', { error });
      return [];
    }
  }
  
  /**
   * Detects file changes using filesystem monitoring
   */
  private async detectFilesystemChanges(workDir: string): Promise<Array<{ path: string; content: string; operation: string }>> {
    const files: Array<{ path: string; content: string; operation: string }> = [];
    
    try {
      // Get recursive file listing
      const { output: findOutput } = await this.runCommand('find', ['.', '-type', 'f', '-not', '-path', '*/\.*', '-mmin', '-5'], { cwd: workDir });
      
      const recentFiles = findOutput
        .split('\n')
        .filter(line => line.trim())
        .filter(path => !path.includes('node_modules') && !path.includes('.git/'));
      
      // Process each recent file
      for (const filePath of recentFiles) {
        try {
          // Read file content
          const { output: fileContent } = await this.runCommand('cat', [filePath], { cwd: workDir });
          
          files.push({
            path: filePath.startsWith('./') ? filePath.substring(2) : filePath,
            content: fileContent,
            operation: 'edit' // We don't know if it's new or edited, assume edited
          });
        } catch (error) {
          this.logger.warn(`Failed to read file ${filePath}`, { error });
        }
      }
      
      return files;
    } catch (error) {
      this.logger.warn('Filesystem-based file change detection failed', { error });
      return [];
    }
  }
  
  /**
   * Run a shell command and return result
   */
  private async runCommand(
    command: string,
    args: string[],
    options: { cwd?: string; timeout?: number } = {}
  ): Promise<{ output: string; error: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        cwd: options.cwd || this.config.workingDirectory,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let error = '';
      
      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      
      childProcess.stderr?.on('data', (data: Buffer) => {
        error += data.toString();
      });
      
      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        resolve({
          output: output.trim(),
          error: error.trim(),
          exitCode: code || 0
        });
      });
      
      childProcess.on('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });
      
      // Set timeout
      const timeoutHandle = setTimeout(() => {
        childProcess.kill('SIGTERM');
        reject(new Error(`Command timeout: ${command} ${args.join(' ')}`));
      }, options.timeout || 30000);
    });
  }

  /**
   * Capture the state of a directory including file paths and modification times
   * for more accurate change detection
   */
  private async captureDirectoryState(dir: string): Promise<Set<string>> {
    const files = new Set<string>();
    
    try {
      // Use find command to get all files with their modification times
      const { output } = await this.runCommand('find', ['.', '-type', 'f', '-not', '-path', '*/\.*', '-printf', '%p\n'], { cwd: dir });
      
      output.split('\n')
        .filter(Boolean)
        .filter(path => !path.includes('node_modules') && !path.includes('.git/'))
        .forEach(path => {
          files.add(path.startsWith('./') ? path.substring(2) : path);
        });
    } catch (error) {
      this.logger.warn('Failed to capture directory state', { error });
    }
    
    return files;
  }
  
  /**
   * Detect file changes by comparing before and after directory state
   */
  private async detectFileChangesByComparison(
    dir: string, 
    beforeFiles: Set<string>
  ): Promise<Array<{ path: string; content: string; operation: string }>> {
    const changes: Array<{ path: string; content: string; operation: string }> = [];
    
    try {
      // Get current files
      const currentFiles = await this.captureDirectoryState(dir);
      
      // Find new files (in current but not in before)
      for (const file of currentFiles) {
        if (!beforeFiles.has(file)) {
          try {
            // Read file content
            const { output: content } = await this.runCommand('cat', [file], { cwd: dir });
            changes.push({
              path: file,
              content,
              operation: 'create'
            });
          } catch (error) {
            this.logger.warn(`Failed to read new file ${file}`, { error });
          }
        }
      }
      
      // Find deleted files (in before but not in current)
      for (const file of beforeFiles) {
        if (!currentFiles.has(file)) {
          changes.push({
            path: file,
            content: '',
            operation: 'delete'
          });
        }
      }
      
      // For files that exist in both, check if they've been modified
      // by comparing content hashes or modification times
      const commonFiles = Array.from(currentFiles).filter(f => beforeFiles.has(f));
      
      // Optimization: Only check files modified recently
      const { output: recentFiles } = await this.runCommand(
        'find', ['.', '-type', 'f', '-not', '-path', '*/\.*', '-mmin', '-5'], 
        { cwd: dir }
      );
      
      const recentFilesSet = new Set(
        recentFiles.split('\n')
          .filter(Boolean)
          .map(f => f.startsWith('./') ? f.substring(2) : f)
      );
      
      for (const file of commonFiles) {
        // Skip files that haven't been modified recently
        if (!recentFilesSet.has(file)) continue;
        
        try {
          // Read file content
          const { output: content } = await this.runCommand('cat', [file], { cwd: dir });
          changes.push({
            path: file,
            content,
            operation: 'edit'
          });
        } catch (error) {
          this.logger.warn(`Failed to read modified file ${file}`, { error });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to detect file changes by comparison', { error });
    }
    
    return changes;
  }

  private parseFeatures(helpOutput: string): string[] {
    const features: string[] = [];
    
    if (helpOutput.includes('--allowedTools')) features.push('tools');
    if (helpOutput.includes('--model')) features.push('model-selection');
    if (helpOutput.includes('--temperature')) features.push('temperature-control');
    if (helpOutput.includes('--output-format')) features.push('output-formatting');
    if (helpOutput.includes('--dangerously-skip-permissions')) features.push('permission-bypass');
    
    return features;
  }

  private generateRequestId(): string {
    return `claude-api-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Factory function to create Claude CLI client
 */
export function createClaudeClient(logger: ILogger, config?: ClaudeCliConfig): ClaudeApiClient {
  const defaultConfig: ClaudeCliConfig = {
    claudePath: process.env.CLAUDE_CLI_PATH || 'claude',
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    temperature: process.env.CLAUDE_TEMPERATURE ? parseFloat(process.env.CLAUDE_TEMPERATURE) : 0.7,
    maxTokens: process.env.CLAUDE_MAX_TOKENS ? parseInt(process.env.CLAUDE_MAX_TOKENS) : 4096,
    verbose: process.env.CLAUDE_VERBOSE === 'true',
    dangerouslySkipPermissions: process.env.CLAUDE_SKIP_PERMISSIONS === 'true' || true, // Default to true for automation
    ...config
  };

  return new ClaudeApiClient(defaultConfig, logger);
}

export default ClaudeApiClient;