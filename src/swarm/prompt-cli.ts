#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { PromptManager } from './prompt-manager.js';
import { CopyOptions, copyPrompts } from './prompt-copier.js';
import { 
  PromptConfigManager, 
  PromptPathResolver, 
  PromptValidator,
  createProgressBar,
  formatFileSize,
  formatDuration
} from './prompt-utils.js';

// Enterprise logger for this module
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args)
};

const program = new Command();

program
  .name('prompt-copier')
  .description('Enterprise-grade prompt copying mechanism for FlowX')
  .version('2.0.0');

program
  .command('copy')
  .description('Copy prompts from source to destination with enterprise features')
  .option('-s, --source <path>', 'Source directory')
  .option('-d, --destination <path>', 'Destination directory')
  .option('-p, --profile <name>', 'Configuration profile to use')
  .option('--no-backup', 'Disable backup creation')
  .option('--no-verify', 'Disable file verification')
  .option('--no-parallel', 'Disable parallel processing')
  .option('--workers <number>', 'Number of worker threads', parseInt)
  .option('--conflict <strategy>', 'Conflict resolution strategy', /^(skip|overwrite|backup|merge)$/)
  .option('--include <patterns>', 'Include patterns (comma-separated)')
  .option('--exclude <patterns>', 'Exclude patterns (comma-separated)')
  .option('--dry-run', 'Show what would be copied without actually copying')
  .option('--enhanced', 'Use enhanced copier with worker threads')
  .action(async (options) => {
    try {
      const configManager = new PromptConfigManager();
      const config = await configManager.loadConfig();
      
      let copyOptions: CopyOptions;
      
      if (options.profile) {
        const profileOptions = configManager.getProfile(options.profile);
        copyOptions = {
          source: options.source || config.sourceDirectories[0],
          destination: options.destination || config.destinationDirectory,
          ...profileOptions
        };
      } else {
        copyOptions = {
          source: options.source || config.sourceDirectories[0],
          destination: options.destination || config.destinationDirectory,
          backup: options.backup !== false, // Default to true unless explicitly disabled
          verify: options.verify !== false, // Default to true unless explicitly disabled
          parallel: options.parallel !== false, // Default to true unless explicitly disabled
          maxWorkers: options.workers || config.defaultOptions.maxWorkers,
          conflictResolution: options.conflict || config.defaultOptions.conflictResolution,
          includePatterns: options.include ? options.include.split(',') : config.defaultOptions.includePatterns,
          excludePatterns: options.exclude ? options.exclude.split(',') : config.defaultOptions.excludePatterns,
          dryRun: options.dryRun,
          overwrite: options.conflict === 'overwrite'
        };
      }

      // Create progress bar
      let progressBar: ReturnType<typeof createProgressBar> | null = null;
      
      copyOptions.progressCallback = (progress) => {
        if (!progressBar) {
          progressBar = createProgressBar(progress.total);
        }
        progressBar.update(progress.completed);
        
        if (progress.completed === progress.total) {
          progressBar.complete();
        }
      };

      console.log('🚀 Starting enterprise prompt copy operation...');
      console.log(`📁 Source: ${copyOptions.source}`);
      console.log(`📁 Destination: ${copyOptions.destination}`);
      
      if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No files will be modified');
      }

      const startTime = Date.now();
      const result = await copyPrompts(copyOptions);

      console.log('\n=== Enterprise Copy Results ===');
      console.log(`✅ Success: ${result.success ? '✅' : '❌'}`);
      console.log(`📊 Total files: ${result.totalFiles}`);
      console.log(`📋 Copied: ${result.copiedFiles}`);
      console.log(`⚠️  Failed: ${result.failedFiles}`);
      console.log(`⏭️  Skipped: ${result.skippedFiles}`);
      console.log(`⏱️  Duration: ${formatDuration(result.duration)}`);
      
      if (result.bytesTransferred) {
        console.log(`💾 Data transferred: ${formatFileSize(result.bytesTransferred)}`);
      }

      if (result.backupLocation) {
        console.log(`🔄 Backup created: ${result.backupLocation}`);
      }

      if (result.errors.length > 0) {
        console.log('\n=== ⚠️ Errors ===');
        result.errors.forEach(error => {
          const timestamp = error.timestamp.toISOString();
          console.log(`❌ [${timestamp}] ${error.file}: ${error.error} (${error.phase})`);
        });
      }

      // Performance metrics
      const throughput = result.bytesTransferred ? 
        (result.bytesTransferred / (result.duration / 1000) / 1024 / 1024).toFixed(2) : 
        'N/A';
      
      console.log('\n=== 📈 Performance Metrics ===');
      console.log(`🏃 Throughput: ${throughput} MB/s`);
      console.log(`⚡ Files/sec: ${(result.copiedFiles / (result.duration / 1000)).toFixed(2)}`);
      
      if (!result.success) {
        process.exit(1);
      }

    } catch (error: any) {
      logger.error('Copy operation failed:', error);
      console.error('❌ Enterprise copy operation failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('discover')
  .description('Discover prompt directories in the current project')
  .option('-b, --base <path>', 'Base path to search from', process.cwd())
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const resolver = new PromptPathResolver(options.base);
      const directories = await resolver.discoverPromptDirectories();
      
      if (options.tson) {
        console.log(JSON.stringify({ directories }, null, 2));
        return;
      }
      
      console.log('📁 Discovered prompt directories:');
      directories.forEach((dir, index) => {
        console.log(`  ${index + 1}. 📂 ${dir}`);
      });
      
      if (directories.length === 0) {
        console.log('  ℹ️  No prompt directories found');
      } else {
        console.log(`\n✅ Found ${directories.length} prompt directories`);
      }
    } catch (error) {
      logger.error('Discovery failed:', error);
      console.error('❌ Discovery failed:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate prompt files with enterprise standards')
  .argument('<path>', 'Path to validate (file or directory)')
  .option('--recursive', 'Validate recursively')
  .option('--json', 'Output in JSON format')
  .option('--strict', 'Use strict validation rules')
  .action(async (filePath, options) => {
    try {
      const stats = await fs.stat(filePath);
      const files: string[] = [];
      
      if (stats.isFile()) {
        files.push(filePath);
      } else if (stats.isDirectory()) {
        // Scan directory for prompt files
        const scanDir = async (dir: string) => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isFile() && (
              entry.name.endsWith('.md') || 
              entry.name.endsWith('.txt') || 
              entry.name.endsWith('.prompt')
            )) {
              files.push(fullPath);
            } else if (entry.isDirectory() && options.recursive) {
              await scanDir(fullPath);
            }
          }
        };
        
        await scanDir(filePath);
      }
      
      console.log(`🔍 Validating ${files.length} files with enterprise standards...`);
      
      let validFiles = 0;
      let invalidFiles = 0;
      const results: any[] = [];
      
      for (const file of files) {
        const result = await PromptValidator.validatePromptFile(file);
        
        if (result.valid) {
          validFiles++;
          if (!options.tson) {
            console.log(`✅ ${file}`);
          }
        } else {
          invalidFiles++;
          if (!options.tson) {
            console.log(`❌ ${file}`);
            result.issues.forEach((issue: string) => {
              console.log(`   ⚠️  ${issue}`);
            });
          }
        }
        
        if (options.tson) {
          results.push({
            file,
            valid: result.valid,
            issues: result.issues,
            metadata: result.metadata
          });
        } else if (result.metadata && Object.keys(result.metadata).length > 0) {
          console.log(`   📊 Metadata: ${JSON.stringify(result.metadata)}`);
        }
      }
      
      if (options.tson) {
        console.log(JSON.stringify({
          summary: { total: files.length, valid: validFiles, invalid: invalidFiles },
          results
        }, null, 2));
      } else {
        console.log(`\n📊 Validation complete: ${validFiles} valid, ${invalidFiles} invalid`);
        
        if (invalidFiles > 0) {
          console.log('⚠️  Some files failed validation. Consider fixing issues for enterprise compliance.');
          process.exit(1);
        } else {
          console.log('✅ All files meet enterprise standards!');
        }
      }
      
    } catch (error) {
      logger.error('Validation failed:', error);
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage enterprise configuration')
  .option('--init', 'Initialize default configuration')
  .option('--show', 'Show current configuration')
  .option('--profiles', 'List available profiles')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const configManager = new PromptConfigManager();
      
      if (options.init) {
        await configManager.saveConfig();
        console.log('✅ Enterprise configuration initialized');
      } else if (options.show) {
        const config = await configManager.loadConfig();
        if (options.tson) {
          console.log(JSON.stringify(config, null, 2));
        } else {
          console.log('📋 Current Configuration:');
          console.log(JSON.stringify(config, null, 2));
        }
      } else if (options.profiles) {
        const config = await configManager.loadConfig();
        const profiles = configManager.listProfiles();
        
        if (options.tson) {
          const profileData: Record<string, any> = {};
          profiles.forEach(profile => {
            profileData[profile] = configManager.getProfile(profile);
          });
          console.log(JSON.stringify(profileData, null, 2));
        } else {
          console.log('📋 Available enterprise profiles:');
          profiles.forEach(profile => {
            console.log(`  🏷️  ${profile}`);
            const profileOptions = configManager.getProfile(profile);
            Object.entries(profileOptions).forEach(([key, value]) => {
              console.log(`     ${key}: ${JSON.stringify(value)}`);
            });
          });
        }
      } else {
        console.log('Use --init, --show, or --profiles');
      }
    } catch (error) {
      logger.error('Configuration operation failed:', error);
      console.error('❌ Configuration operation failed:', error);
      process.exit(1);
    }
  });

program
  .command('rollback')
  .description('Rollback from backup with enterprise safety')
  .argument('<manifest>', 'Path to backup manifest file')
  .option('--confirm', 'Confirm rollback operation')
  .action(async (manifestPath, options) => {
    try {
      if (!options.confirm) {
        console.log('⚠️  Rollback is a destructive operation.');
        console.log('Use --confirm flag to proceed with rollback.');
        process.exit(1);
      }

      const { PromptCopier } = await import('./prompt-copier.ts');
      const copier = new PromptCopier({
        source: '',
        destination: ''
      });
      
      console.log('🔄 Starting enterprise rollback operation...');
      await copier.restoreFromBackup(manifestPath);
      console.log('✅ Enterprise rollback completed successfully');
    } catch (error) {
      logger.error('Rollback failed:', error);
      console.error('❌ Enterprise rollback failed:', error);
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Synchronize prompts between directories with enterprise features')
  .option('-s, --source <path>', 'Source directory')
  .option('-d, --destination <path>', 'Destination directory')
  .option('--bidirectional', 'Enable bidirectional sync')
  .option('--delete', 'Delete files not present in source')
  .option('--dry-run', 'Show what would be synchronized')
  .action(async (options) => {
    try {
      console.log('🔄 Enterprise sync functionality');
      console.log('📊 Sync options:', JSON.stringify(options, null, 2));
      
      if (options.dryRun) {
        console.log('🔍 DRY RUN: Would synchronize directories');
        console.log(`📁 Source: ${options.source}`);
        console.log(`📁 Destination: ${options.destination}`);
        console.log(`🔄 Bidirectional: ${options.bidirectional ? 'Yes' : 'No'}`);
        console.log(`🗑️  Delete orphaned: ${options.delete ? 'Yes' : 'No'}`);
      } else {
        console.log('⚠️  Enterprise sync functionality is under development');
        console.log('Use --dry-run to preview sync operations');
      }
    } catch (error) {
      logger.error('Sync failed:', error);
      console.error('❌ Enterprise sync failed:', error);
      process.exit(1);
    }
  });

// Enterprise error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error('💥 Critical error occurred:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  console.error('💥 Unhandled promise rejection:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received interrupt signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received termination signal. Shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  program.parse();
}

export { program };