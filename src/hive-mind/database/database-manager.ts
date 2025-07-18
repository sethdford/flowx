/**
 * Database Manager for Hive-Mind System
 * 
 * Manages SQLite database operations for the collective intelligence system
 * Based on original flowx v2.0.0 Alpha architecture
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DatabaseConnection,
  HiveMindConfig,
  AgentConfig,
  Task,
  MemoryEntry,
  Message,
  ConsensusProposal,
  ConsensusVote,
  PerformanceMetric,
  NeuralPattern,
  SessionHistory,
  Hook,
  Workflow,
  SecurityEvent,
  SwarmStatusInfo
} from '../types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * SQLite Database Manager for Hive-Mind
 */
export class DatabaseManager implements DatabaseConnection {
  private static instance: DatabaseManager;
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized = false;

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || join(process.cwd(), '.flowx', 'hive-mind.db');
  }

  /**
   * Get singleton instance
   */
  static async getInstance(dbPath?: string): Promise<DatabaseManager> {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
      await DatabaseManager.instance.initialize();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create database connection
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('foreign_keys = ON');

      // Load and execute schema
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);

      this.initialized = true;
      console.log('Hive-Mind database initialized:', this.dbPath);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Execute SQL command
   */
  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(...params);
    } catch (error) {
      console.error('Database execute error:', { sql, params, error });
      throw error;
    }
  }

  /**
   * Query SQL and return results
   */
  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('Database query error:', { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute multiple operations in a transaction
   */
  async transaction(callback: (db: DatabaseConnection) => Promise<void>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(async () => {
      await callback(this);
    });
    
    transaction();
  }

  // === SWARM OPERATIONS ===

  async createSwarm(config: HiveMindConfig & { id: string }): Promise<void> {
    await this.execute(`
      INSERT INTO swarms (
        id, name, topology, queen_mode, max_agents, consensus_threshold,
        memory_ttl, config, performance_metrics, resource_limits, security_config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      config.id,
      config.name,
      config.topology,
      config.queenMode,
      config.maxAgents,
      config.consensusThreshold,
      config.memoryTTL,
      JSON.stringify(config),
      JSON.stringify(config.performanceMetrics || {}),
      JSON.stringify(config.resourceLimits || {}),
      JSON.stringify(config.securityConfig || {})
    ]);
  }

  async getSwarm(swarmId: string): Promise<any> {
    const results = await this.query('SELECT * FROM swarms WHERE id = ?', [swarmId]);
    return results[0] || null;
  }

  async setActiveSwarm(swarmId: string): Promise<void> {
    await this.transaction(async (db) => {
      // Deactivate all swarms
      await db.execute('UPDATE swarms SET is_active = 0');
      // Activate the specified swarm
      await db.execute('UPDATE swarms SET is_active = 1 WHERE id = ?', [swarmId]);
    });
  }

  async getActiveSwarm(): Promise<any> {
    const results = await this.query('SELECT * FROM swarms WHERE is_active = 1 LIMIT 1');
    return results[0] || null;
  }

  async listSwarms(): Promise<any[]> {
    return await this.query('SELECT * FROM active_swarms ORDER BY created_at DESC');
  }

  // === AGENT OPERATIONS ===

  async createAgent(agent: AgentConfig & { id: string }): Promise<void> {
    await this.execute(`
      INSERT INTO agents (
        id, swarm_id, name, type, capabilities, specialization,
        system_prompt, health_score, performance_rating, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      agent.id,
      agent.swarmId,
      agent.name,
      agent.type,
      JSON.stringify(agent.capabilities),
      agent.specialization || null,
      agent.systemPrompt || null,
      agent.healthScore || 1.0,
      agent.performanceRating || 1.0,
      JSON.stringify({})
    ]);
  }

  async getAgent(agentId: string): Promise<any> {
    const results = await this.query('SELECT * FROM agents WHERE id = ?', [agentId]);
    return results[0] || null;
  }

  async getAgents(swarmId: string): Promise<any[]> {
    return await this.query('SELECT * FROM agents WHERE swarm_id = ?', [swarmId]);
  }

  async updateAgentStatus(agentId: string, status: string): Promise<void> {
    await this.execute('UPDATE agents SET status = ? WHERE id = ?', [status, agentId]);
  }

  async updateAgentTask(agentId: string, taskId: string | null): Promise<void> {
    await this.execute('UPDATE agents SET current_task_id = ? WHERE id = ?', [taskId, agentId]);
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.execute('DELETE FROM agents WHERE id = ?', [agentId]);
  }

  // === TASK OPERATIONS ===

  async createTask(task: Task): Promise<void> {
    await this.execute(`
      INSERT INTO tasks (
        id, swarm_id, description, priority, strategy, status, progress,
        dependencies, assigned_agents, require_consensus, max_agents,
        required_capabilities, deadline, metadata, execution_plan,
        resource_requirements
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      task.id,
      task.swarmId,
      task.description,
      task.priority,
      task.strategy,
      task.status,
      task.progress,
      JSON.stringify(task.dependencies),
      JSON.stringify(task.assignedAgents),
      task.requireConsensus ? 1 : 0,
      task.maxAgents,
      JSON.stringify(task.requiredCapabilities),
      task.deadline?.toISOString() || null,
      JSON.stringify(task.metadata),
      JSON.stringify(task.executionPlan || {}),
      JSON.stringify(task.resourceRequirements || {})
    ]);
  }

  async getTask(taskId: string): Promise<any> {
    const results = await this.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    return results[0] || null;
  }

  async getTasks(swarmId: string): Promise<any[]> {
    return await this.query('SELECT * FROM tasks WHERE swarm_id = ? ORDER BY created_at DESC', [swarmId]);
  }

  async updateTaskStatus(taskId: string, status: string, progress?: number): Promise<void> {
    const params = [status, taskId];
    let sql = 'UPDATE tasks SET status = ?';
    
    if (progress !== undefined) {
      sql += ', progress = ?';
      params.splice(1, 0, progress.toString());
    }
    
    sql += ' WHERE id = ?';
    await this.execute(sql, params);
  }

  async updateTaskResult(taskId: string, result: any, qualityScore?: number): Promise<void> {
    const params = [JSON.stringify(result), taskId];
    let sql = 'UPDATE tasks SET result = ?';
    
    if (qualityScore !== undefined) {
      sql += ', quality_score = ?';
      params.splice(1, 0, qualityScore.toString());
    }
    
    sql += ' WHERE id = ?';
    await this.execute(sql, params);
  }

  // === MEMORY OPERATIONS ===

  async storeMemory(entry: MemoryEntry): Promise<void> {
    await this.execute(`
      INSERT OR REPLACE INTO memory (
        key, namespace, value, ttl, access_count, last_accessed_at,
        created_at, expires_at, metadata, tags, content_type,
        content_hash, importance_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entry.key,
      entry.namespace,
      entry.value,
      entry.ttl || null,
      entry.accessCount,
      entry.lastAccessedAt.toISOString(),
      entry.createdAt.toISOString(),
      entry.expiresAt?.toISOString() || null,
      JSON.stringify(entry.metadata || {}),
      JSON.stringify(entry.tags || []),
      entry.contentType || 'text',
      entry.contentHash || null,
      entry.importanceScore || 0.0
    ]);
  }

  async getMemory(key: string, namespace: string = 'default'): Promise<any> {
    // Update access count and timestamp
    await this.execute(`
      UPDATE memory 
      SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
      WHERE key = ? AND namespace = ?
    `, [key, namespace]);

    const results = await this.query(`
      SELECT * FROM memory 
      WHERE key = ? AND namespace = ? 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `, [key, namespace]);
    
    return results[0] || null;
  }

  async queryMemory(options: {
    namespace?: string;
    pattern?: string;
    tags?: string[];
    limit?: number;
    sortBy?: string;
  }): Promise<any[]> {
    let sql = `
      SELECT * FROM memory 
      WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const params: any[] = [];

    if (options.namespace) {
      sql += ' AND namespace = ?';
      params.push(options.namespace);
    }

    if (options.pattern) {
      sql += ' AND (key LIKE ? OR value LIKE ?)';
      params.push(`%${options.pattern}%`, `%${options.pattern}%`);
    }

    if (options.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      options.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    if (options.sortBy) {
      const sortColumn = options.sortBy === 'recent' ? 'last_accessed_at' :
                        options.sortBy === 'created' ? 'created_at' :
                        options.sortBy === 'importance' ? 'importance_score' :
                        'access_count';
      sql += ` ORDER BY ${sortColumn} DESC`;
    } else {
      sql += ' ORDER BY last_accessed_at DESC';
    }

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return await this.query(sql, params);
  }

  async deleteMemory(key: string, namespace: string = 'default'): Promise<void> {
    await this.execute('DELETE FROM memory WHERE key = ? AND namespace = ?', [key, namespace]);
  }

  async getMemoryStats(): Promise<any> {
    const results = await this.query(`
      SELECT 
        COUNT(*) as total_entries,
        SUM(LENGTH(value)) as total_size,
        namespace,
        COUNT(*) as entries,
        AVG(access_count) as avg_access_count,
        AVG(importance_score) as avg_importance
      FROM memory 
      WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      GROUP BY namespace
    `);

    const overall = await this.query(`
      SELECT 
        COUNT(*) as total_entries,
        SUM(LENGTH(value)) as total_size,
        AVG(access_count) as avg_access_count
      FROM memory 
      WHERE (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `);

    return {
      overall: overall[0] || { total_entries: 0, total_size: 0, avg_access_count: 0 },
      byNamespace: results
    };
  }

  // === COMMUNICATION OPERATIONS ===

  async storeMessage(message: Message): Promise<void> {
    await this.execute(`
      INSERT INTO communications (
        from_agent_id, to_agent_id, swarm_id, message_type, content,
        priority, requires_response, timestamp, channel_name, encryption_key, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      message.fromAgentId,
      message.toAgentId,
      message.swarmId,
      message.type,
      JSON.stringify(message.content),
      message.priority || 'normal',
      message.requiresResponse ? 1 : 0,
      message.timestamp.toISOString(),
      message.channelName || null,
      message.encryptionKey || null,
      JSON.stringify(message.metadata || {})
    ]);
  }

  async getMessages(swarmId: string, limit: number = 100): Promise<any[]> {
    return await this.query(`
      SELECT * FROM communications 
      WHERE swarm_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [swarmId, limit]);
  }

  // === CONSENSUS OPERATIONS ===

  async createConsensusProposal(proposal: ConsensusProposal): Promise<void> {
    await this.execute(`
      INSERT INTO consensus (
        id, swarm_id, task_id, proposal, required_threshold,
        deadline_at, voting_strategy, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      proposal.id,
      proposal.swarmId,
      proposal.taskId || null,
      JSON.stringify(proposal.proposal),
      proposal.requiredThreshold,
      proposal.deadline?.toISOString() || null,
      proposal.votingStrategy,
      JSON.stringify(proposal.metadata || {})
    ]);
  }

  async recordConsensusVote(vote: ConsensusVote): Promise<void> {
    // Get current votes
    const proposal = await this.query('SELECT votes FROM consensus WHERE id = ?', [vote.proposalId]);
    if (!proposal[0]) throw new Error('Proposal not found');

    const votes = JSON.parse(proposal[0].votes || '{}');
    votes[vote.agentId] = {
      vote: vote.vote,
      reason: vote.reason,
      timestamp: vote.timestamp.toISOString(),
      confidence: vote.confidence,
      weight: vote.weight
    };

    await this.execute(`
      UPDATE consensus 
      SET votes = ?, current_votes = current_votes + 1
      WHERE id = ?
    `, [JSON.stringify(votes), vote.proposalId]);
  }

  // === PERFORMANCE METRICS ===

  async recordMetric(metric: PerformanceMetric): Promise<void> {
    await this.execute(`
      INSERT INTO performance_metrics (
        swarm_id, agent_id, metric_type, metric_value, timestamp,
        metadata, category, unit, aggregation_period
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      metric.swarmId,
      metric.agentId || null,
      metric.metricType,
      metric.metricValue,
      metric.timestamp.toISOString(),
      JSON.stringify(metric.metadata || {}),
      metric.category,
      metric.unit,
      metric.aggregationPeriod
    ]);
  }

  // === NEURAL PATTERNS ===

  async storeNeuralPattern(pattern: NeuralPattern): Promise<void> {
    await this.execute(`
      INSERT OR REPLACE INTO neural_patterns (
        id, swarm_id, pattern_type, pattern_data, confidence,
        usage_count, success_rate, created_at, last_used_at, metadata, training_data,
        model_version, validation_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      pattern.id,
      pattern.swarm_id,
      pattern.pattern_type,
      pattern.pattern_data,
      pattern.confidence,
      pattern.usage_count,
      pattern.success_rate,
      pattern.created_at,
      pattern.last_used_at || null,
      pattern.metadata || '{}',
      pattern.training_data || '{}',
      pattern.model_version,
      pattern.validation_score
    ]);
  }

  async getNeuralPatterns(swarmId: string, patternType?: string): Promise<NeuralPattern[]> {
    let sql = 'SELECT * FROM neural_patterns WHERE swarm_id = ?';
    const params = [swarmId];

    if (patternType) {
      sql += ' AND pattern_type = ?';
      params.push(patternType);
    }

    sql += ' ORDER BY confidence DESC, success_rate DESC';
    return await this.query(sql, params);
  }

  async getNeuralPattern(patternId: string): Promise<NeuralPattern | null> {
    const results = await this.query('SELECT * FROM neural_patterns WHERE id = ?', [patternId]);
    return results[0] || null;
  }

  async updateNeuralPatternUsage(patternId: string, success: boolean): Promise<void> {
    await this.execute(`
      UPDATE neural_patterns 
      SET usage_count = usage_count + 1,
          success_rate = (success_rate * usage_count + ?) / (usage_count + 1),
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [success ? 1 : 0, patternId]);
  }

  async cleanupNeuralPatterns(swarmId: string, minConfidence: number): Promise<void> {
    await this.execute(`
      DELETE FROM neural_patterns 
      WHERE swarm_id = ? AND confidence < ?
    `, [swarmId, minConfidence]);
  }

  async deleteNeuralPattern(patternId: string): Promise<void> {
    await this.execute('DELETE FROM neural_patterns WHERE id = ?', [patternId]);
  }

  // === CLEANUP OPERATIONS ===

  async cleanupExpiredMemory(): Promise<number> {
    const result = await this.execute('DELETE FROM memory WHERE expires_at < CURRENT_TIMESTAMP');
    return result.changes || 0;
  }

  async cleanupOldMetrics(daysToKeep: number = 30): Promise<number> {
    const result = await this.execute(`
      DELETE FROM performance_metrics 
      WHERE timestamp < datetime('now', '-${daysToKeep} days')
    `);
    return result.changes || 0;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    const stats = await this.query(`
      SELECT 
        (SELECT COUNT(*) FROM swarms) as swarms,
        (SELECT COUNT(*) FROM agents) as agents,
        (SELECT COUNT(*) FROM tasks) as tasks,
        (SELECT COUNT(*) FROM memory) as memory_entries,
        (SELECT COUNT(*) FROM communications) as messages,
        (SELECT COUNT(*) FROM consensus) as consensus_proposals,
        (SELECT COUNT(*) FROM performance_metrics) as metrics,
        (SELECT COUNT(*) FROM neural_patterns) as neural_patterns,
        (SELECT COUNT(*) FROM hooks) as hooks,
        (SELECT COUNT(*) FROM workflows) as workflows,
        (SELECT COUNT(*) FROM security_events) as security_events
    `);

    return stats[0] || {};
  }
} 