import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { copyPrompts, CopyOptions, CopyResult, CopyError } from './prompt-copier.js';
import { 
  PromptConfigManager, 
  PromptPathResolver, 
  PromptValidator,
  formatDuration,
  formatFileSize
} from './prompt-utils.js';
import { Logger } from '../core/logger.js';
import * as fs from 'node:fs/promises';

export interface PromptManagerOptions {
  configPath?: string;
  basePath?: string;
  autoDiscovery?: boolean;
  defaultProfile?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface SyncOptions {
  bidirectional?: boolean;
  deleteOrphaned?: boolean;
  compareHashes?: boolean;
  incrementalOnly?: boolean;
  dryRun?: boolean;
  backup?: boolean;
}

export interface ValidationReport {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  issues: Array<{
    file: string;
    issues: string[];
    metadata?: any;
  }>;
  performance: {
    duration: number;
    filesPerSecond: number;
  };
}

export interface SyncResult {
  forward: CopyResult;
  backward?: CopyResult;
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    duration: number;
  };
}

/**
 * Enterprise-grade prompt manager with comprehensive features and monitoring
 */
export class PromptManager extends EventEmitter {
  private configManager: PromptConfigManager;
  private pathResolver: PromptPathResolver;
  private options: Required<PromptManagerOptions>;
  private logger: Logger;

  constructor(options: PromptManagerOptions = {}) {
    super();
    
    this.options = {
      configPath: options.configPath || '.prompt-config.tson',
      basePath: options.basePath || process.cwd(),
      autoDiscovery: options.autoDiscovery ?? true,
      defaultProfile: options.defaultProfile || 'sparc',
      logLevel: options.logLevel || 'info'
    };

    this.logger = new Logger({
      level: this.options.logLevel,
      format: 'text',
      destination: 'console'
    });

    this.configManager = new PromptConfigManager(
      path.resolve(this.options.basePath, this.options.configPath)
    );
    this.pathResolver = new PromptPathResolver(this.options.basePath);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Enterprise PromptManager...');
    
    try {
      // Load configuration
      await this.configManager.loadConfig();
      
      // Auto-discover prompt directories if enabled
      if (this.options.autoDiscovery) {
        const discovered = await this.pathResolver.discoverPromptDirectories();
        if (discovered.length > 0) {
          this.logger.info(`Auto-discovered ${discovered.length} prompt directories`);
          
          // Update config with discovered directories
          const config = this.configManager.getConfig();
          const uniqueDirs = Array.from(new Set([
            ...config.sourceDirectories,
            ...discovered.map(dir => path.relative(this.options.basePath, dir))
          ]));
          
          await this.configManager.saveConfig({
            sourceDirectories: uniqueDirs
          });
        }
      }
      
      this.emit('initialized');
      this.logger.info('PromptManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PromptManager:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async copyPrompts(options: Partial<CopyOptions> = {}): Promise<CopyResult> {
    const startTime = Date.now();
    
    try {
      const config = this.configManager.getConfig();
      const profile = this.options.defaultProfile;
      
      // Resolve paths
      const resolved = this.pathResolver.resolvePaths(
        config.sourceDirectories,
        config.destinationDirectory
      );

      if (resolved.sources.length === 0) {
        throw new Error('No valid source directories found');
      }

      // Build copy options with enterprise defaults
      const copyOptions: CopyOptions = {
        source: resolved.sources[0], // Use first available source
        destination: resolved.destination,
        ...this.configManager.getProfile(profile),
        ...options,
        // Enterprise defaults (applied last to override profile/options if needed)
        backup: options.backup ?? true,
        verify: options.verify ?? true,
        parallel: options.parallel ?? true
      };

      this.logger.info('Starting enterprise prompt copy operation', {
        source: copyOptions.source,
        destination: copyOptions.destination,
        profile,
        backup: copyOptions.backup,
        verify: copyOptions.verify
      });

      this.emit('copyStart', copyOptions);

      const result = await copyPrompts(copyOptions);

      // Add performance metrics
      const duration = Date.now() - startTime;
      this.logger.info('Copy operation completed', {
        success: result.success,
        duration,
        copiedFiles: result.copiedFiles,
        failedFiles: result.failedFiles,
        bytesTransferred: result.bytesTransferred
      });

      this.emit('copyComplete', result);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Copy operation failed', { error, duration });
      this.emit('copyError', error);
      throw error;
    }
  }

  async copyFromMultipleSources(options: Partial<CopyOptions> = {}): Promise<CopyResult[]> {
    const config = this.configManager.getConfig();
    const resolved = this.pathResolver.resolvePaths(
      config.sourceDirectories,
      config.destinationDirectory
    );

    const results: CopyResult[] = [];
    const startTime = Date.now();
    
    this.logger.info(`Starting multi-source copy from ${resolved.sources.length} sources`);
    
    for (const source of resolved.sources) {
      try {
        const copyOptions: CopyOptions = {
          source,
          destination: resolved.destination,
          ...this.configManager.getProfile(this.options.defaultProfile),
          ...options,
          // Enterprise defaults
          backup: options.backup ?? true,
          verify: options.verify ?? true
        };

        this.logger.info(`Copying from source: ${source}`);
        const result = await copyPrompts(copyOptions);
        results.push(result);
        
        this.emit('sourceComplete', { source, result });
        
      } catch (error) {
        this.logger.error(`Failed to copy from ${source}:`, error);
        this.emit('sourceError', { source, error });
        
        // Add error result with proper typing
        const errorResult: CopyResult = {
          success: false,
          totalFiles: 0,
          copiedFiles: 0,
          failedFiles: 1,
          skippedFiles: 0,
          errors: [{
            file: source,
            error: (error as Error).message,
            phase: 'read',
            timestamp: new Date()
          } as CopyError],
          duration: 0,
          bytesTransferred: 0
        };
        results.push(errorResult);
      }
    }

    const totalDuration = Date.now() - startTime;
    this.logger.info('Multi-source copy completed', {
      sources: resolved.sources.length,
      results: results.length,
      duration: totalDuration
    });

    return results;
  }

  async validatePrompts(sourcePath?: string): Promise<ValidationReport> {
    const startTime = Date.now();
    
    try {
      const config = this.configManager.getConfig();
      const sources = sourcePath ? [sourcePath] : config.sourceDirectories;
      
      const resolved = this.pathResolver.resolvePaths(
        sources,
        config.destinationDirectory
      );

      let totalFiles = 0;
      let validFiles = 0;
      let invalidFiles = 0;
      const issues: ValidationReport['issues'] = [];

      this.logger.info(`Starting validation of ${resolved.sources.length} source directories`);

      for (const source of resolved.sources) {
        await this.validateDirectory(source, issues);
      }

      totalFiles = issues.length;
      validFiles = issues.filter(issue => issue.issues.length === 0).length;
      invalidFiles = totalFiles - validFiles;

      const duration = Date.now() - startTime;
      const filesPerSecond = totalFiles > 0 ? totalFiles / (duration / 1000) : 0;

      const report: ValidationReport = {
        totalFiles,
        validFiles,
        invalidFiles,
        issues: issues.filter(issue => issue.issues.length > 0), // Only include files with issues
        performance: {
          duration,
          filesPerSecond
        }
      };

      this.logger.info('Validation completed', {
        totalFiles,
        validFiles,
        invalidFiles,
        duration,
        filesPerSecond: filesPerSecond.toFixed(2)
      });

      this.emit('validationComplete', report);
      return report;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Validation failed', { error, duration });
      throw error;
    }
  }

  private async validateDirectory(dirPath: string, issues: ValidationReport['issues']): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isFile() && this.isPromptFile(entry.name)) {
          try {
            const result = await PromptValidator.validatePromptFile(fullPath);
            
            issues.push({
              file: fullPath,
              issues: result.issues,
              metadata: result.metadata
            });
          } catch (error) {
            this.logger.warn(`Failed to validate file ${fullPath}:`, error);
            issues.push({
              file: fullPath,
              issues: [`Validation error: ${(error as Error).message}`],
              metadata: {}
            });
          }
        } else if (entry.isDirectory()) {
          await this.validateDirectory(fullPath, issues);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to validate directory ${dirPath}:`, error);
    }
  }

  private isPromptFile(fileName: string): boolean {
    const config = this.configManager.getConfig();
    const patterns = config.defaultOptions.includePatterns;
    
    return patterns.some(pattern => {
      const regex = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      return new RegExp(regex).test(fileName);
    });
  }

  async syncPrompts(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      const config = this.configManager.getConfig();
      const resolved = this.pathResolver.resolvePaths(
        config.sourceDirectories,
        config.destinationDirectory
      );

      const syncOptions: SyncOptions = {
        bidirectional: false,
        deleteOrphaned: false,
        compareHashes: true,
        incrementalOnly: true,
        backup: true, // Enterprise default
        ...options
      };

      this.logger.info('Starting enterprise sync operation', syncOptions);

      // Forward sync (source to destination)
      const forwardResult = await this.performIncrementalSync(
        resolved.sources[0],
        resolved.destination,
        syncOptions
      );

      let backwardResult: CopyResult | undefined;
      let totalOperations = 1;

      // Backward sync if bidirectional
      if (syncOptions.bidirectional) {
        backwardResult = await this.performIncrementalSync(
          resolved.destination,
          resolved.sources[0],
          syncOptions
        );
        totalOperations = 2;
      }

      const duration = Date.now() - startTime;
      const successfulOperations = (forwardResult.success ? 1 : 0) + (backwardResult?.success ? 1 : 0);
      const failedOperations = totalOperations - successfulOperations;

      const result: SyncResult = {
        forward: forwardResult,
        ...(backwardResult !== undefined && { backward: backwardResult }),
        summary: {
          totalOperations,
          successfulOperations,
          failedOperations,
          duration
        }
      };

      this.logger.info('Sync operation completed', {
        totalOperations,
        successfulOperations,
        failedOperations,
        duration
      });

      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Sync operation failed', { error, duration });
      throw error;
    }
  }

  private async performIncrementalSync(
    source: string,
    destination: string,
    options: SyncOptions
  ): Promise<CopyResult> {
    // Enhanced sync logic with enterprise features
    const copyOptions: CopyOptions = {
      source,
      destination,
      overwrite: !options.incrementalOnly
    };

    // Add optional properties only if they're defined
    if (options.backup !== undefined) {
      copyOptions.backup = options.backup;
    }
    if (options.compareHashes !== undefined) {
      copyOptions.verify = options.compareHashes;
    }
    if (options.dryRun !== undefined) {
      copyOptions.dryRun = options.dryRun;
    }

    return copyPrompts(copyOptions);
  }

  async generateReport(): Promise<{
    configuration: any;
    sources: Array<{
      path: string;
      exists: boolean;
      fileCount?: number;
      totalSize?: number;
      lastModified?: Date;
    }>;
    validation?: ValidationReport;
    performance: {
      generationTime: number;
      timestamp: Date;
    };
  }> {
    const startTime = Date.now();
    
    try {
      const config = this.configManager.getConfig();
      const resolved = this.pathResolver.resolvePaths(
        config.sourceDirectories,
        config.destinationDirectory
      );

      // Analyze sources with enhanced metrics
      const sources = await Promise.all(
        resolved.sources.map(async (sourcePath) => {
          try {
            const stats = await fs.stat(sourcePath);
            
            if (!stats.isDirectory()) {
              return { path: sourcePath, exists: false };
            }

            // Count files and calculate total size
            let fileCount = 0;
            let totalSize = 0;
            let lastModified = new Date(0);

            const scanDir = async (dir: string) => {
              const entries = await fs.readdir(dir, { withFileTypes: true });
              
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isFile() && this.isPromptFile(entry.name)) {
                  const fileStats = await fs.stat(fullPath);
                  fileCount++;
                  totalSize += fileStats.size;
                  
                  if (fileStats.mtime > lastModified) {
                    lastModified = fileStats.mtime;
                  }
                } else if (entry.isDirectory()) {
                  await scanDir(fullPath);
                }
              }
            };

            await scanDir(sourcePath);

            return {
              path: sourcePath,
              exists: true,
              fileCount,
              totalSize,
              lastModified
            };
          } catch (error) {
            this.logger.warn(`Failed to analyze source ${sourcePath}:`, error);
            return { path: sourcePath, exists: false };
          }
        })
      );

      const generationTime = Date.now() - startTime;

      const report = {
        configuration: config,
        sources,
        performance: {
          generationTime,
          timestamp: new Date()
        }
      };

      this.logger.info('Report generated successfully', {
        sources: sources.length,
        generationTime
      });

      return report;
      
    } catch (error) {
      this.logger.error('Failed to generate report:', error);
      throw error;
    }
  }

  // Utility methods with enhanced functionality
  getConfig() {
    return this.configManager.getConfig();
  }

  async updateConfig(updates: any): Promise<void> {
    try {
      await this.configManager.saveConfig(updates);
      this.logger.info('Configuration updated successfully');
    } catch (error) {
      this.logger.error('Failed to update configuration:', error);
      throw error;
    }
  }

  getProfiles(): string[] {
    return this.configManager.listProfiles();
  }

  getProfile(name: string) {
    return this.configManager.getProfile(name);
  }

  async discoverPromptDirectories(): Promise<string[]> {
    try {
      const directories = await this.pathResolver.discoverPromptDirectories();
      this.logger.info(`Discovered ${directories.length} prompt directories`);
      return directories;
    } catch (error) {
      this.logger.error('Failed to discover prompt directories:', error);
      throw error;
    }
  }

  // Health check and monitoring
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
      duration: number;
    }>;
  }> {
    const checks: any[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check configuration
    const configStart = Date.now();
    try {
      this.configManager.getConfig();
      checks.push({
        name: 'configuration',
        status: 'pass',
        duration: Date.now() - configStart
      });
    } catch (error) {
      checks.push({
        name: 'configuration',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - configStart
      });
      overallStatus = 'unhealthy';
    }

    // Check source directories
    const sourcesStart = Date.now();
    try {
      const config = this.configManager.getConfig();
      const resolved = this.pathResolver.resolvePaths(
        config.sourceDirectories,
        config.destinationDirectory
      );
      
      if (resolved.sources.length === 0) {
        checks.push({
          name: 'sources',
          status: 'fail',
          message: 'No valid source directories found',
          duration: Date.now() - sourcesStart
        });
        overallStatus = 'degraded';
      } else {
        checks.push({
          name: 'sources',
          status: 'pass',
          message: `${resolved.sources.length} sources available`,
          duration: Date.now() - sourcesStart
        });
      }
    } catch (error) {
      checks.push({
        name: 'sources',
        status: 'fail',
        message: (error as Error).message,
        duration: Date.now() - sourcesStart
      });
      overallStatus = 'unhealthy';
    }

    return { status: overallStatus, checks };
  }
}

// Export factory function with enterprise defaults
export function createPromptManager(options?: PromptManagerOptions): PromptManager {
  return new PromptManager({
    logLevel: 'info',
    autoDiscovery: true,
    defaultProfile: 'sparc',
    ...options
  });
}

// Export singleton instance with lazy initialization
let defaultManager: PromptManager | null = null;

export function getDefaultPromptManager(): PromptManager {
  if (!defaultManager) {
    defaultManager = createPromptManager();
  }
  return defaultManager;
}