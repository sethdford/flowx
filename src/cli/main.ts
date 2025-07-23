#!/usr/bin/env node

/**
 * FlowX CLI - Main Entry Point
 * Optimized for fast startup with lazy service initialization
 */

import { CLIApplication } from './core/application.js';
import { getAllCommands } from './core/command-registry.js';
import { initializeGlobalServices, shutdownGlobalServices, isServicesInitialized } from './core/global-initialization.js';
import { EventBus } from '../core/event-bus.js';
import { Logger } from '../core/logger.js';

async function main() {
  try {
    // Fast CLI startup - don't initialize heavy services immediately
    const app = new CLIApplication(
      'flowx',
      'AI-powered development workflows'
    );

    // Register all available commands
    const commands = getAllCommands();
    app.registerCommands(commands);
    
    // Setup graceful shutdown
    const shutdownHandler = async () => {
      console.log('\n🛑 Shutting down gracefully...');
      if (isServicesInitialized()) {
        await shutdownGlobalServices();
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
    
    // Check if this is a help or version command (no need to initialize services)
    const args = process.argv.slice(2);
    // Check if this is a help, version, repl, or test command that doesn't need full initialization
    const isHelpOrVersion = args.includes('--help') || args.includes('-h') || 
                           args.includes('--version') || args.includes('-v') ||
                           args.length === 0 || 
                           args[0] === 'repl' ||
                           process.env.FLOWX_ENV === 'test';

    if (isHelpOrVersion) {
      // Fast path for help/version - no service initialization needed
      await app.run();
      process.exit(0);
    }

    // VS Code support removed - no environment manipulation needed
    
    // For actual commands, initialize services with timeout and progress
    console.log('🚀 Initializing FlowX CLI...');
    const startTime = Date.now();
    
    try {
      // Create core services
      const eventBus = EventBus.getInstance();
      const logger = Logger.getInstance();
      
      // Create memory config
      const memoryConfig = {
        backend: 'sqlite' as const,
        cacheSizeMB: 100,
        syncInterval: 60000, // 1 minute
        conflictResolution: 'last-write' as const,
        retentionDays: 30,
        sqlitePath: '.flowx/memory.db'
      };
      
      // Initialize with fast 3 second timeout for better reliability
      await initializeGlobalServices(eventBus, logger, memoryConfig, 3000);
      
      const initTime = Date.now() - startTime;
      console.log(`✅ Backend services initialized (${initTime}ms)`);

    } catch (error) {
      const initTime = Date.now() - startTime;
      console.error(`❌ Service initialization failed after ${initTime}ms:`, error instanceof Error ? error.message : error);
      
      // Try to continue with degraded functionality
      console.log('⚠️  Attempting to continue with limited functionality...');
      
      // Create minimal fallback services
      try {
        const eventBus = EventBus.getInstance();
        const logger = Logger.getInstance();
        
        // Store fallback services for commands that need them
        (global as any).fallbackServices = {
          eventBus,
          logger,
          initialized: false
        };
        
        console.log('⚠️  Fallback services created');
      } catch (fallbackError) {
        console.error('❌ Failed to create fallback services:', fallbackError instanceof Error ? fallbackError.message : fallbackError);
        console.log('⚠️  Continuing with minimal functionality...');
      }
    }
    
    await app.run();

    // Ensure process exits cleanly
    if (isServicesInitialized()) {
      await shutdownGlobalServices();
    }
    process.exit(0);

  } catch (error) {
    console.error('❌ Failed to start CLI:', error);
    
    // Show stack trace for debugging
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    
    // Only shutdown if services were initialized
    if (isServicesInitialized()) {
      await shutdownGlobalServices();
    }
    
    process.exit(1);
  }
}

main().catch(console.error); 