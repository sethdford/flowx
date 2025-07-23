/**
 * Consensus Engine for Hive Mind
 * 
 * Provides sophisticated consensus mechanisms for distributed decision making
 * in the collective intelligence system.
 */

import { EventEmitter } from 'node:events';
import { Logger } from '../../core/logger.js';
import { EventBus } from '../../core/event-bus.js';
import {
  ConsensusProposal,
  ConsensusVote,
  ConsensusResult,
  VotingStrategy,
  VotingStrategyConfig
} from '../types.js';
import { generateId } from '../../utils/helpers.js';

// Configuration for the consensus engine
export interface ConsensusEngineConfig {
  defaultThreshold: number;
  defaultVotingStrategy: VotingStrategy;
  maxVotingTime: number;
  minParticipation: number;
  weightedVoting: boolean;
  confidenceWeighting: boolean;
  reputationWeighting: boolean;
  expertiseWeighting: boolean;
  neuralPatternEnabled: boolean;
  conflictResolutionEnabled: boolean;
}

// Default configuration
const DEFAULT_CONFIG: ConsensusEngineConfig = {
  defaultThreshold: 0.7,
  defaultVotingStrategy: 'threshold_based',
  maxVotingTime: 30000, // 30 seconds
  minParticipation: 0.5,
  weightedVoting: true,
  confidenceWeighting: true,
  reputationWeighting: true,
  expertiseWeighting: true,
  neuralPatternEnabled: true,
  conflictResolutionEnabled: true
};

// Consensus proposal with additional runtime data
interface ActiveProposal extends ConsensusProposal {
  votes: Map<string, ConsensusVote>;
  startTime: number;
  timeoutId?: NodeJS.Timeout;
  reminderTimeoutId?: NodeJS.Timeout;
  result?: ConsensusResult;
  participants: Set<string>;
  agentWeights: Map<string, number>;
  finalizedAt?: number;
}

/**
 * Consensus Engine - Provides distributed decision making capabilities
 */
export class ConsensusEngine extends EventEmitter {
  private logger: Logger;
  private eventBus: EventBus;
  private config: ConsensusEngineConfig;
  
  // Voting strategies
  private votingStrategies = new Map<VotingStrategy, VotingStrategyConfig>();
  
  // Active proposals
  private activeProposals = new Map<string, ActiveProposal>();
  
  // Historical proposals
  private completedProposals = new Map<string, ActiveProposal>();
  
  // Metrics
  private metrics = {
    totalProposals: 0,
    achievedConsensus: 0,
    failedConsensus: 0,
    avgVotingTime: 0,
    avgParticipation: 0,
    avgConfidence: 0
  };
  
  constructor(config: Partial<ConsensusEngineConfig> = {}) {
    super();
    this.logger = new Logger('ConsensusEngine');
    this.eventBus = EventBus.getInstance();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.initializeVotingStrategies();
    this.setupEventListeners();
  }

  /**
   * Initialize voting strategies
   */
  private initializeVotingStrategies(): void {
    // Simple majority strategy
    this.votingStrategies.set('simple_majority', {
      name: 'simple_majority',
      description: 'Requires more than 50% positive votes',
      threshold: 0.5,
      weightingEnabled: false,
      confidenceRequired: false,
      recommend: (proposal, analysis) => {
        const positiveRatio = analysis.positiveVotes / analysis.totalVotes;
        return {
          vote: positiveRatio > 0.5,
          confidence: Math.abs(positiveRatio - 0.5) * 2,
          reasoning: positiveRatio > 0.5 ? 
            'Majority of votes were positive' : 
            'Majority of votes were negative',
          factors: ['vote_count']
        };
      }
    });
    
    // Weighted voting strategy
    this.votingStrategies.set('weighted_voting', {
      name: 'weighted_voting',
      description: 'Weights votes based on agent reputation and expertise',
      threshold: 0.6,
      weightingEnabled: true,
      confidenceRequired: true,
      recommend: (proposal, analysis) => {
        const weightedPositive = analysis.weightedPositive / analysis.totalWeight;
        return {
          vote: weightedPositive > 0.6,
          confidence: Math.abs(weightedPositive - 0.5) * 2,
          reasoning: weightedPositive > 0.6 ? 
            'Weighted majority supports proposal' : 
            'Weighted majority rejects proposal',
          factors: ['vote_count', 'agent_weights', 'confidence']
        };
      }
    });
    
    // Unanimous strategy
    this.votingStrategies.set('unanimous', {
      name: 'unanimous',
      description: 'Requires all votes to be positive',
      threshold: 1.0,
      weightingEnabled: false,
      confidenceRequired: false,
      recommend: (proposal, analysis) => {
        const unanimous = analysis.negativeVotes === 0 && analysis.totalVotes > 0;
        return {
          vote: unanimous,
          confidence: unanimous ? 1.0 : 0.0,
          reasoning: unanimous ? 
            'All votes were positive' : 
            'At least one negative vote',
          factors: ['vote_count']
        };
      }
    });
    
    // Threshold-based strategy
    this.votingStrategies.set('threshold_based', {
      name: 'threshold_based',
      description: 'Requires a specific threshold of positive votes',
      threshold: this.config.defaultThreshold,
      weightingEnabled: this.config.weightedVoting,
      confidenceRequired: this.config.confidenceWeighting,
      recommend: (proposal, analysis) => {
        const value = this.config.weightedVoting ? 
          analysis.weightedPositive / analysis.totalWeight : 
          analysis.positiveVotes / analysis.totalVotes;
        
        const threshold = proposal.requiredThreshold;
        
        return {
          vote: value >= threshold,
          confidence: Math.min(1.0, Math.abs(value - threshold) * 2 + 0.2),
          reasoning: value >= threshold ? 
            `Reached required threshold of ${threshold}` : 
            `Failed to reach required threshold of ${threshold}`,
          factors: this.config.weightedVoting ? 
            ['vote_count', 'agent_weights', 'threshold'] : 
            ['vote_count', 'threshold']
        };
      }
    });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for votes
    this.eventBus.on('consensus:vote', (vote: ConsensusVote) => {
      this.processVote(vote);
    });
    
    // Listen for agent metric updates
    this.eventBus.on('agent:metrics_updated', (data: {
      agentId: string;
      metrics: Record<string, number>;
    }) => {
      this.updateAgentWeight(data.agentId, data.metrics);
    });
  }

  /**
   * Create a new consensus proposal
   */
  public async createProposal(options: {
    swarmId: string;
    taskId?: string;
    proposal: any;
    requiredThreshold?: number;
    deadline?: Date;
    votingStrategy?: VotingStrategy;
    metadata?: Record<string, any>;
  }): Promise<ConsensusProposal> {
    try {
      // Generate ID
      const proposalId = generateId('proposal');
      
      // Determine threshold and voting strategy
      const requiredThreshold = options.requiredThreshold !== undefined ? 
        options.requiredThreshold : this.config.defaultThreshold;
      
      const votingStrategy = options.votingStrategy || this.config.defaultVotingStrategy;
      
      // Create proposal
      const proposal: ConsensusProposal = {
        id: proposalId,
        swarmId: options.swarmId,
        taskId: options.taskId,
        proposal: options.proposal,
        requiredThreshold,
        deadline: options.deadline,
        votingStrategy,
        metadata: options.metadata || {}
      };
      
      // Create active proposal
      const activeProposal: ActiveProposal = {
        ...proposal,
        votes: new Map<string, ConsensusVote>(),
        startTime: Date.now(),
        participants: new Set<string>(),
        agentWeights: new Map<string, number>()
      };
      
      // Set deadline timeout
      if (options.deadline || this.config.maxVotingTime > 0) {
        const timeoutMs = options.deadline ? 
          options.deadline.getTime() - Date.now() : 
          this.config.maxVotingTime;
        
        activeProposal.timeoutId = setTimeout(() => {
          this.finalizeProposal(proposalId, 'timeout');
        }, timeoutMs);
        
        // Set reminder at halfway point
        const reminderMs = timeoutMs / 2;
        activeProposal.reminderTimeoutId = setTimeout(() => {
          this.sendVotingReminder(proposalId);
        }, reminderMs);
      }
      
      // Store active proposal
      this.activeProposals.set(proposalId, activeProposal);
      
      // Update metrics
      this.metrics.totalProposals++;
      
      this.logger.info('Consensus proposal created', {
        proposalId,
        swarmId: options.swarmId,
        taskId: options.taskId,
        threshold: requiredThreshold,
        strategy: votingStrategy
      });
      
      // Emit proposal created event
      this.eventBus.emit('consensus:proposal_created', {
        proposalId,
        swarmId: options.swarmId,
        taskId: options.taskId,
        proposal: options.proposal,
        requiredThreshold,
        votingStrategy
      });
      
      // Return proposal
      return proposal;
    } catch (error) {
      this.logger.error('Failed to create consensus proposal', { error });
      throw error;
    }
  }

  /**
   * Process a consensus vote
   */
  private processVote(vote: ConsensusVote): void {
    try {
      const proposal = this.activeProposals.get(vote.proposalId);
      
      // Check if proposal exists and is still active
      if (!proposal) {
        this.logger.warn('Vote received for unknown or completed proposal', {
          proposalId: vote.proposalId,
          agentId: vote.agentId
        });
        return;
      }
      
      // Store vote
      proposal.votes.set(vote.agentId, vote);
      proposal.participants.add(vote.agentId);
      
      this.logger.debug('Consensus vote processed', {
        proposalId: vote.proposalId,
        agentId: vote.agentId,
        vote: vote.vote,
        confidence: vote.confidence
      });
      
      // Emit vote processed event
      this.emit('vote:processed', { proposalId: vote.proposalId, vote });
      
      // Check if consensus can be reached
      this.checkConsensusStatus(vote.proposalId);
    } catch (error) {
      this.logger.error('Failed to process vote', {
        proposalId: vote.proposalId,
        agentId: vote.agentId,
        error
      });
    }
  }

  /**
   * Submit a vote for a proposal
   */
  public async submitVote(
    proposalId: string,
    agentId: string,
    vote: boolean,
    confidence: number = 1.0,
    reason: string = ''
  ): Promise<void> {
    try {
      const proposal = this.activeProposals.get(proposalId);
      
      if (!proposal) {
        throw new Error('Proposal not found or already completed');
      }
      
      const consensusVote: ConsensusVote = {
        proposalId,
        agentId,
        vote,
        confidence,
        reason,
        timestamp: new Date(),
        weight: this.getAgentWeight(proposal, agentId)
      };
      
      // Process vote
      this.processVote(consensusVote);
    } catch (error) {
      this.logger.error('Failed to submit vote', {
        proposalId,
        agentId,
        error
      });
      throw error;
    }
  }

  /**
   * Check if consensus has been reached
   */
  private checkConsensusStatus(proposalId: string): void {
    try {
      const proposal = this.activeProposals.get(proposalId);
      
      if (!proposal) {
        return;
      }
      
      // Calculate voting statistics
      const stats = this.calculateVotingStatistics(proposal);
      
      // Get strategy
      const strategy = this.votingStrategies.get(proposal.votingStrategy);
      
      if (!strategy) {
        this.logger.error('Unknown voting strategy', {
          proposalId,
          strategy: proposal.votingStrategy
        });
        return;
      }
      
      // Check for early consensus
      if (stats.totalVotes > 0 && stats.participationRate >= this.config.minParticipation) {
        const recommendation = strategy.recommend(proposal, stats);
        
        // If high confidence recommendation, finalize early
        if (recommendation.confidence > 0.9) {
          this.finalizeProposal(proposalId, recommendation.vote ? 'achieved' : 'failed');
          return;
        }
      }
      
      // Continue collecting votes
    } catch (error) {
      this.logger.error('Failed to check consensus status', {
        proposalId,
        error
      });
    }
  }

  /**
   * Send voting reminder to agents who haven't voted
   */
  private sendVotingReminder(proposalId: string): void {
    try {
      const proposal = this.activeProposals.get(proposalId);
      
      if (!proposal) {
        return;
      }
      
      // Get all agents who haven't voted
      // This is simplified - in a real implementation, we would track all available agents
      // and send reminders only to those who haven't voted
      
      this.logger.debug('Sending voting reminder', {
        proposalId,
        votesReceived: proposal.votes.size,
        timeRemaining: proposal.deadline ? 
          proposal.deadline.getTime() - Date.now() : 
          'unknown'
      });
      
      // Emit reminder event
      this.eventBus.emit('consensus:voting_reminder', {
        proposalId,
        swarmId: proposal.swarmId,
        taskId: proposal.taskId,
        proposal: proposal.proposal,
        timeRemaining: proposal.deadline ? 
          proposal.deadline.getTime() - Date.now() : 
          'unknown'
      });
    } catch (error) {
      this.logger.error('Failed to send voting reminder', {
        proposalId,
        error
      });
    }
  }

  /**
   * Finalize a proposal
   */
  private finalizeProposal(proposalId: string, outcome: 'achieved' | 'failed' | 'timeout'): void {
    try {
      const proposal = this.activeProposals.get(proposalId);
      
      if (!proposal) {
        return;
      }
      
      // Clear timeouts
      if (proposal.timeoutId) {
        clearTimeout(proposal.timeoutId);
      }
      
      if (proposal.reminderTimeoutId) {
        clearTimeout(proposal.reminderTimeoutId);
      }
      
      // Calculate final statistics
      const stats = this.calculateVotingStatistics(proposal);
      
      // Get strategy
      const strategy = this.votingStrategies.get(proposal.votingStrategy);
      
      if (!strategy) {
        this.logger.error('Unknown voting strategy', {
          proposalId,
          strategy: proposal.votingStrategy
        });
        return;
      }
      
      // If timeout or failed participation, evaluate based on available votes
      const finalOutcome = outcome === 'timeout' && stats.totalVotes > 0 ?
        (strategy.recommend(proposal, stats).vote ? 'achieved' : 'failed') :
        outcome;
      
      // Create result
      const result: ConsensusResult = {
        proposalId,
        achieved: finalOutcome === 'achieved',
        finalRatio: this.config.weightedVoting ? 
          stats.weightedPositive / Math.max(stats.totalWeight, 1) : 
          stats.positiveVotes / Math.max(stats.totalVotes, 1),
        totalVotes: stats.totalVotes,
        positiveVotes: stats.positiveVotes,
        negativeVotes: stats.negativeVotes,
        participationRate: stats.participationRate,
        confidenceScore: stats.avgConfidence,
        finalDecision: finalOutcome === 'achieved' ? proposal.proposal : undefined
      };
      
      // Store result
      proposal.result = result;
      proposal.finalizedAt = Date.now();
      
      // Update metrics
      if (finalOutcome === 'achieved') {
        this.metrics.achievedConsensus++;
      } else {
        this.metrics.failedConsensus++;
      }
      
      this.metrics.avgVotingTime = (this.metrics.avgVotingTime * (this.metrics.totalProposals - 1) +
        (proposal.finalizedAt - proposal.startTime)) / this.metrics.totalProposals;
      
      this.metrics.avgParticipation = (this.metrics.avgParticipation * (this.metrics.totalProposals - 1) +
        stats.participationRate) / this.metrics.totalProposals;
      
      this.metrics.avgConfidence = (this.metrics.avgConfidence * (this.metrics.totalProposals - 1) +
        stats.avgConfidence) / this.metrics.totalProposals;
      
      this.logger.info(`Consensus ${finalOutcome}`, {
        proposalId,
        totalVotes: stats.totalVotes,
        positiveVotes: stats.positiveVotes,
        negativeVotes: stats.negativeVotes,
        participationRate: stats.participationRate.toFixed(2),
        votingTime: proposal.finalizedAt - proposal.startTime
      });
      
      // Move to completed proposals
      this.activeProposals.delete(proposalId);
      this.completedProposals.set(proposalId, proposal);
      
      // Emit consensus event
      this.eventBus.emit(`consensus:${finalOutcome}`, {
        proposalId,
        swarmId: proposal.swarmId,
        taskId: proposal.taskId,
        result
      });
      
      // Emit specific events for task-related proposals
      if (proposal.taskId) {
        this.eventBus.emit(`task:${proposal.taskId}:consensus:${finalOutcome}`, {
          proposalId,
          result
        });
      }
    } catch (error) {
      this.logger.error('Failed to finalize proposal', {
        proposalId,
        outcome,
        error
      });
    }
  }

  /**
   * Calculate voting statistics for a proposal
   */
  private calculateVotingStatistics(proposal: ActiveProposal): {
    totalVotes: number;
    positiveVotes: number;
    negativeVotes: number;
    totalWeight: number;
    weightedPositive: number;
    weightedNegative: number;
    participationRate: number;
    avgConfidence: number;
    highestConfidence: number;
  } {
    // Initialize statistics
    let totalVotes = 0;
    let positiveVotes = 0;
    let negativeVotes = 0;
    let totalWeight = 0;
    let weightedPositive = 0;
    let weightedNegative = 0;
    let totalConfidence = 0;
    let highestConfidence = 0;
    
    // Process votes
    for (const vote of proposal.votes.values()) {
      totalVotes++;
      
      if (vote.vote) {
        positiveVotes++;
      } else {
        negativeVotes++;
      }
      
      // Calculate weighted votes
      const weight = vote.weight || 1.0;
      totalWeight += weight;
      
      if (vote.vote) {
        weightedPositive += weight * (vote.confidence || 1.0);
      } else {
        weightedNegative += weight * (vote.confidence || 1.0);
      }
      
      // Track confidence
      const confidence = vote.confidence || 1.0;
      totalConfidence += confidence;
      highestConfidence = Math.max(highestConfidence, confidence);
    }
    
    // Calculate participation rate - simplified as we don't track total available agents
    const participationRate = totalVotes / Math.max(proposal.participants.size, 1);
    
    // Calculate average confidence
    const avgConfidence = totalConfidence / Math.max(totalVotes, 1);
    
    return {
      totalVotes,
      positiveVotes,
      negativeVotes,
      totalWeight,
      weightedPositive,
      weightedNegative,
      participationRate,
      avgConfidence,
      highestConfidence
    };
  }

  /**
   * Get agent weight for voting
   */
  private getAgentWeight(proposal: ActiveProposal, agentId: string): number {
    // Check if weight exists
    if (proposal.agentWeights.has(agentId)) {
      return proposal.agentWeights.get(agentId)!;
    }
    
    // Default weight is 1.0
    return 1.0;
  }

  /**
   * Update agent weight based on metrics
   */
  private updateAgentWeight(agentId: string, metrics: Record<string, number>): void {
    try {
      // Update weight for active proposals
      for (const proposal of this.activeProposals.values()) {
        let weight = 1.0;
        
        // Apply reputation weighting
        if (this.config.reputationWeighting && metrics.reputation) {
          weight *= 0.5 + metrics.reputation / 2;
        }
        
        // Apply expertise weighting based on task type
        if (this.config.expertiseWeighting && 
            proposal.taskId && 
            metrics.expertise && 
            proposal.metadata?.taskType) {
          
          const taskType = proposal.metadata.taskType as string;
          const expertise = metrics.expertise;
          
          if (taskType && expertise) {
            weight *= 0.7 + (expertise * 0.3);
          }
        }
        
        // Update weight
        proposal.agentWeights.set(agentId, weight);
      }
    } catch (error) {
      this.logger.error('Failed to update agent weight', {
        agentId,
        error
      });
    }
  }

  /**
   * Get proposal by ID
   */
  public getProposal(proposalId: string): ConsensusProposal | undefined {
    // Check active proposals
    const activeProposal = this.activeProposals.get(proposalId);
    if (activeProposal) {
      return {
        id: activeProposal.id,
        swarmId: activeProposal.swarmId,
        taskId: activeProposal.taskId,
        proposal: activeProposal.proposal,
        requiredThreshold: activeProposal.requiredThreshold,
        deadline: activeProposal.deadline,
        votingStrategy: activeProposal.votingStrategy,
        metadata: activeProposal.metadata
      };
    }
    
    // Check completed proposals
    const completedProposal = this.completedProposals.get(proposalId);
    if (completedProposal) {
      return {
        id: completedProposal.id,
        swarmId: completedProposal.swarmId,
        taskId: completedProposal.taskId,
        proposal: completedProposal.proposal,
        requiredThreshold: completedProposal.requiredThreshold,
        deadline: completedProposal.deadline,
        votingStrategy: completedProposal.votingStrategy,
        metadata: completedProposal.metadata
      };
    }
    
    return undefined;
  }

  /**
   * Get votes for a proposal
   */
  public getVotes(proposalId: string): ConsensusVote[] {
    // Check active proposals
    const activeProposal = this.activeProposals.get(proposalId);
    if (activeProposal) {
      return Array.from(activeProposal.votes.values());
    }
    
    // Check completed proposals
    const completedProposal = this.completedProposals.get(proposalId);
    if (completedProposal) {
      return Array.from(completedProposal.votes.values());
    }
    
    return [];
  }

  /**
   * Get consensus result for a proposal
   */
  public getConsensusResult(proposalId: string): ConsensusResult | undefined {
    // Check active proposals (shouldn't have results)
    const activeProposal = this.activeProposals.get(proposalId);
    if (activeProposal && activeProposal.result) {
      return activeProposal.result;
    }
    
    // Check completed proposals
    const completedProposal = this.completedProposals.get(proposalId);
    if (completedProposal && completedProposal.result) {
      return completedProposal.result;
    }
    
    return undefined;
  }

  /**
   * Get active proposals
   */
  public getActiveProposals(): ConsensusProposal[] {
    return Array.from(this.activeProposals.values()).map(p => ({
      id: p.id,
      swarmId: p.swarmId,
      taskId: p.taskId,
      proposal: p.proposal,
      requiredThreshold: p.requiredThreshold,
      deadline: p.deadline,
      votingStrategy: p.votingStrategy,
      metadata: p.metadata
    }));
  }

  /**
   * Get voting statistics for a proposal
   */
  public getProposalStatistics(proposalId: string): any {
    // Check active proposals
    const activeProposal = this.activeProposals.get(proposalId);
    if (activeProposal) {
      return this.calculateVotingStatistics(activeProposal);
    }
    
    // Check completed proposals
    const completedProposal = this.completedProposals.get(proposalId);
    if (completedProposal) {
      return this.calculateVotingStatistics(completedProposal);
    }
    
    return undefined;
  }

  /**
   * Get consensus metrics
   */
  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Reset the consensus engine
   */
  public reset(): void {
    // Clear all proposals
    for (const proposal of this.activeProposals.values()) {
      if (proposal.timeoutId) {
        clearTimeout(proposal.timeoutId);
      }
      
      if (proposal.reminderTimeoutId) {
        clearTimeout(proposal.reminderTimeoutId);
      }
    }
    
    this.activeProposals.clear();
    this.completedProposals.clear();
    
    // Reset metrics
    this.metrics = {
      totalProposals: 0,
      achievedConsensus: 0,
      failedConsensus: 0,
      avgVotingTime: 0,
      avgParticipation: 0,
      avgConfidence: 0
    };
    
    this.logger.info('Consensus engine reset');
  }

  /**
   * Force finalize a proposal
   */
  public forceFinalize(proposalId: string, outcome: 'achieved' | 'failed'): void {
    try {
      const proposal = this.activeProposals.get(proposalId);
      
      if (!proposal) {
        throw new Error('Proposal not found or already completed');
      }
      
      this.finalizeProposal(proposalId, outcome);
      
      this.logger.info('Proposal force finalized', {
        proposalId,
        outcome
      });
    } catch (error) {
      this.logger.error('Failed to force finalize proposal', {
        proposalId,
        error
      });
      throw error;
    }
  }
}

/**
 * Create a consensus engine
 */
export function createConsensusEngine(
  config: Partial<ConsensusEngineConfig> = {}
): ConsensusEngine {
  return new ConsensusEngine(config);
}