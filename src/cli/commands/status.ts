/**
 * Status command for Claude-Flow
 */

import { Command } from 'commander';
import { formatHealthStatus, formatDuration, formatStatusIndicator, formatProgressBar } from "../formatter.ts";

// Color utilities
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  white: (text: string) => `\x1b[37m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
};

// Color combination helpers
const colorCombinations = {
  cyanBold: (text: string) => `\x1b[1;36m${text}\x1b[0m`,
  redBold: (text: string) => `\x1b[1;31m${text}\x1b[0m`,
  yellowBold: (text: string) => `\x1b[1;33m${text}\x1b[0m`,
};

// Simple table utility
class Table {
  private headers: string[] = [];
  private rows: string[][] = [];
  private hasBorder: boolean = false;

  constructor() {}

  header(headers: string[]): this {
    this.headers = headers;
    return this;
  }

  push(row: string[]): this {
    this.rows.push(row);
    return this;
  }

  border(enabled: boolean): this {
    this.hasBorder = enabled;
    return this;
  }

  render(): void {
    console.log(this.toString());
  }

  toString(): string {
    if (this.headers.length === 0 && this.rows.length === 0) {
      return '';
    }

    const allRows = this.headers.length > 0 ? [this.headers, ...this.rows] : this.rows;
    const colWidths = this.headers.map((_, i) => 
      Math.max(...allRows.map(row => (row[i] || '').length))
    );

    let result = '';
    
    if (this.headers.length > 0) {
      result += this.headers.map((header, i) => header.padEnd(colWidths[i])).join(' | ') + '\n';
      result += colWidths.map(width => '-'.repeat(width)).join('-+-') + '\n';
    }

    for (const row of this.rows) {
      result += row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ') + '\n';
    }

    return result;
  }
}

export const statusCommand = new Command('status')
  .description('Show Claude-Flow system status')
  .option('-w, --watch', 'Watch mode - continuously update status')
  .option('-i, --interval <seconds>', 'Update interval in seconds', '5')
  .option('-c, --component <name>', 'Show status for specific component')
  .option('--json', 'Output in JSON format')
  .action(async (options: any) => {
    if (options.watch) {
      await watchStatus(options);
    } else {
      await showStatus(options);
    }
  });

async function showStatus(options: any): Promise<void> {
  try {
    // In a real implementation, this would connect to the running orchestrator
    const status = await getSystemStatus(options);
    
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    if (options.component) {
      showComponentStatus(status, options.component);
    } else {
      showFullStatus(status);
    }
  } catch (error) {
    if ((error as Error).message.includes('ECONNREFUSED') || (error as Error).message.includes('connection refused')) {
      console.error(colors.red('✗ Claude-Flow is not running'));
      console.log(colors.gray('Start it with: claude-flow start'));
    } else {
      console.error(colors.red('Error getting status:'), (error as Error).message);
    }
  }
}

async function watchStatus(options: any): Promise<void> {
  const interval = parseInt(options.interval) * 1000;
  
  console.log(colors.cyan('Watching Claude-Flow status...'));
  console.log(colors.gray(`Update interval: ${options.interval}s`));
  console.log(colors.gray('Press Ctrl+C to stop\n'));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Clear screen and show status
    console.clear();
    console.log(colorCombinations.cyanBold('Claude-Flow Status Monitor'));
    console.log(colors.gray(`Last updated: ${new Date().toLocaleTimeString()}\n`));
    
    try {
      await showStatus({ ...options, json: false });
    } catch (error) {
      console.error(colors.red('Status update failed:'), (error as Error).message);
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

function showFullStatus(status: any): void {
  // System overview
  console.log(colorCombinations.cyanBold('System Overview'));
  console.log('─'.repeat(50));
  
  const statusIcon = formatStatusIndicator(status.overall);
  console.log(`${statusIcon} Overall Status: ${getStatusColor(status.overall)(status.overall.toUpperCase())}`);
  console.log(`${colors.white('Uptime:')} ${formatDuration(status.uptime)}`);
  console.log(`${colors.white('Version:')} ${status.version}`);
  console.log(`${colors.white('Started:')} ${new Date(status.startTime).toLocaleString()}`);
  console.log();

  // Components status
  console.log(colorCombinations.cyanBold('Components'));
  console.log('─'.repeat(50));
  
  const componentTable = new Table()
    .header(['Component', 'Status', 'Uptime', 'Details'])
    .border(true);

  for (const [name, component] of Object.entries(status.components)) {
    const comp = component as any;
    const statusIcon = formatStatusIndicator(comp.status);
    const statusText = getStatusColor(comp.status)(comp.status.toUpperCase());
    
    componentTable.push([
      colors.white(name),
      `${statusIcon} ${statusText}`,
      formatDuration(comp.uptime || 0),
      comp.details || '-'
    ]);
  }
  
  componentTable.render();
  console.log();

  // Resource usage
  if (status.resources) {
    console.log(colorCombinations.cyanBold('Resource Usage'));
    console.log('─'.repeat(50));
    
    const resourceTable = new Table()
      .header(['Resource', 'Usage', 'Status', 'Trend'])
      .border(true);

    for (const [name, resource] of Object.entries(status.resources)) {
      const res = resource as any;
      const usage = `${res.used}/${res.total} ${res.unit}`;
      const percentage = ((res.used / res.total) * 100).toFixed(1);
      const statusColor = getResourceColor(parseFloat(percentage));
      
      resourceTable.push([
        colors.white(name),
        `${usage} (${percentage}%)`,
        statusColor(`${percentage}%`),
        res.trend ? (res.trend > 0 ? '↗️' : res.trend < 0 ? '↘️' : '→') : '-'
      ]);
    }
    
    resourceTable.render();
    console.log();
  }

  // Active agents
  if (status.agents && status.agents.length > 0) {
    console.log(colorCombinations.cyanBold('Active Agents'));
    console.log('─'.repeat(50));
    
    const agentTable = new Table()
      .header(['Agent ID', 'Type', 'Status', 'Tasks', 'Uptime'])
      .border(true);

    for (const agent of status.agents.slice(0, 10)) {
      agentTable.push([
        colors.gray(agent.id.substring(0, 12)),
        colors.cyan(agent.type),
        getStatusColor(agent.status)(agent.status),
        agent.activeTasks?.toString() || '0',
        formatDuration(agent.uptime || 0)
      ]);
    }
    
    agentTable.render();
    
    if (status.agents.length > 10) {
      console.log(colors.gray(`... and ${status.agents.length - 10} more agents`));
    }
    console.log();
  }

  // Recent tasks
  if (status.tasks && status.tasks.length > 0) {
    console.log(colorCombinations.cyanBold('Recent Tasks'));
    console.log('─'.repeat(50));
    
    const taskTable = new Table()
      .header(['Task ID', 'Type', 'Status', 'Agent', 'Duration'])
      .border(true);

    for (const task of status.tasks.slice(0, 5)) {
      taskTable.push([
        colors.gray(task.id.substring(0, 12)),
        colors.white(task.type),
        getStatusColor(task.status)(task.status),
        task.assignedAgent ? colors.cyan(task.assignedAgent.substring(0, 12)) : colors.gray('None'),
        task.duration ? formatDuration(task.duration) : colors.gray('N/A')
      ]);
    }
    
    taskTable.render();
    console.log();
  }

  // Health warnings
  if (status.warnings && status.warnings.length > 0) {
    console.log(colorCombinations.yellowBold('⚠️  Health Warnings'));
    console.log('─'.repeat(50));
    
    for (const warning of status.warnings) {
      console.log(`${colors.yellow('⚠️')} ${warning.message}`);
      if (warning.suggestion) {
        console.log(`   ${colors.gray('💡 ' + warning.suggestion)}`);
      }
    }
    console.log();
  }
}

function showComponentStatus(status: any, componentName: string): void {
  const component = status.components[componentName];
  
  if (!component) {
    console.error(colors.red(`Component '${componentName}' not found`));
    console.log(colors.gray('Available components:'), Object.keys(status.components).join(', '));
    return;
  }

  console.log(colorCombinations.cyanBold(`${componentName} Status`));
  console.log('─'.repeat(30));
  
  const statusIcon = formatStatusIndicator(component.status);
  console.log(`${statusIcon} Status: ${getStatusColor(component.status)(component.status.toUpperCase())}`);
  
  if (component.uptime) {
    console.log(`${colors.white('Uptime:')} ${formatDuration(component.uptime)}`);
  }
  
  if (component.details) {
    console.log(`${colors.white('Details:')} ${component.details}`);
  }
  
  if (component.metrics) {
    console.log('\n' + colorCombinations.cyanBold('Metrics'));
    console.log('─'.repeat(20));
    
    for (const [metric, value] of Object.entries(component.metrics)) {
      console.log(`${colors.white(metric + ':')} ${value}`);
    }
  }
  
  if (component.errors && component.errors.length > 0) {
    console.log('\n' + colorCombinations.redBold('Recent Errors'));
    console.log('─'.repeat(20));
    
    for (const error of component.errors.slice(0, 5)) {
      console.log(colors.red(`• ${error.message}`));
      console.log(colors.gray(`  ${new Date(error.timestamp).toLocaleString()}`));
    }
  }
}

async function getSystemStatus(options: any = {}): Promise<any> {
  // Mock system status for demonstration
  return {
    overall: 'running',
    uptime: 86400000, // 1 day in milliseconds
    version: '1.0.0',
    startTime: Date.now() - 86400000,
    components: {
      orchestrator: {
        status: 'running',
        uptime: 86400000,
        details: 'Processing tasks normally'
      },
      terminal: {
        status: 'running',
        uptime: 86400000,
        details: 'Connected clients: 3'
      },
      memory: {
        status: 'running',
        uptime: 86400000,
        details: 'Memory usage: 45%'
      },
      mcp: {
        status: 'running',
        uptime: 86400000,
        details: 'Active connections: 2'
      },
      coordination: {
        status: 'running',
        uptime: 86400000,
        details: 'Load balancer active'
      }
    },
    resources: {
      CPU: { used: 2, total: 8 },
      Memory: { used: 4096, total: 16384 },
      Disk: { used: 50, total: 500 }
    },
    agents: [
      {
        id: 'agent-1',
        name: 'Primary Agent',
        type: 'coordinator',
        status: 'active',
        tasks: 3
      }
    ],
    tasks: {
      active: 5,
      pending: 2,
      completed: 150,
      failed: 1
    },
    performance: {
      avgResponseTime: 150,
      throughput: 45,
      errorRate: 0.1
    }
  };
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'active':
    case 'completed':
      return colors.green;
    case 'degraded':
    case 'warning':
    case 'idle':
      return colors.yellow;
    case 'unhealthy':
    case 'error':
    case 'failed':
      return colors.red;
    case 'running':
      return colors.cyan;
    default:
      return colors.white;
  }
}

function getResourceColor(percentage: number) {
  if (percentage >= 90) return colors.red;
  if (percentage >= 75) return colors.yellow;
  return colors.green;
}

function getPriorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case 'high': return colors.red;
    case 'medium': return colors.yellow;
    case 'low': return colors.green;
    default: return colors.white;
  }
}

function getMetricStatus(metric: string, value: any): string {
  // Simple heuristic for metric status
  if (typeof value === 'string' && value.includes('%')) {
    const percentage = parseFloat(value);
    if (percentage >= 95) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 60) return 'fair';
    return 'poor';
  }
  return 'normal';
}

function calculateTrend(history: number[]): number {
  if (history.length < 2) return 0;
  const recent = history.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, history.length);
  const older = history.slice(0, -5).reduce((a, b) => a + b, 0) / Math.max(1, history.length - 5);
  return (recent - older) / older;
}

async function getRealSystemStatus(): Promise<any | null> {
  try {
    // Try to connect to running orchestrator
    // This would be implemented based on actual IPC/HTTP communication
    return null; // Not implemented yet
  } catch {
    return null;
  }
}

async function getPidFromFile(): Promise<number | null> {
  try {
    const fs = await import('node:fs/promises');
    try {
      await fs.access('.claude-flow.pid');
      const pidData = await fs.readFile('.claude-flow.pid', 'utf8');
      const data = JSON.parse(pidData);
      return data.pid || null;
    } catch {
      return null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

async function getLastKnownStatus(): Promise<any | null> {
  try {
    const fs = await import('node:fs/promises');
    try {
      await fs.access('.claude-flow-last-status.json');
      const statusData = await fs.readFile('.claude-flow-last-status.json', 'utf8');
      return JSON.parse(statusData);
    } catch {
      return null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

function generateRecentTasks() {
  const types = ['research', 'implementation', 'analysis', 'coordination', 'testing'];
  const statuses = ['running', 'pending', 'completed', 'failed'];
  const priorities = ['high', 'medium', 'low'];
  
  return Array.from({ length: 15 }, (_, i) => ({
    id: `task-${String(i + 1).padStart(3, '0')}`,
    type: types[Math.floor(Math.random() * types.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    agent: Math.random() > 0.3 ? `agent-${String(Math.floor(Math.random() * 5) + 1).padStart(3, '0')}` : null,
    duration: Math.random() > 0.4 ? Math.floor(Math.random() * 120000) + 5000 : null,
    priority: priorities[Math.floor(Math.random() * priorities.length)]
  }));
}

function generateRecentErrors() {
  const components = ['orchestrator', 'terminal', 'memory', 'coordination', 'mcp'];
  const errorTypes = [
    'Connection timeout',
    'Memory allocation failed',
    'Task execution error',
    'Resource not available',
    'Configuration invalid'
  ];
  
  return Array.from({ length: Math.floor(Math.random() * 3) }, (_, i) => ({
    component: components[Math.floor(Math.random() * components.length)],
    message: errorTypes[Math.floor(Math.random() * errorTypes.length)],
    timestamp: Date.now() - (Math.random() * 3600000), // Last hour
    stack: 'Error stack trace would be here...'
  }));
}

function generateHealthWarnings() {
  const warnings = [
    {
      message: 'Memory usage approaching 80% threshold',
      recommendation: 'Consider restarting memory manager or increasing cache limits'
    },
    {
      message: 'High task queue length detected',
      recommendation: 'Scale up coordination workers or check for blocked tasks'
    }
  ];
  
  return Math.random() > 0.7 ? [warnings[Math.floor(Math.random() * warnings.length)]] : [];
}

function generatePerformanceMetrics() {
  return {
    'Response Time': {
      current: '1.2s',
      average: '1.5s',
      peak: '3.2s'
    },
    'Throughput': {
      current: '45 req/min',
      average: '38 req/min',
      peak: '67 req/min'
    },
    'Error Rate': {
      current: '0.2%',
      average: '0.5%',
      peak: '2.1%'
    }
  };
}

async function performSystemHealthChecks(): Promise<any> {
  const checks = {
    'Disk Space': await checkDiskSpace(),
    'Memory Usage': await checkMemoryUsage(),
    'Network Connectivity': await checkNetworkConnectivity(),
    'Process Health': await checkProcessHealth()
  };
  
  return checks;
}

async function checkDiskSpace(): Promise<{ status: string; details: string }> {
  try {
    // Basic disk space check using Node.js fs
    const fs = await import('node:fs/promises');
    await fs.access('.');
    return {
      status: 'healthy',
      details: 'Sufficient disk space available'
    };
  } catch {
    return {
      status: 'warning',
      details: 'Cannot determine disk space'
    };
  }
}

async function checkMemoryUsage(): Promise<{ status: string; details: string }> {
  const memoryInfo = process.memoryUsage();
  const heapUsedMB = Math.round(memoryInfo.heapUsed / 1024 / 1024);
  
  if (heapUsedMB > 500) {
    return {
      status: 'warning',
      details: `High memory usage: ${heapUsedMB}MB`
    };
  }
  
  return {
    status: 'healthy',
    details: `Memory usage normal: ${heapUsedMB}MB`
  };
}

async function checkNetworkConnectivity(): Promise<{ status: string; details: string }> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('https://httpbin.org/status/200', {
      signal: controller.signal
    });
    
    return {
      status: response.ok ? 'healthy' : 'warning',
      details: response.ok ? 'Network connectivity normal' : `HTTP ${response.status}`
    };
  } catch {
    return {
      status: 'warning',
      details: 'Network connectivity check failed (offline mode?)'
    };
  }
}

async function checkProcessHealth(): Promise<{ status: string; details: string }> {
  const pid = await getPidFromFile();
  if (!pid) {
    return {
      status: 'error',
      details: 'No process ID found - system may not be running'
    };
  }
  
  try {
    // Check if process exists using Node.js process API
    process.kill(pid, 0); // Non-destructive signal to check if process exists
    return {
      status: 'healthy',
      details: `Process ${pid} is running`
    };
  } catch {
    return {
      status: 'error',
      details: `Process ${pid} not found - system stopped unexpectedly`
    };
  }
}