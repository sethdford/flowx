import { EventEmitter } from 'node:events';
import { generateId } from '../utils/helpers.js';
import type { CLILogger } from '../cli/core/application.js';
import { getAgentTypesForStrategy, getCapabilitiesForType, getSystemPromptForType } from './agent-strategy-helpers.js';

export interface SwarmCoordinatorConfig {
  maxAgents: number;
  maxConcurrentTasks: number;
  taskTimeout: number;
  enableMonitoring: boolean;
  enableWorkStealing: boolean;
  enableCircuitBreaker: boolean;
  memoryNamespace: string;
  coordinationStrategy: 'centralized' | 'distributed' | 'hierarchical' | 'mesh';
  
  // Enhanced neural features (optional)
  enableNeuralOptimization?: boolean;
  enablePredictiveAssignment?: boolean;
  enableAdaptiveLearning?: boolean;
  learningInterval?: number;
  optimizationThreshold?: number;
}

// Legacy alias for backwards compatibility
export type SwarmCoordinatorOptions = SwarmCoordinatorConfig;

export interface AgentProfile {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  performance: {
    tasksCompleted: number;
    averageTime: number;
    successRate: number;
  };
  systemPrompt?: string;
  maxConcurrentTasks: number;
}

export type AgentType = 
  | 'coordinator'
  | 'researcher' 
  | 'coder'
  | 'analyst'
  | 'architect'
  | 'tester'
  | 'reviewer'
  | 'optimizer'
  | 'documenter'
  | 'monitor'
  | 'specialist';

export interface ObjectiveTask {
  id: string;
  objective: string;
  strategy: string;
  status: 'created' | 'planning' | 'executing' | 'completed' | 'failed';
  subtasks: SubTask[];
  assignedAgents: string[];
  progress: number;
  startTime: Date;
  endTime?: Date;
}

export interface SubTask {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'assigned' | 'executing' | 'completed' | 'failed';
  assignedAgent?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  estimatedTime?: number;
  actualTime?: number;
}

export interface SwarmIntelligence {
  coordinationEfficiency: number;
  taskSuccessRate: number;
  resourceUtilization: number;
  adaptabilityScore: number;
  learningRate: number;
}

export interface PredictiveAssignment {
  taskId: string;
  recommendedAgent: string;
  confidence: number;
  expectedDuration: number;
  successProbability: number;
  reasoning: string;
  alternatives: string[];
}

export class SwarmCoordinator extends EventEmitter {
  private agents = new Map<string, AgentProfile>();
  private objectives = new Map<string, ObjectiveTask>();
  private tasks = new Map<string, SubTask>();
  private options: SwarmCoordinatorConfig;
  private logger?: CLILogger;
  private isRunning = false;
  private circuitBreakerState = new Map<string, { failures: number; lastFailure: Date; isOpen: boolean }>();
  
  // Enhanced neural features
  private swarmIntelligence: SwarmIntelligence = {
    coordinationEfficiency: 0.5,
    taskSuccessRate: 0.5,
    resourceUtilization: 0.5,
    adaptabilityScore: 0.5,
    learningRate: 0.0
  };
  private learningData: any[] = [];
  private optimizationMetrics = {
    totalOptimizations: 0,
    successfulOptimizations: 0,
    averageImprovement: 0,
    lastOptimization: null as Date | null
  };

  constructor(options: SwarmCoordinatorConfig, logger?: CLILogger) {
    super();
    this.options = {
      // Set defaults for enhanced features
      enableNeuralOptimization: false,
      enablePredictiveAssignment: false,
      enableAdaptiveLearning: false,
      learningInterval: 300000, // 5 minutes
      optimizationThreshold: 0.8,
      ...options
    };
    this.logger = logger;
    
    // Start adaptive learning if enabled
    if (this.options.enableAdaptiveLearning) {
      this.startAdaptiveLearning();
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('SwarmCoordinator is already running');
    }

    this.logger?.info('Starting SwarmCoordinator', { options: this.options });
    this.isRunning = true;
    
    // Initialize monitoring if enabled
    if (this.options.enableMonitoring) {
      this.startMonitoring();
    }

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger?.info('Stopping SwarmCoordinator');
    this.isRunning = false;
    
    // Clean up all agents
    this.agents.clear();
    this.objectives.clear();
    this.tasks.clear();
    
    this.emit('stopped');
  }

  async createObjective(objective: string, strategy: string): Promise<string> {
    const objectiveId = generateId('obj');
    
    const objectiveTask: ObjectiveTask = {
      id: objectiveId,
      objective,
      strategy,
      status: 'created',
      subtasks: [],
      assignedAgents: [],
      progress: 0,
      startTime: new Date(),
    };

    this.objectives.set(objectiveId, objectiveTask);
    
    // Generate subtasks based on strategy
    const subtasks = this.generateSubtasksForStrategy(objective, strategy);
    objectiveTask.subtasks = subtasks;
    
    // Store subtasks in task map
    subtasks.forEach(task => {
      this.tasks.set(task.id, task);
    });

    this.logger?.info('Created objective', { objectiveId, objective, strategy, subtaskCount: subtasks.length });
    this.emit('objectiveCreated', objectiveTask);
    
    return objectiveId;
  }

  async registerAgent(name: string, type: AgentType, capabilities: string[], systemPrompt?: string): Promise<string> {
    const agentId = generateId('agent');
    
    const agent: AgentProfile = {
      id: agentId,
      name,
      type,
      capabilities,
      status: 'idle',
      performance: {
        tasksCompleted: 0,
        averageTime: 0,
        successRate: 1.0,
      },
      systemPrompt,
      maxConcurrentTasks: this.options.maxConcurrentTasks,
    };

    this.agents.set(agentId, agent);
    
    this.logger?.info('Registered agent', { agentId, name, type, capabilities });
    this.emit('agentRegistered', agent);
    
    return agentId;
  }

  async assignTask(taskId: string, agentId?: string): Promise<boolean> {
    // Use intelligent assignment if enabled
    if (this.options.enablePredictiveAssignment) {
      const assignment = await this.assignTaskIntelligently(taskId, agentId);
      return assignment !== null;
    }
    
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'pending') {
      throw new Error(`Task ${taskId} is not in pending status`);
    }

    // Auto-assign if no agent specified
    if (!agentId) {
      agentId = this.findBestAgentForTask(task) || undefined;
    }

    if (!agentId) {
      this.logger?.warn('No suitable agent found for task', { taskId, task });
      return false;
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status !== 'idle') {
      this.logger?.warn('Agent is not idle', { agentId, status: agent.status });
      return false;
    }

    // Assign task
    task.assignedAgent = agentId;
    task.status = 'assigned';
    agent.status = 'busy';
    agent.currentTask = taskId;

    this.logger?.info('Assigned task to agent', { taskId, agentId, taskType: task.type });
    this.emit('taskAssigned', { task, agent });

    // Start executing task
    this.executeTask(taskId);
    
    return true;
  }

  getSystemStatus(): any {
    const agentStats = Array.from(this.agents.values()).reduce(
      (stats, agent) => {
        stats[agent.status] = (stats[agent.status] || 0) + 1;
        return stats;
      },
      {} as Record<string, number>
    );

    const taskStats = Array.from(this.tasks.values()).reduce(
      (stats, task) => {
        stats[task.status] = (stats[task.status] || 0) + 1;
        return stats;
      },
      {} as Record<string, number>
    );

    return {
      isRunning: this.isRunning,
      agents: {
        total: this.agents.size,
        byStatus: agentStats,
      },
      tasks: {
        total: this.tasks.size,
        byStatus: taskStats,
      },
      objectives: {
        total: this.objectives.size,
        active: Array.from(this.objectives.values()).filter(obj => obj.status === 'executing').length,
      },
      coordination: {
        strategy: this.options.coordinationStrategy,
        monitoring: this.options.enableMonitoring,
        circuitBreaker: this.options.enableCircuitBreaker,
        workStealing: this.options.enableWorkStealing,
      },
    };
  }

  private generateSubtasksForStrategy(objective: string, strategy: string): SubTask[] {
    const subtasks: SubTask[] = [];
    
    switch (strategy) {
      case 'research':
        subtasks.push(
          { id: generateId('task'), type: 'research', description: `Research: ${objective}`, status: 'pending', priority: 'high', dependencies: [] },
          { id: generateId('task'), type: 'analysis', description: 'Analyze findings', status: 'pending', priority: 'medium', dependencies: [subtasks[0]?.id].filter(Boolean) },
          { id: generateId('task'), type: 'report', description: 'Generate report', status: 'pending', priority: 'medium', dependencies: [subtasks[1]?.id].filter(Boolean) }
        );
        break;
        
      case 'development':
        subtasks.push(
          { id: generateId('task'), type: 'planning', description: `Plan solution for: ${objective}`, status: 'pending', priority: 'high', dependencies: [] },
          { id: generateId('task'), type: 'architecture', description: 'Design system architecture', status: 'pending', priority: 'high', dependencies: [subtasks[0]?.id].filter(Boolean) },
          { id: generateId('task'), type: 'implementation', description: 'Implement the solution', status: 'pending', priority: 'high', dependencies: [subtasks[1]?.id].filter(Boolean) },
          { id: generateId('task'), type: 'testing', description: 'Test and validate', status: 'pending', priority: 'medium', dependencies: [subtasks[2]?.id].filter(Boolean) }
        );
        break;
        
      case 'analysis':
        subtasks.push(
          { id: generateId('task'), type: 'data-collection', description: `Collect data for: ${objective}`, status: 'pending', priority: 'high', dependencies: [] },
          { id: generateId('task'), type: 'pattern-analysis', description: 'Analyze patterns', status: 'pending', priority: 'high', dependencies: [subtasks[0]?.id].filter(Boolean) },
          { id: generateId('task'), type: 'insights', description: 'Generate insights', status: 'pending', priority: 'medium', dependencies: [subtasks[1]?.id].filter(Boolean) }
        );
        break;
        
      default: // auto
        // Analyze objective to determine best approach
        if (objective.toLowerCase().includes('build') || objective.toLowerCase().includes('create')) {
          return this.generateSubtasksForStrategy(objective, 'development');
        } else if (objective.toLowerCase().includes('research') || objective.toLowerCase().includes('analyze')) {
          return this.generateSubtasksForStrategy(objective, 'research');
        } else {
          subtasks.push(
            { id: generateId('task'), type: 'exploration', description: `Explore requirements for: ${objective}`, status: 'pending', priority: 'high', dependencies: [] },
            { id: generateId('task'), type: 'execution', description: 'Execute main tasks', status: 'pending', priority: 'high', dependencies: [subtasks[0]?.id].filter(Boolean) },
            { id: generateId('task'), type: 'validation', description: 'Validate results', status: 'pending', priority: 'medium', dependencies: [subtasks[1]?.id].filter(Boolean) }
          );
        }
    }

    return subtasks;
  }

  private findBestAgentForTask(task: SubTask): string | null {
    const availableAgents = Array.from(this.agents.values()).filter(agent => agent.status === 'idle');
    
    if (availableAgents.length === 0) {
      return null;
    }

    // Score agents based on capabilities and performance
    const scoredAgents = availableAgents.map(agent => {
      let score = 0;
      
      // Type matching bonus
      if (this.isAgentSuitableForTaskType(agent.type, task.type)) {
        score += 10;
      }
      
      // Performance bonus
      score += agent.performance.successRate * 5;
      
      // Experience bonus
      score += Math.min(agent.performance.tasksCompleted / 10, 3);
      
      return { agent, score };
    });

    // Sort by score and return best agent
    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0]?.agent.id || null;
  }

  private isAgentSuitableForTaskType(agentType: AgentType, taskType: string): boolean {
    const typeMapping: Record<string, AgentType[]> = {
      'research': ['researcher', 'analyst'],
      'analysis': ['analyst', 'researcher'],
      'planning': ['architect', 'coordinator'],
      'architecture': ['architect', 'coordinator'],
      'implementation': ['coder', 'architect'],
      'testing': ['tester', 'coder'],
      'review': ['reviewer', 'architect'],
      'documentation': ['documenter', 'coder'],
      'monitoring': ['monitor', 'analyst'],
      'optimization': ['optimizer', 'architect'],
    };

    return typeMapping[taskType]?.includes(agentType) || false;
  }

  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const agent = task.assignedAgent ? this.agents.get(task.assignedAgent) : null;
    if (!agent) {
      throw new Error(`Agent for task ${taskId} not found`);
    }

    try {
      task.status = 'executing';
      const startTime = Date.now();
      
      this.logger?.info('Executing task', { taskId, agentId: agent.id, taskType: task.type });
      this.emit('taskStarted', { task, agent });

      // Simulate task execution (replace with real implementation)
      await this.simulateTaskExecution(task, agent);

      // Update task and agent status
      task.status = 'completed';
      task.actualTime = Date.now() - startTime;
      agent.status = 'idle';
      agent.currentTask = undefined;
      
      // Update agent performance
      agent.performance.tasksCompleted++;
      agent.performance.averageTime = 
        (agent.performance.averageTime * (agent.performance.tasksCompleted - 1) + task.actualTime) / 
        agent.performance.tasksCompleted;

      this.logger?.info('Task completed', { taskId, agentId: agent.id, duration: task.actualTime });
      this.emit('taskCompleted', { task, agent });

      // Check if we can assign more tasks
      this.checkForPendingTasks();

    } catch (error) {
      task.status = 'failed';
      agent.status = 'idle';
      agent.currentTask = undefined;
      
      // Update failure rate
      agent.performance.successRate = Math.max(0, agent.performance.successRate - 0.1);
      
      this.logger?.error('Task failed', { taskId, agentId: agent.id, error });
      this.emit('taskFailed', { task, agent, error });
    }
  }

  private async simulateTaskExecution(task: SubTask, agent: AgentProfile): Promise<void> {
    // Simulate variable execution time based on task complexity
    const baseTime = 1000; // 1 second base
    const complexityMultiplier = task.priority === 'critical' ? 3 : task.priority === 'high' ? 2 : 1;
    const executionTime = baseTime * complexityMultiplier * (0.5 + Math.random());
    
    await new Promise(resolve => setTimeout(resolve, executionTime));
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error(`Simulated failure in ${task.type} task`);
    }
  }

  private checkForPendingTasks(): void {
    const pendingTasks = Array.from(this.tasks.values()).filter(task => task.status === 'pending');
    
    for (const task of pendingTasks) {
      // Check if dependencies are satisfied
      const dependenciesSatisfied = task.dependencies.every(depId => {
        const depTask = this.tasks.get(depId);
        return depTask?.status === 'completed';
      });
      
      if (dependenciesSatisfied) {
        this.assignTask(task.id);
      }
    }
  }

  private startMonitoring(): void {
    setInterval(() => {
      const status = this.getSystemStatus();
      this.emit('statusUpdate', status);
      
      if (this.logger) {
        this.logger.debug('System status update', status);
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Enhanced neural assignment with predictive intelligence
   */
  async assignTaskIntelligently(taskId: string, preferredAgent?: string): Promise<PredictiveAssignment | null> {
    try {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Get available agents
      const availableAgents = Array.from(this.agents.values()).filter(agent => agent.status === 'idle');
      if (availableAgents.length === 0) {
        return null;
      }

      // Simple intelligent assignment logic (can be enhanced with real neural network later)
      let bestAgent = availableAgents[0];
      let bestScore = 0;

      for (const agent of availableAgents) {
        let score = agent.performance.successRate * 10;
        
        // Type matching bonus
        if (this.isAgentSuitableForTaskType(agent.type, task.type)) {
          score += 15;
        }
        
        // Performance history bonus
        score += Math.min(agent.performance.tasksCompleted / 10, 5);
        
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }

      const assignment: PredictiveAssignment = {
        taskId,
        recommendedAgent: bestAgent.id,
        confidence: Math.min(bestScore / 20, 1.0),
        expectedDuration: this.estimateTaskDuration(task, bestAgent),
        successProbability: bestAgent.performance.successRate,
        reasoning: `Selected based on agent suitability (${this.isAgentSuitableForTaskType(bestAgent.type, task.type) ? 'suitable' : 'general'}) and performance history`,
        alternatives: availableAgents.slice(0, 3).map(a => a.id)
      };

      // Execute the assignment if confidence is high enough
      if (assignment.confidence >= (this.options.optimizationThreshold || 0.8)) {
        // Standard assignment logic
        task.assignedAgent = bestAgent.id;
        task.status = 'assigned';
        bestAgent.status = 'busy';
        bestAgent.currentTask = taskId;

        this.logger?.info('Intelligent task assignment', { taskId, agentId: bestAgent.id, confidence: assignment.confidence });
        this.emit('taskAssigned', { task, agent: bestAgent });
        this.emit('intelligent-assignment', assignment);

        // Start executing task
        this.executeTask(taskId);
        
        return assignment;
      }

      return null;

    } catch (error) {
      this.logger?.error('Intelligent assignment failed', { taskId, error });
      return null;
    }
  }

  /**
   * Estimate task duration based on agent and task characteristics
   */
  private estimateTaskDuration(task: SubTask, agent: AgentProfile): number {
    let estimate = 30000; // 30 seconds default
    
    // Adjust based on task priority
    const priorityMultiplier = {
      'critical': 2.0,
      'high': 1.5,
      'medium': 1.0,
      'low': 0.8
    };
    estimate *= priorityMultiplier[task.priority];
    
    // Adjust based on agent performance
    estimate *= (2.0 - agent.performance.successRate); // Better agents are faster
    
    // Adjust based on agent experience
    const experienceMultiplier = Math.max(0.7, 1.0 - (agent.performance.tasksCompleted / 100));
    estimate *= experienceMultiplier;
    
    return Math.round(estimate);
  }

  /**
   * Start adaptive learning process
   */
  private startAdaptiveLearning(): void {
    if (process.env.NODE_ENV === 'test') {
      this.logger?.debug('Skipping adaptive learning in test environment');
      return;
    }

    const interval = this.options.learningInterval || 300000; // 5 minutes default
    setInterval(async () => {
      await this.performAdaptiveLearning();
    }, interval);

    this.logger?.info('Adaptive learning started', { 
      interval: interval / 1000 / 60 + ' minutes' 
    });
  }

  /**
   * Perform adaptive learning cycle
   */
  private async performAdaptiveLearning(): Promise<void> {
    if (this.learningData.length < 5) {
      return; // Need minimum data for learning
    }

    try {
      this.logger?.info('Starting adaptive learning cycle', { 
        dataPoints: this.learningData.length 
      });

      // Update swarm intelligence metrics
      this.updateSwarmIntelligence();
      
      // Clear processed learning data
      this.learningData = [];
      
      this.emit('adaptive-learning', {
        dataProcessed: this.learningData.length,
        intelligence: this.swarmIntelligence
      });

    } catch (error) {
      this.logger?.error('Adaptive learning cycle failed', { error });
    }
  }

  /**
   * Update swarm intelligence metrics
   */
  private updateSwarmIntelligence(): void {
    try {
      const status = this.getSystemStatus();
      
      // Calculate coordination efficiency
      const completedTasks = status.tasks.byStatus.completed || 0;
      const totalTasks = status.tasks.total || 1;
      this.swarmIntelligence.coordinationEfficiency = completedTasks / totalTasks;
      
      // Calculate task success rate
      this.swarmIntelligence.taskSuccessRate = completedTasks / totalTasks;
      
      // Calculate resource utilization
      const activeAgents = status.agents.byStatus.busy || 0;
      const totalAgents = status.agents.total || 1;
      this.swarmIntelligence.resourceUtilization = activeAgents / totalAgents;
      
      // Calculate adaptability score (simplified)
      this.swarmIntelligence.adaptabilityScore = Math.random() * 0.3 + 0.5; // Placeholder
      
      // Calculate learning rate
      this.swarmIntelligence.learningRate = this.learningData.length / 100; // Simplified
      
      this.emit('intelligence-updated', this.swarmIntelligence);

    } catch (error) {
      this.logger?.error('Failed to update swarm intelligence metrics', { error });
    }
  }

  /**
   * Get enhanced system status including neural intelligence
   */
  getEnhancedSystemStatus(): any {
    const baseStatus = this.getSystemStatus();
    
    return {
      ...baseStatus,
      enhanced: {
        neuralOptimization: this.options.enableNeuralOptimization,
        predictiveAssignment: this.options.enablePredictiveAssignment,
        adaptiveLearning: this.options.enableAdaptiveLearning
      },
      intelligence: this.swarmIntelligence,
      optimization: this.optimizationMetrics
    };
  }
} 