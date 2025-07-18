/**
 * Mock MCP Server and Transport for testing
 */

import type { ILogger } from '../../src/core/logger';
import {
  MCPTool,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPContext,
  MCPToolCall,
  MCPToolResult
} from '../../src/utils/types';

/**
 * Mock MCP Transport layer for testing
 */
export class MockMCPTransport {
  public received: string[] = [];
  public sent: string[] = [];
  public listeners: Array<(message: string) => void> = [];

  constructor() {}

  async send(message: string): Promise<void> {
    this.sent.push(message);
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in MCP transport listener:', error);
      }
    }
  }

  onMessage(listener: (message: string) => void): void {
    this.listeners.push(listener);
  }

  receive(message: string): void {
    this.received.push(message);
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in MCP transport listener:', error);
      }
    }
  }

  clearAll(): void {
    this.sent = [];
    this.received = [];
  }
}

/**
 * Mock MCP Server for testing
 */
/**
 * Mock MCP Server for testing
 * Implements both the detailed mock interface and the simplified interface from index.ts
 */
export class MockMCPServer {
  private tools = new Map<string, MCPTool>();
  private running = false;
  private requestTimeout = 2000; // 2s timeout for tests

  constructor(private transport: MockMCPTransport, private logger: ILogger) {
    this.transport.onMessage(this.handleMessage.bind(this));
  }

  async initialize(): Promise<void> {
    this.running = true;
    this.logger.info('Mock MCP Server initialized');
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    this.running = false;
    this.tools.clear();
    return Promise.resolve();
  }
  
  // Compatibility methods for the simplified IMCPServer interface
  async start(): Promise<void> {
    return this.initialize();
  }
  
  async stop(): Promise<void> {
    return this.shutdown();
  }
  
  async getHealthStatus(): Promise<{ healthy: boolean; error?: string; metrics?: Record<string, number> }> {
    return {
      healthy: this.running,
      metrics: {
        tools: this.tools.size,
        runningStatus: this.running ? 1 : 0
      }
    };
  }
  
  getMetrics(): any {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      activeSessions: 0,
      toolInvocations: {},
      errors: {},
      lastReset: new Date()
    };
  }
  
  getSessions(): any[] {
    return [];
  }
  
  getSession(sessionId: string): any | undefined {
    return undefined;
  }
  
  terminateSession(sessionId: string): void {
    // No-op implementation
  }

  async registerTool(tool: MCPTool): Promise<void> {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    
    this.tools.set(tool.name, tool);
    this.logger.info(`Tool registered: ${tool.name}`);
  }

  async listTools(): Promise<MCPTool[]> {
    return Array.from(this.tools.values());
  }

  async executeTool(toolCall: MCPToolCall, context?: MCPContext): Promise<MCPToolResult> {
    if (!this.running) {
      throw new Error('MCP Server not initialized');
    }

    const tool = this.tools.get(toolCall.name);
    if (!tool) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Tool not found: ${toolCall.name}`,
        }],
      };
    }

    try {
      // Execute with timeout
      const timeoutPromise = new Promise<MCPToolResult>((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timed out')), this.requestTimeout);
      });
      
      const executionPromise = this.executeToolWithValidation(tool, toolCall.arguments, context);
      
      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(`Tool execution error: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        isError: true,
        content: [{
          type: 'text',
          text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        }],
      };
    }
  }

  private async executeToolWithValidation(tool: MCPTool, args: any, context?: MCPContext): Promise<MCPToolResult> {
    // Validate input if schema provided
    if (tool.inputSchema) {
      try {
        // In a real implementation, this would validate against the schema
        // For mock purposes, we just check for required fields
        if (tool.inputSchema.required && Array.isArray(tool.inputSchema.required)) {
          for (const requiredField of tool.inputSchema.required) {
            if (args[requiredField] === undefined) {
              throw new Error(`Missing required field: ${requiredField}`);
            }
          }
        }
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `Input validation failed: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }

    try {
      // Execute tool handler
      const result = await tool.handler(args, context);
      return result as MCPToolResult;
    } catch (error) {
      throw error; // Let the outer catch handle this
    }
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.running) {
      throw new Error('MCP Server not initialized');
    }

    if (!request.jsonrpc || !request.id) {
      return {
        jsonrpc: '2.0',
        id: request.id || '0', // Use '0' as a fallback id instead of null
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Request must include jsonrpc and id fields',
        },
      };
    }

    // Handle different method types
    switch (request.method) {
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: await this.listTools(),
        };
        
      case 'tools/call':
        const toolParams = request.params as MCPToolCall;
        if (!toolParams || !toolParams.name) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32602,
              message: 'Invalid params',
              data: 'tools/call requires name and arguments parameters',
            },
          };
        }
        
        const toolCallParams = request.params as MCPToolCall;
        const result = await this.executeTool({
          name: toolCallParams.name,
          arguments: toolCallParams.arguments || {},
        });
        
        return {
          jsonrpc: '2.0',
          id: request.id,
          result,
        };
        
      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Unsupported method: ${request.method}`,
          },
        };
    }
  }

  private async handleMessage(message: string): Promise<void> {
    try {
      const request = JSON.parse(message) as MCPRequest;
      const response = await this.handleRequest(request);
      await this.transport.send(JSON.stringify(response));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error handling MCP message: ${errorMessage}`, { error });
      
      // Try to send error response if possible
      try {
        const request = JSON.parse(message) as MCPRequest;
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: request.id || '0', // Use '0' as fallback id
          error: {
            code: -32603,
            message: 'Internal error',
            data: errorMessage,
          },
        };
        await this.transport.send(JSON.stringify(response));
      } catch {
        // If we couldn't parse the request, we can't send a proper response
      }
    }
  }
}