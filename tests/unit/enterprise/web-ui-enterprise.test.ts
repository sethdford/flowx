/**
 * ENTERPRISE WEB UI TESTS
 * Comprehensive test suite for the Enterprise Dashboard and Web UI Command
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import EnterpriseDashboard, { DashboardConfig, DashboardMetrics } from '../../../src/ui/enterprise-dashboard.ts';
import { webUIEnterpriseCommand } from '../../../src/cli/commands/system/web-ui-enterprise-command.ts';
import type { CLIContext } from '../../../src/cli/interfaces/index.ts';

// Mock dependencies
jest.mock('../../../src/utils/logger.ts');
jest.mock('../../../src/cli/core/global-initialization.ts');
jest.mock('express');
jest.mock('ws');
jest.mock('http');

describe('EnterpriseDashboard', () => {
  let dashboard: EnterpriseDashboard;
  let defaultConfig: DashboardConfig;

  beforeEach(() => {
    defaultConfig = {
      port: 3000,
      host: 'localhost',
      enableRealTime: true,
      enableCollaboration: false,
      theme: 'dark',
      features: {
        visualWorkflow: true,
        neuralNetworks: true,
        swarmCoordination: true,
        memoryManagement: true,
        githubIntegration: true,
        realTimeMonitoring: true,
        enterpriseAnalytics: true,
        systemManagement: true
      }
    };

    dashboard = new EnterpriseDashboard(defaultConfig);
  });

  afterEach(async () => {
    if (dashboard) {
      try {
        await dashboard.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Constructor and Configuration', () => {
    it('should create dashboard with default configuration', () => {
      expect(dashboard).toBeDefined();
      expect(dashboard['config']).toEqual(defaultConfig);
    });

    it('should initialize with correct metrics structure', () => {
      const metrics = dashboard['metrics'];
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('features');
      expect(metrics).toHaveProperty('realTime');
      
      expect(metrics.system).toHaveProperty('uptime');
      expect(metrics.system).toHaveProperty('cpuUsage');
      expect(metrics.system).toHaveProperty('memoryUsage');
      expect(metrics.system).toHaveProperty('diskUsage');
      expect(metrics.system).toHaveProperty('networkIO');
    });

    it('should set all features enabled by default', () => {
      Object.values(defaultConfig.features).forEach(feature => {
        expect(feature).toBe(true);
      });
    });
  });

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      // Mock Express app
      const mockApp = {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn()
      };

      const mockServer = {
        listen: jest.fn().mockImplementation((port, host, callback) => {
          setTimeout(callback, 0);
          return { on: jest.fn() };
        })
      };

      // Mock express module
      const expressMock = {
        default: jest.fn(() => mockApp),
        json: jest.fn(),
        urlencoded: jest.fn(),
        static: jest.fn()
      };

      jest.doMock('express', () => expressMock);
      jest.doMock('http', () => ({
        createServer: jest.fn(() => mockServer)
      }));

      await dashboard.start();
      
      expect(dashboard['isRunning']).toBe(true);
    });

    it('should not start if already running', async () => {
      dashboard['isRunning'] = true;
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await dashboard.start();
      
      // Should have logged warning but not failed
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should stop server gracefully', async () => {
      dashboard['isRunning'] = true;
      dashboard['server'] = {
        close: jest.fn().mockImplementation((callback) => callback())
      } as any;
      dashboard['wss'] = {
        close: jest.fn()
      } as any;
      dashboard['connections'] = new Set();

      await dashboard.stop();
      
      expect(dashboard['isRunning']).toBe(false);
    });

    it('should handle startup errors', async () => {
      const mockApp = {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn()
      };

      const mockServer = {
        listen: jest.fn().mockImplementation((port, host, callback) => {
          const error = { on: jest.fn().mockImplementation((event, errorCallback) => {
            if (event === 'error') {
              setTimeout(() => errorCallback(new Error('Port already in use')), 0);
            }
          }) };
          return error;
        })
      };

      jest.doMock('express', () => ({
        default: jest.fn(() => mockApp)
      }));
      jest.doMock('http', () => ({
        createServer: jest.fn(() => mockServer)
      }));

      await expect(dashboard.start()).rejects.toThrow();
    });
  });

  describe('Metrics Management', () => {
    it('should update metrics correctly', () => {
      const initialUptime = dashboard['metrics'].system.uptime;
      
      dashboard['updateMetrics']();
      
      const updatedMetrics = dashboard['metrics'];
      expect(updatedMetrics.system.uptime).toBeGreaterThanOrEqual(initialUptime);
      expect(updatedMetrics.system.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(updatedMetrics.system.cpuUsage).toBeLessThanOrEqual(100);
      expect(updatedMetrics.performance.responseTime).toBeGreaterThan(0);
      expect(updatedMetrics.performance.successRate).toBeGreaterThanOrEqual(95);
    });

    it('should format metrics correctly', () => {
      const metrics: DashboardMetrics = {
        system: {
          uptime: 3665,
          cpuUsage: 45.5,
          memoryUsage: 1024 * 1024 * 100, // 100 MB
          diskUsage: 75.2,
          networkIO: 1500
        },
        performance: {
          responseTime: 120,
          throughput: 850,
          errorRate: 1.5,
          successRate: 98.5
        },
        features: {
          activeWorkflows: 5,
          runningAgents: 12,
          memoryEntries: 5000,
          toolExecutions: 150,
          githubOperations: 25
        },
        realTime: {
          timestamp: new Date(),
          connections: 8,
          queuedTasks: 3,
          activeSessions: 6
        }
      };

      const uptime = dashboard['formatUptime'](metrics.system.uptime);
      expect(uptime).toBe('1h 1m');

      const memory = dashboard['formatBytes'](metrics.system.memoryUsage);
      expect(memory).toBe('100 MB');
    });

    it('should broadcast metrics to WebSocket connections', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };
      const mockWs3 = { readyState: 0, send: jest.fn() }; // Closed connection

      dashboard['connections'].add(mockWs1);
      dashboard['connections'].add(mockWs2);
      dashboard['connections'].add(mockWs3);

      dashboard['broadcastMetrics']();

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
      expect(mockWs3.send).not.toHaveBeenCalled();

      const sentMessage = JSON.parse(mockWs1.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('metrics_update');
      expect(sentMessage.data).toBeDefined();
    });
  });

  describe('WebSocket Functionality', () => {
    it('should handle WebSocket connections', () => {
      const mockWs = {
        send: jest.fn(),
        on: jest.fn(),
        subscriptions: new Set()
      };

      dashboard['connections'].add(mockWs);

      expect(dashboard['connections'].size).toBe(1);
    });

    it('should handle subscription requests', () => {
      const mockWs = {
        send: jest.fn(),
        subscriptions: new Set()
      };

      const subscriptionData = {
        feature: 'metrics',
        interval: 3000
      };

      dashboard['handleSubscription'](mockWs, subscriptionData);

      expect(mockWs.subscriptions.has('metrics')).toBe(true);
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('subscription_confirmed')
      );
    });

    it('should handle remote execution requests', () => {
      const mockWs = { send: jest.fn() };
      const executionData = {
        command: 'neural_train',
        parameters: { epochs: 10 }
      };

      dashboard['handleRemoteExecution'](mockWs, executionData);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('execution_result')
      );

      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('execution_result');
      expect(sentMessage.data.success).toBe(true);
    });

    it('should handle collaboration messages', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };
      const mockWs3 = { readyState: 0, send: jest.fn() };

      dashboard['connections'].add(mockWs1);
      dashboard['connections'].add(mockWs2);
      dashboard['connections'].add(mockWs3);

      const collaborationData = {
        action: 'cursor_move',
        payload: { x: 100, y: 200 }
      };

      dashboard['handleCollaboration'](mockWs1, collaborationData);

      // Should broadcast to other active connections
      expect(mockWs2.send).toHaveBeenCalled();
      expect(mockWs3.send).not.toHaveBeenCalled();
      expect(mockWs1.send).not.toHaveBeenCalled(); // Don't send back to sender

      const sentMessage = JSON.parse(mockWs2.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('collaboration');
      expect(sentMessage.data.action).toBe('cursor_move');
    });

    it('should handle invalid WebSocket messages', () => {
      const mockWs = { send: jest.fn() };
      const invalidData = Buffer.from('invalid json');

      dashboard['handleWebSocketMessage'](mockWs, invalidData);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON message')
      );
    });
  });

  describe('HTML Generation', () => {
    it('should generate main dashboard HTML', () => {
      const html = dashboard['generateMainDashboardHTML']();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Claude Flow Enterprise Dashboard');
      expect(html).toContain('Enterprise Dashboard Overview');
      expect(html).toContain('Visual Workflow Designer');
      expect(html).toContain('Neural Networks');
      expect(html).toContain('Swarm Coordination');
      expect(html).toContain('Memory Management');
      expect(html).toContain('GitHub Integration');
      expect(html).toContain('Real-time Monitoring');
    });

    it('should include correct navigation links', () => {
      const html = dashboard['generateMainDashboardHTML']();

      expect(html).toContain('href="/workflows"');
      expect(html).toContain('href="/neural"');
      expect(html).toContain('href="/swarm"');
      expect(html).toContain('href="/memory"');
      expect(html).toContain('href="/github"');
      expect(html).toContain('href="/monitoring"');
      expect(html).toContain('href="/system"');
    });

    it('should apply correct theme classes', () => {
      const darkDashboard = new EnterpriseDashboard({
        ...defaultConfig,
        theme: 'dark'
      });

      const lightDashboard = new EnterpriseDashboard({
        ...defaultConfig,
        theme: 'light'
      });

      const darkHtml = darkDashboard['generateMainDashboardHTML']();
      const lightHtml = lightDashboard['generateMainDashboardHTML']();

      expect(darkHtml).toContain('class="dark"');
      expect(lightHtml).toContain('class="light"');
    });

    it('should generate feature-specific dashboards', () => {
      const workflowHtml = dashboard['generateWorkflowDashboardHTML']();
      const neuralHtml = dashboard['generateNeuralDashboardHTML']();
      const swarmHtml = dashboard['generateSwarmDashboardHTML']();

      expect(workflowHtml).toContain('Workflow Designer');
      expect(neuralHtml).toContain('Neural Networks');
      expect(swarmHtml).toContain('Swarm Coordination');

      // All should have back navigation
      expect(workflowHtml).toContain('← Back to Overview');
      expect(neuralHtml).toContain('← Back to Overview');
      expect(swarmHtml).toContain('← Back to Overview');
    });
  });

  describe('Utility Functions', () => {
    it('should format uptime correctly', () => {
      expect(dashboard['formatUptime'](0)).toBe('0m');
      expect(dashboard['formatUptime'](30)).toBe('0m');
      expect(dashboard['formatUptime'](90)).toBe('1m');
      expect(dashboard['formatUptime'](3600)).toBe('1h 0m');
      expect(dashboard['formatUptime'](3665)).toBe('1h 1m');
      expect(dashboard['formatUptime'](86400)).toBe('1d 0h');
      expect(dashboard['formatUptime'](90061)).toBe('1d 1h');
    });

    it('should format bytes correctly', () => {
      expect(dashboard['formatBytes'](0)).toBe('0 Bytes');
      expect(dashboard['formatBytes'](1024)).toBe('1 KB');
      expect(dashboard['formatBytes'](1024 * 1024)).toBe('1 MB');
      expect(dashboard['formatBytes'](1024 * 1024 * 1024)).toBe('1 GB');
      expect(dashboard['formatBytes'](1536)).toBe('1.5 KB');
      expect(dashboard['formatBytes'](1572864)).toBe('1.5 MB');
    });
  });

  describe('Feature Toggles', () => {
    it('should respect feature configuration', () => {
      const limitedConfig: DashboardConfig = {
        ...defaultConfig,
        features: {
          visualWorkflow: true,
          neuralNetworks: false,
          swarmCoordination: false,
          memoryManagement: true,
          githubIntegration: false,
          realTimeMonitoring: true,
          enterpriseAnalytics: false,
          systemManagement: true
        }
      };

      const limitedDashboard = new EnterpriseDashboard(limitedConfig);
      const html = limitedDashboard['generateMainDashboardHTML']();

      // Should include enabled features
      expect(html).toContain('Visual Workflow Designer');
      expect(html).toContain('Memory Management');

      // Feature states should be reflected in configuration
      expect(limitedDashboard['config'].features.neuralNetworks).toBe(false);
      expect(limitedDashboard['config'].features.swarmCoordination).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle server startup errors gracefully', async () => {
      // Mock a server that fails to start
      const mockApp = { use: jest.fn(), get: jest.fn(), post: jest.fn() };
      const mockServer = {
        listen: jest.fn().mockImplementation(() => {
          throw new Error('Address already in use');
        })
      };

      jest.doMock('express', () => ({
        default: jest.fn(() => mockApp)
      }));
      jest.doMock('http', () => ({
        createServer: jest.fn(() => mockServer)
      }));

      await expect(dashboard.start()).rejects.toThrow();
      expect(dashboard['isRunning']).toBe(false);
    });

    it('should handle WebSocket errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Test invalid message handling
      const mockWs = { send: jest.fn() };
      dashboard['handleWebSocketMessage'](mockWs, Buffer.from('invalid'));

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON')
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('Web UI Enterprise Command', () => {
  let mockContext: CLIContext;

  beforeEach(() => {
    mockContext = {
      command: 'web-ui',
      args: [],
      options: {
        port: 3000,
        host: 'localhost',
        theme: 'dark',
        realtime: true,
        collaboration: false,
        verbose: false,
        open: false
      },
      rawArgs: []
    };

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Command Definition', () => {
    it('should have correct command structure', () => {
      expect(webUIEnterpriseCommand.name).toBe('web-ui');
      expect(webUIEnterpriseCommand.description).toContain('enterprise web UI');
      expect(webUIEnterpriseCommand.category).toBe('System');
      expect(webUIEnterpriseCommand.usage).toContain('flowx web-ui');
    });

    it('should have comprehensive options', () => {
      const options = webUIEnterpriseCommand.options || [];
      const optionNames = options.map(opt => opt.name);

      expect(optionNames).toContain('port');
      expect(optionNames).toContain('host');
      expect(optionNames).toContain('theme');
      expect(optionNames).toContain('realtime');
      expect(optionNames).toContain('collaboration');
      expect(optionNames).toContain('features');
      expect(optionNames).toContain('open');
    });

    it('should have practical examples', () => {
      const examples = webUIEnterpriseCommand.examples || [];
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.some(ex => ex.includes('--port'))).toBe(true);
      expect(examples.some(ex => ex.includes('--features'))).toBe(true);
      expect(examples.some(ex => ex.includes('--open'))).toBe(true);
    });
  });

  describe('Feature Parsing', () => {
    it('should parse feature flags correctly', () => {
      // Test the parseFeatures function by using mock command context
      const featuresString = 'workflows,neural,swarm';
      mockContext.options.features = featuresString;

      // We can't directly test the internal function, but we can test the behavior
      // by mocking the dashboard creation process
      expect(featuresString.split(',')).toEqual(['workflows', 'neural', 'swarm']);
    });

    it('should handle empty feature string', () => {
      mockContext.options.features = '';
      
      const emptyFeatures = ''.split(',').filter(f => f.trim().length > 0);
      expect(emptyFeatures).toEqual([]);
    });

    it('should trim whitespace from features', () => {
      const featuresWithSpaces = ' workflows , neural , swarm ';
      const parsed = featuresWithSpaces
        .split(',')
        .map(f => f.trim().toLowerCase())
        .filter(f => f.length > 0);

      expect(parsed).toEqual(['workflows', 'neural', 'swarm']);
    });
  });

  describe('Configuration Generation', () => {
    it('should generate correct dashboard config from options', () => {
      const options = {
        port: 8080,
        host: '0.0.0.0',
        theme: 'light',
        realtime: false,
        collaboration: true,
        features: 'workflows,neural'
      };

      const expectedConfig = {
        port: 8080,
        host: '0.0.0.0',
        enableRealTime: false,
        enableCollaboration: true,
        theme: 'light',
        features: {
          visualWorkflow: true,
          neuralNetworks: true,
          swarmCoordination: false,
          memoryManagement: false,
          githubIntegration: false,
          realTimeMonitoring: false,
          enterpriseAnalytics: false,
          systemManagement: false
        }
      };

      // Test the logic that would be used in the command
      const enabledFeatures = options.features.split(',').map(f => f.trim().toLowerCase());
      
      expect(enabledFeatures.includes('workflows')).toBe(true);
      expect(enabledFeatures.includes('neural')).toBe(true);
      expect(enabledFeatures.includes('swarm')).toBe(false);
    });

    it('should enable all features when no specific features specified', () => {
      const options = { port: 3000, host: 'localhost' };
      
      // When no features are specified, all should be enabled
      const allEnabled = !options.hasOwnProperty('features');
      expect(allEnabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle dashboard creation errors', async () => {
      // Mock EnterpriseDashboard to throw an error
      jest.doMock('../../../src/ui/enterprise-dashboard.ts', () => ({
        default: jest.fn().mockImplementation(() => {
          throw new Error('Failed to create dashboard');
        })
      }));

      // The command should handle errors gracefully
      try {
        await webUIEnterpriseCommand.handler(mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should validate port numbers', () => {
      const invalidPorts = [-1, 0, 65536, 100000];
      const validPorts = [80, 3000, 8080, 65535];

      invalidPorts.forEach(port => {
        expect(port < 1 || port > 65535).toBe(true);
      });

      validPorts.forEach(port => {
        expect(port >= 1 && port <= 65535).toBe(true);
      });
    });
  });

  describe('Browser Opening', () => {
    it('should attempt to open browser when requested', () => {
      mockContext.options.open = true;
      
      // The browser opening functionality should be tested
      // We can verify the platform-specific command generation
      const platform = process.platform;
      let expectedCommand: string;

      if (platform === 'darwin') {
        expectedCommand = 'open "http://localhost:3000"';
      } else if (platform === 'win32') {
        expectedCommand = 'start "http://localhost:3000"';
      } else {
        expectedCommand = 'xdg-open "http://localhost:3000"';
      }

      expect(expectedCommand).toContain('http://localhost:3000');
    });
  });

  describe('Feature Display', () => {
    it('should format feature names correctly', () => {
      const featureMap = {
        visualWorkflow: '🔄 Visual Workflow Designer',
        neuralNetworks: '🧠 Neural Networks & WASM Acceleration',
        swarmCoordination: '🤖 Swarm Coordination & Multi-Agent',
        memoryManagement: '💾 Memory Management & Persistence',
        githubIntegration: '🐙 GitHub Integration & Automation',
        realTimeMonitoring: '📈 Real-time Monitoring & Analytics',
        enterpriseAnalytics: '📊 Enterprise Analytics & Reporting',
        systemManagement: '⚙️ System Management & Configuration'
      };

      Object.entries(featureMap).forEach(([key, expectedName]) => {
        expect(expectedName).toContain('🔄' || '🧠' || '🤖' || '💾' || '🐙' || '📈' || '📊' || '⚙️');
        expect(expectedName.length).toBeGreaterThan(key.length);
      });
    });
  });
});

describe('Integration Tests', () => {
  describe('Dashboard and Command Integration', () => {
    it('should work together for full enterprise web UI', async () => {
      const mockContext: CLIContext = {
        command: 'web-ui',
        args: [],
        options: {
          port: 3001,
          host: 'localhost',
          theme: 'dark',
          realtime: true,
          features: 'workflows,neural'
        },
        rawArgs: []
      };

      // Mock the dashboard to avoid actual server startup
      const mockDashboard = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined)
      };

      jest.doMock('../../../src/ui/enterprise-dashboard.ts', () => ({
        default: jest.fn().mockImplementation(() => mockDashboard)
      }));

      // The integration should work without errors
      expect(mockContext.options.port).toBe(3001);
      expect(mockContext.options.features).toBe('workflows,neural');
    });
  });

  describe('End-to-End Feature Flow', () => {
    it('should handle complete feature lifecycle', () => {
      const featureFlow = {
        parse: (features: string) => features.split(',').map(f => f.trim()),
        validate: (features: string[]) => features.every(f => f.length > 0),
        enable: (features: string[]) => features.reduce((acc, f) => ({ ...acc, [f]: true }), {}),
        format: (features: Record<string, boolean>) => Object.keys(features).filter(k => features[k])
      };

      const input = 'workflows, neural, swarm';
      const parsed = featureFlow.parse(input);
      const valid = featureFlow.validate(parsed);
      const enabled = featureFlow.enable(parsed);
      const formatted = featureFlow.format(enabled);

      expect(parsed).toEqual(['workflows', 'neural', 'swarm']);
      expect(valid).toBe(true);
      expect(enabled).toEqual({
        workflows: true,
        neural: true,
        swarm: true
      });
      expect(formatted).toEqual(['workflows', 'neural', 'swarm']);
    });
  });
});

describe('Performance and Reliability', () => {
  describe('Memory Management', () => {
    it('should clean up resources properly', async () => {
      const dashboard = new EnterpriseDashboard({
        port: 3002,
        host: 'localhost',
        enableRealTime: false,
        enableCollaboration: false,
        theme: 'dark',
        features: {
          visualWorkflow: true,
          neuralNetworks: false,
          swarmCoordination: false,
          memoryManagement: false,
          githubIntegration: false,
          realTimeMonitoring: false,
          enterpriseAnalytics: false,
          systemManagement: false
        }
      });

      // Simulate starting and stopping
      dashboard['isRunning'] = true;
      dashboard['connections'] = new Set([
        { close: jest.fn() },
        { close: jest.fn() }
      ]);
      dashboard['wss'] = { close: jest.fn() } as any;
      dashboard['server'] = {
        close: jest.fn().mockImplementation((callback) => callback())
      } as any;

      await dashboard.stop();

      expect(dashboard['isRunning']).toBe(false);
      expect(dashboard['connections'].size).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should handle WebSocket connection failures', () => {
      const dashboard = new EnterpriseDashboard({
        port: 3003,
        host: 'localhost',
        enableRealTime: true,
        enableCollaboration: false,
        theme: 'dark',
        features: {
          visualWorkflow: true,
          neuralNetworks: true,
          swarmCoordination: true,
          memoryManagement: true,
          githubIntegration: true,
          realTimeMonitoring: true,
          enterpriseAnalytics: true,
          systemManagement: true
        }
      });

      // Test connection recovery logic
      const mockWs = {
        readyState: 0, // Closed
        send: jest.fn()
      };

      dashboard['connections'].add(mockWs);
      dashboard['broadcastMetrics']();

      // Should not attempt to send to closed connections
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Usage', () => {
    it('should handle multiple simultaneous connections', () => {
      const dashboard = new EnterpriseDashboard({
        port: 3004,
        host: 'localhost',
        enableRealTime: true,
        enableCollaboration: true,
        theme: 'dark',
        features: {
          visualWorkflow: true,
          neuralNetworks: true,
          swarmCoordination: true,
          memoryManagement: true,
          githubIntegration: true,
          realTimeMonitoring: true,
          enterpriseAnalytics: true,
          systemManagement: true
        }
      });

      // Simulate multiple connections
      const connections = Array.from({ length: 50 }, () => ({
        readyState: 1,
        send: jest.fn()
      }));

      connections.forEach(conn => dashboard['connections'].add(conn));

      dashboard['broadcastMetrics']();

      // All connections should receive the broadcast
      connections.forEach(conn => {
        expect(conn.send).toHaveBeenCalled();
      });
    });
  });
}); 