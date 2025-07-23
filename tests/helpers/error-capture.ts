/**
 * Error handling utilities for tests
 */

/**
 * Wrap a function to safely execute it and catch any errors
 */
export function safeFn(fn: any) {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`Error in function: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
}

/**
 * Try executing a function and catch any errors
 */
export async function tryCatch(fn: () => Promise<any>, fallback: any = null) {
  try {
    return await fn();
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

/**
 * Execute a function with retry logic
 */
export async function withRetry(fn: any, options: any = {}) {
  const { maxRetries = 3, delay = 500, onRetry = null } = options;
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (onRetry) {
        onRetry(error, attempt);
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
