#!/usr/bin/env node

/**
 * Test Worker Pool Communication
 * This script tests if messages are being sent to and received by workers correctly
 */

import { fork } from 'node:child_process';
import path from 'node:path';

console.log('🧪 Testing worker pool communication...');

// Create worker
const workerPath = './dist/claude-worker.js';
console.log(`📁 Using worker script: ${workerPath}`);

const worker = fork(workerPath, [], {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  silent: false // Enable worker output
});

console.log(`✅ Worker ${worker.pid} created`);

// Listen for ALL data from worker stdout/stderr
worker.stdout?.on('data', (data) => {
  console.log('📺 Worker STDOUT:', data.toString());
});

worker.stderr?.on('data', (data) => {
  console.log('📻 Worker STDERR:', data.toString());
});

// Listen for messages from worker
worker.on('message', (message) => {
  console.log('📨 Received message from worker:', message);
});

// Handle worker events
worker.on('error', (error) => {
  console.error('❌ Worker error:', error);
});

worker.on('exit', (code, signal) => {
  console.log(`🚪 Worker exited: code=${code}, signal=${signal}`);
});

worker.on('spawn', () => {
  console.log('🆕 Worker spawned successfully');
});

// Wait a moment then send test message
setTimeout(() => {
  console.log('📤 Sending test message to worker...');
  
  const testMessage = ['execute', {
    taskId: 'test-task-123',
    prompt: 'Create a simple test file',
    options: {
      workingDirectory: '/tmp',
      timeout: 30000,
      tools: ['Edit', 'WriteFile:*']
    }
  }];
  
  console.log('📋 Test message content:', JSON.stringify(testMessage, null, 2));
  worker.send(testMessage);
  console.log('✅ Test message sent');
}, 1000);

// Kill worker after 20 seconds to give Claude more time
setTimeout(() => {
  console.log('🔚 Killing worker...');
  worker.kill('SIGTERM');
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}, 20000); 