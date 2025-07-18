/**
 * Claude Code Memory Operations E2E Tests
 * Tests the integration between Claude Code and flowx memory system
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createCommandTestRunner } from '../utils/command-test-base.js';

describe('Claude Code Memory Operations E2E', () => {
  let runner;
  
  beforeEach(async () => {
    runner = createCommandTestRunner({ 
      debug: false,
      timeout: 30000 // 30 second timeout for memory operations
    });
    await runner.setup();
    // Clear memory store before each test for consistent results
    runner.clearMemoryStore();
  });
  
  afterEach(async () => {
    await runner.teardown();
  });
  
  describe('Basic memory operations', () => {
    test('should store memory entries via Claude Code', async () => {
      const testKey = 'test-key';
      const testValue = JSON.stringify({ message: 'Test value from Claude Code', timestamp: new Date().toISOString() });
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', testKey,
        '--value', testValue,
        '--type', 'observation',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Memory stored');
      expect(stdout).toContain(testKey);
      
      // Extract memory ID for further tests
      const memoryId = runner.extractId(stdout);
      expect(memoryId).not.toBeNull();
      
      return { memoryId, testKey };
    });
    
    test('should retrieve memory entries via Claude Code', async () => {
      // First store a memory entry
      const testKey = 'query-test-key';
      const testValue = JSON.stringify({ data: 'Retrievable test data', timestamp: new Date().toISOString() });
      
      const storeResult = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', testKey,
        '--value', testValue,
        '--type', 'observation',
        '--test-mode'
      ]);
      
      expect(storeResult.code).toBe(0);
      
      // Now query by key
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'query',
        '--key', testKey,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Query Results');
      expect(stdout).toContain(testKey);
    });
    
    test('should list memory entries via Claude Code', async () => {
      // Store a few test memories
      const testEntries = [
        { key: 'list-test-1', value: '{"data": "Test data 1"}', type: 'observation' },
        { key: 'list-test-2', value: '{"data": "Test data 2"}', type: 'decision' },
        { key: 'list-test-3', value: '{"data": "Test data 3"}', type: 'observation' }
      ];
      
      for (const entry of testEntries) {
        const storeResult = await runner.runCommand([
          '--claude-code',
          'memory', 'store',
          '--key', entry.key,
          '--value', entry.value,
          '--type', entry.type,
          '--test-mode'
        ]);
        
        expect(storeResult.code).toBe(0);
      }
      
      // List all memories
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'list',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Memory Entries');
      
      for (const entry of testEntries) {
        expect(stdout).toContain(entry.key);
      }
    });
  });
  
  describe('Advanced memory operations', () => {
    test('should store memory with tags via Claude Code', async () => {
      const testKey = 'tagged-memory';
      const testValue = JSON.stringify({ data: 'Tagged test data' });
      const tags = 'important,test,e2e';
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', testKey,
        '--value', testValue,
        '--type', 'observation',
        '--tags', tags,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Memory stored');
      expect(stdout).toContain('Tags:');
      
      // Query by tag
      const queryResult = await runner.runCommand([
        '--claude-code',
        'memory', 'query',
        '--tag', 'important',
        '--test-mode'
      ]);
      
      expect(queryResult.code).toBe(0);
      expect(queryResult.stdout).toContain('Query Results');
    });
    
    test('should store memory with context via Claude Code', async () => {
      const testKey = 'context-memory';
      const testValue = JSON.stringify({ data: 'Context test data' });
      const context = JSON.stringify({ source: 'e2e-test', priority: 'high', user: 'test-user' });
      
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', testKey,
        '--value', testValue,
        '--type', 'observation',
        '--context', context,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Memory stored');
      
      // Query by context
      const queryResult = await runner.runCommand([
        '--claude-code',
        'memory', 'query',
        '--context-key', 'source',
        '--context-value', 'e2e-test',
        '--test-mode'
      ]);
      
      expect(queryResult.code).toBe(0);
      expect(queryResult.stdout).toContain('Query Results');
    });
    
    test('should filter memory entries by type via Claude Code', async () => {
      // Store memories with different types
      const memoryTypes = ['observation', 'decision', 'analysis', 'summary'];
      
      for (let i = 0; i < memoryTypes.length; i++) {
        const storeResult = await runner.runCommand([
          '--claude-code',
          'memory', 'store',
          '--key', `type-test-${i}`,
          '--value', JSON.stringify({ data: `Test data for ${memoryTypes[i]}` }),
          '--type', memoryTypes[i],
          '--test-mode'
        ]);
        
        expect(storeResult.code).toBe(0);
      }
      
      // List memories filtered by type
      const typeToFilter = 'decision';
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'list',
        '--type', typeToFilter,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Memory Entries');
      expect(stdout).toContain(typeToFilter);
    });
  });
  
  describe('Memory search operations', () => {
    test('should search memory by content via Claude Code', async () => {
      // Store memory with specific content
      const searchableContent = 'UNIQUESEARCHSTRING';
      
      const storeResult = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', 'search-test-key',
        '--value', JSON.stringify({ data: `This is a test with ${searchableContent} embedded` }),
        '--type', 'observation',
        '--test-mode'
      ]);
      
      expect(storeResult.code).toBe(0);
      
      // Search memory
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'search',
        '--term', searchableContent,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Search Results');
      expect(stdout).toContain('search-test-key');
    });
    
    test('should support fuzzy memory search via Claude Code', async () => {
      // Store memory
      const storeResult = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', 'fuzzy-search-key',
        '--value', JSON.stringify({ data: 'This is a test with machine learning information' }),
        '--type', 'observation',
        '--test-mode'
      ]);
      
      expect(storeResult.code).toBe(0);
      
      // Fuzzy search with related terms
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'search',
        '--term', 'artificial intelligence',
        '--fuzzy',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Search Results');
    });
  });
  
  describe('Memory management operations', () => {
    test('should delete memory entries via Claude Code', async () => {
      // First store a memory entry
      const testKey = 'delete-test-key';
      
      const storeResult = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', testKey,
        '--value', JSON.stringify({ data: 'Test data to be deleted' }),
        '--type', 'observation',
        '--test-mode'
      ]);
      
      expect(storeResult.code).toBe(0);
      const memoryId = runner.extractId(storeResult.stdout);
      
      // Delete the memory
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'delete',
        memoryId,
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Memory entry deleted');
      expect(stdout).toContain(memoryId);
      
      // Verify it's deleted by trying to query
      const queryResult = await runner.runCommand([
        '--claude-code',
        'memory', 'query',
        '--key', testKey,
        '--test-mode'
      ], { afterDelete: true });
      
      expect(queryResult.stdout).not.toContain(testKey);
    });
    
    test('should clear memory by type via Claude Code', async () => {
      // Store memories with a specific type to clear
      const typeToClear = 'temporary';
      
      for (let i = 0; i < 3; i++) {
        const storeResult = await runner.runCommand([
          '--claude-code',
          'memory', 'store',
          '--key', `clear-test-${i}`,
          '--value', JSON.stringify({ data: `Data ${i}` }),
          '--type', typeToClear,
          '--test-mode'
        ]);
        
        expect(storeResult.code).toBe(0);
      }
      
      // Clear memories by type
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'clear',
        '--type', typeToClear,
        '--confirm',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Cleared');
      
      // Verify they're cleared
      const listResult = await runner.runCommand([
        '--claude-code',
        'memory', 'list',
        '--type', typeToClear,
        '--test-mode'
      ], { afterClear: true });
      
      expect(listResult.stdout).toContain('No memories found');
    });
    
    test('should show memory statistics via Claude Code', async () => {
      // Store a few memories for stats
      for (let i = 0; i < 5; i++) {
        const storeResult = await runner.runCommand([
          '--claude-code',
          'memory', 'store',
          '--key', `stats-test-${i}`,
          '--value', JSON.stringify({ data: `Stats test data ${i}` }),
          '--type', i % 2 === 0 ? 'observation' : 'decision',
          '--test-mode'
        ]);
        
        expect(storeResult.code).toBe(0);
      }
      
      // Get memory stats
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'stats',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      expect(stdout).toContain('Memory System Statistics');
    });
  });
  
  describe('JSON output format', () => {
    test('should support JSON format for memory listing via Claude Code', async () => {
      // Store a memory for listing
      const storeResult = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        '--key', 'json-test-key',
        '--value', JSON.stringify({ data: 'JSON test data' }),
        '--type', 'observation',
        '--test-mode'
      ]);
      
      expect(storeResult.code).toBe(0);
      
      // List memory with JSON output
      const { stdout, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'list',
        '--format', 'json',
        '--test-mode'
      ]);
      
      expect(code).toBe(0);
      
      const parsed = runner.parseJsonOutput(stdout);
      expect(parsed).not.toBeNull();
      expect(Array.isArray(parsed)).toBe(true);
      
      // Verify our test entry is in the results
      const foundEntry = parsed.find(entry => entry.content && entry.content.includes('JSON test data'));
      expect(foundEntry).toBeDefined();
    });
  });
  
  describe('Error handling', () => {
    test('should handle missing required parameters via Claude Code', async () => {
      const { stderr, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'store',
        // Missing required --key and --value parameters
        '--test-mode'
      ]);
      
      expect(code).not.toBe(0);
      expect(stderr).toContain('required');
    });
    
    test('should handle invalid memory operations via Claude Code', async () => {
      const { stderr, code } = await runner.runCommand([
        '--claude-code',
        'memory', 'invalid-operation',
        '--test-mode'
      ]);
      
      expect(code).not.toBe(0);
      expect(stderr).toContain('Unknown');
    });
  });
});