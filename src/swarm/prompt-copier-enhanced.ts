import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import * as fs from 'fs/promises';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { PromptCopier } from './prompt-copier.js';
import type { CopyOptions, CopyResult, FileInfo } from './prompt-copier.js';
import { Logger } from '../core/logger.js';

interface WorkerPool {
  workers: Worker[];
  busy: Set<number>;
  queue: Array<() => void>;
}

export class EnhancedPromptCopier extends PromptCopier {
  private workerPool?: WorkerPool;
  private workerResults: Map<string, any> = new Map();
  private logger = new Logger({ level: 'info' });

  constructor(options: CopyOptions) {
    super(options);
  }

  public async copyFilesParallel(): Promise<void> {
    const workerCount = Math.min(this.options.maxWorkers || 4, this.fileQueue.length);

    // Initialize worker pool
    this.workerPool = await this.initializeWorkerPool(workerCount);

    try {
      // Process files using worker pool
      await this.processWithWorkerPool();
    } finally {
      // Cleanup workers
      await this.terminateWorkers();
    }
  }

  private async initializeWorkerPool(workerCount: number): Promise<WorkerPool> {
    const workers: Worker[] = [];
    const pool: WorkerPool = { workers, busy: new Set(), queue: [] };

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(path.join(__dirname, 'workers', 'copy-worker.js'), {
        workerData: { workerId: i },
      });
      worker.on('message', (result) => this.handleWorkerResult(result, i, pool));
      worker.on('error', (error) => {
        this.logger.error(`Worker ${i} error:`, error);
        this.errors.push({
          file: 'worker',
          error: error instanceof Error ? error.message : String(error),
          phase: 'write',
        });
      });
      workers.push(worker);
    }
    return pool;
  }

  private async processWithWorkerPool(): Promise<void> {
    // Basic implementation: process all files at once
    const promises = this.fileQueue.map(file => this.processFileWithWorker(file));
    await Promise.all(promises);
  }
  
  private processFileWithWorker(file: FileInfo): Promise<void> {
    return new Promise((resolve) => {
        const pool = this.workerPool!;
        const assignWork = () => {
            const workerIndex = pool.workers.findIndex((_, i) => !pool.busy.has(i));
            if (workerIndex === -1) {
                pool.queue.push(assignWork);
                return;
            }
            pool.busy.add(workerIndex);
            const worker = pool.workers[workerIndex];
            
            const messageHandler = (result: any) => {
                if(result.file === file.path) {
                    this.handleWorkerResult(result, workerIndex, pool);
                    worker.off('message', messageHandler);
                    resolve();
                }
            };
            worker.on('message', messageHandler);

            worker.postMessage({
                files: [{
                    sourcePath: file.path,
                    destPath: path.join(this.options.destination, file.relativePath),
                    permissions: this.options.preservePermissions ? file.permissions : undefined,
                    verify: this.options.verify,
                }]
            });
        };
        assignWork();
    });
  }

  private handleWorkerResult(result: any, workerId: number, pool: WorkerPool): void {
    if (result.success) {
        this.copiedFiles.add(result.file);
        if (result.hash) {
            this.workerResults.set(result.file, { hash: result.hash });
        }
    } else {
        this.errors.push({ file: result.file, error: result.error, phase: 'write' });
    }
    pool.busy.delete(workerId);
    if(pool.queue.length > 0) {
        pool.queue.shift()!();
    }
  }

  private async terminateWorkers(): Promise<void> {
    if (!this.workerPool) return;
    await Promise.all(this.workerPool.workers.map((worker) => worker.terminate()));
    this.workerPool = undefined;
  }

  protected override async verifyFiles(): Promise<void> {
    this.logger.info('Verifying copied files using worker results...');

    for (const file of this.fileQueue) {
      if (!this.copiedFiles.has(file.path)) continue;

      try {
        const destPath = path.join(this.options.destination, file.relativePath);

        // Verify file exists
        if (!(await this.fileExists(destPath))) {
          throw new Error('Destination file not found');
        }

        // Verify size
        const destStats = await fs.stat(destPath);
        if (destStats.size !== file.size) {
          throw new Error(`Size mismatch: ${destStats.size} != ${file.size}`);
        }

        // Use hash from worker if available
        const workerResult = this.workerResults.get(file.path);
        if (workerResult?.hash) {
          const sourceHash = await this.calculateFileHash(file.path);
          if (sourceHash !== workerResult.hash) {
            throw new Error(`Hash mismatch: ${sourceHash} != ${workerResult.hash}`);
          }
        }
      } catch (error) {
        this.errors.push({
          file: file.path,
          error: error instanceof Error ? error.message : String(error),
          phase: 'verify',
        });
      }
    }
  }
}

export async function copyPromptsEnhanced(options: CopyOptions): Promise<CopyResult> {
  const copier = new EnhancedPromptCopier(options);
  return copier.copy();
} 