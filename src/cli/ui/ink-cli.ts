#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { ProcessManager } from '../commands/start/process-manager.js';
import { SystemMonitor } from '../commands/start/system-monitor.js';
import InkDashboard from './ink-dashboard.tsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export async function launchInkDashboard(): Promise<void> {
  // Initialize process manager and system monitor
  const processManager = new ProcessManager();
  await processManager.initialize();
  
  const systemMonitor = new SystemMonitor(processManager);
  systemMonitor.start();
  
  // Render the Ink dashboard
  const { waitUntilExit } = render(
    React.createElement(InkDashboard, {
      processManager,
      systemMonitor
    })
  );
  
  // Wait for the app to exit
  await waitUntilExit();
  
  // Cleanup
  systemMonitor.stop();
  await processManager.stopAll();
}

// If this file is run directly, launch the dashboard
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  launchInkDashboard().catch(console.error);
} 