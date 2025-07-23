/**
 * @type {import('@stryker-mutator/api/core').StrykerOptions}
 */
export default {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.js',
    enableFindRelatedTests: true
  },
  mutate: [
    'src/core/*.js',
    'src/core/*.ts',
    'src/memory/manager.js',
    'src/memory/manager.ts',
    'src/memory/distributed-memory.js',
    'src/memory/distributed-memory.ts',
    'src/memory/indexer.js',
    'src/memory/indexer.ts'
  ],
  mutator: {
    excludedMutations: [
      'StringLiteral',
      'ArrayDeclaration'
    ]
  },
  timeoutMS: 60000,
  timeoutFactor: 4,
  concurrency: 4,
  maxConcurrentTestRunners: 4,
  // These are mutation testing ignores
  ignorePatterns: [
    'node_modules',
    'dist',
    '**/tests/**',
    '**/*.test.js',
    '**/*.test.ts',
    '**/*.spec.js',
    '**/*.spec.ts'
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50
  },
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html'
  },
  dashboard: {
    project: 'github.com/sethdford/flowx',
    version: 'main',
    module: '@flowx/core'
  },
  dryRunTimeoutMinutes: 5
};