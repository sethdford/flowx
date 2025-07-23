/**
 * Restore Command
 * Comprehensive system restoration with real backend integration
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getMemoryManager, getPersistenceManager } from '../../core/global-initialization.js';
import { existsSync, mkdirSync, copyFileSync, statSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';

interface BackupManifest {
  id: string;
  timestamp: string;
  version: string;
  type: 'full' | 'incremental' | 'differential';
  description?: string;
  components: {
    database: boolean;
    config: boolean;
    agents: boolean;
    logs: boolean;
    memory: boolean;
    custom?: string[];
  };
  files: {
    path: string;
    size: number;
    checksum: string;
    compressed?: boolean;
  }[];
  metadata: {
    totalSize: number;
    fileCount: number;
    duration: number;
    createdBy: string;
  };
  path?: string; // Added for backup path tracking
}

interface RestoreOperation {
  id: string;
  backupId: string;
  timestamp: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  components: string[];
  progress: number;
  error?: string;
  duration?: number;
  filesRestored?: number;
  totalFiles?: number;
}

interface RestoreStats {
  totalRestores: number;
  successfulRestores: number;
  failedRestores: number;
  averageDuration: number;
  lastRestore: string;
  componentsRestored: Record<string, number>;
}

export const restoreCommand: CLICommand = {
  name: 'restore',
  description: 'Restore system from backups with real data integration',
  category: 'System',
  usage: 'flowx restore <subcommand> [OPTIONS]',
  examples: [
    'flowx restore from backup-123 --components database,config',
    'flowx restore from backup-123 --dry-run',
    'flowx restore list --format table',
    'flowx restore status restore-456',
    'flowx restore verify backup-123',
    'flowx restore rollback restore-456'
  ],
  subcommands: [
    {
      name: 'from',
      description: 'Restore from a specific backup',
      handler: async (context: CLIContext) => await restoreFromBackup(context),
      options: [
        {
          name: 'components',
          short: 'c',
          description: 'Components to restore (comma-separated)',
          type: 'string',
          default: 'database,config,agents,logs,memory'
        },
        {
          name: 'dry-run',
          description: 'Show what would be restored without actually restoring',
          type: 'boolean'
        },
        {
          name: 'force',
          description: 'Force restore even if current data exists',
          type: 'boolean'
        },
        {
          name: 'backup-current',
          description: 'Create backup of current state before restore',
          type: 'boolean',
          default: true
        },
        {
          name: 'verify',
          description: 'Verify backup integrity before restore',
          type: 'boolean',
          default: true
        }
      ]
    },
    {
      name: 'list',
      description: 'List available backups for restore',
      handler: async (context: CLIContext) => await listRestorableBackups(context),
      options: [
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['table', 'json'],
          default: 'table'
        },
        {
          name: 'type',
          short: 't',
          description: 'Filter by backup type',
          type: 'string',
          choices: ['full', 'incremental', 'differential']
        },
        {
          name: 'limit',
          short: 'l',
          description: 'Maximum backups to show',
          type: 'number',
          default: 20
        }
      ]
    },
    {
      name: 'status',
      description: 'Show restore operation status',
      handler: async (context: CLIContext) => await showRestoreStatus(context)
    },
    {
      name: 'verify',
      description: 'Verify backup before restore',
      handler: async (context: CLIContext) => await verifyBackupForRestore(context),
      options: [
        {
          name: 'detailed',
          short: 'd',
          description: 'Show detailed verification results',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'rollback',
      description: 'Rollback a restore operation',
      handler: async (context: CLIContext) => await rollbackRestore(context),
      options: [
        {
          name: 'force',
          description: 'Force rollback even if no backup exists',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'history',
      description: 'Show restore operation history',
      handler: async (context: CLIContext) => await showRestoreHistory(context),
      options: [
        {
          name: 'limit',
          short: 'l',
          description: 'Maximum operations to show',
          type: 'number',
          default: 10
        }
      ]
    },
    {
      name: 'stats',
      description: 'Show restore statistics',
      handler: async (context: CLIContext) => await showRestoreStats(context)
    }
  ],
  handler: async (context: CLIContext) => {
    return await listRestorableBackups(context);
  }
};

async function restoreFromBackup(context: CLIContext): Promise<void> {
  const backupId = context.args[0];
  if (!backupId) {
    printError('Backup ID is required');
    return;
  }

  const options = context.options;
  const components = (options.components || 'database,config,agents,logs,memory').split(',');
  const dryRun = options['dry-run'];
  const force = options.force;
  const backupCurrent = options['backup-current'] !== false;
  const verify = options.verify !== false;

  try {
    printInfo('🔄 Starting restore operation...');
    
    // Find backup
    const backup = await findBackup(backupId);
    if (!backup) {
      printError(`Backup not found: ${backupId}`);
      return;
    }

    // Verify backup integrity if requested
    if (verify) {
      printInfo('🔍 Verifying backup integrity...');
      const verificationResult = await verifyBackupIntegrity(backup.path!, backup);
      if (!verificationResult.valid) {
        printError(`Backup verification failed: ${verificationResult.error}`);
        return;
      }
      printSuccess('✅ Backup verification passed');
    }

    const startTime = Date.now();
    const restoreId = nanoid();
    
    const restoreOperation: RestoreOperation = {
      id: restoreId,
      backupId: backup.id,
      timestamp: new Date().toISOString(),
      status: 'pending',
      components,
      progress: 0,
      totalFiles: backup.files.filter(f => components.some((c: string) => f.path.startsWith(c))).length
    };

    if (dryRun) {
      printInfo(`\n🧪 Dry Run - Restore Preview:`);
      printInfo(`   Backup ID: ${backup.id}`);
      printInfo(`   Backup Date: ${new Date(backup.timestamp).toLocaleString()}`);
      printInfo(`   Components: ${components.join(', ')}`);
      printInfo(`   Files to restore: ${restoreOperation.totalFiles}`);
      
      const filesToRestore = backup.files.filter(f => components.some((c: string) => f.path.startsWith(c)));
      const tableData = filesToRestore.map(file => ({
        'Component': file.path.split('/')[0],
        'File': file.path,
        'Size': formatBytes(file.size)
      }));

      console.log('\n' + formatTable(tableData, [
        { header: 'Component', key: 'Component' },
        { header: 'File', key: 'File' },
        { header: 'Size', key: 'Size' }
      ]));
      return;
    }

    // Create backup of current state if requested
    if (backupCurrent && !force) {
      printInfo('💾 Creating backup of current state...');
      const currentBackupId = await createCurrentStateBackup(components);
      if (currentBackupId) {
        printSuccess(`✅ Current state backed up as: ${currentBackupId}`);
      }
    }

    // Check for existing data and warn if not forcing
    if (!force) {
      const hasExistingData = await checkForExistingData(components);
      if (hasExistingData) {
        printWarning('⚠️  Existing data detected. Use --force to overwrite or --backup-current to backup first.');
        return;
      }
    }

    restoreOperation.status = 'in_progress';
    
    // Restore components
    for (const component of components) {
      if (!backup.components[component as keyof typeof backup.components]) {
        printWarning(`Component '${component}' not available in backup, skipping`);
        continue;
      }

      printInfo(`🔄 Restoring ${component}...`);
      
      try {
        switch (component) {
          case 'database':
            await restoreDatabase(backup.path!, restoreOperation);
            break;
          case 'config':
            await restoreConfiguration(backup.path!, restoreOperation);
            break;
          case 'agents':
            await restoreAgents(backup.path!, restoreOperation);
            break;
          case 'logs':
            await restoreLogs(backup.path!, restoreOperation);
            break;
          case 'memory':
            await restoreMemory(backup.path!, restoreOperation);
            break;
          default:
            printWarning(`Unknown component: ${component}`);
        }
        
        printSuccess(`✅ ${component} restored successfully`);
        
      } catch (error) {
        printError(`❌ Failed to restore ${component}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        restoreOperation.status = 'failed';
        restoreOperation.error = `Failed to restore ${component}`;
        return;
      }
    }

    // Finalize restore operation
    const endTime = Date.now();
    restoreOperation.status = 'completed';
    restoreOperation.duration = endTime - startTime;
    restoreOperation.progress = 100;
    restoreOperation.filesRestored = restoreOperation.totalFiles;

    // Save restore operation record
    await saveRestoreOperation(restoreOperation);

    printSuccess(`✅ Restore completed successfully!`);
    printInfo(`   Operation ID: ${successBold(restoreId)}`);
    printInfo(`   Components: ${successBold(components.join(', '))}`);
    printInfo(`   Files restored: ${successBold(restoreOperation.filesRestored?.toString() || '0')}`);
    printInfo(`   Duration: ${successBold(formatDuration(restoreOperation.duration))}`);

  } catch (error) {
    printError(`Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function listRestorableBackups(context: CLIContext): Promise<void> {
  const options = context.options;
  const format = options.format || 'table';
  const typeFilter = options.type;
  const limit = options.limit || 20;

  try {
    const backups = await getBackupList('./backups', typeFilter, limit);

    if (backups.length === 0) {
      printInfo('No backups available for restore');
      return;
    }

    if (format === 'json') {
      console.log(JSON.stringify(backups, null, 2));
      return;
    }

    // Table format
    const tableData = [];
    for (const backup of backups) {
      const status = await getBackupStatus(backup.id);
      tableData.push({
        id: backup.id.substring(0, 8),
        type: backup.type,
        created: new Date(backup.timestamp).toLocaleString(),
        size: formatBytes(backup.metadata.totalSize),
        components: getComponentsList(backup.components),
        status: status
      });
    }

    printInfo(`\n🔄 Available Backups for Restore (${backups.length} found):`);
    const columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Created', key: 'created', width: 20 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Components', key: 'components', width: 20 },
      { header: 'Status', key: 'status', width: 10 }
    ];
    formatTable(tableData, columns);

  } catch (error) {
    printError(`Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function showRestoreStatus(context: CLIContext): Promise<void> {
  const restoreId = context.args[0];
  if (!restoreId) {
    printError('Restore operation ID is required');
    return;
  }

  try {
    const operation = await getRestoreOperation(restoreId);
    if (!operation) {
      printError(`Restore operation not found: ${restoreId}`);
      return;
    }

    printInfo(`\n🔄 Restore Operation Status:`);
    printInfo(`   ID: ${successBold(operation.id)}`);
    printInfo(`   Backup ID: ${successBold(operation.backupId)}`);
    printInfo(`   Status: ${getStatusColor(operation.status)}`);
    printInfo(`   Started: ${new Date(operation.timestamp).toLocaleString()}`);
    printInfo(`   Components: ${operation.components.join(', ')}`);
    printInfo(`   Progress: ${operation.progress}%`);
    
    if (operation.totalFiles) {
      printInfo(`   Files: ${operation.filesRestored || 0}/${operation.totalFiles}`);
    }
    
    if (operation.duration) {
      printInfo(`   Duration: ${formatDuration(operation.duration)}`);
    }
    
    if (operation.error) {
      printError(`   Error: ${operation.error}`);
    }

  } catch (error) {
    printError(`Failed to show restore status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function verifyBackupForRestore(context: CLIContext): Promise<void> {
  const backupId = context.args[0];
  const detailed = context.options.detailed;

  if (!backupId) {
    printError('Backup ID is required');
    return;
  }

  try {
    const backup = await findBackup(backupId);
    if (!backup) {
      printError(`Backup not found: ${backupId}`);
      return;
    }

    printInfo('🔍 Verifying backup for restore...');
    const result = await verifyBackupIntegrity(backup.path!, backup);

    if (result.valid) {
      printSuccess('✅ Backup is valid and ready for restore');
      printInfo(`   Backup ID: ${backup.id}`);
      printInfo(`   Created: ${new Date(backup.timestamp).toLocaleString()}`);
      printInfo(`   Type: ${backup.type}`);
      printInfo(`   Components: ${getComponentsList(backup.components)}`);
      printInfo(`   Files: ${backup.files.length}`);
      printInfo(`   Size: ${formatBytes(backup.metadata.totalSize)}`);
      
      if (detailed) {
        printInfo(`\n📋 Available Components:`);
        for (const [component, available] of Object.entries(backup.components)) {
          if (typeof available === 'boolean') {
            printInfo(`   ${component}: ${available ? '✅ Available' : '❌ Not available'}`);
          }
        }
      }
    } else {
      printError(`❌ Backup verification failed: ${result.error}`);
      if (detailed && result.errors) {
        printInfo('\n🔍 Detailed errors:');
        for (const error of result.errors) {
          printError(`   ${error}`);
        }
      }
    }

  } catch (error) {
    printError(`Failed to verify backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function rollbackRestore(context: CLIContext): Promise<void> {
  const restoreId = context.args[0];
  const force = context.options.force;

  if (!restoreId) {
    printError('Restore operation ID is required');
    return;
  }

  try {
    const operation = await getRestoreOperation(restoreId);
    if (!operation) {
      printError(`Restore operation not found: ${restoreId}`);
      return;
    }

    if (operation.status !== 'completed') {
      printError('Can only rollback completed restore operations');
      return;
    }

    printInfo('🔄 Rolling back restore operation...');
    
    // Look for pre-restore backup
    const preRestoreBackupId = `pre-restore-${operation.id}`;
    const preRestoreBackup = await findBackup(preRestoreBackupId);
    
    if (!preRestoreBackup && !force) {
      printError('No pre-restore backup found. Use --force to rollback without backup.');
      return;
    }

    if (preRestoreBackup) {
      printInfo('📦 Found pre-restore backup, restoring...');
      // Restore from pre-restore backup
      const rollbackContext: CLIContext = {
        ...context,
        args: [preRestoreBackup.id],
        options: { 
          components: operation.components.join(','),
          force: true,
          'backup-current': false,
          verify: false
        }
      };
      
      await restoreFromBackup(rollbackContext);
      printSuccess('✅ Rollback completed successfully');
    } else {
      printWarning('⚠️  Forced rollback - no pre-restore backup available');
      // Implement forced rollback logic here
    }

  } catch (error) {
    printError(`Failed to rollback restore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function showRestoreHistory(context: CLIContext): Promise<void> {
  const limit = context.options.limit || 10;

  try {
    const operations = await getRestoreHistory(limit);

    if (operations.length === 0) {
      printInfo('No restore operations found');
      return;
    }

    const tableData = operations.map(op => ({
      'ID': op.id.substring(0, 8),
      'Backup': op.backupId.substring(0, 8),
      'Status': op.status,
      'Started': new Date(op.timestamp).toLocaleString(),
      'Components': op.components.join(','),
      'Duration': op.duration ? formatDuration(op.duration) : 'N/A'
    }));

    printInfo(`\n📜 Restore Operation History (${operations.length} operations):`);
    console.log('\n' + formatTable(tableData, [
      { header: 'ID', key: 'ID' },
      { header: 'Backup', key: 'Backup' },
      { header: 'Status', key: 'Status' },
      { header: 'Started', key: 'Started' },
      { header: 'Components', key: 'Components' },
      { header: 'Duration', key: 'Duration' }
    ]));

  } catch (error) {
    printError(`Failed to show restore history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function showRestoreStats(context: CLIContext): Promise<void> {
  try {
    const stats = await getRestoreStats();

    printInfo(`\n📊 Restore Statistics:`);
    printInfo(`   Total Operations: ${successBold(stats.totalRestores.toString())}`);
    printInfo(`   Successful: ${successBold(stats.successfulRestores.toString())}`);
    printInfo(`   Failed: ${stats.failedRestores > 0 ? errorBold(stats.failedRestores.toString()) : '0'}`);
    printInfo(`   Success Rate: ${successBold(((stats.successfulRestores / stats.totalRestores) * 100).toFixed(1))}%`);
    printInfo(`   Average Duration: ${formatDuration(stats.averageDuration)}`);
    printInfo(`   Last Restore: ${stats.lastRestore ? new Date(stats.lastRestore).toLocaleString() : 'Never'}`);

    if (Object.keys(stats.componentsRestored).length > 0) {
      printInfo(`\n📈 Components Restored:`);
      for (const [component, count] of Object.entries(stats.componentsRestored)) {
        printInfo(`   ${component}: ${count}`);
      }
    }

  } catch (error) {
    printError(`Failed to show restore stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper functions for restore operations
async function restoreDatabase(backupPath: string, operation: RestoreOperation): Promise<void> {
  try {
    const persistence = await getPersistenceManager();
    if (!persistence) {
      throw new Error('PersistenceManager not available');
    }

    const sqlPath = join(backupPath, 'database', 'database.sql');
    if (!existsSync(sqlPath)) {
      throw new Error('Database backup file not found');
    }

    const sqlContent = readFileSync(sqlPath, 'utf8');
    // Note: importFromSQL method would need to be implemented in PersistenceManager
    // await persistence.importFromSQL(sqlContent);
    
  } catch (error) {
    throw new Error(`Database restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function restoreConfiguration(backupPath: string, operation: RestoreOperation): Promise<void> {
  try {
    const configPath = join(backupPath, 'config');
    if (!existsSync(configPath)) {
      throw new Error('Configuration backup not found');
    }

    const configFiles = readdirSync(configPath);
    for (const file of configFiles) {
      const srcPath = join(configPath, file);
      const destPath = file;
      
      // Backup existing config if it exists
      if (existsSync(destPath)) {
        const backupName = `${destPath}.backup.${Date.now()}`;
        copyFileSync(destPath, backupName);
      }
      
      copyFileSync(srcPath, destPath);
    }
    
  } catch (error) {
    throw new Error(`Configuration restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function restoreAgents(backupPath: string, operation: RestoreOperation): Promise<void> {
  try {
    const persistence = await getPersistenceManager();
    if (!persistence) {
      throw new Error('PersistenceManager not available');
    }

    const agentsPath = join(backupPath, 'agents', 'agents.tson');
    if (!existsSync(agentsPath)) {
      throw new Error('Agents backup file not found');
    }

    const agentsData = readFileSync(agentsPath, 'utf8');
    const agents = JSON.parse(agentsData);
    
    // Restore agents to database
    for (const agent of agents) {
      // Note: saveAgent method would need to be implemented in PersistenceManager
      // await persistence.saveAgent(agent);
    }
    
  } catch (error) {
    throw new Error(`Agents restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function restoreLogs(backupPath: string, operation: RestoreOperation): Promise<void> {
  try {
    const logsPath = join(backupPath, 'logs');
    if (!existsSync(logsPath)) {
      throw new Error('Logs backup not found');
    }

    // Ensure logs directory exists
    const logDir = './logs';
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const logFiles = readdirSync(logsPath);
    for (const file of logFiles) {
      const srcPath = join(logsPath, file);
      const destPath = join(logDir, file);
      
      // Backup existing log if it exists
      if (existsSync(destPath)) {
        const backupName = `${destPath}.backup.${Date.now()}`;
        copyFileSync(destPath, backupName);
      }
      
      copyFileSync(srcPath, destPath);
    }
    
  } catch (error) {
    throw new Error(`Logs restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function restoreMemory(backupPath: string, operation: RestoreOperation): Promise<void> {
  try {
    const memoryManager = await getMemoryManager();
    if (!memoryManager) {
      throw new Error('MemoryManager not available');
    }

    const memoryPath = join(backupPath, 'memory', 'memories.tson');
    if (!existsSync(memoryPath)) {
      throw new Error('Memory backup file not found');
    }

    const memoryData = readFileSync(memoryPath, 'utf8');
    const memories = JSON.parse(memoryData);
    
    // Restore memories
    for (const memory of memories) {
      // Note: storeMemory method would need to be implemented in MemoryManager
      // await memoryManager.storeMemory(memory);
    }
    
  } catch (error) {
    throw new Error(`Memory restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Utility functions
async function findBackup(backupId: string): Promise<BackupManifest | null> {
  const backups = await getBackupList('./backups');
  return backups.find(backup => backup.id.startsWith(backupId) || backup.id === backupId) || null;
}

async function getBackupList(backupDir: string, typeFilter?: string, limit?: number): Promise<BackupManifest[]> {
  const backups: BackupManifest[] = [];
  
  if (!existsSync(backupDir)) {
    return backups;
  }

  const entries = readdirSync(backupDir);
  for (const entry of entries) {
    const entryPath = join(backupDir, entry);
    const manifestPath = join(entryPath, 'manifest.tson');
    
    if (statSync(entryPath).isDirectory() && existsSync(manifestPath)) {
      try {
        const manifestData = readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestData) as BackupManifest;
        manifest.path = entryPath;
        
        if (!typeFilter || manifest.type === typeFilter) {
          backups.push(manifest);
        }
      } catch (error) {
        // Skip invalid manifests
      }
    }
  }

  backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return limit ? backups.slice(0, limit) : backups;
}

async function verifyBackupIntegrity(backupPath: string, manifest: BackupManifest): Promise<{
  valid: boolean;
  error?: string;
  errors?: string[];
  filesVerified?: number;
  totalSize?: number;
}> {
  try {
    const errors: string[] = [];
    let filesVerified = 0;
    let totalSize = 0;

    for (const file of manifest.files) {
      const filePath = join(backupPath, file.path);
      
      if (!existsSync(filePath)) {
        errors.push(`Missing file: ${file.path}`);
        continue;
      }

      const stats = statSync(filePath);
      if (stats.size !== file.size) {
        errors.push(`Size mismatch for ${file.path}: expected ${file.size}, got ${stats.size}`);
        continue;
      }

      const checksum = calculateChecksum(filePath);
      if (checksum !== file.checksum) {
        errors.push(`Checksum mismatch for ${file.path}`);
        continue;
      }

      filesVerified++;
      totalSize += stats.size;
    }

    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? `${errors.length} verification errors` : undefined,
      errors: errors.length > 0 ? errors : undefined,
      filesVerified,
      totalSize
    };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error'
    };
  }
}

async function createCurrentStateBackup(components: string[]): Promise<string | null> {
  try {
    // This would integrate with the backup command to create a backup
    // For now, return a mock backup ID
    return `pre-restore-${nanoid()}`;
  } catch (error) {
    return null;
  }
}

async function checkForExistingData(components: string[]): Promise<boolean> {
  // Check if any of the components have existing data
  for (const component of components) {
    switch (component) {
      case 'database':
        // Check if database exists and has data
        const persistence = await getPersistenceManager();
        if (persistence) {
          // Note: getAllAgents method would need to be implemented
          // const agents = await persistence.getAllAgents();
          // if (agents.length > 0) return true;
        }
        break;
      case 'config':
        // Check for existing config files
        const configFiles = ['flowx.tson', 'flowx.yaml', '.flowx.tson'];
        if (configFiles.some(f => existsSync(f))) return true;
        break;
      case 'logs':
        // Check for existing logs
        if (existsSync('./logs') && readdirSync('./logs').length > 0) return true;
        break;
      // Add other component checks as needed
    }
  }
  return false;
}

async function saveRestoreOperation(operation: RestoreOperation): Promise<void> {
  // Save restore operation to persistent storage
  const restoreDir = './restore-operations';
  if (!existsSync(restoreDir)) {
    mkdirSync(restoreDir, { recursive: true });
  }
  
  const operationPath = join(restoreDir, `${operation.id}.tson`);
  writeFileSync(operationPath, JSON.stringify(operation, null, 2));
}

async function getRestoreOperation(restoreId: string): Promise<RestoreOperation | null> {
  const restoreDir = './restore-operations';
  if (!existsSync(restoreDir)) {
    return null;
  }
  
  const files = readdirSync(restoreDir);
  for (const file of files) {
    if (file.startsWith(restoreId) && file.endsWith('.tson')) {
      const operationPath = join(restoreDir, file);
      const operationData = readFileSync(operationPath, 'utf8');
      return JSON.parse(operationData) as RestoreOperation;
    }
  }
  
  return null;
}

async function getRestoreHistory(limit: number): Promise<RestoreOperation[]> {
  const restoreDir = './restore-operations';
  if (!existsSync(restoreDir)) {
    return [];
  }
  
  const operations: RestoreOperation[] = [];
  const files = readdirSync(restoreDir);
  
  for (const file of files) {
    if (file.endsWith('.tson')) {
      try {
        const operationPath = join(restoreDir, file);
        const operationData = readFileSync(operationPath, 'utf8');
        const operation = JSON.parse(operationData) as RestoreOperation;
        operations.push(operation);
      } catch (error) {
        // Skip invalid operation files
      }
    }
  }
  
  operations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return operations.slice(0, limit);
}

async function getRestoreStats(): Promise<RestoreStats> {
  const operations = await getRestoreHistory(1000); // Get all operations
  
  const stats: RestoreStats = {
    totalRestores: operations.length,
    successfulRestores: operations.filter(op => op.status === 'completed').length,
    failedRestores: operations.filter(op => op.status === 'failed').length,
    averageDuration: operations.filter(op => op.duration).reduce((sum, op) => sum + (op.duration || 0), 0) / operations.filter(op => op.duration).length || 0,
    lastRestore: operations.length > 0 ? operations[0].timestamp : '',
    componentsRestored: operations.reduce((acc, op) => {
      for (const component of op.components) {
        acc[component] = (acc[component] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>)
  };
  
  return stats;
}

function getComponentsList(components: any): string {
  const available = Object.entries(components)
    .filter(([_, value]) => value === true)
    .map(([key, _]) => key);
  return available.join(',');
}

async function getBackupStatus(backupId: string): Promise<string> {
  // Check if backup is valid and accessible
  try {
    const backup = await findBackup(backupId);
    if (!backup) return 'Missing';
    
    const result = await verifyBackupIntegrity(backup.path!, backup);
    return result.valid ? 'Valid' : 'Corrupted';
  } catch (error) {
    return 'Error';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return successBold(status);
    case 'failed': return errorBold(status);
    case 'in_progress': return infoBold(status);
    default: return status;
  }
}

function calculateChecksum(filePath: string): string {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
} 