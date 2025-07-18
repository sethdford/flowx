/**
 * Claude Code SPARC Mode Operations E2E Tests
 * Tests the integration between Claude Code and flowx SPARC modes
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createCommandTestRunner } from '../utils/command-test-base.js';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Claude Code SPARC Mode Operations E2E', () => {
  let runner;
  let workDir;
  
  beforeEach(async () => {
    runner = createCommandTestRunner({ 
      debug: false,
      timeout: 60000 // 60 second timeout for SPARC operations
    });
    
    workDir = await runner.setup();
    console.log(`Test working directory: ${workDir}`);
  });
  
  afterEach(async () => {
    await runner.teardown();
  });
  
  describe('Basic SPARC operations', () => {
    test('should execute default SPARC mode via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        '"Create a simple test function"',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC');
      expect(stdout).toContain('mode executing');
      expect(stdout).toContain('Create a simple test function');
    });
    
    test('should list available SPARC modes via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'list',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Available SPARC Modes');
      
      // Check for common SPARC modes
      const commonModes = ['architect', 'code', 'tdd', 'review', 'debug'];
      for (const mode of commonModes) {
        expect(stdout).toContain(mode);
      }
    });
  });
  
  describe('Specific SPARC modes', () => {
    test('should execute architect mode via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'architect',
        '"Design a user authentication system"',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC architect mode executing');
    });
    
    test('should execute coder mode via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'code',
        '"Implement a sorting algorithm"',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC code mode executing');
    });
    
    test('should execute TDD mode via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'tdd',
        '"Create a user validation function"',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC tdd mode executing');
    });
    
    test('should execute review mode via Claude Code', async () => {
      // First create a file to review
      const testCodePath = await runner.createFile('test-code.js', `
        function add(a, b) {
          return a + b;
        }
        
        function subtract(a, b) {
          return a - b;
        }
        
        module.exports = {
          add,
          subtract
        };
      `);
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'review',
        `"Review the code in ${testCodePath}"`,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC review mode executing');
    });
    
    test('should execute debug mode via Claude Code', async () => {
      // Create a file with a bug
      const buggyCodePath = await runner.createFile('buggy-code.js', `
        function calculateAverage(numbers) {
          let sum = 0;
          for (let i = 0; i < numbers.length; i++) {
            sum += numbers[i];
          }
          return sum / numbers.length; // Bug: doesn't handle empty array
        }
        
        module.exports = calculateAverage;
      `);
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'debug',
        `"Fix the bug in ${buggyCodePath}"`,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC debug mode executing');
    });
    
    test('should execute docs mode via Claude Code', async () => {
      // Create code that needs documentation
      const undocCodePath = await runner.createFile('undoc-code.js', `
        function processData(data, options) {
          const results = [];
          const settings = { ...defaultSettings, ...options };
          
          for (const item of data) {
            if (settings.filter && !settings.filter(item)) {
              continue;
            }
            
            const processed = settings.transform ? settings.transform(item) : item;
            results.push(processed);
          }
          
          return results;
        }
        
        const defaultSettings = {
          filter: null,
          transform: null,
          includeMetadata: false
        };
        
        module.exports = processData;
      `);
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'docs',
        `"Document the function in ${undocCodePath}"`,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC docs mode executing');
    });
    
    test('should execute security mode via Claude Code', async () => {
      // Create code with security issues
      const insecureCodePath = await runner.createFile('insecure-code.js', `
        function processUserInput(req, res) {
          const { username, password } = req.body;
          const query = \`SELECT * FROM users WHERE username='\${username}' AND password='\${password}'\`;
          
          db.execute(query)
            .then(results => {
              if (results.length > 0) {
                const token = createToken(username);
                res.cookie('auth', token);
                res.json({ success: true });
              } else {
                res.json({ success: false, error: 'Invalid credentials' });
              }
            })
            .catch(err => {
              console.log('Error:', err);
              res.status(500).json({ error: err.toString() });
            });
        }
        
        module.exports = processUserInput;
      `);
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'security',
        `"Identify security issues in ${insecureCodePath}"`,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC security mode executing');
    });
  });
  
  describe('SPARC with options', () => {
    test('should support dry run mode via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'architect',
        '"Design a message queue system"',
        '--dry-run',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('DRY RUN');
      expect(stdout).toContain('architect');
      expect(stdout).toContain('Design a message queue system');
    });
    
    test('should support batch mode via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'batch',
        '--modes', 'architect,code,tdd',
        '--task', '"Build a simple cache system"',
        '--dry-run', // Use dry-run to avoid actual execution
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('DRY RUN');
      expect(stdout).toContain('modes: architect,code,tdd');
    });
    
    test('should support parallel execution via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'batch',
        '--modes', 'architect,code',
        '--task', '"Create a logging system"',
        '--parallel',
        '--dry-run', // Use dry-run to avoid actual execution
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('DRY RUN');
      expect(stdout).toContain('Parallel: enabled');
    });
  });
  
  describe('SPARC TDD workflow', () => {
    test('should execute TDD workflow via Claude Code', async () => {
      // Create a project directory for TDD
      const projectDir = path.join(workDir, 'tdd-project');
      await fs.mkdir(projectDir, { recursive: true });
      
      // Create a minimal package.json
      await runner.createFile('tdd-project/package.json', JSON.stringify({
        "name": "tdd-project",
        "version": "1.0.0",
        "description": "TDD test project",
        "main": "index.js",
        "scripts": {
          "test": "jest"
        }
      }, null, 2));
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'tdd',
        '"Create a user validation module with email and password validation"',
        '--dir', projectDir,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC tdd mode executing');
    });
  });
  
  describe('Error handling', () => {
    test('should handle invalid SPARC mode via Claude Code', async () => {
      const { stderr, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'invalid-mode',
        '"This should fail"',
        '--test-mode'
      ]);
      
      expect(code).not.toBe(0);
      expect(stderr).toContain('Unknown SPARC mode');
    });
    
    test('should handle missing task description via Claude Code', async () => {
      const { stderr, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'code',
        // Missing task description
        '--test-mode'
      ]);
      
      expect(code).not.toBe(0);
      expect(stderr).toContain('required');
    });
  });
  
  describe('SPARC with project context', () => {
    test('should use project context from memory via Claude Code', async () => {
      // First store project context in memory
      await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', 'project/tech-stack',
        '--value', JSON.stringify({
          frontend: 'React',
          backend: 'Node.js',
          database: 'MongoDB',
          testing: 'Jest'
        }),
        '--type', 'context',
        '--test-mode'
      ]);
      
      // Run SPARC with memory context
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'sparc',
        'run',
        'architect',
        '"Design user profile feature"',
        '--use-memory',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('SPARC architect mode executing');
    });
  });
});