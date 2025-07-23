/**
 * Real-time Swarm Monitoring Command
 * Provides live monitoring and status updates for active swarms
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { printSuccess, printError, printWarning, printInfo, formatTable, TableColumn } from '../../core/output-formatter.js';
import { SwarmMonitor } from '../../../coordination/swarm-monitor.js';
import { generateId } from '../../../utils/helpers.js';

let monitoringInterval: NodeJS.Timeout | null = null;

export const swarmMonitorCommand: CLICommand = {
  name: 'monitor',
  description: 'Real-time monitoring of swarm status and performance',
  category: 'Swarm',
  usage: 'flowx swarm monitor [OPTIONS]',
  examples: [
    'flowx swarm monitor',
    'flowx swarm monitor --refresh 2000',
    'flowx swarm monitor --detailed',
    'flowx swarm monitor --export metrics.json'
  ],
  options: [
    {
      name: 'refresh',
      short: 'r',
      description: 'Refresh interval in milliseconds',
      type: 'number',
      default: 1000
    },
    {
      name: 'detailed',
      short: 'd',
      description: 'Show detailed metrics',
      type: 'boolean',
      default: false
    },
    {
      name: 'export',
      short: 'e',
      description: 'Export metrics to file',
      type: 'string'
    },
    {
      name: 'alerts',
      short: 'a',
      description: 'Show only alerts and warnings',
      type: 'boolean',
      default: false
    }
  ],
  handler: async (context: CLIContext) => {
    const { options } = context;
    
    try {
      await startRealTimeMonitoring(options);
    } catch (error) {
      printError(`Failed to start monitoring: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
};

async function startRealTimeMonitoring(options: any): Promise<void> {
  const refreshInterval = options.refresh || 1000;
  const detailed = options.detailed || false;
  const exportFile = options.export;
  const alertsOnly = options.alerts || false;
  
  printSuccess('🔍 Starting Real-Time Swarm Monitoring');
  printInfo(`📊 Refresh interval: ${refreshInterval}ms`);
  if (detailed) printInfo('📈 Detailed metrics enabled');
  if (exportFile) printInfo(`📁 Exporting to: ${exportFile}`);
  printInfo('🛑 Press Ctrl+C to stop monitoring');
  console.log();
  
  // Initialize swarm monitor
  const monitor = new SwarmMonitor({
    updateInterval: refreshInterval,
    enableAlerts: true,
    enableHistory: !!exportFile
  });
  
  // Track active swarms and agents
  const activeSwarms = new Map<string, any>();
  const swarmMetrics = new Map<string, any>();
  
  // Start monitoring active swarms
  await detectActiveSwarms(activeSwarms);
  
  // Set up real-time display
  monitoringInterval = setInterval(async () => {
    try {
      await updateMonitoringDisplay(monitor, activeSwarms, swarmMetrics, detailed, alertsOnly);
      
      if (exportFile) {
        await exportMetrics(monitor, exportFile);
      }
    } catch (error) {
      printError(`Monitoring error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, refreshInterval);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    stopMonitoring();
    process.exit(0);
  });
  
  // Keep the process running
  await new Promise(() => {}); // Run indefinitely until Ctrl+C
}

async function detectActiveSwarms(activeSwarms: Map<string, any>): Promise<void> {
  try {
    printInfo('🔍 Detecting active swarms...');
    
    // Check for swarm process files
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      const logsDir = './logs';
      const files = await fs.promises.readdir(logsDir);
      
      let swarmCount = 0;
      
      for (const file of files) {
        if (file.startsWith('swarm-') && file.endsWith('.json')) {
          try {
            const content = await fs.promises.readFile(path.join(logsDir, file), 'utf8');
            const swarmInfo = JSON.parse(content);
            
            activeSwarms.set(swarmInfo.id, {
              ...swarmInfo,
              configFile: file,
              detected: new Date()
            });
            
            swarmCount++;
          } catch (e) {
            // Ignore malformed files
          }
        }
      }
      
      if (swarmCount > 0) {
        printSuccess(`✅ Detected ${swarmCount} active swarm(s)`);
      } else {
        printWarning('⚠️ No active swarms detected');
        printInfo('💡 Start a swarm with: ./cli.js swarm "your objective"');
      }
      
    } catch (e) {
      printWarning('⚠️ No logs directory found - no active swarms detected');
    }
    
  } catch (error) {
    printWarning(`Warning: Could not detect active swarms: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function updateMonitoringDisplay(
  monitor: SwarmMonitor,
  activeSwarms: Map<string, any>,
  swarmMetrics: Map<string, any>,
  detailed: boolean,
  alertsOnly: boolean
): Promise<void> {
  // Clear screen for real-time updates
  console.clear();
  
  // Header
  console.log('🐝 FlowX Swarm Real-Time Monitor');
  console.log('='.repeat(80));
  console.log(`⏰ ${new Date().toLocaleTimeString()} | 🔄 Live Updates | 📊 Monitoring Active`);
  console.log();
  
  if (activeSwarms.size === 0) {
    printWarning('⚠️ No active swarms detected');
    printInfo('💡 Start a swarm with: ./cli.js swarm "your objective"');
    return;
  }
  
  // System overview
  const summary = monitor.getSummary();
  displaySystemOverview(summary);
  
  // Active swarms
  await displayActiveSwarms(activeSwarms, swarmMetrics, detailed);
  
  // Alerts (if any)
  const alerts = monitor.getAlerts(Date.now() - 3600000); // Last hour
  if (alerts.length > 0 || alertsOnly) {
    displayAlerts(alerts);
  }
  
  if (detailed) {
    displayDetailedMetrics(monitor);
  }
  
  console.log('─'.repeat(80));
  console.log('🛑 Press Ctrl+C to stop monitoring');
}

function displaySystemOverview(summary: any): void {
  console.log('📊 System Overview:');
  console.log(`  Uptime: ${formatDuration(summary.uptime)}`);
  console.log(`  Active Agents: ${summary.activeAgents}/${summary.totalAgents}`);
  console.log(`  Tasks: ${summary.completedTasks}/${summary.totalTasks} completed (${summary.successRate.toFixed(1)}% success)`);
  console.log(`  Throughput: ${summary.currentThroughput} tasks/min`);
  console.log(`  Active Alerts: ${summary.alerts}`);
  console.log();
}

async function displayActiveSwarms(
  activeSwarms: Map<string, any>,
  swarmMetrics: Map<string, any>,
  detailed: boolean
): Promise<void> {
  console.log('🐝 Active Swarms:');
  
  const swarmTable = [];
  
  for (const [swarmId, swarmInfo] of activeSwarms) {
    // Try to get live status
    let status = 'unknown';
    let progress = 0;
    let agents = 0;
    
    try {
      // Check if process is still running
      const isRunning = await checkSwarmProcess(swarmInfo.pid);
      status = isRunning ? 'running' : 'stopped';
      
      // Read log file for progress if available
      const logData = await parseSwarmLogs(swarmInfo.logFile);
      progress = logData.progress || 0;
      agents = logData.agentCount || 0;
      
    } catch (e) {
      status = 'error';
    }
    
    swarmTable.push({
      'Swarm ID': swarmId.substring(0, 16) + '...',
      'Objective': swarmInfo.objective?.substring(0, 30) + '...' || 'Unknown',
      'Strategy': swarmInfo.strategy || 'auto',
      'Status': getStatusColor(status),
      'Progress': `${progress}%`,
      'Agents': agents,
      'Runtime': formatDuration(Date.now() - new Date(swarmInfo.startTime).getTime())
    });
    
    swarmMetrics.set(swarmId, { status, progress, agents });
  }
  
  if (swarmTable.length > 0) {
    const columns: TableColumn[] = [
      { header: 'Swarm ID', key: 'Swarm ID' },
      { header: 'Objective', key: 'Objective' },
      { header: 'Strategy', key: 'Strategy' },
      { header: 'Status', key: 'Status' },
      { header: 'Progress', key: 'Progress' },
      { header: 'Agents', key: 'Agents' },
      { header: 'Runtime', key: 'Runtime' }
    ];
    console.log(formatTable(swarmTable, columns));
  } else {
    printWarning('  No active swarms found');
  }
  
  console.log();
}

function displayAlerts(alerts: any[]): void {
  if (alerts.length === 0) return;
  
  console.log('🚨 Recent Alerts:');
  
  for (const alert of alerts.slice(0, 5)) {
    const icon = alert.severity === 'critical' ? '🔴' : 
                 alert.severity === 'warning' ? '🟡' : '🔵';
    const time = new Date(alert.timestamp).toLocaleTimeString();
    console.log(`  ${icon} [${time}] ${alert.message}`);
  }
  
  console.log();
}

function displayDetailedMetrics(monitor: SwarmMonitor): void {
  console.log('📈 Detailed Metrics:');
  
  const systemMetrics = monitor.getSystemMetrics();
  if (systemMetrics) {
    console.log(`  CPU Usage: ${systemMetrics.cpuUsage.toFixed(1)}%`);
    console.log(`  Memory Usage: ${systemMetrics.memoryUsage.toFixed(1)}%`);
    console.log(`  Load Average: ${systemMetrics.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
    console.log(`  Active Processes: ${systemMetrics.activeAgents}`);
  }
  
  console.log();
}

async function checkSwarmProcess(pid: number): Promise<boolean> {
  try {
    // Check if process is running (cross-platform)
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function parseSwarmLogs(logFile?: string): Promise<{ progress: number; agentCount: number }> {
  if (!logFile) return { progress: 0, agentCount: 0 };
  
  try {
    const fs = await import('fs');
    const logContent = await fs.promises.readFile(logFile, 'utf8');
    
    // Parse log for progress indicators
    const lines = logContent.split('\n');
    let progress = 0;
    let agentCount = 0;
    
    for (const line of lines.reverse()) {
      // Look for progress indicators
      if (line.includes('Progress:') || line.includes('%')) {
        const match = line.match(/(\d+)%/);
        if (match) {
          progress = parseInt(match[1]);
          break;
        }
      }
      
      // Count agent spawning
      if (line.includes('agent_spawn') || line.includes('Agent spawned')) {
        agentCount++;
      }
    }
    
    return { progress, agentCount };
    
  } catch (e) {
    return { progress: 0, agentCount: 0 };
  }
}

async function exportMetrics(monitor: SwarmMonitor, fileName: string): Promise<void> {
  try {
    const fs = await import('fs');
    
    const metrics = {
      timestamp: new Date().toISOString(),
      summary: monitor.getSummary(),
      systemMetrics: monitor.getSystemMetrics(),
      agents: monitor.getAgentMetrics(),
      alerts: monitor.getAlerts()
    };
    
    await fs.promises.writeFile(fileName, JSON.stringify(metrics, null, 2));
    
  } catch (error) {
    printError(`Failed to export metrics: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function stopMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  console.log();
  printSuccess('✅ Monitoring stopped');
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return '🟢 Running';
    case 'completed':
      return '✅ Completed';
    case 'failed':
    case 'error':
      return '🔴 Error';
    case 'stopped':
      return '🟡 Stopped';
    default:
      return '⚪ Unknown';
  }
} 