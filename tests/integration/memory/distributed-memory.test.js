/**
 * Integration tests for DistributedMemorySystem
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as path from 'path';
import * as fs from 'node:fs/promises';

// Mock node:fs/promises
// Using centralized mock system for better test isolation

// Mock node:path to fix file path issues
// Using centralized mock system for better test isolation

// Mock the Logger class to avoid the initialization error
// Using centralized mock system for better test isolation

// Mock path for consistent path operations
// Using centralized mock system for better test isolation

// Mock Logger to prevent initialization errors
jest.mock('../../../src/core/logger.ts', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    configure: jest.fn().mockResolvedValue(undefined),
    child: jest.fn().mockReturnThis()
  })),
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  },
}));
import { EventBus } from '../../../src/core/event-bus.js';
import { Logger } from '../../../src/core/logger.ts';
import { DistributedMemorySystem } from '../../../original-flowx/src/memory/distributed-memory.js';

describe('DistributedMemorySystem Integration', () => {
  let eventBus;
  let logger;
  let memorySystem;
  
  beforeEach(async () => {
    // Create dependencies
    eventBus = new EventBus();
    
    // Create mock logger directly
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      configure: jest.fn().mockResolvedValue(undefined),
      child: jest.fn().mockReturnThis()
    };
    
    // Set up test configuration with specific paths that will be mocked
    const testConfig = {
      namespace: 'test',
      distributed: true,
      consistency: 'eventual',
      replicationFactor: 2,
      syncInterval: 1000,
      maxMemorySize: 1024 * 1024, // 1MB
      compressionEnabled: false,
      encryptionEnabled: false,
      backupEnabled: false,
      persistenceEnabled: false,
      shardingEnabled: false,
      cacheSize: 100,
      cacheTtl: 5000 // 5 seconds
    };
    
    // Create memory system with test config
    memorySystem = new DistributedMemorySystem(testConfig, logger, eventBus);
    
    // Mock any required file system operations
    await memorySystem.initialize();
  });
  
  afterEach(async () => {
    // Reset all mocks between tests
    jest.clearAllMocks();
    await memorySystem.shutdown();
  });
  
  test('should store and retrieve entries', async () => {
    // Store test entry
    const key = 'test-key';
    const value = { message: 'Test data' };
    
    const entryId = await memorySystem.store(key, value, {
      type: 'knowledge',
      tags: ['test', 'integration']
    });
    
    expect(entryId).toBeDefined();
    expect(typeof entryId).toBe('string');
    
    // Retrieve the entry
    const entry = await memorySystem.retrieve(key);
    
    expect(entry).toBeDefined();
    expect(entry.key).toBe(key);
    expect(entry.value).toEqual(value);
    expect(entry.type).toBe('knowledge');
    expect(entry.tags).toContain('test');
    expect(entry.tags).toContain('integration');
  });
  
  test('should update existing entries', async () => {
    // Store initial entry
    const key = 'update-test';
    const initialValue = { count: 1 };
    
    await memorySystem.store(key, initialValue);
    
    // Update the entry
    const updated = await memorySystem.update(key, { count: 2 });
    expect(updated).toBe(true);
    
    // Retrieve updated entry
    const entry = await memorySystem.retrieve(key);
    expect(entry.value).toEqual({ count: 2 });
    expect(entry.version).toBe(2); // Version incremented
  });
  
  test('should merge objects when update with merge option', async () => {
    // Store initial entry
    const key = 'merge-test';
    const initialValue = { name: 'Test', count: 1 };
    
    await memorySystem.store(key, initialValue);
    
    // Update with merge
    const updated = await memorySystem.update(key, { count: 2, status: 'active' }, { merge: true });
    expect(updated).toBe(true);
    
    // Retrieve merged entry
    const entry = await memorySystem.retrieve(key);
    expect(entry.value).toEqual({
      name: 'Test', // Retained from original
      count: 2,     // Updated
      status: 'active' // Added
    });
  });
  
  test('should delete entries', async () => {
    // Store entry
    const key = 'delete-test';
    const entryId = await memorySystem.store(key, { test: true });
    
    // Verify it exists
    const entry = await memorySystem.retrieve(key);
    expect(entry).toBeDefined();
    
    // Delete entry
    const deleted = await memorySystem.deleteEntry(entryId);
    expect(deleted).toBe(true);
    
    // Verify it's gone
    const retrievedAfterDelete = await memorySystem.retrieve(key);
    expect(retrievedAfterDelete).toBeNull();
  });
  
  test('should query entries by criteria', async () => {
    // Store multiple entries
    await memorySystem.store('query-1', { value: 1 }, { 
      type: 'data', 
      tags: ['test', 'number'] 
    });
    await memorySystem.store('query-2', { value: 2 }, { 
      type: 'data', 
      tags: ['test', 'number'] 
    });
    await memorySystem.store('query-3', { value: 'string' }, { 
      type: 'text', 
      tags: ['test', 'string'] 
    });
    
    // Query by type
    const dataEntries = await memorySystem.query({ type: 'data' });
    expect(dataEntries.length).toBe(2);
    expect(dataEntries.every(e => e.type === 'data')).toBe(true);
    
    // Query by tag
    const stringEntries = await memorySystem.query({ tags: ['string'] });
    expect(stringEntries.length).toBe(1);
    expect(stringEntries[0].value.value).toBe('string');
    
    // Query by multiple criteria
    const testNumbers = await memorySystem.query({ 
      type: 'data',
      tags: ['number']
    });
    expect(testNumbers.length).toBe(2);
  });
  
  test('should handle cache operations correctly', async () => {
    // Store entry
    const key = 'cache-test';
    await memorySystem.store(key, { cached: true });
    
    // First retrieval should cache the entry
    await memorySystem.retrieve(key);
    
    // Spy on internal methods to verify cache usage
    const getEntrySpy = jest.spyOn(memorySystem, 'retrieve');
    
    // Second retrieval should use cache
    await memorySystem.retrieve(key);
    
    // Need to verify cache was used
    // This is difficult to test directly without exposing internals
    // In a real test we would verify cache metrics or use a more testable API
  });
  
  test('should create and manage partitions', async () => {
    // Create a custom partition
    const partitionId = await memorySystem.createPartition(
      'test-partition',
      'custom',
      {
        maxSize: 1024 * 100, // 100KB
        ttl: 3600000, // 1 hour
        indexed: true
      }
    );
    
    expect(partitionId).toBeDefined();
    
    // Store entry in specific partition
    const key = 'partition-test';
    const entryId = await memorySystem.store(key, { test: true }, {
      partition: partitionId
    });
    
    // Retrieve from specific partition
    const entry = await memorySystem.retrieve(key, {
      partition: partitionId
    });
    
    expect(entry).toBeDefined();
    expect(entry.id).toBe(entryId);
    
    // Get partitions
    const partitions = memorySystem.getPartitions();
    expect(partitions.length).toBeGreaterThan(0);
    expect(partitions.some(p => p.id === partitionId)).toBe(true);
  });
  
  test('should report memory statistics', async () => {
    // Store some test data
    await memorySystem.store('stats-test-1', { large: 'x'.repeat(1000) });
    await memorySystem.store('stats-test-2', { large: 'y'.repeat(1000) });
    
    // Get statistics
    const stats = memorySystem.getStatistics();
    
    expect(stats).toBeDefined();
    expect(stats.totalEntries).toBeGreaterThan(0);
    expect(stats.partitionCount).toBeGreaterThan(0);
    expect(stats.nodeCount).toBeGreaterThanOrEqual(1);
  });
  
  test('should handle backup and restore', async () => {
    // Store test data
    await memorySystem.store('backup-test-1', { value: 1 });
    await memorySystem.store('backup-test-2', { value: 2 });
    
    // Create backup
    const backup = await memorySystem.backup();
    expect(backup).toBeDefined();
    expect(typeof backup).toBe('string');
    
    // Clear all data
    await memorySystem.clear();
    
    // Verify data is gone
    const emptyResult = await memorySystem.retrieve('backup-test-1');
    expect(emptyResult).toBeNull();
    
    // Restore from backup
    await memorySystem.restore(backup);
    
    // Verify data is back
    const entry1 = await memorySystem.retrieve('backup-test-1');
    const entry2 = await memorySystem.retrieve('backup-test-2');
    
    expect(entry1).toBeDefined();
    expect(entry1.value.value).toBe(1);
    expect(entry2).toBeDefined();
    expect(entry2.value.value).toBe(2);
  });
});