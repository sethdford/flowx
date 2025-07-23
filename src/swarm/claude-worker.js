#!/usr/bin/env node

/**
 * Claude Worker Process - Enhanced Logging Version (ES Modules)
 * 
 * This worker process executes Claude CLI commands in isolation to avoid
 * the hanging issues experienced with direct subprocess spawning.
 * 
 * Based on Val Town's solution that improved subprocess performance 3x.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Enhanced logging for debugging
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const pid = process.pid;
  console.log(`[${timestamp}] ${level} [Worker-${pid}] ${message}`, data ? JSON.stringify(data) : '');
}

// Log worker startup
log('INFO', '🚀 Claude worker process starting up', { pid: process.pid, argv: process.argv });

// Log ALL process messages for debugging
process.on('message', async (message) => {
  log('INFO', '📨 Worker received raw message', { 
    messageType: typeof message,
    messageLength: Array.isArray(message) ? message.length : 'not-array',
    message: Array.isArray(message) ? message : [message]
  });
  
  // Handle different message formats
  if (Array.isArray(message) && message.length >= 2) {
    const [command, data] = message;
    log('INFO', 'Worker processing array message', { command, hasData: !!data });
    
    if (command === 'execute') {
      await executeClaudeCommand(data);
    } else {
      log('WARN', 'Unknown command received', { command });
    }
  } else {
    log('ERROR', 'Invalid message format received', { message });
  }
});

// Add process error handlers
process.on('error', (error) => {
  log('ERROR', 'Worker process error', { error: error.message, stack: error.stack });
});

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception in worker', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled rejection in worker', { reason, promise });
});

async function executeClaudeCommand({ taskId, prompt, options }) {
  const startTime = Date.now();
  
  try {
    log('INFO', 'Starting Claude task execution', { 
      taskId, 
      promptLength: prompt?.length || 0,
      workingDirectory: options.workingDirectory,
      timeout: options.timeout 
    });
    
    // Create temporary working directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-worker-'));
    const workDir = options.workingDirectory || tempDir;
    
    log('INFO', 'Created working directory', { tempDir, workDir });
    
    // Ensure working directory exists
    await fs.mkdir(workDir, { recursive: true });
    
    // Build Claude CLI command with comprehensive tools
    const claudeArgs = [
      '-p',  // Print mode
      prompt,
      '--dangerously-skip-permissions'
    ];
    
    // Add comprehensive tools if specified - FIXED: Each tool must be a separate argument
    if (options.tools && options.tools.length > 0) {
      claudeArgs.push('--allowedTools');
      // FIXED: Add each tool as a separate argument instead of spreading the array
      for (const tool of options.tools) {
        claudeArgs.push(tool);
      }
      log('INFO', 'Added tools to Claude command', { tools: options.tools, totalArgs: claudeArgs.length });
        } else {
      // FIXED: Use comma-separated tools in single argument (GitHub research shows this is correct format)
      claudeArgs.push('--allowedTools', 'Write,Edit,Read,LS,Bash');
      log('INFO', 'Using comma-separated Claude CLI tools', { tools: 'Write,Edit,Read,LS,Bash' });
    }
    
    log('INFO', 'Executing Claude CLI via bash script', { 
      command: 'claude',
      args: claudeArgs.slice(0, 2).concat(['[PROMPT]', `...${claudeArgs.length - 2} more args`]),
      cwd: workDir
    });
    
    // REVOLUTIONARY FIX: Use bash script approach with simplified execution
    const scriptPath = path.join(tempDir, 'claude-runner.sh');
    const bashScript = `#!/bin/bash
set -e
cd "${workDir}"
export CLAUDE_NON_INTERACTIVE=true
export PATH="${process.env.PATH}"

# Ensure working directory context is clear
echo "Working directory: $(pwd)"
echo "Starting Claude execution with file creation tools..."
claude ${claudeArgs.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ')} 2>&1 | tee "${tempDir}/claude-output.txt"
EXIT_CODE=$?
echo "Claude completed with exit code: $EXIT_CODE" >> "${tempDir}/claude-output.txt"
echo "Files created in working directory:" >> "${tempDir}/claude-output.txt"
ls -la . >> "${tempDir}/claude-output.txt" 2>/dev/null || echo "No files listed" >> "${tempDir}/claude-output.txt"
exit $EXIT_CODE
`;
    
    await fs.writeFile(scriptPath, bashScript);
    await fs.chmod(scriptPath, 0o755);
    
    log('INFO', 'Created bash script for Claude execution', { 
      scriptPath,
      bashScript: bashScript.substring(0, 200) + '...'
    });
    
    // Execute bash script with comprehensive monitoring and timeout
    const claudeProcess = spawn('bash', [scriptPath], {
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CLAUDE_NON_INTERACTIVE: 'true',
        PATH: process.env.PATH
      }
    });
    
    // ORIGINAL CLAUDE-FLOW APPROACH: Validate process creation
    if (!claudeProcess.pid) {
      throw new Error('Failed to spawn Claude process - no PID assigned');
    }
    
    log('INFO', 'Claude process started successfully', {
      taskId,
      pid: claudeProcess.pid,
      workDir,
      command: 'bash',
      args: [scriptPath]
    });
    
    let outputBuffer = '';
    let errorBuffer = '';
    let outputChunks = 0;
    let errorChunks = 0;
    let isCompleted = false;
    let timeoutId;
    
    // ORIGINAL CLAUDE-FLOW APPROACH: Robust timeout with graceful shutdown
    timeoutId = setTimeout(() => {
      if (!isCompleted && claudeProcess && !claudeProcess.killed) {
        log('WARN', 'Claude execution timeout - attempting graceful shutdown', { 
          taskId,
          pid: claudeProcess.pid,
          duration: Date.now() - startTime,
          outputReceived: outputBuffer.length
        });
        
        // Graceful shutdown first (original claude-flow approach)
        claudeProcess.kill('SIGTERM');
        
        // Force kill after grace period
        setTimeout(() => {
          if (!isCompleted && claudeProcess && !claudeProcess.killed) {
            log('ERROR', 'Graceful shutdown failed - force killing Claude process', { 
              taskId, 
              pid: claudeProcess.pid 
            });
            claudeProcess.kill('SIGKILL');
          }
        }, 5000); // 5 second grace period
        
        isCompleted = true;
      }
    }, 30000); // 30 second timeout
    
    claudeProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      outputBuffer += chunk;
      outputChunks++;
      
      // ENHANCED: Monitor for Claude completion patterns
      const lowerChunk = chunk.toLowerCase();
      if (lowerChunk.includes('claude completed') || 
          lowerChunk.includes('task completed') || 
          lowerChunk.includes('files created') ||
          lowerChunk.includes('exit code:')) {
        log('INFO', 'Claude completion indicator detected', { 
          taskId, 
          indicator: chunk.substring(0, 200)
        });
      }
      
      if (outputChunks <= 5) { // Log first few chunks for debugging
        log('DEBUG', 'Claude stdout chunk received', { 
          taskId, 
          chunkNumber: outputChunks,
          chunkLength: chunk.length,
          preview: chunk.substring(0, 100) + (chunk.length > 100 ? '...' : '')
        });
      }
    });
    
    claudeProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorBuffer += chunk;
      errorChunks++;
      
      log('WARN', 'Claude stderr chunk received', { 
        taskId, 
        chunkNumber: errorChunks,
        chunkLength: chunk.length,
        error: chunk.substring(0, 200)
      });
    });
    
    // Handle process completion with enhanced monitoring
    claudeProcess.on('close', async (code, signal) => {
      isCompleted = true;
      clearTimeout(timeoutId); // Clear the timeout since process completed
      const duration = Date.now() - startTime;
      
      // ENHANCED: Read output from tee file for complete capture
      try {
        const teeOutputPath = path.join(tempDir, 'claude-output.txt');
        const teeExists = await fs.access(teeOutputPath).then(() => true).catch(() => false);
        
        if (teeExists) {
          const teeOutput = await fs.readFile(teeOutputPath, 'utf-8');
          if (teeOutput && teeOutput.length > outputBuffer.length) {
            outputBuffer = teeOutput;
            log('INFO', 'Used tee output for complete capture', { 
              taskId,
              teeOutputLength: teeOutput.length,
              bufferLength: outputBuffer.length
            });
          }
        }
      } catch (error) {
        log('WARN', 'Could not read tee output', { taskId, error: error.message });
      }
      
      log('INFO', 'Claude process completed', { 
        taskId, 
        exitCode: code, 
        signal, 
        duration: `${duration}ms`,
        outputLength: outputBuffer.length,
        errorLength: errorBuffer.length
      });
      
      try {
        // Collect any files created in the working directory
        log('INFO', 'Collecting artifacts from working directory', { workDir });
        const artifacts = await collectFiles(workDir);
        
        log('INFO', 'Artifacts collected', { 
          taskId, 
          artifactCount: artifacts.length,
          artifactNames: artifacts.map(a => a.path)
        });
        
        const result = {
          success: code === 0,
          output: outputBuffer,
          error: errorBuffer,
          exitCode: code || 0,
          duration,
          resourcesUsed: {
            cpuTime: duration,
            maxMemory: 0,
            diskIO: 0,
            networkIO: 0,
            fileHandles: 0
          },
          files: artifacts, // Use 'files' for consistency with coordinator expectations
          artifacts: { files: artifacts }, // Also provide in artifacts structure
          metadata: {
            taskId,
            signal,
            approach: 'worker-pool',
            workDir: workDir.replace(os.homedir(), '~'),
            outputChunks,
            errorChunks
          }
        };
        
        // Clean up temp directory
        if (tempDir !== workDir) {
          await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
          log('INFO', 'Cleaned up temporary directory', { tempDir });
        }
        
        log('INFO', 'Task completed successfully', { 
          taskId, 
          success: result.success, 
          duration: `${duration}ms`,
          outputSize: result.output.length,
          artifactCount: artifacts.length
        });
        
        log('INFO', 'Sending success result back to parent', { taskId });
        process.send([taskId, 'success', result]);
        
      } catch (error) {
        log('ERROR', 'Error collecting results', { taskId, error: error.message });
        process.send([taskId, 'error', error]);
      }
    });
    
    claudeProcess.on('error', (error) => {
      log('ERROR', 'Claude process error', { taskId, error: error.message });
      process.send([taskId, 'error', error]);
    });
    
    // Timeout handling
    const timeoutHandle = setTimeout(() => {
      log('WARN', 'Task timeout reached', { taskId, timeout: options.timeout || 300000 });
      claudeProcess.kill('SIGTERM');
      
      setTimeout(() => {
        if (!claudeProcess.killed) {
          claudeProcess.kill('SIGKILL');
          log('WARN', 'Force killed Claude process', { taskId });
        }
      }, 5000);
      
      process.send([taskId, 'error', new Error(`Task ${taskId} timed out`)]);
    }, options.timeout || 300000);
    
    claudeProcess.on('close', () => {
      clearTimeout(timeoutHandle);
    });
    
  } catch (error) {
    log('ERROR', 'Worker setup error', { taskId, error: error.message });
    process.send([taskId, 'error', error]);
  }
}

async function collectFiles(directory) {
  const files = [];
  
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(directory, entry.name);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          files.push({
            path: entry.name,
            content,
            size: content.length
          });
          log('DEBUG', 'Collected file', { fileName: entry.name, size: content.length });
        } catch (e) {
          // Skip files that can't be read
          log('WARN', 'Could not read file', { fileName: entry.name, error: e.message });
        }
      }
    }
  } catch (error) {
    log('WARN', 'Could not scan directory', { directory, error: error.message });
  }
  
  return files;
}

// Handle worker shutdown gracefully
process.on('SIGTERM', () => {
  log('INFO', 'Worker shutting down (SIGTERM)');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('INFO', 'Worker interrupted (SIGINT)');
  process.exit(0);
});

log('INFO', 'Claude worker initialized and ready for tasks', { pid: process.pid }); 