#!/usr/bin/env node

/**
 * Simple CLI Entry Point for FlowX
 * Used primarily for tests and local development
 */

import { initCommand } from './commands/system/initialization-command.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Simple CLI application for tests
class SimpleCLI {
  private commands: Map<string, any>;
  
  constructor() {
    this.commands = new Map();
    // Register the initialization command
    this.registerCommand(initCommand);
  }
  
  registerCommand(command: any) {
    this.commands.set(command.name, command);
  }
  
  async run(args: string[] = process.argv.slice(2)) {
    try {
      if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        this.showHelp();
        return 0;
      }
      
      const commandName = args[0];
      const command = this.commands.get(commandName);
      
      if (!command) {
        console.error(`Unknown command: ${commandName}`);
        this.showHelp();
        return 1;
      }
      
      // Parse options and arguments
      const options: Record<string, any> = {};
      const commandArgs: string[] = [];
      
      // Simple option parsing
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
          const optName = arg.slice(2);
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            options[optName] = args[i + 1];
            i++;
          } else {
            options[optName] = true;
          }
        } else if (arg.startsWith('-')) {
          const optName = arg.slice(1);
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            options[optName] = args[i + 1];
            i++;
          } else {
            options[optName] = true;
          }
        } else {
          commandArgs.push(arg);
        }
      }
      
      // Execute command
      const context = {
        args: commandArgs,
        options
      };
      
      await command.handler(context);
      return 0;
    } catch (error) {
      console.error('Error executing command:', error);
      return 1;
    }
  }
  
  showHelp() {
    console.log('Usage: simple-cli [command] [options]');
    console.log('\nAvailable commands:');
    
    for (const [name, command] of this.commands.entries()) {
      console.log(`  ${name} - ${command.description}`);
    }
    
    console.log('\nUse --help with any command for more information.');
  }
}

// For safe exit in tests
function safeExit(code: number) {
  if (process.env.NODE_ENV !== 'test') {
    process.exit(code);
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new SimpleCLI();
  cli.run().then(safeExit).catch(error => {
    console.error('Unexpected error:', error);
    safeExit(1);
  });
}

export { SimpleCLI };