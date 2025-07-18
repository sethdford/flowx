/**
 * Visual Progress Formatter
 * Implements the visual progress display format with emoji indicators and hierarchical task visualization
 * Based on original flowx best practices with modern TypeScript implementation
 */

import { TodoItem } from './coordination.js';
import { WorkflowTask } from './engine.js';

export interface ProgressOverview {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  percentages: {
    completed: number;
    inProgress: number;
    pending: number;
    blocked: number;
  };
}

export interface VisualTaskGroup {
  status: 'completed' | 'in_progress' | 'pending' | 'blocked';
  tasks: Array<{
    id: string;
    content: string;
    priority: 'low' | 'medium' | 'high';
    dependencies?: number;
    actionable: boolean;
  }>;
}

export interface FormattingOptions {
  maxTasksPerGroup?: number;
  showDependencies?: boolean;
  showPriorities?: boolean;
  compactMode?: boolean;
  colorSupport?: boolean;
}

export class VisualProgressFormatter {
  private static readonly PRIORITY_ICONS = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  } as const;

  private static readonly STATUS_ICONS = {
    completed: '✅',
    in_progress: '🔄',
    pending: '⭕',
    blocked: '❌'
  } as const;

  private static readonly TREE_CHARS = {
    pipe: '├──',
    lastPipe: '└──',
    space: '   ',
    continuation: '│  '
  } as const;

  /**
   * Format TodoItems into visual progress display
   */
  static formatTodoProgress(
    todos: TodoItem[],
    options: FormattingOptions = {}
  ): string {
    const overview = this.calculateOverview(todos);
    const groups = this.groupTodosByStatus(todos);
    
    let output = this.formatProgressOverview(overview);
    output += '\n\n';
    
    // Format each status group
    const statusOrder: Array<keyof typeof this.STATUS_ICONS> = ['pending', 'in_progress', 'completed', 'blocked'];
    
    for (const status of statusOrder) {
      if (groups[status] && groups[status].tasks.length > 0) {
        output += this.formatTaskGroup(status, groups[status], options);
        output += '\n\n';
      }
    }
    
    return output.trim();
  }

  /**
   * Format WorkflowTasks into visual progress display
   */
  static formatTaskProgress(
    tasks: WorkflowTask[],
    options: FormattingOptions = {}
  ): string {
    // Convert WorkflowTasks to TodoItem format for consistent display
    const todos: TodoItem[] = tasks.map(task => ({
      id: task.id,
      content: task.description,
      status: this.mapTaskStatusToTodoStatus(task.status),
      priority: this.mapTaskPriorityToTodoPriority(task.priority),
      dependencies: task.dependencies?.map(dep => dep.taskId) || [],
      assignedAgent: task.assignedAgent,
      tags: task.tags,
      metadata: task.metadata,
      createdAt: task.createdAt,
      updatedAt: new Date()
    }));

    return this.formatTodoProgress(todos, options);
  }

  /**
   * Format compact progress overview
   */
  static formatProgressOverview(overview: ProgressOverview): string {
    const { total, completed, inProgress, pending, blocked, percentages } = overview;
    
    return `📊 Progress Overview
   ├── Total Tasks: ${total}
   ├── ${this.STATUS_ICONS.completed} Completed: ${completed} (${percentages.completed}%)
   ├── ${this.STATUS_ICONS.in_progress} In Progress: ${inProgress} (${percentages.inProgress}%)
   ├── ${this.STATUS_ICONS.pending} Todo: ${pending} (${percentages.pending}%)
   └── ${this.STATUS_ICONS.blocked} Blocked: ${blocked} (${percentages.blocked}%)`;
  }

  /**
   * Format a task group with hierarchical display
   */
  private static formatTaskGroup(
    status: keyof typeof this.STATUS_ICONS,
    group: VisualTaskGroup,
    options: FormattingOptions = {}
  ): string {
    const { maxTasksPerGroup = 10 } = options;
    const statusIcon = this.STATUS_ICONS[status];
    const statusLabel = this.capitalizeStatus(status);
    const taskCount = group.tasks.length;
    
    let output = `${statusIcon} ${statusLabel} (${taskCount})`;
    
    if (taskCount === 0) {
      return output + '\n   └── No tasks';
    }
    
    const tasksToShow = group.tasks.slice(0, maxTasksPerGroup);
    const hasMore = group.tasks.length > maxTasksPerGroup;
    
    for (let i = 0; i < tasksToShow.length; i++) {
      const task = tasksToShow[i];
      const isLast = i === tasksToShow.length - 1 && !hasMore;
      const prefix = isLast ? this.TREE_CHARS.lastPipe : this.TREE_CHARS.pipe;
      
      output += '\n   ';
      output += prefix;
      output += ' ';
      
      // Priority indicator
      if (options.showPriorities !== false) {
        output += this.PRIORITY_ICONS[task.priority];
        output += ' ';
      }
      
      // Task ID and content
      output += `${task.id}: ${task.content}`;
      
      // Dependencies indicator
      if (options.showDependencies !== false && task.dependencies && task.dependencies > 0) {
        output += ` ↳ ${task.dependencies} deps`;
      }
      
      // Priority label for high priority
      if (task.priority === 'high') {
        output += ` [${task.priority.toUpperCase()}]`;
      }
      
      // Actionable indicator
      if (task.actionable && status === 'pending') {
        output += ' ▶';
      }
      
      // Blocked indicator
      if (status === 'blocked') {
        output += ' [BLOCKED]';
      }
    }
    
    // Show truncation message if needed
    if (hasMore) {
      output += '\n   ';
      output += this.TREE_CHARS.lastPipe;
      output += ` ... (${group.tasks.length - maxTasksPerGroup} more tasks)`;
    }
    
    return output;
  }

  /**
   * Calculate progress overview statistics
   */
  private static calculateOverview(todos: TodoItem[]): ProgressOverview {
    const total = todos.length;
    const completed = todos.filter(t => t.status === 'completed').length;
    const inProgress = todos.filter(t => t.status === 'in_progress').length;
    const pending = todos.filter(t => t.status === 'pending').length;
    const blocked = total - completed - inProgress - pending; // Any other status is considered blocked
    
    const percentages = {
      completed: total > 0 ? Math.round((completed / total) * 100) : 0,
      inProgress: total > 0 ? Math.round((inProgress / total) * 100) : 0,
      pending: total > 0 ? Math.round((pending / total) * 100) : 0,
      blocked: total > 0 ? Math.round((blocked / total) * 100) : 0
    };
    
    return {
      total,
      completed,
      inProgress,
      pending,
      blocked,
      percentages
    };
  }

  /**
   * Group todos by status for organized display
   */
  private static groupTodosByStatus(todos: TodoItem[]): Record<string, VisualTaskGroup> {
    const groups: Record<string, VisualTaskGroup> = {
      completed: { status: 'completed', tasks: [] },
      in_progress: { status: 'in_progress', tasks: [] },
      pending: { status: 'pending', tasks: [] },
      blocked: { status: 'blocked', tasks: [] }
    };
    
    for (const todo of todos) {
      const status = todo.status === 'completed' || todo.status === 'in_progress' || todo.status === 'pending' 
        ? todo.status 
        : 'blocked';
      
      const dependencyCount = Array.isArray(todo.dependencies) ? todo.dependencies.length : 0;
      const isActionable = status === 'pending' && dependencyCount === 0;
      
      groups[status].tasks.push({
        id: todo.id,
        content: todo.content,
        priority: todo.priority,
        dependencies: dependencyCount > 0 ? dependencyCount : undefined,
        actionable: isActionable
      });
    }
    
    // Sort tasks within each group by priority and then by creation order
    for (const group of Object.values(groups)) {
      group.tasks.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 1;
        const bPriority = priorityOrder[b.priority] || 1;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        return a.id.localeCompare(b.id); // Then by ID
      });
    }
    
    return groups;
  }

  /**
   * Map WorkflowTask status to TodoItem status
   */
  private static mapTaskStatusToTodoStatus(status: string): 'pending' | 'in_progress' | 'completed' {
    switch (status) {
      case 'completed':
        return 'completed';
      case 'running':
      case 'assigned':
        return 'in_progress';
      case 'pending':
      case 'created':
      default:
        return 'pending';
    }
  }

  /**
   * Map WorkflowTask priority to TodoItem priority
   */
  private static mapTaskPriorityToTodoPriority(priority: number): 'low' | 'medium' | 'high' {
    if (priority >= 70) return 'high';
    if (priority >= 40) return 'medium';
    return 'low';
  }

  /**
   * Capitalize status for display
   */
  private static capitalizeStatus(status: string): string {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Create a sample progress display for testing
   */
  static createSampleDisplay(): string {
    const sampleTodos: TodoItem[] = [
      {
        id: '001',
        content: 'Set up authentication system',
        status: 'completed',
        priority: 'high',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '002',
        content: 'Implement user dashboard',
        status: 'in_progress',
        priority: 'medium',
        dependencies: ['001'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '003',
        content: 'Add payment integration',
        status: 'pending',
        priority: 'high',
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '004',
        content: 'Deploy to production',
        status: 'pending',
        priority: 'high',
        dependencies: ['002', '003'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    return this.formatTodoProgress(sampleTodos);
  }
} 