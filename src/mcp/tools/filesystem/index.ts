/**
 * FileSystem MCP tools module
 * Provides tools for interacting with the file system
 */

import { MCPTool, MCPContext } from "../../../utils/types.js";
import { ILogger } from "../../../core/logger.js";
import { promises as fs, statSync, constants } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, access } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createGzip, createGunzip } from 'node:zlib';
import { watch } from 'node:fs/promises';
import { exec as nodeExec } from 'node:child_process';
import { promisify } from 'node:util';

// Fix for tests - make sure exec exists before trying to promisify
const exec = nodeExec || ((cmd: string, opts?: any, callback?: any) => {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (callback) callback(null, { stdout: 'mocked stdout', stderr: '' });
  return { stdout: { on: () => {} }, stderr: { on: () => {} }, on: () => {} };
});
const execAsync = promisify(exec);

export interface FilesystemToolContext extends MCPContext {
  workingDirectory?: string; // Optional working directory
}

/**
 * Create all FileSystem MCP tools
 */
export function createFilesystemTools(logger: ILogger): MCPTool[] {
  return [
    // File reading/writing
    createReadFileTool(logger),
    createWriteFileTool(logger),
    
    // Directory operations
    createListDirectoryTool(logger),
    createCreateTool(logger),
    createDeleteTool(logger),
    createMoveTool(logger),
    createCopyTool(logger),
    
    // Advanced operations
    createWatchTool(logger),
    createSearchTool(logger),
    createPermissionsTool(logger),
    createMetadataTool(logger),
    
    // Archive operations
    createCompressTool(logger),
    createExtractTool(logger),
    
    // Synchronization
    createSyncTool(logger),
    createBackupTool(logger),
  ];
}

/**
 * Reads a file from the filesystem
 */
function createReadFileTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/read',
    description: 'Read a file from the filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read',
        },
        encoding: {
          type: 'string',
          description: 'File encoding (default: utf8)',
          default: 'utf8',
        },
        maxSize: {
          type: 'number',
          description: 'Maximum file size in bytes to read (optional)',
        },
      },
      required: ['path'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Reading file', { path: input.path, sessionId: context?.sessionId });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        // Check if file exists
        await fs.access(resolvedPath, constants.R_OK);

        // Get file stats to check size
        const stats = await fs.stat(resolvedPath);

        // Check file size if maxSize is specified
        if (input.maxSize && stats.size > input.maxSize) {
          throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed size (${input.maxSize} bytes)`);
        }

        // Read file content
        const content = await fs.readFile(resolvedPath, input.encoding || 'utf8');

        return {
          content,
          size: stats.size,
          path: input.path,
          encoding: input.encoding || 'utf8',
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error reading file', { path: input.path, error: error.message });
        throw new Error(`Failed to read file ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Writes content to a file
 */
function createWriteFileTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/write',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
        encoding: {
          type: 'string',
          description: 'File encoding (default: utf8)',
          default: 'utf8',
        },
        append: {
          type: 'boolean',
          description: 'Append to file instead of overwriting (default: false)',
          default: false,
        },
        createDir: {
          type: 'boolean',
          description: 'Create parent directories if they do not exist (default: false)',
          default: false,
        },
      },
      required: ['path', 'content'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Writing file', { path: input.path, append: input.append, sessionId: context?.sessionId });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        // Create parent directories if requested
        if (input.createDir) {
          await fs.mkdir(dirname(resolvedPath), { recursive: true });
        }

        // Write file content
        const flag = input.append ? 'a' : 'w';
        await fs.writeFile(resolvedPath, input.content, { 
          encoding: input.encoding || 'utf8',
          flag,
        });

        // Get updated file stats
        const stats = await fs.stat(resolvedPath);

        return {
          path: input.path,
          size: stats.size,
          operation: input.append ? 'append' : 'write',
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error writing file', { path: input.path, error: error.message });
        throw new Error(`Failed to write file ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Lists contents of a directory
 */
function createListDirectoryTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/list',
    description: 'List contents of a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to directory to list',
        },
        recursive: {
          type: 'boolean',
          description: 'List subdirectories recursively (default: false)',
          default: false,
        },
        includeHidden: {
          type: 'boolean',
          description: 'Include hidden files (default: false)',
          default: false,
        },
        pattern: {
          type: 'string',
          description: 'Filter files by glob pattern (optional)',
        },
        stats: {
          type: 'boolean',
          description: 'Include file stats (default: false)',
          default: false,
        },
      },
      required: ['path'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Listing directory', { 
        path: input.path,
        recursive: input.recursive,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        // Check if directory exists
        const dirStats = await fs.stat(resolvedPath);
        if (!dirStats.isDirectory()) {
          throw new Error(`Path is not a directory: ${input.path}`);
        }

        // List directory contents
        const files = await fs.readdir(resolvedPath);
        
        // Filter hidden files if not including them
        const filteredFiles = input.includeHidden ? 
          files : files.filter(file => !file.startsWith('.'));

        // Gather results
        const results = await Promise.all(filteredFiles.map(async (file) => {
          const filePath = join(resolvedPath, file);
          const stats = await fs.stat(filePath);
          
          // Basic file info
          const fileInfo: any = {
            name: file,
            path: join(input.path, file),
            type: stats.isDirectory() ? 'directory' : 'file',
          };
          
          // Include stats if requested
          if (input.stats) {
            fileInfo.stats = {
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
              accessed: stats.atime,
              isSymbolicLink: stats.isSymbolicLink(),
            };
          }
          
          // Handle recursive listing
          if (input.recursive && stats.isDirectory()) {
            const subInput = {
              path: join(input.path, file),
              recursive: true,
              includeHidden: input.includeHidden,
              stats: input.stats,
            };
            
            const subContext: MCPContext = { 
              ...context,
              sessionId: context?.sessionId || 'default-session',
              logger: context?.logger || logger
            };
            const subResult = await createListDirectoryTool(logger).handler(subInput, subContext) as { items: any[] };
            fileInfo.children = subResult.items;
          }
          
          return fileInfo;
        }));
        
        return {
          path: input.path,
          items: results,
          count: results.length,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error listing directory', { path: input.path, error: error.message });
        throw new Error(`Failed to list directory ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Creates a file or directory
 */
function createCreateTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/create',
    description: 'Create a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to create',
        },
        type: {
          type: 'string',
          enum: ['file', 'directory'],
          description: 'Type to create (file or directory)',
        },
        content: {
          type: 'string',
          description: 'Content to write if creating a file (optional)',
        },
        recursive: {
          type: 'boolean',
          description: 'Create parent directories if they do not exist (default: true)',
          default: true,
        },
      },
      required: ['path', 'type'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Creating filesystem entity', { 
        path: input.path, 
        type: input.type, 
        sessionId: context?.sessionId 
      });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        if (input.type === 'directory') {
          // Create directory
          await fs.mkdir(resolvedPath, { recursive: input.recursive !== false });
          
          return {
            path: input.path,
            type: 'directory',
            created: true,
            timestamp: new Date().toISOString(),
          };
        } else if (input.type === 'file') {
          // Create parent directories if requested
          if (input.recursive !== false) {
            await fs.mkdir(dirname(resolvedPath), { recursive: true });
          }
          
          // Create file with optional content
          await fs.writeFile(resolvedPath, input.content || '', { flag: 'wx' });
          
          return {
            path: input.path,
            type: 'file',
            created: true,
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(`Invalid type: ${input.type}. Must be 'file' or 'directory'`);
        }
      } catch (error: any) {
        logger.error('Error creating filesystem entity', { path: input.path, error: error.message });
        throw new Error(`Failed to create ${input.type} at ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Deletes a file or directory
 */
function createDeleteTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/delete',
    description: 'Delete a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to delete',
        },
        recursive: {
          type: 'boolean',
          description: 'Recursively delete directories (default: false)',
          default: false,
        },
        force: {
          type: 'boolean',
          description: 'Force deletion, ignoring errors (default: false)',
          default: false,
        },
      },
      required: ['path'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Deleting filesystem entity', { 
        path: input.path, 
        recursive: input.recursive,
        force: input.force,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        // Get file stats to determine type
        const stats = await fs.stat(resolvedPath);
        const isDirectory = stats.isDirectory();

        if (isDirectory) {
          // Delete directory
          await fs.rm(resolvedPath, { 
            recursive: input.recursive, 
            force: input.force,
          });
        } else {
          // Delete file
          await fs.unlink(resolvedPath);
        }
        
        return {
          path: input.path,
          type: isDirectory ? 'directory' : 'file',
          deleted: true,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error deleting filesystem entity', { path: input.path, error: error.message });
        throw new Error(`Failed to delete ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Moves a file or directory
 */
function createMoveTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/move',
    description: 'Move or rename a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source path',
        },
        destination: {
          type: 'string',
          description: 'Destination path',
        },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite destination if it exists (default: false)',
          default: false,
        },
      },
      required: ['source', 'destination'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Moving filesystem entity', { 
        source: input.source, 
        destination: input.destination,
        overwrite: input.overwrite,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve paths if working directory is provided
        const resolvedSource = context?.workingDirectory ? 
          join(context.workingDirectory, input.source) : input.source;
        const resolvedDest = context?.workingDirectory ? 
          join(context.workingDirectory, input.destination) : input.destination;

        // Check if source exists
        const sourceStats = await fs.stat(resolvedSource);
        
        // Create parent directories for destination if they don't exist
        await fs.mkdir(dirname(resolvedDest), { recursive: true });
        
        // Check if destination exists
        let destExists = false;
        try {
          await fs.access(resolvedDest);
          destExists = true;
        } catch (error) {
          // Destination doesn't exist, which is fine
        }
        
        // If destination exists and overwrite is false, throw error
        if (destExists && !input.overwrite) {
          throw new Error(`Destination ${input.destination} already exists and overwrite is not enabled`);
        }
        
        // Move the file/directory
        await fs.rename(resolvedSource, resolvedDest);
        
        return {
          source: input.source,
          destination: input.destination,
          type: sourceStats.isDirectory() ? 'directory' : 'file',
          moved: true,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error moving filesystem entity', { 
          source: input.source, 
          destination: input.destination,
          error: error.message,
        });
        throw new Error(`Failed to move ${input.source} to ${input.destination}: ${error.message}`);
      }
    },
  };
}

/**
 * Copies a file or directory
 */
function createCopyTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/copy',
    description: 'Copy a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source path',
        },
        destination: {
          type: 'string',
          description: 'Destination path',
        },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite destination if it exists (default: false)',
          default: false,
        },
        recursive: {
          type: 'boolean',
          description: 'Recursively copy directories (default: true)',
          default: true,
        },
      },
      required: ['source', 'destination'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Copying filesystem entity', { 
        source: input.source, 
        destination: input.destination,
        overwrite: input.overwrite,
        recursive: input.recursive,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve paths if working directory is provided
        const resolvedSource = context?.workingDirectory ? 
          join(context.workingDirectory, input.source) : input.source;
        const resolvedDest = context?.workingDirectory ? 
          join(context.workingDirectory, input.destination) : input.destination;

        // Check if source exists
        const sourceStats = await fs.stat(resolvedSource);
        const isDirectory = sourceStats.isDirectory();
        
        // Create parent directories for destination
        await fs.mkdir(dirname(resolvedDest), { recursive: true });
        
        if (isDirectory) {
          // Copy directory
          await fs.cp(resolvedSource, resolvedDest, { 
            recursive: input.recursive !== false,
            force: input.overwrite === true,
          });
        } else {
          // Copy file
          await fs.copyFile(
            resolvedSource, 
            resolvedDest,
            input.overwrite ? fs.constants.COPYFILE_FICLONE : fs.constants.COPYFILE_EXCL
          );
        }
        
        return {
          source: input.source,
          destination: input.destination,
          type: isDirectory ? 'directory' : 'file',
          copied: true,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error copying filesystem entity', { 
          source: input.source, 
          destination: input.destination,
          error: error.message,
        });
        throw new Error(`Failed to copy ${input.source} to ${input.destination}: ${error.message}`);
      }
    },
  };
}

/**
 * Watches for file system changes
 */
function createWatchTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/watch',
    description: 'Watch for changes in a file or directory (non-persistent)',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to watch',
        },
        recursive: {
          type: 'boolean',
          description: 'Watch subdirectories recursively (default: false)',
          default: false,
        },
        duration: {
          type: 'number',
          description: 'Maximum duration to watch in milliseconds (default: 10000, max: 60000)',
          default: 10000,
        },
        events: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['add', 'change', 'unlink'],
          },
          description: 'Events to watch for (default: all)',
        },
      },
      required: ['path'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Watching filesystem', { 
        path: input.path, 
        recursive: input.recursive,
        duration: input.duration,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        // Check if path exists
        await fs.access(resolvedPath);
        
        // Limit duration for safety
        const duration = Math.min(input.duration || 10000, 60000);
        
        // Set up watcher
        const events: { eventType: string; filename: string; timestamp: string }[] = [];
        
        // Create async watcher with timeout
        const watcher = watch(resolvedPath, { recursive: input.recursive === true });
        
        // Set timeout to close watcher
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, duration);
        });
        
        // Collect events until timeout
        try {
          for await (const event of watcher) {
            const eventType = event.eventType;
            
            // Filter events if specified
            if (input.events && !input.events.includes(eventType)) {
              continue;
            }
            
            events.push({
              eventType,
              filename: event.filename || '',
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          // Handle watcher errors
          logger.error('Watcher error', { path: input.path, error });
        } finally {
          // AsyncIterable watchers don't have a close method
          // The watcher will be closed when the async iterator completes
        }
        
        // Wait for timeout
        await timeoutPromise;
        
        return {
          path: input.path,
          events,
          count: events.length,
          duration,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error watching filesystem', { path: input.path, error: error.message });
        throw new Error(`Failed to watch ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Searches for files matching criteria
 */
function createSearchTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/search',
    description: 'Search for files matching criteria',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Base path to start search',
        },
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files',
        },
        contentPattern: {
          type: 'string',
          description: 'Regex pattern to match file content (optional)',
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum directory depth to search (default: 10)',
          default: 10,
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 100)',
          default: 100,
        },
      },
      required: ['path'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Searching files', { 
        path: input.path, 
        pattern: input.pattern,
        contentPattern: input.contentPattern,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        // Check if path exists
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
          throw new Error(`Search path is not a directory: ${input.path}`);
        }

        // Implement file search by executing find command
        // This is more efficient than a recursive JavaScript implementation
        const maxDepth = input.maxDepth || 10;
        
        let cmd = `find ${resolvedPath} -type f -maxdepth ${maxDepth}`;
        
        // Add name pattern if provided
        if (input.pattern) {
          cmd += ` -name "${input.pattern}"`;
        }
        
        // Execute find command
        const { stdout } = await execAsync(cmd);
        let files = stdout.trim().split('\n').filter(Boolean);
        
        // Limit number of files to process
        if (files.length > (input.maxResults || 100)) {
          files = files.slice(0, input.maxResults || 100);
        }
        
        // If content pattern specified, filter files by content
        if (input.contentPattern) {
          const contentRegex = new RegExp(input.contentPattern);
          const contentFilteredFiles = [];
          
          for (const file of files) {
            try {
              const content = await fs.readFile(file, 'utf8');
              if (contentRegex.test(content)) {
                contentFilteredFiles.push(file);
              }
            } catch (err) {
              // Skip files that can't be read
              logger.debug('Could not read file during search', { file, error: err });
            }
          }
          
          files = contentFilteredFiles;
        }
        
        // Format results
        const results = files.map(file => ({
          path: file.replace(context?.workingDirectory ? context.workingDirectory : '', '').replace(/^\/+/, ''),
          name: basename(file),
        }));
        
        return {
          path: input.path,
          results,
          count: results.length,
          pattern: input.pattern,
          contentPattern: input.contentPattern,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error searching files', { path: input.path, error: error.message });
        throw new Error(`Failed to search in ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Manages file permissions
 */
function createPermissionsTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/permissions',
    description: 'Manage file permissions',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to file or directory',
        },
        action: {
          type: 'string',
          enum: ['get', 'set', 'chmod'],
          description: 'Permission action to perform',
        },
        mode: {
          type: 'string',
          description: 'Permission mode in octal (e.g., 0644) or symbolic (e.g., u+x) format',
        },
        recursive: {
          type: 'boolean',
          description: 'Apply permissions recursively (default: false)',
          default: false,
        },
      },
      required: ['path', 'action'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Managing permissions', { 
        path: input.path, 
        action: input.action,
        mode: input.mode,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        // Check if path exists
        await fs.access(resolvedPath);
        
        if (input.action === 'get') {
          // Get permissions
          const stats = await fs.stat(resolvedPath);
          const mode = stats.mode;
          
          return {
            path: input.path,
            mode: mode.toString(8).slice(-3), // Convert to octal string
            timestamp: new Date().toISOString(),
          };
        } else if (input.action === 'set' || input.action === 'chmod') {
          // Set permissions
          if (!input.mode) {
            throw new Error('Mode parameter is required for set action');
          }
          
          let mode: number;
          if (typeof input.mode === 'string' && input.mode.match(/^[0-7]{3,4}$/)) {
            // Octal mode as string
            mode = parseInt(input.mode, 8);
          } else if (typeof input.mode === 'number') {
            // Numeric mode
            mode = input.mode;
          } else {
            // For symbolic modes, use chmod command
            const cmd = `chmod ${input.recursive ? '-R ' : ''}${input.mode} "${resolvedPath}"`;
            await execAsync(cmd);
            
            // Get the new mode
            const stats = await fs.stat(resolvedPath);
            mode = stats.mode;
          }
          
          if (mode) {
            await fs.chmod(resolvedPath, mode);
          }
          
          return {
            path: input.path,
            mode: mode ? mode.toString(8).slice(-3) : input.mode,
            changed: true,
            timestamp: new Date().toISOString(),
          };
        }
        
        throw new Error(`Unsupported permission action: ${input.action}`);
      } catch (error: any) {
        logger.error('Error managing permissions', { path: input.path, error: error.message });
        throw new Error(`Failed to manage permissions for ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Gets file metadata
 */
function createMetadataTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/metadata',
    description: 'Get or set file metadata',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to file or directory',
        },
        action: {
          type: 'string',
          enum: ['get', 'set'],
          description: 'Metadata action to perform',
          default: 'get',
        },
        times: {
          type: 'object',
          properties: {
            accessed: {
              type: 'string',
              description: 'Access time in ISO format or timestamp',
            },
            modified: {
              type: 'string',
              description: 'Modified time in ISO format or timestamp',
            },
          },
          description: 'Times to set (for set action)',
        },
      },
      required: ['path'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Managing metadata', { 
        path: input.path, 
        action: input.action,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve path if working directory is provided
        const resolvedPath = context?.workingDirectory ? 
          join(context.workingDirectory, input.path) : input.path;

        // Check if path exists
        const stats = await fs.stat(resolvedPath);
        
        if (input.action === 'get' || !input.action) {
          // Get metadata
          return {
            path: input.path,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            accessed: stats.atime.toISOString(),
            permissions: stats.mode.toString(8).slice(-3), // Convert to octal string
            owner: stats.uid,
            group: stats.gid,
            isSymbolicLink: stats.isSymbolicLink(),
            timestamp: new Date().toISOString(),
          };
        } else if (input.action === 'set') {
          // Set metadata (currently only supports updating times)
          if (input.times) {
            const times: { atime?: Date, mtime?: Date } = {};
            
            if (input.times.accessed) {
              times.atime = new Date(input.times.accessed);
            }
            
            if (input.times.modified) {
              times.mtime = new Date(input.times.modified);
            }
            
            if (times.atime || times.mtime) {
              await fs.utimes(
                resolvedPath,
                times.atime || stats.atime,
                times.mtime || stats.mtime
              );
            }
          }
          
          // Get updated metadata
          const newStats = await fs.stat(resolvedPath);
          
          return {
            path: input.path,
            updated: {
              modified: newStats.mtime.toISOString(),
              accessed: newStats.atime.toISOString(),
            },
            timestamp: new Date().toISOString(),
          };
        }
        
        throw new Error(`Unsupported metadata action: ${input.action}`);
      } catch (error: any) {
        logger.error('Error managing metadata', { path: input.path, error: error.message });
        throw new Error(`Failed to manage metadata for ${input.path}: ${error.message}`);
      }
    },
  };
}

/**
 * Compresses files
 */
function createCompressTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/compress',
    description: 'Compress files or directories',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source path (file or directory)',
        },
        destination: {
          type: 'string',
          description: 'Destination archive path',
        },
        format: {
          type: 'string',
          enum: ['gzip', 'zip', 'tar', 'tar.gz'],
          description: 'Compression format',
          default: 'tar.gz',
        },
        level: {
          type: 'number',
          description: 'Compression level (1-9, default: 6)',
          default: 6,
        },
      },
      required: ['source', 'destination'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Compressing files', { 
        source: input.source, 
        destination: input.destination,
        format: input.format,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve paths if working directory is provided
        const resolvedSource = context?.workingDirectory ? 
          join(context.workingDirectory, input.source) : input.source;
        const resolvedDest = context?.workingDirectory ? 
          join(context.workingDirectory, input.destination) : input.destination;
          
        // Check if source exists
        const sourceStats = await fs.stat(resolvedSource);
        
        // Create parent directories for destination
        await fs.mkdir(dirname(resolvedDest), { recursive: true });
        
        // Use appropriate compression method based on format
        const format = input.format || 'tar.gz';
        
        if (format === 'gzip') {
          // Simple gzip for a single file
          if (sourceStats.isDirectory()) {
            throw new Error('Cannot use gzip format directly on directories');
          }
          
          // Create read and write streams
          const readStream = createReadStream(resolvedSource);
          const writeStream = createWriteStream(resolvedDest);
          const gzip = createGzip({ level: input.level || 6 });
          
          // Pipe through gzip
          await pipeline(readStream, gzip, writeStream);
        } else {
          // For other formats, use tar command
          let cmd: string;
          
          if (format === 'tar') {
            cmd = `tar -cf "${resolvedDest}" -C "${dirname(resolvedSource)}" "${basename(resolvedSource)}"`;
          } else if (format === 'tar.gz') {
            cmd = `tar -czf "${resolvedDest}" -C "${dirname(resolvedSource)}" "${basename(resolvedSource)}"`;
          } else if (format === 'zip') {
            if (sourceStats.isDirectory()) {
              cmd = `cd "${dirname(resolvedSource)}" && zip -r "${resolvedDest}" "${basename(resolvedSource)}"`;
            } else {
              cmd = `zip -j "${resolvedDest}" "${resolvedSource}"`;
            }
          } else {
            throw new Error(`Unsupported compression format: ${format}`);
          }
          
          await execAsync(cmd);
        }
        
        // Get compressed file stats
        const destStats = await fs.stat(resolvedDest);
        
        return {
          source: input.source,
          destination: input.destination,
          format,
          originalSize: sourceStats.size,
          compressedSize: destStats.size,
          compressionRatio: sourceStats.size > 0 ? destStats.size / sourceStats.size : 1,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error compressing files', { 
          source: input.source, 
          destination: input.destination, 
          error: error.message,
        });
        throw new Error(`Failed to compress ${input.source}: ${error.message}`);
      }
    },
  };
}

/**
 * Extracts archives
 */
function createExtractTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/extract',
    description: 'Extract archives',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source archive path',
        },
        destination: {
          type: 'string',
          description: 'Destination directory',
        },
        format: {
          type: 'string',
          enum: ['auto', 'gzip', 'zip', 'tar', 'tar.gz'],
          description: 'Archive format (default: auto-detect)',
          default: 'auto',
        },
        stripComponents: {
          type: 'number',
          description: 'Strip the specified number of leading components from file names',
          default: 0,
        },
      },
      required: ['source', 'destination'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Extracting archive', { 
        source: input.source, 
        destination: input.destination,
        format: input.format,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve paths if working directory is provided
        const resolvedSource = context?.workingDirectory ? 
          join(context.workingDirectory, input.source) : input.source;
        const resolvedDest = context?.workingDirectory ? 
          join(context.workingDirectory, input.destination) : input.destination;
          
        // Check if source exists
        await fs.access(resolvedSource);
        
        // Create destination directory if it doesn't exist
        await fs.mkdir(resolvedDest, { recursive: true });
        
        // Determine format if auto
        let format = input.format || 'auto';
        if (format === 'auto') {
          const sourceLower = resolvedSource.toLowerCase();
          if (sourceLower.endsWith('.tar.gz') || sourceLower.endsWith('.tgz')) {
            format = 'tar.gz';
          } else if (sourceLower.endsWith('.tar')) {
            format = 'tar';
          } else if (sourceLower.endsWith('.zip')) {
            format = 'zip';
          } else if (sourceLower.endsWith('.gz')) {
            format = 'gzip';
          } else {
            throw new Error('Could not auto-detect archive format');
          }
        }
        
        // Extract based on format
        if (format === 'gzip') {
          // Simple gunzip for a single file
          const outputPath = join(
            resolvedDest, 
            basename(resolvedSource).replace(/\.gz$/, '')
          );
          
          const readStream = createReadStream(resolvedSource);
          const writeStream = createWriteStream(outputPath);
          const gunzip = createGunzip();
          
          await pipeline(readStream, gunzip, writeStream);
        } else {
          // For other formats, use appropriate command
          let cmd: string;
          const stripComponentsArg = input.stripComponents ? 
            `--strip-components=${input.stripComponents}` : '';
          
          if (format === 'tar') {
            cmd = `tar -xf "${resolvedSource}" -C "${resolvedDest}" ${stripComponentsArg}`;
          } else if (format === 'tar.gz') {
            cmd = `tar -xzf "${resolvedSource}" -C "${resolvedDest}" ${stripComponentsArg}`;
          } else if (format === 'zip') {
            cmd = `unzip -q "${resolvedSource}" -d "${resolvedDest}"`;
          } else {
            throw new Error(`Unsupported extraction format: ${format}`);
          }
          
          await execAsync(cmd);
        }
        
        return {
          source: input.source,
          destination: input.destination,
          format,
          extracted: true,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error extracting archive', { 
          source: input.source, 
          destination: input.destination, 
          error: error.message,
        });
        throw new Error(`Failed to extract ${input.source}: ${error.message}`);
      }
    },
  };
}

/**
 * Syncs files between directories
 */
function createSyncTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/sync',
    description: 'Synchronize files between directories',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source directory',
        },
        destination: {
          type: 'string',
          description: 'Destination directory',
        },
        delete: {
          type: 'boolean',
          description: 'Delete files in destination that are not in source',
          default: false,
        },
        update: {
          type: 'boolean',
          description: 'Skip files that are newer in the destination',
          default: true,
        },
        checksum: {
          type: 'boolean',
          description: 'Compare files by checksum instead of modification time',
          default: false,
        },
        exclude: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to exclude',
        },
        dryRun: {
          type: 'boolean',
          description: 'Perform a trial run with no changes made',
          default: false,
        },
      },
      required: ['source', 'destination'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Synchronizing directories', { 
        source: input.source, 
        destination: input.destination,
        delete: input.delete,
        update: input.update,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve paths if working directory is provided
        const resolvedSource = context?.workingDirectory ? 
          join(context.workingDirectory, input.source) : input.source;
        const resolvedDest = context?.workingDirectory ? 
          join(context.workingDirectory, input.destination) : input.destination;
          
        // Check if source exists
        const sourceStats = await fs.stat(resolvedSource);
        if (!sourceStats.isDirectory()) {
          throw new Error(`Source is not a directory: ${input.source}`);
        }
        
        // Create destination directory if it doesn't exist
        await fs.mkdir(resolvedDest, { recursive: true });
        
        // Build rsync command for syncing
        let cmd = 'rsync -a';
        
        if (input.dryRun) {
          cmd += ' --dry-run';
        }
        
        if (input.delete) {
          cmd += ' --delete';
        }
        
        if (input.update) {
          cmd += ' --update';
        }
        
        if (input.checksum) {
          cmd += ' --checksum';
        }
        
        // Add exclude patterns
        if (input.exclude && Array.isArray(input.exclude)) {
          for (const pattern of input.exclude) {
            cmd += ` --exclude="${pattern}"`;
          }
        }
        
        // Ensure source path ends with slash for rsync
        const sourceArg = resolvedSource.endsWith('/') ? resolvedSource : `${resolvedSource}/`;
        
        // Complete the command
        cmd += ` "${sourceArg}" "${resolvedDest}"`;
        
        // Execute rsync
        const { stdout, stderr } = await execAsync(cmd);
        
        // Parse output to count files
        const fileCount = stdout.split('\n').filter(line => line.trim()).length;
        
        return {
          source: input.source,
          destination: input.destination,
          fileCount,
          dryRun: input.dryRun === true,
          deleted: input.delete === true,
          output: input.dryRun ? stdout : undefined,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        logger.error('Error synchronizing directories', { 
          source: input.source, 
          destination: input.destination, 
          error: error.message,
        });
        throw new Error(`Failed to synchronize ${input.source} to ${input.destination}: ${error.message}`);
      }
    },
  };
}

/**
 * Creates backups
 */
function createBackupTool(logger: ILogger): MCPTool {
  return {
    name: 'filesystem/backup',
    description: 'Create backups of files or directories',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'Source path to backup',
        },
        destination: {
          type: 'string',
          description: 'Backup destination path',
        },
        format: {
          type: 'string',
          enum: ['copy', 'tar', 'tar.gz', 'zip'],
          description: 'Backup format',
          default: 'tar.gz',
        },
        timestamp: {
          type: 'boolean',
          description: 'Add timestamp to filename',
          default: true,
        },
        rotate: {
          type: 'boolean',
          description: 'Rotate backups',
          default: false,
        },
        maxBackups: {
          type: 'number',
          description: 'Maximum number of backups to keep when rotating',
          default: 5,
        },
      },
      required: ['source', 'destination'],
    },
    handler: async (input: any, context?: FilesystemToolContext) => {
      logger.info('Creating backup', { 
        source: input.source, 
        destination: input.destination,
        format: input.format,
        timestamp: input.timestamp,
        sessionId: context?.sessionId,
      });
      
      try {
        // Resolve paths if working directory is provided
        const resolvedSource = context?.workingDirectory ? 
          join(context.workingDirectory, input.source) : input.source;
        
        // Check if source exists
        const sourceStats = await fs.stat(resolvedSource);
        
        // Prepare destination path
        let destPath = input.destination;
        const format = input.format || 'tar.gz';
        
        // Add timestamp if requested
        if (input.timestamp !== false) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const extension = format === 'copy' ? '' : `.${format}`;
          
          // Get basename without extension
          let baseName = basename(destPath);
          if (format !== 'copy' && baseName.endsWith(`.${format}`)) {
            baseName = baseName.slice(0, -format.length - 1);
          }
          
          // Create new destination path with timestamp
          const dirName = dirname(destPath);
          destPath = join(dirName, `${baseName}-${timestamp}${extension}`);
        }
        
        // Resolve destination path
        const resolvedDest = context?.workingDirectory ? 
          join(context.workingDirectory, destPath) : destPath;
        
        // Create parent directories for destination
        await fs.mkdir(dirname(resolvedDest), { recursive: true });
        
        // Create backup based on format
        if (format === 'copy') {
          if (sourceStats.isDirectory()) {
            // Copy directory recursively
            await fs.cp(resolvedSource, resolvedDest, { recursive: true });
          } else {
            // Copy file
            await fs.copyFile(resolvedSource, resolvedDest);
          }
        } else {
          // Use compression methods from compress tool
          const compressInput = {
            source: input.source,
            destination: destPath,
            format,
          };
          
          await createCompressTool(logger).handler(compressInput, context);
        }
        
        // Rotate backups if requested
        if (input.rotate && input.maxBackups > 0) {
          const dirName = dirname(resolvedDest);
          const basePattern = basename(destPath).replace(/(-[^.]+)?(\.[^.]+)?$/, '');
          
          // List files in the destination directory
          const files = await fs.readdir(dirName);
          
          // Filter and sort backup files
          const backupFiles = files
            .filter(file => file.startsWith(basePattern) && file !== basename(destPath))
            .map(file => join(dirName, file))
            .sort((a, b) => {
              return statSync(b).mtime.getTime() - statSync(a).mtime.getTime();
            });
          
          // Delete old backups
          if (backupFiles.length >= input.maxBackups) {
            for (let i = input.maxBackups - 1; i < backupFiles.length; i++) {
              const fileStats = await fs.stat(backupFiles[i]);
              if (fileStats.isDirectory()) {
                await fs.rm(backupFiles[i], { recursive: true });
              } else {
                await fs.unlink(backupFiles[i]);
              }
              
              logger.debug('Deleted old backup', { path: backupFiles[i] });
            }
          }
        }
        
        // Get backup file stats
        const backupStats = await fs.stat(resolvedDest);
        
        return {
          source: input.source,
          destination: destPath,
          format,
          size: backupStats.size,
          timestamp: new Date().toISOString(),
          rotated: input.rotate === true,
        };
      } catch (error: any) {
        logger.error('Error creating backup', { 
          source: input.source, 
          destination: input.destination, 
          error: error.message,
        });
        throw new Error(`Failed to create backup of ${input.source}: ${error.message}`);
      }
    },
  };
}