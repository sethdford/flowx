/**
 * Comprehensive Jest setup for Claude-Flow tests
 */

import { jest } from '@jest/globals';

// Set test environment variable for proper logger initialization
process.env.FLOWX_ENV = 'test';
process.env.NODE_ENV = 'test';

// Set test timeout - increased to avoid timeouts in complex tests
jest.setTimeout(30000);

// Store working directory reference for mocks
const mockTestWorkingDir = process.cwd();

// Mock Deno runtime for tests that import Deno modules
global.Deno = {
  cwd: jest.fn(() => mockTestWorkingDir),
  readTextFile: jest.fn(),
  writeTextFile: jest.fn(),
  mkdir: jest.fn(),
  remove: jest.fn(),
  env: {
    get: jest.fn((key) => process.env[key]),
    set: jest.fn((key, value) => { process.env[key] = value; }),
    has: jest.fn((key) => key in process.env),
    toObject: jest.fn(() => ({ ...process.env }))
  },
  errors: {
    NotFound: class extends Error { name = 'NotFound' }
  },
  makeTempDir: jest.fn(() => Promise.resolve('/tmp/test-dir')),
  stat: jest.fn(() => Promise.resolve({ isFile: true, isDirectory: false, size: 0 })),
  Command: jest.fn().mockImplementation(() => ({
    output: jest.fn(() => Promise.resolve({ success: true, code: 0, stdout: '', stderr: '' }))
  }))
};

// Mock fs promises for modules that use them
jest.mock('fs/promises', () => ({
  readFile: jest.fn(() => Promise.resolve('mock file content')),
  writeFile: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
  unlink: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({ isFile: () => true, isDirectory: () => false, size: 0 })),
  access: jest.fn(() => Promise.resolve()),
  rm: jest.fn(() => Promise.resolve())
}));

// Mock child_process spawn/exec for CLI tests
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event, cb) => {
      if (event === 'close') {
        setTimeout(() => cb(0), 10);
      }
    }),
    kill: jest.fn()
  })),
  exec: jest.fn((cmd, cb) => cb(null, 'mock output', '')),
  execSync: jest.fn(() => 'mock output'),
  fork: jest.fn(() => ({
    on: jest.fn(),
    send: jest.fn(),
    kill: jest.fn()
  }))
}));

// Mock path module for consistent behavior  
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn((...args) => {
    const path = jest.requireActual('path');
    // Use the stored working directory instead of a variable reference
    return path.resolve(process.cwd(), ...args);
  })
}));

// Mock os module for temp directory operations
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  tmpdir: jest.fn(() => '/tmp'),
  homedir: jest.fn(() => '/home/test'),
  hostname: jest.fn(() => 'test-host')
}));

// Override process.cwd to be stable during tests
const originalCwd = process.cwd;
process.cwd = jest.fn(() => mockTestWorkingDir);

// Console cleanup - suppress noisy output during tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Restore console for test output when needed
global.testConsole = originalConsole;

// Error boundary for uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  originalConsole.error('Uncaught exception in test:', error);
});

process.on('unhandledRejection', (reason) => {
  originalConsole.error('Unhandled rejection in test:', reason);
});

// Global cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Add global test utilities
global.testUtils = {
  createMockLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn()
  }),
  
  createMockConfig: () => ({
    agents: { defaultConcurrency: 1 },
    swarm: { topology: 'centralized' },
    memory: { backend: 'sqlite', path: ':memory:' },
    logging: { level: 'error' }
  }),
  
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};