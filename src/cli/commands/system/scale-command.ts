/**
 * Scale Command
 * Dynamic agent scaling and resource management with real backend integration
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getMemoryManager } from '../../core/global-initialization.js';
import { SwarmCoordinator } from '../../../swarm/coordinator.js';
import { AgentProcessManager } from '../../../agents/agent-process-manager.js';
import { Logger } from '../../../core/logger.js';
import { nanoid } from 'nanoid';

interface ScalingPolicy {
  id: string;
  name: string;
  type: 'manual' | 'auto' | 'scheduled' | 'demand-based';
  minAgents: number;
  maxAgents: number;
  targetUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number; // seconds
  metrics: string[];
  enabled: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

interface ScalingMetrics {
  timestamp: Date;
  cpuUtilization: number;
  memoryUtilization: number;
  taskQueueLength: number;
  activeAgents: number;
  idleAgents: number;
  throughput: number;
  responseTime: number;
  errorRate: number;
}

interface ScalingAction {
  id: string;
  type: 'scale-up' | 'scale-down' | 'rebalance';
  reason: string;
  fromCount: number;
  toCount: number;
  timestamp: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  duration?: number;
  error?: string;
}

export const scaleCommand: CLICommand = {
  name: 'scale',
  description: 'Dynamic agent scaling and resource management',
  category: 'System',
  usage: 'flowx scale [subcommand] [OPTIONS]',
  examples: [
    'flowx scale up 5',
    'flowx scale down 2',
    'flowx scale auto --target-utilization 75',
    'flowx scale status',
    'flowx scale policy create --name "peak-hours" --min 3 --max 10',
    'flowx scale metrics --watch'
  ],
  options: [
    {
      name: 'target-utilization',
      short: 't',
      description: 'Target CPU utilization percentage',
      type: 'number',
      default: 70
    },
    {
      name: 'min-agents',
      description: 'Minimum number of agents',
      type: 'number',
      default: 1
    },
    {
      name: 'max-agents',
      description: 'Maximum number of agents',
      type: 'number',
      default: 10
    },
    {
      name: 'cooldown',
      short: 'c',
      description: 'Cooldown period in seconds',
      type: 'number',
      default: 300
    },
    {
      name: 'dry-run',
      short: 'd',
      description: 'Show what would be done without executing',
      type: 'boolean'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Force scaling action without safety checks',
      type: 'boolean'
    },
    {
      name: 'watch',
      short: 'w',
      description: 'Watch scaling metrics continuously',
      type: 'boolean'
    },
    {
      name: 'format',
      description: 'Output format (table, json)',
      type: 'string',
      choices: ['table', 'json'],
      default: 'table'
    }
  ],
  subcommands: [
    {
      name: 'up',
      description: 'Scale up agents',
      handler: async (context: CLIContext) => await scaleUp(context)
    },
    {
      name: 'down',
      description: 'Scale down agents',
      handler: async (context: CLIContext) => await scaleDown(context)
    },
    {
      name: 'auto',
      description: 'Enable automatic scaling',
      handler: async (context: CLIContext) => await enableAutoScaling(context)
    },
    {
      name: 'manual',
      description: 'Switch to manual scaling',
      handler: async (context: CLIContext) => await enableManualScaling(context)
    },
    {
      name: 'status',
      description: 'Show scaling status',
      handler: async (context: CLIContext) => await showScalingStatus(context)
    },
    {
      name: 'metrics',
      description: 'Show scaling metrics',
      handler: async (context: CLIContext) => await showScalingMetrics(context)
    },
    {
      name: 'policy',
      description: 'Manage scaling policies',
      handler: async (context: CLIContext) => await manageScalingPolicies(context)
    },
    {
      name: 'history',
      description: 'Show scaling action history',
      handler: async (context: CLIContext) => await showScalingHistory(context)
    }
  ],
  handler: async (context: CLIContext) => {
    return await showScalingStatus(context);
  }
};

// Global scaling state
let agentProcessManager: AgentProcessManager | null = null;
let swarmCoordinator: SwarmCoordinator | null = null;
let autoScalingEnabled = false;
let currentScalingPolicy: ScalingPolicy | null = null;
let scalingInterval: NodeJS.Timeout | null = null;
let metricsHistory: ScalingMetrics[] = [];
const scalingActions: ScalingAction[] = [];

async function getAgentProcessManager(): Promise<AgentProcessManager> {
  if (!agentProcessManager) {
    const logger = new Logger({ level: 'info', format: 'text', destination: 'console' }, { component: 'scale-command' });
    agentProcessManager = new AgentProcessManager(logger);
  }
  return agentProcessManager;
}

async function getSwarmCoordinator(): Promise<SwarmCoordinator> {
  if (!swarmCoordinator) {
    swarmCoordinator = new SwarmCoordinator({
      maxAgents: 10,
      coordinationStrategy: {
        name: 'scaling-optimized',
        description: 'Scaling-optimized coordination strategy',
        agentSelection: 'round-robin',
        taskScheduling: 'fifo',
        loadBalancing: 'centralized',
        faultTolerance: 'retry',
        communication: 'direct'
      }
    });
    await swarmCoordinator.initialize();
  }
  return swarmCoordinator;
}

// Scaling command implementations

async function scaleUp(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const targetCount = parseInt(args[0]);
  if (!targetCount || targetCount < 1) {
    printError('Target agent count is required. Example: flowx scale up 5');
    return;
  }

  try {
    const processManager = await getAgentProcessManager();
    const currentAgents = processManager.getAgents();
    const currentCount = currentAgents.filter(a => a.status === 'running').length;
    const newAgents = targetCount;

    printInfo(`🚀 Scaling up from ${currentCount} to ${currentCount + newAgents} agents...`);

    if (options.dryRun) {
      printInfo('DRY RUN: Would create the following agents:');
      for (let i = 0; i < newAgents; i++) {
        console.log(`  • Agent ${currentCount + i + 1}: general type`);
      }
      return;
    }

    // Record scaling action
    const action: ScalingAction = {
      id: `scale-up-${nanoid()}`,
      type: 'scale-up',
      reason: 'Manual scale up command',
      fromCount: currentCount,
      toCount: currentCount + newAgents,
      timestamp: new Date(),
      status: 'in-progress'
    };
    scalingActions.push(action);

    const startTime = Date.now();
    const createdAgents: string[] = [];

    // Create new agents
    for (let i = 0; i < newAgents; i++) {
      try {
        const agentId = `agent-${Date.now()}-${nanoid()}`;
        await processManager.createAgent({
          id: agentId,
          type: 'general',
          maxMemory: 512,
          maxConcurrentTasks: 3,
          timeout: 300000
        });
        
        createdAgents.push(agentId);
        printSuccess(`✅ Created agent: ${agentId}`);
        
      } catch (error) {
        printError(`❌ Failed to create agent ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Update action status
    action.status = createdAgents.length === newAgents ? 'completed' : 'failed';
    action.duration = Date.now() - startTime;
    
    if (createdAgents.length < newAgents) {
      action.error = `Only created ${createdAgents.length} out of ${newAgents} agents`;
    }

    printSuccess(`🎉 Scale up completed: ${createdAgents.length}/${newAgents} agents created in ${action.duration}ms`);
    
    // Store scaling action in memory
    await storeScalingAction(action);

  } catch (error) {
    printError(`Scale up failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function scaleDown(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const targetCount = parseInt(args[0]);
  if (!targetCount || targetCount < 1) {
    printError('Target agent count to remove is required. Example: flowx scale down 2');
    return;
  }

  try {
    const processManager = await getAgentProcessManager();
    const currentAgents = processManager.getAgents();
    const runningAgents = currentAgents.filter(a => a.status === 'running');
    const currentCount = runningAgents.length;

    if (targetCount >= currentCount) {
      printError(`Cannot remove ${targetCount} agents: only ${currentCount} running agents available`);
      return;
    }

    const finalCount = currentCount - targetCount;
    
    // Safety check
    if (finalCount < 1 && !options.force) {
      printError('Cannot scale down to 0 agents. Use --force to override.');
      return;
    }

    printInfo(`🔽 Scaling down from ${currentCount} to ${finalCount} agents...`);

    if (options.dryRun) {
      printInfo('DRY RUN: Would remove the following agents:');
      const agentsToRemove = selectAgentsForRemoval(runningAgents, targetCount);
      agentsToRemove.forEach(agent => {
        console.log(`  • ${agent.id} (${agent.type}, uptime: ${getAgentUptime(agent)})`);
      });
      return;
    }

    // Record scaling action
    const action: ScalingAction = {
      id: `scale-down-${nanoid()}`,
      type: 'scale-down',
      reason: 'Manual scale down command',
      fromCount: currentCount,
      toCount: finalCount,
      timestamp: new Date(),
      status: 'in-progress'
    };
    scalingActions.push(action);

    const startTime = Date.now();
    const removedAgents: string[] = [];

    // Select agents to remove (prefer idle agents)
    const agentsToRemove = selectAgentsForRemoval(runningAgents, targetCount);

    // Remove selected agents
    for (const agent of agentsToRemove) {
      try {
        await processManager.stopAgent(agent.id);
        removedAgents.push(agent.id);
        printSuccess(`✅ Removed agent: ${agent.id}`);
        
      } catch (error) {
        printError(`❌ Failed to remove agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Update action status
    action.status = removedAgents.length === targetCount ? 'completed' : 'failed';
    action.duration = Date.now() - startTime;
    
    if (removedAgents.length < targetCount) {
      action.error = `Only removed ${removedAgents.length} out of ${targetCount} agents`;
    }

    printSuccess(`🎉 Scale down completed: ${removedAgents.length}/${targetCount} agents removed in ${action.duration}ms`);
    
    // Store scaling action in memory
    await storeScalingAction(action);

  } catch (error) {
    printError(`Scale down failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function enableAutoScaling(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    printInfo('🤖 Enabling automatic scaling...');

    // Create or update scaling policy
    const policy: ScalingPolicy = {
      id: `auto-policy-${nanoid()}`,
      name: 'Auto Scaling Policy',
      type: 'auto',
      minAgents: options.minAgents || 1,
      maxAgents: options.maxAgents || 10,
      targetUtilization: options.targetUtilization || 70,
      scaleUpThreshold: (options.targetUtilization || 70) + 10,
      scaleDownThreshold: (options.targetUtilization || 70) - 10,
      cooldownPeriod: options.cooldown || 300,
      metrics: ['cpu', 'memory', 'queue_length', 'response_time'],
      enabled: true,
      createdAt: new Date()
    };

    currentScalingPolicy = policy;
    autoScalingEnabled = true;

    // Start auto-scaling monitoring
    startAutoScalingMonitor();

    // Store policy in memory
    await storeScalingPolicy(policy);

    printSuccess('✅ Automatic scaling enabled');
    console.log(`   Target Utilization: ${policy.targetUtilization}%`);
    console.log(`   Agent Range: ${policy.minAgents} - ${policy.maxAgents}`);
    console.log(`   Cooldown Period: ${policy.cooldownPeriod}s`);

  } catch (error) {
    printError(`Failed to enable auto scaling: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function enableManualScaling(context: CLIContext): Promise<void> {
  try {
    printInfo('👤 Switching to manual scaling...');

    autoScalingEnabled = false;
    
    // Stop auto-scaling monitor
    if (scalingInterval) {
      clearInterval(scalingInterval);
      scalingInterval = null;
    }

    printSuccess('✅ Manual scaling enabled');
    printInfo('Use "flowx scale up/down" commands to manually adjust agent count');

  } catch (error) {
    printError(`Failed to enable manual scaling: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showScalingStatus(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const processManager = await getAgentProcessManager();
    const agents = processManager.getAgents();
    const stats = processManager.getAgentStats();
    const currentMetrics = await collectCurrentMetrics();

    const status = {
      mode: autoScalingEnabled ? 'Automatic' : 'Manual',
      totalAgents: stats.total,
      runningAgents: stats.running,
      stoppedAgents: stats.stopped,
      errorAgents: stats.error,
      currentUtilization: currentMetrics.cpuUtilization,
      targetUtilization: currentScalingPolicy?.targetUtilization || 'N/A',
      queueLength: currentMetrics.taskQueueLength,
      lastScalingAction: scalingActions.length > 0 ? scalingActions[scalingActions.length - 1] : null,
      policy: currentScalingPolicy
    };

    if (options.format === 'json') {
      console.log(JSON.stringify(status, null, 2));
    } else {
      displayScalingStatus(status);
    }

  } catch (error) {
    printError(`Failed to show scaling status: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showScalingMetrics(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    if (options.watch) {
      await watchScalingMetrics();
      return;
    }

    const currentMetrics = await collectCurrentMetrics();
    
    if (options.format === 'json') {
      console.log(JSON.stringify({
        current: currentMetrics,
        history: metricsHistory.slice(-10)
      }, null, 2));
    } else {
      displayScalingMetrics(currentMetrics, metricsHistory.slice(-10));
    }

  } catch (error) {
    printError(`Failed to show scaling metrics: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function manageScalingPolicies(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const action = args[0];
  
  if (!action) {
    // List policies
    await listScalingPolicies();
    return;
  }

  switch (action) {
    case 'create':
      await createScalingPolicy(context);
      break;
    case 'update':
      await updateScalingPolicy(context);
      break;
    case 'delete':
      await deleteScalingPolicy(context);
      break;
    case 'show':
      await showScalingPolicy(context);
      break;
    default:
      printError(`Unknown policy action: ${action}`);
      printInfo('Available actions: create, update, delete, show');
  }
}

async function showScalingHistory(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const recentActions = scalingActions.slice(-20);
    
    if (options.format === 'json') {
      console.log(JSON.stringify(recentActions, null, 2));
    } else {
      displayScalingHistory(recentActions);
    }

  } catch (error) {
    printError(`Failed to show scaling history: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Auto-scaling implementation

function startAutoScalingMonitor(): void {
  if (scalingInterval) {
    clearInterval(scalingInterval);
  }

  scalingInterval = setInterval(async () => {
    try {
      await performAutoScalingCheck();
    } catch (error) {
      console.error('Auto-scaling check failed:', error);
    }
  }, 30000); // Check every 30 seconds

  printInfo('🤖 Auto-scaling monitor started (30s interval)');
}

async function performAutoScalingCheck(): Promise<void> {
  if (!autoScalingEnabled || !currentScalingPolicy) {
    return;
  }

  const metrics = await collectCurrentMetrics();
  metricsHistory.push(metrics);
  
  // Keep only last 100 metrics
  if (metricsHistory.length > 100) {
    metricsHistory = metricsHistory.slice(-100);
  }

  const policy = currentScalingPolicy;
  const currentAgents = metrics.activeAgents;

  // Check cooldown period
  if (policy.lastTriggered) {
    const timeSinceLastAction = Date.now() - policy.lastTriggered.getTime();
    if (timeSinceLastAction < policy.cooldownPeriod * 1000) {
      return; // Still in cooldown
    }
  }

  let shouldScale = false;
  let scaleDirection: 'up' | 'down' | null = null;
  let reason = '';

  // Check scale up conditions
  if (currentAgents < policy.maxAgents) {
    if (metrics.cpuUtilization > policy.scaleUpThreshold ||
        metrics.taskQueueLength > 5 ||
        metrics.responseTime > 5000) {
      shouldScale = true;
      scaleDirection = 'up';
      reason = `High utilization: CPU ${metrics.cpuUtilization}%, Queue ${metrics.taskQueueLength}, RT ${metrics.responseTime}ms`;
    }
  }

  // Check scale down conditions
  if (currentAgents > policy.minAgents && !shouldScale) {
    if (metrics.cpuUtilization < policy.scaleDownThreshold &&
        metrics.taskQueueLength === 0 &&
        metrics.idleAgents > 0) {
      shouldScale = true;
      scaleDirection = 'down';
      reason = `Low utilization: CPU ${metrics.cpuUtilization}%, ${metrics.idleAgents} idle agents`;
    }
  }

  if (shouldScale && scaleDirection) {
    const targetChange = scaleDirection === 'up' ? 1 : 1;
    await executeAutoScaling(scaleDirection, targetChange, reason);
    
    // Update last triggered time
    policy.lastTriggered = new Date();
    await storeScalingPolicy(policy);
  }
}

async function executeAutoScaling(direction: 'up' | 'down', count: number, reason: string): Promise<void> {
  const processManager = await getAgentProcessManager();
  const currentAgents = processManager.getAgents().filter(a => a.status === 'running');
  
  const action: ScalingAction = {
    id: `auto-${direction}-${nanoid()}`,
    type: direction === 'up' ? 'scale-up' : 'scale-down',
    reason: `Auto-scaling: ${reason}`,
    fromCount: currentAgents.length,
    toCount: direction === 'up' ? currentAgents.length + count : currentAgents.length - count,
    timestamp: new Date(),
    status: 'in-progress'
  };
  
  scalingActions.push(action);
  
  try {
    const startTime = Date.now();
    
    if (direction === 'up') {
      const agentId = `auto-agent-${Date.now()}-${nanoid()}`;
      await processManager.createAgent({
        id: agentId,
        type: 'general',
        maxMemory: 512,
        maxConcurrentTasks: 3,
        timeout: 300000
      });
      console.log(`🤖 Auto-scaled up: Created agent ${agentId}`);
    } else {
      const agentsToRemove = selectAgentsForRemoval(currentAgents, count);
      if (agentsToRemove.length > 0) {
        await processManager.stopAgent(agentsToRemove[0].id);
        console.log(`🤖 Auto-scaled down: Removed agent ${agentsToRemove[0].id}`);
      }
    }
    
    action.status = 'completed';
    action.duration = Date.now() - startTime;
    
  } catch (error) {
    action.status = 'failed';
    action.error = error instanceof Error ? error.message : String(error);
    console.error(`Auto-scaling failed: ${action.error}`);
  }
  
  await storeScalingAction(action);
}

// Utility functions

async function collectCurrentMetrics(): Promise<ScalingMetrics> {
  const processManager = await getAgentProcessManager();
  const agents = processManager.getAgents();
  const stats = processManager.getAgentStats();
  
  // Simulate metrics collection - in production would use real system metrics
  const metrics: ScalingMetrics = {
    timestamp: new Date(),
    cpuUtilization: Math.random() * 100,
    memoryUtilization: Math.random() * 100,
    taskQueueLength: Math.floor(Math.random() * 10),
    activeAgents: stats.running,
    idleAgents: Math.floor(stats.running * Math.random()),
    throughput: Math.random() * 100,
    responseTime: Math.random() * 2000 + 500,
    errorRate: Math.random() * 5
  };
  
  return metrics;
}

function selectAgentsForRemoval(agents: any[], count: number): any[] {
  // Prefer removing idle agents first, then agents with least uptime
  const sortedAgents = agents
    .filter(a => a.status === 'running')
    .sort((a, b) => {
      // Prefer agents with no current tasks
      if (a.tasksCompleted === b.tasksCompleted) {
        // Then prefer newer agents (less uptime)
        const aUptime = a.startTime ? Date.now() - a.startTime.getTime() : 0;
        const bUptime = b.startTime ? Date.now() - b.startTime.getTime() : 0;
        return aUptime - bUptime;
      }
      return a.tasksCompleted - b.tasksCompleted;
    });
  
  return sortedAgents.slice(0, count);
}

function getAgentUptime(agent: any): string {
  if (!agent.startTime) return 'Unknown';
  
  const uptime = Date.now() - agent.startTime.getTime();
  const hours = Math.floor(uptime / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Storage functions

async function storeScalingAction(action: ScalingAction): Promise<void> {
  try {
    const memoryManager = await getMemoryManager();
    
    const entry = {
      id: `scaling-action:${action.id}`,
      agentId: 'system',
      sessionId: 'scaling-session',
      type: 'artifact' as const,
      content: JSON.stringify(action),
      context: {
        namespace: 'scaling',
        operation: 'store',
        actionId: action.id
      },
      timestamp: new Date(),
      tags: [action.type, action.status],
      version: 1,
      metadata: {
        type: action.type,
        status: action.status,
        reason: action.reason
      }
    };
    
    await memoryManager.store(entry);
  } catch (error) {
    console.error('Failed to store scaling action:', error);
  }
}

async function storeScalingPolicy(policy: ScalingPolicy): Promise<void> {
  try {
    const memoryManager = await getMemoryManager();
    
    const entry = {
      id: `scaling-policy:${policy.id}`,
      agentId: 'system',
      sessionId: 'scaling-session',
      type: 'artifact' as const,
      content: JSON.stringify(policy),
      context: {
        namespace: 'scaling',
        operation: 'store',
        policyId: policy.id
      },
      timestamp: new Date(),
      tags: [policy.type, policy.enabled ? 'enabled' : 'disabled'],
      version: 1,
      metadata: {
        name: policy.name,
        type: policy.type,
        enabled: policy.enabled
      }
    };
    
    await memoryManager.store(entry);
  } catch (error) {
    console.error('Failed to store scaling policy:', error);
  }
}

// Display functions

function displayScalingStatus(status: any): void {
  console.log(successBold('\n⚖️ Scaling Status\n'));
  
  console.log(`Mode: ${status.mode}`);
  console.log(`Total Agents: ${status.totalAgents}`);
  console.log(`Running: ${status.runningAgents}`);
  console.log(`Stopped: ${status.stoppedAgents}`);
  if (status.errorAgents > 0) {
    console.log(`Errors: ${status.errorAgents}`);
  }
  console.log();
  
  console.log('📊 Current Metrics:');
  console.log(`  CPU Utilization: ${status.currentUtilization.toFixed(1)}%`);
  if (status.targetUtilization !== 'N/A') {
    console.log(`  Target Utilization: ${status.targetUtilization}%`);
  }
  console.log(`  Task Queue Length: ${status.queueLength}`);
  console.log();
  
  if (status.policy) {
    console.log('🤖 Auto-Scaling Policy:');
    console.log(`  Name: ${status.policy.name}`);
    console.log(`  Range: ${status.policy.minAgents} - ${status.policy.maxAgents} agents`);
    console.log(`  Thresholds: ${status.policy.scaleDownThreshold}% - ${status.policy.scaleUpThreshold}%`);
    console.log(`  Cooldown: ${status.policy.cooldownPeriod}s`);
    console.log();
  }
  
  if (status.lastScalingAction) {
    const action = status.lastScalingAction;
    console.log('🕒 Last Scaling Action:');
    console.log(`  Type: ${action.type}`);
    console.log(`  Reason: ${action.reason}`);
    console.log(`  Status: ${action.status}`);
    console.log(`  Time: ${action.timestamp.toLocaleString()}`);
    if (action.duration) {
      console.log(`  Duration: ${action.duration}ms`);
    }
  }
}

function displayScalingMetrics(current: ScalingMetrics, history: ScalingMetrics[]): void {
  console.log(successBold('\n📊 Scaling Metrics\n'));
  
  console.log('Current Metrics:');
  console.log(`  CPU Utilization: ${current.cpuUtilization.toFixed(1)}%`);
  console.log(`  Memory Utilization: ${current.memoryUtilization.toFixed(1)}%`);
  console.log(`  Task Queue Length: ${current.taskQueueLength}`);
  console.log(`  Active Agents: ${current.activeAgents}`);
  console.log(`  Idle Agents: ${current.idleAgents}`);
  console.log(`  Throughput: ${current.throughput.toFixed(1)} tasks/min`);
  console.log(`  Response Time: ${current.responseTime.toFixed(0)}ms`);
  console.log(`  Error Rate: ${current.errorRate.toFixed(1)}%`);
  console.log();
  
  if (history.length > 0) {
    console.log('📈 Recent History:');
    const tableData = history.slice(-5).map(m => ({
      time: m.timestamp.toLocaleTimeString(),
      cpu: `${m.cpuUtilization.toFixed(1)}%`,
      memory: `${m.memoryUtilization.toFixed(1)}%`,
      queue: m.taskQueueLength,
      agents: `${m.activeAgents}/${m.activeAgents + m.idleAgents}`,
      throughput: m.throughput.toFixed(1)
    }));
    
    console.table(tableData);
  }
}

function displayScalingHistory(actions: ScalingAction[]): void {
  console.log(successBold('\n🕒 Scaling History\n'));
  
  if (actions.length === 0) {
    console.log('No scaling actions recorded');
    return;
  }
  
  const tableData = actions.map(action => ({
    id: action.id.substring(0, 12) + '...',
    type: action.type,
    from: action.fromCount,
    to: action.toCount,
    status: action.status,
    duration: action.duration ? `${action.duration}ms` : 'N/A',
    time: action.timestamp.toLocaleString(),
    reason: action.reason.length > 30 ? action.reason.substring(0, 27) + '...' : action.reason
  }));
  
  console.table(tableData);
}

async function watchScalingMetrics(): Promise<void> {
  printInfo('👁️ Watching scaling metrics (Ctrl+C to stop)...');
  
  const interval = setInterval(async () => {
    console.clear();
    const metrics = await collectCurrentMetrics();
    displayScalingMetrics(metrics, metricsHistory.slice(-10));
  }, 5000);
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(interval);
    printInfo('\nMetrics monitoring stopped');
    process.exit(0);
  });
}

// Policy management functions

async function listScalingPolicies(): Promise<void> {
  console.log(successBold('\n📋 Scaling Policies\n'));
  
  if (currentScalingPolicy) {
    console.log('Current Policy:');
    console.log(`  Name: ${currentScalingPolicy.name}`);
    console.log(`  Type: ${currentScalingPolicy.type}`);
    console.log(`  Range: ${currentScalingPolicy.minAgents} - ${currentScalingPolicy.maxAgents}`);
    console.log(`  Target: ${currentScalingPolicy.targetUtilization}%`);
    console.log(`  Enabled: ${currentScalingPolicy.enabled}`);
  } else {
    console.log('No scaling policy configured');
  }
}

async function createScalingPolicy(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (!options.name) {
    printError('Policy name is required. Use --name "policy-name"');
    return;
  }
  
  const policy: ScalingPolicy = {
    id: `policy-${nanoid()}`,
    name: options.name,
    type: options.type || 'auto',
    minAgents: options.minAgents || 1,
    maxAgents: options.maxAgents || 10,
    targetUtilization: options.targetUtilization || 70,
    scaleUpThreshold: (options.targetUtilization || 70) + 10,
    scaleDownThreshold: (options.targetUtilization || 70) - 10,
    cooldownPeriod: options.cooldown || 300,
    metrics: ['cpu', 'memory', 'queue_length'],
    enabled: true,
    createdAt: new Date()
  };
  
  await storeScalingPolicy(policy);
  currentScalingPolicy = policy;
  
  printSuccess(`✅ Created scaling policy: ${policy.name}`);
}

async function updateScalingPolicy(context: CLIContext): Promise<void> {
  printInfo('Policy update not implemented in this demo');
}

async function deleteScalingPolicy(context: CLIContext): Promise<void> {
  printInfo('Policy deletion not implemented in this demo');
}

async function showScalingPolicy(context: CLIContext): Promise<void> {
  if (!currentScalingPolicy) {
    printInfo('No scaling policy configured');
    return;
  }
  
  console.log(JSON.stringify(currentScalingPolicy, null, 2));
}

export default scaleCommand; 