/**
 * Restart Command
 * Provides comprehensive system restart capabilities with rolling restart and health checks
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import * as fs from 'fs/promises';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

export const restartCommand: CLICommand = {
  name: 'restart',
  description: 'Restart the flowx orchestration system',
  category: 'System',
  usage: 'flowx restart [OPTIONS]',
  examples: [
    'flowx restart',
    'flowx restart --rolling',
    'flowx restart --service mcp-server',
    'flowx restart --health-check',
    'flowx restart --wait-time 10'
  ],
  options: [
    {
      name: 'rolling',
      short: 'r',
      description: 'Perform rolling restart (zero-downtime)',
      type: 'boolean'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Force restart without graceful shutdown',
      type: 'boolean'
    },
    {
      name: 'service',
      short: 's',
      description: 'Restart specific service only',
      type: 'string'
    },
    {
      name: 'health-check',
      short: 'h',
      description: 'Perform health checks after restart',
      type: 'boolean'
    },
    {
      name: 'wait-time',
      short: 'w',
      description: 'Wait time between stop and start (seconds)',
      type: 'number',
      default: 5
    },
    {
      name: 'timeout',
      short: 't',
      description: 'Restart timeout in seconds',
      type: 'number',
      default: 60
    },
    {
      name: 'backup-config',
      short: 'b',
      description: 'Backup configuration before restart',
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
      description: 'Preview restart sequence',
      type: 'boolean'
    }
  ],
  subcommands: [
    {
      name: 'daemon',
      description: 'Restart daemon process',
      handler: async (context: CLIContext) => await restartDaemon(context)
    },
    {
      name: 'services',
      description: 'Restart all services',
      handler: async (context: CLIContext) => await restartAllServices(context)
    },
    {
      name: 'agents',
      description: 'Restart all agents',
      handler: async (context: CLIContext) => await restartAllAgents(context)
    },
    {
      name: 'swarms',
      description: 'Restart all swarms',
      handler: async (context: CLIContext) => await restartAllSwarms(context)
    },
    {
      name: 'mcp',
      description: 'Restart MCP server',
      handler: async (context: CLIContext) => await restartMCPServer(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { options } = context;
    
    printInfo('🔄 flowx System Restart');
    console.log('─'.repeat(50));

    try {
      // Backup configuration if requested
      if (options.backupConfig) {
        await backupConfiguration(options.verbose);
      }

      // Check current system status
      const systemStatus = await getSystemStatus();
      
      if (!systemStatus.isRunning && !options.force) {
        printWarning('flowx is not currently running');
        printInfo('Use "flowx start" to start the system');
        return;
      }

      // Show restart preview
      if (options.dryRun) {
        await showRestartPreview(systemStatus, options);
        return;
      }

      // Restart specific service
      if (options.service) {
        await restartSpecificService(options.service, options);
        return;
      }

      // Perform restart based on mode
      if (options.rolling) {
        printInfo('Performing rolling restart (zero-downtime)...');
        await rollingRestart(systemStatus, options);
      } else {
        printInfo('Performing standard restart...');
        await standardRestart(systemStatus, options);
      }

      // Health checks if requested
      if (options.healthCheck) {
        await performPostRestartHealthChecks(options);
      }

      printSuccess('✓ flowx restarted successfully');

    } catch (error) {
      printError(`Failed to restart system: ${error instanceof Error ? error.message : String(error)}`);
      
      // Attempt recovery
      printWarning('Attempting system recovery...');
      try {
        await performSystemRecovery(options);
        printSuccess('✓ System recovery completed');
      } catch (recoveryError) {
        printError(`System recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
        printError('Manual intervention may be required');
        process.exit(1);
      }
    }
  }
};

// Core restart functions

async function standardRestart(systemStatus: SystemStatus, options: any): Promise<void> {
  const waitTime = options.waitTime || 5;
  
  printInfo('Step 1: Stopping system...');
  await stopSystem(systemStatus, options);
  
  printInfo(`Step 2: Waiting ${waitTime} seconds...`);
  await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  
  printInfo('Step 3: Starting system...');
  await startSystem(options);
  
  printInfo('Step 4: Verifying system health...');
  await verifySystemHealth(options.timeout || 60);
}

async function rollingRestart(systemStatus: SystemStatus, options: any): Promise<void> {
  printInfo('Performing zero-downtime rolling restart...');
  
  // Get service restart order (reverse dependency order)
  const restartOrder = getServiceRestartOrder(systemStatus.services);
  
  for (const service of restartOrder) {
    try {
      printInfo(`Rolling restart: ${service.name}`);
      
      // Start new instance
      const newInstance = await startServiceInstance(service, options);
      
      // Wait for new instance to be ready
      await waitForServiceReady(newInstance, 30);
      
      // Health check new instance
      await healthCheckService(newInstance);
      
      // Stop old instance
      await stopServiceInstance(service, options);
      
      // Update service registry
      await updateServiceRegistry(service, newInstance);
      
      printSuccess(`✓ ${service.name} restarted`);
      
      // Brief pause between services
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      printError(`Failed to restart ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
      
      // Rollback if possible
      await rollbackService(service, options);
      throw error;
    }
  }
}

async function restartSpecificService(serviceName: string, options: any): Promise<void> {
  printInfo(`Restarting service: ${serviceName}`);
  
  const service = await findService(serviceName);
  if (!service) {
    printError(`Service not found: ${serviceName}`);
    return;
  }
  
  try {
    if (options.rolling) {
      // Rolling restart for single service
      const newInstance = await startServiceInstance(service, options);
      await waitForServiceReady(newInstance, 30);
      await healthCheckService(newInstance);
      await stopServiceInstance(service, options);
      await updateServiceRegistry(service, newInstance);
    } else {
      // Standard restart for single service
      await stopServiceInstance(service, options);
      
      const waitTime = options.waitTime || 5;
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      
      const newInstance = await startServiceInstance(service, options);
      await waitForServiceReady(newInstance, options.timeout || 60);
      
      if (options.healthCheck) {
        await healthCheckService(newInstance);
      }
    }
    
    printSuccess(`✓ Service ${serviceName} restarted`);
  } catch (error) {
    printError(`Failed to restart service ${serviceName}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Subcommand handlers

async function restartDaemon(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Restarting flowx daemon...');
  
  try {
    // Stop daemon
    const pidData = await fs.readFile('.flowx.pid', 'utf8');
    const { pid } = JSON.parse(pidData);
    
    if (options.verbose) {
      printInfo(`Stopping daemon (PID: ${pid})...`);
    }
    
    if (options.force) {
      process.kill(pid, 'SIGKILL');
    } else {
      process.kill(pid, 'SIGTERM');
      await waitForProcessExit(pid, options.timeout || 30000);
    }
    
    // Wait before restart
    const waitTime = options.waitTime || 5;
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    
    // Start daemon
    if (options.verbose) {
      printInfo('Starting new daemon instance...');
    }
    
    await startDaemonProcess(options);
    
    // Health check
    if (options.healthCheck) {
      await verifyDaemonHealth();
    }
    
    printSuccess('✓ Daemon restarted');
  } catch (error) {
    printError(`Failed to restart daemon: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function restartAllServices(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Restarting all services...');
  
  const services = await getAllServices();
  
  if (options.rolling) {
    // Rolling restart
    const restartOrder = getServiceRestartOrder(services);
    
    for (const service of restartOrder) {
      try {
        if (options.verbose) {
          printInfo(`Rolling restart: ${service.name}...`);
        }
        
        await restartSpecificService(service.name, { ...options, rolling: true });
        
        if (options.verbose) {
          printSuccess(`✓ ${service.name} restarted`);
        }
      } catch (error) {
        printWarning(`Failed to restart ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else {
    // Standard restart - stop all then start all
    for (const service of services) {
      try {
        if (options.verbose) {
          printInfo(`Stopping ${service.name}...`);
        }
        await stopServiceInstance(service, options);
      } catch (error) {
        printWarning(`Failed to stop ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Wait between stop and start
    const waitTime = options.waitTime || 5;
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    
    for (const service of services) {
      try {
        if (options.verbose) {
          printInfo(`Starting ${service.name}...`);
        }
        await startServiceInstance(service, options);
      } catch (error) {
        printWarning(`Failed to start ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  printSuccess('✓ All services restarted');
}

async function restartAllAgents(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Restarting all agents...');
  
  const agents = await getAllAgents();
  
  for (const agent of agents) {
    try {
      if (options.verbose) {
        printInfo(`Restarting agent: ${agent.name}`);
      }
      
      await restartAgent(agent.id, options);
      
      if (options.verbose) {
        printSuccess(`✓ Agent ${agent.name} restarted`);
      }
    } catch (error) {
      printWarning(`Failed to restart agent ${agent.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  printSuccess('✓ All agents restarted');
}

async function restartAllSwarms(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Restarting all swarms...');
  
  const swarms = await getAllSwarms();
  
  for (const swarm of swarms) {
    try {
      if (options.verbose) {
        printInfo(`Restarting swarm: ${swarm.name}`);
      }
      
      await restartSwarm(swarm.id, options);
      
      if (options.verbose) {
        printSuccess(`✓ Swarm ${swarm.name} restarted`);
      }
    } catch (error) {
      printWarning(`Failed to restart swarm ${swarm.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  printSuccess('✓ All swarms restarted');
}

async function restartMCPServer(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('Restarting MCP server...');
  
  try {
    await restartSpecificService('mcp-server', options);
    printSuccess('✓ MCP server restarted');
  } catch (error) {
    printError(`Failed to restart MCP server: ${error instanceof Error ? error.message : String(error)}`);
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
  dependencies?: string[];
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

async function getSystemStatus(): Promise<SystemStatus> {
  try {
    const pidData = await fs.readFile('.flowx.pid', 'utf8');
    const { pid, startTime } = JSON.parse(pidData);
    
    try {
      process.kill(pid, 0);
      
      return {
        isRunning: true,
        pid,
        services: await getAllServices(),
        agents: await getAllAgents(),
        swarms: await getAllSwarms(),
        uptime: Date.now() - startTime
      };
    } catch {
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

async function showRestartPreview(systemStatus: SystemStatus, options: any): Promise<void> {
  printInfo('Restart Preview - What would be restarted:');
  console.log();
  
  if (options.service) {
    const service = systemStatus.services.find(s => s.name === options.service);
    if (service) {
      console.log(`Service: ${service.name} (PID: ${service.pid})`);
      console.log(`Mode: ${options.rolling ? 'Rolling restart' : 'Standard restart'}`);
    } else {
      printWarning(`Service '${options.service}' not found`);
    }
    return;
  }
  
  console.log(successBold('Restart Mode:'));
  console.log(`  ${options.rolling ? 'Rolling restart (zero-downtime)' : 'Standard restart (brief downtime)'}`);
  console.log(`  Wait time: ${options.waitTime || 5} seconds`);
  console.log(`  Health checks: ${options.healthCheck ? 'Enabled' : 'Disabled'}`);
  
  console.log();
  console.log(successBold('Services to restart:'));
  if (systemStatus.services.length > 0) {
    const restartOrder = options.rolling ? getServiceRestartOrder(systemStatus.services) : systemStatus.services;
    restartOrder.forEach((service, index) => {
      console.log(`  ${index + 1}. ${service.name} (PID: ${service.pid})`);
    });
  } else {
    console.log('  No services running');
  }
  
  console.log();
  console.log(successBold('Agents to restart:'));
  if (systemStatus.agents.length > 0) {
    systemStatus.agents.forEach(agent => {
      console.log(`  ${agent.name} (${agent.id})`);
    });
  } else {
    console.log('  No agents running');
  }
  
  console.log();
  printInfo('Remove --dry-run to proceed with restart');
}

async function backupConfiguration(verbose: boolean): Promise<void> {
  if (verbose) {
    printInfo('Backing up configuration...');
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `./backups/config-${timestamp}`;
  
  try {
    await fs.mkdir(backupDir, { recursive: true });
    
    // Backup configuration files
    const configFiles = [
      '.flowx.config.tson',
      'flowx.yml',
      'config/default.tson'
    ];
    
    for (const file of configFiles) {
      try {
        await fs.copyFile(file, `${backupDir}/${file.replace('/', '-')}`);
        if (verbose) {
          printInfo(`Backed up ${file}`);
        }
      } catch {
        // File may not exist
      }
    }
    
    printSuccess(`✓ Configuration backed up to ${backupDir}`);
  } catch (error) {
    printWarning(`Failed to backup configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function stopSystem(systemStatus: SystemStatus, options: any): Promise<void> {
  // Stop in reverse dependency order
  const stopOrder = [...systemStatus.services].reverse();
  
  for (const service of stopOrder) {
    try {
      await stopServiceInstance(service, options);
    } catch (error) {
      if (options.verbose) {
        printWarning(`Failed to stop ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  // Stop daemon if running
  if (systemStatus.pid) {
    try {
      if (options.force) {
        process.kill(systemStatus.pid, 'SIGKILL');
      } else {
        process.kill(systemStatus.pid, 'SIGTERM');
        await waitForProcessExit(systemStatus.pid, 30000);
      }
    } catch (error) {
      if (options.verbose) {
        printWarning(`Failed to stop daemon: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

async function startSystem(options: any): Promise<void> {
  // Start daemon first
  await startDaemonProcess(options);
  
  // Wait for daemon to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Start services in dependency order
  const services = await getAllServices();
  const startOrder = getServiceStartOrder(services);
  
  for (const service of startOrder) {
    try {
      await startServiceInstance(service, options);
      
      // Wait for service to be ready
      await waitForServiceReady(service, 30);
    } catch (error) {
      if (options.verbose) {
        printWarning(`Failed to start ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

async function verifySystemHealth(timeout: number): Promise<void> {
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const systemStatus = await getSystemStatus();
      
      if (systemStatus.isRunning) {
        const healthyServices = systemStatus.services.filter(s => s.status === 'running').length;
        const totalServices = systemStatus.services.length;
        
        if (healthyServices === totalServices && totalServices > 0) {
          return; // System is healthy
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      // Continue checking
    }
  }
  
  throw new Error('System failed to become healthy within timeout');
}

async function performPostRestartHealthChecks(options: any): Promise<void> {
  printInfo('Performing post-restart health checks...');
  
  const checks = [
    { name: 'Daemon Process', fn: checkDaemonHealth },
    { name: 'MCP Server', fn: checkMCPServerHealth },
    { name: 'Agent Manager', fn: checkAgentManagerHealth },
    { name: 'Swarm Coordinator', fn: checkSwarmCoordinatorHealth },
    { name: 'Memory Manager', fn: checkMemoryManagerHealth }
  ];
  
  let failedChecks = 0;
  
  for (const check of checks) {
    try {
      await check.fn();
      printSuccess(`✓ ${check.name}`);
    } catch (error) {
      printError(`✗ ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
      failedChecks++;
    }
  }
  
  if (failedChecks > 0) {
    printWarning(`${failedChecks} health check(s) failed`);
    if (options.verbose) {
      printInfo('System may not be fully operational');
    }
  } else {
    printSuccess('✓ All health checks passed');
  }
}

async function performSystemRecovery(options: any): Promise<void> {
  printInfo('Attempting system recovery...');
  
  // Kill any remaining processes
  try {
    await exec('pkill -f flowx').catch(() => {});
  } catch {
    // Ignore errors
  }
  
  // Clean up PID files
  await fs.unlink('.flowx.pid').catch(() => {});
  
  // Wait before attempting restart
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Attempt to start system
  await startSystem(options);
  
  // Basic health check
  await verifySystemHealth(30);
}

// Service management functions

function getServiceRestartOrder(services: ServiceInfo[]): ServiceInfo[] {
  // Define restart order based on dependencies (least dependent first)
  const order = ['memory-manager', 'agent-manager', 'swarm-coordinator', 'mcp-server'];
  
  const orderedServices = [];
  
  // Add services in defined order
  for (const serviceName of order) {
    const service = services.find(s => s.name === serviceName);
    if (service) {
      orderedServices.push(service);
    }
  }
  
  // Add any remaining services
  for (const service of services) {
    if (!orderedServices.includes(service)) {
      orderedServices.push(service);
    }
  }
  
  return orderedServices;
}

function getServiceStartOrder(services: ServiceInfo[]): ServiceInfo[] {
  // Start order is reverse of restart order
  return getServiceRestartOrder(services).reverse();
}

async function startServiceInstance(service: ServiceInfo, options: any): Promise<ServiceInfo> {
  // Mock implementation - would start actual service
  const newService = {
    ...service,
    pid: Math.floor(Math.random() * 10000) + 10000,
    status: 'starting'
  };
  
  if (options.verbose) {
    printInfo(`Starting ${service.name} (new PID: ${newService.pid})`);
  }
  
  return newService;
}

async function stopServiceInstance(service: ServiceInfo, options: any): Promise<void> {
  if (options.verbose) {
    printInfo(`Stopping ${service.name} (PID: ${service.pid})`);
  }
  
  try {
    if (options.force) {
      process.kill(service.pid, 'SIGKILL');
    } else {
      process.kill(service.pid, 'SIGTERM');
      await waitForProcessExit(service.pid, 30000);
    }
  } catch (error) {
    if (options.verbose) {
      printWarning(`Failed to stop ${service.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function waitForServiceReady(service: ServiceInfo, timeout: number): Promise<void> {
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Check if service is responding
      const isReady = await checkServiceHealth(service);
      if (isReady) {
        return;
      }
    } catch {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Service ${service.name} did not become ready within timeout`);
}

async function healthCheckService(service: ServiceInfo): Promise<void> {
  // Mock implementation - would perform actual health check
  if (service.name === 'mcp-server') {
    await checkMCPServerHealth();
  } else if (service.name === 'agent-manager') {
    await checkAgentManagerHealth();
  } else if (service.name === 'swarm-coordinator') {
    await checkSwarmCoordinatorHealth();
  } else if (service.name === 'memory-manager') {
    await checkMemoryManagerHealth();
  }
}

async function updateServiceRegistry(oldService: ServiceInfo, newService: ServiceInfo): Promise<void> {
  // Mock implementation - would update service registry
  if (newService.port) {
    // Update port mappings
  }
}

async function rollbackService(service: ServiceInfo, options: any): Promise<void> {
  printWarning(`Rolling back service: ${service.name}`);
  // Mock implementation - would rollback to previous version
}

// Utility functions

async function getAllServices(): Promise<ServiceInfo[]> {
  return [
    { name: 'mcp-server', pid: 12345, status: 'running', port: 3000, dependencies: [] },
    { name: 'agent-manager', pid: 12346, status: 'running', dependencies: ['memory-manager'] },
    { name: 'swarm-coordinator', pid: 12347, status: 'running', dependencies: ['agent-manager'] },
    { name: 'memory-manager', pid: 12348, status: 'running', dependencies: [] }
  ];
}

async function getAllAgents(): Promise<AgentInfo[]> {
  return [
    { id: 'agent-001', name: 'Research Agent', status: 'active' },
    { id: 'agent-002', name: 'Code Agent', status: 'idle' }
  ];
}

async function getAllSwarms(): Promise<SwarmInfo[]> {
  return [
    { id: 'swarm-001', name: 'Development Swarm', status: 'active', agentCount: 3 }
  ];
}

async function findService(serviceName: string): Promise<ServiceInfo | null> {
  const services = await getAllServices();
  return services.find(s => s.name === serviceName) || null;
}

async function waitForProcessExit(pid: number, timeout: number): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      process.kill(pid, 0);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      return;
    }
  }
  
  throw new Error(`Process ${pid} did not exit within timeout`);
}

async function startDaemonProcess(options: any): Promise<void> {
  // Mock implementation - would start actual daemon
  const pid = process.pid + 1000;
  const pidData = {
    pid,
    startTime: Date.now(),
    config: options.config || 'default'
  };
  
  await fs.writeFile('.flowx.pid', JSON.stringify(pidData, null, 2));
  
  if (options.verbose) {
    printInfo(`Started daemon (PID: ${pid})`);
  }
}

async function checkServiceHealth(service: ServiceInfo): Promise<boolean> {
  // Mock implementation - would check actual service health
  return service.status === 'running';
}

async function restartAgent(agentId: string, options: any): Promise<void> {
  // Mock implementation - would restart actual agent
  if (options.verbose) {
    printInfo(`Restarting agent ${agentId}`);
  }
}

async function restartSwarm(swarmId: string, options: any): Promise<void> {
  // Mock implementation - would restart actual swarm
  if (options.verbose) {
    printInfo(`Restarting swarm ${swarmId}`);
  }
}

// Health check functions

async function checkDaemonHealth(): Promise<void> {
  const pidData = await fs.readFile('.flowx.pid', 'utf8');
  const { pid } = JSON.parse(pidData);
  process.kill(pid, 0); // Throws if process doesn't exist
}

async function verifyDaemonHealth(): Promise<void> {
  await checkDaemonHealth();
}

async function checkMCPServerHealth(): Promise<void> {
  // Mock implementation - would check MCP server health
  const service = await findService('mcp-server');
  if (!service || service.status !== 'running') {
    throw new Error('MCP server not healthy');
  }
}

async function checkAgentManagerHealth(): Promise<void> {
  // Mock implementation - would check agent manager health
  const service = await findService('agent-manager');
  if (!service || service.status !== 'running') {
    throw new Error('Agent manager not healthy');
  }
}

async function checkSwarmCoordinatorHealth(): Promise<void> {
  // Mock implementation - would check swarm coordinator health
  const service = await findService('swarm-coordinator');
  if (!service || service.status !== 'running') {
    throw new Error('Swarm coordinator not healthy');
  }
}

async function checkMemoryManagerHealth(): Promise<void> {
  // Mock implementation - would check memory manager health
  const service = await findService('memory-manager');
  if (!service || service.status !== 'running') {
    throw new Error('Memory manager not healthy');
  }
} 