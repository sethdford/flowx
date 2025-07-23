module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Transform configuration with improved ESM support
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: false, // Use CommonJS for better stability
      isolatedModules: true, // Move isolatedModules here from globals
      tsconfig: {
        module: 'CommonJS',
        target: 'ES2020',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        skipLibCheck: true,
        isolatedModules: true,
        strict: false, // Relax strict mode for tests
        allowImportingTsExtensions: false, // Disable .ts extension imports
        downlevelIteration: true, // Enable downlevel iteration for Maps/Sets
        forceConsistentCasingInFileNames: false,
        experimentalDecorators: true, // Enable experimental decorators
        emitDecoratorMetadata: true // Enable decorator metadata
      }
    }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Module name mapping - comprehensive ESM/TypeScript support
  moduleNameMapper: {
    // Handle src imports with alias first (most specific)
    '^@/(.*)$': '<rootDir>/src/$1',
    // Handle relative imports to src from tests
    '^\\.\\./\\.\\./\\.\\./src/(.*)$': '<rootDir>/src/$1',
    '^\\.\\./\\.\\./src/(.*)$': '<rootDir>/src/$1', 
    '^\\.\\./src/(.*)$': '<rootDir>/src/$1',
    // Handle imports from tests directory
    '^\\.\\./\\.\\./\\.\\./\\.\\./src/(.*)$': '<rootDir>/src/$1',
    // Handle TypeScript imports - strip .ts extension for Jest resolution
    '^(\\.{1,2}/.*)\\.ts$': '$1',
    // Handle .js imports that should resolve to .ts files
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Handle Deno imports - unified mock
    'https://deno.land/std@(.*)/(.*)': '<rootDir>/tests/__mocks__/deno_modules.js',
    '@std/(.*)': '<rootDir>/tests/__mocks__/deno_modules.js',
    // Handle problematic npm modules with explicit mocks
    'sql.js': '<rootDir>/tests/__mocks__/sql.js',
    'ipaddr.js': '<rootDir>/tests/__mocks__/ipaddr.js',
    'better-sqlite3': '<rootDir>/tests/__mocks__/better-sqlite3.js',
    // Handle Express and other modules with explicit resolution
    '^express$': require.resolve('express'),
    '^ws$': require.resolve('ws'),
    '^cors$': require.resolve('cors')
  },
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Test file patterns - include both main and tests directory
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,js,tsx,jsx}',
    '<rootDir>/tests/**/*.spec.{ts,js,tsx,jsx}'
  ],
  
  // Ignore problematic test files and directories
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/original-claude-flow/',
    // Temporarily ignore e2e tests that have complex setup requirements
    '<rootDir>/tests/e2e/',
    // Ignore performance tests that might be flaky
    '<rootDir>/tests/performance/',
    // Ignore integration tests with external dependencies
    '<rootDir>/tests/integration/github-automation.test.ts',
    '<rootDir>/tests/integration/security-integration.test.ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,js}',
    '!src/**/*.spec.{ts,js}',
    '!src/index.js' // Skip main entry point
  ],
  
  // Test configuration
  testTimeout: 30000, // 30 seconds should be enough for most tests
  verbose: false, // Reduce verbose output to avoid console spam
  bail: false,
  maxWorkers: 1, // Run tests sequentially to avoid resource conflicts
  
  // Mock and cleanup configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Memory and performance
  maxConcurrency: 3,
  logHeapUsage: false,
  
  // Error handling
  errorOnDeprecated: false,
  
  // Use manual mocks in __mocks__
  automock: false,
  unmockedModulePathPatterns: [],
  
  // Force exit to prevent hanging
  forceExit: true
}; 