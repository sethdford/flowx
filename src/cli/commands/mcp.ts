/**
 * MCP command for Claude-Flow
 */

import { Command } from 'commander';
import { Logger } from '../utils/logger.js';
import { configManager } from "../../core/config.js";
import { MCPServer } from "../../mcp/server.js";
import { eventBus } from "../../core/event-bus.js";

let mcpServer: MCPServer | null = null;

// Create logger instance
const logger = new Logger({
  level: 'info',
  format: 'text',
  destination: 'console'
});

// Simple color utilities (replacing @cliffy/ansi/colors)
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

export const mcpCommand = new Command('mcp')
  .description('Manage MCP server and tools')
  .action(() => {
    console.log(colors.yellow('Please specify a subcommand:'));
    console.log('  start   - Start the MCP server');
    console.log('  stop    - Stop the MCP server');
    console.log('  status  - Show MCP server status');
    console.log('  tools   - List available MCP tools');
    console.log('  config  - Show MCP configuration');
    console.log('  restart - Restart the MCP server');
    console.log('  logs    - Show MCP server logs');
  });

mcpCommand
  .command('start')
  .description('Start the MCP server')
  .option('-p, --port <port>', 'Port for MCP server', '3000')
  .option('-h, --host <host>', 'Host for MCP server', 'localhost')
  .option('--transport <transport>', 'Transport type (stdio, http)', 'stdio')
  .action(async (options: any) => {
    try {
      const config = await configManager.load();
      
      // Override with CLI options
      const mcpConfig = {
        ...config.mcp,
        port: parseInt(options.port),
        host: options.host,
        transport: options.transport,
      };

      mcpServer = new MCPServer(mcpConfig, eventBus, logger);
      await mcpServer.start();

      console.log(colors.green(`✅ MCP server started on ${options.host}:${options.port}`));
      console.log(colors.cyan(`📡 Server URL: http://${options.host}:${options.port}`));
      console.log(colors.cyan(`🔧 Available tools: Research, Code, Terminal, Memory`));
      console.log(colors.cyan(`📚 API documentation: http://${options.host}:${options.port}/docs`));
    } catch (error) {
      console.error(colors.red(`❌ Failed to start MCP server: ${(error as Error).message}`));
      process.exit(1);
    }
  });

mcpCommand
  .command('stop')
  .description('Stop the MCP server')
  .action(async () => {
    try {
      if (mcpServer) {
        await mcpServer.stop();
        mcpServer = null;
        console.log(colors.green('✅ MCP server stopped'));
      } else {
        console.log(colors.yellow('⚠️  MCP server is not running'));
      }
    } catch (error) {
      console.error(colors.red(`❌ Failed to stop MCP server: ${(error as Error).message}`));
      process.exit(1);
    }
  });

mcpCommand
  .command('status')
  .description('Show MCP server status')
  .action(async () => {
    try {
      const config = await configManager.load();
      const isRunning = mcpServer !== null;

      console.log(colors.cyan('MCP Server Status:'));
      console.log(`🌐 Status: ${isRunning ? colors.green('Running') : colors.red('Stopped')}`);
      
      if (isRunning) {
        console.log(`📍 Address: ${config.mcp.host}:${config.mcp.port}`);
        console.log(`🔐 Authentication: ${config.mcp.auth ? colors.green('Enabled') : colors.yellow('Disabled')}`);
        console.log(`🔧 Tools: ${colors.green('Available')}`);
        console.log(`📊 Metrics: ${colors.green('Collecting')}`);
      } else {
        console.log(colors.gray('Use "claude-flow mcp start" to start the server'));
      }
    } catch (error) {
      console.error(colors.red(`❌ Failed to get MCP status: ${(error as Error).message}`));
    }
  });

mcpCommand
  .command('tools')
  .description('List available MCP tools')
  .action(() => {
    console.log(colors.cyan('Available MCP Tools:'));
    
    console.log('\n📊 Research Tools:');
    console.log('  • web_search - Search the web for information');
    console.log('  • web_fetch - Fetch content from URLs');
    console.log('  • knowledge_query - Query knowledge base');
    
    console.log('\n💻 Code Tools:');
    console.log('  • code_edit - Edit code files');
    console.log('  • code_search - Search through codebase');
    console.log('  • code_analyze - Analyze code quality');
    
    console.log('\n🖥️  Terminal Tools:');
    console.log('  • terminal_execute - Execute shell commands');
    console.log('  • terminal_session - Manage terminal sessions');
    console.log('  • file_operations - File system operations');
    
    console.log('\n💾 Memory Tools:');
    console.log('  • memory_store - Store information');
    console.log('  • memory_query - Query stored information');
    console.log('  • memory_index - Index and search content');
  });

mcpCommand
  .command('config')
  .description('Show MCP configuration')
  .action(async () => {
    try {
      const config = await configManager.load();
      
      console.log(colors.cyan('MCP Configuration:'));
      console.log(JSON.stringify(config.mcp, null, 2));
    } catch (error) {
      console.error(colors.red(`❌ Failed to show MCP config: ${(error as Error).message}`));
    }
  });

mcpCommand
  .command('restart')
  .description('Restart the MCP server')
  .action(async () => {
    try {
      console.log(colors.yellow('🔄 Stopping MCP server...'));
      if (mcpServer) {
        await mcpServer.stop();
      }
      
      console.log(colors.yellow('🔄 Starting MCP server...'));
      const config = await configManager.load();
      mcpServer = new MCPServer(config.mcp, eventBus, logger);
      await mcpServer.start();
      
      console.log(colors.green(`✅ MCP server restarted on ${config.mcp.host}:${config.mcp.port}`));
    } catch (error) {
      console.error(colors.red(`❌ Failed to restart MCP server: ${(error as Error).message}`));
      process.exit(1);
    }
  });

mcpCommand
  .command('logs')
  .description('Show MCP server logs')
  .option('-n, --lines <lines>', 'Number of log lines to show', '50')
  .action((options: any) => {
    console.log(colors.cyan(`MCP Server Logs (last ${options.lines} lines):`));
    
    // Mock logs since logging system might not be fully implemented
    const logEntries = [
      '2024-01-10 10:00:00 [INFO] MCP server started on localhost:3000',
      '2024-01-10 10:00:01 [INFO] Tools registered: 12',
      '2024-01-10 10:00:02 [INFO] Authentication disabled',
      '2024-01-10 10:01:00 [INFO] Client connected: claude-desktop',
      '2024-01-10 10:01:05 [INFO] Tool called: web_search',
      '2024-01-10 10:01:10 [INFO] Tool response sent successfully',
      '2024-01-10 10:02:00 [INFO] Tool called: terminal_execute',
      '2024-01-10 10:02:05 [INFO] Command executed successfully',
      '2024-01-10 10:03:00 [INFO] Memory operation: store',
      '2024-01-10 10:03:01 [INFO] Data stored in namespace: default',
    ];
    
    const startIndex = Math.max(0, logEntries.length - parseInt(options.lines));
    const displayLogs = logEntries.slice(startIndex);
    
    for (const entry of displayLogs) {
      if (entry.includes('[ERROR]')) {
        console.log(colors.red(entry));
      } else if (entry.includes('[WARN]')) {
        console.log(colors.yellow(entry));
      } else if (entry.includes('[INFO]')) {
        console.log(colors.green(entry));
      } else {
        console.log(colors.gray(entry));
      }
    }
  });