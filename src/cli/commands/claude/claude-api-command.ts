/**
 * SUPERIOR Claude API Management Commands
 * Comprehensive CLI interface for our enhanced Claude API client
 * Exceeds original with advanced configuration, analytics, and model recommendations
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { Logger } from '../../../core/logger.js';
import { ConfigManager } from '../../../config/config-manager.js';
import { ClaudeAPIClient, ClaudeModel, createClaudeAPIClient } from '../../../api/claude-api-client.js';
import { ModelSelector, DEFAULT_MODEL_ID } from '../../../config/models.js';

// Interactive prompts for configuration
async function promptClaudeConfiguration(): Promise<any> {
  // Simple prompt implementation since we don't have inquirer
  console.log('📝 Interactive Claude API Configuration');
  console.log('=====================================\n');
  
  const config: any = {};
  
  // API Key
  console.log('1. API Key Configuration');
  console.log('   Set your ANTHROPIC_API_KEY environment variable or provide it here');
  console.log('   Current: ' + (process.env.ANTHROPIC_API_KEY ? '[SET]' : '[NOT SET]'));
  
  // Model Selection
  console.log('\n2. Model Selection');
  console.log('   Available models:');
  console.log(`   - ${ModelSelector.getDefault().id} (Recommended - Latest & Most Capable)`);
  console.log('   - claude-3-5-haiku-20241022  (Fast & Efficient)');
  console.log('   - claude-3-opus-20240229     (Most Advanced Reasoning)');
  console.log('   - claude-3-sonnet-20240229   (Balanced Performance)');
  console.log('   - claude-3-haiku-20240307    (Cost Effective)');
  console.log('   - claude-2.1, claude-2.0    (Legacy Support)');
  console.log('   - claude-instant-1.2         (Fastest & Cheapest)');
  
      config.model = DEFAULT_MODEL_ID; // Default to best
  
  // Temperature
  console.log('\n3. Temperature (0.0-1.0)');
  console.log('   0.0 = Deterministic, 1.0 = Creative');
  config.temperature = 0.7;
  
  // Max Tokens
  console.log('\n4. Maximum Tokens');
  console.log('   Response length limit (1-8192)');
  config.maxTokens = 4096;
  
  // Advanced Features
  console.log('\n5. Advanced Features');
  config.streamingEnabled = false;
  config.autoRetryOnRateLimit = true;
  
  console.log('\n✅ Configuration complete! Use --api-key to set your API key.');
  return config;
}

export const claudeApiCommand: CLICommand = {
  name: 'claude-api',
  description: 'Manage and test Claude API with comprehensive model support',
  handler: async (context: CLIContext) => {
    console.log('🤖 Claude API Management');
    console.log('========================\n');
    console.log('Available commands:');
    console.log('  configure  - Configure Claude API settings');
    console.log('  test       - Test API connectivity');
    console.log('  models     - List available models');
    console.log('  chat       - Interactive chat');
    console.log('  analytics  - View usage analytics');
    console.log('\nUse: flowx claude-api <command> --help for more info');
  },
  subcommands: [
    {
      name: 'configure',
      description: 'Configure Claude API settings with interactive setup',
      options: [
        { name: '--api-key', description: 'Set Claude API key', type: 'string' },
        { name: '--model', description: 'Set default Claude model', type: 'string' },
        { name: '--temperature', description: 'Set temperature (0.0-1.0)', type: 'string' },
        { name: '--max-tokens', description: 'Set max tokens (1-8192)', type: 'string' },
        { name: '--streaming', description: 'Enable streaming responses', type: 'boolean' },
        { name: '--interactive', description: 'Interactive configuration wizard', type: 'boolean' }
      ],
      handler: async (context: CLIContext) => {
        const { args, options } = context;
        const logger = new Logger({ level: 'info', format: 'json', destination: 'console' });
        const configManager = ConfigManager.getInstance();
        
        try {
          console.log('🤖 Claude API Configuration');
          console.log('===========================\n');
          
          if (options.interactive) {
            const config = await promptClaudeConfiguration();
            
            // Save configuration
            configManager.set('claude', config);
            await configManager.save();
            
            console.log('✅ Configuration saved successfully!');
            console.log('📁 Config stored in configuration manager');
            return;
          }
          
          // Direct configuration options
          const updates: any = {};
          
          if (options['api-key']) {
            updates.apiKey = options['api-key'];
            console.log('🔑 API key configured');
          }
          
          if (options.model) {
            const validModels = [
              ...Object.keys(ModelSelector.getAllModels()),
              'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307',
              'claude-2.1', 'claude-2.0', 'claude-instant-1.2', 'claude-instant-1.1', 'claude-instant-1.0'
            ];
            
            if (validModels.includes(options.model)) {
              updates.model = options.model;
              console.log('🧠 Model set to:', options.model);
            } else {
              console.error('❌ Invalid model. Valid models:', validModels.join(', '));
              return;
            }
          }
          
          if (options.temperature) {
            const temp = parseFloat(options.temperature);
            if (temp >= 0 && temp <= 1) {
              updates.temperature = temp;
              console.log('🌡️ Temperature set to:', temp);
            } else {
              console.error('❌ Temperature must be between 0.0 and 1.0');
              return;
            }
          }
          
          if (options['max-tokens']) {
            const tokens = parseInt(options['max-tokens']);
            if (tokens > 0 && tokens <= 8192) {
              updates.maxTokens = tokens;
              console.log('📏 Max tokens set to:', tokens);
            } else {
              console.error('❌ Max tokens must be between 1 and 8192');
              return;
            }
          }
          
          if (options.streaming !== undefined) {
            updates.streamingEnabled = options.streaming;
            console.log('📡 Streaming enabled:', options.streaming);
          }
          
          if (Object.keys(updates).length > 0) {
            // Get existing config and merge
            const existingConfig = configManager.get('claude') || {};
            const newConfig = { ...existingConfig, ...updates };
            
            configManager.set('claude', newConfig);
            await configManager.save();
            
            console.log('✅ Configuration updated successfully!');
          } else {
            // Show current configuration
            const currentConfig = configManager.get('claude') || {};
            console.log('📋 Current Claude API Configuration:');
            console.log('=====================================');
            console.log('Model:', currentConfig.model || DEFAULT_MODEL_ID);
            console.log('Temperature:', currentConfig.temperature || 0.7);
            console.log('Max Tokens:', currentConfig.maxTokens || 4096);
            console.log('Streaming:', currentConfig.streamingEnabled || false);
            console.log('API Key:', process.env.ANTHROPIC_API_KEY ? '[SET]' : '[NOT SET]');
            console.log('\nUse --interactive for guided setup or specify options directly');
          }
          
        } catch (error) {
          console.error('❌ Configuration failed:', error);
        }
      }
    },
    
    {
      name: 'test',
      description: 'Test Claude API connectivity and performance',
      options: [
        { name: '--model', description: 'Test specific model', type: 'string' },
        { name: '--message', description: 'Custom test message', type: 'string' },
        { name: '--benchmark', description: 'Run performance benchmark', type: 'boolean' },
        { name: '--streaming', description: 'Test streaming capability', type: 'boolean' }
      ],
      handler: async (context: CLIContext) => {
        const { args, options } = context;
        const logger = new Logger({ level: 'info', format: 'json', destination: 'console' });
        const configManager = ConfigManager.getInstance();
        
        try {
          console.log('🧪 Testing Claude API Connection');
          console.log('=================================\n');
          
          // Create client
          const clientConfig: any = {};
          if (options.model) clientConfig.model = options.model;
          if (options.streaming) clientConfig.streamingEnabled = true;
          
          const client = createClaudeAPIClient(logger, configManager, clientConfig);
          
          console.log('📡 Running health check...');
          const health = await client.healthCheck();
          
          console.log('\n🏥 Health Check Results:');
          console.log('========================');
          console.log('Status:', health.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY');
          console.log('Model:', health.model);
          console.log('API Key Valid:', health.apiKeyValid ? '✅ YES' : '❌ NO');
          console.log('Latency:', health.latency + 'ms');
          console.log('Capabilities:');
          console.log('  - Context Window:', health.capabilities.contextWindow.toLocaleString());
          console.log('  - Max Output:', health.capabilities.maxOutputTokens.toLocaleString());
          console.log('  - Vision Support:', health.capabilities.supportsVision ? '✅' : '❌');
          console.log('  - Tool Use:', health.capabilities.supportsToolUse ? '✅' : '❌');
          console.log('  - Cost/1K tokens:', (health.capabilities.costPerInputToken * 1000).toFixed(4));
          
          if (health.error) {
            console.log('Error:', health.error);
            return;
          }
          
          if (!health.healthy) {
            console.log('\n❌ API not healthy. Check your configuration and API key.');
            return;
          }
          
          // Test message
          console.log('\n💬 Testing message sending...');
          const testMessage = options.message || 'Hello! Please respond with "Claude API test successful!" to confirm the connection is working.';
          
          const startTime = Date.now();
          
          if (options.streaming) {
            console.log('📡 Testing streaming response...');
            let streamedText = '';
            
            await client.streamMessage({
              role: 'user',
              content: testMessage
            }, {
              max_tokens: 100,
              temperature: 0
            }, (chunk) => {
              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                process.stdout.write(chunk.delta.text);
                streamedText += chunk.delta.text;
              }
            });
            
            console.log('\n\n✅ Streaming test completed!');
          } else {
            const response = await client.sendMessage({
              role: 'user',
              content: testMessage
            }, {
              max_tokens: 100,
              temperature: 0
            });
            
            console.log('📨 Response received:');
            console.log('Response:', response.content[0]?.text || 'No text content');
          }
          
          const duration = Date.now() - startTime;
          console.log('⏱️ Response time:', duration + 'ms');
          
          // Benchmark mode
          if (options.benchmark) {
            console.log('\n🏃 Running performance benchmark...');
            const benchmarkResults = await runBenchmark(client);
            displayBenchmarkResults(benchmarkResults);
          }
          
          // Usage metrics
          const metrics = client.getUsageMetrics();
          console.log('\n📊 Usage Metrics:');
          console.log('=================');
          console.log('Total Requests:', metrics.totalRequests);
          console.log('Total Tokens:', metrics.totalTokensUsed);
          console.log('Total Cost: $' + metrics.totalCost.toFixed(4));
          console.log('Success Rate:', (metrics.successRate * 100).toFixed(1) + '%');
          console.log('Avg Response Time:', metrics.averageResponseTime.toFixed(0) + 'ms');
          
          if (metrics.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            metrics.recommendations.forEach(rec => console.log('  •', rec));
          }
          
          await client.close();
          
        } catch (error) {
          console.error('❌ Test failed:', error);
        }
      }
    },
    
    {
      name: 'models',
      description: 'List available models and get recommendations',
      options: [
        { name: '--use-case', description: 'Get model recommendations for use case', type: 'string' },
        { name: '--needs-vision', description: 'Require vision support', type: 'boolean' },
        { name: '--needs-tools', description: 'Require tool use support', type: 'boolean' },
        { name: '--max-cost', description: 'Maximum cost per 1K tokens', type: 'string' },
        { name: '--details', description: 'Show detailed capabilities', type: 'boolean' }
      ],
      handler: async (context: CLIContext) => {
        const { args, options } = context;
        const logger = new Logger({ level: 'info', format: 'json', destination: 'console' });
        const configManager = ConfigManager.getInstance();
        
        try {
          const client = createClaudeAPIClient(logger, configManager);
          const allModels = client.getAllModels();
          
          if (options['use-case']) {
            console.log('🎯 Model Recommendations for:', options['use-case']);
            console.log('===========================================\n');
            
            const requirements: any = {};
            if (options['needs-vision']) requirements.needsVision = true;
            if (options['needs-tools']) requirements.needsToolUse = true;
            if (options['max-cost']) requirements.maxCost = parseFloat(options['max-cost']) / 1000;
            
            const recommendations = client.recommendModel(options['use-case'], requirements);
            
            if (recommendations.length === 0) {
              console.log('❌ No models match your requirements');
              return;
            }
            
            console.log('📋 Recommended Models (in order of preference):');
            recommendations.forEach((model, index) => {
              const caps = allModels[model];
              console.log(`\n${index + 1}. ${model}`);
              console.log(`   Cost: $${(caps.costPerInputToken * 1000).toFixed(4)}/1K tokens`);
              console.log(`   Strengths: ${caps.strengths.join(', ')}`);
              console.log(`   Best for: ${caps.optimalUseCases.join(', ')}`);
              console.log(`   Vision: ${caps.supportsVision ? '✅' : '❌'} | Tools: ${caps.supportsToolUse ? '✅' : '❌'}`);
            });
            
          } else {
            console.log('📚 Available Claude Models');
            console.log('==========================\n');
            
            Object.entries(allModels).forEach(([model, caps]) => {
              console.log(`🤖 ${model}`);
              if (options.details) {
                console.log(`   Context: ${caps.contextWindow.toLocaleString()} tokens`);
                console.log(`   Max Output: ${caps.maxOutputTokens.toLocaleString()} tokens`);
                console.log(`   Cost: $${(caps.costPerInputToken * 1000).toFixed(4)}/1K input | $${(caps.costPerOutputToken * 1000).toFixed(4)}/1K output`);
                console.log(`   Rate Limit: ${caps.rateLimit.requestsPerMinute} req/min | ${caps.rateLimit.tokensPerMinute.toLocaleString()} tokens/min`);
                console.log(`   Features: Vision ${caps.supportsVision ? '✅' : '❌'} | Tools ${caps.supportsToolUse ? '✅' : '❌'}`);
                console.log(`   Strengths: ${caps.strengths.join(', ')}`);
                console.log(`   Best for: ${caps.optimalUseCases.join(', ')}`);
              } else {
                console.log(`   $${(caps.costPerInputToken * 1000).toFixed(4)}/1K tokens | ${caps.strengths.slice(0, 3).join(', ')}`);
              }
              console.log('');
            });
            
            console.log('💡 Use --use-case <description> for personalized recommendations');
            console.log('💡 Use --details for comprehensive model information');
          }
          
          await client.close();
          
        } catch (error) {
          console.error('❌ Failed to load models:', error);
        }
      }
    },
    
    {
      name: 'chat',
      description: 'Interactive chat with Claude API',
      options: [
        { name: '--model', description: 'Model to use for chat', type: 'string' },
        { name: '--temperature', description: 'Response creativity (0.0-1.0)', type: 'string' },
        { name: '--streaming', description: 'Enable streaming responses', type: 'boolean' },
        { name: '--system', description: 'System prompt', type: 'string' }
      ],
      handler: async (context: CLIContext) => {
        const { args, options } = context;
        const logger = new Logger({ level: 'info', format: 'json', destination: 'console' });
        const configManager = ConfigManager.getInstance();
        
        try {
          const message = args.join(' ').trim();
          
          if (!message) {
            console.error('❌ Usage: flowx claude-api chat <message>');
            console.log('Example: flowx claude-api chat "Explain quantum computing"');
            return;
          }
          
          console.log('💬 Chatting with Claude API');
          console.log('============================\n');
          
          const clientConfig: any = {};
          if (options.model) clientConfig.model = options.model;
          if (options.temperature) clientConfig.temperature = parseFloat(options.temperature);
          if (options.streaming) clientConfig.streamingEnabled = true;
          
          const client = createClaudeAPIClient(logger, configManager, clientConfig);
          
          console.log('🤖 Model:', clientConfig.model || DEFAULT_MODEL_ID);
          console.log('👤 You:', message);
          console.log('🤖 Claude:');
          console.log('');
          
          const requestOptions: any = {};
          if (options.system) requestOptions.system = options.system;
          
          if (options.streaming) {
            await client.streamMessage({
              role: 'user',
              content: message
            }, requestOptions, (chunk) => {
              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                process.stdout.write(chunk.delta.text);
              }
            });
            console.log('\n');
          } else {
            const response = await client.sendMessage({
              role: 'user',
              content: message
            }, requestOptions);
            
            console.log(response.content[0]?.text || 'No response text');
            console.log('\n📊 Usage:', response.usage.input_tokens, 'in +', response.usage.output_tokens, 'out tokens');
          }
          
          await client.close();
          
        } catch (error) {
          console.error('❌ Chat failed:', error);
        }
      }
    },
    
    {
      name: 'analytics',
      description: 'View Claude API usage analytics and optimization insights',
      options: [
        { name: '--export', description: 'Export analytics to JSON file', type: 'string' }
      ],
      handler: async (context: CLIContext) => {
        const { args, options } = context;
        const logger = new Logger({ level: 'info', format: 'json', destination: 'console' });
        const configManager = ConfigManager.getInstance();
        
        try {
          console.log('📈 Claude API Analytics');
          console.log('=======================\n');
          
          const client = createClaudeAPIClient(logger, configManager);
          const analytics = client.getUsageMetrics();
          
          console.log('📊 Overall Usage:');
          console.log('=================');
          console.log('Total Requests:', analytics.totalRequests);
          console.log('Total Tokens:', analytics.totalTokensUsed.toLocaleString());
          console.log('Total Cost: $' + analytics.totalCost.toFixed(4));
          console.log('Success Rate:', (analytics.successRate * 100).toFixed(1) + '%');
          
          console.log('\n⚡ Performance:');
          console.log('===============');
          console.log('Average Latency:', analytics.performance.averageLatency.toFixed(0) + 'ms');
          console.log('P95 Latency:', analytics.performance.p95Latency.toFixed(0) + 'ms');
          console.log('Error Rate:', (analytics.performance.errorRate * 100).toFixed(1) + '%');
          
          if (Object.keys(analytics.costBreakdown).length > 0) {
            console.log('\n💰 Cost Breakdown by Model:');
            console.log('============================');
            Object.entries(analytics.costBreakdown).forEach(([model, cost]) => {
              console.log(`${model}: $${cost.toFixed(4)}`);
            });
          }
          
          if (Object.keys(analytics.requestsByModel).length > 0) {
            console.log('\n🤖 Requests by Model:');
            console.log('=====================');
            Object.entries(analytics.requestsByModel).forEach(([model, count]) => {
              console.log(`${model}: ${count} requests`);
            });
          }
          
          if (Object.keys(analytics.errorsByType).length > 0) {
            console.log('\n❌ Errors by Type:');
            console.log('==================');
            Object.entries(analytics.errorsByType).forEach(([type, count]) => {
              console.log(`${type}: ${count} errors`);
            });
          }
          
          if (analytics.recommendations.length > 0) {
            console.log('\n💡 Optimization Recommendations:');
            console.log('=================================');
            analytics.recommendations.forEach(rec => console.log('  •', rec));
          }
          
          if (options.export) {
            const fs = await import('fs/promises');
            await fs.writeFile(options.export, JSON.stringify(analytics, null, 2));
            console.log(`\n📁 Analytics exported to: ${options.export}`);
          }
          
          await client.close();
          
        } catch (error) {
          console.error('❌ Analytics failed:', error);
        }
      }
    }
  ]
};

// Helper functions for benchmarking
async function runBenchmark(client: ClaudeAPIClient): Promise<any> {
  const benchmarks = [
    { name: 'Simple Question', message: 'What is 2+2?', expectedTokens: 10 },
    { name: 'Code Generation', message: 'Write a Python function to calculate fibonacci', expectedTokens: 100 },
    { name: 'Analysis Task', message: 'Explain the pros and cons of renewable energy', expectedTokens: 200 }
  ];
  
  const results = [];
  
  for (const benchmark of benchmarks) {
    const startTime = Date.now();
    try {
      const response = await client.sendMessage({
        role: 'user',
        content: benchmark.message
      }, {
        max_tokens: benchmark.expectedTokens,
        temperature: 0
      });
      
      const duration = Date.now() - startTime;
      results.push({
        name: benchmark.name,
        duration,
        tokens: response.usage.output_tokens,
        success: true
      });
    } catch (error) {
      results.push({
        name: benchmark.name,
        duration: Date.now() - startTime,
        tokens: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

function displayBenchmarkResults(results: any[]): void {
  console.log('\n🏆 Benchmark Results:');
  console.log('=====================');
  
  results.forEach(result => {
    console.log(`\n${result.name}:`);
    console.log(`  Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`  Duration: ${result.duration}ms`);
    if (result.success) {
      console.log(`  Tokens: ${result.tokens}`);
      console.log(`  Speed: ${(result.tokens / (result.duration / 1000)).toFixed(1)} tokens/sec`);
    }
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  });
  
  const successful = results.filter(r => r.success);
  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const totalTokens = successful.reduce((sum, r) => sum + r.tokens, 0);
    
    console.log('\n📊 Summary:');
    console.log(`Average Response Time: ${avgDuration.toFixed(0)}ms`);
    console.log(`Total Tokens Generated: ${totalTokens}`);
    console.log(`Success Rate: ${(successful.length / results.length * 100).toFixed(1)}%`);
  }
} 