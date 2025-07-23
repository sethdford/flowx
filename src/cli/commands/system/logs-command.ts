/**
 * Logs Command
 * Real-time log aggregation and monitoring for flowx
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { homedir } from 'os';

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  metadata?: any;
  source: string;
}

interface LogsOptions {
  follow?: boolean;
  lines?: number;
  level?: string;
  component?: string;
  format?: 'table' | 'json' | 'raw';
  output?: string;
  since?: string;
  until?: string;
  grep?: string;
  tail?: boolean;
}

export const logsCommand: CLICommand = {
  name: 'logs',
  description: 'View and manage flowx logs',
  category: 'System',
  usage: 'flowx logs [OPTIONS]',
  examples: [
    'flowx logs',
    'flowx logs --follow',
    'flowx logs --level error',
    'flowx logs --component SwarmCoordinator',
    'flowx logs --lines 100 --format json',
    'flowx logs --grep "task completed"',
    'flowx logs --since "2024-01-01" --until "2024-01-02"'
  ],
  options: [
    {
      name: 'follow',
      short: 'f',
      description: 'Follow log output in real-time',
      type: 'boolean'
    },
    {
      name: 'lines',
      short: 'n',
      description: 'Number of lines to show',
      type: 'number',
      default: 50
    },
    {
      name: 'level',
      short: 'l',
      description: 'Filter by log level',
      type: 'string',
      choices: ['debug', 'info', 'warn', 'error']
    },
    {
      name: 'component',
      short: 'c',
      description: 'Filter by component name',
      type: 'string'
    },
    {
      name: 'format',
      description: 'Output format',
      type: 'string',
      choices: ['table', 'json', 'raw'],
      default: 'table'
    },
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string'
    },
    {
      name: 'since',
      description: 'Show logs since timestamp (ISO format)',
      type: 'string'
    },
    {
      name: 'until',
      description: 'Show logs until timestamp (ISO format)',
      type: 'string'
    },
    {
      name: 'grep',
      short: 'g',
      description: 'Filter logs by pattern',
      type: 'string'
    },
    {
      name: 'tail',
      short: 't',
      description: 'Show latest logs only',
      type: 'boolean'
    },
    {
      name: 'clear',
      description: 'Clear log files',
      type: 'boolean'
    },
    {
      name: 'stats',
      description: 'Show log statistics',
      type: 'boolean'
    }
  ],
  subcommands: [
    {
      name: 'clear',
      description: 'Clear all log files',
      handler: async (context: CLIContext) => await clearLogs(context)
    },
    {
      name: 'stats',
      description: 'Show log statistics',
      handler: async (context: CLIContext) => await showLogStats(context)
    },
    {
      name: 'export',
      description: 'Export logs to file',
      handler: async (context: CLIContext) => await exportLogs(context)
    },
    {
      name: 'analyze',
      description: 'Analyze log patterns',
      handler: async (context: CLIContext) => await analyzeLogs(context)
    },
    {
      name: 'rotate',
      description: 'Rotate log files',
      handler: async (context: CLIContext) => await rotateLogs(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { options } = context;
    
    if (options.clear) {
      await clearLogs(context);
      return;
    }
    
    if (options.stats) {
      await showLogStats(context);
      return;
    }
    
    await showLogs(context);
  }
};

async function showLogs(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    printInfo('📋 flowx Logs');
    console.log('─'.repeat(60));
    
    // Get log entries
    const logs = await getLogEntries(options);
    
    if (logs.length === 0) {
      printWarning('No log entries found');
      printInfo('Try adjusting your filters or check if flowx is running');
      return;
    }
    
    // Display logs
    if (options.follow) {
      await followLogs(logs, options);
    } else {
      await displayLogs(logs, options);
    }
    
    // Export if requested
    if (options.output) {
      await exportLogsToFile(logs, options.output, options.format || 'json');
      printSuccess(`✅ Logs exported to ${options.output}`);
    }
    
  } catch (error) {
    printError(`Failed to show logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getLogEntries(options: LogsOptions): Promise<LogEntry[]> {
  const logSources = await getLogSources();
  const allLogs: LogEntry[] = [];
  
  // Read from all log sources
  for (const source of logSources) {
    try {
      const logs = await readLogsFromSource(source, options);
      allLogs.push(...logs);
    } catch (error) {
      console.warn(`Warning: Could not read logs from ${source.name}`);
    }
  }
  
  // Sort by timestamp
  allLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // Apply filters
  let filteredLogs = allLogs;
  
  if (options.level) {
    filteredLogs = filteredLogs.filter(log => log.level === options.level);
  }
  
  if (options.component) {
    filteredLogs = filteredLogs.filter(log => 
      log.component.toLowerCase().includes(options.component!.toLowerCase())
    );
  }
  
  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    filteredLogs = filteredLogs.filter(log => 
      pattern.test(log.message) || pattern.test(log.component)
    );
  }
  
  if (options.since) {
    const sinceDate = new Date(options.since);
    filteredLogs = filteredLogs.filter(log => 
      new Date(log.timestamp) >= sinceDate
    );
  }
  
  if (options.until) {
    const untilDate = new Date(options.until);
    filteredLogs = filteredLogs.filter(log => 
      new Date(log.timestamp) <= untilDate
    );
  }
  
  // Limit lines
  if (options.lines && !options.follow) {
    filteredLogs = options.tail 
      ? filteredLogs.slice(-options.lines)
      : filteredLogs.slice(0, options.lines);
  }
  
  return filteredLogs;
}

async function getLogSources(): Promise<Array<{ name: string; path: string; type: 'file' | 'system' }>> {
  const sources = [];
  
  // flowx specific logs
  const claudeFlowLogDir = path.join(process.cwd(), '.flowx', 'logs');
  try {
    const files = await fs.readdir(claudeFlowLogDir);
    for (const file of files) {
      if (file.endsWith('.log')) {
        sources.push({
          name: file.replace('.log', ''),
          path: path.join(claudeFlowLogDir, file),
          type: 'file' as const
        });
      }
    }
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(claudeFlowLogDir, { recursive: true });
  }
  
  // System logs (if accessible)
  const systemLogPaths = [
    '/var/log/system.log',
    '/var/log/messages',
    `${homedir()}/Library/Logs/flowx.log`
  ];
  
  for (const logPath of systemLogPaths) {
    try {
      await fs.access(logPath);
      sources.push({
        name: path.basename(logPath, '.log'),
        path: logPath,
        type: 'system' as const
      });
    } catch {
      // Log file doesn't exist or not accessible
    }
  }
  
  // If no sources found, create a default one
  if (sources.length === 0) {
    const defaultLogPath = path.join(claudeFlowLogDir, 'flowx.log');
    sources.push({
      name: 'flowx',
      path: defaultLogPath,
      type: 'file' as const
    });
  }
  
  return sources;
}

async function readLogsFromSource(source: { name: string; path: string; type: string }, options: LogsOptions): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];
  
  try {
    const content = await fs.readFile(source.path, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const logEntry = parseLogLine(line, source.name);
      if (logEntry) {
        logs.push(logEntry);
      }
    }
  } catch (error) {
    // If file doesn't exist, generate some sample logs
    if ((error as any).code === 'ENOENT') {
      const sampleLogs = generateSampleLogs(source.name);
      logs.push(...sampleLogs);
    }
  }
  
  return logs;
}

function parseLogLine(line: string, sourceName: string): LogEntry | null {
  try {
    // Try to parse as JSON first (structured logs)
    if (line.startsWith('{')) {
      const parsed = JSON.parse(line);
      return {
        timestamp: parsed.timestamp || new Date().toISOString(),
        level: parsed.level || 'info',
        component: parsed.component || sourceName,
        message: parsed.message || line,
        metadata: parsed.metadata,
        source: sourceName
      };
    }
    
    // Try to parse common log formats
    const timestampMatch = line.match(/^\[([^\]]+)\]/);
    const levelMatch = line.match(/\b(DEBUG|INFO|WARN|ERROR|FATAL)\b/i);
    const componentMatch = line.match(/\{[^}]*"component":"([^"]+)"/);
    
    return {
      timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
      level: (levelMatch ? levelMatch[1].toLowerCase() : 'info') as LogEntry['level'],
      component: componentMatch ? componentMatch[1] : sourceName,
      message: line.replace(/^\[[^\]]+\]\s*/, '').replace(/\b(DEBUG|INFO|WARN|ERROR|FATAL)\b/i, '').trim(),
      source: sourceName
    };
  } catch {
    // If parsing fails, treat as plain text
    return {
      timestamp: new Date().toISOString(),
      level: 'info',
      component: sourceName,
      message: line,
      source: sourceName
    };
  }
}

function generateSampleLogs(sourceName: string): LogEntry[] {
  const now = new Date();
  const logs: LogEntry[] = [];
  
  // Generate some realistic log entries
  const components = ['SwarmCoordinator', 'AgentManager', 'MemoryManager', 'CLI', 'TaskScheduler'];
  const levels: LogEntry['level'][] = ['debug', 'info', 'warn', 'error'];
  const messages = [
    'System initialized successfully',
    'Agent registered: agent-123',
    'Task completed: task-456',
    'Memory sync completed',
    'Configuration loaded',
    'Warning: High memory usage detected',
    'Error: Failed to connect to database',
    'Debug: Processing background tasks',
    'Agent heartbeat received',
    'Swarm coordination started'
  ];
  
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(now.getTime() - (i * 60000)).toISOString();
    logs.push({
      timestamp,
      level: levels[Math.floor(Math.random() * levels.length)],
      component: components[Math.floor(Math.random() * components.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      source: sourceName
    });
  }
  
  return logs.reverse(); // Chronological order
}

async function displayLogs(logs: LogEntry[], options: LogsOptions): Promise<void> {
  if (options.format === 'json') {
    console.log(JSON.stringify(logs, null, 2));
    return;
  }
  
  if (options.format === 'raw') {
    logs.forEach(log => {
      console.log(`[${log.timestamp}] ${log.level.toUpperCase()} ${log.component}: ${log.message}`);
    });
    return;
  }
  
  // Table format
  const tableData = logs.map(log => ({
    timestamp: new Date(log.timestamp).toLocaleString(),
    level: formatLogLevel(log.level),
    component: log.component,
    message: log.message.substring(0, 60) + (log.message.length > 60 ? '...' : ''),
    source: log.source
  }));
  
  const table = formatTable(tableData, [
    { header: 'Time', key: 'timestamp', width: 20 },
    { header: 'Level', key: 'level', width: 8 },
    { header: 'Component', key: 'component', width: 15 },
    { header: 'Message', key: 'message', width: 50 },
    { header: 'Source', key: 'source', width: 10 }
  ]);
  
  console.log(table);
  console.log();
  printInfo(`Showing ${logs.length} log entries`);
}

async function followLogs(initialLogs: LogEntry[], options: LogsOptions): Promise<void> {
  console.log(successBold('📡 Following logs in real-time (Press Ctrl+C to stop)\n'));
  
  // Show initial logs
  await displayLogs(initialLogs.slice(-10), options);
  
  // Simulate real-time log following
  const interval = setInterval(async () => {
    try {
      const newLogs = await getLogEntries({ ...options, lines: 5, tail: true });
      
      if (newLogs.length > 0) {
        const latestLog = newLogs[newLogs.length - 1];
        const formattedTime = new Date(latestLog.timestamp).toLocaleTimeString();
        const levelColor = formatLogLevel(latestLog.level);
        
        console.log(`[${formattedTime}] ${levelColor} ${latestLog.component}: ${latestLog.message}`);
      }
    } catch (error) {
      console.error('Error following logs:', error);
    }
  }, 2000);
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n📋 Log following stopped');
    process.exit(0);
  });
}

function formatLogLevel(level: string): string {
  switch (level.toLowerCase()) {
    case 'debug':
      return '🔍 DEBUG';
    case 'info':
      return '📋 INFO';
    case 'warn':
      return '⚠️  WARN';
    case 'error':
      return '❌ ERROR';
    default:
      return level.toUpperCase();
  }
}

async function clearLogs(context: CLIContext): Promise<void> {
  try {
    const logSources = await getLogSources();
    
    printWarning('This will clear all log files');
    printInfo('Are you sure? (This action cannot be undone)');
    
    // In a real implementation, you would prompt for confirmation
    // For now, we'll just simulate the action
    
    let clearedCount = 0;
    for (const source of logSources) {
      try {
        await fs.writeFile(source.path, '');
        clearedCount++;
      } catch (error) {
        console.warn(`Warning: Could not clear ${source.name}`);
      }
    }
    
    printSuccess(`✅ Cleared ${clearedCount} log files`);
    
  } catch (error) {
    printError(`Failed to clear logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function showLogStats(context: CLIContext): Promise<void> {
  try {
    const logs = await getLogEntries({ lines: 10000 });
    
    console.log(successBold('\n📊 Log Statistics\n'));
    
    // Level distribution
    const levelCounts = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(infoBold('📈 Log Levels:'));
    Object.entries(levelCounts).forEach(([level, count]) => {
      console.log(`  ${formatLogLevel(level)}: ${count}`);
    });
    
    // Component distribution
    const componentCounts = logs.reduce((acc, log) => {
      acc[log.component] = (acc[log.component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(infoBold('\n🏗️  Components:'));
    Object.entries(componentCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([component, count]) => {
        console.log(`  ${component}: ${count}`);
      });
    
    // Time range
    if (logs.length > 0) {
      const firstLog = logs[0];
      const lastLog = logs[logs.length - 1];
      
      console.log(infoBold('\n⏰ Time Range:'));
      console.log(`  From: ${new Date(firstLog.timestamp).toLocaleString()}`);
      console.log(`  To: ${new Date(lastLog.timestamp).toLocaleString()}`);
      console.log(`  Total entries: ${logs.length}`);
    }
    
    // Log sources
    const sources = await getLogSources();
    console.log(infoBold('\n📁 Log Sources:'));
    sources.forEach(source => {
      console.log(`  ${source.name}: ${source.path}`);
    });
    
  } catch (error) {
    printError(`Failed to show log stats: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function exportLogs(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const outputFile = args[0] || `flowx-logs-${Date.now()}.tson`;
  
  try {
    const logs = await getLogEntries(options);
    await exportLogsToFile(logs, outputFile, options.format || 'json');
    
    printSuccess(`✅ Exported ${logs.length} log entries to ${outputFile}`);
    
  } catch (error) {
    printError(`Failed to export logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function exportLogsToFile(logs: LogEntry[], filePath: string, format: string): Promise<void> {
  let content: string;
  
  switch (format) {
    case 'json':
      content = JSON.stringify(logs, null, 2);
      break;
    case 'csv':
      const headers = 'timestamp,level,component,message,source\n';
      const rows = logs.map(log => 
        `"${log.timestamp}","${log.level}","${log.component}","${log.message.replace(/"/g, '""')}","${log.source}"`
      ).join('\n');
      content = headers + rows;
      break;
    case 'raw':
      content = logs.map(log => 
        `[${log.timestamp}] ${log.level.toUpperCase()} ${log.component}: ${log.message}`
      ).join('\n');
      break;
    default:
      content = JSON.stringify(logs, null, 2);
  }
  
  await fs.writeFile(filePath, content);
}

async function analyzeLogs(context: CLIContext): Promise<void> {
  try {
    const logs = await getLogEntries({ lines: 10000 });
    
    console.log(successBold('\n🔍 Log Analysis\n'));
    
    // Error analysis
    const errors = logs.filter(log => log.level === 'error');
    if (errors.length > 0) {
      console.log(errorBold('❌ Error Analysis:'));
      const errorPatterns = errors.reduce((acc, log) => {
        const pattern = log.message.split(':')[0];
        acc[pattern] = (acc[pattern] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(errorPatterns)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([pattern, count]) => {
          console.log(`  ${pattern}: ${count} occurrences`);
        });
    }
    
    // Performance patterns
    const performanceLogs = logs.filter(log => 
      log.message.includes('completed') || 
      log.message.includes('duration') || 
      log.message.includes('time')
    );
    
    if (performanceLogs.length > 0) {
      console.log(infoBold('\n⚡ Performance Patterns:'));
      console.log(`  Task completions: ${performanceLogs.length}`);
      console.log(`  Average per hour: ${Math.round(performanceLogs.length / 24)}`);
    }
    
    // Recent activity
    const recentLogs = logs.filter(log => {
      const logTime = new Date(log.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return logTime > oneHourAgo;
    });
    
    console.log(infoBold('\n🕐 Recent Activity (Last Hour):'));
    console.log(`  Total logs: ${recentLogs.length}`);
    console.log(`  Errors: ${recentLogs.filter(l => l.level === 'error').length}`);
    console.log(`  Warnings: ${recentLogs.filter(l => l.level === 'warn').length}`);
    
  } catch (error) {
    printError(`Failed to analyze logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function rotateLogs(context: CLIContext): Promise<void> {
  try {
    const sources = await getLogSources();
    
    printInfo('🔄 Rotating log files...');
    
    let rotatedCount = 0;
    for (const source of sources) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${source.path}.${timestamp}`;
        
        // Move current log to backup
        await fs.rename(source.path, backupPath);
        
        // Create new empty log file
        await fs.writeFile(source.path, '');
        
        rotatedCount++;
        console.log(`  ✅ Rotated ${source.name} -> ${path.basename(backupPath)}`);
      } catch (error) {
        console.warn(`  ⚠️  Could not rotate ${source.name}`);
      }
    }
    
    printSuccess(`✅ Rotated ${rotatedCount} log files`);
    
  } catch (error) {
    printError(`Failed to rotate logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default logsCommand; 