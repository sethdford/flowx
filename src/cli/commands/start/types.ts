/**
 * Type definitions for the start command module
 */

export interface ProcessInfo {
  id: string;
  name: string;
  type: ProcessType;
  status: ProcessStatus;
  pid?: number;
  startTime?: number;
  config?: Record<string, any>;
  metrics?: ProcessMetrics;
  stdin?: any;
  stdout?: any;
  command?: string;
  args?: string[];
  workingDirectory?: string;
}

export enum ProcessType {
  ORCHESTRATOR = 'orchestrator',
  MCP_SERVER = 'mcp-server',
  MEMORY_MANAGER = 'memory-manager',
  TERMINAL_POOL = 'terminal-pool',
  COORDINATOR = 'coordinator',
  EVENT_BUS = 'event-bus'
}

export enum ProcessStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
  CRASHED = 'crashed'
}

export interface ProcessMetrics {
  cpu?: number;
  memory?: number;
  uptime?: number;
  restarts?: number;
  lastError?: string;
  startTime?: number;
  restartCount?: number;
}

export interface SystemStats {
  totalProcesses: number;
  runningProcesses: number;
  stoppedProcesses: number;
  errorProcesses: number;
  systemUptime: number;
  totalMemory: number;
  totalCpu: number;
}

export interface StartOptions {
  daemon?: boolean;
  port?: number;
  mcpTransport?: string;
  config?: string;
  verbose?: boolean;
  ui?: boolean;
  autoStart?: boolean;
  force?: boolean;
  healthCheck?: boolean;
  timeout?: number;
}

export interface UIAction {
  type: 'start' | 'stop' | 'restart' | 'logs' | 'status' | 'exit';
  processId?: string;
  options?: Record<string, any>;
}