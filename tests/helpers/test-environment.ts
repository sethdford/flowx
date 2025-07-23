/**
 * Test environment detection and configuration
 */

/**
 * Get information about the current test environment
 */
export function getTestEnvironmentInfo() {
  return {
    isCI: !!process.env.CI,
    isPR: !!process.env.GITHUB_PR_NUMBER,
    platform: process.platform,
    isWindows: process.platform === 'win32',
    isMacOS: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
  };
}

/**
 * Determine if a test should be skipped based on environment
 */
export function shouldSkipTest(testInfo: {
  skipCI?: boolean;
  skipWindows?: boolean;
  skipMacOS?: boolean;
  skipLinux?: boolean;
  skipPR?: boolean;
} = {}) {
  const env = getTestEnvironmentInfo();
  
  if (testInfo.skipCI && env.isCI) return true;
  if (testInfo.skipWindows && env.isWindows) return true;
  if (testInfo.skipMacOS && env.isMacOS) return true;
  if (testInfo.skipLinux && env.isLinux) return true;
  if (testInfo.skipPR && env.isPR) return true;
  
  return false;
}
