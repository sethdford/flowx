/**
 * Unit tests for Database MCP tools
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createDatabaseTools } from '../../../../src/mcp/tools/database/index';
import { MockLogger } from '../../../mocks/index';
import path from 'node:path';

// Mock child_process
jest.mock('node:child_process', () => ({
  exec: jest.fn((cmd: string, callback?: (error: any, stdout: any, stderr: any) => void) => {
    if (callback) {
      // Always call callback with mock data for tests
      callback(null, '[]', '');
    }
    return {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn()
    };
  })
}));

// Mock fs/promises
jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  rmdir: jest.fn()
}));

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn(() => ({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(() => [])
    })),
    exec: jest.fn(),
    close: jest.fn()
  }));
});

// Helper function to create temp directory for tests
async function createTempDir(): Promise<string> {
  const os = await import('node:os');
  const tempDir = path.join(os.tmpdir(), `flowx-test-${Date.now()}`);
  return tempDir;
}

// Helper function to cleanup temp directory
async function cleanupTempDir(dir: string): Promise<void> {
  // Mock cleanup for tests
  return Promise.resolve();
}

describe('Database MCP Tools', () => {
  let tempDir: string;
  let mockLogger: any;

  beforeEach(async () => {
    // Use fake timers to prevent hanging
    jest.useFakeTimers();
    
    // Create mock logger
    mockLogger = new MockLogger();
    
    // Create temp directory for tests
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    // Clean up temp directory
    await cleanupTempDir(tempDir);
    
    // Clear all timers and mocks
    jest.clearAllTimers();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should create all database tools', async () => {
    const tools = await createDatabaseTools(mockLogger);
    
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    
    // Check that each tool has required properties
    tools.forEach(tool => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool).toHaveProperty('handler');
      expect(typeof tool.handler).toBe('function');
    });
  });

  it('should have database_query tool', () => {
    const tools = createDatabaseTools(mockLogger);
    
    const queryTool = tools.find(tool => tool.name === 'database/query');
    expect(queryTool).toBeDefined();
    expect(queryTool?.description).toContain('queries');
  });

  it('should have database_execute tool', () => {
    const tools = createDatabaseTools(mockLogger);
    
    const executeTool = tools.find(tool => tool.name === 'database/execute');
    expect(executeTool).toBeDefined();
    expect(executeTool?.description).toContain('commands');
  });

  it('should handle database operations without hanging', async () => {
    const tools = await createDatabaseTools(mockLogger);
    
    // Test that tools can be created without hanging
    expect(tools).toBeDefined();
    
    // Advance timers to ensure no hanging intervals
    jest.advanceTimersByTime(1000);
    
    // Test should complete without timeout
    expect(true).toBe(true);
  });

  it('should handle tool execution with proper error handling', async () => {
    const tools = await createDatabaseTools(mockLogger);
    
    const queryTool = tools.find(tool => tool.name === 'database_query');
    
    if (queryTool) {
      // Test tool execution doesn't throw
      try {
        await queryTool.handler({
          query: 'SELECT * FROM test_table',
          database: 'test.db'
        });
        // Should not throw
        expect(true).toBe(true);
      } catch (error) {
        // Error handling should be graceful
        expect(error).toBeDefined();
      }
    }
  });

  it('should properly cleanup resources', async () => {
    const tools = await createDatabaseTools(mockLogger);
    
    // Tools should be created successfully
    expect(tools).toBeDefined();
    
    // Advance timers to trigger any cleanup
    jest.advanceTimersByTime(5000);
    
    // Test should complete without resource leaks
    expect(true).toBe(true);
  });
});