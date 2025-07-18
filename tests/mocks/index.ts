/**
 * Comprehensive mock implementations for testing
 */

import { jest } from '@jest/globals';
import type { MockedFunction } from 'jest-mock';
import type { AgentProfile, Task } from "../../src/utils/types";
import { MockMCPServer, MockMCPTransport } from './mock-mcp-server';

// Re-export the MCP server and transport mocks
export { MockMCPServer, MockMCPTransport };

// Since we can't import the actual interfaces yet, we'll define minimal interfaces
interface IEventBus {
  emit(event: string, data?: unknown): boolean;
  on(event: string, handler: (data: unknown) => void): IEventBus;
  off(event: string, handler: (data: unknown) => void): IEventBus;
  once(event: string, handler: (data: unknown) => void): IEventBus;
  removeAllListeners(event?: string): IEventBus;
  getMaxListeners(): number;
  setMaxListeners(n: number): IEventBus;
  listeners(event: string): Function[];
  listenerCount(event: string): number;
}

interface ILogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
  configure?(config: any): Promise<void>;
}

interface ITerminalManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  spawnTerminal(profile: any): Promise<string>;
  terminateTerminal(terminalId: string): Promise<void>;
  sendCommand(terminalId: string, command: any): Promise<string>;
  executeCommand(terminalId: string, command: string): Promise<string>;
  getHealthStatus(): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }>;
  performMaintenance(): Promise<void>;
}

interface IMemoryManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  createBank(agentId: string): Promise<string>;
  closeBank(bankId: string): Promise<void>;
  store(key: string, value: any, options?: any): Promise<void>;
  store(entry: any): Promise<void>;
  retrieve(key: string, options?: any): Promise<any>;
  query(query: any): Promise<any[]>;
  update(key: string, value: any, options?: any): Promise<void>;
  getHealthStatus(): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }>;
  performMaintenance(): Promise<void>;
}

interface ICoordinationManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  assignTask(task: any, agentId: string): Promise<string>;
  getAgentTaskCount(agentId: string): Promise<number>;
  getAgentTasks(agentId: string): Promise<any[]>;
  cancelTask(taskId: string, reason?: string): Promise<void>;
  acquireResource(resourceId: string, agentId: string): Promise<void>;
  releaseResource(resourceId: string, agentId: string): Promise<void>;
  sendMessage(from: string, to: string, message: unknown): Promise<void>;
  getHealthStatus(): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }>;
  performMaintenance(): Promise<void>;
  getCoordinationMetrics(): Promise<Record<string, unknown>>;
  enableAdvancedScheduling(): void;
  reportConflict(type: 'resource' | 'task', id: string, agents: string[]): Promise<void>;
  registerAgent(agent: any): Promise<void>;
  unregisterAgent(agentId: string): Promise<void>;
  completeTask(taskId: string, result?: any): Promise<void>;
  failTask(taskId: string, error?: any): Promise<void>;
}

interface IMCPServer {
  // Methods from the detailed MockMCPServer in mock-mcp-server.ts
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  registerTool(tool: any): Promise<void>;
  listTools(): Promise<any[]>;
  executeTool(toolCall: any, context?: any): Promise<any>;
  handleRequest(request: any): Promise<any>;
  
  // Additional methods from the simplified MockMCPServer
  getHealthStatus?(): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }>;
  getMetrics?(): any;
  getSessions?(): any[];
  getSession?(sessionId: string): any | undefined;
  terminateSession?(sessionId: string): void;
}

// Helper function to create Jest mock
function createSpy<T extends (...args: any[]) => any>(implementation?: T): MockedFunction<T> {
  return jest.fn(implementation) as unknown as MockedFunction<T>;
}

/**
 * Mock EventBus implementation
 */
export class MockEventBus implements IEventBus {
  private events: Array<{ event: string; data: any }> = [];
  private handlers = new Map<string, Array<(data: any) => void>>();

  emit(event: string, data?: unknown): boolean {
    this.events.push({ event, data });
    const eventHandlers = this.handlers.get(event) || [];
    eventHandlers.forEach(handler => handler(data));
    return eventHandlers.length > 0;
  }

  on(event: string, handler: (data: unknown) => void): IEventBus {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
    return this;
  }

  off(event: string, handler: (data: unknown) => void): IEventBus {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);
      if (index !== -1) {
        eventHandlers.splice(index, 1);
      }
    }
    return this;
  }

  once(event: string, handler: (data: unknown) => void): IEventBus {
    const wrappedHandler = (data: unknown) => {
      handler(data);
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
    return this;
  }

  // Additional EventEmitter methods for compatibility
  removeAllListeners(event?: string): IEventBus {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
    return this;
  }

  getMaxListeners(): number {
    return 0; // Mock implementation
  }

  setMaxListeners(n: number): IEventBus {
    // Mock implementation
    return this;
  }

  listeners(event: string): Function[] {
    return this.handlers.get(event) || [];
  }

  listenerCount(event: string): number {
    return this.listeners(event).length;
  }

  getEvents(): Array<{ event: string; data: any }> {
    return this.events;
  }

  clearEvents(): void {
    this.events = [];
  }

  clearHandlers(): void {
    this.handlers.clear();
  }
}

/**
 * Mock Logger implementation
 */
export class MockLogger implements ILogger {
  private logs: Array<{ level: string; message: string; data?: any }> = [];

  debug = createSpy((message: string, data?: unknown): void => {
    this.logs.push({ level: 'debug', message, data });
  });

  info = createSpy((message: string, data?: unknown): void => {
    this.logs.push({ level: 'info', message, data });
  });

  warn = createSpy((message: string, data?: unknown): void => {
    this.logs.push({ level: 'warn', message, data });
  });

  error = createSpy((message: string, error?: unknown): void => {
    this.logs.push({ level: 'error', message, data: error });
  });

  configure = createSpy(async (config: any): Promise<void> => {
    // No-op for mock
  });

  getLogs(): Array<{ level: string; message: string; data?: any }> {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  hasLog(level: string, message: string): boolean {
    return this.logs.some(log => log.level === level && log.message.includes(message));
  }
}

/**
 * Mock Terminal Manager
 */
export class MockTerminalManager implements ITerminalManager {
  private terminals = new Map<string, { profile: AgentProfile; output: string[] }>();
  private initialized = false;
  
  spawnTerminal = createSpy(async (profile: any): Promise<string> => {
    const id = `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.terminals.set(id, { profile, output: [] });
    return id;
  });

  terminateTerminal = createSpy(async (terminalId: string): Promise<void> => {
    if (!this.terminals.has(terminalId)) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }
    this.terminals.delete(terminalId);
  });

  sendCommand = createSpy(async (terminalId: string, command: any): Promise<string> => {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) throw new Error(`Terminal not found: ${terminalId}`);
    
    const commandStr = typeof command === 'string' ? command : command.command || 'unknown';
    const output = `Mock output for: ${commandStr}`;
    terminal.output.push(output);
    return output;
  });

  executeCommand = createSpy(async (terminalId: string, command: string): Promise<string> => {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) throw new Error(`Terminal not found: ${terminalId}`);

    const output = `Mock output for: ${command}`;
    terminal.output.push(output);
    return output;
  });

  initialize = createSpy(async (): Promise<void> => {
    if (this.initialized) {
      throw new Error('Terminal manager already initialized');
    }
    this.initialized = true;
  });

  shutdown = createSpy(async (): Promise<void> => {
    this.terminals.clear();
    this.initialized = false;
  });

  getHealthStatus = createSpy(async (): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }> => {
    return {
      healthy: this.initialized,
      metrics: {
        activeTerminals: this.terminals.size,
        totalCommands: Array.from(this.terminals.values()).reduce((sum, t) => sum + t.output.length, 0),
      },
    };
  });

  performMaintenance = createSpy(async (): Promise<void> => {
    // Simulate maintenance by clearing old terminals
    const now = Date.now();
    for (const [id, terminal] of this.terminals.entries()) {
      // Remove terminals older than 1 hour (for testing)
      const terminalAge = now - parseInt(id.split('-')[1]);
      if (terminalAge > 3600000) {
        this.terminals.delete(id);
      }
    }
  });

  getTerminal(id: string) {
    return this.terminals.get(id);
  }

  isInitialized() {
    return this.initialized;
  }
}

/**
 * Mock Memory Manager
 */
export class MockMemoryManager implements IMemoryManager {
  private banks = new Map<string, any[]>();
  private entries = new Map<string, any>();
  private initialized = false;
  
  initialize = createSpy(async (): Promise<void> => {
    if (this.initialized) {
      throw new Error('Memory manager already initialized');
    }
    this.initialized = true;
  });

  shutdown = createSpy(async (): Promise<void> => {
    this.initialized = false;
    this.banks.clear();
    this.entries.clear();
  });

  createBank = createSpy(async (agentId: string): Promise<string> => {
    const bankId = `bank-${agentId}-${Date.now()}`;
    this.banks.set(bankId, []);
    return bankId;
  });

  closeBank = createSpy(async (bankId: string): Promise<void> => {
    if (!this.banks.has(bankId)) {
      throw new Error(`Bank not found: ${bankId}`);
    }
    this.banks.delete(bankId);
  });

  store = createSpy(async (keyOrEntry: string | any, value?: any, options: any = {}): Promise<void> => {
    if (typeof keyOrEntry === 'string') {
      // Pattern 1: store(key, value, options) - bank-based storage
      const key = keyOrEntry;
      const bankId = options.bankId || 'default';
      
      if (!this.banks.has(bankId)) {
        this.banks.set(bankId, []);
      }
      
      const bank = this.banks.get(bankId)!;
      
      // Remove existing entry with same key
      const existingIndex = bank.findIndex((entry: any) => entry.key === key);
      if (existingIndex !== -1) {
        bank.splice(existingIndex, 1);
      }
      
      // Add new entry
      bank.push({ key, value, timestamp: Date.now() });
    } else {
      // Pattern 2: store(entry) - direct entry storage
      const entry = keyOrEntry;
      const entryId = entry.id || entry.key || `entry-${Date.now()}`;
      
      this.entries.set(entryId, {
        ...entry,
        timestamp: Date.now()
      });
    }
  });

  retrieve = createSpy(async (key: string, options: any = {}): Promise<any> => {
    // Try direct entry storage first
    if (this.entries.has(key)) {
      const entry = this.entries.get(key);
      return options.includeMetadata ? entry : entry.value || entry.content;
    }
    
    // Try bank-based storage
    const bankId = options.bankId || 'default';
    const bank = this.banks.get(bankId);
    if (!bank) {
      return null;
    }
    
    const entry = bank.find((entry: any) => entry.key === key);
    return entry ? entry.value : null;
  });

  query = createSpy(async (query: any): Promise<any[]> => {
    const results: any[] = [];
    const searchTerm = query.search?.toLowerCase() || '';
    const limit = query.limit || 100;
    
    // Search direct entries
    for (const [entryId, entry] of this.entries) {
      if (searchTerm && !entryId.toLowerCase().includes(searchTerm)) {
        continue;
      }
      
      results.push({
        id: entryId,
        content: entry.value || entry.content || entry,
        timestamp: new Date(entry.timestamp || Date.now()),
        tags: entry.tags || []
      });
      
      if (results.length >= limit) break;
    }
    
    // Search bank-based entries
    for (const [bankId, bank] of this.banks) {
      for (const entry of bank) {
        if (searchTerm && !entry.key.toLowerCase().includes(searchTerm)) {
          continue;
        }
        
        results.push({
          id: entry.key,
          bankId,
          content: entry.value,
          timestamp: new Date(entry.timestamp),
          tags: entry.tags || []
        });
        
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }
    
    return results;
  });

  update = createSpy(async (key: string, value: any, options: any = {}): Promise<void> => {
    // Try direct entry storage first
    if (this.entries.has(key)) {
      const entry = this.entries.get(key);
      this.entries.set(key, {
        ...entry,
        value: value,
        timestamp: Date.now()
      });
      return;
    }
    
    // Try bank-based storage
    const bankId = options.bankId || 'default';
    const bank = this.banks.get(bankId);
    if (!bank) {
      throw new Error(`Bank ${bankId} not found`);
    }
    
    const entryIndex = bank.findIndex((entry: any) => entry.key === key);
    if (entryIndex === -1) {
      throw new Error(`Entry with key ${key} not found in bank ${bankId}`);
    }
    
    bank[entryIndex] = {
      ...bank[entryIndex],
      value,
      timestamp: Date.now()
    };
  });

  list = createSpy(async (bankId: string): Promise<string[]> => {
    const bank = this.banks.get(bankId);
    if (!bank) return [];
    return bank.map((entry: any) => entry.key);
  });

  delete = createSpy(async (id: string): Promise<void> => {
    // Try direct entry storage first
    if (this.entries.has(id)) {
      this.entries.delete(id);
      return;
    }
    
    // Try bank-based storage (use id as key)
    for (const bank of this.banks.values()) {
      const index = bank.findIndex((entry: any) => entry.key === id || entry.id === id);
      if (index !== -1) {
        bank.splice(index, 1);
        return;
      }
    }
    
    throw new Error(`Entry with id ${id} not found`);
  });

  getHealthStatus = createSpy(async (): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }> => {
    return {
      healthy: this.initialized,
      metrics: {
        totalBanks: this.banks.size,
        totalEntries: Array.from(this.banks.values()).reduce((sum, bank) => sum + bank.length, 0) + this.entries.size,
        memoryUsage: JSON.stringify(Array.from(this.banks.entries())).length + JSON.stringify(Array.from(this.entries.entries())).length
      }
    };
  });

  performMaintenance = createSpy(async (): Promise<void> => {
    // Simulate maintenance tasks
    const now = Date.now();
    
    // Clean up bank entries
    for (const [bankId, bank] of this.banks) {
      const filtered = bank.filter((entry: any) => 
        !entry.expiresAt || entry.expiresAt > now
      );
      this.banks.set(bankId, filtered);
    }
    
    // Clean up direct entries
    for (const [entryId, entry] of this.entries) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.entries.delete(entryId);
      }
    }
  });

  // Test utilities
  getBanks() {
    return new Map(this.banks);
  }

  getEntries() {
    return new Map(this.entries);
  }

  isInitialized() {
    return this.initialized;
  }
}

/**
 * Mock Coordination Manager
 */
export class MockCoordinationManager implements ICoordinationManager {
  private tasks = new Map<string, { task: Task; agentId: string }>();
  private agentTasks = new Map<string, Task[]>();
  private initialized = false;

  initialize = createSpy(async (): Promise<void> => {
    this.initialized = true;
  });

  shutdown = createSpy(async (): Promise<void> => {
    this.tasks.clear();
    this.agentTasks.clear();
    this.initialized = false;
  });

  assignTask = createSpy(async (task: Task, agentId: string): Promise<string> => {
    this.tasks.set(task.id, { task, agentId });
    const agentTaskList = this.agentTasks.get(agentId) || [];
    agentTaskList.push(task);
    this.agentTasks.set(agentId, agentTaskList);
    return agentId;
  });

  getAgentTaskCount = createSpy(async (agentId: string): Promise<number> => {
    const tasks = this.agentTasks.get(agentId) || [];
    return tasks.filter(t => t.status !== 'completed' && t.status !== 'failed').length;
  });

  getAgentTasks = createSpy(async (agentId: string): Promise<Task[]> => {
    return this.agentTasks.get(agentId) || [];
  });

  cancelTask = createSpy(async (taskId: string, reason?: string): Promise<void> => {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      taskInfo.task.status = 'cancelled';
    }
  });

  getHealthStatus = createSpy(async (): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }> => {
    return {
      healthy: true,
      metrics: {
        totalTasks: this.tasks.size,
      },
    };
  });

  performMaintenance = createSpy(async (): Promise<void> => {
    // No-op for mock
  });

  acquireResource = createSpy(async (resourceId: string, agentId: string): Promise<void> => {
    // Mock implementation
  });

  releaseResource = createSpy(async (resourceId: string, agentId: string): Promise<void> => {
    // Mock implementation
  });

  sendMessage = createSpy(async (from: string, to: string, message: unknown): Promise<void> => {
    // Mock implementation
  });

  getCoordinationMetrics = createSpy(async (): Promise<Record<string, unknown>> => {
    return {
      totalTasks: this.tasks.size,
      activeAgents: this.agentTasks.size,
      resourcesInUse: 0,
      messagesRouted: 0
    };
  });

  enableAdvancedScheduling = createSpy((): void => {
    // Mock implementation
  });

  reportConflict = createSpy(async (type: 'resource' | 'task', id: string, agents: string[]): Promise<void> => {
    // Mock implementation
  });

  registerAgent = createSpy(async (agent: any): Promise<void> => {
    // Mock implementation
  });

  unregisterAgent = createSpy(async (agentId: string): Promise<void> => {
    // Mock implementation
  });

  completeTask = createSpy(async (taskId: string, result?: any): Promise<void> => {
    // Mock implementation
  });

  failTask = createSpy(async (taskId: string, error?: any): Promise<void> => {
    // Mock implementation
  });

  isInitialized() {
    return this.initialized;
  }

  getTasks() {
    return new Map(this.tasks);
  }
}

// Note: MockMCPServer is imported from mock-mcp-server.ts above, not redefined here

/**
 * Create a complete set of mocks for testing
 */
export function createMocks() {
  const logger = new MockLogger();
  const transport = new MockMCPTransport();
  return {
    eventBus: new MockEventBus(),
    logger,
    terminalManager: new MockTerminalManager(),
    memoryManager: new MockMemoryManager(),
    coordinationManager: new MockCoordinationManager(),
    mcpServer: new MockMCPServer(transport, logger),
  };
}

/**
 * Type guard for mock objects
 */
export function isMock(obj: any): boolean {
  return obj instanceof MockEventBus ||
         obj instanceof MockLogger ||
         obj instanceof MockTerminalManager ||
         obj instanceof MockMemoryManager ||
         obj instanceof MockCoordinationManager ||
         obj instanceof MockMCPServer ||
         obj instanceof MockMCPTransport;
}