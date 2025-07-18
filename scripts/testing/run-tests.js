#!/usr/bin/env node

/**
 * Comprehensive test runner for FlowX
 * 
 * This script runs all test suites with proper configuration and reporting.
 * Usage:
 *   node scripts/run-tests.js [options]
 * 
 * Options:
 *   --unit       Run only unit tests
 *   --e2e        Run only end-to-end tests
 *   --integration Run only integration tests
 *   --property   Run only property-based tests
 *   --coverage   Generate code coverage report
 *   --watch      Run in watch mode
 *   --verbose    Show verbose output
 *   --ci         Run in CI mode
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Handle ES Module paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  unit: args.includes('--unit'),
  e2e: args.includes('--e2e'),
  integration: args.includes('--integration'),
  property: args.includes('--property'),
  coverage: args.includes('--coverage'),
  watch: args.includes('--watch'),
  verbose: args.includes('--verbose'),
  ci: args.includes('--ci')
};

// If no specific test type is specified, run all tests
if (!options.unit && !options.e2e && !options.integration && !options.property) {
  options.unit = true;
  options.e2e = true;
  options.integration = true;
  options.property = true;
}

// Set environment variables for test
process.env.FLOWX_ENV = 'test';
process.env.NODE_ENV = 'test';

// Base Jest command
let jestCmd = 'jest';
if (fs.existsSync(path.join(process.cwd(), 'node_modules/.bin/jest'))) {
  jestCmd = path.join(process.cwd(), 'node_modules/.bin/jest');
}

// Build Jest arguments
const jestArgs = [];

// Add config file
jestArgs.push('--config', 'jest.config.cjs');

// Add test patterns based on selected test types
const testPatterns = [];
if (options.unit) {
  testPatterns.push('tests/unit');
}
if (options.e2e) {
  testPatterns.push('tests/e2e');
}
if (options.integration) {
  testPatterns.push('tests/integration');
}
if (options.property) {
  testPatterns.push('tests/property');
}

// Add test patterns to arguments
if (testPatterns.length > 0) {
  jestArgs.push(...testPatterns);
}

jestArgs.push('--runInBand');

// Add watch mode if specified
if (options.watch) {
  jestArgs.push('--watch');
}

// Add coverage if specified
if (options.coverage) {
  jestArgs.push('--coverage');
  jestArgs.push('--coverage-directory=./test-results/coverage');
}

// Add CI mode if specified
if (options.ci) {
  jestArgs.push('--ci');
  jestArgs.push('--reporters=default');
  jestArgs.push('--reporters=jest-junit');
}

// Add verbose output if specified
if (options.verbose) {
  jestArgs.push('--verbose');
}

// Log command being executed
if (options.verbose) {
  console.log(`Executing: ${jestCmd} ${jestArgs.join(' ')}`);
}

// Add coverage configuration
if (options.coverage) {
  jestArgs.push('--coverageReporters=text');
  jestArgs.push('--coverageReporters=lcov');
  jestArgs.push('--coverageReporters=html');
  jestArgs.push('--coverageThreshold={"global":{"branches":90,"functions":95,"lines":90,"statements":90}}');
}

// Print header with test types
console.log('\n----------------------------------------------');
console.log(' FLOWX TEST RUNNER');
console.log('----------------------------------------------');
console.log(' Running:');
if (options.unit) console.log(' - Unit Tests');
if (options.e2e) console.log(' - End-to-End Tests');
if (options.integration) console.log(' - Integration Tests');
if (options.property) console.log(' - Property-Based Tests');
console.log('----------------------------------------------\n');

// Run Jest with the arguments
const jestProcess = spawn(jestCmd, jestArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

// Handle process completion
jestProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`\nTests failed with exit code ${code}`);
    process.exit(code);
  } else {
    console.log('\n----------------------------------------------');
    console.log(' All tests completed successfully!');
    console.log('----------------------------------------------\n');
  }
});

// Handle process errors
jestProcess.on('error', (err) => {
  console.error(`Failed to start Jest: ${err.message}`);
  process.exit(1);
});