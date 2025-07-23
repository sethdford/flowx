/**
 * Batch Command
 * Comprehensive batch operations for multiple projects and workflows
 */

import type { CLIContext, CLICommand } from '../../interfaces/index.js';
import { successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';

export const batchCommand: CLICommand = {
  name: 'batch',
  description: 'Execute batch operations for multiple projects and workflows',
  category: 'System',
  options: [
    {
      name: 'projects',
      description: 'Comma-separated list of project names',
      type: 'string'
    },
    {
      name: 'template',
      description: 'Template to use for all projects',
      type: 'string',
      default: 'basic'
    },
    {
      name: 'config',
      description: 'Batch configuration file',
      type: 'string'
    },
    {
      name: 'parallel',
      description: 'Execute operations in parallel',
      type: 'boolean'
    },
    {
      name: 'dry-run',
      description: 'Show what would be executed without running',
      type: 'boolean'
    },
    {
      name: 'force',
      description: 'Force overwrite existing projects',
      type: 'boolean'
    }
  ],
  subcommands: [
    {
      name: 'init',
      description: 'Initialize multiple projects',
      handler: async (context: CLIContext) => await batchInitProjects(context)
    },
    {
      name: 'sparc',
      description: 'Execute SPARC operations across multiple projects',
      handler: async (context: CLIContext) => await batchSparcOperations(context)
    },
    {
      name: 'swarm',
      description: 'Create and manage multiple swarms',
      handler: async (context: CLIContext) => await batchSwarmOperations(context)
    },
    {
      name: 'config',
      description: 'Manage batch configurations',
      handler: async (context: CLIContext) => await manageBatchConfig(context)
    },
    {
      name: 'status',
      description: 'Show status of batch operations',
      handler: async (context: CLIContext) => await showBatchStatus(context)
    },
    {
      name: 'templates',
      description: 'List available batch templates',
      handler: async (context: CLIContext) => await listBatchTemplates(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    if (args.length === 0) {
      return await showBatchHelp(context);
    }

    // Default to init if projects are specified
    if (options.projects) {
      return await batchInitProjects(context);
    }

    printError('No batch operation specified');
    printInfo('Use "node cli.ts batch --help" for available operations');
  }
};

async function batchInitProjects(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('🚀 Batch Project Initialization');
  
  let projects: string[] = [];
  let config: any = {};

  // Load from config file if specified
  if (options.config) {
    try {
      const configContent = readFileSync(options.config, 'utf8');
      config = JSON.parse(configContent);
      projects = config.projects || [];
    } catch (error) {
      printError(`Failed to load config file: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  }

  // Override with command line projects
  if (options.projects) {
    projects = options.projects.split(',').map((p: string) => p.trim());
  }

  if (projects.length === 0) {
    printError('No projects specified. Use --projects or --config');
    return;
  }

  console.log(`📋 Projects to create: ${projects.join(', ')}`);
  console.log(`📝 Template: ${options.template || config.template || 'basic'}`);
  console.log(`⚡ Parallel: ${options.parallel ? 'enabled' : 'disabled'}`);

  if (options['dry-run']) {
    console.log('\n🔍 DRY RUN - Would create projects:');
    projects.forEach((project: string) => console.log(`  - ${project}`));
    return;
  }

  try {
    if (options.parallel) {
      // Parallel execution
      const promises = projects.map((project: string) => createProject(project, options, config));
      const results = await Promise.allSettled(promises);
      
      console.log('\n✅ Batch initialization results:');
      results.forEach((result, index) => {
        const status = result.status === 'fulfilled' ? '✅' : '❌';
        console.log(`  ${status} ${projects[index]}: ${result.status}`);
      });
    } else {
      // Sequential execution
      for (const project of projects) {
        console.log(`\n🔄 Creating ${project}...`);
        try {
          await createProject(project, options, config);
          console.log(`✅ ${project}: completed`);
        } catch (error) {
          console.log(`❌ ${project}: failed - ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    
    printSuccess('🎉 Batch project initialization completed');
    
  } catch (error) {
    printError(`Batch initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function createProject(projectName: string, options: any, config: any): Promise<void> {
  const template = options.template || config.template || 'basic';
  const forceFlag = options.force ? '--force' : '';
  const sparcFlag = config.sparc || options.sparc ? '--sparc' : '';
  const swarmFlag = config.swarm || options.swarm ? '--swarm' : '';
  
  const command = `node cli.ts init ${projectName} --template ${template} ${forceFlag} ${sparcFlag} ${swarmFlag}`.trim();
  
  execSync(command, { stdio: 'pipe' });
}

async function batchSparcOperations(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  printInfo('🧠 Batch SPARC Operations');
  
  const operation = args[0] || 'architect';
  const task = args[1] || 'Batch SPARC operation';
  const modes = options.modes ? options.modes.split(',').map((m: string) => m.trim()) : [operation];
  
  console.log(`📋 Operation: ${operation}`);
  console.log(`📝 Task: ${task}`);
  console.log(`🔧 Modes: ${modes.join(', ')}`);
  console.log(`⚡ Parallel: ${options.parallel ? 'enabled' : 'disabled'}`);

  if (options['dry-run']) {
    console.log('\n🔍 DRY RUN - Would execute SPARC modes:');
    modes.forEach((mode: string) => console.log(`  - ${mode}: ${task}`));
    return;
  }

  try {
    if (options.parallel) {
      const promises = modes.map((mode: string) => 
        execSparcMode(mode, task, options)
      );
      await Promise.all(promises);
    } else {
      for (const mode of modes) {
        console.log(`\n🔄 Executing SPARC ${mode}...`);
        await execSparcMode(mode, task, options);
        console.log(`✅ ${mode}: completed`);
      }
    }
    
    printSuccess('🎉 Batch SPARC operations completed');
    
  } catch (error) {
    printError(`Batch SPARC operations failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function execSparcMode(mode: string, task: string, options: any): Promise<void> {
  const dryRunFlag = options['dry-run'] ? '--dry-run' : '';
  const namespaceFlag = options.namespace ? `--namespace ${options.namespace}` : '';
  
  const command = `node cli.ts sparc ${mode} "${task}" ${dryRunFlag} ${namespaceFlag}`.trim();
  
  execSync(command, { stdio: 'pipe' });
}

async function batchSwarmOperations(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  printInfo('🐝 Batch Swarm Operations');
  
  const operation = args[0] || 'create';
  const swarmNames = options.swarms ? options.swarms.split(',').map((s: string) => s.trim()) : ['batch-swarm'];
  
  console.log(`📋 Operation: ${operation}`);
  console.log(`🐝 Swarms: ${swarmNames.join(', ')}`);
  console.log(`⚡ Parallel: ${options.parallel ? 'enabled' : 'disabled'}`);

  if (options['dry-run']) {
    console.log('\n🔍 DRY RUN - Would execute swarm operations:');
    swarmNames.forEach((swarm: string) => console.log(`  - ${operation} ${swarm}`));
    return;
  }

  try {
    for (const swarmName of swarmNames) {
      console.log(`\n🔄 ${operation} swarm: ${swarmName}...`);
      await execSwarmOperation(operation, swarmName, options);
      console.log(`✅ ${swarmName}: ${operation} completed`);
    }
    
    printSuccess('🎉 Batch swarm operations completed');
    
  } catch (error) {
    printError(`Batch swarm operations failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function execSwarmOperation(operation: string, swarmName: string, options: any): Promise<void> {
  const agentsFlag = options.agents ? `--agents ${options.agents}` : '--agents 3';
  const objectiveFlag = options.objective ? `--objective "${options.objective}"` : '';
  
  let command = '';
  switch (operation) {
    case 'create':
      command = `node cli.ts swarm create ${swarmName} ${agentsFlag} ${objectiveFlag}`;
      break;
    case 'start':
      command = `node cli.ts swarm start ${swarmName}`;
      break;
    case 'stop':
      command = `node cli.ts swarm stop ${swarmName}`;
      break;
    case 'status':
      command = `node cli.ts swarm status ${swarmName}`;
      break;
    default:
      command = `node cli.ts swarm ${operation} ${swarmName}`;
  }
  
  execSync(command.trim(), { stdio: 'pipe' });
}

async function manageBatchConfig(context: CLIContext): Promise<void> {
  const { args } = context;
  
  const action = args[0] || 'create';
  
  switch (action) {
    case 'create':
      await createBatchConfig(context);
      break;
    case 'validate':
      await validateBatchConfig(context);
      break;
    case 'list':
      await listBatchConfigs(context);
      break;
    default:
      printError(`Unknown config action: ${action}`);
      printInfo('Available actions: create, validate, list');
  }
}

async function createBatchConfig(context: CLIContext): Promise<void> {
  const { args } = context;
  
  const configFile = args[1] || 'batch-config.tson';
  
  const defaultConfig = {
    name: 'Default Batch Configuration',
    version: '1.0.0',
    template: 'basic',
    projects: [
      'api-service',
      'web-frontend', 
      'mobile-app'
    ],
    sparc: true,
    swarm: true,
    parallel: true,
    features: [
      'monitoring',
      'testing',
      'deployment'
    ],
    environments: [
      'development',
      'staging',
      'production'
    ]
  };
  
  try {
    writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
    printSuccess(`✅ Created batch configuration: ${configFile}`);
    console.log('Edit the file to customize your batch operations.');
  } catch (error) {
    printError(`Failed to create config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validateBatchConfig(context: CLIContext): Promise<void> {
  const { args } = context;
  
  const configFile = args[1] || 'batch-config.tson';
  
  if (!existsSync(configFile)) {
    printError(`Configuration file not found: ${configFile}`);
    return;
  }
  
  try {
    const content = readFileSync(configFile, 'utf8');
    const config = JSON.parse(content);
    
    // Validate required fields
    const required = ['name', 'projects'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      printError(`Missing required fields: ${missing.join(', ')}`);
      return;
    }
    
    printSuccess(`✅ Configuration is valid: ${configFile}`);
    console.log(`Projects: ${config.projects.length}`);
    console.log(`Template: ${config.template || 'basic'}`);
    console.log(`Features: ${(config.features || []).join(', ')}`);
    
  } catch (error) {
    printError(`Invalid configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listBatchConfigs(context: CLIContext): Promise<void> {
  printInfo('📋 Available Batch Configurations');
  
  const configs = [
    { name: 'batch-config-simple.tson', description: 'Basic project setup' },
    { name: 'batch-config-advanced.tson', description: 'Advanced features enabled' },
    { name: 'batch-config-enterprise.tson', description: 'Enterprise-grade setup' }
  ];
  
  console.log('\nConfiguration Files:');
  configs.forEach(config => {
    const status = existsSync(config.name) ? '✅ Found' : '❌ Missing';
    console.log(`  ${config.name.padEnd(30)} ${config.description.padEnd(40)} ${status}`);
  });
}

async function showBatchStatus(context: CLIContext): Promise<void> {
  printInfo('📊 Batch Operations Status');
  
  // Mock status data - in real implementation, this would track actual operations
  const operations = [
    { id: 'batch-001', type: 'init', count: 3, status: 'completed', duration: '2.5s' },
    { id: 'batch-002', type: 'sparc', count: 4, status: 'running', duration: '45s' },
    { id: 'batch-003', type: 'swarm', count: 2, status: 'pending', duration: '-' }
  ];
  
  console.log('\nBatch Operations:');
  operations.forEach(op => {
    console.log(`  ${op.id.padEnd(12)} ${op.type.padEnd(8)} ${String(op.count).padEnd(8)} ${op.status.padEnd(12)} ${op.duration}`);
  });
}

async function listBatchTemplates(context: CLIContext): Promise<void> {
  printInfo('📋 Available Batch Templates');
  
  const templates = [
    { name: 'microservices', description: 'Multiple microservice projects', projects: '5-10' },
    { name: 'fullstack', description: 'Frontend + Backend + Mobile', projects: '3' },
    { name: 'enterprise', description: 'Enterprise application suite', projects: '8-15' },
    { name: 'development', description: 'Development team setup', projects: '3-5' },
    { name: 'research', description: 'Research project template', projects: '2-4' }
  ];
  
  console.log('\nBatch Templates:');
  templates.forEach(template => {
    console.log(`  ${template.name.padEnd(15)} ${template.description.padEnd(40)} ${template.projects} projects`);
  });
  
  console.log('\nUsage:');
  console.log('  node cli.ts batch init --template microservices --projects "api,web,mobile"');
}

async function showBatchHelp(context: CLIContext): Promise<void> {
  console.log(successBold('\n🚀 Batch Operations Help\n'));
  
  console.log(infoBold('SUBCOMMANDS:'));
  console.log('  init        Initialize multiple projects');
  console.log('  sparc       Execute SPARC operations across projects');
  console.log('  swarm       Create and manage multiple swarms');
  console.log('  config      Manage batch configurations');
  console.log('  status      Show status of batch operations');
  console.log('  templates   List available batch templates');
  
  console.log(infoBold('\nEXAMPLES:'));
  console.log('  node cli.ts batch init --projects "api,web,mobile" --template fullstack');
  console.log('  node cli.ts batch sparc architect "Design system" --modes "architect,code"');
  console.log('  node cli.ts batch swarm create --swarms "dev-team,qa-team" --parallel');
  console.log('  node cli.ts batch config create my-batch-config.tson');
  console.log('  node cli.ts batch status');
  
  console.log(infoBold('\nOPTIONS:'));
  console.log('  --projects    Comma-separated list of project names');
  console.log('  --template    Template to use for all projects');
  console.log('  --config      Batch configuration file');
  console.log('  --parallel    Execute operations in parallel');
  console.log('  --dry-run     Show what would be executed');
  console.log('  --force       Force overwrite existing projects');
} 