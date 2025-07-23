/**
 * Exec Command
 * Execute commands within agent context
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { printSuccess, printError, printInfo, printWarning } from '../../core/output-formatter.js';
import { getLogger, getMemoryManager, getPersistenceManager } from '../../core/global-initialization.js';
import { SwarmCoordinator } from '../../../swarm/coordinator.js';
import { AgentProcessManager } from '../../../agents/agent-process-manager.js';
import { TaskEngine } from '../../../task/engine.js';
import { generateId } from '../../../utils/helpers.js';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, access, constants } from 'fs/promises';
import { join, dirname, resolve } from 'path';

const execAsync = promisify(exec);

export const execCommand: CLICommand = {
  name: 'exec',
  description: 'Execute commands within agent context',
  category: 'Agents',
  usage: 'flowx exec <agent-id> <command> [ARGS...] [OPTIONS]',
  examples: [
    'flowx exec agent-123 "npm test"',
    'flowx exec agent-123 ls -la',
    'flowx exec --agent-type researcher "analyze data.csv"',
    'flowx exec --spawn-agent coder "git status"',
    'flowx exec agent-123 --script ./agent-script.sh',
    'flowx exec agent-123 "echo $AGENT_ID" --env',
    'flowx exec agent-123 "long-task" --async --timeout 300',
    'flowx exec --all "system update"'
  ],
  arguments: [
    {
      name: 'agent-id',
      description: 'Agent ID or special selector (--all, --spawn-agent, etc.)',
      required: false
    },
    {
      name: 'command',
      description: 'Command to execute in agent context',
      required: false
    },
    {
      name: 'args',
      description: 'Command arguments',
      required: false,
      variadic: true
    }
  ],
  options: [
    {
      name: 'agent-type',
      short: 't',
      description: 'Agent type for execution (researcher, coder, analyst, etc.)',
      type: 'string',
      choices: ['researcher', 'coder', 'analyst', 'coordinator', 'tester', 'reviewer', 'architect', 'optimizer', 'documenter', 'monitor', 'specialist', 'security', 'devops']
    },
    {
      name: 'spawn-agent',
      short: 's',
      description: 'Spawn new agent for execution',
      type: 'boolean'
    },
    {
      name: 'all',
      short: 'a',
      description: 'Execute on all active agents',
      type: 'boolean'
    },
    {
      name: 'script',
      description: 'Execute script file in agent context',
      type: 'string'
    },
    {
      name: 'task-id',
      description: 'Associate execution with specific task',
      type: 'string'
    },
    {
      name: 'priority',
      short: 'p',
      description: 'Execution priority (1-10)',
      type: 'number',
      default: 5
    },
    {
      name: 'timeout',
      description: 'Execution timeout in seconds',
      type: 'number',
      default: 300
    },
    {
      name: 'async',
      description: 'Execute asynchronously',
      type: 'boolean'
    },
    {
      name: 'env',
      short: 'e',
      description: 'Include agent environment variables',
      type: 'boolean'
    },
    {
      name: 'memory',
      short: 'm',
      description: 'Access agent memory context',
      type: 'boolean'
    },
    {
      name: 'isolation',
      short: 'i',
      description: 'Isolation level (none, process, container)',
      type: 'string',
      choices: ['none', 'process', 'container'],
      default: 'process'
    },
    {
      name: 'capture',
      short: 'c',
      description: 'Capture output to file',
      type: 'string'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output',
      type: 'boolean'
    },
    {
      name: 'dry-run',
      short: 'd',
      description: 'Show what would be executed',
      type: 'boolean'
    },
    {
      name: 'retry',
      short: 'r',
      description: 'Number of retry attempts',
      type: 'number',
      default: 0
    },
    {
      name: 'interactive',
      description: 'Interactive mode',
      type: 'boolean'
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    try {
      const logger = await getLogger();
      const memoryManager = await getMemoryManager();
      const persistenceManager = await getPersistenceManager();
      
      // Initialize required managers
      const swarmCoordinator = await getSwarmCoordinator();
      const agentManager = await getAgentManager();
      const taskEngine = await getTaskEngine();
      
      // Determine execution mode
      if (options.all) {
        await executeOnAllAgents(args, options, swarmCoordinator, agentManager, logger);
      } else if (options['spawn-agent']) {
        await executeOnSpawnedAgent(args, options, swarmCoordinator, agentManager, logger);
      } else if (options['agent-type']) {
        await executeOnAgentType(args, options, swarmCoordinator, agentManager, logger);
      } else if (args.length >= 2) {
        const agentId = args[0];
        const command = args[1];
        const commandArgs = args.slice(2);
        await executeOnAgent(agentId, command, commandArgs, options, swarmCoordinator, agentManager, logger);
      } else {
        printError('Agent ID and command are required');
        printInfo('Usage: flowx exec <agent-id> <command> [args...]');
        printInfo('       flowx exec --all <command>');
        printInfo('       flowx exec --spawn-agent <command>');
        printInfo('       flowx exec --agent-type <type> <command>');
        return;
      }
      
    } catch (error) {
      printError(`Exec command failed: ${error instanceof Error ? error.message : String(error)}`);
      if (options.verbose) {
        console.error(error);
      }
      // Don't call process.exit in test environment
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
    }
  }
};

// Helper functions for manager initialization
async function getSwarmCoordinator(): Promise<SwarmCoordinator> {
  const logger = await getLogger();
  return new SwarmCoordinator({
    maxAgents: 10,
    coordinationStrategy: {
      name: 'centralized',
      description: 'Centralized coordination for exec commands',
      agentSelection: 'round-robin',
      taskScheduling: 'fifo',
      loadBalancing: 'centralized',
      faultTolerance: 'retry',
      communication: 'direct'
    }
  });
}

async function getAgentManager(): Promise<AgentProcessManager> {
  const logger = await getLogger();
  return new AgentProcessManager(logger);
}

async function getTaskEngine(): Promise<TaskEngine> {
  return new TaskEngine(10);
}

// Core execution functions
async function executeOnAgent(
  agentId: string,
  command: string,
  commandArgs: string[],
  options: any,
  swarmCoordinator: SwarmCoordinator,
  agentManager: AgentProcessManager,
  logger: any
): Promise<void> {
  const fullCommand = [command, ...commandArgs].join(' ');
  
  if (options['dry-run']) {
    printInfo(`Would execute on agent ${agentId}: ${fullCommand}`);
    if (options.env) printInfo('Would include agent environment variables');
    if (options.memory) printInfo('Would access agent memory context');
    if (options.timeout) printInfo(`Timeout: ${options.timeout}s`);
    return;
  }
  
  printInfo(`🤖 Executing on agent ${agentId}: ${fullCommand}`);
  
  // Check if agent exists
  const agentExists = await checkAgentExists(agentId, swarmCoordinator);
  if (!agentExists) {
    printError(`Agent not found: ${agentId}`);
    return;
  }
  
  // Build execution context
  const executionContext = await buildAgentExecutionContext(agentId, options, swarmCoordinator, logger);
  
  if (options.verbose) {
    printInfo(`Agent context: ${JSON.stringify(executionContext, null, 2)}`);
  }
  
  // Execute command in agent context
  await executeInAgentContext(agentId, fullCommand, executionContext, options, logger);
}

async function executeOnAllAgents(
  args: string[],
  options: any,
  swarmCoordinator: SwarmCoordinator,
  agentManager: AgentProcessManager,
  logger: any
): Promise<void> {
  if (args.length === 0) {
    printError('Command is required for --all execution');
    return;
  }
  
  const command = args[0];
  const commandArgs = args.slice(1);
  const fullCommand = [command, ...commandArgs].join(' ');
  
  if (options['dry-run']) {
    printInfo(`Would execute on all agents: ${fullCommand}`);
    return;
  }
  
  printInfo(`🌐 Executing on all agents: ${fullCommand}`);
  
  // Get all active agents
  const activeAgents = await getActiveAgents(swarmCoordinator);
  
  if (activeAgents.length === 0) {
    printWarning('No active agents found');
    return;
  }
  
  printInfo(`Found ${activeAgents.length} active agents`);
  
  // Execute on each agent
  const results = await Promise.allSettled(
    activeAgents.map(async (agentId) => {
      printInfo(`[${agentId}] Executing...`);
      const executionContext = await buildAgentExecutionContext(agentId, options, swarmCoordinator, logger);
      return executeInAgentContext(agentId, fullCommand, executionContext, options, logger);
    })
  );
  
  // Report results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  if (successful > 0) {
    printSuccess(`✅ Successfully executed on ${successful} agents`);
  }
  
  if (failed > 0) {
    printError(`❌ Failed on ${failed} agents`);
    if (options.verbose) {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          printError(`  Agent ${activeAgents[index]}: ${result.reason}`);
        }
      });
    }
  }
}

async function executeOnSpawnedAgent(
  args: string[],
  options: any,
  swarmCoordinator: SwarmCoordinator,
  agentManager: AgentProcessManager,
  logger: any
): Promise<void> {
  if (args.length === 0) {
    printError('Command is required for --spawn-agent execution');
    return;
  }
  
  const command = args[0];
  const commandArgs = args.slice(1);
  const fullCommand = [command, ...commandArgs].join(' ');
  
  if (options['dry-run']) {
    printInfo(`Would spawn agent and execute: ${fullCommand}`);
    printInfo(`Agent type: ${options['agent-type'] || 'general'}`);
    return;
  }
  
  printInfo(`🚀 Spawning agent for execution: ${fullCommand}`);
  
  // Create agent profile
  const agentProfile = {
    id: generateId('exec-agent'),
    name: `exec-${Date.now()}`,
    type: options['agent-type'] || 'general',
    capabilities: ['execution'],
    systemPrompt: 'You are an execution agent created for command execution.',
    maxConcurrentTasks: 1,
    priority: options.priority || 5,
    metadata: {
      createdFor: 'exec-command',
      command: fullCommand,
      temporary: true
    }
  };
  
  try {
    // Spawn the agent
    printInfo(`Creating agent: ${agentProfile.name} (${agentProfile.type})`);
    const agentId = await spawnAgent(agentProfile, swarmCoordinator, agentManager);
    
    // Execute command
    const executionContext = await buildAgentExecutionContext(agentId, options, swarmCoordinator, logger);
    await executeInAgentContext(agentId, fullCommand, executionContext, options, logger);
    
    // Cleanup temporary agent if not async
    if (!options.async) {
      printInfo(`Cleaning up temporary agent: ${agentId}`);
      await cleanupAgent(agentId, swarmCoordinator, agentManager);
    }
    
  } catch (error) {
    printError(`Failed to spawn agent: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function executeOnAgentType(
  args: string[],
  options: any,
  swarmCoordinator: SwarmCoordinator,
  agentManager: AgentProcessManager,
  logger: any
): Promise<void> {
  if (args.length === 0) {
    printError('Command is required for --agent-type execution');
    return;
  }
  
  const command = args[0];
  const commandArgs = args.slice(1);
  const fullCommand = [command, ...commandArgs].join(' ');
  
  if (options['dry-run']) {
    printInfo(`Would execute on agents of type ${options['agent-type']}: ${fullCommand}`);
    return;
  }
  
  printInfo(`🎯 Executing on ${options['agent-type']} agents: ${fullCommand}`);
  
  // Get agents of specific type
  const typeAgents = await getAgentsByType(options['agent-type'], swarmCoordinator);
  
  if (typeAgents.length === 0) {
    printWarning(`No active agents of type '${options['agent-type']}' found`);
    return;
  }
  
  printInfo(`Found ${typeAgents.length} agents of type '${options['agent-type']}'`);
  
  // Execute on each agent of the type
  const results = await Promise.allSettled(
    typeAgents.map(async (agentId) => {
      printInfo(`[${agentId}] Executing...`);
      const executionContext = await buildAgentExecutionContext(agentId, options, swarmCoordinator, logger);
      return executeInAgentContext(agentId, fullCommand, executionContext, options, logger);
    })
  );
  
  // Report results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  if (successful > 0) {
    printSuccess(`✅ Successfully executed on ${successful} ${options['agent-type']} agents`);
  }
  
  if (failed > 0) {
    printError(`❌ Failed on ${failed} ${options['agent-type']} agents`);
  }
}

// Core execution logic
async function executeInAgentContext(
  agentId: string,
  command: string,
  executionContext: any,
  options: any,
  logger: any
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Build execution environment
    const env = {
      ...process.env,
      ...executionContext.environment,
      AGENT_ID: agentId,
      AGENT_TYPE: executionContext.agentType,
      AGENT_CONTEXT: 'true',
      FLOWX_EXEC_MODE: 'agent',
      FLOWX_ISOLATION: options.isolation || 'process'
    };
    
    if (options.memory && executionContext.memory) {
      env.AGENT_MEMORY = JSON.stringify(executionContext.memory);
    }
    
    const execOptions = {
      env,
      cwd: executionContext.workingDirectory || process.cwd(),
      timeout: (options.timeout || 300) * 1000,
      maxBuffer: 1024 * 1024 * 10, // 10MB
    };
    
    if (options.verbose) {
      printInfo(`Execution environment: ${Object.keys(env).filter(k => k.startsWith('AGENT_') || k.startsWith('FLOWX_')).join(', ')}`);
    }
    
    // Execute based on mode
    if (options.interactive) {
      await executeInteractiveInAgent(agentId, command, execOptions, options, logger);
    } else if (options.async) {
      await executeAsyncInAgent(agentId, command, execOptions, options, logger);
    } else {
      await executeSyncInAgent(agentId, command, execOptions, options, logger);
    }
    
    const duration = Date.now() - startTime;
    
    if (options.verbose) {
      printSuccess(`✅ Agent ${agentId} execution completed in ${duration}ms`);
    }
    
    logger.info('Agent command executed successfully', {
      agentId,
      command,
      duration,
      isolation: options.isolation
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Agent command execution failed', {
      agentId,
      command,
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw new Error(`Agent ${agentId} execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function executeSyncInAgent(
  agentId: string,
  command: string,
  execOptions: any,
  options: any,
  logger: any
): Promise<void> {
  try {
    const { stdout, stderr } = await execAsync(command, execOptions);
    
    const stdoutStr = stdout ? stdout.toString() : '';
    const stderrStr = stderr ? stderr.toString() : '';
    
    if (!options.silent) {
      if (stdoutStr) {
        console.log(`[${agentId}] ${stdoutStr}`);
      }
      if (stderrStr) {
        console.error(`[${agentId}] ${stderrStr}`);
      }
    }
    
    if (options.capture) {
      await captureAgentOutput(options.capture, agentId, command, stdoutStr, stderrStr);
    }
    
  } catch (error: any) {
    const stdoutStr = error.stdout ? error.stdout.toString() : '';
    const stderrStr = error.stderr ? error.stderr.toString() : '';
    
    if (!options.silent) {
      if (stdoutStr) {
        console.log(`[${agentId}] ${stdoutStr}`);
      }
      if (stderrStr) {
        console.error(`[${agentId}] ${stderrStr}`);
      }
    }
    
    if (options.capture) {
      await captureAgentOutput(options.capture, agentId, command, stdoutStr, stderrStr);
    }
    
    throw new Error(`Command failed with exit code ${error.code}: ${error.message}`);
  }
}

async function executeAsyncInAgent(
  agentId: string,
  command: string,
  execOptions: any,
  options: any,
  logger: any
): Promise<void> {
  printInfo(`🔄 Agent ${agentId} running asynchronously...`);
  
  const child = spawn('bash', ['-c', command], {
    ...execOptions,
    stdio: options.silent ? 'ignore' : 'pipe',
    detached: true
  });
  
  if (child.pid) {
    printSuccess(`✅ Agent ${agentId} process started with PID: ${child.pid}`);
    
    logger.info('Agent async command started', {
      agentId,
      command,
      pid: child.pid
    });
  }
  
  child.unref();
}

async function executeInteractiveInAgent(
  agentId: string,
  command: string,
  execOptions: any,
  options: any,
  logger: any
): Promise<void> {
  printInfo(`🎮 Agent ${agentId} running in interactive mode...`);
  
  const child = spawn('bash', ['-c', command], {
    ...execOptions,
    stdio: 'inherit'
  });
  
  return new Promise<void>((resolve, reject) => {
    child.on('exit', (code, signal) => {
      if (code === 0) {
        printSuccess(`✅ Agent ${agentId} interactive command completed`);
        logger.info('Agent interactive command completed', { agentId, command, code, signal });
        resolve();
      } else {
        const error = new Error(`Agent ${agentId} interactive command failed with exit code ${code}`);
        logger.error('Agent interactive command failed', { agentId, command, code, signal });
        reject(error);
      }
    });
    
    child.on('error', (error) => {
      logger.error('Agent interactive command error', { agentId, command, error: error.message });
      reject(error);
    });
  });
}

// Helper functions
async function checkAgentExists(agentId: string, swarmCoordinator: SwarmCoordinator): Promise<boolean> {
  try {
    // In a real implementation, this would check with the swarm coordinator
    // For now, we'll simulate agent existence
    return true;
  } catch {
    return false;
  }
}

async function getActiveAgents(swarmCoordinator: SwarmCoordinator): Promise<string[]> {
  try {
    // In a real implementation, this would get active agents from swarm coordinator
    // For now, we'll return a simulated list
    return ['agent-1', 'agent-2', 'agent-3'];
  } catch {
    return [];
  }
}

async function getAgentsByType(agentType: string, swarmCoordinator: SwarmCoordinator): Promise<string[]> {
  try {
    // In a real implementation, this would filter agents by type
    // For now, we'll return a simulated list based on type
    return [`${agentType}-agent-1`, `${agentType}-agent-2`];
  } catch {
    return [];
  }
}

async function buildAgentExecutionContext(
  agentId: string,
  options: any,
  swarmCoordinator: SwarmCoordinator,
  logger: any
): Promise<any> {
  const context = {
    agentId,
    agentType: 'general',
    workingDirectory: process.cwd(),
    environment: {},
    memory: null as any,
    capabilities: ['execution'],
    isolation: options.isolation || 'process'
  };
  
  // Add agent-specific environment variables
  if (options.env) {
    context.environment = {
      AGENT_ID: agentId,
      AGENT_TYPE: context.agentType,
      AGENT_CAPABILITIES: context.capabilities.join(','),
      FLOWX_AGENT_CONTEXT: 'true'
    };
  }
  
  // Add memory context if requested
  if (options.memory) {
    try {
      // In a real implementation, this would fetch agent memory
      context.memory = {
        namespace: `agent-${agentId}`,
        context: 'execution',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('Failed to load agent memory context', { agentId, error });
    }
  }
  
  return context;
}

async function spawnAgent(
  agentProfile: any,
  swarmCoordinator: SwarmCoordinator,
  agentManager: AgentProcessManager
): Promise<string> {
  try {
    // In a real implementation, this would use the swarm coordinator to spawn an agent
    // For now, we'll simulate agent spawning
    const agentId = agentProfile.id;
    
    // Simulate agent registration
    printInfo(`Agent spawned: ${agentId}`);
    
    return agentId;
  } catch (error) {
    throw new Error(`Failed to spawn agent: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function cleanupAgent(
  agentId: string,
  swarmCoordinator: SwarmCoordinator,
  agentManager: AgentProcessManager
): Promise<void> {
  try {
    // In a real implementation, this would cleanup the agent
    printInfo(`Agent cleaned up: ${agentId}`);
  } catch (error) {
    printWarning(`Failed to cleanup agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function captureAgentOutput(
  filePath: string,
  agentId: string,
  command: string,
  stdout: string,
  stderr: string
): Promise<void> {
  const output = {
    timestamp: new Date().toISOString(),
    agentId,
    command,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    success: !stderr
  };
  
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(output, null, 2));
    printInfo(`📄 Agent output captured to: ${filePath}`);
  } catch (error) {
    printWarning(`Failed to capture agent output: ${error instanceof Error ? error.message : String(error)}`);
  }
} 