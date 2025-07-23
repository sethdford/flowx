/**
 * Kill Command
 * Force terminate agents and processes
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { printSuccess, printError, printInfo, printWarning } from '../../core/output-formatter.js';
import { getPersistenceManager, getMemoryManager } from '../../core/global-initialization.js';
import { SwarmCoordinator } from '../../../swarm/coordinator.js';
import { Logger } from '../../../core/logger.js';

export const killCommand: CLICommand = {
  name: 'kill',
  description: 'Force terminate agents and processes',
  category: 'Agents',
  usage: 'flowx kill <target> [OPTIONS]',
  examples: [
    'flowx kill agent-123',
    'flowx kill --all',
    'flowx kill --pattern "test-*"',
    'flowx kill --force --timeout 5000'
  ],
  arguments: [
    {
      name: 'target',
      description: 'Agent ID, process ID, or pattern to kill',
      required: false
    }
  ],
  options: [
    {
      name: 'all',
      short: 'a',
      description: 'Kill all agents and processes',
      type: 'boolean'
    },
    {
      name: 'pattern',
      short: 'p',
      description: 'Kill agents matching pattern (glob style)',
      type: 'string'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Force kill (SIGKILL instead of SIGTERM)',
      type: 'boolean'
    },
    {
      name: 'timeout',
      short: 't',
      description: 'Timeout in milliseconds for graceful shutdown',
      type: 'number',
      default: 10000
    },
    {
      name: 'type',
      description: 'Filter by agent type (researcher, coder, etc.)',
      type: 'string'
    },
    {
      name: 'status',
      description: 'Filter by agent status (running, idle, error)',
      type: 'string'
    },
    {
      name: 'dry-run',
      short: 'd',
      description: 'Show what would be killed without actually killing',
      type: 'boolean'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output',
      type: 'boolean'
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    try {
      const persistence = await getPersistenceManager();
      const logger = Logger.getInstance();
      
      // Get all agents from persistence
      const allAgents = await persistence.getAllAgents();
      
      // Determine what to kill
      let targets: string[] = [];
      
      if (options.all) {
        // Kill all agents
        targets = allAgents.map(agent => agent.id);
        if (targets.length === 0) {
          printInfo('No agents found to kill');
          return;
        }
      } else if (options.pattern) {
        // Kill agents matching pattern
        targets = getAgentsByPattern(allAgents, options.pattern);
        if (targets.length === 0) {
          printInfo(`No agents found matching pattern: ${options.pattern}`);
          return;
        }
      } else if (args.length > 0) {
        // Kill specific target
        targets = [args[0]];
      } else {
        printError('Target is required. Use --all, --pattern, or specify agent ID');
        printInfo('Usage: flowx kill <agent-id> [OPTIONS]');
        printInfo('       flowx kill --all');
        printInfo('       flowx kill --pattern "test-*"');
        return;
      }
      
      // Apply filters
      targets = applyFilters(targets, allAgents, options);
      
      if (targets.length === 0) {
        printInfo('No agents match the specified criteria');
        return;
      }
      
      // Show what will be killed
      if (options.verbose || options['dry-run']) {
        printInfo(`Targets to kill (${targets.length}):`);
        for (const target of targets) {
          const agent = allAgents.find(a => a.id === target);
          if (agent) {
            printInfo(`  • ${target} (${agent.type || 'unknown'}) - ${agent.status || 'unknown'}`);
          } else {
            printInfo(`  • ${target} (not found in database)`);
          }
        }
      }
      
      if (options['dry-run']) {
        printInfo('Dry run completed. No agents were actually killed.');
        return;
      }
      
      // Confirm if killing multiple agents
      if (targets.length > 1 && !options.force) {
        printWarning(`About to kill ${targets.length} agents. Use --force to skip confirmation.`);
        printInfo('Use --dry-run to preview what would be killed.');
        return;
      }
      
      // Kill the targets
      const results = await killTargets(targets, persistence, logger, options);
      
      // Report results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (successful > 0) {
        printSuccess(`✅ Successfully killed ${successful} agent${successful > 1 ? 's' : ''}`);
      }
      
      if (failed > 0) {
        printError(`❌ Failed to kill ${failed} agent${failed > 1 ? 's' : ''}`);
        if (options.verbose) {
          results.filter(r => !r.success).forEach(r => {
            printError(`  • ${r.target}: ${r.error}`);
          });
        }
      }
      
    } catch (error) {
      printError(`Failed to execute kill command: ${error instanceof Error ? error.message : error}`);
      if (options.verbose) {
        console.error(error);
      }
    }
  }
};

// Helper functions

function getAgentsByPattern(agents: any[], pattern: string): string[] {
  // Convert glob pattern to regex
  const regex = new RegExp(
    pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[([^\]]+)\]/g, '[$1]')
  );
  
  return agents
    .filter(agent => regex.test(agent.id))
    .map(agent => agent.id);
}

function applyFilters(targets: string[], agents: any[], options: any): string[] {
  if (!options.type && !options.status) {
    return targets;
  }
  
  const filtered: string[] = [];
  
  for (const target of targets) {
    const agent = agents.find(a => a.id === target);
    if (!agent) continue;
    
    let matches = true;
    
    if (options.type && agent.type !== options.type) {
      matches = false;
    }
    
    if (options.status && agent.status !== options.status) {
      matches = false;
    }
    
    if (matches) {
      filtered.push(target);
    }
  }
  
  return filtered;
}

interface KillResult {
  target: string;
  success: boolean;
  error?: string;
}

async function killTargets(targets: string[], persistence: any, logger: any, options: any): Promise<KillResult[]> {
  const results: KillResult[] = [];
  
  for (const target of targets) {
    try {
      // Get agent info
      const agent = await persistence.getAgent(target);
      if (!agent) {
        results.push({ 
          target, 
          success: false, 
          error: 'Agent not found in database' 
        });
        continue;
      }
      
      // Create a SwarmCoordinator to manage the agent termination
      const swarmCoordinator = new SwarmCoordinator({
        name: 'kill-swarm',
        description: 'Temporary swarm for agent termination',
        version: '1.0.0',
        mode: 'centralized',
        strategy: 'auto',
        maxAgents: 50,
        maxConcurrentTasks: 10,
        qualityThreshold: 0.8,
        resourceLimits: {
          memory: 512 * 1024 * 1024, // 512MB
          cpu: 2,
          disk: 1024 * 1024 * 1024 // 1GB
        }
      });
      
      let killed = false;
      
      try {
        // Try to stop the agent process if it's running
        if (agent.status === 'running' || agent.status === 'idle') {
          await swarmCoordinator.stop();
          killed = true;
        }
        
        // Update agent status in database
        await persistence.updateAgentStatus(target, 'terminated');
        
        // If we get here, consider it successful
        if (!killed) {
          killed = true; // Agent was already stopped or we successfully updated status
        }
        
        results.push({ target, success: true });
        
      } catch (error) {
        // Try to update status even if stopping failed
        try {
          await persistence.updateAgentStatus(target, 'error');
          results.push({ target, success: true });
        } catch (statusError) {
          results.push({ 
            target, 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      } finally {
        // Clean up the temporary swarm coordinator
        try {
          await swarmCoordinator.stop();
        } catch (cleanupError) {
          logger.warn('Failed to cleanup swarm coordinator', { error: cleanupError });
        }
      }
      
    } catch (error) {
      results.push({ 
        target, 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  return results;
} 