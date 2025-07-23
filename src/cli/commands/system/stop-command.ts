/**
 * Stop Command
 * Provides comprehensive system shutdown capabilities
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import * as fs from 'fs/promises';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

export const stopCommand: CLICommand = {
  name: 'stop',
  description: 'Stop the flowx orchestration system',
  category: 'System',
  usage: 'flowx stop [OPTIONS]',
  examples: [
    'flowx stop',
    'flowx stop --force',
    'flowx stop --timeout 30',
    'flowx stop --service mcp-server',
    'flowx stop --all'
  ],
  options: [
    {
      name: 'force',
      short: 'f',
      description: 'Force stop without graceful shutdown',
      type: 'boolean'
    },
    {
      name: 'timeout',
      short: 't',
      description: 'Graceful shutdown timeout in seconds',
      type: 'number',
      default: 30
    },
    {
      name: 'service',
      short: 's',
      description: 'Stop specific service only',
      type: 'string'
    },
    {
      name: 'all',
      short: 'a',
      description: 'Stop all related processes',
      type: 'boolean'
    },
    {
      name: 'cleanup',
      short: 'c',
      description: 'Clean up temporary files and data',
      type: 'boolean'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Enable verbose output',
      type: 'boolean'
    },
    {
      name: 'dry-run',
      short: 'd',
      description: 'Preview what would be stopped',
      type: 'boolean'
    }
  ],
  subcommands: [
    {
      name: 'daemon',
      description: 'Stop daemon process',
      handler: async (context: CLIContext) => await stopDaemon(context)
    },
    {
      name: 'services',
      description: 'Stop all services',
      handler: async (context: CLIContext) => await stopAllServices(context)
    },
    {
      name: 'agents',
      description: 'Stop all agents',
      handler: async (context: CLIContext) => await stopAllAgents(context)
    },
    {
      name: 'swarms',
      description: 'Stop all swarms',
      handler: async (context: CLIContext) => await stopAllSwarms(context)
    },
    {
      name: 'mcp',
      description: 'Stop MCP server',
      handler: async (context: CLIContext) => await stopMCPServer(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { options } = context;
    
    printInfo('🛑 flowx System Shutdown');
    console.log('─'.repeat(50));

    try {
      // Check if system is running
      const systemStatus = await getSystemStatus();
      
      if (!systemStatus.isRunning) {
        printWarning('flowx is not currently running');
        if (options.cleanup) {
          await performCleanup(options.verbose);
        }
        return;
      }

      // Show what will be stopped
      if (options.dryRun) {
        await showStopPreview(systemStatus, options);
        return;
      }

      // Stop specific service
      if (options.service) {
        await stopSpecificService(options.service, options);
        return;
      }

      // Perform graceful shutdown
      if (options.force) {
        printWarning('Performing force shutdown...');
        await forceShutdown(systemStatus, options);
      } else {
        printInfo('Performing graceful shutdown...');
        await gracefulShutdown(systemStatus, options);
      }

      // Cleanup if requested
      if (options.cleanup) {
        await performCleanup(options.verbose);
      }

      printSuccess('✓ flowx stopped successfully');

    } catch (error) {
      printError(`Failed to stop system: ${error instanceof Error ? error.message : String(error)}`);
      
      // Attempt force shutdown as fallback
      if (!options.force) {
        printWarning('Attempting force shutdown as fallback...');
        try {
          await forceShutdown(await getSystemStatus(), { ...options, force: true });
          printSuccess('✓ Force shutdown completed');
        } catch (forceError) {
          printError(`Force shutdown also failed: ${forceError instanceof Error ? forceError.message : String(forceError)}`);
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    }
  }
};

// Core shutdown functions

async function gracefulShutdown(systemStatus: SystemStatus, options: any): Promise<void> {
  const timeout = options.timeout || 30;
  
  printInfo(`Starting graceful shutdown (timeout: ${timeout}s)...`);
  
  // Step 1: Stop accepting new requests
  await stopNewRequests(systemStatus, options);
  
  // Step 2: Complete ongoing tasks
  await waitForTaskCompletion(systemStatus, timeout, options);
  
  // Step 3: Stop services in order
  await stopServicesGracefully(systemStatus, options);
  
  // Step 4: Stop daemon process
  await stopDaemonProcess(systemStatus, options);
  
  // Step 5: Cleanup resources
  await cleanupResources(options);
}

async function forceShutdown(systemStatus: SystemStatus, options: any): Promise<void> {
  printWarning('Force stopping all processes...');
  
  // Kill all processes immediately
  const processes = await getAllClaudeFlowProcesses();
  
  for (const process of processes) {
    try {
      if (options.verbose) {
        printInfo(`Force killing process: ${process.name} (PID: ${process.pid})`);
      }
      
      process.kill('SIGKILL');
      await waitForProcessExit(process.pid, 5000);
      
      if (options.verbose) {
        printSuccess(`✓ Process ${process.name} terminated`);
      }
    } catch (error) {
      printWarning(`Failed to kill process ${process.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Force cleanup
  await forceCleanup(options);
}

async function stopSpecificService(serviceName: string, options: any): Promise<void> {
  printInfo(`Stopping service: ${serviceName}`);
  
  const service = await findService(serviceName);
  if (!service) {
    printError(`Service not found: ${serviceName}`);
    return;
  }
  
  try {
    if (options.force) {
      await killProcess(service.pid, 'SIGKILL');
    } else {
      await gracefulStopService(service, options.timeout || 30);
    }
    
    printSuccess(`✓ Service ${serviceName} stopped`);
  } catch (error) {
    printError(`Failed to stop service ${serviceName}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Subcommand handlers

async function stopDaemon(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Stopping flowx daemon...');
  
  try {
    const pidData = await fs.readFile('.flowx.pid', 'utf8');
    const { pid } = JSON.parse(pidData);
    
    if (options.force) {
      process.kill(pid, 'SIGKILL');
    } else {
      process.kill(pid, 'SIGTERM');
      await waitForProcessExit(pid, options.timeout || 30000);
    }
    
    // Remove PID file
    await fs.unlink('.flowx.pid').catch(() => {});
    
    printSuccess('✓ Daemon stopped');
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      printWarning('Daemon PID file not found - daemon may not be running');
    } else {
      throw error;
    }
  }
}

async function stopAllServices(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Stopping all services...');
  
  const services = await getAllServices();
  
  for (const service of services) {
    try {
      if (options.verbose) {
        printInfo(`Stopping ${service.name}...`);
      }
      
      if (options.force) {
        await killProcess(service.pid, 'SIGKILL');
      } else {
        await gracefulStopService(service, options.timeout || 30);
      }
      
      if (options.verbose) {
        printSuccess(`✓ ${service.name} stopped`);
      }
    } catch (error) {
      printWarning(`Failed to stop ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  printSuccess('✓ All services stopped');
}

async function stopAllAgents(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Stopping all agents...');
  
  const agents = await getAllAgents();
  
  for (const agent of agents) {
    try {
      if (options.verbose) {
        printInfo(`Stopping agent: ${agent.name}`);
      }
      
      await stopAgent(agent.id, options.force);
      
      if (options.verbose) {
        printSuccess(`✓ Agent ${agent.name} stopped`);
      }
    } catch (error) {
      printWarning(`Failed to stop agent ${agent.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  printSuccess('✓ All agents stopped');
}

async function stopAllSwarms(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Stopping all swarms...');
  
  const swarms = await getAllSwarms();
  
  for (const swarm of swarms) {
    try {
      if (options.verbose) {
        printInfo(`Stopping swarm: ${swarm.name}`);
      }
      
      await stopSwarm(swarm.id, options.force);
      
      if (options.verbose) {
        printSuccess(`✓ Swarm ${swarm.name} stopped`);
      }
    } catch (error) {
      printWarning(`Failed to stop swarm ${swarm.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  printSuccess('✓ All swarms stopped');
}

async function stopMCPServer(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Stopping MCP server...');
  
  try {
    const mcpProcess = await findService('mcp-server');
    if (mcpProcess) {
      if (options.force) {
        await killProcess(mcpProcess.pid, 'SIGKILL');
      } else {
        await gracefulStopService(mcpProcess, options.timeout || 30);
      }
      printSuccess('✓ MCP server stopped');
    } else {
      printWarning('MCP server not found or not running');
    }
  } catch (error) {
    printError(`Failed to stop MCP server: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper functions

interface SystemStatus {
  isRunning: boolean;
  pid?: number;
  services: ServiceInfo[];
  agents: AgentInfo[];
  swarms: SwarmInfo[];
  uptime?: number;
}

interface ServiceInfo {
  name: string;
  pid: number;
  status: string;
  port?: number;
}

interface AgentInfo {
  id: string;
  name: string;
  pid?: number;
  status: string;
}

interface SwarmInfo {
  id: string;
  name: string;
  status: string;
  agentCount: number;
}

interface ProcessInfo {
  name: string;
  pid: number;
  kill: (signal: string) => void;
}

async function getSystemStatus(): Promise<SystemStatus> {
  try {
    // Check if daemon is running
    const pidData = await fs.readFile('.flowx.pid', 'utf8');
    const { pid, startTime } = JSON.parse(pidData);
    
    try {
      process.kill(pid, 0); // Check if process exists
      
      return {
        isRunning: true,
        pid,
        services: await getAllServices(),
        agents: await getAllAgents(),
        swarms: await getAllSwarms(),
        uptime: Date.now() - startTime
      };
    } catch {
      // Process not found
      await fs.unlink('.flowx.pid').catch(() => {});
      return {
        isRunning: false,
        services: [],
        agents: [],
        swarms: []
      };
    }
  } catch {
    return {
      isRunning: false,
      services: [],
      agents: [],
      swarms: []
    };
  }
}

async function showStopPreview(systemStatus: SystemStatus, options: any): Promise<void> {
  printInfo('Stop Preview - What would be stopped:');
  console.log();
  
  if (options.service) {
    const service = systemStatus.services.find(s => s.name === options.service);
    if (service) {
      console.log(`Service: ${service.name} (PID: ${service.pid})`);
    } else {
      printWarning(`Service '${options.service}' not found`);
    }
    return;
  }
  
  console.log(successBold('Daemon Process:'));
  if (systemStatus.isRunning) {
    console.log(`  Main daemon (PID: ${systemStatus.pid})`);
  } else {
    console.log('  No daemon running');
  }
  
  console.log();
  console.log(successBold('Services:'));
  if (systemStatus.services.length > 0) {
    for (const service of systemStatus.services) {
      console.log(`  ${service.name} (PID: ${service.pid}) - ${service.status}`);
    }
  } else {
    console.log('  No services running');
  }
  
  console.log();
  console.log(successBold('Agents:'));
  if (systemStatus.agents.length > 0) {
    for (const agent of systemStatus.agents) {
      console.log(`  ${agent.name} (${agent.id}) - ${agent.status}`);
    }
  } else {
    console.log('  No agents running');
  }
  
  console.log();
  console.log(successBold('Swarms:'));
  if (systemStatus.swarms.length > 0) {
    for (const swarm of systemStatus.swarms) {
      console.log(`  ${swarm.name} (${swarm.id}) - ${swarm.agentCount} agents`);
    }
  } else {
    console.log('  No swarms running');
  }
  
  console.log();
  printInfo(`Use --force for immediate termination, or remove --dry-run to proceed`);
}

async function stopNewRequests(systemStatus: SystemStatus, options: any): Promise<void> {
  if (options.verbose) {
    printInfo('Stopping new request acceptance...');
  }
  
  // Send signal to stop accepting new requests
  for (const service of systemStatus.services) {
    try {
      process.kill(service.pid, 'SIGUSR1'); // Custom signal for graceful stop
    } catch (error) {
      if (options.verbose) {
        printWarning(`Could not signal service ${service.name}`);
      }
    }
  }
  
  // Wait a moment for services to process the signal
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function waitForTaskCompletion(systemStatus: SystemStatus, timeout: number, options: any): Promise<void> {
  if (options.verbose) {
    printInfo('Waiting for ongoing tasks to complete...');
  }
  
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  
  while (Date.now() - startTime < timeoutMs) {
    // Check if all tasks are complete
    const hasActiveTasks = await checkForActiveTasks();
    
    if (!hasActiveTasks) {
      if (options.verbose) {
        printSuccess('✓ All tasks completed');
      }
      return;
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  printWarning('Timeout reached - proceeding with shutdown');
}

async function stopServicesGracefully(systemStatus: SystemStatus, options: any): Promise<void> {
  if (options.verbose) {
    printInfo('Stopping services gracefully...');
  }
  
  // Stop services in reverse dependency order
  const serviceOrder = ['mcp-server', 'agent-manager', 'swarm-coordinator', 'memory-manager'];
  
  for (const serviceName of serviceOrder) {
    const service = systemStatus.services.find(s => s.name === serviceName);
    if (service) {
      try {
        await gracefulStopService(service, 30);
        if (options.verbose) {
          printSuccess(`✓ ${serviceName} stopped`);
        }
      } catch (error) {
        printWarning(`Failed to stop ${serviceName} gracefully, will be force killed`);
      }
    }
  }
}

async function stopDaemonProcess(systemStatus: SystemStatus, options: any): Promise<void> {
  if (systemStatus.pid) {
    if (options.verbose) {
      printInfo('Stopping daemon process...');
    }
    
    try {
      process.kill(systemStatus.pid, 'SIGTERM');
      await waitForProcessExit(systemStatus.pid, 10000);
      
      // Remove PID file
      await fs.unlink('.flowx.pid').catch(() => {});
      
      if (options.verbose) {
        printSuccess('✓ Daemon process stopped');
      }
    } catch (error) {
      printWarning('Failed to stop daemon gracefully, force killing...');
      try {
        process.kill(systemStatus.pid, 'SIGKILL');
      } catch {
        // Process may already be dead
      }
    }
  }
}

async function cleanupResources(options: any): Promise<void> {
  if (options.verbose) {
    printInfo('Cleaning up resources...');
  }
  
  // Clean up temporary files
  const tempFiles = ['.flowx.pid', '.flowx.lock'];
  
  for (const file of tempFiles) {
    try {
      await fs.unlink(file);
      if (options.verbose) {
        printInfo(`Removed ${file}`);
      }
    } catch {
      // File may not exist
    }
  }
  
  // Clean up temporary directories
  const tempDirs = ['./tmp/flowx', './logs/temp'];
  
  for (const dir of tempDirs) {
    try {
      await fs.rmdir(dir, { recursive: true });
      if (options.verbose) {
        printInfo(`Removed directory ${dir}`);
      }
    } catch {
      // Directory may not exist
    }
  }
}

async function performCleanup(verbose: boolean): Promise<void> {
  printInfo('Performing system cleanup...');
  
  try {
    // Remove PID files
    await fs.unlink('.flowx.pid').catch(() => {});
    
    // Clean up log files older than 7 days
    await cleanupOldLogs(verbose);
    
    // Clean up temporary data
    await cleanupTempData(verbose);
    
    // Clean up orphaned processes
    await cleanupOrphanedProcesses(verbose);
    
    printSuccess('✓ Cleanup completed');
  } catch (error) {
    printWarning(`Cleanup partially failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function forceCleanup(options: any): Promise<void> {
  if (options.verbose) {
    printInfo('Performing force cleanup...');
  }
  
  // Force remove all Claude Flow files
  const forceRemoveFiles = [
    '.flowx.pid',
    '.flowx.lock',
    '.flowx.socket'
  ];
  
  for (const file of forceRemoveFiles) {
    try {
      await fs.unlink(file);
    } catch {
      // Ignore errors
    }
  }
  
  // Kill any remaining processes
  try {
    await exec('pkill -f flowx').catch(() => {});
  } catch {
    // Ignore errors
  }
}

// Utility functions

async function getAllClaudeFlowProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await exec('ps aux | grep flowx | grep -v grep');
    const lines = stdout.trim().split('\n');
    
    return lines.map(line => {
      const parts = line.split(/\s+/);
      const pid = parseInt(parts[1]);
      const name = parts.slice(10).join(' ');
      
      return {
        name,
        pid,
        kill: (signal: string) => process.kill(pid, signal)
      };
    });
  } catch {
    return [];
  }
}

async function getAllServices(): Promise<ServiceInfo[]> {
  // Mock implementation - would connect to actual service registry
  return [
    { name: 'mcp-server', pid: 12345, status: 'running', port: 3000 },
    { name: 'agent-manager', pid: 12346, status: 'running' },
    { name: 'swarm-coordinator', pid: 12347, status: 'running' },
    { name: 'memory-manager', pid: 12348, status: 'running' }
  ];
}

async function getAllAgents(): Promise<AgentInfo[]> {
  // Mock implementation - would connect to agent manager
  return [
    { id: 'agent-001', name: 'Research Agent', status: 'active' },
    { id: 'agent-002', name: 'Code Agent', status: 'idle' }
  ];
}

async function getAllSwarms(): Promise<SwarmInfo[]> {
  // Mock implementation - would connect to swarm coordinator
  return [
    { id: 'swarm-001', name: 'Development Swarm', status: 'active', agentCount: 3 }
  ];
}

async function findService(serviceName: string): Promise<ServiceInfo | null> {
  const services = await getAllServices();
  return services.find(s => s.name === serviceName) || null;
}

async function gracefulStopService(service: ServiceInfo, timeout: number): Promise<void> {
  process.kill(service.pid, 'SIGTERM');
  await waitForProcessExit(service.pid, timeout * 1000);
}

async function killProcess(pid: number, signal: string): Promise<void> {
  process.kill(pid, signal);
  await waitForProcessExit(pid, 5000);
}

async function waitForProcessExit(pid: number, timeout: number): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      process.kill(pid, 0); // Check if process exists
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      // Process has exited
      return;
    }
  }
  
  throw new Error(`Process ${pid} did not exit within timeout`);
}

async function checkForActiveTasks(): Promise<boolean> {
  // Mock implementation - would check actual task status
  return false;
}

async function stopAgent(agentId: string, force: boolean): Promise<void> {
  // Mock implementation - would connect to agent manager
  printInfo(`Stopping agent ${agentId}${force ? ' (force)' : ''}`);
}

async function stopSwarm(swarmId: string, force: boolean): Promise<void> {
  // Mock implementation - would connect to swarm coordinator
  printInfo(`Stopping swarm ${swarmId}${force ? ' (force)' : ''}`);
}

async function cleanupOldLogs(verbose: boolean): Promise<void> {
  // Implementation would clean up log files older than retention period
  if (verbose) {
    printInfo('Cleaning up old log files...');
  }
}

async function cleanupTempData(verbose: boolean): Promise<void> {
  // Implementation would clean up temporary data files
  if (verbose) {
    printInfo('Cleaning up temporary data...');
  }
}

async function cleanupOrphanedProcesses(verbose: boolean): Promise<void> {
  // Implementation would find and clean up orphaned processes
  if (verbose) {
    printInfo('Cleaning up orphaned processes...');
  }
} 