/**
 * Comprehensive Test Suite for Debug Command
 * Tests all debug subcommands, analysis types, error handling, and edge cases
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { debugCommand } from '@/cli/commands/system/debug-command.ts';
import type { CLIContext } from '@/cli/interfaces/index.ts';

// Mock dependencies
jest.mock('@/cli/core/global-initialization.ts', () => ({
  getLogger: jest.fn(() => Promise.resolve({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  getMemoryManager: jest.fn(() => Promise.resolve({
    get: jest.fn(),
    set: jest.fn()
  })),
  getPersistenceManager: jest.fn(() => Promise.resolve({
    save: jest.fn(),
    load: jest.fn()
  }))
}));

jest.mock('@/cli/core/output-formatter.ts', () => ({
  formatTable: jest.fn().mockReturnValue('mocked table'),
  printSuccess: jest.fn(),
  printError: jest.fn(),
  printInfo: jest.fn(),
  printWarning: jest.fn(),
  successBold: jest.fn().mockImplementation(text => `[SUCCESS] ${text}`),
  errorBold: jest.fn().mockImplementation(text => `[ERROR] ${text}`),
  infoBold: jest.fn().mockImplementation(text => `[INFO] ${text}`),
  warningBold: jest.fn().mockImplementation(text => `[WARNING] ${text}`)
}));

jest.mock('@/swarm/coordinator.ts', () => ({
  SwarmCoordinator: jest.fn().mockImplementation(() => ({
    getSystemStatus: jest.fn(),
    getPerformanceMetrics: jest.fn()
  }))
}));

jest.mock('@/task/engine.ts', () => ({
  TaskEngine: jest.fn().mockImplementation(() => ({
    getTaskMetrics: jest.fn(),
    getErrorLog: jest.fn()
  }))
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn()
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn()
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let mockConsoleLog: jest.Mock;
let mockConsoleError: jest.Mock;

// Mock process
let originalExitCode: number | undefined;
let originalExit: typeof process.exit;

function createMockContext(args: string[] = [], options: Record<string, any> = {}): CLIContext {
  return {
    args,
    options,
    flags: new Set(Object.keys(options).filter(key => options[key] === true)),
    command: 'debug',
    subcommand: args[0],
    cwd: process.cwd(),
    verbose: !!options.verbose,
    interactive: false
  };
}

describe('Debug Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    mockConsoleLog = jest.fn();
    mockConsoleError = jest.fn();
    console.log = mockConsoleLog;
    console.error = mockConsoleError;
    
    // Store original exit code and process.exit
    originalExitCode = typeof process.exitCode === 'number' ? process.exitCode : undefined;
    originalExit = process.exit;
    process.exitCode = 0;
    process.exit = jest.fn() as any;
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    // Restore original exit code and process.exit
    if (typeof originalExitCode === 'number') {
      process.exitCode = originalExitCode;
    } else {
      delete (process as any).exitCode;
    }
    process.exit = originalExit;
  });

  describe('Command Structure', () => {
    it('should have correct basic properties', () => {
      expect(debugCommand.name).toBe('debug');
      expect(debugCommand.description).toContain('debugging');
      expect(debugCommand.category).toBe('System');
      expect(debugCommand.usage).toContain('flowx debug');
    });

    it('should have all required subcommands', () => {
      const expectedSubcommands = [
        'logs', 'errors', 'performance', 'trace', 'diagnose', 'fix', 'session', 'report'
      ];
      
      expect(debugCommand.subcommands).toBeDefined();
      expect(debugCommand.subcommands!.length).toBeGreaterThanOrEqual(expectedSubcommands.length);
      
      const subcommandNames = debugCommand.subcommands!.map(sub => sub.name);
      expectedSubcommands.forEach(expected => {
        expect(subcommandNames).toContain(expected);
      });
    });

    it('should have appropriate options', () => {
      const expectedOptions = ['verbose', 'auto-fix', 'dry-run', 'format', 'output', 'timeout'];
      
      expect(debugCommand.options).toBeDefined();
      const optionNames = debugCommand.options!.map(opt => opt.name);
      
      expectedOptions.forEach(expected => {
        expect(optionNames).toContain(expected);
      });
    });

    it('should have examples for all major use cases', () => {
      expect(debugCommand.examples).toBeDefined();
      expect(debugCommand.examples!.length).toBeGreaterThan(5);
      
      // Check for key examples
      const exampleText = debugCommand.examples!.join(' ');
      expect(exampleText).toContain('logs');
      expect(exampleText).toContain('errors');
      expect(exampleText).toContain('performance');
      expect(exampleText).toContain('diagnose');
    });
  });

  describe('Main Handler (Debug Overview)', () => {
    it('should show debug overview when called without subcommands', async () => {
      const context = createMockContext();
      
      await debugCommand.handler!(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Debug Assistant'));
    });

    it('should handle verbose mode', async () => {
      const context = createMockContext([], { verbose: true });
      
      await debugCommand.handler!(context);
      
      // Should show additional system information in verbose mode
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle overview display errors gracefully', async () => {
      const context = createMockContext();
      
      // Mock an error in the overview display
      const { getLogger } = require('@/cli/core/global-initialization.ts');
      getLogger.mockRejectedValueOnce(new Error('Logger initialization failed'));
      
      await debugCommand.handler!(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Failed to show debug overview'));
    });
  });

  describe('Logs Subcommand', () => {
    let logsSubcommand: any;

    beforeEach(() => {
      logsSubcommand = debugCommand.subcommands!.find(sub => sub.name === 'logs');
    });

    it('should analyze logs with default options', async () => {
      const context = createMockContext(['logs']);
      
      await logsSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Log Analysis'));
    });

    it('should handle analyze option', async () => {
      const context = createMockContext(['logs'], { analyze: true });
      
      await logsSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle patterns option', async () => {
      const context = createMockContext(['logs'], { patterns: true });
      
      await logsSubcommand.handler(context);
      
      // Should display pattern analysis
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle anomalies option', async () => {
      const context = createMockContext(['logs'], { anomalies: true });
      
      await logsSubcommand.handler(context);
      
      // Should display anomaly detection
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should filter by component', async () => {
      const context = createMockContext(['logs'], { component: 'SwarmCoordinator' });
      
      await logsSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle time-based filtering', async () => {
      const context = createMockContext(['logs'], { since: '1h', level: 'error' });
      
      await logsSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle auto-fix option', async () => {
      const context = createMockContext(['logs'], { 'auto-fix': true });
      
      await logsSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Applying automated fixes'));
    });

    it('should handle log analysis errors', async () => {
      const context = createMockContext(['logs']);
      
      // Mock an error in log collection
      const fs = require('fs/promises');
      fs.readFile.mockRejectedValueOnce(new Error('Permission denied'));
      
      await logsSubcommand.handler(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Log analysis failed'));
    });
  });

  describe('Errors Subcommand', () => {
    let errorsSubcommand: any;

    beforeEach(() => {
      errorsSubcommand = debugCommand.subcommands!.find(sub => sub.name === 'errors');
    });

    it('should analyze errors with default options', async () => {
      const context = createMockContext(['errors']);
      
      await errorsSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Error Analysis'));
    });

    it('should handle no errors found', async () => {
      const context = createMockContext(['errors']);
      
      await errorsSubcommand.handler(context);
      
      const { printSuccess } = require('@/cli/core/output-formatter.ts');
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('No errors found'));
    });

    it('should group similar errors', async () => {
      const context = createMockContext(['errors'], { group: true });
      
      await errorsSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should correlate errors across components', async () => {
      const context = createMockContext(['errors'], { correlate: true });
      
      await errorsSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should filter by component and time', async () => {
      const context = createMockContext(['errors'], { 
        component: 'TaskEngine', 
        since: '2h' 
      });
      
      await errorsSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should provide error fix suggestions', async () => {
      const context = createMockContext(['errors']);
      
      await errorsSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle error analysis failures', async () => {
      const context = createMockContext(['errors']);
      
      // Mock an error in error collection
      const { getLogger } = require('@/cli/core/global-initialization.ts');
      getLogger.mockRejectedValueOnce(new Error('Database connection failed'));
      
      await errorsSubcommand.handler(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Error analysis failed'));
    });
  });

  describe('Performance Subcommand', () => {
    let performanceSubcommand: any;

    beforeEach(() => {
      performanceSubcommand = debugCommand.subcommands!.find(sub => sub.name === 'performance');
    });

    it('should analyze performance with default options', async () => {
      const context = createMockContext(['performance']);
      
      await performanceSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Performance Analysis'));
    });

    it('should handle profiling option', async () => {
      const context = createMockContext(['performance'], { profile: true });
      
      await performanceSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Starting performance profiling'));
    });

    it('should handle benchmark option', async () => {
      const context = createMockContext(['performance'], { benchmark: true });
      
      await performanceSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Running performance benchmarks'));
    });

    it('should handle memory profiling', async () => {
      const context = createMockContext(['performance'], { memory: true });
      
      await performanceSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Analyzing memory usage'));
    });

    it('should handle CPU profiling', async () => {
      const context = createMockContext(['performance'], { cpu: true });
      
      await performanceSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Analyzing CPU usage'));
    });

    it('should handle component-specific profiling', async () => {
      const context = createMockContext(['performance'], { 
        profile: true, 
        component: 'SwarmCoordinator',
        duration: 60
      });
      
      await performanceSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should provide performance recommendations', async () => {
      const context = createMockContext(['performance']);
      
      await performanceSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle performance analysis errors', async () => {
      const context = createMockContext(['performance']);
      
      // Mock an error in performance analysis
      const { SwarmCoordinator } = require('@/swarm/coordinator.ts');
      SwarmCoordinator.mockImplementation(() => {
        throw new Error('Coordinator initialization failed');
      });
      
      await performanceSubcommand.handler(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Performance analysis failed'));
    });
  });

  describe('Trace Subcommand', () => {
    let traceSubcommand: any;

    beforeEach(() => {
      traceSubcommand = debugCommand.subcommands!.find(sub => sub.name === 'trace');
    });

    it('should trace execution with default options', async () => {
      const context = createMockContext(['trace']);
      
      await traceSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Execution Tracing'));
    });

    it('should trace specific process', async () => {
      const context = createMockContext(['trace'], { process: 'flowx' });
      
      await traceSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should trace specific function', async () => {
      const context = createMockContext(['trace'], { function: 'executeTask' });
      
      await traceSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle stack depth configuration', async () => {
      const context = createMockContext(['trace'], { 'stack-depth': 20 });
      
      await traceSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle async tracing', async () => {
      const context = createMockContext(['trace'], { async: true });
      
      await traceSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle trace execution errors', async () => {
      const context = createMockContext(['trace']);
      
      // Mock an error in execution tracing
      const { spawn } = require('child_process');
      spawn.mockImplementation(() => {
        throw new Error('Process spawn failed');
      });
      
      await traceSubcommand.handler(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Execution tracing failed'));
    });
  });

  describe('Diagnose Subcommand', () => {
    let diagnoseSubcommand: any;

    beforeEach(() => {
      diagnoseSubcommand = debugCommand.subcommands!.find(sub => sub.name === 'diagnose');
    });

    it('should run automated diagnosis with default options', async () => {
      const context = createMockContext(['diagnose']);
      
      await diagnoseSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Automated System Diagnosis'));
    });

    it('should diagnose system health', async () => {
      const context = createMockContext(['diagnose'], { system: true });
      
      await diagnoseSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Diagnosing system health'));
    });

    it('should diagnose performance issues', async () => {
      const context = createMockContext(['diagnose'], { performance: true });
      
      await diagnoseSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Diagnosing performance issues'));
    });

    it('should diagnose security issues', async () => {
      const context = createMockContext(['diagnose'], { security: true });
      
      await diagnoseSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Diagnosing security issues'));
    });

    it('should diagnose configuration issues', async () => {
      const context = createMockContext(['diagnose'], { configuration: true });
      
      await diagnoseSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Diagnosing configuration issues'));
    });

    it('should diagnose dependency issues', async () => {
      const context = createMockContext(['diagnose'], { dependencies: true });
      
      await diagnoseSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Diagnosing dependency issues'));
    });

    it('should handle diagnosis errors', async () => {
      const context = createMockContext(['diagnose']);
      
      // Mock an error in diagnosis
      const { getMemoryManager } = require('@/cli/core/global-initialization.ts');
      getMemoryManager.mockRejectedValueOnce(new Error('Memory manager unavailable'));
      
      await diagnoseSubcommand.handler(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('System diagnosis failed'));
    });
  });

  describe('Fix Subcommand', () => {
    let fixSubcommand: any;

    beforeEach(() => {
      fixSubcommand = debugCommand.subcommands!.find(sub => sub.name === 'fix');
    });

    it('should apply automated fixes with default options', async () => {
      const context = createMockContext(['fix']);
      
      await fixSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Applying Automated Fixes'));
    });

    it('should handle no fixable issues', async () => {
      const context = createMockContext(['fix']);
      
      await fixSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith('No fixable issues found');
    });

    it('should fix specific issue by ID', async () => {
      const context = createMockContext(['fix'], { issue: 'memory-leak-001' });
      
      await fixSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should fix issues by category', async () => {
      const context = createMockContext(['fix'], { category: 'performance' });
      
      await fixSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle dry-run mode', async () => {
      const context = createMockContext(['fix'], { 'dry-run': true });
      
      await fixSubcommand.handler(context);
      
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Would fix'));
    });

    it('should handle confirmation mode', async () => {
      const context = createMockContext(['fix'], { confirm: true });
      
      await fixSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle backup option', async () => {
      const context = createMockContext(['fix'], { backup: true });
      
      await fixSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle fix application errors', async () => {
      const context = createMockContext(['fix']);
      
      // Mock an error in fix application
      const fs = require('fs/promises');
      fs.writeFile.mockRejectedValueOnce(new Error('Permission denied'));
      
      await fixSubcommand.handler(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Fix application failed'));
    });
  });

  describe('Session Subcommand', () => {
    let sessionSubcommand: any;

    beforeEach(() => {
      sessionSubcommand = debugCommand.subcommands!.find(sub => sub.name === 'session');
    });

    it('should handle session creation', async () => {
      const context = createMockContext(['session'], { create: true, context: 'API issues' });
      
      await sessionSubcommand.handler(context);
      
      const { printSuccess } = require('@/cli/core/output-formatter.ts');
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('Created debug session'));
    });

    it('should list debug sessions', async () => {
      const context = createMockContext(['session'], { list: true });
      
      await sessionSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith('No debug sessions found');
    });

    it('should resume debug session', async () => {
      const context = createMockContext(['session'], { resume: 'session_123' });
      
      await sessionSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Resumed debug session'));
    });

    it('should show session management help', async () => {
      const context = createMockContext(['session']);
      
      await sessionSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Debug session management commands'));
    });

    it('should handle session management errors', async () => {
      const context = createMockContext(['session'], { create: true });
      
      // Mock an error in session creation
      const fs = require('fs/promises');
      fs.mkdir.mockRejectedValueOnce(new Error('Directory creation failed'));
      
      await sessionSubcommand.handler(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Session management failed'));
    });
  });

  describe('Report Subcommand', () => {
    let reportSubcommand: any;

    beforeEach(() => {
      reportSubcommand = debugCommand.subcommands!.find(sub => sub.name === 'report');
    });

    it('should generate debug report with default options', async () => {
      const context = createMockContext(['report']);
      
      await reportSubcommand.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Generating Debug Report'));
    });

    it('should export report in different formats', async () => {
      const formats = ['json', 'html', 'pdf', 'markdown'];
      
      for (const format of formats) {
        const context = createMockContext(['report'], { export: format });
        
        await reportSubcommand.handler(context);
        
        const { printSuccess } = require('@/cli/core/output-formatter.ts');
        expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining(`Report exported to`));
      }
    });

    it('should handle custom output path', async () => {
      const context = createMockContext(['report'], { 
        export: 'json', 
        output: '/tmp/custom-debug-report.json' 
      });
      
      await reportSubcommand.handler(context);
      
      const { printSuccess } = require('@/cli/core/output-formatter.ts');
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('/tmp/custom-debug-report.json'));
    });

    it('should include different report sections', async () => {
      const context = createMockContext(['report'], { 
        'include-logs': true,
        'include-metrics': true,
        'include-recommendations': true
      });
      
      await reportSubcommand.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle report generation errors', async () => {
      const context = createMockContext(['report']);
      
      // Mock an error in report generation
      const fs = require('fs/promises');
      fs.writeFile.mockRejectedValueOnce(new Error('Disk full'));
      
      await reportSubcommand.handler(context);
      
      const { printError } = require('@/cli/core/output-formatter.ts');
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('Report generation failed'));
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid subcommands gracefully', async () => {
      const context = createMockContext(['invalid-subcommand']);
      
      // Since the main handler should be called for invalid subcommands
      await debugCommand.handler!(context);
      
      // Should show overview instead of erroring
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Debug Assistant'));
    });

    it('should handle timeout option', async () => {
      const context = createMockContext(['logs'], { timeout: 30 });
      
      await debugCommand.subcommands!.find(sub => sub.name === 'logs')!.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle deep-analysis option', async () => {
      const context = createMockContext(['diagnose'], { 'deep-analysis': true });
      
      await debugCommand.subcommands!.find(sub => sub.name === 'diagnose')!.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle include-stack option', async () => {
      const context = createMockContext(['errors'], { 'include-stack': true });
      
      await debugCommand.subcommands!.find(sub => sub.name === 'errors')!.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle multiple format options', async () => {
      const formats = ['table', 'json', 'yaml', 'markdown'];
      
      for (const format of formats) {
        const context = createMockContext(['diagnose'], { format });
        
        await debugCommand.subcommands!.find(sub => sub.name === 'diagnose')!.handler(context);
        
        expect(mockConsoleLog).toHaveBeenCalled();
      }
    });

    it('should handle system resource constraints', async () => {
      const context = createMockContext(['performance'], { memory: true });
      
      // Mock low memory condition
      Object.defineProperty(process, 'memoryUsage', {
        value: () => ({
          rss: 1024 * 1024 * 1024, // 1GB
          heapTotal: 512 * 1024 * 1024, // 512MB
          heapUsed: 480 * 1024 * 1024, // 480MB
          external: 32 * 1024 * 1024 // 32MB
        })
      });
      
      await debugCommand.subcommands!.find(sub => sub.name === 'performance')!.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle concurrent debug operations', async () => {
      const context1 = createMockContext(['logs']);
      const context2 = createMockContext(['performance']);
      
      // Run multiple debug operations concurrently
      await Promise.all([
        debugCommand.subcommands!.find(sub => sub.name === 'logs')!.handler(context1),
        debugCommand.subcommands!.find(sub => sub.name === 'performance')!.handler(context2)
      ]);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with verbose global option', async () => {
      const context = createMockContext(['diagnose'], { verbose: true });
      
      await debugCommand.subcommands!.find(sub => sub.name === 'diagnose')!.handler(context);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should combine multiple analysis types', async () => {
      const context = createMockContext(['diagnose'], { 
        system: true, 
        performance: true, 
        security: true 
      });
      
      await debugCommand.subcommands!.find(sub => sub.name === 'diagnose')!.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledTimes(4); // Header + 3 diagnosis types
    });

    it('should handle export and output together', async () => {
      const context = createMockContext(['report'], { 
        export: 'json',
        output: 'debug-report.json',
        'include-logs': true,
        'include-metrics': true
      });
      
      await debugCommand.subcommands!.find(sub => sub.name === 'report')!.handler(context);
      
      const { printSuccess } = require('@/cli/core/output-formatter.ts');
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining('debug-report.json'));
    });

    it('should work with auto-fix and dry-run together', async () => {
      const context = createMockContext(['fix'], { 
        'auto-fix': true, 
        'dry-run': true 
      });
      
      await debugCommand.subcommands!.find(sub => sub.name === 'fix')!.handler(context);
      
      const { printInfo } = require('@/cli/core/output-formatter.ts');
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining('Would fix'));
    });
  });
}); 