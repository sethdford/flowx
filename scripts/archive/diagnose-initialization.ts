#!/usr/bin/env tsx

/**
 * Diagnostic Script for Service Initialization
 * Identifies exactly where the initialization process is hanging
 */

import { EventBus } from '../src/core/event-bus.ts';
import { Logger } from '../src/core/logger.ts';
import { initializeGlobalServices } from '../src/cli/core/global-initialization.ts';

async function diagnoseInitialization(): Promise<void> {
  console.log('🔍 Diagnosing Service Initialization\n');
  console.log('=' .repeat(50));

  try {
    console.log('Step 1: Creating EventBus...');
    const eventBus = EventBus.getInstance();
    console.log('✅ EventBus created successfully');

    console.log('Step 2: Creating Logger...');
    const logger = Logger.getInstance();
    console.log('✅ Logger created successfully');

    console.log('Step 3: Creating Memory Config...');
    const memoryConfig = {
      backend: 'sqlite' as const,
      cacheSizeMB: 100,
      syncInterval: 60000,
      conflictResolution: 'last-write' as const,
      retentionDays: 30,
      sqlitePath: '.flowx/memory.db'
    };
    console.log('✅ Memory config created successfully');

    console.log('Step 4: Starting service initialization...');
    console.log('⏳ This is where it might hang...');
    
    // Add timeout to see if it hangs
    const initPromise = initializeGlobalServices(eventBus, logger, memoryConfig, 5000);
    
    // Add progress logging
    const progressInterval = setInterval(() => {
      console.log('⏳ Still initializing...');
    }, 1000);

    try {
      await initPromise;
      clearInterval(progressInterval);
      console.log('✅ Service initialization completed successfully');
    } catch (error) {
      clearInterval(progressInterval);
      console.log('❌ Service initialization failed:');
      console.error(error);
      
      // Try to get more details
      if (error instanceof Error) {
        console.log('Error name:', error.name);
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
      }
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Run the diagnostic
diagnoseInitialization().catch(console.error); 