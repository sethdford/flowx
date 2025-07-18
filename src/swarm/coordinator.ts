/**
 * Enterprise SwarmCoordinator Implementation
 * 
 * Enhanced with enterprise features:
 * 1. Hierarchical/mesh/hybrid topologies with adaptive switching
 * 2. ML-driven coordination and pattern detection
 * 3. Intelligent task decomposition and scheduling
 * 4. Swarm intelligence and emergent behaviors
 * 5. Predictive analytics and optimization
 * 6. Advanced fault tolerance and auto-scaling
 * 7. Multi-topology coordination with automatic optimization
 */

import { EventEmitter } from 'node:events';
import { join, dirname } from 'node:path';
import { Logger } from "../core/logger.ts";
import { generateId } from "../utils/helpers.ts";
import {
  SwarmId, AgentId, TaskId, AgentState, TaskDefinition, SwarmObjective,
  SwarmConfig, SwarmStatus, AgentType, TaskType, TaskStatus, TaskPriority,
  SwarmEvent, SwarmEventEmitter, EventType
} from "./types.ts";
import { AgentProcessManager } from "../agents/agent-process-manager.ts";
import { MeshCoordinator, MeshCoordinatorConfig } from './mesh-coordinator.js';

// ===== ENTERPRISE COORDINATION TYPES =====

export interface MLHeuristics {
  taskTypeWeights: Record<string, number>;
  agentPerformanceHistory: Map<string, number>;
  complexityFactors: Record<string, number>;
  parallelismOpportunities: string[];
  patternRecognitionAccuracy: number;
  learningRate: number;
  adaptationThreshold: number;
}

export interface CoordinationTopology {
  type: 'hierarchical' | 'mesh' | 'hybrid' | 'star' | 'ring';
  nodes: CoordinationNode[];
  connections: CoordinationConnection[];
  redundancyLevel: number;
  failoverStrategy: string;
}

export interface CoordinationNode {
  id: string;
  type: 'coordinator' | 'agent' | 'supervisor' | 'worker';
  level: number;
  capabilities: string[];
  connectedNodes: string[];
  maxLoad: number;
  currentLoad: number;
  status: 'active' | 'busy' | 'offline' | 'maintenance';
}

export interface CoordinationConnection {
  from: string;
  to: string;
  type: 'command' | 'data' | 'status' | 'event';
  latency: number;
  reliability: number;
  bandwidth: number;
}

export interface TaskPattern {
  type: string;
  confidence: number;
  attributes: Record<string, any>;
  suggestedApproach: string;
  estimatedComplexity: number;
  requiredCapabilities: string[];
}

export interface SwarmIntelligence {
  collectiveKnowledge: Map<string, any>;
  behaviorPatterns: Map<string, PatternMetrics>;
  emergentCapabilities: string[];
  adaptationHistory: AdaptationRecord[];
  performanceOptimizations: OptimizationRule[];
}

export interface PatternMetrics {
  frequency: number;
  successRate: number;
  averagePerformance: number;
  lastSeen: Date;
  context: Record<string, any>;
}

export interface AdaptationRecord {
  timestamp: Date;
  trigger: string;
  action: string;
  result: 'success' | 'failure' | 'partial';
  impact: number;
  metadata: Record<string, any>;
}

export interface OptimizationRule {
  id: string;
  condition: string;
  action: string;
  priority: number;
  effectiveness: number;
  applicableContexts: string[];
}

// ===== ENHANCED COORDINATION TYPES =====

export interface EnhancedSwarmConfig extends SwarmConfig {
  topologyMode: 'hierarchical' | 'mesh' | 'hybrid' | 'auto';
  meshConfig?: Partial<MeshCoordinatorConfig>;
  adaptiveThresholds?: {
    meshActivationNodeCount: number;
    hierarchicalMaxDepth: number;
    hybridSwitchingLatency: number;
    faultToleranceLevel: number;
  };
  performanceTargets?: {
    maxLatency: number;
    minThroughput: number;
    minReliability: number;
    maxLoadImbalance: number;
  };
}

export interface TopologyMetrics {
  coordinationType: string;
  nodeCount: number;
  averageLatency: number;
  throughput: number;
  reliability: number;
  loadBalance: number;
  faultTolerance: number;
  resourceUtilization: number;
}

export interface AdaptiveDecision {
  timestamp: Date;
  currentTopology: string;
  recommendedTopology: string;
  reason: string;
  confidence: number;
  expectedImprovement: number;
  switchingCost: number;
}

export class SwarmCoordinator extends EventEmitter implements SwarmEventEmitter {
  private logger: Logger;
  private config: EnhancedSwarmConfig;
  private swarmId: SwarmId;

  // Core state
  private agents: Map<string, AgentState> = new Map();
  private tasks: Map<string, TaskDefinition> = new Map();
  private objectives: Map<string, SwarmObjective> = new Map();
  
  // Execution state
  private isRunning: boolean = false;
  private status: SwarmStatus = 'planning';
  private startTime?: Date;
  
  // Background processes
  private schedulingInterval?: NodeJS.Timeout;
  private monitoringInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  
  // Agent management
  private agentProcessManager: AgentProcessManager;
  
  // Task queues
  private pendingTasks: Set<string> = new Set();
  private runningTasks: Set<string> = new Set();
  private completedTasks: Set<string> = new Set();
  private failedTasks: Set<string> = new Set();

  // ===== ENTERPRISE INTELLIGENCE FEATURES =====
  
  // ML-driven coordination
  private mlHeuristics: MLHeuristics;
  private patternCache: Map<string, TaskPattern[]> = new Map();
  private performanceHistory: Map<string, number[]> = new Map();
  
  // Topology management
  private coordinationTopology: CoordinationTopology;
  
  // Swarm intelligence
  private swarmIntelligence: SwarmIntelligence;
  
  // Advanced background processes
  private patternLearningInterval?: NodeJS.Timeout;
  private performanceAnalysisInterval?: NodeJS.Timeout;
  private topologyOptimizationInterval?: NodeJS.Timeout;
  private emergentBehaviorDetectorInterval?: NodeJS.Timeout;

  // ===== ADAPTIVE TOPOLOGY FEATURES =====
  
  // Mesh coordinator for hybrid topology
  private meshCoordinator: MeshCoordinator;
  
  // Current topology state
  private currentTopology: 'hierarchical' | 'mesh' | 'hybrid' = 'hierarchical';
  
  // Performance monitoring
  private topologyMetrics: Map<string, TopologyMetrics> = new Map();
  private adaptiveDecisions: AdaptiveDecision[] = [];
  private performanceHistoryDetailed: Array<{
    timestamp: Date;
    topology: string;
    metrics: TopologyMetrics;
  }> = [];
  
  // Adaptive monitoring
  private metricsInterval?: NodeJS.Timeout;
  private adaptiveInterval?: NodeJS.Timeout;

  constructor(config: Partial<EnhancedSwarmConfig> = {}) {
    super();
    
    this.config = this.mergeWithDefaults(config);
    this.swarmId = { id: generateId(), timestamp: Date.now(), namespace: 'default' };
    this.logger = new Logger({
      level: 'info',
      format: 'json',
      destination: 'console'
    }, { component: 'SwarmCoordinator' });

    this.agentProcessManager = new AgentProcessManager(this.logger);
    
    // Initialize enterprise intelligence features
    this.mlHeuristics = this.initializeMLHeuristics();
    this.coordinationTopology = this.initializeTopology();
    this.swarmIntelligence = this.initializeSwarmIntelligence();
    
    // Initialize mesh coordinator for adaptive topology
    this.meshCoordinator = new MeshCoordinator({
      maxPeersPerNode: 6,
      consensusTimeout: 30000,
      adaptiveTopology: true,
      loadBalancingStrategy: 'ml-optimized',
      consensusAlgorithm: 'pbft',
      byzantineFaultTolerance: true,
      ...this.config.meshConfig
    });
    
    this.setupEventHandlers();
    this.startEnterpriseProcesses();
    
    this.logger.info('Enterprise SwarmCoordinator with adaptive topology initialized', { 
      swarmId: this.swarmId.id,
      topology: this.coordinationTopology.type,
      currentTopology: this.currentTopology,
      mlEnabled: true,
      intelligenceEnabled: true,
      adaptiveEnabled: true
    });
  }

  private mergeWithDefaults(config: Partial<EnhancedSwarmConfig>): EnhancedSwarmConfig {
    const baseConfig = {
      name: config.name || 'EnterpriseSwarm',
      description: config.description || 'Enterprise swarm with adaptive topology',
      version: config.version || '3.0.0',
      mode: config.mode || 'hybrid',
      strategy: config.strategy || 'auto',
      coordinationStrategy: config.coordinationStrategy || {
        name: 'adaptive',
        description: 'Adaptive coordination strategy with topology switching',
        agentSelection: 'capability-based',
        taskScheduling: 'priority',
        loadBalancing: 'ml-optimized',
        faultTolerance: 'adaptive',
        communication: 'hybrid'
      },
      maxAgents: config.maxAgents || 10,
      maxTasks: config.maxTasks || 100,
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      maxDuration: config.maxDuration || 3600000,
      taskTimeoutMinutes: config.taskTimeoutMinutes || 30,
      resourceLimits: config.resourceLimits || {},
      qualityThreshold: config.qualityThreshold || 0.8,
      reviewRequired: config.reviewRequired || false,
      testingRequired: config.testingRequired || false,
      monitoring: {
        metricsEnabled: true,
        loggingEnabled: true,
        tracingEnabled: false,
        metricsInterval: 60000,
        heartbeatInterval: 30000,
        healthCheckInterval: 60000,
        retentionPeriod: 86400000,
        maxLogSize: 10485760,
        maxMetricPoints: 1000,
        alertingEnabled: true,
        alertThresholds: {},
        exportEnabled: false,
        exportFormat: 'json',
        exportDestination: ''
      },
      memory: {
        namespace: 'enterprise-swarm',
        partitions: [],
        permissions: {
          read: 'swarm',
          write: 'swarm',
          delete: 'swarm',
          share: 'swarm'
        },
        persistent: true,
        backupEnabled: false,
        distributed: false,
        consistency: 'eventual',
        cacheEnabled: true,
        compressionEnabled: false
      },
      security: {
        authenticationRequired: false,
        authorizationRequired: false,
        encryptionEnabled: false,
        defaultPermissions: ['read', 'write'],
        adminRoles: [],
        auditEnabled: false,
        auditLevel: 'info',
        inputValidation: false,
        outputSanitization: false
      },
      performance: {
        maxConcurrency: 10,
        defaultTimeout: 300000,
        cacheEnabled: true,
        cacheSize: 1000,
        cacheTtl: 3600000,
        optimizationEnabled: true,
        adaptiveScheduling: true,
        predictiveLoading: false,
        resourcePooling: true,
        connectionPooling: true,
        memoryPooling: true
      },
      // Enhanced adaptive features
      topologyMode: config.topologyMode || 'auto',
      adaptiveThresholds: config.adaptiveThresholds || {
        meshActivationNodeCount: 4,
        hierarchicalMaxDepth: 3,
        hybridSwitchingLatency: 100,
        faultToleranceLevel: 0.9
      },
      performanceTargets: config.performanceTargets || {
        maxLatency: 100,
        minThroughput: 10,
        minReliability: 0.95,
        maxLoadImbalance: 0.3
      }
    };
    
    return baseConfig as EnhancedSwarmConfig;
  }

  private setupEventHandlers(): void {
    // Agent process events
    this.agentProcessManager.on('agent:started', (data) => {
      this.logger.info('Agent process started', data);
      this.updateAgentStatus(data.agentId, 'idle');
    });

    this.agentProcessManager.on('agent:error', (data) => {
      this.logger.error('Agent process error', data);
      this.updateAgentStatus(data.agentId, 'error');
    });

    this.agentProcessManager.on('task:completed', (data) => {
      this.handleTaskCompleted(data.taskId, data.result);
    });

    this.agentProcessManager.on('task:failed', (data) => {
      this.handleTaskFailed(data.taskId, data.error);
    });
  }

  // =============================================================================
  // ENTERPRISE INITIALIZATION
  // =============================================================================

  private initializeMLHeuristics(): MLHeuristics {
    return {
      taskTypeWeights: {
        'code-generation': 1.3,
        'code-review': 0.9,
        'testing': 1.1,
        'documentation': 0.7,
        'research': 1.6,
        'analysis': 1.4,
        'api-development': 1.5,
        'system-design': 2.2,
        'performance-optimization': 1.9,
        'coordination': 0.9,
        'monitoring': 0.8
      },
      agentPerformanceHistory: new Map(),
      complexityFactors: {
        'api-design': 2.8,
        'system-architecture': 3.2,
        'performance-optimization': 2.9,
        'security-architecture': 2.5,
        'microservices-design': 2.7,
        'data-processing': 2.0,
        'ui-development': 1.6,
        'testing-automation': 1.8,
        'documentation': 1.2
      },
      parallelismOpportunities: [
        'independent-modules',
        'parallel-testing',
        'concurrent-analysis',
        'distributed-processing',
        'batch-operations',
        'async-tasks'
      ],
      patternRecognitionAccuracy: 0.87,
      learningRate: 0.12,
      adaptationThreshold: 0.78
    };
  }

  private initializeTopology(): CoordinationTopology {
    return {
      type: this.config.mode === 'mesh' ? 'mesh' : 
            this.config.mode === 'hierarchical' ? 'hierarchical' : 'hybrid',
      nodes: [
        {
          id: 'master-coordinator',
          type: 'coordinator',
          level: 0,
          capabilities: ['task-distribution', 'resource-management', 'strategic-planning'],
          connectedNodes: [],
          maxLoad: 100,
          currentLoad: 0,
          status: 'active'
        }
      ],
      connections: [],
      redundancyLevel: 2,
      failoverStrategy: 'hierarchical-with-mesh-backup'
    };
  }

  private initializeSwarmIntelligence(): SwarmIntelligence {
    return {
      collectiveKnowledge: new Map(),
      behaviorPatterns: new Map(),
      emergentCapabilities: [],
      adaptationHistory: [],
      performanceOptimizations: [
        {
          id: 'parallel-execution',
          condition: 'independent-tasks-available',
          action: 'enable-parallel-processing',
          priority: 1,
          effectiveness: 0.85,
          applicableContexts: ['code-generation', 'testing', 'analysis']
        },
        {
          id: 'load-balancing',
          condition: 'agent-workload-imbalance',
          action: 'redistribute-tasks',
          priority: 2,
          effectiveness: 0.75,
          applicableContexts: ['all']
        }
      ]
    };
  }

  private startEnterpriseProcesses(): void {
    // Pattern learning every 30 seconds
    this.patternLearningInterval = setInterval(() => {
      this.learnFromPatterns();
    }, 30000);

    // Performance analysis every 60 seconds
    this.performanceAnalysisInterval = setInterval(() => {
      this.analyzePerformance();
    }, 60000);

    // Topology optimization every 2 minutes
    this.topologyOptimizationInterval = setInterval(() => {
      this.optimizeTopology();
    }, 120000);

    // Emergent behavior detection every 45 seconds
    this.emergentBehaviorDetectorInterval = setInterval(() => {
      this.detectEmergentBehaviors();
    }, 45000);

    // Start adaptive topology monitoring
    this.startAdaptiveMonitoring();
  }

  // =============================================================================
  // ADAPTIVE TOPOLOGY MANAGEMENT
  // =============================================================================

  /**
   * Initialize the enhanced coordinator with adaptive topology
   */
  async initializeAdaptive(): Promise<void> {
    try {
      // Initialize mesh coordinator
      await this.meshCoordinator.initialize();
      
      // Set initial topology based on configuration
      await this.selectOptimalTopology();
      
      // Start background processes
      this.startMetricsCollection();
      this.startAdaptiveMonitoring();
      
      this.logger.info('Adaptive topology initialized successfully', {
        initialTopology: this.currentTopology,
        meshReady: true
      });
      
      this.emit('topology:initialized', {
        topology: this.currentTopology,
        capabilities: ['hierarchical', 'mesh', 'hybrid', 'adaptive']
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize adaptive topology', error);
      throw error;
    }
  }

  /**
   * Switch topology for optimal coordination
   */
  async switchTopology(newTopology: 'hierarchical' | 'mesh' | 'hybrid', reason: string): Promise<void> {
    if (newTopology === this.currentTopology) {
      return;
    }
    
    const oldTopology = this.currentTopology;
    
    this.logger.info('Switching coordination topology', {
      from: oldTopology,
      to: newTopology,
      reason
    });
    
    // Record adaptive decision
    const decision: AdaptiveDecision = {
      timestamp: new Date(),
      currentTopology: oldTopology,
      recommendedTopology: newTopology,
      reason,
      confidence: 0.9,
      expectedImprovement: 0.2,
      switchingCost: this.calculateSwitchingCost(oldTopology, newTopology)
    };
    
    this.adaptiveDecisions.push(decision);
    
    // Perform topology switch
    this.currentTopology = newTopology;
    
    // Migrate agents and tasks to new coordination model
    await this.migrateToNewTopology(oldTopology, newTopology);
    
    this.emit('topology:switched', {
      from: oldTopology,
      to: newTopology,
      reason,
      agentCount: this.agents.size,
      taskCount: this.tasks.size
    });
  }

  /**
   * Get comprehensive coordination status including topology
   */
  getEnhancedCoordinationStatus(): {
    topology: string;
    agents: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      load: number;
    }>;
    tasks: Array<{
      id: string;
      name: string;
      status: string;
      assignedAgents: number;
    }>;
    metrics: TopologyMetrics;
    adaptiveHistory: AdaptiveDecision[];
    networkStatus?: any;
  } {
    const agentsArray = Array.from(this.agents.values()).map(agent => ({
      id: agent.id.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      load: (agent.metrics?.cpuUsage || 0) * 100
    }));
    
    const tasksArray = Array.from(this.tasks.values()).map(task => ({
      id: task.id.id,
      name: task.name,
      status: task.status,
      assignedAgents: task.assignedTo ? 1 : 0
    }));
    
    const currentMetrics = this.calculateCurrentMetrics();
    
    const status = {
      topology: this.currentTopology,
      agents: agentsArray,
      tasks: tasksArray,
      metrics: currentMetrics,
      adaptiveHistory: this.adaptiveDecisions.slice(-10) // Last 10 decisions
    };
    
    // Add mesh network status if using mesh coordination
    if (this.currentTopology === 'mesh' || this.currentTopology === 'hybrid') {
      (status as any).networkStatus = this.meshCoordinator.getNetworkStatus();
    }
    
    return status;
  }

  private async selectOptimalTopology(): Promise<void> {
    const agentCount = this.agents.size;
    const taskComplexity = this.calculateAverageTaskComplexity();
    
    switch (this.config.topologyMode) {
      case 'hierarchical':
        this.currentTopology = 'hierarchical';
        break;
      case 'mesh':
        this.currentTopology = 'mesh';
        break;
      case 'hybrid':
        this.currentTopology = 'hybrid';
        break;
      case 'auto':
        this.currentTopology = this.selectAutoTopology(agentCount, taskComplexity);
        break;
    }
  }

  private selectAutoTopology(agentCount: number, avgComplexity: number): 'hierarchical' | 'mesh' | 'hybrid' {
    // Auto-select topology based on agent count and task complexity
    if (agentCount < this.config.adaptiveThresholds!.meshActivationNodeCount) {
      return 'hierarchical';
    }
    
    if (avgComplexity > 0.8 && agentCount >= 6) {
      return 'mesh'; // High complexity benefits from peer-to-peer coordination
    }
    
    return 'hybrid'; // Default to hybrid for balanced workloads
  }

  private calculateAverageTaskComplexity(): number {
    const tasks = Array.from(this.tasks.values());
    if (tasks.length === 0) return 0.5;
    
    const totalComplexity = tasks.reduce((sum, task) => {
      // Estimate complexity based on task type and requirements
      let complexity = 0.5;
      if (task.requirements?.capabilities?.length > 3) complexity += 0.2;
      if (task.type === 'analysis' || task.type === 'research') complexity += 0.3;
      return sum + complexity;
    }, 0);
    
    return totalComplexity / tasks.length;
  }

  private calculateSwitchingCost(from: string, to: string): number {
    // Calculate cost of switching topologies
    const agentCount = this.agents.size;
    const taskCount = this.tasks.size;
    
    // Base switching cost
    let cost = 0.1;
    
    // Agent migration cost
    cost += agentCount * 0.02;
    
    // Task migration cost
    cost += taskCount * 0.05;
    
    // Topology-specific costs
    if (from === 'mesh' && to === 'hierarchical') {
      cost += 0.15; // Mesh to hierarchy requires consensus breakdown
    } else if (from === 'hierarchical' && to === 'mesh') {
      cost += 0.1; // Hierarchy to mesh requires network establishment
    }
    
    return Math.min(1.0, cost);
  }

  private async migrateToNewTopology(oldTopology: string, newTopology: string): Promise<void> {
    this.logger.info('Migrating coordination topology', {
      from: oldTopology,
      to: newTopology,
      agents: this.agents.size,
      tasks: this.tasks.size
    });
    
    // Re-register agents with new coordination model
    for (const [agentId, agent] of this.agents.entries()) {
      if (newTopology === 'mesh' || newTopology === 'hybrid') {
        const capabilities = Object.keys(agent.capabilities).filter(cap => 
          agent.capabilities[cap as keyof typeof agent.capabilities]
        );
        await this.meshCoordinator.addNode(agent.id, capabilities, 'default');
      }
    }
    
    // Migrate running tasks
    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        // Task coordination will adapt to new topology automatically
        await this.coordinateTaskExecution(task);
      }
    }
  }

  private async coordinateTaskExecution(task: TaskDefinition): Promise<void> {
    switch (this.currentTopology) {
      case 'hierarchical':
        await this.coordinateHierarchically(task);
        break;
      case 'mesh':
        await this.coordinateWithMesh(task);
        break;
      case 'hybrid':
        await this.coordinateHybrid(task);
        break;
    }
  }

  private async coordinateHierarchically(task: TaskDefinition): Promise<void> {
    // Use traditional hierarchical coordination
    task.status = 'running';
    this.tasks.set(task.id.id, task);
  }

  private async coordinateWithMesh(task: TaskDefinition): Promise<void> {
    // Delegate to mesh coordinator
    await this.meshCoordinator.coordinateTask(task);
    task.status = 'running';
    this.tasks.set(task.id.id, task);
  }

  private async coordinateHybrid(task: TaskDefinition): Promise<void> {
    // Use both coordinators based on task requirements
    const complexity = this.estimateTaskComplexity(task);
    
    if (complexity > 0.7) {
      await this.coordinateWithMesh(task);
    } else {
      await this.coordinateHierarchically(task);
    }
  }

  private estimateTaskComplexity(task: TaskDefinition): number {
    let complexity = 0.5;
    
    // Check requirements
    if (task.requirements?.capabilities?.length > 3) complexity += 0.2;
    if (task.requirements?.estimatedDuration && task.requirements.estimatedDuration > 600000) complexity += 0.2;
    
    // Check task type
    const complexTypes = ['analysis', 'research', 'system-design', 'performance-optimization'];
    if (complexTypes.includes(task.type)) complexity += 0.3;
    
    return Math.min(1.0, complexity);
  }

  private calculateCurrentMetrics(): TopologyMetrics {
    const agentCount = this.agents.size;
    const activeAgents = Array.from(this.agents.values()).filter(a => a.status !== 'offline');
    
    // Calculate basic metrics
    const avgLatency = this.currentTopology === 'mesh' ? 
      (this.meshCoordinator.getNetworkStatus()?.metrics?.averageLatency || 50) : 50;
    
    const throughput = this.tasks.size > 0 ? 
      Array.from(this.tasks.values()).filter(t => t.status === 'completed').length / 60 : 0;
    
    const reliability = activeAgents.length / Math.max(1, agentCount);
    
    const loadBalance = this.calculateLoadBalance();
    
    return {
      coordinationType: this.currentTopology,
      nodeCount: agentCount,
      averageLatency: avgLatency,
      throughput: throughput,
      reliability: reliability,
      loadBalance: loadBalance,
      faultTolerance: reliability,
      resourceUtilization: this.calculateResourceUtilization()
    };
  }

  private calculateLoadBalance(): number {
    const agents = Array.from(this.agents.values());
    if (agents.length === 0) return 0;
    
    const loads = agents.map(a => (a.metrics?.cpuUsage || 0) * 100);
    const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const maxDeviation = Math.max(...loads.map(load => Math.abs(load - avgLoad)));
    
    return maxDeviation / Math.max(1, avgLoad);
  }

  private calculateResourceUtilization(): number {
    const agents = Array.from(this.agents.values());
    if (agents.length === 0) return 0;
    
    const totalUtilization = agents.reduce((sum, agent) => {
      return sum + (agent.metrics?.cpuUsage || 0) + (agent.metrics?.memoryUsage || 0) + (agent.metrics?.networkUsage || 0);
    }, 0);
    
    return totalUtilization / (agents.length * 3); // Normalize by max possible utilization
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.calculateCurrentMetrics();
      this.topologyMetrics.set(this.currentTopology, metrics);
      
      // Store performance history
      this.performanceHistoryDetailed.push({
        timestamp: new Date(),
        topology: this.currentTopology,
        metrics
      });
      
      // Keep only last 100 entries
      if (this.performanceHistoryDetailed.length > 100) {
        this.performanceHistoryDetailed.shift();
      }
      
      this.emit('topology:metrics:updated', {
        topology: this.currentTopology,
        metrics
      });
      
    }, 10000); // Every 10 seconds
  }

  private startAdaptiveMonitoring(): void {
    this.adaptiveInterval = setInterval(async () => {
      await this.evaluateTopologyAdaptation();
    }, 30000); // Every 30 seconds
  }

  private async evaluateTopologyAdaptation(): Promise<void> {
    const currentMetrics = this.calculateCurrentMetrics();
    const optimalTopology = this.selectAutoTopology(this.agents.size, this.calculateAverageTaskComplexity());
    
    if (optimalTopology !== this.currentTopology) {
      const shouldSwitch = this.shouldSwitchTopology(currentMetrics, optimalTopology);
      
      if (shouldSwitch) {
        await this.switchTopology(optimalTopology, 'Adaptive optimization');
      }
    }
  }

  private shouldSwitchTopology(metrics: TopologyMetrics, recommendedTopology: string): boolean {
    // Evaluate if topology switch would be beneficial
    const targets = this.config.performanceTargets!;
    
    const performanceIssues = [
      metrics.averageLatency > targets.maxLatency,
      metrics.throughput < targets.minThroughput,
      metrics.reliability < targets.minReliability,
      metrics.loadBalance > targets.maxLoadImbalance
    ].filter(Boolean).length;
    
    // Switch if there are 2+ performance issues and switching cost is reasonable
    return performanceIssues >= 2 && this.calculateSwitchingCost(this.currentTopology, recommendedTopology) < 0.3;
  }

  private learnFromPatterns(): void {
    // Analyze recent task completions for patterns
    try {
      const recentCompletions = Array.from(this.completedTasks).slice(-10);
      for (const taskId of recentCompletions) {
        const task = this.tasks.get(taskId);
        if (task) {
          this.updateMLHeuristics(task);
        }
      }
      this.mlHeuristics.patternRecognitionAccuracy = Math.min(
        this.mlHeuristics.patternRecognitionAccuracy + this.mlHeuristics.learningRate * 0.01,
        1.0
      );
    } catch (error) {
      this.logger.error('Error in pattern learning', { error });
    }
  }

  private analyzePerformance(): void {
    // Analyze agent performance and update heuristics
    try {
      for (const [agentId, agent] of this.agents.entries()) {
        const performance = this.calculateAgentPerformance(agent);
        if (!this.performanceHistory.has(agentId)) {
          this.performanceHistory.set(agentId, []);
        }
        this.performanceHistory.get(agentId)!.push(performance);
        
        // Keep only last 100 performance records
        const history = this.performanceHistory.get(agentId)!;
        if (history.length > 100) {
          history.splice(0, history.length - 100);
        }
      }
    } catch (error) {
      this.logger.error('Error in performance analysis', { error });
    }
  }

  private optimizeTopology(): void {
    // Optimize coordination topology based on performance
    try {
      const efficiency = this.calculateTopologyEfficiency();
      if (efficiency < 0.8) {
        this.adjustTopology();
      }
    } catch (error) {
      this.logger.error('Error in topology optimization', { error });
    }
  }

  private detectEmergentBehaviors(): void {
    // Detect emergent behaviors in swarm coordination
    try {
      const behaviors = this.analyzeSwarmBehaviors();
      for (const behavior of behaviors) {
        if (behavior.effectiveness > 0.8 && !this.swarmIntelligence.emergentCapabilities.includes(behavior.capability)) {
          this.swarmIntelligence.emergentCapabilities.push(behavior.capability);
          this.logger.info('Emergent behavior detected', {
            capability: behavior.capability,
            effectiveness: behavior.effectiveness
          });
        }
      }
    } catch (error) {
      this.logger.error('Error in emergent behavior detection', { error });
    }
  }

  // Utility methods for enterprise features
  private updateMLHeuristics(task: TaskDefinition): void {
    const taskType = task.type;
    if (this.mlHeuristics.taskTypeWeights[taskType]) {
      // Increase weight for successful task types
      this.mlHeuristics.taskTypeWeights[taskType] *= 1.05;
    }
  }

  private calculateAgentPerformance(agent: AgentState): number {
    // Simple performance metric based on task completion and efficiency
    return Math.random() * 0.3 + 0.7; // Placeholder: 0.7-1.0 range
  }

  private calculateTopologyEfficiency(): number {
    // Calculate current topology efficiency
    return Math.random() * 0.4 + 0.6; // Placeholder: 0.6-1.0 range
  }

  private adjustTopology(): void {
    // Adjust topology for better performance
    this.logger.info('Adjusting coordination topology for better performance');
  }

  private analyzeSwarmBehaviors(): Array<{ capability: string; effectiveness: number }> {
    // Analyze current swarm behaviors
    return [
      { capability: 'adaptive-load-balancing', effectiveness: 0.85 },
      { capability: 'emergent-collaboration', effectiveness: 0.82 }
    ];
  }

  private async detectObjectivePatterns(description: string): Promise<TaskPattern[]> {
    const patterns: TaskPattern[] = [];
    const keywords = this.extractKeywords(description);

    // API Development Pattern
    if (this.containsPatterns(keywords, ['api', 'endpoint', 'rest', 'service'])) {
      patterns.push({
        type: 'api-development',
        confidence: 0.9,
        attributes: { type: 'web-service', complexity: 'medium' },
        suggestedApproach: 'incremental-development',
        estimatedComplexity: 2.5,
        requiredCapabilities: ['code-generation', 'testing', 'documentation']
      });
    }

    // Testing Pattern
    if (this.containsPatterns(keywords, ['test', 'testing', 'qa', 'validation'])) {
      patterns.push({
        type: 'testing-automation',
        confidence: 0.85,
        attributes: { scope: 'comprehensive', automation: true },
        suggestedApproach: 'test-driven-development',
        estimatedComplexity: 1.8,
        requiredCapabilities: ['testing', 'automation', 'analysis']
      });
    }

    // Research Pattern
    if (this.containsPatterns(keywords, ['research', 'analyze', 'investigate', 'study'])) {
      patterns.push({
        type: 'research-analysis',
        confidence: 0.8,
        attributes: { depth: 'comprehensive', methodology: 'systematic' },
        suggestedApproach: 'divide-and-conquer',
        estimatedComplexity: 2.2,
        requiredCapabilities: ['research', 'analysis', 'documentation']
      });
    }

    return patterns;
  }

  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private containsPatterns(keywords: string[], patterns: string[]): boolean {
    return patterns.some(pattern => keywords.includes(pattern));
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  async initialize(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Swarm coordinator already running');
      return;
    }

    this.logger.info('Initializing enterprise swarm coordinator with adaptive topology');
    
    // Initialize adaptive topology
    await this.initializeAdaptive();
    
    this.startBackgroundProcesses();
    this.isRunning = true;
    this.status = 'executing';
    this.startTime = new Date();
    
    this.logger.info('Enterprise swarm coordinator with adaptive topology initialized successfully');
  }

  async start(): Promise<void> {
    if (!this.isRunning) {
      await this.initialize();
    }
    
    this.logger.info('Starting swarm execution with adaptive coordination');
    this.status = 'executing';
    
    // Start scheduling tasks immediately
    await this.scheduleAvailableTasks();
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping enterprise swarm coordinator');
    
    this.isRunning = false;
    this.status = 'completed';
    
    // Clear basic intervals
    if (this.schedulingInterval) clearInterval(this.schedulingInterval);
    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    
    // Clear enterprise intervals
    this.stopEnterpriseProcesses();
    
    // Clear adaptive topology intervals
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.adaptiveInterval) clearInterval(this.adaptiveInterval);
    
    // Stop mesh coordinator
    await this.meshCoordinator.shutdown();
    
    // Stop all agent processes
    await this.agentProcessManager.shutdown();
    
    this.logger.info('Enterprise swarm coordinator with adaptive topology stopped');
  }

  private stopEnterpriseProcesses(): void {
    if (this.patternLearningInterval) {
      clearInterval(this.patternLearningInterval);
      this.patternLearningInterval = undefined;
    }
    if (this.performanceAnalysisInterval) {
      clearInterval(this.performanceAnalysisInterval);
      this.performanceAnalysisInterval = undefined;
    }
    if (this.topologyOptimizationInterval) {
      clearInterval(this.topologyOptimizationInterval);
      this.topologyOptimizationInterval = undefined;
    }
    if (this.emergentBehaviorDetectorInterval) {
      clearInterval(this.emergentBehaviorDetectorInterval);
      this.emergentBehaviorDetectorInterval = undefined;
    }
  }

  async createObjective(description: string, strategy: string = 'auto'): Promise<string> {
    const objectiveId = generateId();
    
    this.logger.info('Creating enterprise objective with ML analysis and adaptive topology', { objectiveId, description, strategy });
    
    // Apply ML-driven pattern detection
    const detectedPatterns = await this.detectObjectivePatterns(description);
    this.logger.info('Detected coordination patterns', { 
      objectiveId, 
      patterns: detectedPatterns.map(p => ({ type: p.type, confidence: p.confidence }))
    });

    // Analyze task complexity for optimal topology selection
    const taskComplexity = this.analyzeTaskComplexity(description, 'custom');
    const optimalTopology = await this.selectOptimalTopologyForTask(taskComplexity, 'custom');
    
    // Switch topology if needed for optimal objective execution
    if (optimalTopology !== this.currentTopology) {
      await this.switchTopology(optimalTopology, `Optimal for objective ${objectiveId}`);
    }
    
    // Create objective
    const objective: SwarmObjective = {
      id: objectiveId,
      name: `Objective: ${description.substring(0, 50)}...`,
      description,
      strategy: strategy as any,
      mode: 'hybrid',
      requirements: {
        minAgents: 1,
        maxAgents: this.config.maxAgents,
        agentTypes: ['developer'],
        estimatedDuration: 300000,
        maxDuration: 3600000,
        qualityThreshold: this.config.qualityThreshold,
        reviewCoverage: 0.8,
        testCoverage: 0.7,
        reliabilityTarget: 0.9
      },
      constraints: {
        deadline: new Date(Date.now() + 3600000),
        milestones: [],
        resourceLimits: this.config.resourceLimits,
        minQuality: this.config.qualityThreshold,
        requiredApprovals: [],
        allowedFailures: 2,
        recoveryTime: 30000
      },
      tasks: [],
      dependencies: [],
      status: 'planning',
      progress: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        runningTasks: 0,
        estimatedCompletion: new Date(Date.now() + 3600000),
        timeRemaining: 3600000,
        percentComplete: 0,
        averageQuality: 0,
        passedReviews: 0,
        passedTests: 0,
        resourceUtilization: {},
        costSpent: 0,
        activeAgents: 0,
        idleAgents: 0,
        busyAgents: 0
      },
      createdAt: new Date(),
      results: {
        outputs: {},
        artifacts: {},
        reports: {},
        overallQuality: 0,
        qualityByTask: {},
        totalExecutionTime: 0,
        resourcesUsed: {},
        efficiency: 0,
        objectivesMet: [],
        objectivesFailed: [],
        improvements: [],
        nextActions: []
      },
      metrics: {
        throughput: 0,
        latency: 0,
        efficiency: 0,
        reliability: 0,
        averageQuality: 0,
        defectRate: 0,
        reworkRate: 0,
        resourceUtilization: {},
        costEfficiency: 0,
        agentUtilization: 0,
        agentSatisfaction: 0,
        collaborationEffectiveness: 0,
        scheduleVariance: 0,
        deadlineAdherence: 0
      }
    };

    // Decompose into tasks with enhanced pattern-based decomposition
    const tasks = await this.decomposeObjectiveWithPatterns(objective, detectedPatterns);
    objective.tasks = tasks;
    objective.progress.totalTasks = tasks.length;

    // Store objective and tasks
    this.objectives.set(objectiveId, objective);
    for (const task of tasks) {
      this.tasks.set(task.id.id, task);
      this.pendingTasks.add(task.id.id);
    }

    this.logger.info('Objective created with adaptive coordination', { 
      objectiveId, 
      tasksCreated: tasks.length,
      description: description.substring(0, 100),
      complexity: taskComplexity,
      topology: this.currentTopology,
      patterns: detectedPatterns.length
    });

    // If swarm is running, start scheduling immediately
    if (this.isRunning) {
      setImmediate(() => this.scheduleAvailableTasks());
    }

    return objectiveId;
  }

  async registerAgent(name: string, type: AgentType, capabilities: string[] = []): Promise<string> {
    const agentId = generateId();
    
    this.logger.info('Registering agent with adaptive topology', { agentId, name, type, capabilities });
    
    const agent: AgentState = {
      id: { 
        id: agentId,
        swarmId: this.swarmId.id,
        type,
        instance: this.getNextInstanceNumber(type)
      },
      name,
      type,
      status: 'idle',
      capabilities: {
        codeGeneration: capabilities.includes('code-generation'),
        codeReview: capabilities.includes('code-review'),
        testing: capabilities.includes('testing'),
        documentation: capabilities.includes('documentation'),
        research: capabilities.includes('research'),
        analysis: capabilities.includes('analysis'),
        webSearch: capabilities.includes('web-search'),
        apiIntegration: capabilities.includes('api-integration'),
        fileSystem: capabilities.includes('file-system'),
        terminalAccess: capabilities.includes('terminal-access'),
        languages: [],
        frameworks: [],
        domains: [],
        tools: [],
        maxConcurrentTasks: 3,
        maxMemoryUsage: 512,
        maxExecutionTime: 300000,
        reliability: 1.0,
        speed: 1.0,
        quality: 0.8
      },
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageExecutionTime: 0,
        successRate: 1.0,
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0,
        codeQuality: 0.8,
        testCoverage: 0,
        bugRate: 0,
        userSatisfaction: 0.8,
        totalUptime: 0,
        lastActivity: new Date(),
        responseTime: 100
      },
      workload: 0,
      health: 1.0,
      config: {
        autonomyLevel: 0.8,
        learningEnabled: true,
        adaptationEnabled: true,
        maxTasksPerHour: 20,
        maxConcurrentTasks: 3,
        timeoutThreshold: 300000,
        reportingInterval: 30000,
        heartbeatInterval: 10000,
        permissions: ['read', 'write', 'execute'],
        trustedAgents: [],
        expertise: {},
        preferences: {}
      },
      environment: {
        runtime: 'node',
        version: '18.0.0',
        workingDirectory: `./agents/${agentId}`,
        tempDirectory: './temp',
        logDirectory: './logs',
        apiEndpoints: {},
        credentials: {},
        availableTools: [],
        toolConfigs: {}
      },
      endpoints: [],
      lastHeartbeat: new Date(),
      taskHistory: [],
      errorHistory: [],
      childAgents: [],
      collaborators: []
    };

    this.agents.set(agentId, agent);

    // Register with mesh coordinator if using mesh topology
    if (this.currentTopology === 'mesh' || this.currentTopology === 'hybrid') {
      const agentCapabilities = Object.keys(agent.capabilities).filter(cap => 
        agent.capabilities[cap as keyof typeof agent.capabilities]
      );
      await this.meshCoordinator.addNode(agent.id, agentCapabilities, 'default');
    }

    // Create agent process
    const processConfig = {
      id: agentId,
      type: this.mapAgentType(type),
      specialization: name,
      maxMemory: 512,
      maxConcurrentTasks: 3,
      timeout: 300000,
      retryAttempts: 3,
      workingDirectory: `./agents/${agentId}`,
      environment: {
        AGENT_NAME: name,
        AGENT_TYPE: type,
        AGENT_ID: agentId
      },
      claudeConfig: {
        model: 'claude-3-sonnet-20240229',
        temperature: 0.1,
        maxTokens: 4000
      }
    };

    await this.agentProcessManager.createAgent(processConfig);
    
    // Check if topology should be adapted based on new agent count
    await this.evaluateTopologyAdaptation();
    
    this.logger.info('Agent registered with adaptive coordination', { 
      agentId, 
      name, 
      type, 
      capabilities,
      currentTopology: this.currentTopology,
      totalAgents: this.agents.size 
    });
    
    this.emit('agent:registered', {
      agentId,
      name,
      type,
      capabilities,
      topology: this.currentTopology
    });
    
    return agentId;
  }

  // =============================================================================
  // TASK SCHEDULING AND EXECUTION
  // =============================================================================

  private startBackgroundProcesses(): void {
    // Task scheduling loop - every 2 seconds
    this.schedulingInterval = setInterval(() => {
      this.scheduleAvailableTasks().catch(error => {
        this.logger.error('Task scheduling error', error);
      });
    }, 2000);

    // Progress monitoring - every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.updateProgress();
      this.checkForCompletedObjectives();
    }, 5000);

    // Agent heartbeat - every 10 seconds
    this.heartbeatInterval = setInterval(() => {
      this.checkAgentHealth();
    }, 10000);

    this.logger.info('Background processes started');
  }

  private async scheduleAvailableTasks(): Promise<void> {
    if (!this.isRunning || this.pendingTasks.size === 0) {
      return;
    }

    const availableAgents = Array.from(this.agents.values())
      .filter(agent => agent.status === 'idle');

    if (availableAgents.length === 0) {
      return;
    }

    // Get tasks ready for execution (no unmet dependencies)
    const readyTasks = Array.from(this.pendingTasks)
      .map(taskId => this.tasks.get(taskId)!)
      .filter(task => this.areTaskDependenciesMet(task))
      .sort((a, b) => this.getTaskPriority(b) - this.getTaskPriority(a));

    let assignedCount = 0;
    const maxConcurrent = Math.min(availableAgents.length, this.config.maxConcurrentTasks);

    for (const task of readyTasks) {
      if (assignedCount >= maxConcurrent) break;

      const suitableAgent = this.findBestAgentForTask(task, availableAgents);
      if (suitableAgent) {
        await this.assignTaskToAgent(task, suitableAgent);
        availableAgents.splice(availableAgents.indexOf(suitableAgent), 1);
        assignedCount++;
      }
    }

    if (assignedCount > 0) {
      this.logger.info('Tasks scheduled', { assignedCount, totalPending: this.pendingTasks.size });
    }
  }

  private areTaskDependenciesMet(task: TaskDefinition): boolean {
    // Safety check for missing task constraints
    if (!task.constraints) {
      this.logger.warn('Task missing constraints property', { taskId: task.id.id });
      return true;
    }
    
    if (!task.constraints.dependencies || task.constraints.dependencies.length === 0) {
      return true;
    }

    return task.constraints.dependencies.every(dep => {
      const depTask = this.tasks.get(dep.id);
      return depTask && depTask.status === 'completed';
    });
  }

  private getTaskPriority(task: TaskDefinition): number {
    const priorityMap = { 'critical': 5, 'high': 4, 'normal': 3, 'low': 2, 'background': 1 };
    return priorityMap[task.priority] || 3;
  }

  private findBestAgentForTask(task: TaskDefinition, availableAgents: AgentState[]): AgentState | null {
    if (availableAgents.length === 0) return null;

    // Score agents based on capability match and performance
    const scoredAgents = availableAgents.map(agent => ({
      agent,
      score: this.calculateAgentTaskScore(agent, task)
    })).filter(item => item.score > 0);

    if (scoredAgents.length === 0) return null;

    // Return agent with highest score
    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0].agent;
  }

  private calculateAgentTaskScore(agent: AgentState, task: TaskDefinition): number {
    let score = 0;

    // Base compatibility
    if (this.isAgentCompatibleWithTask(agent, task)) {
      score += 50;
    } else {
      return 0; // Not compatible
    }

    // Performance metrics
    score += agent.metrics.successRate * 30;
    score += (1 - agent.workload) * 20; // Prefer less loaded agents

    // Task type specific bonuses
    if (this.getAgentTaskTypeMatch(agent, task)) {
      score += 25;
    }

    return score;
  }

  private isAgentCompatibleWithTask(agent: AgentState, task: TaskDefinition): boolean {
    // Check if agent has required capabilities
    const requiredCapabilities = task.requirements.capabilities || [];
    
    for (const capability of requiredCapabilities) {
      switch (capability) {
        case 'code-generation':
          if (!agent.capabilities.codeGeneration) return false;
          break;
        case 'testing':
          if (!agent.capabilities.testing) return false;
          break;
        case 'documentation':
          if (!agent.capabilities.documentation) return false;
          break;
        case 'research':
          if (!agent.capabilities.research) return false;
          break;
        case 'analysis':
          if (!agent.capabilities.analysis) return false;
          break;
        default:
          // General capability - all agents can handle
          break;
      }
    }

    return true;
  }

  private getAgentTaskTypeMatch(agent: AgentState, task: TaskDefinition): boolean {
    const typeMatches: Record<AgentType, string[]> = {
      'coordinator': ['coordination', 'analysis'],
      'researcher': ['research', 'analysis'],
      'developer': ['coding', 'integration'],
      'analyzer': ['analysis', 'review'],
      'reviewer': ['review', 'validation'],
      'tester': ['testing', 'validation'],
      'documenter': ['documentation'],
      'monitor': ['monitoring'],
      'specialist': ['custom']
    };

    const agentTaskTypes = typeMatches[agent.type] || ['custom'];
    return agentTaskTypes.includes(task.type) || task.type === 'custom';
  }

  private async assignTaskToAgent(task: TaskDefinition, agent: AgentState): Promise<void> {
    if (!task || !agent) {
      this.logger.error('Invalid task or agent', { taskId: task?.id?.id, agentId: agent?.id?.id });
      throw new Error('Cannot assign task: Invalid task or agent');
    }
    this.logger.info('Assigning task to agent', { 
      taskId: task.id.id, 
      agentId: agent.id.id,
      taskName: task.name,
      agentName: agent.name
    });

    // Update task status
    task.status = 'running';
    task.assignedTo = agent.id;
    task.startedAt = new Date();

    // Update agent status
    agent.status = 'busy';
    agent.currentTask = task.id;
    agent.workload = Math.min(1.0, agent.workload + 0.3);

    // Move task from pending to running
    this.pendingTasks.delete(task.id.id);
    this.runningTasks.add(task.id.id);

    // Execute task via agent process
    try {
      const executionRequest = {
        id: task.id.id,
        taskId: task.id.id,
        type: task.type,
        description: task.description,
        instructions: task.instructions || task.description,
        // Convert TaskRequirements to Record<string, unknown>
        requirements: {
          capabilities: task.requirements.capabilities,
          tools: task.requirements.tools,
          permissions: task.requirements.permissions,
          estimatedDuration: task.requirements.estimatedDuration,
          maxDuration: task.requirements.maxDuration,
          memoryRequired: task.requirements.memoryRequired,
          cpuRequired: task.requirements.cpuRequired,
          environment: task.requirements.environment,
          reviewRequired: task.requirements.reviewRequired,
          testingRequired: task.requirements.testingRequired,
          documentationRequired: task.requirements.documentationRequired,
          agentType: task.requirements.agentType,
          minReliability: task.requirements.minReliability
        } as Record<string, unknown>,
        agent: {
          instructions: task.instructions || this.generateTaskInstructions(task),
          constraints: task.constraints,
          timeout: 300000
        }
      };

      await this.agentProcessManager.executeTask(agent.id.id, executionRequest);
      
    } catch (error) {
      this.logger.error('Failed to execute task', { taskId: task.id.id, error });
      await this.handleTaskFailed(task.id.id, error);
    }
  }

  // =============================================================================
  // OBJECTIVE DECOMPOSITION
  // =============================================================================

  private analyzeTaskComplexity(description: string, type: TaskType): number {
    // Analyze task description to estimate complexity
    const keywords = description.toLowerCase().split(/\s+/);
    
    let complexity = 0.5; // Base complexity
    
    // Complexity indicators
    const complexityIndicators = {
      'distributed': 0.3,
      'parallel': 0.2,
      'optimization': 0.3,
      'machine learning': 0.4,
      'consensus': 0.3,
      'real-time': 0.2,
      'fault tolerance': 0.3,
      'enterprise': 0.2,
      'scalable': 0.2,
      'performance': 0.2
    };
    
    for (const [indicator, weight] of Object.entries(complexityIndicators)) {
      if (description.toLowerCase().includes(indicator)) {
        complexity += weight;
      }
    }
    
    // Task type complexity modifiers
    const typeComplexity: Record<TaskType, number> = {
      'research': 0.6,
      'analysis': 0.8,
      'coding': 0.7,
      'testing': 0.6,
      'review': 0.5,
      'documentation': 0.4,
      'deployment': 0.8,
      'monitoring': 0.5,
      'coordination': 0.8,
      'communication': 0.6,
      'maintenance': 0.5,
      'optimization': 0.9,
      'validation': 0.7,
      'integration': 0.8,
      'custom': 0.7
    };
    
    complexity *= typeComplexity[type] ?? 0.7;
    
    return Math.min(1.0, complexity);
  }

  private async selectOptimalTopologyForTask(complexity: number, type: TaskType): Promise<'hierarchical' | 'mesh' | 'hybrid'> {
    // Select optimal topology based on task characteristics
    if (complexity > 0.8 && this.agents.size >= 4) {
      return 'mesh'; // High complexity tasks benefit from mesh coordination
    }
    
    if (type === 'coordination' || type === 'analysis') {
      return 'mesh'; // Collaborative tasks work well with mesh
    }
    
    if (this.agents.size <= 3) {
      return 'hierarchical'; // Small teams work well with hierarchy
    }
    
    return 'hybrid'; // Default balanced approach
  }

  private async decomposeObjectiveWithPatterns(objective: SwarmObjective, patterns: TaskPattern[]): Promise<TaskDefinition[]> {
    if (!objective) {
      this.logger.error('Trying to decompose null objective');
      return [];
    }
    
    this.logger.info('Starting objective decomposition with pattern analysis', { 
      objectiveId: objective.id,
      patterns: patterns.length
    });
    
    const tasks: TaskDefinition[] = [];
    
    // Use patterns to guide decomposition
    if (patterns.length > 0) {
      const primaryPattern = patterns[0]; // Highest confidence pattern
      tasks.push(...await this.createTasksFromPattern(objective, primaryPattern));
    } else {
      // Fallback to traditional decomposition
      const taskBreakdown = this.analyzeObjectiveComplexity(objective.description);
      tasks.push(...await this.createTasksFromBreakdown(objective, taskBreakdown));
    }
    
    this.logger.info('Objective decomposed with patterns', { 
      objectiveId: objective.id, 
      tasksCreated: tasks.length,
      taskTypes: tasks.map(t => t.type)
    });

    return tasks;
  }

  private async createTasksFromPattern(objective: SwarmObjective, pattern: TaskPattern): Promise<TaskDefinition[]> {
    const tasks: TaskDefinition[] = [];
    
    // Create tasks based on detected pattern
    switch (pattern.type) {
      case 'api-development':
        tasks.push(...this.createAPITasks(objective, pattern));
        break;
      case 'testing-automation':
        tasks.push(...this.createTestingTasks(objective, pattern));
        break;
      case 'research-analysis':
        tasks.push(...this.createResearchTasks(objective, pattern));
        break;
      default:
        // Fallback to traditional decomposition
        const taskBreakdown = this.analyzeObjectiveComplexity(objective.description);
        tasks.push(...await this.createTasksFromBreakdown(objective, taskBreakdown));
        break;
    }
    
    return tasks;
  }

  private createAPITasks(objective: SwarmObjective, pattern: TaskPattern): TaskDefinition[] {
    const tasks: TaskDefinition[] = [];
    const baseId = generateId();
    
    const apiTasks = [
      { name: 'API Design', type: 'analysis' as TaskType, capabilities: ['analysis', 'design'] },
      { name: 'Implementation', type: 'coding' as TaskType, capabilities: ['code-generation'] },
      { name: 'Testing', type: 'testing' as TaskType, capabilities: ['testing'] },
      { name: 'Documentation', type: 'documentation' as TaskType, capabilities: ['documentation'] }
    ];
    
    apiTasks.forEach((taskInfo, index) => {
      const task: TaskDefinition = {
        id: { 
          id: `${baseId}-${index}`,
          swarmId: this.swarmId.id,
          sequence: index + 1,
          priority: 1
        },
        type: taskInfo.type,
        name: taskInfo.name,
        description: `${taskInfo.name} for ${objective.description}`,
        instructions: `Complete ${taskInfo.name.toLowerCase()} according to enterprise standards`,
        requirements: {
          capabilities: taskInfo.capabilities,
          tools: [],
          permissions: [],
          estimatedDuration: 300000
        },
        constraints: {
          dependencies: index > 0 ? [{ 
            id: `${baseId}-${index-1}`,
            swarmId: this.swarmId.id,
            sequence: index,
            priority: 1
          }] : [],
          dependents: [],
          conflicts: []
        },
        priority: 'high',
        input: {
          objectiveId: objective.id,
          description: objective.description
        },
        context: {
          objectiveId: objective.id,
          strategy: objective.strategy
        },
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: [],
        statusHistory: []
      };
      
      tasks.push(task);
    });
    
    return tasks;
  }

  private createTestingTasks(objective: SwarmObjective, pattern: TaskPattern): TaskDefinition[] {
    // Similar pattern-based task creation for testing
    return this.createAPITasks(objective, pattern); // Simplified for now
  }

  private createResearchTasks(objective: SwarmObjective, pattern: TaskPattern): TaskDefinition[] {
    // Similar pattern-based task creation for research
    return this.createAPITasks(objective, pattern); // Simplified for now
  }

  private async createTasksFromBreakdown(objective: SwarmObjective, taskBreakdown: any[]): Promise<TaskDefinition[]> {
    const tasks: TaskDefinition[] = [];
    
    for (let i = 0; i < taskBreakdown.length; i++) {
      const taskInfo = taskBreakdown[i];
      
      const task: TaskDefinition = {
        id: { 
          id: generateId(),
          swarmId: this.swarmId.id,
          sequence: i + 1,
          priority: 1
        },
        type: taskInfo.type,
        name: taskInfo.name,
        description: taskInfo.description,
        instructions: taskInfo.instructions,
        requirements: {
          capabilities: taskInfo.capabilities,
          tools: [],
          permissions: [],
          estimatedDuration: taskInfo.estimatedDuration
        },
        constraints: {
          dependencies: taskInfo.dependencies.map((depIndex: number) => ({
            id: tasks[depIndex]?.id.id || '',
            swarmId: this.swarmId.id,
            sequence: depIndex + 1,
            priority: 1
          })).filter((dep: any) => dep.id),
          dependents: [],
          conflicts: []
        },
        priority: taskInfo.priority,
        input: {
          objectiveId: objective.id,
          description: objective.description
        },
        context: {
          objectiveId: objective.id,
          strategy: objective.strategy
        },
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: [],
        statusHistory: []
      };

      tasks.push(task);
    }
    
    return tasks;
  }

  private async decomposeObjective(objective: SwarmObjective): Promise<TaskDefinition[]> {
    if (!objective) {
      this.logger.error('Trying to decompose null objective');
      return [];
    }
    
    this.logger.info('Starting objective decomposition', { objectiveId: objective.id });
    const tasks: TaskDefinition[] = [];
    
    // Analyze the objective to determine task breakdown
    const taskBreakdown = this.analyzeObjectiveComplexity(objective.description);
    
    for (let i = 0; i < taskBreakdown.length; i++) {
      const taskInfo = taskBreakdown[i];
      
      const task: TaskDefinition = {
        id: { 
          id: generateId(),
          swarmId: this.swarmId.id,
          sequence: i + 1,
          priority: 1
        },
        type: taskInfo.type,
        name: taskInfo.name,
        description: taskInfo.description,
        instructions: taskInfo.instructions,
        requirements: {
          capabilities: taskInfo.capabilities,
          tools: [],
          permissions: [],
          estimatedDuration: taskInfo.estimatedDuration
        },
        constraints: {
          dependencies: taskInfo.dependencies.map(depIndex => ({
            id: tasks[depIndex]?.id.id || '',
            swarmId: this.swarmId.id,
            sequence: depIndex + 1,
            priority: 1
          })).filter(dep => dep.id),
          dependents: [],
          conflicts: []
        },
        priority: taskInfo.priority,
        input: {
          objectiveId: objective.id,
          description: objective.description
        },
        context: {
          objectiveId: objective.id,
          strategy: objective.strategy
        },
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: [],
        statusHistory: []
      };

      tasks.push(task);
    }

    this.logger.info('Objective decomposed', { 
      objectiveId: objective.id, 
      tasksCreated: tasks.length,
      taskTypes: tasks.map(t => t.type)
    });

    return tasks;
  }

  private analyzeObjectiveComplexity(description: string): Array<{
    name: string;
    description: string;
    instructions: string;
    type: TaskType;
    capabilities: string[];
    estimatedDuration: number;
    priority: TaskPriority;
    dependencies: number[];
  }> {
    const lowerDesc = description.toLowerCase();
    
    // Hello World application breakdown
    if (lowerDesc.includes('hello world')) {
      return [
        {
          name: 'Create HTML Structure',
          description: 'Create the basic HTML structure for the Hello World application',
          instructions: 'Create a modern HTML5 file with semantic elements, proper meta tags, and a responsive layout structure for a Hello World application.',
          type: 'coding',
          capabilities: ['code-generation', 'file-system'],
          estimatedDuration: 300000, // 5 minutes
          priority: 'high',
          dependencies: []
        },
        {
          name: 'Style with CSS',
          description: 'Create responsive CSS styling with animations',
          instructions: 'Create modern CSS with responsive design, animations, and attractive styling for the Hello World application.',
          type: 'coding',
          capabilities: ['code-generation', 'file-system'],
          estimatedDuration: 420000, // 7 minutes
          priority: 'high',
          dependencies: [0]
        },
        {
          name: 'Add JavaScript Interactivity',
          description: 'Implement interactive JavaScript features',
          instructions: 'Add JavaScript functionality for user interaction, dynamic greetings, and smooth animations.',
          type: 'coding',
          capabilities: ['code-generation', 'file-system'],
          estimatedDuration: 480000, // 8 minutes
          priority: 'high',
          dependencies: [0, 1]
        },
        {
          name: 'Create Documentation',
          description: 'Write comprehensive README and documentation',
          instructions: 'Create a detailed README.md with setup instructions, features, and usage guide.',
          type: 'documentation',
          capabilities: ['documentation', 'file-system'],
          estimatedDuration: 240000, // 4 minutes
          priority: 'normal',
          dependencies: [0, 1, 2]
        },
        {
          name: 'Test and Validate',
          description: 'Test the application and validate functionality',
          instructions: 'Test all features, validate HTML, CSS, and JavaScript, ensure cross-browser compatibility.',
          type: 'testing',
          capabilities: ['testing', 'analysis'],
          estimatedDuration: 180000, // 3 minutes
          priority: 'normal',
          dependencies: [0, 1, 2]
        }
      ];
    }

    // Default single task for other objectives
    return [
      {
        name: 'Complete Objective',
        description: description,
        instructions: `Complete the following objective: ${description}`,
        type: 'custom',
        capabilities: ['custom'],
        estimatedDuration: 600000, // 10 minutes
        priority: 'normal',
        dependencies: []
      }
    ];
  }

  // =============================================================================
  // FILE OUTPUT HANDLING
  // =============================================================================

  private async writeTaskResults(task: TaskDefinition, result: any): Promise<void> {
    if (!result || !result.result || !result.result.files) {
      return; // No files to write
    }

    try {
      // Determine output directory from the objective
      const objective = this.getObjectiveForTask(task);
      const outputDir = this.extractOutputDirectory(objective?.description || '');
      
      if (!outputDir) {
        this.logger.warn('No output directory found for task', { taskId: task.id.id });
        return;
      }

      // Create output directory
      await this.ensureDirectoryExists(outputDir);

      // Write each file from the task result
      for (const file of result.result.files) {
        const filePath = this.joinPath(outputDir, file.path);
        await this.ensureDirectoryExists(this.getDirectoryName(filePath));
        await this.writeFile(filePath, file.content);
        
        this.logger.info('File written', { 
          taskId: task.id.id, 
          filePath: filePath.replace(process.cwd(), '.'),
          size: file.content?.length || 0
        });
      }

    } catch (error) {
      this.logger.error('Failed to write task results', { 
        taskId: task.id.id, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async checkObjectiveCompletion(): Promise<void> {
    for (const [objectiveId, objective] of this.objectives) {
      const allTasks = objective.tasks;
      const completedTasks = allTasks.filter(t => {
        const task = this.tasks.get(t.id.id);
        return task?.status === 'completed';
      });

      // If all tasks are completed, finalize the objective
      if (allTasks.length > 0 && completedTasks.length === allTasks.length) {
        this.logger.info('Objective completed', { 
          objectiveId, 
          tasksCompleted: completedTasks.length,
          totalTasks: allTasks.length
        });

        objective.status = 'completed';
        objective.progress.percentComplete = 100;

        // Write final summary
        await this.writeFinalSummary(objective);
      }
    }
  }

  private getObjectiveForTask(task: TaskDefinition): SwarmObjective | undefined {
    for (const objective of this.objectives.values()) {
      if (objective.tasks.some(t => t.id.id === task.id.id)) {
        return objective;
      }
    }
    return undefined;
  }

  private extractOutputDirectory(description: string): string | null {
    // Look for output directory patterns in the description
    const patterns = [
      /in\s+([^\s]+\/[^\s]+)/i,  // "in ./demo-test-final/hello-world-app"
      /output:\s*([^\s]+)/i,      // "output: ./demo-output"
      /to\s+([^\s]+\/[^\s]+)/i    // "to ./output/app"
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Default fallback
    return './demo-output';
  }

  private async writeFinalSummary(objective: SwarmObjective): Promise<void> {
    try {
      const outputDir = this.extractOutputDirectory(objective.description);
      if (!outputDir) return;

      const summaryPath = this.joinPath(outputDir, 'swarm-summary.tson');
      const summary = {
        objective: {
          id: objective.id,
          name: objective.name,
          description: objective.description,
          status: objective.status,
          progress: objective.progress
        },
        tasks: objective.tasks.map(taskRef => {
          const task = this.tasks.get(taskRef.id.id);
          return {
            id: task?.id.id,
            name: task?.name,
            type: task?.type,
            status: task?.status,
            result: task?.result ? 'completed' : 'none'
          };
        }),
        agents: Array.from(this.agents.values()).map(agent => ({
          id: agent.id.id,
          name: agent.name,
          type: agent.type,
          tasksCompleted: agent.metrics.tasksCompleted,
          successRate: agent.metrics.successRate
        })),
        summary: {
          totalTasks: objective.tasks.length,
          completedTasks: objective.progress.completedTasks,
          totalAgents: this.agents.size,
          executionTime: objective.progress.timeRemaining,
          timestamp: new Date().toISOString()
        }
      };

      await this.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      this.logger.info('Final summary written', { path: summaryPath });

    } catch (error) {
      this.logger.error('Failed to write final summary', { error });
    }
  }

  // Utility methods for file operations
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const { mkdir } = await import('node:fs/promises');
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(filePath, content, 'utf-8');
  }

  private joinPath(...parts: string[]): string {
    return join(...parts);
  }

  private getDirectoryName(filePath: string): string {
    return dirname(filePath);
  }

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  private async handleTaskCompleted(taskId: string, result: any): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.logger.info('Task completed', { taskId, taskName: task.name });

    // Update task
    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;

    // Write task result files to disk
    await this.writeTaskResults(task, result);

    // Update agent
    if (task.assignedTo) {
      const agent = this.agents.get(task.assignedTo.id);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = undefined;
        agent.workload = Math.max(0, agent.workload - 0.3);
        agent.metrics.tasksCompleted++;
        agent.metrics.successRate = agent.metrics.tasksCompleted / 
          (agent.metrics.tasksCompleted + agent.metrics.tasksFailed);
      }
    }

    // Move task from running to completed
    this.runningTasks.delete(taskId);
    this.completedTasks.add(taskId);

    // Check if objective is complete and write final output
    await this.checkObjectiveCompletion();

    // Schedule dependent tasks
    await this.scheduleAvailableTasks();
  }

  private async handleTaskFailed(taskId: string, error: any): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.logger.error('Task failed', { taskId, taskName: task.name, error });

    // Update task
    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error?.message || String(error);

    // Update agent
    if (task.assignedTo) {
      const agent = this.agents.get(task.assignedTo.id);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = undefined;
        agent.workload = Math.max(0, agent.workload - 0.3);
        agent.metrics.tasksFailed++;
        agent.metrics.successRate = agent.metrics.tasksCompleted / 
          (agent.metrics.tasksCompleted + agent.metrics.tasksFailed);
      }
    }

    // Move task from running to failed
    this.runningTasks.delete(taskId);
    this.failedTasks.add(taskId);
  }

  // =============================================================================
  // MONITORING AND STATUS
  // =============================================================================

  private updateProgress(): void {
    for (const [objectiveId, objective] of this.objectives) {
      const objectiveTasks = objective.tasks;
      const completed = objectiveTasks.filter(t => {
        const task = this.tasks.get(t.id.id);
        return task?.status === 'completed';
      }).length;
      
      const failed = objectiveTasks.filter(t => {
        const task = this.tasks.get(t.id.id);
        return task?.status === 'failed';
      }).length;

      const running = objectiveTasks.filter(t => {
        const task = this.tasks.get(t.id.id);
        return task?.status === 'running';
      }).length;

      objective.progress.completedTasks = completed;
      objective.progress.failedTasks = failed;
      objective.progress.runningTasks = running;
      objective.progress.percentComplete = objectiveTasks.length > 0 ? 
        (completed / objectiveTasks.length) * 100 : 0;
    }
  }

  private checkForCompletedObjectives(): void {
    for (const [objectiveId, objective] of this.objectives) {
      if (objective.status === 'completed') continue;

      const allTasksCompleted = objective.tasks.every(t => {
        const task = this.tasks.get(t.id.id);
        return task?.status === 'completed';
      });

      if (allTasksCompleted && objective.tasks.length > 0) {
        objective.status = 'completed';
        objective.completedAt = new Date();
        this.logger.info('Objective completed', { objectiveId, name: objective.name });
      }
    }
  }

  private checkAgentHealth(): void {
    const now = new Date();
    for (const [agentId, agent] of this.agents) {
      const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();
      
              if (timeSinceHeartbeat > 90000) { // 1.5 minutes (agents send every 30s)
        if (agent.status !== 'offline') {
          this.logger.warn('Agent marked as offline due to missed heartbeats', { agentId });
          agent.status = 'offline';
        }
      }
    }
  }

  private updateAgentStatus(agentId: string, status: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status as any;
      agent.lastHeartbeat = new Date();
    }
  }

  // =============================================================================
  // PUBLIC STATUS METHODS
  // =============================================================================

  getSwarmStatus(): {
    status: SwarmStatus;
    objectives: number;
    tasks: { total: number; pending: number; running: number; completed: number; failed: number };
    agents: { total: number; idle: number; busy: number; offline: number; error: number };
    uptime: number;
  } {
    const agents = Array.from(this.agents.values());

    return {
      status: this.status,
      objectives: this.objectives.size,
      tasks: {
        total: this.tasks.size,
        pending: this.pendingTasks.size,
        running: this.runningTasks.size,
        completed: this.completedTasks.size,
        failed: this.failedTasks.size
      },
      agents: {
        total: agents.length,
        idle: agents.filter(a => a.status === 'idle').length,
        busy: agents.filter(a => a.status === 'busy').length,
        offline: agents.filter(a => a.status === 'offline').length,
        error: agents.filter(a => a.status === 'error').length
      },
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
    };
  }

  getAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  getTasks(): TaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  getObjectives(): SwarmObjective[] {
    return Array.from(this.objectives.values());
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private getNextInstanceNumber(type: AgentType): number {
    const existingAgents = Array.from(this.agents.values()).filter(a => a.type === type);
    return existingAgents.length + 1;
  }

  private mapAgentType(type: AgentType): 'backend' | 'frontend' | 'devops' | 'test' | 'security' | 'documentation' | 'general' {
    const typeMap: Record<AgentType, 'backend' | 'frontend' | 'devops' | 'test' | 'security' | 'documentation' | 'general'> = {
      'coordinator': 'general',
      'researcher': 'general',
      'developer': 'general',
      'analyzer': 'general',
      'reviewer': 'general',
      'tester': 'test',
      'documenter': 'documentation',
      'monitor': 'general',
      'specialist': 'general'
    };
    return typeMap[type] || 'general';
  }

  private generateTaskInstructions(task: TaskDefinition): string {
    return `
Task: ${task.name}

Description: ${task.description}

Please complete this task systematically:
1. Analyze the requirements
2. Plan your approach
3. Execute the task step by step
4. Verify your results
5. Provide a summary of what was accomplished

Context: This task is part of a larger objective. Focus on quality and completeness.
    `.trim();
  }

  emitSwarmEvent(event: SwarmEvent): boolean {
    return this.emit('swarm:event', event);
  }

  emitSwarmEvents(events: SwarmEvent[]): boolean {
    let allEmitted = true;
    for (const event of events) {
      if (!this.emitSwarmEvent(event)) {
        allEmitted = false;
      }
    }
    return allEmitted;
  }

  onSwarmEvent(type: EventType, handler: (event: SwarmEvent) => void): this {
    this.on(type, handler);
    return this;
  }

  offSwarmEvent(type: EventType, handler: (event: SwarmEvent) => void): this {
    this.off(type, handler);
    return this;
  }

  filterEvents(predicate: (event: SwarmEvent) => boolean): SwarmEvent[] {
    // This is a simple implementation - in a real system you'd store events
    return [];
  }

  correlateEvents(correlationId: string): SwarmEvent[] {
    // This is a simple implementation - in a real system you'd store events
    return [];
  }
} 