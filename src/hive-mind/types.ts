/**
 * Hive Mind Type Definitions
 * 
 * Core types and interfaces for the Hive Mind collective intelligence system
 * Based on original flowx v2.0.0 Alpha architecture
 */

// === CORE ENUMS ===

export type SwarmTopology = 'mesh' | 'hierarchical' | 'ring' | 'star';
export type QueenMode = 'centralized' | 'distributed';
export type SwarmStatus = 'active' | 'paused' | 'archived';

export type AgentType = 
  | 'queen'
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
  | 'specialist'
  | 'security'
  | 'devops';

export type AgentStatus = 'idle' | 'busy' | 'active' | 'error' | 'offline';

export type AgentCapability = 
  | 'task_management'
  | 'resource_allocation'
  | 'consensus_building'
  | 'information_gathering'
  | 'pattern_recognition'
  | 'knowledge_synthesis'
  | 'code_generation'
  | 'refactoring'
  | 'debugging'
  | 'data_analysis'
  | 'performance_metrics'
  | 'bottleneck_detection'
  | 'system_design'
  | 'architecture_patterns'
  | 'integration_planning'
  | 'test_generation'
  | 'quality_assurance'
  | 'edge_case_detection'
  | 'code_review'
  | 'standards_enforcement'
  | 'best_practices'
  | 'performance_optimization'
  | 'resource_optimization'
  | 'algorithm_improvement'
  | 'documentation_generation'
  | 'api_docs'
  | 'user_guides'
  | 'system_monitoring'
  | 'health_checks'
  | 'alerting'
  | 'domain_expertise'
  | 'custom_capabilities'
  | 'problem_solving'
  | 'security_auditing'
  | 'compliance_checking'
  | 'threat_detection'
  | 'vulnerability_assessment'
  | 'deployment_automation'
  | 'infrastructure_management'
  | 'container_orchestration'
  | 'ci_cd_pipeline'
  | 'neural_processing'
  | 'machine_learning'
  | 'predictive_analysis';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStrategy = 'parallel' | 'sequential' | 'adaptive' | 'consensus';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type MessageType = 
  | 'direct'
  | 'broadcast'
  | 'consensus'
  | 'query'
  | 'response'
  | 'notification'
  | 'task_assignment'
  | 'progress_update'
  | 'coordination'
  | 'channel';

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export type ConsensusStatus = 'pending' | 'achieved' | 'failed' | 'timeout';
export type VotingStrategy = 'simple_majority' | 'weighted_voting' | 'unanimous' | 'threshold_based';

export type NeuralPatternType = 'coordination' | 'optimization' | 'prediction' | 'behavior';
export type PatternType = NeuralPatternType;

export type HookType = 
  | 'pre-task'
  | 'post-task'
  | 'pre-edit'
  | 'post-edit'
  | 'pre-command'
  | 'post-command'
  | 'session-start'
  | 'session-end'
  | 'session-restore'
  | 'notification';

export type SecurityEventSeverity = 'info' | 'warning' | 'error' | 'critical';

// === CORE INTERFACES ===

export interface HiveMindConfig {
  name: string;
  topology: SwarmTopology;
  maxAgents: number;
  queenMode: QueenMode;
  memoryTTL: number;
  consensusThreshold: number;
  autoSpawn: boolean;
  enabledFeatures?: string[];
  createdAt: Date;
  performanceMetrics?: Record<string, any>;
  resourceLimits?: ResourceLimits;
  securityConfig?: SecurityConfig;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxDiskMB: number;
  maxNetworkMbps: number;
  maxConcurrentTasks: number;
  maxExecutionTimeMs: number;
}

export interface SecurityConfig {
  encryptionEnabled: boolean;
  auditLogging: boolean;
  threatDetection: boolean;
  accessControl: boolean;
  dataRetentionDays: number;
  complianceMode: string;
}

export interface AgentConfig {
  id?: string;
  name: string;
  type: AgentType;
  swarmId: string;
  capabilities: AgentCapability[];
  specialization?: string;
  systemPrompt?: string;
  healthScore?: number;
  performanceRating?: number;
  resourceUsage?: Record<string, any>;
}

export interface AgentSpawnOptions {
  type: AgentType;
  name?: string;
  capabilities?: AgentCapability[];
  autoAssign?: boolean;
  specialization?: string;
  systemPrompt?: string;
}

export interface Task {
  id: string;
  swarmId: string;
  description: string;
  priority: TaskPriority;
  strategy: TaskStrategy;
  status: TaskStatus;
  progress: number;
  result?: any;
  error?: string;
  dependencies: string[];
  assignedAgents: string[];
  requireConsensus: boolean;
  consensusAchieved?: boolean;
  maxAgents: number;
  requiredCapabilities: AgentCapability[];
  createdAt: Date;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  deadline?: Date;
  metadata: Record<string, any>;
  executionPlan?: Record<string, any>;
  qualityScore?: number;
  resourceRequirements?: Record<string, any>;
}

export interface TaskSubmitOptions {
  description: string;
  priority: TaskPriority;
  strategy: TaskStrategy;
  dependencies?: string[];
  assignTo?: string;
  requireConsensus?: boolean;
  maxAgents?: number;
  requiredCapabilities?: AgentCapability[];
  metadata?: Record<string, any>;
  deadline?: Date;
  resourceRequirements?: Record<string, any>;
}

export interface TaskAssignment {
  role: string;
  requiredCapabilities: AgentCapability[];
  responsibilities: string[];
  expectedOutput: string;
  timeout: number;
  canRunParallel: boolean;
  resourceAllocation?: Record<string, any>;
}

export interface Message {
  id: string;
  fromAgentId: string;
  toAgentId: string | null;
  swarmId: string;
  type: MessageType;
  content: any;
  priority?: MessagePriority;
  timestamp: Date;
  requiresResponse: boolean;
  channelName?: string;
  encryptionKey?: string;
  deliveredAt?: Date;
  readAt?: Date;
  metadata?: Record<string, any>;
}

export interface CommunicationChannel {
  name: string;
  description: string;
  type: 'public' | 'private';
  subscribers: string[];
  createdAt: Date;
  encryptionEnabled?: boolean;
  retentionPolicy?: string;
}

export interface CommunicationStats {
  totalMessages: number;
  avgLatency: number;
  activeChannels: number;
  messagesByType: Record<MessageType, number>;
  throughput: number;
  encryptedMessages: number;
}

export interface MemoryEntry {
  key: string;
  namespace: string;
  value: string;
  ttl?: number;
  createdAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  tags?: string[];
  contentType?: string;
  contentHash?: string;
  importanceScore?: number;
}

export interface MemoryNamespace {
  name: string;
  description: string;
  retentionPolicy: 'persistent' | 'time-based' | 'size-based';
  ttl?: number;
  maxEntries?: number;
  lastOperation?: string;
  lastOperationTime?: Date;
  encryptionEnabled?: boolean;
}

export interface MemoryStats {
  totalEntries: number;
  totalSize: number;
  byNamespace: Record<string, {
    entries: number;
    size: number;
    avgTTL: number;
  }>;
  cacheHitRate: number;
  avgAccessTime: number;
  hotKeys: string[];
  encryptedEntries: number;
}

export interface MemorySearchOptions {
  namespace?: string;
  pattern?: string;
  keyPrefix?: string;
  minAccessCount?: number;
  limit?: number;
  sortBy?: 'access' | 'recent' | 'created' | 'importance';
  tags?: string[];
  contentType?: string;
}

export interface MemoryPattern {
  type: 'co-access' | 'temporal' | 'frequency';
  keys: string[];
  confidence: number;
  frequency: number;
  metadata?: Record<string, any>;
}

export interface ConsensusProposal {
  id: string;
  swarmId: string;
  taskId?: string;
  proposal: any;
  requiredThreshold: number;
  deadline?: Date;
  votingStrategy: VotingStrategy;
  metadata?: Record<string, any>;
}

export interface ConsensusVote {
  proposalId: string;
  agentId: string;
  vote: boolean;
  reason?: string;
  timestamp: Date;
  confidence?: number;
  weight?: number;
}

export interface ConsensusResult {
  proposalId: string;
  achieved: boolean;
  finalRatio: number;
  totalVotes: number;
  positiveVotes: number;
  negativeVotes: number;
  participationRate: number;
  confidenceScore: number;
  finalDecision?: any;
}

export interface VotingStrategyConfig {
  name: string;
  description: string;
  threshold: number;
  weightingEnabled: boolean;
  confidenceRequired: boolean;
  recommend: (proposal: ConsensusProposal, analysis: any) => {
    vote: boolean;
    confidence: number;
    reasoning: string;
    factors: string[];
  };
}

export interface ConsensusMetrics {
  totalProposals: number;
  achievedConsensus: number;
  failedConsensus: number;
  avgVotingTime: number;
  avgParticipation: number;
  avgConfidence: number;
}

export interface ExecutionPlan {
  taskId: string;
  strategy: TaskStrategy;
  phases: string[];
  phaseAssignments: TaskAssignment[][];
  dependencies: string[];
  checkpoints: any[];
  parallelizable: boolean;
  estimatedDuration: number;
  resourceRequirements: Record<string, any>;
  riskAssessment?: Record<string, any>;
}

export interface OrchestrationResult {
  taskId: string;
  success: boolean;
  executionTime: number;
  phaseResults: any[];
  errors?: any[];
  qualityScore?: number;
  resourcesUsed?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  data: any;
  executionTime: number;
  agentId: string;
  metadata?: Record<string, any>;
  qualityScore?: number;
  resourcesUsed?: Record<string, any>;
}

export interface QueenDecision {
  id: string;
  taskId: string;
  strategy: CoordinationStrategy;
  selectedAgents: string[];
  executionPlan: any;
  confidence: number;
  rationale: string;
  timestamp: Date;
  alternativeStrategies?: CoordinationStrategy[];
}

export interface CoordinationStrategy {
  name: string;
  description: string;
  phases: string[];
  maxAgents: number;
  coordinationPoints: string[];
  suitableFor: string[];
  riskLevel: 'low' | 'medium' | 'high';
  expectedEfficiency: number;
}

export interface SwarmStatusInfo {
  swarmId: string;
  name: string;
  topology: SwarmTopology;
  queenMode: QueenMode;
  health: 'healthy' | 'degraded' | 'critical' | 'unknown';
  uptime: number;
  agents: Array<{
    id: string;
    name: string;
    type: AgentType;
    status: AgentStatus;
    currentTask: string | null;
    messageCount: number;
    createdAt: number;
    healthScore: number;
    performanceRating: number;
  }>;
  agentsByType: Record<AgentType, number>;
  tasks: Array<{
    id: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    progress: number;
    assignedAgent: string | null;
    qualityScore?: number;
  }>;
  taskStats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    avgQuality: number;
  };
  memoryStats: MemoryStats;
  communicationStats: CommunicationStats;
  performance: {
    avgTaskCompletion: number;
    messageThroughput: number;
    consensusSuccessRate: number;
    memoryHitRate: number;
    agentUtilization: number;
    neuralPatternAccuracy: number;
  };
  warnings: string[];
  securityStatus: {
    threatsDetected: number;
    vulnerabilities: number;
    complianceScore: number;
    lastAudit: Date;
  };
}

export interface NeuralPattern {
  id: string;
  swarm_id: string;
  pattern_type: NeuralPatternType;
  pattern_data: string;
  confidence: number;
  usage_count: number;
  success_rate: number;
  created_at: string;
  last_used_at?: string;
  metadata?: string;
  training_data?: string;
  model_version: string;
  validation_score: number;
}

export interface PerformanceMetric {
  swarmId: string;
  agentId?: string;
  metricType: string;
  metricValue: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  category: string;
  unit: string;
  aggregationPeriod: string;
}

export interface SessionHistory {
  id: string;
  swarmId: string;
  startedAt: Date;
  endedAt?: Date;
  tasksCompleted: number;
  tasksFailed: number;
  totalMessages: number;
  avgTaskDuration?: number;
  sessionData?: Record<string, any>;
  userId?: string;
  sessionType: string;
  outcome: string;
  qualityRating: number;
}

export interface Hook {
  id: string;
  swarmId?: string;
  hookType: HookType;
  hookName: string;
  command: string;
  args: string[];
  enabled: boolean;
  alwaysRun: boolean;
  createdAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
  metadata?: Record<string, any>;
}

export interface Workflow {
  id: string;
  swarmId: string;
  name: string;
  description?: string;
  definition: Record<string, any>;
  status: 'active' | 'paused' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
  metadata?: Record<string, any>;
}

export interface SecurityEvent {
  id: number;
  swarmId: string;
  agentId?: string;
  eventType: string;
  severity: SecurityEventSeverity;
  description: string;
  timestamp: Date;
  sourceIp?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// === ADVANCED INTERFACES ===

export interface AgentHealth {
  agentId: string;
  healthScore: number;
  lastCheck: Date;
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  issues: string[];
  recommendations: string[];
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  performanceMetrics: {
    tasksCompleted: number;
    avgExecutionTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface SwarmMetrics {
  swarmId: string;
  timestamp: Date;
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  busyAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  avgTaskDuration: number;
  messageThroughput: number;
  consensusSuccessRate: number;
  memoryHitRate: number;
  neuralPatternAccuracy: number;
  securityScore: number;
  overallHealth: number;
  efficiency: number;
  resourceUtilization: Record<string, number>;
}

export interface NeuralNetworkConfig {
  layers: number[];
  activationFunction: string;
  learningRate: number;
  batchSize: number;
  epochs: number;
  validationSplit: number;
  regularization?: {
    l1?: number;
    l2?: number;
    dropout?: number;
  };
  optimizer: string;
  lossFunction: string;
}

export interface CognitiveModel {
  name: string;
  type: PatternType;
  description: string;
  parameters: Record<string, any>;
  isActive: boolean;
}

export interface PatternMatch {
  patternId: string;
  confidence: number;
  modelName: string;
  matchedFeatures: string[];
  timestamp: string;
  metadata: Record<string, any>;
}

export interface LearningSession {
  id: string;
  swarmId: string;
  startedAt: string;
  endedAt?: string;
  samplesProcessed: number;
  patternsLearned: number;
  averageConfidence: number;
  successRate: number;
  metadata?: Record<string, any>;
}

export interface LearningPattern {
  id: string;
  swarmId: string;
  patternType: 'success' | 'failure' | 'optimization' | 'coordination';
  context: Record<string, any>;
  outcome: Record<string, any>;
  confidence: number;
  frequency: number;
  lastObserved: Date;
  applicableScenarios: string[];
  recommendations: string[];
}

// === EVENT INTERFACES ===

export interface SwarmEvent {
  id: string;
  swarmId: string;
  eventType: string;
  timestamp: Date;
  source: string;
  data: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  processed: boolean;
  processedAt?: Date;
}

export interface AgentEvent {
  id: string;
  agentId: string;
  swarmId: string;
  eventType: string;
  timestamp: Date;
  data: Record<string, any>;
  impact: 'low' | 'medium' | 'high';
}

export interface TaskEvent {
  id: string;
  taskId: string;
  swarmId: string;
  eventType: string;
  timestamp: Date;
  data: Record<string, any>;
  agentId?: string;
}

// === UTILITY TYPES ===

export type SwarmEventHandler = (event: SwarmEvent) => void | Promise<void>;
export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;
export type TaskEventHandler = (event: TaskEvent) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: SwarmEventHandler | AgentEventHandler | TaskEventHandler;
  filter?: (event: any) => boolean;
  priority: number;
}

export interface DatabaseConnection {
  execute(sql: string, params?: any[]): Promise<any>;
  query(sql: string, params?: any[]): Promise<any[]>;
  transaction(callback: (db: DatabaseConnection) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

export interface HiveMindOptions {
  databasePath?: string;
  enableMetrics?: boolean;
  enableSecurity?: boolean;
  enableNeuralPatterns?: boolean;
  enableHooks?: boolean;
  enableWorkflows?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  performanceOptimizations?: boolean;
}

// === EXPORT COLLECTIONS ===

export interface HiveMindExport {
  // Core classes (to be implemented)
  HiveMind: any;
  Queen: any;
  Agent: any;
  Memory: any;
  Communication: any;
  DatabaseManager: any;
  
  // Integration layer (to be implemented)
  MCPToolWrapper: any;
  SwarmOrchestrator: any;
  ConsensusEngine: any;
  
  // Neural computing (to be implemented)
  NeuralPatternEngine: any;
  CognitiveProcessor: any;
  LearningSystem: any;
  
  // Security (to be implemented)
  SecurityManager: any;
  ThreatDetector: any;
  ComplianceChecker: any;
  
  // Hooks and workflows (to be implemented)
  HookManager: any;
  WorkflowEngine: any;
  
  // Types
  types: {
    // All the types defined above
    [key: string]: any;
  };
} 