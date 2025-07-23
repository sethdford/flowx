import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EnhancedMemorySystem } from '../../src/enterprise/enhanced-memory-system';
import type { MemoryEntry, MemoryQuery, MemoryConfiguration } from '../../src/enterprise/enhanced-memory-system';
import { Logger } from '../../src/core/logger';
import { mkdtemp, rm, stat } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Enhanced Memory System Integration', () => {
  let memorySystem: EnhancedMemorySystem;
  let logger: Logger;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    logger = new Logger({ level: 'debug', format: 'json', destination: 'console' });
    
    // Create temporary directory for tests
    const tmpBaseDir = os.tmpdir() || '/tmp';
    tempDir = await mkdtemp(path.join(tmpBaseDir, 'enhanced-memory-test-'));
    dbPath = path.join(tempDir, 'test-memory.db');

    const config: Partial<MemoryConfiguration> = {
      database_path: dbPath,
      cache_size: 100,
      compression_enabled: true,
      encryption_enabled: false,
      sync_enabled: false,
      federation_enabled: false,
      vector_search_enabled: true,
      auto_cleanup: {
        enabled: false, // Disable for testing
        ttl_check_interval: 60000,
        importance_threshold: 0.1,
        max_entries: 1000
      },
      performance: {
        batch_size: 50,
        index_optimization: true,
        vacuum_interval: 3600000,
        checkpoint_interval: 1800000
      },
      analytics: {
        enabled: true,
        metrics_retention: 604800000,
        learning_enabled: true,
        pattern_detection: true
      }
    };

    memorySystem = new EnhancedMemorySystem(config, logger);
  });

  afterEach(async () => {
    if (memorySystem) {
      await memorySystem.shutdown();
    }
    
    // Clean up temporary directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('System Initialization', () => {
    it('should initialize with SQLite database', async () => {
      await memorySystem.initialize();
      
      // Verify database file was created
      const stats = await stat(dbPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should handle configuration options correctly', async () => {
      await memorySystem.initialize();
      
      const statistics = await memorySystem.getStatistics();
      expect(statistics).toBeDefined();
      expect(statistics.total_entries).toBe(0);
    });

    it('should support graceful shutdown', async () => {
      await memorySystem.initialize();
      await memorySystem.shutdown();
      
      // Should be able to initialize again
      await memorySystem.initialize();
      await memorySystem.shutdown();
    });
  });

  describe('Memory Storage and Retrieval', () => {
    beforeEach(async () => {
      await memorySystem.initialize();
    });

    it('should store and retrieve basic memory entries', async () => {
      const memoryEntry: Partial<MemoryEntry> = {
        type: 'conversation',
        content: {
          data: { message: 'Hello, world!', response: 'Hi there!' },
          format: 'json',
          size: 0,
          checksum: '',
          compressed: false,
          encrypted: false
        },
        metadata: {
          source: 'test',
          session: 'test-session-1',
          agent: 'test-agent',
          importance: 0.8,
          confidence: 0.9,
          accuracy: 0.85,
          usage_count: 0,
          success_rate: 1.0,
          domain: 'conversation',
          category: 'interaction',
          keywords: ['hello', 'greeting']
        },
        tags: ['test', 'conversation'],
        priority: 5
      };

      const id = await memorySystem.store(memoryEntry);
      expect(id).toBeDefined();

      const retrieved = await memorySystem.retrieve(id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.type).toBe('conversation');
      expect(retrieved!.content.data.message).toBe('Hello, world!');
      expect(retrieved!.metadata.importance).toBe(0.8);
      expect(retrieved!.tags).toContain('test');
    });

    it('should handle complex memory content types', async () => {
      const codeEntry: Partial<MemoryEntry> = {
        type: 'code_knowledge',
        content: {
          data: {
            language: 'typescript',
            code: 'function fibonacci(n: number): number { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }',
            description: 'Recursive fibonacci implementation',
            complexity: 'O(2^n)',
            best_practices: ['Consider memoization', 'Use iterative approach for large n']
          },
          format: 'json',
          size: 0,
          checksum: '',
          compressed: false,
          encrypted: false
        },
        metadata: {
          source: 'code_analysis',
          session: 'dev-session-1',
          agent: 'code-agent',
          importance: 0.9,
          confidence: 0.95,
          accuracy: 0.9,
          usage_count: 0,
          success_rate: 1.0,
          domain: 'programming',
          category: 'algorithm',
          subcategory: 'recursion',
          keywords: ['fibonacci', 'recursion', 'typescript', 'algorithm']
        },
        context: {
          temporal: {
            timestamp: new Date()
          },
          spatial: {
            file_path: '/src/utils/math.ts',
            line_range: { start: 15, end: 20 }
          },
          semantic: {
            topic: 'algorithm_implementation',
            intent: 'code_storage',
            complexity: 'medium',
            abstraction_level: 'concrete',
            concepts: ['recursion', 'mathematics', 'optimization'],
            entities: []
          },
          causal: {
            causes: ['need_fibonacci_function'],
            effects: ['function_available_for_use'],
            prerequisites: ['typescript_knowledge'],
            consequences: ['potential_performance_issues'],
            dependencies: []
          },
          environmental: {
            system_state: { editor: 'vscode', language_server: 'active' },
            active_tools: ['typescript_compiler'],
            concurrent_tasks: ['code_analysis'],
            resource_state: {
              cpu_usage: 0.3,
              memory_usage: 0.4,
              disk_usage: 0.1,
              network_state: 'connected',
              active_connections: 2
            }
          }
        },
        tags: ['algorithm', 'fibonacci', 'recursion', 'optimization'],
        priority: 8
      };

      const id = await memorySystem.store(codeEntry);
      const retrieved = await memorySystem.retrieve(id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.content.data.language).toBe('typescript');
      expect(retrieved!.context!.spatial!.file_path).toBe('/src/utils/math.ts');
      expect(retrieved!.metadata.keywords).toContain('fibonacci');
    });

    it('should support memory updates and versioning', async () => {
      const entry: Partial<MemoryEntry> = {
        type: 'task_execution',
        content: {
          data: { task: 'create_component', status: 'in_progress' },
          format: 'json',
          size: 0,
          checksum: '',
          compressed: false,
          encrypted: false
        },
        metadata: {
          source: 'task_manager',
          session: 'work-session',
          agent: 'task-agent',
          importance: 0.7,
          confidence: 0.8,
          accuracy: 0.9,
          usage_count: 0,
          success_rate: 1.0,
          domain: 'project_management',
          category: 'task',
          keywords: ['component', 'development']
        }
      };

      const id = await memorySystem.store(entry);
      
      // Update the memory
      await memorySystem.update(id, {
        content: {
          data: { task: 'create_component', status: 'completed', result: 'success' },
          format: 'json',
          size: 0,
          checksum: '',
          compressed: false,
          encrypted: false
        },
        metadata: {
          source: 'task_manager',
          session: 'work-session',
          agent: 'task-agent',
          importance: 0.8,
          confidence: 0.9,
          accuracy: 0.95,
          usage_count: 1,
          success_rate: 1.0,
          domain: 'project_management',
          category: 'task',
          keywords: ['component', 'development', 'completed']
        }
      });

      const updated = await memorySystem.retrieve(id);
      expect(updated!.content.data.status).toBe('completed');
      expect(updated!.version).toBe(2);
      expect(updated!.metadata.keywords).toContain('completed');
    });

    it('should handle memory deletion', async () => {
      const entry: Partial<MemoryEntry> = {
        type: 'system_state',
        content: {
          data: { temp_data: 'to_be_deleted' },
          format: 'json',
          size: 0,
          checksum: '',
          compressed: false,
          encrypted: false
        }
      };

      const id = await memorySystem.store(entry);
      
      let retrieved = await memorySystem.retrieve(id);
      expect(retrieved).toBeDefined();

      await memorySystem.delete(id);
      
      retrieved = await memorySystem.retrieve(id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Memory Querying and Filtering', () => {
    beforeEach(async () => {
      await memorySystem.initialize();
      
      // Store test data
      const entries = [
        {
          type: 'conversation' as const,
          content: { data: { topic: 'AI development' }, format: 'json' as const, size: 0, checksum: '', compressed: false, encrypted: false },
          metadata: { source: 'chat', session: 'session1', agent: 'ai', importance: 0.8, confidence: 0.9, accuracy: 0.8, usage_count: 0, success_rate: 1.0, domain: 'ai', category: 'discussion', keywords: ['ai', 'development'] },
          tags: ['ai', 'development'],
          priority: 7
        },
        {
          type: 'task_execution' as const,
          content: { data: { task: 'code_review' }, format: 'json' as const, size: 0, checksum: '', compressed: false, encrypted: false },
          metadata: { source: 'system', session: 'session1', agent: 'reviewer', importance: 0.9, confidence: 0.85, accuracy: 0.9, usage_count: 2, success_rate: 1.0, domain: 'development', category: 'quality', keywords: ['code', 'review'] },
          tags: ['code', 'review'],
          priority: 9
        },
        {
          type: 'user_preference' as const,
          content: { data: { theme: 'dark', language: 'typescript' }, format: 'json' as const, size: 0, checksum: '', compressed: false, encrypted: false },
          metadata: { source: 'user', session: 'session2', agent: 'ui', importance: 0.5, confidence: 1.0, accuracy: 1.0, usage_count: 5, success_rate: 1.0, domain: 'ui', category: 'preference', keywords: ['theme', 'language'] },
          tags: ['preferences', 'ui'],
          priority: 3
        }
      ];

      for (const entry of entries) {
        await memorySystem.store(entry);
      }
    });

    it('should query memories by type', async () => {
      const query: MemoryQuery = {
        filters: [{
          field: 'type',
          operator: 'equals',
          value: 'conversation'
        }]
      };

      const results = await memorySystem.query(query);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('conversation');
    });

    it('should query memories by metadata criteria', async () => {
      const query: MemoryQuery = {
        importance_threshold: 0.8,
        confidence_threshold: 0.85
      };

      const results = await memorySystem.query(query);
      expect(results.length).toBeGreaterThan(0);
      
      for (const result of results) {
        expect(result.metadata.importance).toBeGreaterThanOrEqual(0.8);
        expect(result.metadata.confidence).toBeGreaterThanOrEqual(0.85);
      }
    });

    it('should support complex filtering and sorting', async () => {
      const query: MemoryQuery = {
        filters: [{
          field: 'metadata',
          operator: 'contains',
          value: 'development'
        }],
        sort: [{
          field: 'priority',
          direction: 'desc'
        }],
        limit: 2
      };

      const results = await memorySystem.query(query);
      expect(results.length).toBeLessThanOrEqual(2);
      
      // Verify sorting
      if (results.length > 1) {
        expect(results[0].priority).toBeGreaterThanOrEqual(results[1].priority);
      }
    });

    it('should support temporal range queries', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      
      const query: MemoryQuery = {
        temporal_range: {
          start: oneHourAgo,
          end: now
        }
      };

      const results = await memorySystem.query(query);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Relationships', () => {
    beforeEach(async () => {
      await memorySystem.initialize();
    });

    it('should create and manage memory relationships', async () => {
      // Store two related memories
      const entry1: Partial<MemoryEntry> = {
        type: 'code_knowledge',
        content: { data: { function: 'calculateSum' }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false }
      };

      const entry2: Partial<MemoryEntry> = {
        type: 'code_knowledge',
        content: { data: { function: 'calculateAverage', uses: 'calculateSum' }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false }
      };

      const id1 = await memorySystem.store(entry1);
      const id2 = await memorySystem.store(entry2);

      // Create relationship
      await memorySystem.createRelationship(id2, id1, 'dependency', 0.9, {
        description: 'calculateAverage depends on calculateSum'
      });

      // Query with relationships
      const query: MemoryQuery = {
        filters: [{ field: 'id', operator: 'equals', value: id2 }],
        include_relationships: true
      };

      const results = await memorySystem.query(query);
      expect(results.length).toBe(1);
      expect(results[0].relationships.length).toBe(1);
      expect(results[0].relationships[0].target_id).toBe(id1);
      expect(results[0].relationships[0].type).toBe('dependency');
      expect(results[0].relationships[0].strength).toBe(0.9);
    });

    it('should support different relationship types', async () => {
      const entries = await Promise.all([
        memorySystem.store({ type: 'pattern_recognition', content: { data: { pattern: 'A' }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false } }),
        memorySystem.store({ type: 'pattern_recognition', content: { data: { pattern: 'B' }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false } }),
        memorySystem.store({ type: 'pattern_recognition', content: { data: { pattern: 'C' }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false } })
      ]);

      // Create various relationship types
      await memorySystem.createRelationship(entries[0], entries[1], 'causal', 0.8);
      await memorySystem.createRelationship(entries[1], entries[2], 'temporal', 0.7);
      await memorySystem.createRelationship(entries[0], entries[2], 'similarity', 0.6);

      const query: MemoryQuery = {
        filters: [{ field: 'id', operator: 'equals', value: entries[0] }],
        include_relationships: true
      };

      const results = await memorySystem.query(query);
      expect(results[0].relationships.length).toBe(2);
      
      const relationshipTypes = results[0].relationships.map(r => r.type);
      expect(relationshipTypes).toContain('causal');
      expect(relationshipTypes).toContain('similarity');
    });
  });

  describe('Vector Similarity Search', () => {
    beforeEach(async () => {
      await memorySystem.initialize();
    });

    it('should support vector similarity search', async () => {
      // Store entries with similar content
      const entries = [
        {
          type: 'learning_insight' as const,
          content: { data: { topic: 'machine learning algorithms' }, format: 'json' as const, size: 0, checksum: '', compressed: false, encrypted: false },
          tags: ['ml', 'algorithms']
        },
        {
          type: 'learning_insight' as const,
          content: { data: { topic: 'neural network architectures' }, format: 'json' as const, size: 0, checksum: '', compressed: false, encrypted: false },
          tags: ['ml', 'neural', 'networks']
        },
        {
          type: 'learning_insight' as const,
          content: { data: { topic: 'cooking recipes' }, format: 'json' as const, size: 0, checksum: '', compressed: false, encrypted: false },
          tags: ['cooking', 'food']
        }
      ];

      for (const entry of entries) {
        await memorySystem.store(entry);
      }

      // Generate a query vector similar to ML content
      const queryVector = new Array(128).fill(0);
      const mlText = 'machine learning neural networks';
      for (let i = 0; i < mlText.length && i < 128; i++) {
        queryVector[i] = mlText.charCodeAt(i) / 255;
      }

      const query: MemoryQuery = {
        similarity_search: {
          query_vector: queryVector,
          similarity_threshold: 0.1,
          max_results: 2
        }
      };

      const results = await memorySystem.query(query);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Memory Analytics and Statistics', () => {
    beforeEach(async () => {
      await memorySystem.initialize();
      
      // Store some test data
      const entries = [
        { type: 'conversation' as const, priority: 5 },
        { type: 'task_execution' as const, priority: 8 },
        { type: 'user_preference' as const, priority: 3 },
        { type: 'code_knowledge' as const, priority: 9 }
      ];

      for (const entry of entries) {
        await memorySystem.store({
          ...entry,
          content: { data: { test: 'data' }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false }
        });
      }
    });

    it('should generate comprehensive statistics', async () => {
      const stats = await memorySystem.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.total_entries).toBeGreaterThanOrEqual(0);
      expect(stats.memory_types).toBeDefined();
      expect(stats.compression_ratio).toBeGreaterThan(0);
      expect(stats.cache_hit_rate).toBeGreaterThanOrEqual(0);
      expect(stats.storage_efficiency).toBeGreaterThan(0);
    });

    it('should generate learning insights', async () => {
      const insights = await memorySystem.generateInsights();
      
      expect(Array.isArray(insights)).toBe(true);
      // Note: Insights might be empty in test environment
    });
  });

  describe('Memory Persistence and Cross-Session Learning', () => {
    it('should persist memories across system restarts', async () => {
      // First session
      await memorySystem.initialize();
      
      const testEntry: Partial<MemoryEntry> = {
        type: 'conversation',
        content: {
          data: { message: 'This should persist across restarts' },
          format: 'json',
          size: 0,
          checksum: '',
          compressed: false,
          encrypted: false
        },
        metadata: {
          source: 'persistence_test',
          session: 'session1',
          agent: 'test',
          importance: 0.9,
          confidence: 0.95,
          accuracy: 0.9,
          usage_count: 0,
          success_rate: 1.0,
          domain: 'testing',
          category: 'persistence',
          keywords: ['persistence', 'test']
        }
      };

      const id = await memorySystem.store(testEntry);
      await memorySystem.shutdown();

      // Second session - reinitialize with same database
      const newMemorySystem = new EnhancedMemorySystem({
        database_path: dbPath,
        cache_size: 100,
        analytics: { enabled: true, metrics_retention: 604800000, learning_enabled: true, pattern_detection: true }
      }, logger);

      await newMemorySystem.initialize();
      
      const retrieved = await newMemorySystem.retrieve(id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.content.data.message).toBe('This should persist across restarts');
      expect(retrieved!.metadata.keywords).toContain('persistence');

      await newMemorySystem.shutdown();
    });

    it('should support backup and restore operations', async () => {
      await memorySystem.initialize();
      
      // Store test data
      await memorySystem.store({
        type: 'system_state',
        content: { data: { backup_test: true }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false }
      });

      // Create backup
      const backupPath = path.join(tempDir, 'backup.db');
      await memorySystem.backup(backupPath);
      
      // Verify backup file exists
      const backupStats = await stat(backupPath);
      expect(backupStats.isFile()).toBe(true);

      // Store additional data
      await memorySystem.store({
        type: 'system_state',
        content: { data: { after_backup: true }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false }
      });

      // Restore from backup
      await memorySystem.restore(backupPath);

      // Verify only original data exists
      const results = await memorySystem.query({
        filters: [{ field: 'type', operator: 'equals', value: 'system_state' }]
      });
      
      const hasBackupTest = results.some(r => r.content.data.backup_test === true);
      const hasAfterBackup = results.some(r => r.content.data.after_backup === true);
      
      expect(hasBackupTest).toBe(true);
      expect(hasAfterBackup).toBe(false);
    });
  });

  describe('Memory Optimization and Performance', () => {
    beforeEach(async () => {
      await memorySystem.initialize();
    });

    it('should optimize memory storage', async () => {
      // Store some test data
      for (let i = 0; i < 10; i++) {
        await memorySystem.store({
          type: 'system_state',
          content: { data: { index: i }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false }
        });
      }

      // Run optimization
      await memorySystem.optimize();
      
      // Verify system still works after optimization
      const results = await memorySystem.query({
        filters: [{ field: 'type', operator: 'equals', value: 'system_state' }]
      });
      
      expect(results.length).toBe(10);
    });

    it('should handle large numbers of memory entries efficiently', async () => {
      const startTime = Date.now();
      
      // Store many entries
      const storePromises = [];
      for (let i = 0; i < 100; i++) {
        storePromises.push(memorySystem.store({
          type: 'system_state',
          content: { data: { id: i, data: `test_data_${i}` }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false },
          metadata: {
            source: 'performance_test',
            session: 'perf_session',
            agent: 'perf_agent',
            importance: Math.random(),
            confidence: Math.random(),
            accuracy: Math.random(),
            usage_count: 0,
            success_rate: 1.0,
            domain: 'testing',
            category: 'performance',
            keywords: ['performance', 'test']
          }
        }));
      }
      
      await Promise.all(storePromises);
      
      const storeTime = Date.now() - startTime;
      
      // Query all entries
      const queryStartTime = Date.now();
      const results = await memorySystem.query({
        filters: [{ field: 'type', operator: 'equals', value: 'system_state' }]
      });
      const queryTime = Date.now() - queryStartTime;
      
      expect(results.length).toBe(100);
      expect(storeTime).toBeLessThan(5000); // Should store 100 entries in less than 5 seconds
      expect(queryTime).toBeLessThan(1000);  // Should query in less than 1 second
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await memorySystem.initialize();
    });

    it('should handle invalid memory entry data gracefully', async () => {
      // Try to store invalid data
      const invalidEntry = {
        type: 'invalid_type' as any,
        content: null as any
      };

      await expect(memorySystem.store(invalidEntry)).rejects.toThrow();
    });

    it('should handle non-existent memory retrieval', async () => {
      const result = await memorySystem.retrieve('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle concurrent operations safely', async () => {
      // Start multiple concurrent operations
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(memorySystem.store({
          type: 'system_state',
          content: { data: { id: i }, format: 'json', size: 0, checksum: '', compressed: false, encrypted: false }
        }));
      }
      
      const ids = await Promise.all(operations);
      expect(ids.length).toBe(10);
      
      // Verify all entries were stored correctly
      const retrievals = ids.map(id => memorySystem.retrieve(id));
      const results = await Promise.all(retrievals);
      
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
}); 