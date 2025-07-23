/**
 * CLI Interfaces
 * Consolidated type definitions for the CLI system
 */

// Re-export core interfaces
export type {
  ValidationRule,
  CLILogger,
  CLIContainer,
  CLIValidator,
  CLIContext,
  ArgumentDefinition,
  OptionDefinition,
  CLIMiddleware,
  CLICommand,
  CLIError
} from '../core/application.js';

export type {
  ParsedArgs,
  ParserOptions
} from '../core/command-parser.js';

export type {
  TableColumn
} from '../core/output-formatter.js';

// Import for use in interfaces below
import type { CLILogger, CLICommand, CLIMiddleware, CLIContext, ValidationRule } from '../core/application.js';

// Command execution context
export interface CommandExecutionContext {
  startTime: Date;
  workingDirectory: string;
  environment: Record<string, string>;
  user: {
    id?: string;
    name?: string;
    preferences?: Record<string, any>;
  };
  config?: Record<string, any>;
  logger?: CLILogger;
}

// Command result
export interface CommandResult {
  success: boolean;
  data?: any;
  error?: Error;
  duration?: number;
  metadata?: Record<string, any>;
}

// Command category for help organization
export interface CommandCategory {
  name: string;
  description: string;
  commands: CLICommand[];
}

// Plugin interface
export interface CLIPlugin {
  name: string;
  version: string;
  description: string;
  commands?: CLICommand[];
  middleware?: CLIMiddleware[];
  initialize?: (context: CLIContext) => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
}

// Configuration interfaces
export interface CLIConfig {
  // Application settings
  name?: string;
  version?: string;
  description?: string;
  
  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logFile?: string;
  
  // Output formatting
  colors?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  
  // Plugin settings
  plugins?: string[];
  pluginPaths?: string[];
  
  // Command defaults
  defaults?: Record<string, any>;
  
  // Environment
  environment?: Record<string, string>;
  
  // Custom settings
  [key: string]: any;
}

// Progress tracking
export interface ProgressInfo {
  current: number;
  total: number;
  message?: string;
  percentage?: number;
  eta?: number;
}

// Status information
export interface StatusInfo {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  message?: string;
  progress?: ProgressInfo;
  startTime?: Date;
  endTime?: Date;
  error?: Error;
}

// Interactive prompt interfaces
export interface PromptOptions {
  message: string;
  type?: 'input' | 'password' | 'confirm' | 'select' | 'multiselect' | 'autocomplete';
  default?: any;
  choices?: Array<string | { name: string; value: any; description?: string }>;
  validate?: (value: any) => boolean | string;
  filter?: (value: any) => any;
  transformer?: (value: any) => string;
  when?: (answers: Record<string, any>) => boolean;
  pageSize?: number;
  loop?: boolean;
}

export interface PromptAnswer {
  [key: string]: any;
}

// File system interfaces
export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  modified: Date;
  isDirectory: boolean;
  isFile: boolean;
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

// Process interfaces
export interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  args: string[];
  workingDirectory: string;
  environment: Record<string, string>;
  startTime: Date;
  user?: string;
  group?: string;
}

export interface ProcessMetrics {
  cpu: number;
  memory: number;
  handles?: number;
  threads?: number;
  uptime: number;
}

// Network interfaces
export interface NetworkInfo {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'tcp' | 'udp';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  latency?: number;
  lastCheck?: Date;
}

// System information
export interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  hostname: string;
  uptime: number;
  memory: {
    total: number;
    free: number;
    used: number;
  };
  cpu: {
    model: string;
    cores: number;
    usage: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
  };
}

// Error interfaces
export interface CLIErrorDetails {
  code: string;
  category: 'validation' | 'execution' | 'system' | 'network' | 'permission' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: string;
  suggestions?: string[];
  context?: Record<string, any>;
  stack?: string;
  timestamp: Date;
}

// Event interfaces
export interface CLIEvent {
  type: string;
  timestamp: Date;
  source: string;
  data?: any;
  metadata?: Record<string, any>;
}

export interface CLIEventHandler {
  event: string;
  handler: (event: CLIEvent) => Promise<void> | void;
  priority?: number;
  once?: boolean;
}

// Validation interfaces
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
  value?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Task interfaces (for background operations)
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: ProgressInfo;
  result?: any;
  error?: Error;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface TaskRunner {
  execute(task: Task): Promise<any>;
  cancel(taskId: string): Promise<void>;
  getStatus(taskId: string): Promise<Task>;
  listTasks(): Promise<Task[]>;
}

// Cache interfaces
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number;
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
}

// Template interfaces
export interface Template {
  name: string;
  description: string;
  variables: TemplateVariable[];
  files: TemplateFile[];
  hooks?: TemplateHook[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  required?: boolean;
  default?: any;
  choices?: string[];
  validation?: ValidationRule;
}

export interface TemplateFile {
  source: string;
  destination: string;
  template?: boolean;
  executable?: boolean;
  condition?: string;
}

export interface TemplateHook {
  name: string;
  command: string;
  when: 'before' | 'after';
  condition?: string;
}

// Export all interfaces for convenience
export * from '../core/application.js';
export * from '../core/command-parser.js';
export * from '../core/output-formatter.js'; 