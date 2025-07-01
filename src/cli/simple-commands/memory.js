// memory.js - Memory management commands
import { printSuccess, printError, printWarning } from "../utils.ts";
import { promises as fs } from 'node:fs';

export async function memoryCommand(subArgs, flags) {
  const memorySubcommand = subArgs[0];
  const memoryStore = './memory/memory-store.json';
  
  // Helper to load memory data
  async function loadMemory() {
    try {
      const content = await fs.readFile(memoryStore, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
  
  // Helper to save memory data
  async function saveMemory(data) {
    await fs.mkdir('./memory', { recursive: true });
    await fs.writeFile(memoryStore, JSON.stringify(data, null, 2));
  }
  
  switch (memorySubcommand) {
    case 'store':
      await storeMemory(subArgs, loadMemory, saveMemory);
      break;
      
    case 'query':
      await queryMemory(subArgs, loadMemory);
      break;
      
    case 'stats':
      await showMemoryStats(loadMemory);
      break;
      
    case 'export':
      await exportMemory(subArgs, loadMemory);
      break;
      
    case 'import':
      await importMemory(subArgs, saveMemory);
      break;
      
    case 'clear':
      await clearMemory(subArgs, saveMemory);
      break;
      
    case 'list':
      await listNamespaces(loadMemory);
      break;
      
    default:
      showMemoryHelp();
  }
}

async function storeMemory(subArgs, loadMemory, saveMemory) {
  const key = subArgs[1];
  const value = subArgs.slice(2).join(' ');
  
  if (!key || !value) {
    printError('Usage: memory store <key> <value>');
    return;
  }
  
  try {
    const data = await loadMemory();
    const namespace = getNamespaceFromArgs(subArgs) || 'default';
    
    if (!data[namespace]) {
      data[namespace] = [];
    }
    
    // Remove existing entry with same key
    data[namespace] = data[namespace].filter(e => e.key !== key);
    
    // Add new entry
    data[namespace].push({
      key,
      value,
      namespace,
      timestamp: Date.now()
    });
    
    await saveMemory(data);
    printSuccess('Stored successfully');
    console.log(`📝 Key: ${key}`);
    console.log(`📦 Namespace: ${namespace}`);
    console.log(`💾 Size: ${Buffer.from(value).length} bytes`);
  } catch (err) {
    printError(`Failed to store: ${err.message}`);
  }
}

async function queryMemory(subArgs, loadMemory) {
  const search = subArgs.slice(1).join(' ');
  
  if (!search) {
    printError('Usage: memory query <search>');
    return;
  }
  
  try {
    const data = await loadMemory();
    const namespace = getNamespaceFromArgs(subArgs);
    const results = [];
    
    for (const [ns, entries] of Object.entries(data)) {
      if (namespace && ns !== namespace) continue;
      
      for (const entry of entries) {
        if (entry.key.includes(search) || entry.value.includes(search)) {
          results.push(entry);
        }
      }
    }
    
    if (results.length === 0) {
      printWarning('No results found');
      return;
    }
    
    printSuccess(`Found ${results.length} results:`);
    
    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    for (const entry of results.slice(0, 10)) {
      console.log(`\n📌 ${entry.key}`);
      console.log(`   Namespace: ${entry.namespace}`);
      console.log(`   Value: ${entry.value.substring(0, 100)}${entry.value.length > 100 ? '...' : ''}`);
      console.log(`   Stored: ${new Date(entry.timestamp).toLocaleString()}`);
    }
    
    if (results.length > 10) {
      console.log(`\n... and ${results.length - 10} more results`);
    }
  } catch (err) {
    printError(`Failed to query: ${err.message}`);
  }
}

async function showMemoryStats(loadMemory) {
  try {
    const data = await loadMemory();
    let totalEntries = 0;
    const namespaceStats = {};
    
    for (const [namespace, entries] of Object.entries(data)) {
      namespaceStats[namespace] = entries.length;
      totalEntries += entries.length;
    }
    
    printSuccess('Memory Bank Statistics:');
    console.log(`   Total Entries: ${totalEntries}`);
    console.log(`   Namespaces: ${Object.keys(data).length}`);
    console.log(`   Size: ${(Buffer.from(JSON.stringify(data)).length / 1024).toFixed(2)} KB`);
    
    if (Object.keys(data).length > 0) {
      console.log('\n📁 Namespace Breakdown:');
      for (const [namespace, count] of Object.entries(namespaceStats)) {
        console.log(`   ${namespace}: ${count} entries`);
      }
    }
  } catch (err) {
    printError(`Failed to get stats: ${err.message}`);
  }
}

async function exportMemory(subArgs, loadMemory) {
  const filename = subArgs[1] || `memory-export-${Date.now()}.json`;
  
  try {
    const data = await loadMemory();
    const namespace = getNamespaceFromArgs(subArgs);
    
    let exportData = data;
    if (namespace) {
      exportData = { [namespace]: data[namespace] || [] };
    }
    
    await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
    printSuccess(`Memory exported to ${filename}`);
    
    let totalEntries = 0;
    for (const entries of Object.values(exportData)) {
      totalEntries += entries.length;
    }
    console.log(`📦 Exported ${totalEntries} entries from ${Object.keys(exportData).length} namespace(s)`);
  } catch (err) {
    printError(`Failed to export memory: ${err.message}`);
  }
}

async function importMemory(subArgs, saveMemory) {
  const filename = subArgs[1];
  
  if (!filename) {
    printError('Usage: memory import <filename>');
    return;
  }
  
  try {
    const importContent = await fs.readFile(filename, 'utf8');
    const importData = JSON.parse(importContent);
    
    // Load existing memory
    const existingData = await loadMemory();
    
    // Merge imported data
    let totalImported = 0;
    for (const [namespace, entries] of Object.entries(importData)) {
      if (!existingData[namespace]) {
        existingData[namespace] = [];
      }
      
      // Add entries that don't already exist (by key)
      const existingKeys = new Set(existingData[namespace].map(e => e.key));
      const newEntries = entries.filter(e => !existingKeys.has(e.key));
      
      existingData[namespace].push(...newEntries);
      totalImported += newEntries.length;
    }
    
    await saveMemory(existingData);
    printSuccess(`Imported ${totalImported} new entries from ${filename}`);
  } catch (err) {
    printError(`Failed to import memory: ${err.message}`);
  }
}

async function clearMemory(subArgs, saveMemory) {
  const namespace = getNamespaceFromArgs(subArgs);
  
  if (!namespace) {
    printError('Usage: memory clear --namespace <namespace>');
    printWarning('Use --namespace to specify which namespace to clear');
    return;
  }
  
  try {
    const data = await loadMemory();
    
    if (!data[namespace]) {
      printWarning(`Namespace '${namespace}' doesn't exist`);
      return;
    }
    
    const count = data[namespace].length;
    delete data[namespace];
    
    await saveMemory(data);
    printSuccess(`Cleared ${count} entries from namespace '${namespace}'`);
  } catch (err) {
    printError(`Failed to clear memory: ${err.message}`);
  }
}

async function listNamespaces(loadMemory) {
  try {
    const data = await loadMemory();
    const namespaces = Object.keys(data);
    
    if (namespaces.length === 0) {
      printWarning('No namespaces found');
      return;
    }
    
    printSuccess('Available namespaces:');
    for (const namespace of namespaces) {
      console.log(`   📁 ${namespace} (${data[namespace].length} entries)`);
    }
  } catch (err) {
    printError(`Failed to list namespaces: ${err.message}`);
  }
}

function getNamespaceFromArgs(subArgs) {
  const nsIndex = subArgs.indexOf('--namespace');
  if (nsIndex !== -1 && nsIndex + 1 < subArgs.length) {
    return subArgs[nsIndex + 1];
  }
  return null;
}

// Helper to load memory data (needed for import function)
async function loadMemory() {
  try {
    const content = await fs.readFile('./memory/memory-store.json', 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function showMemoryHelp() {
  console.log(`
🧠 Memory Management Commands

USAGE:
  claude-flow memory <command> [options]

COMMANDS:
  store <key> <value>     Store a key-value pair
  query <search>          Search for entries
  stats                   Show memory statistics
  export [filename]       Export memory to file
  import <filename>       Import memory from file
  clear                   Clear namespace entries
  list                    List all namespaces

OPTIONS:
  --namespace <name>      Specify namespace (default: "default")

EXAMPLES:
  claude-flow memory store "api_key" "sk-..." --namespace config
  claude-flow memory query "authentication" --namespace docs
  claude-flow memory stats
  claude-flow memory export backup.json --namespace project
  claude-flow memory clear --namespace temp
`);
}