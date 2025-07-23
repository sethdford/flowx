/**
 * Memory Management Command
 * Comprehensive memory bank operations with actual backend integration
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { successBold, infoBold, warningBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getMemoryManager } from '../../core/global-initialization.js';

export const memoryCommand: CLICommand = {
  name: 'memory',
  description: 'Manage memory bank operations with real persistence',
  category: 'Memory',
  usage: 'flowx memory <subcommand> [OPTIONS]',
  examples: [
    'flowx memory store --key "project" --value "Important project requirements"',
    'flowx memory query --search "project"',
    'flowx memory list --type user',
    'flowx memory stats'
  ],
  subcommands: [
    {
      name: 'store',
      description: 'Store information in memory',
      handler: storeMemory,
      options: [
        {
          name: 'key',
          short: 'k',
          description: 'Memory key',
          type: 'string',
          required: true
        },
        {
          name: 'value',
          short: 'v',
          description: 'Memory value',
          type: 'string',
          required: true
        },
        {
          name: 'type',
          short: 't',
          description: 'Memory type',
          type: 'string',
          choices: ['user', 'system', 'context', 'task'],
          default: 'user'
        },
        {
          name: 'tags',
          description: 'Comma-separated tags',
          type: 'string'
        }
      ]
    },
    {
      name: 'query',
      description: 'Query memory bank',
      handler: queryMemory,
      options: [
        {
          name: 'search',
          short: 's',
          description: 'Search term or query',
          type: 'string',
          required: true
        },
        {
          name: 'limit',
          short: 'l',
          description: 'Maximum results',
          type: 'number',
          default: 10
        },
        {
          name: 'type',
          description: 'Filter by memory type',
          type: 'string',
          choices: ['user', 'system', 'context', 'task']
        }
      ]
    },
    {
      name: 'list',
      description: 'List memory entries',
      handler: listMemories,
      options: [
        {
          name: 'type',
          short: 't',
          description: 'Filter by type',
          type: 'string',
          choices: ['user', 'system', 'context', 'task']
        },
        {
          name: 'limit',
          short: 'l',
          description: 'Maximum entries to show',
          type: 'number',
          default: 20
        },
        {
          name: 'format',
          description: 'Output format',
          type: 'string',
          choices: ['table', 'json'],
          default: 'table'
        }
      ]
    },
    {
      name: 'stats',
      description: 'Show memory statistics',
      handler: showMemoryStats,
      options: [
        {
          name: 'detailed',
          short: 'd',
          description: 'Show detailed statistics',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'clear',
      description: 'Clear memories',
      handler: clearMemories,
      options: [
        {
          name: 'type',
          short: 't',
          description: 'Clear only specific type',
          type: 'string',
          choices: ['user', 'system', 'context', 'task']
        },
        {
          name: 'key',
          short: 'k',
          description: 'Clear specific memory by key',
          type: 'string'
        },
        {
          name: 'confirm',
          short: 'y',
          description: 'Skip confirmation prompt',
          type: 'boolean'
        }
      ]
    }
  ],
  handler: async (context: CLIContext) => {
    return await listMemories(context);
  }
};

async function storeMemory(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const memoryManager = await getMemoryManager();
    
    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
    
    const memoryEntry = {
      id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId: 'cli-user',
      sessionId: 'cli-session',
      type: (options.type || 'artifact') as 'observation' | 'insight' | 'decision' | 'artifact' | 'error',
      content: options.value,
      context: {
        key: options.key,
        source: 'cli',
        timestamp: Date.now()
      },
      timestamp: new Date(),
      tags,
      version: 1,
      metadata: {
        key: options.key,
        source: 'cli'
      }
    };

    await memoryManager.store(memoryEntry);

    printSuccess(`✅ Memory stored with ID: ${memoryEntry.id}`);
    printInfo(`Key: ${options.key}`);
    printInfo(`Type: ${memoryEntry.type}`);
    if (tags.length > 0) {
      printInfo(`Tags: ${tags.join(', ')}`);
    }
    
  } catch (error) {
    printError(`Failed to store memory: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function queryMemory(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const memoryManager = await getMemoryManager();
    
    const results = await memoryManager.query({
      search: options.search,
      type: options.type,
      limit: options.limit
    });
    
    if (results.length === 0) {
      printInfo('No memories found matching your query');
      return;
    }

    console.log(successBold(`\n🧠 Query Results (${results.length} found):\n`));
    
    results.forEach((memory, index) => {
      const contextKey = memory.context && typeof memory.context === 'object' && 'key' in memory.context 
        ? (memory.context as { key: string }).key 
        : memory.id;
      console.log(`${index + 1}. ${infoBold(contextKey)}`);
      console.log(`   Content: ${memory.content}`);
      console.log(`   Type: ${memory.type}`);
      console.log(`   Tags: ${memory.tags.join(', ') || 'None'}`);
      console.log(`   Created: ${memory.timestamp.toLocaleString()}`);
      console.log('');
    });
    
  } catch (error) {
    printError(`Failed to query memory: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function listMemories(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const memoryManager = await getMemoryManager();
    
    const results = await memoryManager.query({
      type: options.type,
      limit: options.limit || 20
    });

    if (results.length === 0) {
      printInfo('No memories found');
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    displayMemoriesTable(results, 'Memory Entries');
    printSuccess(`Found ${results.length} memories`);
    
  } catch (error) {
    printError(`Failed to list memories: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showMemoryStats(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const memoryManager = await getMemoryManager();
    
    const healthStatus = await memoryManager.getHealthStatus();
    
    console.log(successBold('\n🧠 Memory System Statistics:\n'));
    
    console.log(`Status: ${healthStatus.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    if (healthStatus.metrics) {
      console.log(`Total Entries: ${healthStatus.metrics.totalEntries || 0}`);
      console.log(`Cache Size: ${healthStatus.metrics.cacheSize || 0}`);
      console.log(`Cache Hit Rate: ${(healthStatus.metrics.cacheHitRate || 0).toFixed(2)}%`);
      console.log(`Active Banks: ${healthStatus.metrics.activeBanks || 0}`);
    }
    
    if (healthStatus.error) {
      console.log(`Error: ${healthStatus.error}`);
    }
    
    if (options.detailed && healthStatus.metrics) {
      console.log('\nDetailed Statistics:');
      Object.entries(healthStatus.metrics).forEach(([key, value]) => {
        if (!['totalEntries', 'cacheSize', 'cacheHitRate', 'activeBanks'].includes(key)) {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
      });
    }
    
  } catch (error) {
    printError(`Failed to get memory stats: ${error instanceof Error ? error.message : String(error)}`);
    
    // Provide fallback information
    console.log(warningBold('\n⚠️  Memory Statistics (Fallback)\n'));
    console.log('Status: ❌ Service not initialized');
    console.log('Total Entries: 0');
    console.log('Total Size: 0 bytes');
    console.log('Cache Hit Rate: 0%');
    console.log('Average Query Time: 0ms');
    console.log(`Last Updated: ${new Date().toISOString()}`);
    
    if (options.detailed) {
      console.log('\nService Details:');
      console.log('  Backend: Not initialized');
      console.log('  Error: Memory manager not available');
      console.log('  Suggestion: Run "flowx start" to initialize backend services');
    }
  }
}

async function clearMemories(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const memoryManager = await getMemoryManager();
    
    if (options.key) {
      const results = await memoryManager.query({
        search: options.key,
        limit: 1
      });
      
      if (results.length === 0) {
        printWarning(`No memory found with key: ${options.key}`);
        return;
      }
      
      await memoryManager.delete(results[0].id);
      printSuccess(`✅ Deleted memory: ${options.key}`);
      
    } else {
      const results = await memoryManager.query({
        type: options.type,
        limit: 1000
      });
      
      if (results.length === 0) {
        printInfo('No memories found to clear');
        return;
      }
      
      if (!options.confirm) {
        printWarning(`This will delete ${results.length} memories. Use --confirm to proceed.`);
        return;
      }
      
      for (const memory of results) {
        await memoryManager.delete(memory.id);
      }
      
      printSuccess(`✅ Cleared ${results.length} memories`);
    }
    
  } catch (error) {
    printError(`Failed to clear memories: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper functions

function displayMemoriesTable(memories: {
  id: string;
  context?: { key?: string };
  type: string;
  content: string;
  tags: string[];
  timestamp: Date;
}[], title: string): void {
  console.log(successBold(`\n🧠 ${title}:\n`));
  
  const tableData = memories.map(memory => ({
    ID: memory.id.substring(0, 12) + '...',
    Key: memory.context?.key || 'N/A',
    Type: memory.type,
    Content: memory.content.substring(0, 50) + (memory.content.length > 50 ? '...' : ''),
    Tags: memory.tags.join(', ') || 'None',
    Created: memory.timestamp.toLocaleDateString()
  }));
  
  console.table(tableData);
}

export default memoryCommand; 