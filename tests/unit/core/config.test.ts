/**
 * Tests for the ConfigManager
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  mkdtemp: jest.fn(),
  rm: jest.fn()
}));

import { configManager } from '../../../src/core/config';

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the configManager before each test if it has a reset method
    if ((configManager as any).reset) {
      (configManager as any).reset();
    }
  });

  afterEach(() => {
    // Clean up any state
  });

  test('should return default values', () => {
    const config = configManager.get();
    expect(config).toBeDefined();
    expect(config.orchestrator).toBeDefined();
    expect(config.terminal).toBeDefined();
    expect(config.memory).toBeDefined();
    expect(config.mcp).toBeDefined();
    expect(config.logging).toBeDefined();
  });

  test('should update configuration values', () => {
    configManager.update({
      orchestrator: { 
        maxConcurrentAgents: 5,
        taskQueueSize: 100,
        healthCheckInterval: 30000,
        shutdownTimeout: 10000
      },
      terminal: { 
        poolSize: 3,
        type: 'auto' as const,
        recycleAfter: 3600000,
        healthCheckInterval: 60000,
        commandTimeout: 30000
      },
    } as any);

    const config = configManager.get();
    expect(config.orchestrator.maxConcurrentAgents).toBe(5);
    expect(config.terminal.poolSize).toBe(3);
  });

  test('should set and get individual values', () => {
    configManager.set('memory.cacheSizeMB', 200);
    configManager.set('logging.level', 'debug');

    expect(configManager.getValue('memory.cacheSizeMB')).toBe(200);
    expect(configManager.getValue('logging.level')).toBe('debug');
  });

  test('should handle secure config', () => {
    // Just test that getSecure returns a config object
    const secureConfig = configManager.getSecure();
    expect(secureConfig).toBeDefined();
    expect(typeof secureConfig).toBe('object');
  });

  test('should compute diff between current and default', () => {
    configManager.set('memory.cacheSizeMB', 500);
    configManager.set('logging.level', 'debug');
    
    const diff = configManager.getDiff();
    expect(diff.memory.cacheSizeMB).toBe(500);
    expect(diff.logging.level).toBe('debug');
  });
});