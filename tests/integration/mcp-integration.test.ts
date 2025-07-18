/**
 * Integration tests for MCP (Model Context Protocol) integration
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  assertEquals,
  assertExists,
  assertRejects,
  spy,
} from '../test.utils';
import eventBus, { EventBus } from '../../src/core/event-bus';
import { Logger } from '../../src/core/logger';
import { MockMCPServer, MockMCPTransport } from '../mocks/index';
import {
  MCPTool,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPContext,
  MCPToolCall,
  MCPToolResult,
  AgentProfile,
} from '../../src/utils/types';
import { cleanupTestEnv, setupTestEnv } from '../test.config';
import { generateId, delay } from '../../src/utils/helpers';

describe('MCP Integration', () => {
  let mcpServer: MockMCPServer;
  let mcpTransport: MockMCPTransport;
  let eventBus: EventBus;
  let logger: Logger;

  beforeEach(() => {
    setupTestEnv();
    
    // Reset singletons
    EventBus.reset();
    eventBus = EventBus.getInstance();
    
    // Get logger instance with test configuration
    logger = Logger.getInstance({
      level: 'debug',
      format: 'text',
      destination: 'console',
    });

    mcpTransport = new MockMCPTransport();
    mcpServer = new MockMCPServer(mcpTransport, logger);
  });

  afterEach(async () => {
    // Clean up resources
    try {
      if (mcpServer) {
        await mcpServer.shutdown();
      }
      
      // Reset singleton states
      EventBus.reset();
      
      // Clear listeners
      mcpTransport.listeners = [];
      
      // Additional cleanup
      await cleanupTestEnv();
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

  describe('tool registration and execution', () => {
    it('should register and execute MCP tools', async () => {
      await mcpServer.initialize();

      // Register a test tool
      const testTool: MCPTool = {
        name: 'echo_tool',
        description: 'Echoes input back with timestamp',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            uppercase: { type: 'boolean', default: false },
          },
          required: ['message'],
        },
        handler: async (input: any, context?: MCPContext) => {
          const { message, uppercase = false } = input;
          const result = uppercase ? message.toUpperCase() : message;
          
          if (context?.logger) {
            context.logger.info(`Echo tool executed: ${result}`);
          }
          
          return {
            content: [{
              type: 'text',
              text: `Echo: ${result} (${new Date().toISOString()})`,
            }],
          };
        },
      };

      await mcpServer.registerTool(testTool);

      // Verify tool registration
      const tools = await mcpServer.listTools();
      assertEquals(tools.length, 1);
      assertEquals(tools[0].name, 'echo_tool');

      // Create tool call request
      const toolCall: MCPToolCall = {
        name: 'echo_tool',
        arguments: {
          message: 'Hello, MCP!',
          uppercase: true,
        },
      };

      const context: MCPContext = {
        sessionId: generateId('session'),
        agentId: 'test-agent',
        logger,
      };

      // Execute tool
      const result = await mcpServer.executeTool(toolCall, context);

      assertExists(result);
      assertEquals(result.content.length, 1);
      assertEquals(result.content[0].type, 'text');
      assertEquals(result.content[0].text?.includes('HELLO, MCP!'), true);
    });

    it('should handle tool execution errors gracefully', async () => {
      await mcpServer.initialize();

      // Register a tool that throws an error
      const errorTool: MCPTool = {
        name: 'error_tool',
        description: 'A tool that always throws an error',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        handler: async () => {
          throw new Error('Tool execution failed');
        },
      };

      await mcpServer.registerTool(errorTool);

      const toolCall: MCPToolCall = {
        name: 'error_tool',
        arguments: {},
      };

      const context: MCPContext = {
        sessionId: generateId('session'),
        logger,
      };

      const result = await mcpServer.executeTool(toolCall, context);

      assertEquals(result.isError, true);
      assertEquals(result.content.length, 1);
      assertEquals(result.content[0].type, 'text');
      assertEquals(result.content[0].text?.includes('Tool execution failed'), true);
    });

    it('should validate tool input schemas', async () => {
      await mcpServer.initialize();

      const strictTool: MCPTool = {
        name: 'strict_tool',
        description: 'Tool with strict input validation',
        inputSchema: {
          type: 'object',
          properties: {
            requiredParam: { type: 'string' },
            numericParam: { type: 'number', minimum: 0 },
          },
          required: ['requiredParam'],
          additionalProperties: false,
        },
        handler: async (input: any) => {
          return {
            content: [{
              type: 'text',
              text: `Processed: ${input.requiredParam}`,
            }],
          };
        },
      };

      await mcpServer.registerTool(strictTool);

      // Test invalid input (missing required parameter)
      const invalidCall: MCPToolCall = {
        name: 'strict_tool',
        arguments: {
          numericParam: 5,
          // Missing requiredParam
        },
      };

      const context: MCPContext = {
        sessionId: generateId('session'),
        logger,
      };

      const result = await mcpServer.executeTool(invalidCall, context);

      assertEquals(result.isError, true);
      assertEquals(result.content[0].text?.includes('validation'), true);
    });
  });

  describe('multi-agent MCP coordination', () => {
    it('should coordinate tool access across multiple agents', async () => {
      await mcpServer.initialize();

      // Register a shared resource tool
      let resourceCount = 0;
      const resourceTool: MCPTool = {
        name: 'shared_resource',
        description: 'Manages a shared resource counter',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['increment', 'get'] },
          },
          required: ['action'],
        },
        handler: async (input: any, context?: MCPContext) => {
          const { action } = input;
          
          if (action === 'increment') {
            resourceCount++;
            context?.logger?.info(`Resource incremented by ${context.agentId}: ${resourceCount}`);
          }
          
          return {
            content: [{
              type: 'text',
              text: `Resource count: ${resourceCount}`,
            }],
          };
        },
      };

      await mcpServer.registerTool(resourceTool);

      // Simulate multiple agents accessing the tool
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      const operations = agents.map(async (agentId) => {
        const context: MCPContext = {
          sessionId: generateId('session'),
          agentId,
          logger,
        };

        // Each agent increments the resource
        const incrementCall: MCPToolCall = {
          name: 'shared_resource',
          arguments: { action: 'increment' },
        };

        await mcpServer.executeTool(incrementCall, context);

        // Then gets the current value
        const getCall: MCPToolCall = {
          name: 'shared_resource',
          arguments: { action: 'get' },
        };

        return mcpServer.executeTool(getCall, context);
      });

      const results = await Promise.all(operations);

      // Verify all operations completed
      assertEquals(results.length, 3);
      results.forEach(result => {
        if (result && result.isError !== undefined) {
          assertEquals(result.isError, false);
        }
        assertExists(result && result.content && result.content[0] && result.content[0].text);
      });

      // Final resource count should be 3 (one increment per agent)
      assertEquals(resourceCount, 3);
    });

    it('should handle tool registration conflicts', async () => {
      await mcpServer.initialize();

      const tool1: MCPTool = {
        name: 'conflicting_tool',
        description: 'First version of tool',
        inputSchema: { type: 'object' },
        handler: async () => ({ content: [{ type: 'text', text: 'Version 1' }] }),
      };

      const tool2: MCPTool = {
        name: 'conflicting_tool',
        description: 'Second version of tool',
        inputSchema: { type: 'object' },
        handler: async () => ({ content: [{ type: 'text', text: 'Version 2' }] }),
      };

      // Register first tool
      await mcpServer.registerTool(tool1);

      // Attempt to register conflicting tool
      await assertRejects(
        () => mcpServer.registerTool(tool2),
        Error,
        'Tool already registered'
      );

      // Verify only first tool is registered
      const tools = await mcpServer.listTools();
      assertEquals(tools.length, 1);
      assertEquals(tools[0].description, 'First version of tool');
    });
  });

  describe('request-response protocol', () => {
    it('should handle JSON-RPC requests and responses', async () => {
      await mcpServer.initialize();

      // Register a calculation tool
      const calcTool: MCPTool = {
        name: 'calculator',
        description: 'Performs basic arithmetic',
        inputSchema: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
            a: { type: 'number' },
            b: { type: 'number' },
          },
          required: ['operation', 'a', 'b'],
        },
        handler: async (input: any) => {
          const { operation, a, b } = input;
          let result: number;

          switch (operation) {
            case 'add':
              result = a + b;
              break;
            case 'subtract':
              result = a - b;
              break;
            case 'multiply':
              result = a * b;
              break;
            case 'divide':
              if (b === 0) throw new Error('Division by zero');
              result = a / b;
              break;
            default:
              throw new Error('Unknown operation');
          }

          return {
            content: [{
              type: 'text',
              text: `${a} ${operation} ${b} = ${result}`,
            }],
          };
        },
      };

      await mcpServer.registerTool(calcTool);

      // Create JSON-RPC request
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: generateId('request'),
        method: 'tools/call',
        params: {
          name: 'calculator',
          arguments: {
            operation: 'multiply',
            a: 6,
            b: 7,
          },
        },
      };

      // Process request
      const response = await mcpServer.handleRequest(request);

      // Verify response structure
      assertEquals(response.jsonrpc, '2.0');
      assertEquals(response.id, request.id);
      assertExists(response.result);
      assertEquals(response.error, undefined);

      // Verify calculation result
      const toolResult = response.result as MCPToolResult;
      assertEquals(toolResult.content[0].text, '6 multiply 7 = 42');
    });

    it('should handle malformed requests', async () => {
      await mcpServer.initialize();

      // Invalid JSON-RPC request (missing required fields)
      const invalidRequest = {
        method: 'tools/call',
        // Missing jsonrpc and id
      } as MCPRequest;

      const response = await mcpServer.handleRequest(invalidRequest);

      // Should return error response
      assertEquals(response.jsonrpc, '2.0');
      assertExists(response.error);
      assertEquals(response.error!.code, -32600); // Invalid Request
    });

    it('should handle unknown methods', async () => {
      await mcpServer.initialize();

      const unknownRequest: MCPRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'unknown/method',
        params: {},
      };

      const response = await mcpServer.handleRequest(unknownRequest);

      assertEquals(response.error!.code, -32601); // Method not found
    });
  });

  describe('transport layer integration', () => {
    it('should communicate through transport layer', async () => {
      await mcpServer.initialize();

      // Register echo tool
      const echoTool: MCPTool = {
        name: 'echo',
        description: 'Echo tool for transport testing',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
        handler: async (input: any) => ({
          content: [{
            type: 'text',
            text: input.message,
          }],
        }),
      };

      await mcpServer.registerTool(echoTool);

      // Simulate transport layer sending request
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: { message: 'Hello from transport!' },
        },
      });

      await mcpTransport.send(message);

      // Wait for response
      await delay(100);

      // Verify transport received response
      assertEquals(mcpTransport.sent.length, 1);
      const response = JSON.parse(mcpTransport.sent[0]);
      assertEquals(response.jsonrpc, '2.0');
      assertEquals(response.id, 1);
      assertEquals(response.result.content[0].text, 'Hello from transport!');
    });

    it('should handle transport errors', async () => {
      await mcpServer.initialize();

      // Mock transport error
      mcpTransport.send = spy(() => {
        throw new Error('Transport connection failed');
      });

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 'error-test',
        method: 'tools/list',
      };

      // Should handle transport error gracefully
      await assertRejects(
        () => mcpServer.handleRequest(request),
        Error,
        'Transport connection failed'
      );
    });
  });

  describe('agent profile integration', () => {
    it('should associate MCP tools with agent capabilities', async () => {
      await mcpServer.initialize();

      // Register tools for different agent types
      const researchTool: MCPTool = {
        name: 'web_search',
        description: 'Search the web for information',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            maxResults: { type: 'number', default: 10 },
          },
          required: ['query'],
        },
        handler: async (input: any) => ({
          content: [{
            type: 'text',
            text: `Search results for: ${input.query}`,
          }],
        }),
      };

      const codeTool: MCPTool = {
        name: 'code_analyzer',
        description: 'Analyze code for issues',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            language: { type: 'string' },
          },
          required: ['code'],
        },
        handler: async (input: any) => ({
          content: [{
            type: 'text',
            text: `Code analysis for ${input.language || 'unknown'} language`,
          }],
        }),
      };

      await mcpServer.registerTool(researchTool);
      await mcpServer.registerTool(codeTool);

      // Create agent profiles with specific capabilities
      const researcherProfile: AgentProfile = {
        id: 'researcher',
        name: 'Research Agent',
        type: 'researcher',
        capabilities: ['web_search', 'data_analysis'],
        systemPrompt: 'You are a research agent',
        maxConcurrentTasks: 3,
        priority: 1,
      };

      const implementerProfile: AgentProfile = {
        id: 'implementer',
        name: 'Implementation Agent',
        type: 'implementer',
        capabilities: ['code_analyzer', 'terminal', 'file_operations'],
        systemPrompt: 'You are an implementation agent',
        maxConcurrentTasks: 2,
        priority: 2,
      };

      // Test researcher using research tool
      const researchContext: MCPContext = {
        sessionId: generateId('session'),
        agentId: researcherProfile.id,
        logger,
      };

      const searchCall: MCPToolCall = {
        name: 'web_search',
        arguments: { query: 'Deno best practices' },
      };

      const searchResult = await mcpServer.executeTool(searchCall, researchContext);
      assertEquals(searchResult.isError, false);
      assertEquals(searchResult.content[0].text?.includes('Deno best practices'), true);

      // Test implementer using code tool
      const implementerContext: MCPContext = {
        sessionId: generateId('session'),
        agentId: implementerProfile.id,
        logger,
      };

      const codeCall: MCPToolCall = {
        name: 'code_analyzer',
        arguments: {
          code: 'function hello() { console.log("hello"); }',
          language: 'javascript',
        },
      };

      const codeResult = await mcpServer.executeTool(codeCall, implementerContext);
      assertEquals(codeResult.isError, false);
      assertEquals(codeResult.content[0].text?.includes('javascript'), true);
    });
  });

  describe('performance and reliability', () => {
    it('should handle concurrent tool executions', async () => {
      await mcpServer.initialize();

      // Register a performance test tool
      let executionCount = 0;
      const perfTool: MCPTool = {
        name: 'performance_test',
        description: 'Tool for performance testing',
        inputSchema: {
          type: 'object',
          properties: {
            delay: { type: 'number', default: 100 },
            id: { type: 'string' },
          },
          required: ['id'],
        },
        handler: async (input: any) => {
          executionCount++;
          await delay(input.delay || 100);
          
          return {
            content: [{
              type: 'text',
              text: `Execution ${input.id} completed (total: ${executionCount})`,
            }],
          };
        },
      };

      await mcpServer.registerTool(perfTool);

      // Execute multiple tool calls concurrently
      const concurrentCalls = Array.from({ length: 10 }, (_, i) => {
        const context: MCPContext = {
          sessionId: generateId('session'),
          agentId: `agent-${i}`,
          logger,
        };

        const toolCall: MCPToolCall = {
          name: 'performance_test',
          arguments: {
            id: `call-${i}`,
            delay: 50,
          },
        };

        return mcpServer.executeTool(toolCall, context);
      });

      const results = await Promise.all(concurrentCalls);

      // Verify all executions completed
      assertEquals(results.length, 10);
      assertEquals(executionCount, 10);
      
      results.forEach((result, index) => {
        assertEquals(result.isError, false);
        assertEquals(result.content[0].text?.includes(`call-${index}`), true);
      });
    });

    it('should handle tool execution timeouts', async () => {
      await mcpServer.initialize();

      // Register a slow tool
      const slowTool: MCPTool = {
        name: 'slow_tool',
        description: 'A tool that takes a long time',
        inputSchema: { type: 'object' },
        handler: async () => {
          await delay(5000); // 5 second delay
          return {
            content: [{
              type: 'text',
              text: 'Slow operation completed',
            }],
          };
        },
      };

      await mcpServer.registerTool(slowTool);

      const context: MCPContext = {
        sessionId: generateId('session'),
        agentId: 'timeout-test',
        logger,
      };

      const toolCall: MCPToolCall = {
        name: 'slow_tool',
        arguments: {},
      };

      // Execute with timeout (mock MCP server should have built-in timeout)
      const startTime = Date.now();
      const result = await mcpServer.executeTool(toolCall, context);
      const elapsed = Date.now() - startTime;

      // Should complete quickly (timeout mechanism)
      assertEquals(elapsed < 2000, true);
      
      // Should indicate timeout error if implemented
      if (result.isError) {
        assertEquals(result.content[0].text?.includes('timeout'), true);
      }
    });
  });
});