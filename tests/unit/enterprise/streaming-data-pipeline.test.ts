/**
 * Enterprise Streaming Data Pipeline Tests
 * 
 * Comprehensive test suite covering:
 * - Stream creation and management
 * - Real-time processing and windowing
 * - Change Data Capture (CDC)
 * - Governance and compliance
 * - Performance monitoring and metrics
 * - Fault tolerance and error handling
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StreamingDataPipeline, StreamDefinition, StreamProcessor, CDCConfiguration } from '../../../src/enterprise/streaming-data-pipeline.js';

describe('StreamingDataPipeline', () => {
  let pipeline: StreamingDataPipeline;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    
    jest.doMock('../../../src/core/logger.js', () => ({
      Logger: jest.fn().mockImplementation(() => mockLogger)
    }));
    
    pipeline = new StreamingDataPipeline({
      maxConcurrentStreams: 10,
      enableGovernance: true,
      enableCompliance: true,
      enableAuditTrail: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Stream Management', () => {
    it('should create a stream with valid configuration', async () => {
      const streamDef = {
        name: 'test-stream',
        description: 'Test stream for unit testing',
        type: 'event-stream' as const,
        source: {
          type: 'kafka' as const,
          configuration: { bootstrap_servers: 'localhost:9092' },
          healthCheck: { enabled: true, interval: 30000, timeout: 5000, retries: 3 }
        },
        schema: {
          version: '1.0.0',
          format: 'json' as const,
          definition: { type: 'object', properties: { id: { type: 'string' } } },
          evolution: {
            strategy: 'backward' as const,
            versions: [],
            migrationRules: []
          },
          validation: {
            required: ['id'],
            formats: {},
            ranges: {},
            custom: []
          },
          compatibility: 'backward' as const
        },
        partitioning: {
          type: 'key-hash' as const,
          partitionCount: 3,
          partitionKey: 'id',
          rebalancing: { enabled: true, strategy: 'cooperative' as const, maxRebalanceTime: 30000 }
        },
        serialization: {
          type: 'json' as const,
          compression: 'gzip' as const,
          encryption: { enabled: false }
        },
        retentionPolicy: {
          type: 'time' as const,
          value: '7d',
          archival: { enabled: false, location: '', format: 'parquet' as const, compression: 'snappy' },
          deletion: { strategy: 'batch' as const, gdprCompliant: true }
        },
        governance: {
          classification: 'internal' as const,
          piiDetection: {
            enabled: true,
            fields: ['email', 'phone'],
            maskingStrategy: 'hash' as const
          },
          accessControl: {
            enabled: true,
            rbac: [{ role: 'admin', permissions: ['read', 'write'] as const }],
            abac: []
          },
          compliance: {
            frameworks: ['GDPR'],
            controls: ['data-encryption'],
            auditLevel: 'standard' as const
          },
          lineage: {
            tracking: true,
            upstreamSources: [],
            downstreamConsumers: []
          }
        },
        replication: {
          factor: 2,
          minInSync: 1,
          acks: 'all' as const,
          durability: 'at-least-once' as const
        }
      };

      const streamId = await pipeline.createStream(streamDef);
      
      expect(streamId).toBeDefined();
      expect(streamId).toMatch(/^stream-/);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stream created',
        expect.objectContaining({
          streamId,
          name: 'test-stream',
          type: 'event-stream'
        })
      );
    });

    it('should validate stream definition and reject invalid configuration', async () => {
      const invalidStreamDef = {
        name: 'invalid-stream',
        description: 'Invalid stream',
        type: 'event-stream' as const,
        source: {
          type: 'kafka' as const,
          configuration: {},
          healthCheck: { enabled: true, interval: 30000, timeout: 5000, retries: 3 }
        },
        schema: {
          version: '1.0.0',
          format: 'invalid-format' as any, // Invalid format
          definition: {},
          evolution: {
            strategy: 'backward' as const,
            versions: [],
            migrationRules: []
          },
          validation: {
            required: [],
            formats: {},
            ranges: {},
            custom: []
          },
          compatibility: 'backward' as const
        },
        partitioning: {
          type: 'key-hash' as const,
          partitionCount: 0, // Invalid partition count
          rebalancing: { enabled: true, strategy: 'cooperative' as const, maxRebalanceTime: 30000 }
        },
        serialization: {
          type: 'json' as const,
          compression: 'gzip' as const,
          encryption: { enabled: false }
        },
        retentionPolicy: {
          type: 'time' as const,
          value: '7d',
          archival: { enabled: false, location: '', format: 'parquet' as const, compression: 'snappy' },
          deletion: { strategy: 'batch' as const, gdprCompliant: true }
        },
        governance: {
          classification: 'internal' as const,
          piiDetection: { enabled: false, fields: [], maskingStrategy: 'hash' as const },
          accessControl: { enabled: false, rbac: [], abac: [] },
          compliance: { frameworks: [], controls: [], auditLevel: 'minimal' as const },
          lineage: { tracking: false, upstreamSources: [], downstreamConsumers: [] }
        },
        replication: {
          factor: 1,
          minInSync: 1,
          acks: 'all' as const,
          durability: 'at-least-once' as const
        }
      };

      await expect(pipeline.createStream(invalidStreamDef)).rejects.toThrow();
    });

    it('should start and stop streams correctly', async () => {
      const streamId = await pipeline.createStream(createValidStreamDef());
      
      await pipeline.startStream(streamId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stream started',
        expect.objectContaining({ streamId })
      );
      
      await pipeline.stopStream(streamId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stream stopped',
        expect.objectContaining({ streamId })
      );
    });

    it('should handle concurrent stream limit', async () => {
      const streamIds: string[] = [];
      
      // Create and start maximum number of streams
      for (let i = 0; i < 10; i++) {
        const streamDef = createValidStreamDef();
        streamDef.name = `test-stream-${i}`;
        const streamId = await pipeline.createStream(streamDef);
        await pipeline.startStream(streamId);
        streamIds.push(streamId);
      }
      
      // Try to start one more stream - should fail
      const extraStreamDef = createValidStreamDef();
      extraStreamDef.name = 'extra-stream';
      const extraStreamId = await pipeline.createStream(extraStreamDef);
      
      await expect(pipeline.startStream(extraStreamId)).rejects.toThrow(
        'Maximum concurrent streams limit reached'
      );
      
      // Clean up
      for (const streamId of streamIds) {
        await pipeline.stopStream(streamId);
      }
    });
  });

  describe('Stream Processing', () => {
    let streamId: string;

    beforeEach(async () => {
      streamId = await pipeline.createStream(createValidStreamDef());
      await pipeline.startStream(streamId);
    });

    afterEach(async () => {
      await pipeline.stopStream(streamId);
    });

    it('should create and start stream processors', async () => {
      const processorDef = {
        name: 'test-processor',
        type: 'filter' as const,
        inputStreams: [streamId],
        outputStream: streamId,
        processingLogic: {
          type: 'javascript' as const,
          code: 'return input.filter(x => x.id !== null);',
          resources: { cpu: '100m', memory: '256Mi', storage: '1Gi' }
        },
        stateManagement: {
          type: 'memory' as const,
          persistence: false,
          partitioning: false
        },
        errorHandling: {
          strategy: 'retry' as const,
          retryPolicy: {
            maxAttempts: 3,
            backoffStrategy: 'exponential' as const,
            baseDelay: 1000,
            maxDelay: 10000
          }
        },
        monitoring: {
          metrics: {
            throughput: true,
            latency: true,
            errorRate: true,
            backpressure: false,
            stateSize: false
          },
          alerts: [],
          sampling: { enabled: false, rate: 0.1, strategy: 'random' as const }
        },
        scaling: {
          enabled: true,
          minInstances: 1,
          maxInstances: 5,
          targetCpuUtilization: 70,
          targetThroughput: 1000,
          scaleUpCooldown: 60000,
          scaleDownCooldown: 120000,
          customMetrics: []
        }
      };

      const processorId = await pipeline.createProcessor(processorDef);
      expect(processorId).toBeDefined();
      expect(processorId).toMatch(/^processor-/);
      
      await pipeline.startProcessor(processorId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stream processor started',
        expect.objectContaining({ processorId })
      );
      
      await pipeline.stopProcessor(processorId);
    });

    it('should validate processor dependencies on input streams', async () => {
      const processorDef = {
        name: 'invalid-processor',
        type: 'transform' as const,
        inputStreams: ['non-existent-stream'],
        outputStream: streamId,
        processingLogic: {
          type: 'javascript' as const,
          code: 'return input;',
          resources: { cpu: '100m', memory: '256Mi', storage: '1Gi' }
        },
        stateManagement: {
          type: 'memory' as const,
          persistence: false,
          partitioning: false
        },
        errorHandling: {
          strategy: 'fail-fast' as const
        },
        monitoring: {
          metrics: {
            throughput: true,
            latency: true,
            errorRate: true,
            backpressure: false,
            stateSize: false
          },
          alerts: [],
          sampling: { enabled: false, rate: 0.1, strategy: 'random' as const }
        },
        scaling: {
          enabled: false,
          minInstances: 1,
          maxInstances: 1,
          targetCpuUtilization: 70,
          targetThroughput: 1000,
          scaleUpCooldown: 60000,
          scaleDownCooldown: 120000,
          customMetrics: []
        }
      };

      await expect(pipeline.createProcessor(processorDef)).rejects.toThrow(
        'Input stream non-existent-stream does not exist'
      );
    });

    it('should handle windowing configurations for aggregate processors', async () => {
      const aggregateProcessorDef = {
        name: 'aggregate-processor',
        type: 'aggregate' as const,
        inputStreams: [streamId],
        outputStream: streamId,
        processingLogic: {
          type: 'sql' as const,
          code: 'SELECT COUNT(*) FROM input WINDOW TUMBLING(INTERVAL 1 MINUTE)',
          resources: { cpu: '200m', memory: '512Mi', storage: '2Gi' }
        },
        windowing: {
          type: 'tumbling' as const,
          size: 60000, // 1 minute
          watermark: {
            strategy: 'bounded' as const,
            maxDelay: 5000
          }
        },
        stateManagement: {
          type: 'rocksdb' as const,
          persistence: true,
          backupInterval: 300000,
          partitioning: true,
          ttl: 3600000
        },
        errorHandling: {
          strategy: 'circuit-breaker' as const,
          circuitBreaker: {
            enabled: true,
            failureThreshold: 5,
            recoveryTimeout: 30000,
            halfOpenMaxCalls: 3
          }
        },
        monitoring: {
          metrics: {
            throughput: true,
            latency: true,
            errorRate: true,
            backpressure: true,
            stateSize: true
          },
          alerts: [{
            name: 'high-latency',
            condition: 'latency > 1000',
            severity: 'warning' as const,
            channels: ['email'],
            cooldown: 300000
          }],
          sampling: { enabled: true, rate: 0.05, strategy: 'systematic' as const }
        },
        scaling: {
          enabled: true,
          minInstances: 2,
          maxInstances: 10,
          targetCpuUtilization: 80,
          targetThroughput: 5000,
          scaleUpCooldown: 120000,
          scaleDownCooldown: 300000,
          customMetrics: ['window-lag', 'state-size']
        }
      };

      const processorId = await pipeline.createProcessor(aggregateProcessorDef);
      expect(processorId).toBeDefined();
      
      await pipeline.startProcessor(processorId);
      await pipeline.stopProcessor(processorId);
    });

    it('should enforce processor limits per stream', async () => {
      const processorIds: string[] = [];
      
      // Create maximum number of processors for the stream
      for (let i = 0; i < 10; i++) {
        const processorDef = createValidProcessorDef(streamId);
        processorDef.name = `processor-${i}`;
        const processorId = await pipeline.createProcessor(processorDef);
        processorIds.push(processorId);
      }
      
      // Try to create one more - should fail
      const extraProcessorDef = createValidProcessorDef(streamId);
      extraProcessorDef.name = 'extra-processor';
      
      await expect(pipeline.createProcessor(extraProcessorDef)).rejects.toThrow(
        'Maximum processors per stream limit reached'
      );
    });
  });

  describe('Change Data Capture (CDC)', () => {
    it('should create CDC configuration with valid settings', async () => {
      const cdcConfig = {
        name: 'test-cdc',
        sourceDatabase: {
          type: 'postgresql' as const,
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          credentials: { username: 'user', password: 'pass' },
          ssl: { enabled: false }
        },
        targetStreams: [],
        tables: [{
          tableName: 'users',
          primaryKey: ['id'],
          columns: ['id', 'name', 'email'],
          captureMode: 'all' as const,
          initialLoad: true
        }],
        filterRules: [{
          type: 'include' as const,
          pattern: 'users.*'
        }],
        transformations: [{
          field: 'email',
          operation: 'hash' as const,
          parameters: { algorithm: 'sha256' }
        }],
        metadata: {
          includeSchema: true,
          includeTimestamps: true,
          includeTransactionId: true,
          includeOperationType: true,
          customFields: { environment: 'test' }
        },
        performance: {
          batchSize: 1000,
          maxLatency: 5000,
          parallelism: 4,
          bufferSize: 10000,
          compressionEnabled: true
        },
        monitoring: {
          enabled: true,
          metrics: ['lag', 'throughput', 'errors'],
          alerts: [{
            name: 'high-lag',
            condition: 'lag > 10000',
            severity: 'warning' as const,
            channels: ['slack']
          }],
          lagThreshold: 5000,
          errorThreshold: 0.01
        }
      };

      const cdcId = await pipeline.createCDC(cdcConfig);
      expect(cdcId).toBeDefined();
      expect(cdcId).toMatch(/^cdc-/);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CDC configuration created',
        expect.objectContaining({ cdcId, name: 'test-cdc' })
      );
    });

    it('should validate CDC configuration', async () => {
      const invalidCdcConfig = {
        name: 'invalid-cdc',
        sourceDatabase: {
          type: 'postgresql' as const,
          host: '', // Invalid empty host
          port: 5432,
          database: '',
          credentials: { username: 'user', password: 'pass' },
          ssl: { enabled: false }
        },
        targetStreams: ['non-existent-stream'],
        tables: [], // No tables configured
        filterRules: [],
        transformations: [],
        metadata: {
          includeSchema: false,
          includeTimestamps: false,
          includeTransactionId: false,
          includeOperationType: false,
          customFields: {}
        },
        performance: {
          batchSize: 100,
          maxLatency: 1000,
          parallelism: 1,
          bufferSize: 1000,
          compressionEnabled: false
        },
        monitoring: {
          enabled: false,
          metrics: [],
          alerts: [],
          lagThreshold: 1000,
          errorThreshold: 0.1
        }
      };

      await expect(pipeline.createCDC(invalidCdcConfig)).rejects.toThrow();
    });

    it('should start CDC with proper initialization', async () => {
      const streamId = await pipeline.createStream(createValidStreamDef());
      
      const cdcConfig = {
        name: 'test-cdc',
        sourceDatabase: {
          type: 'postgresql' as const,
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          credentials: { username: 'user', password: 'pass' },
          ssl: { enabled: false }
        },
        targetStreams: [streamId],
        tables: [{
          tableName: 'orders',
          primaryKey: ['order_id'],
          columns: ['order_id', 'customer_id', 'amount'],
          captureMode: 'all' as const,
          initialLoad: false
        }],
        filterRules: [],
        transformations: [],
        metadata: {
          includeSchema: true,
          includeTimestamps: true,
          includeTransactionId: false,
          includeOperationType: true,
          customFields: {}
        },
        performance: {
          batchSize: 500,
          maxLatency: 2000,
          parallelism: 2,
          bufferSize: 5000,
          compressionEnabled: true
        },
        monitoring: {
          enabled: true,
          metrics: ['throughput'],
          alerts: [],
          lagThreshold: 3000,
          errorThreshold: 0.05
        }
      };

      const cdcId = await pipeline.createCDC(cdcConfig);
      await pipeline.startCDC(cdcId);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CDC started',
        expect.objectContaining({ cdcId, name: 'test-cdc' })
      );
    });
  });

  describe('Governance and Compliance', () => {
    it('should apply governance policies during stream creation', async () => {
      const streamDef = createValidStreamDef();
      streamDef.governance.piiDetection.enabled = true;
      streamDef.governance.accessControl.enabled = true;
      streamDef.governance.compliance.frameworks = ['GDPR', 'HIPAA'];

      const streamId = await pipeline.createStream(streamDef);
      expect(streamId).toBeDefined();
      
      // Verify governance setup was called
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Setting up PII detection',
        expect.objectContaining({ streamId })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Setting up access controls',
        expect.objectContaining({ streamId })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Setting up compliance monitoring',
        expect.objectContaining({ streamId })
      );
    });

    it('should handle audit trail when enabled', async () => {
      const streamDef = createValidStreamDef();
      const streamId = await pipeline.createStream(streamDef);
      
      // Check that audit events are emitted
      const auditEventPromise = new Promise(resolve => {
        pipeline.once('audit:logged', resolve);
      });
      
      await pipeline.startStream(streamId);
      
      const auditEvent = await auditEventPromise;
      expect(auditEvent).toMatchObject({
        action: 'stream_started',
        data: { streamId }
      });
    });
  });

  describe('Performance Monitoring', () => {
    let streamId: string;

    beforeEach(async () => {
      streamId = await pipeline.createStream(createValidStreamDef());
      await pipeline.startStream(streamId);
    });

    afterEach(async () => {
      await pipeline.stopStream(streamId);
    });

    it('should collect and provide stream metrics', async () => {
      const metrics = pipeline.getStreamMetrics(streamId);
      
      expect(metrics).toMatchObject({
        messagesProcessed: expect.any(Number),
        bytesProcessed: expect.any(Number),
        errorCount: expect.any(Number),
        latency: {
          p50: expect.any(Number),
          p95: expect.any(Number),
          p99: expect.any(Number)
        },
        throughput: expect.any(Number),
        backpressureEvents: expect.any(Number),
        lastUpdate: expect.any(Date)
      });
    });

    it('should provide pipeline health status', async () => {
      const healthStatus = pipeline.getHealthStatus();
      
      expect(healthStatus).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded|critical)$/),
        streams: {
          total: expect.any(Number),
          active: expect.any(Number),
          stopped: expect.any(Number)
        },
        processors: {
          total: expect.any(Number),
          active: expect.any(Number),
          stopped: expect.any(Number)
        },
        performance: {
          errorRate: expect.any(Number),
          avgLatency: expect.any(Number),
          totalThroughput: expect.any(Number)
        },
        lastUpdate: expect.any(Date)
      });
    });

    it('should detect and handle backpressure', async () => {
      // Mock backpressure condition
      const metrics = pipeline.getStreamMetrics(streamId);
      if (typeof metrics === 'object' && 'backpressureEvents' in metrics) {
        (metrics as any).backpressureEvents = 10;
      }
      
      const backpressureEventPromise = new Promise(resolve => {
        pipeline.once('backpressure:detected', resolve);
      });
      
      // Trigger metrics collection (normally done by background process)
      (pipeline as any).checkBackpressure();
      
      const backpressureEvent = await backpressureEventPromise;
      expect(backpressureEvent).toMatchObject({
        streamId: expect.any(String)
      });
    });

    it('should detect and handle anomalies', async () => {
      // Mock anomaly condition
      const metrics = pipeline.getStreamMetrics(streamId);
      if (typeof metrics === 'object' && 'errorCount' in metrics) {
        (metrics as any).errorCount = 150; // High error count
        (metrics as any).latency.p99 = 6000; // High latency
      }
      
      const anomalyEventPromise = new Promise(resolve => {
        pipeline.once('anomaly:detected', resolve);
      });
      
      // Trigger anomaly detection
      (pipeline as any).detectAnomalies();
      
      const anomalyEvent = await anomalyEventPromise;
      expect(anomalyEvent).toMatchObject({
        streamId: expect.any(String),
        metrics: expect.any(Object)
      });
    });
  });

  describe('Error Handling and Fault Tolerance', () => {
    it('should handle stream creation failures gracefully', async () => {
      const invalidStreamDef = createValidStreamDef();
      invalidStreamDef.schema.format = 'invalid' as any;

      await expect(pipeline.createStream(invalidStreamDef)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle processor failures with circuit breaker', async () => {
      const streamId = await pipeline.createStream(createValidStreamDef());
      await pipeline.startStream(streamId);
      
      const processorDef = createValidProcessorDef(streamId);
      processorDef.errorHandling = {
        strategy: 'circuit-breaker' as const,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          recoveryTimeout: 5000,
          halfOpenMaxCalls: 1
        }
      };
      
      const processorId = await pipeline.createProcessor(processorDef);
      await pipeline.startProcessor(processorId);
      
      // Processor should be running with circuit breaker protection
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stream processor started',
        expect.objectContaining({ processorId })
      );
      
      await pipeline.stopProcessor(processorId);
      await pipeline.stopStream(streamId);
    });

    it('should handle CDC connection failures', async () => {
      const cdcConfig = {
        name: 'failing-cdc',
        sourceDatabase: {
          type: 'postgresql' as const,
          host: 'nonexistent-host',
          port: 5432,
          database: 'testdb',
          credentials: { username: 'user', password: 'pass' },
          ssl: { enabled: false }
        },
        targetStreams: [],
        tables: [{
          tableName: 'test_table',
          primaryKey: ['id'],
          columns: ['id'],
          captureMode: 'all' as const,
          initialLoad: false
        }],
        filterRules: [],
        transformations: [],
        metadata: {
          includeSchema: false,
          includeTimestamps: false,
          includeTransactionId: false,
          includeOperationType: false,
          customFields: {}
        },
        performance: {
          batchSize: 100,
          maxLatency: 1000,
          parallelism: 1,
          bufferSize: 1000,
          compressionEnabled: false
        },
        monitoring: {
          enabled: false,
          metrics: [],
          alerts: [],
          lagThreshold: 1000,
          errorThreshold: 0.1
        }
      };

      const cdcId = await pipeline.createCDC(cdcConfig);
      
      // Starting CDC with invalid connection should fail gracefully
      await expect(pipeline.startCDC(cdcId)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to start CDC',
        expect.objectContaining({ cdcId })
      );
    });
  });

  describe('Initialization and Cleanup', () => {
    it('should initialize pipeline successfully', async () => {
      await pipeline.initialize();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Streaming data pipeline initialized successfully'
      );
    });

    it('should handle initialization failures', async () => {
      // Mock a failure in initialization
      const failingPipeline = new StreamingDataPipeline({
        enableAuditTrail: true
      });
      
      // Mock a method to fail during initialization
      const originalInitializeAuditTrail = (failingPipeline as any).initializeAuditTrail;
      (failingPipeline as any).initializeAuditTrail = jest.fn().mockRejectedValue(new Error('Audit initialization failed'));
      
      await expect(failingPipeline.initialize()).rejects.toThrow('Audit initialization failed');
    });
  });
});

// ===== HELPER FUNCTIONS =====

function createValidStreamDef() {
  return {
    name: 'test-stream',
    description: 'Test stream for unit testing',
    type: 'event-stream' as const,
    source: {
      type: 'kafka' as const,
      configuration: { bootstrap_servers: 'localhost:9092' },
      healthCheck: { enabled: true, interval: 30000, timeout: 5000, retries: 3 }
    },
    schema: {
      version: '1.0.0',
      format: 'json' as const,
      definition: { type: 'object', properties: { id: { type: 'string' } } },
      evolution: {
        strategy: 'backward' as const,
        versions: [],
        migrationRules: []
      },
      validation: {
        required: ['id'],
        formats: {},
        ranges: {},
        custom: []
      },
      compatibility: 'backward' as const
    },
    partitioning: {
      type: 'key-hash' as const,
      partitionCount: 3,
      rebalancing: { enabled: true, strategy: 'cooperative' as const, maxRebalanceTime: 30000 }
    },
    serialization: {
      type: 'json' as const,
      compression: 'none' as const,
      encryption: { enabled: false }
    },
    retentionPolicy: {
      type: 'time' as const,
      value: '7d',
      archival: { enabled: false, location: '', format: 'parquet' as const, compression: 'snappy' },
      deletion: { strategy: 'batch' as const, gdprCompliant: true }
    },
    governance: {
      classification: 'internal' as const,
      piiDetection: { enabled: false, fields: [], maskingStrategy: 'hash' as const },
      accessControl: { enabled: false, rbac: [], abac: [] },
      compliance: { frameworks: [], controls: [], auditLevel: 'minimal' as const },
      lineage: { tracking: false, upstreamSources: [], downstreamConsumers: [] }
    },
    replication: {
      factor: 1,
      minInSync: 1,
      acks: 'all' as const,
      durability: 'at-least-once' as const
    }
  };
}

function createValidProcessorDef(streamId: string) {
  return {
    name: 'test-processor',
    type: 'filter' as const,
    inputStreams: [streamId],
    outputStream: streamId,
    processingLogic: {
      type: 'javascript' as const,
      code: 'return input;',
      resources: { cpu: '100m', memory: '256Mi', storage: '1Gi' }
    },
    stateManagement: {
      type: 'memory' as const,
      persistence: false,
      partitioning: false
    },
    errorHandling: {
      strategy: 'retry' as const,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential' as const,
        baseDelay: 1000,
        maxDelay: 10000
      }
    },
    monitoring: {
      metrics: {
        throughput: true,
        latency: true,
        errorRate: true,
        backpressure: false,
        stateSize: false
      },
      alerts: [],
      sampling: { enabled: false, rate: 0.1, strategy: 'random' as const }
    },
    scaling: {
      enabled: false,
      minInstances: 1,
      maxInstances: 1,
      targetCpuUtilization: 70,
      targetThroughput: 1000,
      scaleUpCooldown: 60000,
      scaleDownCooldown: 120000,
      customMetrics: []
    }
  };
} 