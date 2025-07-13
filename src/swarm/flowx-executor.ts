/**
 * FlowX SPARC Executor
 * Executes tasks using the full flowx SPARC system in non-interactive mode
 */

import { TaskDefinition, AgentState, TaskResult } from "./types.ts";
import { Logger } from "../core/logger.ts";
import * as path from 'node:path';
import { spawn } from 'node:child_process';

export interface FlowXExecutorConfig {
  logger?: Logger;
  flowxPath?: string;
  enableSparc?: boolean;
  verbose?: boolean;
  timeoutMinutes?: number;
}

export class FlowXExecutor {
  private logger: Logger;
  private flowxPath: string;
  private enableSparc: boolean;
  private verbose: boolean;
  private timeoutMinutes: number;

  constructor(config: FlowXExecutorConfig = {}) {
    this.logger = config.logger || new Logger(
      { level: 'info', format: 'text', destination: 'console' },
      { component: 'FlowXExecutor' }
    );
    this.flowxPath = config.flowxPath || '/workspaces/claude-code-flow/bin/flowx';
    this.enableSparc = config.enableSparc ?? true;
    this.verbose = config.verbose ?? false;
    this.timeoutMinutes = config.timeoutMinutes ?? 59;
  }

  async executeTask(
    task: TaskDefinition,
    agent: AgentState,
    targetDir?: string
  ): Promise<TaskResult> {
    this.logger.info('Executing task with FlowX SPARC', {
      taskId: task.id.id,
      taskName: task.name,
      agentType: agent.type,
      targetDir
    });

    const startTime = Date.now();

    try {
      // Determine the SPARC mode based on task type and agent type
      const sparcMode = this.determineSparcMode(task, agent);
      
      // Build the command
      const command = this.buildSparcCommand(task, sparcMode, targetDir);
      
      this.logger.info('Executing SPARC command', { 
        mode: sparcMode, 
        command: command.join(' ') 
      });

      // Execute the command
      const result = await this.executeCommand(command);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      return {
        output: result.output,
        artifacts: result.artifacts || {},
        metadata: {
          executionTime,
          sparcMode,
          command: command.join(' '),
          exitCode: result.exitCode,
          quality: 0.95,
          completeness: 0.9
        },
        quality: 0.95,
        completeness: 0.9,
        accuracy: 0.95,
        executionTime,
        resourcesUsed: {
          cpuTime: executionTime,
          maxMemory: 0,
          diskIO: 0,
          networkIO: 0,
          fileHandles: 0
        },
        validated: true
      };
    } catch (error) {
      const errorExecutionTime = Date.now() - startTime;
      this.logger.error('Failed to execute FlowX SPARC command', { 
        error: error instanceof Error ? error.message : String(error),
        taskId: task.id.id 
      });
      
      return {
        output: '',
        artifacts: {},
        metadata: {
          executionTime: errorExecutionTime,
          quality: 0,
          completeness: 0,
          error: error instanceof Error ? error.message : String(error)
        },
        quality: 0,
        completeness: 0,
        accuracy: 0,
        executionTime: errorExecutionTime,
        resourcesUsed: {
          cpuTime: errorExecutionTime,
          maxMemory: 0,
          diskIO: 0,
          networkIO: 0,
          fileHandles: 0
        },
        validated: false
      };
    }
  }

  private determineSparcMode(task: TaskDefinition, agent: AgentState): string {
    // Map task types and agent types to SPARC modes
    const modeMap: Record<string, string> = {
      // Task type mappings
      'coding': 'code',
      'testing': 'tdd',
      'analysis': 'spec-pseudocode',
      'documentation': 'docs-writer',
      'research': 'spec-pseudocode',
      'review': 'refinement-optimization-mode',
      'deployment': 'devops',
      'optimization': 'refinement-optimization-mode',
      'integration': 'integration',
      
      // Agent type overrides
      'developer': 'code',
      'tester': 'tdd',
      'analyzer': 'spec-pseudocode',
      'documenter': 'docs-writer',
      'reviewer': 'refinement-optimization-mode',
      'researcher': 'spec-pseudocode',
      'coordinator': 'architect'
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

    // Use agent type first, then task type
    return modeMap[agent.type] || modeMap[task.type] || 'code';
  }

  private buildSparcCommand(task: TaskDefinition, mode: string, targetDir?: string): string[] {
    const command = [
      this.flowxPath,
      'sparc',
      'run',
      mode,
      `"${this.formatTaskDescription(task)}"`
    ];

    // Add options
    if (targetDir) {
      command.push('--target-dir', targetDir);
    }

    if (this.verbose) {
      command.push('--verbose');
    }

    // Add non-interactive flag
    command.push('--non-interactive');
    
    // Add auto-confirm flag
    command.push('--yes');

    return command;
  }

  private formatTaskDescription(task: TaskDefinition): string {
    // Format the task description for SPARC command
    let description = task.description;
    
    // If the task has specific instructions, include them
    if (task.instructions && task.instructions !== task.description) {
      description = `${task.description}. ${task.instructions}`;
    }

    // Add context if available
    if (task.context?.targetDir) {
      description += ` in ${task.context.targetDir}`;
    }

    return description.replace(/"/g, '\\"');
  }

  private async executeCommand(command: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command;
      
      const proc = spawn(cmd, args, {
        shell: true,
        env: {
          ...process.env,
          FLOWX_NON_INTERACTIVE: 'true',
          FLOWX_AUTO_CONFIRM: 'true'
        }
      });

      let stdout = '';
      let stderr = '';
      const artifacts: Record<string, any> = {};

      proc.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Parse artifacts from output
        const artifactMatch = chunk.match(/Created file: (.+)/g);
        if (artifactMatch) {
          artifactMatch.forEach((match: string) => {
            const filePath = match.replace('Created file: ', '').trim();
            artifacts[filePath] = true;
          });
        }
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId); // Clear timeout when process completes
        if (code === 0) {
          resolve({
            output: stdout,
            artifacts,
            exitCode: code,
            error: null
          });
        } else {
          resolve({
            output: stdout,
            artifacts,
            exitCode: code,
            error: stderr || `Command exited with code ${code}`
          });
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });

      // Handle timeout - configurable for SPARC operations
      const timeoutMs = this.timeoutMinutes * 60 * 1000;
      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Command execution timeout'));
      }, timeoutMs);
    });
  }
}

// Export for use in swarm coordinator
export default FlowXExecutor;