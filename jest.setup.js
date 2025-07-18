// Jest setup file for Node.js environment
import { jest } from '@jest/globals';

// Set test environment
process.env.FLOWX_ENV = 'test';
process.env.NODE_ENV = 'test';

// Configure longer timeout for E2E tests
jest.setTimeout(30000);

// Mock console output unless VERBOSE_TESTS is set
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    // Suppress console output during tests
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Clean up any potential side effects
afterEach(() => {
  // Add any necessary cleanup here
});