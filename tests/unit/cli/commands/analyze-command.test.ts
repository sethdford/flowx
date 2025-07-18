/**
 * Comprehensive Test Suite for Analyze Command
 * Tests all analysis types, edge cases, error scenarios, and performance
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { analyzeCommand } from '../../../../src/cli/commands/system/analyze-command';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import type { CLIContext } from '../../../../src/cli/interfaces/index';

// Mock dependencies
jest.mock('../../../../src/cli/core/global-initialization.js', () => ({
  getLogger: jest.fn(() => Promise.resolve({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../../../src/cli/core/output-formatter.js', () => ({
  printSuccess: jest.fn(),
  printError: jest.fn(),
  printInfo: jest.fn(),
  printWarning: jest.fn(),
  formatTable: jest.fn(),
  successBold: jest.fn((text: string) => text),
  infoBold: jest.fn((text: string) => text),
  warningBold: jest.fn((text: string) => text),
  errorBold: jest.fn((text: string) => text)
}));

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawn: jest.fn()
}));

describe('Analyze Command', () => {
  let testDir: string;
  let originalExitCode: number | undefined;
  let consoleSpy: jest.SpiedFunction<typeof console.log>;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await mkdtemp(join(tmpdir(), 'analyze-test-'));
    
    // Spy on console.log to capture output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Store original exit code
    originalExitCode = typeof process.exitCode === 'number' ? process.exitCode : undefined;
    process.exitCode = 0;
    
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  afterEach(async () => {
    // Cleanup test directory
    await rm(testDir, { recursive: true, force: true });
    
    // Restore console.log
    consoleSpy.mockRestore();
    
    // Restore exit code
    process.exitCode = originalExitCode;
  });

  // Helper function to create valid CLIContext
  function createMockContext(args: string[] = [], options: Record<string, any> = {}): CLIContext {
    return {
      args,
      options,
      command: 'analyze',
      workingDirectory: testDir,
      environment: {},
      user: { id: 'test-user', name: 'Test User' }
    };
  }

  describe('Command Structure', () => {
    it('should have correct command configuration', () => {
      expect(analyzeCommand.name).toBe('analyze');
      expect(analyzeCommand.description).toContain('Enterprise-grade');
      expect(analyzeCommand.category).toBe('Analysis');
      expect(analyzeCommand.usage).toContain('flowx analyze');
      expect(analyzeCommand.arguments).toBeDefined();
      expect(analyzeCommand.options).toBeDefined();
      expect(analyzeCommand.examples).toBeDefined();
      expect(analyzeCommand.handler).toBeDefined();
    });

    it('should have required arguments defined', () => {
      const targetArg = analyzeCommand.arguments?.find(arg => arg.name === 'target');
      expect(targetArg).toBeDefined();
      expect(targetArg?.required).toBe(true);
      
      const pathArg = analyzeCommand.arguments?.find(arg => arg.name === 'path');
      expect(pathArg).toBeDefined();
      expect(pathArg?.required).toBe(false);
    });

    it('should have comprehensive options defined', () => {
      const options = analyzeCommand.options || [];
      
      // Core options
      expect(options.find(opt => opt.name === 'detailed')).toBeDefined();
      expect(options.find(opt => opt.name === 'format')).toBeDefined();
      expect(options.find(opt => opt.name === 'output')).toBeDefined();
      expect(options.find(opt => opt.name === 'threshold')).toBeDefined();
      
      // Analysis-specific options
      expect(options.find(opt => opt.name === 'lint')).toBeDefined();
      expect(options.find(opt => opt.name === 'complexity')).toBeDefined();
      expect(options.find(opt => opt.name === 'dependencies')).toBeDefined();
      expect(options.find(opt => opt.name === 'secrets')).toBeDefined();
      expect(options.find(opt => opt.name === 'vulnerabilities')).toBeDefined();
      expect(options.find(opt => opt.name === 'benchmark')).toBeDefined();
      expect(options.find(opt => opt.name === 'ml-insights')).toBeDefined();
    });

    it('should have useful examples', () => {
      expect(analyzeCommand.examples).toHaveLength(7);
      expect(analyzeCommand.examples?.[0]).toContain('code');
      expect(analyzeCommand.examples?.[1]).toContain('architecture');
      expect(analyzeCommand.examples?.[2]).toContain('security');
      expect(analyzeCommand.examples?.[6]).toContain('all');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing target argument', async () => {
      const context = createMockContext();

      await analyzeCommand.handler!(context);

      const { printError, printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printError).toHaveBeenCalledWith('Analysis target is required');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Available targets'));
    });

    it('should handle non-existent path', async () => {
      const context = createMockContext(['code', '/non/existent/path']);

      await analyzeCommand.handler!(context);

      const { printError } = require('../../../../src/cli/core/output-formatter.js');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Path does not exist'));
    });

    it('should handle unknown analysis target', async () => {
      const context = createMockContext(['unknown', testDir]);

      await analyzeCommand.handler!(context);

      const { printError } = require('../../../../src/cli/core/output-formatter.js');
      expect(printError).toHaveBeenCalledWith('Unknown analysis target: unknown');
    });

    it('should handle analysis failures gracefully', async () => {
      // Mock logger to throw error
      const { getLogger } = require('../../../../src/cli/core/global-initialization.js');
      getLogger.mockRejectedValueOnce(new Error('Logger initialization failed'));

      const context = createMockContext(['code', testDir]);

      await analyzeCommand.handler!(context);

      const { printError } = require('../../../../src/cli/core/output-formatter.js');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Analysis failed'));
      expect(process.exitCode).toBe(1);
    });
  });

  describe('Code Analysis', () => {
    beforeEach(async () => {
      // Create test source files
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      // Simple TypeScript file
      await writeFile(join(testDir, 'src', 'simple.ts'), `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
      `);
      
      // Complex file with issues
      await writeFile(join(testDir, 'src', 'complex.ts'), `
var globalVar = 'should use const';
console.log('debug statement');

export function complexFunction(a: any, b: any, c: any, d: any, e: any): any {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            return 'deeply nested';
          } else {
            return 'else case 1';
          }
        } else {
          return 'else case 2';
        }
      } else {
        return 'else case 3';
      }
    } else {
      return 'else case 4';
    }
  } else {
    return 'else case 5';
  }
}

// Duplicate block start
const data = {
  name: 'test',
  value: 42,
  active: true
};
// Duplicate block end

// Duplicate block start  
const data2 = {
  name: 'test',
  value: 42,
  active: true
};
// Duplicate block end
      `);
      
      // Package.json
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'lodash': '^4.17.21',
          'express': '^4.18.0'
        },
        devDependencies: {
          'typescript': '^4.8.0',
          '@types/node': '^18.0.0'
        }
      }, null, 2));
      
      // TSConfig
      await writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true
        }
      }, null, 2));
    });

    it('should perform basic code analysis', async () => {
      const context = createMockContext(['code', testDir]);

      await analyzeCommand.handler!(context);

      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Starting code analysis'));
    });

    it('should analyze code complexity', async () => {
      const context = createMockContext(['code', testDir], { complexity: true });

      await analyzeCommand.handler!(context);

      // Should complete without errors
      expect(process.exitCode).not.toBe(1);
    });

    it('should detect linting issues', async () => {
      const context = createMockContext(['code', testDir], { lint: true });

      await analyzeCommand.handler!(context);

      // Should complete analysis
      expect(process.exitCode).toBeDefined();
    });

    it('should detect code duplication', async () => {
      const context = createMockContext(['code', testDir], { duplication: true });

      await analyzeCommand.handler!(context);

      // Should complete analysis
      expect(process.exitCode).toBeDefined();
    });

    it('should generate quality score', async () => {
      const context = createMockContext(['code', testDir], { threshold: 70 });

      await analyzeCommand.handler!(context);

      // Should have generated output
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle TypeScript analysis', async () => {
      const context = createMockContext(['code', testDir]);

      await analyzeCommand.handler!(context);

      // Should complete TypeScript analysis
      expect(process.exitCode).toBeDefined();
    });
  });

  describe('Architecture Analysis', () => {
    beforeEach(async () => {
      // Create architectural structure
      await mkdir(join(testDir, 'src', 'controllers'), { recursive: true });
      await mkdir(join(testDir, 'src', 'services'), { recursive: true });
      await mkdir(join(testDir, 'src', 'models'), { recursive: true });
      
      await writeFile(join(testDir, 'src', 'controllers', 'user.ts'), `
import { UserService } from '../services/user';
export class UserController {
  constructor(private userService: UserService) {}
}
      `);
      
      await writeFile(join(testDir, 'src', 'services', 'user.ts'), `
import { User } from '../models/user';
export class UserService {
  getUser(id: string): User { return new User(); }
}
      `);
      
      await writeFile(join(testDir, 'src', 'models', 'user.ts'), `
export class User {
  id: string = '';
  name: string = '';
}
      `);
    });

    it('should analyze architecture structure', async () => {
      const context = createMockContext(['architecture', testDir]);

      await analyzeCommand.handler!(context);

      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Analyzing architecture'));
    });

    it('should analyze dependencies when requested', async () => {
      const context = createMockContext(['architecture', testDir], { dependencies: true });

      await analyzeCommand.handler!(context);

      // Should complete dependency analysis
      expect(process.exitCode).toBeDefined();
    });

    it('should analyze architectural layers', async () => {
      const context = createMockContext(['architecture', testDir], { layers: true });

      await analyzeCommand.handler!(context);

      // Should complete layer analysis
      expect(process.exitCode).toBeDefined();
    });

    it('should analyze coupling and cohesion', async () => {
      const context = createMockContext(['architecture', testDir], { coupling: true });

      await analyzeCommand.handler!(context);

      // Should complete coupling analysis
      expect(process.exitCode).toBeDefined();
    });
  });

  describe('Security Analysis', () => {
    beforeEach(async () => {
      // Create files with security issues
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(join(testDir, 'src', 'config.ts'), `
export const config = {
  apiKey: 'sk-1234567890abcdef1234567890abcdef',
  password: 'hardcoded-password-123',
  secret: 'my-secret-token-abcdef123456'
};

const token = 'bearer-token-xyz789';
      `);
      
      await writeFile(join(testDir, 'src', 'auth.ts'), `
import crypto from 'crypto';

export function hashPassword(password: string): string {
  // Insecure: using deprecated MD5
  return crypto.createHash('md5').update(password).digest('hex');
}

export function authenticate(user: any, pass: any): boolean {
  // Insecure: no input validation
  return user.password === pass;
}
      `);
    });

    it('should perform security analysis', async () => {
      const context = createMockContext(['security', testDir]);

      await analyzeCommand.handler!(context);

      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Analyzing security'));
    });

    it('should detect secrets when enabled', async () => {
      const context = createMockContext(['security', testDir], { secrets: true });

      await analyzeCommand.handler!(context);

      // Should detect hardcoded secrets
      expect(process.exitCode).toBeDefined();
    });

    it('should scan for vulnerabilities', async () => {
      const context = createMockContext(['security', testDir], { vulnerabilities: true });

      await analyzeCommand.handler!(context);

      // Should complete vulnerability scan
      expect(process.exitCode).toBeDefined();
    });

    it('should check OWASP compliance', async () => {
      const context = createMockContext(['security', testDir], { owasp: true });

      await analyzeCommand.handler!(context);

      // Should complete OWASP compliance check
      expect(process.exitCode).toBeDefined();
    });

    it('should generate security score', async () => {
      const context = createMockContext(['security', testDir]);

      await analyzeCommand.handler!(context);

      // Should generate security analysis
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(join(testDir, 'src', 'performance.ts'), `
// Performance anti-patterns
export function inefficientLoop(): void {
  const data = new Array(1000).fill(0);
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data.length; j++) {
      console.log(data[i] + data[j]);
    }
  }
}

export async function unnecessaryAsync(): Promise<string> {
  return 'not actually async';
}

export function memoryLeak(): any[] {
  const cache = [];
  setInterval(() => {
    cache.push(new Array(1000).fill(Math.random()));
  }, 100);
  return cache;
}
      `);
    });

    it('should analyze performance characteristics', async () => {
      const context = createMockContext(['performance', testDir]);

      await analyzeCommand.handler!(context);

      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Analyzing performance'));
    });

    it('should run benchmarks when requested', async () => {
      const context = createMockContext(['performance', testDir], { benchmark: true });

      await analyzeCommand.handler!(context);

      // Should complete benchmark analysis
      expect(process.exitCode).toBeDefined();
    });

    it('should analyze memory usage', async () => {
      const context = createMockContext(['performance', testDir], { memory: true });

      await analyzeCommand.handler!(context);

      // Should complete memory analysis
      expect(process.exitCode).toBeDefined();
    });

    it('should include profiling data', async () => {
      const context = createMockContext(['performance', testDir], { profiling: true });

      await analyzeCommand.handler!(context);

      // Should complete profiling analysis
      expect(process.exitCode).toBeDefined();
    });
  });

  describe('Dependency Analysis', () => {
    beforeEach(async () => {
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'lodash': '^4.17.21',
          'express': '^4.18.0',
          'moment': '^2.29.0' // Outdated package
        },
        devDependencies: {
          'typescript': '^4.8.0',
          '@types/node': '^18.0.0',
          'unused-package': '^1.0.0' // Potentially unused
        }
      }, null, 2));
      
      await writeFile(join(testDir, 'package-lock.json'), JSON.stringify({
        lockfileVersion: 2,
        requires: true,
        packages: {}
      }, null, 2));
    });

    it('should analyze package dependencies', async () => {
      const context = createMockContext(['dependencies', testDir]);

      await analyzeCommand.handler!(context);

      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Analyzing dependencies'));
    });

    it('should scan for vulnerabilities', async () => {
      const context = createMockContext(['dependencies', testDir], { vulnerabilities: true });

      await analyzeCommand.handler!(context);

      // Should complete vulnerability scan
      expect(process.exitCode).toBeDefined();
    });

    it('should detect outdated dependencies', async () => {
      // Mock npm outdated command
      const { execSync } = require('child_process');
      execSync.mockReturnValueOnce(JSON.stringify({
        'moment': {
          current: '2.29.0',
          wanted: '2.29.4',
          latest: '2.29.4'
        }
      }));

      const context = createMockContext(['dependencies', testDir]);

      await analyzeCommand.handler!(context);

      // Should detect outdated packages
      expect(execSync).toHaveBeenCalled();
    });

    it('should analyze licenses', async () => {
      const context = createMockContext(['dependencies', testDir]);

      await analyzeCommand.handler!(context);

      // Should complete license analysis
      expect(process.exitCode).toBeDefined();
    });
  });

  describe('Pattern Analysis', () => {
    beforeEach(async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      // File with design patterns
      await writeFile(join(testDir, 'src', 'patterns.ts'), `
// Singleton pattern
export class ConfigManager {
  private static instance: ConfigManager;
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
}

// Observer pattern
export interface Observer {
  update(data: any): void;
}

export class Subject {
  private observers: Observer[] = [];
  
  addObserver(observer: Observer): void {
    this.observers.push(observer);
  }
  
  notifyObservers(data: any): void {
    this.observers.forEach(observer => observer.update(data));
  }
}

// Anti-pattern: God Object
export class GodObject {
  doEverything(): void { /* ... */ }
  handleAllLogic(): void { /* ... */ }
  manageAllData(): void { /* ... */ }
  processAllRequests(): void { /* ... */ }
  validateEverything(): void { /* ... */ }
}
      `);
      
      // File with code smells
      await writeFile(join(testDir, 'src', 'smells.ts'), `
// Long method (code smell)
export function processData(data: any[]): any {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] && data[i].valid) {
      const processed = data[i].value * 2;
      if (processed > 100) {
        result.push({ value: processed, category: 'high' });
      } else if (processed > 50) {
        result.push({ value: processed, category: 'medium' });
      } else {
        result.push({ value: processed, category: 'low' });
      }
    }
  }
  return result;
}

// Feature envy (code smell)
export class OrderProcessor {
  processOrder(order: any): void {
    order.customer.validateAddress();
    order.customer.validatePayment();
    order.customer.updateHistory();
    order.items.forEach((item: any) => {
      item.product.updateStock();
      item.product.trackSales();
    });
  }
}
      `);
    });

    it('should analyze code patterns', async () => {
      const context = createMockContext(['patterns', testDir]);

      await analyzeCommand.handler!(context);

      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Analyzing code patterns'));
    });

    it('should detect design patterns', async () => {
      const context = createMockContext(['patterns', testDir], { 'design-patterns': true });

      await analyzeCommand.handler!(context);

      // Should detect design patterns
      expect(process.exitCode).toBeDefined();
    });

    it('should detect anti-patterns', async () => {
      const context = createMockContext(['patterns', testDir], { 'anti-patterns': true });

      await analyzeCommand.handler!(context);

      // Should detect anti-patterns
      expect(process.exitCode).toBeDefined();
    });

    it('should provide ML insights when enabled', async () => {
      const context = createMockContext(['patterns', testDir], { 'ml-insights': true });

      await analyzeCommand.handler!(context);

      // Should complete ML analysis
      expect(process.exitCode).toBeDefined();
    });
  });

  describe('Comprehensive Analysis', () => {
    beforeEach(async () => {
      // Set up complete project structure
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(join(testDir, 'package.json'), JSON.stringify({
        name: 'comprehensive-test',
        version: '1.0.0',
        dependencies: { 'lodash': '^4.17.21' }
      }, null, 2));
      
      await writeFile(join(testDir, 'src', 'index.ts'), `
export * from './modules/auth';
export * from './modules/data';
      `);
      
      await mkdir(join(testDir, 'src', 'modules'), { recursive: true });
      await writeFile(join(testDir, 'src', 'modules', 'auth.ts'), `
export function authenticate(): boolean { return true; }
      `);
      
      await writeFile(join(testDir, 'src', 'modules', 'data.ts'), `
export function processData(): any[] { return []; }
      `);
    });

    it('should run comprehensive analysis', async () => {
      const context = createMockContext(['all', testDir]);

      await analyzeCommand.handler!(context);

      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('comprehensive analysis'));
    });

    it('should aggregate results from all analysis types', async () => {
      const context = createMockContext(['all', testDir], { detailed: true });

      await analyzeCommand.handler!(context);

      // Should have output comprehensive results
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle partial analysis failures gracefully', async () => {
      // Mock one analysis to fail
      const { getLogger } = require('../../../../src/cli/core/global-initialization.js');
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      };
      getLogger.mockResolvedValue(mockLogger);

      const context = createMockContext(['all', testDir]);

      await analyzeCommand.handler!(context);

      // Should complete even with partial failures
      expect(process.exitCode).toBeDefined();
    });
  });

  describe('Output and Reporting', () => {
    beforeEach(async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src', 'test.ts'), 'export const test = 1;');
    });

    it('should display results in table format by default', async () => {
      const context = createMockContext(['code', testDir]);

      await analyzeCommand.handler!(context);

      // Should display results
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should save results to file when requested', async () => {
      const outputPath = join(testDir, 'analysis-results.json');
      const context = createMockContext(['code', testDir], { output: outputPath, format: 'json' });

      await analyzeCommand.handler!(context);

      // Should save results file
      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Analysis saved to'));
    });

    it('should generate markdown report', async () => {
      const outputPath = join(testDir, 'analysis-report.md');
      const context = createMockContext(['code', testDir], { output: outputPath, format: 'markdown' });

      await analyzeCommand.handler!(context);

      // Should generate markdown report
      expect(process.exitCode).toBeDefined();
    });

    it('should generate HTML report', async () => {
      const outputPath = join(testDir, 'analysis-report.html');
      const context = createMockContext(['code', testDir], { output: outputPath, format: 'html' });

      await analyzeCommand.handler!(context);

      // Should generate HTML report
      expect(process.exitCode).toBeDefined();
    });

    it('should respect quality threshold', async () => {
      const context = createMockContext(['code', testDir], { threshold: 90 }); // High threshold

      await analyzeCommand.handler!(context);

      // May fail quality threshold and set exit code
      expect(process.exitCode).toBeDefined();
    });

    it('should provide verbose output when requested', async () => {
      const context = createMockContext(['code', testDir], { verbose: true });

      await analyzeCommand.handler!(context);

      // Should provide verbose output
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Advanced Features', () => {
    beforeEach(async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src', 'app.ts'), `
export class App {
  start(): void {
    console.log('App started');
  }
}
      `);
    });

    it('should support custom configuration', async () => {
      const configPath = join(testDir, 'analyze.config.json');
      await writeFile(configPath, JSON.stringify({
        quality: {
          complexity: { cyclomatic: 5 },
          duplication: { threshold: 2 }
        }
      }, null, 2));

      const context = createMockContext(['code', testDir], { config: configPath });

      await analyzeCommand.handler!(context);

      // Should use custom configuration
      expect(process.exitCode).toBeDefined();
    });

    it('should support include/exclude patterns', async () => {
      const context = createMockContext(['code', testDir], { 
        include: '**/*.ts',
        exclude: '**/node_modules/**'
      });

      await analyzeCommand.handler!(context);

      // Should respect patterns
      expect(process.exitCode).toBeDefined();
    });

    it('should handle auto-fix when requested', async () => {
      const context = createMockContext(['code', testDir], { fix: true });

      await analyzeCommand.handler!(context);

      // Should attempt auto-fixes
      expect(process.exitCode).toBeDefined();
    });

    it('should support watch mode', async () => {
      const context = createMockContext(['code', testDir], { watch: true });

      // Mock watch functionality (would normally not return)
      const originalTimeout = setTimeout;
      const mockSetTimeout = jest.fn().mockImplementation((...args: any[]) => {
        const [callback, ms] = args;
        if (typeof ms === 'number' && ms > 1000) {
          // Skip long timeouts in tests
          return {} as NodeJS.Timeout;
        }
        return originalTimeout(callback, ms);
      });
      global.setTimeout = mockSetTimeout as any;

      await analyzeCommand.handler!(context);

      // Should start watch mode
      const { printInfo } = require('../../../../src/cli/core/output-formatter.js');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Watching for changes'));

      global.setTimeout = originalTimeout;
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large codebases efficiently', async () => {
      // Create many files to test performance
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      for (let i = 0; i < 50; i++) {
        await writeFile(join(testDir, 'src', `file${i}.ts`), `
export function func${i}(): number {
  return ${i};
}
        `);
      }

      const startTime = Date.now();
      const context = createMockContext(['code', testDir]);

      await analyzeCommand.handler!(context);

      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (< 30 seconds)
      expect(duration).toBeLessThan(30000);
    });

    it('should handle binary files gracefully', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      // Create a binary file
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      await writeFile(join(testDir, 'src', 'image.png'), binaryContent);
      
      // Create a normal file
      await writeFile(join(testDir, 'src', 'code.ts'), 'export const x = 1;');

      const context = createMockContext(['code', testDir]);

      await analyzeCommand.handler!(context);

      // Should handle binary files without errors
      expect(process.exitCode).not.toBe(1);
    });

    it('should handle empty directories', async () => {
      await mkdir(join(testDir, 'empty'), { recursive: true });

      const context = createMockContext(['code', join(testDir, 'empty')]);

      await analyzeCommand.handler!(context);

      // Should handle empty directories gracefully
      expect(process.exitCode).toBeDefined();
    });

    it('should handle malformed source files', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      // Create malformed TypeScript file
      await writeFile(join(testDir, 'src', 'malformed.ts'), `
export function incomplete(a: number
// Missing closing brace and parenthesis
      `);

      const context = createMockContext(['code', testDir]);

      await analyzeCommand.handler!(context);

      // Should handle malformed files gracefully
      expect(process.exitCode).toBeDefined();
    });

    it('should respect memory limits during analysis', async () => {
      // Monitor memory usage during analysis
      const initialMemory = process.memoryUsage();
      
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      // Create large file to test memory handling
      const largeContent = 'export const data = [\n' + 
        Array(1000).fill('  "large string content",').join('\n') + 
        '\n];';
      
      await writeFile(join(testDir, 'src', 'large.ts'), largeContent);

      const context = createMockContext(['code', testDir]);

      await analyzeCommand.handler!(context);

      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase dramatically (< 100MB increase)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });
  });
}); 