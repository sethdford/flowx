/**
 * Simple ProcessUI implementation for the start command
 */

import { ProcessManager } from "./process-manager.js";
import { ILogger } from "../../../core/logger.js";
import { logger } from "../../../core/logger.js";
import * as readline from 'readline';
import type { CLICommand, CLIContext } from '../../interfaces/index.js';

export class ProcessUI {
  private processManager: ProcessManager;
  private logger: ILogger;
  private running = false;

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
    this.logger = logger;
  }

  async start(): Promise<void> {
    this.running = true;
    
    console.log('🖥️  Process Management UI');
    console.log('─'.repeat(40));
    console.log('Commands:');
    console.log('  status - Show process status');
    console.log('  start <process> - Start a process');
    console.log('  stop <process> - Stop a process');
    console.log('  restart <process> - Restart a process');
    console.log('  list - List all processes');
    console.log('  quit - Exit UI');
    console.log('─'.repeat(40));

    // Simple command loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'flowx> '
    });

    rl.prompt();

    rl.on('line', async (line: string) => {
      const command = line.trim();
      
      if (command === 'quit' || command === 'exit') {
        this.running = false;
        rl.close();
        return;
      }

      await this.handleCommand(command);
      
      if (this.running) {
        rl.prompt();
      }
    });

    rl.on('close', () => {
      this.running = false;
      console.log('UI closed');
    });

    // Keep running until closed
    while (this.running) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async handleCommand(command: string): Promise<void> {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case 'status':
          await this.showStatus();
          break;
        
        case 'start':
          if (args.length === 0) {
            console.log('Usage: start <process-name>');
          } else {
            await this.startProcess(args[0]);
          }
          break;
        
        case 'stop':
          if (args.length === 0) {
            console.log('Usage: stop <process-name>');
          } else {
            await this.stopProcess(args[0]);
          }
          break;
        
        case 'restart':
          if (args.length === 0) {
            console.log('Usage: restart <process-name>');
          } else {
            await this.restartProcess(args[0]);
          }
          break;
        
        case 'list':
          await this.listProcesses();
          break;
        
        case 'help':
          this.showHelp();
          break;
        
        default:
          console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
      }
    } catch (error) {
      console.error(`Error executing command: ${error}`);
    }
  }

  private async showStatus(): Promise<void> {
    console.log('\n📊 System Status:');
    const processes = this.processManager.getAllProcesses();
    
    if (processes.length === 0) {
      console.log('No processes configured');
      return;
    }

    for (const process of processes) {
      const status = process.status || 'unknown';
      const statusColor = this.getStatusColor(status);
      console.log(`  ${process.id}: ${statusColor}${status}\x1b[0m`);
    }
    console.log();
  }

  private async startProcess(processName: string): Promise<void> {
    console.log(`Starting process: ${processName}`);
    await this.processManager.startProcess(processName);
    console.log(`✓ Process ${processName} started`);
  }

  private async stopProcess(processName: string): Promise<void> {
    console.log(`Stopping process: ${processName}`);
    await this.processManager.stopProcess(processName);
    console.log(`✓ Process ${processName} stopped`);
  }

  private async restartProcess(processName: string): Promise<void> {
    console.log(`Restarting process: ${processName}`);
    await this.processManager.restartProcess(processName);
    console.log(`✓ Process ${processName} restarted`);
  }

  private async listProcesses(): Promise<void> {
    console.log('\n📋 All Processes:');
    const processes = this.processManager.getAllProcesses();
    
    if (processes.length === 0) {
      console.log('No processes configured');
      return;
    }

    for (const process of processes) {
      console.log(`  - ${process.id} (${process.status || 'unknown'})`);
    }
    console.log();
  }

  private showHelp(): void {
    console.log('\n📖 Available Commands:');
    console.log('  status - Show process status');
    console.log('  start <process> - Start a process');
    console.log('  stop <process> - Stop a process');
    console.log('  restart <process> - Restart a process');
    console.log('  list - List all processes');
    console.log('  help - Show this help');
    console.log('  quit - Exit UI');
    console.log();
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'running': return '\x1b[32m'; // green
      case 'stopped': return '\x1b[31m'; // red
      case 'starting': return '\x1b[33m'; // yellow
      case 'stopping': return '\x1b[33m'; // yellow
      case 'error': return '\x1b[31m'; // red
      default: return '\x1b[37m'; // white
    }
  }
} 