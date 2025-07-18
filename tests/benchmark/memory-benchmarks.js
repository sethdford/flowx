/**
 * Performance benchmarks for memory system
 * 
 * This module measures the performance of the memory system operations
 * including storage, retrieval, and querying with various data sizes.
 */

import { createBenchmarkSuite, saveResults } from './benchmark-suite.js';
import { DistributedMemorySystem } from '../../original-flowx/src/memory/distributed-memory.js';
import { Logger } from '../../src/core/logger.js';
import { EventBus } from '../../src/core/event-bus.js';

// Create core dependencies
const logger = new Logger({
  level: 'error', // Minimize noise during benchmarks
  format: 'json',
  destination: 'console'
}, { component: 'benchmark' });

const eventBus = new EventBus();

/**
 * Create a memory system instance for benchmarking
 */
async function createMemorySystem(options = {}) {
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
async function runMemoryBenchmarks() {
  const results = {};
  
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
  await new Promise((resolve) => {
    storeSuite.on('complete', function() {
      results['store'] = this.ctx.metrics;
      resolve();
    }).run({ async: true });
  });
  
  // Benchmark 2: Retrieval operations
  const retrieveSuite = createBenchmarkSuite('Memory Retrieval Operations');
  
  // Prepare test data
  const testKeys = [];
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
    await memorySystem.retrieve(missKey);
  });
  
  // Run the retrieval benchmarks
  await new Promise((resolve) => {
    retrieveSuite.on('complete', function() {
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
  await new Promise((resolve) => {
    querySuite.on('complete', function() {
      results['query'] = this.ctx.metrics;
      resolve();
    }).run({ async: true });
  });
  
  // Benchmark 4: Update operations
  const updateSuite = createBenchmarkSuite('Memory Update Operations');
  
  // Prepare update test data
  const updateKeys = [];
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
  await new Promise((resolve) => {
    updateSuite.on('complete', function() {
      results['update'] = this.ctx.metrics;
      resolve();
    }).run({ async: true });
  });
  
  // Shutdown memory system
  await memorySystem.shutdown();
  
  // Save benchmark results
  await saveResults(results, 'memory-benchmarks.json');
  
  return results;
}

// Run benchmarks if this module is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMemoryBenchmarks().catch(console.error);
}

export default runMemoryBenchmarks;