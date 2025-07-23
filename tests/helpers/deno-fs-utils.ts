/**
 * Helper utilities for Deno tests to handle filesystem operations safely
 */

// Mock Deno for Node.js environment
declare global {
  var Deno: any;
}

const fs = require('fs').promises;

// Mock Deno implementation using Node.js fs
if (typeof globalThis.Deno === 'undefined') {
  globalThis.Deno = {
    async stat(filePath: string) {
      const stats = await fs.stat(filePath);
      return {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size
      };
    },
    readTextFile: (filePath: string) => fs.readFile(filePath, 'utf-8'),
    writeTextFile: (filePath: string, content: string) => fs.writeFile(filePath, content, 'utf-8'),
    async *readDir(dirPath: string) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        yield {
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory()
        };
      }
    },
    mkdir: (dirPath: string, options?: { recursive?: boolean }) => fs.mkdir(dirPath, options),
    remove: (filePath: string, options?: { recursive?: boolean }) => fs.rm(filePath, { recursive: options?.recursive, force: true })
  };
}

/**
 * Safely changes the current working directory with robust error handling
 * @param path The directory path to change to
 * @returns {boolean} True if successful, false otherwise
 */
export async function safeChdir(path: string): Promise<boolean> {
  try {
    Deno.chdir(path);
    return true;
  } catch (error) {
    console.error(`Failed to change directory to ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Safely gets the current working directory
 * @returns {string|null} The current working directory or null on error
 */
export function safeCwd(): string | null {
  try {
    return Deno.cwd();
  } catch (error) {
    console.error(`Failed to get current directory: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Creates a temporary test directory with error handling
 * @param prefix Prefix for the temporary directory
 * @returns {Promise<string|null>} Path to the created directory or null on error
 */
export async function createTempTestDir(prefix: string = "test_"): Promise<string | null> {
  try {
    return await Deno.makeTempDir({ prefix });
  } catch (error) {
    console.error(`Failed to create temp directory: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Safely removes a directory and its contents
 * @param path Directory path to remove
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function safeRemoveDir(path: string): Promise<boolean> {
  try {
    await Deno.remove(path, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Failed to remove directory ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Setup test directory environment for Deno tests
 * @returns {Promise<{originalCwd: string|null, testDir: string|null}>} Original directory and test directory
 */
export async function setupTestDirEnvironment(prefix: string = "test_"): Promise<{originalCwd: string|null, testDir: string|null}> {
  const originalCwd = safeCwd();
  const testDir = await createTempTestDir(prefix);
  
  if (testDir) {
    // Set environment variable for tests
    Deno.env.set("PWD", testDir);
    await safeChdir(testDir);
  }
  
  return { originalCwd, testDir };
}

/**
 * Cleanup test directory environment for Deno tests
 * @param originalCwd Original working directory to restore
 * @param testDir Test directory to remove
 */
export async function cleanupTestDirEnvironment(originalCwd: string|null, testDir: string|null): Promise<void> {
  try {
    // Restore original directory if possible
    if (originalCwd) {
      await safeChdir(originalCwd);
    }
  } finally {
    // Remove test directory if it exists
    if (testDir) {
      await safeRemoveDir(testDir);
    }
  }
}

// Compatibility layer for exists function used in tests
export const exists = async (filePath: string) => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
};
