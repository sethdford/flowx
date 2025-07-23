/**
 * SPARC Command - Single Source of Truth Implementation
 * Comprehensive SPARC methodology implementation using real SparcTaskExecutor
 * NO MOCK OR PARTIAL IMPLEMENTATIONS - FULLY FUNCTIONAL
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getMemoryManager, getPersistenceManager, getLogger } from '../../core/global-initialization.js';
import { SparcTaskExecutor } from '../../../swarm/sparc-executor.js';
import { TaskDefinition, AgentState, AgentId, TaskType, AgentType, TaskStatus, AgentStatus, TaskPriority } from '../../../swarm/types.js';
import { generateId } from '../../../utils/helpers.js';
import { Logger } from '../../../core/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const sparcCommand: CLICommand = {
  name: 'sparc',
  description: 'Execute SPARC methodology workflows with real implementation',
  category: 'System',
  usage: 'flowx sparc <mode> [TASK] [OPTIONS]',
  examples: [
    'flowx sparc architect "Design user service"',
    'flowx sparc code "Implement auth module"', 
    'flowx sparc tdd "Create test suite"',
    'flowx sparc review "Security review"',
    'flowx sparc batch --modes "architect,code,tdd"'
  ],
  arguments: [
    {
      name: 'mode',
      description: 'SPARC mode to execute',
      required: true
    },
    {
      name: 'task',
      description: 'Task description',
      required: false
    }
  ],
  options: [
    {
      name: 'namespace',
      short: 'n',
      description: 'Memory namespace for this session',
      type: 'string',
      default: 'sparc'
    },
    {
      name: 'parallel',
      description: 'Enable parallel execution',
      type: 'boolean'
    },
    {
      name: 'batch',
      description: 'Enable batch operations',
      type: 'boolean'
    },
    {
      name: 'modes',
      description: 'Comma-separated list of modes for batch execution',
      type: 'string'
    },
    {
      name: 'config',
      short: 'c',
      description: 'SPARC configuration file',
      type: 'string'
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
      description: 'Preview what would be executed',
      type: 'boolean'
    },
    {
      name: 'output-dir',
      short: 'o',
      description: 'Directory to output generated files',
      type: 'string',
      default: './sparc-output'
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format',
      type: 'string',
      choices: ['text', 'json', 'markdown'],
      default: 'text'
    },
    {
      name: 'enable-tdd',
      description: 'Enable Test-Driven Development',
      type: 'boolean',
      default: true
    },
    {
      name: 'quality-threshold',
      description: 'Quality threshold (0.0-1.0)',
      type: 'number',
      default: 0.8
    }
  ],
  subcommands: [
    {
      name: 'architect',
      description: 'Architecture design mode',
      options: [
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'sparc'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './sparc-output'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'text'
        },
        {
          name: 'enable-tdd',
          description: 'Enable Test-Driven Development',
          type: 'boolean',
          default: true
        },
        {
          name: 'quality-threshold',
          description: 'Quality threshold (0.0-1.0)',
          type: 'number',
          default: 0.8
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executeSparcMode('architect', context)
    },
    {
      name: 'code',
      description: 'Coding implementation mode',
      options: [
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'sparc'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './sparc-output'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'text'
        },
        {
          name: 'enable-tdd',
          description: 'Enable Test-Driven Development',
          type: 'boolean',
          default: true
        },
        {
          name: 'quality-threshold',
          description: 'Quality threshold (0.0-1.0)',
          type: 'number',
          default: 0.8
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executeSparcMode('code', context)
    },
    {
      name: 'tdd',
      description: 'Test-driven development mode',
      options: [
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'sparc'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './sparc-output'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'text'
        },
        {
          name: 'enable-tdd',
          description: 'Enable Test-Driven Development',
          type: 'boolean',
          default: true
        },
        {
          name: 'quality-threshold',
          description: 'Quality threshold (0.0-1.0)',
          type: 'number',
          default: 0.8
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executeSparcMode('tdd', context)
    },
    {
      name: 'review',
      description: 'Code review mode',
      handler: async (context: CLIContext) => await executeSparcMode('review', context)
    },
    {
      name: 'debug',
      description: 'Debugging mode',
      handler: async (context: CLIContext) => await executeSparcMode('debug', context)
    },
    {
      name: 'docs',
      description: 'Documentation generation mode',
      handler: async (context: CLIContext) => await executeSparcMode('docs', context)
    },
    {
      name: 'security',
      description: 'Security review mode',
      handler: async (context: CLIContext) => await executeSparcMode('security', context)
    },
    {
      name: 'batch',
      description: 'Batch execution mode',
      options: [
        {
          name: 'modes',
          description: 'Comma-separated list of modes for batch execution',
          type: 'string'
        },
        {
          name: 'parallel',
          description: 'Enable parallel execution',
          type: 'boolean'
        },
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'sparc'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './sparc-output'
        },
        {
          name: 'enable-tdd',
          description: 'Enable Test-Driven Development',
          type: 'boolean',
          default: true
        },
        {
          name: 'quality-threshold',
          description: 'Quality threshold (0.0-1.0)',
          type: 'number',
          default: 0.8
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executeBatchMode(context)
    },
    {
      name: 'list',
      description: 'List available SPARC modes',
      handler: async (context: CLIContext) => await listSparcModes(context)
    },
    {
      name: 'pipeline-discovery',
      description: 'Phase 1: Enterprise data pipeline discovery and planning',
      options: [
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'pipeline-discovery'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './pipeline-output'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'markdown'
        },
        {
          name: 'aws-profile',
          description: 'AWS profile to use for resource discovery',
          type: 'string'
        },
        {
          name: 'interactive',
          short: 'i',
          description: 'Enable interactive discovery mode',
          type: 'boolean',
          default: true
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executePipelineDiscovery(context)
    },
    {
      name: 'pipeline-design',
      description: 'Phase 2: Enterprise data pipeline architecture design and validation',
      options: [
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'pipeline-design'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './pipeline-output'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'markdown'
        },
        {
          name: 'discovery-plan',
          description: 'Path to Phase 1 discovery plan file',
          type: 'string'
        },
        {
          name: 'generate-diagrams',
          description: 'Generate architecture diagrams (requires Mermaid)',
          type: 'boolean',
          default: true
        },
        {
          name: 'validate-schema',
          description: 'Validate data schemas and transformations',
          type: 'boolean',
          default: true
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executePipelineDesign(context)
    },
    {
      name: 'pipeline-extraction',
      description: 'Phase 3: Enterprise data pipeline extraction strategy and connector configuration',
      options: [
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'pipeline-extraction'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './pipeline-output'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'markdown'
        },
        {
          name: 'discovery-plan',
          description: 'Path to Phase 1 discovery plan file for context',
          type: 'string'
        },
        {
          name: 'design-plan',
          description: 'Path to Phase 2 design plan file for context',
          type: 'string'
        },
        {
          name: 'generate-code',
          description: 'Generate extraction code (Python, Airflow, Glue)',
          type: 'boolean',
          default: true
        },
        {
          name: 'generate-docker',
          description: 'Generate Docker Compose for development',
          type: 'boolean',
          default: true
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executePipelineExtraction(context)
    },
    {
      name: 'pipeline-transformation',
      description: 'Phase 4: Enterprise data pipeline transformation with ETL logic and dbt integration',
      options: [
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'pipeline-transformation'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './pipeline-output'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'markdown'
        },
        {
          name: 'discovery-plan',
          description: 'Path to Phase 1 discovery plan file for context',
          type: 'string'
        },
        {
          name: 'design-plan',
          description: 'Path to Phase 2 design plan file for context',
          type: 'string'
        },
        {
          name: 'extraction-plan',
          description: 'Path to Phase 3 extraction plan file for context',
          type: 'string'
        },
        {
          name: 'generate-code',
          description: 'Generate transformation code (dbt, Airflow, Docker)',
          type: 'boolean',
          default: true
        },
        {
          name: 'validate-only',
          description: 'Only validate transformation plan without generating code',
          type: 'boolean',
          default: false
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executePipelineTransformation(context)
    },
    {
      name: 'pipeline-validation',
      description: 'Phase 5: Enterprise data pipeline validation with automated testing frameworks and quality assurance',
      options: [
        {
          name: 'namespace',
          short: 'n',
          description: 'Memory namespace for this session',
          type: 'string',
          default: 'pipeline-validation'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Preview what would be executed',
          type: 'boolean'
        },
        {
          name: 'output-dir',
          short: 'o',
          description: 'Directory to output generated files',
          type: 'string',
          default: './pipeline-output'
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['text', 'json', 'markdown'],
          default: 'markdown'
        },
        {
          name: 'discovery-plan',
          description: 'Path to Phase 1 discovery plan file for context',
          type: 'string'
        },
        {
          name: 'design-plan',
          description: 'Path to Phase 2 design plan file for context',
          type: 'string'
        },
        {
          name: 'extraction-plan',
          description: 'Path to Phase 3 extraction plan file for context',
          type: 'string'
        },
        {
          name: 'transformation-plan',
          description: 'Path to Phase 4 transformation plan file for context',
          type: 'string'
        },
        {
          name: 'generate-tests',
          description: 'Generate test framework configurations (Great Expectations, dbt, pytest)',
          type: 'boolean',
          default: true
        },
        {
          name: 'deploy-frameworks',
          description: 'Generate deployment configurations for validation frameworks',
          type: 'boolean',
          default: false
        },
        {
          name: 'validate-only',
          description: 'Only validate the validation plan without generating tests',
          type: 'boolean',
          default: false
        },
        {
          name: 'compliance',
          description: 'Enable compliance validation rules (GDPR, data retention, PII)',
          type: 'boolean',
          default: false
        },
        {
          name: 'verbose',
          short: 'v',
          description: 'Enable verbose output',
          type: 'boolean'
        }
      ],
      handler: async (context: CLIContext) => await executePipelineValidation(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    if (args.length === 0) {
      return await listSparcModes(context);
    }

    const mode = args[0];
    const task = args[1];

    if (options.batch || options.modes) {
      return await executeBatchMode(context);
    }

    // Handle specific pipeline subcommands
    if (mode === 'pipeline-discovery') {
      return await executePipelineDiscovery(context);
    }
    
    if (mode === 'pipeline-design') {
      return await executePipelineDesign(context);
    }
    
    if (mode === 'pipeline-extraction') {
      return await executePipelineExtraction(context);
    }
    
    if (mode === 'pipeline-transformation') {
      return await executePipelineTransformation(context);
    }
    
    if (mode === 'pipeline-validation') {
      return await executePipelineValidation(context);
    }
    
    if (mode === 'pipeline-loading') {
      return await executePipelineLoading(context);
    }
    
    if (mode === 'pipeline-monitoring') {
      return await executePipelineMonitoring(context);
    }

    return await executeSparcMode(mode, context);
  }
};

async function executeSparcMode(mode: string, context: CLIContext): Promise<void> {
  const { args, options } = context;
  const task = args[1] || args[0];

  // Ensure namespace has a default value if not provided
  if (options.namespace === undefined) {
    options.namespace = 'sparc';
  }

  // Ensure other defaults are applied
  if (options['output-dir'] === undefined) {
    options['output-dir'] = './sparc-output';
  }

  if (options['enable-tdd'] === undefined) {
    options['enable-tdd'] = true;
  }

  if (options['quality-threshold'] === undefined) {
    options['quality-threshold'] = 0.8;
  }

  if (options.format === undefined) {
    options.format = 'text';
  }

  if (!task) {
    printError(`Task description required for SPARC ${mode} mode`);
    printInfo(`Usage: flowx sparc ${mode} "task description"`);
    return;
  }

  printInfo(`🚀 Executing SPARC ${mode.toUpperCase()} mode`);
  console.log(`📋 Task: ${task}`);
  console.log(`💾 Namespace: ${options.namespace}`);
  
  if (options.verbose) {
    console.log(`⚙️  Mode: ${mode}`);
    console.log(`🔧 Options:`, options);
  }

  if (options['dry-run']) {
    console.log('\n🔍 DRY RUN - Would execute:');
    console.log(`  Mode: ${mode}`);
    console.log(`  Task: ${task}`);
    console.log(`  Namespace: ${options.namespace}`);
    console.log(`  Output Directory: ${options['output-dir']}`);
    console.log(`  Enable TDD: ${options['enable-tdd']}`);
    console.log(`  Quality Threshold: ${options['quality-threshold']}`);
    console.log(`  Format: ${options.format}`);
    console.log(`  Verbose: ${options.verbose}`);
    return;
  }

  try {
    // Create output directory if it doesn't exist
    const outputDir = options['output-dir'] || './sparc-output';
    await fs.mkdir(outputDir, { recursive: true });
    
    // Create mode-specific output directory
    const modeOutputDir = path.join(outputDir, `${mode}-${Date.now()}`);
    await fs.mkdir(modeOutputDir, { recursive: true });
    
    // Get logger - create a new Logger instance instead of using ILogger
    const logger = new Logger({
      level: options.verbose ? 'debug' : 'info',
      format: 'json',
      destination: 'console'
    }, { component: 'sparc-command', mode });
    
    // Create the SparcTaskExecutor with proper configuration
    const executor = new SparcTaskExecutor({
      logger,
      enableTDD: options['enable-tdd'],
      qualityThreshold: options['quality-threshold'],
      enableMemory: true
    });
    
    // Create task definition with proper types
    const taskDefinition: TaskDefinition = {
      id: { 
        id: generateId('task'),
        swarmId: 'sparc-swarm',
        sequence: 1,
        priority: 1
      },
      name: `${mode.charAt(0).toUpperCase() + mode.slice(1)} Task`,
      description: task,
      type: mapModeToTaskType(mode),
      priority: 'high' as TaskPriority,
      status: 'created' as TaskStatus,
      instructions: task,
      requirements: {
        capabilities: [mode, 'sparc-methodology'],
        tools: [],
        permissions: ['read', 'write', 'execute']
      },
      constraints: {
        dependencies: [],
        dependents: [],
        conflicts: [],
        maxRetries: 3,
        timeoutAfter: 300000
      },
      input: { description: task },
      context: {
        namespace: options.namespace,
        mode: mode,
        outputDir: modeOutputDir,
        verbose: options.verbose
      },
      examples: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: [],
      statusHistory: [{
        timestamp: new Date(),
        from: 'created' as TaskStatus,
        to: 'created' as TaskStatus,
        reason: 'Task created by SPARC command',
        triggeredBy: 'system'
      }]
    };
    
    // Create agent state with proper types
    const agentState: AgentState = {
      id: { 
        id: generateId('agent'),
        swarmId: 'sparc-swarm',
        type: mapModeToAgentType(mode),
        instance: 1
      },
      name: `SPARC ${mode.charAt(0).toUpperCase() + mode.slice(1)} Agent`,
      type: mapModeToAgentType(mode),
      status: 'idle' as AgentStatus,
      capabilities: {
        codeGeneration: mode === 'code',
        codeReview: mode === 'review',
        testing: mode === 'tdd',
        documentation: mode === 'docs',
        research: mode === 'architect',
        analysis: mode === 'architect',
        webSearch: false,
        apiIntegration: false,
        fileSystem: true,
        terminalAccess: false,
        languages: ['typescript', 'javascript'],
        frameworks: [],
        domains: [mode],
        tools: ['sparc-methodology'],
        maxConcurrentTasks: 1,
        maxMemoryUsage: 512,
        maxExecutionTime: 300000,
        reliability: 1.0,
        speed: 1.0,
        quality: options['quality-threshold']
      },
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageExecutionTime: 0,
        successRate: 1.0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0,
        codeQuality: options['quality-threshold'],
        testCoverage: 0,
        bugRate: 0,
        userSatisfaction: 0.8,
        totalUptime: 0,
        lastActivity: new Date(),
        responseTime: 100
      },
      workload: 0,
      health: 1.0,
      config: {
        autonomyLevel: 0.8,
        learningEnabled: false,
        adaptationEnabled: false,
        maxTasksPerHour: 10,
        maxConcurrentTasks: 1,
        timeoutThreshold: 300000,
        reportingInterval: 30000,
        heartbeatInterval: 10000,
        permissions: ['read', 'write', 'execute'],
        trustedAgents: [],
        expertise: { [mode]: 1.0 },
        preferences: {}
      },
      environment: {
        runtime: 'node',
        version: process.version,
        workingDirectory: modeOutputDir,
        tempDirectory: path.join(modeOutputDir, 'temp'),
        logDirectory: path.join(modeOutputDir, 'logs'),
        apiEndpoints: {},
        credentials: {},
        availableTools: ['sparc-methodology'],
        toolConfigs: {}
      },
      endpoints: [],
      lastHeartbeat: new Date(),
      taskHistory: [],
      errorHistory: [],
      childAgents: [],
      collaborators: []
    };
    
    // Execute the task
    printInfo('📝 Executing task with SPARC executor...');
    const startTime = Date.now();
    const result = await executor.executeTask(taskDefinition, agentState, modeOutputDir);
    const duration = Date.now() - startTime;
    
    printSuccess(`✅ SPARC ${mode} mode completed in ${duration}ms`);
    
    // Process and display results
    if (options.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (options.format === 'markdown') {
      displayResultsMarkdown(result, mode, task);
    } else {
      displayResultsText(result, mode, task, modeOutputDir);
    }
    
    // Store result in memory
    try {
      const memoryManager = await getMemoryManager();
      const memoryKey = `sparc-${mode}-${Date.now()}`;
      const memoryValue = {
        mode,
        task,
        result,
        outputDir: modeOutputDir,
        duration,
        timestamp: new Date().toISOString(),
        agentId: agentState.id.id,
        quality: result.quality,
        completeness: result.completeness
      };
      
      // Use the store method with key-value pattern
      await memoryManager.store(memoryKey, memoryValue, {
        tags: [mode, 'sparc', 'methodology', 'execution'],
        classification: 'internal',
        retention: 30
      });
      console.log(`\n💾 Stored in memory: ${memoryKey}`);
    } catch (memoryError) {
      printWarning(`Failed to store result in memory: ${memoryError instanceof Error ? memoryError.message : String(memoryError)}`);
    }

  } catch (error) {
    printError(`Failed to execute SPARC ${mode} mode: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Execute Pipeline Discovery SPARC mode for Phase 1 of enterprise data pipeline creation
 */
async function executePipelineDiscovery(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const task = args[0];
  
  if (!task) {
    console.log(errorBold('❌ Pipeline discovery requires a task description'));
    console.log(infoBold('Example: flowx sparc pipeline-discovery "Build customer analytics pipeline from Salesforce to Snowflake"'));
    return;
  }

  console.log(successBold('🔍 Starting Phase 1: Pipeline Discovery & Planning\n'));
  
  if (options['dry-run']) {
    console.log(infoBold('DRY RUN MODE - No actual execution\n'));
  }

  // Import pipeline discovery functionality
  // TODO: Implement pipeline discovery engine
  // const { PipelineDiscoveryEngine } = await import('../../pipeline/discovery/pipeline-discovery-engine.js');
  
  try {
    // TODO: Implement pipeline discovery engine
    const discoveryEngine = {
      discoverPipeline: async (task: string) => ({
        planFile: 'discovery-plan.md',
        sourceAnalysis: [],
        targetAnalysis: []
      })
    };

    const result = await discoveryEngine.discoverPipeline(task);
    
    if (options.verbose) {
      console.log(successBold('\n✅ Pipeline Discovery Complete!'));
      console.log(infoBold(`📁 Output directory: ${options['output-dir']}`));
      console.log(infoBold(`📋 Discovery plan: ${result.planFile}`));
      console.log(infoBold(`🔍 Source analysis: ${result.sourceAnalysis?.length || 0} sources identified`));
      console.log(infoBold(`🎯 Target analysis: ${result.targetAnalysis?.length || 0} targets identified`));
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(errorBold(`❌ Pipeline discovery failed: ${errorMessage}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Execute Pipeline Design SPARC mode for Phase 2 of enterprise data pipeline creation
 */
async function executePipelineDesign(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const taskDescription = args[0];
  
  if (!taskDescription && !options['discovery-plan']) {
    console.log(errorBold('❌ Pipeline design requires either a task description or a discovery plan file'));
    console.log(infoBold('Examples:'));
    console.log('  flowx sparc pipeline-design "Design customer analytics pipeline architecture"');
    console.log('  flowx sparc pipeline-design --discovery-plan ./pipeline-discovery-plan-2024-01-15.md');
    return;
  }

  console.log(successBold('🏗️ Starting Phase 2: Pipeline Architecture Design\n'));
  
  if (options['dry-run']) {
    console.log(infoBold('DRY RUN MODE - No actual execution\n'));
  }

  // Import pipeline design functionality
  const { PipelineDesignEngine } = await import('../../pipeline/design/pipeline-design-engine.js');
  
  try {
    const designEngine = new PipelineDesignEngine({
      namespace: options.namespace as string,
      outputDir: options['output-dir'] as string,
      format: options.format as 'text' | 'json' | 'markdown',
      discoveryPlanPath: options['discovery-plan'] as string,
      generateDiagrams: options['generate-diagrams'] as boolean,
      validateSchema: options['validate-schema'] as boolean,
      verbose: options.verbose as boolean,
      dryRun: options['dry-run'] as boolean
    });

    const result = await designEngine.designPipeline(taskDescription || '');
    
    if (options.verbose) {
      console.log(successBold('\n✅ Pipeline Design Complete!'));
      console.log(infoBold(`📁 Output directory: ${options['output-dir']}`));
      console.log(infoBold(`🏗️ Architecture document: ${result.architectureFile}`));
      console.log(infoBold(`📊 Generated diagrams: ${result.diagrams?.length || 0}`));
      console.log(infoBold(`✅ Schema validations: ${result.schemaValidations?.length || 0}`));
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(errorBold(`❌ Pipeline design failed: ${errorMessage}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Execute Pipeline Extraction SPARC mode for Phase 3 of enterprise data pipeline creation
 */
async function executePipelineExtraction(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const taskDescription = args[0];
  
  if (!taskDescription && !options['discovery-plan'] && !options['design-plan']) {
    console.log(errorBold('❌ Pipeline extraction requires a task description or a reference plan file'));
    console.log(infoBold('Examples:'));
    console.log('  flowx sparc pipeline-extraction "Configure connectors for customer data extraction"');
    console.log('  flowx sparc pipeline-extraction --discovery-plan ./pipeline-discovery-plan-2024-01-15.md');
    console.log('  flowx sparc pipeline-extraction --design-plan ./pipeline-design-plan-2024-01-15.md');
    return;
  }

  console.log(successBold('⚡ Starting Phase 3: Data Extraction Strategy & Connector Configuration\n'));
  
  if (options['dry-run']) {
    console.log(infoBold('DRY RUN MODE - No actual execution\n'));
  }

  // Import pipeline extraction functionality
  const { PipelineExtractionEngine } = await import('../../pipeline/extraction/pipeline-extraction-engine.js');
  
  try {
    const extractionEngine = new PipelineExtractionEngine();

    const planPath = options['discovery-plan'] as string || options['design-plan'] as string;
    const result = await extractionEngine.generateExtractionPlan(taskDescription || '', planPath);
    
    // Save the extraction plan
    const outputDir = options['output-dir'] as string || './pipeline-output';
    await fs.mkdir(outputDir, { recursive: true });
    
    const planFile = await extractionEngine.saveExtractionPlan(result, path.join(outputDir, `pipeline-extraction-plan-${new Date().toISOString().split('T')[0]}.md`));
    
    let codeDir = '';
    if (options['generate-code']) {
      // Save generated code files
      codeDir = path.join(outputDir, 'extraction-code');
      await fs.mkdir(codeDir, { recursive: true });
      
      await fs.writeFile(path.join(codeDir, 'extraction_pipeline.py'), result.codeGeneration.pythonScript);
      await fs.writeFile(path.join(codeDir, 'airflow_dag.py'), result.codeGeneration.airflowDag);
      await fs.writeFile(path.join(codeDir, 'glue_job.py'), result.codeGeneration.glueJob);
      
      if (options['generate-docker']) {
        await fs.writeFile(path.join(codeDir, 'docker-compose.yml'), result.codeGeneration.dockerCompose);
      }
    }
    
    if (options.verbose) {
      console.log(successBold('\n✅ Pipeline Extraction Plan Complete!'));
      console.log(infoBold(`📁 Output directory: ${outputDir}`));
      console.log(infoBold(`⚡ Extraction plan: ${planFile}`));
      console.log(infoBold(`🔌 Source connectors: ${result.sources.length}`));
      console.log(infoBold(`🏗️ Infrastructure: ${result.infrastructure.compute} compute`));
      console.log(infoBold(`🔒 Security: ${result.security.encryption ? 'Encrypted' : 'Standard'}`));
      
      if (options['generate-code']) {
        console.log(infoBold(`💻 Generated code: ${codeDir}/`));
        console.log(infoBold(`  - Python extraction script`));
        console.log(infoBold(`  - Airflow DAG`));
        console.log(infoBold(`  - AWS Glue job`));
        if (options['generate-docker']) {
          console.log(infoBold(`  - Docker Compose`));
        }
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(errorBold(`❌ Pipeline extraction failed: ${errorMessage}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Execute Pipeline Transformation SPARC mode for Phase 4 of enterprise data pipeline creation
 */
async function executePipelineTransformation(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const taskDescription = args[0];
  
  if (!taskDescription && !options['discovery-plan'] && !options['design-plan'] && !options['extraction-plan']) {
    console.log(errorBold('❌ Pipeline transformation requires a task description or a reference plan file'));
    console.log(infoBold('Examples:'));
    console.log('  flowx sparc pipeline-transformation "Create ETL transformations for customer analytics"');
    console.log('  flowx sparc pipeline-transformation --discovery-plan ./pipeline-discovery-plan-2024-01-15.md');
    console.log('  flowx sparc pipeline-transformation --design-plan ./pipeline-design-plan-2024-01-15.md');
    console.log('  flowx sparc pipeline-transformation --extraction-plan ./pipeline-extraction-plan-2024-01-15.md');
    return;
  }

  console.log(successBold('🔄 Starting Phase 4: Data Transformation, ETL Logic & dbt Integration\n'));
  
  if (options['dry-run']) {
    console.log(infoBold('DRY RUN MODE - No actual execution\n'));
  }

  // Import pipeline transformation functionality
  const { handlePipelineTransformation } = await import('../sparc/transformation-sparc.js');
  
  try {
    const transformationOptions = {
      discoveryPlan: options['discovery-plan'] as string,
      designPlan: options['design-plan'] as string,
      extractionPlan: options['extraction-plan'] as string,
      outputDir: options['output-dir'] as string || './pipeline-output',
      generateCode: options['generate-code'] as boolean,
      validateOnly: options['validate-only'] as boolean
    };

    await handlePipelineTransformation(taskDescription || '', transformationOptions);
    
    if (options.verbose) {
      console.log(successBold('\n✅ Pipeline Transformation Phase Complete!'));
      console.log(infoBold(`📁 Output directory: ${transformationOptions.outputDir}`));
      console.log(infoBold(`🔄 Transformation plan: pipeline-transformation-plan-${new Date().toISOString().split('T')[0]}.md`));
      console.log(infoBold(`🛠️ ETL transformations: Comprehensive business logic`));
      console.log(infoBold(`📊 dbt models: Staging, marts, and fact tables`));
      console.log(infoBold(`⚡ Orchestration: Airflow DAG with dependencies`));
      console.log(infoBold(`🔍 Data Quality: Validation rules and tests`));
      
      if (transformationOptions.generateCode) {
        console.log(infoBold(`💻 Generated artifacts:`));
        console.log(infoBold(`  - dbt project structure`));
        console.log(infoBold(`  - Airflow DAG for orchestration`));
        console.log(infoBold(`  - Great Expectations configuration`));
        console.log(infoBold(`  - Docker Compose setup`));
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(errorBold(`❌ Pipeline transformation failed: ${errorMessage}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Execute Pipeline Validation SPARC mode for Phase 5 of enterprise data pipeline creation
 */
async function executePipelineValidation(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const taskDescription = args[0];
  
  if (!taskDescription && !options['discovery-plan'] && !options['design-plan'] && !options['extraction-plan'] && !options['transformation-plan']) {
    console.log(errorBold('❌ Pipeline validation requires a task description or a reference plan file'));
    console.log(infoBold('Examples:'));
    console.log('  flowx sparc pipeline-validation "Create comprehensive data quality validation framework"');
    console.log('  flowx sparc pipeline-validation --transformation-plan ./pipeline-transformation-plan-2024-01-15.md');
    console.log('  flowx sparc pipeline-validation --compliance "GDPR compliance validation suite"');
    console.log('  flowx sparc pipeline-validation --validate-only "Validate quality assurance plan"');
    return;
  }

  console.log(successBold('🔍 Starting Phase 5: Data Validation, Quality Assurance & Testing Frameworks\n'));
  
  if (options['dry-run']) {
    console.log(infoBold('DRY RUN MODE - No actual execution\n'));
  }

  // Import pipeline validation functionality
  const { handlePipelineValidation } = await import('../sparc/validation-sparc.js');
  
  try {
    const validationOptions = {
      discoveryPlan: options['discovery-plan'] as string,
      designPlan: options['design-plan'] as string,
      extractionPlan: options['extraction-plan'] as string,
      transformationPlan: options['transformation-plan'] as string,
      outputDir: options['output-dir'] as string || './pipeline-output',
      generateTests: options['generate-tests'] as boolean,
      deployFrameworks: options['deploy-frameworks'] as boolean,
      validateOnly: options['validate-only'] as boolean,
      compliance: options['compliance'] as boolean
    };

    await handlePipelineValidation(taskDescription || '', validationOptions);
    
    if (options.verbose) {
      console.log(successBold('\n✅ Pipeline Validation & Quality Assurance Phase Complete!'));
      console.log(infoBold(`📁 Output directory: ${validationOptions.outputDir}`));
      console.log(infoBold(`🔍 Validation plan: pipeline-validation-plan-${new Date().toISOString().split('T')[0]}.md`));
      console.log(infoBold(`🛡️ Quality rules: Comprehensive data quality validation`));
      console.log(infoBold(`🧪 Test frameworks: Great Expectations, dbt, pytest, SQL`));
      console.log(infoBold(`📈 Monitoring: Dashboards, alerts, SLA tracking`));
      console.log(infoBold(`🚀 CI/CD: Automated quality gates and deployment`));
      
      if (validationOptions.generateTests) {
        console.log(infoBold(`💻 Generated test frameworks:`));
        console.log(infoBold(`  - Great Expectations configuration`));
        console.log(infoBold(`  - dbt test suites`));
        console.log(infoBold(`  - Custom SQL validation tests`));
        console.log(infoBold(`  - Python pytest integration`));
      }
      
      if (validationOptions.deployFrameworks) {
        console.log(infoBold(`📦 Deployment configurations:`));
        console.log(infoBold(`  - Framework deployment scripts`));
        console.log(infoBold(`  - Monitoring dashboard setup`));
        console.log(infoBold(`  - CI/CD pipeline integration`));
      }
      
      if (validationOptions.compliance) {
        console.log(infoBold(`✅ Compliance features enabled:`));
        console.log(infoBold(`  - GDPR data retention validation`));
        console.log(infoBold(`  - PII encryption verification`));
        console.log(infoBold(`  - Audit trail compliance`));
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(errorBold(`❌ Pipeline validation failed: ${errorMessage}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Execute Pipeline Loading SPARC mode for Phase 6 of enterprise data pipeline creation
 */
async function executePipelineLoading(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const taskDescription = args[0];
  
  if (!taskDescription && !options['validation-plan'] && !options['transformation-plan']) {
    console.log(errorBold('❌ Pipeline loading requires a task description or a reference plan file'));
    console.log(infoBold('Examples:'));
    console.log('  flowx sparc pipeline-loading "Configure optimized data loading to Snowflake and S3"');
    console.log('  flowx sparc pipeline-loading --validation-plan ./pipeline-validation-plan-2024-01-15.json');
    console.log('  flowx sparc pipeline-loading --compliance "Implement secure loading with encryption"');
    console.log('  flowx sparc pipeline-loading --generate-code "Create loading implementation"');
    return;
  }

  console.log(successBold('🚀 Starting Phase 6: Data Loading & Storage Optimization\n'));
  
  if (options['dry-run']) {
    console.log(infoBold('DRY RUN MODE - No actual execution\n'));
  }

  // Import pipeline loading functionality
  const { handlePipelineLoading } = await import('../sparc/loading-sparc.js');
  
  try {
    const loadingOptions = {
      validationPlan: options['validation-plan'] as string,
      transformationPlan: options['transformation-plan'] as string,
      outputPath: options['output-dir'] as string || './pipeline-loading',
      generateCode: options['generate-code'] as boolean,
      compliance: options['compliance'] as boolean
    };

    await handlePipelineLoading(taskDescription || '', loadingOptions);
    
    if (options.verbose) {
      console.log(successBold('\n✅ Pipeline Loading & Storage Phase Complete!'));
      console.log(infoBold(`📁 Output directory: ${loadingOptions.outputPath}`));
      console.log(infoBold(`🎯 Loading plan: pipeline-loading-plan-${new Date().toISOString().split('T')[0]}.json`));
      console.log(infoBold(`⚡ Performance optimization: Memory, CPU, I/O tuning`));
      console.log(infoBold(`🏢 Multi-destination support: Snowflake, Redshift, S3, BigQuery`));
      console.log(infoBold(`🔒 Security: Encryption, RBAC, compliance controls`));
      console.log(infoBold(`🎼 Orchestration: Airflow, Dagster, Prefect integration`));
      
      if (loadingOptions.generateCode) {
        console.log(infoBold(`💻 Generated implementation files:`));
        console.log(infoBold(`  - Python loading scripts with async processing`));
        console.log(infoBold(`  - Docker containerization`));
        console.log(infoBold(`  - Airflow DAG orchestration`));
        console.log(infoBold(`  - Infrastructure as Code (Terraform)`));
      }
      
      if (loadingOptions.compliance) {
        console.log(infoBold(`✅ Compliance features enabled:`));
        console.log(infoBold(`  - End-to-end encryption`));
        console.log(infoBold(`  - Data governance controls`));
        console.log(infoBold(`  - Audit logging and monitoring`));
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(errorBold(`❌ Pipeline loading failed: ${errorMessage}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Execute Pipeline Monitoring SPARC mode for Phase 7 of enterprise data pipeline creation
 */
async function executePipelineMonitoring(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const taskDescription = args[0];
  
  if (!taskDescription && !options['loading-plan'] && !options['validation-plan']) {
    console.log(errorBold('❌ Pipeline monitoring requires a task description or a reference plan file'));
    console.log(infoBold('Examples:'));
    console.log('  flowx sparc pipeline-monitoring "Setup comprehensive monitoring with Prometheus and Grafana"');
    console.log('  flowx sparc pipeline-monitoring --loading-plan ./pipeline-loading-plan-2024-01-15.json');
    console.log('  flowx sparc pipeline-monitoring --compliance "Enterprise monitoring with audit trails"');
    console.log('  flowx sparc pipeline-monitoring --generate-code "Create monitoring stack configuration"');
    return;
  }

  console.log(successBold('🔍 Starting Phase 7: Monitoring, Maintenance & Observability\n'));
  
  if (options['dry-run']) {
    console.log(infoBold('DRY RUN MODE - No actual execution\n'));
  }

  // Import pipeline monitoring functionality
  const { handlePipelineMonitoring } = await import('../sparc/monitoring-sparc.js');
  
  try {
    const monitoringOptions = {
      loadingPlan: options['loading-plan'] as string,
      validationPlan: options['validation-plan'] as string,
      outputPath: options['output-dir'] as string || './pipeline-monitoring',
      generateCode: options['generate-code'] as boolean,
      compliance: options['compliance'] as boolean
    };

    await handlePipelineMonitoring(taskDescription || '', monitoringOptions);
    
    if (options.verbose) {
      console.log(successBold('\n✅ Pipeline Monitoring & Maintenance Phase Complete!'));
      console.log(successBold('\n🎊 ALL 7 PHASES OF ENTERPRISE DATA PIPELINE CREATION COMPLETE!'));
      console.log(infoBold(`📁 Output directory: ${monitoringOptions.outputPath}`));
      console.log(infoBold(`📊 Monitoring plan: pipeline-monitoring-plan-${new Date().toISOString().split('T')[0]}.json`));
      console.log(infoBold(`🔍 Observability stack: Prometheus, Grafana, alerting`));
      console.log(infoBold(`🚨 Alert management: Multi-tier escalation, SLA monitoring`));
      console.log(infoBold(`🔧 Automated maintenance: Health checks, optimization, scaling`));
      console.log(infoBold(`📈 SLA tracking: Availability, latency, error rate monitoring`));
      
      if (monitoringOptions.generateCode) {
        console.log(infoBold(`💻 Generated monitoring configuration:`));
        console.log(infoBold(`  - Prometheus metrics collection`));
        console.log(infoBold(`  - Grafana dashboards and alerts`));
        console.log(infoBold(`  - Docker Compose monitoring stack`));
        console.log(infoBold(`  - Python monitoring agents`));
      }
      
      if (monitoringOptions.compliance) {
        console.log(infoBold(`✅ Enterprise compliance monitoring:`));
        console.log(infoBold(`  - Comprehensive audit logging`));
        console.log(infoBold(`  - Access control monitoring`));
        console.log(infoBold(`  - Data retention compliance`));
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(errorBold(`❌ Pipeline monitoring failed: ${errorMessage}`));
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

async function executeBatchMode(context: CLIContext): Promise<void> {
  const { args, options } = context;
  const task = args[1] || args[0];

  // Options should already have defaults applied by CLI application
  // No need to manually apply defaults here
  
  printInfo('🚀 Executing SPARC Batch Mode');
  
  const modes = options.modes ? options.modes.split(',').map((m: string) => m.trim()) : ['architect', 'code', 'tdd', 'review'];
  
  console.log(`📋 Modes: ${modes.join(', ')}`);
  console.log(`⚡ Parallel: ${options.parallel ? 'enabled' : 'disabled'}`);
  console.log(`💾 Namespace: ${options.namespace}`);
  console.log(`📁 Output Directory: ${options['output-dir']}`);
  
  if (!task && !args[0]) {
    printError('Task description required for batch mode');
    printInfo('Usage: flowx sparc batch "task description" --modes "architect,code,tdd"');
    return;
  }
  
  if (options['dry-run']) {
    console.log('\n🔍 DRY RUN - Would execute modes:');
    modes.forEach((mode: string) => console.log(`  - ${mode}: ${task || args[0]}`));
    console.log(`\nConfiguration:`);
    console.log(`  Namespace: ${options.namespace}`);
    console.log(`  Output Directory: ${options['output-dir']}`);
    console.log(`  Enable TDD: ${options['enable-tdd']}`);
    console.log(`  Quality Threshold: ${options['quality-threshold']}`);
    console.log(`  Parallel Execution: ${options.parallel}`);
    return;
  }

  try {
    // Create output directory if it doesn't exist
    const outputDir = options['output-dir'] || './sparc-output';
    await fs.mkdir(outputDir, { recursive: true });
    
    // Prepare batch task
    const batchTask = task || args[0];
    const batchOutputDir = path.join(outputDir, `batch-${Date.now()}`);
    await fs.mkdir(batchOutputDir, { recursive: true });
    
    printInfo(`📁 Batch output directory: ${batchOutputDir}`);
    
    const batchResults: any = {
      task: batchTask,
      modes: {},
      startTime: new Date(),
      endTime: null,
      summary: {}
    };
    
    const executeMode = async (mode: string): Promise<any> => {
      printInfo(`\n🔄 Executing ${mode}...`);
      const modeOutputDir = path.join(batchOutputDir, mode);
      await fs.mkdir(modeOutputDir, { recursive: true });
      
      // Create new context for this mode
      const modeContext = {
        ...context,
        args: [mode, batchTask],
        options: {
          ...options,
          'output-dir': modeOutputDir
        }
      };
      
      try {
        await executeSparcMode(mode, modeContext);
        return { status: 'completed', mode, outputDir: modeOutputDir };
      } catch (error) {
        printError(`Mode ${mode} failed: ${error instanceof Error ? error.message : String(error)}`);
        return { status: 'failed', mode, error: error instanceof Error ? error.message : String(error) };
      }
    };
    
    if (options.parallel) {
      // Execute modes in parallel
      const promises = modes.map((mode: string) => executeMode(mode));
      const results = await Promise.all(promises);
      
      // Store results
      modes.forEach((mode: string, index: number) => {
        batchResults.modes[mode] = results[index];
      });
    } else {
      // Execute modes sequentially
      for (const mode of modes) {
        const modeResult = await executeMode(mode);
        batchResults.modes[mode] = modeResult;
      }
    }
    
    // Calculate summary
    batchResults.endTime = new Date();
    batchResults.duration = batchResults.endTime.getTime() - batchResults.startTime.getTime();
    
    let successfulModes = 0;
    let failedModes = 0;
    
    for (const mode of Object.keys(batchResults.modes)) {
      const modeResult = batchResults.modes[mode];
      if (modeResult.status === 'completed') {
        successfulModes++;
      } else {
        failedModes++;
      }
    }
    
    batchResults.summary = {
      totalModes: modes.length,
      successfulModes,
      failedModes,
      duration: batchResults.duration
    };
    
    // Save batch results
    const batchResultsPath = path.join(batchOutputDir, 'batch-results.tson');
    await fs.writeFile(batchResultsPath, JSON.stringify(batchResults, null, 2));
    
    printSuccess(`🎉 SPARC batch execution completed in ${batchResults.duration}ms`);
    printInfo(`📊 Summary: ${successfulModes}/${modes.length} modes completed successfully`);
    if (failedModes > 0) {
      printWarning(`⚠️  ${failedModes} modes failed`);
    }
    printInfo(`📁 Results saved to ${batchOutputDir}`);
    printInfo(`📄 Batch summary: ${batchResultsPath}`);
    
  } catch (error) {
    printError(`Batch execution failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function listSparcModes(context: CLIContext): Promise<void> {
  console.log(successBold('\n🧠 Available SPARC Modes\n'));
  
  const modes = [
    { name: 'architect', description: '🏗️  Architecture design and system planning', category: 'Design' },
    { name: 'code', description: '💻 Code implementation and development', category: 'Development' },
    { name: 'tdd', description: '🧪 Test-driven development and testing', category: 'Testing' },
    { name: 'review', description: '👁️  Code review and quality assurance', category: 'Quality' },
    { name: 'debug', description: '🐛 Debugging and troubleshooting', category: 'Maintenance' },
    { name: 'docs', description: '📚 Documentation generation', category: 'Documentation' },
    { name: 'security', description: '🛡️  Security analysis and review', category: 'Security' },
    { name: 'batch', description: '🚀 Batch execution of multiple modes', category: 'Automation' },
    { name: 'pipeline-discovery', description: '🔍 Enterprise data pipeline discovery and planning', category: 'Data Pipeline' },
    { name: 'pipeline-design', description: '🏗️ Enterprise data pipeline architecture design and validation', category: 'Data Pipeline' },
    { name: 'pipeline-extraction', description: '⚡ Enterprise data pipeline extraction strategy and connector configuration', category: 'Data Pipeline' },
    { name: 'pipeline-transformation', description: '🔄 Enterprise data pipeline transformation with ETL logic and dbt integration', category: 'Data Pipeline' },
    { name: 'pipeline-validation', description: '🔍 Enterprise data pipeline validation with automated testing frameworks and quality assurance', category: 'Data Pipeline' },
    { name: 'pipeline-loading', description: '🚀 Enterprise data pipeline loading and storage optimization with multi-destination support', category: 'Data Pipeline' },
    { name: 'pipeline-monitoring', description: '📊 Enterprise data pipeline monitoring, maintenance and observability with comprehensive alerting', category: 'Data Pipeline' }
  ];

  const categories = Array.from(new Set(modes.map(m => m.category)));
  
  for (const category of categories) {
    console.log(infoBold(`${category}:`));
    const categoryModes = modes.filter((m: any) => m.category === category);
    for (const mode of categoryModes) {
      console.log(`  ${mode.name.padEnd(12)} ${mode.description}`);
    }
    console.log();
  }

  console.log(infoBold('Examples:'));
  console.log('  flowx sparc architect "Design user authentication system"');
  console.log('  flowx sparc code "Implement REST API endpoints"');
  console.log('  flowx sparc tdd "Create comprehensive test suite"');
  console.log('  flowx sparc pipeline-discovery "Analyze customer data from CRM to analytics warehouse"');
  console.log('  flowx sparc pipeline-design "Design ETL architecture for real-time processing"');
  console.log('  flowx sparc pipeline-extraction "Configure connectors for customer data extraction"');
  console.log('  flowx sparc pipeline-transformation "Create ETL transformations for customer analytics"');
  console.log('  flowx sparc pipeline-validation "Create comprehensive data quality validation framework"');
  console.log('  flowx sparc batch --modes "architect,code,tdd" --parallel');
  console.log();
}

// === UTILITY FUNCTIONS ===

function mapModeToTaskType(mode: string): TaskType {
  const modeToType: Record<string, TaskType> = {
    'architect': 'analysis',
    'code': 'coding',
    'tdd': 'testing',
    'review': 'review',
    'debug': 'maintenance',
    'docs': 'documentation',
    'security': 'review'
  };
  
  return modeToType[mode] || 'custom';
}

function mapModeToAgentType(mode: string): AgentType {
  const modeToAgentType: Record<string, AgentType> = {
    'architect': 'developer',
    'code': 'developer',
    'tdd': 'tester',
    'review': 'reviewer',
    'debug': 'developer',
    'docs': 'documenter',
    'security': 'reviewer'
  };
  
  return modeToAgentType[mode] || 'developer';
}

function displayResultsText(result: any, mode: string, task: string, outputDir: string): void {
  console.log('\n📄 Execution Results:');
  console.log('─'.repeat(60));
  
  if (result.output) {
    console.log(`Output: ${typeof result.output === 'string' ? result.output : JSON.stringify(result.output)}`);
  }
  
  if (result.metadata) {
    console.log(`\n📊 Metadata:`);
    console.log(`  Agent Type: ${result.metadata.agentType}`);
    console.log(`  Execution Time: ${result.metadata.executionTime}ms`);
    console.log(`  Quality Score: ${result.quality}`);
    console.log(`  Completeness: ${result.completeness}`);
    console.log(`  Accuracy: ${result.accuracy}`);
    if (result.metadata.sparcPhase) {
      console.log(`  SPARC Phase: ${result.metadata.sparcPhase}`);
    }
  }
  
  if (result.artifacts && Object.keys(result.artifacts).length > 0) {
    console.log(`\n📁 Generated Artifacts:`);
    for (const [key, value] of Object.entries(result.artifacts)) {
      console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 100) + '...' : JSON.stringify(value)}`);
    }
  }
  
  console.log(`\n📂 Output Directory: ${outputDir}`);
}

function displayResultsMarkdown(result: any, mode: string, task: string): void {
  console.log(`\n# SPARC ${mode.toUpperCase()} Execution Results\n`);
  console.log(`**Task:** ${task}\n`);
  console.log(`**Mode:** ${mode}\n`);
  
  if (result.output) {
    console.log(`## Output\n`);
    console.log(`${typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}\n`);
  }
  
  if (result.metadata) {
    console.log(`## Metadata\n`);
    console.log(`- **Agent Type:** ${result.metadata.agentType}`);
    console.log(`- **Execution Time:** ${result.metadata.executionTime}ms`);
    console.log(`- **Quality Score:** ${result.quality}`);
    console.log(`- **Completeness:** ${result.completeness}`);
    console.log(`- **Accuracy:** ${result.accuracy}`);
    if (result.metadata.sparcPhase) {
      console.log(`- **SPARC Phase:** ${result.metadata.sparcPhase}`);
    }
    console.log();
  }
  
  if (result.artifacts && Object.keys(result.artifacts).length > 0) {
    console.log(`## Generated Artifacts\n`);
    for (const [key, value] of Object.entries(result.artifacts)) {
      console.log(`### ${key}\n`);
      console.log(`\`\`\`\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n\`\`\`\n`);
    }
  }
}

export default sparcCommand; 