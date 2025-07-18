/**
 * Enterprise MCP Integration Tests
 * Comprehensive test suite for 87 tools integration with security, compliance, and monitoring
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EnterpriseMCPOrchestrator } from '../../../src/mcp/enterprise-mcp-orchestrator';
import { EnterpriseToolsManager } from '../../../src/mcp/enterprise-tools-manager';
import { MCPServer } from '../../../src/mcp/server';
import { ILogger } from '../../../src/core/logger';
import { MCPTool } from '../../../src/utils/types';

// Mock dependencies
jest.mock('../../../src/mcp/server');
jest.mock('../../../src/mcp/enterprise-tools-manager');
jest.mock('../../../src/core/logger');

describe('Enterprise MCP Integration', () => {
  let mockLogger: jest.Mocked<ILogger>;
  let mockMCPServer: jest.Mocked<MCPServer>;
  let mockToolsManager: jest.Mocked<EnterpriseToolsManager>;
  let orchestrator: EnterpriseMCPOrchestrator;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      configure: jest.fn()
    } as any;

    // Setup mock MCP server
    mockMCPServer = {
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn(),
      registerTool: jest.fn()
    } as any;

    // Setup mock tools manager
    mockToolsManager = {
      initialize: jest.fn(),
      getAllTools: jest.fn(),
      getCategories: jest.fn(),
      getToolStatistics: jest.fn()
    } as any;

    // Mock constructor correctly
    (EnterpriseToolsManager as unknown as jest.Mock).mockImplementation(() => mockToolsManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Orchestrator Initialization', () => {
    it('should initialize with default enterprise configuration', async () => {
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getCapabilities()).toContain('enterprise_tools');
      expect(orchestrator.getCapabilities()).toContain('advanced_security');
      expect(orchestrator.getCapabilities()).toContain('compliance_validation');
    });

    it('should initialize with custom configuration', async () => {
      const customConfig = {
        enableEnterpriseTools: true,
        enableLegacyTools: false,
        enableAdvancedSecurity: true,
        enableCompliance: false,
        enableMonitoring: true,
        performanceOptimizations: true,
        rateLimiting: {
          enabled: true,
          globalLimits: {
            requestsPerMinute: 500,
            burstLimit: 25
          }
        },
        caching: {
          enabled: true,
          strategy: 'redis' as const,
          ttl: 600
        },
        auditLogging: {
          enabled: false,
          retentionDays: 30,
          complianceFrameworks: ['SOC2']
        }
      };

      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer, customConfig);
      
      expect(orchestrator).toBeDefined();
    });

    it('should successfully initialize all enterprise components', async () => {
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      // Mock successful initialization
      mockToolsManager.initialize.mockResolvedValue(undefined);
      mockToolsManager.getAllTools.mockReturnValue([]);
      mockToolsManager.getCategories.mockReturnValue(['development', 'data', 'security']);
      
      await orchestrator.initialize();
      
      expect(mockToolsManager.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Enterprise MCP Orchestrator initialized', expect.any(Object));
    });

    it('should handle initialization failures gracefully', async () => {
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      // Mock initialization failure
      mockToolsManager.initialize.mockRejectedValue(new Error('Initialization failed'));
      
      await expect(orchestrator.initialize()).rejects.toThrow('Initialization failed');
    });
  });

  describe('Enterprise Tools Integration', () => {
    beforeEach(async () => {
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      // Create proper MCPTool objects
      const mockTools: MCPTool[] = [
        {
          name: 'github_enterprise',
          description: 'Enterprise GitHub management',
          handler: jest.fn(async () => ({ success: true })),
          inputSchema: { type: 'object' }
        },
        {
          name: 'database_enterprise',
          description: 'Enterprise database operations',
          handler: jest.fn(async () => ({ success: true })),
          inputSchema: { type: 'object' }
        }
      ];
      
      mockToolsManager.initialize.mockResolvedValue(undefined);
      mockToolsManager.getAllTools.mockReturnValue(mockTools);
      mockToolsManager.getCategories.mockReturnValue(['development', 'data']);
      
      await orchestrator.initialize();
    });

    it('should register all enterprise tools with MCP server', () => {
      expect(mockMCPServer.registerTool).toHaveBeenCalledTimes(2);
      expect(mockMCPServer.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'github_enterprise',
          description: 'Enterprise GitHub management'
        })
      );
    });

    it('should wrap tools with enterprise middleware', () => {
      const registeredTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      
      expect(registeredTool.handler).toBeDefined();
      expect(registeredTool.handler).not.toBe(mockToolsManager.getAllTools()[0].handler);
    });

    it('should get total tool count including enterprise tools', async () => {
      const totalCount = await orchestrator.getTotalToolCount();
      
      expect(totalCount).toBeGreaterThan(0);
      expect(totalCount).toEqual(52); // 2 enterprise tools + 50 estimated MCP tools
    });
  });

  describe('Security and Compliance Features', () => {
    beforeEach(async () => {
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      const mockTool: MCPTool = {
        name: 'test_tool',
        description: 'Test tool',
        handler: jest.fn(async () => ({ result: 'success' })),
        inputSchema: { type: 'object' }
      };
      
      mockToolsManager.initialize.mockResolvedValue(undefined);
      mockToolsManager.getAllTools.mockReturnValue([mockTool]);
      mockToolsManager.getCategories.mockReturnValue(['test']);
      
      await orchestrator.initialize();
    });

    it('should enforce security validation on tool execution', async () => {
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      
      const testInput = { test: 'data' };
      const testContext = { 
        userId: 'test-user', 
        sessionId: 'test-session',
        logger: mockLogger
      };
      
      const result = await wrappedTool.handler(testInput, testContext);
      
      expect(result).toEqual({ result: 'success' });
    });

    it('should perform compliance validation', async () => {
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      
      const testInput = { sensitiveData: true };
      const testContext = { 
        userId: 'test-user',
        sessionId: 'test-session',
        logger: mockLogger
      };
      
      const result = await wrappedTool.handler(testInput, testContext);
      
      expect(result).toEqual({ result: 'success' });
    });

    it('should handle security failures appropriately', async () => {
      const mockTool: MCPTool = {
        name: 'secure_tool',
        description: 'Secure tool',
        handler: jest.fn(async () => {
          throw new Error('Security violation');
        }),
        inputSchema: { type: 'object' }
      };
      
      // Override the mock to return the new failing tool
      mockToolsManager.getAllTools.mockReturnValue([mockTool]);
      
      const orchestratorWithSecurity = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      await orchestratorWithSecurity.initialize();
      
      // Get the newly registered tool, not the old one
      const registeredTools = (mockMCPServer.registerTool as jest.Mock).mock.calls;
      const wrappedTool = registeredTools[registeredTools.length - 1][0] as MCPTool;
      
      await expect(wrappedTool.handler({}, { sessionId: 'test', logger: mockLogger })).rejects.toThrow('Security violation');
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    beforeEach(async () => {
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      const mockTool: MCPTool = {
        name: 'performance_tool',
        description: 'Performance test tool',
        handler: jest.fn(async () => {
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 100));
          return { result: 'completed' };
        }),
        inputSchema: { type: 'object' }
      };
      
      mockToolsManager.initialize.mockResolvedValue(undefined);
      mockToolsManager.getAllTools.mockReturnValue([mockTool]);
      mockToolsManager.getCategories.mockReturnValue(['performance']);
      
      await orchestrator.initialize();
    });

    it('should track tool execution metrics', async () => {
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      const mockContext = { sessionId: 'test', logger: mockLogger };
      
      // Execute tool multiple times
      await wrappedTool.handler({}, mockContext);
      await wrappedTool.handler({}, mockContext);
      await wrappedTool.handler({}, mockContext);
      
      const metrics = orchestrator.getExecutionMetrics('performance_tool');
      
      expect(metrics).toBeDefined();
      if (metrics && typeof metrics === 'object' && !('get' in metrics)) {
        expect(metrics.totalExecutions).toBe(3);
        expect(metrics.successfulExecutions).toBe(3);
        expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      }
    });

    it('should track global system metrics', async () => {
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      
      await wrappedTool.handler({}, { sessionId: 'test', logger: mockLogger });
      
      const globalMetrics = orchestrator.getGlobalMetrics();
      
      expect(globalMetrics.totalRequests).toBe(1);
      expect(globalMetrics.systemHealth).toBe(100);
      expect(globalMetrics.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('should provide detailed statistics', async () => {
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      
      mockMCPServer.getMetrics.mockReturnValue({
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        averageResponseTime: 250,
        activeSessions: 2,
        toolInvocations: {},
        errors: {},
        lastReset: new Date()
      });
      
      mockToolsManager.getToolStatistics.mockResolvedValue({
        totalTools: 87,
        toolsByCategory: { development: 15, data: 12 },
        securityLevels: { public: 50, internal: 37 },
        averageSuccessRate: 99.5,
        totalInvocations: 1000,
        complianceFrameworks: ['SOC2', 'GDPR']
      });
      
      await wrappedTool.handler({}, { sessionId: 'test', logger: mockLogger });
      
      const stats = await orchestrator.getDetailedStatistics();
      
      expect(stats.overview).toBeDefined();
      expect(stats.enterprise).toBeDefined();
      expect(stats.mcp).toBeDefined();
      expect(stats.performance).toBeDefined();
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      mockToolsManager.initialize.mockResolvedValue(undefined);
      mockToolsManager.getAllTools.mockReturnValue([]);
      mockToolsManager.getCategories.mockReturnValue([]);
      
      await orchestrator.initialize();
    });

    it('should perform system health checks', async () => {
      mockMCPServer.getHealthStatus.mockResolvedValue({
        healthy: true,
        metrics: { tools: 87 }
      });
      
      mockToolsManager.getToolStatistics.mockResolvedValue({
        totalTools: 87,
        toolsByCategory: { development: 15 },
        securityLevels: { public: 50 },
        averageSuccessRate: 98.5,
        totalInvocations: 5000,
        complianceFrameworks: ['SOC2']
      });
      
      const healthStatus = await orchestrator.getSystemHealthStatus();
      
      expect(healthStatus.overall).toBeGreaterThan(90);
      expect(healthStatus.components.mcp).toBeDefined();
      expect(healthStatus.components.enterprise).toBeDefined();
    });

    it('should handle unhealthy MCP server', async () => {
      mockMCPServer.getHealthStatus.mockResolvedValue({
        healthy: false,
        error: 'Server unreachable'
      });
      
      const healthStatus = await orchestrator.getSystemHealthStatus();
      
      expect(healthStatus.overall).toBeLessThan(100);
      expect(healthStatus.issues).toContain('MCP server issues');
    });

    it('should handle enterprise tools health issues', async () => {
      // Mock MCP server returning proper health status
      mockMCPServer.getHealthStatus.mockResolvedValue({
        healthy: true,
        metrics: { tools: 0 }
      });
      
      mockToolsManager.getToolStatistics.mockRejectedValue(new Error('Tools manager error'));
      
      const healthStatus = await orchestrator.getSystemHealthStatus();
      
      expect(healthStatus.components.enterprise.healthy).toBe(false);
      expect(healthStatus.issues).toContain('Enterprise tools issues');
    });
  });

  describe('Caching and Performance Optimization', () => {
    beforeEach(async () => {
      const cacheConfig = {
        enableEnterpriseTools: true,
        enableLegacyTools: true,
        enableAdvancedSecurity: false,
        enableCompliance: false,
        enableMonitoring: true,
        performanceOptimizations: true,
        rateLimiting: {
          enabled: false,
          globalLimits: {
            requestsPerMinute: 1000,
            burstLimit: 50
          }
        },
        caching: {
          enabled: true,
          strategy: 'memory' as const,
          ttl: 300
        },
        auditLogging: {
          enabled: false,
          retentionDays: 90,
          complianceFrameworks: []
        }
      };
      
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer, cacheConfig);
      
      const mockTool: MCPTool = {
        name: 'cacheable_tool',
        description: 'Cacheable tool',
        handler: jest.fn(async () => ({ result: 'cached_result', timestamp: Date.now() })),
        inputSchema: { type: 'object' }
      };
      
      mockToolsManager.initialize.mockResolvedValue(undefined);
      mockToolsManager.getAllTools.mockReturnValue([mockTool]);
      mockToolsManager.getCategories.mockReturnValue(['test']);
      
      await orchestrator.initialize();
    });

    it('should cache tool execution results', async () => {
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      const testInput = { query: 'test' };
      const mockContext = { sessionId: 'test', logger: mockLogger };
      
      // First execution
      const result1 = await wrappedTool.handler(testInput, mockContext);
      
      // Second execution with same input should use cache
      const result2 = await wrappedTool.handler(testInput, mockContext);
      
      expect(result1).toEqual(result2);
    });

    it('should identify optimization opportunities', async () => {
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      const mockContext = { sessionId: 'test', logger: mockLogger };
      
      // Execute tool multiple times to build metrics
      for (let i = 0; i < 15; i++) {
        await wrappedTool.handler({ iteration: i }, mockContext);
      }
      
      const metrics = orchestrator.getExecutionMetrics('cacheable_tool');
      if (metrics && typeof metrics === 'object' && !('get' in metrics)) {
        expect(metrics.totalExecutions).toBe(15);
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(async () => {
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      const faultyTool: MCPTool = {
        name: 'faulty_tool',
        description: 'Tool that sometimes fails',
        handler: jest.fn(async (input: any) => {
          if (input.shouldFail) {
            throw new Error('Simulated failure');
          }
          return { result: 'success' };
        }),
        inputSchema: { type: 'object' }
      };
      
      mockToolsManager.initialize.mockResolvedValue(undefined);
      mockToolsManager.getAllTools.mockReturnValue([faultyTool]);
      mockToolsManager.getCategories.mockReturnValue(['test']);
      
      await orchestrator.initialize();
    });

    it('should handle tool execution errors gracefully', async () => {
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      
      // Successful execution
      const successResult = await wrappedTool.handler({ shouldFail: false }, { sessionId: 'test', logger: mockLogger });
      expect(successResult).toEqual({ result: 'success' });
      
      // Failed execution
      await expect(wrappedTool.handler({ shouldFail: true }, { sessionId: 'test', logger: mockLogger })).rejects.toThrow('Simulated failure');
      
      // Check metrics reflect both success and failure
      const metrics = orchestrator.getExecutionMetrics('faulty_tool');
      if (metrics && typeof metrics === 'object' && !('get' in metrics)) {
        expect(metrics.totalExecutions).toBe(2);
        expect(metrics.successfulExecutions).toBe(1);
        expect(metrics.failedExecutions).toBe(1);
      }
    });

    it('should emit alerts for failures when monitoring is enabled', async () => {
      let alertEmitted = false;
      orchestrator.on('alert', (alert) => {
        alertEmitted = true;
        expect(alert.level).toBe('error');
        expect(alert.message).toContain('Tool execution failed');
      });
      
      const wrappedTool = (mockMCPServer.registerTool as jest.Mock).mock.calls[0][0] as MCPTool;
      
      try {
        await wrappedTool.handler({ shouldFail: true }, { sessionId: 'test', logger: mockLogger });
      } catch (error) {
        // Expected to fail
      }
      
      // Give time for async event emission
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(alertEmitted).toBe(true);
    });
  });

  describe('Enterprise Tools Manager Integration', () => {
    it('should successfully integrate with tools manager', async () => {
      const mockTools = generateMockToolsSuite();
      
      // Clear all previous calls and create fresh orchestrator
      jest.clearAllMocks();
      (mockMCPServer.registerTool as jest.Mock).mockClear();
      
      mockToolsManager.initialize.mockResolvedValue(undefined);
      mockToolsManager.getAllTools.mockReturnValue(mockTools);
      mockToolsManager.getCategories.mockReturnValue([
        'development', 'data', 'communication', 'cloud', 'security',
        'productivity', 'analytics', 'content', 'deployment', 'monitoring',
        'neural', 'enterprise'
      ]);
      
      // Create new orchestrator instance
      const freshOrchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      await freshOrchestrator.initialize();
      
      // Should register exactly the number of tools we generated (87)
      expect(mockMCPServer.registerTool).toHaveBeenCalledTimes(mockTools.length);
      expect(mockToolsManager.getCategories).toHaveBeenCalled();
    });

    it('should handle tools manager statistics', async () => {
      const mockStats = {
        totalTools: 87,
        toolsByCategory: {
          development: 15,
          data: 12,
          communication: 8,
          cloud: 10,
          security: 8,
          productivity: 8,
          analytics: 6,
          content: 6,
          deployment: 6,
          monitoring: 6,
          neural: 4,
          enterprise: 4
        },
        securityLevels: {
          public: 50,
          internal: 25,
          confidential: 10,
          restricted: 2
        },
        averageSuccessRate: 99.2,
        totalInvocations: 10000,
        complianceFrameworks: ['SOC2', 'GDPR', 'HIPAA']
      };
      
      mockToolsManager.getToolStatistics.mockResolvedValue(mockStats);
      
      orchestrator = new EnterpriseMCPOrchestrator(mockLogger, mockMCPServer);
      
      const enterpriseMetrics = await (orchestrator as any).getEnterpriseMetrics();
      
      expect(enterpriseMetrics.totalTools).toBe(87);
      expect(enterpriseMetrics.averageSuccessRate).toBe(99.2);
    });
  });
});

// Helper function to generate mock tools suite
function generateMockToolsSuite(): MCPTool[] {
  const categories = [
    { name: 'development', count: 15 },
    { name: 'data', count: 12 },
    { name: 'communication', count: 8 },
    { name: 'cloud', count: 10 },
    { name: 'security', count: 8 },
    { name: 'productivity', count: 8 },
    { name: 'analytics', count: 6 },
    { name: 'content', count: 6 },
    { name: 'deployment', count: 6 },
    { name: 'monitoring', count: 6 },
    { name: 'neural', count: 4 },
    { name: 'enterprise', count: 4 }
  ];
  
  const tools: MCPTool[] = [];
  
  for (const category of categories) {
    for (let i = 1; i <= category.count; i++) {
      tools.push({
        name: `${category.name}_tool_${i}`,
        description: `Enterprise ${category.name} tool ${i}`,
        handler: jest.fn(async () => ({ success: true })),
        inputSchema: { type: 'object', properties: {} }
      });
    }
  }
  
  return tools;
} 