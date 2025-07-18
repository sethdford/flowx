/**
 * Migration Runner - Executes migration strategies
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Helper function to check if path exists
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper function to ensure directory exists
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

// Helper function to copy files/directories
async function copyRecursive(src: string, dest: string, options: { overwrite?: boolean } = {}): Promise<void> {
  const stat = await fs.stat(src);
  
  if (stat.isDirectory()) {
    await ensureDir(dest);
    const entries = await fs.readdir(src);
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      await copyRecursive(srcPath, destPath, options);
    }
  } else {
    if (options.overwrite || !(await pathExists(dest))) {
      await fs.copyFile(src, dest);
    }
  }
}

// Helper function to remove files/directories recursively
async function removeRecursive(targetPath: string): Promise<void> {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore error if path doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

// Helper function to read JSON files
async function readJson(filePath: string): Promise<any> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

// Helper function to write JSON files
async function writeJson(filePath: string, data: any, options: { spaces?: number } = {}): Promise<void> {
  const content = JSON.stringify(data, null, options.spaces || 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

import { 
  MigrationOptions, 
  MigrationResult, 
  MigrationBackup,
  BackupFile,
  ValidationResult,
  MigrationProgress,
  MigrationManifest
} from './types.js';
import { MigrationAnalyzer } from './migration-analyzer.js';
import { logger } from '../core/logger.js';
import { ProgressReporter } from './progress-reporter.js';
import { MigrationValidator } from './migration-validator.js';
import globPkg from 'glob';
const { glob } = globPkg;
import * as inquirer from 'inquirer';
import { colors } from '../utils/colors.js';

export class MigrationRunner {
  private options: MigrationOptions;
  private progress: ProgressReporter;
  private analyzer: MigrationAnalyzer;
  private validator: MigrationValidator;
  private manifest: MigrationManifest;

  constructor(options: MigrationOptions) {
    this.options = options;
    this.progress = new ProgressReporter();
    this.analyzer = new MigrationAnalyzer();
    this.validator = new MigrationValidator();
    this.manifest = this.loadManifest();
  }

  async run(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      filesModified: [],
      filesCreated: [],
      filesBackedUp: [],
      errors: [],
      warnings: []
    };

    try {
      // Analyze project
      this.progress.start('analyzing', 'Analyzing project...');
      const analysis = await this.analyzer.analyze(this.options.projectPath);
      
      // Show analysis and confirm
      if (!this.options.force && !this.options.dryRun) {
        this.analyzer.printAnalysis(analysis);
        const confirm = await this.confirmMigration(analysis);
        if (!confirm) {
          logger.info('Migration cancelled');
          return result;
        }
      }

      // Create backup
      if (!this.options.dryRun && analysis.hasClaudeFolder) {
        this.progress.update('backing-up', 'Creating backup...');
        const backup = await this.createBackup();
        result.rollbackPath = backup.timestamp.toISOString();
        result.filesBackedUp = backup.files.map(f => f.path);
      }

      // Execute migration based on strategy
      this.progress.update('migrating', 'Migrating files...');
      
      switch (this.options.strategy) {
        case 'full':
          await this.fullMigration(result);
          break;
        case 'selective':
          await this.selectiveMigration(result, analysis);
          break;
        case 'merge':
          await this.mergeMigration(result, analysis);
          break;
      }

      // Validate migration
      if (!this.options.skipValidation && !this.options.dryRun) {
        this.progress.update('validating', 'Validating migration...');
        const validation = await this.validator.validate(this.options.projectPath);
        
        if (!validation.valid) {
          result.errors.push(...validation.errors.map(e => ({ error: e })));
          result.warnings.push(...validation.warnings);
        }
      }

      result.success = result.errors.length === 0;
      this.progress.complete(result.success ? 'Migration completed successfully!' : 'Migration completed with errors');

      // Print summary
      this.printSummary(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      result.errors.push({ error: errorMessage, stack: errorStack });
      this.progress.error('Migration failed');
      
      // Attempt rollback on failure
      if (result.rollbackPath && !this.options.dryRun) {
        logger.warn('Attempting automatic rollback...');
        try {
          await this.rollback(result.rollbackPath);
          logger.info('Rollback completed');
        } catch (rollbackError) {
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          logger.error('Rollback failed:', rollbackMessage);
        }
      }
    }

    return result;
  }

  private async fullMigration(result: MigrationResult): Promise<void> {
    const sourcePath = path.join(__dirname, '../../.claude');
    const targetPath = path.join(this.options.projectPath, '.claude');

    if (this.options.dryRun) {
      logger.info('[DRY RUN] Would replace entire .claude folder');
      return;
    }

    // Remove existing .claude folder
    if (await pathExists(targetPath)) {
      await removeRecursive(targetPath);
    }

    // Copy new .claude folder
    await copyRecursive(sourcePath, targetPath);
    result.filesCreated.push('.claude');

    // Copy other required files
    await this.copyRequiredFiles(result);
  }

  private async selectiveMigration(result: MigrationResult, analysis: any): Promise<void> {
    const sourcePath = path.join(__dirname, '../../.claude');
    const targetPath = path.join(this.options.projectPath, '.claude');

    // Ensure target directory exists
    await ensureDir(targetPath);

    // Migrate commands selectively
    const commandsSource = path.join(sourcePath, 'commands');
    const commandsTarget = path.join(targetPath, 'commands');
    await ensureDir(commandsTarget);

    // Copy optimized commands
    for (const command of Object.values(this.manifest.files.commands)) {
      const sourceFile = path.join(commandsSource, command.source);
      const targetFile = path.join(commandsTarget, command.target);

      if (this.options.preserveCustom && analysis.customCommands.includes(path.basename(command.target, '.md'))) {
        result.warnings.push(`Skipped ${command.target} (custom command preserved)`);
        continue;
      }

      if (this.options.dryRun) {
        logger.info(`[DRY RUN] Would copy ${command.source} to ${command.target}`);
      } else {
        await copyRecursive(sourceFile, targetFile, { overwrite: true });
        result.filesCreated.push(command.target);
      }
    }

    // Copy optimization guides
    const guides = [
      'BATCHTOOLS_GUIDE.md',
      'BATCHTOOLS_BEST_PRACTICES.md',
      'MIGRATION_GUIDE.md',
      'PERFORMANCE_BENCHMARKS.md'
    ];

    for (const guide of guides) {
      const sourceFile = path.join(sourcePath, guide);
      const targetFile = path.join(targetPath, guide);

      if (await pathExists(sourceFile)) {
        if (this.options.dryRun) {
          logger.info(`[DRY RUN] Would copy ${guide}`);
        } else {
          await copyRecursive(sourceFile, targetFile, { overwrite: true });
          result.filesCreated.push(guide);
        }
      }
    }

    // Update configurations
    await this.updateConfigurations(result);
  }

  private async mergeMigration(result: MigrationResult, analysis: any): Promise<void> {
    // Similar to selective but merges configurations
    await this.selectiveMigration(result, analysis);

    // Merge configurations
    if (!this.options.dryRun) {
      await this.mergeConfigurations(result, analysis);
    }
  }

  private async mergeConfigurations(result: MigrationResult, analysis: any): Promise<void> {
    // Merge CLAUDE.md
    const claudeMdPath = path.join(this.options.projectPath, 'CLAUDE.md');
    if (await pathExists(claudeMdPath)) {
      const existingContent = await fs.readFile(claudeMdPath, 'utf-8');
      const newContent = await this.getMergedClaudeMd(existingContent);
      
      await fs.writeFile(claudeMdPath, newContent);
      result.filesModified.push('CLAUDE.md');
    }

    // Merge .roomodes
    const roomodesPath = path.join(this.options.projectPath, '.roomodes');
    if (await pathExists(roomodesPath)) {
      const existing = await readJson(roomodesPath);
      const updated = await this.getMergedRoomodes(existing);
      
      await writeJson(roomodesPath, updated, { spaces: 2 });
      result.filesModified.push('.roomodes');
    }
  }

  private async copyRequiredFiles(result: MigrationResult): Promise<void> {
    const files = [
      { source: 'CLAUDE.md', target: 'CLAUDE.md' },
      { source: '.roomodes', target: '.roomodes' }
    ];

    for (const file of files) {
      const sourcePath = path.join(__dirname, '../../', file.source);
      const targetPath = path.join(this.options.projectPath, file.target);

      if (await pathExists(sourcePath)) {
        if (this.options.dryRun) {
          logger.info(`[DRY RUN] Would copy ${file.source}`);
        } else {
          await copyRecursive(sourcePath, targetPath, { overwrite: true });
          result.filesCreated.push(file.target);
        }
      }
    }
  }

  private async updateConfigurations(result: MigrationResult): Promise<void> {
    // Update package.tson scripts if needed
    const packageJsonPath = path.join(this.options.projectPath, 'package.tson');
    if (await pathExists(packageJsonPath)) {
      const packageJson = await readJson(packageJsonPath);
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      const scripts = {
        'migrate': 'flowx migrate',
        'migrate:analyze': 'flowx migrate analyze',
        'migrate:rollback': 'flowx migrate rollback'
      };

      let modified = false;
      for (const [name, command] of Object.entries(scripts)) {
        if (!packageJson.scripts[name]) {
          packageJson.scripts[name] = command;
          modified = true;
        }
      }

      if (modified && !this.options.dryRun) {
        await writeJson(packageJsonPath, packageJson, { spaces: 2 });
        result.filesModified.push('package.tson');
      }
    }
  }

  private async createBackup(): Promise<MigrationBackup> {
    const backupDir = path.join(this.options.projectPath, this.options.backupDir || '.claude-backup');
    const timestamp = new Date();
    const backupPath = path.join(backupDir, timestamp.toISOString().replace(/:/g, '-'));

    await ensureDir(backupPath);

    const backup: MigrationBackup = {
      timestamp,
      version: '1.0.0',
      files: [],
      metadata: {
        strategy: this.options.strategy,
        projectPath: this.options.projectPath
      }
    };

    // Backup .claude folder
    const claudePath = path.join(this.options.projectPath, '.claude');
    if (await pathExists(claudePath)) {
      await copyRecursive(claudePath, path.join(backupPath, '.claude'));
      
      // Record backed up files
      const files = await new Promise<string[]>((resolve, reject) => {
        glob('**/*', { cwd: claudePath, nodir: true }, (err, matches) => {
          if (err) reject(err);
          else resolve(matches);
        });
      });
      for (const file of files) {
        const content = await fs.readFile(path.join(claudePath, file), 'utf-8');
        backup.files.push({
          path: `.claude/${file}`,
          content,
          checksum: createHash('md5').update(content).digest('hex')
        });
      }
    }

    // Backup other important files
    const importantFiles = ['CLAUDE.md', '.roomodes', 'package.tson'];
    for (const file of importantFiles) {
      const filePath = path.join(this.options.projectPath, file);
      if (await pathExists(filePath)) {
        await copyRecursive(filePath, path.join(backupPath, file));
        const content = await fs.readFile(filePath, 'utf-8');
        backup.files.push({
          path: file,
          content,
          checksum: createHash('md5').update(content).digest('hex')
        });
      }
    }

    // Save backup manifest
    const manifestPath = path.join(backupPath, 'backup-manifest.tson');
    await writeJson(manifestPath, backup, { spaces: 2 });

    logger.info(`Backup created at ${backupPath}`);
    return backup;
  }

  async rollback(timestamp?: string): Promise<void> {
    const backupDir = path.join(this.options.projectPath, this.options.backupDir || '.claude-backup');
    
    if (!await pathExists(backupDir)) {
      throw new Error('No backups found');
    }

    let backupPath: string;
    
    if (timestamp) {
      backupPath = path.join(backupDir, timestamp);
    } else {
      // Use most recent backup
      const backups = await fs.readdir(backupDir);
      if (backups.length === 0) {
        throw new Error('No backups found');
      }
      backups.sort().reverse();
      backupPath = path.join(backupDir, backups[0]);
    }

    if (!await pathExists(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    logger.info(`Rolling back from ${backupPath}...`);

    // Confirm rollback
    if (!this.options.force) {
      const confirm = await inquirer.default.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Are you sure you want to rollback? This will overwrite current files.',
        default: false
      }]);

      if (!confirm.proceed) {
        logger.info('Rollback cancelled');
        return;
      }
    }

    // Restore files
    const backup = await readJson(path.join(backupPath, 'backup-manifest.tson'));
    
    for (const file of backup.files) {
      const targetPath = path.join(this.options.projectPath, file.path);
      await ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, file.content);
    }

    logger.info('Rollback completed successfully');
  }

  async validate(verbose: boolean = false): Promise<boolean> {
    const validation = await this.validator.validate(this.options.projectPath);
    
    if (verbose) {
      this.validator.printValidation(validation);
    }

    return validation.valid;
  }

  async listBackups(): Promise<void> {
    const backupDir = path.join(this.options.projectPath, this.options.backupDir || '.claude-backup');
    
    if (!await pathExists(backupDir)) {
      logger.info('No backups found');
      return;
    }

    const backups = await fs.readdir(backupDir);
    if (backups.length === 0) {
      logger.info('No backups found');
      return;
    }

    console.log(colors.bold('\n📦 Available Backups'));
    console.log(colors.gray('─'.repeat(50)));

    for (const backup of backups.sort().reverse()) {
      const backupPath = path.join(backupDir, backup);
      const stats = await fs.stat(backupPath);
      const manifest = await readJson(path.join(backupPath, 'backup-manifest.tson')).catch(() => null);

      console.log(`\n${colors.bold(backup)}`);
      console.log(`  Created: ${stats.mtime.toLocaleString()}`);
      console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
      
      if (manifest) {
        console.log(`  Version: ${manifest.version}`);
        console.log(`  Strategy: ${manifest.metadata.strategy}`);
        console.log(`  Files: ${manifest.files.length.toString()}`);
      }
    }

    console.log(colors.gray('\n' + '─'.repeat(50)));
  }

  private async confirmMigration(analysis: any): Promise<boolean> {
    const questions = [
      {
        type: 'confirm',
        name: 'proceed',
        message: `Proceed with ${this.options.strategy} migration?`,
        default: true
      }
    ];

    if (analysis.customCommands.length > 0 && !this.options.preserveCustom) {
      questions.unshift({
        type: 'confirm',
        name: 'preserveCustom',
        message: `Found ${analysis.customCommands.length} custom commands. Preserve them?`,
        default: true
      });
    }

    const answers = await inquirer.default.prompt(questions);
    
    if (answers.preserveCustom) {
      this.options.preserveCustom = true;
    }

    return answers.proceed;
  }

  private loadManifest(): MigrationManifest {
    // This would normally load from a manifest file
    return {
      version: '1.0.0',
      files: {
        commands: {
          'sparc': { source: 'sparc.md', target: 'sparc.md' },
          'sparc-architect': { source: 'sparc/architect.md', target: 'sparc-architect.md' },
          'sparc-code': { source: 'sparc/code.md', target: 'sparc-code.md' },
          'sparc-tdd': { source: 'sparc/tdd.md', target: 'sparc-tdd.md' },
          'flowx-help': { source: 'flowx-help.md', target: 'flowx-help.md' },
          'flowx-memory': { source: 'flowx-memory.md', target: 'flowx-memory.md' },
          'flowx-swarm': { source: 'flowx-swarm.md', target: 'flowx-swarm.md' }
        },
        configurations: {},
        templates: {}
      }
    };
  }

  private async getMergedClaudeMd(existingContent: string): Promise<string> {
    // Merge logic for CLAUDE.md
    const templatePath = path.join(__dirname, '../../CLAUDE.md');
    const templateContent = await fs.readFile(templatePath, 'utf-8');

    // Simple merge: append custom content to template
    if (!existingContent.includes('SPARC Development Environment')) {
      return templateContent + '\n\n## Previous Configuration\n\n' + existingContent;
    }

    return templateContent;
  }

  private async getMergedRoomodes(existing: any): Promise<any> {
    const templatePath = path.join(__dirname, '../../.roomodes');
    const template = await readJson(templatePath);

    // Merge custom modes with template
    const merged = { ...template };
    
    for (const [mode, config] of Object.entries(existing)) {
      if (!merged[mode]) {
        merged[mode] = config;
      }
    }

    return merged;
  }

  private printSummary(result: MigrationResult): void {
    console.log(colors.bold('\n📋 Migration Summary'));
    console.log(colors.gray('─'.repeat(50)));

    console.log(`\n${colors.bold('Status:')} ${result.success ? colors.hex("#00AA00")('Success') : colors.hex("#FF0000")('Failed')}`);
    
    if (result.filesCreated.length > 0) {
      console.log(`\n${colors.bold('Files Created:')} ${colors.hex("#00AA00")(result.filesCreated.length.toString())}`);
      if (result.filesCreated.length <= 10) {
        result.filesCreated.forEach(file => console.log(`  • ${file}`));
      }
    }

    if (result.filesModified.length > 0) {
      console.log(`\n${colors.bold('Files Modified:')} ${colors.hex("#FFAA00")(result.filesModified.length.toString())}`);
      result.filesModified.forEach(file => console.log(`  • ${file}`));
    }

    if (result.filesBackedUp.length > 0) {
      console.log(`\n${colors.bold('Files Backed Up:')} ${colors.hex("#0066CC")(result.filesBackedUp.length.toString())}`);
    }

    if (result.warnings.length > 0) {
      console.log(`\n${colors.bold('Warnings:')}`);
      result.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }

    if (result.errors.length > 0) {
      console.log(`\n${colors.bold('Errors:')}`);
      result.errors.forEach(error => console.log(`  ❌ ${error.error}`));
    }

    if (result.rollbackPath) {
      console.log(`\n${colors.bold('Rollback Available:')} ${result.rollbackPath}`);
      console.log(colors.gray(`  Run "flowx migrate rollback -t ${result.rollbackPath}" to revert`));
    }

    console.log(colors.gray('\n' + '─'.repeat(50)));
  }
}