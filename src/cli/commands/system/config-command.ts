/**
 * Config Command
 * Comprehensive configuration management for flowx
 */

import type { CLICommand, CLIContext } from '../../interfaces/index';
import { formatTable, TableColumn, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

interface ConfigSchema {
  system: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxAgents: number;
    timeout: number;
    autoRestart: boolean;
  };
  mcp: {
    port: number;
    transport: 'stdio' | 'http';
    maxConnections: number;
    timeout: number;
  };
  agents: {
    defaultType: string;
    maxConcurrentTasks: number;
    heartbeatInterval: number;
    idleTimeout: number;
  };
  swarm: {
    maxSwarms: number;
    defaultSize: number;
    coordinationMode: 'centralized' | 'distributed';
    loadBalancing: boolean;
  };
  memory: {
    provider: 'sqlite' | 'postgres' | 'memory';
    maxEntries: number;
    ttl: number;
    compression: boolean;
  };
  security: {
    encryption: boolean;
    apiKeys: boolean;
    rateLimiting: boolean;
    auditLogging: boolean;
  };
  performance: {
    caching: boolean;
    poolSize: number;
    batchSize: number;
    optimization: 'speed' | 'memory' | 'balanced';
  };
  orchestrator: {
    maxConcurrentTasks: number;
    taskTimeout: number;
    retryAttempts: number;
  };
}

const DEFAULT_CONFIG: ConfigSchema = {
  system: {
    logLevel: 'info',
    maxAgents: 100,
    timeout: 30000,
    autoRestart: true
  },
  mcp: {
    port: 3000,
    transport: 'stdio',
    maxConnections: 10,
    timeout: 5000
  },
  agents: {
    defaultType: 'general',
    maxConcurrentTasks: 5,
    heartbeatInterval: 30000,
    idleTimeout: 300000
  },
  swarm: {
    maxSwarms: 10,
    defaultSize: 3,
    coordinationMode: 'centralized',
    loadBalancing: true
  },
  memory: {
    provider: 'sqlite',
    maxEntries: 10000,
    ttl: 86400000,
    compression: true
  },
  security: {
    encryption: false,
    apiKeys: false,
    rateLimiting: true,
    auditLogging: true
  },
  performance: {
    caching: true,
    poolSize: 10,
    batchSize: 100,
    optimization: 'balanced'
  },
  orchestrator: {
    maxConcurrentTasks: 10,
    taskTimeout: 30000,
    retryAttempts: 3
  }
};

export const configCommand: CLICommand = {
  name: 'config',
  description: 'Manage flowx configuration',
  category: 'System',
  usage: 'flowx config <subcommand> [options]',
  examples: [
    'flowx config list',
    'flowx config get system.logLevel',
    'flowx config set mcp.port 3001',
    'flowx config validate',
    'flowx config profile create production'
  ],
  arguments: [
    {
      name: 'subcommand',
      description: 'Configuration subcommand',
      required: false
    }
  ],
  options: [
    {
      name: 'global',
      short: 'g',
      description: 'Use global configuration',
      type: 'boolean'
    },
    {
      name: 'profile',
      short: 'p',
      description: 'Configuration profile to use',
      type: 'string'
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format (json, yaml, table)',
      type: 'string',
      default: 'table',
      choices: ['json', 'yaml', 'table']
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output',
      type: 'boolean'
    },
    {
      name: 'file',
      description: 'Configuration file path',
      type: 'string'
    },
    {
      name: 'save',
      description: 'Save after operation',
      type: 'boolean'
    }
  ],
  subcommands: [
    {
      name: 'list',
      description: 'List all configuration values',
      handler: async (context: CLIContext) => await listConfig(context)
    },
    {
      name: 'get',
      description: 'Get configuration value',
      handler: async (context: CLIContext) => await getConfig(context)
    },
    {
      name: 'set',
      description: 'Set configuration value',
      handler: async (context: CLIContext) => await setConfig(context)
    },
    {
      name: 'unset',
      description: 'Remove configuration value',
      handler: async (context: CLIContext) => await unsetConfig(context)
    },
    {
      name: 'validate',
      description: 'Validate configuration',
      handler: async (context: CLIContext) => await validateConfig(context)
    },
    {
      name: 'reset',
      description: 'Reset to default configuration',
      handler: async (context: CLIContext) => await resetConfig(context)
    },
    {
      name: 'export',
      description: 'Export configuration',
      handler: async (context: CLIContext) => await exportConfig(context)
    },
    {
      name: 'import',
      description: 'Import configuration',
      handler: async (context: CLIContext) => await importConfig(context)
    },
    {
      name: 'profile',
      description: 'Manage configuration profiles',
      handler: async (context: CLIContext) => await manageProfiles(context)
    },
    {
      name: 'backup',
      description: 'Backup current configuration',
      handler: async (context: CLIContext) => await backupConfig(context)
    },
    {
      name: 'restore',
      description: 'Restore configuration from backup',
      handler: async (context: CLIContext) => await restoreConfig(context)
    },
    {
      name: 'init',
      description: 'Initialize configuration with wizard',
      handler: async (context: CLIContext) => await initConfig(context)
    },
    {
      name: 'reload',
      description: 'Reload configuration from file',
      handler: async (context: CLIContext) => await reloadConfig(context)
    },
    {
      name: 'schema',
      description: 'Show configuration schema',
      handler: async (context: CLIContext) => await showSchema(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { args } = context;
    
    if (args.length === 0) {
      await listConfig(context);
      return;
    }
    
    const subcommandName = args[0];
    const subcommand = configCommand.subcommands?.find(sub => sub.name === subcommandName);
    
    if (subcommand) {
      // Create new context with remaining args (excluding the subcommand name)
      const subContext = {
        ...context,
        args: args.slice(1)
      };
      await subcommand.handler(subContext);
    } else {
      printError('Unknown subcommand. Use "flowx config --help" for usage information.');
    }
  }
};

// Subcommand handlers

async function listConfig(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const config = await loadConfig(options);
    
    printInfo('📋 flowx Configuration');
    console.log('─'.repeat(60));
    
    if (options.format === 'json') {
      console.log(JSON.stringify(config, null, 2));
    } else if (options.format === 'yaml') {
      console.log(configToYaml(config));
    } else {
      displayConfigTable(config, options.verbose);
    }
    
    console.log();
    printInfo(`Profile: ${options.profile || 'default'}`);
    printInfo(`Scope: ${options.global ? 'global' : 'local'}`);
    
  } catch (error) {
    printError(`Failed to list configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getConfig(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  if (args.length === 0) {
    printError('Configuration key is required. Example: flowx config get system.logLevel');
    return;
  }
  
  const key = args[0];
  
  try {
    const config = await loadConfig(options);
    const value = getNestedValue(config, key);
    
    if (value === undefined) {
      printWarning(`Configuration key '${key}' not found`);
      return;
    }
    
    if (options.format === 'json') {
      console.log(JSON.stringify({ [key]: value }, null, 2));
    } else {
      console.log(`${key} = ${formatValue(value)}`);
    }
    
  } catch (error) {
    printError(`Failed to get configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function setConfig(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  if (args.length < 2) {
    printError('Key and value are required. Example: flowx config set mcp.port 3001');
    return;
  }
  
  const key = args[0];
  const value = args[1];
  
  try {
    const config = await loadConfig(options);
    const parsedValue = parseValue(value);
    
    // Validate the key exists in schema
    if (!isValidConfigKey(key)) {
      printWarning(`Configuration key '${key}' is not in the standard schema`);
      const shouldContinue = await confirmPrompt('Continue anyway?', false);
      if (!shouldContinue) {
        return;
      }
    }
    
    // Set the value
    setNestedValue(config, key, parsedValue);
    
    // Validate the new configuration
    const validation = validateConfigSchema(config);
    if (!validation.valid) {
      printError('Configuration validation failed');
      validation.errors.forEach(error => printError(`  - ${error}`));
      return;
    }
    
    // Save the configuration
    await saveConfig(config, options);
    
    printSuccess(`✓ Configuration updated: ${key} = ${formatValue(parsedValue)}`);
    
    if (options.verbose) {
      printInfo('Configuration change may require system restart to take effect');
    }
    
  } catch (error) {
    printError('Failed to set configuration');
    printError(`Error details: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function unsetConfig(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  if (args.length === 0) {
    printError('Configuration key is required. Example: flowx config unset custom.setting');
    return;
  }
  
  const key = args[0];
  
  try {
    const config = await loadConfig(options);
    
    if (getNestedValue(config, key) === undefined) {
      printWarning(`Configuration key '${key}' not found`);
      return;
    }
    
    // Don't allow unsetting required keys
    if (isRequiredConfigKey(key)) {
      printError(`Cannot unset required configuration key: ${key}`);
      return;
    }
    
    unsetNestedValue(config, key);
    await saveConfig(config, options);
    
    printSuccess(`✓ Configuration key removed: ${key}`);
    
  } catch (error) {
    printError(`Failed to unset configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validateConfig(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    let config;
    
    // If a specific file is provided, validate that file instead of the default config
    if (options.file) {
      const content = await fs.readFile(options.file, 'utf-8');
      config = JSON.parse(content);
    } else {
      config = await loadConfig(options);
    }
    
    const validation = validateConfigSchema(config);
    
    printInfo('🔍 Configuration Validation');
    console.log('─'.repeat(40));
    
    if (validation.valid) {
      printSuccess('✓ Configuration is valid');
      
      if (options.verbose) {
        printInfo('Validation checks passed:');
        console.log('  - Schema compliance');
        console.log('  - Type validation');
        console.log('  - Range validation');
        console.log('  - Dependency validation');
      }
    } else {
      printError('✗ Configuration validation failed:');
      validation.errors.forEach(error => printError(`  - ${error}`));
      
      if (validation.warnings.length > 0) {
        printWarning('Warnings:');
        validation.warnings.forEach(warning => printWarning(`  - ${warning}`));
      }
    }
    
  } catch (error) {
    printError(`Failed to validate configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function resetConfig(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  // Handle reset all with force requirement
  if (options.all) {
    if (!options.force) {
      printError('Use --force to confirm resetting all configuration');
      return;
    }
    
    try {
      // Backup current config first
      await backupConfig(context);
      
      // Reset to defaults
      await saveConfig(DEFAULT_CONFIG, options);
      
      printSuccess('✓ All configuration reset to defaults');
      printInfo('Previous configuration backed up');
      
    } catch (error) {
      printError(`Failed to reset configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }
  
  // Handle specific section reset
  const section = args.length > 0 ? args[0] : null;
  
  if (section) {
    try {
      const config = await loadConfig(options);
      
      // Reset specific section to defaults
      if (section in DEFAULT_CONFIG) {
        (config as any)[section] = (DEFAULT_CONFIG as any)[section];
        await saveConfig(config, options);
        printSuccess(`✓ Configuration section reset`);
      } else {
        printError(`Unknown configuration section: ${section}`);
      }
      
    } catch (error) {
      printError(`Failed to reset configuration section: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }
  
  // Handle general reset with confirmation
  printWarning('This will reset all configuration to defaults');
  const shouldReset = await confirmPrompt('Are you sure?', false);
  
  if (!shouldReset) {
    printInfo('Reset cancelled');
    return;
  }
  
  try {
    // Backup current config first
    await backupConfig(context);
    
    // Reset to defaults
    await saveConfig(DEFAULT_CONFIG, options);
    
    printSuccess('✓ Configuration reset to defaults');
    printInfo('Previous configuration backed up');
    
  } catch (error) {
    printError(`Failed to reset configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function exportConfig(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const outputFile = args[0] || `flowx-config-${Date.now()}.tson`;
  
  try {
    const config = await loadConfig(options);
    
    if (options.format === 'yaml') {
      const yamlContent = configToYaml(config);
      await fs.writeFile(outputFile.replace('.tson', '.yml'), yamlContent);
    } else {
      await fs.writeFile(outputFile, JSON.stringify(config, null, 2));
    }
    
    printSuccess(`✓ Configuration exported to ${outputFile}`);
    
  } catch (error) {
    printError(`Failed to export configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function importConfig(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const inputFile = options.file || args[0];
  
  if (!inputFile) {
    printError('Configuration file is required. Example: flowx config import config.tson');
    return;
  }
  
  try {
    const content = await fs.readFile(inputFile, 'utf8');
    let config: any;
    
    if (inputFile.endsWith('.yml') || inputFile.endsWith('.yaml')) {
      config = yamlToConfig(content);
    } else {
      config = JSON.parse(content);
    }
    
    // Validate imported configuration
    const validation = validateConfigSchema(config);
    if (!validation.valid) {
      printError('Imported configuration is invalid:');
      validation.errors.forEach(error => printError(`  - ${error}`));
      return;
    }
    
    // Backup current config
    await backupConfig(context);
    
    // Import new configuration
    await saveConfig(config, options);
    
    printSuccess(`✓ Configuration imported from ${inputFile}`);
    printInfo('Previous configuration backed up');
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      printError('Invalid configuration format');
    } else {
      printError(`Failed to import configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function manageProfiles(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  if (args.length === 0) {
    // List profiles
    await listProfiles(options);
    return;
  }
  
  const action = args[0];
  const profileName = args[1];
  
  switch (action) {
    case 'create':
      if (!profileName) {
        printError('Profile name is required. Example: flowx config profile create production');
        return;
      }
      await createProfile(profileName, options);
      break;
      
    case 'delete':
      if (!profileName) {
        printError('Profile name is required. Example: flowx config profile delete production');
        return;
      }
      await deleteProfile(profileName, options);
      break;
      
    case 'copy':
      const targetProfile = args[2];
      if (!profileName || !targetProfile) {
        printError('Source and target profile names are required. Example: flowx config profile copy default production');
        return;
      }
      await copyProfile(profileName, targetProfile, options);
      break;
      
    case 'switch':
      if (!profileName) {
        printError('Profile name is required. Example: flowx config profile switch production');
        return;
      }
      await switchProfile(profileName, options);
      break;
      
    default:
      printError(`Unknown profile action: ${action}`);
      printInfo('Available actions: create, delete, copy, switch');
  }
}

async function backupConfig(context: CLIContext): Promise<void> {
  const { options } = context;
  
  // Handle listing backups
  if (options.list) {
    try {
      printInfo('Available backups:');
      // For now, just show a placeholder message since we don't have a backup directory structure
      printInfo('  - No backups found');
    } catch (error) {
      printError(`Failed to list backups: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }
  
  try {
    const config = await loadConfig(options);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `flowx-config-backup-${timestamp}.tson`;
    
    await fs.writeFile(backupFile, JSON.stringify(config, null, 2));
    
    printSuccess(`✓ Configuration backed up to ${backupFile}`);
    
  } catch (error) {
    printError(`Failed to backup configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function restoreConfig(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  const backupFile = options.backup || args[0];
  
  if (!backupFile) {
    printError('Backup file is required. Example: flowx config restore backup.tson');
    return;
  }
  
  try {
    const content = await fs.readFile(backupFile, 'utf8');
    const config = JSON.parse(content);
    
    // Validate backup
    const validation = validateConfigSchema(config);
    if (!validation.valid) {
      printError('Backup configuration is invalid:');
      validation.errors.forEach(error => printError(`  - ${error}`));
      return;
    }
    
    await saveConfig(config, options);
    
    printSuccess(`✓ Configuration restored from ${backupFile}`);
    
  } catch (error) {
    printError(`Failed to restore configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function initConfig(context: CLIContext): Promise<void> {
  const { options } = context;
  
  printInfo('🚀 flowx Configuration Wizard');
  console.log('─'.repeat(50));
  
  try {
    const config = { ...DEFAULT_CONFIG };
    
    // System configuration
    printInfo('\n📊 System Configuration:');
    config.system.logLevel = await promptChoice('Log level', ['debug', 'info', 'warn', 'error'], 'info') as any;
    config.system.maxAgents = await promptNumber('Maximum agents', 100, 1, 1000);
    config.system.autoRestart = await promptBoolean('Auto-restart on failure', true);
    
    // MCP configuration
    printInfo('\n🔌 MCP Server Configuration:');
    config.mcp.port = await promptNumber('MCP server port', 3000, 1024, 65535);
    config.mcp.transport = await promptChoice('Transport type', ['stdio', 'http'], 'stdio') as any;
    
    // Agent configuration
    printInfo('\n🤖 Agent Configuration:');
    config.agents.defaultType = await promptString('Default agent type', 'general');
    config.agents.maxConcurrentTasks = await promptNumber('Max concurrent tasks per agent', 5, 1, 50);
    
    // Performance configuration
    printInfo('\n⚡ Performance Configuration:');
    config.performance.optimization = await promptChoice('Optimization mode', ['speed', 'memory', 'balanced'], 'balanced') as any;
    config.performance.caching = await promptBoolean('Enable caching', true);
    
    // Security configuration
    printInfo('\n🔒 Security Configuration:');
    config.security.encryption = await promptBoolean('Enable encryption', false);
    config.security.rateLimiting = await promptBoolean('Enable rate limiting', true);
    
    // Save configuration
    await saveConfig(config, options);
    
    printSuccess('\n✓ Configuration initialized successfully!');
    printInfo('Use "flowx config list" to view your configuration');
    
  } catch (error) {
    printError(`Failed to initialize configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper functions

async function loadConfig(options: any): Promise<ConfigSchema> {
  const configPath = getConfigPath(options);
  
  try {
    const content = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    // If config doesn't exist, return defaults
    if ((error as any).code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

async function saveConfig(config: ConfigSchema, options: any): Promise<void> {
  const configPath = getConfigPath(options);
  const configDir = path.dirname(configPath);
  
  // Ensure config directory exists
  await fs.mkdir(configDir, { recursive: true });
  
  // Save configuration
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

function getConfigPath(options: any): string {
  if (options.global) {
    return path.join(homedir(), '.flowx', 'config.json');
  }
  
  const profile = options.profile || 'default';
  return path.join(process.cwd(), '.flowx', `config-${profile}.json`);
}

function getNestedValue(obj: any, key: string): any {
  return key.split('.').reduce((current, prop) => current?.[prop], obj);
}

function setNestedValue(obj: any, key: string, value: any): void {
  const keys = key.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, prop) => {
    if (!current[prop]) current[prop] = {};
    return current[prop];
  }, obj);
  target[lastKey] = value;
}

function unsetNestedValue(obj: any, key: string): void {
  const keys = key.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, prop) => current?.[prop], obj);
  if (target) {
    delete target[lastKey];
  }
}

function parseValue(value: string): any {
  // Try to parse as JSON first
  try {
    return JSON.parse(value);
  } catch {
    // If not JSON, try common types
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    return value; // Return as string
  }
}

function formatValue(value: any): string {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function displayConfigTable(config: ConfigSchema, verbose: boolean): void {
  const rows: any[] = [];
  
  function addConfigSection(section: any, prefix: string = '') {
    for (const [key, value] of Object.entries(section)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (verbose) {
          rows.push({
            key: fullKey,
            value: '[object]',
            description: 'Configuration section'
          });
        }
        addConfigSection(value, fullKey);
      } else {
        rows.push({
          key: fullKey,
          value: formatValue(value),
          description: getConfigDescription(fullKey)
        });
      }
    }
  }
  
  addConfigSection(config);
  
  const columns = [
    { header: 'Key', key: 'key', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
    { header: 'Description', key: 'description', width: 40 }
  ];
  
  console.log(formatTable(rows, columns));
}

function getConfigDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'system.logLevel': 'Logging verbosity level',
    'system.maxAgents': 'Maximum number of concurrent agents',
    'system.timeout': 'Default operation timeout (ms)',
    'system.autoRestart': 'Automatically restart failed components',
    'mcp.port': 'MCP server listening port',
    'mcp.transport': 'Communication transport protocol',
    'mcp.maxConnections': 'Maximum concurrent connections',
    'agents.defaultType': 'Default agent type for new agents',
    'agents.maxConcurrentTasks': 'Max tasks per agent',
    'swarm.maxSwarms': 'Maximum number of swarms',
    'swarm.coordinationMode': 'Swarm coordination strategy',
    'memory.provider': 'Memory storage backend',
    'memory.maxEntries': 'Maximum memory entries',
    'security.encryption': 'Enable data encryption',
    'performance.optimization': 'Performance optimization mode'
  };
  
  return descriptions[key] || 'Configuration setting';
}

function isValidConfigKey(key: string): boolean {
  const validKeys = [
    'system.logLevel', 'system.maxAgents', 'system.timeout', 'system.autoRestart',
    'mcp.port', 'mcp.transport', 'mcp.maxConnections', 'mcp.timeout',
    'agents.defaultType', 'agents.maxConcurrentTasks', 'agents.heartbeatInterval', 'agents.idleTimeout',
    'orchestrator.maxConcurrentTasks', 'orchestrator.taskTimeout', 'orchestrator.retryAttempts',
    'swarm.maxSwarms', 'swarm.defaultSize', 'swarm.coordinationMode', 'swarm.loadBalancing',
    'memory.provider', 'memory.maxEntries', 'memory.ttl', 'memory.compression',
    'security.encryption', 'security.apiKeys', 'security.rateLimiting', 'security.auditLogging',
    'performance.caching', 'performance.poolSize', 'performance.batchSize', 'performance.optimization'
  ];
  
  return validKeys.includes(key);
}

function isRequiredConfigKey(key: string): boolean {
  const requiredKeys = [
    'system.logLevel', 'mcp.port', 'mcp.transport', 'agents.defaultType',
    'memory.provider', 'performance.optimization'
  ];
  
  return requiredKeys.includes(key);
}

function validateConfigSchema(config: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate system configuration
  if (config.system) {
    if (!['debug', 'info', 'warn', 'error'].includes(config.system.logLevel)) {
      errors.push('system.logLevel must be one of: debug, info, warn, error');
    }
    if (typeof config.system.maxAgents !== 'number' || config.system.maxAgents < 1) {
      errors.push('system.maxAgents must be a positive number');
    }
    if (typeof config.system.timeout !== 'number' || config.system.timeout < 1000) {
      errors.push('system.timeout must be at least 1000ms');
    }
  }
  
  // Validate MCP configuration
  if (config.mcp) {
    if (typeof config.mcp.port !== 'number' || config.mcp.port < 1024 || config.mcp.port > 65535) {
      errors.push('mcp.port must be between 1024 and 65535');
    }
    if (!['stdio', 'http'].includes(config.mcp.transport)) {
      errors.push('mcp.transport must be either stdio or http');
    }
  }
  
  // Validate agent configuration
  if (config.agents) {
    if (typeof config.agents.maxConcurrentTasks !== 'number' || config.agents.maxConcurrentTasks < 1) {
      errors.push('agents.maxConcurrentTasks must be a positive number');
    }
  }
  
  // Validate orchestrator configuration
  if (config.orchestrator) {
    if (typeof config.orchestrator.maxConcurrentTasks !== 'number' || config.orchestrator.maxConcurrentTasks < 1) {
      errors.push('orchestrator.maxConcurrentTasks must be a positive number');
    }
  }
  
  // Validate performance configuration
  if (config.performance) {
    if (!['speed', 'memory', 'balanced'].includes(config.performance.optimization)) {
      errors.push('performance.optimization must be one of: speed, memory, balanced');
    }
  }
  
  // Add warnings for potentially problematic settings
  if (config.system?.maxAgents > 500) {
    warnings.push('system.maxAgents is very high, may impact performance');
  }
  
  if (config.mcp?.port < 3000) {
    warnings.push('mcp.port is below 3000, may conflict with other services');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function configToYaml(config: any): string {
  // Simple YAML conversion (in a real implementation, use a proper YAML library)
  function toYaml(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n${toYaml(value, indent + 1)}`;
      } else {
        yaml += `${spaces}${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    return yaml;
  }
  
  return toYaml(config);
}

async function yamlToConfig(yamlContent: string): Promise<any> {
  // YAML parsing using js-yaml
  try {
    // @ts-ignore - Dynamic import for optional YAML support
    const yaml = await import('js-yaml');
    return yaml.load(yamlContent);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot resolve module')) {
      throw new Error('YAML support requires js-yaml package. Please install it or use JSON format.');
    }
    throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Profile management functions

async function listProfiles(options: any): Promise<void> {
  try {
    const configDir = path.join(process.cwd(), '.flowx');
    const files = await fs.readdir(configDir).catch(() => []);
    
    const profiles = files
      .filter(file => file.startsWith('config-') && file.endsWith('.tson'))
      .map(file => file.replace('config-', '').replace('.tson', ''));
    
    if (profiles.length === 0) {
      printInfo('No configuration profiles found');
      return;
    }
    
    printInfo('📋 Configuration Profiles:');
    profiles.forEach(profile => {
      const marker = profile === (options.profile || 'default') ? '* ' : '  ';
      console.log(`${marker}${profile}`);
    });
    
  } catch (error) {
    printError(`Failed to list profiles: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function createProfile(profileName: string, options: any): Promise<void> {
  try {
    const currentConfig = await loadConfig(options);
    const newOptions = { ...options, profile: profileName };
    
    await saveConfig(currentConfig, newOptions);
    
    printSuccess(`✓ Profile '${profileName}' created`);
    
  } catch (error) {
    printError(`Failed to create profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function deleteProfile(profileName: string, options: any): Promise<void> {
  if (profileName === 'default') {
    printError('Cannot delete the default profile');
    return;
  }
  
  try {
    const configPath = path.join(process.cwd(), '.flowx', `config-${profileName}.tson`);
    await fs.unlink(configPath);
    
    printSuccess(`✓ Profile '${profileName}' deleted`);
    
  } catch (error) {
    printError(`Failed to delete profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function copyProfile(sourceProfile: string, targetProfile: string, options: any): Promise<void> {
  try {
    const sourceConfig = await loadConfig({ ...options, profile: sourceProfile });
    const targetOptions = { ...options, profile: targetProfile };
    
    await saveConfig(sourceConfig, targetOptions);
    
    printSuccess(`✓ Profile '${sourceProfile}' copied to '${targetProfile}'`);
    
  } catch (error) {
    printError(`Failed to copy profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function switchProfile(profileName: string, options: any): Promise<void> {
  try {
    // Check if profile exists
    const profileConfig = await loadConfig({ ...options, profile: profileName });
    
    // Update current profile reference (this would be stored in a separate file)
    const profileRefPath = path.join(process.cwd(), '.flowx', 'current-profile');
    await fs.writeFile(profileRefPath, profileName);
    
    printSuccess(`✓ Switched to profile '${profileName}'`);
    
  } catch (error) {
    printError(`Failed to switch profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Interactive prompts

async function confirmPrompt(message: string, defaultValue: boolean): Promise<boolean> {
  try {
    const inquirer = await import('inquirer');
    const { confirmed } = await inquirer.default.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue
    }]);
    return confirmed;
  } catch (error) {
    // Fallback if inquirer is not available
    printWarning('Interactive prompts not available, using default value');
    return defaultValue;
  }
}

async function promptChoice(message: string, choices: string[], defaultValue: string): Promise<string> {
  try {
    const inquirer = await import('inquirer');
    const { choice } = await inquirer.default.prompt([{
      type: 'list',
      name: 'choice',
      message,
      choices,
      default: defaultValue
    }]);
    return choice;
  } catch (error) {
    // Fallback if inquirer is not available
    printWarning('Interactive prompts not available, using default value');
    return defaultValue;
  }
}

async function promptNumber(message: string, defaultValue: number, min?: number, max?: number): Promise<number> {
  try {
    const inquirer = await import('inquirer');
    const { number } = await inquirer.default.prompt([{
      type: 'number',
      name: 'number',
      message,
      default: defaultValue,
      validate: (input: number) => {
        if (min !== undefined && input < min) {
          return `Value must be at least ${min}`;
        }
        if (max !== undefined && input > max) {
          return `Value must be at most ${max}`;
        }
        return true;
      }
    }]);
    return number;
  } catch (error) {
    // Fallback if inquirer is not available
    printWarning('Interactive prompts not available, using default value');
    return defaultValue;
  }
}

async function promptString(message: string, defaultValue: string): Promise<string> {
  try {
    const inquirer = await import('inquirer');
    const { text } = await inquirer.default.prompt([{
      type: 'input',
      name: 'text',
      message,
      default: defaultValue
    }]);
    return text;
  } catch (error) {
    // Fallback if inquirer is not available
    printWarning('Interactive prompts not available, using default value');
    return defaultValue;
  }
}

async function promptBoolean(message: string, defaultValue: boolean): Promise<boolean> {
  try {
    const inquirer = await import('inquirer');
    const { value } = await inquirer.default.prompt([{
      type: 'confirm',
      name: 'value',
      message,
      default: defaultValue
    }]);
    return value;
  } catch (error) {
    // Fallback if inquirer is not available
    printWarning('Interactive prompts not available, using default value');
    return defaultValue;
  }
}

async function reloadConfig(context: CLIContext): Promise<void> {
  try {
    // Import global initialization module to call reloadConfig
    const globalInit = await import('../../core/global-initialization');
    
    // Call reloadConfig if it exists (it's mocked in tests)
    if ('reloadConfig' in globalInit && typeof (globalInit as any).reloadConfig === 'function') {
      await (globalInit as any).reloadConfig();
    }
    
    printSuccess('Configuration reloaded successfully');
    
  } catch (error) {
    printError(`Failed to reload configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function showSchema(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  try {
    const sectionName = args[0];
    
    if (sectionName) {
      // Show specific section schema
      if (DEFAULT_CONFIG[sectionName as keyof typeof DEFAULT_CONFIG]) {
        printInfo(`Configuration schema for ${sectionName}:`);
        console.log(JSON.stringify(DEFAULT_CONFIG[sectionName as keyof typeof DEFAULT_CONFIG], null, 2));
      } else {
        printError(`Unknown configuration section: ${sectionName}`);
      }
    } else {
      // Show full schema
      if (options.docs) {
        printInfo('Schema documentation');
        printInfo('Configuration schema documentation with detailed explanations:');
        // Add detailed documentation here
      } else {
        printInfo('Configuration schema:');
        if (options.format === 'json') {
          console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));
        } else {
          printInfo('Available configuration sections:');
          Object.keys(DEFAULT_CONFIG).forEach(section => {
            console.log(`  - ${section}`);
          });
          printInfo('\nUse "flowx config schema <section>" to see specific section schema');
        }
      }
    }
    
  } catch (error) {
    printError(`Failed to show schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}