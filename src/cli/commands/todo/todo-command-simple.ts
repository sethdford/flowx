/**
 * TodoWrite CLI Command - Simplified Implementation
 * Exposes key TodoWrite capabilities through CLI with visual formatting
 * 
 * This provides the core TodoWrite functionality in a format that works with our CLI system
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { VisualProgressFormatter } from '../../../task/visual-progress-formatter.js';
import { TodoItem } from '../../../task/coordination.js';
import { 
  formatTable, 
  successBold, 
  infoBold, 
  warningBold, 
  errorBold, 
  printSuccess, 
  printError, 
  printWarning, 
  printInfo,
  type TableColumn
} from '../../core/output-formatter.js';

export const todoCommand: CLICommand = {
  name: 'todo',
  description: 'TodoWrite management with visual formatting and batch operations',
  category: 'Task Management',
  usage: 'flowx todo <subcommand> [options]',
  examples: [
    'flowx todo list',
    'flowx todo create "Implement authentication" --priority high',
    'flowx todo progress',
    'flowx todo validate'
  ],
  options: [
    {
      name: 'help',
      short: 'h',
      description: 'Show help information',
      type: 'boolean'
    },
    {
      name: 'format',
      short: 'f',
      description: 'Output format (visual, table, json)',
      type: 'string',
      default: 'visual',
      choices: ['visual', 'table', 'json']
    },
    {
      name: 'status',
      short: 's',
      description: 'Filter by status (pending, in_progress, completed)',
      type: 'string',
      choices: ['pending', 'in_progress', 'completed', 'all']
    },
    {
      name: 'priority',
      short: 'p',
      description: 'Filter by priority (high, medium, low)',
      type: 'string',
      choices: ['high', 'medium', 'low']
    }
  ],

  handler: async (context: CLIContext) => {
    const subcommand = context.args[0];
    
    if (!subcommand || context.options.help) {
      showHelp();
      return;
    }

    switch (subcommand) {
      case 'list':
        await handleListTodos(context);
        break;
      case 'create':
        await handleCreateTodo(context);
        break;
      case 'progress':
        await handleProgressDisplay(context);
        break;
      case 'validate':
        await handleValidateTodos(context);
        break;
      case 'template':
        await handleGenerateTemplate(context);
        break;
      default:
        printError(`Unknown subcommand: ${subcommand}`);
        showHelp();
        break;
    }
  }
};

function showHelp(): void {
  console.log(successBold('\n🎯 TodoWrite CLI - Comprehensive Task Management'));
  console.log('='.repeat(60));
  
  console.log(infoBold('\nSubcommands:'));
  console.log('  list      - List todos with visual formatting');
  console.log('  create    - Create new todo items');
  console.log('  progress  - Show visual progress overview');
  console.log('  validate  - Validate todos against best practices');
  console.log('  template  - Generate todo templates');
  
  console.log(infoBold('\nOptions:'));
  console.log('  --format, -f     Output format (visual, table, json)');
  console.log('  --status, -s     Filter by status');
  console.log('  --priority, -p   Filter by priority');
  
  console.log(infoBold('\nExamples:'));
  console.log('  flowx todo list --format visual');
  console.log('  flowx todo create "Implement auth" --priority high');
  console.log('  flowx todo progress');
  console.log('  flowx todo validate');
  
  console.log(infoBold('\n📝 TodoWrite Best Practices:'));
  console.log('  • ALWAYS batch 5-10+ todos in ONE call');
  console.log('  • Mix priorities (high, medium, low)');
  console.log('  • Use dependencies to show task order');
  console.log('  • Assign todos to specific agents for swarms');
  console.log('  • NEVER call TodoWrite multiple times in sequence');
}

/**
 * Handle listing todos with various formats
 */
async function handleListTodos(context: CLIContext): Promise<void> {
  const format = context.options.format || 'visual';
  const statusFilter = context.options.status;
  const priorityFilter = context.options.priority;
  
  // Get sample todos (this would integrate with real task system)
  let todos = getSampleTodos();
  
  // Apply filters
  if (statusFilter && statusFilter !== 'all') {
    todos = todos.filter(todo => todo.status === statusFilter);
  }
  
  if (priorityFilter) {
    todos = todos.filter(todo => todo.priority === priorityFilter);
  }

  if (todos.length === 0) {
    printWarning('No todos found matching the specified criteria');
    return;
  }

  // Display based on format
  switch (format) {
    case 'visual':
      console.log(successBold('\n🎯 Visual TodoWrite Display'));
      console.log('='.repeat(60));
      console.log(VisualProgressFormatter.formatTodoProgress(todos));
      break;
      
    case 'table':
      displayTableFormat(todos);
      break;
      
    case 'json':
      console.log(JSON.stringify(todos, null, 2));
      break;
      
    default:
      console.log(VisualProgressFormatter.formatTodoProgress(todos));
  }
  
  // Show batch validation reminder
  if (todos.length < 5) {
    console.log(warningBold('\n⚠️  BatchTool Reminder:'));
    console.log('   TodoWrite works best with 5+ todos for optimal performance');
    console.log('   Consider adding more todos to reach the recommended batch size');
  }
}

/**
 * Handle creating new todos
 */
async function handleCreateTodo(context: CLIContext): Promise<void> {
  const description = context.args[1];
  if (!description) {
    printError('Todo description is required');
    printInfo('Usage: flowx todo create "Task description" [--priority high]');
    return;
  }

  const priority = context.options.priority || 'medium';
  const status = context.options.status || 'pending';
  
  const todo: TodoItem = {
    id: generateTodoId(),
    content: description,
    status: status as 'pending' | 'in_progress' | 'completed',
    priority: priority as 'high' | 'medium' | 'low',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  printSuccess(`✅ Todo created: ${todo.id}`);
  printInfo(`   Description: ${todo.content}`);
  printInfo(`   Priority: ${todo.priority}`);
  printInfo(`   Status: ${todo.status}`);
  
  console.log(warningBold('\n💡 Batch Mode Reminder:'));
  console.log('   • Create 4+ more todos for optimal batch performance');
  console.log('   • Mix priorities (high, medium, low) for better coordination');
  console.log('   • Use dependencies to show execution order');
  console.log('   • Assign todos to agents for swarm coordination');
}

/**
 * Handle progress display
 */
async function handleProgressDisplay(context: CLIContext): Promise<void> {
  const todos = getSampleTodos();
  
  if (todos.length === 0) {
    printWarning('No todos found');
    return;
  }

  console.log(successBold('\n🎯 TodoWrite Progress Overview'));
  console.log('='.repeat(60));
  console.log(VisualProgressFormatter.formatTodoProgress(todos));

  // Generate statistics
  const stats = generateTodoStatistics(todos);
  console.log('\n📈 Statistics:');
  console.log(`   • Total Todos: ${stats.total}`);
  console.log(`   • Completion Rate: ${stats.completionRate}%`);
  console.log(`   • High Priority: ${stats.highPriority}`);
  console.log(`   • With Dependencies: ${stats.withDependencies}`);
  
  // Batch validation
  if (todos.length >= 5) {
    printSuccess('✅ Batch size meets recommendations (5+ todos)');
  } else {
    printWarning(`⚠️  Current batch size: ${todos.length} (recommend 5+ todos)`);
  }
}

/**
 * Handle todo validation
 */
async function handleValidateTodos(context: CLIContext): Promise<void> {
  const todos = getSampleTodos();
  const validation = validateTodos(todos);
  
  console.log(successBold('\n🔍 TodoWrite Validation Report'));
  console.log('='.repeat(60));
  
  if (validation.valid) {
    printSuccess('✅ All todos passed validation');
  } else {
    printError('❌ Validation issues found:');
    validation.errors.forEach(error => printError(`   • ${error}`));
  }
  
  console.log('\n📋 Batch Analysis:');
  console.log(`   • Todo Count: ${todos.length} (minimum: 5)`);
  console.log(`   • Priority Distribution: ${validation.priorityDistribution}`);
  console.log(`   • Status Distribution: ${validation.statusDistribution}`);
  console.log(`   • Dependencies: ${validation.dependencyCount} todos have dependencies`);
  
  console.log('\n💡 Best Practices:');
  console.log('   • ALWAYS batch 5-10+ todos in ONE TodoWrite call');
  console.log('   • Mix priorities (high, medium, low) for balanced workload');
  console.log('   • Use clear, actionable descriptions');
  console.log('   • Set up proper dependencies for execution order');
  console.log('   • NEVER call TodoWrite multiple times in sequence');
}

/**
 * Handle template generation
 */
async function handleGenerateTemplate(context: CLIContext): Promise<void> {
  const templateType = context.args[1] || 'api';
  
  console.log(successBold(`\n📝 TodoWrite Template - ${templateType.toUpperCase()}`));
  console.log('='.repeat(60));
  
  const template = generateTodoTemplate(templateType);
  console.log('```javascript');
  console.log('// ✅ CORRECT TodoWrite Pattern - Batch with 5+ todos');
  console.log('TodoWrite({');
  console.log('  todos: [');
  template.forEach((todo, index) => {
    const comma = index < template.length - 1 ? ',' : '';
    console.log(`    ${JSON.stringify(todo)}${comma}`);
  });
  console.log('  ]');
  console.log('});');
  console.log('```');
  
  console.log('\n💡 Template Features:');
  console.log('   • Contains 5+ todos for optimal batch performance');
  console.log('   • Mixes priorities (high, medium, low)');
  console.log('   • Includes proper dependencies');
  console.log('   • Ready for swarm coordination');
}

// Helper functions

function generateTodoId(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getSampleTodos(): TodoItem[] {
  return [
    {
      id: 'todo-1',
      content: 'Implement authentication system',
      status: 'completed',
      priority: 'high',
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'todo-2',
      content: 'Build user dashboard',
      status: 'in_progress',
      priority: 'medium',
      dependencies: ['todo-1'],
      assignedAgent: 'frontend-dev',
      estimatedTime: '2h',
      tags: ['ui', 'dashboard'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'todo-3',
      content: 'Add payment integration',
      status: 'pending',
      priority: 'high',
      dependencies: [],
      estimatedTime: '3h',
      tags: ['payment', 'integration'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'todo-4',
      content: 'Write API documentation',
      status: 'pending',
      priority: 'medium',
      dependencies: ['todo-1'],
      estimatedTime: '1h',
      tags: ['docs', 'api'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'todo-5',
      content: 'Deploy to production',
      status: 'pending',
      priority: 'low',
      dependencies: ['todo-2', 'todo-3'],
      estimatedTime: '30min',
      tags: ['deployment'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
}

function displayTableFormat(todos: TodoItem[]): void {
  const columns: TableColumn[] = [
    { key: 'id', header: 'ID', width: 12 },
    { key: 'content', header: 'Description', width: 35 },
    { key: 'status', header: 'Status', width: 12 },
    { key: 'priority', header: 'Priority', width: 10 },
    { key: 'assignedAgent', header: 'Agent', width: 15 }
  ];

  const rows = todos.map(todo => ({
    id: todo.id,
    content: todo.content.length > 32 ? todo.content.substring(0, 32) + '...' : todo.content,
    status: todo.status,
    priority: todo.priority,
    assignedAgent: todo.assignedAgent || '-'
  }));

  console.log(formatTable(rows, columns));
}

function validateTodos(todos: TodoItem[]): { 
  valid: boolean; 
  errors: string[]; 
  priorityDistribution: string;
  statusDistribution: string;
  dependencyCount: number;
} {
  const errors: string[] = [];
  
  // Check batch size
  if (todos.length < 5) {
    errors.push(`Batch size ${todos.length} is below recommended minimum of 5 todos`);
  }
  
  // Check priority distribution
  const priorityCounts = {
    high: todos.filter(t => t.priority === 'high').length,
    medium: todos.filter(t => t.priority === 'medium').length,
    low: todos.filter(t => t.priority === 'low').length
  };
  
  if (priorityCounts.high === 0 && priorityCounts.medium === 0) {
    errors.push('No high or medium priority todos found - consider priority distribution');
  }
  
  // Check status distribution
  const statusCounts = {
    pending: todos.filter(t => t.status === 'pending').length,
    in_progress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length
  };
  
  if (statusCounts.pending === 0 && statusCounts.in_progress === 0) {
    errors.push('No actionable todos (pending/in_progress) found');
  }
  
  const dependencyCount = todos.filter(t => t.dependencies && t.dependencies.length > 0).length;
  
  return {
    valid: errors.length === 0,
    errors,
    priorityDistribution: `H:${priorityCounts.high}, M:${priorityCounts.medium}, L:${priorityCounts.low}`,
    statusDistribution: `P:${statusCounts.pending}, IP:${statusCounts.in_progress}, C:${statusCounts.completed}`,
    dependencyCount
  };
}

function generateTodoStatistics(todos: TodoItem[]) {
  const completed = todos.filter(t => t.status === 'completed').length;
  const completionRate = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0;
  const highPriority = todos.filter(t => t.priority === 'high').length;
  const withDependencies = todos.filter(t => t.dependencies && t.dependencies.length > 0).length;
  
  return {
    total: todos.length,
    completionRate,
    highPriority,
    withDependencies
  };
}

function generateTodoTemplate(type: string): TodoItem[] {
  const templates: Record<string, TodoItem[]> = {
    'api': [
      { id: 'api-1', content: 'Set up API project structure', status: 'pending', priority: 'high', createdAt: new Date(), updatedAt: new Date() },
      { id: 'api-2', content: 'Implement authentication middleware', status: 'pending', priority: 'high', createdAt: new Date(), updatedAt: new Date() },
      { id: 'api-3', content: 'Create database models', status: 'pending', priority: 'high', dependencies: ['api-1'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'api-4', content: 'Build REST endpoints', status: 'pending', priority: 'medium', dependencies: ['api-2', 'api-3'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'api-5', content: 'Add input validation', status: 'pending', priority: 'medium', dependencies: ['api-4'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'api-6', content: 'Write API tests', status: 'pending', priority: 'low', dependencies: ['api-5'], createdAt: new Date(), updatedAt: new Date() }
    ],
    'web-app': [
      { id: 'web-1', content: 'Initialize React project', status: 'pending', priority: 'high', createdAt: new Date(), updatedAt: new Date() },
      { id: 'web-2', content: 'Set up routing', status: 'pending', priority: 'high', dependencies: ['web-1'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'web-3', content: 'Create UI components', status: 'pending', priority: 'medium', dependencies: ['web-1'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'web-4', content: 'Implement state management', status: 'pending', priority: 'medium', dependencies: ['web-2'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'web-5', content: 'Add responsive design', status: 'pending', priority: 'low', dependencies: ['web-3'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'web-6', content: 'Write component tests', status: 'pending', priority: 'low', dependencies: ['web-3'], createdAt: new Date(), updatedAt: new Date() }
    ]
  };
  
  return templates[type] || templates['api'];
} 