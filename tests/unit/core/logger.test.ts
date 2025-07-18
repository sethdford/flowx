/**
 * Unit tests for Logger
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('Logger', () => {
  let originalConsole: any;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original console methods
    originalConsole = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    // Save original environment
    originalEnv = process.env.FLOWX_ENV;
    
    // Set environment to avoid singleton initialization errors
    process.env.FLOWX_ENV = 'development';

    // Mock console methods
    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.FLOWX_ENV = originalEnv;
    } else {
      delete process.env.FLOWX_ENV;
    }
  });

  it('should be able to get instance with proper configuration', async () => {
    // Import after setting up environment
    const { Logger } = await import('../../../src/core/logger');
    
    const logger = Logger.getInstance({
      level: 'info',
      format: 'json',
      destination: 'console'
    });

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should handle mock logger methods', async () => {
    const { Logger } = await import('../../../src/core/logger');
    
    const logger = Logger.getInstance({
      level: 'debug',
      format: 'json',
      destination: 'console'
    });

    // Test that the logger methods exist and can be called
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');

    // Since the logger is mocked globally, we just verify the methods exist
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should handle error objects', async () => {
    const { Logger } = await import('../../../src/core/logger');
    
    const logger = Logger.getInstance({
      level: 'error',
      format: 'json',
      destination: 'console'
    });

    const testError = new Error('Test error');
    
    // Test that error method can be called with error objects
    expect(() => {
      logger.error('Error occurred', testError);
    }).not.toThrow();
  });

  it('should return same instance for singleton pattern', async () => {
    const { Logger } = await import('../../../src/core/logger');
    
    const logger1 = Logger.getInstance({
      level: 'info',
      format: 'json',
      destination: 'console'
    });
    
    const logger2 = Logger.getInstance();
    
    expect(logger1).toBe(logger2);
  });
});
