/**
 * VSCode Extension Bridge for Terminal Integration
 * 
 * This file provides the bridge between FlowX and VSCode extension API
 * for terminal management and output capture.
 */

// Type declarations for vscode module (optional dependency)
interface VSCodeTerminal {
  sendText(text: string, addNewLine?: boolean): void;
  dispose(): void;
}

interface VSCodeExtensionContext {
  subscriptions: any[];
}

interface VSCodeWindow {
  createTerminal(options?: any): VSCodeTerminal;
  showInformationMessage(message: string): void;
  onDidCloseTerminal?: (callback: (terminal: VSCodeTerminal) => void) => any;
  registerTerminalProfileProvider?: any;
}

interface VSCodeEventEmitter<T> {
  event: (listener: (e: T) => void) => any;
  fire(data: T): void;
  dispose(): void;
}

interface VSCodeAPI {
  window: VSCodeWindow;
  EventEmitter: new <T>() => VSCodeEventEmitter<T>;
}

// Conditional import for vscode module
let vscode: VSCodeAPI | null = null;
try {
  vscode = require('vscode');
} catch (error) {
  // VSCode module not available - running outside VSCode
}

/**
 * Terminal output processors registry
 */
const terminalOutputProcessors = new Map<string, (data: string) => void>();

/**
 * Active terminals registry
 */
const activeTerminals = new Map<string, VSCodeTerminal>();

/**
 * Terminal write emulators for output capture
 */
const terminalWriteEmulators = new Map<VSCodeTerminal, VSCodeEventEmitter<string>>();

/**
 * Initialize the VSCode terminal bridge
 */
export function initializeTerminalBridge(context: VSCodeExtensionContext): void {
  if (!vscode) {
    console.warn('VSCode API not available - terminal bridge disabled');
    return;
  }

  // Inject VSCode API into global scope for FlowX
  (globalThis as any).vscode = vscode;

  // Register terminal output processor function
  (globalThis as any).registerTerminalOutputProcessor = (
    terminalId: string,
    processor: (data: string) => void
  ) => {
    terminalOutputProcessors.set(terminalId, processor);
  };

  // Override terminal creation to capture output
  const originalCreateTerminal = vscode.window.createTerminal;
  (vscode.window as any).createTerminal = function(options: any) {
    const terminal = originalCreateTerminal.call(vscode.window, options) as VSCodeTerminal;
    
    // Create write emulator for this terminal
    const writeEmulator = new vscode.EventEmitter<string>();
    terminalWriteEmulators.set(terminal, writeEmulator);

    // Find terminal ID from name
    const match = options.name?.match(/FlowX Terminal ([\w-]+)/);
    if (match) {
      const terminalId = match[1];
      activeTerminals.set(terminalId, terminal);
      
      // Set up output capture
      captureTerminalOutput(terminal, terminalId);
    }

    return terminal;
  };

  // Clean up on terminal close
  if (vscode.window.onDidCloseTerminal) {
    const disposable = vscode.window.onDidCloseTerminal((terminal: VSCodeTerminal) => {
      // Find and remove from registries
      for (const [id, term] of activeTerminals.entries()) {
        if (term === terminal) {
          activeTerminals.delete(id);
          terminalOutputProcessors.delete(id);
          break;
        }
      }
      
      // Clean up write emulator
      const emulator = terminalWriteEmulators.get(terminal);
      if (emulator) {
        emulator.dispose();
        terminalWriteEmulators.delete(terminal);
      }
    });
    
    context.subscriptions.push(disposable);
  }
}

/**
 * Capture terminal output using various methods
 */
function captureTerminalOutput(terminal: VSCodeTerminal, terminalId: string): void {
  // Method 1: Use terminal.sendText override to capture commands
  const originalSendText = terminal.sendText;
  (terminal as any).sendText = function(text: string, addNewLine?: boolean) {
    // Call original method
    originalSendText.call(terminal, text, addNewLine);
    
    // Process command
    const processor = terminalOutputProcessors.get(terminalId);
    if (processor && text) {
      // Simulate command echo
      processor(text + (addNewLine !== false ? '\n' : ''));
    }
  };

  // Method 2: Use proposed API if available
  if ('onDidWriteData' in terminal) {
    const writeDataEvent = (terminal as any).onDidWriteData;
    if (writeDataEvent) {
      writeDataEvent((data: string) => {
        const processor = terminalOutputProcessors.get(terminalId);
        if (processor) {
          processor(data);
        }
      });
    }
  }

  // Method 3: Use terminal renderer if available
  setupTerminalRenderer(terminal, terminalId);
}

/**
 * Set up terminal renderer for output capture
 */
function setupTerminalRenderer(terminal: VSCodeTerminal, terminalId: string): void {
  if (!vscode) return;

  // Check if terminal renderer API is available
  if (vscode.window.registerTerminalProfileProvider) {
    // This is a more advanced method that requires additional setup
    // It would involve creating a custom terminal profile that captures output
    
    // For now, we'll use a simpler approach with periodic output checking
    const lastOutput = '';
    const checkOutput = setInterval(() => {
      // This is a placeholder - actual implementation would depend on
      // available VSCode APIs for reading terminal content
      
      // Check if terminal is still active
      if (!activeTerminals.has(terminalId)) {
        clearInterval(checkOutput);
      }
    }, 100);
  }
}

/**
 * Create a terminal with output capture
 */
export async function createCapturedTerminal(
  name: string,
  shellPath?: string,
  shellArgs?: string[]
): Promise<{
  terminal: VSCodeTerminal;
  onData: (listener: (e: string) => void) => any;
} | null> {
  if (!vscode) {
    console.warn('VSCode API not available');
    return null;
  }

  const writeEmulator = new vscode.EventEmitter<string>();
  
  const terminal = vscode.window.createTerminal({
    name,
    shellPath,
    shellArgs,
  });

  terminalWriteEmulators.set(terminal, writeEmulator);

  return {
    terminal,
    onData: writeEmulator.event,
  };
}

/**
 * Send command to terminal and capture output
 */
export async function executeTerminalCommand(
  terminal: VSCodeTerminal,
  command: string,
  timeout: number = 30000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writeEmulator = terminalWriteEmulators.get(terminal);
    if (!writeEmulator) {
      reject(new Error('Terminal not found or not configured for output capture'));
      return;
    }

    let output = '';
    const timeoutId = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    const disposable = writeEmulator.event((data: string) => {
      output += data;
      
      // Simple command completion detection
      if (data.includes('$') || data.includes('>')) {
        clearTimeout(timeoutId);
        disposable.dispose();
        resolve(output);
      }
    });

    // Send the command
    terminal.sendText(command);
  });
}

/**
 * Get terminal by ID
 */
export function getTerminalById(terminalId: string): VSCodeTerminal | undefined {
  return activeTerminals.get(terminalId);
}

/**
 * Dispose terminal bridge resources
 */
export function disposeTerminalBridge(): void {
  // Clean up all emulators
  for (const emulator of terminalWriteEmulators.values()) {
    emulator.dispose();
  }
  
  terminalWriteEmulators.clear();
  activeTerminals.clear();
  terminalOutputProcessors.clear();
}