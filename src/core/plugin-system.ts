/**
 * Plugin System
 * Provides dynamic loading, extension points, and plugin lifecycle management
 */

import { EventEmitter } from 'node:events';
import { Container } from './container.js';
import { ILogger } from './logger.js';

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  dependencies?: string[];
  peerDependencies?: string[];
  engines?: {
    node?: string;
    'flowx'?: string;
  };
  keywords?: string[];
  category?: string;
}

export interface PluginManifest extends PluginMetadata {
  main: string;
  exports?: Record<string, string>;
  hooks?: string[];
  commands?: string[];
  permissions?: string[];
}

export interface Plugin {
  metadata: PluginMetadata;
  activate(context: PluginContext): Promise<void> | void;
  deactivate?(context: PluginContext): Promise<void> | void;
  onError?(error: Error, context: PluginContext): Promise<void> | void;
}

export interface PluginContext {
  container: Container;
  logger: ILogger;
  hooks: HookRegistry;
  commands: CommandRegistry;
  subscriptions: DisposableStore;
  workspaceState: WorkspaceState;
  globalState: GlobalState;
}

export interface Hook {
  name: string;
  handler: (...args: any[]) => any;
  priority?: number;
  once?: boolean;
}

export interface Command {
  name: string;
  handler: (...args: any[]) => any;
  description?: string | undefined;
  usage?: string | undefined;
}

export interface Disposable {
  dispose(): void;
}

export class DisposableStore {
  private disposables: Disposable[] = [];

  add(disposable: Disposable): void {
    this.disposables.push(disposable);
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    }
    this.disposables = [];
  }
}

export class HookRegistry {
  private hooks = new Map<string, Hook[]>();

  register(name: string, handler: (...args: any[]) => any, options: { priority?: number; once?: boolean } = {}): Disposable {
    const hook: Hook = {
      name,
      handler,
      priority: options.priority || 0,
      once: options.once || false
    };

    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }

    const hooks = this.hooks.get(name)!;
    hooks.push(hook);
    hooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return {
      dispose: () => {
        const index = hooks.indexOf(hook);
        if (index >= 0) {
          hooks.splice(index, 1);
        }
      }
    };
  }

  async execute(name: string, ...args: any[]): Promise<any[]> {
    const hooks = this.hooks.get(name) || [];
    const results: any[] = [];
    const toRemove: Hook[] = [];

    for (const hook of hooks) {
      try {
        const result = await hook.handler(...args);
        results.push(result);

        if (hook.once) {
          toRemove.push(hook);
        }
      } catch (error) {
        console.error(`Error executing hook ${name}:`, error);
        results.push(undefined);
      }
    }

    // Remove one-time hooks
    for (const hook of toRemove) {
      const hooks = this.hooks.get(name)!;
      const index = hooks.indexOf(hook);
      if (index >= 0) {
        hooks.splice(index, 1);
      }
    }

    return results;
  }

  getHooks(name: string): Hook[] {
    return [...(this.hooks.get(name) || [])];
  }

  clear(name?: string): void {
    if (name) {
      this.hooks.delete(name);
    } else {
      this.hooks.clear();
    }
  }
}

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(name: string, handler: (...args: any[]) => any, options: { description?: string; usage?: string } = {}): Disposable {
    if (this.commands.has(name)) {
      throw new Error(`Command already registered: ${name}`);
    }

    const command: Command = {
      name,
      handler,
      description: options.description,
      usage: options.usage
    };

    this.commands.set(name, command);

    return {
      dispose: () => {
        this.commands.delete(name);
      }
    };
  }

  async execute(name: string, ...args: any[]): Promise<any> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`Command not found: ${name}`);
    }

    return await command.handler(...args);
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  clear(): void {
    this.commands.clear();
  }
}

export class WorkspaceState {
  private state = new Map<string, any>();

  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.state.get(key) ?? defaultValue;
  }

  set(key: string, value: any): void {
    this.state.set(key, value);
  }

  delete(key: string): boolean {
    return this.state.delete(key);
  }

  clear(): void {
    this.state.clear();
  }

  keys(): string[] {
    return Array.from(this.state.keys());
  }
}

export class GlobalState extends WorkspaceState {
  // Global state persists across workspace sessions
  // Could be backed by a file or database
}

export interface PluginLoadResult {
  plugin: Plugin;
  context: PluginContext;
  error?: Error;
}

export class PluginManager extends EventEmitter {
  private plugins = new Map<string, PluginLoadResult>();
  private hooks = new HookRegistry();
  private commands = new CommandRegistry();
  private globalState = new GlobalState();

  constructor(
    private container: Container,
    private logger: ILogger
  ) {
    super();
  }

  async loadPlugin(manifest: PluginManifest, pluginPath: string): Promise<void> {
    try {
      this.logger.info(`Loading plugin: ${manifest.name}@${manifest.version}`);

      // Validate dependencies
      await this.validateDependencies(manifest);

      // Create plugin context
      const workspaceState = new WorkspaceState();
      const subscriptions = new DisposableStore();
      
      const context: PluginContext = {
        container: this.container,
        logger: this.logger,
        hooks: this.hooks,
        commands: this.commands,
        subscriptions,
        workspaceState,
        globalState: this.globalState
      };

      // Load plugin module
      const pluginModule = await import(pluginPath);
      const plugin: Plugin = pluginModule.default || pluginModule;

      // Validate plugin interface
      if (!plugin || typeof plugin.activate !== 'function') {
        throw new Error('Plugin must export an object with an activate function');
      }

      // Store plugin
      const result: PluginLoadResult = { plugin, context };
      this.plugins.set(manifest.name, result);

      // Activate plugin
      await plugin.activate(context);

      this.logger.info(`Plugin loaded successfully: ${manifest.name}`);
      this.emit('pluginLoaded', { name: manifest.name, manifest });

    } catch (error) {
      this.logger.error(`Failed to load plugin ${manifest.name}:`, error);
      
      // Store error result
      const result: PluginLoadResult = { 
        plugin: null as any, 
        context: null as any, 
        error: error instanceof Error ? error : new Error(String(error))
      };
      this.plugins.set(manifest.name, result);
      
      this.emit('pluginError', { name: manifest.name, error });
      throw error;
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const result = this.plugins.get(name);
    if (!result) {
      throw new Error(`Plugin not loaded: ${name}`);
    }

    if (result.error) {
      this.plugins.delete(name);
      return;
    }

    try {
      this.logger.info(`Unloading plugin: ${name}`);

      // Deactivate plugin
      if (result.plugin.deactivate) {
        await result.plugin.deactivate(result.context);
      }

      // Dispose subscriptions
      result.context.subscriptions.dispose();

      // Clear workspace state
      result.context.workspaceState.clear();

      this.plugins.delete(name);
      this.logger.info(`Plugin unloaded: ${name}`);
      this.emit('pluginUnloaded', { name });

    } catch (error) {
      this.logger.error(`Error unloading plugin ${name}:`, error);
      
      // Handle plugin error
      if (result.plugin.onError) {
        try {
          await result.plugin.onError(error instanceof Error ? error : new Error(String(error)), result.context);
        } catch (handlerError) {
          this.logger.error(`Plugin error handler failed for ${name}:`, handlerError);
        }
      }

      throw error;
    }
  }

  async reloadPlugin(name: string, manifest: PluginManifest, pluginPath: string): Promise<void> {
    if (this.plugins.has(name)) {
      await this.unloadPlugin(name);
    }
    await this.loadPlugin(manifest, pluginPath);
  }

  getPlugin(name: string): PluginLoadResult | undefined {
    return this.plugins.get(name);
  }

  getLoadedPlugins(): string[] {
    return Array.from(this.plugins.keys()).filter(name => !this.plugins.get(name)?.error);
  }

  getFailedPlugins(): Array<{ name: string; error: Error }> {
    return Array.from(this.plugins.entries())
      .filter(([, result]) => result.error)
      .map(([name, result]) => ({ name, error: result.error! }));
  }

  getHooks(): HookRegistry {
    return this.hooks;
  }

  getCommands(): CommandRegistry {
    return this.commands;
  }

  async dispose(): Promise<void> {
    const pluginNames = Array.from(this.plugins.keys());
    
    for (const name of pluginNames) {
      try {
        await this.unloadPlugin(name);
      } catch (error) {
        this.logger.error(`Error disposing plugin ${name}:`, error);
      }
    }

    this.hooks.clear();
    this.commands.clear();
    this.globalState.clear();
  }

  private async validateDependencies(manifest: PluginManifest): Promise<void> {
    // Validate peer dependencies
    if (manifest.peerDependencies) {
      for (const [dep, version] of Object.entries(manifest.peerDependencies)) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Missing peer dependency: ${dep}@${version}`);
        }
      }
    }

    // Validate engine requirements
    if (manifest.engines) {
      const nodeVersion = process.version;
      if (manifest.engines.node && !this.satisfiesVersion(nodeVersion, manifest.engines.node)) {
        throw new Error(`Node.ts version ${nodeVersion} does not satisfy requirement: ${manifest.engines.node}`);
      }
    }
  }

  private satisfiesVersion(actual: string, required: string): boolean {
    // Simple version check - in production, use semver library
    return true; // Simplified for now
  }
} 