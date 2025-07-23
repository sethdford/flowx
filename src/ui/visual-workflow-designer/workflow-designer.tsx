/**
 * Visual Workflow Designer
 * Drag-and-drop interface for creating GitHub automation workflows
 * 
 * Note: This is a simplified TypeScript version to avoid JSX compilation issues.
 * The full React component would require proper JSX configuration and ReactFlow installation.
 */

import * as React from 'react';

// Interface definitions for type safety
export interface WorkflowDesignerProps {
  onWorkflowSave?: (workflow: WorkflowDefinition) => void;
  onWorkflowLoad?: (workflowId: string) => void;
  initialWorkflow?: WorkflowDefinition;
  readonly?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  mode: AutomationMode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  settings: WorkflowSettings;
  metadata: WorkflowMetadata;
}

export interface FlowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'notification';
  position: { x: number; y: number };
  data: {
    label: string;
    config: any;
    status?: 'idle' | 'running' | 'success' | 'error';
    executionTime?: number;
    lastRun?: Date;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type: 'default' | 'conditional' | 'parallel';
  data?: {
    condition?: string;
    label?: string;
  };
}

export interface WorkflowSettings {
  timeout: number;
  retries: number;
  parallel: boolean;
  notifications: boolean;
  logging: 'minimal' | 'detailed' | 'verbose';
}

export interface WorkflowMetadata {
  created: Date;
  modified: Date;
  author: string;
  version: string;
  tags: string[];
  dependencies: string[];
}

type AutomationMode = 
  | 'ci-cd-optimization'
  | 'code-quality-guardian'
  | 'release-orchestrator'
  | 'dependency-sentinel'
  | 'security-watchdog'
  | 'project-coordinator';

/**
 * Workflow Designer Class
 * Manages workflow creation and execution logic
 */
export class WorkflowDesignerEngine {
  private nodes: FlowNode[] = [];
  private edges: FlowEdge[] = [];
  private selectedMode: AutomationMode = 'ci-cd-optimization';
  private workflowName: string = 'New Workflow';
  private workflowDescription: string = '';
  private validationErrors: string[] = [];

  constructor(private props: WorkflowDesignerProps) {
    if (props.initialWorkflow) {
      this.loadWorkflow(props.initialWorkflow);
    }
  }

  /**
   * Load workflow from definition
   */
  loadWorkflow(workflow: WorkflowDefinition): void {
    this.nodes = workflow.nodes;
    this.edges = workflow.edges;
    this.workflowName = workflow.name;
    this.workflowDescription = workflow.description;
    this.selectedMode = workflow.mode;
  }

  /**
   * Add a new node to the workflow
   */
  addNode(type: FlowNode['type'], position: { x: number; y: number }): FlowNode {
    const newNode: FlowNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        config: this.getDefaultConfig(type),
        status: 'idle',
      },
    };

    this.nodes.push(newNode);
    return newNode;
  }

  /**
   * Connect two nodes with an edge
   */
  connectNodes(sourceId: string, targetId: string): FlowEdge {
    const edge: FlowEdge = {
      id: `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: 'default',
    };

    this.edges.push(edge);
    return edge;
  }

  /**
   * Update node configuration
   */
  updateNodeConfig(nodeId: string, config: any): void {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.data.config = { ...node.data.config, ...config };
    }
  }

  /**
   * Delete a node and its connected edges
   */
  deleteNode(nodeId: string): void {
    this.nodes = this.nodes.filter(node => node.id !== nodeId);
    this.edges = this.edges.filter(edge => 
      edge.source !== nodeId && edge.target !== nodeId
    );
  }

  /**
   * Validate workflow structure
   */
  validateWorkflow(): string[] {
    const errors: string[] = [];

    // Check for trigger nodes
    const triggerNodes = this.nodes.filter(node => node.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    }

    // Check for disconnected nodes
    const connectedNodes = new Set<string>();
    this.edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    const disconnectedNodes = this.nodes.filter(node => 
      !connectedNodes.has(node.id) && this.nodes.length > 1
    );
    if (disconnectedNodes.length > 0) {
      errors.push(`${disconnectedNodes.length} nodes are not connected to the workflow`);
    }

    // Check for cycles
    if (this.hasCycles()) {
      errors.push('Workflow contains cycles which are not allowed');
    }

    this.validationErrors = errors;
    return errors;
  }

  /**
   * Check if workflow has cycles using DFS
   */
  private hasCycles(): boolean {
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    this.nodes.forEach(node => graph.set(node.id, []));
    this.edges.forEach(edge => {
      const neighbors = graph.get(edge.source) || [];
      neighbors.push(edge.target);
      graph.set(edge.source, neighbors);
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && dfs(neighbor)) {
          return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    // Convert iterator to array to avoid downlevelIteration issues
    const nodeIds = Array.from(graph.keys());
    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId) && dfs(nodeId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Execute workflow simulation
   */
  async executeWorkflow(): Promise<void> {
    const errors = this.validateWorkflow();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Simulate workflow execution
    for (const node of this.nodes) {
      // Update node status to running
      node.data.status = 'running';
      
      // Simulate execution time
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // Update node status to success
      node.data.status = 'success';
      node.data.executionTime = Math.round(1000 + Math.random() * 2000);
      node.data.lastRun = new Date();
    }
  }

  /**
   * Save workflow definition
   */
  saveWorkflow(): WorkflowDefinition {
    const errors = this.validateWorkflow();
    if (errors.length > 0) {
      throw new Error(`Cannot save invalid workflow: ${errors.join(', ')}`);
    }

    const workflow: WorkflowDefinition = {
      id: this.props.initialWorkflow?.id || `workflow-${Date.now()}`,
      name: this.workflowName,
      description: this.workflowDescription,
      mode: this.selectedMode,
      nodes: this.nodes,
      edges: this.edges,
      settings: {
        timeout: 3600,
        retries: 3,
        parallel: false,
        notifications: true,
        logging: 'detailed',
      },
      metadata: {
        created: this.props.initialWorkflow?.metadata.created || new Date(),
        modified: new Date(),
        author: 'current-user',
        version: '1.0.0',
        tags: [],
        dependencies: [],
      },
    };

    this.props.onWorkflowSave?.(workflow);
    return workflow;
  }

  /**
   * Get default configuration for node types
   */
  private getDefaultConfig(nodeType: FlowNode['type']): any {
    switch (nodeType) {
      case 'trigger':
        return {
          type: 'push',
          branches: ['main'],
          paths: [],
        };
      case 'action':
        return {
          type: 'lint-check',
          timeout: 300,
          retries: 1,
        };
      case 'condition':
        return {
          type: 'file_changed',
          parameters: {},
        };
      case 'notification':
        return {
          channels: ['slack'],
          template: 'default',
        };
      default:
        return {};
    }
  }

  /**
   * Clear workflow
   */
  clearWorkflow(): void {
    this.nodes = [];
    this.edges = [];
    this.validationErrors = [];
    this.workflowName = 'New Workflow';
    this.workflowDescription = '';
  }

  // Getters for accessing internal state
  getNodes(): FlowNode[] { return [...this.nodes]; }
  getEdges(): FlowEdge[] { return [...this.edges]; }
  getValidationErrors(): string[] { return [...this.validationErrors]; }
  getWorkflowName(): string { return this.workflowName; }
  getWorkflowDescription(): string { return this.workflowDescription; }
  getSelectedMode(): AutomationMode { return this.selectedMode; }

  // Setters for updating state
  setWorkflowName(name: string): void { this.workflowName = name; }
  setWorkflowDescription(description: string): void { this.workflowDescription = description; }
  setSelectedMode(mode: AutomationMode): void { this.selectedMode = mode; }
}

/**
 * React Component Wrapper (simplified for TypeScript compatibility)
 * 
 * To use this as a full React component, install ReactFlow and enable JSX:
 * npm install reactflow
 * Then configure TypeScript with jsx: "react-jsx"
 */
const WorkflowDesigner: React.FC<WorkflowDesignerProps> = (props) => {
  // This is a placeholder - in production, this would render the full UI
  // For now, it just creates the engine instance
  const engine = new WorkflowDesignerEngine(props);
  
  // Return a simple placeholder element
  return React.createElement('div', {
    style: {
      padding: '20px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      textAlign: 'center' as const,
      color: '#666'
    }
  }, 'Workflow Designer - Install ReactFlow and enable JSX for full UI');
};

export default WorkflowDesigner; 