/**
 * System Initialization Command
 * Comprehensive initialization for Claude Flow projects
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.ts';
import { successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.ts';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export const initCommand: CLICommand = {
  name: 'init',
  description: 'Initialize a new Claude Flow project',
  category: 'System',
  usage: 'claude-flow init [PROJECT_NAME] [OPTIONS]',
  examples: [
    'claude-flow init my-project',
    'claude-flow init my-project --template basic',
    'claude-flow init --interactive',
    'claude-flow init --sparc --advanced',
    'claude-flow init --batch --config batch-config.json'
  ],
  arguments: [
    {
      name: 'project-name',
      description: 'Name of the project to initialize',
      required: false
    }
  ],
  options: [
    {
      name: 'template',
      short: 't',
      description: 'Project template to use',
      type: 'string',
      choices: ['basic', 'advanced', 'enterprise', 'minimal', 'sparc', 'swarm'],
      default: 'basic'
    },
    {
      name: 'interactive',
      short: 'i',
      description: 'Interactive setup mode',
      type: 'boolean'
    },
    {
      name: 'sparc',
      description: 'Initialize with SPARC methodology',
      type: 'boolean'
    },
    {
      name: 'swarm',
      description: 'Initialize with swarm capabilities',
      type: 'boolean'
    },
    {
      name: 'advanced',
      short: 'a',
      description: 'Enable advanced features',
      type: 'boolean'
    },
    {
      name: 'batch',
      short: 'b',
      description: 'Batch initialization mode',
      type: 'boolean'
    },
    {
      name: 'config',
      short: 'c',
      description: 'Configuration file for batch mode',
      type: 'string'
    },
    {
      name: 'force',
      short: 'f',
      description: 'Force initialization in non-empty directory',
      type: 'boolean'
    },
    {
      name: 'skip-install',
      description: 'Skip dependency installation',
      type: 'boolean'
    },
    {
      name: 'git',
      description: 'Initialize git repository',
      type: 'boolean',
      default: true
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    try {
      const projectName = args[0] || await getProjectName(options.interactive);
      const projectPath = join(process.cwd(), projectName);

      // Validate project directory
      await validateProjectDirectory(projectPath, options.force);

      // Get initialization configuration
      const config = await getInitializationConfig(options, projectName);

      // Create project structure
      await createProjectStructure(projectPath, config);

      // Initialize components based on options
      if (config.sparc) {
        await initializeSparc(projectPath, config);
      }

      if (config.swarm) {
        await initializeSwarm(projectPath, config);
      }

      if (config.advanced) {
        await initializeAdvancedFeatures(projectPath, config);
      }

      // Create configuration files
      await createConfigurationFiles(projectPath, config);

      // Initialize git repository
      if (config.git) {
        await initializeGitRepository(projectPath);
      }

      // Install dependencies
      if (!config.skipInstall) {
        await installDependencies(projectPath);
      }

      // Post-initialization validation
      await validateInitialization(projectPath);

      printSuccess(`Successfully initialized Claude Flow project: ${projectName}`);
      printInfo(`Next steps:`);
      console.log(`  cd ${projectName}`);
      console.log(`  claude-flow start`);

    } catch (error) {
      printError(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
};

interface InitializationConfig {
  projectName: string;
  template: string;
  sparc: boolean;
  swarm: boolean;
  advanced: boolean;
  batch: boolean;
  interactive: boolean;
  git: boolean;
  skipInstall: boolean;
  features: string[];
  customConfig?: any;
}

async function getProjectName(interactive: boolean): Promise<string> {
  if (interactive) {
    // In a real implementation, this would use a prompt library
    return 'claude-flow-project';
  }
  return 'claude-flow-project';
}

async function validateProjectDirectory(projectPath: string, force: boolean): Promise<void> {
  if (existsSync(projectPath)) {
    if (!force) {
      throw new Error(`Directory ${projectPath} already exists. Use --force to override.`);
    }
    
    // Check if directory is empty or contains only safe files
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(projectPath);
    const safeFiles = ['.git', '.gitignore', 'README.md', '.DS_Store'];
    const nonSafeFiles = files.filter(f => !safeFiles.includes(f));
    
    if (nonSafeFiles.length > 0) {
      printWarning(`Directory contains files: ${nonSafeFiles.join(', ')}`);
    }
  }
}

async function getInitializationConfig(options: any, projectName: string): Promise<InitializationConfig> {
  let config: InitializationConfig = {
    projectName,
    template: options.template || 'basic',
    sparc: options.sparc || false,
    swarm: options.swarm || false,
    advanced: options.advanced || false,
    batch: options.batch || false,
    interactive: options.interactive || false,
    git: options.git !== false,
    skipInstall: options['skip-install'] || false,
    features: []
  };

  // Load batch configuration if specified
  if (options.batch && options.config) {
    try {
      const configContent = await readFile(options.config, 'utf8');
      config.customConfig = JSON.parse(configContent);
      Object.assign(config, config.customConfig);
    } catch (error) {
      printWarning(`Failed to load batch config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Auto-enable features based on template
  switch (config.template) {
    case 'sparc':
      config.sparc = true;
      config.features.push('sparc-modes', 'workflows');
      break;
    case 'swarm':
      config.swarm = true;
      config.features.push('swarm-coordination', 'agent-management');
      break;
    case 'enterprise':
      config.advanced = true;
      config.features.push('monitoring', 'security', 'scaling');
      break;
    case 'advanced':
      config.advanced = true;
      config.features.push('mcp-integration', 'workflows');
      break;
  }

  return config;
}

async function createProjectStructure(projectPath: string, config: InitializationConfig): Promise<void> {
  printInfo('Creating project structure...');

  // Basic directory structure
  const directories = [
    'src',
    'docs',
    'examples',
    'tests',
    'config',
    '.claude-flow'
  ];

  // Add template-specific directories
  if (config.sparc) {
    directories.push('sparc', 'sparc/modes', 'sparc/workflows');
  }

  if (config.swarm) {
    directories.push('swarms', 'agents', 'coordinators');
  }

  if (config.advanced) {
    directories.push('plugins', 'templates', 'scripts');
  }

  // Create directories
  for (const dir of directories) {
    await mkdir(join(projectPath, dir), { recursive: true });
  }

  // Create basic files
  await createBasicFiles(projectPath, config);
}

async function createBasicFiles(projectPath: string, config: InitializationConfig): Promise<void> {
  // Package.json
  const packageJson = {
    name: config.projectName,
    version: '1.0.0',
    description: 'Claude Flow project',
    main: 'src/index.js',
    scripts: {
      start: 'claude-flow start',
      dev: 'claude-flow start --dev',
      test: 'npm run test:unit && npm run test:integration',
      'test:unit': 'jest tests/unit',
      'test:integration': 'jest tests/integration',
      build: 'claude-flow build',
      deploy: 'claude-flow deploy'
    },
    dependencies: {
      '@claude-flow/core': '^1.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      'jest': '^29.0.0',
      'typescript': '^5.0.0'
    },
    keywords: ['claude-flow', 'ai', 'automation'],
    author: '',
    license: 'MIT'
  };

  await writeFile(
    join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // README.md
  const readme = `# ${config.projectName}

A Claude Flow project.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start the project
npm start

# Run tests
npm test
\`\`\`

## Features

${config.features.map(f => `- ${f}`).join('\n')}

## Documentation

See the [docs](./docs) directory for detailed documentation.
`;

  await writeFile(join(projectPath, 'README.md'), readme);

  // .gitignore
  const gitignore = `node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store
.claude-flow/cache/
.claude-flow/logs/
`;

  await writeFile(join(projectPath, '.gitignore'), gitignore);

  // TypeScript config
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'node',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: './dist',
      rootDir: './src'
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  };

  await writeFile(
    join(projectPath, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );
}

async function initializeSparc(projectPath: string, config: InitializationConfig): Promise<void> {
  printInfo('Initializing SPARC methodology...');

  // SPARC configuration
  const sparcConfig = {
    methodology: 'SPARC',
    version: '1.0.0',
    modes: {
      specification: {
        enabled: true,
        templates: ['requirements', 'architecture', 'api-spec']
      },
      pseudocode: {
        enabled: true,
        style: 'structured',
        documentation: true
      },
      architecture: {
        enabled: true,
        diagrams: true,
        patterns: ['microservices', 'event-driven']
      },
      review: {
        enabled: true,
        automated: true,
        criteria: ['performance', 'security', 'maintainability']
      },
      coding: {
        enabled: true,
        standards: 'typescript',
        testing: 'jest'
      }
    }
  };

  await writeFile(
    join(projectPath, 'sparc/sparc.config.json'),
    JSON.stringify(sparcConfig, null, 2)
  );

  // Create SPARC mode files
  const modes = ['specification', 'pseudocode', 'architecture', 'review', 'coding'];
  for (const mode of modes) {
    const modeContent = `# ${mode.toUpperCase()} Mode

This directory contains ${mode} related files and templates.

## Usage

\`\`\`bash
claude-flow sparc ${mode} --help
\`\`\`
`;
    await writeFile(join(projectPath, `sparc/modes/${mode}.md`), modeContent);
  }
}

async function initializeSwarm(projectPath: string, config: InitializationConfig): Promise<void> {
  printInfo('Initializing swarm capabilities...');

  // Swarm configuration
  const swarmConfig = {
    swarms: {
      default: {
        name: 'Default Swarm',
        description: 'Default swarm configuration',
        agents: {
          coordinator: {
            type: 'coordinator',
            config: {
              maxAgents: 10,
              taskDistribution: 'round-robin'
            }
          },
          worker: {
            type: 'worker',
            instances: 3,
            config: {
              capabilities: ['general', 'analysis']
            }
          }
        }
      }
    }
  };

  await writeFile(
    join(projectPath, 'swarms/swarm.config.json'),
    JSON.stringify(swarmConfig, null, 2)
  );

  // Create example agent
  const agentTemplate = `/**
 * Example Agent
 */

export class ExampleAgent {
  constructor(config) {
    this.config = config;
  }

  async execute(task) {
    // Agent implementation
    return { success: true, result: 'Task completed' };
  }
}
`;

  await writeFile(join(projectPath, 'agents/example-agent.js'), agentTemplate);
}

async function initializeAdvancedFeatures(projectPath: string, config: InitializationConfig): Promise<void> {
  printInfo('Initializing advanced features...');

  // Create plugin structure
  await mkdir(join(projectPath, 'plugins/custom'), { recursive: true });

  // Example plugin
  const pluginTemplate = `/**
 * Custom Plugin
 */

export default {
  name: 'custom-plugin',
  version: '1.0.0',
  
  initialize(app) {
    // Plugin initialization
  },

  commands: [
    // Custom commands
  ]
};
`;

  await writeFile(join(projectPath, 'plugins/custom/index.js'), pluginTemplate);

  // Monitoring configuration
  const monitoringConfig = {
    enabled: true,
    metrics: {
      performance: true,
      errors: true,
      usage: true
    },
    alerts: {
      email: false,
      webhook: false
    }
  };

  await writeFile(
    join(projectPath, 'config/monitoring.json'),
    JSON.stringify(monitoringConfig, null, 2)
  );
}

async function createConfigurationFiles(projectPath: string, config: InitializationConfig): Promise<void> {
  printInfo('Creating configuration files...');

  // Main Claude Flow configuration
  const claudeFlowConfig: any = {
    name: config.projectName,
    version: '1.0.0',
    features: config.features,
    paths: {
      src: './src',
      docs: './docs',
      tests: './tests',
      config: './config'
    },
    logging: {
      level: 'info',
      file: '.claude-flow/logs/app.log'
    },
    memory: {
      backend: 'sqlite',
      path: '.claude-flow/memory.db'
    }
  };

  if (config.sparc) {
    claudeFlowConfig.sparc = {
      enabled: true,
      configPath: './sparc/sparc.config.json'
    };
  }

  if (config.swarm) {
    claudeFlowConfig.swarm = {
      enabled: true,
      configPath: './swarms/swarm.config.json'
    };
  }

  await writeFile(
    join(projectPath, 'claude-flow.config.json'),
    JSON.stringify(claudeFlowConfig, null, 2)
  );

  // Environment template
  const envTemplate = `# Claude Flow Environment Configuration

# Application
NODE_ENV=development
LOG_LEVEL=info

# Memory
MEMORY_BACKEND=sqlite
MEMORY_PATH=.claude-flow/memory.db

# API Keys (set your actual keys)
# ANTHROPIC_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here
`;

  await writeFile(join(projectPath, '.env.example'), envTemplate);
}

async function initializeGitRepository(projectPath: string): Promise<void> {
  printInfo('Initializing git repository...');

  try {
    const { spawn } = await import('node:child_process');
    
    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['init'], { cwd: projectPath });
      git.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Git init failed with code ${code}`));
      });
    });

    // Initial commit
    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['add', '.'], { cwd: projectPath });
      git.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Git add failed with code ${code}`));
      });
    });

    await new Promise<void>((resolve, reject) => {
      const git = spawn('git', ['commit', '-m', 'Initial commit'], { cwd: projectPath });
      git.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Git commit failed with code ${code}`));
      });
    });

  } catch (error) {
    printWarning(`Git initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function installDependencies(projectPath: string): Promise<void> {
  printInfo('Installing dependencies...');

  try {
    const { spawn } = await import('node:child_process');
    
    await new Promise<void>((resolve, reject) => {
      const npm = spawn('npm', ['install'], { 
        cwd: projectPath,
        stdio: 'inherit'
      });
      
      npm.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npm install failed with code ${code}`));
      });
    });

  } catch (error) {
    printWarning(`Dependency installation failed: ${error instanceof Error ? error.message : String(error)}`);
    printInfo('You can install dependencies manually with: npm install');
  }
}

async function validateInitialization(projectPath: string): Promise<void> {
  printInfo('Validating initialization...');

  const requiredFiles = [
    'package.json',
    'claude-flow.config.json',
    'README.md',
    '.gitignore',
    'tsconfig.json'
  ];

  for (const file of requiredFiles) {
    if (!existsSync(join(projectPath, file))) {
      throw new Error(`Required file missing: ${file}`);
    }
  }

  printSuccess('Initialization validation passed');
}

export default initCommand; 