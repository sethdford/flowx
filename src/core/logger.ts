/**
 * Logging infrastructure for FlowX
 */

import * as fs from 'node:fs/promises';
import * as path from 'path';
import { Buffer } from 'node:buffer';
import * as process from 'node:process';
// Remove interface import that gets stripped in Node.js strip-only mode
// import { LoggingConfig } from "../utils/types.js";
import { formatBytes } from "../utils/helpers.js";
import { EventEmitter } from 'node:events';

export interface ILogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, error?: unknown): void;
  configure(config: any): Promise<void>; // Use any instead of LoggingConfig
}

// Convert enum to const object for Node.js strip-only mode compatibility
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

// Add mapping for log level names
const LogLevelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: Record<string, unknown>;
  data?: unknown;
  error?: unknown;
}

/**
 * Logger implementation with context support
 */
export class Logger implements ILogger {
  private static instance: Logger;
  private config: any; // Use any instead of LoggingConfig
  private context: Record<string, unknown>;
  private fileHandle?: fs.FileHandle;
  private currentFileSize = 0;
  private currentFileIndex = 0;
  private isClosing = false;

  constructor(
    config: any = { // Use any instead of LoggingConfig
      level: 'info',
      format: 'json',
      destination: 'console',
    },
    context: Record<string, unknown> = {},
  ) {
    // Validate file path if file destination
    if ((config.destination === 'file' || config.destination === 'both') && !config.filePath) {
      throw new Error('File path required for file logging');
    }
    
    this.config = config;
    this.context = context;
  }

  /**
   * Gets the singleton instance of the logger
   */
  static getInstance(config?: any): Logger { // Use any instead of LoggingConfig
    if (!Logger.instance) {
      if (!config) {
        // Use default config if none provided and not in test environment
        const isTestEnv = process.env.FLOWX_ENV === 'test';
        if (isTestEnv) {
          // Skip error in test environment and use defaults
          console.warn('Using default logger configuration in test environment');
        }
        config = {
          level: 'info',
          format: 'json',
          destination: 'console',
        };
      }
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Updates logger configuration
   */
  async configure(config: any): Promise<void> { // Use any instead of LoggingConfig
    this.config = config;
    
    // Reset file handle if destination changed
    if (this.fileHandle && config.destination !== 'file' && config.destination !== 'both') {
      await this.fileHandle.close();
      delete this.fileHandle;
    }
  }

  debug(message: string, meta?: unknown): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: unknown): void {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, undefined, error);
  }

  /**
   * Creates a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    return new Logger(this.config, { ...this.context, ...context });
  }

  /**
   * Properly close the logger and release resources
   */
  async close(): Promise<void> {
    this.isClosing = true;
    if (this.fileHandle) {
      try {
        await this.fileHandle.close();
      } catch (error) {
        console.error('Error closing log file handle:', error);
      } finally {
        delete this.fileHandle;
      }
    }
  }

  private log(level: LogLevel, message: string, data?: unknown, error?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevelNames[level], // Use LogLevelNames array instead of LogLevel[level]
      message,
      context: this.context,
      data,
      error,
    };

    const formatted = this.format(entry);

    if (this.config.destination === 'console' || this.config.destination === 'both') {
      this.writeToConsole(level, formatted);
    }

    if (this.config.destination === 'file' || this.config.destination === 'both') {
      this.writeToFile(formatted);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levelStr = this.config.level || 'info';
    const configLevel = LogLevel[levelStr.toUpperCase() as keyof typeof LogLevel];
    return level >= configLevel;
  }

  private format(entry: LogEntry): string {
    if (this.config.format === 'json') {
      // Handle error serialization for JSON format
      const jsonEntry = { ...entry };
      if (jsonEntry.error instanceof Error) {
        jsonEntry.error = {
          name: jsonEntry.error.name,
          message: jsonEntry.error.message,
          stack: jsonEntry.error.stack,
        };
      }
      return JSON.stringify(jsonEntry);
    }

    // Text format
    const contextStr = Object.keys(entry.context).length > 0
      ? ` ${JSON.stringify(entry.context)}`
      : '';
    const dataStr = entry.data !== undefined
      ? ` ${JSON.stringify(entry.data)}`
      : '';
    const errorStr = entry.error !== undefined
      ? entry.error instanceof Error
        ? `\n  Error: ${entry.error.message}\n  Stack: ${entry.error.stack}`
        : ` Error: ${JSON.stringify(entry.error)}`
      : '';

    return `[${entry.timestamp}] ${entry.level} ${entry.message}${contextStr}${dataStr}${errorStr}`;
  }

  private writeToConsole(level: LogLevel, message: string): void {
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
        console.error(message);
        break;
    }
  }

  private async writeToFile(message: string): Promise<void> {
    if (!this.config.filePath || this.isClosing) {
      return;
    }

    try {
      // Check if we need to rotate the log file
      if (await this.shouldRotate()) {
        await this.rotate();
      }

      // Open file handle if not already open
      if (!this.fileHandle) {
        this.fileHandle = await fs.open(this.config.filePath, 'a');
      }

      // Write the message
      const data = Buffer.from(message + '\n', 'utf8');
      await this.fileHandle.write(data);
      this.currentFileSize += data.length;
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async shouldRotate(): Promise<boolean> {
    if (!this.config.maxFileSize || !this.config.filePath) {
      return false;
    }

    try {
      const stat = await fs.stat(this.config.filePath);
      return stat.size >= this.config.maxFileSize;
    } catch {
      return false;
    }
  }

  private async rotate(): Promise<void> {
    if (!this.config.filePath || !this.config.maxFiles) {
      return;
    }

    // Close current file
    if (this.fileHandle) {
      await this.fileHandle.close();
      delete this.fileHandle;
    }

    // Rename current file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = `${this.config.filePath}.${timestamp}`;
    await fs.rename(this.config.filePath, rotatedPath);

    // Clean up old files
    await this.cleanupOldFiles();

    // Reset file size
    this.currentFileSize = 0;
  }

  private async cleanupOldFiles(): Promise<void> {
    if (!this.config.maxFiles || this.config.maxFiles <= 0) return;

    try {
      const dir = path.dirname(this.config.filePath);
      const files = await fs.readdir(dir);
      const logFiles = files
        .filter(file => file.startsWith(path.basename(this.config.filePath)))
        .sort()
        .slice(this.config.maxFiles);

      for (const file of logFiles) {
        await fs.unlink(path.join(dir, file));
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * Resets the singleton instance (for testing)
   */
  static reset(): void {
    if (Logger.instance) {
      Logger.instance.close().catch(() => {
        // Ignore errors during cleanup
      });
      Logger.instance = null as any;
    }
  }
}

// Export singleton instance with lazy initialization
export const logger = Logger.getInstance();