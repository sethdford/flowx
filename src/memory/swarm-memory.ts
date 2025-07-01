import { EventEmitter } from 'node:events';
import { Logger } from "../core/logger.ts";
import { generateId } from "../utils/helpers.ts";
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface SwarmMemoryEntry {
  id: string;
  agentId: string;
  type: 'knowledge' | 'result' | 'state' | 'communication' | 'error';
  content: any;
  timestamp: Date;
  metadata: {
    taskId?: string;
    objectiveId?: string;
    tags?: string[];
    priority?: number;
    shareLevel?: 'private' | 'team' | 'public';
    originalId?: string;
    sharedFrom?: string;
    sharedTo?: string;
    sharedAt?: Date;
  };
}

export interface SwarmMemoryQuery {
  agentId?: string;
  type?: SwarmMemoryEntry['type'];
  taskId?: string;
  objectiveId?: string;
  tags?: string[];
  since?: Date;
  before?: Date;
  limit?: number;
  shareLevel?: SwarmMemoryEntry['metadata']['shareLevel'];
}

export interface SwarmKnowledgeBase {
  id: string;
  name: string;
  description: string;
  entries: SwarmMemoryEntry[];
  metadata: {
    domain: string;
    expertise: string[];
    contributors: string[];
    lastUpdated: Date;
  };
}

export interface SwarmMemoryConfig {
  namespace: string;
  enableDistribution: boolean;
  enableReplication: boolean;
  syncInterval: number;
  maxEntries: number;
  compressionThreshold: number;
  enableKnowledgeBase: boolean;
  enableCrossAgentSharing: boolean;
  persistencePath: string;
}

export class SwarmMemoryManager extends EventEmitter {
  private logger: Logger;
  private config: SwarmMemoryConfig;
  private entries: Map<string, SwarmMemoryEntry>;
  private knowledgeBases: Map<string, SwarmKnowledgeBase>;
  private agentMemories: Map<string, Set<string>>; // agentId -> set of entry IDs
  private syncTimer?: any;
  private isInitialized: boolean = false;

  constructor(config: Partial<SwarmMemoryConfig> = {}) {
    super();
    this.logger = new Logger({ level: 'info', format: 'text', destination: 'console' });
    this.config = {
      namespace: 'swarm',
      enableDistribution: true,
      enableReplication: true,
      syncInterval: 10000, // 10 seconds
      maxEntries: 10000,
      compressionThreshold: 1000,
      enableKnowledgeBase: true,
      enableCrossAgentSharing: true,
      persistencePath: './swarm-memory',
      ...config
    };

    this.entries = new Map();
    this.knowledgeBases = new Map();
    this.agentMemories = new Map();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.logger.info('Initializing swarm memory manager...');

    // Create persistence directory
    await fs.mkdir(this.config.persistencePath, { recursive: true });

    // Load existing memory
    await this.loadMemoryState();

    // Start sync timer
    if (this.config.syncInterval > 0) {
      this.syncTimer = setInterval(() => {
        this.syncMemoryState();
      }, this.config.syncInterval);
    }

    this.isInitialized = true;
    this.emit('memory:initialized');
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Shutting down swarm memory manager...');

    // Stop sync timer
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }

    // Save final state
    await this.saveMemoryState();

    this.isInitialized = false;
    this.emit('memory:shutdown');
  }

  async remember(
    agentId: string,
    type: SwarmMemoryEntry['type'],
    content: any,
    metadata: Partial<SwarmMemoryEntry['metadata']> = {}
  ): Promise<string> {
    const entryId = generateId('mem');
    const entry: SwarmMemoryEntry = {
      id: entryId,
      agentId,
      type,
      content,
      timestamp: new Date(),
      metadata: {
        shareLevel: 'team',
        priority: 1,
        ...metadata
      }
    };

    this.entries.set(entryId, entry);

    // Associate with agent
    if (!this.agentMemories.has(agentId)) {
      this.agentMemories.set(agentId, new Set());
    }
    this.agentMemories.get(agentId)!.add(entryId);

    this.logger.debug(`Agent ${agentId} remembered: ${type} - ${entryId}`);
    this.emit('memory:added', entry);

    // Update knowledge base if applicable
    if (type === 'knowledge' && this.config.enableKnowledgeBase) {
      await this.updateKnowledgeBase(entry);
    }

    // Check for memory limits
    await this.enforceMemoryLimits();

    return entryId;
  }

  async recall(query: SwarmMemoryQuery): Promise<SwarmMemoryEntry[]> {
    let results = Array.from(this.entries.values());

    // Apply filters
    if (query.agentId) {
      results = results.filter(e => e.agentId === query.agentId);
    }

    if (query.type) {
      results = results.filter(e => e.type === query.type);
    }

    if (query.taskId) {
      results = results.filter(e => e.metadata.taskId === query.taskId);
    }

    if (query.objectiveId) {
      results = results.filter(e => e.metadata.objectiveId === query.objectiveId);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(e => 
        e.metadata.tags?.some(tag => query.tags!.includes(tag))
      );
    }

    if (query.since) {
      results = results.filter(e => e.timestamp >= query.since!);
    }

    if (query.before) {
      results = results.filter(e => e.timestamp <= query.before!);
    }

    if (query.shareLevel) {
      results = results.filter(e => e.metadata.shareLevel === query.shareLevel);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async shareMemory(entryId: string, targetAgentId: string): Promise<void> {
    const entry = this.entries.get(entryId);
    if (!entry) {
      throw new Error('Memory entry not found');
    }

    if (entry.metadata.shareLevel === 'private') {
      throw new Error('Cannot share private memory');
    }

    // Create a shared copy for the target agent
    const sharedEntry: SwarmMemoryEntry = {
      ...entry,
      id: generateId('mem'),
      metadata: {
        ...entry.metadata,
        originalId: entryId,
        sharedFrom: entry.agentId,
        sharedTo: targetAgentId,
        sharedAt: new Date()
      }
    };

    this.entries.set(sharedEntry.id, sharedEntry);

    // Associate with target agent
    if (!this.agentMemories.has(targetAgentId)) {
      this.agentMemories.set(targetAgentId, new Set());
    }
    this.agentMemories.get(targetAgentId)!.add(sharedEntry.id);

    this.logger.info(`Shared memory ${entryId} from ${entry.agentId} to ${targetAgentId}`);
    this.emit('memory:shared', { original: entry, shared: sharedEntry });
  }

  async broadcastMemory(entryId: string, agentIds?: string[]): Promise<void> {
    const entry = this.entries.get(entryId);
    if (!entry) {
      throw new Error('Memory entry not found');
    }

    if (entry.metadata.shareLevel === 'private') {
      throw new Error('Cannot broadcast private memory');
    }

    const targets = agentIds || Array.from(this.agentMemories.keys())
      .filter(id => id !== entry.agentId);

    for (const targetId of targets) {
      try {
        await this.shareMemory(entryId, targetId);
      } catch (error) {
        this.logger.warn(`Failed to share memory to ${targetId}:`, error);
      }
    }

    this.logger.info(`Broadcasted memory ${entryId} to ${targets.length} agents`);
  }

  async createKnowledgeBase(
    name: string,
    description: string,
    domain: string,
    expertise: string[]
  ): Promise<string> {
    const kbId = generateId('kb');
    const knowledgeBase: SwarmKnowledgeBase = {
      id: kbId,
      name,
      description,
      entries: [],
      metadata: {
        domain,
        expertise,
        contributors: [],
        lastUpdated: new Date()
      }
    };

    this.knowledgeBases.set(kbId, knowledgeBase);

    this.logger.info(`Created knowledge base: ${name} (${kbId})`);
    this.emit('knowledgebase:created', knowledgeBase);

    return kbId;
  }

  async updateKnowledgeBase(entry: SwarmMemoryEntry): Promise<void> {
    if (!this.config.enableKnowledgeBase) return;

    // Find relevant knowledge bases
    const relevantKBs = Array.from(this.knowledgeBases.values())
      .filter(kb => {
        // Simple matching based on tags and content
        const tags = entry.metadata.tags || [];
        return tags.some(tag => 
          kb.metadata.expertise.some(exp => 
            exp.toLowerCase().includes(tag.toLowerCase()) ||
            tag.toLowerCase().includes(exp.toLowerCase())
          )
        );
      });

    for (const kb of relevantKBs) {
      // Add entry to knowledge base
      kb.entries.push(entry);
      kb.metadata.lastUpdated = new Date();

      // Add contributor
      if (!kb.metadata.contributors.includes(entry.agentId)) {
        kb.metadata.contributors.push(entry.agentId);
      }

      this.logger.debug(`Updated knowledge base ${kb.id} with entry ${entry.id}`);
    }
  }

  async searchKnowledge(
    query: string,
    domain?: string,
    expertise?: string[]
  ): Promise<SwarmMemoryEntry[]> {
    const allEntries: SwarmMemoryEntry[] = [];

    // Search in knowledge bases
    for (const kb of this.knowledgeBases.values()) {
      if (domain && kb.metadata.domain !== domain) continue;
      
      if (expertise && !expertise.some(exp => kb.metadata.expertise.includes(exp))) {
        continue;
      }

      allEntries.push(...kb.entries);
    }

    // Simple text search (in real implementation, use better search)
    const queryLower = query.toLowerCase();
    const results = allEntries.filter(entry => {
      const contentStr = JSON.stringify(entry.content).toLowerCase();
      return contentStr.includes(queryLower);
    });

    return results.slice(0, 50); // Limit results
  }

  async getAgentMemorySnapshot(agentId: string): Promise<{
    totalEntries: number;
    recentEntries: SwarmMemoryEntry[];
    knowledgeContributions: number;
    sharedEntries: number;
  }> {
    const agentEntryIds = this.agentMemories.get(agentId) || new Set();
    const agentEntries = Array.from(agentEntryIds)
      .map(id => this.entries.get(id))
      .filter(Boolean) as SwarmMemoryEntry[];

    const recentEntries = agentEntries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    const knowledgeContributions = agentEntries
      .filter(e => e.type === 'knowledge').length;

    const sharedEntries = agentEntries
      .filter(e => e.metadata.shareLevel === 'public' || e.metadata.shareLevel === 'team').length;

    return {
      totalEntries: agentEntries.length,
      recentEntries,
      knowledgeContributions,
      sharedEntries
    };
  }

  private async loadMemoryState(): Promise<void> {
    try {
      // Load entries
      const entriesFile = path.join(this.config.persistencePath, 'entries.json');
      try {
        const entriesData = await fs.readFile(entriesFile, 'utf-8');
        const entriesArray = JSON.parse(entriesData);
        
        for (const entry of entriesArray) {
          this.entries.set(entry.id, {
            ...entry,
            timestamp: new Date(entry.timestamp)
          });

          // Rebuild agent memory associations
          if (!this.agentMemories.has(entry.agentId)) {
            this.agentMemories.set(entry.agentId, new Set());
          }
          this.agentMemories.get(entry.agentId)!.add(entry.id);
        }

        this.logger.info(`Loaded ${entriesArray.length} memory entries`);
      } catch (error) {
        this.logger.warn('No existing memory entries found');
      }

      // Load knowledge bases
      const kbFile = path.join(this.config.persistencePath, 'knowledge-bases.json');
      try {
        const kbData = await fs.readFile(kbFile, 'utf-8');
        const kbArray = JSON.parse(kbData);
        
        for (const kb of kbArray) {
          this.knowledgeBases.set(kb.id, {
            ...kb,
            metadata: {
              ...kb.metadata,
              lastUpdated: new Date(kb.metadata.lastUpdated)
            }
          });
        }

        this.logger.info(`Loaded ${kbArray.length} knowledge bases`);
      } catch (error) {
        this.logger.warn('No existing knowledge bases found');
      }
    } catch (error) {
      this.logger.error('Failed to load memory state:', error);
    }
  }

  private async saveMemoryState(): Promise<void> {
    try {
      // Save entries
      const entriesArray = Array.from(this.entries.values());
      const entriesFile = path.join(this.config.persistencePath, 'entries.json');
      await fs.writeFile(entriesFile, JSON.stringify(entriesArray, null, 2));

      // Save knowledge bases
      const kbArray = Array.from(this.knowledgeBases.values());
      const kbFile = path.join(this.config.persistencePath, 'knowledge-bases.json');
      await fs.writeFile(kbFile, JSON.stringify(kbArray, null, 2));

      this.logger.debug('Memory state saved');
    } catch (error) {
      this.logger.error('Failed to save memory state:', error);
    }
  }

  private async syncMemoryState(): Promise<void> {
    await this.saveMemoryState();
  }

  private async enforceMemoryLimits(): Promise<void> {
    if (this.entries.size <= this.config.maxEntries) return;

    // Remove oldest entries
    const entries = Array.from(this.entries.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const toRemove = entries.slice(0, this.entries.size - this.config.maxEntries);
    
    for (const entry of toRemove) {
      this.entries.delete(entry.id);
      
      // Remove from agent memories
      const agentSet = this.agentMemories.get(entry.agentId);
      if (agentSet) {
        agentSet.delete(entry.id);
      }
    }

    this.logger.info(`Removed ${toRemove.length} old memory entries`);
  }

  getMemoryStats(): {
    totalEntries: number;
    entriesByType: Record<string, number>;
    entriesByAgent: Record<string, number>;
    knowledgeBases: number;
    memoryUsage: number;
  } {
    const entries = Array.from(this.entries.values());
    
    const entriesByType: Record<string, number> = {};
    const entriesByAgent: Record<string, number> = {};
    
    for (const entry of entries) {
      entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;
      entriesByAgent[entry.agentId] = (entriesByAgent[entry.agentId] || 0) + 1;
    }

    const memoryUsage = JSON.stringify(entries).length + 
                       JSON.stringify(Array.from(this.knowledgeBases.values())).length;

    return {
      totalEntries: entries.length,
      entriesByType,
      entriesByAgent,
      knowledgeBases: this.knowledgeBases.size,
      memoryUsage
    };
  }

  async exportMemory(agentId?: string): Promise<any> {
    const entries = agentId 
      ? Array.from(this.entries.values()).filter(e => e.agentId === agentId)
      : Array.from(this.entries.values());

    return {
      entries,
      knowledgeBases: Array.from(this.knowledgeBases.values()),
      exportedAt: new Date(),
      agentId
    };
  }

  async clearMemory(agentId?: string): Promise<void> {
    if (agentId) {
      // Clear specific agent's memory
      const agentEntryIds = this.agentMemories.get(agentId) || new Set();
      for (const entryId of agentEntryIds) {
        this.entries.delete(entryId);
      }
      this.agentMemories.delete(agentId);
      
      this.logger.info(`Cleared memory for agent ${agentId}`);
    } else {
      // Clear all memory
      this.entries.clear();
      this.agentMemories.clear();
      this.knowledgeBases.clear();
      
      this.logger.info('Cleared all memory');
    }

    this.emit('memory:cleared', { agentId });
  }
}