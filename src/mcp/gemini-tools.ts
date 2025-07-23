/**
 * Gemini MCP Tool Integration
 * Provides Gemini CLI integration with Claude Flow
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ILogger } from '../core/logger.js';
import { EventBus } from '../core/event-bus.js';

/**
 * Context for Gemini tool execution
 */
export interface GeminiToolContext {
  logger: ILogger;
  eventBus: EventBus;
  basePath?: string;
  enableMetrics?: boolean;
  modelOverride?: string;
}

/**
 * Gemini execution options
 */
export interface GeminiOptions {
  model?: string;
  prompt?: string;
  sandbox?: boolean;
  debug?: boolean;
  allFiles?: boolean;
  yolo?: boolean;
  checkpointing?: boolean;
}

/**
 * Create Gemini MCP tools
 */
export function createGeminiTools(context: GeminiToolContext) {
  const { logger, eventBus, basePath = process.cwd(), enableMetrics = true, modelOverride } = context;

  /**
   * Execute a Gemini CLI command
   */
  async function executeGemini(options: GeminiOptions): Promise<string> {
    const { model = modelOverride || 'gemini-2.5-pro', prompt, sandbox, debug, allFiles, yolo, checkpointing } = options;
    
    const args = [
      '--model', model
    ];
    
    if (prompt) args.push('--prompt', prompt);
    if (sandbox) args.push('--sandbox');
    if (debug) args.push('--debug');
    if (allFiles) args.push('--all-files');
    if (yolo) args.push('--yolo');
    if (checkpointing) args.push('--checkpointing');
    
    logger.debug(`Executing Gemini CLI with args: ${args.join(' ')}`);
    
    return new Promise((resolve, reject) => {
      const geminiProcess = spawn('gemini', args, { cwd: basePath });
      let stdout = '';
      let stderr = '';
      
      geminiProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      geminiProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      geminiProcess.on('close', (code) => {
        if (code === 0) {
          if (enableMetrics) {
            eventBus.emit('gemini:execution:completed', { 
              success: true, 
              model, 
              executionTime: Date.now()
            });
          }
          resolve(stdout);
        } else {
          logger.error(`Gemini execution failed with code ${code}: ${stderr}`);
          if (enableMetrics) {
            eventBus.emit('gemini:execution:failed', { 
              error: stderr, 
              model, 
              executionTime: Date.now()
            });
          }
          reject(new Error(`Gemini execution failed: ${stderr}`));
        }
      });
      
      if (prompt) {
        geminiProcess.stdin.write(prompt);
        geminiProcess.stdin.end();
      }
    });
  }

  /**
   * Check if Gemini is available in the system
   */
  async function checkGeminiAvailability(): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        const check = spawn('which', ['gemini']);
        check.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error('Gemini CLI not found'));
          }
        });
      });
      return true;
    } catch (error) {
      logger.warn('Gemini CLI not available on system');
      return false;
    }
  }

  /**
   * Get Gemini version information
   */
  async function getGeminiVersion(): Promise<string> {
    try {
      return new Promise((resolve, reject) => {
        const versionProcess = spawn('gemini', ['--version']);
        let stdout = '';
        
        versionProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        versionProcess.on('close', (code) => {
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error('Failed to get Gemini version'));
          }
        });
      });
    } catch (error) {
      logger.error('Failed to get Gemini version', error);
      return 'unknown';
    }
  }

  /**
   * List available Gemini models
   */
  async function listAvailableModels(): Promise<string[]> {
    // This is a simplified approach; in reality we'd parse the models from Gemini
    return ['gemini-2.5-pro', 'gemini-2.5-flash'];
  }

  return {
    /**
     * Execute a prompt with Gemini
     */
    'mcp__gemini__execute': async ({ prompt, model, sandbox = false, debug = false, allFiles = false, yolo = false }: {
      prompt: string;
      model?: string;
      sandbox?: boolean;
      debug?: boolean;
      allFiles?: boolean;
      yolo?: boolean;
    }) => {
      const isAvailable = await checkGeminiAvailability();
      if (!isAvailable) {
        throw new Error('Gemini CLI is not available on this system');
      }

      const result = await executeGemini({
        prompt,
        model,
        sandbox,
        debug,
        allFiles,
        yolo
      });

      return {
        result,
        model: model || modelOverride || 'gemini-2.5-pro'
      };
    },

    /**
     * Process file with Gemini
     */
    'mcp__gemini__process_file': async ({ filePath, prompt, model }: {
      filePath: string;
      prompt: string;
      model?: string;
    }) => {
      const isAvailable = await checkGeminiAvailability();
      if (!isAvailable) {
        throw new Error('Gemini CLI is not available on this system');
      }

      const resolvedPath = path.resolve(basePath, filePath);
      try {
        const fileContent = await fs.readFile(resolvedPath, 'utf-8');
        const result = await executeGemini({
          prompt: `${prompt}\n\nFile content:\n${fileContent}`,
          model,
          allFiles: false
        });

        return {
          result,
          filePath: resolvedPath,
          model: model || modelOverride || 'gemini-2.5-pro'
        };
      } catch (error) {
        logger.error(`Failed to process file ${resolvedPath}`, error);
        throw new Error(`Failed to process file: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    /**
     * Get Gemini information
     */
    'mcp__gemini__info': async () => {
      const isAvailable = await checkGeminiAvailability();
      if (!isAvailable) {
        return {
          available: false,
          version: 'N/A',
          models: []
        };
      }

      const version = await getGeminiVersion();
      const models = await listAvailableModels();

      return {
        available: true,
        version,
        models
      };
    },

    /**
     * Compare models for a specific task
     */
    'mcp__gemini__compare_with_claude': async ({ prompt, claudeModel = 'claude-3-5-sonnet', geminiModel = 'gemini-2.5-pro' }: {
      prompt: string;
      claudeModel?: string;
      geminiModel?: string;
    }) => {
      const isAvailable = await checkGeminiAvailability();
      if (!isAvailable) {
        throw new Error('Gemini CLI is not available on this system');
      }

      // Trigger a Claude execution
      eventBus.emit('claude:execution:request', {
        prompt,
        model: claudeModel
      });

      // Execute with Gemini
      const geminiResult = await executeGemini({
        prompt,
        model: geminiModel
      });

      return {
        geminiResult,
        geminiModel,
        claudeModel,
        // Claude result would be handled asynchronously through events
        comparisonId: `compare_${Date.now()}`
      };
    },
  };
}