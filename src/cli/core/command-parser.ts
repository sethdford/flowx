/**
 * Command Parser
 * Handles parsing of command-line arguments and options
 */

export interface ParsedArgs {
  command: string;
  subcommand?: string | undefined;
  args: string[];
  options: Record<string, any>;
}

export interface ParserOptions {
  allowUnknownOptions?: boolean;
  stopAtFirstUnknown?: boolean;
  booleanFlags?: string[];
  stringFlags?: string[];
  aliases?: Record<string, string>;
  defaults?: Record<string, any>;
}

export class CommandParser {
  private options: ParserOptions;
  
  constructor(options: ParserOptions = {}) {
    this.options = options;
  }

  /**
   * Parse command line arguments
   */
  parse(args: string[]): ParsedArgs {
    if (args.length === 0) {
      throw new Error('No command provided');
    }

    const command = args[0];
    let subcommand: string | undefined = undefined;
    let remainingArgs = args.slice(1);

    // Check for a subcommand
    if (remainingArgs.length > 0 && !remainingArgs[0].startsWith('-')) {
      subcommand = remainingArgs[0];
      remainingArgs = remainingArgs.slice(1);
    }
    
    const { options, args: finalArgs } = this.parseOptions(remainingArgs);

    return {
      command,
      subcommand,
      args: finalArgs,
      options
    };
  }

  /**
   * Parse options and arguments from a list of strings
   */
  private parseOptions(args: string[]): { options: Record<string, any>; args: string[] } {
    const options: Record<string, any> = { ...this.options.defaults };
    const remainingArgs: string[] = [];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--') {
        // Everything after -- is treated as arguments
        remainingArgs.push(...args.slice(i + 1));
        break;
      }

      if (arg.startsWith('--')) {
        // Long option
        const result = this.parseLongOption(arg, args, i);
        Object.assign(options, result.options);
        i = result.nextIndex;
      } else if (arg.startsWith('-') && arg.length > 1) {
        // Short option(s)
        const result = this.parseShortOptions(arg, args, i);
        Object.assign(options, result.options);
        i = result.nextIndex;
      } else {
        // Regular argument
        remainingArgs.push(arg);
      }
    }

    // Apply aliases
    if (this.options.aliases) {
      for (const [alias, target] of Object.entries(this.options.aliases)) {
        if (options[alias] !== undefined) {
          options[target] = options[alias];
          delete options[alias];
        }
      }
    }

    return { options, args: remainingArgs };
  }

  /**
   * Parse a long option (--option or --option=value)
   */
  private parseLongOption(
    arg: string, 
    args: string[], 
    currentIndex: number
  ): { options: Record<string, any>; nextIndex: number } {
    const options: Record<string, any> = {};
    let nextIndex = currentIndex;

    // Split on = if present
    const [key, value] = arg.slice(2).split('=', 2);

    if (value !== undefined) {
      // --option=value
      options[key] = this.parseValue(key, value);
    } else {
      // --option (might have value as next arg)
      if (this.isBooleanFlag(key)) {
        options[key] = true;
      } else if (currentIndex + 1 < args.length && !args[currentIndex + 1].startsWith('-')) {
        // Next argument is the value
        options[key] = this.parseValue(key, args[currentIndex + 1]);
        nextIndex = currentIndex + 1;
      } else {
        // No value provided, treat as boolean
        options[key] = true;
      }
    }

    return { options, nextIndex };
  }

  /**
   * Parse short options (-o or -abc)
   */
  private parseShortOptions(
    arg: string, 
    args: string[], 
    currentIndex: number
  ): { options: Record<string, any>; nextIndex: number } {
    const options: Record<string, any> = {};
    let nextIndex = currentIndex;

    const flags = arg.slice(1);

    if (!flags || flags.length === 0) {
      return { options, nextIndex };
    }

    for (let j = 0; j < flags.length; j++) {
      const flag = flags[j];

      if (!flag) {
        continue;
      }

      if (this.isBooleanFlag(flag)) {
        options[flag] = true;
      } else {
        // This flag expects a value
        if (j === flags.length - 1) {
          // Last flag in the group, value might be next argument
          if (currentIndex + 1 < args.length && !args[currentIndex + 1].startsWith('-')) {
            options[flag] = this.parseValue(flag, args[currentIndex + 1]);
            nextIndex = currentIndex + 1;
          } else {
            options[flag] = true;
          }
        } else {
          // Value is the rest of the string
          const remainingFlags = flags.slice(j + 1);
          if (remainingFlags) {
            options[flag] = this.parseValue(flag, remainingFlags);
          } else {
            options[flag] = true;
          }
          break;
        }
      }
    }

    return { options, nextIndex };
  }

  /**
   * Parse a value based on the flag type
   */
  private parseValue(key: string, value: string): any {
    // Check if this is a string flag
    if (this.options.stringFlags?.includes(key)) {
      return value;
    }

    // Try to parse as number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Return as string
    return value;
  }

  /**
   * Check if a flag is boolean
   */
  private isBooleanFlag(flag: string): boolean {
    return this.options.booleanFlags?.includes(flag) ?? false;
  }
}

/**
 * Simple parser function for basic use cases
 */
export function parseArgs(args: string[], options?: ParserOptions): ParsedArgs {
  const parser = new CommandParser(options);
  return parser.parse(args);
}

/**
 * Parse environment variables into options
 */
export function parseEnvVars(prefix: string = 'FLOWX_'): Record<string, any> {
  const options: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && value !== undefined) {
      const optionKey = key
        .slice(prefix.length)
        .toLowerCase()
        .replace(/_/g, '-');
      
      // Try to parse the value
      if (value === 'true') options[optionKey] = true;
      else if (value === 'false') options[optionKey] = false;
      else if (/^\d+$/.test(value)) options[optionKey] = parseInt(value, 10);
      else if (/^\d+\.\d+$/.test(value)) options[optionKey] = parseFloat(value);
      else options[optionKey] = value;
    }
  }
  
  return options;
}

/**
 * Merge options from multiple sources (defaults < env vars < command line)
 */
export function mergeOptions(...optionSets: Record<string, any>[]): Record<string, any> {
  return Object.assign({}, ...optionSets);
}

/**
 * Validate required options
 */
export function validateRequiredOptions(
  options: Record<string, any>, 
  required: string[]
): string[] {
  const missing: string[] = [];
  
  for (const key of required) {
    if (options[key] === undefined || options[key] === null) {
      missing.push(key);
    }
  }
  
  return missing;
}

/**
 * Convert camelCase to kebab-case for option names
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert kebab-case to camelCase for option names
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export default CommandParser; 