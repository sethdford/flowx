/**
 * Load balancer for intelligent agent selection with predictive modeling
 * Handles multiple load balancing strategies with adaptive thresholds
 */

import { EventEmitter } from 'node:events';
import { TaskDefinition, TaskResult, AgentState, TaskId, AgentId } from "../swarm/types.js";
import { ILogger } from "../core/logger.js";
import { IEventBus } from "../core/event-bus.js";
import { generateId } from "../utils/helpers.js";

export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  adaptiveThresholds: boolean;
  predictiveModeling: boolean;
  healthCheckInterval: number;
  rebalanceInterval: number;
  maxLoadThreshold: number;
  minLoadThreshold: number;
  responseTimeThreshold: number;
  errorRateThreshold: number;
  capacityBuffer: number;
  learningRate: number;
  predictionWindow: number;
  enableMetrics: boolean;
}

export type LoadBalancingStrategy = 
  | 'round-robin'
  | 'least-connections'
  | 'least-loaded'
  | 'weighted-round-robin'
  | 'performance-based'
  | 'cost-based'
  | 'hybrid'
  | 'predictive'
  | 'adaptive';

export interface AgentLoad {
  agentId: string;
  currentLoad: number;
  maxCapacity: number;
  utilization: number;
  activeConnections: number;
  queueLength: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  lastUpdated: Date;
}

export interface LoadPrediction {
  agentId: string;
  predictedLoad: number;
  confidence: number;
  timeWindow: number;
  factors: PredictionFactor[];
  timestamp: Date;
}

export interface PredictionFactor {
  name: string;
  weight: number;
  value: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface LoadBalancingDecision {
  selectedAgent: string;
  strategy: LoadBalancingStrategy;
  confidence: number;
  reasoning: string;
  alternatives: AlternativeAgent[];
  timestamp: Date;
}

export interface AlternativeAgent {
  agentId: string;
  score: number;
  reason: string;
}

export interface LoadBalancerMetrics {
  totalRequests: number;
  successfulAssignments: number;
  failedAssignments: number;
  averageResponseTime: number;
  throughput: number;
  loadDistribution: Map<string, number>;
  strategyEffectiveness: Map<LoadBalancingStrategy, number>;
  predictionAccuracy: number;
  rebalanceCount: number;
  adaptationCount: number;
}

export interface AgentPerformanceHistory {
  agentId: string;
  timestamps: Date[];
  loads: number[];
  responseTimes: number[];
  errorRates: number[];
  throughputs: number[];
  maxHistory: number;
}

export interface LoadBalancingRule {
  id: string;
  name: string;
  condition: string;
  action: LoadBalancingAction;
  priority: number;
  enabled: boolean;
  metadata: Record<string, any>;
}

export interface LoadBalancingAction {
  type: 'redirect' | 'scale' | 'throttle' | 'alert' | 'switch-strategy';
  parameters: Record<string, any>;
}

export class LoadBalancer extends EventEmitter {
  private agents = new Map<string, AgentLoad>();
  private performanceHistory = new Map<string, AgentPerformanceHistory>();
  private predictions = new Map<string, LoadPrediction>();
  private rules: LoadBalancingRule[] = [];
  private metrics: LoadBalancerMetrics;
  private healthCheckTimer?: NodeJS.Timeout;
  private rebalanceTimer?: NodeJS.Timeout;
  private predictionTimer?: NodeJS.Timeout;
  private currentStrategy: LoadBalancingStrategy;
  private roundRobinIndex = 0;
  private isShuttingDown = false;

  constructor(
    private config: LoadBalancerConfig,
    private logger: ILogger,
    private eventBus: IEventBus
  ) {
    super();
    this.currentStrategy = config.strategy;
    this.metrics = this.initializeMetrics();
    this.setupEventHandlers();
  }

  private initializeMetrics(): LoadBalancerMetrics {
    return {
      totalRequests: 0,
      successfulAssignments: 0,
      failedAssignments: 0,
      averageResponseTime: 0,
      throughput: 0,
      loadDistribution: new Map(),
      strategyEffectiveness: new Map(),
      predictionAccuracy: 0,
      rebalanceCount: 0,
      adaptationCount: 0
    };
  }

  private setupEventHandlers(): void {
    this.eventBus.on('system:shutdown', () => this.shutdown());
    this.eventBus.on('agent:registered', (agent: AgentState) => this.registerAgent(agent));
    this.eventBus.on('agent:unregistered', (agentId: string) => this.unregisterAgent(agentId));
    this.eventBus.on('agent:updated', (agent: AgentState) => this.updateAgent(agent));
    this.eventBus.on('task:completed', (result: TaskResult) => this.handleTaskCompletion(result));
    this.eventBus.on('task:failed', (error: any) => this.handleTaskFailure(error));
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing LoadBalancer');

    // Start health checks
    if (this.config.healthCheckInterval > 0) {
      this.healthCheckTimer = setInterval(
        () => this.performHealthCheck(),
        this.config.healthCheckInterval
      );
    }

    // Start rebalancing
    if (this.config.rebalanceInterval > 0) {
      this.rebalanceTimer = setInterval(
        () => this.performRebalancing(),
        this.config.rebalanceInterval
      );
    }

    // Start prediction updates
    if (this.config.predictiveModeling) {
      this.predictionTimer = setInterval(
        () => this.updatePredictions(),
        this.config.predictionWindow
      );
    }

    this.logger.info('LoadBalancer initialized successfully');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down LoadBalancer');
    this.isShuttingDown = true;

    // Clear timers
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.rebalanceTimer) clearInterval(this.rebalanceTimer);
    if (this.predictionTimer) clearInterval(this.predictionTimer);

    this.logger.info('LoadBalancer shutdown complete');
  }

  /**
   * Select the best agent for a task using the configured strategy
   */
  async selectAgent(task: TaskDefinition): Promise<LoadBalancingDecision> {
    if (this.isShuttingDown) {
      throw new Error('LoadBalancer is shutting down');
    }

    this.metrics.totalRequests++;

    try {
      const decision = await this.makeLoadBalancingDecision(task);
      
      if (decision.selectedAgent) {
        this.updateAgentLoad(decision.selectedAgent, 1);
        this.metrics.successfulAssignments++;
        
        this.logger.info('Agent selected for task', {
          taskId: task.id.id,
          selectedAgent: decision.selectedAgent,
          strategy: decision.strategy,
          confidence: decision.confidence
        });

        this.emit('agent:selected', decision);
      } else {
        this.metrics.failedAssignments++;
        this.logger.warn('No agent could be selected for task', { taskId: task.id.id });
      }

      return decision;

    } catch (error) {
      this.metrics.failedAssignments++;
      this.logger.error('Agent selection failed', { taskId: task.id.id, error });
      throw error;
    }
  }

  /**
   * Register a new agent with the load balancer
   */
  registerAgent(agent: AgentState): void {
    if (!agent || !agent.id || !agent.id.id) {
      this.logger.error('Invalid agent object in registerAgent', { 
        agent: JSON.stringify(agent, null, 2) 
      });
      throw new Error(`Invalid agent object: missing id property`);
    }
    
    const agentLoad: AgentLoad = {
      agentId: agent.id.id,
      currentLoad: 0,
      maxCapacity: agent.capabilities.maxConcurrentTasks || 10,
      utilization: 0,
      activeConnections: 0,
      queueLength: 0,
      averageResponseTime: 0,
      errorRate: 0,
      throughput: 0,
      lastUpdated: new Date()
    };

    this.agents.set(agent.id.id, agentLoad);
    this.initializePerformanceHistory(agent.id.id);

    this.logger.info('Agent registered with load balancer', { agentId: agent.id.id });
    this.emit('agent:registered', agentLoad);
  }

  /**
   * Unregister an agent from the load balancer
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.performanceHistory.delete(agentId);
    this.predictions.delete(agentId);

    this.logger.info('Agent unregistered from load balancer', { agentId });
    this.emit('agent:unregistered', { agentId });
  }

  /**
   * Update agent information
   */
  updateAgent(agent: AgentState): void {
    const existingLoad = this.agents.get(agent.id.id);
    if (existingLoad) {
      existingLoad.maxCapacity = agent.capabilities.maxConcurrentTasks || 10;
      existingLoad.lastUpdated = new Date();
      this.updateUtilization(existingLoad);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): LoadBalancerMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get agent load information
   */
  getAgentLoad(agentId: string): AgentLoad | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agent loads
   */
  getAllAgentLoads(): AgentLoad[] {
    return Array.from(this.agents.values());
  }

  /**
   * Switch load balancing strategy
   */
  switchStrategy(strategy: LoadBalancingStrategy): void {
    const oldStrategy = this.currentStrategy;
    this.currentStrategy = strategy;
    this.metrics.adaptationCount++;

    this.logger.info('Load balancing strategy changed', {
      from: oldStrategy,
      to: strategy
    });

    this.emit('strategy:changed', { from: oldStrategy, to: strategy });
  }

  /**
   * Add a load balancing rule
   */
  addRule(rule: LoadBalancingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);

    this.logger.info('Load balancing rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Remove a load balancing rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index > -1) {
      this.rules.splice(index, 1);
      this.logger.info('Load balancing rule removed', { ruleId });
      return true;
    }
    return false;
  }

  // Private methods for load balancing decision making
  private async makeLoadBalancingDecision(task: TaskDefinition): Promise<LoadBalancingDecision> {
    // Check rules first
    const ruleDecision = this.applyRules(task);
    if (ruleDecision) {
      return ruleDecision;
    }

    // Get available agents
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        strategy: this.currentStrategy,
        confidence: 0,
        reasoning: 'No available agents found',
        alternatives: [],
        timestamp: new Date()
      };
    }

    // Select strategy
    const strategy = this.config.adaptiveThresholds ? 
      this.adaptiveStrategySelection(task) : 
      this.currentStrategy;

    // Apply strategy
    let selectedAgent: string;
    let confidence: number;
    let reasoning: string;
    let alternatives: AlternativeAgent[] = [];

    switch (strategy) {
      case 'round-robin':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.roundRobinSelection(task));
        break;
      case 'least-connections':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.leastConnectionsSelection(task));
        break;
      case 'least-loaded':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.leastLoadedSelection(task));
        break;
      case 'weighted-round-robin':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.weightedRoundRobinSelection(task));
        break;
      case 'performance-based':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.performanceBasedSelection(task));
        break;
      case 'cost-based':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.costBasedSelection(task));
        break;
      case 'hybrid':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.hybridSelection(task));
        break;
      case 'predictive':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.predictiveSelection(task));
        break;
      case 'adaptive':
        ({ selectedAgent, confidence, reasoning, alternatives } = this.adaptiveSelection(task));
        break;
      default:
        ({ selectedAgent, confidence, reasoning, alternatives } = this.roundRobinSelection(task));
    }

    return {
      selectedAgent,
      strategy,
      confidence,
      reasoning,
      alternatives,
      timestamp: new Date()
    };
  }

  private selectStrategy(task: TaskDefinition): LoadBalancingStrategy {
    // Simple strategy selection based on task characteristics
    // In a real implementation, this would be more sophisticated
    return this.currentStrategy;
  }

  private roundRobinSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    this.roundRobinIndex = (this.roundRobinIndex + 1) % availableAgents.length;
    const selected = availableAgents[this.roundRobinIndex];

    const alternatives = availableAgents
      .filter(agent => agent.agentId !== selected.agentId)
      .slice(0, 3)
      .map(agent => ({
        agentId: agent.agentId,
        score: 1 - agent.utilization,
        reason: `Utilization: ${(agent.utilization * 100).toFixed(1)}%`
      }));

    return {
      selectedAgent: selected.agentId,
      confidence: 0.8,
      reasoning: `Round-robin selection (index: ${this.roundRobinIndex})`,
      alternatives
    };
  }

  private leastConnectionsSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    // Sort by least active connections
    const sorted = availableAgents.sort((a, b) => a.activeConnections - b.activeConnections);
    const selected = sorted[0];

    const alternatives = sorted
      .slice(1, 4)
      .map(agent => ({
        agentId: agent.agentId,
        score: 1 / (agent.activeConnections + 1),
        reason: `Connections: ${agent.activeConnections}`
      }));

    return {
      selectedAgent: selected.agentId,
      confidence: 0.9,
      reasoning: `Least connections: ${selected.activeConnections}`,
      alternatives
    };
  }

  private leastLoadedSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    // Sort by least current load
    const sorted = availableAgents.sort((a, b) => a.currentLoad - b.currentLoad);
    const selected = sorted[0];

    const alternatives = sorted
      .slice(1, 4)
      .map(agent => ({
        agentId: agent.agentId,
        score: 1 / (agent.currentLoad + 1),
        reason: `Load: ${agent.currentLoad}`
      }));

    return {
      selectedAgent: selected.agentId,
      confidence: 0.85,
      reasoning: `Least loaded: ${selected.currentLoad}`,
      alternatives
    };
  }

  private weightedRoundRobinSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    // Calculate weights based on capacity
    const weights = availableAgents.map(agent => agent.maxCapacity);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    // Select based on weighted probability
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }

    const selected = availableAgents[selectedIndex];

    const alternatives = availableAgents
      .filter(agent => agent.agentId !== selected.agentId)
      .slice(0, 3)
      .map(agent => ({
        agentId: agent.agentId,
        score: agent.maxCapacity / totalWeight,
        reason: `Weight: ${agent.maxCapacity}`
      }));

    return {
      selectedAgent: selected.agentId,
      confidence: 0.75,
      reasoning: `Weighted selection (capacity: ${selected.maxCapacity})`,
      alternatives
    };
  }

  private performanceBasedSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    // Score agents based on performance metrics
    const scoredAgents = availableAgents.map(agent => {
      const history = this.performanceHistory.get(agent.agentId);
      const score = this.calculatePerformanceScore(agent, history);
      
      return { agent, score };
    });

    // Sort by score (highest first)
    scoredAgents.sort((a, b) => b.score - a.score);
    const selected = scoredAgents[0];

    const alternatives = scoredAgents
      .slice(1, 4)
      .map(item => ({
        agentId: item.agent.agentId,
        score: item.score,
        reason: `Performance score: ${item.score.toFixed(2)}`
      }));

    return {
      selectedAgent: selected.agent.agentId,
      confidence: 0.9,
      reasoning: `Best performance score: ${selected.score.toFixed(2)}`,
      alternatives
    };
  }

  private costBasedSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    // Score agents based on cost efficiency
    const scoredAgents = availableAgents.map(agent => {
      const cost = this.calculateAgentCost(agent);
      const score = 1 / (cost + 1); // Lower cost = higher score
      
      return { agent, score, cost };
    });

    // Sort by score (highest first, i.e., lowest cost)
    scoredAgents.sort((a, b) => b.score - a.score);
    const selected = scoredAgents[0];

    const alternatives = scoredAgents
      .slice(1, 4)
      .map(item => ({
        agentId: item.agent.agentId,
        score: item.score,
        reason: `Cost: ${item.cost.toFixed(2)}`
      }));

    return {
      selectedAgent: selected.agent.agentId,
      confidence: 0.8,
      reasoning: `Lowest cost: ${selected.cost.toFixed(2)}`,
      alternatives
    };
  }

  private hybridSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    // Combine multiple factors
    const scoredAgents = availableAgents.map(agent => {
      const history = this.performanceHistory.get(agent.agentId);
      const performanceScore = this.calculatePerformanceScore(agent, history);
      const loadScore = 1 - agent.utilization;
      const costScore = 1 / (this.calculateAgentCost(agent) + 1);
      
      // Weighted combination
      const combinedScore = (performanceScore * 0.4) + (loadScore * 0.4) + (costScore * 0.2);
      
      return { agent, score: combinedScore, performanceScore, loadScore, costScore };
    });

    // Sort by combined score
    scoredAgents.sort((a, b) => b.score - a.score);
    const selected = scoredAgents[0];

    const alternatives = scoredAgents
      .slice(1, 4)
      .map(item => ({
        agentId: item.agent.agentId,
        score: item.score,
        reason: `Hybrid score: ${item.score.toFixed(2)}`
      }));

    return {
      selectedAgent: selected.agent.agentId,
      confidence: 0.95,
      reasoning: `Hybrid selection (score: ${selected.score.toFixed(2)})`,
      alternatives
    };
  }

  private predictiveSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    // Use predictions to select agent
    const scoredAgents = availableAgents.map(agent => {
      const prediction = this.predictions.get(agent.agentId);
      const predictedLoad = prediction ? prediction.predictedLoad : agent.currentLoad;
      const confidence = prediction ? prediction.confidence : 0.5;
      
      // Score based on predicted future load
      const score = (1 - predictedLoad / agent.maxCapacity) * confidence;
      
      return { agent, score, predictedLoad, confidence };
    });

    // Sort by score
    scoredAgents.sort((a, b) => b.score - a.score);
    const selected = scoredAgents[0];

    const alternatives = scoredAgents
      .slice(1, 4)
      .map(item => ({
        agentId: item.agent.agentId,
        score: item.score,
        reason: `Predicted load: ${item.predictedLoad.toFixed(1)}`
      }));

    return {
      selectedAgent: selected.agent.agentId,
      confidence: selected.confidence,
      reasoning: `Predictive selection (predicted load: ${selected.predictedLoad.toFixed(1)})`,
      alternatives
    };
  }

  private adaptiveSelection(task: TaskDefinition): any {
    const availableAgents = this.getAvailableAgents(task);
    
    if (availableAgents.length === 0) {
      return {
        selectedAgent: '',
        confidence: 0,
        reasoning: 'No available agents',
        alternatives: []
      };
    }

    // Adapt strategy based on current system state
    const systemLoad = this.calculateSystemLoad();
    const systemErrorRate = this.calculateSystemErrorRate();
    
    let strategy: LoadBalancingStrategy;
    
    if (systemErrorRate > 0.1) {
      // High error rate - use performance-based
      strategy = 'performance-based';
    } else if (systemLoad > 0.8) {
      // High load - use least-loaded
      strategy = 'least-loaded';
    } else {
      // Normal conditions - use hybrid
      strategy = 'hybrid';
    }

    // Apply the selected strategy
    switch (strategy) {
      case 'performance-based':
        return this.performanceBasedSelection(task);
      case 'least-loaded':
        return this.leastLoadedSelection(task);
      default:
        return this.hybridSelection(task);
    }
  }

  private getAvailableAgents(task: TaskDefinition): AgentLoad[] {
    const agents = Array.from(this.agents.values());
    
    return agents.filter(agent => {
      // Check capacity
      if (agent.currentLoad >= agent.maxCapacity) {
        return false;
      }
      
      // Check utilization threshold
      if (agent.utilization > this.config.maxLoadThreshold) {
        return false;
      }
      
      // Check error rate
      if (agent.errorRate > this.config.errorRateThreshold) {
        return false;
      }
      
      return true;
    });
  }

  private updateAgentLoad(agentId: string, increment: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentLoad += increment;
      agent.lastUpdated = new Date();
      this.updateUtilization(agent);
    }
  }

  private updateUtilization(agent: AgentLoad): void {
    agent.utilization = agent.currentLoad / agent.maxCapacity;
  }

  private calculatePerformanceScore(agent: AgentLoad, history?: AgentPerformanceHistory): number {
    let score = 0.5; // Default score
    
    if (history && history.responseTimes.length > 0) {
      // Response time factor (30%)
      const avgResponseTime = history.responseTimes.reduce((sum, time) => sum + time, 0) / history.responseTimes.length;
      const responseScore = Math.max(0, 1 - (avgResponseTime / this.config.responseTimeThreshold));
      score += responseScore * 0.3;
      
      // Error rate factor (40%)
      const avgErrorRate = history.errorRates.reduce((sum, rate) => sum + rate, 0) / history.errorRates.length;
      const errorScore = Math.max(0, 1 - (avgErrorRate / this.config.errorRateThreshold));
      score += errorScore * 0.4;
      
      // Throughput factor (30%)
      const avgThroughput = history.throughputs.reduce((sum, tp) => sum + tp, 0) / history.throughputs.length;
      const throughputScore = Math.min(1, avgThroughput / 10); // Normalize to 0-1
      score += throughputScore * 0.3;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private calculateAgentCost(agent: AgentLoad): number {
    // Simple cost calculation - could be more sophisticated
    const baseCost = 1.0;
    const loadMultiplier = 1 + agent.utilization;
    const responseTimeMultiplier = 1 + (agent.averageResponseTime / 1000);
    
    return baseCost * loadMultiplier * responseTimeMultiplier;
  }

  private calculateSystemLoad(): number {
    const agents = Array.from(this.agents.values());
    if (agents.length === 0) return 0;
    
    const totalUtilization = agents.reduce((sum, agent) => sum + agent.utilization, 0);
    return totalUtilization / agents.length;
  }

  private calculateSystemErrorRate(): number {
    const agents = Array.from(this.agents.values());
    if (agents.length === 0) return 0;
    
    const totalErrorRate = agents.reduce((sum, agent) => sum + agent.errorRate, 0);
    return totalErrorRate / agents.length;
  }

  private initializePerformanceHistory(agentId: string): void {
    this.performanceHistory.set(agentId, {
      agentId,
      timestamps: [],
      loads: [],
      responseTimes: [],
      errorRates: [],
      throughputs: [],
      maxHistory: 100
    });
  }

  private updatePerformanceHistory(agentId: string, responseTime: number, success: boolean): void {
    const history = this.performanceHistory.get(agentId);
    if (!history) return;
    
    const now = new Date();
    history.timestamps.push(now);
    history.responseTimes.push(responseTime);
    history.errorRates.push(success ? 0 : 1);
    
    // Keep only recent history
    if (history.timestamps.length > history.maxHistory) {
      history.timestamps.shift();
      history.responseTimes.shift();
      history.errorRates.shift();
      history.loads.shift();
      history.throughputs.shift();
    }
  }

  private performHealthCheck(): void {
    for (const [agentId, agent] of this.agents) {
      // Check if agent is responsive
      const timeSinceUpdate = Date.now() - agent.lastUpdated.getTime();
      
      if (timeSinceUpdate > this.config.healthCheckInterval * 2) {
        this.logger.warn('Agent appears unresponsive', {
          agentId,
          timeSinceUpdate
        });
        
        this.emit('agent:unresponsive', { agentId, timeSinceUpdate });
      }
    }
  }

  private performRebalancing(): void {
    if (!this.config.adaptiveThresholds) return;
    
    const imbalance = this.calculateLoadImbalance();
    
    if (imbalance > 0.3) { // 30% imbalance threshold
      this.logger.info('Load imbalance detected, triggering rebalancing', { imbalance });
      this.rebalanceLoad();
      this.metrics.rebalanceCount++;
    }
  }

  private calculateLoadImbalance(): number {
    const agents = Array.from(this.agents.values());
    if (agents.length < 2) return 0;
    
    const utilizations = agents.map(agent => agent.utilization);
    const maxUtil = Math.max(...utilizations);
    const minUtil = Math.min(...utilizations);
    
    return maxUtil - minUtil;
  }

  private rebalanceLoad(): void {
    // Simple rebalancing - could be more sophisticated
    const agents = Array.from(this.agents.values());
    const overloaded = agents.filter(agent => agent.utilization > this.config.maxLoadThreshold);
    const underloaded = agents.filter(agent => agent.utilization < this.config.minLoadThreshold);
    
    this.logger.info('Rebalancing load', {
      overloaded: overloaded.length,
      underloaded: underloaded.length
    });
    
    this.emit('rebalancing:triggered', { overloaded, underloaded });
  }

  private adaptThresholds(): void {
    if (!this.config.adaptiveThresholds) return;
    
    const systemLoad = this.calculateSystemLoad();
    const systemErrorRate = this.calculateSystemErrorRate();
    
    // Adjust thresholds based on system performance
    if (systemErrorRate > 0.1) {
      // Increase thresholds to be more conservative
      this.config.maxLoadThreshold = Math.min(0.9, this.config.maxLoadThreshold + 0.1);
    } else if (systemLoad < 0.5) {
      // Decrease thresholds to be more aggressive
      this.config.maxLoadThreshold = Math.max(0.6, this.config.maxLoadThreshold - 0.05);
    }
    
    this.logger.debug('Adapted load balancing thresholds', {
      maxLoadThreshold: this.config.maxLoadThreshold,
      systemLoad,
      systemErrorRate
    });
  }

  private updatePredictions(): void {
    if (!this.config.predictiveModeling) return;
    
    for (const [agentId, agent] of this.agents) {
      const history = this.performanceHistory.get(agentId);
      if (history) {
        const prediction = this.predictAgentLoad(agentId, history);
        this.predictions.set(agentId, prediction);
      }
    }
  }

  private predictAgentLoad(agentId: string, history: AgentPerformanceHistory): LoadPrediction {
    // Simple linear prediction - could use more sophisticated ML models
    const recentLoads = history.loads.slice(-10); // Last 10 data points
    
    if (recentLoads.length < 2) {
      return {
        agentId,
        predictedLoad: history.loads[history.loads.length - 1] || 0,
        confidence: 0.5,
        timeWindow: this.config.predictionWindow,
        factors: [],
        timestamp: new Date()
      };
    }
    
    // Calculate trend
    const trend = (recentLoads[recentLoads.length - 1] - recentLoads[0]) / recentLoads.length;
    const predictedLoad = Math.max(0, recentLoads[recentLoads.length - 1] + trend);
    
    return {
      agentId,
      predictedLoad,
      confidence: 0.7,
      timeWindow: this.config.predictionWindow,
      factors: [
        {
          name: 'trend',
          weight: 1.0,
          value: trend,
          trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable'
        }
      ],
      timestamp: new Date()
    };
  }

  private adaptiveStrategySelection(task: TaskDefinition): LoadBalancingStrategy {
    const systemLoad = this.calculateSystemLoad();
    const systemErrorRate = this.calculateSystemErrorRate();
    
    if (systemErrorRate > 0.1) {
      return 'performance-based';
    } else if (systemLoad > 0.8) {
      return 'least-loaded';
    } else if (this.config.predictiveModeling) {
      return 'predictive';
    } else {
      return 'hybrid';
    }
  }

  private applyRules(task: TaskDefinition): LoadBalancingDecision | undefined {
    for (const rule of this.rules) {
      if (rule.enabled && this.evaluateRule(rule, task)) {
        return this.executeRuleAction(rule, task);
      }
    }
    return undefined;
  }

  private evaluateRule(rule: LoadBalancingRule, task: TaskDefinition): boolean {
    // Simple rule evaluation - could be more sophisticated
    return true; // Placeholder
  }

  private executeRuleAction(rule: LoadBalancingRule, task: TaskDefinition): LoadBalancingDecision {
    // Execute rule action - placeholder implementation
    return {
      selectedAgent: '',
      strategy: this.currentStrategy,
      confidence: 0.5,
      reasoning: `Rule applied: ${rule.name}`,
      alternatives: [],
      timestamp: new Date()
    };
  }

  private handleTaskCompletion(result: TaskResult): void {
    // Update performance metrics based on task completion
    // Note: TaskResult doesn't have agentId, this would need to be tracked separately
    this.logger.debug('Task completed, updating metrics');
  }

  private handleTaskFailure(error: any): void {
    // Update performance metrics based on task failure
    this.logger.debug('Task failed, updating metrics', { error });
  }

  private updateMetrics(): void {
    const now = Date.now();
    const agents = Array.from(this.agents.values());
    
    // Update load distribution
    this.metrics.loadDistribution.clear();
    for (const agent of agents) {
      this.metrics.loadDistribution.set(agent.agentId, agent.currentLoad);
    }
    
    // Calculate average response time
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    
    for (const history of this.performanceHistory.values()) {
      if (history.responseTimes.length > 0) {
        totalResponseTime += history.responseTimes.reduce((sum, time) => sum + time, 0);
        responseTimeCount += history.responseTimes.length;
      }
    }
    
    this.metrics.averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    
    // Calculate throughput
    this.metrics.throughput = this.metrics.successfulAssignments / Math.max(1, (now - 0) / 60000); // per minute
  }
}