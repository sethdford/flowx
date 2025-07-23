/**
 * Dependency graph management for task scheduling
 */

import { Task } from "../utils/types.js";
import { TaskDependencyError } from "../utils/errors.js";
import { ILogger } from "../core/logger.js";

export interface DependencyNode {
  taskId: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
}

export interface DependencyPath {
  from: string;
  to: string;
  path: string[];
  weight?: number;
}

/**
 * Manages task dependencies and determines execution order
 */
export class DependencyGraph {
  private dependencies = new Map<string, Set<string>>();
  private dependents = new Map<string, Set<string>>();
  private nodes = new Map<string, DependencyNode>();
  private completedTasks = new Set<string>();
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  /**
   * Add a task to the dependency graph
   */
  addTask(task: Task): void {
    if (this.nodes.has(task.id)) {
      this.logger.warn('Task already exists in dependency graph', { taskId: task.id });
      return;
    }

    const node: DependencyNode = {
      taskId: task.id,
      dependencies: new Set(task.dependencies),
      dependents: new Set(),
      status: 'pending',
    };

    // Add node first so that circular dependency detection can work
    this.nodes.set(task.id, node);

    // Check for circular dependencies
    const tempNode = this.nodes.get(task.id);
    if (tempNode) {
      // Add a temp node to check for circular deps
      for (const depId of task.dependencies) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.add(task.id);
        }
      }

      // Check for cycles
      const cycles = this.detectCycles();
      if (cycles.length > 0) {
        // Remove the node and its dependency references since it creates cycles
        for (const depId of task.dependencies) {
          const depNode = this.nodes.get(depId);
          if (depNode) {
            depNode.dependents.delete(task.id);
          }
        }
        this.nodes.delete(task.id);
        throw new TaskDependencyError(task.id, cycles[0], 'Circular dependency detected');
      }
    }

    // Validate dependencies exist
    for (const depId of task.dependencies) {
      if (!this.nodes.has(depId) && !this.completedTasks.has(depId)) {
        // Remove the node since dependencies don't exist
        this.nodes.delete(task.id);
        throw new TaskDependencyError(task.id, [depId]);
      }
    }

    // Check if task is ready
    if (this.isTaskReady(task.id)) {
      node.status = 'ready';
    }
  }

  /**
   * Remove a task from the dependency graph
   */
  removeTask(taskId: string): void {
    const node = this.nodes.get(taskId);
    if (!node) {
      return;
    }

    // Remove from dependents of dependencies
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.delete(taskId);
      }
    }

    // Remove from dependencies of dependents
    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependencies.delete(taskId);
        // Check if dependent is now ready
        if (this.isTaskReady(depId)) {
          depNode.status = 'ready';
        }
      }
    }

    this.nodes.delete(taskId);
  }

  /**
   * Mark a task as completed
   */
  markCompleted(taskId: string): string[] {
    const node = this.nodes.get(taskId);
    if (!node) {
      this.logger.warn('Task not found in dependency graph', { taskId });
      return [];
    }

    node.status = 'completed';
    this.completedTasks.add(taskId);
    
    // Find newly ready tasks
    const readyTasks: string[] = [];
    
    for (const dependentId of node.dependents) {
      const dependent = this.nodes.get(dependentId);
      if (dependent && dependent.status === 'pending' && this.isTaskReady(dependentId)) {
        dependent.status = 'ready';
        readyTasks.push(dependentId);
      }
    }

    // Remove from active graph
    this.removeTask(taskId);

    return readyTasks;
  }

  /**
   * Mark a task as failed
   */
  markFailed(taskId: string): string[] {
    const node = this.nodes.get(taskId);
    if (!node) {
      return [];
    }

    node.status = 'failed';
    
    // Get all dependent tasks that need to be cancelled
    const toCancelIds = this.getAllDependents(taskId);
    
    // Mark all dependents as failed
    for (const depId of toCancelIds) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.status = 'failed';
      }
    }

    return toCancelIds;
  }

  /**
   * Check if a task is ready to run
   */
  isTaskReady(taskId: string): boolean {
    const node = this.nodes.get(taskId);
    if (!node) {
      return false;
    }

    // All dependencies must be completed
    for (const depId of node.dependencies) {
      if (!this.completedTasks.has(depId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all ready tasks
   */
  getReadyTasks(): string[] {
    const ready: string[] = [];
    
    for (const [taskId, node] of this.nodes) {
      if (node.status === 'ready' || (node.status === 'pending' && this.isTaskReady(taskId))) {
        ready.push(taskId);
        node.status = 'ready';
      }
    }

    return ready;
  }

  /**
   * Get all dependents of a task (recursive)
   */
  getAllDependents(taskId: string): string[] {
    const visited = new Set<string>();
    const dependents: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);

      const node = this.nodes.get(id);
      if (!node) {
        return;
      }

      for (const depId of node.dependents) {
        if (!visited.has(depId)) {
          dependents.push(depId);
          visit(depId);
        }
      }
    };

    visit(taskId);
    return dependents;
  }

  /**
   * Detect circular dependencies
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const hasCycle = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);
      currentPath.push(taskId);

      const node = this.nodes.get(taskId);
      if (!node) {
        currentPath.pop();
        recursionStack.delete(taskId);
        return false;
      }

      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          // Found cycle
          const cycleStart = currentPath.indexOf(depId);
          const cycle = currentPath.slice(cycleStart);
          cycle.push(depId); // Complete the cycle
          cycles.push(cycle);
          return true;
        }
      }

      currentPath.pop();
      recursionStack.delete(taskId);
      return false;
    };

    // Check all nodes
    for (const taskId of this.nodes.keys()) {
      if (!visited.has(taskId)) {
        hasCycle(taskId);
      }
    }

    return cycles;
  }

  /**
   * Get topological sort of tasks
   */
  topologicalSort(): string[] | null {
    // Check for cycles first
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      this.logger.error('Cannot perform topological sort due to cycles', { cycles });
      return null;
    }

    const sorted: string[] = [];
    const visited = new Set<string>();
    
    const visit = (taskId: string) => {
      if (visited.has(taskId)) {
        return;
      }
      visited.add(taskId);

      const node = this.nodes.get(taskId);
      if (!node) {
        return;
      }

      // Visit dependencies first
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          visit(depId);
        }
      }

      sorted.push(taskId);
    };

    // Visit all nodes
    for (const taskId of this.nodes.keys()) {
      if (!visited.has(taskId)) {
        visit(taskId);
      }
    }

    return sorted;
  }

  /**
   * Find the critical path in the dependency graph
   * Critical path is the longest path from a source node to a sink node
   * This is useful for determining which tasks are most important for meeting deadlines
   */
  findCriticalPath(): DependencyPath | null {
    // Check for cycles first, as critical path doesn't exist in cyclic graphs
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      this.logger.error('Cannot find critical path due to cycles', { cycles });
      return null;
    }
    
    // Get topological sort order
    const sorted = this.topologicalSort();
    if (!sorted || sorted.length === 0) {
      return null;
    }
    
    // Find source nodes (no dependencies) and sink nodes (no dependents)
    const sourceNodes: string[] = [];
    const sinkNodes: string[] = [];
    
    for (const [taskId, node] of this.nodes.entries()) {
      if (node.dependencies.size === 0) {
        sourceNodes.push(taskId);
      }
      if (node.dependents.size === 0) {
        sinkNodes.push(taskId);
      }
    }
    
    if (sourceNodes.length === 0 || sinkNodes.length === 0) {
      return null;
    }
    
    // Calculate longest path from each source to each sink
    let criticalPath: DependencyPath | null = null;
    let maxLength = 0;
    
    for (const source of sourceNodes) {
      for (const sink of sinkNodes) {
        const path = this.findLongestPath(source, sink);
        if (path && path.path.length > maxLength) {
          maxLength = path.path.length;
          criticalPath = path;
        }
      }
    }
    
    return criticalPath;
  }
  
  /**
   * Helper method to find the longest path between two nodes
   * Uses dynamic programming approach based on topological sort
   */
  private findLongestPath(from: string, to: string): DependencyPath | null {
    const topo = this.topologicalSort();
    if (!topo) return null;
    
    // Initialize distances and predecessors
    const dist: Map<string, number> = new Map();
    const pred: Map<string, string> = new Map();
    
    // Set initial distances to -Infinity except for source
    for (const task of topo) {
      dist.set(task, task === from ? 0 : Number.NEGATIVE_INFINITY);
    }
    
    // Process in topological order
    for (const taskId of topo) {
      const node = this.nodes.get(taskId);
      if (!node) continue;
      
      // Relax edges
      for (const dependent of node.dependents) {
        const newDist = dist.get(taskId)! + 1; // Each edge has weight 1
        
        if (newDist > (dist.get(dependent) || Number.NEGATIVE_INFINITY)) {
          dist.set(dependent, newDist);
          pred.set(dependent, taskId);
        }
      }
    }
    
    // Check if we can reach the target
    if ((dist.get(to) || Number.NEGATIVE_INFINITY) === Number.NEGATIVE_INFINITY) {
      return null;
    }
    
    // Reconstruct path
    const path: string[] = [];
    let current = to;
    
    while (current !== from) {
      path.unshift(current);
      current = pred.get(current)!;
    }
    
    path.unshift(from);
    
    return {
      from,
      to,
      path,
      weight: dist.get(to)
    };
  }

  /**
   * Generate DOT graph representation for visualization
   */
  toDot(): string {
    let dot = 'digraph TaskDependencies {\n';
    
    // Add nodes
    for (const [taskId, node] of this.nodes.entries()) {
      let nodeStyle = '';
      
      switch (node.status) {
        case 'ready':
          nodeStyle = ' [color=green]';
          break;
        case 'running':
          nodeStyle = ' [color=blue]';
          break;
        case 'failed':
          nodeStyle = ' [color=red]';
          break;
        case 'completed':
          nodeStyle = ' [color=grey]';
          break;
        default:
          nodeStyle = '';
          break;
      }
      
      dot += `  "${taskId}"${nodeStyle};\n`;
    }
    
    // Add edges
    for (const [taskId, node] of this.nodes.entries()) {
      for (const depId of node.dependencies) {
        dot += `  "${depId}" -> "${taskId}";\n`;
      }
    }
    
    dot += '}';
    return dot;
  }

  /**
   * Get graph statistics
   */
  getStats(): Record<string, unknown> {
    const stats = {
      totalTasks: this.nodes.size,
      completedTasks: this.completedTasks.size,
      readyTasks: 0,
      pendingTasks: 0,
      runningTasks: 0,
      failedTasks: 0,
      avgDependencies: 0,
      maxDependencies: 0,
      cycles: this.detectCycles(),
    };

    let totalDeps = 0;
    for (const node of this.nodes.values()) {
      totalDeps += node.dependencies.size;
      stats.maxDependencies = Math.max(stats.maxDependencies, node.dependencies.size);
      
      switch (node.status) {
        case 'ready':
          stats.readyTasks++;
          break;
        case 'pending':
          stats.pendingTasks++;
          break;
        case 'running':
          stats.runningTasks++;
          break;
        case 'failed':
          stats.failedTasks++;
          break;
      }
    }

    stats.avgDependencies = this.nodes.size > 0 ? totalDeps / this.nodes.size : 0;

    return stats;
  }

}