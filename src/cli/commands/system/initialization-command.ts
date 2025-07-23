/**
 * System Initialization Command
 * Comprehensive initialization for Claude Flow projects
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';

export const initCommand: CLICommand = {
  name: 'init',
  description: 'Initialize a new Claude Flow project',
  category: 'System',
  usage: 'flowx init [PROJECT_NAME] [OPTIONS]',
  examples: [
    'flowx init my-project',
    'flowx init my-project --template basic',
    'flowx init --interactive',
    'flowx init --sparc --advanced',
    'flowx init --batch --config batch-config.tson'
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
      console.log(`  flowx start`);

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
    return 'flowx-project';
  }
  return 'flowx-project';
}

async function validateProjectDirectory(projectPath: string, force: boolean): Promise<void> {
  try {
    // Get current working directory safely
    let currentDir;
    try {
      currentDir = process.cwd();
    } catch (cwdError) {
      throw new Error(`Unable to determine current working directory: ${cwdError instanceof Error ? cwdError.message : String(cwdError)}`);
    }
    
    // Ensure project path is valid
    const resolvedPath = projectPath.startsWith('/') ? projectPath : join(currentDir, projectPath);
    
    if (existsSync(resolvedPath)) {
      if (!force) {
        throw new Error(`Directory ${resolvedPath} already exists. Use --force to override.`);
      }
      
      // Check if directory is empty or contains only safe files
      const { readdir } = await import('node:fs/promises');
      try {
        const files = await readdir(resolvedPath);
        const safeFiles = ['.git', '.gitignore', 'README.md', '.DS_Store'];
        const nonSafeFiles = files.filter(f => !safeFiles.includes(f));
        
        if (nonSafeFiles.length > 0) {
          printWarning(`Directory contains files: ${nonSafeFiles.join(', ')}`);
        }
      } catch (readError) {
        throw new Error(`Cannot read directory ${resolvedPath}: ${readError instanceof Error ? readError.message : String(readError)}`);
      }
    }
  } catch (error) {
    printError(`Directory validation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function getInitializationConfig(options: any, projectName: string): Promise<InitializationConfig> {
  const config: InitializationConfig = {
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

  try {
    // Ensure project root directory exists
    await mkdir(projectPath, { recursive: true });

    // Basic directory structure
    const directories = [
      'src',
      'docs',
      'examples',
      'tests',
      'config',
      '.flowx'
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

    // Create directories with error handling
    for (const dir of directories) {
      try {
        await mkdir(join(projectPath, dir), { recursive: true });
      } catch (dirError) {
        printWarning(`Failed to create directory ${dir}: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
        // Continue with other directories
      }
    }

    // Create basic files
    await createBasicFiles(projectPath, config);
  } catch (error) {
    printError(`Failed to create project structure: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function createBasicFiles(projectPath: string, config: InitializationConfig): Promise<void> {
  // Package.tson
  const packageJson = {
    name: config.projectName,
    version: '1.0.0',
    description: 'Claude Flow project',
    main: 'src/index.ts',
    scripts: {
      start: 'flowx start',
      dev: 'flowx start --dev',
      test: 'npm run test:unit && npm run test:integration',
      'test:unit': 'jest tests/unit',
      'test:integration': 'jest tests/integration',
      build: 'flowx build',
      deploy: 'flowx deploy'
    },
    dependencies: {
      '@flowx/core': '^1.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      'jest': '^29.0.0',
      'typescript': '^5.0.0'
    },
    keywords: ['flowx', 'ai', 'automation'],
    author: '',
    license: 'MIT'
  };

  await writeFile(
    join(projectPath, 'package.tson'),
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
.flowx/cache/
.flowx/logs/
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
    join(projectPath, 'tsconfig.tson'),
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
    join(projectPath, 'sparc/sparc.config.tson'),
    JSON.stringify(sparcConfig, null, 2)
  );

  // Create SPARC mode files
  const modes = ['specification', 'pseudocode', 'architecture', 'review', 'coding'];
  for (const mode of modes) {
    const modeContent = `# ${mode.toUpperCase()} Mode

This directory contains ${mode} related files and templates.

## Usage

\`\`\`bash
flowx sparc ${mode} --help
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
    join(projectPath, 'swarms/swarm.config.tson'),
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

  await writeFile(join(projectPath, 'agents/example-agent.ts'), agentTemplate);
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

  await writeFile(join(projectPath, 'plugins/custom/index.ts'), pluginTemplate);

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
    join(projectPath, 'config/monitoring.tson'),
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
      file: '.flowx/logs/app.log'
    },
    memory: {
      backend: 'sqlite',
      path: '.flowx/memory.db'
    }
  };

  if (config.sparc) {
    claudeFlowConfig.sparc = {
      enabled: true,
      configPath: './sparc/sparc.config.tson'
    };
  }

  if (config.swarm) {
    claudeFlowConfig.swarm = {
      enabled: true,
      configPath: './swarms/swarm.config.tson'
    };
  }

  await writeFile(
    join(projectPath, 'flowx.config.tson'),
    JSON.stringify(claudeFlowConfig, null, 2)
  );

  // Environment template
  const envTemplate = `# Claude Flow Environment Configuration

# Application
NODE_ENV=development
LOG_LEVEL=info

# Memory
MEMORY_BACKEND=sqlite
MEMORY_PATH=.flowx/memory.db

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
    'package.tson',
    'flowx.config.tson',
    'README.md',
    '.gitignore',
    'tsconfig.tson'
  ];

  for (const file of requiredFiles) {
    if (!existsSync(join(projectPath, file))) {
      throw new Error(`Required file missing: ${file}`);
    }
  }

  printSuccess('Initialization validation passed');
}

export default initCommand; 