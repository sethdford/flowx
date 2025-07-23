/**
 * Centralized Timeout Configuration System
 * 
 * This module provides a single source of truth for all timeout values
 * throughout the flowx system, replacing 70+ hardcoded values.
 */

export interface TimeoutConfig {
  // Claude Code execution timeouts (critical for swarm operations)
  claude: {
    defaultExecution: number;
    complexTask: number;
    simpleTask: number;
    interactiveTask: number;
    batchTask: number;
  };
  
  // Swarm coordination timeouts
  swarm: {
    agentHeartbeat: number;
    taskExecution: number;
    coordinationCycle: number;
    syncInterval: number;
    offlineDetection: number;
  };
  
  // Task execution timeouts
  tasks: {
    default: number;
    setup: number;
    development: number;
    testing: number;
    deployment: number;
    analysis: number;
  };
  
  // Network and API timeouts
  network: {
    apiRequest: number;
    connection: number;
    upload: number;
    download: number;
  };
  
  // Resource management timeouts
  resources: {
    allocation: number;
    cleanup: number;
    monitoring: number;
    idle: number;
  };
  
  // Terminal and process timeouts
  terminal: {
    command: number;
    session: number;
    process: number;
    cleanup: number;
  };
  
  // Memory and cache timeouts
  memory: {
    cacheTTL: number;
    syncInterval: number;
    cleanup: number;
    persistence: number;
  };
}

/**
 * Default timeout configuration
 * Values are in milliseconds
 */
export const DEFAULT_TIMEOUTS: TimeoutConfig = {
  claude: {
    defaultExecution: 900000,    // 15 minutes (increased from 5)
    complexTask: 1800000,        // 30 minutes for complex tasks
    simpleTask: 300000,          // 5 minutes for simple tasks
    interactiveTask: 600000,     // 10 minutes for interactive tasks
    batchTask: 3600000,          // 1 hour for batch operations
  },
  
  swarm: {
    agentHeartbeat: 120000,      // 2 minutes (increased from 30s)
    taskExecution: 1800000,      // 30 minutes (increased from 5)
    coordinationCycle: 30000,    // 30 seconds
    syncInterval: 10000,         // 10 seconds
    offlineDetection: 300000,    // 5 minutes before marking offline
  },
  
  tasks: {
    default: 900000,             // 15 minutes default
    setup: 1800000,              // 30 minutes for setup tasks (Maven, project init)
    development: 1200000,        // 20 minutes for development tasks
    testing: 600000,             // 10 minutes for testing
    deployment: 1800000,         // 30 minutes for deployment
    analysis: 900000,            // 15 minutes for analysis
  },
  
  network: {
    apiRequest: 60000,           // 1 minute
    connection: 30000,           // 30 seconds
    upload: 600000,              // 10 minutes
    download: 600000,            // 10 minutes
  },
  
  resources: {
    allocation: 60000,           // 1 minute
    cleanup: 180000,             // 3 minutes
    monitoring: 300000,          // 5 minutes
    idle: 600000,                // 10 minutes
  },
  
  terminal: {
    command: 600000,             // 10 minutes (increased from 5)
    session: 1800000,            // 30 minutes
    process: 900000,             // 15 minutes
    cleanup: 60000,              // 1 minute
  },
  
  memory: {
    cacheTTL: 900000,            // 15 minutes (increased from 5)
    syncInterval: 30000,         // 30 seconds
    cleanup: 300000,             // 5 minutes
    persistence: 180000,         // 3 minutes
  },
};

/**
 * Development environment timeouts (longer for debugging)
 */
export const DEV_TIMEOUTS: Partial<TimeoutConfig> = {
  claude: {
    defaultExecution: 1800000,   // 30 minutes
    complexTask: 3600000,        // 1 hour
    simpleTask: 600000,          // 10 minutes
    interactiveTask: 1200000,    // 20 minutes
    batchTask: 7200000,          // 2 hours
  },
  
  swarm: {
    agentHeartbeat: 300000,      // 5 minutes
    taskExecution: 3600000,      // 1 hour
    coordinationCycle: 60000,    // 1 minute
    syncInterval: 15000,         // 15 seconds
    offlineDetection: 600000,    // 10 minutes
  },
  
  tasks: {
    default: 1800000,            // 30 minutes
    setup: 3600000,              // 1 hour
    development: 2400000,        // 40 minutes
    testing: 1200000,            // 20 minutes
    deployment: 3600000,         // 1 hour
    analysis: 1800000,           // 30 minutes
  },
};

/**
 * Production environment timeouts (optimized for performance)
 */
export const PROD_TIMEOUTS: Partial<TimeoutConfig> = {
  claude: {
    defaultExecution: 600000,    // 10 minutes
    complexTask: 1200000,        // 20 minutes
    simpleTask: 180000,          // 3 minutes
    interactiveTask: 300000,     // 5 minutes
    batchTask: 1800000,          // 30 minutes
  },
  
  swarm: {
    agentHeartbeat: 60000,       // 1 minute
    taskExecution: 900000,       // 15 minutes
    coordinationCycle: 15000,    // 15 seconds
    syncInterval: 5000,          // 5 seconds
    offlineDetection: 180000,    // 3 minutes
  },
  
  resources: {
    allocation: 60000,           // 1 minute
    cleanup: 120000,             // 2 minutes (faster cleanup)
    monitoring: 240000,          // 4 minutes
    idle: 300000,                // 5 minutes (faster cleanup)
  },
};

/**
 * Timeout configuration manager
 */
export class TimeoutManager {
  private config: TimeoutConfig;
  private environment: string;
  
  constructor(environment: string = process.env.NODE_ENV || 'development') {
    this.environment = environment;
    this.config = this.buildConfig();
  }
  
  private buildConfig(): TimeoutConfig {
    let config = { ...DEFAULT_TIMEOUTS };
    
    // Apply environment-specific overrides
    switch (this.environment) {
      case 'development':
      case 'dev':
        config = this.mergeConfig(config, DEV_TIMEOUTS);
        break;
      case 'production':
      case 'prod':
        config = this.mergeConfig(config, PROD_TIMEOUTS);
        break;
    }
    
    // Apply environment variable overrides
    config = this.applyEnvOverrides(config);
    
    return config;
  }
  
  private mergeConfig(base: TimeoutConfig, overrides: Partial<TimeoutConfig>): TimeoutConfig {
    const result = { ...base };
    
    for (const [category, values] of Object.entries(overrides)) {
      if (result[category as keyof TimeoutConfig] && values) {
        (result[category as keyof TimeoutConfig] as any) = {
          ...result[category as keyof TimeoutConfig],
          ...values
        };
      }
    }
    
    return result;
  }
  
  private applyEnvOverrides(config: TimeoutConfig): TimeoutConfig {
    // Allow environment variable overrides
    const envMappings = {
      'FLOWX_CLAUDE_TIMEOUT': 'claude.defaultExecution',
      'FLOWX_SWARM_TIMEOUT': 'swarm.taskExecution',
      'FLOWX_TASK_TIMEOUT': 'tasks.default',
      'FLOWX_SETUP_TIMEOUT': 'tasks.setup',
      'FLOWX_TERMINAL_TIMEOUT': 'terminal.command',
      'FLOWX_HEARTBEAT_INTERVAL': 'swarm.agentHeartbeat',
    };
    
    for (const [envVar, configPath] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value && !isNaN(parseInt(value))) {
        this.setNestedValue(config, configPath, parseInt(value));
      }
    }
    
    return config;
  }
  
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  /**
   * Get timeout value by category and type
   */
  get(category: keyof TimeoutConfig, type?: string): number {
    const categoryConfig = this.config[category];
    
    if (!type || typeof categoryConfig === 'number') {
      return typeof categoryConfig === 'number' ? categoryConfig : (categoryConfig as any).default || 300000;
    }
    
    return (categoryConfig as any)[type] || (categoryConfig as any).default || 300000;
  }
  
  /**
   * Get timeout for Claude execution based on task type
   */
  getClaudeTimeout(taskType?: string): number {
    switch (taskType) {
      case 'setup':
      case 'maven':
      case 'project-init':
        return this.config.claude.complexTask;
      case 'simple':
      case 'quick':
        return this.config.claude.simpleTask;
      case 'interactive':
        return this.config.claude.interactiveTask;
      case 'batch':
        return this.config.claude.batchTask;
      default:
        return this.config.claude.defaultExecution;
    }
  }
  
  /**
   * Get timeout for task execution based on task type
   */
  getTaskTimeout(taskType?: string): number {
    switch (taskType) {
      case 'setup':
        return this.config.tasks.setup;
      case 'development':
      case 'coding':
        return this.config.tasks.development;
      case 'testing':
        return this.config.tasks.testing;
      case 'deployment':
        return this.config.tasks.deployment;
      case 'analysis':
        return this.config.tasks.analysis;
      default:
        return this.config.tasks.default;
    }
  }
  
  /**
   * Get all current timeout values
   */
  getAll(): TimeoutConfig {
    return { ...this.config };
  }
  
  /**
   * Update timeout configuration
   */
  update(updates: Partial<TimeoutConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }
}

// Global timeout manager instance
export const timeoutManager = new TimeoutManager();

// Convenience functions for common timeouts
export const getClaudeTimeout = (taskType?: string) => timeoutManager.getClaudeTimeout(taskType);
export const getTaskTimeout = (taskType?: string) => timeoutManager.getTaskTimeout(taskType);
export const getSwarmTimeout = () => timeoutManager.get('swarm', 'taskExecution');
export const getHeartbeatInterval = () => timeoutManager.get('swarm', 'agentHeartbeat'); 