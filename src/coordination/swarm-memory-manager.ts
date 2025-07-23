import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { generateId } from '../utils/helpers.js';
import type { CLILogger } from '../cli/core/application.js';

// For now, we'll use a simple in-memory implementation
// In a full implementation, this would use SQLite
export interface MemoryEntry {
  id: string;
  key: string;
  value: any;
  namespace: string;
  type: 'data' | 'knowledge' | 'pattern' | 'learning' | 'context';
  tags: string[];
  metadata: {
    source?: string;
    agentId?: string;
    confidence?: number;
    version?: number;
    accessCount?: number;
    lastAccessed?: Date;
    created: Date;
    updated: Date;
  };
  expiresAt?: Date;
  relationships: string[]; // IDs of related entries
}

export interface KnowledgePattern {
  id: string;
  pattern: string;
  frequency: number;
  contexts: string[];
  effectiveness: number;
  lastUsed: Date;
  metadata: Record<string, any>;
}

export interface SwarmMemoryOptions {
  namespace: string;
  enableDistribution: boolean;
  enableKnowledgeBase: boolean;
  persistencePath: string;
  maxMemorySize?: number;
  defaultTTL?: number; // Time to live in milliseconds
  enablePatternLearning?: boolean;
  syncInterval?: number;
}

export class SwarmMemoryManager extends EventEmitter {
  private memory = new Map<string, MemoryEntry>();
  private knowledgeBase = new Map<string, KnowledgePattern>();
  private namespaceIndex = new Map<string, Set<string>>();
  private tagIndex = new Map<string, Set<string>>();
  private typeIndex = new Map<string, Set<string>>();
  private options: SwarmMemoryOptions;
  private logger?: CLILogger;
  private isInitialized = false;
  private syncTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: SwarmMemoryOptions, logger?: CLILogger) {
    super();
    this.options = {
      maxMemorySize: 10000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      enablePatternLearning: true,
      syncInterval: 30000, // 30 seconds
      ...options,
    };
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger?.info('Initializing SwarmMemoryManager', { options: this.options });

    // Create persistence directory
    await fs.mkdir(this.options.persistencePath, { recursive: true });

    // Load persisted data
    await this.loadFromPersistence();

    // Start sync timer if distribution enabled
    if (this.options.enableDistribution && this.options.syncInterval) {
      this.startSyncTimer();
    }

    // Start cleanup timer
    this.startCleanupTimer();

    this.isInitialized = true;
    this.emit('initialized');

    this.logger?.info('SwarmMemoryManager initialized', { 
      memoryEntries: this.memory.size,
      knowledgePatterns: this.knowledgeBase.size 
    });
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger?.info('Shutting down SwarmMemoryManager');

    // Stop timers
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Save to persistence
    await this.saveToPersistence();

    this.isInitialized = false;
    this.emit('shutdown');
  }

  async store(key: string, value: any, options?: {
    type?: MemoryEntry['type'];
    tags?: string[];
    namespace?: string;
    ttl?: number;
    metadata?: Partial<MemoryEntry['metadata']>;
    relationships?: string[];
  }): Promise<string> {
    const entryId = generateId('mem');
    const now = new Date();
    const namespace = options?.namespace || this.options.namespace;
    const ttl = options?.ttl || this.options.defaultTTL!;

    const entry: MemoryEntry = {
      id: entryId,
      key,
      value,
      namespace,
      type: options?.type || 'data',
      tags: options?.tags || [],
      metadata: {
        version: 1,
        accessCount: 0,
        created: now,
        updated: now,
        ...options?.metadata,
      },
      expiresAt: ttl ? new Date(now.getTime() + ttl) : undefined,
      relationships: options?.relationships || [],
    };

    this.memory.set(entryId, entry);
    this.updateIndexes(entry);

    // Learn patterns if enabled
    if (this.options.enablePatternLearning) {
      this.learnFromEntry(entry);
    }

    this.logger?.debug('Memory entry stored', { entryId, key, namespace, type: entry.type });
    this.emit('entryStored', entry);

    // Check memory limits
    this.enforceMemoryLimits();

    return entryId;
  }

  async retrieve(key: string, namespace?: string): Promise<MemoryEntry | null> {
    const targetNamespace = namespace || this.options.namespace;
    
    // Find entry by key and namespace
    for (const entry of this.memory.values()) {
      if (entry.key === key && entry.namespace === targetNamespace) {
        // Check if expired
        if (entry.expiresAt && entry.expiresAt < new Date()) {
          await this.delete(entry.id);
          return null;
        }

        // Update access metadata
        entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
        entry.metadata.lastAccessed = new Date();

        this.logger?.debug('Memory entry retrieved', { 
          entryId: entry.id, 
          key, 
          namespace: targetNamespace 
        });

        this.emit('entryAccessed', entry);
        return { ...entry }; // Return copy
      }
    }

    return null;
  }

  async retrieveById(entryId: string): Promise<MemoryEntry | null> {
    const entry = this.memory.get(entryId);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      await this.delete(entryId);
      return null;
    }

    // Update access metadata
    entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
    entry.metadata.lastAccessed = new Date();

    this.emit('entryAccessed', entry);
    return { ...entry }; // Return copy
  }

  async update(entryId: string, updates: Partial<Pick<MemoryEntry, 'value' | 'tags' | 'metadata'>>): Promise<boolean> {
    const entry = this.memory.get(entryId);
    if (!entry) {
      return false;
    }

    // Update entry
    if (updates.value !== undefined) {
      entry.value = updates.value;
    }
    if (updates.tags !== undefined) {
      entry.tags = updates.tags;
    }
    if (updates.metadata !== undefined) {
      entry.metadata = { ...entry.metadata, ...updates.metadata };
    }

    entry.metadata.updated = new Date();
    entry.metadata.version = (entry.metadata.version || 1) + 1;

    this.updateIndexes(entry);

    this.logger?.debug('Memory entry updated', { entryId });
    this.emit('entryUpdated', entry);

    return true;
  }

  async delete(entryId: string): Promise<boolean> {
    const entry = this.memory.get(entryId);
    if (!entry) {
      return false;
    }

    this.memory.delete(entryId);
    this.removeFromIndexes(entry);

    this.logger?.debug('Memory entry deleted', { entryId });
    this.emit('entryDeleted', { entryId, entry });

    return true;
  }

  async query(options: {
    namespace?: string;
    type?: MemoryEntry['type'];
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<MemoryEntry[]> {
    let results = Array.from(this.memory.values());

    // Filter by namespace
    if (options.namespace) {
      results = results.filter(entry => entry.namespace === options.namespace);
    }

    // Filter by type
    if (options.type) {
      results = results.filter(entry => entry.type === options.type);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(entry => 
        options.tags!.some(tag => entry.tags.includes(tag))
      );
    }

    // Search in key and value
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      results = results.filter(entry => 
        entry.key.toLowerCase().includes(searchLower) ||
        JSON.stringify(entry.value).toLowerCase().includes(searchLower)
      );
    }

    // Remove expired entries
    const now = new Date();
    results = results.filter(entry => !entry.expiresAt || entry.expiresAt > now);

    // Sort by access count and recency
    results.sort((a, b) => {
      const aScore = (a.metadata.accessCount || 0) + (a.metadata.lastAccessed ? 1 : 0);
      const bScore = (b.metadata.accessCount || 0) + (b.metadata.lastAccessed ? 1 : 0);
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      return b.metadata.updated.getTime() - a.metadata.updated.getTime();
    });

    // Apply pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results.map(entry => ({ ...entry })); // Return copies
  }

  async getRelated(entryId: string, depth: number = 1): Promise<MemoryEntry[]> {
    const visited = new Set<string>();
    const related: MemoryEntry[] = [];

    const collectRelated = async (id: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(id)) {
        return;
      }

      visited.add(id);
      const entry = await this.retrieveById(id);
      if (!entry) {
        return;
      }

      if (currentDepth > 0) {
        related.push(entry);
      }

      // Follow relationships
      for (const relatedId of entry.relationships) {
        await collectRelated(relatedId, currentDepth + 1);
      }
    };

    await collectRelated(entryId, 0);
    return related;
  }

  async createRelationship(entryId1: string, entryId2: string): Promise<boolean> {
    const entry1 = this.memory.get(entryId1);
    const entry2 = this.memory.get(entryId2);

    if (!entry1 || !entry2) {
      return false;
    }

    // Add bidirectional relationships
    if (!entry1.relationships.includes(entryId2)) {
      entry1.relationships.push(entryId2);
    }
    if (!entry2.relationships.includes(entryId1)) {
      entry2.relationships.push(entryId1);
    }

    this.emit('relationshipCreated', { entryId1, entryId2 });
    return true;
  }

  async learnPattern(pattern: string, context: string, effectiveness: number = 1.0): Promise<string> {
    const existing = Array.from(this.knowledgeBase.values()).find(p => p.pattern === pattern);

    if (existing) {
      // Update existing pattern
      existing.frequency++;
      existing.effectiveness = (existing.effectiveness + effectiveness) / 2;
      existing.lastUsed = new Date();
      if (!existing.contexts.includes(context)) {
        existing.contexts.push(context);
      }
      
      this.emit('patternUpdated', existing);
      return existing.id;
    } else {
      // Create new pattern
      const patternId = generateId('pattern');
      const knowledgePattern: KnowledgePattern = {
        id: patternId,
        pattern,
        frequency: 1,
        contexts: [context],
        effectiveness,
        lastUsed: new Date(),
        metadata: { created: new Date() },
      };

      this.knowledgeBase.set(patternId, knowledgePattern);
      
      this.emit('patternLearned', knowledgePattern);
      return patternId;
    }
  }

  async getPatterns(context?: string, minEffectiveness?: number): Promise<KnowledgePattern[]> {
    let patterns = Array.from(this.knowledgeBase.values());

    if (context) {
      patterns = patterns.filter(p => p.contexts.includes(context));
    }

    if (minEffectiveness !== undefined) {
      patterns = patterns.filter(p => p.effectiveness >= minEffectiveness);
    }

    // Sort by effectiveness and frequency
    patterns.sort((a, b) => {
      const aScore = a.effectiveness * Math.log(a.frequency + 1);
      const bScore = b.effectiveness * Math.log(b.frequency + 1);
      return bScore - aScore;
    });

    return patterns;
  }

  getMemoryStats(): any {
    const namespaces = new Set(Array.from(this.memory.values()).map(e => e.namespace));
    const types = new Set(Array.from(this.memory.values()).map(e => e.type));
    
    return {
      totalEntries: this.memory.size,
      totalPatterns: this.knowledgeBase.size,
      namespaces: Array.from(namespaces),
      types: Array.from(types),
      memorySize: this.calculateMemorySize(),
      oldestEntry: this.getOldestEntry(),
      newestEntry: this.getNewestEntry(),
      mostAccessed: this.getMostAccessedEntry(),
    };
  }

  private updateIndexes(entry: MemoryEntry): void {
    // Update namespace index
    if (!this.namespaceIndex.has(entry.namespace)) {
      this.namespaceIndex.set(entry.namespace, new Set());
    }
    this.namespaceIndex.get(entry.namespace)!.add(entry.id);

    // Update type index
    if (!this.typeIndex.has(entry.type)) {
      this.typeIndex.set(entry.type, new Set());
    }
    this.typeIndex.get(entry.type)!.add(entry.id);

    // Update tag index
    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(entry.id);
    }
  }

  private removeFromIndexes(entry: MemoryEntry): void {
    // Remove from namespace index
    this.namespaceIndex.get(entry.namespace)?.delete(entry.id);

    // Remove from type index
    this.typeIndex.get(entry.type)?.delete(entry.id);

    // Remove from tag index
    for (const tag of entry.tags) {
      this.tagIndex.get(tag)?.delete(entry.id);
    }
  }

  private learnFromEntry(entry: MemoryEntry): void {
    if (!this.options.enablePatternLearning) {
      return;
    }

    // Extract patterns from the entry
    const patterns = this.extractPatterns(entry);
    
    for (const pattern of patterns) {
      this.learnPattern(pattern, entry.namespace);
    }
  }

  private extractPatterns(entry: MemoryEntry): string[] {
    const patterns: string[] = [];

    // Extract key patterns
    if (entry.key.includes('/')) {
      patterns.push(`key_structure:${entry.key.split('/')[0]}`);
    }

    // Extract type patterns
    patterns.push(`type:${entry.type}`);

    // Extract tag patterns
    for (const tag of entry.tags) {
      patterns.push(`tag:${tag}`);
    }

    // Extract value patterns (basic)
    if (typeof entry.value === 'object' && entry.value !== null) {
      patterns.push(`value_type:object`);
      if (Array.isArray(entry.value)) {
        patterns.push(`value_type:array`);
      }
    } else {
      patterns.push(`value_type:${typeof entry.value}`);
    }

    return patterns;
  }

  private enforceMemoryLimits(): void {
    if (!this.options.maxMemorySize || this.memory.size <= this.options.maxMemorySize) {
      return;
    }

    // Remove least recently used entries
    const entries = Array.from(this.memory.values());
    entries.sort((a, b) => {
      const aTime = a.metadata.lastAccessed?.getTime() || a.metadata.created.getTime();
      const bTime = b.metadata.lastAccessed?.getTime() || b.metadata.created.getTime();
      return aTime - bTime; // Oldest first
    });

    const toRemove = entries.slice(0, this.memory.size - this.options.maxMemorySize);
    for (const entry of toRemove) {
      this.delete(entry.id);
    }

    this.logger?.info('Memory limit enforced', { 
      removed: toRemove.length, 
      remaining: this.memory.size 
    });
  }

  private async cleanupExpiredEntries(): Promise<void> {
    const now = new Date();
    const expiredIds: string[] = [];

    for (const [id, entry] of this.memory.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      await this.delete(id);
    }

    if (expiredIds.length > 0) {
      this.logger?.debug('Cleaned up expired entries', { count: expiredIds.length });
    }
  }

  private calculateMemorySize(): number {
    // Rough estimate of memory usage
    let size = 0;
    for (const entry of this.memory.values()) {
      size += JSON.stringify(entry).length;
    }
    return size;
  }

  private getOldestEntry(): MemoryEntry | null {
    let oldest: MemoryEntry | null = null;
    for (const entry of this.memory.values()) {
      if (!oldest || entry.metadata.created < oldest.metadata.created) {
        oldest = entry;
      }
    }
    return oldest;
  }

  private getNewestEntry(): MemoryEntry | null {
    let newest: MemoryEntry | null = null;
    for (const entry of this.memory.values()) {
      if (!newest || entry.metadata.created > newest.metadata.created) {
        newest = entry;
      }
    }
    return newest;
  }

  private getMostAccessedEntry(): MemoryEntry | null {
    let mostAccessed: MemoryEntry | null = null;
    for (const entry of this.memory.values()) {
      if (!mostAccessed || (entry.metadata.accessCount || 0) > (mostAccessed.metadata.accessCount || 0)) {
        mostAccessed = entry;
      }
    }
    return mostAccessed;
  }

  private async loadFromPersistence(): Promise<void> {
    try {
      // Load memory entries
      const memoryFile = path.join(this.options.persistencePath, 'memory.json');
      try {
        const data = await fs.readFile(memoryFile, 'utf-8');
        const entries = JSON.parse(data);
        
        for (const entryData of entries) {
          // Convert date strings back to Date objects
          entryData.metadata.created = new Date(entryData.metadata.created);
          entryData.metadata.updated = new Date(entryData.metadata.updated);
          if (entryData.metadata.lastAccessed) {
            entryData.metadata.lastAccessed = new Date(entryData.metadata.lastAccessed);
          }
          if (entryData.expiresAt) {
            entryData.expiresAt = new Date(entryData.expiresAt);
          }

          this.memory.set(entryData.id, entryData);
          this.updateIndexes(entryData);
        }
      } catch {
        // File doesn't exist, that's ok
      }

      // Load knowledge base
      const knowledgeFile = path.join(this.options.persistencePath, 'knowledge.json');
      try {
        const data = await fs.readFile(knowledgeFile, 'utf-8');
        const patterns = JSON.parse(data);
        
        for (const patternData of patterns) {
          patternData.lastUsed = new Date(patternData.lastUsed);
          if (patternData.metadata.created) {
            patternData.metadata.created = new Date(patternData.metadata.created);
          }
          
          this.knowledgeBase.set(patternData.id, patternData);
        }
      } catch {
        // File doesn't exist, that's ok
      }

      this.logger?.info('Loaded persisted memory data', { 
        entries: this.memory.size,
        patterns: this.knowledgeBase.size 
      });

    } catch (error) {
      this.logger?.error('Failed to load persisted memory data', { error });
    }
  }

  private async saveToPersistence(): Promise<void> {
    try {
      // Save memory entries
      const memoryFile = path.join(this.options.persistencePath, 'memory.json');
      const entries = Array.from(this.memory.values());
      await fs.writeFile(memoryFile, JSON.stringify(entries, null, 2));

      // Save knowledge base
      const knowledgeFile = path.join(this.options.persistencePath, 'knowledge.json');
      const patterns = Array.from(this.knowledgeBase.values());
      await fs.writeFile(knowledgeFile, JSON.stringify(patterns, null, 2));

      this.logger?.debug('Saved memory data to persistence', { 
        entries: entries.length,
        patterns: patterns.length 
      });

    } catch (error) {
      this.logger?.error('Failed to save memory data to persistence', { error });
    }
  }

  private startSyncTimer(): void {
    this.syncTimer = setInterval(async () => {
      await this.saveToPersistence();
    }, this.options.syncInterval);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute
  }
} 