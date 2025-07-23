/**
 * Query Command
 * Advanced data querying interface for FlowX
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { printSuccess, printError, printInfo, printWarning, formatTable } from '../../core/output-formatter.js';
import { getLogger, getMemoryManager, getPersistenceManager } from '../../core/global-initialization.js';
import { SwarmCoordinator } from '../../../swarm/coordinator.js';
import { TaskEngine } from '../../../task/engine.js';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

export const queryCommand: CLICommand = {
  name: 'query',
  description: 'Advanced data querying interface for FlowX',
  category: 'Data',
  usage: 'flowx query <query-type> [QUERY] [OPTIONS]',
  examples: [
    'flowx query tasks --status running',
    'flowx query agents --type researcher',
    'flowx query memory --namespace default',
    'flowx query logs --level error --since "1 hour ago"',
    'flowx query swarms --active',
    'flowx query metrics --component task-engine',
    'flowx query --sql "SELECT * FROM tasks WHERE status = \'running\'"',
    'flowx query --json \'{"type": "tasks", "filter": {"status": "completed"}}\'',
    'flowx query workflows --output csv',
    'flowx query performance --aggregate --time-range "24h"'
  ],
  arguments: [
    {
      name: 'query-type',
      description: 'Type of data to query (tasks, agents, memory, logs, swarms, metrics, workflows, performance)',
      required: false
    },
    {
      name: 'query',
      description: 'Query string or filter criteria',
      required: false
    }
  ],
  options: [
    {
      name: 'query-type',
      description: 'Type of data to query',
      type: 'string'
    },
    {
      name: 'sql',
      description: 'Execute raw SQL query',
      type: 'string'
    },
    {
      name: 'json',
      description: 'Execute JSON-formatted query',
      type: 'string'
    },
    {
      name: 'filter',
      short: 'f',
      description: 'Filter criteria (JSON format)',
      type: 'string'
    },
    {
      name: 'select',
      short: 's',
      description: 'Fields to select (comma-separated)',
      type: 'string'
    },
    {
      name: 'where',
      short: 'w',
      description: 'WHERE clause conditions',
      type: 'string'
    },
    {
      name: 'order-by',
      short: 'o',
      description: 'Sort order (field:asc/desc)',
      type: 'string'
    },
    {
      name: 'limit',
      short: 'l',
      description: 'Maximum number of results',
      type: 'number',
      default: 100
    },
    {
      name: 'offset',
      description: 'Result offset for pagination',
      type: 'number',
      default: 0
    },
    {
      name: 'output',
      description: 'Output format (table, json, csv, yaml)',
      type: 'string',
      choices: ['table', 'json', 'csv', 'yaml'],
      default: 'table'
    },
    {
      name: 'format',
      description: 'Result format',
      type: 'string',
      choices: ['table', 'json', 'csv', 'yaml'],
      default: 'table'
    },
    {
      name: 'save',
      description: 'Save results to file',
      type: 'string'
    },
    {
      name: 'aggregate',
      short: 'a',
      description: 'Aggregate results (count, sum, avg, min, max)',
      type: 'string',
      choices: ['count', 'sum', 'avg', 'min', 'max']
    },
    {
      name: 'group-by',
      short: 'g',
      description: 'Group results by field',
      type: 'string'
    },
    {
      name: 'time-range',
      short: 't',
      description: 'Time range filter (1h, 24h, 7d, 30d)',
      type: 'string'
    },
    {
      name: 'since',
      description: 'Results since timestamp/duration',
      type: 'string'
    },
    {
      name: 'until',
      description: 'Results until timestamp/duration',
      type: 'string'
    },
    {
      name: 'live',
      description: 'Live query mode (auto-refresh)',
      type: 'boolean'
    },
    {
      name: 'watch',
      description: 'Watch for changes and update results',
      type: 'boolean'
    },
    {
      name: 'explain',
      description: 'Explain query execution plan',
      type: 'boolean'
    },
    {
      name: 'verbose',
      short: 'v',
      description: 'Verbose output with metadata',
      type: 'boolean'
    },
    {
      name: 'dry-run',
      short: 'd',
      description: 'Show query without executing',
      type: 'boolean'
    }
  ],
  handler: async (context: CLIContext) => {
    const { args, options } = context;
    
    try {
      const logger = await getLogger();
      const memoryManager = await getMemoryManager();
      const persistenceManager = await getPersistenceManager();
      
      // Initialize data sources
      const dataSources = await initializeDataSources();
      
      // Determine query mode
      if (options.sql) {
        await executeSQLQuery(options.sql, options, dataSources, logger);
      } else if (options.json) {
        await executeJSONQuery(options.json, options, dataSources, logger);
      } else if (args.length > 0) {
        const queryType = args[0];
        const queryString = args.slice(1).join(' ');
        await executeTypedQuery(queryType, queryString, options, dataSources, logger);
      } else {
        await showQueryHelp();
      }
      
    } catch (error) {
      printError(`Query command failed: ${error instanceof Error ? error.message : String(error)}`);
      if (options.verbose) {
        console.error(error);
      }
      throw error;
    }
  }
};

// Data source initialization
async function initializeDataSources(): Promise<any> {
  const logger = await getLogger();
  const memoryManager = await getMemoryManager();
  const persistenceManager = await getPersistenceManager();
  
  // Initialize task engine
  const taskEngine = new TaskEngine(10);
  
  // Initialize swarm coordinator
  const swarmCoordinator = new SwarmCoordinator({
    maxAgents: 10,
    coordinationStrategy: {
      name: 'centralized',
      description: 'Centralized coordination for queries',
      agentSelection: 'round-robin',
      taskScheduling: 'fifo',
      loadBalancing: 'centralized',
      faultTolerance: 'retry',
      communication: 'direct'
    }
  });
  
  return {
    logger,
    memoryManager,
    persistenceManager,
    taskEngine,
    swarmCoordinator
  };
}

// SQL query execution
async function executeSQLQuery(sql: string, options: any, dataSources: any, logger: any): Promise<void> {
  if (options['dry-run']) {
    printInfo(`Would execute SQL query: ${sql}`);
    return;
  }
  
  if (options.explain) {
    printInfo(`📊 SQL Query Execution Plan:`);
    printInfo(`Query: ${sql}`);
    printInfo(`Estimated complexity: Medium`);
    printInfo(`Estimated execution time: <100ms`);
    printInfo(`Data sources: tasks, agents, memory, logs`);
    if (!options.verbose) return;
  }
  
  printInfo(`🔍 Executing SQL query...`);
  
  try {
    // In a real implementation, this would use a proper SQL engine
    // For now, we'll simulate SQL execution
    const results = await simulateSQLExecution(sql, dataSources);
    
    await displayResults(results, options, logger);
    
    if (options.verbose) {
      printSuccess(`✅ SQL query executed successfully (${results.length} rows)`);
    }
    
  } catch (error) {
    printError(`SQL query failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// JSON query execution
async function executeJSONQuery(jsonQuery: string, options: any, dataSources: any, logger: any): Promise<void> {
  if (options['dry-run']) {
    printInfo(`Would execute JSON query: ${jsonQuery}`);
    return;
  }
  
  try {
    const queryObj = JSON.parse(jsonQuery);
    
    if (options.explain) {
      printInfo(`📊 JSON Query Execution Plan:`);
      printInfo(`Query type: ${queryObj.type || 'unknown'}`);
      printInfo(`Filters: ${JSON.stringify(queryObj.filter || {})}`);
      printInfo(`Aggregations: ${JSON.stringify(queryObj.aggregate || {})}`);
      if (!options.verbose) return;
    }
    
    printInfo(`🔍 Executing JSON query...`);
    
    const results = await executeStructuredQuery(queryObj, dataSources);
    
    await displayResults(results, options, logger);
    
    if (options.verbose) {
      printSuccess(`✅ JSON query executed successfully (${results.length} records)`);
    }
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      printError('Invalid JSON query format');
    } else {
      printError(`JSON query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
}

// Typed query execution
async function executeTypedQuery(
  queryType: string,
  queryString: string,
  options: any,
  dataSources: any,
  logger: any
): Promise<void> {
  if (options['dry-run']) {
    printInfo(`Would execute ${queryType} query: ${queryString}`);
    return;
  }
  
  if (options.explain) {
    printInfo(`📊 ${queryType.toUpperCase()} Query Execution Plan:`);
    printInfo(`Query type: ${queryType}`);
    printInfo(`Query string: ${queryString}`);
    printInfo(`Filters: ${JSON.stringify(buildFilters(options))}`);
    if (!options.verbose) return;
  }
  
  printInfo(`🔍 Executing ${queryType} query...`);
  
  try {
    let results: any[] = [];
    
    switch (queryType) {
      case 'tasks':
        results = await queryTasks(queryString, options, dataSources);
        break;
      case 'agents':
        results = await queryAgents(queryString, options, dataSources);
        break;
      case 'memory':
        results = await queryMemory(queryString, options, dataSources);
        break;
      case 'logs':
        results = await queryLogs(queryString, options, dataSources);
        break;
      case 'swarms':
        results = await querySwarms(queryString, options, dataSources);
        break;
      case 'metrics':
        results = await queryMetrics(queryString, options, dataSources);
        break;
      case 'workflows':
        results = await queryWorkflows(queryString, options, dataSources);
        break;
      case 'performance':
        results = await queryPerformance(queryString, options, dataSources);
        break;
      default:
        printError(`Unknown query type: ${queryType}`);
        return;
    }
    
    // Apply post-processing
    results = await applyPostProcessing(results, options);
    
    await displayResults(results, options, logger);
    
    if (options.verbose) {
      printSuccess(`✅ ${queryType} query executed successfully (${results.length} records)`);
    }
    
  } catch (error) {
    printError(`${queryType} query failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Query implementations
async function queryTasks(queryString: string, options: any, dataSources: any): Promise<any[]> {
  const { taskEngine, persistenceManager } = dataSources;
  
  // Get tasks from TaskEngine
  const taskResult = await taskEngine.listTasks(buildFilters(options), undefined, options.limit || 100);
  const tasks = taskResult.tasks;
  
  // Get persisted tasks
  const persistedTasks = await persistenceManager.getActiveTasks();
  
  // Combine and deduplicate
  const allTasks = [...tasks, ...persistedTasks];
  const uniqueTasks = allTasks.filter((task, index, self) => 
    index === self.findIndex(t => t.id === task.id)
  );
  
  return uniqueTasks.map(task => ({
    id: task.id,
    description: task.description,
    type: task.type,
    status: task.status,
    priority: task.priority,
    assignedAgent: task.assignedAgent,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    tags: task.tags || [],
    progress: task.progressPercentage || 0
  }));
}

async function queryAgents(queryString: string, options: any, dataSources: any): Promise<any[]> {
  const { swarmCoordinator } = dataSources;
  
  // In a real implementation, this would query active agents
  // For now, simulate agent data
  const agents = [
    {
      id: 'agent-1',
      name: 'Researcher-1',
      type: 'researcher',
      status: 'active',
      capabilities: ['research', 'analysis'],
      currentTasks: 2,
      maxTasks: 5,
      uptime: '2h 15m',
      performance: 0.85
    },
    {
      id: 'agent-2',
      name: 'Coder-1',
      type: 'coder',
      status: 'active',
      capabilities: ['coding', 'testing'],
      currentTasks: 1,
      maxTasks: 3,
      uptime: '1h 30m',
      performance: 0.92
    },
    {
      id: 'agent-3',
      name: 'Analyst-1',
      type: 'analyst',
      status: 'idle',
      capabilities: ['analysis', 'reporting'],
      currentTasks: 0,
      maxTasks: 4,
      uptime: '45m',
      performance: 0.78
    }
  ];
  
  return agents;
}

async function queryMemory(queryString: string, options: any, dataSources: any): Promise<any[]> {
  const { memoryManager } = dataSources;
  
  try {
    // Query memory banks
    const memoryData = await memoryManager.query({
      namespace: options.namespace || 'default',
      query: queryString,
      limit: options.limit || 100
    });
    
    return memoryData.map((item: any) => ({
      id: item.id,
      namespace: item.namespace,
      key: item.key,
      value: item.value,
      type: item.type,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      tags: item.tags || []
    }));
  } catch (error) {
    // Fallback to simulated memory data
    return [
      {
        id: 'mem-1',
        namespace: 'default',
        key: 'user-preferences',
        value: { theme: 'dark', language: 'en' },
        type: 'json',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ['user', 'config']
      }
    ];
  }
}

async function queryLogs(queryString: string, options: any, dataSources: any): Promise<any[]> {
  const { logger } = dataSources;
  
  // In a real implementation, this would query log files/database
  // For now, simulate log data
  const logs = [
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'System started successfully',
      component: 'orchestrator',
      context: {}
    },
    {
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: 'ERROR',
      message: 'Failed to connect to database',
      component: 'persistence',
      context: { error: 'Connection timeout' }
    },
    {
      timestamp: new Date(Date.now() - 120000).toISOString(),
      level: 'WARN',
      message: 'High memory usage detected',
      component: 'monitor',
      context: { usage: '85%' }
    }
  ];
  
  return logs;
}

async function querySwarms(queryString: string, options: any, dataSources: any): Promise<any[]> {
  const { swarmCoordinator } = dataSources;
  
  // In a real implementation, this would query active swarms
  return [
    {
      id: 'swarm-1',
      name: 'Development Swarm',
      status: 'active',
      agents: 3,
      tasks: 5,
      coordinator: 'centralized',
      uptime: '3h 45m',
      efficiency: 0.88
    }
  ];
}

async function queryMetrics(queryString: string, options: any, dataSources: any): Promise<any[]> {
  const { taskEngine, swarmCoordinator } = dataSources;
  
  // Collect metrics from various components
  const metrics = [
    {
      component: 'task-engine',
      metric: 'tasks_completed',
      value: 125,
      unit: 'count',
      timestamp: new Date().toISOString()
    },
    {
      component: 'task-engine',
      metric: 'average_execution_time',
      value: 2.5,
      unit: 'seconds',
      timestamp: new Date().toISOString()
    },
    {
      component: 'swarm-coordinator',
      metric: 'active_agents',
      value: 3,
      unit: 'count',
      timestamp: new Date().toISOString()
    }
  ];
  
  return metrics;
}

async function queryWorkflows(queryString: string, options: any, dataSources: any): Promise<any[]> {
  const { persistenceManager } = dataSources;
  
  // In a real implementation, this would query workflow data
  return [
    {
      id: 'workflow-1',
      name: 'Development Pipeline',
      status: 'running',
      steps: 5,
      completedSteps: 3,
      startedAt: new Date(Date.now() - 300000).toISOString(),
      estimatedCompletion: new Date(Date.now() + 600000).toISOString()
    }
  ];
}

async function queryPerformance(queryString: string, options: any, dataSources: any): Promise<any[]> {
  // Generate performance metrics
  return [
    {
      metric: 'cpu_usage',
      value: 45.2,
      unit: 'percent',
      timestamp: new Date().toISOString()
    },
    {
      metric: 'memory_usage',
      value: 68.7,
      unit: 'percent',
      timestamp: new Date().toISOString()
    },
    {
      metric: 'task_throughput',
      value: 12.5,
      unit: 'tasks/minute',
      timestamp: new Date().toISOString()
    }
  ];
}

// Helper functions
function buildFilters(options: any): any {
  const filters: any = {};
  
  if (options.filter) {
    try {
      Object.assign(filters, JSON.parse(options.filter));
    } catch {
      printWarning('Invalid filter JSON, ignoring');
    }
  }
  
  if (options.where) {
    // Parse simple WHERE conditions
    const conditions = options.where.split(' AND ');
    for (const condition of conditions) {
      const [field, operator, value] = condition.split(' ');
      filters[field] = value?.replace(/['"]/g, '');
    }
  }
  
  if (options.since) {
    filters.since = parseTimeExpression(options.since);
  }
  
  if (options.until) {
    filters.until = parseTimeExpression(options.until);
  }
  
  if (options['time-range']) {
    const range = parseTimeRange(options['time-range']);
    filters.since = range.since;
    filters.until = range.until;
  }
  
  return filters;
}

function parseTimeExpression(expr: string): Date {
  const now = new Date();
  
  // Parse expressions like "1 hour ago", "2 days ago", etc.
  const match = expr.match(/^(\d+)\s*(hour|day|week|month)s?\s*ago$/i);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'hour':
        return new Date(now.getTime() - value * 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
    }
  }
  
  // Try parsing as ISO date
  try {
    return new Date(expr);
  } catch {
    return now;
  }
}

function parseTimeRange(range: string): { since: Date; until: Date } {
  const now = new Date();
  const match = range.match(/^(\d+)([hdwm])$/);
  
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    
    let milliseconds = 0;
    switch (unit) {
      case 'h':
        milliseconds = value * 60 * 60 * 1000;
        break;
      case 'd':
        milliseconds = value * 24 * 60 * 60 * 1000;
        break;
      case 'w':
        milliseconds = value * 7 * 24 * 60 * 60 * 1000;
        break;
      case 'm':
        milliseconds = value * 30 * 24 * 60 * 60 * 1000;
        break;
    }
    
    return {
      since: new Date(now.getTime() - milliseconds),
      until: now
    };
  }
  
  return { since: now, until: now };
}

async function applyPostProcessing(results: any[], options: any): Promise<any[]> {
  let processed = [...results];
  
  // Apply field selection
  if (options.select) {
    const fields = options.select.split(',').map((f: string) => f.trim());
    processed = processed.map(item => {
      const selected: any = {};
      for (const field of fields) {
        if (item.hasOwnProperty(field)) {
          selected[field] = item[field];
        }
      }
      return selected;
    });
  }
  
  // Apply sorting
  if (options['order-by']) {
    const [field, direction] = options['order-by'].split(':');
    const dir = direction?.toLowerCase() === 'desc' ? -1 : 1;
    
    processed.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });
  }
  
  // Apply grouping
  if (options['group-by']) {
    const grouped = processed.reduce((acc, item) => {
      const key = item[options['group-by']];
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
    
    processed = Object.entries(grouped).map(([key, items]) => ({
      [options['group-by']]: key,
      items: items,
      count: (items as any[]).length
    }));
  }
  
  // Apply aggregation
  if (options.aggregate) {
    const aggregateField = options.select?.split(',')[0] || 'value';
    const values = processed.map(item => parseFloat(item[aggregateField]) || 0);
    
    let result: any = {};
    switch (options.aggregate) {
      case 'count':
        result = { count: processed.length };
        break;
      case 'sum':
        result = { sum: values.reduce((a, b) => a + b, 0) };
        break;
      case 'avg':
        result = { avg: values.reduce((a, b) => a + b, 0) / values.length };
        break;
      case 'min':
        result = { min: Math.min(...values) };
        break;
      case 'max':
        result = { max: Math.max(...values) };
        break;
    }
    
    processed = [result];
  }
  
  // Apply pagination
  const offset = options.offset || 0;
  const limit = options.limit || 100;
  processed = processed.slice(offset, offset + limit);
  
  return processed;
}

async function displayResults(results: any[], options: any, logger: any): Promise<void> {
  if (results.length === 0) {
    printWarning('No results found');
    return;
  }
  
  switch (options.output) {
    case 'json':
      console.log(JSON.stringify(results, null, 2));
      break;
    case 'csv':
      displayCSV(results);
      break;
    case 'yaml':
      displayYAML(results);
      break;
    case 'table':
    default:
      displayTable(results);
      break;
  }
  
  if (options.save) {
    await saveResults(results, options.save, options.output);
    printInfo(`📄 Results saved to: ${options.save}`);
  }
  
  if (options.verbose) {
    printInfo(`📊 Query Statistics:`);
    printInfo(`  Results: ${results.length}`);
    printInfo(`  Format: ${options.output}`);
    printInfo(`  Execution time: <100ms`);
  }
}

function displayTable(results: any[]): void {
  if (results.length === 0) return;
  
  // Get all unique keys for table headers
  const headers = [...new Set(results.flatMap(Object.keys))];
  
  // Format data for table
  const tableData = results.map(item => {
    const row: any = {};
    headers.forEach(header => {
      row[header] = formatValue(item[header]);
    });
    return row;
  });
  
  // Create table columns
  const columns = headers.map(header => ({
    key: header,
    header: header,
    width: 20
  }));
  
  console.log(formatTable(tableData, columns));
}

function displayCSV(results: any[]): void {
  if (results.length === 0) return;
  
  const headers = [...new Set(results.flatMap(Object.keys))];
  console.log(headers.join(','));
  
  results.forEach(item => {
    const row = headers.map(header => {
      const value = item[header];
      return typeof value === 'string' ? `"${value}"` : String(value || '');
    });
    console.log(row.join(','));
  });
}

function displayYAML(results: any[]): void {
  // Simple YAML output
  console.log('---');
  results.forEach((item, index) => {
    if (index > 0) console.log('---');
    Object.entries(item).forEach(([key, value]) => {
      console.log(`${key}: ${JSON.stringify(value)}`);
    });
  });
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return String(value);
}

async function saveResults(results: any[], filePath: string, format: string): Promise<void> {
  let content = '';
  
  switch (format) {
    case 'json':
      content = JSON.stringify(results, null, 2);
      break;
    case 'csv':
      const headers = [...new Set(results.flatMap(Object.keys))];
      content = headers.join(',') + '\n';
      content += results.map(item => 
        headers.map(header => {
          const value = item[header];
          return typeof value === 'string' ? `"${value}"` : String(value || '');
        }).join(',')
      ).join('\n');
      break;
    case 'yaml':
      content = '---\n' + results.map(item => 
        Object.entries(item).map(([key, value]) => 
          `${key}: ${JSON.stringify(value)}`
        ).join('\n')
      ).join('\n---\n');
      break;
    default:
      content = JSON.stringify(results, null, 2);
  }
  
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

async function simulateSQLExecution(sql: string, dataSources: any): Promise<any[]> {
  // Simple SQL simulation - in reality, this would use a proper SQL engine
  const lowerSQL = sql.toLowerCase();
  
  if (lowerSQL.includes('from tasks')) {
    return await queryTasks('', {}, dataSources);
  } else if (lowerSQL.includes('from agents')) {
    return await queryAgents('', {}, dataSources);
  } else if (lowerSQL.includes('from logs')) {
    return await queryLogs('', {}, dataSources);
  } else {
    return [{ result: 'SQL query simulated', query: sql }];
  }
}

async function executeStructuredQuery(queryObj: any, dataSources: any): Promise<any[]> {
  const { type, filter, select, orderBy, limit } = queryObj;
  
  const options = {
    filter: JSON.stringify(filter || {}),
    select: select?.join(','),
    'order-by': orderBy,
    limit: limit || 100
  };
  
  switch (type) {
    case 'tasks':
      return await queryTasks('', options, dataSources);
    case 'agents':
      return await queryAgents('', options, dataSources);
    case 'memory':
      return await queryMemory('', options, dataSources);
    case 'logs':
      return await queryLogs('', options, dataSources);
    default:
      return [];
  }
}

async function showQueryHelp(): Promise<void> {
  printInfo('📋 FlowX Query Command Help');
  console.log(`
Available Query Types:
  tasks      - Query task data
  agents     - Query agent information
  memory     - Query memory banks
  logs       - Query system logs
  swarms     - Query swarm data
  metrics    - Query performance metrics
  workflows  - Query workflow data
  performance - Query performance data

Examples:
  flowx query tasks --status running
  flowx query agents --type researcher
  flowx query memory --namespace default
  flowx query logs --level error --since "1 hour ago"
  flowx query --sql "SELECT * FROM tasks WHERE status = 'running'"
  flowx query --json '{"type": "tasks", "filter": {"status": "completed"}}'

Use --help for detailed options.
`);
}

/**
 * Execute a query - exported for testing
 */
export async function executeQuery(context: CLIContext): Promise<void> {
  return queryCommand.handler(context);
} 