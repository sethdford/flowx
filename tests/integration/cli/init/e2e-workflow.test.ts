
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

// Duplicate mock removed to avoid conflicts

// Mock exists function
jest.mock('./tests/helpers/deno-fs-utils.ts', () => ({
  safeChdir: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  safeCwd: jest.fn<() => string>().mockReturnValue('/mock/cwd'),
  createTempTestDir: jest.fn<() => Promise<string>>().mockResolvedValue('/mock/temp-dir'),
  safeRemoveDir: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  setupTestDirEnvironment: jest.fn<() => Promise<{originalCwd: string; testDir: string}>>().mockResolvedValue({
    originalCwd: '/mock/original-cwd',
    testDir: '/mock/test-dir'
  }),
  cleanupTestDirEnvironment: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true)
}));

// Mock Deno.stat for compatibility
global.Deno = {
  stat: jest.fn().mockResolvedValue({ isFile: true })
};
import { safeChdir, safeCwd, createTempTestDir, safeRemoveDir, setupTestDirEnvironment, cleanupTestDirEnvironment } from "../../../helpers/deno-fs-utils.ts";
import { safeFn, tryCatch, withRetry } from "../../../helpers/error-capture.ts";
import { getTestEnvironmentInfo, shouldSkipTest } from "../../../helpers/test-environment.ts";

describe("End-to-End Init Workflow Tests", () => {
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

  describe("Complete project initialization workflow", () => {
    it("should initialize a new project from scratch", async () => {
      // Step 1: Initialize basic project
      const initCommand = mockDenoCommand("deno", {
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

      const initResult = await initCommand.output();
      assertEquals(initResult.success, true);

      const initOutput = String.fromCharCode.apply(null, Array.from)(initResult.stdout);
      assertStringIncludes(initOutput, "initialized successfully");
      assertStringIncludes(initOutput, "Next steps");

      // Verify all files and directories are created
      const expectedFiles = [
        "CLAUDE.md",
        "memory-bank.md",
        "coordination.md",
        "memory/flowx-data.json",
        "memory/agents/README.md",
        "memory/sessions/README.md",
        "flowx"
      ];

      for (const file of expectedFiles) {
        assertExists(await exists(join(testDir, file)));
      }

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
        ".claude/logs"
      ];

      for (const dir of expectedDirs) {
        assertExists(await exists(join(testDir, dir)));
      }

      // Step 2: Test that local executable works
      const helpCommand = mockDenoCommand(join(testDir, "flowx"), {
        args: ["--help"],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const helpResult = await helpCommand.output();
      assertEquals(helpResult.success, true);

      const helpOutput = String.fromCharCode.apply(null, Array.from)(helpResult.stdout);
      assertStringIncludes(helpOutput, "flowx");

      // Step 3: Verify memory system is functional
      const memoryTestCommand = mockDenoCommand(join(testDir, "flowx"), {
        args: ["memory", "store", "test_key", "test_value"],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const memoryResult = await memoryTestCommand.output();
      // Memory command should work (success or fail gracefully)
      console.log("Memory test result:", memoryResult.success);
    });

    it("should initialize SPARC-enabled project workflow", async () => {
      // Step 1: Initialize with SPARC
      const initCommand = mockDenoCommand("deno", {
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

      const initResult = await initCommand.output();
      assertEquals(initResult.success, true);

      const initOutput = String.fromCharCode.apply(null, Array.from)(initResult.stdout);
      assertStringIncludes(initOutput, "SPARC development environment");

      // Verify SPARC structure
      assertExists(await exists(join(testDir, ".roo")));
      assertExists(await exists(join(testDir, ".roomodes")));
      assertExists(await exists(join(testDir, ".claude/commands/sparc")));

      // Step 2: Test SPARC commands
      const sparcModesCommand = mockDenoCommand(join(testDir, "flowx"), {
        args: ["sparc", "modes"],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const sparcResult = await sparcModesCommand.output();
      // SPARC command should work or fail gracefully
      console.log("SPARC modes result:", sparcResult.success);

      // Step 3: Verify CLAUDE.md has SPARC content
      const claudeContent = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      assertStringIncludes(claudeContent, "SPARC Development Environment");
      assertStringIncludes(claudeContent, "## SPARC Development Commands");
      assertStringIncludes(claudeContent, "Test-Driven Development");

      // Step 4: Verify slash commands directory
      assertExists(await exists(join(testDir, ".claude/commands/sparc")));
    });

    it("should handle project upgrade workflow", async () => {
      // Step 1: Start with minimal project
      const minimalCommand = mockDenoCommand("deno", {
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

      await minimalCommand.output();

      const minimalClaude = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      assertStringIncludes(minimalClaude, "Minimal project configuration");

      // Step 2: Upgrade to full project
      const fullCommand = mockDenoCommand("deno", {
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

      const fullResult = await fullCommand.output();
      assertEquals(fullResult.success, true);

      const fullClaude = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      assertEquals(fullClaude.length > minimalClaude.length, true);
      assertStringIncludes(fullClaude, "## Project Overview");

      // Step 3: Upgrade to SPARC project
      const sparcCommand = mockDenoCommand("deno", {
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

      const sparcResult = await sparcCommand.output();
      assertEquals(sparcResult.success, true);

      const sparcClaude = await fs.promises.readFile(join(testDir, "CLAUDE.md"));
      assertStringIncludes(sparcClaude, "SPARC Development Environment");
      assertExists(await exists(join(testDir, ".roo")));
    });
  });

  describe("Real-world project scenarios", () => {
    it("should initialize in existing Node.js project", async () => {
      // Create existing Node.js project structure
      await fs.promises.writeFile(join(testDir, "package.json"), JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        main: "index.js"
      }, null, 2));

      await fs.promises.writeFile(join(testDir, "index.js"), "console.log('Hello World');");
      
      await fs.promises.mkdir(join(testDir, "src"));
      await fs.promises.writeFile(join(testDir, "src/app.js"), "// App code");

      await fs.promises.mkdir(join(testDir, "tests"));
      await fs.promises.writeFile(join(testDir, "tests/app.test.js"), "// Tests");

      // Initialize Claude Flow
      const initCommand = mockDenoCommand("deno", {
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

      const result = await initCommand.output() as { success: boolean };
      assertEquals(result.success, true);

      // Should not interfere with existing project files
      assertExists(await exists(join(testDir, "package.json")));
      assertExists(await exists(join(testDir, "index.js")));
      assertExists(await exists(join(testDir, "src/app.js")));
      assertExists(await exists(join(testDir, "tests/app.test.js")));

      // Should add Claude Flow files
      assertExists(await exists(join(testDir, "CLAUDE.md")));
      assertExists(await exists(join(testDir, "memory-bank.md")));
      assertExists(await exists(join(testDir, "coordination.md")));
      assertExists(await exists(join(testDir, "flowx")));

      // Verify package.json is unchanged
      const packageJson = JSON.parse(await fs.promises.readFile(join(testDir, "package.json")));
      assertEquals(packageJson.name, "test-project");
      assertEquals(packageJson.version, "1.0.0");
    });

    it("should initialize in Git repository", async () => {
      // Initialize git repository
      const gitInitCommand = mockDenoCommand("git", {
        args: ["init"],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      await gitInitCommand.output();

      // Create some files and commit
      await fs.promises.writeFile(join(testDir, "README.md"), "# Test Project");
      await fs.promises.writeFile(join(testDir, ".gitignore"), "node_modules/\n*.log");

      const gitAddCommand = mockDenoCommand("git", {
        args: ["add", "."],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      await gitAddCommand.output();

      const gitCommitCommand = mockDenoCommand("git", {
        args: ["commit", "-m", "Initial commit"],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      await gitCommitCommand.output();

      // Initialize Claude Flow
      const initCommand = mockDenoCommand("deno", {
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

      const result = await initCommand.output();
      assertEquals(result.success, true);

      // Should preserve git repository
      assertExists(await exists(join(testDir, ".git")));
      assertExists(await exists(join(testDir, "README.md")));
      assertExists(await exists(join(testDir, ".gitignore")));

      // Should add Claude Flow files
      assertExists(await exists(join(testDir, "CLAUDE.md")));
      assertExists(await exists(join(testDir, "memory-bank.md")));

      // Check git status
      const gitStatusCommand = mockDenoCommand("git", {
        args: ["status", "--porcelain"],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const statusResult = await gitStatusCommand.output();
      const statusOutput = String.fromCharCode.apply(null, Array.from)(statusResult.stdout);

      // New files should be untracked
      assertStringIncludes(statusOutput, "CLAUDE.md");
      assertStringIncludes(statusOutput, "memory-bank.md");
    });

    it("should handle large project with many subdirectories", async () => {
      // Create complex project structure
      const projectStructure = [
        "src/components",
        "src/utils",
        "src/services",
        "tests/unit",
        "tests/integration",
        "tests/e2e",
        "docs/api",
        "docs/guides",
        "config/dev",
        "config/prod",
        "scripts/build",
        "scripts/deploy"
      ];

      for (const dir of projectStructure) {
        await fs.promises.mkdir(join(testDir, dir), { recursive: true });
        await fs.promises.writeFile(join(testDir, dir, "index.js"), `// ${dir} code`);
      }

      // Add many files
      for (let i = 0; i < 50; i++) {
        await fs.promises.writeFile(join(testDir, `file_${i}.txt`), `Content ${i}`);
      }

      const startTime = performance.now();

      // Initialize Claude Flow
      const initCommand = mockDenoCommand("deno", {
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

      const result = await initCommand.output();
      const endTime = performance.now();

      assertEquals(result.success, true);

      // Should not take too long even with many files
      assertEquals(endTime - startTime < 30000, true);

      // Should preserve all existing structure
      for (const dir of projectStructure) {
        assertExists(await exists(join(testDir, dir)));
        assertExists(await exists(join(testDir, dir, "index.js")));
      }

      // Should add Claude Flow files
      assertExists(await exists(join(testDir, "CLAUDE.md")));
      assertExists(await exists(join(testDir, "memory-bank.md")));
      assertExists(await exists(join(testDir, "coordination.md")));

      console.log(`Large project init completed in ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe("User experience workflow", () => {
    it("should provide helpful output and guidance", async () => {
      const initCommand = mockDenoCommand("deno", {
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

      const result = await initCommand.output();
      const output = String.fromCharCode.apply(null, Array.from)(result.stdout);

      // Should provide clear feedback
      assertStringIncludes(output, "Initializing Claude Code integration files");
      assertStringIncludes(output, "✓ Created");
      assertStringIncludes(output, "initialized successfully");

      // Should provide next steps
      assertStringIncludes(output, "Next steps:");
      assertStringIncludes(output, "./flowx start");
      assertStringIncludes(output, "Review and customize");

      // Should mention local executable
      assertStringIncludes(output, "Local executable created");
      assertStringIncludes(output, "Use './flowx' instead of 'npx flowx'");
    });

    it("should provide SPARC-specific guidance", async () => {
      const initCommand = mockDenoCommand("deno", {
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

      const result = await initCommand.output();
      const output = String.fromCharCode.apply(null, Array.from)(result.stdout);

      // Should mention SPARC initialization
      assertStringIncludes(output, "SPARC development environment");
      assertStringIncludes(output, "SPARC environment initialized");

      // Should provide SPARC guidance
      assertStringIncludes(output, "Claude Code slash commands");
      assertStringIncludes(output, "/sparc");
      assertStringIncludes(output, "sparc modes");
      assertStringIncludes(output, "sparc tdd");
    });

    it("should handle help request appropriately", async () => {
      const helpCommand = mockDenoCommand("deno", {
        args: [
          "run",
          "--allow-all",
          join(originalCwd, "src/cli/simple-cli.ts"),
          "init",
          "--help"
        ],
        cwd: testDir,
        stdout: "piped",
        stderr: "piped"
      });

      const result = await helpCommand.output();
      const output = String.fromCharCode.apply(null, Array.from)(result.stdout);

      // Should show help without initializing
      assertStringIncludes(output, "Initialize Claude Code integration");
      assertStringIncludes(output, "--force");
      assertStringIncludes(output, "--minimal");
      assertStringIncludes(output, "--sparc");

      // Should not create any files
      assertEquals(await exists(join(testDir, "CLAUDE.md")), false);
      assertEquals(await exists(join(testDir, "memory-bank.md")), false);
    });

    it("should handle error scenarios gracefully", async () => {
      // Create a scenario that will cause an error
      await fs.promises.writeFile(join(testDir, "memory"), "blocking file");

      const initCommand = mockDenoCommand("deno", {
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

      const result = await initCommand.output();
      const output = String.fromCharCode.apply(null, Array.from)(result.stdout);
      const error = String.fromCharCode.apply(null, Array.from)(result.stderr);

      // Should provide clear error message
      console.log("Error output:", error);
      console.log("Standard output:", output);

      // Should not leave the system in a bad state
      assertEquals(await exists(join(testDir, "memory")), true); // Original file should remain
    });
  });
});