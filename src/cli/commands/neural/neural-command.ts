/**
 * Neural Network CLI Command
 * Provides access to WASM-accelerated neural network tools
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.ts';
import { createNeuralTools } from '../../../mcp/neural-tools.js';
import { Logger } from '../../../core/logger.js';

export const neuralCommand: CLICommand = {
  name: 'neural',
  description: 'WASM-accelerated neural network operations',
  subcommands: [
    {
      name: 'status',
      description: 'Check neural network system status',
      options: [
        { name: '--include-models', description: 'Include model details', type: 'boolean' },
        { name: '--include-metrics', description: 'Include performance metrics', type: 'boolean' }
      ],
      handler: async (context: CLIContext) => {
        const args = context.args || [];
        const logger = new Logger({ level: 'info', format: 'json', destination: 'console' });
        const neuralTools = createNeuralTools(logger);
        const statusTool = neuralTools.find(tool => tool.name === 'neural/status');
        
        if (!statusTool) {
          console.error('❌ Neural status tool not found');
          return;
        }

        const includeModels = args.includes('--include-models');
        const includeMetrics = args.includes('--include-metrics');

        try {
          console.log('🧠 Checking neural network status...');
          const result = await statusTool.handler({ includeModels, includeMetrics }) as any;
          
          if (result.success) {
            console.log('✅ Neural Network System Status');
            console.log('================================');
            console.log(`Backend: ${result.backend}`);
            console.log(`TensorFlow.js Version: ${result.tensorflow_version}`);
            console.log(`WASM Enabled: ${result.wasm_enabled ? '✅' : '❌'}`);
            console.log(`SIMD Optimized: ${result.simd_optimized ? '✅' : '❌'}`);
            console.log(`Models Available: ${result.models}`);
            console.log(`Active Patterns: ${result.active_patterns}`);
            console.log(`Memory Usage: ${result.memory_usage.numTensors} tensors, ${result.memory_usage.numBytes} bytes`);
            
            if (result.patterns && includeModels) {
              console.log('\n📋 Available Patterns:');
              result.patterns.forEach((pattern: any) => {
                console.log(`  • ${pattern.name} (${pattern.type}) - Accuracy: ${(pattern.accuracy * 100).toFixed(1)}%`);
              });
            }

            if (result.metrics && includeMetrics) {
              console.log('\n📊 Performance Metrics:');
              result.metrics.forEach((metric: any) => {
                console.log(`  • ${metric.id}: ${(metric.accuracy * 100).toFixed(1)}% accuracy, ${metric.usageCount} uses`);
              });
            }
          } else {
            console.error(`❌ Neural status check failed: ${result.error}`);
          }
        } catch (error) {
          console.error(`❌ Failed to check neural status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    },
    {
      name: 'wasm_optimize',
      description: 'Optimize neural operations with WASM SIMD acceleration',
      options: [
        { name: '--operation', description: 'Operation to optimize (matrix_multiply, convolution)', type: 'string', required: true },
        { name: '--benchmark', description: 'Run performance benchmarks', type: 'boolean' }
      ],
      handler: async (context: CLIContext) => {
        const args = context.args || [];
        const logger = new Logger({ level: 'info', format: 'json', destination: 'console' });
        const neuralTools = createNeuralTools(logger);
        const wasmTool = neuralTools.find(tool => tool.name === 'neural/wasm_optimize');
        
        if (!wasmTool) {
          console.error('❌ WASM optimization tool not found');
          return;
        }

        const operationIndex = args.indexOf('--operation');
        const operation = operationIndex !== -1 ? args[operationIndex + 1] : 'matrix_multiply';
        const benchmark = args.includes('--benchmark');

        try {
          console.log(`⚡ Optimizing neural operation: ${operation}...`);
          if (benchmark) {
            console.log('🔬 Running performance benchmarks...');
          }
          
          const result = await wasmTool.handler({ operation, benchmark }) as any;
          
          if (result.success) {
            console.log('✅ WASM Neural Acceleration Results');
            console.log('===================================');
            console.log(`Operation: ${result.operation}`);
            console.log(`Backend: ${result.wasm_acceleration.backend}`);
            console.log(`WASM Enabled: ${result.wasm_acceleration.wasm_enabled ? '✅' : '❌'}`);
            console.log(`SIMD Enabled: ${result.wasm_acceleration.simd_enabled ? '✅' : '❌'}`);
            console.log(`Threads Enabled: ${result.wasm_acceleration.threads_enabled ? '✅' : '❌'}`);
            console.log(`Performance Boost: ${result.wasm_acceleration.performance_boost}`);
            
            console.log('\n💾 Memory Usage:');
            console.log(`  Tensors: ${result.wasm_acceleration.memory_usage.numTensors}`);
            console.log(`  Data Buffers: ${result.wasm_acceleration.memory_usage.numDataBuffers}`);
            console.log(`  Memory: ${(result.wasm_acceleration.memory_usage.numBytes / 1024 / 1024).toFixed(2)} MB`);

            if (result.benchmark_results) {
              console.log('\n🏁 Benchmark Results:');
              console.log(`  Operation: ${result.benchmark_results.operation}`);
              console.log(`  CPU Time: ${result.benchmark_results.cpuTime.toFixed(2)}ms`);
              console.log(`  WASM Time: ${result.benchmark_results.wasmTime.toFixed(2)}ms`);
              console.log(`  Speedup: ${result.benchmark_results.speedup.toFixed(1)}x faster`);
              console.log(`  Input Size: ${result.benchmark_results.inputSize.toLocaleString()} elements`);
            }
          } else {
            console.error(`❌ WASM optimization failed: ${result.error}`);
            if (result.fallback_backend) {
              console.log(`🔄 Fallback backend: ${result.fallback_backend}`);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to optimize with WASM: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    },
    {
      name: 'benchmark',
      description: 'Run comprehensive neural performance benchmarks',
      handler: async (context: CLIContext) => {
        const logger = new Logger({ level: 'info', format: 'json', destination: 'console' });
        const neuralTools = createNeuralTools(logger);
        const wasmTool = neuralTools.find(tool => tool.name === 'neural/wasm_optimize');
        
        if (!wasmTool) {
          console.error('❌ WASM optimization tool not found');
          return;
        }

        console.log('🏁 Running Neural Performance Benchmarks');
        console.log('========================================');

        const operations = ['matrix_multiply', 'convolution', 'neural_forward_pass'];

        for (const operation of operations) {
          try {
            console.log(`\n⚡ Testing ${operation}...`);
            const result = await wasmTool.handler({ operation, benchmark: true }) as any;
            
            if (result.success && result.benchmark_results) {
              const br = result.benchmark_results;
              console.log(`  ✅ ${operation}:`);
              console.log(`     CPU Time: ${br.cpuTime.toFixed(2)}ms`);
              console.log(`     WASM Time: ${br.wasmTime.toFixed(2)}ms`);
              console.log(`     Speedup: ${br.speedup.toFixed(1)}x`);
              console.log(`     Backend: ${result.wasm_acceleration.backend}`);
            } else {
              console.log(`  ❌ ${operation}: ${result.error || 'Benchmark failed'}`);
            }
          } catch (error) {
            console.log(`  ❌ ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        console.log('\n🎯 Benchmark Summary Complete');
      }
    }
  ],
  handler: async (context: CLIContext) => {
    const args = context.args || [];
    if (args.length === 0) {
      console.log('🧠 Neural Network Operations');
      console.log('============================');
      console.log('Available commands:');
      console.log('  status       - Check neural network system status');
      console.log('  wasm_optimize - Optimize with WASM SIMD acceleration');
      console.log('  benchmark    - Run performance benchmarks');
      console.log('');
      console.log('Example usage:');
      console.log('  flowx neural status --include-models');
      console.log('  flowx neural wasm_optimize --operation matrix_multiply --benchmark');
      console.log('  flowx neural benchmark');
      return;
    }

    console.error(`❌ Unknown neural subcommand: ${args[0]}`);
    console.log('Run "flowx neural" to see available commands');
  }
}; 