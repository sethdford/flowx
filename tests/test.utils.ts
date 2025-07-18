/**
 * Test utilities and helpers
 */

import { jest } from '@jest/globals';
import { Logger } from '../src/core/logger';
import { EventBus } from '../src/core/event-bus';

// Re-export Jest functions for consistency
export { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';

// Custom assertion helpers
export function assertEquals(actual: any, expected: any, message?: string) {
  expect(actual).toEqual(expected);
}

export function assertExists(value: any, message?: string) {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

export function assertStringIncludes(actual: string, expected: string, message?: string) {
  expect(actual).toContain(expected);
}

export function assertThrows(fn: () => void, ErrorClass?: any, message?: string) {
  if (ErrorClass) {
    expect(fn).toThrow(ErrorClass);
  } else {
    expect(fn).toThrow();
  }
}

export async function assertRejects(fn: () => Promise<any>, ErrorClass?: any, message?: string) {
  if (ErrorClass) {
    await expect(fn()).rejects.toThrow(ErrorClass);
  } else {
    await expect(fn()).rejects.toThrow();
  }
}

// Spy utilities
export function spy(fn?: (...args: any[]) => any) {
  return jest.fn(fn);
}

export function assertSpyCalls(spyFn: jest.Mock | any, expectedCalls: number) {
  expect(spyFn).toHaveBeenCalledTimes(expectedCalls);
}

// Timer utilities
export class FakeTime {
  private originalTimers: any;
  private currentTime: number;

  constructor(initialTime?: number) {
    this.currentTime = initialTime || Date.now();
    this.originalTimers = {
      setTimeout: global.setTimeout,
      setInterval: global.setInterval,
      clearTimeout: global.clearTimeout,
      clearInterval: global.clearInterval,
      Date: global.Date
    };
    jest.useFakeTimers();
    if (initialTime !== undefined) {
      jest.setSystemTime(new Date(this.currentTime));
    }
  }

  now(): number {
    return this.currentTime;
  }

  tick(ms: number) {
    this.currentTime += ms;
    jest.advanceTimersByTime(ms);
    jest.setSystemTime(new Date(this.currentTime));
  }

  async tickAsync(ms: number) {
    this.currentTime += ms;
    jest.advanceTimersByTime(ms);
    jest.setSystemTime(new Date(this.currentTime));
    // Allow any pending promises to resolve
    await Promise.resolve();
  }

  restore() {
    jest.useRealTimers();
  }
}

// Async utilities
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
} {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve: resolve!, reject: reject! };
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } | number = 5000,
  intervalMs: number = 100
): Promise<void> {
  // Handle both old and new signatures
  const timeoutMs = typeof options === 'number' ? options : (options.timeout || 5000);
  const interval = typeof options === 'number' ? intervalMs : (options.interval || 100);
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

// Console capture utility
export function captureConsole(): {
  logs: string[];
  errors: string[];
  getOutput: () => string[];
  getErrors: () => string[];
  restore: () => void;
} {
  const logs: string[] = [];
  const errors: string[] = [];
  
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = jest.fn((...args) => {
    logs.push(args.join(' '));
  });
  
  console.error = jest.fn((...args) => {
    errors.push(args.join(' '));
  });
  
  return {
    logs,
    errors,
    getOutput: () => [...logs],
    getErrors: () => [...errors],
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    }
  };
}

// Mock factory functions
export function createMockLogger(): Logger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => createMockLogger()),
    configure: jest.fn(),
    close: jest.fn()
  } as any;
}

export function createMockEventBus(): EventBus {
  const listeners = new Map<string, Set<Function>>();
  
  return {
    on: jest.fn((event: string, listener: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
    }),
    off: jest.fn((event: string, listener: Function) => {
      listeners.get(event)?.delete(listener);
    }),
    emit: jest.fn((event: string, ...args: any[]) => {
      listeners.get(event)?.forEach(listener => listener(...args));
    }),
    removeAllListeners: jest.fn(() => {
      listeners.clear();
    })
  } as any;
}

// Test environment setup
export function setupTestEnv() {
  process.env.NODE_ENV = 'test';
  process.env.FLOWX_ENV = 'test';
  process.env.FLOWX_LOG_LEVEL = 'silent';
  process.env.FLOWX_DISABLE_METRICS = 'true';
  process.env.FLOWX_DISABLE_TELEMETRY = 'true';
}

export function cleanupTestEnv() {
  // Clear all timers
  jest.clearAllTimers();
  jest.clearAllMocks();
}

// File system test utilities
export async function createTempDir(prefix: string = 'test-'): Promise<string> {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return tempDir;
}

export async function cleanupTempDir(dir: string): Promise<void> {
  const fs = await import('node:fs/promises');
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Database test utilities
export function createMockDatabase() {
  const storage = new Map<string, any>();
  
  return {
    prepare: jest.fn((sql: string) => ({
      run: jest.fn((params?: any[]) => {
        // Mock implementation based on SQL
        if (sql.includes('INSERT')) {
          const key = params?.[0] || 'default';
          storage.set(key, params);
        }
        return { changes: 1 };
      }),
      get: jest.fn((params?: any[]) => {
        const key = params?.[0] || 'default';
        return storage.get(key);
      }),
      all: jest.fn(() => Array.from(storage.values()))
    })),
    exec: jest.fn(),
    close: jest.fn(),
    serialize: jest.fn(() => Buffer.from('mock-db'))
  };
}

// Memory manager test utilities
export function createMockMemoryManager() {
  const storage = new Map<string, any>();
  
  return {
    store: jest.fn(async (key: string, value: any) => {
      storage.set(key, value);
    }),
    retrieve: jest.fn(async (key: string) => {
      return storage.get(key);
    }),
    delete: jest.fn(async (key: string) => {
      storage.delete(key);
    }),
    query: jest.fn(async () => []),
    getHealthStatus: jest.fn(async () => ({
      status: 'healthy',
      healthy: true,
      details: {},
      timestamp: new Date()
    })),
    shutdown: jest.fn(async () => {})
  };
}

// Task and coordination test utilities
export function createMockTask(id: string = 'test-task') {
  return {
    id,
    type: 'test',
    description: 'Test task',
    priority: 1,
    dependencies: [],
    status: 'pending',
    input: {},
    createdAt: new Date()
  };
}

export function createMockAgent(id: string = 'test-agent') {
  return {
    id,
    name: 'Test Agent',
    type: 'general',
    capabilities: ['test'],
    status: 'active',
    load: 0,
    lastSeen: new Date()
  };
}

// Assertion utilities for ranges
export function assertInRange(value: number, min: number, max: number, message?: string) {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

export function assertGreater(actual: number, expected: number, message?: string) {
  expect(actual).toBeGreaterThan(expected);
}

// Delay utility for tests
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test data generators
export function generateTestData(count: number, generator: (index: number) => any): any[] {
  return Array.from({ length: count }, (_, index) => generator(index));
}

export class TestDataBuilder {
  static agentProfile(overrides = {}) {
    return {
      id: 'test-agent',
      name: 'Test Agent',
      type: 'coordinator' as 'coordinator' | 'researcher' | 'implementer' | 'analyst' | 'custom',
      capabilities: ['code', 'debug'],
      systemPrompt: 'You are a test agent',
      maxConcurrentTasks: 3,
      priority: 5,
      environment: {},
      workingDirectory: '/tmp',
      shell: 'bash',
      metadata: {},
      ...overrides,
    };
  }

  static task(overrides = {}) {
    return {
      id: 'test-task',
      name: 'Test Task',
      description: 'A test task',
      type: 'code',
      status: 'pending' as 'pending' | 'queued' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled',
      priority: 5,
      dependencies: [],
      input: {},
      createdAt: new Date(),
      ...overrides,
    };
  }

  static config(overrides = {}) {
    return {
      name: 'test-config',
      version: '1.0.0',
      environment: 'test',
      orchestrator: {
        dataDir: './test-data',
        maxConcurrentTasks: 10,
        taskTimeout: 60000,
        enablePersistence: false,
      },
      agents: {
        maxConcurrent: 5,
        defaultTimeout: 30000,
      },
      tasks: {
        maxConcurrent: 10,
        defaultTimeout: 60000,
      },
      ...overrides,
    };
  }
}

// Test configuration
export const TEST_CONFIG = {
  timeout: {
    unit: 15000,
    integration: 45000,
    e2e: 90000
  },
  tempDir: '/tmp/flowx-tests',
  logLevel: 'silent'
};

// Export commonly used test patterns
export const TestUtils = {
  createMockLogger,
  createMockEventBus,
  createMockDatabase,
  createMockMemoryManager,
  createMockTask,
  createMockAgent,
  setupTestEnv,
  cleanupTestEnv,
  createTempDir,
  cleanupTempDir,
  assertInRange,
  delay,
  generateTestData
}; 