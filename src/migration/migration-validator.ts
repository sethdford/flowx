/**
 * Migration Validator - Validates successful migration
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ValidationResult, ValidationCheck } from './types.js';
import { logger } from '../core/logger.js';
import { colors } from '../utils/colors.js';
import globPkg from 'glob';
const { glob } = globPkg;

// Helper function to check if path exists
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper function to read JSON files
async function readJson(filePath: string): Promise<any> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

// Helper function to remove files/directories
async function remove(filePath: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await fs.rmdir(filePath, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export class MigrationValidator {
  private readonly expectedFiles = [
    '.claude/prompts/sparc.md',
    '.claude/prompts/claude.md',
    '.claude/prompts/code-review.md',
    '.claude/commands/memory-bank.md',
    '.claude/commands/coordination.md',
    '.claude/commands/flowx-help.md',
    '.claude/commands/flowx-memory.md',
    '.claude/commands/flowx-swarm.md'
  ];

  private readonly expectedCommands = [
    'sparc',
    'memory-bank',
    'coordination',
    'flowx-help',
    'flowx-memory',
    'flowx-swarm'
  ];

  async validate(projectPath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      checks: [],
      errors: [],
      warnings: []
    };

    // Check file structure
    await this.validateFileStructure(projectPath, result);
    
    // Check command files
    await this.validateCommandFiles(projectPath, result);
    
    // Check configuration files
    await this.validateConfiguration(projectPath, result);
    
    // Check file integrity
    await this.validateFileIntegrity(projectPath, result);
    
    // Check functionality
    await this.validateFunctionality(projectPath, result);
    
    // Overall validation
    result.valid = result.errors.length === 0;

    return result;
  }

  private async validateFileStructure(projectPath: string, result: ValidationResult): Promise<void> {
    const check: ValidationCheck = {
      name: 'File Structure',
      passed: true
    };

    // Check .claude directory exists
    const claudePath = path.join(projectPath, '.claude');
    if (!await pathExists(claudePath)) {
      check.passed = false;
      result.errors.push('.claude directory not found');
    }

    // Check commands directory
    const commandsPath = path.join(claudePath, 'commands');
    if (!await pathExists(commandsPath)) {
      check.passed = false;
      result.errors.push('.claude/commands directory not found');
    }

    // Check required files
    for (const file of this.expectedFiles) {
      const filePath = path.join(projectPath, file);
      if (!await pathExists(filePath)) {
        check.passed = false;
        result.errors.push(`Required file missing: ${file}`);
      }
    }

    result.checks.push(check);
  }

  private async validateCommandFiles(projectPath: string, result: ValidationResult): Promise<void> {
    const check: ValidationCheck = {
      name: 'Command Files',
      passed: true
    };

    const commandsPath = path.join(projectPath, '.claude/commands');
    
    if (await pathExists(commandsPath)) {
      for (const command of this.expectedCommands) {
        const commandFile = path.join(commandsPath, `${command}.md`);
        const sparcCommandFile = path.join(commandsPath, 'sparc', `${command.replace('sparc-', '')}.md`);
        
        const hasMainFile = await pathExists(commandFile);
        const hasSparcFile = await pathExists(sparcCommandFile);
        
        if (!hasMainFile && !hasSparcFile) {
          check.passed = false;
          result.errors.push(`Command file missing: ${command}.md`);
        } else {
          // Validate file content
          const filePath = hasMainFile ? commandFile : sparcCommandFile;
          await this.validateCommandFileContent(filePath, command, result);
        }
      }
    } else {
      check.passed = false;
      result.errors.push('Commands directory not found');
    }

    result.checks.push(check);
  }

  private async validateCommandFileContent(filePath: string, command: string, result: ValidationResult): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check for minimum content requirements
      const hasDescription = content.includes('description') || content.includes('Description');
      const hasInstructions = content.length > 100; // Minimum content length
      
      if (!hasDescription) {
        result.warnings.push(`Command ${command} may be missing description`);
      }
      
      if (!hasInstructions) {
        result.warnings.push(`Command ${command} may have insufficient content`);
      }
      
      // Check for optimization indicators
      const hasOptimizedContent = content.includes('optimization') || 
                                  content.includes('performance') ||
                                  content.includes('efficient');
      
      if (!hasOptimizedContent && command.includes('sparc')) {
        result.warnings.push(`SPARC command ${command} may not be optimized`);
      }
      
    } catch (error) {
      result.errors.push(`Failed to validate ${command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async validateConfiguration(projectPath: string, result: ValidationResult): Promise<void> {
    const check: ValidationCheck = {
      name: 'Configuration Files',
      passed: true
    };

    // Check CLAUDE.md
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (await pathExists(claudeMdPath)) {
      const content = await fs.readFile(claudeMdPath, 'utf-8');
      
      // Check for SPARC configuration
      if (!content.includes('SPARC')) {
        result.warnings.push('CLAUDE.md may not include SPARC configuration');
      }
      
      // Check for key sections
      const requiredSections = [
        'Project Overview',
        'SPARC Development',
        'Memory Integration'
      ];
      
      for (const section of requiredSections) {
        if (!content.includes(section)) {
          result.warnings.push(`CLAUDE.md missing section: ${section}`);
        }
      }
    } else {
      result.warnings.push('CLAUDE.md not found');
    }

    // Check .roomodes
    const roomodesPath = path.join(projectPath, '.roomodes');
    if (await pathExists(roomodesPath)) {
      try {
        const roomodes = await readJson(roomodesPath);
        const requiredModes = ['architect', 'code', 'tdd', 'debug'];
        
        for (const mode of requiredModes) {
          if (!roomodes[mode]) {
            result.warnings.push(`Missing SPARC mode: ${mode}`);
          }
        }
      } catch (error) {
        result.errors.push(`Invalid .roomodes file: ${error instanceof Error ? error.message : String(error)}`);
        check.passed = false;
      }
    }

    result.checks.push(check);
  }

  private async validateFileIntegrity(projectPath: string, result: ValidationResult): Promise<void> {
    const check: ValidationCheck = {
      name: 'File Integrity',
      passed: true
    };

    // Check for corrupted files
    const claudePath = path.join(projectPath, '.claude');
    if (await pathExists(claudePath)) {
      const files = await new Promise<string[]>((resolve, reject) => {
        glob('**/*.md', { cwd: claudePath }, (err, matches) => {
          if (err) reject(err);
          else resolve(matches);
        });
      });
      
      for (const file of files) {
        try {
          const content = await fs.readFile(path.join(claudePath, file), 'utf-8');
          
          // Basic integrity checks
          if (content.length === 0) {
            result.errors.push(`Empty file: ${file}`);
            check.passed = false;
          }
          
          // Check for binary data in text files
          if (content.includes('\0')) {
            result.errors.push(`Corrupted text file: ${file}`);
            check.passed = false;
          }
          
        } catch (error) {
          result.errors.push(`Cannot read file ${file}: ${error instanceof Error ? error.message : String(error)}`);
          check.passed = false;
        }
      }
    }

    result.checks.push(check);
  }

  private async validateFunctionality(projectPath: string, result: ValidationResult): Promise<void> {
    const check: ValidationCheck = {
      name: 'Functionality',
      passed: true
    };

    // Check directory permissions
    const claudePath = path.join(projectPath, '.claude');
    if (await pathExists(claudePath)) {
      try {
        // Test write permissions
        const testFile = path.join(claudePath, '.test-write');
        await fs.writeFile(testFile, 'test');
        await remove(testFile);
      } catch (error) {
        result.warnings.push('.claude directory may not be writable');
      }
    }

    // Check for potential conflicts
    const packageJsonPath = path.join(projectPath, 'package.tson');
    if (await pathExists(packageJsonPath)) {
      try {
        const packageJson = await readJson(packageJsonPath);
        
        // Check for script conflicts
        const scripts = packageJson.scripts || {};
        const conflictingScripts = Object.keys(scripts).filter(script => 
          script.startsWith('flowx') || script.startsWith('sparc')
        );
        
        if (conflictingScripts.length > 0) {
          result.warnings.push(`Potential script conflicts: ${conflictingScripts.join(', ')}`);
        }
        
      } catch (error) {
        result.warnings.push('Could not validate package.tson');
      }
    }

    result.checks.push(check);
  }

  printValidation(validation: ValidationResult): void {
    console.log(colors.bold('\n✅ Migration Validation Report'));
    console.log(colors.gray('─'.repeat(50)));
    
    console.log(`\n${colors.bold('Overall Status:')} ${validation.valid ? colors.green('✓ Valid') : colors.red('✗ Invalid')}`);
    
    // Show checks
    console.log(colors.bold('\n📋 Validation Checks:'));
    validation.checks.forEach(check => {
      const status = check.passed ? colors.green('✓') : colors.red('✗');
      console.log(`  ${status} ${check.name}`);
      if (check.message) {
        console.log(`     ${colors.gray(check.message)}`);
      }
    });
    
    // Show errors
    if (validation.errors.length > 0) {
      console.log(colors.bold('\n❌ Errors:'));
      validation.errors.forEach(error => {
        console.log(`  • ${colors.red(error)}`);
      });
    }
    
    // Show warnings
    if (validation.warnings.length > 0) {
      console.log(colors.bold('\n⚠️  Warnings:'));
      validation.warnings.forEach(warning => {
        console.log(`  • ${colors.yellow(warning)}`);
      });
    }
    
    console.log(colors.gray('\n' + '─'.repeat(50)));
    
    if (validation.valid) {
      console.log(colors.green('\n🎉 Migration validation passed! Your project is ready to use optimized prompts.'));
    } else {
      console.log(colors.red('\n⚠️  Migration validation failed. Please address the errors above.'));
    }
  }
}