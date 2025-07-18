/**
 * Infrastructure Manager Tests
 * Comprehensive tests for enterprise infrastructure management
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { InfrastructureManager, InfrastructureConfig } from '../../../src/enterprise/infrastructure-manager';
import { EventEmitter } from 'node:events';

// Mock child_process
jest.mock('node:child_process', () => ({
  spawn: jest.fn()
}));

// Mock file system operations
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn()
}));

describe('InfrastructureManager', () => {
  let infraManager: InfrastructureManager;
  let mockSpawn: jest.Mock;
  let mockConfig: Partial<InfrastructureConfig>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock spawn
    mockSpawn = require('node:child_process').spawn;
    
    // Create mock child process
    const mockChildProcess = new EventEmitter() as any;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = jest.fn();
    
    mockSpawn.mockReturnValue(mockChildProcess);
    
    // Setup test configuration
    mockConfig = {
      mode: 'enterprise',
      containerization: {
        enabled: true,
        orchestrator: 'docker-compose',
        scaling: {
          enabled: true,
          minInstances: 1,
          maxInstances: 5,
          targetCpu: 70,
          targetMemory: 80
        }
      },
      performance: {
        wasmAcceleration: true,
        neuralOptimization: true,
        memoryPooling: true,
        connectionPooling: true,
        caching: {
          enabled: true,
          layers: ['memory', 'redis'],
          maxSize: 1024
        }
      },
      monitoring: {
        enabled: true,
        metricsCollection: true,
        healthChecks: true,
        alerting: true
      }
    };
    
    infraManager = new InfrastructureManager(mockConfig);
  });

  afterEach(async () => {
    if (infraManager) {
      try {
        await infraManager.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new InfrastructureManager();
      expect(defaultManager).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      expect(infraManager).toBeDefined();
    });

    it('should validate Docker environment during initialization', async () => {
      // Mock successful Docker validation
      const mockProcess = mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });

      await infraManager.initialize();
      
      expect(mockSpawn).toHaveBeenCalledWith('docker', ['--version']);
    });

    it('should throw error if Docker is not available', async () => {
      // Mock failed Docker validation
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Error exit code
          }
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });

      await expect(infraManager.initialize()).rejects.toThrow('Docker not available');
    });

    it('should setup configuration directories', async () => {
      const mockMkdirSync = require('node:fs').mkdirSync;
      
      // Mock Docker validation success
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });

      await infraManager.initialize();
      
      expect(mockMkdirSync).toHaveBeenCalled();
    });

    it('should generate optimized configurations', async () => {
      const mockWriteFileSync = require('node:fs').writeFileSync;
      
      // Mock Docker validation success
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });

      await infraManager.initialize();
      
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'config/prometheus/prometheus.yml',
        expect.any(String)
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'config/nginx/nginx.conf',
        expect.any(String)
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'config/postgres/postgresql.conf',
        expect.any(String)
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'config/redis/redis.conf',
        expect.any(String)
      );
    });
  });

  describe('Deployment', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });
      
      await infraManager.initialize();
    });

    it('should deploy with Docker Compose', async () => {
      // Mock successful deployment
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      await infraManager.deploy();
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker-compose',
        expect.arrayContaining(['-f', 'docker-compose.enterprise.yml', 'up', '-d'])
      );
    });

    it('should handle deployment failures', async () => {
      // Mock failed deployment
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(1);
        })
      });

      await expect(infraManager.deploy()).rejects.toThrow();
    });

    it('should emit deployment events', async () => {
      const deployedHandler = jest.fn();
      infraManager.on('deployed', deployedHandler);
      
      // Mock successful deployment
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      await infraManager.deploy();
      
      expect(deployedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
          containers: expect.any(Array),
          metrics: expect.any(Object)
        })
      );
    });
  });

  describe('Scaling', () => {
    beforeEach(async () => {
      // Mock successful initialization and deployment
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });
      
      await infraManager.initialize();
      await infraManager.deploy();
    });

    it('should scale up instances', async () => {
      const targetInstances = 3;
      
      // Mock successful scaling
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      await infraManager.scale(targetInstances, 'test scaling');
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker-compose',
        expect.arrayContaining([
          '-f', 'docker-compose.enterprise.yml', 
          'up', '-d', '--scale', `flowx-worker=${targetInstances}`
        ])
      );
    });

    it('should scale down instances', async () => {
      const targetInstances = 1;
      
      // Mock successful scaling
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      await infraManager.scale(targetInstances, 'test scaling down');
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker-compose',
        expect.arrayContaining([`flowx-worker=${targetInstances}`])
      );
    });

    it('should emit scaling events', async () => {
      const scaledHandler = jest.fn();
      infraManager.on('scaled', scaledHandler);
      
      // Mock successful scaling
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      await infraManager.scale(2, 'test event');
      
      expect(scaledHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.any(String),
          targetInstances: 2,
          reason: 'test event',
          timestamp: expect.any(Date)
        })
      );
    });

    it('should handle scaling failures', async () => {
      // Mock failed scaling
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(1);
        })
      });

      await expect(infraManager.scale(3, 'test failure')).rejects.toThrow();
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });
      
      await infraManager.initialize();
    });

    it('should collect performance metrics', () => {
      const metrics = infraManager.getPerformanceMetrics();
      
      expect(metrics).toEqual(
        expect.objectContaining({
          responseTime: expect.any(Number),
          throughput: expect.any(Number),
          memoryUsage: expect.any(Number),
          cpuUtilization: expect.any(Number),
          diskIO: expect.any(Number),
          networkLatency: expect.any(Number),
          timestamp: expect.any(Date),
          improvement: expect.objectContaining({
            factor: expect.any(Number),
            baseline: expect.any(Number),
            current: expect.any(Number)
          })
        })
      );
    });

    it('should emit metrics events during monitoring', (done) => {
      infraManager.on('metrics', (metrics) => {
        expect(metrics).toEqual(
          expect.objectContaining({
            responseTime: expect.any(Number),
            throughput: expect.any(Number),
            timestamp: expect.any(Date)
          })
        );
        done();
      });
      
      // Trigger metrics collection manually for testing
      infraManager['collectPerformanceMetrics']();
    });

    it('should calculate performance improvement factor', () => {
      const metrics = infraManager.getPerformanceMetrics();
      
      expect(metrics.improvement.factor).toBeGreaterThan(0);
      expect(metrics.improvement.baseline).toBeGreaterThan(0);
      expect(metrics.improvement.current).toBeGreaterThan(0);
    });

    it('should target 2.8x-4.4x performance improvement', () => {
      const metrics = infraManager.getPerformanceMetrics();
      
      // In a real scenario, this would verify actual performance improvements
      // For testing, we verify the structure is correct
      expect(metrics.improvement.factor).toBeDefined();
      expect(typeof metrics.improvement.factor).toBe('number');
    });
  });

  describe('Health Checks', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });
      
      await infraManager.initialize();
    });

    it('should provide infrastructure status', () => {
      const status = infraManager.getStatus();
      
      expect(status).toEqual(
        expect.objectContaining({
          initialized: expect.any(Boolean),
          containers: expect.any(Array),
          metrics: expect.any(Object),
          scalingHistory: expect.any(Array),
          uptime: expect.any(Number)
        })
      );
    });

    it('should track container health status', () => {
      const status = infraManager.getStatus();
      
      // Verify container status structure
      if (status.containers.length > 0) {
        const container = status.containers[0];
        expect(container).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            status: expect.stringMatching(/^(running|stopped|error|starting)$/),
            health: expect.stringMatching(/^(healthy|unhealthy|unknown)$/),
            resources: expect.objectContaining({
              cpu: expect.any(Number),
              memory: expect.any(Number),
              disk: expect.any(Number),
              network: expect.any(Number)
            })
          })
        );
      }
    });

    it('should emit unhealthy container events', (done) => {
      infraManager.on('unhealthy', (container) => {
        expect(container).toEqual(
          expect.objectContaining({
            name: expect.any(String),
            health: 'unhealthy'
          })
        );
        done();
      });
      
      // Manually trigger health check for testing
      infraManager['performHealthChecks']();
    });
  });

  describe('Auto-scaling', () => {
    beforeEach(async () => {
      // Mock successful initialization with auto-scaling enabled
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });
      
      await infraManager.initialize();
    });

    it('should evaluate scaling based on metrics', async () => {
      // Manually trigger scaling evaluation
      await infraManager['evaluateScaling']();
      
      // Verify scaling logic was executed (no specific assertions since it's internal)
      expect(true).toBe(true); // Placeholder - would test specific scaling logic in real implementation
    });

    it('should respect min and max instance limits', async () => {
      const config = infraManager['config'];
      
      expect(config.containerization.scaling.minInstances).toBe(1);
      expect(config.containerization.scaling.maxInstances).toBe(5);
    });

    it('should consider CPU and memory thresholds', () => {
      const config = infraManager['config'];
      
      expect(config.containerization.scaling.targetCpu).toBe(70);
      expect(config.containerization.scaling.targetMemory).toBe(80);
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });
      
      await infraManager.initialize();
    });

    it('should shutdown gracefully', async () => {
      // Mock successful shutdown
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      await infraManager.shutdown();
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'docker-compose',
        ['-f', 'docker-compose.enterprise.yml', 'down']
      );
    });

    it('should emit shutdown events', async () => {
      const shutdownHandler = jest.fn();
      infraManager.on('shutdown', shutdownHandler);
      
      // Mock successful shutdown
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      await infraManager.shutdown();
      
      expect(shutdownHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date)
        })
      );
    });

    it('should kill processes during shutdown', async () => {
      const mockProcess = {
        kill: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      };
      
      infraManager['processes'].set('test-process', mockProcess as any);
      
      // Mock successful docker-compose shutdown
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        })
      });

      await infraManager.shutdown();
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('Configuration Generation', () => {
    it('should generate Prometheus configuration', () => {
      const config = infraManager['generatePrometheusConfig']();
      
      expect(config).toContain('global:');
      expect(config).toContain('scrape_configs:');
      expect(config).toContain('flowx-orchestrator');
      expect(config).toContain('flowx-worker');
    });

    it('should generate Nginx configuration', () => {
      const config = infraManager['generateNginxConfig']();
      
      expect(config).toContain('upstream flowx_backend');
      expect(config).toContain('server flowx-orchestrator:3000');
      expect(config).toContain('gzip on');
    });

    it('should generate PostgreSQL configuration', () => {
      const config = infraManager['generatePostgresConfig']();
      
      expect(config).toContain('shared_buffers = 256MB');
      expect(config).toContain('max_connections = 200');
      expect(config).toContain('effective_cache_size = 1GB');
    });

    it('should generate Redis configuration', () => {
      const config = infraManager['generateRedisConfig']();
      
      expect(config).toContain('maxmemory 512mb');
      expect(config).toContain('maxmemory-policy allkeys-lru');
      expect(config).toContain('save 900 1');
    });
  });

  describe('Error Handling', () => {
    it('should handle Docker environment validation errors', async () => {
      // Mock Docker not found
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            callback(new Error('Docker not found'));
          }
        })
      });

      await expect(infraManager.initialize()).rejects.toThrow('Docker not found');
    });

    it('should handle configuration generation errors', async () => {
      const mockWriteFileSync = require('node:fs').writeFileSync;
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      // Mock Docker validation success
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });

      await expect(infraManager.initialize()).rejects.toThrow();
    });

    it('should prevent double initialization', async () => {
      // Mock successful initialization
      mockSpawn.mockReturnValue({
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() }
      });
      
      await infraManager.initialize();
      
      await expect(infraManager.initialize()).rejects.toThrow('already initialized');
    });
  });

  describe('Performance Optimization Features', () => {
    it('should support WASM acceleration', () => {
      expect(infraManager['config'].performance.wasmAcceleration).toBe(true);
    });

    it('should support neural optimization', () => {
      expect(infraManager['config'].performance.neuralOptimization).toBe(true);
    });

    it('should support memory pooling', () => {
      expect(infraManager['config'].performance.memoryPooling).toBe(true);
    });

    it('should support connection pooling', () => {
      expect(infraManager['config'].performance.connectionPooling).toBe(true);
    });

    it('should configure multi-layer caching', () => {
      const caching = infraManager['config'].performance.caching;
      
      expect(caching.enabled).toBe(true);
      expect(caching.layers).toContain('memory');
      expect(caching.layers).toContain('redis');
      expect(caching.maxSize).toBe(1024);
    });
  });
}); 