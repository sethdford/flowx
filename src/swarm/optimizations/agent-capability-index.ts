/**
 * Agent Capability Index
 * Provides O(1) agent selection through capability mapping and performance tracking
 */

import { EventEmitter } from 'node:events';
import { Logger } from "../../core/logger.js";
import { TTLMap } from "./ttl-map.js";
import { CircularBuffer } from "./circular-buffer.js";
import type { AgentId, TaskType, TaskPriority } from "../types.js";

export interface AgentCapability {
  taskType: TaskType;
  priority: TaskPriority;
  complexity: 'low' | 'medium' | 'high';
  specialization?: string[];
  requiresKnowledge?: string[];
}

export interface AgentPerformanceMetrics {
  agentId: AgentId;
  totalTasks: number;
  successfulTasks: number;
  averageExecutionTime: number;
  reliabilityScore: number; // 0-1 based on success rate
  workloadScore: number; // 0-1 based on current load
  lastTaskTime: Date;
  currentLoad: number; // Active tasks count
  specialtyScores: Map<string, number>; // Performance by specialty
}

export interface CapabilityMatch {
  agentId: AgentId;
  matchScore: number;
  performanceScore: number;
  workloadScore: number;
  combinedScore: number;
  confidence: number;
  estimatedExecutionTime: number;
}

export interface IndexConfig {
  performanceHistorySize?: number;
  performanceDecayFactor?: number;
  workloadBalancingWeight?: number;
  capabilityCacheTimeout?: number;
  minConfidenceThreshold?: number;
  maxRecommendations?: number;
}

export class AgentCapabilityIndex extends EventEmitter {
  private capabilityMap: Map<string, Set<AgentId>> = new Map();
  private agentCapabilities: Map<AgentId, AgentCapability[]> = new Map();
  private performanceMetrics: Map<AgentId, AgentPerformanceMetrics> = new Map();
  private performanceHistory: Map<AgentId, CircularBuffer<number>> = new Map();
  private taskExecutionCache: TTLMap<string, CapabilityMatch[]>;
  private workloadTracker: Map<AgentId, number> = new Map();
  
  private config: IndexConfig;
  private logger: Logger;
  private metricsUpdateInterval?: ReturnType<typeof setInterval>;
  private isInitialized = false;

  constructor(config: Partial<IndexConfig> = {}) {
    super();
    
    this.config = {
      performanceHistorySize: 100,
      performanceDecayFactor: 0.95,
      workloadBalancingWeight: 0.3,
      capabilityCacheTimeout: 300000, // 5 minutes
      minConfidenceThreshold: 0.6,
      maxRecommendations: 5,
      ...config
    };

    this.logger = Logger.getInstance();
    this.taskExecutionCache = new TTLMap({
      defaultTTL: this.config.capabilityCacheTimeout!,
      maxSize: 1000
    });

    this.initializeMetricsTracking();
  }

  /**
   * Initialize the index with agent capabilities
   */
  async initialize(agents: { id: AgentId; capabilities: AgentCapability[] }[]): Promise<void> {
    try {
      this.logger.info('Initializing Agent Capability Index', { agentCount: agents.length });

      // Clear existing data
      this.capabilityMap.clear();
      this.agentCapabilities.clear();
      this.performanceMetrics.clear();
      this.performanceHistory.clear();

      // Index agents by capabilities
      for (const agent of agents) {
        await this.registerAgent(agent.id, agent.capabilities);
      }

      this.isInitialized = true;
      this.emit('initialized', { agentCount: agents.length });
      
      this.logger.info('Agent Capability Index initialized successfully', {
        agentCount: agents.length,
        capabilityTypes: this.capabilityMap.size
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize Agent Capability Index', error);
      throw error;
    }
  }

  /**
   * Register a new agent with capabilities
   */
  async registerAgent(agentId: AgentId, capabilities: AgentCapability[]): Promise<void> {
    this.agentCapabilities.set(agentId, capabilities);
    
    // Initialize performance metrics
    this.performanceMetrics.set(agentId, {
      agentId,
      totalTasks: 0,
      successfulTasks: 0,
      averageExecutionTime: 0,
      reliabilityScore: 1.0,
      workloadScore: 1.0,
      lastTaskTime: new Date(),
      currentLoad: 0,
      specialtyScores: new Map()
    });

    // Initialize performance history
    this.performanceHistory.set(agentId, new CircularBuffer(this.config.performanceHistorySize!));
    this.workloadTracker.set(agentId, 0);

    // Index capabilities for O(1) lookup
    for (const capability of capabilities) {
      const key = this.generateCapabilityKey(capability);
      if (!this.capabilityMap.has(key)) {
        this.capabilityMap.set(key, new Set());
      }
      this.capabilityMap.get(key)!.add(agentId);
    }

    this.emit('agentRegistered', { agentId, capabilityCount: capabilities.length });
  }

  /**
   * Find best agents for a task - O(1) lookup time
   */
  async findBestAgents(
    taskType: TaskType,
    priority: TaskPriority,
    complexity: 'low' | 'medium' | 'high',
    specialization?: string[],
    requiresKnowledge?: string[]
  ): Promise<CapabilityMatch[]> {
    
    if (!this.isInitialized) {
      throw new Error('AgentCapabilityIndex not initialized');
    }

    const cacheKey = this.generateCacheKey(taskType, priority, complexity, specialization, requiresKnowledge);
    
    // Check cache first
    const cached = this.taskExecutionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const capability: AgentCapability = {
      taskType,
      priority,
      complexity,
      specialization,
      requiresKnowledge
    };

    // O(1) lookup of capable agents
    const capableAgents = this.getCapableAgents(capability);
    
    if (capableAgents.length === 0) {
      return [];
    }

    // Score and rank agents
    const matches = await this.scoreAgents(capableAgents, capability);
    
    // Sort by combined score
    matches.sort((a, b) => b.combinedScore - a.combinedScore);
    
    // Filter by confidence threshold and limit results
    const qualified = matches.filter(m => m.confidence >= this.config.minConfidenceThreshold!)
                            .slice(0, this.config.maxRecommendations!);

    // Cache results
    this.taskExecutionCache.set(cacheKey, qualified);
    
    this.emit('agentsFound', {
      taskType,
      capableAgents: capableAgents.length,
      qualifiedAgents: qualified.length
    });

    return qualified;
  }

  /**
   * Update agent performance after task completion
   */
  async updateAgentPerformance(
    agentId: AgentId,
    taskType: TaskType,
    executionTimeMs: number,
    success: boolean,
    specialty?: string
  ): Promise<void> {
    
    const metrics = this.performanceMetrics.get(agentId);
    if (!metrics) {
      this.logger.warn('Agent not found for performance update', { agentId });
      return;
    }

    // Update performance history
    const history = this.performanceHistory.get(agentId)!;
    history.push(success ? 1 : 0);

    // Update metrics
    metrics.totalTasks++;
    if (success) {
      metrics.successfulTasks++;
    }

    // Update average execution time with exponential smoothing
    const alpha = 0.1; // Smoothing factor
    metrics.averageExecutionTime = metrics.averageExecutionTime === 0 
      ? executionTimeMs
      : (alpha * executionTimeMs) + ((1 - alpha) * metrics.averageExecutionTime);

    // Update reliability score
    metrics.reliabilityScore = metrics.successfulTasks / metrics.totalTasks;

    // Update specialty scores if provided
    if (specialty && specialty.length > 0) {
      const currentScore = metrics.specialtyScores.get(specialty) || 0.5;
      const newScore = success ? Math.min(1.0, currentScore + 0.1) : Math.max(0.0, currentScore - 0.1);
      metrics.specialtyScores.set(specialty, newScore);
    }

    metrics.lastTaskTime = new Date();

    // Invalidate cache for this agent
    this.invalidateCacheForAgent(agentId);

    this.emit('performanceUpdated', {
      agentId,
      reliabilityScore: metrics.reliabilityScore,
      averageExecutionTime: metrics.averageExecutionTime
    });
  }

  /**
   * Update agent workload
   */
  updateAgentWorkload(agentId: AgentId, currentLoad: number): void {
    this.workloadTracker.set(agentId, currentLoad);
    
    const metrics = this.performanceMetrics.get(agentId);
    if (metrics) {
      metrics.currentLoad = currentLoad;
      // Calculate workload score (inverse of load)
      metrics.workloadScore = Math.max(0.1, 1.0 - (currentLoad / 10)); // Assume max load of 10
    }
  }

  /**
   * Get performance metrics for an agent
   */
  getAgentMetrics(agentId: AgentId): AgentPerformanceMetrics | undefined {
    return this.performanceMetrics.get(agentId);
  }

  /**
   * Get all indexed agents
   */
  getAllAgents(): AgentId[] {
    return Array.from(this.agentCapabilities.keys());
  }

  /**
   * Get index statistics
   */
  getIndexStats(): {
    totalAgents: number;
    capabilityTypes: number;
    cacheHitRate: number;
    averageReliability: number;
  } {
    const totalAgents = this.agentCapabilities.size;
    const capabilityTypes = this.capabilityMap.size;
    const cacheStats = this.taskExecutionCache.getStats();
    
    let totalReliability = 0;
    for (const metrics of this.performanceMetrics.values()) {
      totalReliability += metrics.reliabilityScore;
    }
    
    return {
      totalAgents,
      capabilityTypes,
      cacheHitRate: cacheStats.hitRate,
      averageReliability: totalAgents > 0 ? totalReliability / totalAgents : 0
    };
  }

  /**
   * Shutdown the index
   */
  async shutdown(): Promise<void> {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    
    this.capabilityMap.clear();
    this.agentCapabilities.clear();
    this.performanceMetrics.clear();
    this.performanceHistory.clear();
    this.taskExecutionCache.clear();
    this.workloadTracker.clear();
    
    this.emit('shutdown');
    this.logger.info('Agent Capability Index shutdown complete');
  }

  // Private methods

  private initializeMetricsTracking(): void {
    // Update workload scores periodically
    this.metricsUpdateInterval = setInterval(() => {
      this.updateWorkloadScores();
    }, 30000); // Every 30 seconds
  }

  private generateCapabilityKey(capability: AgentCapability): string {
    const parts: string[] = [
      capability.taskType,
      capability.priority,
      capability.complexity
    ];
    
    if (capability.specialization?.length) {
      parts.push(...capability.specialization.sort());
    }
    
    return parts.join('|');
  }

  private generateCacheKey(
    taskType: TaskType,
    priority: TaskPriority,
    complexity: 'low' | 'medium' | 'high',
    specialization?: string[],
    requiresKnowledge?: string[]
  ): string {
    const parts: string[] = [taskType, priority, complexity];
    
    if (specialization?.length) {
      parts.push('spec:' + specialization.sort().join(','));
    }
    
    if (requiresKnowledge?.length) {
      parts.push('req:' + requiresKnowledge.sort().join(','));
    }
    
    return parts.join('|');
  }

  private getCapableAgents(capability: AgentCapability): AgentId[] {
    const agentSet = new Set<AgentId>();
    
    // Primary capability lookup
    const primaryKey = this.generateCapabilityKey(capability);
    const primaryAgents = this.capabilityMap.get(primaryKey);
    if (primaryAgents) {
      primaryAgents.forEach(id => agentSet.add(id));
    }

    // Fallback: find agents with overlapping capabilities
    if (agentSet.size === 0) {
      const relaxedKey = `${capability.taskType}|${capability.priority}`;
      for (const [key, agents] of this.capabilityMap.entries()) {
        if (key.startsWith(relaxedKey)) {
          agents.forEach(id => agentSet.add(id));
        }
      }
    }

    return Array.from(agentSet);
  }

  private async scoreAgents(agentIds: AgentId[], capability: AgentCapability): Promise<CapabilityMatch[]> {
    const matches: CapabilityMatch[] = [];

    for (const agentId of agentIds) {
      const metrics = this.performanceMetrics.get(agentId);
      const agentCapabilities = this.agentCapabilities.get(agentId);
      
      if (!metrics || !agentCapabilities) continue;

      const matchScore = this.calculateMatchScore(agentCapabilities, capability);
      const performanceScore = this.calculatePerformanceScore(metrics, capability);
      const workloadScore = metrics.workloadScore;

      const combinedScore = (
        matchScore * 0.4 +
        performanceScore * 0.4 +
        workloadScore * this.config.workloadBalancingWeight!
      );

      const confidence = Math.min(1.0, matchScore * performanceScore);
      const estimatedExecutionTime = this.estimateExecutionTime(metrics, capability);

      matches.push({
        agentId,
        matchScore,
        performanceScore,
        workloadScore,
        combinedScore,
        confidence,
        estimatedExecutionTime
      });
    }

    return matches;
  }

  private calculateMatchScore(agentCapabilities: AgentCapability[], targetCapability: AgentCapability): number {
    let bestMatch = 0;

    for (const capability of agentCapabilities) {
      let score = 0;

      // Task type match (required)
      if (capability.taskType === targetCapability.taskType) {
        score += 0.4;
      }

      // Priority match
      if (capability.priority === targetCapability.priority) {
        score += 0.2;
      }

      // Complexity match
      if (capability.complexity === targetCapability.complexity) {
        score += 0.2;
      }

      // Specialization match
      if (targetCapability.specialization && capability.specialization) {
        const overlap = targetCapability.specialization.filter(s => 
          capability.specialization!.includes(s)
        ).length;
        score += (overlap / targetCapability.specialization.length) * 0.2;
      } else if (!targetCapability.specialization) {
        score += 0.2; // No specialization required
      }

      bestMatch = Math.max(bestMatch, score);
    }

    return bestMatch;
  }

  private calculatePerformanceScore(metrics: AgentPerformanceMetrics, capability: AgentCapability): number {
    let score = metrics.reliabilityScore * 0.6; // Base reliability

    // Specialty performance boost
    if (capability.specialization) {
      for (const specialty of capability.specialization) {
        const specialtyScore = metrics.specialtyScores.get(specialty) || 0.5;
        score += specialtyScore * 0.1;
      }
    }

    // Recent activity boost
    const daysSinceLastTask = (Date.now() - metrics.lastTaskTime.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - daysSinceLastTask / 7); // Decay over 7 days
    score += recencyScore * 0.1;

    return Math.min(1.0, score);
  }

  private estimateExecutionTime(metrics: AgentPerformanceMetrics, capability: AgentCapability): number {
    let baseTime = metrics.averageExecutionTime || 60000; // Default 1 minute

    // Adjust based on complexity
    const complexityMultiplier = {
      'low': 0.7,
      'medium': 1.0,
      'high': 1.5
    }[capability.complexity];

    // Adjust based on current load
    const loadMultiplier = 1 + (metrics.currentLoad * 0.2);

    return baseTime * complexityMultiplier * loadMultiplier;
  }

  private updateWorkloadScores(): void {
    for (const [agentId, load] of this.workloadTracker.entries()) {
      const metrics = this.performanceMetrics.get(agentId);
      if (metrics) {
        metrics.workloadScore = Math.max(0.1, 1.0 - (load / 10));
      }
    }
  }

  private invalidateCacheForAgent(agentId: AgentId): void {
    // Could be optimized further with agent-specific cache keys
    this.taskExecutionCache.clear();
  }
} 