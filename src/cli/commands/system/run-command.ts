/**
 * Run Command
 * Execute arbitrary commands/scripts within FlowX context
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { printSuccess, printError, printInfo, printWarning } from '../../core/output-formatter.js';
import { getLogger, getMemoryManager, getPersistenceManager } from '../../core/global-initialization.js';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, mkdir, access, constants } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { platform } from 'os';

const execAsync = promisify(exec);

export const runCommand: CLICommand = {
  name: 'run',
  description: 'Execute arbitrary commands/scripts within FlowX context',
  category: 'System',
  usage: 'flowx run <command> [ARGS...] [OPTIONS]',
  examples: [
    'flowx run "npm test"',
    'flowx run ls -la',
    'flowx run --script ./my-script.sh',
    'flowx run --file commands.txt',
    'flowx run "echo Hello" --async',
    'flowx run "sleep 10" --timeout 5',
    'flowx run --interactive bash',
    'flowx run "npm install" --cwd ./my-project'
  ],
  arguments: [
    {
      name: 'command',
      description: 'Command to execute',
      required: false
    },
    {
      name: 'args',
      description: 'Command arguments',
      required: false,
      variadic: true
    }
  ],
  options: [
    {
      name: 'script',
      short: 's',
      description: 'Execute script file',
      type: 'string'
    },
    {
      name: 'file',
      short: 'f',
      description: 'Execute commands from file (one per line)',
      type: 'string'
    },
    {
      name: 'cwd',
      short: 'C',
      description: 'Working directory',
      type: 'string'
    },
    {
      name: 'env',
      short: 'e',
      description: 'Environment variables (JSON or KEY=VALUE format)',
      type: 'string'
    },
    {
      name: 'timeout',
      short: 't',
      description: 'Timeout in seconds',
      type: 'number'
    },
    {
      name: 'async',
      short: 'a',
      description: 'Run asynchronously (non-blocking)',
      type: 'boolean'
    },
    {
      name: 'interactive',
      short: 'i',
      description: 'Interactive mode (inherit stdio)',
      type: 'boolean'
    },
    {
      name: 'shell',
      description: 'Shell to use for execution',
      type: 'string',
      default: platform() === 'win32' ? 'cmd' : 'bash'
    },
    {
      name: 'capture',
      short: 'c',
      description: 'Capture output to file',
      type: 'string'
    },
    {
      name: 'silent',
      description: 'Suppress output',
      type: 'boolean'
    },
    {
      name: 'dry-run',
      short: 'd',
      description: 'Show what would be executed without running',
      type: 'boolean'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output',
      type: 'boolean'
    },
    {
      name: 'ignore-errors',
      description: 'Continue execution even if commands fail',
      type: 'boolean'
    },
    {
      name: 'retry',
      short: 'r',
      description: 'Number of retry attempts on failure',
      type: 'number',
      default: 0
    },
    {
      name: 'retry-delay',
      description: 'Delay between retries in seconds',
      type: 'number',
      default: 1
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    try {
      const logger = await getLogger();
      const memoryManager = await getMemoryManager();
      const persistenceManager = await getPersistenceManager();
      
      // Determine execution mode
      if (options.script) {
        await executeScript(options.script, options, logger);
      } else if (options.file) {
        await executeCommandsFromFile(options.file, options, logger);
      } else if (args.length > 0) {
        const command = args[0];
        const commandArgs = args.slice(1);
        await executeCommand(command, commandArgs, options, logger);
      } else {
        printError('Command, script, or file is required');
        printInfo('Usage: flowx run <command> [args...]');
        printInfo('       flowx run --script <script-file>');
        printInfo('       flowx run --file <commands-file>');
        return;
      }
      
    } catch (error) {
      printError(`Run command failed: ${error instanceof Error ? error.message : String(error)}`);
      if (options.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  }
};

// Helper functions

async function executeCommand(command: string, commandArgs: string[], options: any, logger: any): Promise<void> {
  const fullCommand = [command, ...commandArgs].join(' ');
  
  if (options['dry-run']) {
    printInfo(`Would execute: ${fullCommand}`);
    if (options.cwd) printInfo(`Working directory: ${options.cwd}`);
    if (options.env) printInfo(`Environment: ${options.env}`);
    if (options.timeout) printInfo(`Timeout: ${options.timeout}s`);
    return;
  }
  
  printInfo(`🚀 Executing: ${fullCommand}`);
  
  const executionOptions = {
    cwd: options.cwd ? resolve(options.cwd) : process.cwd(),
    env: await buildEnvironment(options.env),
    timeout: options.timeout ? options.timeout * 1000 : undefined,
    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
  };
  
  if (options.verbose) {
    printInfo(`Working directory: ${executionOptions.cwd}`);
    printInfo(`Environment variables: ${Object.keys(executionOptions.env).length} vars`);
  }
  
  try {
    await executeWithRetry(fullCommand, executionOptions, options, logger);
  } catch (error) {
    if (!options['ignore-errors']) {
      throw error;
    } else {
      printWarning(`Command failed but continuing due to --ignore-errors: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function executeScript(scriptPath: string, options: any, logger: any): Promise<void> {
  try {
    await access(scriptPath, constants.R_OK);
  } catch {
    printError(`Script file not found or not readable: ${scriptPath}`);
    return;
  }
  
  const resolvedPath = resolve(scriptPath);
  
  if (options['dry-run']) {
    printInfo(`Would execute script: ${resolvedPath}`);
    return;
  }
  
  printInfo(`📜 Executing script: ${resolvedPath}`);
  
  const executionOptions = {
    cwd: options.cwd ? resolve(options.cwd) : dirname(resolvedPath),
    env: await buildEnvironment(options.env),
    timeout: options.timeout ? options.timeout * 1000 : undefined,
  };
  
  // Determine script interpreter
  const interpreter = getScriptInterpreter(resolvedPath, options.shell);
  const command = `${interpreter} "${resolvedPath}"`;
  
  if (options.verbose) {
    printInfo(`Interpreter: ${interpreter}`);
    printInfo(`Working directory: ${executionOptions.cwd}`);
  }
  
  try {
    await executeWithRetry(command, executionOptions, options, logger);
  } catch (error) {
    if (!options['ignore-errors']) {
      throw error;
    } else {
      printWarning(`Script failed but continuing due to --ignore-errors: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function executeCommandsFromFile(filePath: string, options: any, logger: any): Promise<void> {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    printError(`Commands file not found or not readable: ${filePath}`);
    return;
  }
  
  const content = await readFile(filePath, 'utf8');
  const commands = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments
  
  if (commands.length === 0) {
    printWarning('No commands found in file');
    return;
  }
  
  if (options['dry-run']) {
    printInfo(`Would execute ${commands.length} commands from: ${filePath}`);
    commands.forEach((cmd, i) => {
      printInfo(`  ${i + 1}. ${cmd}`);
    });
    return;
  }
  
  printInfo(`📋 Executing ${commands.length} commands from: ${filePath}`);
  
  const executionOptions = {
    cwd: options.cwd ? resolve(options.cwd) : dirname(resolve(filePath)),
    env: await buildEnvironment(options.env),
    timeout: options.timeout ? options.timeout * 1000 : undefined,
  };
  
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    printInfo(`[${i + 1}/${commands.length}] ${command}`);
    
    try {
      await executeWithRetry(command, executionOptions, options, logger);
      printSuccess(`✅ Command ${i + 1} completed`);
    } catch (error) {
      if (!options['ignore-errors']) {
        printError(`❌ Command ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      } else {
        printWarning(`⚠️ Command ${i + 1} failed but continuing: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

async function executeWithRetry(command: string, executionOptions: any, options: any, logger: any): Promise<void> {
  let lastError: Error | null = null;
  const maxAttempts = (options.retry || 0) + 1;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        printInfo(`🔄 Retry attempt ${attempt}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, (options['retry-delay'] || 1) * 1000));
      }
      
      if (options.interactive) {
        await executeInteractive(command, executionOptions, options, logger);
      } else if (options.async) {
        await executeAsync(command, executionOptions, options, logger);
      } else {
        await executeSync(command, executionOptions, options, logger);
      }
      
      return; // Success
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        printWarning(`Attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  throw lastError;
}

async function executeSync(command: string, executionOptions: any, options: any, logger: any): Promise<void> {
  const startTime = Date.now();
  
  try {
    const { stdout, stderr } = await execAsync(command, executionOptions);
    
    const duration = Date.now() - startTime;
    
    // Convert buffers to strings
    const stdoutStr = stdout ? stdout.toString() : '';
    const stderrStr = stderr ? stderr.toString() : '';
    
    if (!options.silent) {
      if (stdoutStr) {
        console.log(stdoutStr);
      }
      if (stderrStr) {
        console.error(stderrStr);
      }
    }
    
    if (options.capture) {
      await captureOutput(options.capture, stdoutStr, stderrStr);
    }
    
    if (options.verbose) {
      printSuccess(`✅ Command completed in ${duration}ms`);
    }
    
    logger.info('Command executed successfully', {
      command,
      duration,
      cwd: executionOptions.cwd
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Convert buffers to strings
    const stdoutStr = error.stdout ? error.stdout.toString() : '';
    const stderrStr = error.stderr ? error.stderr.toString() : '';
    
    if (!options.silent && stdoutStr) {
      console.log(stdoutStr);
    }
    if (!options.silent && stderrStr) {
      console.error(stderrStr);
    }
    
    if (options.capture) {
      await captureOutput(options.capture, stdoutStr, stderrStr);
    }
    
    logger.error('Command execution failed', {
      command,
      duration,
      error: error.message,
      exitCode: error.code,
      cwd: executionOptions.cwd
    });
    
    throw new Error(`Command failed with exit code ${error.code}: ${error.message}`);
  }
}

async function executeAsync(command: string, executionOptions: any, options: any, logger: any): Promise<void> {
  printInfo('🔄 Running asynchronously...');
  
  const child = spawn(options.shell || 'bash', ['-c', command], {
    ...executionOptions,
    stdio: options.silent ? 'ignore' : 'pipe',
    detached: true
  });
  
  if (child.pid) {
    printSuccess(`✅ Process started with PID: ${child.pid}`);
    
    if (!options.silent) {
      printInfo('Use process monitoring tools to track progress');
    }
    
    logger.info('Async command started', {
      command,
      pid: child.pid,
      cwd: executionOptions.cwd
    });
  }
  
  child.unref(); // Allow parent to exit
}

async function executeInteractive(command: string, executionOptions: any, options: any, logger: any): Promise<void> {
  printInfo('🎮 Running in interactive mode...');
  
  const child = spawn(options.shell || 'bash', ['-c', command], {
    ...executionOptions,
    stdio: 'inherit'
  });
  
  return new Promise<void>((resolve, reject) => {
    child.on('exit', (code, signal) => {
      if (code === 0) {
        printSuccess('✅ Interactive command completed');
        logger.info('Interactive command completed', { command, code, signal });
        resolve();
      } else {
        const error = new Error(`Interactive command failed with exit code ${code}`);
        logger.error('Interactive command failed', { command, code, signal });
        reject(error);
      }
    });
    
    child.on('error', (error) => {
      logger.error('Interactive command error', { command, error: error.message });
      reject(error);
    });
  });
}

async function buildEnvironment(envOption?: string): Promise<NodeJS.ProcessEnv> {
  const env = { ...process.env };
  
  // Add FlowX context variables
  env.FLOWX_CONTEXT = 'true';
  env.FLOWX_VERSION = '1.0.0';
  env.FLOWX_TIMESTAMP = new Date().toISOString();
  
  if (envOption) {
    try {
      // Try parsing as JSON first
      const parsedEnv = JSON.parse(envOption);
      Object.assign(env, parsedEnv);
    } catch {
      // Fall back to KEY=VALUE format
      const pairs = envOption.split(',');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      }
    }
  }
  
  return env;
}

function getScriptInterpreter(scriptPath: string, defaultShell: string): string {
  const ext = scriptPath.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'sh':
    case 'bash':
      return 'bash';
    case 'zsh':
      return 'zsh';
    case 'fish':
      return 'fish';
    case 'ps1':
      return 'powershell';
    case 'cmd':
    case 'bat':
      return 'cmd';
    case 'py':
      return 'python';
    case 'js':
      return 'node';
    case 'ts':
      return 'ts-node';
    case 'rb':
      return 'ruby';
    case 'php':
      return 'php';
    case 'pl':
      return 'perl';
    default:
      return defaultShell;
  }
}

async function captureOutput(filePath: string, stdout: string, stderr: string): Promise<void> {
  const output = {
    timestamp: new Date().toISOString(),
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    success: !stderr
  };
  
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(output, null, 2));
    printInfo(`📄 Output captured to: ${filePath}`);
  } catch (error) {
    printWarning(`Failed to capture output: ${error instanceof Error ? error.message : String(error)}`);
  }
} 