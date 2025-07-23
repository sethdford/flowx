/**
 * Benchmark Command
 * Run performance benchmarks and load testing
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

interface BenchmarkResult {
  name: string;
  iterations: number;
  duration: number;
  operationsPerSecond: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

interface BenchmarkSuite {
  name: string;
  description: string;
  tests: BenchmarkTest[];
}

interface BenchmarkTest {
  name: string;
  operation: () => Promise<any>;
  iterations?: number;
  concurrency?: number;
  warmupIterations?: number;
}

interface SystemMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  uptime: number;
}

export const benchmarkCommand: CLICommand = {
  name: 'benchmark',
  description: 'Run performance benchmarks and load testing',
  category: 'System',
  usage: 'flowx benchmark <subcommand> [OPTIONS]',
  examples: [
    'flowx benchmark run --suite all',
    'flowx benchmark run --test memory',
    'flowx benchmark load --concurrent 10',
    'flowx benchmark compare --baseline baseline.tson',
    'flowx benchmark system --duration 60',
    'flowx benchmark report --format json'
  ],
  options: [
    {
      name: 'suite',
      short: 's',
      description: 'Benchmark suite to run (all, system, memory, cli, network)',
      type: 'string',
      default: 'all'
    },
    {
      name: 'test',
      short: 't',
      description: 'Specific test to run',
      type: 'string'
    },
    {
      name: 'iterations',
      short: 'i',
      description: 'Number of iterations per test',
      type: 'number',
      default: 100
    },
    {
      name: 'concurrent',
      short: 'c',
      description: 'Number of concurrent operations',
      type: 'number',
      default: 1
    },
    {
      name: 'duration',
      short: 'd',
      description: 'Test duration in seconds',
      type: 'number',
      default: 30
    },
    {
      name: 'warmup',
      short: 'w',
      description: 'Warmup iterations',
      type: 'number',
      default: 10
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format (table, json, csv)',
      type: 'string',
      default: 'table'
    },
    {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      type: 'string'
    },
    {
      name: 'baseline',
      short: 'b',
      description: 'Baseline file for comparison',
      type: 'string'
    },
    {
      name: 'threshold',
      description: 'Performance threshold (ms)',
      type: 'number'
    },
    {
      name: 'memory-limit',
      description: 'Memory limit (MB)',
      type: 'number'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output',
      type: 'boolean'
    }
  ],
  subcommands: [
    {
      name: 'run',
      description: 'Run benchmark suites or specific tests',
      handler: async (context: CLIContext) => await runBenchmarks(context)
    },
    {
      name: 'load',
      description: 'Run load testing scenarios',
      handler: async (context: CLIContext) => await runLoadTests(context)
    },
    {
      name: 'system',
      description: 'Run system performance monitoring',
      handler: async (context: CLIContext) => await runSystemBenchmark(context)
    },
    {
      name: 'compare',
      description: 'Compare results with baseline',
      handler: async (context: CLIContext) => await compareBenchmarks(context)
    },
    {
      name: 'report',
      description: 'Generate benchmark reports',
      handler: async (context: CLIContext) => await generateReport(context)
    },
    {
      name: 'list',
      description: 'List available benchmark suites and tests',
      handler: async (context: CLIContext) => await listBenchmarks(context)
    },
    {
      name: 'validate',
      description: 'Validate performance against thresholds',
      handler: async (context: CLIContext) => await validatePerformance(context)
    },
    {
      name: 'stress',
      description: 'Run stress testing scenarios',
      handler: async (context: CLIContext) => await runStressTests(context)
    }
  ],
  handler: async (context: CLIContext) => {
    const { args } = context;
    
    if (args.length === 0) {
      await listBenchmarks(context);
      return;
    }
    
    printError('Invalid subcommand. Use "flowx benchmark --help" for usage information.');
  }
};

// Subcommand handlers

async function runBenchmarks(context: CLIContext): Promise<void> {
  const { options } = context;

  try {
    printInfo('🚀 Starting benchmark execution...');
    
    const suites = await getBenchmarkSuites();
    const targetSuite = options.suite || 'all';
    const targetTest = options.test;

    let suitesToRun: BenchmarkSuite[] = [];
    
    if (targetSuite === 'all') {
      suitesToRun = suites;
    } else {
      const suite = suites.find(s => s.name === targetSuite);
      if (!suite) {
        printError(`Benchmark suite '${targetSuite}' not found`);
        return;
      }
      suitesToRun = [suite];
    }

    const results: BenchmarkResult[] = [];
    
    for (const suite of suitesToRun) {
      printInfo(`Running ${suite.name} benchmark suite...`);
      
      let testsToRun = suite.tests;
      if (targetTest) {
        testsToRun = suite.tests.filter(t => t.name.includes(targetTest));
        if (testsToRun.length === 0) {
          printWarning(`No tests matching '${targetTest}' found in ${suite.name}`);
          continue;
        }
      }
      
      for (const test of testsToRun) {
        printInfo(`  Running ${test.name}...`);
        
        const result = await runSingleBenchmark(test, {
          iterations: options.iterations || test.iterations || 100,
          concurrency: options.concurrent || test.concurrency || 1,
          warmupIterations: options.warmup || test.warmupIterations || 10,
          verbose: options.verbose
        });
        
        results.push(result);
        
        if (options.verbose) {
          printSuccess(`    ✅ ${result.operationsPerSecond.toFixed(0)} ops/sec, ${result.averageLatency.toFixed(2)}ms avg`);
        }
      }
    }

    // Display results
    await displayResults(results, options);

    // Save results if output specified
    if (options.output) {
      await saveResults(results, options.output, options.format);
      printSuccess(`Results saved to ${options.output}`);
    }

    printSuccess(`✅ Benchmark execution completed (${results.length} tests)`);

  } catch (error) {
    printError(`Failed to run benchmarks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runLoadTests(context: CLIContext): Promise<void> {
  const { options } = context;

  try {
    printInfo('⚡ Starting load testing...');
    
    const concurrent = options.concurrent || 10;
    const duration = options.duration || 30;
    
    printInfo(`Configuration: ${concurrent} concurrent users, ${duration}s duration`);
    
    const loadTest = await createLoadTest({
      concurrency: concurrent,
      duration: duration * 1000,
      rampUp: 5000, // 5 second ramp up
    });

    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    const results: any[] = [];
    const errors: any[] = [];
    
    // Start load generation
    const workers = Array.from({ length: concurrent }, async (_, workerId) => {
      while (Date.now() < endTime) {
        try {
          const operationStart = performance.now();
          await loadTest.operation();
          const operationEnd = performance.now();
          
          results.push({
            workerId,
            duration: operationEnd - operationStart,
            timestamp: Date.now()
          });
          
          // Brief pause between operations
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        } catch (error) {
          errors.push({
            workerId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          });
        }
      }
    });

    await Promise.all(workers);
    
    // Analyze results
    const totalOperations = results.length;
    const totalErrors = errors.length;
    const successRate = totalOperations / (totalOperations + totalErrors);
    const averageLatency = results.reduce((sum, r) => sum + r.duration, 0) / totalOperations;
    const throughput = totalOperations / duration;
    
    console.log(successBold('\n⚡ Load Test Results\n'));
    console.log(`Duration: ${duration}s`);
    console.log(`Concurrent Users: ${concurrent}`);
    console.log(`Total Operations: ${totalOperations}`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log(`Success Rate: ${(successRate * 100).toFixed(2)}%`);
    console.log(`Throughput: ${throughput.toFixed(2)} ops/sec`);
    console.log(`Average Latency: ${averageLatency.toFixed(2)}ms`);
    
    if (options.verbose && errors.length > 0) {
      console.log('\nErrors:');
      errors.slice(0, 10).forEach((error, i) => {
        console.log(`  ${i + 1}. Worker ${error.workerId}: ${error.error}`);
      });
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }

    printSuccess('✅ Load testing completed');

  } catch (error) {
    printError(`Failed to run load tests: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runSystemBenchmark(context: CLIContext): Promise<void> {
  const { options } = context;

  try {
    printInfo('📊 Starting system performance monitoring...');
    
    const duration = options.duration || 30;
    const interval = 1000; // 1 second intervals
    const metrics: SystemMetrics[] = [];
    
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;
    
    printInfo(`Monitoring system for ${duration} seconds...`);
    
    while (Date.now() < endTime) {
      const metric = await collectSystemMetrics();
      metrics.push(metric);
      
      if (options.verbose) {
        process.stdout.write(`\rCPU: ${metric.cpuUsage.toFixed(1)}%, Memory: ${(metric.memoryUsage.rss / 1024 / 1024).toFixed(1)}MB`);
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    if (options.verbose) {
      console.log(); // New line after progress
    }
    
    // Analyze metrics
    const avgCpu = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length;
    const maxCpu = Math.max(...metrics.map(m => m.cpuUsage));
    const avgMemory = metrics.reduce((sum, m) => sum + m.memoryUsage.rss, 0) / metrics.length;
    const maxMemory = Math.max(...metrics.map(m => m.memoryUsage.rss));
    
    console.log(successBold('\n📊 System Performance Report\n'));
    console.log(`Monitoring Duration: ${duration}s`);
    console.log(`Sample Count: ${metrics.length}`);
    console.log(`Average CPU Usage: ${avgCpu.toFixed(2)}%`);
    console.log(`Peak CPU Usage: ${maxCpu.toFixed(2)}%`);
    console.log(`Average Memory Usage: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Peak Memory Usage: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
    
    // Check against limits
    if (options['memory-limit']) {
      const memoryLimitMB = options['memory-limit'];
      const peakMemoryMB = maxMemory / 1024 / 1024;
      if (peakMemoryMB > memoryLimitMB) {
        printWarning(`⚠️  Memory usage exceeded limit: ${peakMemoryMB.toFixed(2)}MB > ${memoryLimitMB}MB`);
      } else {
        printSuccess(`✅ Memory usage within limit: ${peakMemoryMB.toFixed(2)}MB <= ${memoryLimitMB}MB`);
      }
    }

    printSuccess('✅ System monitoring completed');

  } catch (error) {
    printError(`Failed to run system benchmark: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function compareBenchmarks(context: CLIContext): Promise<void> {
  const { options } = context;

  if (!options.baseline) {
    printError('Baseline file required for comparison. Use --baseline <file>');
    return;
  }

  try {
    printInfo('📈 Comparing benchmark results...');
    
    // Load baseline results
    const baselineData = await fs.readFile(options.baseline, 'utf-8');
    const baseline: BenchmarkResult[] = JSON.parse(baselineData);
    
    // Run current benchmarks
    const current = await runCurrentBenchmarks(options);
    
    // Compare results
    const comparisons = baseline.map(baselineResult => {
      const currentResult = current.find(r => r.name === baselineResult.name);
      
      if (!currentResult) {
        return {
          name: baselineResult.name,
          status: 'missing',
          message: 'Test not found in current results'
        };
      }
      
      const latencyChange = ((currentResult.averageLatency - baselineResult.averageLatency) / baselineResult.averageLatency) * 100;
      const throughputChange = ((currentResult.operationsPerSecond - baselineResult.operationsPerSecond) / baselineResult.operationsPerSecond) * 100;
      
      let status = 'stable';
      let message = '';
      
      if (Math.abs(latencyChange) > 10) {
        status = latencyChange > 0 ? 'degraded' : 'improved';
        message = `Latency ${latencyChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(latencyChange).toFixed(1)}%`;
      }
      
      if (Math.abs(throughputChange) > 10) {
        const throughputStatus = throughputChange > 0 ? 'improved' : 'degraded';
        if (status === 'stable') {
          status = throughputStatus;
          message = `Throughput ${throughputChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(throughputChange).toFixed(1)}%`;
        } else {
          message += `, Throughput ${throughputChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(throughputChange).toFixed(1)}%`;
        }
      }
      
      return {
        name: baselineResult.name,
        status,
        message: message || 'Performance within expected range',
        baseline: baselineResult,
        current: currentResult,
        latencyChange,
        throughputChange
      };
    });
    
    // Display comparison results
    console.log(successBold('\n📈 Benchmark Comparison Results\n'));
    
    const tableData = comparisons.map(comp => ({
      test: comp.name,
      status: comp.status === 'improved' ? '🟢 Improved' : 
              comp.status === 'degraded' ? '🔴 Degraded' :
              comp.status === 'missing' ? '⚪ Missing' : '🟡 Stable',
      latencyChange: comp.latencyChange ? `${comp.latencyChange > 0 ? '+' : ''}${comp.latencyChange.toFixed(1)}%` : 'N/A',
      throughputChange: comp.throughputChange ? `${comp.throughputChange > 0 ? '+' : ''}${comp.throughputChange.toFixed(1)}%` : 'N/A',
      message: comp.message
    }));
    
    console.log(formatTable(tableData, [
      { header: 'Test', key: 'test' },
      { header: 'Status', key: 'status' },
      { header: 'Latency Δ', key: 'latencyChange' },
      { header: 'Throughput Δ', key: 'throughputChange' },
      { header: 'Notes', key: 'message' }
    ]));
    
    const improved = comparisons.filter(c => c.status === 'improved').length;
    const degraded = comparisons.filter(c => c.status === 'degraded').length;
    const stable = comparisons.filter(c => c.status === 'stable').length;
    
    console.log();
    printSuccess(`✅ Comparison completed: ${improved} improved, ${stable} stable, ${degraded} degraded`);

  } catch (error) {
    printError(`Failed to compare benchmarks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function generateReport(context: CLIContext): Promise<void> {
  const { options } = context;

  try {
    printInfo('📋 Generating benchmark report...');
    
    // Collect all available benchmark data
    const reportData = {
      timestamp: new Date().toISOString(),
      system: await getSystemInfo(),
      benchmarks: await runCurrentBenchmarks(options),
      loadTests: [], // TODO: Load from saved results
      systemMetrics: await collectSystemMetrics()
    };
    
    const format = options.format || 'table';
    const output = options.output || `benchmark-report-${Date.now()}.${format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt'}`;
    
    await generateReportFile(reportData, output, format);
    
    printSuccess(`✅ Report generated: ${output}`);

  } catch (error) {
    printError(`Failed to generate report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listBenchmarks(context: CLIContext): Promise<void> {
  try {
    const suites = await getBenchmarkSuites();
    
    console.log(successBold('\n🧪 Available Benchmark Suites\n'));
    
    suites.forEach(suite => {
      console.log(`${suite.name}:`);
      console.log(`  Description: ${suite.description}`);
      console.log(`  Tests: ${suite.tests.length}`);
      
      if (context.options.verbose) {
        suite.tests.forEach(test => {
          console.log(`    - ${test.name}`);
        });
      }
      console.log();
    });
    
    console.log(`Total: ${suites.length} suites, ${suites.reduce((sum, s) => sum + s.tests.length, 0)} tests`);

  } catch (error) {
    printError(`Failed to list benchmarks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validatePerformance(context: CLIContext): Promise<void> {
  const { options } = context;

  try {
    printInfo('✅ Validating performance against thresholds...');
    
    const results = await runCurrentBenchmarks(options);
    const threshold = options.threshold || 100; // 100ms default
    
    const violations = results.filter(result => result.averageLatency > threshold);
    
    if (violations.length === 0) {
      printSuccess(`✅ All tests passed performance validation (< ${threshold}ms)`);
    } else {
      printWarning(`⚠️  ${violations.length} tests exceeded performance threshold:`);
      violations.forEach(violation => {
        console.log(`  - ${violation.name}: ${violation.averageLatency.toFixed(2)}ms > ${threshold}ms`);
      });
    }

  } catch (error) {
    printError(`Failed to validate performance: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runStressTests(context: CLIContext): Promise<void> {
  const { options } = context;

  try {
    printInfo('💥 Starting stress testing...');
    
    const maxConcurrency = options.concurrent || 50;
    const duration = options.duration || 60;
    
    printInfo(`Stress test: ramping up to ${maxConcurrency} concurrent operations over ${duration}s`);
    
    const results = [];
    const stressLevels = [1, 5, 10, 20, maxConcurrency];
    
    for (const concurrency of stressLevels) {
      printInfo(`  Testing with ${concurrency} concurrent operations...`);
      
      const stressResult = await runStressLevel(concurrency, 10); // 10 seconds per level
      results.push({
        concurrency,
        ...stressResult
      });
      
      if (options.verbose) {
        console.log(`    ${stressResult.operationsPerSecond.toFixed(0)} ops/sec, ${stressResult.errorRate.toFixed(2)}% errors`);
      }
    }
    
    // Analyze stress test results
    console.log(successBold('\n💥 Stress Test Results\n'));
    
    const tableData = results.map(result => ({
      concurrency: result.concurrency,
      throughput: `${result.operationsPerSecond.toFixed(0)} ops/sec`,
      latency: `${result.averageLatency.toFixed(2)}ms`,
      errors: `${result.errorRate.toFixed(2)}%`,
      status: result.errorRate < 5 ? '✅ Stable' : result.errorRate < 20 ? '⚠️  Degraded' : '❌ Failed'
    }));
    
    console.log(formatTable(tableData, [
      { header: 'Concurrency', key: 'concurrency' },
      { header: 'Throughput', key: 'throughput' },
      { header: 'Latency', key: 'latency' },
      { header: 'Error Rate', key: 'errors' },
      { header: 'Status', key: 'status' }
    ]));
    
    printSuccess('✅ Stress testing completed');

  } catch (error) {
    printError(`Failed to run stress tests: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper functions

async function getBenchmarkSuites(): Promise<BenchmarkSuite[]> {
  return [
    {
      name: 'system',
      description: 'Core system performance tests',
      tests: [
        {
          name: 'cli-initialization',
          operation: async () => {
            // Simulate CLI initialization
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            return 'initialized';
          }
        },
        {
          name: 'memory-allocation',
          operation: async () => {
            // Simulate memory operations
            const data = new Array(1000).fill(0).map((_, i) => ({ id: i, data: Math.random() }));
            return data.length;
          }
        },
        {
          name: 'file-operations',
          operation: async () => {
            // Simulate file operations
            const tempFile = `/tmp/benchmark-${Date.now()}-${Math.random()}`;
            await fs.writeFile(tempFile, 'benchmark data');
            await fs.readFile(tempFile);
            await fs.unlink(tempFile);
            return 'completed';
          }
        }
      ]
    },
    {
      name: 'cli',
      description: 'CLI command performance tests',
      tests: [
        {
          name: 'command-parsing',
          operation: async () => {
            // Simulate command parsing
            const args = ['benchmark', 'run', '--iterations', '100', '--concurrent', '5'];
            return args.length;
          }
        },
        {
          name: 'help-generation',
          operation: async () => {
            // Simulate help text generation
            const helpText = 'Usage: flowx benchmark <subcommand> [OPTIONS]...';
            return helpText.length;
          }
        }
      ]
    },
    {
      name: 'memory',
      description: 'Memory management performance tests',
      tests: [
        {
          name: 'large-object-creation',
          operation: async () => {
            const largeObject = {
              data: new Array(10000).fill(0).map(i => ({ index: i, value: Math.random() }))
            };
            return largeObject.data.length;
          }
        },
        {
          name: 'garbage-collection',
          operation: async () => {
            // Force garbage collection if available
            if (global.gc) {
              global.gc();
            }
            return process.memoryUsage().heapUsed;
          }
        }
      ]
    }
  ];
}

async function runSingleBenchmark(test: BenchmarkTest, options: {
  iterations: number;
  concurrency: number;
  warmupIterations: number;
  verbose?: boolean;
}): Promise<BenchmarkResult> {
  const { iterations, concurrency, warmupIterations } = options;
  
  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    await test.operation();
  }
  
  // Run benchmark
  const durations: number[] = [];
  const errors: any[] = [];
  
  const runBatch = async (batchSize: number) => {
    const promises = Array.from({ length: batchSize }, async () => {
      const start = performance.now();
      try {
        await test.operation();
        const end = performance.now();
        return end - start;
      } catch (error) {
        errors.push(error);
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    durations.push(...results.filter(d => d !== null) as number[]);
  };
  
  const batches = Math.ceil(iterations / concurrency);
  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(concurrency, iterations - i * concurrency);
    await runBatch(batchSize);
  }
  
  // Calculate statistics
  const sortedDurations = durations.sort((a, b) => a - b);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const averageLatency = totalDuration / durations.length;
  const operationsPerSecond = durations.length / (totalDuration / 1000);
  
  return {
    name: test.name,
    iterations: durations.length,
    duration: totalDuration,
    operationsPerSecond,
    averageLatency,
    minLatency: sortedDurations[0] || 0,
    maxLatency: sortedDurations[sortedDurations.length - 1] || 0,
    p95Latency: sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0,
    p99Latency: sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0,
    errorRate: errors.length / iterations
  };
}

async function createLoadTest(config: { concurrency: number; duration: number; rampUp: number }) {
  return {
    operation: async () => {
      // Simulate typical system operation
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
      
      // Simulate some computation
      const data = Array.from({ length: 100 }, (_, i) => i * Math.random());
      const result = data.reduce((sum, val) => sum + val, 0);
      
      return result;
    }
  };
}

async function collectSystemMetrics(): Promise<SystemMetrics> {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  // Simple CPU usage calculation (this is approximate)
  const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
  
  return {
    timestamp: new Date(),
    cpuUsage: Math.min(cpuPercent * 100, 100), // Cap at 100%
    memoryUsage: {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    },
    uptime: process.uptime()
  };
}

async function runCurrentBenchmarks(options: any): Promise<BenchmarkResult[]> {
  const suites = await getBenchmarkSuites();
  const results: BenchmarkResult[] = [];
  
  for (const suite of suites) {
    for (const test of suite.tests) {
      const result = await runSingleBenchmark(test, {
        iterations: options.iterations || 50,
        concurrency: options.concurrent || 1,
        warmupIterations: options.warmup || 5
      });
      results.push(result);
    }
  }
  
  return results;
}

async function runStressLevel(concurrency: number, duration: number): Promise<BenchmarkResult> {
  const endTime = Date.now() + duration * 1000;
  const durations: number[] = [];
  const errors: any[] = [];
  
  const workers = Array.from({ length: concurrency }, async () => {
    while (Date.now() < endTime) {
      const start = performance.now();
      try {
        // Simulate work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        const end = performance.now();
        durations.push(end - start);
      } catch (error) {
        errors.push(error);
      }
    }
  });
  
  await Promise.all(workers);
  
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const averageLatency = totalDuration / durations.length;
  const operationsPerSecond = durations.length / duration;
  
  return {
    name: `stress-${concurrency}`,
    iterations: durations.length,
    duration: totalDuration,
    operationsPerSecond,
    averageLatency,
    minLatency: Math.min(...durations),
    maxLatency: Math.max(...durations),
    p95Latency: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] || 0,
    p99Latency: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.99)] || 0,
    errorRate: errors.length / (durations.length + errors.length)
  };
}

async function displayResults(results: BenchmarkResult[], options: any): Promise<void> {
  const format = options.format || 'table';
  
  if (format === 'table') {
    console.log(successBold('\n🧪 Benchmark Results\n'));
    
    const tableData = results.map(result => ({
      test: result.name,
      ops: `${result.operationsPerSecond.toFixed(0)}/sec`,
      latency: `${result.averageLatency.toFixed(2)}ms`,
      p95: `${result.p95Latency.toFixed(2)}ms`,
      errors: `${(result.errorRate * 100).toFixed(2)}%`
    }));
    
    console.log(formatTable(tableData, [
      { header: 'Test', key: 'test' },
      { header: 'Throughput', key: 'ops' },
      { header: 'Avg Latency', key: 'latency' },
      { header: 'P95 Latency', key: 'p95' },
      { header: 'Error Rate', key: 'errors' }
    ]));
  } else if (format === 'json') {
    console.log(JSON.stringify(results, null, 2));
  } else if (format === 'csv') {
    console.log('test,throughput,avg_latency,p95_latency,error_rate');
    results.forEach(result => {
      console.log(`${result.name},${result.operationsPerSecond.toFixed(0)},${result.averageLatency.toFixed(2)},${result.p95Latency.toFixed(2)},${(result.errorRate * 100).toFixed(2)}`);
    });
  }
}

async function saveResults(results: BenchmarkResult[], outputPath: string, format: string): Promise<void> {
  let content: string;
  
  if (format === 'json') {
    content = JSON.stringify(results, null, 2);
  } else if (format === 'csv') {
    content = 'test,throughput,avg_latency,p95_latency,error_rate\n';
    content += results.map(result => 
      `${result.name},${result.operationsPerSecond.toFixed(0)},${result.averageLatency.toFixed(2)},${result.p95Latency.toFixed(2)},${(result.errorRate * 100).toFixed(2)}`
    ).join('\n');
  } else {
    content = results.map(result => 
      `${result.name}: ${result.operationsPerSecond.toFixed(0)} ops/sec, ${result.averageLatency.toFixed(2)}ms avg`
    ).join('\n');
  }
  
  await fs.writeFile(outputPath, content);
}

async function generateReportFile(reportData: any, outputPath: string, format: string): Promise<void> {
  if (format === 'json') {
    await fs.writeFile(outputPath, JSON.stringify(reportData, null, 2));
  } else {
    // Generate text report
    let content = `# Benchmark Report\n\n`;
    content += `Generated: ${reportData.timestamp}\n`;
    content += `System: ${reportData.system.platform} ${reportData.system.arch}\n\n`;
    content += `## Benchmark Results\n\n`;
    
    reportData.benchmarks.forEach((result: BenchmarkResult) => {
      content += `### ${result.name}\n`;
      content += `- Throughput: ${result.operationsPerSecond.toFixed(0)} ops/sec\n`;
      content += `- Average Latency: ${result.averageLatency.toFixed(2)}ms\n`;
      content += `- P95 Latency: ${result.p95Latency.toFixed(2)}ms\n`;
      content += `- Error Rate: ${(result.errorRate * 100).toFixed(2)}%\n\n`;
    });
    
    await fs.writeFile(outputPath, content);
  }
}

async function getSystemInfo(): Promise<any> {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
}

export default benchmarkCommand; 