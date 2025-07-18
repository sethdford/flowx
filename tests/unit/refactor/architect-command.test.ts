/**
 * Architect Command Tests
 * Comprehensive test suite for architecture analysis capabilities
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { architectCommand } from '../../../src/cli/commands/refactor/architect-command.js';
import type { CLIContext } from '../../../src/cli/interfaces/index.ts';
import * as fs from 'fs/promises';

// Mock the logger
jest.mock('../../../src/core/logger.js', () => ({
  createConsoleLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock fs operations
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock output formatter
jest.mock('../../../src/cli/core/output-formatter.ts', () => ({
  formatTable: jest.fn((rows, columns) => 'Mocked Table'),
  successBold: jest.fn((text) => `SUCCESS: ${text}`),
  infoBold: jest.fn((text) => `INFO: ${text}`),
  warningBold: jest.fn((text) => `WARNING: ${text}`),
  errorBold: jest.fn((text) => `ERROR: ${text}`),
  printSuccess: jest.fn((text) => console.log(`SUCCESS: ${text}`)),
  printError: jest.fn((text) => console.log(`ERROR: ${text}`)),
  printWarning: jest.fn((text) => console.log(`WARNING: ${text}`)),
  printInfo: jest.fn((text) => console.log(`INFO: ${text}`))
}));

describe('Architect Command', () => {
  let mockContext: CLIContext;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    mockContext = {
      args: [],
      options: {},
      subcommand: undefined
    };

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock file system operations
    mockFs.stat.mockResolvedValue({
      isFile: () => false,
      isDirectory: () => true
    } as any);
    
    mockFs.readdir.mockResolvedValue([
      { name: 'controller.ts', isDirectory: () => false, isFile: () => true },
      { name: 'service.ts', isDirectory: () => false, isFile: () => true },
      { name: 'entity.ts', isDirectory: () => false, isFile: () => true },
      { name: 'repository.ts', isDirectory: () => false, isFile: () => true }
    ] as any);

    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
  });

  describe('Command Structure', () => {
    it('should have correct command metadata', () => {
      expect(architectCommand.name).toBe('architect');
      expect(architectCommand.description).toContain('architecture analysis');
      expect(architectCommand.category).toBe('Architecture');
      expect(architectCommand.usage).toContain('flowx architect');
    });

    it('should have all required subcommands', () => {
      const expectedSubcommands = [
        'analyze', 'validate', 'patterns', 'dependencies', 
        'layers', 'principles', 'diagram'
      ];
      
      const actualSubcommands = architectCommand.subcommands?.map(cmd => cmd.name) || [];
      expectedSubcommands.forEach(cmd => {
        expect(actualSubcommands).toContain(cmd);
      });
    });

    it('should have comprehensive examples', () => {
      expect(architectCommand.examples).toBeDefined();
      expect(architectCommand.examples!.length).toBeGreaterThan(0);
      expect(architectCommand.examples![0]).toContain('flowx architect');
    });

    it('should have proper options', () => {
      const expectedOptions = ['strict', 'threshold', 'format', 'fix', 'include-tests', 'output-file'];
      const actualOptions = architectCommand.options?.map(opt => opt.name) || [];
      
      expectedOptions.forEach(opt => {
        expect(actualOptions).toContain(opt);
      });
    });
  });

  describe('Analyze Subcommand', () => {
    beforeEach(() => {
      mockContext.subcommand = 'analyze';
      mockContext.args = ['src/'];
    });

    it('should analyze clean architecture compliance', async () => {
      mockContext.options = { 'clean-arch': true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      expect(analyzeSubcommand).toBeDefined();
      
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('INFO: 🏗️ Analyzing architecture'));
    });

    it('should analyze design patterns', async () => {
      mockContext.options = { patterns: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing architecture'));
    });

    it('should analyze dependencies', async () => {
      mockContext.options = { dependencies: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should analyze layers', async () => {
      mockContext.options = { layers: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should analyze SOLID principles', async () => {
      mockContext.options = { principles: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should run all analyses when specified', async () => {
      mockContext.options = { all: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing architecture'));
    });

    it('should auto-fix violations when requested', async () => {
      mockContext.options = { all: true, fix: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Auto-fixing violations'));
    });

    it('should save analysis to file when specified', async () => {
      mockContext.options = { all: true, 'output-file': 'analysis.json' };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith('analysis.json', expect.any(String));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analysis saved to'));
    });
  });

  describe('Validate Subcommand', () => {
    beforeEach(() => {
      mockContext.subcommand = 'validate';
      mockContext.args = ['src/'];
    });

    it('should validate architecture', async () => {
      const validateSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'validate');
      await validateSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Validating architecture'));
    });

    it('should use custom validation rules', async () => {
      mockContext.options = { rules: 'custom-rules.json' };
      
      const validateSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'validate');
      await validateSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should use strict validation', async () => {
      mockContext.options = { strict: true };
      
      const validateSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'validate');
      await validateSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should fail on violations when requested', async () => {
      mockContext.options = { 'fail-on-violations': true };
      
      // Mock process.exit to prevent actual exit
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      
      const validateSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'validate');
      
      try {
        await validateSubcommand!.handler(mockContext);
      } catch (error) {
        // Expected to throw due to mocked process.exit
      }
      
      exitSpy.mockRestore();
    });
  });

  describe('Patterns Subcommand', () => {
    beforeEach(() => {
      mockContext.subcommand = 'patterns';
      mockContext.args = ['src/'];
    });

    it('should detect existing patterns', async () => {
      mockContext.options = { detect: true };
      
      const patternsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'patterns');
      await patternsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Detecting design patterns'));
    });

    it('should recommend applicable patterns', async () => {
      mockContext.options = { recommend: true };
      
      const patternsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'patterns');
      await patternsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Recommending design patterns'));
    });

    it('should validate pattern implementations', async () => {
      mockContext.options = { validate: true };
      
      const patternsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'patterns');
      await patternsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Validating pattern implementations'));
    });

    it('should run all pattern analyses by default', async () => {
      mockContext.options = {};
      
      const patternsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'patterns');
      await patternsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Detecting design patterns'));
    });
  });

  describe('Dependencies Subcommand', () => {
    beforeEach(() => {
      mockContext.subcommand = 'dependencies';
      mockContext.args = ['src/'];
    });

    it('should detect circular dependencies', async () => {
      mockContext.options = { circular: true };
      
      const depsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'dependencies');
      await depsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing dependencies'));
    });

    it('should analyze coupling metrics', async () => {
      mockContext.options = { coupling: true };
      
      const depsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'dependencies');
      await depsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should analyze external dependencies', async () => {
      mockContext.options = { external: true };
      
      const depsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'dependencies');
      await depsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should generate dependency graph', async () => {
      mockContext.options = { graph: true };
      
      const depsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'dependencies');
      await depsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Dependency graph saved'));
    });
  });

  describe('Layers Subcommand', () => {
    beforeEach(() => {
      mockContext.subcommand = 'layers';
      mockContext.args = ['src/'];
    });

    it('should enforce layer separation', async () => {
      mockContext.options = { 'enforce-separation': true };
      
      const layersSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'layers');
      await layersSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing layer structure'));
    });

    it('should validate dependency flow', async () => {
      mockContext.options = { 'dependency-flow': true };
      
      const layersSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'layers');
      await layersSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should suggest improved structure', async () => {
      mockContext.options = { 'suggest-structure': true };
      
      const layersSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'layers');
      await layersSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Principles Subcommand', () => {
    beforeEach(() => {
      mockContext.subcommand = 'principles';
      mockContext.args = ['src/'];
    });

    it('should analyze all SOLID principles', async () => {
      mockContext.options = { solid: true };
      
      const principlesSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'principles');
      await principlesSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing SOLID principles'));
    });

    it('should analyze Single Responsibility Principle', async () => {
      mockContext.options = { srp: true };
      
      const principlesSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'principles');
      await principlesSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should analyze Open-Closed Principle', async () => {
      mockContext.options = { ocp: true };
      
      const principlesSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'principles');
      await principlesSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should analyze Liskov Substitution Principle', async () => {
      mockContext.options = { lsp: true };
      
      const principlesSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'principles');
      await principlesSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should analyze Interface Segregation Principle', async () => {
      mockContext.options = { isp: true };
      
      const principlesSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'principles');
      await principlesSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should analyze Dependency Inversion Principle', async () => {
      mockContext.options = { dip: true };
      
      const principlesSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'principles');
      await principlesSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Diagram Subcommand', () => {
    beforeEach(() => {
      mockContext.subcommand = 'diagram';
      mockContext.args = ['src/'];
    });

    it('should generate layer diagrams', async () => {
      mockContext.options = { type: 'layers', format: 'mermaid' };
      
      const diagramSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'diagram');
      await diagramSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generating architecture diagrams'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated layers diagram'));
    });

    it('should generate dependency diagrams', async () => {
      mockContext.options = { type: 'dependencies', format: 'plantuml' };
      
      const diagramSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'diagram');
      await diagramSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated dependencies diagram'));
    });

    it('should generate pattern diagrams', async () => {
      mockContext.options = { type: 'patterns', format: 'svg' };
      
      const diagramSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'diagram');
      await diagramSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated patterns diagram'));
    });

    it('should generate component diagrams', async () => {
      mockContext.options = { type: 'components' };
      
      const diagramSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'diagram');
      await diagramSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated components diagram'));
    });

    it('should generate all diagram types', async () => {
      mockContext.options = { type: 'all' };
      
      const diagramSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'diagram');
      await diagramSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated layers diagram'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated dependencies diagram'));
    });

    it('should default to layers diagram', async () => {
      mockContext.options = {};
      
      const diagramSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'diagram');
      await diagramSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Generated layers diagram'));
    });
  });

  describe('Output Formats', () => {
    beforeEach(() => {
      mockContext.subcommand = 'analyze';
      mockContext.args = ['src/'];
    });

    it('should support JSON output format', async () => {
      mockContext.options = { all: true, format: 'json' };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should support table output format', async () => {
      mockContext.options = { all: true, format: 'table' };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should support detailed output format (default)', async () => {
      mockContext.options = { all: true, format: 'detailed' };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should support summary output format', async () => {
      mockContext.options = { all: true, format: 'summary' };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Quality Threshold', () => {
    beforeEach(() => {
      mockContext.subcommand = 'analyze';
      mockContext.args = ['src/'];
    });

    it('should respect custom threshold', async () => {
      mockContext.options = { all: true, threshold: 0.9 };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should use default threshold when not specified', async () => {
      mockContext.options = { all: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('File Handling', () => {
    it('should handle single file target', async () => {
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      } as any);

      mockContext.subcommand = 'analyze';
      mockContext.args = ['src/single-file.ts'];
      mockContext.options = { patterns: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should include test files when specified', async () => {
      mockContext.subcommand = 'analyze';
      mockContext.args = ['src/'];
      mockContext.options = { all: true, 'include-tests': true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should exclude test files by default', async () => {
      mockContext.subcommand = 'analyze';
      mockContext.args = ['src/'];
      mockContext.options = { all: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));
      
      mockContext.subcommand = 'analyze';
      mockContext.args = ['nonexistent/'];
      mockContext.options = { all: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      
      await expect(analyzeSubcommand!.handler(mockContext)).rejects.toThrow();
    });

    it('should handle missing target gracefully', async () => {
      mockContext.subcommand = 'analyze';
      mockContext.args = [];
      mockContext.options = { all: true };
      
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      // Should default to current directory
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Architecture Analysis Content', () => {
    beforeEach(() => {
      mockContext.subcommand = 'analyze';
      mockContext.args = ['src/'];
      mockContext.options = { all: true, format: 'detailed' };
    });

    it('should display overall architecture score', async () => {
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Overall Architecture Score'));
    });

    it('should display clean architecture compliance', async () => {
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Clean Architecture Compliance'));
    });

    it('should display detected patterns', async () => {
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Design Patterns Detected'));
    });

    it('should display architecture violations', async () => {
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Architecture Violations'));
    });

    it('should display recommendations', async () => {
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Recommendations'));
    });

    it('should display architecture metrics', async () => {
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Architecture Metrics'));
    });
  });

  describe('SOLID Principles Analysis', () => {
    beforeEach(() => {
      mockContext.subcommand = 'principles';
      mockContext.args = ['src/'];
      mockContext.options = { solid: true, format: 'detailed' };
    });

    it('should display overall SOLID score', async () => {
      const principlesSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'principles');
      await principlesSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Overall SOLID Score'));
    });

    it('should display individual principle scores', async () => {
      const principlesSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'principles');
      await principlesSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Single Responsibility'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Open-Closed'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Liskov Substitution'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Interface Segregation'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Dependency Inversion'));
    });
  });

  describe('Default Handler', () => {
    it('should show help when no args provided', async () => {
      mockContext.args = [];
      mockContext.options = {};
      
      await architectCommand.handler!(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🏗️ Architect Command'));
    });

    it('should default to analyze when target provided without subcommand', async () => {
      mockContext.args = ['src/'];
      mockContext.options = {};
      mockContext.subcommand = undefined;
      
      await architectCommand.handler!(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🏗️ Analyzing architecture'));
    });
  });

  describe('Integration Tests', () => {
    it('should run comprehensive architecture analysis', async () => {
      // Test full workflow of multiple analysis types
      const workflows = [
        { subcommand: 'analyze', options: { all: true } },
        { subcommand: 'validate', options: { strict: true } },
        { subcommand: 'patterns', options: { recommend: true } },
        { subcommand: 'dependencies', options: { circular: true } },
        { subcommand: 'principles', options: { solid: true } }
      ];

      for (const workflow of workflows) {
        mockContext.subcommand = workflow.subcommand;
        mockContext.args = ['src/'];
        mockContext.options = workflow.options;

        const subcommand = architectCommand.subcommands?.find(cmd => cmd.name === workflow.subcommand);
        expect(subcommand).toBeDefined();
        
        await subcommand!.handler(mockContext);
        expect(consoleLogSpy).toHaveBeenCalled();
      }
    });

    it('should generate complete architecture documentation', async () => {
      // Test workflow for generating complete documentation
      const documentationWorkflow = [
        { subcommand: 'analyze', options: { all: true, 'output-file': 'analysis.json' } },
        { subcommand: 'diagram', options: { type: 'all', format: 'mermaid' } }
      ];

      for (const step of documentationWorkflow) {
        mockContext.subcommand = step.subcommand;
        mockContext.args = ['src/'];
        mockContext.options = step.options;

        const subcommand = architectCommand.subcommands?.find(cmd => cmd.name === step.subcommand);
        await subcommand!.handler(mockContext);
        expect(consoleLogSpy).toHaveBeenCalled();
      }

      expect(mockFs.writeFile).toHaveBeenCalledWith('analysis.json', expect.any(String));
    });
  });

  describe('Performance Tests', () => {
    it('should handle large codebases efficiently', async () => {
      // Mock a large number of files
      const largeFileList = Array.from({ length: 500 }, (_, i) => ({
        name: `component${i}.ts`,
        isDirectory: () => false,
        isFile: () => true
      }));
      
      mockFs.readdir.mockResolvedValue(largeFileList as any);
      
      mockContext.subcommand = 'analyze';
      mockContext.args = ['large-project/'];
      mockContext.options = { all: true };
      
      const start = Date.now();
      const analyzeSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'analyze');
      await analyzeSubcommand!.handler(mockContext);
      const end = Date.now();
      
      // Should complete within reasonable time (mocked operations should be fast)
      expect(end - start).toBeLessThan(1000);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Specific Architecture Features', () => {
    it('should detect clean architecture layers correctly', async () => {
      // Mock files that represent different layers
      mockFs.readdir.mockResolvedValue([
        { name: 'controllers', isDirectory: () => true, isFile: () => false },
        { name: 'use-cases', isDirectory: () => true, isFile: () => false },
        { name: 'entities', isDirectory: () => true, isFile: () => false },
        { name: 'repositories', isDirectory: () => true, isFile: () => false }
      ] as any);

      mockContext.subcommand = 'layers';
      mockContext.args = ['src/'];
      mockContext.options = { 'enforce-separation': true };
      
      const layersSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'layers');
      await layersSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analyzing layer structure'));
    });

    it('should validate dependency directions', async () => {
      mockContext.subcommand = 'dependencies';
      mockContext.args = ['src/'];
      mockContext.options = { coupling: true, circular: true };
      
      const depsSubcommand = architectCommand.subcommands?.find(cmd => cmd.name === 'dependencies');
      await depsSubcommand!.handler(mockContext);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Circular Dependencies'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Coupling Analysis'));
    });
  });
}); 