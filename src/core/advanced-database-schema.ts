/**
 * Advanced SQLite Database Schema - Complete 12-Table Architecture
 * Enterprise-grade database design with full relationships and advanced features
 */

import Database from 'better-sqlite3';
import { ILogger } from './logger.js';
import { generateId } from '../utils/helpers.js';

export interface DatabaseConfig {
  path: string;
  enableWAL: boolean;
  enableForeignKeys: boolean;
  enableTriggers: boolean;
  cacheSize: number;
  pageSize: number;
  journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
  enableFullTextSearch: boolean;
  enableJSON: boolean;
  enableRTree: boolean;
  enableBackup: boolean;
  backupInterval: number;
  enableCompression: boolean;
  enableEncryption: boolean;
}

export interface HiveMind {
  id: string;
  name: string;
  description: string;
  topology: 'hierarchical' | 'mesh' | 'ring' | 'star' | 'hybrid';
  max_agents: number;
  consensus_threshold: number;
  coordination_mode: 'centralized' | 'distributed' | 'democratic' | 'authoritarian';
  intelligence_level: number;
  learning_enabled: boolean;
  adaptation_enabled: boolean;
  queen_agent_id?: string;
  status: 'active' | 'inactive' | 'suspended' | 'archived';
  created_at: Date;
  updated_at: Date;
  metadata: string; // JSON
}

export interface Agent {
  id: string;
  hive_mind_id: string;
  name: string;
  type: 'queen' | 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'specialist' | 'security' | 'devops';
  specialization?: string;
  status: 'idle' | 'busy' | 'offline' | 'error' | 'maintenance';
  capabilities: string; // JSON
  performance_metrics: string; // JSON
  reputation_score: number;
  hierarchy_level: number;
  parent_agent_id?: string;
  spawn_count: number;
  max_concurrent_tasks: number;
  current_workload: number;
  health_score: number;
  last_heartbeat: Date;
  created_at: Date;
  updated_at: Date;
  metadata: string; // JSON
}

export interface Task {
  id: string;
  hive_mind_id: string;
  parent_task_id?: string;
  name: string;
  description: string;
  type: 'coding' | 'research' | 'analysis' | 'documentation' | 'testing' | 'review' | 'optimization' | 'deployment' | 'monitoring' | 'maintenance';
  priority: number;
  complexity: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  assigned_agent_id?: string;
  created_by_agent_id: string;
  requirements: string; // JSON
  constraints: string; // JSON
  expected_duration: number;
  actual_duration?: number;
  progress: number;
  quality_score?: number;
  result: string; // JSON
  error_message?: string;
  retry_count: number;
  max_retries: number;
  deadline?: Date;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  metadata: string; // JSON
}

export interface Communication {
  id: string;
  hive_mind_id: string;
  sender_agent_id: string;
  receiver_agent_id?: string; // null for broadcast
  message_type: 'task_assignment' | 'status_update' | 'coordination' | 'broadcast' | 'query' | 'response' | 'alert' | 'heartbeat';
  content: string; // JSON
  priority: 'low' | 'normal' | 'high' | 'urgent';
  encryption_level: 'none' | 'basic' | 'advanced' | 'quantum';
  delivery_status: 'pending' | 'delivered' | 'failed' | 'acknowledged';
  response_required: boolean;
  response_deadline?: Date;
  correlation_id?: string;
  thread_id?: string;
  created_at: Date;
  delivered_at?: Date;
  acknowledged_at?: Date;
  metadata: string; // JSON
}

export interface NeuralPattern {
  id: string;
  hive_mind_id: string;
  name: string;
  type: 'coordination' | 'task_prediction' | 'behavior_analysis' | 'optimization' | 'anomaly_detection' | 'learning';
  description: string;
  pattern_data: string; // JSON - neural network weights/structure
  training_data_size: number;
  accuracy: number;
  confidence: number;
  usage_count: number;
  success_rate: number;
  last_training: Date;
  version: number;
  is_active: boolean;
  feature_importance: string; // JSON
  hyperparameters: string; // JSON
  created_at: Date;
  updated_at: Date;
  metadata: string; // JSON
}

export interface ConsensusDecision {
  id: string;
  hive_mind_id: string;
  decision_type: 'task_assignment' | 'resource_allocation' | 'strategy_change' | 'agent_spawn' | 'consensus_vote' | 'emergency_response';
  description: string;
  options: string; // JSON array of options
  voting_method: 'majority' | 'weighted' | 'expertise' | 'neural' | 'queen_decision';
  consensus_threshold: number;
  participants: string; // JSON array of agent IDs
  votes: string; // JSON array of votes
  selected_option: string;
  confidence_level: number;
  reasoning: string;
  initiated_by: string;
  decision_time: number; // milliseconds
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  outcome: 'success' | 'failure' | 'partial';
  impact_assessment: string; // JSON
  created_at: Date;
  completed_at?: Date;
  metadata: string; // JSON
}

export interface PerformanceMetric {
  id: string;
  hive_mind_id: string;
  entity_type: 'hive_mind' | 'agent' | 'task' | 'communication' | 'system';
  entity_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  aggregation_type: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'rate';
  time_window: number; // seconds
  baseline_value?: number;
  threshold_warning?: number;
  threshold_critical?: number;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  anomaly_score?: number;
  tags: string; // JSON
  created_at: Date;
  metadata: string; // JSON
}

export interface SessionHistory {
  id: string;
  hive_mind_id: string;
  agent_id: string;
  session_type: 'task_execution' | 'communication' | 'coordination' | 'learning' | 'maintenance';
  session_data: string; // JSON
  start_time: Date;
  end_time?: Date;
  duration?: number;
  status: 'active' | 'completed' | 'interrupted' | 'failed';
  resource_usage: string; // JSON
  performance_metrics: string; // JSON
  errors: string; // JSON array
  outcomes: string; // JSON
  learning_data: string; // JSON
  created_at: Date;
  metadata: string; // JSON
}

export interface SwarmConfiguration {
  id: string;
  hive_mind_id: string;
  configuration_name: string;
  configuration_type: 'topology' | 'coordination' | 'communication' | 'learning' | 'security' | 'performance';
  configuration_data: string; // JSON
  version: number;
  is_active: boolean;
  applied_at?: Date;
  applied_by: string;
  validation_status: 'pending' | 'valid' | 'invalid' | 'warning';
  validation_errors: string; // JSON
  rollback_data: string; // JSON
  impact_assessment: string; // JSON
  created_at: Date;
  updated_at: Date;
  metadata: string; // JSON
}

export interface AgentCapability {
  id: string;
  agent_id: string;
  capability_name: string;
  capability_type: 'skill' | 'tool' | 'knowledge' | 'access' | 'specialization';
  proficiency_level: number; // 0-1
  certification_level: 'none' | 'basic' | 'intermediate' | 'advanced' | 'expert';
  last_used: Date;
  usage_frequency: number;
  success_rate: number;
  improvement_rate: number;
  dependencies: string; // JSON array
  prerequisites: string; // JSON array
  expiry_date?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  metadata: string; // JSON
}

export interface TaskDependency {
  id: string;
  task_id: string;
  dependent_task_id: string;
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish' | 'resource' | 'logical';
  dependency_strength: 'weak' | 'medium' | 'strong' | 'critical';
  lag_time: number; // seconds
  condition: string; // JSON
  status: 'pending' | 'satisfied' | 'violated' | 'cancelled';
  violation_impact: 'low' | 'medium' | 'high' | 'critical';
  created_at: Date;
  resolved_at?: Date;
  metadata: string; // JSON
}

export interface SystemEvent {
  id: string;
  hive_mind_id?: string;
  event_type: 'agent_spawn' | 'agent_terminate' | 'task_create' | 'task_complete' | 'communication_sent' | 'consensus_reached' | 'pattern_learned' | 'performance_alert' | 'system_error' | 'security_event';
  event_category: 'operational' | 'performance' | 'security' | 'learning' | 'coordination' | 'system';
  severity: 'info' | 'warning' | 'error' | 'critical' | 'debug';
  source_entity_type: 'hive_mind' | 'agent' | 'task' | 'system' | 'user';
  source_entity_id: string;
  target_entity_type?: 'hive_mind' | 'agent' | 'task' | 'system' | 'user';
  target_entity_id?: string;
  event_data: string; // JSON
  correlation_id?: string;
  trace_id?: string;
  user_id?: string;
  session_id?: string;
  processing_status: 'pending' | 'processed' | 'failed' | 'ignored';
  retention_policy: 'short' | 'medium' | 'long' | 'permanent';
  created_at: Date;
  processed_at?: Date;
  metadata: string; // JSON
}

/**
 * Advanced Database Schema Manager with Enterprise Features
 */
export class AdvancedDatabaseSchema {
  private db!: Database.Database;
  private logger: ILogger;
  private config: DatabaseConfig;
  private initialized = false;
  private backupInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  private maintenanceInterval?: NodeJS.Timeout;
  
  // Connection pool and performance monitoring
  private connectionPool: Database.Database[] = [];
  private queryMetrics = new Map<string, any>();
  private performanceStats = {
    totalQueries: 0,
    avgQueryTime: 0,
    slowQueries: 0,
    errors: 0
  };
  
  constructor(config: Partial<DatabaseConfig>, logger: ILogger) {
    this.logger = logger;
    this.config = {
      path: './data/flowx-advanced.db',
      enableWAL: true,
      enableForeignKeys: true,
      enableTriggers: true,
      cacheSize: 10000,
      pageSize: 4096,
      journalMode: 'WAL',
      synchronous: 'NORMAL',
      tempStore: 'MEMORY',
      enableFullTextSearch: true,
      enableJSON: true,
      enableRTree: false,
      enableBackup: true,
      backupInterval: 3600000, // 1 hour
      enableCompression: false,
      enableEncryption: false,
      ...config
    };
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Initialize main database connection
      this.db = new Database(this.config.path);
      
      // Configure database settings
      await this.configureDatabase();
      
      // Create all tables
      await this.createTables();
      
      // Create indexes
      await this.createIndexes();
      
      // Create triggers
      if (this.config.enableTriggers) {
        await this.createTriggers();
      }
      
      // Create views
      await this.createViews();
      
      // Enable extensions
      await this.enableExtensions();
      
      // Initialize connection pool
      await this.initializeConnectionPool();
      
      // Start background processes
      this.startBackgroundProcesses();
      
      this.initialized = true;
      this.logger.info('Advanced database schema initialized', {
        path: this.config.path,
        features: this.getEnabledFeatures()
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize database schema', { error });
      throw error;
    }
  }
  
  private async configureDatabase(): Promise<void> {
    const pragmas = [
      `PRAGMA journal_mode = ${this.config.journalMode}`,
      `PRAGMA synchronous = ${this.config.synchronous}`,
      `PRAGMA cache_size = ${this.config.cacheSize}`,
      `PRAGMA page_size = ${this.config.pageSize}`,
      `PRAGMA temp_store = ${this.config.tempStore}`,
      `PRAGMA foreign_keys = ${this.config.enableForeignKeys ? 'ON' : 'OFF'}`,
      `PRAGMA recursive_triggers = ON`,
      `PRAGMA secure_delete = ON`,
      `PRAGMA auto_vacuum = INCREMENTAL`,
      `PRAGMA optimize`
    ];
    
    for (const pragma of pragmas) {
      this.db.exec(pragma);
    }
  }
  
  private async createTables(): Promise<void> {
    // 1. Hive Minds Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hive_minds (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        topology TEXT CHECK (topology IN ('hierarchical', 'mesh', 'ring', 'star', 'hybrid')) NOT NULL,
        max_agents INTEGER NOT NULL DEFAULT 10,
        consensus_threshold REAL NOT NULL DEFAULT 0.7,
        coordination_mode TEXT CHECK (coordination_mode IN ('centralized', 'distributed', 'democratic', 'authoritarian')) NOT NULL,
        intelligence_level REAL NOT NULL DEFAULT 0.5,
        learning_enabled BOOLEAN NOT NULL DEFAULT 1,
        adaptation_enabled BOOLEAN NOT NULL DEFAULT 1,
        queen_agent_id TEXT,
        status TEXT CHECK (status IN ('active', 'inactive', 'suspended', 'archived')) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (queen_agent_id) REFERENCES agents(id) ON DELETE SET NULL
      )
    `);
    
    // 2. Agents Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT CHECK (type IN ('queen', 'coordinator', 'researcher', 'coder', 'analyst', 'architect', 'tester', 'reviewer', 'optimizer', 'documenter', 'monitor', 'specialist', 'security', 'devops')) NOT NULL,
        specialization TEXT,
        status TEXT CHECK (status IN ('idle', 'busy', 'offline', 'error', 'maintenance')) NOT NULL DEFAULT 'idle',
        capabilities TEXT DEFAULT '{}',
        performance_metrics TEXT DEFAULT '{}',
        reputation_score REAL NOT NULL DEFAULT 0.5,
        hierarchy_level INTEGER NOT NULL DEFAULT 0,
        parent_agent_id TEXT,
        spawn_count INTEGER NOT NULL DEFAULT 0,
        max_concurrent_tasks INTEGER NOT NULL DEFAULT 3,
        current_workload REAL NOT NULL DEFAULT 0.0,
        health_score REAL NOT NULL DEFAULT 1.0,
        last_heartbeat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_agent_id) REFERENCES agents(id) ON DELETE SET NULL
      )
    `);
    
    // 3. Tasks Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT NOT NULL,
        parent_task_id TEXT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT CHECK (type IN ('coding', 'research', 'analysis', 'documentation', 'testing', 'review', 'optimization', 'deployment', 'monitoring', 'maintenance')) NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        complexity REAL NOT NULL DEFAULT 0.5,
        status TEXT CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled')) NOT NULL DEFAULT 'pending',
        assigned_agent_id TEXT,
        created_by_agent_id TEXT NOT NULL,
        requirements TEXT DEFAULT '{}',
        constraints TEXT DEFAULT '{}',
        expected_duration INTEGER,
        actual_duration INTEGER,
        progress REAL NOT NULL DEFAULT 0.0,
        quality_score REAL,
        result TEXT DEFAULT '{}',
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        deadline DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by_agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);
    
    // 4. Communications Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS communications (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT NOT NULL,
        sender_agent_id TEXT NOT NULL,
        receiver_agent_id TEXT,
        message_type TEXT CHECK (message_type IN ('task_assignment', 'status_update', 'coordination', 'broadcast', 'query', 'response', 'alert', 'heartbeat')) NOT NULL,
        content TEXT NOT NULL,
        priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) NOT NULL DEFAULT 'normal',
        encryption_level TEXT CHECK (encryption_level IN ('none', 'basic', 'advanced', 'quantum')) NOT NULL DEFAULT 'none',
        delivery_status TEXT CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'acknowledged')) NOT NULL DEFAULT 'pending',
        response_required BOOLEAN NOT NULL DEFAULT 0,
        response_deadline DATETIME,
        correlation_id TEXT,
        thread_id TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        delivered_at DATETIME,
        acknowledged_at DATETIME,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);
    
    // 5. Neural Patterns Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS neural_patterns (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT CHECK (type IN ('coordination', 'task_prediction', 'behavior_analysis', 'optimization', 'anomaly_detection', 'learning')) NOT NULL,
        description TEXT NOT NULL,
        pattern_data TEXT NOT NULL,
        training_data_size INTEGER NOT NULL DEFAULT 0,
        accuracy REAL NOT NULL DEFAULT 0.0,
        confidence REAL NOT NULL DEFAULT 0.0,
        usage_count INTEGER NOT NULL DEFAULT 0,
        success_rate REAL NOT NULL DEFAULT 0.0,
        last_training DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        version INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        feature_importance TEXT DEFAULT '{}',
        hyperparameters TEXT DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE
      )
    `);
    
    // 6. Consensus Decisions Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS consensus_decisions (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT NOT NULL,
        decision_type TEXT CHECK (decision_type IN ('task_assignment', 'resource_allocation', 'strategy_change', 'agent_spawn', 'consensus_vote', 'emergency_response')) NOT NULL,
        description TEXT NOT NULL,
        options TEXT NOT NULL,
        voting_method TEXT CHECK (voting_method IN ('majority', 'weighted', 'expertise', 'neural', 'queen_decision')) NOT NULL,
        consensus_threshold REAL NOT NULL DEFAULT 0.7,
        participants TEXT NOT NULL,
        votes TEXT DEFAULT '[]',
        selected_option TEXT,
        confidence_level REAL NOT NULL DEFAULT 0.0,
        reasoning TEXT,
        initiated_by TEXT NOT NULL,
        decision_time INTEGER,
        status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) NOT NULL DEFAULT 'pending',
        outcome TEXT CHECK (outcome IN ('success', 'failure', 'partial')),
        impact_assessment TEXT DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE,
        FOREIGN KEY (initiated_by) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);
    
    // 7. Performance Metrics Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT NOT NULL,
        entity_type TEXT CHECK (entity_type IN ('hive_mind', 'agent', 'task', 'communication', 'system')) NOT NULL,
        entity_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metric_unit TEXT NOT NULL,
        aggregation_type TEXT CHECK (aggregation_type IN ('sum', 'avg', 'min', 'max', 'count', 'rate')) NOT NULL,
        time_window INTEGER NOT NULL DEFAULT 3600,
        baseline_value REAL,
        threshold_warning REAL,
        threshold_critical REAL,
        trend TEXT CHECK (trend IN ('increasing', 'decreasing', 'stable', 'volatile')) NOT NULL DEFAULT 'stable',
        anomaly_score REAL,
        tags TEXT DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE
      )
    `);
    
    // 8. Session History Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_history (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        session_type TEXT CHECK (session_type IN ('task_execution', 'communication', 'coordination', 'learning', 'maintenance')) NOT NULL,
        session_data TEXT NOT NULL,
        start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        duration INTEGER,
        status TEXT CHECK (status IN ('active', 'completed', 'interrupted', 'failed')) NOT NULL DEFAULT 'active',
        resource_usage TEXT DEFAULT '{}',
        performance_metrics TEXT DEFAULT '{}',
        errors TEXT DEFAULT '[]',
        outcomes TEXT DEFAULT '{}',
        learning_data TEXT DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);
    
    // 9. Swarm Configurations Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS swarm_configurations (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT NOT NULL,
        configuration_name TEXT NOT NULL,
        configuration_type TEXT CHECK (configuration_type IN ('topology', 'coordination', 'communication', 'learning', 'security', 'performance')) NOT NULL,
        configuration_data TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT 0,
        applied_at DATETIME,
        applied_by TEXT NOT NULL,
        validation_status TEXT CHECK (validation_status IN ('pending', 'valid', 'invalid', 'warning')) NOT NULL DEFAULT 'pending',
        validation_errors TEXT DEFAULT '[]',
        rollback_data TEXT DEFAULT '{}',
        impact_assessment TEXT DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE,
        FOREIGN KEY (applied_by) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);
    
    // 10. Agent Capabilities Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_capabilities (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        capability_name TEXT NOT NULL,
        capability_type TEXT CHECK (capability_type IN ('skill', 'tool', 'knowledge', 'access', 'specialization')) NOT NULL,
        proficiency_level REAL NOT NULL DEFAULT 0.5,
        certification_level TEXT CHECK (certification_level IN ('none', 'basic', 'intermediate', 'advanced', 'expert')) NOT NULL DEFAULT 'none',
        last_used DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        usage_frequency INTEGER NOT NULL DEFAULT 0,
        success_rate REAL NOT NULL DEFAULT 0.0,
        improvement_rate REAL NOT NULL DEFAULT 0.0,
        dependencies TEXT DEFAULT '[]',
        prerequisites TEXT DEFAULT '[]',
        expiry_date DATETIME,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        UNIQUE(agent_id, capability_name)
      )
    `);
    
    // 11. Task Dependencies Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        dependent_task_id TEXT NOT NULL,
        dependency_type TEXT CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish', 'resource', 'logical')) NOT NULL,
        dependency_strength TEXT CHECK (dependency_strength IN ('weak', 'medium', 'strong', 'critical')) NOT NULL DEFAULT 'medium',
        lag_time INTEGER NOT NULL DEFAULT 0,
        condition TEXT DEFAULT '{}',
        status TEXT CHECK (status IN ('pending', 'satisfied', 'violated', 'cancelled')) NOT NULL DEFAULT 'pending',
        violation_impact TEXT CHECK (violation_impact IN ('low', 'medium', 'high', 'critical')) NOT NULL DEFAULT 'medium',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (dependent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, dependent_task_id)
      )
    `);
    
    // 12. System Events Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_events (
        id TEXT PRIMARY KEY,
        hive_mind_id TEXT,
        event_type TEXT CHECK (event_type IN ('agent_spawn', 'agent_terminate', 'task_create', 'task_complete', 'communication_sent', 'consensus_reached', 'pattern_learned', 'performance_alert', 'system_error', 'security_event')) NOT NULL,
        event_category TEXT CHECK (event_category IN ('operational', 'performance', 'security', 'learning', 'coordination', 'system')) NOT NULL,
        severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical', 'debug')) NOT NULL DEFAULT 'info',
        source_entity_type TEXT CHECK (source_entity_type IN ('hive_mind', 'agent', 'task', 'system', 'user')) NOT NULL,
        source_entity_id TEXT NOT NULL,
        target_entity_type TEXT CHECK (target_entity_type IN ('hive_mind', 'agent', 'task', 'system', 'user')),
        target_entity_id TEXT,
        event_data TEXT NOT NULL,
        correlation_id TEXT,
        trace_id TEXT,
        user_id TEXT,
        session_id TEXT,
        processing_status TEXT CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored')) NOT NULL DEFAULT 'pending',
        retention_policy TEXT CHECK (retention_policy IN ('short', 'medium', 'long', 'permanent')) NOT NULL DEFAULT 'medium',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (hive_mind_id) REFERENCES hive_minds(id) ON DELETE CASCADE
      )
    `);
  }
  
  private async createIndexes(): Promise<void> {
    const indexes = [
      // Hive Minds indexes
      'CREATE INDEX IF NOT EXISTS idx_hive_minds_status ON hive_minds(status)',
      'CREATE INDEX IF NOT EXISTS idx_hive_minds_topology ON hive_minds(topology)',
      'CREATE INDEX IF NOT EXISTS idx_hive_minds_created_at ON hive_minds(created_at)',
      
      // Agents indexes
      'CREATE INDEX IF NOT EXISTS idx_agents_hive_mind_id ON agents(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type)',
      'CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)',
      'CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id ON agents(parent_agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_agents_reputation_score ON agents(reputation_score)',
      'CREATE INDEX IF NOT EXISTS idx_agents_last_heartbeat ON agents(last_heartbeat)',
      
      // Tasks indexes
      'CREATE INDEX IF NOT EXISTS idx_tasks_hive_mind_id ON tasks(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent_id ON tasks(assigned_agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_created_by_agent_id ON tasks(created_by_agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)',
      
      // Communications indexes
      'CREATE INDEX IF NOT EXISTS idx_communications_hive_mind_id ON communications(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_communications_sender_agent_id ON communications(sender_agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_communications_receiver_agent_id ON communications(receiver_agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_communications_message_type ON communications(message_type)',
      'CREATE INDEX IF NOT EXISTS idx_communications_priority ON communications(priority)',
      'CREATE INDEX IF NOT EXISTS idx_communications_delivery_status ON communications(delivery_status)',
      'CREATE INDEX IF NOT EXISTS idx_communications_created_at ON communications(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_communications_correlation_id ON communications(correlation_id)',
      'CREATE INDEX IF NOT EXISTS idx_communications_thread_id ON communications(thread_id)',
      
      // Neural Patterns indexes
      'CREATE INDEX IF NOT EXISTS idx_neural_patterns_hive_mind_id ON neural_patterns(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_neural_patterns_type ON neural_patterns(type)',
      'CREATE INDEX IF NOT EXISTS idx_neural_patterns_is_active ON neural_patterns(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_neural_patterns_accuracy ON neural_patterns(accuracy)',
      'CREATE INDEX IF NOT EXISTS idx_neural_patterns_usage_count ON neural_patterns(usage_count)',
      'CREATE INDEX IF NOT EXISTS idx_neural_patterns_last_training ON neural_patterns(last_training)',
      
      // Consensus Decisions indexes
      'CREATE INDEX IF NOT EXISTS idx_consensus_decisions_hive_mind_id ON consensus_decisions(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_consensus_decisions_decision_type ON consensus_decisions(decision_type)',
      'CREATE INDEX IF NOT EXISTS idx_consensus_decisions_status ON consensus_decisions(status)',
      'CREATE INDEX IF NOT EXISTS idx_consensus_decisions_initiated_by ON consensus_decisions(initiated_by)',
      'CREATE INDEX IF NOT EXISTS idx_consensus_decisions_created_at ON consensus_decisions(created_at)',
      
      // Performance Metrics indexes
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_hive_mind_id ON performance_metrics(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_entity_type ON performance_metrics(entity_type)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_entity_id ON performance_metrics(entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_name ON performance_metrics(metric_name)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_performance_metrics_anomaly_score ON performance_metrics(anomaly_score)',
      
      // Session History indexes
      'CREATE INDEX IF NOT EXISTS idx_session_history_hive_mind_id ON session_history(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_session_history_agent_id ON session_history(agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_session_history_session_type ON session_history(session_type)',
      'CREATE INDEX IF NOT EXISTS idx_session_history_status ON session_history(status)',
      'CREATE INDEX IF NOT EXISTS idx_session_history_start_time ON session_history(start_time)',
      
      // Swarm Configurations indexes
      'CREATE INDEX IF NOT EXISTS idx_swarm_configurations_hive_mind_id ON swarm_configurations(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_swarm_configurations_configuration_type ON swarm_configurations(configuration_type)',
      'CREATE INDEX IF NOT EXISTS idx_swarm_configurations_is_active ON swarm_configurations(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_swarm_configurations_validation_status ON swarm_configurations(validation_status)',
      
      // Agent Capabilities indexes
      'CREATE INDEX IF NOT EXISTS idx_agent_capabilities_agent_id ON agent_capabilities(agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_agent_capabilities_capability_type ON agent_capabilities(capability_type)',
      'CREATE INDEX IF NOT EXISTS idx_agent_capabilities_proficiency_level ON agent_capabilities(proficiency_level)',
      'CREATE INDEX IF NOT EXISTS idx_agent_capabilities_is_active ON agent_capabilities(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_agent_capabilities_last_used ON agent_capabilities(last_used)',
      
      // Task Dependencies indexes
      'CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_dependencies_dependent_task_id ON task_dependencies(dependent_task_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_dependencies_dependency_type ON task_dependencies(dependency_type)',
      'CREATE INDEX IF NOT EXISTS idx_task_dependencies_status ON task_dependencies(status)',
      
      // System Events indexes
      'CREATE INDEX IF NOT EXISTS idx_system_events_hive_mind_id ON system_events(hive_mind_id)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_event_category ON system_events(event_category)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_source_entity_type ON system_events(source_entity_type)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_source_entity_id ON system_events(source_entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_correlation_id ON system_events(correlation_id)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_trace_id ON system_events(trace_id)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_processing_status ON system_events(processing_status)'
    ];
    
    for (const index of indexes) {
      this.db.exec(index);
    }
  }
  
  private async createTriggers(): Promise<void> {
    // Update timestamp triggers
    const updateTriggers = [
      'hive_minds',
      'agents',
      'tasks',
      'neural_patterns',
      'swarm_configurations',
      'agent_capabilities'
    ];
    
    for (const table of updateTriggers) {
      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_${table}_timestamp
        AFTER UPDATE ON ${table}
        FOR EACH ROW
        BEGIN
          UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);
    }
    
    // Agent status change trigger
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS agent_status_change_event
      AFTER UPDATE OF status ON agents
      FOR EACH ROW
      WHEN OLD.status != NEW.status
      BEGIN
        INSERT INTO system_events (
          id, hive_mind_id, event_type, event_category, severity,
          source_entity_type, source_entity_id, event_data
        ) VALUES (
          '${generateId('event')}', NEW.hive_mind_id, 'agent_status_change', 'operational', 'info',
          'agent', NEW.id, json_object('old_status', OLD.status, 'new_status', NEW.status)
        );
      END
    `);
    
    // Task completion trigger
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS task_completion_event
      AFTER UPDATE OF status ON tasks
      FOR EACH ROW
      WHEN OLD.status != 'completed' AND NEW.status = 'completed'
      BEGIN
        UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        INSERT INTO system_events (
          id, hive_mind_id, event_type, event_category, severity,
          source_entity_type, source_entity_id, event_data
        ) VALUES (
          '${generateId('event')}', NEW.hive_mind_id, 'task_complete', 'operational', 'info',
          'task', NEW.id, json_object('duration', NEW.actual_duration, 'quality', NEW.quality_score)
        );
      END
    `);
    
    // Neural pattern usage trigger
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS neural_pattern_usage_update
      AFTER UPDATE OF usage_count ON neural_patterns
      FOR EACH ROW
      WHEN NEW.usage_count > OLD.usage_count
      BEGIN
        INSERT INTO system_events (
          id, hive_mind_id, event_type, event_category, severity,
          source_entity_type, source_entity_id, event_data
        ) VALUES (
          '${generateId('event')}', NEW.hive_mind_id, 'pattern_used', 'learning', 'debug',
          'neural_pattern', NEW.id, json_object('usage_count', NEW.usage_count, 'accuracy', NEW.accuracy)
        );
      END
    `);
  }
  
  private async createViews(): Promise<void> {
    // Active agents view
    this.db.exec(`
      CREATE VIEW IF NOT EXISTS active_agents AS
      SELECT 
        a.*,
        h.name as hive_mind_name,
        h.topology,
        COUNT(t.id) as active_tasks
      FROM agents a
      JOIN hive_minds h ON a.hive_mind_id = h.id
      LEFT JOIN tasks t ON a.id = t.assigned_agent_id AND t.status IN ('assigned', 'in_progress')
      WHERE a.status IN ('idle', 'busy')
      GROUP BY a.id
    `);
    
    // Task performance view
    this.db.exec(`
      CREATE VIEW IF NOT EXISTS task_performance AS
      SELECT 
        t.*,
        a.name as agent_name,
        a.type as agent_type,
        h.name as hive_mind_name,
        (t.actual_duration / NULLIF(t.expected_duration, 0)) as duration_ratio,
        CASE 
          WHEN t.completed_at IS NOT NULL THEN 
            (julianday(t.completed_at) - julianday(t.created_at)) * 24 * 60 * 60
          ELSE NULL
        END as total_duration_seconds
      FROM tasks t
      JOIN agents a ON t.assigned_agent_id = a.id
      JOIN hive_minds h ON t.hive_mind_id = h.id
      WHERE t.status = 'completed'
    `);
    
    // Communication flow view
    this.db.exec(`
      CREATE VIEW IF NOT EXISTS communication_flow AS
      SELECT 
        c.*,
        s.name as sender_name,
        s.type as sender_type,
        r.name as receiver_name,
        r.type as receiver_type,
        h.name as hive_mind_name
      FROM communications c
      JOIN agents s ON c.sender_agent_id = s.id
      LEFT JOIN agents r ON c.receiver_agent_id = r.id
      JOIN hive_minds h ON c.hive_mind_id = h.id
      ORDER BY c.created_at DESC
    `);
    
    // System health view
    this.db.exec(`
      CREATE VIEW IF NOT EXISTS system_health AS
      SELECT 
        h.id as hive_mind_id,
        h.name as hive_mind_name,
        h.status as hive_mind_status,
        COUNT(DISTINCT a.id) as total_agents,
        COUNT(DISTINCT CASE WHEN a.status IN ('idle', 'busy') THEN a.id END) as active_agents,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'failed' THEN t.id END) as failed_tasks,
        AVG(a.health_score) as avg_agent_health,
        AVG(a.reputation_score) as avg_agent_reputation,
        MAX(a.last_heartbeat) as last_activity
      FROM hive_minds h
      LEFT JOIN agents a ON h.id = a.hive_mind_id
      LEFT JOIN tasks t ON h.id = t.hive_mind_id
      GROUP BY h.id
    `);
  }
  
  private async enableExtensions(): Promise<void> {
    if (this.config.enableFullTextSearch) {
      // Enable FTS for searchable content
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
          id, name, description, content='tasks', content_rowid='rowid'
        )
      `);
      
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS communications_fts USING fts5(
          id, content, content='communications', content_rowid='rowid'
        )
      `);
    }
    
    if (this.config.enableJSON) {
      // JSON functions are built-in to SQLite 3.38+
      // Test JSON functionality
      this.db.exec(`SELECT json_valid('{"test": true}') as json_test`);
    }
  }
  
  private async initializeConnectionPool(): Promise<void> {
    const poolSize = Math.min(10, Math.max(2, this.config.cacheSize / 1000));
    
    for (let i = 0; i < poolSize; i++) {
      const conn = new Database(this.config.path);
      await this.configureConnection(conn);
      this.connectionPool.push(conn);
    }
    
    this.logger.info('Database connection pool initialized', { poolSize });
  }
  
  private async configureConnection(conn: Database.Database): Promise<void> {
    // Configure connection with same settings as main database
    const pragmas = [
      `PRAGMA foreign_keys = ${this.config.enableForeignKeys ? 'ON' : 'OFF'}`,
      `PRAGMA journal_mode = ${this.config.journalMode}`,
      `PRAGMA synchronous = ${this.config.synchronous}`,
      `PRAGMA cache_size = ${this.config.cacheSize}`,
      `PRAGMA temp_store = ${this.config.tempStore}`
    ];
    
    for (const pragma of pragmas) {
      conn.exec(pragma);
    }
  }
  
  private startBackgroundProcesses(): void {
    // Automated backup
    if (this.config.enableBackup) {
      this.backupInterval = setInterval(() => {
        this.performBackup().catch(error => {
          this.logger.error('Backup failed', { error });
        });
      }, this.config.backupInterval);
    }
    
    // Database optimization
    this.optimizationInterval = setInterval(() => {
      this.optimizeDatabase().catch(error => {
        this.logger.error('Database optimization failed', { error });
      });
    }, 3600000); // 1 hour
    
    // Maintenance tasks
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance().catch(error => {
        this.logger.error('Database maintenance failed', { error });
      });
    }, 86400000); // 24 hours
  }
  
  private async performBackup(): Promise<void> {
    const backupPath = `${this.config.path}.backup-${Date.now()}`;
    this.db.exec(`VACUUM INTO '${backupPath}'`);
    this.logger.info('Database backup created', { backupPath });
  }
  
  private async optimizeDatabase(): Promise<void> {
    this.db.exec('PRAGMA optimize');
    this.db.exec('PRAGMA incremental_vacuum');
    this.logger.debug('Database optimization completed');
  }
  
  private async performMaintenance(): Promise<void> {
    // Clean up old events based on retention policy
    this.db.exec(`
      DELETE FROM system_events 
      WHERE retention_policy = 'short' 
      AND created_at < datetime('now', '-7 days')
    `);
    
    this.db.exec(`
      DELETE FROM system_events 
      WHERE retention_policy = 'medium' 
      AND created_at < datetime('now', '-30 days')
    `);
    
    this.db.exec(`
      DELETE FROM system_events 
      WHERE retention_policy = 'long' 
      AND created_at < datetime('now', '-1 year')
    `);
    
    // Update statistics
    this.db.exec('ANALYZE');
    
    this.logger.info('Database maintenance completed');
  }
  
  private async runQuery(sql: string, params: any[] = []): Promise<any> {
    const startTime = Date.now();
    
    try {
      const stmt = this.db.prepare(sql);
      const result = params.length > 0 ? stmt.all(params) : stmt.all();
      
      const duration = Date.now() - startTime;
      
      // Update performance stats
      this.performanceStats.totalQueries++;
      this.performanceStats.avgQueryTime = 
        (this.performanceStats.avgQueryTime * (this.performanceStats.totalQueries - 1) + duration) / 
        this.performanceStats.totalQueries;
      
      if (duration > 1000) {
        this.performanceStats.slowQueries++;
        this.logger.warn('Slow query detected', { sql: sql.substring(0, 100), duration });
      }
      
      return result;
    } catch (error) {
      this.performanceStats.errors++;
      this.logger.error('Database query failed', { sql: sql.substring(0, 100), error });
      throw error;
    }
  }
  
  private getEnabledFeatures(): string[] {
    const features = [];
    if (this.config.enableWAL) features.push('WAL');
    if (this.config.enableForeignKeys) features.push('foreign-keys');
    if (this.config.enableTriggers) features.push('triggers');
    if (this.config.enableFullTextSearch) features.push('full-text-search');
    if (this.config.enableJSON) features.push('json');
    if (this.config.enableBackup) features.push('backup');
    if (this.config.enableCompression) features.push('compression');
    if (this.config.enableEncryption) features.push('encryption');
    return features;
  }
  
  /**
   * Execute a query with performance monitoring
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    return this.runQuery(sql, params);
  }
  
  /**
   * Get database statistics
   */
  async getStatistics(): Promise<any> {
    const stats = await this.runQuery(`
      SELECT 
        (SELECT COUNT(*) FROM hive_minds) as hive_minds,
        (SELECT COUNT(*) FROM agents) as agents,
        (SELECT COUNT(*) FROM tasks) as tasks,
        (SELECT COUNT(*) FROM communications) as communications,
        (SELECT COUNT(*) FROM neural_patterns) as neural_patterns,
        (SELECT COUNT(*) FROM consensus_decisions) as consensus_decisions,
        (SELECT COUNT(*) FROM performance_metrics) as performance_metrics,
        (SELECT COUNT(*) FROM session_history) as session_history,
        (SELECT COUNT(*) FROM swarm_configurations) as swarm_configurations,
        (SELECT COUNT(*) FROM agent_capabilities) as agent_capabilities,
        (SELECT COUNT(*) FROM task_dependencies) as task_dependencies,
        (SELECT COUNT(*) FROM system_events) as system_events
    `);
    
    return {
      tables: stats[0],
      performance: this.performanceStats,
      features: this.getEnabledFeatures(),
      connectionPool: this.connectionPool.length
    };
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return { ...this.performanceStats };
  }
  
  /**
   * Shutdown database
   */
  async shutdown(): Promise<void> {
    // Clear intervals
    if (this.backupInterval) clearInterval(this.backupInterval as NodeJS.Timeout);
    if (this.optimizationInterval) clearInterval(this.optimizationInterval as NodeJS.Timeout);
    if (this.maintenanceInterval) clearInterval(this.maintenanceInterval as NodeJS.Timeout);
    
    // Close connection pool
    for (const conn of this.connectionPool) {
      conn.close();
    }
    
    // Close main connection
    this.db.close();
    
    this.initialized = false;
    this.logger.info('Advanced database schema shutdown complete');
  }
} 