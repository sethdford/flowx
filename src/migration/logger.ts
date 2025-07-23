/**
 * Migration Logger - Structured logging for migration operations
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { colors } from '../utils/colors.js';

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  message: string;
  context?: any;
  stack?: string;
}

export class MigrationLogger {
  private logFile?: string;
  private entries: LogEntry[] = [];

  constructor(logFile?: string) {
    this.logFile = logFile;
  }

  info(message: string, context?: any): void {
    this.log('info', message, context);
    console.log(colors.hex("#0066CC")(`ℹ️  ${message}`));
  }

  warn(message: string, context?: any): void {
    this.log('warn', message, context);
    console.log(colors.hex("#FFAA00")(`⚠️  ${message}`));
  }

  error(message: string, error?: Error | any, context?: any): void {
    this.log('error', message, context, error?.stack);
    console.log(colors.hex("#FF0000")(`❌ ${message}`));
    if (error && error.message !== message) {
      console.log(colors.hex("#FF0000")(`   ${error.message}`));
    }
  }

  success(message: string, context?: any): void {
    this.log('success', message, context);
    console.log(colors.hex("#00AA00")(`✅ ${message}`));
  }

  debug(message: string, context?: any): void {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      this.log('debug', message, context);
      console.log(colors.gray(`🔍 ${message}`));
    }
  }

  private log(level: LogEntry['level'], message: string, context?: any, stack?: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      stack
    };

    this.entries.push(entry);

    if (this.logFile) {
      this.writeToFile(entry);
    }
  }

  private async writeToFile(entry: LogEntry): Promise<void> {
    if (!this.logFile) return;

    try {
      const logDir = path.dirname(this.logFile);
      await fs.mkdir(logDir, { recursive: true });

      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logFile, logLine);
    } catch (error) {
      // Prevent recursive logging
      console.error('Failed to write to log file:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async saveToFile(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(this.entries, null, 2));
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntriesByLevel(level: LogEntry['level']): LogEntry[] {
    return this.entries.filter(entry => entry.level === level);
  }

  clear(): void {
    this.entries = [];
  }

  printSummary(): void {
    const summary = {
      total: this.entries.length,
      info: this.getEntriesByLevel('info').length,
      warn: this.getEntriesByLevel('warn').length,
      error: this.getEntriesByLevel('error').length,
      success: this.getEntriesByLevel('success').length,
      debug: this.getEntriesByLevel('debug').length
    };

    console.log(colors.bold('\n📊 Migration Log Summary'));
    console.log(colors.gray('─'.repeat(30)));
    console.log(`Total entries: ${summary.total}`);
    console.log(`${colors.hex("#0066CC")('Info:')} ${summary.info}`);
    console.log(`${colors.hex("#00AA00")('Success:')} ${summary.success}`);
    console.log(`${colors.hex("#FFAA00")('Warnings:')} ${summary.warn}`);
    console.log(`${colors.hex("#FF0000")('Errors:')} ${summary.error}`);
    if (summary.debug > 0) {
      console.log(`${colors.gray('Debug:')} ${summary.debug}`);
    }
    console.log(colors.gray('─'.repeat(30)));
  }
}

// Global logger instance
export const logger = new MigrationLogger();

// Set log file if in production
if (process.env.NODE_ENV === 'production') {
  const logFile = path.join(process.cwd(), 'logs', 'migration.log');
  logger['logFile'] = logFile;
}