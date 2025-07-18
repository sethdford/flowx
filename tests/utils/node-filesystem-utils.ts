/**
 * Node.js compatible file system test utilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * File system test utilities for Node.js
 */
export class FileSystemTestUtils {
  /**
   * Create temporary directory for testing
   */
  static async createTempDir(prefix = 'flowx-test-'): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join('src/tests/.tmp', prefix));
    return tempDir;
  }

  /**
   * Create temporary file with content
   */
  static async createTempFile(
    content: string,
    options: { suffix?: string; dir?: string } = {}
  ): Promise<string> {
    const { suffix = '.tmp', dir } = options;
    const tempDir = dir || await this.createTempDir();
    const tempFile = path.join(tempDir, `temp-${Date.now()}${suffix}`);
    await fs.writeFile(tempFile, content);
    return tempFile;
  }

  /**
   * Create test fixture files
   */
  static async createFixtures(
    fixtures: Record<string, string>,
    baseDir?: string
  ): Promise<string> {
    const fixtureDir = baseDir || await this.createTempDir('fixtures-');
    
    for (const [fileName, content] of Object.entries(fixtures)) {
      const filePath = path.join(fixtureDir, fileName);
      const dirPath = path.dirname(filePath);
      
      try {
        await fs.mkdir(dirPath, { recursive: true });
      } catch {
        // Directory already exists
      }
      
      await fs.writeFile(filePath, content);
    }

    return fixtureDir;
  }

  /**
   * Clean up temporary files and directories
   */
  static async cleanup(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async filePath => {
        try {
          await fs.rm(filePath, { recursive: true, force: true });
        } catch {
          // Ignore if already removed
        }
      })
    );
  }
}

export default FileSystemTestUtils;