#!/usr/bin/env node

/**
 * FlowX Interactive REPL Command
 * Provides claude-flow compatible interactive shell functionality
 * Compatible with enterprise features and all FlowX capabilities
 */

import { Logger } from '../../../core/logger.js';
import { getAllCommands } from '../../core/command-registry.js';
import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

// Define CLIContext interface locally
interface CLIContext {
  command: string;
  args: string[];
  options: Record<string, any>;
  workingDirectory: string;
  environment: Record<string, string | undefined>;
  user: { id: string; name: string };
}

// Define CLICommand interface locally  
interface CLICommand {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  options?: Array<{
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean';
    short?: string;
    default?: any;
  }>;
  handler: (context: CLIContext) => Promise<void>;
}

interface REPLOptions {
  banner?: boolean;
  history?: string;
  autoComplete?: boolean;
  color?: boolean;
  prompt?: string;
  timeout?: number;
}

interface REPLSession {
  id: string;
  startTime: Date;
  commandHistory: string[];
  variables: Map<string, any>;
  context: Record<string, any>;
}

interface REPLVariable {
  name: string;
  value: any;
  type: string;
  scope: 'session' | 'global' | 'temporary';
  created: Date;
  modified: Date;
}

/**
 * Variable Manager for REPL session persistence
 */
class REPLVariableManager {
  private variables = new Map<string, REPLVariable>();
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.flowx', 'repl-variables.json');
    this.loadVariables();
  }

  async loadVariables(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const data = await fs.readFile(this.filePath, 'utf-8');
      const variableData = JSON.parse(data);
      
      for (const [key, value] of Object.entries(variableData)) {
        this.variables.set(key, {
          ...(value as REPLVariable),
          created: new Date((value as REPLVariable).created),
          modified: new Date((value as REPLVariable).modified)
        });
      }
    } catch (error) {
      // File doesn't exist or invalid JSON, start fresh
      this.variables.clear();
    }
  }

  async saveVariables(): Promise<void> {
    try {
      const variableData: Record<string, REPLVariable> = {};
      
      // Only save non-temporary variables
      for (const [key, variable] of this.variables.entries()) {
        if (variable.scope !== 'temporary') {
          variableData[key] = variable;
        }
      }
      
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(variableData, null, 2));
    } catch (error) {
      console.error('Failed to save REPL variables:', error);
    }
  }

  set(name: string, value: any, scope: 'session' | 'global' | 'temporary' = 'session'): void {
    const variable: REPLVariable = {
      name,
      value,
      type: typeof value === 'object' ? 'object' : typeof value,
      scope,
      created: this.variables.get(name)?.created || new Date(),
      modified: new Date()
    };
    
    this.variables.set(name, variable);
  }

  get(name: string): any {
    return this.variables.get(name)?.value;
  }

  has(name: string): boolean {
    return this.variables.has(name);
  }

  delete(name: string): boolean {
    return this.variables.delete(name);
  }

  clear(scope?: string): void {
    if (scope) {
      for (const [key, variable] of this.variables.entries()) {
        if (variable.scope === scope) {
          this.variables.delete(key);
        }
      }
    } else {
      this.variables.clear();
    }
  }

  list(scope?: string): REPLVariable[] {
    const result: REPLVariable[] = [];
    for (const variable of this.variables.values()) {
      if (!scope || variable.scope === scope) {
        result.push(variable);
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/**
 * REPL Session Manager
 */
class REPLSessionManager {
  private sessions = new Map<string, REPLSession>();
  private currentSession?: REPLSession;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.flowx', 'repl-sessions.json');
    this.loadSessions();
  }

  async loadSessions(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const sessionData = JSON.parse(data);
      
      for (const [id, session] of Object.entries(sessionData)) {
        this.sessions.set(id, {
          ...(session as REPLSession),
          startTime: new Date((session as REPLSession).startTime),
          variables: new Map(Object.entries((session as REPLSession).variables || {}))
        });
      }
    } catch (error) {
      // File doesn't exist, start fresh
      this.sessions.clear();
    }
  }

  async saveSessions(): Promise<void> {
    try {
      const sessionData: Record<string, any> = {};
      
      for (const [id, session] of this.sessions.entries()) {
        sessionData[id] = {
          ...session,
          variables: Object.fromEntries(session.variables)
        };
      }
      
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.error('Failed to save REPL sessions:', error);
    }
  }

  createSession(): REPLSession {
    const session: REPLSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      commandHistory: [],
      variables: new Map(),
      context: {}
    };
    
    this.sessions.set(session.id, session);
    this.currentSession = session;
    return session;
  }

  getCurrentSession(): REPLSession | undefined {
    return this.currentSession;
  }

  addToHistory(command: string): void {
    if (this.currentSession && command.trim()) {
      this.currentSession.commandHistory.push(command);
      // Keep last 1000 commands
      if (this.currentSession.commandHistory.length > 1000) {
        this.currentSession.commandHistory = this.currentSession.commandHistory.slice(-1000);
      }
    }
  }

  getHistory(): string[] {
    return this.currentSession?.commandHistory || [];
  }
}

/**
 * Main REPL Engine
 */
class FlowXREPL {
  private rl?: readline.Interface;
  private logger: any;
  private variableManager: REPLVariableManager;
  private sessionManager: REPLSessionManager;
  private options: REPLOptions;
  private running = false;
  private commands = new Map<string, Function>();

  constructor(options: REPLOptions = {}) {
    this.options = {
      banner: true,
      history: path.join(process.cwd(), '.flowx', 'repl-history'),
      autoComplete: true,
      color: true,
      prompt: 'flowx> ',
      timeout: 30000,
      ...options
    };
    
    this.variableManager = new REPLVariableManager();
    this.sessionManager = new REPLSessionManager();
    this.setupCommands();
  }

  private setupCommands(): void {
    // System commands
    this.commands.set('help', this.showHelp.bind(this));
    this.commands.set('status', this.showStatus.bind(this));
    this.commands.set('config', this.handleConfig.bind(this));
    this.commands.set('clear', this.clearScreen.bind(this));
    this.commands.set('history', this.showHistory.bind(this));
    this.commands.set('exit', this.exit.bind(this));
    this.commands.set('quit', this.exit.bind(this));
    this.commands.set('version', this.showVersion.bind(this));

    // Variable management
    this.commands.set('var', this.handleVariable.bind(this));
    this.commands.set('set', this.setVariable.bind(this));
    this.commands.set('get', this.getVariable.bind(this));
    this.commands.set('unset', this.unsetVariable.bind(this));
    this.commands.set('vars', this.listVariables.bind(this));
  }

  async start(): Promise<void> {
    try {
      // Try to get logger, but don't fail if it's not available
      try {
        this.logger = await Logger.getInstance();
      } catch (error) {
        // Fallback to console logging if logger initialization fails
        this.logger = {
          info: (msg: string, context?: any) => console.log(`INFO: ${msg}`, context || ''),
          error: (msg: string, context?: any) => console.error(`ERROR: ${msg}`, context || ''),
          warn: (msg: string, context?: any) => console.warn(`WARN: ${msg}`, context || ''),
          debug: (msg: string, context?: any) => console.debug(`DEBUG: ${msg}`, context || '')
        } as any;
      }
      
      // Create session
      const session = this.sessionManager.createSession();
      this.logger.info('Starting FlowX REPL session', { sessionId: session.id });

      // Show banner
      if (this.options.banner) {
        this.showBanner();
      }

      // Setup readline interface
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: this.options.prompt,
        historySize: 1000,
        removeHistoryDuplicates: true,
        completer: this.options.autoComplete ? this.completer.bind(this) : undefined
      });

      // Load command history
      await this.loadHistory();

      // Setup event handlers
      this.setupEventHandlers();

      // Start the REPL loop
      this.running = true;
      this.rl.prompt();

    } catch (error) {
      console.error('Failed to start FlowX REPL:', error);
      throw error;
    }
  }

  private showBanner(): void {
    console.log('\n🧠 FlowX Interactive REPL v2.0.0');
    console.log('━'.repeat(50));
    console.log('🚀 Enterprise AI Development Workflows');
    console.log('🔧 87+ MCP Tools | 🧬 Neural Networks | 🐝 Swarm Intelligence');
    console.log('');
    console.log('Type "help" for available commands, "exit" to quit');
    console.log('Use Tab for auto-completion, Up/Down for history');
    console.log('Shell commands: !command, Search history: /pattern');
    console.log('━'.repeat(50));
    console.log('');
  }

  private setupEventHandlers(): void {
    if (!this.rl) return;

    this.rl.on('line', async (input: string) => {
      const command = input.trim();
      
      if (!command) {
        this.rl!.prompt();
        return;
      }

      // Add to history
      this.sessionManager.addToHistory(command);
      
      try {
        await this.processCommand(command);
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      if (this.running) {
        this.rl!.prompt();
      }
    });

    this.rl.on('close', () => {
      this.exit();
    });

    // Handle Ctrl+C gracefully
    this.rl.on('SIGINT', () => {
      console.log('\n👋 Use "exit" to quit FlowX REPL');
      this.rl!.prompt();
    });
  }

  private async processCommand(input: string): Promise<void> {
    // Handle shell commands (!)
    if (input.startsWith('!')) {
      await this.executeShellCommand(input.slice(1));
      return;
    }

    // Handle history search (/)
    if (input.startsWith('/')) {
      this.searchHistory(input.slice(1));
      return;
    }

    // Handle variable substitution ($)
    const processedInput = this.substituteVariables(input);

    // Parse command and arguments
    const parts = processedInput.split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    // Execute command
    const command = this.commands.get(commandName);
    if (command) {
      await command(args);
    } else {
      // Try to execute as flowx command
      await this.executeFlowXCommand([commandName, ...args]);
    }
  }

  private substituteVariables(input: string): string {
    return input.replace(/\$(\w+)/g, (match, varName) => {
      const value = this.variableManager.get(varName);
      return value !== undefined ? String(value) : match;
    });
  }

  private completer(line: string): [string[], string] {
    const completions = Array.from(this.commands.keys()).concat([
      'agent', 'task', 'memory', 'swarm', 'neural', 'mcp', 'workflow',
      'infrastructure', 'monitor', 'terminal', 'config', 'status'
    ]);
    
    const hits = completions.filter((c) => c.startsWith(line));
    return [hits.length ? hits : completions, line];
  }

  private async loadHistory(): Promise<void> {
    if (!this.options.history || !this.rl) return;
    
    try {
      const history = await fs.readFile(this.options.history, 'utf-8');
      const lines = history.split('\n').filter(line => line.trim());
      
      // Add to readline history
      for (const line of lines.slice(-1000)) { // Keep last 1000
        (this.rl as any).history.unshift(line);
      }
    } catch (error) {
      // History file doesn't exist, that's fine
    }
  }

  private async saveHistory(): Promise<void> {
    if (!this.options.history || !this.rl) return;
    
    try {
      await fs.mkdir(path.dirname(this.options.history), { recursive: true });
      const history = (this.rl as any).history.slice().reverse().join('\n');
      await fs.writeFile(this.options.history, history);
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
  }

  // Command implementations

  private async showHelp(args: string[]): Promise<void> {
    if (args.length > 0) {
      this.showCommandHelp(args[0]);
      return;
    }

    console.log(`
🧠 FlowX REPL Commands

🏛️  System Commands:
  help [command]           Show help for command or all commands
  status                   Show system status
  config [key] [value]     Show/set configuration (basic)
  clear                    Clear the screen
  history                  Show command history
  version                  Show FlowX version
  exit, quit               Exit REPL

🔧 Variables:
  set <name> <value>       Set variable
  get <name>               Get variable value
  unset <name>             Delete variable
  vars [scope]             List variables (session, global, temporary)

💡 Special Features:
  !<command>              Execute shell command
  /<pattern>              Search command history
  $<variable>             Variable substitution
  Tab                     Auto-completion
  Up/Down                 Command history navigation

📚 Examples:
  set project "my-app"
  get project
  !ls -la
  /set project
  
Note: Enhanced FlowX integration available when running in full mode.
`);
  }

  private showCommandHelp(command: string): void {
    const helpTexts: Record<string, string> = {
      set: 'set <name> <value> [scope] - Set a variable with optional scope (session, global, temporary)',
      get: 'get <name> - Get the value of a variable',
      unset: 'unset <name> - Delete a variable',
      vars: 'vars [scope] - List all variables, optionally filtered by scope',
      status: 'status - Show basic system status',
      config: 'config [key] [value] - Show or set configuration (limited in REPL mode)',
      history: 'history - Show recent command history',
      clear: 'clear - Clear the screen and optionally show banner'
    };

    console.log(helpTexts[command] || `No help available for command: ${command}`);
  }

  private async showStatus(): Promise<void> {
    console.log('\n🟢 FlowX REPL Status:');
    console.log('━'.repeat(40));
    
    // Show session info
    const session = this.sessionManager.getCurrentSession();
    if (session) {
      console.log(`  📝 Session: ${session.id}`);
      console.log(`  ⏱️  Uptime: ${Math.floor((Date.now() - session.startTime.getTime()) / 1000)}s`);
      console.log(`  📜 Commands: ${session.commandHistory.length}`);
    }
    
    // Show variable info
    const variables = this.variableManager.list();
    console.log(`  🔧 Variables: ${variables.length}`);
    
    console.log(`  💻 Working Directory: ${process.cwd()}`);
    console.log(`  🧠 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  }

  private async handleConfig(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('⚠️  Basic configuration access only in REPL mode');
      console.log('Working Directory:', process.cwd());
      console.log('Node Version:', process.version);
      console.log('Platform:', process.platform);
    } else {
      console.log(`⚠️  Configuration setting not available in REPL mode: ${args[0]}`);
      console.log('Use full FlowX commands for configuration management');
    }
  }

  private clearScreen(): void {
    console.clear();
    if (this.options.banner) {
      this.showBanner();
    }
  }

  private showHistory(): void {
    const history = this.sessionManager.getHistory();
    console.log('\n📜 Command History:');
    console.log('━'.repeat(30));
    
    history.slice(-20).forEach((cmd, index) => {
      console.log(`  ${String(history.length - 20 + index + 1).padStart(3)}: ${cmd}`);
    });
    
    if (history.length > 20) {
      console.log(`  ... (${history.length - 20} more commands)`);
    }
  }

  private showVersion(): void {
    console.log('FlowX REPL v2.0.0');
    console.log('Enterprise AI Development Workflows');
  }

  private setVariable(args: string[]): void {
    if (args.length < 2) {
      console.log('Usage: set <name> <value> [scope]');
      return;
    }
    
    const [name, value, scope = 'session'] = args;
    let parsedValue: any = value;
    
    // Try to parse as JSON for complex values
    if (value.startsWith('{') || value.startsWith('[') || value === 'true' || value === 'false' || !isNaN(Number(value))) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string
      }
    }
    
    this.variableManager.set(name, parsedValue, scope as any);
    console.log(`✅ Set ${name} = ${JSON.stringify(parsedValue)} (${scope})`);
  }

  private getVariable(args: string[]): void {
    if (args.length === 0) {
      console.log('Usage: get <name>');
      return;
    }
    
    const value = this.variableManager.get(args[0]);
    if (value !== undefined) {
      console.log(`${args[0]}: ${JSON.stringify(value, null, 2)}`);
    } else {
      console.log(`❌ Variable not found: ${args[0]}`);
    }
  }

  private unsetVariable(args: string[]): void {
    if (args.length === 0) {
      console.log('Usage: unset <name>');
      return;
    }
    
    if (this.variableManager.delete(args[0])) {
      console.log(`✅ Deleted variable: ${args[0]}`);
    } else {
      console.log(`❌ Variable not found: ${args[0]}`);
    }
  }

  private listVariables(args: string[]): void {
    const scope = args[0];
    const variables = this.variableManager.list(scope);
    
    if (variables.length === 0) {
      console.log(`No variables found${scope ? ` in scope: ${scope}` : ''}`);
      return;
    }
    
    console.log(`\n📝 Variables${scope ? ` (${scope})` : ''}:`);
    console.log('━'.repeat(50));
    
    variables.forEach(variable => {
      const preview = JSON.stringify(variable.value).slice(0, 50);
      console.log(`  ${variable.name} (${variable.type}, ${variable.scope}): ${preview}${preview.length < JSON.stringify(variable.value).length ? '...' : ''}`);
    });
  }

  private handleVariable(args: string[]): void {
    if (args.length === 0) {
      this.listVariables([]);
      return;
    }
    
    const [subcommand, ...subArgs] = args;
    
    switch (subcommand) {
      case 'set':
        this.setVariable(subArgs);
        break;
      case 'get':
        this.getVariable(subArgs);
        break;
      case 'delete':
      case 'unset':
        this.unsetVariable(subArgs);
        break;
      case 'list':
        this.listVariables(subArgs);
        break;
      case 'clear':
        this.variableManager.clear(subArgs[0]);
        console.log(`✅ Cleared variables${subArgs[0] ? ` in scope: ${subArgs[0]}` : ''}`);
        break;
      default:
        console.log('Variable commands: set, get, unset, list, clear');
    }
  }

  private async executeShellCommand(command: string): Promise<void> {
    console.log(`> ${command}`);
    
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        if (code !== 0) {
          console.log(`Process exited with code ${code}`);
        }
        resolve();
      });
      
      child.on('error', (error) => {
        console.error(`Shell command error: ${error.message}`);
        resolve();
      });
    });
  }

  private searchHistory(pattern: string): void {
    const history = this.sessionManager.getHistory();
    const matches = history.filter(cmd => cmd.includes(pattern));
    
    if (matches.length === 0) {
      console.log(`No commands found matching: ${pattern}`);
      return;
    }
    
    console.log(`\n🔍 Commands matching "${pattern}":`);
    console.log('━'.repeat(40));
    
    matches.slice(-10).forEach((cmd, index) => {
      console.log(`  ${String(index + 1).padStart(2)}: ${cmd}`);
    });
    
    if (matches.length > 10) {
      console.log(`  ... (${matches.length - 10} more matches)`);
    }
  }

  private async executeFlowXCommand(args: string[]): Promise<void> {
    try {
      console.log(`⚠️  FlowX command integration not available in basic REPL mode: ${args.join(' ')}`);
      console.log(`💡 Use full FlowX CLI for complete functionality: ./cli.js ${args.join(' ')}`);
    } catch (error) {
      console.log(`❌ Command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async exit(): Promise<void> {
    console.log('\n👋 Saving session and exiting FlowX REPL...');
    
    // Save state
    await this.variableManager.saveVariables();
    await this.sessionManager.saveSessions();
    await this.saveHistory();
    
    // Cleanup
    if (this.rl) {
      this.rl.close();
    }
    
    this.running = false;
    console.log('✅ Session saved. Goodbye!');
    process.exit(0);
  }
}

/**
 * REPL Command Definition
 */
export const replCommand: CLICommand = {
  name: 'repl',
  description: 'Start interactive REPL (Read-Eval-Print Loop) shell',
  usage: 'flowx repl [options]',
  examples: [
    'flowx repl',
    'flowx repl --no-banner',
    'flowx repl --history /path/to/history',
    'flowx repl --prompt "flowx-dev> "'
  ],
  options: [
    {
      name: 'no-banner',
      description: 'Skip welcome banner',
      type: 'boolean'
    },
    {
      name: 'history',
      description: 'Custom history file path',
      type: 'string'
    },
    {
      name: 'no-auto-complete',
      description: 'Disable command auto-completion',
      type: 'boolean'
    },
    {
      name: 'no-color',
      description: 'Disable colored output',
      type: 'boolean'
    },
    {
      name: 'prompt',
      description: 'Custom prompt string',
      type: 'string',
      default: 'flowx> '
    },
    {
      name: 'timeout',
      description: 'Command timeout in milliseconds',
      type: 'number',
      default: 30000
    }
  ],
  handler: async (context: CLIContext) => {
    const { options } = context;
    
    try {
      const replOptions: REPLOptions = {
        banner: !options['no-banner'],
        history: options.history,
        autoComplete: !options['no-auto-complete'],
        color: !options['no-color'],
        prompt: options.prompt || 'flowx> ',
        timeout: options.timeout || 30000
      };
      
      const repl = new FlowXREPL(replOptions);
      await repl.start();
      
    } catch (error) {
      console.error(`❌ REPL failed to start: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}; 