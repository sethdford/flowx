/**
 * Basic Claude Code CLI Integration Tests
 * Tests basic integration between Claude Code and flowx
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createCommandTestRunner } from '../utils/command-test-base.js';

describe('Claude Code Basic Integration E2E', () => {
  let runner;
  
  beforeEach(async () => {
    runner = createCommandTestRunner({ 
      debug: false,
      timeout: 30000 // 30 second timeout for Claude Code operations
    });
    await runner.setup();
  });
  
  afterEach(async () => {
    await runner.teardown();
  });
  
  describe('Basic Claude Code CLI commands', () => {
    test('should execute flowx help command via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'help'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Claude Flow Command Line Interface');
      expect(stdout).toContain('USAGE');
      expect(stdout).toContain('COMMANDS');
    });
    
    test('should show version information via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        '--version'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Claude Flow version');
    });
    
    test('should handle invalid commands via Claude Code', async () => {
      const { stderr, code } = await runner.runCommand([
        '--claude-code',
        'invalid-command'
      ]);
      
      expect(code).not.toBe(0);
      expect(stderr).toContain('Unknown command');
    });
  });
  
  describe('Claude Code system commands', () => {
    test('should check system status via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'status'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('System Status');
    });
    
    test('should check system health via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'health'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Health Status');
    });
  });
  
  describe('Claude Code configuration commands', () => {
    test('should show configuration via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'config',
        'show'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Configuration');
    });
    
    test('should validate configuration via Claude Code', async () => {
      // Create a basic config file in the temp directory
      const configFilePath = await runner.createFile('test-config.json', JSON.stringify({
        orchestrator: { maxConcurrentAgents: 10 },
        memory: { backend: 'hybrid' },
        terminal: { type: 'auto' }
      }, null, 2));
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'config',
        'validate',
        configFilePath
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Configuration is valid');
    });
  });
  
  describe('Claude Code with JSON output', () => {
    test('should support JSON format for system status via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'status',
        '--format', 'json'
      ]);
      
      expect(code).toBe(0);
      
      const parsed = runner.parseJsonOutput(stdout);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('health');
    });
    
    test('should support JSON format for configuration via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'config',
        'show',
        '--format', 'json'
      ]);
      
      expect(code).toBe(0);
      
      const parsed = runner.parseJsonOutput(stdout);
      expect(parsed).not.toBeNull();
      expect(parsed).toHaveProperty('orchestrator');
      expect(parsed).toHaveProperty('memory');
    });
  });
  
  describe('Claude Code tool integration', () => {
    test('should execute Claude Code tools through CLI', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'tools',
        'list'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Available Tools');
    });
    
    test('should execute Claude Code bash tool', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'tools',
        'bash',
        '--command', 'echo "Hello from Claude Code"'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Hello from Claude Code');
    });
  });
});