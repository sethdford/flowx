/**
 * Property-based tests for the memory system
 * 
 * These tests verify that the memory system meets critical invariants
 * regardless of input data patterns.
 */

import fc from 'fast-check';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { EventBus } from '../../src/core/event-bus.js';
import { Logger } from '../../src/core/logger.js';
import { DistributedMemorySystem } from '../../original-flowx/src/memory/distributed-memory.js';

describe('Memory System Property Tests', () => {
  let eventBus;
  let logger;
  let memorySystem;
  
  beforeEach(async () => {
    eventBus = new EventBus();
    logger = new Logger(
      {
        level: 'error', // Minimize output during tests
        format: 'json',
        destination: 'console'
      },
      { component: 'property-test' }
    );
    
    memorySystem = new DistributedMemorySystem(
      {
        namespace: 'test',
        distributed: false,
        persistenceEnabled: false
      },
      logger,
      eventBus
    );
    
    await memorySystem.initialize();
  });
  
  test('store and retrieve preserves data integrity', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string(), // Key
        fc.jsonObject(), // Value
        fc.array(fc.string()), // Tags
        async (key, value, tags) => {
          // Store the value
          await memorySystem.store(key, value, { tags });
          
          // Retrieve the value
          const entry = await memorySystem.retrieve(key);
          
          // Assert data integrity
          expect(entry).not.toBeNull();
          expect(entry.value).toEqual(value);
          expect(entry.key).toBe(key);
          expect(entry.tags).toEqual(expect.arrayContaining(tags));
        }
      ),
      { numRuns: 50 } // Number of random test cases to run
    );
  });
  
  test('update maintains version increments', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string(), // Key
        fc.array(fc.jsonObject(), { minLength: 2, maxLength: 10 }), // Series of updates
        async (key, updates) => {
          // Store initial value
          await memorySystem.store(key, updates[0]);
          
          // Apply a series of updates
          for (let i = 1; i < updates.length; i++) {
            await memorySystem.update(key, updates[i]);
          }
          
          // Retrieve final state
          const entry = await memorySystem.retrieve(key);
          
          // Version should match number of updates + 1 (initial store)
          expect(entry.version).toBe(updates.length);
          
          // Final value should match last update
          expect(entry.value).toEqual(updates[updates.length - 1]);
        }
      ),
      { numRuns: 25 } // Number of random test cases to run
    );
  });
});