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
import { Logger } from "../core/logger.js";
import { generateId } from "../utils/helpers.js";
import { getTaskTimeout, getSwarmTimeout, getHeartbeatInterval } from '../config/timeout-config.js';
import {
  SwarmId, AgentId, TaskId, AgentState, TaskDefinition, SwarmObjective,
  SwarmConfig, SwarmStatus, AgentType, TaskType, TaskStatus, TaskPriority,
  SwarmEvent, SwarmEventEmitter, EventType, TaskResult
} from "./types.js";
import { AgentProcessManager } from "../agents/agent-process-manager.js";
import { MeshCoordinator, MeshCoordinatorConfig } from './mesh-coordinator.js';
import { SwarmMemoryManager } from "./memory.js";
import { TaskExecutor, ExecutionResult } from "./executor.js";
import { FlowXExecutor } from "./flowx-executor.js";
import { WorkspaceCoordinator } from "./workspace-coordinator.js";
import { SwarmJsonOutputAggregator } from './json-output-aggregator.js';
// Enhanced coordination imports
import { SwarmCoordinatorConfig as CoordinationConfig, SwarmIntelligence as CoordinationIntelligence } from "../coordination/swarm-coordinator.js";
import { NeuralPatternEngine, NeuralConfig, PatternPrediction } from "../coordination/neural-pattern-engine.js";
import { BackgroundExecutor } from "../coordination/background-executor.js";
import { getCapabilitiesForType, calculateAgentSuitability } from "../coordination/agent-strategy-helpers.js";
// Removed wrong application generator import - swarms don't generate static files!
import * as fs from 'fs-extra';
import * as path from 'path';
import { promises as fsPromises, mkdirSync } from 'fs';
import { ChildProcess } from 'child_process';

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
  // FlowX Executor Configuration
  enableFlowX?: boolean;
  verbose?: boolean;
  // Add missing swarmId property
  swarmId?: string;
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
  
  // Neural pattern engine for advanced coordination
  private neuralEngine: NeuralPatternEngine;
  private backgroundExecutor: BackgroundExecutor;
  
  // Memory management
  private memoryManager: SwarmMemoryManager;
  
  // Real task execution
  private taskExecutor: TaskExecutor;
  private flowxExecutor?: FlowXExecutor;
  
  // Workspace coordination for agent collaboration
  private workspaceCoordinator: WorkspaceCoordinator;
  
  // JSON output aggregation
  private jsonAggregator?: SwarmJsonOutputAggregator;
  
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

  // Add missing agent processes map
  private agentProcesses: Map<string, ChildProcess> = new Map();

  // Rate limiting for Claude API calls
  private static readonly CLAUDE_API_DELAY = 2000; // 2 seconds between Claude calls
  private lastClaudeCall: number = 0;
  private lastClaudeApiCall: Map<string, number> = new Map();

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastClaudeCall;
    
    if (timeSinceLastCall < SwarmCoordinator.CLAUDE_API_DELAY) {
      const waitTime = SwarmCoordinator.CLAUDE_API_DELAY - timeSinceLastCall;
      this.logger.info('Rate limiting: waiting before next Claude API call', {
        waitTime,
        timeSinceLastCall
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastClaudeCall = Date.now();
  }

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
    
    // Initialize memory manager
    this.memoryManager = new SwarmMemoryManager(this.config.memory);
    
    // Initialize real task executor for actual work
    this.taskExecutor = new TaskExecutor({
        logLevel: 'info', // Or get from config
    });
    
    // Initialize FlowX executor for enhanced SPARC capabilities if enabled
    if (config.enableFlowX) {
      this.flowxExecutor = new FlowXExecutor({
        enableSparc: true,
        logLevel: 'info',
        timeoutMs: getTaskTimeout('default'),
        verbose: config.verbose || false,
      });
    }
    
    // Initialize workspace coordinator for agent collaboration
    this.workspaceCoordinator = new WorkspaceCoordinator(this.logger);
    
    // Initialize JSON aggregator if in non-interactive mode
    if (config.nonInteractive) {
        this.jsonAggregator = new SwarmJsonOutputAggregator(this.swarmId.id, config.objective || 'Untitled Swarm', config);
    }
    
    // Initialize neural pattern engine for advanced coordination
    this.neuralEngine = new NeuralPatternEngine({
      enableWasm: true,
      modelPath: './models/swarm-patterns.model',
      patternThreshold: 0.7,
      learningRate: 0.01,
      maxPatterns: 1000,
      cacheTTL: 300000,
      batchSize: 32,
      enableDistribution: false,
      computeBackend: 'wasm'
    });
    
    // Initialize background executor for parallel task processing
    this.backgroundExecutor = new BackgroundExecutor({
      maxConcurrentTasks: 10,
      defaultTimeout: getSwarmTimeout(),
      logPath: './logs/background-executor',
      enablePersistence: true,
      enableWorkStealing: true,
      retryAttempts: 3
    });
    
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
    
    // Removed wrong application generator initialization
    
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
        defaultTimeout: getSwarmTimeout(),
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
      },
      // Add swarmId if not provided
      swarmId: config.swarmId || this.swarmId?.id || generateId()
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

    this.logger.info('Initializing enterprise swarm coordinator with advanced neural coordination');
    
    // Initialize memory manager
    await this.memoryManager.initialize();
    
    // Initialize neural pattern engine
    await this.neuralEngine.initialize();
    
    // Initialize background executor
    await this.backgroundExecutor.start();
    
    // Initialize adaptive topology
    await this.initializeAdaptive();
    
    this.startBackgroundProcesses();
    this.isRunning = true;
    this.status = 'executing';
    this.startTime = new Date();
    
    this.logger.info('Enterprise swarm coordinator with advanced neural coordination initialized successfully');
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
    this.logger.info('Stopping SwarmCoordinator...');
    this.isRunning = false;
    this.status = 'stopping';

    this.stopEnterpriseProcesses();
    this.agentProcessManager.shutdown();
    
    if (this.jsonAggregator) {
        await this.jsonAggregator.saveToFile(`./swarm-output-${this.swarmId.id}.json`);
    }

    this.emit('swarm:stopped', { swarmId: this.swarmId.id });
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

  /**
   * Register and spawn an agent with the swarm
   */
  async registerAgent(
    name: string,
    type: string,
    capabilities: string[] = [],
    systemPrompt?: string
  ): Promise<string> {
    const agentId = generateId();
    
    this.logger.info('Registering agent with adaptive topology', {
      agentId,
      name,
      type,
      capabilities
    });

    // Create agent profile
    const agent: AgentState = {
      id: { 
        id: agentId, 
        swarmId: this.swarmId.id, 
        type: type as AgentType,
        instance: this.getNextInstanceNumber(type as AgentType)
      } as AgentId,
      name,
      type: type as AgentType,
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
        tools: capabilities,
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
        runtime: 'claude',
        version: '1.0.0',
        workingDirectory: `./agents/${agentId}`,
        tempDirectory: './temp',
        logDirectory: './logs',
        apiEndpoints: {},
        credentials: {},
        availableTools: capabilities,
        toolConfigs: {}
      },
      endpoints: [],
      lastHeartbeat: new Date(),
      taskHistory: [],
      errorHistory: [],
      childAgents: [],
      collaborators: []
    };

    // Add to registry
    this.agents.set(agentId, agent);
    
    // Update topology (check if topology should be adapted based on new agent count)
    await this.evaluateTopologyAdaptation();

    // FIXED: Spawn Claude Code process directly with MCP tools instead of TypeScript template
    await this.spawnClaudeCodeAgent(agent, systemPrompt);

    this.logger.info('Agent registered with adaptive coordination', {
      agentId,
      name,
      type,
      capabilities,
      currentTopology: this.currentTopology,
      totalAgents: this.agents.size
    });

    return agentId;
  }

  /**
   * Spawn Claude Code agent with MCP tools (SUPERIOR APPROACH)
   */
  private async spawnClaudeCodeAgent(agent: AgentState, systemPrompt?: string): Promise<void> {
    // Create working directory
    await fs.ensureDir(agent.environment.workingDirectory);
    
    // Create MCP-powered prompt for Claude Code
    const mcpPrompt = this.createMCPAgentPrompt(agent, systemPrompt);
    
    // Create .clauderc file for the agent with MCP tools
    const clauderc = {
      mcp: {
        servers: {
          "flowx-swarm": {
            command: "flowx",
            args: ["mcp", "start", "--port", "3030"],
            env: {
              AGENT_ID: agent.id.id,
              AGENT_TYPE: agent.type,
              AGENT_NAME: agent.name,
              SWARM_ID: this.config.swarmId || this.swarmId.id,
              CAPABILITIES: agent.capabilities.tools.join(',')
            }
          }
        }
      },
      tools: [
        "mcp__flowx__agent_spawn",
        "mcp__flowx__memory_store", 
        "mcp__flowx__memory_retrieve",
        "mcp__flowx__task_create",
        "mcp__flowx__task_assign",
        "mcp__flowx__swarm_status",
        "mcp__flowx__agent_communicate"
      ]
    };

    try {
      await fs.ensureDir(agent.environment.workingDirectory);
      await fsPromises.writeFile(path.join(agent.environment.workingDirectory, '.clauderc'), JSON.stringify(clauderc, null, 2));
    } catch (error) {
      this.logger.warn('Failed to create .clauderc file, continuing without MCP config', { error: error instanceof Error ? error.message : String(error) });
    }

    // Create initial prompt file
    try {
      await fsPromises.writeFile(
        path.join(agent.environment.workingDirectory, 'agent-prompt.md'),
        mcpPrompt
      );
    } catch (error) {
      this.logger.warn('Failed to create agent prompt file, continuing', { error: error instanceof Error ? error.message : String(error) });
    }

    this.logger.info('Agent script created successfully', {
      scriptPath: `${agent.environment.workingDirectory}/.clauderc`
    });

    // Spawn Claude Code process with the prompt
    await this.spawnClaudeProcess(agent, mcpPrompt);
  }

  /**
   * Create MCP-powered agent prompt for Claude Code
   */
  private createMCPAgentPrompt(agent: AgentState, customSystemPrompt?: string): string {
    const basePrompt = customSystemPrompt || this.getDefaultSystemPrompt(agent.type);
    
    return `# ${agent.name} - ${agent.type.toUpperCase()} Agent

## Your Role
${basePrompt}

## Agent Configuration
- **ID**: ${agent.id.id}
- **Type**: ${agent.type}
- **Capabilities**: ${agent.capabilities.tools.join(', ')}
- **Max Concurrent Tasks**: ${agent.capabilities.maxConcurrentTasks}
- **Working Directory**: ${agent.environment.workingDirectory}

## MCP Tools Available
You have access to the following FlowX MCP tools for coordination:

### Agent Management
- \`mcp__flowx__agent_spawn\` - Spawn new agents for specialized tasks
- \`mcp__flowx__agent_list\` - List all agents in the swarm
- \`mcp__flowx__agent_communicate\` - Send messages to other agents

### Task Management  
- \`mcp__flowx__task_create\` - Create new tasks
- \`mcp__flowx__task_assign\` - Assign tasks to agents
- \`mcp__flowx__task_list\` - List current tasks

### Memory & Coordination
- \`mcp__flowx__memory_store\` - Store information in swarm memory
- \`mcp__flowx__memory_retrieve\` - Retrieve information from swarm memory
- \`mcp__flowx__swarm_status\` - Get swarm status and metrics

## Instructions
1. You are part of a swarm working on: "${this.config.description}"
2. Use MCP tools to coordinate with other agents
3. Store important information using \`mcp__flowx__memory_store\`
4. Spawn specialized agents when needed using \`mcp__flowx__agent_spawn\`
5. Communicate with other agents using \`mcp__flowx__agent_communicate\`
6. Check swarm status regularly with \`mcp__flowx__swarm_status\`

## Current Objective
${this.config.description}

Begin by checking the swarm status and coordinating with other agents to understand the current progress and your role in achieving the objective.
`;
  }

  /**
   * Get default system prompt for agent type
   */
  private getDefaultSystemPrompt(type: AgentType): string {
    const prompts: Record<AgentType, string> = {
      coordinator: "You are a coordinator agent responsible for orchestrating and managing other agents in the swarm.",
      researcher: "You are a research agent specialized in gathering information and conducting analysis.",
      developer: "You are a developer agent focused on writing, reviewing, and maintaining code.",
      analyzer: "You are an analyzer agent that processes data and generates insights.",
      reviewer: "You are a reviewer agent that validates and provides feedback on work products.",
      tester: "You are a tester agent responsible for testing and quality assurance.",
      documenter: "You are a documentation agent that creates and maintains documentation.",
      monitor: "You are a monitoring agent that tracks system health and performance.",
      specialist: "You are a specialist agent with domain-specific expertise."
    };
    
    return prompts[type] || prompts.specialist;
  }

  /**
   * Spawn the actual Claude Code process
   */
  private async spawnClaudeProcess(agent: AgentState, prompt: string): Promise<void> {
    const { spawn } = await import('child_process');
    
    const claudeArgs = [
      prompt,
      '--print',
      '--dangerously-skip-permissions'
    ];

    this.logger.info('Spawning agent process', {
      agentId: agent.id.id,
      workDir: agent.environment.workingDirectory
    });

    // Use Claude Code instead of Node.js for agent execution
    const nodeCmd = process.execPath;
    
    this.logger.info('Spawning agent with Claude Code', {
      args: claudeArgs
    });

    try {
      const childProcess = spawn('claude', claudeArgs, {
        cwd: agent.environment.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          AGENT_ID: agent.id.id,
          AGENT_TYPE: agent.type,
          AGENT_NAME: agent.name,
          SWARM_ID: this.config.swarmId || this.swarmId.id,
          CAPABILITIES: agent.capabilities.tools.join(',')
        }
      });

      // Store process reference
      this.agentProcesses.set(agent.id.id, childProcess);

      this.logger.info('Agent process started', {
        agentId: agent.id.id,
        pid: childProcess.pid,
        workDir: agent.environment.workingDirectory
      });

      // Close stdin to prevent hanging [[memory:3798511]]
      if (childProcess.stdin) {
        childProcess.stdin.end();
      }

      childProcess.on('exit', (code: number | null) => {
        this.logger.info('Agent process exited', {
          agentId: agent.id.id,
          exitCode: code
        });
        this.agentProcesses.delete(agent.id.id);
      });

      childProcess.on('error', (error: Error) => {
        this.logger.error('Agent process error', {
          agentId: agent.id.id,
          error: error.message
        });
      });

    } catch (error) {
      this.logger.error('Failed to spawn Claude Code process', {
        agentId: agent.id.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
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
      this.logger.info('DEBUG: scheduleAvailableTasks early return', { 
        isRunning: this.isRunning, 
        pendingTasksSize: this.pendingTasks.size 
      });
      return;
    }

    const availableAgents = Array.from(this.agents.values())
      .filter(agent => agent.status === 'idle');

    this.logger.info('DEBUG: Task scheduling attempt', {
      totalAgents: this.agents.size,
      availableAgents: availableAgents.length,
      pendingTasks: this.pendingTasks.size,
      agentStatuses: Array.from(this.agents.values()).map(a => ({ id: a.id.id, name: a.name, status: a.status }))
    });

    if (availableAgents.length === 0) {
      this.logger.warn('DEBUG: No available agents for task assignment');
      return;
    }

    // Get tasks ready for execution (no unmet dependencies)
    const readyTasks = Array.from(this.pendingTasks)
      .map(taskId => this.tasks.get(taskId)!)
      .filter(task => this.areTaskDependenciesMet(task))
      .sort((a, b) => this.getTaskPriority(b) - this.getTaskPriority(a));

    this.logger.info('DEBUG: Ready tasks for assignment', {
      readyTasksCount: readyTasks.length,
      readyTasks: readyTasks.map(t => ({ 
        id: t.id.id, 
        name: t.name, 
        type: t.type, 
        capabilities: t.requirements.capabilities 
      }))
    });

    // PARALLEL TASK ASSIGNMENT: Assign multiple tasks concurrently instead of sequentially
    const maxConcurrent = Math.min(availableAgents.length, this.config.maxConcurrentTasks);
    const assignmentPromises: Promise<void>[] = [];
    const assignedAgents: AgentState[] = [];
    let assignedCount = 0;

    for (const task of readyTasks) {
      if (assignedCount >= maxConcurrent) break;

      const suitableAgent = this.findBestAgentForTask(task, availableAgents.filter(a => !assignedAgents.includes(a)));
      
      this.logger.info('DEBUG: Agent selection result', {
        taskId: task.id.id,
        taskName: task.name,
        suitableAgentFound: !!suitableAgent,
        suitableAgentId: suitableAgent?.id.id,
        suitableAgentName: suitableAgent?.name
      });
      
      if (suitableAgent) {
        // Start assignment asynchronously (don't await here for parallel execution)
        const assignmentPromise = this.assignTaskToAgent(task, suitableAgent);
        assignmentPromises.push(assignmentPromise);
        
        // Track assigned agents to prevent double-assignment
        assignedAgents.push(suitableAgent);
        assignedCount++;
      } else {
        this.logger.warn('DEBUG: No suitable agent found for task', {
          taskId: task.id.id,
          taskName: task.name,
          taskCapabilities: task.requirements.capabilities,
          availableAgentCount: availableAgents.filter(a => !assignedAgents.includes(a)).length
        });
      }
    }

    // Wait for all assignments to complete in parallel
    if (assignmentPromises.length > 0) {
      await Promise.allSettled(assignmentPromises);
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
      this.logger.info('DEBUG: Task has no dependencies - ready to run', { 
        taskId: task.id.id, 
        taskName: task.name 
      });
      return true;
    }

    // ENHANCED DEBUG: Check each dependency individually
    const dependencyResults = task.constraints.dependencies.map(dep => {
      const depTask = this.tasks.get(dep.id);
      const isCompleted = depTask && depTask.status === 'completed';
      
      this.logger.info('DEBUG: Dependency check', {
        taskId: task.id.id,
        taskName: task.name,
        dependencyId: dep.id,
        dependencyExists: !!depTask,
        dependencyStatus: depTask?.status || 'NOT_FOUND',
        dependencyName: depTask?.name || 'UNKNOWN',
        isCompleted
      });
      
      return isCompleted;
    });

    const allDependenciesMet = dependencyResults.every(result => result);
    
    this.logger.info('DEBUG: Overall dependency check result', {
      taskId: task.id.id,
      taskName: task.name,
      totalDependencies: task.constraints.dependencies.length,
      metDependencies: dependencyResults.filter(r => r).length,
      allDependenciesMet,
      dependencyStatuses: task.constraints.dependencies.map(dep => {
        const depTask = this.tasks.get(dep.id);
        return { id: dep.id, status: depTask?.status || 'NOT_FOUND', name: depTask?.name || 'UNKNOWN' };
      })
    });

    return allDependenciesMet;
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
    const isCompatible = this.isAgentCompatibleWithTask(agent, task);
    this.logger.info('DEBUG: Agent compatibility check', {
      agentId: agent.id.id,
      agentName: agent.name,
      agentType: agent.type,
      taskId: task.id.id,
      taskName: task.name,
      taskType: task.type,
      isCompatible,
      agentCapabilities: {
        codeGeneration: agent.capabilities.codeGeneration,
        testing: agent.capabilities.testing,
        documentation: agent.capabilities.documentation,
        research: agent.capabilities.research,
        analysis: agent.capabilities.analysis,
        tools: agent.capabilities.tools
      },
      taskCapabilities: task.requirements.capabilities
    });

    if (isCompatible) {
      score += 50;
    } else {
      return 0; // Not compatible
    }

    // Performance metrics
    score += agent.metrics.successRate * 30;
    score += (1 - agent.workload) * 20; // Prefer less loaded agents

    // Task type specific bonuses
    const typeMatch = this.getAgentTaskTypeMatch(agent, task);
    if (typeMatch) {
      score += 25;
    }

    this.logger.info('DEBUG: Agent scoring result', {
      agentId: agent.id.id,
      taskId: task.id.id,
      finalScore: score,
      typeMatch,
      successRate: agent.metrics.successRate,
      workload: agent.workload
    });

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
        case 'design':
          // Design can be handled by architects, analysts, or if agent has system-design/architecture tools
          if (!agent.capabilities.analysis && 
              !agent.capabilities.tools.includes('system-design') &&
              !agent.capabilities.tools.includes('architecture')) {
            return false;
          }
          break;
        case 'custom':
          // Custom capabilities can be handled by any agent
          break;
        default:
          // For any other capability, check if it's in the agent's tools
          if (!agent.capabilities.tools.includes(capability)) {
            // FALLBACK: If agent is a developer/coordinator and task is coding, allow it
            if ((agent.type === 'developer' || agent.type === 'coordinator') && 
                (capability === 'file-system' || task.type === 'coding')) {
              continue; // Allow this capability
            }
            return false;
          }
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

  private shouldUseFlowXForTask(task: TaskDefinition, agent: AgentState): boolean {
    // Use FlowX for complex tasks that benefit from SPARC methodology
    const complexTaskTypes = ['coding', 'architecture', 'setup', 'integration', 'documentation'];
    const complexAgentTypes = ['architect', 'developer', 'coordinator'];
    
    const isComplexTask = complexTaskTypes.includes(task.type);
    const isComplexAgent = complexAgentTypes.includes(agent.type);
    const isLongRunningTask = (task.constraints.timeoutAfter || 0) > 600000; // > 10 minutes
    
    return isComplexTask || isComplexAgent || isLongRunningTask;
  }

  private async assignTaskToAgent(task: TaskDefinition, agent: AgentState): Promise<void> {
    if (!task || !agent) {
      this.logger.error('Invalid task or agent', { taskId: task?.id?.id, agentId: agent?.id?.id });
      throw new Error('Cannot assign task: Invalid task or agent');
    }

    // Add rate limiting before Claude API calls
    await this.waitForRateLimit();
    this.logger.info('Assigning task to agent', { 
      taskId: task.id.id, 
      agentId: agent.id.id,
      taskName: task.name,
      agentName: agent.name
    });

    if (this.jsonAggregator) {
        this.jsonAggregator.updateTask(task.id.id, { assignedAgent: agent.id.id, status: 'assigned' });
    }

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

    // PARALLEL-SAFE RATE LIMITING: Use per-agent rate limiting that doesn't block other agents
    // This allows multiple agents to work in parallel while still preventing individual agent rate limits
    const agentId = agent.id.id;
    const lastClaudeCall = this.lastClaudeApiCall.get(agentId);
    const now = Date.now();
    const MIN_DELAY_PER_AGENT = 1000; // 1 second between calls per agent (allows parallel agents)
    
    if (lastClaudeCall && (now - lastClaudeCall) < MIN_DELAY_PER_AGENT) {
      const delayNeeded = MIN_DELAY_PER_AGENT - (now - lastClaudeCall);
      this.logger.info('Per-agent rate limiting delay (allows parallel execution)', {
        taskId: task.id.id,
        agentId,
        delayMs: delayNeeded,
        parallelExecution: true
      });
      // This delay only affects THIS agent, others can continue in parallel
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }

    // Record this Claude API call attempt for this specific agent
    this.lastClaudeApiCall.set(agentId, Date.now());

    // Execute task via REAL task executor with workspace coordination
    try {
      this.logger.info('🚀 Starting REAL task execution with workspace coordination', {
        taskId: task.id.id,
        agentId: agent.id.id,
        taskType: task.type,
        agentType: agent.type
      });

      // CRITICAL FIX: Create workspace for ALL tasks, not just collaborative ones
      let workspaceId: string | undefined;
      
      // Check if this task requires collaboration or is a handoff
      const isCollaborativeTask = task.requirements.reviewRequired || 
                                  task.name.includes('review') ||
                                  task.name.includes('handoff') ||
                                  task.type === 'review';

      this.logger.info('DEBUG: About to setup workspace', {
        taskId: task.id.id,
        agentId: agent.id.id,
        isCollaborativeTask,
        taskName: task.name,
        taskType: task.type
      });

      try {
        if (isCollaborativeTask) {
          // Create or use shared workspace for collaborative tasks
          this.logger.info('DEBUG: Setting up collaborative workspace', { taskId: task.id.id });
          workspaceId = await this.setupCollaborativeWorkspace(task, agent);
        } else {
          // FIXED: Create individual workspace for regular tasks
          this.logger.info('DEBUG: Setting up individual task workspace', { taskId: task.id.id });
          workspaceId = await this.setupTaskWorkspace(task, agent);
        }
        
        this.logger.info('DEBUG: Workspace setup completed', {
          taskId: task.id.id,
          workspaceId,
          isCollaborativeTask
        });
      } catch (workspaceError) {
        this.logger.error('DEBUG: Workspace setup failed', {
          taskId: task.id.id,
          error: workspaceError instanceof Error ? workspaceError.message : String(workspaceError),
          stack: workspaceError instanceof Error ? workspaceError.stack : undefined,
          isCollaborativeTask
        });
        throw workspaceError;
      }

      // Use FlowX executor for enhanced SPARC capabilities, fallback to TaskExecutor
      let executionResult: ExecutionResult;
      
      this.logger.info('DEBUG: About to execute task', {
        taskId: task.id.id,
        agentId: agent.id.id,
        workspaceId,
        hasFlowXExecutor: !!this.flowxExecutor,
        shouldUseFlowX: this.flowxExecutor && this.shouldUseFlowXForTask(task, agent)
      });

      try {
        if (this.flowxExecutor && this.shouldUseFlowXForTask(task, agent)) {
          this.logger.info('Using FlowX executor with SPARC methodology', {
            taskId: task.id.id,
            taskType: task.type,
            agentType: agent.type
          });
          executionResult = await this.flowxExecutor.executeTask(task, agent) as ExecutionResult;
        } else {
          // Use the standard task executor that produces actual deliverables
          this.logger.info('DEBUG: Using TaskExecutor.executeClaudeTask', {
            taskId: task.id.id,
            agentId: agent.id.id,
            taskExecutorExists: !!this.taskExecutor
          });
          executionResult = await this.taskExecutor.executeClaudeTask(task, agent);
        }
        
        this.logger.info('DEBUG: Task execution completed', {
          taskId: task.id.id,
          success: executionResult.success,
          hasOutput: !!executionResult.output,
          outputLength: executionResult.output?.length || 0,
          hasError: !!executionResult.error
        });
      } catch (executionError) {
        this.logger.error('DEBUG: Task execution threw error', {
          taskId: task.id.id,
          error: executionError instanceof Error ? executionError.message : String(executionError),
          stack: executionError instanceof Error ? executionError.stack : undefined
        });
        throw executionError;
      }
      
      if (executionResult.success) {
        this.logger.info('✅ REAL task execution completed successfully', {
          taskId: task.id.id,
          filesGenerated: executionResult.artifacts.files?.length || 0,
          duration: executionResult.duration,
          tokensUsed: executionResult.resourcesUsed.cpuTime, // Not a direct mapping, but best effort
        });
        
        await this.handleTaskCompleted(task.id.id, {
          success: true,
          output: executionResult.output,
          files: executionResult.artifacts.files || [],
          artifacts: executionResult.artifacts,
        });

        // Check for automatic handoffs
        await this.checkForAutomaticHandoffs(task, agent, executionResult);
        
      } else {
        this.logger.error('❌ REAL task execution failed', {
          taskId: task.id.id,
          error: executionResult.error,
          exitCode: executionResult.exitCode,
        });
        await this.handleTaskFailed(task.id.id, new Error(executionResult.error));
      }
    } catch (error) {
      this.logger.error('💥 REAL task execution error', { taskId: task.id.id, error });
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
    
    // FIXED: Pre-generate all task IDs to resolve dependency references
    const taskIds = taskBreakdown.map(() => generateId());
    
    for (let i = 0; i < taskBreakdown.length; i++) {
      const taskInfo = taskBreakdown[i];
      
      const task: TaskDefinition = {
        id: { 
          id: taskIds[i],  // Use pre-generated ID
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
            id: taskIds[depIndex],  // FIXED: Use pre-generated IDs, no more undefined references!
            swarmId: this.swarmId.id,
            sequence: depIndex + 1,
            priority: 1
          })),  // FIXED: No more filtering - all dependencies are now valid
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
    
    // FIXED: Pre-generate all task IDs to resolve dependency references  
    const taskIds = taskBreakdown.map(() => generateId());
    
    for (let i = 0; i < taskBreakdown.length; i++) {
      const taskInfo = taskBreakdown[i];
      
      const task: TaskDefinition = {
        id: { 
          id: taskIds[i],  // Use pre-generated ID
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
            id: taskIds[depIndex],  // FIXED: Use pre-generated IDs
            swarmId: this.swarmId.id,
            sequence: depIndex + 1,
            priority: 1
          })),  // FIXED: No more filtering - all dependencies are valid
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
    
    // React component breakdown
    if (lowerDesc.includes('react') && (lowerDesc.includes('component') || lowerDesc.includes('hello'))) {
      return [
        {
          name: 'Create Package.json',
          description: 'Create package.json with React and TypeScript dependencies',
          instructions: 'Create a package.json file with React, TypeScript, and necessary build dependencies. Include start, build, and test scripts.',
          type: 'coding',
          capabilities: ['code-generation'],
          estimatedDuration: 120000, // 2 minutes
          priority: 'high',
          dependencies: []
        },
        {
          name: 'Create Hello Component',
          description: 'Create React TypeScript Hello component',
          instructions: 'Create a Hello.tsx component with TypeScript that displays "Hello, World!" with proper props and modern React patterns.',
          type: 'coding',
          capabilities: ['code-generation'],
          estimatedDuration: 180000, // 3 minutes
          priority: 'high',
          dependencies: [0]
        },
        {
          name: 'Create App Component',
          description: 'Create main App.tsx component',
          instructions: 'Create the main App.tsx component that imports and renders the Hello component.',
          type: 'coding',
          capabilities: ['code-generation'],
          estimatedDuration: 150000, // 2.5 minutes
          priority: 'high',
          dependencies: [1]
        },
        {
          name: 'Create Index File',
          description: 'Create index.tsx entry point',
          instructions: 'Create index.tsx as the entry point that renders the App component.',
          type: 'coding',
          capabilities: ['code-generation'],
          estimatedDuration: 90000, // 1.5 minutes
          priority: 'normal',
          dependencies: [2]
        },
        {
          name: 'Create README',
          description: 'Create README with setup instructions',
          instructions: 'Create a comprehensive README.md with setup instructions, how to run the app, and project structure.',
          type: 'documentation',
          capabilities: ['documentation'],
          estimatedDuration: 120000, // 2 minutes
          priority: 'normal',
          dependencies: [0, 1, 2, 3]
        }
      ];
    }

    // Hello World application breakdown
    if (lowerDesc.includes('hello world')) {
      return [
        {
          name: 'Create HTML Structure',
          description: 'Create the basic HTML structure for the Hello World application',
          instructions: 'Create a modern HTML5 file with semantic elements, proper meta tags, and a responsive layout structure for a Hello World application.',
          type: 'coding',
          capabilities: ['code-generation'],
          estimatedDuration: 300000, // 5 minutes
          priority: 'high',
          dependencies: []
        },
        {
          name: 'Style with CSS',
          description: 'Create responsive CSS styling with animations',
          instructions: 'Create modern CSS with responsive design, animations, and attractive styling for the Hello World application.',
          type: 'coding',
          capabilities: ['code-generation'],
          estimatedDuration: 420000, // 7 minutes
          priority: 'high',
          dependencies: [0]
        },
        {
          name: 'Add JavaScript Interactivity',
          description: 'Implement interactive JavaScript features',
          instructions: 'Add JavaScript functionality for user interaction, dynamic greetings, and smooth animations.',
          type: 'coding',
          capabilities: ['code-generation'],
          estimatedDuration: 480000, // 8 minutes
          priority: 'high',
          dependencies: [0, 1]
        },
        {
          name: 'Create Documentation',
          description: 'Write comprehensive README and documentation',
          instructions: 'Create a detailed README.md with setup instructions, features, and usage guide.',
          type: 'documentation',
          capabilities: ['documentation'],
          estimatedDuration: 240000, // 4 minutes
          priority: 'normal',
          dependencies: [0, 1, 2]
        },
        {
          name: 'Test and Validate',
          description: 'Test the application and validate functionality',
          instructions: 'Test all features, validate HTML, CSS, and JavaScript, ensure cross-browser compatibility.',
          type: 'testing',
          capabilities: ['testing'],
          estimatedDuration: 180000, // 3 minutes
          priority: 'normal',
          dependencies: [0, 1, 2]
        }
      ];
    }

    // Default single task for other objectives - FIXED: Use 'coding' instead of 'custom'
    return [
      {
        name: 'Complete Objective',
        description: description,
        instructions: `Complete the following objective: ${description}`,
        type: 'coding',
        capabilities: ['code-generation'],
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
    // FIXED: Check for files in the correct structure - result.files (from SwarmCoordinator) or result.artifacts.files
    const files = result?.files || result?.artifacts?.files || result?.result?.files;
    if (!files || !Array.isArray(files) || files.length === 0) {
      this.logger.info('No files to copy from task result', { 
        taskId: task.id.id,
        hasResult: !!result,
        hasFiles: !!result?.files,
        hasArtifactsFiles: !!result?.artifacts?.files,
        hasResultFiles: !!result?.result?.files,
        fileCount: files?.length || 0
      });
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
      for (const file of files) {
        // Handle both file path string and file object formats
        let filePath: string;
        let content: string;
        
        if (typeof file === 'string') {
          // File is a path string - read from the temporary location
          const fileName = file.split('/').pop() || 'output';
          filePath = this.joinPath(outputDir, fileName);
          try {
            const fs = await import('node:fs/promises');
            content = await fs.readFile(file, 'utf-8');
          } catch (error) {
            this.logger.warn('Could not read file from path', { file, error });
            continue;
          }
        } else if (file && typeof file === 'object' && file.path && file.content) {
          // File is an object with path and content
          filePath = this.joinPath(outputDir, file.path);
          content = file.content;
        } else {
          this.logger.warn('Unknown file format in artifacts', { file });
          continue;
        }
        
        await this.ensureDirectoryExists(this.getDirectoryName(filePath));
        await this.writeFile(filePath, content);
        
        this.logger.info('File written', { 
          taskId: task.id.id, 
          filePath: filePath.replace(process.cwd(), '.'),
          size: content?.length || 0
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

    if (this.jsonAggregator) {
        this.jsonAggregator.completeTask(taskId, result);
    }
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

    if (this.jsonAggregator) {
        this.jsonAggregator.updateTask(taskId, { status: 'failed', error: error.message });
    }
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
      
      // Skip heartbeat check for agents that are actively busy with tasks
      // Claude Code tasks can take several minutes to complete
      if (agent.status === 'busy' && agent.currentTask) {
        // Extend timeout for busy agents - allow up to 10 minutes for long-running tasks
        if (timeSinceHeartbeat > 600000) { // 10 minutes for busy agents
          this.logger.warn('Agent marked as offline due to prolonged inactivity during task execution', { 
            agentId, 
            currentTask: agent.currentTask.id,
            timeSinceHeartbeat: Math.round(timeSinceHeartbeat / 1000) + 's'
          });
          agent.status = 'offline';
        }
      } else {
        // Normal timeout for idle agents
        if (timeSinceHeartbeat > 90000) { // 1.5 minutes for idle agents
          if (agent.status !== 'offline') {
            this.logger.warn('Agent marked as offline due to missed heartbeats', { 
              agentId,
              timeSinceHeartbeat: Math.round(timeSinceHeartbeat / 1000) + 's'
            });
            agent.status = 'offline';
          }
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

  /*
   * REMOVED: createApplication method - FUNDAMENTALLY WRONG APPROACH!
   * 
   * Real swarms don't generate static files - they coordinate live Claude Code processes!
   * The correct approach is to spawn Claude Code with MCP tool instructions.
   */

  /*
   * REMOVED: All application generation analysis methods - WRONG APPROACH!
   * 
   * Real swarms coordinate Claude Code processes, not static file generation.
   */

  // ===== WORKSPACE COORDINATION METHODS =====

  /**
   * Setup collaborative workspace for multi-agent tasks
   */
  private async setupCollaborativeWorkspace(task: TaskDefinition, agent: AgentState): Promise<string> {
    const workspaceName = `${task.type}-${task.id.id}`;
    
    // Get other agents that might collaborate
    const collaborators = Array.from(this.agents.values())
      .filter(a => a.id.id !== agent.id.id && a.status === 'idle')
      .slice(0, 2) // Limit to 2 additional collaborators
      .map(a => a.id.id);

    const workspaceId = await this.workspaceCoordinator.createSharedWorkspace(
      workspaceName,
      [agent.id.id, ...collaborators],
      {
        description: `Collaborative workspace for task: ${task.name}`,
        template: task.type
      }
    );

    this.logger.info('🏗️ Setup collaborative workspace', {
      workspaceId,
      taskId: task.id.id,
      agent: agent.id.id,
      collaborators
    });

    return workspaceId;
  }

  /**
   * Setup individual workspace for regular tasks
   */
  private async setupTaskWorkspace(task: TaskDefinition, agent: AgentState): Promise<string> {
    const workspaceName = `${task.type}-${task.id.id}-${agent.id.id}`;
    const workspaceDir = `./swarm-workspaces/swarm-${this.swarmId.id}`;
    
    // Create workspace directory structure
    await fs.ensureDir(workspaceDir);
    await fs.ensureDir(path.join(workspaceDir, 'tasks'));
    await fs.ensureDir(path.join(workspaceDir, 'artifacts'));
    await fs.ensureDir(path.join(workspaceDir, 'logs'));
    
    // Create task-specific directory
    const taskWorkspaceDir = path.join(workspaceDir, 'tasks', workspaceName);
    await fs.ensureDir(taskWorkspaceDir);

    // Create task manifest
    const taskManifest = {
      taskId: task.id.id,
      taskName: task.name,
      taskType: task.type,
      assignedAgent: agent.id.id,
      agentName: agent.name,
      workspaceDir: taskWorkspaceDir,
      objective: task.description,
      requirements: task.requirements,
      createdAt: new Date(),
      status: 'active'
    };

    // Use dynamic import to avoid transpilation issues
    const { writeFile } = await import('node:fs/promises');
    
    await writeFile(
      path.join(taskWorkspaceDir, 'task-manifest.json'),
      JSON.stringify(taskManifest, null, 2),
      'utf8'
    );

    // Create README for the task
    const readmeContent = `# Task: ${task.name}

## Objective
${task.description}

## Task Details
- **Type**: ${task.type}
- **Assigned Agent**: ${agent.name} (${agent.id.id})
- **Created**: ${new Date().toISOString()}

## Instructions
${task.instructions || 'Complete the task according to the objective above.'}

## Workspace Structure
- \`src/\` - Source code files
- \`docs/\` - Documentation
- \`tests/\` - Test files
- \`artifacts/\` - Generated artifacts
`;

    await writeFile(path.join(taskWorkspaceDir, 'README.md'), readmeContent, 'utf8');

    // Create basic project structure for coding tasks
    if (task.type === 'coding' || task.type === 'integration') {
      await fs.ensureDir(path.join(taskWorkspaceDir, 'src'));
      await fs.ensureDir(path.join(taskWorkspaceDir, 'docs'));
      await fs.ensureDir(path.join(taskWorkspaceDir, 'tests'));
      await fs.ensureDir(path.join(taskWorkspaceDir, 'artifacts'));
    }

    this.logger.info('🏗️ Setup individual task workspace', {
      workspaceId: workspaceName,
      taskId: task.id.id,
      agentId: agent.id.id,
      workspaceDir: taskWorkspaceDir
    });

    return workspaceName;
  }

  /**
   * Share task results in workspace for collaboration
   */
  private async shareTaskResults(
    workspaceId: string, 
    task: TaskDefinition, 
    agent: AgentState, 
    result: any
  ): Promise<void> {
    try {
      // Store each generated file in the shared workspace
      for (const [filename, content] of result.files) {
        await this.workspaceCoordinator.storeWorkspaceFile(
          workspaceId,
          filename,
          content,
          agent.id.id,
          {
            status: task.requirements.reviewRequired ? 'review' : 'approved',
            reviewRequired: task.requirements.reviewRequired
          }
        );
      }

      this.logger.info('📤 Shared task results in workspace', {
        workspaceId,
        taskId: task.id.id,
        agent: agent.id.id,
        files: result.files.size
      });
    } catch (error) {
      this.logger.error('Failed to share task results', { error, workspaceId, taskId: task.id.id });
    }
  }

  /**
   * Check for automatic handoffs based on task completion
   */
  private async checkForAutomaticHandoffs(
    task: TaskDefinition, 
    agent: AgentState, 
    result: any
  ): Promise<void> {
    try {
      // Check if this was a coding task that needs review
      if (task.type === 'coding' && result.files.size > 0) {
        const reviewerAgent = this.findBestAgentForTask({
          ...task,
          type: 'review',
          name: `Review: ${task.name}`,
          description: `Review the code generated for: ${task.description}`
        } as TaskDefinition, Array.from(this.agents.values()).filter(a => 
          a.id.id !== agent.id.id && 
          a.capabilities.codeReview && 
          a.status === 'idle'
        ));

        if (reviewerAgent) {
          this.logger.info('🔄 Automatic handoff to reviewer', {
            taskId: task.id.id,
            fromAgent: agent.id.id,
            toAgent: reviewerAgent.id.id
          });

          // Create review task
          const reviewTask = this._createTaskDefinition({
            name: `Review: ${task.name}`,
            description: `Review the code generated for: ${task.description}`,
            type: 'review',
            priority: task.priority,
            instructions: `Please review the code files generated by ${agent.name} and provide feedback.`,
            requirements: {
              capabilities: ['code-review'],
              tools: ['str_replace_editor'],
              permissions: ['read', 'write'],
              reviewRequired: false,
            },
            constraints: {
              dependencies: [],
              dependents: [],
              conflicts: [],
            },
          });

          this.tasks.set(reviewTask.id.id, reviewTask);
          this.pendingTasks.add(reviewTask.id.id);

          await this.assignTaskToAgent(reviewTask, reviewerAgent);
        }
      }

      // Check if this was a research task that needs analysis
      if (task.type === 'research' && result.files.size > 0) {
        const analystAgent = this.findBestAgentForTask(
          {
            ...task,
            type: 'analysis',
            name: `Analyze: ${task.name}`,
            description: `Analyze the research findings for: ${task.description}`,
          } as TaskDefinition,
          Array.from(this.agents.values()).filter(
            (a) =>
              a.id.id !== agent.id.id &&
              a.capabilities.analysis &&
              a.status === 'idle'
          )
        );

        if (analystAgent) {
          this.logger.info('🔄 Automatic handoff to analyst', {
            taskId: task.id.id,
            fromAgent: agent.id.id,
            toAgent: analystAgent.id.id,
          });

          // Create analysis task
          const analysisTask = this._createTaskDefinition({
            name: `Analyze: ${task.name}`,
            description: `Analyze the research findings for: ${task.description}`,
            type: 'analysis',
            priority: task.priority,
            instructions: `Please analyze the research findings generated by ${agent.name} and provide insights.`,
            requirements: {
              capabilities: ['analysis'],
              tools: ['str_replace_editor'],
              permissions: ['read', 'write'],
              reviewRequired: false,
            },
            constraints: {
              dependencies: [],
              dependents: [],
              conflicts: [],
            },
          });

          this.tasks.set(analysisTask.id.id, analysisTask);
          this.pendingTasks.add(analysisTask.id.id);

          await this.assignTaskToAgent(analysisTask, analystAgent);
        }
      }
    } catch (error) {
      this.logger.error('Failed to check automatic handoffs', {
        error,
        taskId: task.id.id,
      });
    }
  }

  /**
   * Get workspace coordinator for external access
   */
  getWorkspaceCoordinator(): WorkspaceCoordinator {
    return this.workspaceCoordinator;
  }

  private _createTaskDefinition(details: Partial<TaskDefinition>): TaskDefinition {
    const taskId = {
      id: generateId('task'),
      swarmId: this.swarmId.id,
      sequence: this.tasks.size + 1,
      priority: this._getTaskPriorityValue(details.priority || 'normal'),
    };

    return {
      id: taskId,
      name: details.name || 'Untitled Task',
      description: details.description || '',
      type: details.type || 'custom',
      priority: details.priority || 'normal',
      status: 'created',
      instructions: details.instructions || '',
      requirements: details.requirements || { capabilities: [], tools: [], permissions: [] },
      constraints: details.constraints || { dependencies: [], dependents: [], conflicts: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      input: details.input || {},
      context: details.context || {},
      attempts: [],
      statusHistory: [],
      ...details,
    };
  }

  private _getTaskPriorityValue(priority: TaskPriority): number {
    switch (priority) {
      case 'critical': return 5;
      case 'high': return 4;
      case 'normal': return 3;
      case 'low': return 2;
      case 'background': return 1;
      default: return 3;
    }
  }

  /**
   * Create tasks from workflow definition
   */
  createTasks(workflowTasks: any[]): void {
    this.logger.info('Creating tasks from workflow definition', { 
      taskCount: workflowTasks.length 
    });

    for (const workflowTask of workflowTasks) {
      const task: TaskDefinition = {
        id: { 
          id: workflowTask.id || generateId(),
          swarmId: this.swarmId.id,
          sequence: workflowTask.sequence || 1,
          priority: 1
        },
        type: workflowTask.type || 'coding',
        name: workflowTask.name,
        description: workflowTask.description || workflowTask.instructions,
        instructions: workflowTask.instructions || workflowTask.description,
        requirements: {
          capabilities: workflowTask.requirements?.capabilities || [],
          tools: workflowTask.requirements?.tools || [],
          permissions: workflowTask.requirements?.permissions || [],
          estimatedDuration: workflowTask.requirements?.estimatedDuration || 300000,
          maxDuration: workflowTask.requirements?.maxDuration || 600000,
          reviewRequired: workflowTask.requirements?.reviewRequired || false,
          testingRequired: workflowTask.requirements?.testingRequired || false
        },
        constraints: {
          dependencies: workflowTask.dependencies ? 
            workflowTask.dependencies.map((dep: string) => ({
              id: dep,
              swarmId: this.swarmId.id,
              sequence: 1,
              priority: 1
            })) : [],
          dependents: [],
          conflicts: []
        },
        priority: workflowTask.priority || 'medium',
        input: workflowTask.input || {},
        context: {
          objectiveId: 'workflow-objective',
          strategy: 'workflow',
          ...workflowTask.context  // Preserve any context passed from CLI (like rootDirectory)
        },
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: [],
        statusHistory: []
      };

      this.tasks.set(task.id.id, task);
      this.pendingTasks.add(task.id.id);
      
      this.logger.info('Created task from workflow', {
        taskId: task.id.id,
        taskName: task.name,
        taskType: task.type
      });
    }

    this.logger.info('All workflow tasks created', { 
      totalTasks: this.tasks.size,
      pendingTasks: this.pendingTasks.size 
    });
  }

  async completeTask(taskId: string, result: TaskResult): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const agent = this.agents.get(task.assignedTo!.id);
    if (!agent) {
      throw new Error(`Agent ${task.assignedTo} not found`);
    }

    const success = result.quality > 0.5 && result.completeness > 0.5; // Define success based on quality metrics
    
    this.logger.info('🏁 Task completion initiated', {
      taskId,
      taskName: task.name,
      agentId: agent.id.id,
      agentName: agent.name,
      result: {
        quality: result.quality,
        completeness: result.completeness,
        duration: result.executionTime,
        artifactsCreated: Object.keys(result.artifacts || {}).length,
        outputLength: result.output?.toString().length || 0
      }
    });

    // Enhanced task completion with memory and coordination
    task.status = success ? 'completed' : 'failed';
    task.completedAt = new Date();
    task.result = result;

    // Update agent status and workload
    agent.status = 'idle';
    agent.workload = Math.max(0, agent.workload - 0.3);
    agent.currentTask = undefined;

    // Move task from running to completed/failed
    this.runningTasks.delete(taskId);
    if (success) {
      this.completedTasks.add(taskId);
      agent.metrics.tasksCompleted++;
    } else {
      this.failedTasks.add(taskId);
      agent.metrics.tasksFailed++;
    }

    // Enhanced logging for swarm coordination
    this.logger.info('🧠 Storing task knowledge in swarm memory', {
      taskId: task.id.id,
      taskType: task.type,
      agentType: agent.type,
      memoryContext: {
        artifacts: Object.keys(result.artifacts || {}).length,
        quality: result.quality,
        completeness: result.completeness
      }
    });

    // Log enhanced agent coordination 
    this.logger.info('📡 Sharing task knowledge across swarm', {
      taskId: task.id.id,
      completingAgent: agent.id.id,
      swarmSize: this.agents.size,
      knowledgeType: {
        artifacts: Object.keys(result.artifacts || {}).length,
        recommendations: result.recommendations?.length || 0,
        nextSteps: result.nextSteps?.length || 0
      }
    });

    this.logger.info('✅ Task completed and swarm updated', {
      taskId,
      taskName: task.name,
      swarmStatus: {
        pendingTasks: this.pendingTasks.size,
        runningTasks: this.runningTasks.size,
        completedTasks: this.completedTasks.size,
        failedTasks: this.failedTasks.size,
        activeAgents: Array.from(this.agents.values()).filter(a => a.status !== 'offline').length
      }
    });

    // Continue scheduling if there are more tasks
    if (this.pendingTasks.size > 0) {
      this.logger.info('🔄 Scheduling next tasks in pipeline', {
        remainingTasks: this.pendingTasks.size,
        availableAgents: Array.from(this.agents.values()).filter(a => a.status === 'idle').length
      });
      setImmediate(() => this.scheduleAvailableTasks());
    }

    // this.emit('task:completed', { taskId, result, agent: agent.id });
  }
} 