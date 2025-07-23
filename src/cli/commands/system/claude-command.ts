/**
 * Claude Command - Direct Claude Code spawning with configurations
 */

import { CLIContext, CLICommand } from '../../interfaces/index.js';
import { printSuccess, printError, printInfo, printWarning } from '../../core/output-formatter.js';
import { spawn, execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * Generate unique instance ID
 */
function generateInstanceId(): string {
  return `claude_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
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
  const mcpConfigPath = path.join(process.cwd(), 'mcp_config', 'mcp.json');
  const claudeSettingsPath = path.join(process.cwd(), '.claude', 'settings.json');
  
  try {
    await fs.access(mcpConfigPath);
    printInfo('✅ MCP configuration found');
    
    // Also check Claude settings for comprehensive validation
    try {
      await fs.access(claudeSettingsPath);
      const settingsContent = await fs.readFile(claudeSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);
      const mcpServers = settings.mcpServers || {};
      const serverCount = Object.keys(mcpServers).length;
      
      if (serverCount > 0) {
        printInfo(`✅ Claude settings has ${serverCount} MCP server(s): ${Object.keys(mcpServers).join(', ')}`);
      } else {
        printWarning('⚠️ No MCP servers configured in Claude settings');
      }
    } catch {
      printWarning('⚠️ Claude settings not found, but MCP config exists');
    }
  } catch {
    printWarning('⚠️ MCP configuration not found, Claude Code may not have FlowX tools available');
    printInfo('Run "flowx init" to create MCP configuration');
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
      'serve',
      '--minimal',
      '--log-level', verbose ? 'debug' : 'info'
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

export const claudeCommand: CLICommand = {
  name: 'claude',
  description: 'Spawn Claude Code instances with specific configurations',
  category: 'System',
  usage: 'flowx claude <task> [OPTIONS]',
  examples: [
    'flowx claude "Create a web application"',
    'flowx claude "Build a REST API" --tools View,Edit,Replace,Bash',
    'flowx claude "Analyze code performance" --research --parallel',
    'flowx claude "Fix bugs in the system" --no-permissions --verbose'
  ],
  arguments: [
    {
      name: 'task',
      description: 'The task for Claude to perform',
      required: true
    }
  ],
  options: [
    {
      name: 'tools',
      short: 't',
      description: 'Allowed tools (comma-separated)',
      type: 'string',
      default: 'View,Edit,Replace,GlobTool,GrepTool,LS,Bash'
    },
    {
      name: 'no-permissions',
      description: 'Use --dangerously-skip-permissions flag',
      type: 'boolean'
    },
    {
      name: 'config',
      short: 'c',
      description: 'MCP config file path',
      type: 'string'
    },
    {
      name: 'mode',
      short: 'm',
      description: 'Development mode (full, backend-only, frontend-only, api-only)',
      type: 'string',
      default: 'full'
    },
    {
      name: 'parallel',
      description: 'Enable parallel execution with BatchTool',
      type: 'boolean'
    },
    {
      name: 'research',
      description: 'Enable web research with WebFetchTool',
      type: 'boolean'
    },
    {
      name: 'coverage',
      description: 'Test coverage target percentage',
      type: 'number',
      default: 80
    },
    {
      name: 'commit',
      description: 'Commit frequency (phase, feature, manual)',
      type: 'string',
      default: 'phase'
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
      description: 'Show what would be executed without running',
      type: 'boolean'
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    const task = args.join(' ').trim();
    
    if (!task) {
      printError('Usage: flowx claude <task>');
      printInfo('Example: flowx claude "Create a web application"');
      return;
    }

    try {
      const instanceId = generateInstanceId();
      
      // Build allowed tools list
      let tools = options.tools || 'View,Edit,Replace,GlobTool,GrepTool,LS,Bash';
      
      if (options.parallel && !tools.includes('BatchTool')) {
        tools += ',BatchTool,dispatch_agent';
      }
      
      if (options.research && !tools.includes('WebFetchTool')) {
        tools += ',WebFetchTool';
      }
      
      // Build base Claude command arguments
      const baseArgs = [task];
      baseArgs.push('--allowedTools', tools);
      
      if (options['no-permissions']) {
        baseArgs.push('--dangerously-skip-permissions');
      }
      
      // Add MCP config - use FlowX config by default
      const mcpConfigPath = options.config || path.join(process.cwd(), 'mcp_config', 'mcp.json');
      try {
        await fs.access(mcpConfigPath);
        baseArgs.push('--mcp-config', mcpConfigPath);
        printInfo(`🔗 Using MCP config: ${mcpConfigPath}`);
      } catch {
        printWarning('⚠️ MCP config not found - Claude Code will run without FlowX tools');
      }
      
      if (options.verbose) {
        baseArgs.push('--verbose');
      }

      // SECURITY INTEGRATION: Enhance arguments with security context
      let claudeArgs = baseArgs;
      let securityEnv = {};
      
      try {
        const { enhanceClaudeArgsWithSecurity } = await import('../../../agents/claude-process-integration.js');
        
        const context = {
          instanceId,
          task,
          workingDirectory: process.cwd(),
          isSwarmMode: options.parallel,
          agentType: 'cli-spawned'
        };

        const enhanced = await enhanceClaudeArgsWithSecurity(baseArgs, context);
        claudeArgs = enhanced.args;
        securityEnv = enhanced.env;
        
        printInfo(`🛡️ Enhanced with security context (${enhanced.templatePaths.length} templates)`);
        
      } catch (error) {
        printWarning('⚠️ Security enhancement failed, using basic security');
        // Add basic security environment
        securityEnv = {
          SECURE_AGENT_MODE: 'basic',
          SECURITY_LEVEL: 'standard',
          OWASP_COMPLIANCE: 'TOP_10_2023'
        };
      }
      
      if (options['dry-run']) {
        printInfo('🔍 Dry Run - Would execute:');
        printInfo(`Command: claude ${claudeArgs.join(' ')}`);
        printInfo('\nConfiguration:');
        printInfo(`  Instance ID: ${instanceId}`);
        printInfo(`  Task: ${task}`);
        printInfo(`  Tools: ${tools}`);
        printInfo(`  Mode: ${options.mode}`);
        printInfo(`  Coverage: ${options.coverage}%`);
        printInfo(`  Commit: ${options.commit}`);
        return;
      }

      // Check if claude command is available
      if (!isClaudeAvailable()) {
        printError('Claude command not found. Please install Claude Code CLI:');
        printInfo('  npm install -g @anthropic/claude-cli');
        return;
      }
      
      // Ensure MCP config and server are ready
      await ensureMCPConfig();
      await ensureMCPServer(options.verbose);

      printSuccess(`🚀 Spawning Claude instance: ${instanceId}`);
      printInfo(`Task: ${task}`);
      printInfo(`Tools: ${tools}`);
      
      // Spawn Claude process with enhanced security environment
      const claudeProcess = spawn('claude', claudeArgs, {
        stdio: 'inherit',
        env: {
          ...process.env,
          ...securityEnv, // Security-enhanced environment variables
          CLAUDE_INSTANCE_ID: instanceId,
          FLOWX_MODE: options.mode || 'full',
          FLOWX_COVERAGE: (options.coverage || 80).toString(),
          FLOWX_COMMIT: options.commit || 'phase',
          FLOWX_MEMORY_ENABLED: 'true',
          FLOWX_MEMORY_NAMESPACE: 'default',
          FLOWX_COORDINATION_ENABLED: options.parallel ? 'true' : 'false',
          FLOWX_FEATURES: 'memory,coordination,swarm',
        }
      });

      // Wait for completion
      await new Promise((resolve, reject) => {
        claudeProcess.on('close', (code) => {
          if (code === 0) {
            printSuccess(`✅ Claude instance ${instanceId} completed successfully`);
          } else {
            printError(`Claude instance ${instanceId} exited with code ${code}`);
          }
          resolve(code);
        });
        
        claudeProcess.on('error', (error) => {
          printError(`Failed to spawn Claude: ${error.message}`);
          reject(error);
        });
      });
      
    } catch (error) {
      printError(`Failed to spawn Claude: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}; 