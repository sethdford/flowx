/**
 * Start Command Integration Tests
 * Tests real functionality of the start command with comprehensive validation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

describe('Start Command Integration Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../cli.js');
  const PID_FILE = '.flowx.pid';
  
  beforeEach(async () => {
    // Clean up any existing PID files
    try {
      await fs.unlink(PID_FILE);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up PID files after tests
    try {
      await fs.unlink(PID_FILE);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  test('should show help when called with --help', async () => {
    const { stdout, stderr } = await execAsync(`node ${CLI_PATH} start --help`, { timeout: 10000 });
    
    expect(stdout).toContain('Start the Claude-Flow orchestration system');
    expect(stdout).toContain('--daemon');
    expect(stdout).toContain('--port');
    expect(stdout).toContain('--verbose');
  }, 15000);

  test('should show start command functionality', async () => {
    // Test that start command executes and shows expected output
    // Using timeout to prevent hanging
    try {
      const { stdout, stderr } = await execAsync(`timeout 3s node ${CLI_PATH} start --timeout 1 || true`);
      
      expect(stdout).toContain('Claude-Flow Orchestration System');
    } catch (error: any) {
      // Timeout is expected, just ensure we see the startup message
      expect(error.stdout || error.stderr || '').toContain('Claude-Flow Orchestration System');
    }
  });

  test('should validate command options', async () => {
    // Test invalid port
    try {
      await execAsync(`node ${CLI_PATH} start --port invalid`);
      throw new Error('Expected command to fail with invalid port');
    } catch (error: any) {
      expect(error.code).toBe(1);
    }
  });

  test('should validate command structure and options', async () => {
    // Test that the start command has proper structure
    const { stdout } = await execAsync(`node ${CLI_PATH} start --help`, { timeout: 10000 });
    
    expect(stdout).toContain('Start the Claude-Flow orchestration system');
    expect(stdout).toContain('--daemon');
    expect(stdout).toContain('--port');
    expect(stdout).toContain('--verbose');
  }, 15000);
}); 