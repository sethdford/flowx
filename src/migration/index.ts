#!/usr/bin/env node
/**
 * FlowX Migration Tool
 * Provides CLI commands for migrating existing projects to optimized configurations
 */

import { Command } from 'commander';
import { MigrationAnalyzer } from './migration-analyzer.js';
import { MigrationRunner } from './migration-runner.js';
import { RollbackManager } from './rollback-manager.js';
import { logger } from '../core/logger.js';
import { colors } from '../utils/colors.js';
import { MigrationStrategy } from './types.js';
import { ValidationError } from '../utils/errors.js';
import { MigrationValidator } from './migration-validator.js';
import * as path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

const program = new Command()
  .name('flowx-migrate')
  .description('Migrate existing flowx projects to optimized prompts')
  .version('1.0.0');

program
  .command('analyze [path]')
  .description('Analyze existing project for migration readiness')
  .option('-d, --detailed', 'Show detailed analysis')
  .option('-o, --output <file>', 'Output analysis to file')
  .action(async (projectPath = '.', options) => {
    try {
      const analyzer = new MigrationAnalyzer();
      const analysis = await analyzer.analyze(path.resolve(projectPath));
      
      if (options.output) {
        await analyzer.saveAnalysis(analysis, options.output);
        logger.info(`Analysis saved to ${options.output}`);
      }
      
      analyzer.printAnalysis(analysis, options.detailed);
    } catch (error) {
      logger.error('Analysis failed:', error);
      process.exit(1);
    }
  });

program
  .command('migrate [path]')
  .description('Migrate project to optimized prompts')
  .option('-s, --strategy <type>', 'Migration strategy: full, selective, merge', 'selective')
  .option('-b, --backup <dir>', 'Backup directory', '.claude-backup')
  .option('-f, --force', 'Force migration without prompts')
  .option('--dry-run', 'Simulate migration without making changes')
  .option('--preserve-custom', 'Preserve custom commands and configurations')
  .option('--skip-validation', 'Skip post-migration validation')
  .action(async (projectPath = '.', options) => {
    try {
      const runner = new MigrationRunner({
        projectPath: path.resolve(projectPath),
        strategy: options.strategy as MigrationStrategy,
        backupDir: options.backup,
        force: options.force,
        dryRun: options.dryRun,
        preserveCustom: options.preserveCustom,
        skipValidation: options.skipValidation
      });
      
      const result = await runner.run();
      logger.info(colors.green('Migration completed successfully!'));
      if (result.rollbackPath) {
        logger.info(colors.gray(`Backup created at: ${result.rollbackPath}`));
      }
    } catch (error) {
      logger.error('Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('rollback [path]')
  .description('Rollback to previous configuration')
  .option('-b, --backup <dir>', 'Backup directory to restore from', '.claude-backup')
  .option('-t, --timestamp <time>', 'Restore from specific timestamp')
  .option('-f, --force', 'Force rollback without prompts')
  .action(async (projectPath = '.', options) => {
    try {
      const runner = new MigrationRunner({
        projectPath: path.resolve(projectPath),
        strategy: 'full',
        backupDir: options.backup,
        force: options.force
      });
      
      await runner.rollback(options.timestamp);
    } catch (error) {
      logger.error('Rollback failed:', error);
      process.exit(1);
    }
  });

program
  .command('validate [path]')
  .description('Validate migration was successful')
  .option('-v, --verbose', 'Show detailed validation results')
  .action(async (projectPath = '.', options) => {
    try {
      const runner = new MigrationRunner({
        projectPath: path.resolve(projectPath),
        strategy: 'full'
      });
      
      const isValid = await runner.validate(options.verbose);
      
      if (isValid) {
        logger.info('Migration validated successfully!');
      } else {
        logger.error('Migration validation failed');
        process.exit(1);
      }
    } catch (error) {
      logger.error('Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('list-backups [path]')
  .description('List available backups')
  .option('-b, --backup <dir>', 'Backup directory', '.claude-backup')
  .action(async (projectPath = '.', options) => {
    try {
      const runner = new MigrationRunner({
        projectPath: path.resolve(projectPath),
        strategy: 'full',
        backupDir: options.backup
      });
      
      await runner.listBackups();
    } catch (error) {
      logger.error('Failed to list backups:', error);
      process.exit(1);
    }
  });

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse(process.argv);