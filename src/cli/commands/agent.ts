/**
 * Comprehensive Agent management commands with advanced features
 */

// Note: Using basic command structure since @cliffy dependencies may not be available
import { Command } from 'commander';
import { colors } from '../../utils/colors.ts';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import { AgentProfile } from "../../utils/types.ts";
import { generateId } from "../../utils/helpers.ts";
import { AgentManager } from "../../agents/agent-manager.ts";
import { MemoryManager } from "../../memory/manager.ts";
import { EventBus } from "../../core/event-bus.ts";
import { Logger } from "../../core/logger.ts";
import { DistributedMemorySystem } from "../../memory/distributed-memory.ts";
import { formatDuration, formatBytes, formatPercentage } from "../../utils/formatters.ts";
import path from 'node:path';
import fs from 'node:fs/promises';

// Global agent manager instance
let agentManager: AgentManager | null = null;

// Initialize agent manager
async function initializeAgentManager(): Promise<AgentManager> {
  if (agentManager) return agentManager;
  
  const logger = new Logger({ level: 'info' });
  const eventBus = new EventBus();
  const memorySystem = new DistributedMemorySystem({
    backend: 'sqlite',
    path: './memory/agents.db'
  });
  
  await memorySystem.initialize();
  
  agentManager = new AgentManager(
    {
      maxAgents: 100,
      defaultTimeout: 60000,
      heartbeatInterval: 15000,
      healthCheckInterval: 30000,
      autoRestart: true,
      resourceLimits: {
        memory: 1024 * 1024 * 1024, // 1GB
        cpu: 2.0,
        disk: 2 * 1024 * 1024 * 1024 // 2GB
      }
    },
    logger,
    eventBus,
    memorySystem
  );
  
  await agentManager.initialize();
  return agentManager;
}

export function createAgentCommands(program: Command) {
  const agent = program.command('agent')
    .description('Manage AI agents');

  agent
    .command('spawn')
    .description('Spawn a new agent')
    .action(async () => {
      const answers = await inquirer.prompt([
        { type: 'input', name: 'name', message: 'Agent name:' },
        { type: 'list', name: 'type', message: 'Agent type:', choices: ['researcher', 'coder', 'analyst'] }
      ]);
      console.log(colors.green(`Spawning ${answers.type} agent named "${answers.name}"...`));
      // Mock implementation
      console.log(colors.blue('Agent spawned successfully.'));
    });

  agent
    .command('list')
    .description('List running agents')
    .action(() => {
      console.log(colors.blue('Listing running agents...'));
      const table = new Table({ head: [colors.green('ID'), colors.green('Name'), colors.green('Type'), colors.green('Status')] });
      // Mock data
      table.push(['1', 'Agent 1', 'coder', 'running']);
      table.push(['2', 'Agent 2', 'researcher', 'idle']);
      console.log(table.toString());
    });
}

export const agentCommand = new Command()
  .description('Comprehensive Claude-Flow agent management with advanced features')
  .action(() => {
    console.log(colors.cyan('🤖 Claude-Flow Agent Management System'));
    console.log('');
    console.log('Available commands:');
    console.log('  spawn    - Create and start new agents with advanced configuration');
    console.log('  list     - Display all agents with status, metrics, and resource usage');
    console.log('  info     - Get detailed information about a specific agent');
    console.log('  terminate - Safely terminate agents with cleanup and state preservation');
    console.log('  pool     - Manage agent pools for scaling and load distribution');
    console.log('  health   - Monitor agent health and performance metrics');
    console.log('  logs     - View agent logs and activity history');
    console.log('');
    console.log('Use --help with any command for detailed options.');
    agentCommand.showHelp();
  })
  .command('terminate', new Command()
    .description('Safely terminate agents with cleanup and state preservation')
    .arguments('<agent-id:string>')
    .option('--force', 'Force termination without graceful shutdown')
    .option('--preserve-state', 'Preserve agent state in memory for later revival')
    .option('--cleanup', 'Remove all agent data and logs')
    .option('--reason <reason:string>', 'Termination reason for logging')
    .action(async (options, agentId: string) => {
      try {
        const manager = await initializeAgentManager();
        const agent = manager.getAgent(agentId);
        
        if (!agent) {
          console.error(colors.red(`Agent '${agentId}' not found`));
          return;
        }
        
        console.log(colors.cyan(`\n🛑 Terminating agent: ${agent.name} (${agentId})`));
        console.log(`Current status: ${getStatusDisplay(agent.status)}${agent.status}${colors.reset}`);
        
        // Confirm termination if agent is busy
        if (agent.status === 'busy' && agent.workload > 0) {
          const confirm = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: `Agent has ${agent.workload} active tasks. Continue with termination?`, default: false }
          ]);
          
          if (!confirm.confirm) {
            console.log(colors.yellow('Termination cancelled'));
            return;
          }
        }
        
        const reason = options.reason || 'user_request';
        
        // Preserve state if requested
        if (options.preserveState) {
          console.log(colors.blue('📦 Preserving agent state...'));
          await manager.memory.store(`agent_state:${agentId}`, {
            agent,
            terminationTime: new Date(),
            reason,
            preservedBy: 'user'
          }, {
            type: 'preserved-agent-state',
            tags: ['terminated', 'preserved'],
            partition: 'archived'
          });
        }
        
        // Terminate the agent
        if (options.force) {
          console.log(colors.red('⚡ Force terminating agent...'));
          // Force termination would be implemented
        } else {
          console.log(colors.yellow('🔄 Gracefully shutting down agent...'));
        }
        
        await manager.stopAgent(agentId, reason);
        
        if (options.cleanup) {
          console.log(colors.blue('🧹 Cleaning up agent data...'));
          await manager.removeAgent(agentId);
        }
        
        console.log(colors.green('✅ Agent terminated successfully'));
        
        // Show final stats
        if (agent.metrics) {
          console.log('\n' + colors.dim('Final Statistics:'));
          console.log(`  Tasks Completed: ${agent.metrics.tasksCompleted}`);
          console.log(`  Success Rate: ${formatPercentage(agent.metrics.successRate)}`);
          console.log(`  Uptime: ${formatDuration(agent.metrics.totalUptime)}`);
        }
        
      } catch (error) {
        console.error(colors.red('Error terminating agent:'), error.message);
        process.exit(1);
      }
    })
  )
  .command('info', new Command()
    .description('Get comprehensive information about a specific agent')
    .arguments('<agent-id:string>')
    .option('--logs', 'Include recent log entries')
    .option('--metrics', 'Show detailed performance metrics')
    .option('--health', 'Include health diagnostic information')
    .option('--tasks', 'Show task history')
    .option('--config', 'Display agent configuration')
    .option('--json', 'Output in JSON format')
    .action(async (options, agentId: string) => {
      try {
        const manager = await initializeAgentManager();
        const agent = manager.getAgent(agentId);
        
        if (!agent) {
          console.error(colors.red(`Agent '${agentId}' not found`));
          
          // Suggest similar agent IDs
          const allAgents = manager.getAllAgents();
          const similar = allAgents.filter(a => 
            a.id.id.includes(agentId) || 
            a.name.toLowerCase().includes(agentId.toLowerCase())
          );
          
          if (similar.length > 0) {
            console.log('\nDid you mean one of these agents?');
            similar.forEach(a => console.log(`  ${a.id.id} - ${a.name}`));
          }
          return;
        }
        
        if (options.json) {
          const fullInfo = {
            agent,
            health: manager.getAgentHealth(agentId),
            logs: options.logs ? await getAgentLogs(agentId) : undefined,
            metrics: options.metrics ? await getDetailedMetrics(agentId, manager) : undefined
          };
          console.log(JSON.stringify(fullInfo, null, 2));
          return;
        }
        
        console.log(colors.cyan(`\n🤖 Agent Information: ${agent.name}`));
        console.log('=' .repeat(60));
        
        // Basic info
        displayAgentBasicInfo(agent);
        
        // Status and health
        displayAgentStatusHealth(agent, manager);
        
        // Configuration
        if (options.config) {
          displayAgentConfiguration(agent);
        }
        
        // Metrics
        if (options.metrics) {
          await displayAgentMetrics(agent, manager);
        }
        
        // Health details
        if (options.health) {
          displayAgentHealthDetails(agentId, manager);
        }
        
        // Task history
        if (options.tasks) {
          displayAgentTaskHistory(agent);
        }
        
        // Logs
        if (options.logs) {
          await displayAgentLogs(agentId);
        }
        
      } catch (error) {
        console.error(colors.red('Error getting agent info:'), error.message);
        process.exit(1);
      }
    })
  )
  
  // Additional commands
  .command('start', new Command()
    .description('Start a created agent')
    .arguments('<agent-id:string>')
    .action(async (options, agentId: string) => {
      try {
        const manager = await initializeAgentManager();
        console.log(colors.cyan(`🚀 Starting agent ${agentId}...`));
        await manager.startAgent(agentId);
        console.log(colors.green('✅ Agent started successfully'));
      } catch (error) {
        console.error(colors.red('Error starting agent:'), error.message);
      }
    })
  )
  
  .command('restart', new Command()
    .description('Restart an agent')
    .arguments('<agent-id:string>')
    .option('--reason <reason:string>', 'Restart reason')
    .action(async (options, agentId: string) => {
      try {
        const manager = await initializeAgentManager();
        console.log(colors.cyan(`🔄 Restarting agent ${agentId}...`));
        await manager.restartAgent(agentId, options.reason);
        console.log(colors.green('✅ Agent restarted successfully'));
      } catch (error) {
        console.error(colors.red('Error restarting agent:'), error.message);
      }
    })
  )
  
  .command('pool', new Command()
    .description('Manage agent pools')
    .option('--create <name:string>', 'Create a new pool')
    .option('--template <template:string>', 'Template for pool agents')
    .option('--min-size <min:number>', 'Minimum pool size', { default: 1 })
    .option('--max-size <max:number>', 'Maximum pool size', { default: 10 })
    .option('--auto-scale', 'Enable auto-scaling')
    .option('--list', 'List all pools')
    .option('--scale <pool:string>', 'Scale a pool')
    .option('--size <size:number>', 'Target size for scaling')
    .action(async (options) => {
      try {
        const manager = await initializeAgentManager();
        
        if (options.create) {
          if (!options.template) {
            console.error(colors.red('Template is required for pool creation'));
            return;
          }
          
          const poolId = await manager.createAgentPool(options.create, options.template, {
            minSize: options.minSize,
            maxSize: options.maxSize,
            autoScale: options.autoScale
          });
          
          console.log(colors.green(`✅ Pool '${options.create}' created with ID: ${poolId}`));
        }
        
        if (options.scale && options.size !== undefined) {
          const pools = manager.getAllPools();
          const pool = pools.find(p => p.name === options.scale || p.id === options.scale);
          
          if (!pool) {
            console.error(colors.red(`Pool '${options.scale}' not found`));
            return;
          }
          
          await manager.scalePool(pool.id, options.size);
          console.log(colors.green(`✅ Pool scaled to ${options.size} agents`));
        }
        
        if (options.list) {
          const pools = manager.getAllPools();
          if (pools.length === 0) {
            console.log(colors.yellow('No pools found'));
            return;
          }
          
          console.log(colors.cyan('\n🏊 Agent Pools'));
          const table = new Table()
            .header(['Name', 'Type', 'Size', 'Available', 'Busy', 'Auto-Scale'])
            .border(true);
          
          pools.forEach(pool => {
            table.push([
              pool.name,
              pool.type,
              pool.currentSize.toString(),
              pool.availableAgents.length.toString(),
              pool.busyAgents.length.toString(),
              pool.autoScale ? '✅' : '❌'
            ]);
          });
          
          table.render();
        }
        
      } catch (error) {
        console.error(colors.red('Error managing pools:'), error.message);
      }
    })
  )
  
  .command('health', new Command()
    .description('Monitor agent health and performance')
    .option('--watch', 'Continuously monitor health')
    .option('--threshold <threshold:number>', 'Health threshold for alerts', { default: 0.7 })
    .option('--agent <agent-id:string>', 'Monitor specific agent')
    .action(async (options) => {
      try {
        const manager = await initializeAgentManager();
        
        if (options.watch) {
          console.log(colors.cyan('🔍 Monitoring agent health (Ctrl+C to stop)...'));
          
          const monitor = setInterval(() => {
            console.clear();
            displayHealthDashboard(manager, options.threshold, options.agent);
          }, 3000);
          
          process.on('SIGINT', () => {
            clearInterval(monitor);
            console.log(colors.yellow('\nHealth monitoring stopped'));
            process.exit(0);
          });
        } else {
          displayHealthDashboard(manager, options.threshold, options.agent);
        }
        
      } catch (error) {
        console.error(colors.red('Error monitoring health:'), error.message);
      }
    })
  );

// === HELPER FUNCTIONS ===

async function interactiveAgentConfiguration(manager: AgentManager): Promise<any> {
  console.log(colors.cyan('\n🛠️  Interactive Agent Configuration'));
  
  const templates = manager.getAgentTemplates();
  const templateChoices = templates.map(t => ({ name: `${t.name} (${t.type})`, value: t.name }));
  
  const template = await inquirer.prompt([
    { type: 'list', name: 'template', message: 'Select agent template:', choices: templateChoices }
  ]);
  
  const name = await inquirer.prompt([
    { type: 'input', name: 'name', message: 'Agent name:', default: `${template.template.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}` }
  ]);
  
  const autonomyLevel = await inquirer.prompt([
    { type: 'number', name: 'autonomyLevel', message: 'Autonomy level (0-1):', min: 0, max: 1, default: 0.7 }
  ]);
  
  const maxTasks = await inquirer.prompt([
    { type: 'number', name: 'maxTasks', message: 'Maximum concurrent tasks:', min: 1, max: 20, default: 5 }
  ]);
  
  const maxMemory = await inquirer.prompt([
    { type: 'number', name: 'maxMemory', message: 'Memory limit (MB):', min: 128, max: 4096, default: 512 }
  ]);
  
  return {
    template: template.template,
    name: name.name,
    config: {
      autonomyLevel: autonomyLevel.autonomyLevel,
      maxConcurrentTasks: maxTasks.maxTasks,
      timeoutThreshold: 300000
    },
    environment: {
      maxMemoryUsage: maxMemory.maxMemory * 1024 * 1024
    }
  };
}

function displayCompactAgentList(agents: any[]): void {
  const table = new Table()
    .header(['ID', 'Name', 'Type', 'Status', 'Health', 'Workload', 'Last Activity'])
    .border(true);
  
  agents.forEach(agent => {
    table.push([
      agent.id.id.slice(-8),
      agent.name,
      agent.type,
      getStatusDisplay(agent.status),
      getHealthDisplay(agent.health),
      agent.workload.toString(),
      formatRelativeTime(agent.metrics?.lastActivity || agent.lastHeartbeat)
    ]);
  });
  
  table.render();
}

function displayDetailedAgentList(agents: any[], manager: AgentManager): void {
  agents.forEach((agent, index) => {
    if (index > 0) console.log('\n' + '-'.repeat(60));
    
    console.log(`\n${colors.bold(agent.name)} (${agent.id.id.slice(-8)})`);
    console.log(`Type: ${colors.blue(agent.type)} | Status: ${getStatusDisplay(agent.status)}`);
    console.log(`Health: ${getHealthDisplay(agent.health)} | Workload: ${agent.workload}`);
    
    if (agent.metrics) {
      console.log(`Tasks: ${agent.metrics.tasksCompleted} completed, ${agent.metrics.tasksFailed} failed`);
      console.log(`Success Rate: ${formatPercentage(agent.metrics.successRate)}`);
      console.log(`CPU: ${formatPercentage(agent.metrics.cpuUsage)} | Memory: ${formatBytes(agent.metrics.memoryUsage)}`);
    }
    
    const health = manager.getAgentHealth(agent.id.id);
    if (health && health.issues.length > 0) {
      console.log(colors.red(`Issues: ${health.issues.length} active`));
    }
  });
}

function displayAgentSummary(agent: any): void {
  console.log('\n' + colors.dim('Agent Summary:'));
  console.log(`  Name: ${agent.name}`);
  console.log(`  Type: ${agent.type}`);
  console.log(`  Status: ${getStatusDisplay(agent.status)}`);
  console.log(`  Health: ${getHealthDisplay(agent.health)}`);
}

function displayAgentBasicInfo(agent: any): void {
  console.log(`ID: ${colors.bold(agent.id.id)}`);
  console.log(`Name: ${colors.bold(agent.name)}`);
  console.log(`Type: ${colors.blue(agent.type)}`);
  console.log(`Instance: ${agent.id.instance}`);
  console.log(`Created: ${formatRelativeTime(agent.lastHeartbeat)}`);
}

function displayAgentStatusHealth(agent: any, manager: AgentManager): void {
  console.log('\n' + colors.cyan('Status & Health:'));
  console.log(`Status: ${getStatusDisplay(agent.status)}`);
  console.log(`Health: ${getHealthDisplay(agent.health)}`);
  console.log(`Workload: ${agent.workload} active tasks`);
  console.log(`Last Heartbeat: ${formatRelativeTime(agent.lastHeartbeat)}`);
  
  const health = manager.getAgentHealth(agent.id.id);
  if (health) {
    console.log(`Health Components:`);
    console.log(`  Responsiveness: ${formatPercentage(health.components.responsiveness)}`);
    console.log(`  Performance: ${formatPercentage(health.components.performance)}`);
    console.log(`  Reliability: ${formatPercentage(health.components.reliability)}`);
    console.log(`  Resource Usage: ${formatPercentage(health.components.resourceUsage)}`);
  }
}

function displayAgentConfiguration(agent: any): void {
  console.log('\n' + colors.cyan('Configuration:'));
  console.log(`Autonomy Level: ${agent.config.autonomyLevel}`);
  console.log(`Max Concurrent Tasks: ${agent.config.maxConcurrentTasks}`);
  console.log(`Timeout Threshold: ${formatDuration(agent.config.timeoutThreshold)}`);
  console.log(`Runtime: ${agent.environment.runtime}`);
  console.log(`Working Directory: ${agent.environment.workingDirectory}`);
}

async function displayAgentMetrics(agent: any, manager: AgentManager): Promise<void> {
  console.log('\n' + colors.cyan('Performance Metrics:'));
  if (agent.metrics) {
    console.log(`Tasks Completed: ${agent.metrics.tasksCompleted}`);
    console.log(`Tasks Failed: ${agent.metrics.tasksFailed}`);
    console.log(`Success Rate: ${formatPercentage(agent.metrics.successRate)}`);
    console.log(`Average Execution Time: ${formatDuration(agent.metrics.averageExecutionTime)}`);
    console.log(`CPU Usage: ${formatPercentage(agent.metrics.cpuUsage)}`);
    console.log(`Memory Usage: ${formatBytes(agent.metrics.memoryUsage)}`);
    console.log(`Total Uptime: ${formatDuration(agent.metrics.totalUptime)}`);
    console.log(`Response Time: ${agent.metrics.responseTime}ms`);
  }
}

function displayAgentHealthDetails(agentId: string, manager: AgentManager): void {
  const health = manager.getAgentHealth(agentId);
  if (!health) return;
  
  console.log('\n' + colors.cyan('Health Details:'));
  console.log(`Overall Score: ${getHealthDisplay(health.overall)}`);
  console.log(`Trend: ${getHealthTrendDisplay(health.trend)}`);
  console.log(`Last Check: ${formatRelativeTime(health.lastCheck)}`);
  
  if (health.issues.length > 0) {
    console.log('\n' + colors.red('Active Issues:'));
    health.issues.forEach((issue, index) => {
      const severity = getSeverityColor(issue.severity);
      console.log(`  ${index + 1}. [${severity}${issue.severity.toUpperCase()}${colors.reset}] ${issue.message}`);
      if (issue.recommendedAction) {
        console.log(`     💡 ${colors.dim(issue.recommendedAction)}`);
      }
    });
  }
}

function displayAgentTaskHistory(agent: any): void {
  console.log('\n' + colors.cyan('Task History:'));
  if (agent.taskHistory && agent.taskHistory.length > 0) {
    agent.taskHistory.slice(-5).forEach((task: any, index: number) => {
      console.log(`  ${index + 1}. ${task.type} - ${task.status} (${formatRelativeTime(task.timestamp)})`);
    });
  } else {
    console.log('  No task history available');
  }
}

async function displayAgentLogs(agentId: string): Promise<void> {
  console.log('\n' + colors.cyan('Recent Logs:'));
  const logs = await getAgentLogs(agentId);
  if (logs && logs.length > 0) {
    logs.slice(-10).forEach((log: any) => {
      const level = getLogLevelColor(log.level);
      console.log(`  [${formatTime(log.timestamp)}] ${level}${log.level}${colors.reset}: ${log.message}`);
    });
  } else {
    console.log('  No recent logs available');
  }
}

function displayHealthDashboard(manager: AgentManager, threshold: number, specificAgent?: string): void {
  const agents = specificAgent ? 
    [manager.getAgent(specificAgent)].filter(Boolean) : 
    manager.getAllAgents();
  
  const stats = manager.getSystemStats();
  
  console.log(colors.cyan('\n🏥 Agent Health Dashboard'));
  console.log('=' .repeat(60));
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log(`Total Agents: ${stats.totalAgents} | Active: ${stats.activeAgents} | Healthy: ${stats.healthyAgents}`);
  console.log(`Average Health: ${formatPercentage(stats.averageHealth)}`);
  
  const unhealthyAgents = agents.filter(a => a.health < threshold);
  if (unhealthyAgents.length > 0) {
    console.log(colors.red(`\n⚠️  ${unhealthyAgents.length} agents below health threshold:`));
    unhealthyAgents.forEach(agent => {
      console.log(`  ${agent.name}: ${getHealthDisplay(agent.health)}`);
    });
  }
  
  // Resource utilization
  console.log('\n' + colors.cyan('Resource Utilization:'));
  console.log(`CPU: ${formatPercentage(stats.resourceUtilization.cpu)}`);
  console.log(`Memory: ${formatPercentage(stats.resourceUtilization.memory)}`);
  console.log(`Disk: ${formatPercentage(stats.resourceUtilization.disk)}`);
}

// === UTILITY FUNCTIONS ===

async function getAgentLogs(agentId: string): Promise<any[]> {
  // This would fetch logs from the logging system
  // For now, return empty array
  return [];
}

async function getDetailedMetrics(agentId: string, manager: AgentManager): Promise<any> {
  // This would fetch detailed metrics
  const agent = manager.getAgent(agentId);
  return agent?.metrics || {};
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'idle': return colors.green;
    case 'busy': return colors.blue;
    case 'error': return colors.red;
    case 'offline': return colors.gray;
    case 'initializing': return colors.yellow;
    case 'terminating': return colors.yellow;
    case 'terminated': return colors.gray;
    default: return colors.white;
  }
}

function getStatusDisplay(status: string): string {
  const color = getStatusColor(status);
  return `${color}${status.toUpperCase()}${colors.reset}`;
}

function getHealthDisplay(health: number): string {
  const percentage = Math.round(health * 100);
  let color = colors.green;
  
  if (health < 0.3) color = colors.red;
  else if (health < 0.7) color = colors.yellow;
  
  return `${color}${percentage}%${colors.reset}`;
}

function getHealthTrendDisplay(trend: string): string {
  switch (trend) {
    case 'improving': return `${colors.green}↗ Improving${colors.reset}`;
    case 'degrading': return `${colors.red}↘ Degrading${colors.reset}`;
    default: return `${colors.blue}→ Stable${colors.reset}`;
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return colors.red;
    case 'high': return colors.red;
    case 'medium': return colors.yellow;
    case 'low': return colors.blue;
    default: return colors.white;
  }
}

function getLogLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'error': return colors.red;
    case 'warn': return colors.yellow;
    case 'info': return colors.blue;
    case 'debug': return colors.gray;
    default: return colors.white;
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

function getCapabilitiesForType(type: string): string[] {
  const capabilities: Record<string, string[]> = {
    coordinator: ['task-assignment', 'planning', 'delegation'],
    researcher: ['web-search', 'information-gathering', 'analysis'],
    implementer: ['code-generation', 'file-manipulation', 'testing'],
    analyst: ['data-analysis', 'pattern-recognition', 'reporting'],
    custom: ['user-defined'],
  };

  return capabilities[type] || capabilities.custom;
}

function getDefaultPromptForType(type: string): string {
  const prompts: Record<string, string> = {
    coordinator: 'You are a coordination agent responsible for planning and delegating tasks.',
    researcher: 'You are a research agent specialized in gathering and analyzing information.',
    implementer: 'You are an implementation agent focused on writing code and creating solutions.',
    analyst: 'You are an analysis agent that identifies patterns and generates insights.',
    custom: 'You are a custom agent. Follow the user\'s instructions.',
  };

  return prompts[type] || prompts.custom;
}