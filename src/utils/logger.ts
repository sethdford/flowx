/**
 * Simple logger utility for claude-code-flow
 */

import { ILogger } from '../core/logger.js';

/**
 * Create a simple console logger
 */
export function createConsoleLogger(component: string): ILogger {
  const log = (level: string, message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}${metaStr}`);
  };

  return {
    debug: (message: string, meta?: unknown) => log('debug', message, meta),
    info: (message: string, meta?: unknown) => log('info', message, meta),
    warn: (message: string, meta?: unknown) => log('warn', message, meta),
    error: (message: string, error?: unknown) => {
      const errorStr = error instanceof Error ? error.message : String(error);
      log('error', `${message}: ${errorStr}`, error);
    },
    configure: async () => {}
  };
} 