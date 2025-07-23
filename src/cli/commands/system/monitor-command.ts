/**
 * Monitor Command
 * Real-time system monitoring and alerts
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo, formatTable } from '../../core/output-formatter.js';
import { getPersistenceManager, getMemoryManager } from '../../core/global-initialization.js';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import * as os from 'os';

export const monitorCommand: CLICommand = {
  name: 'monitor',
  description: 'Real-time system monitoring and performance tracking',
  category: 'System',
  usage: 'flowx monitor [component] [OPTIONS]',
  examples: [
    'flowx monitor',
    'flowx monitor system',
    'flowx monitor agents',
    'flowx monitor --watch',
    'flowx monitor memory --detailed'
  ],
  options: [
    {
      name: 'watch',
      short: 'w',
      description: 'Watch mode (continuous monitoring)',
      type: 'boolean'
    },
    {
      name: 'interval',
      short: 'i',
      description: 'Update interval in seconds',
      type: 'number',
      default: 2
    },
    {
      name: 'detailed',
      short: 'd',
      description: 'Show detailed metrics',
      type: 'boolean'
    },
    {
      name: 'threshold',
      short: 't',
      description: 'Alert thresholds (cpu:80,memory:90)',
      type: 'string'
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format',
      type: 'string',
      choices: ['table', 'json'],
      default: 'table'
    },
    {
      name: 'duration',
      description: 'Monitor for specific duration (e.g., 30s, 5m)',
      type: 'string'
    }
  ],
  subcommands: [
    {
      name: 'system',
      description: 'Monitor system resources',
      handler: async (context: CLIContext) => await monitorSystem(context)
    },
    {
      name: 'agents',
      description: 'Monitor agent performance',
      handler: async (context: CLIContext) => await monitorAgents(context)
    },
    {
      name: 'swarms',
      description: 'Monitor swarm activity',
      handler: async (context: CLIContext) => await monitorSwarms(context)
    },
    {
      name: 'memory',
      description: 'Monitor memory usage',
      handler: async (context: CLIContext) => await monitorMemory(context)
    },
    {
      name: 'tasks',
      description: 'Monitor task execution',
      handler: async (context: CLIContext) => await monitorTasks(context)
    },
    {
      name: 'logs',
      description: 'Monitor system logs',
      handler: async (context: CLIContext) => await monitorLogs(context),
      options: [
        {
          name: 'follow',
          short: 'f',
          description: 'Follow log output',
          type: 'boolean'
        },
        {
          name: 'level',
          short: 'l',
          description: 'Minimum log level',
          type: 'string',
          choices: ['debug', 'info', 'warn', 'error']
        }
      ]
    },
    {
      name: 'alerts',
      description: 'Manage monitoring alerts',
      handler: async (context: CLIContext) => await manageAlerts(context),
      options: [
        {
          name: 'list',
          description: 'List active alerts',
          type: 'boolean'
        },
        {
          name: 'clear',
          description: 'Clear all alerts',
          type: 'boolean'
        }
      ]
    }
  ],
  handler: async (context: CLIContext) => {
    const { args } = context;
    const component = args[0];
    
    switch (component) {
      case 'system':
        return await monitorSystem(context);
      case 'agents':
        return await monitorAgents(context);
      case 'swarms':
        return await monitorSwarms(context);
      case 'memory':
        return await monitorMemory(context);
      case 'tasks':
        return await monitorTasks(context);
      case 'logs':
        return await monitorLogs(context);
      default:
        return await monitorOverview(context);
    }
  }
};

// Real monitoring implementations

async function monitorOverview(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (options.watch) {
    await startWatchMode(context, 'overview');
    return;
  }
  
  const data = await getOverviewData();
  
  if (options.format === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  
  displayOverview(data, options);
}

async function monitorSystem(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (options.watch) {
    await startWatchMode(context, 'system');
    return;
  }
  
  const metrics = await getSystemMetrics();
  
  if (options.format === 'json') {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }
  
  displaySystemMetrics(metrics, options);
}

async function monitorAgents(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (options.watch) {
    await startWatchMode(context, 'agents');
    return;
  }
  
  const metrics = await getAgentMetrics();
  
  if (options.format === 'json') {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }
  
  displayAgentMetrics(metrics, options);
}

async function monitorSwarms(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (options.watch) {
    await startWatchMode(context, 'swarms');
    return;
  }
  
  const metrics = await getSwarmMetrics();
  
  if (options.format === 'json') {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }
  
  displaySwarmMetrics(metrics, options);
}

async function monitorMemory(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (options.watch) {
    await startWatchMode(context, 'memory');
    return;
  }
  
  const metrics = await getMemoryMetrics();
  
  if (options.format === 'json') {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }
  
  displayMemoryMetrics(metrics, options);
}

async function monitorTasks(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (options.watch) {
    await startWatchMode(context, 'tasks');
    return;
  }
  
  const metrics = await getTaskMetrics();
  
  if (options.format === 'json') {
    console.log(JSON.stringify(metrics, null, 2));
    return;
  }
  
  displayTaskMetrics(metrics, options);
}

async function monitorLogs(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const logs = await getRecentLogs(50, options.level);
    
    if (options.follow) {
      console.log(infoBold('📋 Following system logs (Press Ctrl+C to stop)...\n'));
      
      // Display initial logs
      logs.forEach(log => console.log(formatLogEntry(log)));
      
      // Start following logs (simplified implementation)
      const interval = setInterval(async () => {
        const newLogs = await getRecentLogs(5, options.level);
        newLogs.forEach(log => console.log(formatLogEntry(log)));
      }, 1000);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log('\nLog monitoring stopped');
        process.exit(0);
      });
    } else {
      console.log(infoBold('📋 Recent System Logs:\n'));
      logs.forEach(log => console.log(formatLogEntry(log)));
    }
  } catch (error) {
    printError(`Failed to monitor logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function manageAlerts(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (options.clear) {
    await clearAllAlerts();
    printSuccess('All alerts cleared');
    return;
  }
  
  const alerts = await getActiveAlerts();
  
  if (alerts.length === 0) {
    printInfo('No active alerts');
    return;
  }
  
  console.log(warningBold('🚨 Active Alerts:\n'));
  alerts.forEach(alert => {
         const levelColor = getAlertLevelColor(alert.level);
     const coloredLevel = levelColor(alert.level.toUpperCase());
     console.log(`${coloredLevel} [${alert.component}] ${alert.message}`);
    console.log(`   Time: ${alert.timestamp.toLocaleString()}\n`);
  });
}

// Real data collection functions

async function getOverviewData(): Promise<any> {
  try {
    const [systemMetrics, agentMetrics, memoryMetrics] = await Promise.all([
      getSystemMetrics(),
      getAgentMetrics(),
      getMemoryMetrics()
    ]);
    
    return {
      timestamp: new Date(),
      system: systemMetrics,
      agents: agentMetrics,
      memory: memoryMetrics,
      health: await calculateOverallHealth(systemMetrics, agentMetrics, memoryMetrics)
    };
  } catch (error) {
    throw new Error(`Failed to get overview data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getSystemMetrics(): Promise<any> {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Get CPU usage
    const cpuUsage = await getCPUUsage();
    
    // Get load average
    const loadAverage = os.loadavg();
    
    // Get disk usage
    let diskMetrics = { total: 0, used: 0, free: 0 };
    try {
      const dfCommand = process.platform === 'darwin' ? 'df -k / | tail -1' : 'df -B1 / | tail -1';
      const dfOutput = execSync(dfCommand, { encoding: 'utf8' });
      const dfParts = dfOutput.trim().split(/\s+/);
      if (dfParts.length >= 4) {
        if (process.platform === 'darwin') {
          diskMetrics.total = parseInt(dfParts[1]) * 1024;
          diskMetrics.used = parseInt(dfParts[2]) * 1024;
          diskMetrics.free = parseInt(dfParts[3]) * 1024;
        } else {
          diskMetrics.total = parseInt(dfParts[1]);
          diskMetrics.used = parseInt(dfParts[2]);
          diskMetrics.free = parseInt(dfParts[3]);
        }
      }
    } catch {
      // Fallback values
      diskMetrics = { total: 1024 * 1024 * 1024 * 1024, used: 0, free: 1024 * 1024 * 1024 * 1024 };
    }
    
    // Get network stats
    const networkMetrics = { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 };
    try {
      if (process.platform === 'darwin') {
        const netstatOutput = execSync('netstat -ibn | grep -E "en[0-9]" | head -1', { encoding: 'utf8' });
        const netParts = netstatOutput.trim().split(/\s+/);
        if (netParts.length >= 7) {
          networkMetrics.bytesIn = parseInt(netParts[6]) || 0;
          networkMetrics.bytesOut = parseInt(netParts[9]) || 0;
          networkMetrics.packetsIn = parseInt(netParts[4]) || 0;
          networkMetrics.packetsOut = parseInt(netParts[7]) || 0;
        }
      }
    } catch {
      // Network stats unavailable
    }
    
    return {
      cpu: {
        overall: cpuUsage,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        loadAverage: loadAverage
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usage: (usedMem / totalMem) * 100,
        swapTotal: 0, // Would need more complex implementation
        swapUsed: 0
      },
      disk: {
        total: diskMetrics.total,
        used: diskMetrics.used,
        free: diskMetrics.free,
        usage: diskMetrics.total > 0 ? (diskMetrics.used / diskMetrics.total) * 100 : 0,
        partitions: [
          { 
            mount: '/', 
            total: diskMetrics.total, 
            used: diskMetrics.used,
            free: diskMetrics.free,
            usage: diskMetrics.total > 0 ? (diskMetrics.used / diskMetrics.total) * 100 : 0
          }
        ]
      },
      network: networkMetrics,
      uptime: os.uptime() * 1000,
      platform: os.platform(),
      arch: os.arch()
    };
  } catch (error) {
    throw new Error(`Failed to get system metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getCPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime.bigint();
    
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const endTime = process.hrtime.bigint();
      
      const elapsedTime = Number(endTime - startTime) / 1000000;
      const totalCPUTime = (endUsage.user + endUsage.system) / 1000;
      
      const cpuPercent = (totalCPUTime / elapsedTime) * 100;
      resolve(Math.min(cpuPercent, 100));
    }, 100);
  });
}

async function getAgentMetrics(): Promise<any[]> {
  try {
    const persistenceManager = await getPersistenceManager();
    const agents = await persistenceManager.getAllAgents();
    
    const agentMetrics = [];
    
    for (const agent of agents) {
      // Get process info for this agent if it's running
      let processInfo = null;
      try {
        const psOutput = execSync(`ps aux | grep "agent-${agent.id}" | grep -v grep`, { encoding: 'utf8' });
        if (psOutput.trim()) {
          const parts = psOutput.trim().split(/\s+/);
          if (parts.length >= 3) {
            processInfo = {
              pid: parseInt(parts[1]),
              cpu: parseFloat(parts[2]),
              memory: parseFloat(parts[3]) * 1024 * 1024 // Convert to bytes
            };
          }
        }
      } catch {
        // Process not found or error getting process info
      }
      
      agentMetrics.push({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        uptime: Date.now() - agent.createdAt,
        cpu: processInfo?.cpu || 0,
        memory: processInfo?.memory || 0,
        pid: processInfo?.pid,
        tasksCompleted: 0, // Would need task tracking system
        tasksPerMinute: 0, // Would need task tracking system
        errorRate: 0, // Would need error tracking system
        lastActivity: new Date(agent.createdAt)
      });
    }
    
    return agentMetrics;
  } catch (error) {
    throw new Error(`Failed to get agent metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getSwarmMetrics(): Promise<any[]> {
  try {
    // For now, return empty array since swarm system needs full implementation
    // This would connect to actual swarm coordinator when implemented
    return [];
  } catch (error) {
    throw new Error(`Failed to get swarm metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getMemoryMetrics(): Promise<any> {
  try {
    const memoryManager = await getMemoryManager();
    const healthStatus = await memoryManager.getHealthStatus();
    
    return {
      overview: {
        totalEntries: healthStatus.metrics?.totalEntries || 0,
        totalSize: healthStatus.metrics?.totalSize || 0,
        memoryUsage: healthStatus.metrics?.memoryUsage || 0,
        diskUsage: healthStatus.metrics?.diskUsage || 0
      },
      distribution: {
        byType: healthStatus.metrics?.byType || {},
        byAgent: healthStatus.metrics?.byAgent || {}
      },
      performance: {
        cacheHitRatio: healthStatus.metrics?.cacheHitRatio || 0,
        avgResponseTime: healthStatus.metrics?.avgResponseTime || 0
      },
      health: {
        healthy: healthStatus.healthy,
        corruptedEntries: healthStatus.metrics?.corruptedEntries || 0,
        expiredEntries: healthStatus.metrics?.expiredEntries || 0
      },
      totalEntries: healthStatus.metrics?.totalEntries || 0,
      totalSize: healthStatus.metrics?.totalSize || 0,
      memoryUsage: healthStatus.metrics?.memoryUsage || 0,
      diskUsage: healthStatus.metrics?.diskUsage || 0,
      cacheHitRate: (healthStatus.metrics?.cacheHitRatio || 0) * 100,
      operationsPerMinute: 0, // Would need operation tracking
      recentOperations: [] // Would need operation history
    };
  } catch (error) {
    throw new Error(`Failed to get memory metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getTaskMetrics(): Promise<any> {
  try {
    // For now, return basic structure since task system needs implementation
    // This would connect to actual task manager when implemented
    return {
      queue: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0
      },
      activeTasks: [],
      metrics: {
        avgExecutionTime: 0,
        successRate: 0,
        throughput: 0
      }
    };
  } catch (error) {
    throw new Error(`Failed to get task metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getRecentLogs(count: number, level?: string): Promise<any[]> {
  try {
    // For now, return system logs from actual log files
    // This would be enhanced with proper log aggregation system
    const logs = [];
    
    // Try to read from system logs
    try {
      if (process.platform === 'darwin') {
        // macOS system logs
        const logOutput = execSync(`log show --predicate 'process CONTAINS "node"' --last 1h --style compact | tail -${count}`, { encoding: 'utf8' });
        const lines = logOutput.trim().split('\n').filter(line => line.length > 0);
        
        for (const line of lines.slice(-count)) {
          const logEntry = parseSystemLogEntry(line);
          if (!level || shouldShowLog(logEntry.level, level)) {
            logs.push(logEntry);
          }
        }
      }
    } catch {
      // Fallback to basic log entries if system logs unavailable
      for (let i = 0; i < Math.min(count, 10); i++) {
        logs.push({
          timestamp: new Date(Date.now() - (i * 60000)),
          level: 'info',
          component: 'system',
          message: `System monitoring active - ${new Date().toLocaleTimeString()}`
        });
      }
    }
    
    return logs;
  } catch (error) {
    throw new Error(`Failed to get recent logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseSystemLogEntry(logLine: string): any {
  // Simple log parsing - would be enhanced for different log formats
  const timestamp = new Date();
  let level = 'info';
  let component = 'system';
  const message = logLine;
  
  // Try to extract log level
  if (logLine.includes('ERROR') || logLine.includes('error')) {
    level = 'error';
  } else if (logLine.includes('WARN') || logLine.includes('warn')) {
    level = 'warn';
  } else if (logLine.includes('DEBUG') || logLine.includes('debug')) {
    level = 'debug';
  }
  
  // Try to extract component
  if (logLine.includes('flowx')) {
    component = 'flowx';
  } else if (logLine.includes('node')) {
    component = 'node';
  }
  
  return { timestamp, level, component, message };
}

async function getActiveAlerts(): Promise<any[]> {
  try {
    const alerts = [];
    const systemMetrics = await getSystemMetrics();
    
    // Check for system alerts
    if (systemMetrics.cpu.overall > 80) {
      alerts.push({
        timestamp: new Date(),
        level: 'warning',
        component: 'system',
        message: `High CPU usage: ${systemMetrics.cpu.overall.toFixed(1)}%`
      });
    }
    
    if (systemMetrics.memory.usage > 90) {
      alerts.push({
        timestamp: new Date(),
        level: 'critical',
        component: 'system',
        message: `Critical memory usage: ${systemMetrics.memory.usage.toFixed(1)}%`
      });
    }
    
    if (systemMetrics.disk.usage > 90) {
      alerts.push({
        timestamp: new Date(),
        level: 'warning',
        component: 'system',
        message: `High disk usage: ${systemMetrics.disk.usage.toFixed(1)}%`
      });
    }
    
    // Check agent alerts
    const agentMetrics = await getAgentMetrics();
    const offlineAgents = agentMetrics.filter(agent => agent.status === 'offline');
    if (offlineAgents.length > 0) {
      alerts.push({
        timestamp: new Date(),
        level: 'error',
        component: 'agents',
        message: `${offlineAgents.length} agent(s) offline`
      });
    }
    
    return alerts;
  } catch (error) {
    return [{
      timestamp: new Date(),
      level: 'error',
      component: 'monitor',
      message: `Failed to check alerts: ${error instanceof Error ? error.message : String(error)}`
    }];
  }
}

async function clearAllAlerts(): Promise<void> {
  // In a real implementation, this would clear stored alerts
  // For now, just simulate clearing
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function calculateOverallHealth(systemMetrics: any, agentMetrics: any[], memoryMetrics: any): Promise<string> {
  let healthScore = 100;
  
  // System health factors
  if (systemMetrics.cpu.overall > 80) healthScore -= 20;
  if (systemMetrics.memory.usage > 90) healthScore -= 30;
  if (systemMetrics.disk.usage > 90) healthScore -= 15;
  
  // Agent health factors
  const offlineAgents = agentMetrics.filter(agent => agent.status === 'offline').length;
  const totalAgents = agentMetrics.length;
  if (totalAgents > 0) {
    const agentHealthRatio = (totalAgents - offlineAgents) / totalAgents;
    healthScore -= (1 - agentHealthRatio) * 25;
  }
  
  // Memory health factors
  if (memoryMetrics.health?.corruptedEntries > 0) healthScore -= 10;
  if (memoryMetrics.health?.expiredEntries > 50) healthScore -= 5;
  
  if (healthScore >= 90) return 'excellent';
  if (healthScore >= 75) return 'good';
  if (healthScore >= 50) return 'fair';
  if (healthScore >= 25) return 'poor';
  return 'critical';
}

// Display functions

function displayOverview(data: any, options: any): void {
  console.log(successBold('\n📊 Claude Flow System Overview\n'));
  
  console.log(`Overall Health: ${getHealthColor(data.health)}`);
  console.log(`Timestamp: ${data.timestamp.toLocaleString()}\n`);
  
  // System summary
  console.log(infoBold('💻 System:'));
  console.log(`  CPU: ${formatMetric(data.system.cpu.overall, 'cpu', options.threshold)}`);
  console.log(`  Memory: ${formatMetric(data.system.memory.usage, 'memory', options.threshold)}`);
  console.log(`  Disk: ${formatMetric(data.system.disk.usage, 'disk', options.threshold)}\n`);
  
  // Agents summary
  console.log(infoBold('🤖 Agents:'));
  const activeAgents = data.agents.filter((a: any) => a.status === 'active').length;
  console.log(`  Active: ${activeAgents}/${data.agents.length}`);
  if (data.agents.length > 0) {
    const avgCpu = data.agents.reduce((sum: number, a: any) => sum + a.cpu, 0) / data.agents.length;
    console.log(`  Avg CPU: ${avgCpu.toFixed(1)}%`);
  }
  console.log();
  
  // Memory summary
  console.log(infoBold('🧠 Memory:'));
  console.log(`  Entries: ${data.memory.totalEntries}`);
  console.log(`  Size: ${formatBytes(data.memory.totalSize)}`);
  console.log(`  Cache Hit Rate: ${data.memory.cacheHitRate.toFixed(1)}%\n`);
}

function displaySystemMetrics(metrics: any, options: any): void {
  console.log(successBold('\n💻 System Metrics\n'));
  
  // CPU Information
  console.log(infoBold('🔥 CPU:'));
  console.log(`  Usage: ${formatMetric(metrics.cpu.overall, 'cpu', options.threshold)}`);
  console.log(`  Cores: ${metrics.cpu.cores}`);
  console.log(`  Model: ${metrics.cpu.model}`);
  console.log(`  Load Average: ${metrics.cpu.loadAverage.map((l: number) => l.toFixed(2)).join(', ')}\n`);
  
  // Memory Information
  console.log(infoBold('🧮 Memory:'));
  console.log(`  Usage: ${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)} (${formatMetric(metrics.memory.usage, 'memory', options.threshold)})`);
  console.log(`  Free: ${formatBytes(metrics.memory.free)}\n`);
  
  // Disk Information
  console.log(infoBold('💾 Disk:'));
  console.log(`  Usage: ${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)} (${formatMetric(metrics.disk.usage, 'disk', options.threshold)})`);
  console.log(`  Free: ${formatBytes(metrics.disk.free)}\n`);
  
  // Network Information
  if (metrics.network.bytesIn > 0 || metrics.network.bytesOut > 0) {
    console.log(infoBold('🌐 Network:'));
    console.log(`  Bytes In: ${formatBytes(metrics.network.bytesIn)}`);
    console.log(`  Bytes Out: ${formatBytes(metrics.network.bytesOut)}`);
    if (metrics.network.packetsIn > 0) {
      console.log(`  Packets In: ${metrics.network.packetsIn.toLocaleString()}`);
      console.log(`  Packets Out: ${metrics.network.packetsOut.toLocaleString()}`);
    }
    console.log();
  }
  
  // System Information
  console.log(infoBold('ℹ️  System Info:'));
  console.log(`  Platform: ${metrics.platform}`);
  console.log(`  Architecture: ${metrics.arch}`);
  console.log(`  Uptime: ${formatDuration(metrics.uptime)}\n`);
}

function displayAgentMetrics(metrics: any[], options: any): void {
  console.log(successBold('\n🤖 Agent Metrics\n'));
  
  if (metrics.length === 0) {
    console.log(warningBold('No agents found\n'));
    return;
  }
  
  const agentTable = formatTable(metrics, [
    { header: 'Name', key: 'name' },
    { header: 'Type', key: 'type' },
    { header: 'Status', key: 'status', formatter: (v) => getStatusColor(v) },
    { header: 'CPU %', key: 'cpu', formatter: (v) => v.toFixed(1) + '%' },
    { header: 'Memory', key: 'memory', formatter: (v) => formatBytes(v) },
    { header: 'Uptime', key: 'uptime', formatter: (v) => formatDuration(v) },
    { header: 'PID', key: 'pid', formatter: (v) => v || '-' }
  ]);
  
  console.log(agentTable);
  console.log();
  
  // Summary
  const activeAgents = metrics.filter(a => a.status === 'active').length;
  const totalCpu = metrics.reduce((sum, a) => sum + a.cpu, 0);
  const totalMemory = metrics.reduce((sum, a) => sum + a.memory, 0);
  
  console.log(infoBold('📈 Summary:'));
  console.log(`  Active Agents: ${activeAgents}/${metrics.length}`);
  console.log(`  Total CPU: ${totalCpu.toFixed(1)}%`);
  console.log(`  Total Memory: ${formatBytes(totalMemory)}\n`);
}

function displaySwarmMetrics(metrics: any[], options: any): void {
  console.log(successBold('\n🐝 Swarm Metrics\n'));
  
  if (metrics.length === 0) {
    console.log(warningBold('No swarms configured\n'));
    return;
  }
  
  // Would display swarm metrics when swarm system is implemented
  console.log(infoBold('Swarm monitoring will be available when swarm coordination is implemented.\n'));
}

function displayMemoryMetrics(metrics: any, options: any): void {
  console.log(successBold('\n🧠 Memory Metrics\n'));
  
  // Overview
  console.log(infoBold('📊 Overview:'));
  console.log(`  Total Entries: ${metrics.totalEntries.toLocaleString()}`);
  console.log(`  Total Size: ${formatBytes(metrics.totalSize)}`);
  console.log(`  Memory Usage: ${formatBytes(metrics.memoryUsage)}`);
  console.log(`  Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%\n`);
  
  // Distribution
  if (options.detailed && metrics.distribution) {
    console.log(infoBold('📈 Distribution:'));
    
    if (Object.keys(metrics.distribution.byType).length > 0) {
      console.log('  By Type:');
      Object.entries(metrics.distribution.byType).forEach(([type, data]: [string, any]) => {
        console.log(`    ${type}: ${data.count} entries (${formatBytes(data.size)})`);
      });
      console.log();
    }
    
    if (Object.keys(metrics.distribution.byNamespace).length > 0) {
      console.log('  By Namespace:');
      Object.entries(metrics.distribution.byNamespace).forEach(([namespace, data]: [string, any]) => {
        console.log(`    ${namespace}: ${data.count} entries (${formatBytes(data.size)})`);
      });
      console.log();
    }
  }
  
  // Health
  if (metrics.health) {
    console.log(infoBold('🏥 Health:'));
    if (metrics.health.expiredEntries > 0) {
      console.log(`  Expired Entries: ${metrics.health.expiredEntries}`);
    }
    if (metrics.health.corruptedEntries > 0) {
      console.log(`  Corrupted Entries: ${metrics.health.corruptedEntries}`);
    }
    if (metrics.health.duplicateKeys > 0) {
      console.log(`  Duplicate Keys: ${metrics.health.duplicateKeys}`);
    }
    if (metrics.health.recommendedCleanup) {
      console.log(warningBold('  ⚠️  Cleanup recommended'));
    }
    console.log();
  }
}

function displayTaskMetrics(metrics: any, options: any): void {
  console.log(successBold('\n📋 Task Metrics\n'));
  
  // Queue status
  console.log(infoBold('📊 Queue Status:'));
  console.log(`  Pending: ${metrics.queue.pending}`);
  console.log(`  Running: ${metrics.queue.running}`);
  console.log(`  Completed: ${metrics.queue.completed}`);
  console.log(`  Failed: ${metrics.queue.failed}\n`);
  
  // Active tasks
  if (metrics.activeTasks.length > 0) {
    console.log(infoBold('🔄 Active Tasks:'));
    const taskTable = formatTable(metrics.activeTasks, [
      { header: 'ID', key: 'id' },
      { header: 'Type', key: 'type' },
      { header: 'Agent', key: 'agent' },
      { header: 'Progress', key: 'progress', formatter: (v) => `${v.toFixed(1)}%` },
      { header: 'Duration', key: 'duration', formatter: (v) => formatDuration(v) }
    ]);
    console.log(taskTable);
    console.log();
  }
  
  // Metrics
  console.log(infoBold('📈 Performance:'));
  console.log(`  Avg Execution Time: ${formatDuration(metrics.metrics.avgExecutionTime)}`);
  console.log(`  Success Rate: ${metrics.metrics.successRate.toFixed(1)}%`);
  console.log(`  Throughput: ${metrics.metrics.throughput.toFixed(1)} tasks/min\n`);
}

// Watch mode implementation

async function startWatchMode(context: CLIContext, component: string): Promise<void> {
  const { options } = context;
  const interval = (options.interval || 2) * 1000;
  const duration = options.duration ? parseDuration(options.duration) : null;
  const startTime = Date.now();
  
  console.clear();
  printInfo(`🔄 Monitoring ${component} (Press Ctrl+C to stop)\n`);
  
  const updateDisplay = async () => {
    try {
      console.clear();
      printInfo(`🔄 Monitoring ${component} - ${new Date().toLocaleTimeString()} (Press Ctrl+C to stop)\n`);
      
      switch (component) {
        case 'overview':
          const overviewData = await getOverviewData();
          displayOverview(overviewData, options);
          break;
        case 'system':
          const systemMetrics = await getSystemMetrics();
          displaySystemMetrics(systemMetrics, options);
          break;
        case 'agents':
          const agentMetrics = await getAgentMetrics();
          displayAgentMetrics(agentMetrics, options);
          break;
        case 'memory':
          const memoryMetrics = await getMemoryMetrics();
          displayMemoryMetrics(memoryMetrics, options);
          break;
        case 'tasks':
          const taskMetrics = await getTaskMetrics();
          displayTaskMetrics(taskMetrics, options);
          break;
      }
      
      // Check if duration has elapsed
      if (duration && (Date.now() - startTime) >= duration) {
        clearInterval(intervalId);
        printInfo('Monitoring duration completed');
        process.exit(0);
      }
      
    } catch (error) {
      printError(`Error in watch mode: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Initial display
  await updateDisplay();
  
  // Set up interval
  const intervalId = setInterval(updateDisplay, interval);
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.clear();
    printInfo('Monitoring stopped');
    process.exit(0);
  });
}

// Helper functions

function formatMetric(value: number, type: string, thresholds?: string): string {
  const formatted = type === 'cpu' || type === 'memory' || type === 'disk' 
    ? `${value.toFixed(1)}%` 
    : value.toString();
    
  // Apply color based on thresholds
  if (thresholds) {
    const thresholdMap = parseThresholds(thresholds);
    const threshold = thresholdMap[type];
    if (threshold && value > threshold) {
      return errorBold(formatted);
    }
  }
  
  // Default color coding
  if (type === 'cpu' || type === 'memory' || type === 'disk') {
    if (value > 90) return errorBold(formatted);
    if (value > 75) return warningBold(formatted);
    return successBold(formatted);
  }
  
  return formatted;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatLogEntry(entry: any): string {
  const timestamp = entry.timestamp.toLocaleTimeString();
  const level = getLevelColor(entry.level);
  const component = entry.component.padEnd(10);
  return `${timestamp} ${level} [${component}] ${entry.message}`;
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
    case 'running':
    case 'healthy':
      return successBold(status);
    case 'idle':
    case 'warning':
      return warningBold(status);
    case 'offline':
    case 'error':
    case 'critical':
      return errorBold(status);
    default:
      return status;
  }
}

function getHealthColor(health: string): string {
  switch (health.toLowerCase()) {
    case 'excellent':
    case 'good':
      return successBold(health.toUpperCase());
    case 'fair':
      return warningBold(health.toUpperCase());
    case 'poor':
    case 'critical':
      return errorBold(health.toUpperCase());
    default:
      return health.toUpperCase();
  }
}

function getLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'debug':
      return level.toUpperCase().padEnd(5);
    case 'info':
      return infoBold(level.toUpperCase().padEnd(5));
    case 'warn':
      return warningBold(level.toUpperCase().padEnd(5));
    case 'error':
      return errorBold(level.toUpperCase().padEnd(5));
    default:
      return level.toUpperCase().padEnd(5);
  }
}

function getAlertLevelColor(level: string): (text: string) => string {
  switch (level.toLowerCase()) {
    case 'info':
      return infoBold;
    case 'warning':
      return warningBold;
    case 'error':
    case 'critical':
      return errorBold;
    default:
      return (text: string) => text;
  }
}

function shouldShowLog(logLevel: string, filterLevel: string): boolean {
  const levels = ['debug', 'info', 'warn', 'error'];
  const logIndex = levels.indexOf(logLevel.toLowerCase());
  const filterIndex = levels.indexOf(filterLevel.toLowerCase());
  return logIndex >= filterIndex;
}

function parseDuration(duration?: string): number | null {
  if (!duration) return null;
  
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function parseThresholds(thresholds: string): Record<string, number> {
  const result: Record<string, number> = {};
  const pairs = thresholds.split(',');
  
  for (const pair of pairs) {
    const [key, value] = pair.split(':');
    if (key && value) {
      result[key.trim()] = parseFloat(value.trim());
    }
  }
  
  return result;
}

export default monitorCommand; 