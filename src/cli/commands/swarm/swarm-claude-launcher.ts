/**
 * Swarm Command with Claude Code Integration
 * Combines swarm management with Claude Code launching functionality
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.ts';
import { printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.ts';
import { spawn, execSync } from 'node:child_process';
import { generateId } from '../../../utils/helpers.ts';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * Generate unique swarm ID
 */
function generateSwarmId(): string {
  return `swarm_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if Claude CLI is available
 */
function isClaudeAvailable(): boolean {
  try {
    execSync('which claude', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure MCP config exists and is properly configured
 */
async function ensureMCPConfig(): Promise<void> {
  const claudeSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  
  try {
    await fs.access(claudeSettingsPath);
    // Check if the settings file contains MCP server configuration
    const settingsContent = await fs.readFile(claudeSettingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);
    
    // Check for any FlowX-related MCP servers
    const mcpServers = settings.mcpServers || {};
    const flowxServers = Object.keys(mcpServers).filter(name => 
      name.includes('flowx') || 
      name.includes('flowx') || 
      name.includes('claude-code-flow')
    );
    
    if (flowxServers.length > 0) {
      printInfo(`✅ MCP configuration found in Claude settings (${flowxServers.join(', ')})`);
    } else {
      printWarning('⚠️ MCP server not configured in Claude settings');
      printInfo('Check .claude/settings.json for FlowX MCP server configuration');
    }
  } catch {
    printWarning('⚠️ Claude settings not found, Claude Code may not have FlowX tools available');
    printInfo('Check .claude/settings.json for MCP configuration');
  }
}

/**
 * Start FlowX MCP server in background if not running
 */
async function ensureMCPServer(verbose: boolean = false): Promise<void> {
  try {
    if (verbose) {
      printInfo('🔧 Starting FlowX MCP server...');
    }
    
    // Start MCP server in background using our local CLI
    const mcpProcess = spawn(process.execPath, [
      path.join(process.cwd(), 'cli.js'),
      'mcp',
      'start',
      '--port', '3001'
    ], {
      detached: true,
      stdio: verbose ? 'inherit' : 'ignore'
    });
    
    if (!verbose) {
      mcpProcess.unref(); // Allow parent to exit
    }
    
    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (verbose) {
      printSuccess('✅ FlowX MCP server started');
    }
    
  } catch (error) {
    if (verbose) {
      printWarning('⚠️ Could not start MCP server automatically');
      printInfo('Claude Code will still work but without FlowX-specific tools');
    }
  }
}

export const swarmCommand: CLICommand = {
  name: 'swarm',
  description: 'Launch Claude Code with intelligent swarm coordination',
  category: 'Swarm',
  usage: 'flowx swarm <objective> [OPTIONS]',
  examples: [
    'flowx swarm "Build a REST API with authentication"',
    'flowx swarm "Research cloud architecture" --strategy research',
    'flowx swarm "Analyze performance issues" --max-agents 3 --parallel',
    'flowx swarm "Develop user features" --mode distributed --ui'
  ],
  arguments: [
    {
      name: 'objective',
      description: 'The objective for the swarm to accomplish',
      required: true
    }
  ],
  options: [
    {
      name: 'strategy',
      short: 's',
      description: 'Execution strategy (auto, research, development, analysis, testing, optimization)',
      type: 'string',
      default: 'auto'
    },
    {
      name: 'mode',
      short: 'm',
      description: 'Coordination mode (centralized, distributed, hierarchical, mesh)',
      type: 'string',
      default: 'centralized'
    },
    {
      name: 'max-agents',
      description: 'Maximum number of agents',
      type: 'number',
      default: 5
    },
    {
      name: 'timeout',
      description: 'Execution timeout in minutes',
      type: 'number',
      default: 60
    },
    {
      name: 'parallel',
      description: 'Enable parallel execution',
      type: 'boolean'
    },
    {
      name: 'claude',
      description: 'Launch Claude Code with swarm coordination',
      type: 'boolean',
      default: true
    },
    {
      name: 'executor',
      description: 'Use built-in executor instead of Claude Code',
      type: 'boolean'
    },
    {
      name: 'ui',
      description: 'Launch with interactive UI',
      type: 'boolean'
    },
    {
      name: 'monitor',
      description: 'Enable real-time monitoring',
      type: 'boolean'
    },
    {
      name: 'dry-run',
      short: 'd',
      description: 'Show configuration without executing',
      type: 'boolean'
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    // Get the objective from args
    const objective = args.join(' ').trim();
    
    if (!objective) {
      printError('Usage: flowx swarm <objective>');
      printInfo('Example: flowx swarm "Build a REST API with authentication"');
      return;
    }

    // Parse options with defaults
    const swarmOptions = {
      strategy: options.strategy || 'auto',
      mode: options.mode || 'centralized',
      maxAgents: options['max-agents'] || 5,
      timeout: options.timeout || 60,
      parallel: options.parallel || false,
      claude: options.claude !== false && !options.executor, // Default to Claude unless executor is explicitly requested
      executor: options.executor || false,
      ui: options.ui || false,
      monitor: options.monitor || false,
      dryRun: options['dry-run'] || false
    };

    const swarmId = generateId('swarm');

    if (swarmOptions.dryRun) {
      printInfo('🔍 Dry Run - Swarm Configuration:');
      printInfo(`Swarm ID: ${swarmId}`);
      printInfo(`Objective: ${objective}`);
      printInfo(`Strategy: ${swarmOptions.strategy}`);
      printInfo(`Mode: ${swarmOptions.mode}`);
      printInfo(`Max Agents: ${swarmOptions.maxAgents}`);
      printInfo(`Timeout: ${swarmOptions.timeout} minutes`);
      printInfo(`Parallel: ${swarmOptions.parallel ? 'enabled' : 'disabled'}`);
      printInfo(`Launch Mode: ${swarmOptions.claude ? 'Claude Code' : 'Built-in executor'}`);
      return;
    }

    // If claude flag is set (default), launch Claude Code with swarm prompt
    if (swarmOptions.claude) {
      await launchClaudeCodeWithSwarm(objective, swarmOptions);
    } else {
      // Use built-in executor (placeholder for now)
      printWarning('Built-in executor not yet implemented');
      printInfo('Use without --executor flag to launch Claude Code with swarm coordination');
    }
  }
};

/**
 * Launch Claude Code with comprehensive swarm coordination prompt
 */
async function launchClaudeCodeWithSwarm(objective: string, options: any): Promise<void> {
  try {
    printInfo('🚀 Launching Claude Code with swarm coordination...');
    
    // Check if claude command is available
    if (!isClaudeAvailable()) {
      printError('Claude command not found. Please install Claude Code CLI:');
      printInfo('  npm install -g @anthropic/claude-cli');
      return;
    }
    
    // Ensure MCP config and server are ready for swarm coordination
    await ensureMCPConfig();
    await ensureMCPServer(options.verbose);

    // Build comprehensive swarm prompt
    const swarmPrompt = buildSwarmPrompt(objective, options);
    
    // Build base Claude arguments
    const baseArgs = [swarmPrompt];
    baseArgs.push('--dangerously-skip-permissions');
    
    // SECURITY INTEGRATION: Enhance swarm with security context
    let claudeArgs = baseArgs;
    let securityEnv = {};
    
    try {
      const { enhanceClaudeArgsWithSecurity, SecurityProfiles } = await import('../../../agents/claude-process-integration.js');
      
      const context = {
        instanceId: generateId('swarm'),
        task: objective,
        workingDirectory: process.cwd(),
        isSwarmMode: true,
        agentType: 'swarm-coordinator'
      };

      // Use high security for swarm operations
      const securityConfig = SecurityProfiles.ENTERPRISE_WEB;
      const enhanced = await enhanceClaudeArgsWithSecurity(baseArgs, context, securityConfig);
      
      claudeArgs = enhanced.args;
      securityEnv = enhanced.env;
      
      printSuccess(`🛡️ Enhanced swarm with security context (${enhanced.templatePaths.length} templates)`);
      printInfo(`🔒 Security Level: ${securityConfig.securityLevel}`);
      printInfo(`📋 Compliance: ${securityConfig.complianceRequirements.join(', ')}`);
      
    } catch (error) {
      printWarning('⚠️ Security enhancement failed for swarm, using basic security');
      securityEnv = {
        SECURE_AGENT_MODE: 'true',
        SECURITY_LEVEL: 'high',
        OWASP_COMPLIANCE: 'TOP_10_2023',
        CLAUDE_SWARM_MODE: 'true'
      };
    }
    
    printWarning('🔓 Using --dangerously-skip-permissions for seamless swarm execution');
    
    // Claude Code will automatically use .claude/settings.json for MCP configuration
    const claudeSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
    try {
      await fs.access(claudeSettingsPath);
      printInfo(`🔗 Using Claude settings: ${claudeSettingsPath}`);
    } catch {
      printWarning('⚠️ Claude settings not found - Claude Code will run without FlowX tools');
    }
    
    printInfo('Launching Claude Code with swarm coordination...');
    
    const claudeProcess = spawn('claude', claudeArgs, {
      stdio: 'inherit',
      shell: false,
      env: { 
        ...process.env,
        ...securityEnv, // Security-enhanced environment variables
        FLOWX_MODE: 'swarm',
        CLAUDE_SWARM_STRATEGY: options.strategy,
        CLAUDE_SWARM_MODE: options.mode
      }
    });
    
    printSuccess('✓ Claude Code launched with swarm coordination');
    printInfo('  The swarm will coordinate task execution using MCP tools');
    printInfo('  Use BatchTool for parallel operations');
    printInfo('  Memory will be shared between agents');
    
    // Wait for claude process to complete
    await new Promise((resolve, reject) => {
      claudeProcess.on('close', (code) => {
        if (code === 0) {
          printSuccess('✅ Claude Code swarm session completed successfully');
        } else {
          printError(`Claude Code exited with code ${code}`);
        }
        resolve(code);
      });
      
      claudeProcess.on('error', (error) => {
        printError(`Failed to launch Claude Code: ${error.message}`);
        reject(error);
      });
    });
    
  } catch (error) {
    printError(`Failed to launch swarm: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Build comprehensive swarm coordination prompt
 */
function buildSwarmPrompt(objective: string, options: any): string {
  return `You are orchestrating a Claude Flow Swarm with advanced MCP tool coordination.

🎯 OBJECTIVE: ${objective}

🐝 SWARM CONFIGURATION:
- Strategy: ${options.strategy}
- Mode: ${options.mode}
- Max Agents: ${options.maxAgents}
- Timeout: ${options.timeout} minutes
- Parallel Execution: ${options.parallel ? 'ENABLED (Always use BatchTool)' : 'Optional'}
- Monitoring: ${options.monitor ? 'ENABLED' : 'Optional'}

🚨 CRITICAL: PARALLEL EXECUTION WITH BATCHTOOL IS MANDATORY! 🚨

📋 CLAUDE-FLOW SWARM INSTRUCTIONS

⚡ THE GOLDEN RULE: If you need to do X operations, they should be in 1 message, not X messages.

🎯 MANDATORY PATTERNS FOR CLAUDE-FLOW SWARMS:

1️⃣ **SWARM INITIALIZATION** - Everything in ONE BatchTool:
\`\`\`javascript
[Single Message with Multiple Tools]:
  // Spawn ALL agents at once
  mcp__flowx__agent_spawn {"type": "coordinator", "name": "SwarmLead"}
  mcp__flowx__agent_spawn {"type": "researcher", "name": "DataAnalyst"}
  mcp__flowx__agent_spawn {"type": "coder", "name": "BackendDev"}
  mcp__flowx__agent_spawn {"type": "coder", "name": "FrontendDev"}
  mcp__flowx__agent_spawn {"type": "tester", "name": "QAEngineer"}
  
  // Initialize ALL memory keys
  mcp__flowx__memory_store {"key": "swarm/objective", "value": "${objective}"}
  mcp__flowx__memory_store {"key": "swarm/config", "value": ${JSON.stringify(options)}}
  
  // Create task hierarchy
  mcp__flowx__task_create {"name": "Main Objective", "description": "${objective}", "type": "parent"}
\`\`\`

2️⃣ **AGENT COORDINATION** - Batch communications:
\`\`\`javascript
[Single Message]:
  mcp__flowx__agent_communicate {"to": "SwarmLead", "message": "Begin coordination"}
  mcp__flowx__agent_communicate {"to": "DataAnalyst", "message": "Start research phase"}
  mcp__flowx__agent_communicate {"to": "BackendDev", "message": "Prepare for development"}
  mcp__flowx__memory_store {"key": "coordination/phase", "value": "initialization"}
\`\`\`

3️⃣ **TASK EXECUTION** - Parallel task management:
\`\`\`javascript
[Single Message]:
  mcp__flowx__task_create {"name": "Research Phase", "assignTo": "DataAnalyst"}
  mcp__flowx__task_create {"name": "Architecture Design", "assignTo": "SwarmLead", "dependsOn": ["Research Phase"]}
  mcp__flowx__task_create {"name": "Backend Implementation", "assignTo": "BackendDev", "dependsOn": ["Architecture Design"]}
  mcp__flowx__task_create {"name": "Frontend Implementation", "assignTo": "FrontendDev", "dependsOn": ["Architecture Design"]}
  mcp__flowx__task_create {"name": "Quality Assurance", "assignTo": "QAEngineer", "dependsOn": ["Backend Implementation", "Frontend Implementation"]}
\`\`\`

4️⃣ **PROGRESS MONITORING** - Combined status checks:
\`\`\`javascript
[Single Message]:
  mcp__flowx__swarm_monitor {}
  mcp__flowx__swarm_status {}
  mcp__flowx__agent_list {"status": "active"}
  mcp__flowx__task_status {"includeCompleted": false}
  mcp__flowx__memory_retrieve {"key": "swarm/*"}
\`\`\`

🎯 ${options.strategy.toUpperCase()} STRATEGY GUIDANCE:
${getStrategyGuidance(options.strategy, objective)}

🏗️ ${options.mode.toUpperCase()} MODE COORDINATION:
${getModeGuidance(options.mode)}

🚀 BEGIN SWARM EXECUTION:

Start by using BatchTool to spawn all agents, initialize memory, and create the task structure in a single message. Then coordinate the swarm to accomplish the objective: "${objective}"

Remember: Always use BatchTool for multiple operations. The swarm should be self-documenting through memory_store and highly coordinated through agent_communicate.`;
}

/**
 * Get strategy-specific guidance
 */
function getStrategyGuidance(strategy: string, objective: string): string {
  const strategies: Record<string, string> = {
    'auto': 'Analyze the objective and automatically determine the best approach combining multiple strategies.',
    'research': 'Focus on information gathering, analysis, and comprehensive research before implementation.',
    'development': 'Emphasize code creation, architecture design, and iterative development cycles.',
    'analysis': 'Deep dive into data analysis, performance metrics, and insight generation.',
    'testing': 'Comprehensive testing strategy with quality assurance and validation.',
    'optimization': 'Performance optimization, efficiency improvements, and bottleneck resolution.'
  };
  
  return strategies[strategy] || strategies['auto'];
}

/**
 * Get coordination mode guidance
 */
function getModeGuidance(mode: string): string {
  const modes: Record<string, string> = {
    'centralized': 'Single coordinator manages all decisions and task distribution.',
    'distributed': 'Multiple coordinators share responsibility with consensus mechanisms.',
    'hierarchical': 'Tree structure with team leads and specialized roles.',
    'mesh': 'Peer-to-peer coordination with direct agent communication.'
  };
  
  return modes[mode] || modes['centralized'];
} 