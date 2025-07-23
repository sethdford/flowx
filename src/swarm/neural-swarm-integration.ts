/**
 * Neural Swarm Integration
 * Integrates neural pattern detection with swarm coordination for intelligent behavior
 */

import { EventEmitter } from 'node:events';
import { ILogger } from '../core/logger.js';
import { NeuralPatternEngine, PatternPrediction, NeuralTrainingData } from '../coordination/neural-pattern-engine.js';
import { SwarmCoordinator } from './coordinator.js';
import { AgentState, TaskDefinition, SwarmObjective } from './types.js';
import { generateId } from '../utils/helpers.js';

export interface SwarmPattern {
  id: string;
  type: 'task_distribution' | 'agent_collaboration' | 'resource_optimization' | 'performance_optimization' | 'failure_prediction' | 'load_balancing';
  description: string;
  confidence: number;
  applicability: number;
  recommendation: {
    action: string;
    parameters: Record<string, any>;
    expectedImprovement: number;
    riskAssessment: string;
  };
  historical_performance: {
    successRate: number;
    averageImprovement: number;
    timesApplied: number;
  };
}

export interface SwarmIntelligence {
  currentPatterns: SwarmPattern[];
  learningRate: number;
  adaptationSpeed: number;
  predictionAccuracy: number;
  optimizationLevel: number;
}

export interface NeuralSwarmMetrics {
  patternsDetected: number;
  patternsApplied: number;
  performanceImprovement: number;
  adaptationEvents: number;
  predictionAccuracy: number;
  learningEfficiency: number;
}

export class NeuralSwarmIntegration extends EventEmitter {
  private logger: ILogger;
  private neuralEngine: NeuralPatternEngine;
  private swarmCoordinator: SwarmCoordinator;
  
  // Pattern tracking
  private detectedPatterns: Map<string, SwarmPattern> = new Map();
  private appliedPatterns: Map<string, { pattern: SwarmPattern; result: any; timestamp: Date }> = new Map();
  private patternHistory: Array<{ timestamp: Date; pattern: SwarmPattern; success: boolean }> = [];
  
  // Learning and adaptation
  private swarmBehaviorData: Array<{
    timestamp: Date;
    swarmState: any;
    actions: any[];
    outcomes: any[];
    performance: number;
  }> = [];
  
  // Performance tracking
  private metrics: NeuralSwarmMetrics = {
    patternsDetected: 0,
    patternsApplied: 0,
    performanceImprovement: 0,
    adaptationEvents: 0,
    predictionAccuracy: 0,
    learningEfficiency: 0
  };
  
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private learningInterval?: NodeJS.Timeout;

  constructor(
    logger: ILogger,
    neuralEngine: NeuralPatternEngine,
    swarmCoordinator: SwarmCoordinator
  ) {
    super();
    this.logger = logger;
    this.neuralEngine = neuralEngine;
    this.swarmCoordinator = swarmCoordinator;
    
    this.setupEventHandlers();
  }

  /**
   * Initialize neural swarm integration
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Neural Swarm Integration...');
    
    try {
      // Ensure neural engine is initialized
      if (!this.neuralEngine['isInitialized']) {
        await this.neuralEngine.initialize();
      }
      
      // Start monitoring swarm behavior
      await this.startSwarmMonitoring();
      
      // Load historical patterns
      await this.loadHistoricalPatterns();
      
      this.logger.info('Neural Swarm Integration initialized successfully');
      this.emit('initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize Neural Swarm Integration', { error });
      throw error;
    }
  }

  /**
   * Analyze current swarm state and detect patterns
   */
  async analyzeSwarmState(): Promise<SwarmPattern[]> {
    try {
      // Get current swarm status
      const swarmStatus = this.swarmCoordinator.getSwarmStatus();
      const agents = this.swarmCoordinator.getAgents();
      const tasks = this.swarmCoordinator.getTasks();
      
      // Prepare data for neural analysis
      const swarmData = this.prepareSwarmDataForAnalysis(swarmStatus, agents, tasks);
      
      // Use neural engine to recognize patterns
      const predictions = await this.neuralEngine.recognizePattern(swarmData, {
        patternType: 'swarm_behavior',
        threshold: 0.6,
        maxResults: 10
      });
      
      // Convert neural predictions to swarm patterns
      const swarmPatterns = await this.convertPredictionsToSwarmPatterns(predictions, swarmData);
      
      // Update detected patterns
      for (const pattern of swarmPatterns) {
        this.detectedPatterns.set(pattern.id, pattern);
      }
      
      this.metrics.patternsDetected += swarmPatterns.length;
      
      this.logger.debug('Swarm patterns detected', {
        count: swarmPatterns.length,
        types: swarmPatterns.map(p => p.type)
      });
      
      this.emit('patterns:detected', { patterns: swarmPatterns });
      
      return swarmPatterns;
      
    } catch (error) {
      this.logger.error('Failed to analyze swarm state', { error });
      return [];
    }
  }

  /**
   * Apply intelligent optimizations based on detected patterns
   */
  async applySwarmOptimizations(patterns?: SwarmPattern[]): Promise<void> {
    const patternsToApply = patterns || Array.from(this.detectedPatterns.values());
    
    for (const pattern of patternsToApply) {
      if (pattern.confidence > 0.7 && pattern.applicability > 0.8) {
        try {
          await this.applyPattern(pattern);
        } catch (error) {
          this.logger.warn('Failed to apply pattern', { 
            patternId: pattern.id, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  /**
   * Predict swarm performance and potential issues
   */
  async predictSwarmPerformance(): Promise<{
    predictedEfficiency: number;
    potentialBottlenecks: string[];
    recommendedActions: string[];
    riskAssessment: string;
  }> {
    try {
      const swarmStatus = this.swarmCoordinator.getSwarmStatus();
      const historicalData = this.swarmBehaviorData.slice(-50); // Last 50 data points
      
      // Prepare data for prediction
      const predictionData = [
        swarmStatus.agents.total,
        swarmStatus.agents.busy / Math.max(1, swarmStatus.agents.total),
        swarmStatus.tasks.running / Math.max(1, swarmStatus.tasks.total),
        swarmStatus.uptime / 3600000, // Hours
        ...historicalData.map(d => d.performance)
      ];
      
      // Use neural engine for prediction
      const prediction = await this.neuralEngine.predict('swarm-performance', predictionData, {
        includeReasoning: true,
        includeAlternatives: true
      });
      
      const predictedEfficiency = Math.max(0, Math.min(1, prediction.confidence));
      
      // Analyze for bottlenecks
      const bottlenecks = await this.identifyBottlenecks(swarmStatus);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(prediction, bottlenecks);
      
      return {
        predictedEfficiency,
        potentialBottlenecks: bottlenecks,
        recommendedActions: recommendations,
        riskAssessment: this.assessRisk(predictedEfficiency, bottlenecks)
      };
      
    } catch (error) {
      this.logger.error('Failed to predict swarm performance', { error });
      
      return {
        predictedEfficiency: 0.5,
        potentialBottlenecks: ['prediction-unavailable'],
        recommendedActions: ['monitor-manually'],
        riskAssessment: 'unknown'
      };
    }
  }

  /**
   * Learn from swarm execution patterns
   */
  async learnFromExecution(
    objective: SwarmObjective,
    performance: {
      efficiency: number;
      quality: number;
      duration: number;
      resourceUtilization: number;
    }
  ): Promise<void> {
    try {
      const swarmState = {
        objective: objective.description,
        strategy: objective.strategy,
        agentCount: this.swarmCoordinator.getAgents().length,
        taskCount: objective.tasks.length,
        complexity: this.estimateComplexity(objective)
      };
      
      // Create training data
      const trainingData: NeuralTrainingData = {
        input: [
          swarmState.agentCount,
          swarmState.taskCount,
          swarmState.complexity,
          objective.strategy === 'research' ? 1 : 0,
          objective.strategy === 'development' ? 1 : 0,
          objective.strategy === 'analysis' ? 1 : 0
        ],
        output: performance.efficiency,
        weight: performance.quality, // Weight by quality
        context: {
          objective: objective.description,
          strategy: objective.strategy,
          timestamp: new Date(),
          performance
        }
      };
      
      // Add to neural engine for learning
      await this.neuralEngine.addTrainingData([trainingData]);
      
      // Store for pattern analysis
      this.swarmBehaviorData.push({
        timestamp: new Date(),
        swarmState,
        actions: [], // Could be populated with actual actions
        outcomes: [performance],
        performance: performance.efficiency
      });
      
      // Limit history size
      if (this.swarmBehaviorData.length > 1000) {
        this.swarmBehaviorData = this.swarmBehaviorData.slice(-1000);
      }
      
      this.metrics.learningEfficiency += 0.1;
      
      this.logger.debug('Learning from swarm execution', {
        objective: objective.description,
        performance: performance.efficiency
      });
      
      this.emit('learning:completed', { objective, performance });
      
    } catch (error) {
      this.logger.error('Failed to learn from execution', { error });
    }
  }

  /**
   * Get neural swarm intelligence metrics
   */
  getSwarmIntelligence(): SwarmIntelligence {
    const patterns = Array.from(this.detectedPatterns.values());
    
    return {
      currentPatterns: patterns,
      learningRate: this.calculateLearningRate(),
      adaptationSpeed: this.calculateAdaptationSpeed(),
      predictionAccuracy: this.metrics.predictionAccuracy,
      optimizationLevel: this.calculateOptimizationLevel()
    };
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Listen to swarm coordinator events
    this.swarmCoordinator.on('task:completed', async (event) => {
      await this.analyzeTaskCompletion(event);
    });
    
    this.swarmCoordinator.on('agent:performance', async (event) => {
      await this.analyzeAgentPerformance(event);
    });
    
    this.swarmCoordinator.on('objective:completed', async (event) => {
      await this.learnFromObjectiveCompletion(event);
    });
  }

  private async startSwarmMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Monitor swarm state every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.analyzeSwarmState();
      } catch (error) {
        this.logger.warn('Monitoring cycle failed', { error });
      }
    }, 30000);
    
    // Learning cycle every 5 minutes
    this.learningInterval = setInterval(async () => {
      try {
        await this.performLearningCycle();
      } catch (error) {
        this.logger.warn('Learning cycle failed', { error });
      }
    }, 300000);
    
    this.logger.info('Swarm monitoring started');
  }

  private prepareSwarmDataForAnalysis(swarmStatus: any, agents: AgentState[], tasks: TaskDefinition[]): any[] {
    return [
      // Swarm metrics
      swarmStatus.agents.total,
      swarmStatus.agents.idle,
      swarmStatus.agents.busy,
      swarmStatus.tasks.total,
      swarmStatus.tasks.completed,
      swarmStatus.tasks.failed,
      
      // Agent performance
      agents.length > 0 ? agents.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0) / agents.length : 0,
      agents.length > 0 ? agents.reduce((sum, a) => sum + a.metrics.successRate, 0) / agents.length : 0,
      agents.length > 0 ? agents.reduce((sum, a) => sum + a.workload, 0) / agents.length : 0,
      
      // Task complexity (using available properties)
      tasks.length > 0 ? tasks.reduce((sum, t) => sum + t.attempts.length, 0) / tasks.length : 0,
      tasks.length > 0 ? tasks.filter(t => t.priority === 'high').length / tasks.length : 0,
      
      // Time factors
      swarmStatus.uptime / 3600000, // Hours
      Date.now() % (24 * 3600000) / (24 * 3600000) // Time of day factor
    ];
  }

  private async convertPredictionsToSwarmPatterns(
    predictions: PatternPrediction[],
    swarmData: any[]
  ): Promise<SwarmPattern[]> {
    const patterns: SwarmPattern[] = [];
    
    for (const prediction of predictions) {
      const pattern: SwarmPattern = {
        id: generateId('pattern'),
        type: this.inferPatternType(prediction.pattern),
        description: prediction.reasoning || `Pattern: ${prediction.pattern}`,
        confidence: prediction.confidence,
        applicability: this.calculateApplicability(prediction, swarmData),
        recommendation: {
          action: this.generateActionFromPattern(prediction.pattern),
          parameters: prediction.metadata || {},
          expectedImprovement: prediction.confidence * 0.3, // Conservative estimate
          riskAssessment: prediction.confidence > 0.8 ? 'low' : 'medium'
        },
        historical_performance: {
          successRate: 0.7, // Default, will be updated with real data
          averageImprovement: 0.2,
          timesApplied: 0
        }
      };
      
      patterns.push(pattern);
    }
    
    return patterns;
  }

  private async applyPattern(pattern: SwarmPattern): Promise<void> {
    this.logger.info('Applying swarm pattern', {
      patternId: pattern.id,
      type: pattern.type,
      confidence: pattern.confidence
    });
    
    try {
      let result: any = null;
      
      switch (pattern.type) {
        case 'task_distribution':
          result = await this.optimizeTaskDistribution(pattern);
          break;
        case 'agent_collaboration':
          result = await this.enhanceAgentCollaboration(pattern);
          break;
        case 'resource_optimization':
          result = await this.optimizeResources(pattern);
          break;
        case 'performance_optimization':
          result = await this.optimizePerformance(pattern);
          break;
        case 'load_balancing':
          result = await this.balanceLoad(pattern);
          break;
        default:
          this.logger.warn('Unknown pattern type', { type: pattern.type });
          return;
      }
      
      // Record successful application
      this.appliedPatterns.set(pattern.id, {
        pattern,
        result,
        timestamp: new Date()
      });
      
      this.metrics.patternsApplied++;
      this.metrics.adaptationEvents++;
      
      this.emit('pattern:applied', { pattern, result });
      
    } catch (error) {
      this.logger.error('Failed to apply pattern', {
        patternId: pattern.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private inferPatternType(patternName: string): SwarmPattern['type'] {
    if (patternName.includes('distribution') || patternName.includes('assign')) {
      return 'task_distribution';
    }
    if (patternName.includes('collaboration') || patternName.includes('team')) {
      return 'agent_collaboration';
    }
    if (patternName.includes('resource') || patternName.includes('memory')) {
      return 'resource_optimization';
    }
    if (patternName.includes('performance') || patternName.includes('speed')) {
      return 'performance_optimization';
    }
    if (patternName.includes('load') || patternName.includes('balance')) {
      return 'load_balancing';
    }
    return 'performance_optimization'; // Default
  }

  private calculateApplicability(prediction: PatternPrediction, swarmData: any[]): number {
    // Calculate how applicable this pattern is to current swarm state
    const agentCount = swarmData[0] || 0;
    const taskLoad = swarmData[6] || 0;
    
    let applicability = prediction.confidence;
    
    // Adjust based on swarm size
    if (agentCount < 2 && prediction.pattern.includes('collaboration')) {
      applicability *= 0.3; // Low applicability for single agent
    }
    
    // Adjust based on load
    if (taskLoad < 0.3 && prediction.pattern.includes('optimization')) {
      applicability *= 0.5; // Lower need for optimization when load is low
    }
    
    return Math.max(0, Math.min(1, applicability));
  }

  private generateActionFromPattern(patternName: string): string {
    if (patternName.includes('distribution')) return 'redistribute_tasks';
    if (patternName.includes('collaboration')) return 'create_agent_teams';
    if (patternName.includes('resource')) return 'optimize_resource_allocation';
    if (patternName.includes('performance')) return 'tune_performance_parameters';
    if (patternName.includes('load')) return 'balance_agent_workload';
    return 'monitor_and_adjust';
  }

  private async optimizeTaskDistribution(pattern: SwarmPattern): Promise<any> {
    // Implementation would integrate with swarm coordinator
    this.logger.debug('Optimizing task distribution', { pattern: pattern.id });
    return { action: 'task_distribution_optimized', improvement: 0.15 };
  }

  private async enhanceAgentCollaboration(pattern: SwarmPattern): Promise<any> {
    this.logger.debug('Enhancing agent collaboration', { pattern: pattern.id });
    return { action: 'collaboration_enhanced', improvement: 0.20 };
  }

  private async optimizeResources(pattern: SwarmPattern): Promise<any> {
    this.logger.debug('Optimizing resources', { pattern: pattern.id });
    return { action: 'resources_optimized', improvement: 0.10 };
  }

  private async optimizePerformance(pattern: SwarmPattern): Promise<any> {
    this.logger.debug('Optimizing performance', { pattern: pattern.id });
    return { action: 'performance_optimized', improvement: 0.25 };
  }

  private async balanceLoad(pattern: SwarmPattern): Promise<any> {
    this.logger.debug('Balancing load', { pattern: pattern.id });
    return { action: 'load_balanced', improvement: 0.18 };
  }

  private async identifyBottlenecks(swarmStatus: any): Promise<string[]> {
    const bottlenecks: string[] = [];
    
    if (swarmStatus.agents.busy / swarmStatus.agents.total > 0.9) {
      bottlenecks.push('agent_overload');
    }
    
    if (swarmStatus.tasks.failed / swarmStatus.tasks.total > 0.1) {
      bottlenecks.push('high_failure_rate');
    }
    
    if (swarmStatus.uptime > 3600000 && swarmStatus.tasks.completed < 10) {
      bottlenecks.push('low_throughput');
    }
    
    return bottlenecks;
  }

  private async generateRecommendations(prediction: PatternPrediction, bottlenecks: string[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (bottlenecks.includes('agent_overload')) {
      recommendations.push('Scale up agent count');
    }
    
    if (bottlenecks.includes('high_failure_rate')) {
      recommendations.push('Review task complexity and agent capabilities');
    }
    
    if (bottlenecks.includes('low_throughput')) {
      recommendations.push('Optimize task distribution and agent coordination');
    }
    
    if (prediction.confidence < 0.5) {
      recommendations.push('Increase monitoring and data collection');
    }
    
    return recommendations;
  }

  private assessRisk(efficiency: number, bottlenecks: string[]): string {
    if (efficiency > 0.8 && bottlenecks.length === 0) return 'low';
    if (efficiency > 0.6 && bottlenecks.length <= 1) return 'medium';
    return 'high';
  }

  private calculateLearningRate(): number {
    return Math.min(1.0, this.swarmBehaviorData.length / 100);
  }

  private calculateAdaptationSpeed(): number {
    return Math.min(1.0, this.metrics.adaptationEvents / 50);
  }

  private calculateOptimizationLevel(): number {
    return Math.min(1.0, this.metrics.performanceImprovement / 10);
  }

  private estimateComplexity(objective: SwarmObjective): number {
    let complexity = 0;
    complexity += objective.tasks.length * 0.1;
    // Use task attempts and priority instead of non-existent dependencies
    complexity += objective.tasks.reduce((sum, task) => sum + task.attempts.length, 0) * 0.2;
    complexity += objective.tasks.filter(task => task.priority === 'high').length * 0.15;
    complexity += objective.strategy === 'research' ? 0.3 : 0.1;
    return Math.min(1.0, complexity);
  }

  private async loadHistoricalPatterns(): Promise<void> {
    // Implementation would load patterns from persistent storage
    this.logger.debug('Loading historical patterns');
  }

  private async performLearningCycle(): Promise<void> {
    // Implementation would perform periodic learning and model updates
    this.logger.debug('Performing learning cycle');
  }

  private async analyzeTaskCompletion(event: any): Promise<void> {
    // Implementation would analyze task completion patterns
    this.logger.debug('Analyzing task completion', { event });
  }

  private async analyzeAgentPerformance(event: any): Promise<void> {
    // Implementation would analyze agent performance patterns
    this.logger.debug('Analyzing agent performance', { event });
  }

  private async learnFromObjectiveCompletion(event: any): Promise<void> {
    // Implementation would learn from completed objectives
    this.logger.debug('Learning from objective completion', { event });
  }
} 