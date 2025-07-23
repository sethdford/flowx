/**
 * System Status Command
 * Provides comprehensive system status information
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, formatDuration, formatRelativeTime, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getPersistenceManager, getMemoryManager } from '../../core/global-initialization.js';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import * as os from 'os';

export const statusCommand: CLICommand = {
  name: 'status',
  description: 'Show comprehensive system status',
  category: 'System',
  usage: 'flowx status [OPTIONS]',
  examples: [
    'flowx status',
    'flowx status --detailed',
    'flowx status --services',
    'flowx status --agents'
  ],
  options: [
    {
      name: 'detailed',
      short: 'd',
      description: 'Show detailed system information',
      type: 'boolean'
    },
    {
      name: 'services',
      short: 's',
      description: 'Show only service status',
      type: 'boolean'
    },
    {
      name: 'agents',
      short: 'a',
      description: 'Show only agent status',
      type: 'boolean'
    },
    {
      name: 'swarms',
      description: 'Show only swarm status',
      type: 'boolean'
    },
    {
      name: 'resources',
      short: 'r',
      description: 'Show only resource usage',
      type: 'boolean'
    },
    {
      name: 'json',
      short: 'j',
      description: 'Output in JSON format',
      type: 'boolean'
    },
    {
      name: 'watch',
      short: 'w',
      description: 'Watch mode (refresh every 5 seconds)',
      type: 'boolean'
    }
  ],
  handler: async (context: CLIContext) => {
    const { options } = context;
    
    try {
      if (options.watch) {
        await watchMode(options);
        return;
      }
      
      const status = await getSystemStatus(options.detailed);
      
      if (options.tson) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }
      
      await displaySystemStatus(status, options);
      
    } catch (error) {
      printError(`Failed to get system status: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
};

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  pid?: number;
  uptime?: number;
  memory?: number;
  cpu?: number;
  port?: number;
  lastCheck: Date;
}

interface ProcessStatus {
  name: string;
  pid: number;
  status: 'running' | 'zombie' | 'stopped';
  cpu: number;
  memory: number;
  uptime: number;
  command: string;
}

interface ResourceStatus {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
}

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  services: number;
  agents: number;
  issues: string[];
}

interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: string;
  uptime: number;
  tasksCompleted: number;
  currentTask?: string;
  lastActivity: Date;
}

interface SwarmStatus {
  id: string;
  name: string;
  status: string;
  agents: number;
  activeTasks: number;
  completedTasks: number;
  uptime: number;
  coordinator: string;
}

interface SystemStatus {
  timestamp: Date;
  uptime: number;
  services: ServiceStatus[];
  processes: ProcessStatus[];
  resources: ResourceStatus;
  health: HealthStatus;
  agents?: AgentStatus[];
  swarms?: SwarmStatus[];
}

async function getSystemStatus(detailed: boolean = false): Promise<SystemStatus> {
  const status: SystemStatus = {
    timestamp: new Date(),
    uptime: process.uptime() * 1000,
    services: await getServiceStatuses(),
    processes: await getProcessStatuses(),
    resources: await getResourceStatus(),
    health: await getHealthStatus()
  };

  if (detailed) {
    status.agents = await getAgentStatuses();
    status.swarms = await getSwarmStatuses();
  }

  return status;
}

async function getServiceStatuses(): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = [];
  
  // Check for actual FlowX processes
  const flowxProcesses = await findFlowXProcesses();
  
  for (const proc of flowxProcesses) {
    services.push({
      name: proc.name,
      status: 'running',
      pid: proc.pid,
      uptime: proc.uptime,
      memory: proc.memory,
      cpu: proc.cpu,
      lastCheck: new Date()
    });
  }
  
  // Check MCP server if configured
  const mcpStatus = await checkMCPServer();
  if (mcpStatus) {
    services.push(mcpStatus);
  }
  
  return services;
}

async function findFlowXProcesses(): Promise<ProcessStatus[]> {
  try {
    // Use ps to find Node.ts processes related to flowx
    const psOutput = execSync('ps aux | grep -E "(flowx|node.*cli\\.ts)" | grep -v grep', { encoding: 'utf8' });
    const lines = psOutput.trim().split('\n').filter(line => line.length > 0);
    
    const processes: ProcessStatus[] = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        const pid = parseInt(parts[1]);
        const cpu = parseFloat(parts[2]);
        const memory = parseFloat(parts[3]) * 1024 * 1024; // Convert to bytes
        const command = parts.slice(10).join(' ');
        
        // Determine process name
        let name = 'flowx';
        if (command.includes('agent-')) {
          name = 'flowx-agent';
        } else if (command.includes('swarm')) {
          name = 'flowx-swarm';
        } else if (command.includes('mcp')) {
          name = 'flowx-mcp';
        }
        
        processes.push({
          name,
          pid,
          status: 'running',
          cpu,
          memory,
          uptime: 0, // Would need more complex logic to get actual uptime
          command
        });
      }
    }
    
    return processes;
  } catch (error) {
    // If ps command fails, return empty array
    return [];
  }
}

async function checkMCPServer(): Promise<ServiceStatus | null> {
  try {
    // Check if MCP config exists
    const mcpConfigPath = './mcp_config/mcp.tson';
    if (!existsSync(mcpConfigPath)) {
      return null;
    }
    
    const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
    const port = mcpConfig.port || 3000;
    
    // Try to check if port is in use
    try {
      execSync(`lsof -i :${port}`, { stdio: 'pipe' });
      return {
        name: 'mcp-server',
        status: 'running',
        port,
        lastCheck: new Date()
      };
    } catch {
      return {
        name: 'mcp-server',
        status: 'stopped',
        port,
        lastCheck: new Date()
      };
    }
  } catch (error) {
    return null;
  }
}

async function getProcessStatuses(): Promise<ProcessStatus[]> {
  return await findFlowXProcesses();
}

async function getResourceStatus(): Promise<ResourceStatus> {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Get disk usage (Unix-like systems)
    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;
    
    try {
      // Use different df command for macOS vs Linux
      const dfCommand = process.platform === 'darwin' ? 'df -k / | tail -1' : 'df -B1 / | tail -1';
      const dfOutput = execSync(dfCommand, { encoding: 'utf8' });
      const dfParts = dfOutput.trim().split(/\s+/);
      if (dfParts.length >= 4) {
        if (process.platform === 'darwin') {
          // macOS df returns KB, convert to bytes
          diskTotal = parseInt(dfParts[1]) * 1024;
          diskUsed = parseInt(dfParts[2]) * 1024;
          diskFree = parseInt(dfParts[3]) * 1024;
        } else {
          diskTotal = parseInt(dfParts[1]);
          diskUsed = parseInt(dfParts[2]);
          diskFree = parseInt(dfParts[3]);
        }
      }
    } catch {
      // Fallback values if df command fails
      diskTotal = 1024 * 1024 * 1024 * 1024; // 1TB
      diskUsed = diskTotal * 0.5; // 50% used
      diskFree = diskTotal - diskUsed;
    }
    
    // Get network stats (simplified)
    let networkBytesIn = 0;
    let networkBytesOut = 0;
    
    try {
      if (process.platform === 'darwin') {
        const netstatOutput = execSync('netstat -ibn | grep -E "en[0-9]" | head -1', { encoding: 'utf8' });
        const netParts = netstatOutput.trim().split(/\s+/);
        if (netParts.length >= 7) {
          networkBytesIn = parseInt(netParts[6]) || 0;
          networkBytesOut = parseInt(netParts[9]) || 0;
        }
      }
    } catch {
      // Fallback if network stats unavailable
    }
    
    return {
      cpu: {
        usage: await getCPUUsage(),
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown'
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usage: (usedMem / totalMem) * 100
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        free: diskFree,
        usage: diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0
      },
      network: {
        bytesIn: networkBytesIn,
        bytesOut: networkBytesOut,
        packetsIn: 0, // Would need more complex implementation
        packetsOut: 0
      }
    };
  } catch (error) {
    // Return basic fallback data
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      cpu: {
        usage: 0,
        cores: os.cpus().length,
        model: 'Unknown'
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usage: (usedMem / totalMem) * 100
      },
      disk: {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      }
    };
  }
}

async function getCPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime.bigint();
    
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const endTime = process.hrtime.bigint();
      
      const elapsedTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const totalCPUTime = (endUsage.user + endUsage.system) / 1000; // Convert to milliseconds
      
      const cpuPercent = (totalCPUTime / elapsedTime) * 100;
      resolve(Math.min(cpuPercent, 100)); // Cap at 100%
    }, 100);
  });
}

async function getHealthStatus(): Promise<HealthStatus> {
  const issues: string[] = [];
  let serviceCount = 0;
  let agentCount = 0;
  
  try {
    // Check services
    const services = await getServiceStatuses();
    serviceCount = services.length;
    const failedServices = services.filter(s => s.status !== 'running');
    if (failedServices.length > 0) {
      issues.push(`${failedServices.length} service(s) not running`);
    }
    
    // Check agents
    const persistenceManager = await getPersistenceManager();
    const agents = await persistenceManager.getActiveAgents();
    agentCount = agents.length;
    
    // Check memory system
    const memoryManager = await getMemoryManager();
    const memoryHealth = await memoryManager.getHealthStatus();
    if (!memoryHealth.healthy) {
      issues.push(`Memory system unhealthy: ${memoryHealth.error || 'Unknown error'}`);
    }
    if (memoryHealth.metrics?.corruptedEntries && memoryHealth.metrics.corruptedEntries > 0) {
      issues.push(`${memoryHealth.metrics.corruptedEntries} corrupted memory entries detected`);
    }
    if (memoryHealth.metrics?.expiredEntries && memoryHealth.metrics.expiredEntries > 10) {
      issues.push(`${memoryHealth.metrics.expiredEntries} expired memory entries need cleanup`);
    }
    
    // Check disk space
    const resources = await getResourceStatus();
    if (resources.disk.usage > 90) {
      issues.push('Disk usage above 90%');
    }
    if (resources.memory.usage > 90) {
      issues.push('Memory usage above 90%');
    }
    
  } catch (error) {
    issues.push('Health check failed: ' + (error instanceof Error ? error.message : String(error)));
  }
  
  let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (issues.length > 0) {
    overall = issues.some(issue => issue.includes('failed') || issue.includes('critical')) ? 'critical' : 'warning';
  }
  
  return {
    overall,
    services: serviceCount,
    agents: agentCount,
    issues
  };
}

async function getAgentStatuses(): Promise<AgentStatus[]> {
  try {
    const persistenceManager = await getPersistenceManager();
    const agents = await persistenceManager.getAllAgents();
    
    return agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      uptime: Date.now() - agent.createdAt,
      tasksCompleted: 0, // Would need task tracking system
      lastActivity: new Date(agent.createdAt)
    }));
  } catch (error) {
    return [];
  }
}

async function getSwarmStatuses(): Promise<SwarmStatus[]> {
  try {
    // This would connect to actual swarm coordinator
    // For now, return empty array since swarm system needs implementation
    return [];
  } catch (error) {
    return [];
  }
}

async function displaySystemStatus(status: SystemStatus, options: any): Promise<void> {
  console.log(successBold('\n🚀 FlowX System Status\n'));
  
  // Health overview
  const healthColor = status.health.overall === 'healthy' ? successBold : 
                     status.health.overall === 'warning' ? warningBold : errorBold;
  console.log(`Overall Health: ${healthColor(status.health.overall.toUpperCase())}`);
  console.log(`System Uptime: ${formatUptime(status.uptime)}`);
  console.log(`Last Check: ${status.timestamp.toLocaleString()}\n`);
  
  if (status.health.issues.length > 0) {
    console.log(warningBold('⚠️  Issues Detected:'));
    status.health.issues.forEach(issue => console.log(`  • ${issue}`));
    console.log();
  }
  
  // Services
  if (!options.agents && !options.swarms && !options.resources) {
    if (status.services.length > 0) {
      console.log(infoBold('📊 Services:'));
      const serviceTable = formatTable(status.services, [
        { header: 'Service', key: 'name' },
        { header: 'Status', key: 'status', formatter: (v) => getStatusColor(String(v || 'unknown')) },
        { header: 'PID', key: 'pid', formatter: (v) => v ? String(v) : '-' },
        { header: 'Memory', key: 'memory', formatter: (v) => (v && typeof v === 'number') ? formatBytes(v) : '-' },
        { header: 'CPU %', key: 'cpu', formatter: (v) => (v && typeof v === 'number') ? v.toFixed(1) + '%' : '-' },
        { header: 'Port', key: 'port', formatter: (v) => v ? String(v) : '-' }
      ]);
      console.log(serviceTable);
      console.log();
    }
  }
  
  // Resources
  if (options.resources || options.detailed) {
    console.log(infoBold('💻 System Resources:'));
    console.log(`CPU: ${status.resources.cpu.usage.toFixed(1)}% (${status.resources.cpu.cores} cores)`);
    console.log(`Memory: ${formatBytes(status.resources.memory.used)} / ${formatBytes(status.resources.memory.total)} (${status.resources.memory.usage.toFixed(1)}%)`);
    console.log(`Disk: ${formatBytes(status.resources.disk.used)} / ${formatBytes(status.resources.disk.total)} (${status.resources.disk.usage.toFixed(1)}%)`);
    if (status.resources.network.bytesIn > 0 || status.resources.network.bytesOut > 0) {
      console.log(`Network: ↓${formatBytes(status.resources.network.bytesIn)} ↑${formatBytes(status.resources.network.bytesOut)}`);
    }
    console.log();
  }
  
  // Agents
  if ((options.agents || options.detailed) && status.agents && status.agents.length > 0) {
    console.log(infoBold('🤖 Agents:'));
    const agentTable = formatTable(status.agents, [
      { header: 'ID', key: 'id' },
      { header: 'Name', key: 'name' },
      { header: 'Type', key: 'type' },
      { header: 'Status', key: 'status', formatter: (v) => getStatusColor(String(v || 'unknown')) },
      { header: 'Uptime', key: 'uptime', formatter: (v) => (v && typeof v === 'number') ? formatUptime(v) : '-' }
    ]);
    console.log(agentTable);
    console.log();
  }
  
  // Swarms
  if ((options.swarms || options.detailed) && status.swarms && status.swarms.length > 0) {
    console.log(infoBold('🐝 Swarms:'));
    const swarmTable = formatTable(status.swarms, [
      { header: 'ID', key: 'id' },
      { header: 'Name', key: 'name' },
      { header: 'Status', key: 'status', formatter: (v) => getStatusColor(String(v || 'unknown')) },
      { header: 'Agents', key: 'agents', formatter: (v) => v ? String(v) : '0' },
      { header: 'Active Tasks', key: 'activeTasks', formatter: (v) => v ? String(v) : '0' }
    ]);
    console.log(swarmTable);
    console.log();
  }
  
  // Summary
  console.log(infoBold('📈 Summary:'));
  console.log(`  Services: ${status.services.length} running`);
  console.log(`  Agents: ${status.health.agents} active`);
  if (status.swarms) {
    console.log(`  Swarms: ${status.swarms.length} configured`);
  }
}

async function watchMode(options: any): Promise<void> {
  console.clear();
  printInfo('🔄 Watch mode enabled (Press Ctrl+C to exit)\n');
  
  const interval = setInterval(async () => {
    try {
      console.clear();
      printInfo('🔄 Watch mode - Refreshing every 5 seconds (Press Ctrl+C to exit)\n');
      
      const status = await getSystemStatus(options.detailed);
      await displaySystemStatus(status, options);
      
    } catch (error) {
      printError(`Error in watch mode: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 5000);
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.clear();
    printInfo('Watch mode stopped');
    process.exit(0);
  });
  
  // Initial display
  try {
    const status = await getSystemStatus(options.detailed);
    await displaySystemStatus(status, options);
  } catch (error) {
    printError(`Error getting initial status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper functions

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
    case 'active':
    case 'healthy':
      return successBold(status);
    case 'warning':
    case 'idle':
      return warningBold(status);
    case 'stopped':
    case 'error':
    case 'critical':
    case 'offline':
      return errorBold(status);
    default:
      return status;
  }
}

function formatUptime(milliseconds: number): string {
  if (!milliseconds || typeof milliseconds !== 'number' || isNaN(milliseconds)) {
    return '0s';
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (!bytes || typeof bytes !== 'number' || isNaN(bytes) || bytes === 0) {
    return '0 B';
  }
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default statusCommand; 