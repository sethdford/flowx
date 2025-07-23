
// Mock implementation for Deno.Command
function mockDenoCommand(command, options = {}) {
  const { args = [], cwd = process.cwd(), stdout = "piped", stderr = "piped" } = options;
  
  return {
    output: async () => {
      return new Promise((resolve) => {
        // Handle both ESM and CommonJS environments
      const childProcess = typeof require !== 'undefined' ? 
        require('child_process') : 
        await import('node:child_process').then(m => m.default);
        const result = childProcess.spawnSync(command, args, { 
          cwd: cwd, 
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        resolve({
          success: result.status === 0,
          stdout: Buffer.from(result.stdout || ''),
          stderr: Buffer.from(result.stderr || '')
        });
      });
    }
  };
}

import { expect } from "@jest/globals";
const { assertEquals, assertExists, assertStringIncludes } = { assertEquals: expect.toBe, assertExists: expect.toBeDefined, assertStringIncludes: expect.toContain };
import fs from "fs";
const { exists } = fs.promises;
import path from "path";
const { join } = path;
import { beforeEach, afterEach, describe, it, jest } from "@jest/globals";

// Mock fs/promises for consistent behavior
// Using centralized mock system for better test isolation
jest.mock('../../../../tests/helpers/deno-fs-utils.ts');

// Mock child_process
// Using centralized mock system for better test isolation

// Mock fs for direct usage
// Using centralized mock system for better test isolation

// Duplicate mock removed to avoid conflicts

// Mock exists function
jest.mock('./tests/helpers/deno-fs-utils.ts', () => ({
  safeChdir: jest.fn().mockResolvedValue(true as boolean),
  safeCwd: jest.fn().mockReturnValue('/mock/cwd' as string),
  createTempTestDir: jest.fn().mockResolvedValue('/mock/temp-dir' as string),
  safeRemoveDir: jest.fn().mockResolvedValue(true as boolean),
  setupTestDirEnvironment: jest.fn().mockResolvedValue({
    originalCwd: '/mock/original-cwd',
    testDir: '/mock/test-dir'
  } as {originalCwd: string; testDir: string}),
  cleanupTestDirEnvironment: jest.fn().mockResolvedValue(undefined as void),
  exists: jest.fn().mockResolvedValue(true as boolean)
}));

// Mock Deno.stat for compatibility
(global as any).Deno = {
  stat: jest.fn().mockResolvedValue({ isFile: true } as {isFile: boolean})
};
import { safeChdir, safeCwd, createTempTestDir, safeRemoveDir, setupTestDirEnvironment, cleanupTestDirEnvironment } from "../../../helpers/deno-fs-utils.ts";
import { safeFn, tryCatch, withRetry } from "../../../helpers/error-capture.ts";
import { getTestEnvironmentInfo, shouldSkipTest } from "../../../helpers/test-environment.ts";

describe("Full Init Flow Integration Tests", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Use our helper function for setup but with proper fallbacks
    // Create a mock test directory that won't actually be used
    const tmpTestDir = path.join(process.cwd(), 'test-dir-' + Date.now());
    originalCwd = process.cwd(); // Use current directory as fallback
    testDir = tmpTestDir;
    
    // Create the test directory
    await fs.promises.mkdir(tmpTestDir, { recursive: true });
  });

  afterEach(async () => {
    // Use our helper function for cleanup
    await cleanupTestDirEnvironment(originalCwd, testDir);
  });

  describe("Complete initialization scenarios", () => {
    it("should initialize empty project successfully", async () => {
      // Run init command through CLI
      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const result = await command.output();
      const output = String.fromCharCode.apply(null, Array.from)(result.stdout);
      const error = String.fromCharCode.apply(null, Array.from)(result.stderr);

      if (!result.success) {
        console.error("Command failed:", error);
      }

      // Check that key files were created
      assertExists(await exists(join(testDir, "CLAUDE.md")));
      assertExists(await exists(join(testDir, "memory-bank.md")));
      assertExists(await exists(join(testDir, "coordination.md")));
      assertExists(await exists(join(testDir, "memory/flowx-data.json")));

      // Check directory structure
      assertExists(await exists(join(testDir, "memory")));
      assertExists(await exists(join(testDir, "memory/agents")));
      assertExists(await exists(join(testDir, "memory/sessions")));
      assertExists(await exists(join(testDir, "coordination")));
      assertExists(await exists(join(testDir, ".claude")));
      assertExists(await exists(join(testDir, ".claude/commands")));
    });

    it("should handle project with existing files", async () => {
      // Create existing files
      await fs.promises.writeFile(join(testDir, "CLAUDE.md"), "existing content");
      await fs.promises.writeFile(join(testDir, "package.json"), '{"name": "test"}');

      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const result = await command.output();
      const output = String.fromCharCode.apply(null, Array.from)(result.stdout);

      // Should warn about existing files
      assertStringIncludes(output, "already exist");
      assertStringIncludes(output, "Use --force to overwrite");

      // Should not overwrite without force
      const existingContent = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      assertEquals(existingContent, "existing content");
    });

    it("should handle force overwrite correctly", async () => {
      // Create existing files
      await fs.promises.writeFile(join(testDir, "CLAUDE.md"), "old content");
      await fs.promises.writeFile(join(testDir, "memory-bank.md"), "old memory");

      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init",
          "--force"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const result = await command.output();
      assertEquals(result.success, true);

      // Should overwrite files
      const claudeContent = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      assertEquals(claudeContent.includes("old content"), false);
      assertStringIncludes(claudeContent, "Claude Code Configuration");

      const memoryContent = await fs.promises.readFile(join(testDir, "memory-bank.md"));
      assertEquals(memoryContent.includes("old memory"), false);
      assertStringIncludes(memoryContent, "Memory Bank");
    });
  });

  describe("SPARC initialization flow", () => {
    it("should initialize with SPARC structure", async () => {
      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init",
          "--sparc"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const result = await command.output();
      const output = String.fromCharCode.apply(null, Array.from)(result.stdout);

      // Should create SPARC structure
      assertExists(await exists(join(testDir, ".roo")));
      assertExists(await exists(join(testDir, ".roomodes")));
      assertExists(await exists(join(testDir, ".claude/commands/sparc")));

      // Should have SPARC-enhanced CLAUDE.md
      const claudeContent = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      assertStringIncludes(claudeContent, "SPARC Development Environment");
      assertStringIncludes(claudeContent, "Test-Driven Development");
    });

    it("should handle SPARC with force flag", async () => {
      // Create existing SPARC files
      await fs.promises.mkdir(join(testDir, ".roo"), { recursive: true });
      await fs.promises.writeFile(join(testDir, ".roomodes"), '{"old": "config"}');

      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all", 
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init",
          "--sparc",
          "--force"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const result = await command.output();
      assertEquals(result.success, true);

      // Should preserve existing .roomodes (as per manual creation logic)
      const roomodesContent = await fs.promises.readFile(join(testDir, ".roomodes"));
      assertStringIncludes(roomodesContent, "old");
    });
  });

  describe("Minimal initialization flow", () => {
    it("should create minimal structure", async () => {
      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init",
          "--minimal"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const result = await command.output();
      assertEquals(result.success, true);

      // Should create basic files
      assertExists(await exists(join(testDir, "CLAUDE.md")));
      assertExists(await exists(join(testDir, "memory-bank.md")));
      assertExists(await exists(join(testDir, "coordination.md")));

      // Content should be minimal
      const claudeContent = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      const memoryContent = await fs.promises.readFile(join(testDir, "memory-bank.md"));

      assertStringIncludes(claudeContent, "Minimal project configuration");
      assertStringIncludes(memoryContent, "Simple memory tracking");
    });
  });

  describe("Complex flag combinations", () => {
    it("should handle --sparc --minimal --force", async () => {
      // Create conflicting files
      await fs.promises.writeFile(join(testDir, "CLAUDE.md"), "conflicting");
      await fs.promises.mkdir(join(testDir, ".roo"), { recursive: true });

      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init",
          "--sparc",
          "--minimal", 
          "--force"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const result = await command.output();
      assertEquals(result.success, true);

      // Should create SPARC structure
      assertExists(await exists(join(testDir, ".roo")));
      assertExists(await exists(join(testDir, ".roomodes")));

      // Should overwrite CLAUDE.md with SPARC content
      const claudeContent = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      assertEquals(claudeContent.includes("conflicting"), false);
      assertStringIncludes(claudeContent, "SPARC Development Environment");

      // Memory should be minimal
      const memoryContent = await fs.promises.readFile(join(testDir, "memory-bank.md"));
      assertStringIncludes(memoryContent, "Simple memory tracking");
    });
  });

  describe("File integrity validation", () => {
    it("should create valid JSON files", async () => {
      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      await command.output();

      // Check JSON files are valid
      const dataPath = join(testDir, "memory/flowx-data.json");
      const dataContent = await fs.promises.readFile(dataPath);
      const data = JSON.parse(dataContent);

      assertEquals(Array.isArray(data.agents), true);
      assertEquals(Array.isArray(data.tasks), true);
      assertEquals(typeof data.lastUpdated, "number");
    });

    it("should create valid SPARC JSON files", async () => {
      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init",
          "--sparc"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      await command.output();

      // Check SPARC JSON files
      if (await exists(join(testDir, ".roomodes"))) {
        const roomodesContent = await fs.promises.readFile(join(testDir, ".roomodes"));
        JSON.parse(roomodesContent); // Should not throw
      }

      if (await exists(join(testDir, ".roo/workflows/basic-tdd.json"))) {
        const workflowContent = await fs.promises.readFile(join(testDir, ".roo/workflows/basic-tdd.json"));
        JSON.parse(workflowContent); // Should not throw
      }
    });

    it("should create readable markdown files", async () => {
      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      await command.output();

      // Check markdown files have proper headers
      const mdFiles = [
        "CLAUDE.md",
        "memory-bank.md", 
        "coordination.md",
        "memory/agents/README.md",
        "memory/sessions/README.md"
      ];

      for (const file of mdFiles) {
        const content = await fs.promises.readFile(join(testDir, file));
        assertEquals(content.startsWith("#"), true);
        assertEquals(content.includes("\r"), false); // No Windows line endings
      }
    });
  });

  describe("Executable creation", () => {
    it("should create local executable wrapper", async () => {
      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      await command.output();

      // Check executable was created
      assertExists(await exists(join(testDir, "flowx")));

      // Check it's executable (on Unix-like systems)
      try {
        const fileInfo = await Deno.stat(join(testDir, "flowx"));
        assertEquals(fileInfo.isFile, true);
      } catch {
        // May not work on all systems
      }
    });

    it("should create working executable", async () => {
      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      await command.output();

      // Try to run the created executable
      const execCommand = mockDenoCommand(join(testDir, "flowx"), {
        args: ["--help"],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const execResult = await execCommand.output();
      const execOutput = String.fromCharCode.apply(null, Array.from)(execResult.stdout);

      // Should show help output
      assertStringIncludes(execOutput, "flowx");
    });
  });

  describe("Working directory handling", () => {
    it("should respect PWD environment variable", async () => {
      const subDir = join(testDir, "subproject");
      await fs.promises.mkdir(subDir, { recursive: true });

      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init"
        ],
        cwd: subDir,
        env: { PWD: subDir },
        stdout: "piped",
        stderr: "piped"
      });

      await command.output();

      // Files should be created in subDir
      assertExists(await exists(join(subDir, "CLAUDE.md")));
      assertExists(await exists(join(subDir, "memory-bank.md")));
      assertExists(await exists(join(subDir, "coordination.md")));
    });

    it("should handle directory changes correctly", async () => {
      // Create nested directory structure
      const nestedDir = join(testDir, "deep", "nested", "project");
      await fs.promises.mkdir(nestedDir, { recursive: true });

      const command = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init"
        ],
        cwd: nestedDir,
        stdout: "piped",
        stderr: "piped"
      });

      await command.output();

      // Files should be in nested directory
      assertExists(await exists(join(nestedDir, "CLAUDE.md")));
      assertExists(await exists(join(nestedDir, "memory")));
      assertExists(await exists(join(nestedDir, "coordination")));
    });
  });
});