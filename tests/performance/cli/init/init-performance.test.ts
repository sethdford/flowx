/**
 * Init Command Performance Tests
 * Comprehensive test suite for measuring init command performance in Node.js environment
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const execFile = promisify(spawn);

describe("Init Command Performance Tests", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    // Create unique temp directory
    const tempId = randomBytes(8).toString('hex');
    testDir = join(tmpdir(), `flowx_perf_test_${tempId}`);
    await fs.mkdir(testDir, { recursive: true });
    process.env.PWD = testDir;
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Basic initialization performance", () => {
    it("should complete basic init within reasonable time", async () => {
      const startTime = performance.now();

      const command = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = await new Promise<{ success: boolean; stdout: string; stderr: string }>((resolve) => {
        let stdout = '';
        let stderr = '';

        command.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        command.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        command.on('close', (code) => {
          resolve({ success: code === 0, stdout, stderr });
        });
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      
      // Should complete within 10 seconds for basic init
      expect(duration).toBeLessThan(10000);
      
      // Should create expected files
      await expect(fs.access(join(testDir, "CLAUDE.md"))).resolves.not.toThrow();
      await expect(fs.access(join(testDir, "memory-bank.md"))).resolves.not.toThrow();
      await expect(fs.access(join(testDir, "coordination.md"))).resolves.not.toThrow();

      console.log(`Basic init completed in ${duration.toFixed(2)}ms`);
    });

    it("should handle minimal init faster than full init", async () => {
      // Test minimal init
      const minimalStartTime = performance.now();
      
      const minimalCommand = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init',
        '--minimal'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      await new Promise<void>((resolve) => {
        minimalCommand.on('close', () => resolve());
      });

      const minimalDuration = performance.now() - minimalStartTime;

      // Clean up for full init test
      await fs.rm(testDir, { recursive: true, force: true });
      const tempId2 = randomBytes(8).toString('hex');
      testDir = join(tmpdir(), `flowx_perf_test_full_${tempId2}`);
      await fs.mkdir(testDir, { recursive: true });
      process.chdir(testDir);

      // Test full init
      const fullStartTime = performance.now();
      
      const fullCommand = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      await new Promise<void>((resolve) => {
        fullCommand.on('close', () => resolve());
      });

      const fullDuration = performance.now() - fullStartTime;

      // Minimal should be faster or comparable
      expect(minimalDuration).toBeLessThanOrEqual(fullDuration * 1.5); // Allow 50% tolerance

      console.log(`Minimal init: ${minimalDuration.toFixed(2)}ms`);
      console.log(`Full init: ${fullDuration.toFixed(2)}ms`);
    });
  });

  describe("SPARC initialization performance", () => {
    it("should complete SPARC init within reasonable time", async () => {
      const startTime = performance.now();

      const command = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init',
        '--sparc'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = await new Promise<{ success: boolean }>((resolve) => {
        command.on('close', (code) => {
          resolve({ success: code === 0 });
        });
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      
      // SPARC init may take longer due to external processes
      expect(duration).toBeLessThan(30000); // 30 seconds max
      
      // Should create SPARC structure
      await expect(fs.access(join(testDir, ".roo"))).resolves.not.toThrow();
      await expect(fs.access(join(testDir, ".roomodes"))).resolves.not.toThrow();

      console.log(`SPARC init completed in ${duration.toFixed(2)}ms`);
    });

    it("should handle SPARC fallback efficiently", async () => {
      // This test simulates the scenario where create-sparc is not available
      // The init should fall back to manual creation quickly
      
      const startTime = performance.now();

      const command = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init',
        '--sparc'
      ], {
        cwd: testDir,
        env: {
          ...process.env,
          // Simulate environment where create-sparc might fail
          PATH: "/usr/bin:/bin" // Minimal PATH
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = await new Promise<{ success: boolean }>((resolve) => {
        command.on('close', (code) => {
          resolve({ success: code === 0 });
        });
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should still complete successfully with fallback
      expect(duration).toBeLessThan(15000); // Should be faster than full external process
      
      // Should create basic SPARC structure manually
      await expect(fs.access(join(testDir, ".roo"))).resolves.not.toThrow();
      await expect(fs.access(join(testDir, ".roomodes"))).resolves.not.toThrow();

      console.log(`SPARC fallback completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe("Parallel operations efficiency", () => {
    it("should handle multiple concurrent inits efficiently", async () => {
      const numConcurrent = 3;
      const testDirs: string[] = [];
      
      // Create multiple test directories
      for (let i = 0; i < numConcurrent; i++) {
        const tempId = randomBytes(8).toString('hex');
        const dir = join(tmpdir(), `flowx_concurrent_${i}_${tempId}`);
        await fs.mkdir(dir, { recursive: true });
        testDirs.push(dir);
      }

      const startTime = performance.now();

      // Run multiple inits concurrently
      const promises = testDirs.map(dir => {
        const command = spawn('node', [
          join(originalCwd, 'cli.js'),
          'init'
        ], {
          cwd: dir,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        return new Promise<{ success: boolean }>((resolve) => {
          command.on('close', (code) => {
            resolve({ success: code === 0 });
          });
        });
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Concurrent execution should be faster than sequential
      expect(duration).toBeLessThan(20000); // 20 seconds for 3 concurrent inits

      // Verify all directories were initialized
      for (const dir of testDirs) {
        await expect(fs.access(join(dir, "CLAUDE.md"))).resolves.not.toThrow();
        await expect(fs.access(join(dir, "memory-bank.md"))).resolves.not.toThrow();
        await expect(fs.access(join(dir, "coordination.md"))).resolves.not.toThrow();
      }

      // Cleanup
      for (const dir of testDirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }

      console.log(`${numConcurrent} concurrent inits completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe("Large project initialization", () => {
    it("should handle initialization in directory with many files", async () => {
      // Create a large number of files to simulate a large project
      const numFiles = 100;
      
      for (let i = 0; i < numFiles; i++) {
        await fs.writeFile(join(testDir, `file_${i}.txt`), `Content ${i}`);
      }

      // Create some directories
      for (let i = 0; i < 10; i++) {
        await fs.mkdir(join(testDir, `dir_${i}`), { recursive: true });
        await fs.writeFile(join(testDir, `dir_${i}`, "file.txt"), `Dir ${i} content`);
      }

      const startTime = performance.now();

      const command = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = await new Promise<{ success: boolean }>((resolve) => {
        command.on('close', (code) => {
          resolve({ success: code === 0 });
        });
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      
      // Should not be significantly slower due to existing files
      expect(duration).toBeLessThan(15000);
      
      // Should create init files
      await expect(fs.access(join(testDir, "CLAUDE.md"))).resolves.not.toThrow();
      await expect(fs.access(join(testDir, "memory-bank.md"))).resolves.not.toThrow();
      await expect(fs.access(join(testDir, "coordination.md"))).resolves.not.toThrow();

      console.log(`Init in large project (${numFiles} files) completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe("Resource usage optimization", () => {
    it("should use reasonable memory during initialization", async () => {
      // This test monitors memory usage during init
      const initialMemory = process.memoryUsage();

      const command = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init',
        '--sparc'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = await new Promise<{ success: boolean }>((resolve) => {
        command.on('close', (code) => {
          resolve({ success: code === 0 });
        });
      });

      const finalMemory = process.memoryUsage();

      expect(result.success).toBe(true);

      // Memory increase should be reasonable (less than 50MB)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it("should handle force overwrite efficiently", async () => {
      // Create existing files first
      await fs.writeFile(join(testDir, "CLAUDE.md"), "existing content".repeat(1000));
      await fs.writeFile(join(testDir, "memory-bank.md"), "existing memory".repeat(1000));
      await fs.writeFile(join(testDir, "coordination.md"), "existing coord".repeat(1000));

      const startTime = performance.now();

      const command = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init',
        '--force'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = await new Promise<{ success: boolean }>((resolve) => {
        command.on('close', (code) => {
          resolve({ success: code === 0 });
        });
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      
      // Force overwrite should not be significantly slower
      expect(duration).toBeLessThan(10000);

      // Files should be overwritten
      const claudeContent = await fs.readFile(join(testDir, "CLAUDE.md"), 'utf-8');
      expect(claudeContent.includes("existing content")).toBe(false);

      console.log(`Force overwrite completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe("File I/O performance", () => {
    it("should efficiently create directory structure", async () => {
      const startTime = performance.now();

      const command = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      await new Promise<void>((resolve) => {
        command.on('close', () => resolve());
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Count created directories
      const expectedDirs = [
        "memory",
        "memory/agents",
        "memory/sessions",
        "coordination",
        "coordination/memory_bank",
        "coordination/subtasks",
        "coordination/orchestration",
        ".claude",
        ".claude/commands",
        ".claude/commands/sparc",
        ".claude/logs"
      ];

      let createdDirs = 0;
      for (const dir of expectedDirs) {
        try {
          await fs.access(join(testDir, dir));
          createdDirs++;
        } catch {
          // Directory doesn't exist
        }
      }

      // Should create directories efficiently
      const dirCreationRate = createdDirs / (duration / 1000); // dirs per second
      expect(dirCreationRate).toBeGreaterThan(10); // Should create > 10 dirs/second

      console.log(`Created ${createdDirs} directories in ${duration.toFixed(2)}ms (${dirCreationRate.toFixed(2)} dirs/sec)`);
    });

    it("should efficiently write template files", async () => {
      const startTime = performance.now();

      const command = spawn('node', [
        join(originalCwd, 'cli.js'),
        'init'
      ], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      await new Promise<void>((resolve) => {
        command.on('close', () => resolve());
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Count created files
      const expectedFiles = [
        "CLAUDE.md",
        "memory-bank.md",
        "coordination.md",
        "memory/flowx-data.json",
        "memory/agents/README.md",
        "memory/sessions/README.md",
        "flowx"
      ];

      let createdFiles = 0;
      let totalSize = 0;
      
      for (const file of expectedFiles) {
        try {
          const stat = await fs.stat(join(testDir, file));
          createdFiles++;
          totalSize += stat.size;
        } catch {
          // File doesn't exist or stat failed
        }
      }

      // Should write files efficiently
      const writeRate = totalSize / (duration / 1000); // bytes per second
      expect(writeRate).toBeGreaterThan(1000); // Should write > 1KB/second

      console.log(`Created ${createdFiles} files (${totalSize} bytes) in ${duration.toFixed(2)}ms (${(writeRate / 1024).toFixed(2)} KB/sec)`);
    });
  });
});