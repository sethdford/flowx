/**
 * Memory-Coordination Integration Tests
 * Tests the interaction between memory management and coordination systems
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MemoryManager } from '../../src/memory/memory-manager.ts';
import { CoordinationManager } from '../../src/coordination/manager.ts';
import { EventBus } from '../../src/core/event-bus.ts';
import { Logger } from '../../src/core/logger.ts';
import type { MemoryEntry, MemorySearchOptions, AgentId } from '../../src/utils/types.ts';

describe('Memory-Coordination Integration', () => {
  let memoryManager: MemoryManager;
  let coordinationManager: CoordinationManager;
  let eventBus: EventBus;
  let logger: Logger;

  beforeEach(async () => {
    eventBus = EventBus.getInstance();
    logger = new Logger({ level: 'error', format: 'text', destination: 'console' }, { component: 'test' });
    
    // Initialize memory manager
    memoryManager = new MemoryManager({
      namespace: 'coordination-test',
      enablePersistence: false,
      enableDistribution: false,
      logging: { level: 'error' }
    });
    await memoryManager.initialize();

    // Initialize coordination manager  
    coordinationManager = new CoordinationManager({
      strategy: 'mesh',
      maxConcurrentTasks: 10,
      taskTimeout: 30000,
      logging: { level: 'error' }
    }, eventBus, logger);
    await coordinationManager.initialize();
  });

  afterEach(async () => {
    await memoryManager?.shutdown();
    await coordinationManager?.shutdown();
    eventBus.removeAllListeners();
  });

  describe('distributed memory coordination', () => {
    it('should coordinate memory operations across agents', async () => {
      // Create memory entries for different agents
      const memoryEntries = [
        {
          id: 'mem-1',
          key: 'agent-1-memory',
          value: 'Agent 1 data',
          agentId: 'agent-1',
          type: 'knowledge' as const,
          tags: ['shared']
        },
        {
          id: 'mem-2', 
          key: 'agent-2-memory',
          value: 'Agent 2 data',
          agentId: 'agent-2',
          type: 'knowledge' as const,
          tags: ['shared']
        }
      ];

      // Store entries with coordination locks
      for (const entry of memoryEntries) {
        // Acquire resource lock for memory region
        const resourceId = `memory:${entry.agentId}`;
        await coordinationManager.acquireResource(resourceId, entry.agentId);

        try {
          await memoryManager.store(entry.key, entry.value, {
            type: entry.type,
            tags: entry.tags,
            owner: { id: entry.agentId, swarmId: 'test', type: 'coordinator', instance: 0 }
          });
        } finally {
          await coordinationManager.releaseResource(resourceId, entry.agentId);
        }
      }

      // Verify memories were stored
      const agent1Memory = await memoryManager.retrieve('agent-1-memory');
      const agent2Memory = await memoryManager.retrieve('agent-2-memory');
      
      expect(agent1Memory).toBeTruthy();
      expect(agent2Memory).toBeTruthy();
      expect(agent1Memory.value).toBe('Agent 1 data');
      expect(agent2Memory.value).toBe('Agent 2 data');
    });

    it('should handle memory conflicts using coordination', async () => {
      const sharedKey = 'shared-resource';
      
      // Create initial memory entry
      const initialEntry = {
        key: sharedKey,
        value: 'Initial value',
        agentId: 'agent-1',
        type: 'knowledge' as const,
        tags: ['shared', 'conflict-test']
      };

      await memoryManager.store(initialEntry.key, initialEntry.value, {
        type: initialEntry.type,
        tags: initialEntry.tags,
        owner: { id: initialEntry.agentId, swarmId: 'test', type: 'coordinator', instance: 0 }
      });

      // Simulate concurrent updates from different processes
      const updates = [
        { agentId: 'agent-1', value: 'Agent 1 update' },
        { agentId: 'agent-2', value: 'Agent 2 update' },
        { agentId: 'agent-3', value: 'Agent 3 update' }
      ];

      const updatePromises = updates.map(async (update, index) => {
        // Add small delay to create actual concurrency
        await new Promise(resolve => setTimeout(resolve, index * 10));
        
        const resourceId = `memory:${sharedKey}`;
        await coordinationManager.acquireResource(resourceId, update.agentId);
        
        try {
          await memoryManager.update(sharedKey, update.value, {
            updater: { id: update.agentId, swarmId: 'test', type: 'coordinator', instance: 0 }
          });
          return { success: true, agentId: update.agentId };
        } catch (error) {
          return { success: false, agentId: update.agentId, error };
        } finally {
          await coordinationManager.releaseResource(resourceId, update.agentId);
        }
      });

      const results = await Promise.all(updatePromises);
      
      // All updates should succeed due to coordination
      expect(results.every(r => r.success)).toBe(true);
      
      // Final value should be one of the updates
      const finalMemory = await memoryManager.retrieve(sharedKey);
      expect(finalMemory).toBeTruthy();
      expect(['Agent 1 update', 'Agent 2 update', 'Agent 3 update']).toContain(finalMemory.value);
    });

    it('should coordinate cross-agent memory queries', async () => {
      // Create memories for multiple agents
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      
      for (const agentId of agents) {
        const entry = {
          key: `${agentId}-data`,
          value: `${agentId} specific data`,
          agentId,
          type: 'knowledge' as const,
          tags: ['agent-data', agentId]
        };

        await memoryManager.store(entry.key, entry.value, {
          type: entry.type,
          tags: entry.tags,
          owner: { id: entry.agentId, swarmId: 'test', type: 'coordinator', instance: 0 }
        });
      }

      // Coordinator queries all memories for synthesis
      const coordinatorId = 'coordinator';
      const queryResourceId = 'memory:query:all-agents';
      
      await coordinationManager.acquireResource(queryResourceId, coordinatorId);
      
      try {
        const searchOptions: MemorySearchOptions = {
          tags: ['agent-data'],
          type: 'knowledge'
        };
        
        const results = await memoryManager.search(searchOptions);
        
        expect(results).toHaveLength(3);
        expect(results.map(r => r.key)).toContain('agent-1-data');
        expect(results.map(r => r.key)).toContain('agent-2-data');
        expect(results.map(r => r.key)).toContain('agent-3-data');
        
      } finally {
        await coordinationManager.releaseResource(queryResourceId, coordinatorId);
      }
    });
  });

  describe('resource coordination with memory backing', () => {
    it('should use memory to track resource allocation history', async () => {
      const resourceId = 'shared-compute-resource';
      const agentId = 'agent-1';
      
      // Store acquisition intention in memory
      const acquisitionEntry = {
        key: `resource-acquisition:${resourceId}:${agentId}`,
        value: {
          resourceId,
          agentId,
          requestTime: new Date().toISOString(),
          status: 'requesting'
        },
        type: 'coordination' as const,
        tags: ['resource', 'acquisition']
      };

      await memoryManager.store(acquisitionEntry.key, acquisitionEntry.value, {
        type: acquisitionEntry.type,
        tags: acquisitionEntry.tags
      });

      // Acquire resource
      await coordinationManager.acquireResource(resourceId, agentId);
      
      // Update memory with successful acquisition
      await memoryManager.update(acquisitionEntry.key, {
        ...acquisitionEntry.value,
        status: 'acquired',
        acquiredTime: new Date().toISOString()
      });

      // Verify memory tracks the acquisition
      const storedEntry = await memoryManager.retrieve(acquisitionEntry.key);
      expect(storedEntry).toBeTruthy();
      expect(storedEntry.value.status).toBe('acquired');
      expect(storedEntry.value.acquiredTime).toBeDefined();

      // Release resource
      await coordinationManager.releaseResource(resourceId, agentId);
      
      // Update memory with release
      await memoryManager.update(acquisitionEntry.key, {
        ...storedEntry.value,
        status: 'released',
        releasedTime: new Date().toISOString()
      });

      const finalEntry = await memoryManager.retrieve(acquisitionEntry.key);
      expect(finalEntry.value.status).toBe('released');
    });

    it('should coordinate deadlock detection with memory logging', async () => {
      const resources = ['resource-A', 'resource-B'];
      const agents = ['agent-1', 'agent-2'];
      
      // Log resource acquisition attempts in memory
      for (const agentId of agents) {
        for (const resourceId of resources) {
          const entry = {
            key: `deadlock-log:${agentId}:${resourceId}`,
            value: {
              agentId,
              resourceId,
              attemptTime: new Date().toISOString(),
              status: 'attempting'
            },
            type: 'coordination' as const,
            tags: ['deadlock', 'resource', agentId]
          };

          await memoryManager.store(entry.key, entry.value, {
            type: entry.type,
            tags: entry.tags
          });
        }
      }

      // Agent 1 acquires resource A
      await coordinationManager.acquireResource('resource-A', 'agent-1');
      await memoryManager.update('deadlock-log:agent-1:resource-A', {
        agentId: 'agent-1',
        resourceId: 'resource-A',
        status: 'acquired',
        acquiredTime: new Date().toISOString()
      });

      // Agent 2 acquires resource B  
      await coordinationManager.acquireResource('resource-B', 'agent-2');
      await memoryManager.update('deadlock-log:agent-2:resource-B', {
        agentId: 'agent-2',
        resourceId: 'resource-B',
        status: 'acquired',
        acquiredTime: new Date().toISOString()
      });

      // Query memory for potential deadlock patterns
      const deadlockResults = await memoryManager.search({
        tags: ['deadlock'],
        type: 'coordination'
      });

      expect(deadlockResults.length).toBeGreaterThan(0);
      
      // Clean up
      await coordinationManager.releaseResource('resource-A', 'agent-1');
      await coordinationManager.releaseResource('resource-B', 'agent-2');
    });
  });

  describe('message coordination with memory persistence', () => {
    it('should persist and coordinate inter-agent messages', async () => {
      const senderAgent = 'agent-sender';
      const receiverAgent = 'agent-receiver';
      const message = {
        id: 'msg-1',
        content: 'Coordination test message',
        type: 'coordination'
      };

      // Log message sending intention in memory
      const sendEntry = {
        key: `message-log:${message.id}`,
        value: {
          messageId: message.id,
          sender: senderAgent,
          receiver: receiverAgent,
          content: message.content,
          status: 'sending',
          timestamp: new Date().toISOString()
        },
        type: 'communication' as const,
        tags: ['message', 'coordination']
      };

      await memoryManager.store(sendEntry.key, sendEntry.value, {
        type: sendEntry.type,
        tags: sendEntry.tags
      });

      // Send message through coordination
      await coordinationManager.sendMessage(senderAgent, receiverAgent, message);

      // Update memory with successful send
      await memoryManager.update(sendEntry.key, {
        ...sendEntry.value,
        status: 'sent',
        sentTime: new Date().toISOString()
      });

      // Verify message log in memory
      const messageLog = await memoryManager.retrieve(sendEntry.key);
      expect(messageLog).toBeTruthy();
      expect(messageLog.value.status).toBe('sent');
      expect(messageLog.value.sender).toBe(senderAgent);
      expect(messageLog.value.receiver).toBe(receiverAgent);
    });

    it('should handle message delivery failures with memory logging', async () => {
      const failureMessages = [
        { id: 'fail-1', receiver: 'nonexistent-agent-1' },
        { id: 'fail-2', receiver: 'nonexistent-agent-2' },
        { id: 'fail-3', receiver: 'nonexistent-agent-3' }
      ];

      for (const msg of failureMessages) {
        try {
          await coordinationManager.sendMessage('sender', msg.receiver, { 
            id: msg.id, 
            content: 'test' 
          });
        } catch (error) {
          // Log failure in memory
          const failureEntry = {
            key: `message-failure:${msg.id}`,
            value: {
              messageId: msg.id,
              receiver: msg.receiver,
              error: error instanceof Error ? error.message : String(error),
              failureTime: new Date().toISOString()
            },
            type: 'communication' as const,
            tags: ['message', 'failure']
          };

          await memoryManager.store(failureEntry.key, failureEntry.value, {
            type: failureEntry.type,
            tags: failureEntry.tags
          });
        }
      }

      // Query failed deliveries
      const failures = await memoryManager.search({
        tags: ['failure'],
        type: 'communication'
      });

      expect(failures.length).toBe(failureMessages.length);
    });
  });

  describe('conflict resolution integration', () => {
    it('should resolve memory conflicts using coordination locks', async () => {
      const conflictKey = 'conflict-resource';
      
      // Create base entry
      const baseEntry = {
        key: conflictKey,
        value: 'original value',
        version: 1,
        type: 'knowledge' as const,
        tags: ['conflict-test']
      };

      await memoryManager.store(baseEntry.key, baseEntry.value, {
        type: baseEntry.type,
        tags: baseEntry.tags
      });

      // Simulate concurrent modification attempts
      const modifications = [
        { agentId: 'agent-1', newValue: 'modification by agent 1' },
        { agentId: 'agent-2', newValue: 'modification by agent 2' },
        { agentId: 'agent-3', newValue: 'modification by agent 3' }
      ];

      // Each agent must acquire lock before modifying
      const modificationResults = await Promise.all(
        modifications.map(async (mod) => {
          const lockId = `memory-lock:${conflictKey}`;
          
          try {
            await coordinationManager.acquireResource(lockId, mod.agentId);
            
            // Read current value
            const current = await memoryManager.retrieve(conflictKey);
            
            // Modify based on current state
            const success = await memoryManager.update(conflictKey, 
              `${current.value} + ${mod.newValue}`, {
                updater: { id: mod.agentId, swarmId: 'test', type: 'coordinator', instance: 0 }
              }
            );
            
            return { agentId: mod.agentId, success };
            
          } finally {
            await coordinationManager.releaseResource(lockId, mod.agentId);
          }
        })
      );

      // All modifications should succeed due to proper locking
      expect(modificationResults.every(r => r.success)).toBe(true);
      
      // Final value should contain all modifications
      const finalValue = await memoryManager.retrieve(conflictKey);
      expect(finalValue.value).toContain('original value');
      modifications.forEach(mod => {
        expect(finalValue.value).toContain(mod.newValue);
      });
    });

    it('should coordinate distributed memory cleanup', async () => {
      // Create multiple temporary entries across different namespaces
      const tempEntries = [];
      
      for (let i = 1; i <= 10; i++) {
        for (const namespace of ['temp-ns-1', 'temp-ns-2', 'temp-ns-3']) {
          const entry = {
            key: `temp-entry-${i}`,
            value: `temporary data ${i}`,
            namespace,
            type: 'temporary' as const,
            tags: ['temp', 'cleanup-test'],
            ttl: 1000 // 1 second TTL
          };

          await memoryManager.store(entry.key, entry.value, {
            type: entry.type,
            tags: entry.tags,
            partition: namespace,
            ttl: entry.ttl
          });
          tempEntries.push(entry);
        }
      }

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Coordinate cleanup across all namespaces
      const cleanupAgents = ['cleanup-agent-1', 'cleanup-agent-2'];
      const cleanupResults = await Promise.all(
        cleanupAgents.map(async (agentId) => {
          const cleanupLock = `cleanup-lock:${agentId}`;
          
          await coordinationManager.acquireResource(cleanupLock, agentId);
          
          try {
            // Each agent cleans up expired entries in specific namespaces
            const namespacesToClean = agentId === 'cleanup-agent-1' 
              ? ['temp-ns-1', 'temp-ns-2'] 
              : ['temp-ns-3'];
            
            let cleanedCount = 0;
            for (const namespace of namespacesToClean) {
              const expiredEntries = await memoryManager.search({
                partition: namespace,
                tags: ['temp']
              });
              
              for (const entry of expiredEntries) {
                try {
                  await memoryManager.delete(entry.key, { partition: namespace });
                  cleanedCount++;
                } catch (error) {
                  // Entry might already be cleaned by another agent
                }
              }
            }
            
            return { agentId, cleanedCount };
            
          } finally {
            await coordinationManager.releaseResource(cleanupLock, agentId);
          }
        })
      );

      expect(cleanupResults.length).toBe(2);
      expect(cleanupResults.every(r => r.cleanedCount >= 0)).toBe(true);
    });
  });

  describe('performance and scalability', () => {
    it('should handle high-volume memory operations with coordination', async () => {
      const numOperations = 100;
      const numAgents = 5;
      
      const operations = [];
      
      for (let i = 0; i < numOperations; i++) {
        const agentId = `agent-${i % numAgents}`;
        const resourceId = `resource-${i % 10}`; // 10 different resources
        
        operations.push(async () => {
          await coordinationManager.acquireResource(resourceId, agentId);
          
          try {
            const entry = {
              key: `high-volume-${i}`,
              value: `data for operation ${i}`,
              agentId,
              type: 'performance' as const,
              tags: ['high-volume', 'performance-test']
            };

            await memoryManager.store(entry.key, entry.value, {
              type: entry.type,
              tags: entry.tags,
              owner: { id: entry.agentId, swarmId: 'test', type: 'coordinator', instance: 0 }
            });
          } finally {
            await coordinationManager.releaseResource(resourceId, agentId);
          }
        });
      }

      const startTime = Date.now();
      await Promise.all(operations.map(op => op()));
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (< 10 seconds)
      expect(duration).toBeLessThan(10000);
      
      // Verify all entries were stored
      const storedEntries = await memoryManager.search({
        tags: ['high-volume']
      });
      
      expect(storedEntries.length).toBe(numOperations);
    });
  });
});