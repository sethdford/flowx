/**
 * Migration Command
 * Provides CLI access to database migrations and system upgrades
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { formatTable, successBold, infoBold, warningBold, errorBold, printSuccess, printError, printWarning, printInfo } from '../../core/output-formatter.js';
import { getPersistenceManager } from '../../core/global-initialization.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface Migration {
  id: string;
  version: string;
  name: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
  createdAt: Date;
  appliedAt?: Date;
  status: 'pending' | 'applied' | 'failed' | 'rolled_back';
  checksum?: string;
  dependencies: string[];
}

interface MigrationHistory {
  id: string;
  version: string;
  name: string;
  appliedAt: Date;
  rollbackAt?: Date;
  executionTime: number;
  status: 'success' | 'failed' | 'rolled_back';
  error?: string;
  checksum: string;
}

export const migrationCommand: CLICommand = {
  name: 'migration',
  description: 'Manage database migrations and system upgrades',
  category: 'System',
  usage: 'flowx migration <subcommand> [OPTIONS]',
  examples: [
    'flowx migration status',
    'flowx migration up',
    'flowx migration down --version 1.2.0',
    'flowx migration create --name "add-user-preferences"',
    'flowx migration history --limit 10'
  ],
  subcommands: [
    {
      name: 'status',
      description: 'Show migration status',
      handler: async (context: CLIContext) => await showMigrationStatus(context),
      options: [
        {
          name: 'verbose',
          short: 'v',
          description: 'Show detailed migration information',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'up',
      description: 'Apply pending migrations',
      handler: async (context: CLIContext) => await runMigrationsUp(context),
      options: [
        {
          name: 'version',
          short: 'V',
          description: 'Migrate to specific version',
          type: 'string'
        },
        {
          name: 'steps',
          short: 's',
          description: 'Number of migrations to apply',
          type: 'number'
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Show what would be migrated without applying',
          type: 'boolean'
        },
        {
          name: 'force',
          short: 'f',
          description: 'Force migration even if checksum mismatch',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'down',
      description: 'Rollback migrations',
      handler: async (context: CLIContext) => await runMigrationsDown(context),
      options: [
        {
          name: 'version',
          short: 'V',
          description: 'Rollback to specific version',
          type: 'string'
        },
        {
          name: 'steps',
          short: 's',
          description: 'Number of migrations to rollback',
          type: 'number',
          default: 1
        },
        {
          name: 'dry-run',
          short: 'd',
          description: 'Show what would be rolled back without applying',
          type: 'boolean'
        },
        {
          name: 'confirm',
          short: 'y',
          description: 'Skip confirmation prompt',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'create',
      description: 'Create new migration',
      handler: async (context: CLIContext) => await createMigration(context),
      options: [
        {
          name: 'name',
          short: 'n',
          description: 'Migration name',
          type: 'string',
          required: true
        },
        {
          name: 'type',
          short: 't',
          description: 'Migration type',
          type: 'string',
          choices: ['schema', 'data', 'system', 'config'],
          default: 'schema'
        },
        {
          name: 'template',
          description: 'Use migration template',
          type: 'string',
          choices: ['basic', 'table', 'index', 'data-transform']
        }
      ]
    },
    {
      name: 'history',
      description: 'Show migration history',
      handler: async (context: CLIContext) => await showMigrationHistory(context),
      options: [
        {
          name: 'limit',
          short: 'l',
          description: 'Maximum entries to show',
          type: 'number',
          default: 20
        },
        {
          name: 'format',
          short: 'f',
          description: 'Output format',
          type: 'string',
          choices: ['table', 'json'],
          default: 'table'
        }
      ]
    },
    {
      name: 'validate',
      description: 'Validate migration integrity',
      handler: async (context: CLIContext) => await validateMigrations(context),
      options: [
        {
          name: 'fix',
          description: 'Attempt to fix validation issues',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'reset',
      description: 'Reset migration state',
      handler: async (context: CLIContext) => await resetMigrations(context),
      options: [
        {
          name: 'confirm',
          short: 'y',
          description: 'Skip confirmation prompt',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'seed',
      description: 'Run database seeders',
      handler: async (context: CLIContext) => await runSeeders(context),
      options: [
        {
          name: 'seeder',
          short: 's',
          description: 'Specific seeder to run',
          type: 'string'
        },
        {
          name: 'force',
          short: 'f',
          description: 'Force seeding even if data exists',
          type: 'boolean'
        }
      ]
    },
    {
      name: 'backup',
      description: 'Create migration backup',
      handler: async (context: CLIContext) => await createMigrationBackup(context)
    },
    {
      name: 'restore',
      description: 'Restore from migration backup',
      handler: async (context: CLIContext) => await restoreMigrationBackup(context)
    }
  ],
  handler: async (context: CLIContext) => {
    return await showMigrationStatus(context);
  }
};

// Migration management functions

async function showMigrationStatus(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const migrations = await loadMigrations();
    const appliedMigrations = await getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    console.log(successBold('\n📋 Migration Status\n'));
    
    if (migrations.length === 0) {
      printInfo('No migrations found');
      return;
    }
    
    const statusData = migrations.map(migration => ({
      version: migration.version,
      name: migration.name,
      status: appliedVersions.has(migration.version) ? '✅ Applied' : '⏳ Pending',
      applied: appliedVersions.has(migration.version) 
        ? appliedMigrations.find(m => m.version === migration.version)?.appliedAt?.toLocaleString() || 'Unknown'
        : '-',
      description: options.verbose ? migration.description : migration.description.substring(0, 50) + '...'
    }));
    
    console.log(formatTable(statusData, [
      { header: 'Version', key: 'version' },
      { header: 'Name', key: 'name' },
      { header: 'Status', key: 'status' },
      { header: 'Applied', key: 'applied' },
      ...(options.verbose ? [{ header: 'Description', key: 'description' }] : [])
    ]));
    
    const pendingCount = migrations.length - appliedMigrations.length;
    console.log();
    printInfo(`Total migrations: ${migrations.length}`);
    printInfo(`Applied: ${appliedMigrations.length}`);
    printInfo(`Pending: ${pendingCount}`);
    
    if (pendingCount > 0) {
      printWarning(`${pendingCount} migrations are pending. Run 'flowx migration up' to apply them.`);
    }
    
  } catch (error) {
    printError(`Failed to show migration status: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function runMigrationsUp(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const migrations = await loadMigrations();
    const appliedMigrations = await getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    let migrationsToApply = migrations.filter(m => !appliedVersions.has(m.version));
    
    // Filter by version if specified
    if (options.version) {
      const targetIndex = migrationsToApply.findIndex(m => m.version === options.version);
      if (targetIndex === -1) {
        printError(`Migration version ${options.version} not found`);
        return;
      }
      migrationsToApply = migrationsToApply.slice(0, targetIndex + 1);
    }
    
    // Limit by steps if specified
    if (options.steps) {
      migrationsToApply = migrationsToApply.slice(0, options.steps);
    }
    
    if (migrationsToApply.length === 0) {
      printInfo('No migrations to apply');
      return;
    }
    
    if (options.dryRun) {
      printInfo('Dry run - migrations that would be applied:');
      migrationsToApply.forEach(m => {
        console.log(`  ${m.version}: ${m.name}`);
      });
      return;
    }
    
    printInfo(`Applying ${migrationsToApply.length} migrations...`);
    
    for (const migration of migrationsToApply) {
      try {
        printInfo(`Applying migration: ${migration.version} - ${migration.name}`);
        
        const startTime = Date.now();
        await migration.up();
        const executionTime = Date.now() - startTime;
        
        // Record migration as applied
        await recordMigrationApplied(migration, executionTime);
        
        printSuccess(`✅ Applied: ${migration.version}`);
        
      } catch (error) {
        printError(`❌ Failed to apply migration ${migration.version}: ${error instanceof Error ? error.message : String(error)}`);
        
        // Record migration failure
        await recordMigrationFailed(migration, error instanceof Error ? error.message : String(error));
        
        if (!options.force) {
          printError('Migration failed. Use --force to continue with remaining migrations.');
          break;
        }
      }
    }
    
    printSuccess('Migration process completed');
    
  } catch (error) {
    printError(`Failed to run migrations: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function runMigrationsDown(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const appliedMigrations = await getAppliedMigrations();
    const migrations = await loadMigrations();
    
    if (appliedMigrations.length === 0) {
      printInfo('No migrations to rollback');
      return;
    }
    
    // Sort by version descending for rollback
    appliedMigrations.sort((a, b) => b.version.localeCompare(a.version));
    
    let migrationsToRollback = appliedMigrations;
    
    // Filter by version if specified
    if (options.version) {
      const targetIndex = appliedMigrations.findIndex(m => m.version === options.version);
      if (targetIndex === -1) {
        printError(`Applied migration version ${options.version} not found`);
        return;
      }
      migrationsToRollback = appliedMigrations.slice(0, targetIndex + 1);
    } else if (options.steps) {
      migrationsToRollback = appliedMigrations.slice(0, options.steps);
    }
    
    if (options.dryRun) {
      printInfo('Dry run - migrations that would be rolled back:');
      migrationsToRollback.forEach(m => {
        console.log(`  ${m.version}: ${m.name}`);
      });
      return;
    }
    
    if (!options.confirm) {
      printWarning(`This will rollback ${migrationsToRollback.length} migrations. This action cannot be undone.`);
      printInfo('Use --confirm to proceed.');
      return;
    }
    
    printInfo(`Rolling back ${migrationsToRollback.length} migrations...`);
    
    for (const appliedMigration of migrationsToRollback) {
      try {
        // Find the migration definition
        const migration = migrations.find(m => m.version === appliedMigration.version);
        if (!migration) {
          printWarning(`Migration definition not found for version ${appliedMigration.version}, skipping`);
          continue;
        }
        
        printInfo(`Rolling back migration: ${migration.version} - ${migration.name}`);
        
        const startTime = Date.now();
        await migration.down();
        const executionTime = Date.now() - startTime;
        
        // Record migration rollback
        await recordMigrationRolledBack(migration, executionTime);
        
        printSuccess(`✅ Rolled back: ${migration.version}`);
        
      } catch (error) {
        printError(`❌ Failed to rollback migration ${appliedMigration.version}: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
    
    printSuccess('Rollback process completed');
    
  } catch (error) {
    printError(`Failed to rollback migrations: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function createMigration(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const migrationName = options.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const version = `${timestamp}_${migrationName}`;
    
    const migrationDir = path.join(process.cwd(), 'migrations');
    await fs.mkdir(migrationDir, { recursive: true });
    
    const migrationFile = path.join(migrationDir, `${version}.ts`);
    
    const template = getMigrationTemplate(options.template || 'basic', {
      name: migrationName,
      version,
      description: options.description || `Migration: ${options.name}`,
      type: options.type || 'schema'
    });
    
    await fs.writeFile(migrationFile, template);
    
    printSuccess(`✅ Migration created: ${migrationFile}`);
    printInfo(`Version: ${version}`);
    printInfo(`Name: ${migrationName}`);
    printInfo(`Type: ${options.type || 'schema'}`);
    
  } catch (error) {
    printError(`Failed to create migration: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function showMigrationHistory(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const history = await getMigrationHistory(options.limit);
    
    if (history.length === 0) {
      printInfo('No migration history found');
      return;
    }
    
    if (options.format === 'json') {
      console.log(JSON.stringify(history, null, 2));
      return;
    }
    
    console.log(successBold('\n📈 Migration History\n'));
    
    const tableData = history.map(entry => ({
      version: entry.version,
      name: entry.name,
      status: getStatusDisplay(entry.status),
      applied: entry.appliedAt.toLocaleString(),
      duration: `${entry.executionTime}ms`,
      ...(entry.error && { error: entry.error.substring(0, 50) + '...' })
    }));
    
    console.log(formatTable(tableData, [
      { header: 'Version', key: 'version' },
      { header: 'Name', key: 'name' },
      { header: 'Status', key: 'status' },
      { header: 'Applied', key: 'applied' },
      { header: 'Duration', key: 'duration' },
      ...(tableData.some(d => d.error) ? [{ header: 'Error', key: 'error' }] : [])
    ]));
    
    console.log();
    printSuccess(`Showing ${history.length} migration history entries`);
    
  } catch (error) {
    printError(`Failed to show migration history: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function validateMigrations(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const migrations = await loadMigrations();
    const appliedMigrations = await getAppliedMigrations();
    
    console.log(successBold('\n🔍 Migration Validation\n'));
    
    const issues: string[] = [];
    
    // Check for duplicate versions
    const versions = migrations.map(m => m.version);
    const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
    if (duplicates.length > 0) {
      issues.push(`Duplicate migration versions found: ${duplicates.join(', ')}`);
    }
    
    // Check for missing migration files
    for (const applied of appliedMigrations) {
      const exists = migrations.some(m => m.version === applied.version);
      if (!exists) {
        issues.push(`Applied migration ${applied.version} has no corresponding file`);
      }
    }
    
    // Check for checksum mismatches
    for (const migration of migrations) {
      const applied = appliedMigrations.find(m => m.version === migration.version);
      if (applied && migration.checksum && applied.checksum !== migration.checksum) {
        issues.push(`Checksum mismatch for migration ${migration.version}`);
      }
    }
    
    // Check for broken dependency chains
    for (const migration of migrations) {
      for (const dep of migration.dependencies) {
        const depExists = migrations.some(m => m.version === dep);
        if (!depExists) {
          issues.push(`Migration ${migration.version} depends on missing migration ${dep}`);
        }
      }
    }
    
    if (issues.length === 0) {
      printSuccess('✅ All migrations are valid');
      return;
    }
    
    printWarning(`Found ${issues.length} validation issues:`);
    issues.forEach(issue => printError(`  - ${issue}`));
    
    if (options.fix) {
      printInfo('Attempting to fix validation issues...');
      await fixMigrationIssues(issues);
      printSuccess('Fix attempts completed');
    }
    
  } catch (error) {
    printError(`Failed to validate migrations: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function resetMigrations(context: CLIContext): Promise<void> {
  const { options } = context;
  
  if (!options.confirm) {
    printWarning('This will reset all migration history. This action cannot be undone.');
    printInfo('Use --confirm to proceed.');
    return;
  }
  
  try {
    await clearMigrationHistory();
    printSuccess('✅ Migration history reset');
    printWarning('All migration records have been cleared. You may need to re-apply migrations.');
    
  } catch (error) {
    printError(`Failed to reset migrations: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function runSeeders(context: CLIContext): Promise<void> {
  const { options } = context;
  
  try {
    const seeders = await loadSeeders();
    
    if (seeders.length === 0) {
      printInfo('No seeders found');
      return;
    }
    
    let seedersToRun = seeders;
    
    if (options.seeder) {
      seedersToRun = seeders.filter(s => s.name === options.seeder);
      if (seedersToRun.length === 0) {
        printError(`Seeder '${options.seeder}' not found`);
        return;
      }
    }
    
    printInfo(`Running ${seedersToRun.length} seeders...`);
    
    for (const seeder of seedersToRun) {
      try {
        printInfo(`Running seeder: ${seeder.name}`);
        await seeder.run();
        printSuccess(`✅ Seeder completed: ${seeder.name}`);
      } catch (error) {
        printError(`❌ Seeder failed: ${seeder.name} - ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    printSuccess('Seeding process completed');
    
  } catch (error) {
    printError(`Failed to run seeders: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function createMigrationBackup(context: CLIContext): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `migration-backup-${timestamp}.tson`;
    
    const backupData = {
      timestamp: new Date(),
      migrations: await loadMigrations(),
      appliedMigrations: await getAppliedMigrations(),
      history: await getMigrationHistory(1000)
    };
    
    await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
    
    printSuccess(`✅ Migration backup created: ${backupFile}`);
    
  } catch (error) {
    printError(`Failed to create migration backup: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function restoreMigrationBackup(context: CLIContext): Promise<void> {
  const { args } = context;
  
  if (args.length === 0) {
    printError('Backup file is required');
    return;
  }
  
  try {
    const backupFile = args[0];
    const content = await fs.readFile(backupFile, 'utf8');
    const backupData = JSON.parse(content);
    
    await restoreFromBackup(backupData);
    
    printSuccess(`✅ Migration state restored from ${backupFile}`);
    
  } catch (error) {
    printError(`Failed to restore migration backup: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper functions

async function loadMigrations(): Promise<Migration[]> {
  // Mock implementation - in real system would load from migration files
  return [
    {
      id: 'init',
      version: '2024-01-01_initial_schema',
      name: 'Initial Schema',
      description: 'Create initial database schema',
      up: async () => { /* Implementation */ },
      down: async () => { /* Implementation */ },
      createdAt: new Date('2024-01-01'),
      status: 'applied',
      checksum: 'abc123',
      dependencies: []
    },
    {
      id: 'agents',
      version: '2024-01-02_add_agents_table',
      name: 'Add Agents Table',
      description: 'Create agents table for agent management',
      up: async () => { /* Implementation */ },
      down: async () => { /* Implementation */ },
      createdAt: new Date('2024-01-02'),
      status: 'applied',
      checksum: 'def456',
      dependencies: ['2024-01-01_initial_schema']
    },
    {
      id: 'tasks',
      version: '2024-01-03_add_tasks_table',
      name: 'Add Tasks Table',
      description: 'Create tasks table for task management',
      up: async () => { /* Implementation */ },
      down: async () => { /* Implementation */ },
      createdAt: new Date('2024-01-03'),
      status: 'pending',
      checksum: 'ghi789',
      dependencies: ['2024-01-02_add_agents_table']
    }
  ];
}

async function getAppliedMigrations(): Promise<MigrationHistory[]> {
  // Mock implementation - in real system would query database
  return [
    {
      id: 'init',
      version: '2024-01-01_initial_schema',
      name: 'Initial Schema',
      appliedAt: new Date('2024-01-01T10:00:00Z'),
      executionTime: 1500,
      status: 'success',
      checksum: 'abc123'
    },
    {
      id: 'agents',
      version: '2024-01-02_add_agents_table',
      name: 'Add Agents Table',
      appliedAt: new Date('2024-01-02T10:00:00Z'),
      executionTime: 800,
      status: 'success',
      checksum: 'def456'
    }
  ];
}

async function getMigrationHistory(limit: number): Promise<MigrationHistory[]> {
  const applied = await getAppliedMigrations();
  return applied.slice(-limit);
}

async function recordMigrationApplied(migration: Migration, executionTime: number): Promise<void> {
  // Mock implementation - in real system would insert into database
  printInfo(`Recording migration ${migration.version} as applied`);
}

async function recordMigrationFailed(migration: Migration, error: string): Promise<void> {
  // Mock implementation - in real system would insert into database
  printInfo(`Recording migration ${migration.version} as failed: ${error}`);
}

async function recordMigrationRolledBack(migration: Migration, executionTime: number): Promise<void> {
  // Mock implementation - in real system would update database
  printInfo(`Recording migration ${migration.version} as rolled back`);
}

async function clearMigrationHistory(): Promise<void> {
  // Mock implementation - in real system would clear database table
  printInfo('Clearing migration history');
}

async function loadSeeders(): Promise<Array<{ name: string; run: () => Promise<void> }>> {
  // Mock implementation - in real system would load seeder files
  return [
    {
      name: 'default_config',
      run: async () => {
        printInfo('Seeding default configuration');
      }
    },
    {
      name: 'sample_agents',
      run: async () => {
        printInfo('Seeding sample agents');
      }
    }
  ];
}

async function fixMigrationIssues(issues: string[]): Promise<void> {
  // Mock implementation - in real system would attempt to fix issues
  printInfo('Attempting to fix migration issues');
}

async function restoreFromBackup(backupData: any): Promise<void> {
  // Mock implementation - in real system would restore from backup
  printInfo('Restoring migration state from backup');
}

function getMigrationTemplate(template: string, params: any): string {
  const templates = {
    basic: `/**
 * Migration: ${params.name}
 * Version: ${params.version}
 * Type: ${params.type}
 * Description: ${params.description}
 */

export async function up(): Promise<void> {
  // Add your migration logic here
  console.log('Running migration: ${params.name}');
}

export async function down(): Promise<void> {
  // Add your rollback logic here
  console.log('Rolling back migration: ${params.name}');
}

export const migration = {
  id: '${params.name}',
  version: '${params.version}',
  name: '${params.name}',
  description: '${params.description}',
  up,
  down,
  createdAt: new Date(),
  status: 'pending' as const,
  dependencies: []
};
`,
    table: `/**
 * Migration: ${params.name}
 * Create table migration template
 */

export async function up(): Promise<void> {
  // Example table creation
  console.log('Creating table for ${params.name}');
  // await db.schema.createTable('table_name', (table) => {
  //   table.increments('id').primary();
  //   table.string('name').notNullable();
  //   table.timestamps(true, true);
  // });
}

export async function down(): Promise<void> {
  // Drop table
  console.log('Dropping table for ${params.name}');
  // await db.schema.dropTable('table_name');
}

export const migration = {
  id: '${params.name}',
  version: '${params.version}',
  name: '${params.name}',
  description: '${params.description}',
  up,
  down,
  createdAt: new Date(),
  status: 'pending' as const,
  dependencies: []
};
`
  };

  return templates[template as keyof typeof templates] || templates.basic;
}

function getStatusDisplay(status: string): string {
  const statusMap: Record<string, string> = {
    success: '✅ Success',
    failed: '❌ Failed',
    rolled_back: '↩️ Rolled Back'
  };
  return statusMap[status] || status;
}

export default migrationCommand; 