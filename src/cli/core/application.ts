/**
 * Core CLI Application
 * Consolidated CLI framework with command composition, middleware, validation, and error handling
 */

import { EventEmitter } from 'node:events';
import { CommandParser } from './command-parser.ts';
import { printError, printInfo } from './output-formatter.ts';
import { getCommand, getCommandByNameOrAlias } from './command-registry.ts';

export const VERSION = "8.0.3";

// Core interfaces
export interface ValidationRule {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

export interface CLILogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, error?: unknown): void;
}

export interface CLIContainer {
  resolve<T>(name: string): Promise<T>;
  has(name: string): boolean;
}

export interface CLIValidator {
  validate(value: any, rule: any): { valid: boolean; errors: any[]; value?: any };
}

export interface CLIContext {
  container?: CLIContainer;
  logger?: CLILogger;
  validator?: CLIValidator;
  args: string[];
  options: Record<string, any>;
  command: string;
  subcommand?: string;
  workingDirectory: string;
  environment: Record<string, string>;
  config?: Record<string, any>;
  user: {
    id?: string;
    name?: string;
    preferences?: Record<string, any>;
  };
}

export interface ArgumentDefinition {
  name: string;
  description: string;
  required?: boolean;
  variadic?: boolean;
  validation?: ValidationRule;
  default?: any;
}

export interface OptionDefinition {
  name: string;
  short?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: any;
  choices?: string[];
  validation?: ValidationRule;
}

export interface CLIMiddleware {
  name: string;
  handler: (context: CLIContext, next: () => Promise<any>) => Promise<any>;
  priority?: number;
}

export interface CLICommand {
  name: string;
  description: string;
  usage?: string;
  examples?: string[];
  aliases?: string[];
  category?: string;
  hidden?: boolean;
  
  // Validation
  arguments?: ArgumentDefinition[];
  options?: OptionDefinition[];
  
  // Middleware
  middleware?: CLIMiddleware[];
  
  // Execution
  handler: (context: CLIContext) => Promise<any> | any;
  
  // Subcommands
  subcommands?: CLICommand[];
}

export interface CLIError extends Error {
  code: string;
  exitCode: number;
  context?: any;
  suggestions?: string[];
}

// Simple OutputFormatter wrapper
class OutputFormatter {
  printError(message: string): void {
    printError(message);
  }
  
  printInfo(message: string): void {
    printInfo(message);
  }
}

export class CLIApplication extends EventEmitter {
  private commands = new Map<string, CLICommand>();
  private middleware: CLIMiddleware[] = [];
  private globalOptions: OptionDefinition[] = [];
  private commandParser: CommandParser;
  private outputFormatter: OutputFormatter;
  private config: Record<string, any> = {};
  private name: string;
  private description: string;
  private container?: CLIContainer;
  private logger?: CLILogger;
  private validator?: CLIValidator;

  constructor(
    name: string,
    description: string,
    container?: CLIContainer,
    logger?: CLILogger,
    validator?: CLIValidator
  ) {
    super();
    this.name = name;
    this.description = description;
    if (container !== undefined) this.container = container;
    if (logger !== undefined) this.logger = logger;
    if (validator !== undefined) this.validator = validator;
    this.commandParser = new CommandParser();
    this.outputFormatter = new OutputFormatter();
    this.setupGlobalOptions();
    this.setupGlobalMiddleware();
  }

  /**
   * Set configuration
   */
  setConfig(config: Record<string, any>): this {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Get configuration
   */
  getConfig(): Record<string, any> {
    return this.config;
  }

  /**
   * Register a command
   */
  command(command: CLICommand): this {
    // Validate command definition
    this.validateCommand(command);
    
    // Register main command
    this.commands.set(command.name, command);
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }

    // Register subcommands
    if (command.subcommands) {
      for (const subcommand of command.subcommands) {
        const fullName = `${command.name}:${subcommand.name}`;
        this.commands.set(fullName, subcommand);
      }
    }

    return this;
  }

  /**
   * Register multiple commands
   */
  registerCommands(commands: CLICommand[]): this {
    commands.forEach(cmd => this.command(cmd));
    return this;
  }

  /**
   * Register global middleware
   */
  use(middleware: CLIMiddleware): this {
    this.middleware.push(middleware);
    this.middleware.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return this;
  }

  /**
   * Add global option
   */
  option(option: OptionDefinition): this {
    this.globalOptions.push(option);
    return this;
  }

  /**
   * Run the CLI with provided arguments
   */
  async run(args = process.argv.slice(2)): Promise<any> {
    try {
      // Handle version at top level
      if (args.includes('--version') || args.includes('-v')) {
        console.log(`${this.name} v${VERSION}`);
        return;
      }

      // Handle empty args (show global help)
      if (args.length === 0) {
        this.showHelp();
        return;
      }

      // Handle global help only if no command specified
      if ((args.includes('--help') || args.includes('-h')) && args.length === 1) {
        this.showHelp();
        return;
      }

      return await this.execute(args);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`❌ ${error.message}`);
        if (args.includes('--verbose')) {
          console.error(error.stack);
        }
      }
      process.exit(1);
    }
  }

  /**
   * Apply default values from command option definitions
   */
  private applyDefaultValues(command: CLICommand, options: Record<string, any>, parentCommand?: CLICommand): Record<string, any> {
    const result = { ...options };
    
    // Apply defaults from parent command first (if exists)
    if (parentCommand && parentCommand.options) {
      for (const optionDef of parentCommand.options) {
        if (optionDef.default !== undefined && result[optionDef.name] === undefined) {
          result[optionDef.name] = optionDef.default;
        }
      }
    }
    
    // Apply defaults from the current command (subcommand takes precedence)
    if (command.options) {
      for (const optionDef of command.options) {
        if (optionDef.default !== undefined && result[optionDef.name] === undefined) {
          result[optionDef.name] = optionDef.default;
        }
      }
    }
    
    return result;
  }

  /**
   * Execute a command
   */
  async execute(args: string[]): Promise<void> {
    try {
      // Parse command line arguments
      const parsed = this.commandParser.parse(args);
      const { command: commandName, args: commandArgs, options: rawOptions } = parsed;

      // Handle no command (show help)
      if (!commandName) {
        const helpCommand = getCommand('help');
        if (helpCommand) {
          await helpCommand.handler({ 
            args: [], 
            options: {}, 
            config: this.config,
            command: 'help',
            workingDirectory: process.cwd(),
            environment: process.env as Record<string, string>,
            user: { id: 'default', name: 'user' }
          });
        }
        return;
      }

      // Get command from application registry (including aliases)
      const command = this.commands.get(commandName);
      if (!command) {
        this.outputFormatter.printError(`Unknown command: ${commandName}`);
        this.outputFormatter.printInfo('Run "flowx help" to see available commands.');
        return;
      }

      // Handle subcommands - check if first argument is a valid subcommand
      let targetCommand = command;
      let subcommand: string | undefined;
      let finalArgs = commandArgs;
      
      if (commandArgs.length > 0 && command.subcommands) {
        const potentialSubcommand = commandArgs[0];
        const subCmd = command.subcommands.find(sc => sc.name === potentialSubcommand);
        if (subCmd) {
          targetCommand = subCmd;
          subcommand = potentialSubcommand;
          finalArgs = commandArgs.slice(1); // Remove subcommand from args
        }
      }

      // Apply default values from command option definitions
      const options = this.applyDefaultValues(targetCommand, rawOptions, command);

      // Create execution context
      const context: CLIContext = {
        args: finalArgs,
        options,
        config: this.config,
        command: commandName,
        workingDirectory: process.cwd(),
        environment: process.env as Record<string, string>,
        user: { id: 'default', name: 'user' }
      };

      // Add subcommand if it exists
      if (subcommand) {
        context.subcommand = subcommand;
      }

      // Add optional properties if they exist
      if (this.container) context.container = this.container;
      if (this.logger) context.logger = this.logger;
      if (this.validator) context.validator = this.validator;

      // Execute the target command through middleware
      await this.executeMiddleware(targetCommand, context);

    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get command help
   */
  getHelp(commandName?: string): string {
    if (commandName) {
      const cmd = this.commands.get(commandName);
      if (!cmd) {
        return `Command not found: ${commandName}`;
      }
      return this.formatCommandHelp(cmd);
    }

    return this.formatGlobalHelp();
  }

  /**
   * Get all commands
   */
  getCommands(): CLICommand[] {
    const unique = new Map<string, CLICommand>();
    
    for (const [name, cmd] of this.commands) {
      if (!unique.has(cmd.name)) {
        unique.set(cmd.name, cmd);
      }
    }

    return Array.from(unique.values())
      .filter(cmd => !cmd.hidden)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private parseArgs(args: string[]): {
    command: string;
    parsedArgs: string[];
    options: Record<string, any>;
  } & ({ subcommand: string } | {}) {
    if (args.length === 0) {
      throw this.createError('No command provided', 'NO_COMMAND', 1);
    }

    const command = args[0];
    let subcommand: string | undefined;
    let startIndex = 1;

    // Check for subcommand
    if (args.length > 1 && !args[1].startsWith('-')) {
      const fullCommand = `${command}:${args[1]}`;
      if (this.commands.has(fullCommand)) {
        subcommand = args[1];
        startIndex = 2;
      }
    }

    // Parse options and arguments
    const options: Record<string, any> = {};
    const parsedArgs: string[] = [];

    for (let i = startIndex; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        // Long option
        const [key, value] = arg.slice(2).split('=', 2);
        if (value !== undefined) {
          options[key] = value;
        } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options[key] = args[++i];
        } else {
          options[key] = true;
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        // Short option(s)
        const flags = arg.slice(1);
        for (let j = 0; j < flags.length; j++) {
          const flag = flags[j];
          if (j === flags.length - 1 && i + 1 < args.length && !args[i + 1].startsWith('-')) {
            options[flag] = args[++i];
          } else {
            options[flag] = true;
          }
        }
      } else {
        // Argument
        parsedArgs.push(arg);
      }
    }

    return { 
      command, 
      parsedArgs, 
      options,
      ...(subcommand && { subcommand })
    };
  }

  private findCommand(command: string, subcommand?: string): CLICommand | undefined {
    if (subcommand) {
      return this.commands.get(`${command}:${subcommand}`);
    }
    return this.commands.get(command);
  }

  private async loadConfig(configPath?: string): Promise<Record<string, any> | undefined> {
    const configFile = configPath || "flowx.config.tson";
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(configFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  }

  private async validateInput(cmd: CLICommand, context: CLIContext): Promise<void> {
    if (!this.validator) return;

    const errors: string[] = [];

    // Validate arguments
    if (cmd.arguments) {
      for (let i = 0; i < cmd.arguments.length; i++) {
        const argDef = cmd.arguments[i];
        const value = context.args[i];

        if (argDef.required && value === undefined) {
          errors.push(`Required argument '${argDef.name}' is missing`);
          continue;
        }

        if (value !== undefined && argDef.validation) {
          const result = this.validator.validate(value, argDef.validation);
          if (!result.valid) {
            errors.push(...result.errors.map(e => `Argument '${argDef.name}': ${e.message}`));
          } else {
            context.args[i] = result.value;
          }
        }
      }
    }

    // Validate options
    const allOptions = [...this.globalOptions, ...(cmd.options || [])];
    for (const optDef of allOptions) {
      const value = context.options[optDef.name] || context.options[optDef.short || ''];

      if (optDef.required && value === undefined) {
        errors.push(`Required option '--${optDef.name}' is missing`);
        continue;
      }

      if (value !== undefined) {
        // Type conversion
        let convertedValue = value;
        if (optDef.type === 'number' && typeof value === 'string') {
          convertedValue = parseFloat(value);
          if (isNaN(convertedValue)) {
            errors.push(`Option '--${optDef.name}' must be a number`);
            continue;
          }
        }

        // Choices validation
        if (optDef.choices && !optDef.choices.includes(convertedValue)) {
          errors.push(`Option '--${optDef.name}' must be one of: ${optDef.choices.join(', ')}`);
          continue;
        }

        // Custom validation
        if (optDef.validation) {
          const result = this.validator.validate(convertedValue, optDef.validation);
          if (!result.valid) {
            errors.push(...result.errors.map(e => `Option '--${optDef.name}': ${e.message}`));
          } else {
            context.options[optDef.name] = result.value;
          }
        } else {
          context.options[optDef.name] = convertedValue;
        }
      }
    }

    if (errors.length > 0) {
      throw this.createError(
        `Validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`,
        'VALIDATION_FAILED',
        1,
        { errors }
      );
    }
  }

  private async executeMiddleware(cmd: CLICommand, context: CLIContext): Promise<any> {
    const allMiddleware = [
      ...this.middleware,
      ...(cmd.middleware || [])
    ].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    let index = 0;

    const next = async (): Promise<any> => {
      if (index < allMiddleware.length) {
        const middleware = allMiddleware[index++];
        return await middleware.handler(context, next);
      } else {
        // Execute command handler
        return await cmd.handler(context);
      }
    };

    return await next();
  }

  private validateCommand(command: CLICommand): void {
    if (!command.name || typeof command.name !== 'string') {
      throw new Error('Command name is required and must be a string');
    }

    if (!command.handler || typeof command.handler !== 'function') {
      throw new Error('Command handler is required and must be a function');
    }

    if (command.arguments) {
      const requiredAfterOptional = command.arguments.some((arg, i) => 
        arg.required && command.arguments!.slice(0, i).some(prev => !prev.required)
      );
      
      if (requiredAfterOptional) {
        throw new Error('Required arguments cannot come after optional arguments');
      }
    }
  }

  private formatCommandHelp(cmd: CLICommand): string {
    let help = `${cmd.name} - ${cmd.description}\n\n`;

    if (cmd.usage) {
      help += `Usage: ${cmd.usage}\n\n`;
    }

    if (cmd.arguments && cmd.arguments.length > 0) {
      help += 'Arguments:\n';
      for (const arg of cmd.arguments) {
        const required = arg.required ? '' : '?';
        help += `  ${arg.name}${required}  ${arg.description}\n`;
      }
      help += '\n';
    }

    if (cmd.options && cmd.options.length > 0) {
      help += 'Options:\n';
      for (const opt of cmd.options) {
        const short = opt.short ? `-${opt.short}, ` : '    ';
        help += `  ${short}--${opt.name}  ${opt.description}\n`;
      }
      help += '\n';
    }

    if (cmd.examples && cmd.examples.length > 0) {
      help += 'Examples:\n';
      for (const example of cmd.examples) {
        help += `  ${example}\n`;
      }
      help += '\n';
    }

    return help;
  }

  private formatGlobalHelp(): string {
    let help = `\n🧠 ${this.name} v${VERSION} - ${this.description}\n\n`;

    help += 'USAGE:\n';
    help += `  ${this.name} [COMMAND] [OPTIONS]\n\n`;

    const commands = this.getCommands();
    const categories = new Map<string, CLICommand[]>();

    // Group by category
    for (const cmd of commands) {
      const category = cmd.category || 'General';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(cmd);
    }

    help += 'COMMANDS:\n';
    // Format each category
    for (const [category, cmds] of categories) {
      help += `  ${category}:\n`;
      for (const cmd of cmds) {
        help += `    ${cmd.name.padEnd(18)} ${cmd.description}\n`;
      }
      help += '\n';
    }

    help += 'GLOBAL OPTIONS:\n';
    for (const opt of this.globalOptions) {
      const flags = opt.short ? `-${opt.short}, --${opt.name}` : `    --${opt.name}`;
      help += `  ${flags.padEnd(25)} ${opt.description}\n`;
    }

    help += '\nEXAMPLES:\n';
    help += `  ${this.name} start                                    # Start orchestrator\n`;
    help += `  ${this.name} agent spawn researcher --name "Bot"     # Spawn research agent\n`;
    help += `  ${this.name} task create research "Analyze data"     # Create task\n`;
    help += `  ${this.name} config init                             # Initialize config\n`;
    help += `  ${this.name} status                                  # Show system status\n\n`;

    help += `For more detailed help on specific commands, use:\n`;
    help += `  ${this.name} [COMMAND] --help\n\n`;

    return help;
  }

  private showHelp(): void {
    console.log(this.formatGlobalHelp());
  }

  private createError(message: string, code: string, exitCode: number, context?: any): CLIError {
    const error = new Error(message) as CLIError;
    error.code = code;
    error.exitCode = exitCode;
    error.context = context;
    return error;
  }

  private setupGlobalOptions(): void {
    this.globalOptions = [
      {
        name: 'help',
        short: 'h',
        description: 'Show help information',
        type: 'boolean'
      },
      {
        name: 'version',
        short: 'v',
        description: 'Show version information',
        type: 'boolean'
      },
      {
        name: 'verbose',
        description: 'Enable verbose logging',
        type: 'boolean'
      },
      {
        name: 'quiet',
        short: 'q',
        description: 'Suppress output',
        type: 'boolean'
      },
      {
        name: 'config',
        short: 'c',
        description: 'Configuration file path',
        type: 'string'
      },
      {
        name: 'log-level',
        description: 'Set log level (debug, info, warn, error)',
        type: 'string',
        default: 'info',
        choices: ['debug', 'info', 'warn', 'error']
      },

    ];
  }

  private setupGlobalMiddleware(): void {
    // Help middleware
    this.use({
      name: 'help',
      priority: 1000,
      handler: async (context, next) => {
        if (context.options.help) {
          const help = this.formatCommandHelp(this.commands.get(context.command)!);
          console.log(help);
          return;
        }
        return await next();
      }
    });

    // Version middleware
    this.use({
      name: 'version',
      priority: 999,
      handler: async (context, next) => {
        if (context.options.version) {
          console.log(`${this.name} v${VERSION}`);
          return;
        }
        return await next();
      }
    });

    // Logging middleware
    this.use({
      name: 'logging',
      priority: 900,
      handler: async (context, next) => {
        const start = Date.now();
        
        if (context.options.verbose && context.logger) {
          context.logger.info('Executing command', {
            command: context.command,
            subcommand: context.subcommand,
            args: context.args,
            options: context.options
          });
        }

        try {
          const result = await next();
          
          if (context.options.verbose && context.logger) {
            context.logger.info('Command completed', {
              command: context.command,
              duration: Date.now() - start
            });
          }
          
          return result;
        } catch (error) {
          if (context.logger) {
            context.logger.error('Command failed', {
              command: context.command,
              error: error instanceof Error ? error.message : error,
              duration: Date.now() - start
            });
          }
          throw error;
        }
      }
    });


  }

  /**
   * Handle errors
   */
  private handleError(error: unknown): void {
    if (error instanceof Error) {
      this.outputFormatter.printError(`Error: ${error.message}`);
      if (this.logger) {
        this.logger.error('CLI Error', error);
      }
    } else {
      this.outputFormatter.printError(`Unknown error: ${String(error)}`);
    }
  }
} 