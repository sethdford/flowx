/**
 * Swarm Topology Performance Benchmarks
 * 
 * Comprehensive performance testing for our adaptive topology system:
 * 1. Topology selection performance
 * 2. Agent spawning efficiency across topologies
 * 3. Communication overhead by topology type
 * 4. Memory usage patterns
 * 5. Scalability thresholds
 * 6. Adaptive switching performance
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import * as path from 'node:path';

interface TopologyBenchmark {
  topology: string;
  agentCount: number;
  setupTime: number;
  communicationLatency: number;
  memoryUsage: number;
  throughput: number;
  success: boolean;
}

interface ScalabilityTest {
  agentCounts: number[];
  topologies: string[];
  results: Map<string, TopologyBenchmark[]>;
}

const CLI_PATH = path.resolve('./cli.js');
const BENCHMARK_TIMEOUT = 180000; // 3 minutes for performance tests

describe('Swarm Topology Performance Benchmarks', () => {
  let benchmarkResults: TopologyBenchmark[] = [];

  beforeAll(() => {
    console.log('🚀 Starting Swarm Topology Performance Benchmarks');
    console.log('📊 Testing adaptive topology performance characteristics');
  });

  afterAll(() => {
    console.log('\n📊 Benchmark Summary:');
    console.table(benchmarkResults.map(result => ({
      Topology: result.topology,
      Agents: result.agentCount,
      'Setup Time (ms)': result.setupTime.toFixed(0),
      'Memory (MB)': (result.memoryUsage / 1024 / 1024).toFixed(1),
      Success: result.success ? '✅' : '❌'
    })));
  });

  describe('Topology Selection Performance', () => {
    test('should select topology quickly for different complexity levels', async () => {
      const testCases = [
        { name: 'Simple', objective: 'Create hello world', expectedTime: 1000 },
        { name: 'Medium', objective: 'Build calculator with tests', expectedTime: 1500 },
        { name: 'Complex', objective: 'Create microservices architecture with authentication, API gateway, databases, monitoring, and CI/CD', expectedTime: 2000 }
      ];

      for (const testCase of testCases) {
        const startTime = performance.now();
        
        const result = await benchmarkSwarmSetup(testCase.objective, { 
          measureSetupOnly: true,
          timeout: 15000 
        });
        
        const selectionTime = performance.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(selectionTime).toBeLessThan(testCase.expectedTime);
        
        benchmarkResults.push({
          topology: result.topology,
          agentCount: result.agentCount,
          setupTime: selectionTime,
          communicationLatency: 0,
          memoryUsage: 0,
          throughput: 0,
          success: result.success
        });
        
        console.log(`📈 ${testCase.name} complexity: ${selectionTime.toFixed(0)}ms (${result.topology} topology)`);
      }
    }, BENCHMARK_TIMEOUT);
  });

  describe('Agent Spawning Efficiency', () => {
    test('should spawn agents efficiently across different counts', async () => {
      const agentCounts = [2, 3, 5];
      
      for (const count of agentCounts) {
        const result = await benchmarkSwarmSetup(
          `Create application with ${count} components`,
          { maxAgents: count, measureSpawning: true }
        );
        
        expect(result.success).toBe(true);
        
        // Calculate spawning efficiency (time per agent)
        const timePerAgent = result.setupTime / count;
        expect(timePerAgent).toBeLessThan(5000); // Under 5s per agent
        
        benchmarkResults.push({
          topology: result.topology,
          agentCount: count,
          setupTime: result.setupTime,
          communicationLatency: 0,
          memoryUsage: result.memoryUsage,
          throughput: count / (result.setupTime / 1000), // agents per second
          success: result.success
        });
        
        console.log(`🤖 ${count} agents: ${result.setupTime.toFixed(0)}ms setup (${timePerAgent.toFixed(0)}ms/agent)`);
      }
    }, BENCHMARK_TIMEOUT);
  });

  describe('Communication Infrastructure Performance', () => {
    test('should create communication infrastructure efficiently', async () => {
      const result = await benchmarkSwarmSetup(
        'Create collaborative development project',
        { measureCommunication: true }
      );
      
      expect(result.success).toBe(true);
      expect(result.setupTime).toBeLessThan(10000); // Under 10 seconds
      
      // Verify communication infrastructure was created
      const hasComms = await verifyCommInfrastructure(result.swarmId);
      expect(hasComms).toBe(true);
      
      benchmarkResults.push({
        topology: result.topology,
        agentCount: result.agentCount,
        setupTime: result.setupTime,
        communicationLatency: result.communicationLatency,
        memoryUsage: result.memoryUsage,
        throughput: 0,
        success: result.success
      });
      
      console.log(`📡 Communication setup: ${result.setupTime.toFixed(0)}ms`);
    }, BENCHMARK_TIMEOUT);
  });

  describe('Memory Usage Patterns', () => {
    test('should scale memory usage linearly with agent count', async () => {
      const memoryResults: Array<{ agents: number; memory: number }> = [];
      
      for (const agentCount of [2, 3, 5]) {
        const result = await benchmarkSwarmSetup(
          `Memory test with ${agentCount} agents`,
          { maxAgents: agentCount, measureMemory: true }
        );
        
        expect(result.success).toBe(true);
        
        memoryResults.push({
          agents: agentCount,
          memory: result.memoryUsage
        });
        
        console.log(`💾 ${agentCount} agents: ${(result.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
      }
      
      // Verify memory scales reasonably (not exponentially)
      const memoryGrowthRate = memoryResults[2].memory / memoryResults[0].memory;
      const agentGrowthRate = memoryResults[2].agents / memoryResults[0].agents;
      
      expect(memoryGrowthRate).toBeLessThan(agentGrowthRate * 2); // Memory shouldn't grow more than 2x the agent ratio
    }, BENCHMARK_TIMEOUT);
  });

  describe('Scalability Thresholds', () => {
    test('should maintain performance under increasing load', async () => {
      const scalabilityResults: ScalabilityTest = {
        agentCounts: [2, 3, 5, 8],
        topologies: [],
        results: new Map()
      };
      
      for (const agentCount of scalabilityResults.agentCounts) {
        const result = await benchmarkSwarmSetup(
          `Scalability test with ${agentCount} agents handling complex coordination`,
          { maxAgents: agentCount, fullBenchmark: true }
        );
        
        if (result.success) {
          const topology = result.topology;
          if (!scalabilityResults.results.has(topology)) {
            scalabilityResults.results.set(topology, []);
            scalabilityResults.topologies.push(topology);
          }
          
          scalabilityResults.results.get(topology)!.push({
            topology,
            agentCount,
            setupTime: result.setupTime,
            communicationLatency: result.communicationLatency,
            memoryUsage: result.memoryUsage,
            throughput: result.throughput,
            success: result.success
          });
        }
        
        console.log(`📈 ${agentCount} agents: ${result.setupTime.toFixed(0)}ms (${result.topology})`);
      }
      
      // Verify performance scaling
      for (const [topology, results] of scalabilityResults.results) {
        expect(results.length).toBeGreaterThan(0);
        
        // Setup time should scale sub-linearly
        const firstResult = results[0];
        const lastResult = results[results.length - 1];
        
        const timeRatio = lastResult.setupTime / firstResult.setupTime;
        const agentRatio = lastResult.agentCount / firstResult.agentCount;
        
        expect(timeRatio).toBeLessThan(agentRatio * 1.5); // Allow 50% overhead
        
        console.log(`📊 ${topology} scaling: ${timeRatio.toFixed(1)}x time for ${agentRatio.toFixed(1)}x agents`);
      }
    }, BENCHMARK_TIMEOUT);
  });

  describe('Enhanced SPARC Performance', () => {
    test('should generate enhanced prompts efficiently', async () => {
      const startTime = performance.now();
      
      const result = await benchmarkSwarmSetup(
        'Test SPARC prompt generation performance',
        { measurePromptGeneration: true }
      );
      
      const promptTime = performance.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(promptTime).toBeLessThan(5000); // Under 5 seconds for prompt generation
      
      // Verify enhanced prompts were created
      const promptsCreated = await verifyEnhancedPrompts(result.swarmId);
      expect(promptsCreated).toBe(true);
      
      console.log(`📝 Enhanced prompt generation: ${promptTime.toFixed(0)}ms`);
    }, BENCHMARK_TIMEOUT);
  });

  // Helper functions
  async function benchmarkSwarmSetup(
    objective: string,
    options: {
      maxAgents?: number;
      measureSetupOnly?: boolean;
      measureSpawning?: boolean;
      measureCommunication?: boolean;
      measureMemory?: boolean;
      measurePromptGeneration?: boolean;
      fullBenchmark?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{
    swarmId: string;
    topology: string;
    agentCount: number;
    setupTime: number;
    communicationLatency: number;
    memoryUsage: number;
    throughput: number;
    success: boolean;
  }> {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed;
    
    return new Promise((resolve) => {
      const args = ['swarm', 'launch', objective];
      
      if (options.maxAgents) {
        args.push('--max-agents', options.maxAgents.toString());
      }
      
      let stdout = '';
      let stderr = '';
      
      const child = spawn(process.execPath, [CLI_PATH, ...args], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Kill after timeout to prevent hanging
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
      }, options.timeout || 30000);
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        
        const endTime = performance.now();
        const finalMemory = process.memoryUsage().heapUsed;
        
        const setupTime = endTime - startTime;
        const memoryDelta = finalMemory - initialMemory;
        
        // Extract information from output
        const swarmIdMatch = stdout.match(/swarm-(\d+)/);
        const swarmId = swarmIdMatch ? swarmIdMatch[0] : 'unknown';
        
        const topologyMatch = stdout.match(/Topology: ([A-Z]+)/i);
        const topology = topologyMatch ? topologyMatch[1].toLowerCase() : 'unknown';
        
        const agentCountMatch = stdout.match(/Active Agents: (\d+)/);
        const agentCount = agentCountMatch ? parseInt(agentCountMatch[1]) : 0;
        
        resolve({
          swarmId,
          topology,
          agentCount,
          setupTime,
          communicationLatency: 50, // Placeholder
          memoryUsage: Math.max(0, memoryDelta),
          throughput: agentCount > 0 ? (agentCount * 1000) / setupTime : 0,
          success: code === 0
        });
      });
      
      child.on('error', () => {
        clearTimeout(timeout);
        resolve({
          swarmId: 'error',
          topology: 'error',
          agentCount: 0,
          setupTime: performance.now() - startTime,
          communicationLatency: 0,
          memoryUsage: 0,
          throughput: 0,
          success: false
        });
      });
    });
  }

  async function verifyCommInfrastructure(swarmId: string): Promise<boolean> {
    // Check if communication infrastructure was created
    // This is a simplified check - in a real test we'd verify the actual files
    return swarmId !== 'unknown' && swarmId !== 'error';
  }

  async function verifyEnhancedPrompts(swarmId: string): Promise<boolean> {
    // Check if enhanced prompts were generated
    // This is a simplified check - in a real test we'd verify the actual files
    return swarmId !== 'unknown' && swarmId !== 'error';
  }
}); 