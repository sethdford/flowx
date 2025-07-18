/**
 * Claude Code Swarm Operations E2E Tests
 * Tests the integration between Claude Code and flowx swarm operations
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createCommandTestRunner } from '../utils/command-test-base.js';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Claude Code Swarm Operations E2E', () => {
  let runner;
  let workDir;
  
  beforeEach(async () => {
    runner = createCommandTestRunner({ 
      debug: false,
      timeout: 60000 // 60 second timeout for swarm operations
    });
    
    workDir = await runner.setup();
    console.log(`Test working directory: ${workDir}`);
  });
  
  afterEach(async () => {
    await runner.teardown();
  });
  
  describe('Basic swarm operations', () => {
    test('should initialize a swarm via Claude Code', async () => {
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'swarm',
        '"Test swarm operation"',
        '--topology', 'mesh',
        '--max-agents', '3',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Swarm initialized');
      expect(stdout).toContain('Objective: Test swarm operation');
      
      // Extract swarm ID for further tests
      const swarmIdMatch = stdout.match(/Swarm ID: ([a-z0-9-]+)/i);
      const swarmId = swarmIdMatch ? swarmIdMatch[1] : null;
      expect(swarmId).not.toBeNull();
      
      return { swarmId };
    });
    
    test('should support different swarm topologies via Claude Code', async () => {
      const topologies = ['mesh', 'hierarchical', 'ring', 'star'];
      
      for (const topology of topologies) {
        const { stdout, code } = await runner.runCommand([
          '--claude-code',
          'swarm',
          `"Test ${topology} topology"`,
          '--topology', topology,
          '--test-mode'
        ]);
        
        expect(code).toBe(0);
        expect(stdout).toContain('Swarm initialized');
      }
    });
    
    test('should support different swarm strategies via Claude Code', async () => {
      const strategies = ['research', 'development', 'analysis', 'testing'];
      
      for (const strategy of strategies) {
        const { stdout, code } = await runner.runCommand([
          '--claude-code',
          'swarm',
          `"Test ${strategy} strategy"`,
          '--strategy', strategy,
          '--test-mode'
        ]);
        
        expect(code).toBe(0);
        expect(stdout).toContain('Swarm initialized');
        expect(stdout).toContain(`Strategy: ${strategy}`);
      }
    });
  });
  
  describe('Swarm agent operations', () => {
    test('should spawn agents in a swarm via Claude Code', async () => {
      // First create a swarm
      const swarmResult = await runner.runCommand([
        '--claude-code',
        'swarm',
        '"Agent spawn test swarm"',
        '--topology', 'mesh',
        '--test-mode'
      ]);
      
      expect(swarmResult.code).toBe(0);
      const swarmId = runner.extractId(swarmResult.stdout);
      
      // Now spawn an agent in this swarm
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'agent', 'spawn',
        'researcher',
        '--name', 'test-researcher',
        '--swarm-id', swarmId,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Agent spawned successfully');
      expect(stdout).toContain('Name: test-researcher');
      
      // Extract agent ID
      const agentId = runner.extractId(stdout);
      expect(agentId).not.toBeNull();
    });
    
    test('should spawn multiple agent types in a swarm via Claude Code', async () => {
      // Create a swarm
      const swarmResult = await runner.runCommand([
        '--claude-code',
        'swarm',
        '"Multi-agent test swarm"',
        '--topology', 'hierarchical',
        '--test-mode'
      ]);
      
      expect(swarmResult.code).toBe(0);
      const swarmId = runner.extractId(swarmResult.stdout);
      
      // Agent types to spawn
      const agentTypes = [
        { type: 'researcher', name: 'test-researcher' },
        { type: 'coder', name: 'test-coder' },
        { type: 'analyst', name: 'test-analyst' },
        { type: 'coordinator', name: 'test-coordinator' }
      ];
      
      // Spawn each agent type
      for (const agent of agentTypes) {
        const { stdout, code } = await runner.runCommand([
          '--claude-code',
          'agent', 'spawn',
          agent.type,
          '--name', agent.name,
          '--swarm-id', swarmId,
          '--test-mode'
        ]);
        
        expect(code).toBe(0);
        expect(stdout).toContain('Agent spawned successfully');
        expect(stdout).toContain(`Name: ${agent.name}`);
      }
      
      // List agents in swarm
      const listResult = await runner.runCommand([
        '--claude-code',
        'agent', 'list',
        '--swarm-id', swarmId,
        '--test-mode'
      ]);
      
      expect(listResult.code).toBe(0);
      expect(listResult.stdout).toContain('Claude Flow Agents');
    });
  });
  
  describe('Swarm task orchestration', () => {
    test('should orchestrate tasks in a swarm via Claude Code', async () => {
      // Create a swarm
      const swarmResult = await runner.runCommand([
        '--claude-code',
        'swarm',
        '"Task orchestration test swarm"',
        '--topology', 'mesh',
        '--test-mode'
      ]);
      
      expect(swarmResult.code).toBe(0);
      const swarmId = runner.extractId(swarmResult.stdout);
      
      // Spawn an agent
      const agentResult = await runner.runCommand([
        '--claude-code',
        'agent', 'spawn',
        'researcher',
        '--name', 'orchestration-agent',
        '--swarm-id', swarmId,
        '--test-mode'
      ]);
      
      expect(agentResult.code).toBe(0);
      const agentId = runner.extractId(agentResult.stdout);
      
      // Create a task
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'task', 'create',
        'research',
        '"Research swarm orchestration"',
        '--agent-id', agentId,
        '--swarm-id', swarmId,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Task created successfully');
      
      // Extract task ID
      const taskId = runner.extractId(stdout);
      expect(taskId).not.toBeNull();
      
      // Execute the task
      const executeResult = await runner.runCommand([
        '--claude-code',
        'task', 'execute',
        taskId,
        '--test-mode'
      ]);
      
      expect(executeResult.code).toBe(0);
      expect(executeResult.stdout).toContain('Task execution started');
      
      // Check task status
      const statusResult = await runner.runCommand([
        '--claude-code',
        'task', 'status',
        taskId,
        '--test-mode'
      ]);
      
      expect(statusResult.code).toBe(0);
      expect(statusResult.stdout).toContain('Task Status');
    });
    
    test('should support parallel task execution in swarm via Claude Code', async () => {
      // Create a swarm with parallel execution capability
      const swarmResult = await runner.runCommand([
        '--claude-code',
        'swarm',
        '"Parallel execution test swarm"',
        '--topology', 'mesh',
        '--strategy', 'parallel',
        '--test-mode'
      ]);
      
      expect(swarmResult.code).toBe(0);
      const swarmId = runner.extractId(swarmResult.stdout);
      
      // Spawn multiple agents
      const agentTypes = ['researcher', 'coder', 'analyst'];
      const agentIds = [];
      
      for (const type of agentTypes) {
        const agentResult = await runner.runCommand([
          '--claude-code',
          'agent', 'spawn',
          type,
          '--name', `parallel-${type}`,
          '--swarm-id', swarmId,
          '--test-mode'
        ]);
        
        expect(agentResult.code).toBe(0);
        agentIds.push(runner.extractId(agentResult.stdout));
      }
      
      // Create multiple tasks
      const taskIds = [];
      
      for (let i = 0; i < agentIds.length; i++) {
        const taskResult = await runner.runCommand([
          '--claude-code',
          'task', 'create',
          'parallel-task',
          `"Parallel task ${i+1}"`,
          '--agent-id', agentIds[i],
          '--swarm-id', swarmId,
          '--test-mode'
        ]);
        
        expect(taskResult.code).toBe(0);
        taskIds.push(runner.extractId(taskResult.stdout));
      }
      
      // Execute tasks in parallel
      for (const taskId of taskIds) {
        const executeResult = await runner.runCommand([
          '--claude-code',
          'task', 'execute',
          taskId,
          '--parallel',
          '--test-mode'
        ]);
        
        expect(executeResult.code).toBe(0);
        expect(executeResult.stdout).toContain('Task execution started');
      }
      
      // Check swarm status
      const statusResult = await runner.runCommand([
        '--claude-code',
        'swarm', 'status',
        swarmId,
        '--test-mode'
      ]);
      
      expect(statusResult.code).toBe(0);
      expect(statusResult.stdout).toContain('Swarm Status');
    });
  });
  
  describe('Swarm monitoring', () => {
    test('should monitor swarm status via Claude Code', async () => {
      // Create a swarm
      const swarmResult = await runner.runCommand([
        '--claude-code',
        'swarm',
        '"Monitoring test swarm"',
        '--test-mode'
      ]);
      
      expect(swarmResult.code).toBe(0);
      const swarmId = runner.extractId(swarmResult.stdout);
      
      // Check swarm status
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'swarm', 'status',
        swarmId,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Swarm Status');
      expect(stdout).toContain(swarmId);
    });
    
    test('should get swarm metrics via Claude Code', async () => {
      // Create a swarm
      const swarmResult = await runner.runCommand([
        '--claude-code',
        'swarm',
        '"Metrics test swarm"',
        '--test-mode'
      ]);
      
      expect(swarmResult.code).toBe(0);
      const swarmId = runner.extractId(swarmResult.stdout);
      
      // Check swarm metrics
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'swarm', 'metrics',
        swarmId,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Swarm Metrics');
    });
  });
  
  describe('Error handling', () => {
    test('should handle invalid swarm operations via Claude Code', async () => {
      const { stderr, code } = await runner.runCommand([
        '--claude-code',
        'swarm', 'invalid-operation',
        '--test-mode'
      ]);
      
      expect(code).not.toBe(0);
      expect(stderr).toContain('Unknown');
    });
    
    test('should handle non-existent swarm ID via Claude Code', async () => {
      const { stderr, code } = await runner.runCommand([
        '--claude-code',
        'swarm', 'status',
        'non-existent-swarm-id',
        '--test-mode'
      ]);
      
      expect(code).not.toBe(0);
      expect(stderr).toContain('not found');
    });
  });
});