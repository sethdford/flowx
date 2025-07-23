/**
 * MCP Tools CLI Command
 */

import { ParsedArgs } from '../../core/command-parser.js';
import { AdvancedToolRegistry, AdvancedTool } from '../../../mcp/tools/advanced-tool-registry.js';
import { AdvancedToolServer } from '../../../mcp/tools/advanced-tool-server.js';
import { printError, printInfo, printSuccess, printWarning } from '../../core/output-formatter.js';

const toolRegistry = new AdvancedToolRegistry();
const toolServer = new AdvancedToolServer();

/**
 * Main MCP Tools command handler
 */
export async function mcpToolsCommand(parsedArgs: ParsedArgs): Promise<void> {
  const { subcommand, args, options } = parsedArgs;

  try {
    switch (subcommand) {
      case 'list':
        await listTools(parsedArgs);
        break;
      case 'info':
        await showToolInfo(parsedArgs);
        break;
      case 'stats':
        await showToolStatistics(parsedArgs);
        break;
      case 'categories':
        await listCategories(parsedArgs);
        break;
      case 'search':
        await searchTools(parsedArgs);
        break;
      case 'server':
        await manageServer(parsedArgs);
        break;
      case 'test':
        await testTool(parsedArgs);
        break;
      case 'export':
        await exportTools(parsedArgs);
        break;
      default:
        await showHelp();
        break;
    }
  } catch (error) {
    printError(`MCP Tools error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Show help information
 */
async function showHelp(): Promise<void> {
  printInfo('🔧 MCP Tools Suite - 87 Advanced Tools for AI Orchestration');
  console.log('\nAvailable commands:');
  console.log('  list           List available tools');
  console.log('  info <tool>    Show detailed information about a tool');
  console.log('  stats          Show usage statistics');
  console.log('  categories     List tool categories');
  console.log('  search <term>  Search for tools');
  console.log('  server         Manage MCP server');
  console.log('  test <tool>    Test a specific tool');
  console.log('  export         Export tools configuration');
  console.log('\nOptions:');
  console.log('  --category     Filter by category');
  console.log('  --priority     Filter by priority (low, medium, high, critical)');
  console.log('  --enterprise   Show only enterprise tools');
  console.log('  --auth         Show only authenticated tools');
  console.log('  --format       Output format (table, json, yaml)');
  console.log('\nExamples:');
  console.log('  flowx mcp-tools list --category development');
  console.log('  flowx mcp-tools info github_repository_manager');
  console.log('  flowx mcp-tools search kubernetes');
  console.log('  flowx mcp-tools server start');
}

/**
 * List available tools
 */
async function listTools(parsedArgs: ParsedArgs): Promise<void> {
  const { options } = parsedArgs;
  const tools = await toolRegistry.listTools();
  
  // Apply filters
  let filteredTools = tools;
  
  if (options.category) {
    filteredTools = filteredTools.filter((tool: AdvancedTool) => tool.category === options.category);
  }
  
  if (options.priority) {
    filteredTools = filteredTools.filter((tool: AdvancedTool) => tool.priority === options.priority);
  }
  
  if (options.enterprise) {
    filteredTools = filteredTools.filter((tool: AdvancedTool) => tool.enterprise);
  }
  
  if (options.auth) {
    filteredTools = filteredTools.filter((tool: AdvancedTool) => tool.requiresAuth);
  }
  
  if (filteredTools.length === 0) {
    printWarning('No tools found matching the specified criteria');
    return;
  }
  
  // Display tools
  const format = options.format || 'table';
  
  if (format === 'json') {
    console.log(JSON.stringify(filteredTools, null, 2));
  } else if (format === 'yaml') {
    // Simple YAML output
    for (const tool of filteredTools) {
      console.log(`- name: ${tool.name}`);
      console.log(`  category: ${tool.category}`);
      console.log(`  priority: ${tool.priority}`);
      console.log(`  enterprise: ${tool.enterprise}`);
      console.log(`  description: ${tool.description || 'No description'}`);
      console.log('');
    }
  } else {
    // Table format
    printInfo(`🔧 Found ${filteredTools.length} MCP Tools`);
    console.log('');
    
    const maxNameWidth = Math.max(...filteredTools.map((t: AdvancedTool) => t.name.length), 20);
    const maxCategoryWidth = Math.max(...filteredTools.map((t: AdvancedTool) => t.category.length), 15);
    
    // Header
    console.log(`${'Name'.padEnd(maxNameWidth)} | ${'Category'.padEnd(maxCategoryWidth)} | Priority | Enterprise | Auth`);
    console.log('-'.repeat(maxNameWidth + maxCategoryWidth + 30));
    
    // Tools
    for (const tool of filteredTools) {
      const name = tool.name.padEnd(maxNameWidth);
      const category = tool.category.padEnd(maxCategoryWidth);
      const priority = tool.priority.padEnd(8);
      const enterprise = tool.enterprise ? '✓' : '✗';
      const auth = tool.requiresAuth ? '✓' : '✗';
      
      console.log(`${name} | ${category} | ${priority} | ${enterprise.padEnd(10)} | ${auth}`);
    }
  }
}

/**
 * Show detailed information about a tool
 */
async function showToolInfo(parsedArgs: ParsedArgs): Promise<void> {
  const { args } = parsedArgs;
  
  if (args.length === 0) {
    printError('Please specify a tool name');
    return;
  }
  
  const toolName = args[0];
  const tool = await toolRegistry.getTool(toolName);
  
  if (!tool) {
    printError(`Tool '${toolName}' not found`);
    return;
  }
  
  printInfo(`🔧 Tool Information: ${tool.name}`);
  console.log('');
  console.log(`Name: ${tool.name}`);
  console.log(`Category: ${tool.category}`);
  console.log(`Priority: ${tool.priority}`);
  console.log(`Enterprise: ${tool.enterprise ? 'Yes' : 'No'}`);
  console.log(`Authentication Required: ${tool.requiresAuth ? 'Yes' : 'No'}`);
  console.log(`Description: ${tool.description || 'No description available'}`);
  
  if (tool.parameters && Object.keys(tool.parameters).length > 0) {
    console.log('\nParameters:');
    for (const [name, param] of Object.entries(tool.parameters)) {
      const paramObj = param as any;
      console.log(`  ${name}: ${paramObj.type || 'unknown'} ${paramObj.required ? '(required)' : '(optional)'}`);
    }
  }
  
  if (tool.examples && tool.examples.length > 0) {
    console.log('\nExamples:');
    for (const example of tool.examples) {
      console.log(`  ${example}`);
    }
  }
}

/**
 * Show tool usage statistics
 */
async function showToolStatistics(parsedArgs: ParsedArgs): Promise<void> {
  const tools = await toolRegistry.listTools();
  const stats = await toolServer.getStatistics();
  
  printInfo('📊 MCP Tools Statistics');
  console.log('');
  console.log(`Total Tools: ${tools.length}`);
  console.log(`Enterprise Tools: ${tools.filter((t: AdvancedTool) => t.enterprise).length}`);
  console.log(`Tools Requiring Auth: ${tools.filter((t: AdvancedTool) => t.requiresAuth).length}`);
  console.log('');
  
  // Category breakdown
  const categoryStats = tools.reduce((acc: Record<string, number>, tool: AdvancedTool) => {
    acc[tool.category] = (acc[tool.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Tools by Category:');
  Object.entries(categoryStats)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
  
  // Priority breakdown
  const priorityStats = tools.reduce((acc: Record<string, number>, tool: AdvancedTool) => {
    acc[tool.priority] = (acc[tool.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\nTools by Priority:');
  Object.entries(priorityStats)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .forEach(([priority, count]) => {
      console.log(`  ${priority}: ${count}`);
    });
}

/**
 * List tool categories
 */
async function listCategories(parsedArgs: ParsedArgs): Promise<void> {
  const tools = await toolRegistry.listTools();
  
  const categoryStats = tools.reduce((acc: Record<string, number>, tool: AdvancedTool) => {
    acc[tool.category] = (acc[tool.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  printInfo('📂 Tool Categories');
  console.log('');
  
  Object.entries(categoryStats)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .forEach(([category, count]) => {
      const countStr = (count as number).toString().padEnd(5);
      console.log(`${countStr} ${category}`);
    });
  
  console.log('');
  console.log(`Total Categories: ${Object.keys(categoryStats).length}`);
  console.log(`Total Tools: ${tools.length}`);
}

/**
 * Search for tools
 */
async function searchTools(parsedArgs: ParsedArgs): Promise<void> {
  const { args } = parsedArgs;
  
  if (args.length === 0) {
    printError('Please provide a search term');
    return;
  }
  
  const searchTerm = args[0];
  const tools = await toolRegistry.listTools();
  
  const matchingTools = tools.filter((tool: AdvancedTool) => 
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tool.description && tool.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    tool.category.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (matchingTools.length === 0) {
    printWarning(`No tools found matching '${searchTerm}'`);
    return;
  }
  
  printInfo(`🔍 Found ${matchingTools.length} tools matching '${searchTerm}'`);
  console.log('');
  
  for (const tool of matchingTools) {
    console.log(`📦 ${tool.name} (${tool.category})`);
    console.log(`   Priority: ${tool.priority} | Enterprise: ${tool.enterprise ? 'Yes' : 'No'}`);
    if (tool.description) {
      console.log(`   ${tool.description}`);
    }
    console.log('');
  }
}

/**
 * Manage MCP server
 */
async function manageServer(parsedArgs: ParsedArgs): Promise<void> {
  const { args } = parsedArgs;
  
  if (args.length === 0) {
    printError('Please specify server action: start, stop, status, restart');
    return;
  }
  
  const action = args[0];
  
  switch (action) {
    case 'start':
      printInfo('🚀 Starting MCP Tools Server...');
      try {
        await toolServer.start();
        printSuccess('MCP Tools Server started successfully');
      } catch (error) {
        printError(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
      
    case 'stop':
      printInfo('🛑 Stopping MCP Tools Server...');
      try {
        await toolServer.stop();
        printSuccess('MCP Tools Server stopped successfully');
      } catch (error) {
        printError(`Failed to stop server: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
      
    case 'status':
      const isRunning = await toolServer.isServerRunning();
      if (isRunning) {
        printSuccess('✅ MCP Tools Server is running');
      } else {
        printWarning('❌ MCP Tools Server is not running');
      }
      break;
      
    case 'restart':
      printInfo('🔄 Restarting MCP Tools Server...');
      try {
        await toolServer.stop();
        await toolServer.start();
        printSuccess('MCP Tools Server restarted successfully');
      } catch (error) {
        printError(`Failed to restart server: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      break;
      
    default:
      printError(`Unknown server action: ${action}`);
      console.log('Available actions: start, stop, status, restart');
      break;
  }
}

/**
 * Test a specific tool
 */
async function testTool(parsedArgs: ParsedArgs): Promise<void> {
  const { args } = parsedArgs;
  
  if (args.length === 0) {
    printError('Please specify a tool name to test');
    return;
  }
  
  const toolName = args[0];
  const tool = await toolRegistry.getTool(toolName);
  
  if (!tool) {
    printError(`Tool '${toolName}' not found`);
    return;
  }
  
  printInfo(`🧪 Testing tool: ${tool.name}`);
  
  try {
    // For now, just validate the tool structure
    if (!tool.name || !tool.category || !tool.priority) {
      printError('Tool is missing required fields');
      return;
    }
    
    printSuccess(`✅ Tool '${tool.name}' passed basic validation`);
    
    if (tool.parameters) {
      console.log('📋 Tool accepts the following parameters:');
      for (const [name, param] of Object.entries(tool.parameters)) {
        const paramObj = param as any;
        console.log(`  • ${name} (${paramObj.type || 'unknown'})`);
      }
    }
    
  } catch (error) {
    printError(`Tool test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export tools configuration
 */
async function exportTools(parsedArgs: ParsedArgs): Promise<void> {
  const { options } = parsedArgs;
  const tools = await toolRegistry.listTools();
  
  const format = options.format || 'json';
  
  const exportData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    totalTools: tools.length,
    tools: tools.map((tool: AdvancedTool) => ({
      name: tool.name,
      category: tool.category,
      priority: tool.priority,
      enterprise: tool.enterprise,
      requiresAuth: tool.requiresAuth,
      description: tool.description,
      parameters: tool.parameters,
      examples: tool.examples
    }))
  };
  
  if (format === 'yaml') {
    // Simple YAML export
    console.log(`version: ${exportData.version}`);
    console.log(`timestamp: ${exportData.timestamp}`);
    console.log(`totalTools: ${exportData.totalTools}`);
    console.log('tools:');
    for (const tool of exportData.tools) {
      console.log(`  - name: ${tool.name}`);
      console.log(`    category: ${tool.category}`);
      console.log(`    priority: ${tool.priority}`);
      console.log(`    enterprise: ${tool.enterprise}`);
      console.log(`    requiresAuth: ${tool.requiresAuth}`);
      if (tool.description) {
        console.log(`    description: "${tool.description}"`);
      }
      console.log('');
    }
  } else {
    console.log(JSON.stringify(exportData, null, 2));
  }
  
  printSuccess(`✅ Exported ${tools.length} tools in ${format} format`);
}

/**
 * Generate sample parameters for a tool
 */
function generateSampleParameters(parameters: Record<string, any>): Record<string, any> {
  const sample: Record<string, any> = {};
  
  for (const [name, param] of Object.entries(parameters)) {
    const paramObj = param as any;
    if (paramObj.type === 'string') {
      sample[name] = `sample_${name}`;
    } else if (paramObj.type === 'number') {
      sample[name] = 42;
    } else if (paramObj.type === 'boolean') {
      sample[name] = true;
    } else if (paramObj.type === 'array') {
      sample[name] = ['item1', 'item2'];
    } else if (paramObj.type === 'object') {
      sample[name] = { key: 'value' };
    } else {
      sample[name] = 'sample_value';
    }
  }
  
  return sample;
} 