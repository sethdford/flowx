/**
 * SQL.ts-based memory backend for cross-platform compatibility
 */

import { MemoryEntry, MemoryQuery } from "../../utils/types.js";
import { IMemoryBackend } from "./base.js";
import { ILogger } from "../../core/logger.js";
import { MemoryError } from "../../utils/errors.js";
import * as fs from 'fs';
import * as path from 'path';

// Import sql.ts with dynamic import for ES module compatibility
// @ts-ignore - sql.ts doesn't have proper TypeScript declarations
let initSqlJs: any;

export class SqlJsBackend implements IMemoryBackend {
  private db: any = null;
  private SQL: any = null;
  private dbPath: string;

  constructor(
    dbPath: string,
    private logger: ILogger,
  ) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing SQL.ts backend...', { dbPath: this.dbPath });

    try {
      // Dynamically import sql.ts for ES module compatibility
      if (!initSqlJs) {
        // @ts-ignore - sql.ts doesn't have proper TypeScript declarations
        const sqlJsModule = await import('sql.ts');
        initSqlJs = sqlJsModule.default || sqlJsModule;
      }
      
      // Initialize SQL.ts
      this.SQL = await initSqlJs({
        // For Node.ts, we don't need to specify locateFile
      });

      // Check if database file exists
      let data: Uint8Array | undefined;
      if (fs.existsSync(this.dbPath)) {
        this.logger.info('Loading existing database file');
        data = fs.readFileSync(this.dbPath);
      }

      // Create or load database
      this.db = new this.SQL.Database(data);

      // Create tables if they don't exist
      await this.createTables();

      this.logger.info('SQL.ts backend initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SQL.ts backend', error);
      throw new MemoryError('SQL.ts backend initialization failed', { error });
    }
  }

  async shutdown(): Promise<void> {
    if (this.db) {
      try {
        // Save database to file
        await this.saveDatabase();
        
        // Close database
        this.db.close();
        this.db = null;
        
        this.logger.info('SQL.ts backend shutdown successfully');
      } catch (error) {
        this.logger.error('Error during SQL.ts backend shutdown', error);
        throw error;
      }
    }
  }

  async store(entry: MemoryEntry): Promise<void> {
    if (!this.db) {
      throw new MemoryError('SQL.ts backend not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memory_entries (
          id, agent_id, session_id, type, content, context, timestamp, tags, version, parent_id, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        entry.id,
        entry.agentId,
        entry.sessionId,
        entry.type,
        entry.content,
        JSON.stringify(entry.context || {}),
        entry.timestamp.toISOString(),
        JSON.stringify(entry.tags || []),
        entry.version || 1,
        entry.parentId || null,
        JSON.stringify(entry.metadata || {}),
      ]);

      stmt.free();

      // Auto-save periodically
      await this.saveDatabase();
      
      this.logger.debug('Memory entry stored', { id: entry.id });
    } catch (error) {
      this.logger.error('Failed to store memory entry', { id: entry.id, error });
      throw new MemoryError('Failed to store memory entry', { error });
    }
  }

  async retrieve(id: string): Promise<MemoryEntry | undefined> {
    if (!this.db) {
      throw new MemoryError('SQL.ts backend not initialized');
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM memory_entries WHERE id = ?');
      stmt.bind([id]);
      
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return this.mapRowToEntry(row);
      }
      
      stmt.free();
      return undefined;
    } catch (error) {
      this.logger.error('Failed to retrieve memory entry', { id, error });
      throw new MemoryError('Failed to retrieve memory entry', { error });
    }
  }

  async update(id: string, entry: MemoryEntry): Promise<void> {
    if (!this.db) {
      throw new MemoryError('SQL.ts backend not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE memory_entries 
        SET agent_id = ?, session_id = ?, type = ?, content = ?, context = ?, timestamp = ?, tags = ?, version = ?, parent_id = ?, metadata = ?
        WHERE id = ?
      `);

      stmt.run([
        entry.agentId,
        entry.sessionId,
        entry.type,
        entry.content,
        JSON.stringify(entry.context || {}),
        entry.timestamp.toISOString(),
        JSON.stringify(entry.tags || []),
        entry.version || 1,
        entry.parentId || null,
        JSON.stringify(entry.metadata || {}),
        id,
      ]);

      stmt.free();

      // Auto-save
      await this.saveDatabase();
      
      this.logger.debug('Memory entry updated', { id });
    } catch (error) {
      this.logger.error('Failed to update memory entry', { id, error });
      throw new MemoryError('Failed to update memory entry', { error });
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.db) {
      throw new MemoryError('SQL.ts backend not initialized');
    }

    try {
      const stmt = this.db.prepare('DELETE FROM memory_entries WHERE id = ?');
      stmt.run([id]);
      stmt.free();

      // Auto-save
      await this.saveDatabase();
      
      this.logger.debug('Memory entry deleted', { id });
    } catch (error) {
      this.logger.error('Failed to delete memory entry', { id, error });
      throw new MemoryError('Failed to delete memory entry', { error });
    }
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (!this.db) {
      throw new MemoryError('SQL.ts backend not initialized');
    }

    try {
      let sql = 'SELECT * FROM memory_entries WHERE 1=1';
      const params: any[] = [];

      // Add filters
      if (query.agentId) {
        sql += ' AND agent_id = ?';
        params.push(query.agentId);
      }

      if (query.sessionId) {
        sql += ' AND session_id = ?';
        params.push(query.sessionId);
      }

      if (query.type) {
        sql += ' AND type = ?';
        params.push(query.type);
      }

      if (query.tags && query.tags.length > 0) {
        const tagConditions = query.tags.map(() => 'tags LIKE ?').join(' AND ');
        sql += ` AND (${tagConditions})`;
        params.push(...query.tags.map(tag => `%"${tag}"%`));
      }

      if (query.search) {
        sql += ' AND content LIKE ?';
        params.push(`%${query.search}%`);
      }

      if (query.startTime) {
        sql += ' AND timestamp >= ?';
        params.push(query.startTime.toISOString());
      }

      if (query.endTime) {
        sql += ' AND timestamp <= ?';
        params.push(query.endTime.toISOString());
      }

      // Add ordering
      sql += ' ORDER BY timestamp DESC';

      // Add limit and offset
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);
      }

      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }

      const stmt = this.db.prepare(sql);
      stmt.bind(params);

      const results: MemoryEntry[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(this.mapRowToEntry(row));
      }

      stmt.free();
      return results;
    } catch (error) {
      this.logger.error('Failed to query memory entries', { query, error });
      throw new MemoryError('Failed to query memory entries', { error });
    }
  }

  async getAllEntries(): Promise<MemoryEntry[]> {
    if (!this.db) {
      throw new MemoryError('SQL.ts backend not initialized');
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM memory_entries ORDER BY timestamp DESC');
      
      const results: MemoryEntry[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(this.mapRowToEntry(row));
      }

      stmt.free();
      return results;
    } catch (error) {
      this.logger.error('Failed to get all memory entries', error);
      throw new MemoryError('Failed to get all memory entries', { error });
    }
  }

  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    try {
      if (!this.db) {
        return { healthy: false, error: 'Database not initialized' };
      }

      // Get basic metrics
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM memory_entries');
      countStmt.step();
      const countResult = countStmt.getAsObject();
      countStmt.free();

      const sizeStmt = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
      sizeStmt.step();
      const sizeResult = sizeStmt.getAsObject();
      sizeStmt.free();

      return {
        healthy: true,
        metrics: {
          entryCount: countResult.count as number,
          databaseSize: sizeResult.size as number,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get health status', error);
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async performMaintenance?(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      // Vacuum database to reclaim space
      this.db.exec('VACUUM');
      
      // Save database
      await this.saveDatabase();
      
      this.logger.debug('SQL.ts backend maintenance completed');
    } catch (error) {
      this.logger.error('Failed to perform maintenance', error);
    }
  }

  private async createTables(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        context TEXT,
        timestamp TEXT NOT NULL,
        tags TEXT,
        version INTEGER DEFAULT 1,
        parent_id TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_agent_id ON memory_entries(agent_id);
      CREATE INDEX IF NOT EXISTS idx_session_id ON memory_entries(session_id);
      CREATE INDEX IF NOT EXISTS idx_type ON memory_entries(type);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON memory_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_parent_id ON memory_entries(parent_id);
    `;

    this.db.exec(createTableSQL);
  }

  private async saveDatabase(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      // Export database as Uint8Array
      const data = this.db.export();
      
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write to file
      fs.writeFileSync(this.dbPath, data);
    } catch (error) {
      this.logger.error('Failed to save database', error);
      throw new MemoryError('Failed to save database', { error });
    }
  }

  private mapRowToEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      agentId: row.agent_id,
      sessionId: row.session_id,
      type: row.type,
      content: row.content,
      context: row.context ? JSON.parse(row.context) : {},
      timestamp: new Date(row.timestamp),
      tags: row.tags ? JSON.parse(row.tags) : [],
      version: row.version || 1,
      parentId: row.parent_id || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    };
  }
} 