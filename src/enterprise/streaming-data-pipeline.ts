/**
 * Enterprise Streaming Data Pipeline
 * 
 * Real-time streaming capabilities and advanced governance features including:
 * - Event-driven streaming with CDC and event sourcing
 * - Real-time analytics and aggregation engines
 * - Stream processing with windowing and watermarks
 * - Schema evolution and data governance
 * - Backpressure management and circuit breakers
 * - Multi-tenant streaming with resource isolation
 * - Compliance and audit trails for streaming data
 */

import { EventEmitter } from 'node:events';
import { Logger } from '../core/logger.js';
import { generateId } from '../utils/helpers.js';

// ===== STREAMING TYPES =====

export interface StreamDefinition {
  id: string;
  name: string;
  description: string;
  type: 'event-stream' | 'data-stream' | 'cdc-stream' | 'metrics-stream' | 'audit-stream';
  source: StreamSource;
  schema: StreamSchema;
  partitioning: PartitioningStrategy;
  serialization: SerializationFormat;
  retentionPolicy: RetentionPolicy;
  governance: StreamGovernance;
  replication: ReplicationConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamSource {
  type: 'kafka' | 'kinesis' | 'pubsub' | 'eventhub' | 'nats' | 'redis' | 'database' | 'webhook';
  configuration: Record<string, any>;
  connectionString?: string;
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    keyFile?: string;
  };
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retries: number;
  };
}

export interface StreamSchema {
  version: string;
  format: 'avro' | 'json' | 'protobuf' | 'parquet';
  definition: Record<string, any>;
  evolution: SchemaEvolution;
  validation: ValidationRules;
  compatibility: 'backward' | 'forward' | 'full' | 'none';
}

export interface SchemaEvolution {
  strategy: 'strict' | 'backward' | 'forward' | 'auto';
  versions: SchemaVersion[];
  migrationRules: SchemaMigrationRule[];
}

export interface SchemaVersion {
  version: string;
  schema: Record<string, any>;
  createdAt: Date;
  deprecated: boolean;
  breakingChanges: boolean;
}

export interface SchemaMigrationRule {
  fromVersion: string;
  toVersion: string;
  transformations: DataTransformation[];
  rollbackStrategy: 'revert' | 'forward-fix' | 'manual';
}

export interface DataTransformation {
  field: string;
  operation: 'rename' | 'convert' | 'split' | 'merge' | 'calculate' | 'filter' | 'enrich';
  parameters: Record<string, any>;
  condition?: string;
}

export interface PartitioningStrategy {
  type: 'key-hash' | 'round-robin' | 'random' | 'field-value' | 'time-based' | 'custom';
  partitionCount: number;
  partitionKey?: string;
  customPartitioner?: string;
  rebalancing: {
    enabled: boolean;
    strategy: 'eager' | 'cooperative';
    maxRebalanceTime: number;
  };
}

export interface SerializationFormat {
  type: 'json' | 'avro' | 'protobuf' | 'msgpack' | 'binary';
  compression: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
  encryption: {
    enabled: boolean;
    algorithm?: 'aes-256' | 'chacha20';
    keyRotation?: boolean;
  };
}

export interface RetentionPolicy {
  type: 'time' | 'size' | 'count' | 'custom';
  value: number | string;
  archival: {
    enabled: boolean;
    location: string;
    format: 'parquet' | 'orc' | 'delta';
    compression: string;
  };
  deletion: {
    strategy: 'immediate' | 'batch' | 'scheduled';
    gdprCompliant: boolean;
  };
}

export interface StreamGovernance {
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  piiDetection: {
    enabled: boolean;
    fields: string[];
    maskingStrategy: 'hash' | 'tokenize' | 'redact' | 'encrypt';
  };
  accessControl: {
    enabled: boolean;
    rbac: RoleBasedAccess[];
    abac: AttributeBasedAccess[];
  };
  compliance: {
    frameworks: string[];
    controls: string[];
    auditLevel: 'minimal' | 'standard' | 'comprehensive';
  };
  lineage: {
    tracking: boolean;
    upstreamSources: string[];
    downstreamConsumers: string[];
  };
}

export interface RoleBasedAccess {
  role: string;
  permissions: ('read' | 'write' | 'admin' | 'delete')[];
  conditions?: string[];
}

export interface AttributeBasedAccess {
  subject: string;
  action: string;
  resource: string;
  conditions: Record<string, any>;
}

export interface ReplicationConfig {
  factor: number;
  minInSync: number;
  acks: 'none' | 'leader' | 'all';
  durability: 'at-most-once' | 'at-least-once' | 'exactly-once';
}

// ===== STREAM PROCESSING =====

export interface StreamProcessor {
  id: string;
  name: string;
  type: 'filter' | 'transform' | 'aggregate' | 'join' | 'window' | 'enrichment' | 'ml-inference';
  inputStreams: string[];
  outputStream: string;
  processingLogic: ProcessingLogic;
  windowing?: WindowingConfig;
  stateManagement: StateConfig;
  errorHandling: ErrorHandlingConfig;
  monitoring: ProcessorMonitoring;
  scaling: AutoScalingConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingLogic {
  type: 'sql' | 'javascript' | 'python' | 'scala' | 'java' | 'custom';
  code: string;
  dependencies?: string[];
  resources: {
    cpu: string;
    memory: string;
    storage: string;
  };
}

export interface WindowingConfig {
  type: 'tumbling' | 'sliding' | 'session' | 'global';
  size: number | string;
  advance?: number | string;
  sessionTimeout?: number;
  watermark: {
    strategy: 'bounded' | 'unbounded' | 'periodic';
    maxDelay: number;
    periodicInterval?: number;
  };
}

export interface StateConfig {
  type: 'memory' | 'rocksdb' | 'redis' | 'cassandra' | 'custom';
  persistence: boolean;
  backupInterval?: number;
  partitioning: boolean;
  ttl?: number;
}

export interface ErrorHandlingConfig {
  strategy: 'fail-fast' | 'retry' | 'dead-letter' | 'skip' | 'circuit-breaker';
  retryPolicy?: {
    maxAttempts: number;
    backoffStrategy: 'fixed' | 'exponential' | 'linear';
    baseDelay: number;
    maxDelay: number;
  };
  deadLetterQueue?: {
    enabled: boolean;
    topic: string;
    maxSize: number;
  };
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
  };
}

export interface ProcessorMonitoring {
  metrics: {
    throughput: boolean;
    latency: boolean;
    errorRate: boolean;
    backpressure: boolean;
    stateSize: boolean;
  };
  alerts: ProcessorAlert[];
  sampling: {
    enabled: boolean;
    rate: number;
    strategy: 'random' | 'systematic' | 'stratified';
  };
}

export interface ProcessorAlert {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  channels: string[];
  cooldown: number;
}

export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCpuUtilization: number;
  targetThroughput: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  customMetrics: string[];
}

// ===== STREAM ANALYTICS =====

export interface StreamAnalytics {
  id: string;
  name: string;
  streams: string[];
  queries: AnalyticsQuery[];
  materializedViews: MaterializedView[];
  alerts: AnalyticsAlert[];
  dashboards: AnalyticsDashboard[];
  exportTargets: ExportTarget[];
  schedule: AnalyticsSchedule;
}

export interface AnalyticsQuery {
  id: string;
  name: string;
  sql: string;
  type: 'continuous' | 'batch' | 'hybrid';
  windowSize?: string;
  outputFormat: 'json' | 'avro' | 'parquet';
  optimization: {
    indexing: boolean;
    caching: boolean;
    parallelization: number;
  };
}

export interface MaterializedView {
  id: string;
  name: string;
  sourceQuery: string;
  refreshStrategy: 'real-time' | 'incremental' | 'full-refresh';
  refreshInterval?: number;
  storage: 'memory' | 'ssd' | 'object-store';
  indexing: IndexConfig[];
}

export interface IndexConfig {
  columns: string[];
  type: 'btree' | 'hash' | 'bitmap' | 'gin' | 'gist';
  unique: boolean;
  partial?: string;
}

export interface AnalyticsAlert {
  id: string;
  name: string;
  query: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  frequency: 'real-time' | 'periodic';
  interval?: number;
  channels: string[];
  escalation: EscalationRule[];
}

export interface EscalationRule {
  level: number;
  delay: number;
  channels: string[];
  condition?: string;
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  refreshInterval: number;
  accessControl: string[];
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'chart' | 'table' | 'metric' | 'alert' | 'map';
  query: string;
  visualization: VisualizationConfig;
  position: WidgetPosition;
}

export interface VisualizationConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter';
  options: Record<string, any>;
  colors?: string[];
  thresholds?: number[];
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DashboardLayout {
  type: 'grid' | 'flexible';
  columns?: number;
  rowHeight?: number;
  responsive: boolean;
}

export interface ExportTarget {
  id: string;
  name: string;
  type: 'database' | 'file' | 'api' | 'warehouse' | 'lake';
  connection: Record<string, any>;
  format: 'json' | 'csv' | 'parquet' | 'avro';
  schedule: string;
  transformation?: string;
}

export interface AnalyticsSchedule {
  enabled: boolean;
  cron: string;
  timezone: string;
  maxRuntime: number;
  retryPolicy: {
    enabled: boolean;
    maxRetries: number;
    backoffStrategy: string;
  };
}

// ===== CHANGE DATA CAPTURE =====

export interface CDCConfiguration {
  id: string;
  name: string;
  sourceDatabase: DatabaseConnection;
  targetStreams: string[];
  tables: CDCTableConfig[];
  filterRules: CDCFilterRule[];
  transformations: CDCTransformation[];
  metadata: CDCMetadata;
  performance: CDCPerformance;
  monitoring: CDCMonitoring;
}

export interface DatabaseConnection {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'cassandra' | 'oracle' | 'sqlserver';
  host: string;
  port: number;
  database: string;
  credentials: {
    username: string;
    password: string;
  };
  ssl: {
    enabled: boolean;
    cert?: string;
    key?: string;
    ca?: string;
  };
}

export interface CDCTableConfig {
  tableName: string;
  primaryKey: string[];
  columns: string[];
  captureMode: 'insert' | 'update' | 'delete' | 'all';
  initialLoad: boolean;
  partitioning?: string;
}

export interface CDCFilterRule {
  type: 'include' | 'exclude';
  pattern: string;
  condition?: string;
}

export interface CDCTransformation {
  field: string;
  operation: 'mask' | 'hash' | 'encrypt' | 'tokenize' | 'format' | 'enrich';
  parameters: Record<string, any>;
}

export interface CDCMetadata {
  includeSchema: boolean;
  includeTimestamps: boolean;
  includeTransactionId: boolean;
  includeOperationType: boolean;
  customFields: Record<string, string>;
}

export interface CDCPerformance {
  batchSize: number;
  maxLatency: number;
  parallelism: number;
  bufferSize: number;
  compressionEnabled: boolean;
}

export interface CDCMonitoring {
  enabled: boolean;
  metrics: string[];
  alerts: CDCAlert[];
  lagThreshold: number;
  errorThreshold: number;
}

export interface CDCAlert {
  name: string;
  condition: string;
  severity: 'warning' | 'critical';
  channels: string[];
}

// ===== MAIN STREAMING PIPELINE CLASS =====

export class StreamingDataPipeline extends EventEmitter {
  private logger: Logger;
  
  // Stream management
  private streams: Map<string, StreamDefinition> = new Map();
  private processors: Map<string, StreamProcessor> = new Map();
  private analytics: Map<string, StreamAnalytics> = new Map();
  private cdcConfigs: Map<string, CDCConfiguration> = new Map();
  
  // Runtime state
  private activeStreams: Set<string> = new Set();
  private activeProcessors: Map<string, any> = new Map();
  private streamMetrics: Map<string, StreamMetrics> = new Map();
  
  // Governance and compliance
  private auditTrail: StreamAuditEntry[] = [];
  private complianceMonitor?: NodeJS.Timeout;
  
  // Configuration
  private config: StreamingPipelineConfig;

  constructor(config: Partial<StreamingPipelineConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentStreams: 100,
      maxProcessorsPerStream: 10,
      defaultRetentionDays: 7,
      enableGovernance: true,
      enableCompliance: true,
      enableAuditTrail: true,
      monitoringInterval: 30000,
      healthCheckInterval: 60000,
      metricsPersistenceInterval: 300000,
      backpressureThreshold: 0.8,
      circuitBreakerThreshold: 0.1,
      ...config
    };
    
    this.logger = new Logger('StreamingDataPipeline');
    this.logger.info('Enterprise Streaming Data Pipeline initialized', { config: this.config });
  }

  /**
   * Initialize the streaming pipeline
   */
  async initialize(): Promise<void> {
    try {
      // Start monitoring processes
      this.startMonitoring();
      this.startComplianceMonitoring();
      this.startHealthChecks();
      
      // Initialize audit trail
      if (this.config.enableAuditTrail) {
        await this.initializeAuditTrail();
      }
      
      this.logger.info('Streaming data pipeline initialized successfully');
      this.emit('pipeline:initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize streaming pipeline', { error });
      throw error;
    }
  }

  /**
   * Create a new stream definition
   */
  async createStream(streamDef: Omit<StreamDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const streamId = generateId('stream');
    
    const stream: StreamDefinition = {
      id: streamId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...streamDef
    };
    
    // Validate stream definition
    await this.validateStreamDefinition(stream);
    
    // Apply governance policies
    if (this.config.enableGovernance) {
      await this.applyGovernancePolicies(stream);
    }
    
    this.streams.set(streamId, stream);
    
    // Initialize stream metrics
    this.streamMetrics.set(streamId, {
      messagesProcessed: 0,
      bytesProcessed: 0,
      errorCount: 0,
      latency: { p50: 0, p95: 0, p99: 0 },
      throughput: 0,
      backpressureEvents: 0,
      lastUpdate: new Date()
    });
    
    this.logger.info('Stream created', { streamId, name: stream.name, type: stream.type });
    this.auditLog('stream_created', { streamId, stream });
    this.emit('stream:created', { streamId, stream });
    
    return streamId;
  }

  /**
   * Start a stream
   */
  async startStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    if (this.activeStreams.has(streamId)) {
      throw new Error(`Stream ${streamId} is already active`);
    }
    
    if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
      throw new Error('Maximum concurrent streams limit reached');
    }
    
    try {
      // Initialize stream connection
      await this.initializeStreamConnection(stream);
      
      // Start stream processors
      const streamProcessors = Array.from(this.processors.values())
        .filter(p => p.inputStreams.includes(streamId));
        
      for (const processor of streamProcessors) {
        await this.startProcessor(processor.id);
      }
      
      this.activeStreams.add(streamId);
      
      this.logger.info('Stream started', { streamId, name: stream.name });
      this.auditLog('stream_started', { streamId });
      this.emit('stream:started', { streamId, stream });
      
    } catch (error) {
      this.logger.error('Failed to start stream', { streamId, error });
      this.auditLog('stream_start_failed', { streamId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Stop a stream
   */
  async stopStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    if (!this.activeStreams.has(streamId)) {
      throw new Error(`Stream ${streamId} is not active`);
    }
    
    try {
      // Stop associated processors
      const streamProcessors = Array.from(this.processors.values())
        .filter(p => p.inputStreams.includes(streamId));
        
      for (const processor of streamProcessors) {
        await this.stopProcessor(processor.id);
      }
      
      // Close stream connection
      await this.closeStreamConnection(stream);
      
      this.activeStreams.delete(streamId);
      
      this.logger.info('Stream stopped', { streamId, name: stream.name });
      this.auditLog('stream_stopped', { streamId });
      this.emit('stream:stopped', { streamId, stream });
      
    } catch (error) {
      this.logger.error('Failed to stop stream', { streamId, error });
      this.auditLog('stream_stop_failed', { streamId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create a stream processor
   */
  async createProcessor(processorDef: Omit<StreamProcessor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const processorId = generateId('processor');
    
    const processor: StreamProcessor = {
      id: processorId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...processorDef
    };
    
    // Validate processor definition
    await this.validateProcessorDefinition(processor);
    
    // Check stream limits
    const streamProcessorCount = Array.from(this.processors.values())
      .filter(p => p.inputStreams.some(s => processor.inputStreams.includes(s))).length;
      
    if (streamProcessorCount >= this.config.maxProcessorsPerStream) {
      throw new Error('Maximum processors per stream limit reached');
    }
    
    this.processors.set(processorId, processor);
    
    this.logger.info('Stream processor created', { 
      processorId, 
      name: processor.name, 
      type: processor.type 
    });
    this.auditLog('processor_created', { processorId, processor });
    this.emit('processor:created', { processorId, processor });
    
    return processorId;
  }

  /**
   * Start a stream processor
   */
  async startProcessor(processorId: string): Promise<void> {
    const processor = this.processors.get(processorId);
    if (!processor) {
      throw new Error(`Processor ${processorId} not found`);
    }
    
    if (this.activeProcessors.has(processorId)) {
      throw new Error(`Processor ${processorId} is already active`);
    }
    
    try {
      // Validate input streams are active
      for (const streamId of processor.inputStreams) {
        if (!this.activeStreams.has(streamId)) {
          throw new Error(`Input stream ${streamId} is not active`);
        }
      }
      
      // Initialize processor runtime
      const runtime = await this.initializeProcessorRuntime(processor);
      this.activeProcessors.set(processorId, runtime);
      
      this.logger.info('Stream processor started', { processorId, name: processor.name });
      this.auditLog('processor_started', { processorId });
      this.emit('processor:started', { processorId, processor });
      
    } catch (error) {
      this.logger.error('Failed to start processor', { processorId, error });
      this.auditLog('processor_start_failed', { processorId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Stop a stream processor
   */
  async stopProcessor(processorId: string): Promise<void> {
    const processor = this.processors.get(processorId);
    if (!processor) {
      throw new Error(`Processor ${processorId} not found`);
    }
    
    const runtime = this.activeProcessors.get(processorId);
    if (!runtime) {
      throw new Error(`Processor ${processorId} is not active`);
    }
    
    try {
      // Gracefully shutdown processor
      await this.shutdownProcessorRuntime(runtime);
      this.activeProcessors.delete(processorId);
      
      this.logger.info('Stream processor stopped', { processorId, name: processor.name });
      this.auditLog('processor_stopped', { processorId });
      this.emit('processor:stopped', { processorId, processor });
      
    } catch (error) {
      this.logger.error('Failed to stop processor', { processorId, error });
      this.auditLog('processor_stop_failed', { processorId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create Change Data Capture configuration
   */
  async createCDC(cdcConfig: Omit<CDCConfiguration, 'id'>): Promise<string> {
    const cdcId = generateId('cdc');
    
    const config: CDCConfiguration = {
      id: cdcId,
      ...cdcConfig
    };
    
    // Validate CDC configuration
    await this.validateCDCConfiguration(config);
    
    this.cdcConfigs.set(cdcId, config);
    
    this.logger.info('CDC configuration created', { cdcId, name: config.name });
    this.auditLog('cdc_created', { cdcId, config });
    this.emit('cdc:created', { cdcId, config });
    
    return cdcId;
  }

  /**
   * Start Change Data Capture
   */
  async startCDC(cdcId: string): Promise<void> {
    const config = this.cdcConfigs.get(cdcId);
    if (!config) {
      throw new Error(`CDC configuration ${cdcId} not found`);
    }
    
    try {
      // Initialize CDC connector
      await this.initializeCDCConnector(config);
      
      this.logger.info('CDC started', { cdcId, name: config.name });
      this.auditLog('cdc_started', { cdcId });
      this.emit('cdc:started', { cdcId, config });
      
    } catch (error) {
      this.logger.error('Failed to start CDC', { cdcId, error });
      this.auditLog('cdc_start_failed', { cdcId, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get stream metrics
   */
  getStreamMetrics(streamId?: string): StreamMetrics | Map<string, StreamMetrics> {
    if (streamId) {
      const metrics = this.streamMetrics.get(streamId);
      if (!metrics) {
        throw new Error(`Metrics for stream ${streamId} not found`);
      }
      return metrics;
    }
    return this.streamMetrics;
  }

  /**
   * Get pipeline health status
   */
  getHealthStatus(): PipelineHealthStatus {
    const totalStreams = this.streams.size;
    const activeStreams = this.activeStreams.size;
    const totalProcessors = this.processors.size;
    const activeProcessors = this.activeProcessors.size;
    
    const errorRate = this.calculateErrorRate();
    const avgLatency = this.calculateAvgLatency();
    const totalThroughput = this.calculateTotalThroughput();
    
    const health = errorRate < this.config.circuitBreakerThreshold ? 'healthy' : 'degraded';
    
    return {
      status: health,
      streams: {
        total: totalStreams,
        active: activeStreams,
        stopped: totalStreams - activeStreams
      },
      processors: {
        total: totalProcessors,
        active: activeProcessors,
        stopped: totalProcessors - activeProcessors
      },
      performance: {
        errorRate,
        avgLatency,
        totalThroughput
      },
      lastUpdate: new Date()
    };
  }

  // ===== PRIVATE METHODS =====

  private async validateStreamDefinition(stream: StreamDefinition): Promise<void> {
    // Validate schema format
    if (!['avro', 'json', 'protobuf', 'parquet'].includes(stream.schema.format)) {
      throw new Error(`Unsupported schema format: ${stream.schema.format}`);
    }
    
    // Validate partitioning
    if (stream.partitioning.partitionCount <= 0) {
      throw new Error('Partition count must be greater than 0');
    }
    
    // Validate retention policy
    if (stream.retentionPolicy.type === 'time' && typeof stream.retentionPolicy.value !== 'string') {
      throw new Error('Time-based retention policy requires string value');
    }
  }

  private async validateProcessorDefinition(processor: StreamProcessor): Promise<void> {
    // Validate input streams exist
    for (const streamId of processor.inputStreams) {
      if (!this.streams.has(streamId)) {
        throw new Error(`Input stream ${streamId} does not exist`);
      }
    }
    
    // Validate processing logic
    if (!processor.processingLogic.code) {
      throw new Error('Processing logic code is required');
    }
    
    // Validate windowing configuration for applicable processors
    if (['aggregate', 'join'].includes(processor.type) && !processor.windowing) {
      throw new Error(`Windowing configuration required for ${processor.type} processor`);
    }
  }

  private async validateCDCConfiguration(config: CDCConfiguration): Promise<void> {
    // Validate database connection
    if (!config.sourceDatabase.host || !config.sourceDatabase.database) {
      throw new Error('Database host and name are required');
    }
    
    // Validate target streams exist
    for (const streamId of config.targetStreams) {
      if (!this.streams.has(streamId)) {
        throw new Error(`Target stream ${streamId} does not exist`);
      }
    }
    
    // Validate table configurations
    if (config.tables.length === 0) {
      throw new Error('At least one table configuration is required');
    }
  }

  private async applyGovernancePolicies(stream: StreamDefinition): Promise<void> {
    // Apply PII detection and masking
    if (stream.governance.piiDetection.enabled) {
      await this.setupPIIDetection(stream);
    }
    
    // Apply access controls
    if (stream.governance.accessControl.enabled) {
      await this.setupAccessControls(stream);
    }
    
    // Setup compliance monitoring
    if (stream.governance.compliance.frameworks.length > 0) {
      await this.setupComplianceMonitoring(stream);
    }
  }

  private async setupPIIDetection(stream: StreamDefinition): Promise<void> {
    // Implementation for PII detection setup
    this.logger.debug('Setting up PII detection', { streamId: stream.id });
  }

  private async setupAccessControls(stream: StreamDefinition): Promise<void> {
    // Implementation for access control setup
    this.logger.debug('Setting up access controls', { streamId: stream.id });
  }

  private async setupComplianceMonitoring(stream: StreamDefinition): Promise<void> {
    // Implementation for compliance monitoring setup
    this.logger.debug('Setting up compliance monitoring', { streamId: stream.id });
  }

  private async initializeStreamConnection(stream: StreamDefinition): Promise<void> {
    // Implementation for stream connection initialization
    this.logger.debug('Initializing stream connection', { streamId: stream.id, type: stream.source.type });
  }

  private async closeStreamConnection(stream: StreamDefinition): Promise<void> {
    // Implementation for stream connection cleanup
    this.logger.debug('Closing stream connection', { streamId: stream.id });
  }

  private async initializeProcessorRuntime(processor: StreamProcessor): Promise<any> {
    // Implementation for processor runtime initialization
    this.logger.debug('Initializing processor runtime', { processorId: processor.id, type: processor.type });
    return {}; // Placeholder runtime object
  }

  private async shutdownProcessorRuntime(runtime: any): Promise<void> {
    // Implementation for processor runtime shutdown
    this.logger.debug('Shutting down processor runtime');
  }

  private async initializeCDCConnector(config: CDCConfiguration): Promise<void> {
    // Implementation for CDC connector initialization
    this.logger.debug('Initializing CDC connector', { cdcId: config.id, database: config.sourceDatabase.type });
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.collectMetrics();
      this.checkBackpressure();
      this.detectAnomalies();
    }, this.config.monitoringInterval);
  }

  private startComplianceMonitoring(): void {
    if (!this.config.enableCompliance) return;
    
    this.complianceMonitor = setInterval(() => {
      this.performComplianceChecks();
    }, this.config.monitoringInterval * 2);
  }

  private startHealthChecks(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async initializeAuditTrail(): Promise<void> {
    this.auditLog('pipeline_initialized', {});
  }

  private collectMetrics(): void {
    // Implementation for metrics collection
    for (const [streamId, metrics] of this.streamMetrics) {
      metrics.lastUpdate = new Date();
      this.emit('metrics:collected', { streamId, metrics });
    }
  }

  private checkBackpressure(): void {
    // Implementation for backpressure detection
    for (const streamId of this.activeStreams) {
      const metrics = this.streamMetrics.get(streamId);
      if (metrics && this.isBackpressureDetected(metrics)) {
        this.handleBackpressure(streamId);
      }
    }
  }

  private isBackpressureDetected(metrics: StreamMetrics): boolean {
    // Simple backpressure detection logic
    return metrics.backpressureEvents > 0;
  }

  private handleBackpressure(streamId: string): void {
    this.logger.warn('Backpressure detected', { streamId });
    this.emit('backpressure:detected', { streamId });
  }

  private detectAnomalies(): void {
    // Implementation for anomaly detection
    for (const [streamId, metrics] of this.streamMetrics) {
      if (this.isAnomalyDetected(metrics)) {
        this.handleAnomaly(streamId, metrics);
      }
    }
  }

  private isAnomalyDetected(metrics: StreamMetrics): boolean {
    // Simple anomaly detection logic
    return metrics.errorCount > 100 || metrics.latency.p99 > 5000;
  }

  private handleAnomaly(streamId: string, metrics: StreamMetrics): void {
    this.logger.warn('Anomaly detected', { streamId, metrics });
    this.emit('anomaly:detected', { streamId, metrics });
  }

  private performComplianceChecks(): void {
    // Implementation for compliance checking
    for (const stream of this.streams.values()) {
      if (stream.governance.compliance.frameworks.length > 0) {
        this.checkStreamCompliance(stream);
      }
    }
  }

  private checkStreamCompliance(stream: StreamDefinition): void {
    // Implementation for stream compliance checking
    this.logger.debug('Checking stream compliance', { streamId: stream.id });
  }

  private performHealthChecks(): void {
    // Implementation for health checking
    for (const streamId of this.activeStreams) {
      this.checkStreamHealth(streamId);
    }
  }

  private checkStreamHealth(streamId: string): void {
    // Implementation for stream health checking
    const stream = this.streams.get(streamId);
    if (stream && stream.source.healthCheck.enabled) {
      this.logger.debug('Checking stream health', { streamId });
    }
  }

  private calculateErrorRate(): number {
    let totalMessages = 0;
    let totalErrors = 0;
    
    for (const metrics of this.streamMetrics.values()) {
      totalMessages += metrics.messagesProcessed;
      totalErrors += metrics.errorCount;
    }
    
    return totalMessages > 0 ? totalErrors / totalMessages : 0;
  }

  private calculateAvgLatency(): number {
    let totalLatency = 0;
    let streamCount = 0;
    
    for (const metrics of this.streamMetrics.values()) {
      totalLatency += metrics.latency.p50;
      streamCount++;
    }
    
    return streamCount > 0 ? totalLatency / streamCount : 0;
  }

  private calculateTotalThroughput(): number {
    let totalThroughput = 0;
    
    for (const metrics of this.streamMetrics.values()) {
      totalThroughput += metrics.throughput;
    }
    
    return totalThroughput;
  }

  private auditLog(action: string, data: Record<string, any>): void {
    if (!this.config.enableAuditTrail) return;
    
    const entry: StreamAuditEntry = {
      id: generateId('audit'),
      timestamp: new Date(),
      action,
      data,
      userId: 'system',
      sessionId: 'pipeline'
    };
    
    this.auditTrail.push(entry);
    this.emit('audit:logged', entry);
  }
}

// ===== ADDITIONAL TYPES =====

export interface StreamingPipelineConfig {
  maxConcurrentStreams: number;
  maxProcessorsPerStream: number;
  defaultRetentionDays: number;
  enableGovernance: boolean;
  enableCompliance: boolean;
  enableAuditTrail: boolean;
  monitoringInterval: number;
  healthCheckInterval: number;
  metricsPersistenceInterval: number;
  backpressureThreshold: number;
  circuitBreakerThreshold: number;
}

export interface StreamMetrics {
  messagesProcessed: number;
  bytesProcessed: number;
  errorCount: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  backpressureEvents: number;
  lastUpdate: Date;
}

export interface PipelineHealthStatus {
  status: 'healthy' | 'degraded' | 'critical';
  streams: {
    total: number;
    active: number;
    stopped: number;
  };
  processors: {
    total: number;
    active: number;
    stopped: number;
  };
  performance: {
    errorRate: number;
    avgLatency: number;
    totalThroughput: number;
  };
  lastUpdate: Date;
}

export interface StreamAuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  data: Record<string, any>;
  userId: string;
  sessionId: string;
}

export interface ValidationRules {
  required: string[];
  formats: Record<string, string>;
  ranges: Record<string, { min?: number; max?: number }>;
  custom: Array<{
    field: string;
    rule: string;
    message: string;
  }>;
} 