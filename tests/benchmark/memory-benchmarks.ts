/**
 * Performance benchmarks for memory system
 * 
 * This module measures the performance of the memory system operations
 * including storage, retrieval, and querying with various data sizes.
 */

import { createBenchmarkSuite, saveResults } from './benchmark-suite';
import { DistributedMemorySystem } from '../../original-flowx/src/memory/distributed-memory';
import { Logger } from '../../src/core/logger';
import { EventBus } from '../../src/core/event-bus';
import { fileURLToPath } from 'url';

// Create core dependencies
const logger = new Logger({
  level: 'error', // Minimize noise during benchmarks
  format: 'json',
  destination: 'console'
}, { component: 'benchmark' });

const eventBus = new EventBus();

interface MemorySystemOptions {
  namespace?: string;
  distributed?: boolean;
  persistenceEnabled?: boolean;
  compressionEnabled?: boolean;
  [key: string]: any;
}

/**
 * Create a memory system instance for benchmarking
 */
async function createMemorySystem(options: MemorySystemOptions = {}): Promise<DistributedMemorySystem> {
  const memorySystem = new DistributedMemorySystem({
    namespace: 'benchmark',
    distributed: false,
    persistenceEnabled: false,
    compressionEnabled: false,
    ...options
  }, logger, eventBus);
  
  await memorySystem.initialize();
  return memorySystem;
}

/**
 * Run the memory system benchmarks
 */
async function runMemoryBenchmarks(): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  
  // Benchmark 1: Store operations with different payload sizes
  const storeSuite = createBenchmarkSuite('Memory Store Operations');
  
  // Create memory system instance
  const memorySystem = await createMemorySystem();
  
  // Small payload benchmark
  storeSuite.add('Store small payload (100B)', async function() {
    const key = `small-${Date.now()}-${Math.random()}`;
    const value = { id: key, data: 'small'.repeat(20) };
    await memorySystem.store(key, value);
  });
  
  // Medium payload benchmark
  storeSuite.add('Store medium payload (10KB)', async function() {
    const key = `medium-${Date.now()}-${Math.random()}`;
    const value = { id: key, data: 'medium'.repeat(2000) };
    await memorySystem.store(key, value);
  });
  
  // Large payload benchmark
  storeSuite.add('Store large payload (100KB)', async function() {
    const key = `large-${Date.now()}-${Math.random()}`;
    const value = { id: key, data: 'large'.repeat(20000) };
    await memorySystem.store(key, value);
  });
  
  // Run the store benchmarks
  await new Promise<void>((resolve) => {
    storeSuite.on('complete', function(this: typeof storeSuite) {
      results['store'] = this.ctx.metrics;
      resolve();
    }).run({ async: true });
  });
  
  // Benchmark 2: Retrieval operations
  const retrieveSuite = createBenchmarkSuite('Memory Retrieval Operations');
  
  // Prepare test data
  const testKeys: string[] = [];
  for (let i = 0; i < 100; i++) {
    const key = `retrieve-${i}`;
    await memorySystem.store(key, { value: `test-value-${i}`, data: 'x'.repeat(i * 10) });
    testKeys.push(key);
  }
  
  // Cached retrieval benchmark
  retrieveSuite.add('Retrieve from cache', async function() {
    const key = testKeys[Math.floor(Math.random() * testKeys.length)];
    await memorySystem.retrieve(key);
    await memorySystem.retrieve(key); // Second retrieval should use cache
  });
  
  // Uncached retrieval benchmark
  retrieveSuite.add('Retrieve uncached item', async function() {
    const key = testKeys[Math.floor(Math.random() * testKeys.length)];
    // Force cache miss by generating a new random key based on an existing one
    const missKey = `${key}-miss-${Math.random()}`;
    try {
      await memorySystem.retrieve(missKey);
    } catch (error) {
      // Ignore "not found" errors which are expected
    }
  });
  
  // Run the retrieval benchmarks
  await new Promise<void>((resolve) => {
    retrieveSuite.on('complete', function(this: typeof retrieveSuite) {
      results['retrieve'] = this.ctx.metrics;
      resolve();
    }).run({ async: true });
  });
  
  // Benchmark 3: Query operations
  const querySuite = createBenchmarkSuite('Memory Query Operations');
  
  // Prepare query test data with tags
  const tags = ['benchmark', 'performance', 'memory', 'query', 'test', 'cache', 'store'];
  for (let i = 0; i < 100; i++) {
    const key = `query-${i}`;
    // Assign 1-3 random tags
    const itemTags = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, 
      () => tags[Math.floor(Math.random() * tags.length)]);
    
    await memorySystem.store(key, { value: `query-value-${i}` }, {
      tags: itemTags,
      type: i % 2 === 0 ? 'even' : 'odd'
    });
  }
  
  // Query by single tag benchmark
  querySuite.add('Query by single tag', async function() {
    const tag = tags[Math.floor(Math.random() * tags.length)];
    await memorySystem.query({ tags: [tag] });
  });
  
  // Query by multiple tags benchmark
  querySuite.add('Query by multiple tags', async function() {
    const selectedTags = Array.from(
      { length: 2 }, 
      () => tags[Math.floor(Math.random() * tags.length)]
    );
    await memorySystem.query({ tags: selectedTags });
  });
  
  // Query by type benchmark
  querySuite.add('Query by type', async function() {
    await memorySystem.query({ type: Math.random() > 0.5 ? 'even' : 'odd' });
  });
  
  // Complex query benchmark
  querySuite.add('Complex query (type + tags)', async function() {
    const tag = tags[Math.floor(Math.random() * tags.length)];
    await memorySystem.query({
      type: Math.random() > 0.5 ? 'even' : 'odd',
      tags: [tag]
    });
  });
  
  // Run the query benchmarks
  await new Promise<void>((resolve) => {
    querySuite.on('complete', function(this: typeof querySuite) {
      results['query'] = this.ctx.metrics;
      resolve();
    }).run({ async: true });
  });
  
  // Benchmark 4: Update operations
  const updateSuite = createBenchmarkSuite('Memory Update Operations');
  
  // Prepare update test data
  const updateKeys: string[] = [];
  for (let i = 0; i < 100; i++) {
    const key = `update-${i}`;
    await memorySystem.store(key, { counter: i, data: Array(i).fill('x').join('') });
    updateKeys.push(key);
  }
  
  // Simple update benchmark
  updateSuite.add('Simple update', async function() {
    const key = updateKeys[Math.floor(Math.random() * updateKeys.length)];
    const newValue = { counter: Math.floor(Math.random() * 1000) };
    await memorySystem.update(key, newValue);
  });
  
  // Merge update benchmark
  updateSuite.add('Merge update', async function() {
    const key = updateKeys[Math.floor(Math.random() * updateKeys.length)];
    const updateValue = { updateTime: Date.now() };
    await memorySystem.update(key, updateValue, { merge: true });
  });
  
  // Run the update benchmarks
  await new Promise<void>((resolve) => {
    updateSuite.on('complete', function(this: typeof updateSuite) {
      results['update'] = this.ctx.metrics;
      resolve();
    }).run({ async: true });
  });
  
  // Benchmark 5: Event bus performance (added in latest update)
  const eventSuite = createBenchmarkSuite('Event Bus Operations');
  
  // Simple event emission
  eventSuite.add('Simple event emission', function() {
    eventBus.emit('benchmark:simple', { timestamp: Date.now() });
  });
  
  // Event with large payload
  eventSuite.add('Event with large payload', function() {
    const largePayload = { 
      data: Array(1000).fill('test-data').join(''),
      timestamp: Date.now(),
      metadata: {
        source: 'benchmark',
        type: 'performance-test',
        tags: Array(50).fill(0).map((_, i) => `tag-${i}`)
      }
    };
    eventBus.emit('benchmark:large', largePayload);
  });
  
  // Event with listener
  const testListener = (data: any) => { /* no-op */ };
  eventBus.on('benchmark:with-listener', testListener);
  
  eventSuite.add('Event with listener', function() {
    eventBus.emit('benchmark:with-listener', { timestamp: Date.now() });
  });
  
  // Run the event bus benchmarks
  await new Promise<void>((resolve) => {
    eventSuite.on('complete', function(this: typeof eventSuite) {
      results['events'] = this.ctx.metrics;
      // Remove test listener to avoid memory leaks
      eventBus.off('benchmark:with-listener', testListener);
      resolve();
    }).run({ async: true });
  });
  
  // Clean up
  await memorySystem.shutdown();
  EventBus.reset(); // Reset event bus singleton
  
  // Save benchmark results
  await saveResults(results, 'memory-benchmarks.json');
  
  return results;
}

// Run benchmarks if this module is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runMemoryBenchmarks().catch(console.error);
}

export default runMemoryBenchmarks;