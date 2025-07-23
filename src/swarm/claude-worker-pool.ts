/**
 * Claude Worker Pool
 * 
 * This implements a child_process.fork() pool approach that solves Claude CLI hanging issues
 * by distributing execution across isolated Node.js worker processes.
 * 
 * Based on Val Town's research that improved subprocess performance from 651 req/s to 2,209 req/s
 * https://blog.val.town/blog/node-spawn-performance/
 */

import { fork, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { generateId } from '../utils/helpers.js';
import type { TaskDefinition, AgentState } from './types.js';
import type { ExecutionContext, ExecutionResult } from './executor.js';

export interface ClaudeExecutionOptionsV2 {
  timeout?: number;
  tools?: string[];
  verbose?: boolean;
}

interface Worker {
  process: ChildProcess;
  ee: EventEmitter;
  busy: boolean;
  requests: number;
}

export class ClaudeWorkerPool {
  private workers: Worker[] = [];
  private static instance: ClaudeWorkerPool;

  static getInstance(): ClaudeWorkerPool {
    if (!ClaudeWorkerPool.instance) {
      ClaudeWorkerPool.instance = new ClaudeWorkerPool();
    }
    return ClaudeWorkerPool.instance;
  }

  async initialize(workerCount: number = 4): Promise<void> {
    if (this.workers.length > 0) return; // Already initialized

    console.log(`🔄 Initializing Claude worker pool with ${workerCount} workers...`);
    
    for (let i = 0; i < workerCount; i++) {
      const worker = await this.createWorker();
      this.workers.push(worker);
    }
    
    console.log(`✅ Claude worker pool initialized with ${this.workers.length} workers`);
  }

  private async createWorker(): Promise<Worker> {
    // FIXED: Use path.join to resolve worker script location properly
    const path = await import('node:path');
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const workerPath = path.join(__dirname, 'claude-worker.js');
    
    console.log(`🔧 Creating worker process: ${workerPath}`);
    
    const process = fork(workerPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      silent: false // CHANGED: Enable output to see worker logs
    });

    const ee = new EventEmitter();
    
    // Route messages from worker to EventEmitter by task ID
    process.on('message', ([taskId, type, data]: [string, string, any]) => {
      console.log(`📨 Worker ${process.pid} message: ${taskId}:${type}`);
      ee.emit(`${taskId}:${type}`, data);
    });
    
    // Add error handling for worker processes
    process.on('error', (error) => {
      console.error(`❌ Worker ${process.pid} error:`, error);
    });
    
    process.on('exit', (code, signal) => {
      console.log(`🚪 Worker ${process.pid} exited: code=${code}, signal=${signal}`);
    });

    const worker: Worker = {
      process,
      ee,
      busy: false,
      requests: 0
    };
    
    console.log(`✅ Worker ${process.pid} created successfully`);
    return worker;
  }

  getAvailableWorker(): Worker {
    // Find least busy worker
    return this.workers.reduce((selected, worker) => 
      worker.requests < selected.requests ? worker : selected
    );
  }

  async executeClaudeTask(
    task: TaskDefinition,
    agent: AgentState,
    context: ExecutionContext,
    options: ClaudeExecutionOptionsV2,
    buildClaudePrompt: (task: TaskDefinition, agent: AgentState) => string
  ): Promise<ExecutionResult> {
    await this.initialize(); // Ensure pool is ready
    
    const worker = this.getAvailableWorker();
    const taskId = generateId('claude-task');
    
    worker.busy = true;
    worker.requests++;

    const prompt = buildClaudePrompt(task, agent);
    
    // Send task to worker process
    const claudeCommand = {
      taskId,
      prompt,
      options: {
        workingDirectory: context.workingDirectory || process.cwd(),
        timeout: options.timeout || 300000,
        tools: options.tools || ['Write', 'Edit', 'Read', 'LS', 'Bash']
      }
    };

    console.log(`🚀 Sending task ${taskId} to worker ${worker.process.pid}`);
    worker.process.send(['execute', claudeCommand]);

    // Wait for result from worker
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        worker.busy = false;
        worker.requests--;
      };

      worker.ee.once(`${taskId}:success`, (result: ExecutionResult) => {
        cleanup();
        resolve(result);
      });

      worker.ee.once(`${taskId}:error`, (error: Error) => {
        cleanup();
        reject(error);
      });

      // Timeout fallback
      setTimeout(() => {
        cleanup();
        reject(new Error(`Claude task ${taskId} timed out`));
      }, options.timeout || 300000);
    });
  }

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Claude worker pool...');
    
    await Promise.all(this.workers.map(worker => {
      return new Promise<void>((resolve) => {
        worker.process.once('exit', () => resolve());
        worker.process.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!worker.process.killed) {
            worker.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });
    }));

    this.workers = [];
    console.log('✅ Claude worker pool shut down');
  }
} 