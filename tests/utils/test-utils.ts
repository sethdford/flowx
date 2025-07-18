/**
 * Comprehensive test utilities for Claude-Flow
 */

import { expect, jest } from '@jest/globals';

// Export Jest equivalents for common assertions
export const assertEquals = (actual: any, expected: any) => expect(actual).toEqual(expected);
export const assertExists = (value: any) => expect(value).toBeDefined();
export const assertRejects = async (promise: Promise<any> | (() => Promise<any>), errorClass?: any, message?: string) => {
  const promiseToTest = typeof promise === 'function' ? promise() : promise;
  if (errorClass) {
    await expect(promiseToTest).rejects.toThrow(errorClass);
  } else {
    await expect(promiseToTest).rejects.toThrow();
  }
};
export const assertThrows = (fn: () => any, errorClass?: any, message?: string) => {
  if (errorClass) {
    expect(fn).toThrow(errorClass);
  } else {
    expect(fn).toThrow();
  }
};
export const stub = jest.fn;
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock FakeTime for Jest
export class FakeTime {
  private originalSetTimeout: typeof setTimeout;
  private originalSetInterval: typeof setInterval;
  private originalClearTimeout: typeof clearTimeout;
  private originalClearInterval: typeof clearInterval;
  private originalDateNow: typeof Date.now;
  
  private currentTime: number = Date.now();
  private timers: Map<any, { callback: Function; time: number; interval?: number }> = new Map();

  constructor() {
    this.originalSetTimeout = global.setTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearTimeout = global.clearTimeout;
    this.originalClearInterval = global.clearInterval;
    this.originalDateNow = Date.now;
    
    // Override global time functions
    global.setTimeout = ((callback: Function, ms: number) => {
      const id = Symbol('timeout');
      this.timers.set(id, { callback, time: this.currentTime + ms });
      return id as any;
    }) as any;
    
    global.setInterval = ((callback: Function, ms: number) => {
      const id = Symbol('interval');
      this.timers.set(id, { callback, time: this.currentTime + ms, interval: ms });
      return id as any;
    }) as any;
    
    global.clearTimeout = ((id: any) => {
      this.timers.delete(id);
    }) as any;
    
    global.clearInterval = ((id: any) => {
      this.timers.delete(id);
    }) as any;
    
    Date.now = () => this.currentTime;
  }

  tick(ms: number): void {
    const targetTime = this.currentTime + ms;
    
    while (this.currentTime < targetTime) {
      // Find next timer to fire
      let nextTimer: { id: any; timer: { callback: Function; time: number; interval?: number } } | null = null;
      
      for (const [id, timer] of this.timers.entries()) {
        if (timer.time <= targetTime && (!nextTimer || timer.time < nextTimer.timer.time)) {
          nextTimer = { id, timer };
        }
      }
      
      if (!nextTimer) {
        this.currentTime = targetTime;
        break;
      }
      
      // Advance to timer time and fire it
      this.currentTime = nextTimer.timer.time;
      nextTimer.timer.callback();
      
      // Handle intervals
      if (nextTimer.timer.interval) {
        nextTimer.timer.time = this.currentTime + nextTimer.timer.interval;
      } else {
        this.timers.delete(nextTimer.id);
      }
    }
  }

  restore(): void {
    global.setTimeout = this.originalSetTimeout;
    global.setInterval = this.originalSetInterval;
    global.clearTimeout = this.originalClearTimeout;
    global.clearInterval = this.originalClearInterval;
    Date.now = this.originalDateNow;
  }
}

export type Spy = jest.MockedFunction<any>;

/**
 * Test utilities for async operations
 */
export class AsyncTestUtils {
  /**
   * Wait for condition to be true with timeout
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    options: { timeout?: number; interval?: number; message?: string } = {}
  ): Promise<void> {
    const { timeout = 5000, interval = 100, message = 'Condition not met within timeout' } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const result = await condition();
      if (result) {
        return;
      }
      await delay(interval);
    }
    
    throw new Error(message);
  }

  /**
   * Wait for all conditions to be true
   */
  static async waitForAll(
    conditions: Array<() => boolean | Promise<boolean>>,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<void> {
    const { timeout = 5000, interval = 100 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const results = await Promise.all(conditions.map(c => c()));
      if (results.every(r => r)) {
        return;
      }
      await delay(interval);
    }
    
    throw new Error('Not all conditions met within timeout');
  }

  /**
   * Wait for any condition to be true
   */
  static async waitForAny(
    conditions: Array<() => boolean | Promise<boolean>>,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<void> {
    const { timeout = 5000, interval = 100 } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const results = await Promise.all(conditions.map(c => c()));
      if (results.some(r => r)) {
        return;
      }
      await delay(interval);
    }
    
    throw new Error('No conditions met within timeout');
  }

  /**
   * Run operation with timeout
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      initialDelay?: number;
      maxDelay?: number;
      backoffFactor?: number;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 100,
      maxDelay = 5000,
      backoffFactor = 2
    } = options;
    
    let lastError: Error;
    let currentDelay = initialDelay;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        await delay(Math.min(currentDelay, maxDelay));
        currentDelay *= backoffFactor;
      }
    }
    
    throw lastError!;
  }
}

/**
 * Memory testing utilities
 */
export class MemoryTestUtils {
  /**
   * Monitor memory usage during operation
   */
  static async monitorMemory<T>(
    operation: () => Promise<T>,
    options: { sampleInterval?: number; maxSamples?: number } = {}
  ): Promise<{ result: T; memoryStats: Array<{ timestamp: number; heapUsed: number; external: number }> }> {
    const { sampleInterval = 100, maxSamples = 100 } = options;
    const memoryStats: Array<{ timestamp: number; heapUsed: number; external: number }> = [];
    
    const startMonitoring = () => {
      const interval = setInterval(() => {
        if (memoryStats.length >= maxSamples) {
          clearInterval(interval);
          return;
        }
        
        const usage = process.memoryUsage();
        memoryStats.push({
          timestamp: Date.now(),
          heapUsed: usage.heapUsed,
          external: usage.external
        });
      }, sampleInterval);
      
      return interval;
    };
    
    const interval = startMonitoring();
    
    try {
      const result = await operation();
      clearInterval(interval);
      return { result, memoryStats };
    } catch (error) {
      clearInterval(interval);
      throw error;
    }
  }

  /**
   * Force garbage collection if available
   */
  static async forceGC(): Promise<void> {
    if (global.gc) {
      global.gc();
    }
    
    // Give GC time to run
    await delay(10);
  }

  /**
   * Check for memory leaks
   */
  static async checkMemoryLeak<T>(
    operation: () => Promise<T>,
    options: { threshold?: number; samples?: number } = {}
  ): Promise<{ result: T; memoryIncrease: number; leaked: boolean }> {
    const { threshold = 1024 * 1024, samples = 3 } = options; // 1MB threshold
    
    // Force GC and get baseline
    await this.forceGC();
    const baseline = this.getAverageMemoryUsage(samples);
    
    // Run operation
    const result = await operation();
    
    // Force GC and measure final memory
    await this.forceGC();
    const final = this.getAverageMemoryUsage(samples);
    
    const memoryIncrease = final - baseline;
    const leaked = memoryIncrease > threshold;
    
    return { result, memoryIncrease, leaked };
  }

  private static getAverageMemoryUsage(samples: number): number {
    const measurements: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      measurements.push(process.memoryUsage().heapUsed);
    }
    
    return measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time of operation
   */
  static async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    const result = await operation();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    return { result, duration };
  }

  /**
   * Run benchmark with multiple iterations
   */
  static async benchmark<T>(
    operation: () => Promise<T>,
    options: {
      iterations?: number;
      warmupIterations?: number;
      concurrency?: number;
    } = {}
  ): Promise<{
    results: T[];
    stats: {
      mean: number;
      median: number;
      min: number;
      max: number;
      stdDev: number;
      p95: number;
      p99: number;
    };
  }> {
    const { iterations = 10, warmupIterations = 3, concurrency = 1 } = options;
    
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await operation();
    }
    
    // Run benchmarks
    const results: T[] = [];
    const durations: number[] = [];
    
    const runBatch = async (batchSize: number) => {
      const promises = Array(batchSize).fill(0).map(async () => {
        const { result, duration } = await this.measureTime(operation);
        results.push(result);
        durations.push(duration);
      });
      
      await Promise.all(promises);
    };
    
    const batches = Math.ceil(iterations / concurrency);
    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(concurrency, iterations - i * concurrency);
      await runBatch(batchSize);
    }
    
    // Calculate statistics
    const sorted = [...durations].sort((a, b) => a - b);
    const mean = durations.reduce((sum, val) => sum + val, 0) / durations.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    const variance = durations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    return {
      results,
      stats: { mean, median, min, max, stdDev, p95, p99 }
    };
  }

  /**
   * Run load test
   */
  static async loadTest<T>(
    operation: () => Promise<T>,
    options: {
      duration?: number; // ms
      rampUpTime?: number; // ms
      maxConcurrency?: number;
      requestsPerSecond?: number;
    } = {}
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    requestsPerSecond: number;
    errors: Error[];
  }> {
    const {
      duration = 10000,
      rampUpTime = 1000,
      maxConcurrency = 10,
      requestsPerSecond = 10
    } = options;
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    const rampUpEndTime = startTime + rampUpTime;
    
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalResponseTime = 0;
    const errors: Error[] = [];
    
    const runRequest = async () => {
      const requestStart = Date.now();
      totalRequests++;
      
      try {
        await operation();
        successfulRequests++;
        totalResponseTime += Date.now() - requestStart;
      } catch (error) {
        failedRequests++;
        errors.push(error as Error);
      }
    };
    
    const promises: Promise<void>[] = [];
    let currentConcurrency = 1;
    
    while (Date.now() < endTime) {
      // Adjust concurrency during ramp-up
      if (Date.now() < rampUpEndTime) {
        const rampUpProgress = (Date.now() - startTime) / rampUpTime;
        currentConcurrency = Math.ceil(maxConcurrency * rampUpProgress);
      } else {
        currentConcurrency = maxConcurrency;
      }
      
      // Launch requests up to current concurrency
      while (promises.length < currentConcurrency && Date.now() < endTime) {
        const promise = runRequest().finally(() => {
          const index = promises.indexOf(promise);
          if (index > -1) {
            promises.splice(index, 1);
          }
        });
        
        promises.push(promise);
      }
      
      // Wait for rate limiting
      await delay(1000 / requestsPerSecond);
    }
    
    // Wait for all remaining requests to complete
    await Promise.all(promises);
    
    const averageResponseTime = totalResponseTime / successfulRequests || 0;
    const actualRequestsPerSecond = totalRequests / (duration / 1000);
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      requestsPerSecond: actualRequestsPerSecond,
      errors
    };
  }
}

/**
 * File system testing utilities
 */
export class FileSystemTestUtils {
  /**
   * Create temporary directory
   */
  static async createTempDir(prefix = 'flowx-test-'): Promise<string> {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { mkdir } = await import('node:fs/promises');
    
    const tempPath = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(36).substring(2)}`);
    await mkdir(tempPath, { recursive: true });
    return tempPath;
  }

  /**
   * Create temporary file
   */
  static async createTempFile(
    content: string,
    options: { suffix?: string; dir?: string } = {}
  ): Promise<string> {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { writeFile } = await import('node:fs/promises');
    
    const { suffix = '.tmp', dir = tmpdir() } = options;
    const fileName = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}${suffix}`;
    const filePath = join(dir, fileName);
    
    await writeFile(filePath, content);
    return filePath;
  }

  /**
   * Create test fixtures
   */
  static async createFixtures(
    fixtures: Record<string, string>,
    baseDir?: string
  ): Promise<string> {
    const { join } = await import('node:path');
    const { mkdir, writeFile } = await import('node:fs/promises');
    
    const fixturesDir = baseDir || await this.createTempDir('fixtures-');
    
    for (const [relativePath, content] of Object.entries(fixtures)) {
      const fullPath = join(fixturesDir, relativePath);
      const dir = join(fullPath, '..');
      
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
    }
    
    return fixturesDir;
  }

  /**
   * Cleanup paths
   */
  static async cleanup(paths: string[]): Promise<void> {
    const { rm } = await import('node:fs/promises');
    
    for (const path of paths) {
      try {
        await rm(path, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Mock factory utilities
 */
export class MockFactory {
  /**
   * Create mock with spies
   */
  static createMock<T extends Record<string, any>>(
    original: T,
    overrides: Partial<T> = {}
  ): T & { [K in keyof T]: T[K] extends (...args: any[]) => any ? Spy : T[K] } {
    const mock = { ...original, ...overrides } as any;
    
    for (const [key, value] of Object.entries(mock)) {
      if (typeof value === 'function') {
        mock[key] = jest.fn(value as (...args: any[]) => any);
      }
    }
    
    return mock;
  }

  /**
   * Create spy function
   */
  static createSpy<T extends (...args: any[]) => any>(
    implementation?: T
  ): Spy & T {
    return jest.fn(implementation) as any;
  }

  /**
   * Create mock that fails on specified methods
   */
  static createFailingMock<T extends Record<string, any>>(
    original: T,
    failingMethods: (keyof T)[],
    error: Error = new Error('Mock failure')
  ): T {
    const mock = { ...original } as any;
    for (const method of failingMethods) {
      if (typeof original[method] === 'function') {
        mock[method] = jest.fn().mockRejectedValue(error as never);
      }
    }
    
    return mock;
  }
}

/**
 * Test data generation utilities
 */
export class TestDataGenerator {
  /**
   * Generate random string
   */
  static randomString(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Generate random number
   */
  static randomNumber(min = 0, max = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean
   */
  static randomBoolean(): boolean {
    return Math.random() >= 0.5;
  }

  /**
   * Generate random array
   */
  static randomArray<T>(generator: () => T, length?: number): T[] {
    const arrayLength = length || this.randomNumber(1, 10);
    return Array(arrayLength).fill(0).map(() => generator());
  }

  /**
   * Generate random object
   */
  static randomObject(schema: Record<string, () => any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, generator] of Object.entries(schema)) {
      result[key] = generator();
    }
    
    return result;
  }

  /**
   * Generate large dataset
   */
  static largeDataset(size: number): Array<{ id: string; name: string; value: number; data: string }> {
    return Array(size).fill(0).map((_, index) => ({
      id: `item-${index}`,
      name: this.randomString(8),
      value: this.randomNumber(1, 1000),
      data: this.randomString(100)
    }));
  }
}

/**
 * Test assertion utilities
 */
export class TestAssertions {
  /**
   * Assert operation completes within timeout
   */
  static async assertCompletesWithin<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    message?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(message || `Operation did not complete within ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Assert async operation throws
   */
  static async assertThrowsAsync<T extends Error>(
    operation: () => Promise<any>,
    ErrorClass?: new (...args: any[]) => T,
    msgIncludes?: string
  ): Promise<T> {
    try {
      await operation();
      throw new Error('Expected operation to throw, but it did not');
    } catch (error) {
      if (ErrorClass && !(error instanceof ErrorClass)) {
        throw new Error(`Expected error to be instance of ${ErrorClass.name}, but got ${(error as Error).constructor.name}`);
      }
      
      if (msgIncludes && !(error as Error).message.includes(msgIncludes)) {
        throw new Error(`Expected error message to include "${msgIncludes}", but got "${(error as Error).message}"`);
      }
      
      return error as T;
    }
  }

  /**
   * Assert number is in range
   */
  static assertInRange(
    actual: number,
    min: number,
    max: number,
    message?: string
  ): void {
    if (actual < min || actual > max) {
      throw new Error(
        message || `Expected ${actual} to be between ${min} and ${max}`
      );
    }
  }

  /**
   * Assert arrays have same elements (order independent)
   */
  static assertSameElements<T>(
    actual: T[],
    expected: T[],
    message?: string
  ): void {
    const actualSorted = [...actual].sort();
    const expectedSorted = [...expected].sort();
    
    expect(actualSorted).toEqual(expectedSorted);
  }

  /**
   * Assert spy was called with specific arguments
   */
  static assertSpyCalledWith(
    spy: Spy,
    expectedArgs: any[],
    message?: string
  ): void {
    expect(spy).toHaveBeenCalledWith(...expectedArgs);
  }
}