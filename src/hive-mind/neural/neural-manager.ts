import { PatternRecognizer, PatternRecognitionConfig } from './pattern-recognizer.js';
import { DatabaseManager } from '../database/database-manager.js';
import { EventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { PatternType, NeuralPattern, PatternMatch, CognitiveModel } from '../types.js';

export interface NeuralManagerConfig {
  enableWASM: boolean;
  learningRate: number;
  confidenceThreshold: number;
  maxPatterns: number;
  adaptiveThreshold: boolean;
  optimizationInterval: number;
  patternBufferSize: number;
  customModels: CognitiveModel[];
}

export class NeuralManager {
  private patternRecognizer: PatternRecognizer;
  private db: DatabaseManager;
  private eventBus: EventBus;
  private logger: Logger;
  private config: NeuralManagerConfig;
  private optimizationTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(
    db: DatabaseManager,
    eventBus: EventBus,
    config: NeuralManagerConfig
  ) {
    this.db = db;
    this.eventBus = eventBus;
    this.config = config;
    this.logger = new Logger({
      level: 'info',
      format: 'json',
      destination: 'console'
    }, { component: 'NeuralManager' });

    // Create pattern recognizer with configuration
    const patternConfig: PatternRecognitionConfig = {
      learningRate: config.learningRate,
      confidenceThreshold: config.confidenceThreshold,
      maxPatterns: config.maxPatterns,
      adaptiveThreshold: config.adaptiveThreshold,
      enableWASM: config.enableWASM,
      useTensorFlow: false,
      cognitiveModels: config.customModels
    };

    this.patternRecognizer = new PatternRecognizer(db, eventBus, patternConfig);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing Neural Manager');

      // Initialize WASM if enabled
      if (this.config.enableWASM) {
        await this.patternRecognizer.initializeWASM();
      }

      // Set up optimization timer
      if (this.config.optimizationInterval > 0) {
        this.optimizationTimer = setInterval(
          () => this.runOptimization(),
          this.config.optimizationInterval
        );
      }

      // Set up event listeners for neural events
      this.setupNeuralEventListeners();

      this.isInitialized = true;
      this.logger.info('Neural Manager initialized successfully');

      this.eventBus.emit('neural:initialized', {
        enableWASM: this.config.enableWASM,
        modelsCount: this.config.customModels.length,
        confidenceThreshold: this.config.confidenceThreshold
      });

    } catch (error) {
      this.logger.error('Failed to initialize Neural Manager:', error);
      throw error;
    }
  }

  private setupNeuralEventListeners(): void {
    // Listen for hive-mind events to trigger learning
    this.eventBus.on('hive:task:completed', (data) => {
      this.handleTaskCompletion(data);
    });

    this.eventBus.on('hive:agent:communication', (data) => {
      this.handleAgentCommunication(data);
    });

    this.eventBus.on('hive:consensus:achieved', (data) => {
      this.handleConsensusAchieved(data);
    });

    this.eventBus.on('hive:performance:metric', (data) => {
      this.handlePerformanceMetric(data);
    });

    // Listen for pattern recognition requests
    this.eventBus.on('neural:recognize:request', (data) => {
      this.handlePatternRecognitionRequest(data);
    });

    // Listen for pattern learning events
    this.eventBus.on('pattern:learned', (data) => {
      this.handlePatternLearned(data);
    });
  }

  private async handleTaskCompletion(data: any): Promise<void> {
    try {
      await this.patternRecognizer.learnFromTask(data);
      this.logger.debug('Processed task completion for neural learning', { taskId: data.taskId });
    } catch (error) {
      this.logger.error('Failed to process task completion:', error);
    }
  }

  private async handleAgentCommunication(data: any): Promise<void> {
    try {
      await this.patternRecognizer.learnFromCommunication(data);
      this.logger.debug('Processed agent communication for neural learning', { messageType: data.messageType });
    } catch (error) {
      this.logger.error('Failed to process agent communication:', error);
    }
  }

  private async handleConsensusAchieved(data: any): Promise<void> {
    try {
      await this.patternRecognizer.learnFromConsensus(data);
      this.logger.debug('Processed consensus achievement for neural learning', { consensusId: data.consensusId });
    } catch (error) {
      this.logger.error('Failed to process consensus achievement:', error);
    }
  }

  private async handlePerformanceMetric(data: any): Promise<void> {
    try {
      await this.patternRecognizer.learnFromMetric(data);
      this.logger.debug('Processed performance metric for neural learning', { metricType: data.metricType });
    } catch (error) {
      this.logger.error('Failed to process performance metric:', error);
    }
  }

  private async handlePatternRecognitionRequest(data: any): Promise<void> {
    try {
      const { swarmId, inputData, patternType, requestId } = data;
      
      const matches = await this.patternRecognizer.recognizePattern(
        swarmId,
        inputData,
        patternType
      );

      // Emit response
      this.eventBus.emit('neural:recognize:response', {
        requestId,
        matches,
        processingTime: Date.now() - data.timestamp
      });

      this.logger.debug('Processed pattern recognition request', {
        requestId,
        matchesFound: matches.length,
        patternType
      });

    } catch (error) {
      this.logger.error('Failed to process pattern recognition request:', error);
      
      // Emit error response
      this.eventBus.emit('neural:recognize:error', {
        requestId: data.requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private handlePatternLearned(data: any): void {
    this.logger.info('New pattern learned', {
      swarmId: data.swarmId,
      patternId: data.patternId,
      patternType: data.patternType,
      confidence: data.confidence
    });

    // Emit to hive-mind for potential strategy updates
    this.eventBus.emit('hive:pattern:learned', data);
  }

  async recognizePattern(
    swarmId: string,
    inputData: any,
    patternType: PatternType
  ): Promise<PatternMatch[]> {
    if (!this.isInitialized) {
      throw new Error('Neural Manager not initialized');
    }

    return await this.patternRecognizer.recognizePattern(swarmId, inputData, patternType);
  }

  async getPatternsByType(swarmId: string, patternType: PatternType): Promise<NeuralPattern[]> {
    if (!this.isInitialized) {
      throw new Error('Neural Manager not initialized');
    }

    return await this.patternRecognizer.getPatternsByType(swarmId, patternType);
  }

  async getPatternById(patternId: string): Promise<NeuralPattern | null> {
    if (!this.isInitialized) {
      throw new Error('Neural Manager not initialized');
    }

    return await this.patternRecognizer.getPatternById(patternId);
  }

  async updatePatternUsage(patternId: string, success: boolean): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Neural Manager not initialized');
    }

    await this.patternRecognizer.updatePatternUsage(patternId, success);
  }

  async optimizePatterns(swarmId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Neural Manager not initialized');
    }

    await this.patternRecognizer.optimizePatterns(swarmId);
    this.logger.info('Pattern optimization completed', { swarmId });
  }

  private async runOptimization(): Promise<void> {
    try {
      // Get all active swarms
      const swarms = await this.db.listSwarms();
      
      for (const swarm of swarms) {
        if (swarm.is_active) {
          await this.optimizePatterns(swarm.id);
        }
      }

      this.logger.debug('Scheduled pattern optimization completed');
    } catch (error) {
      this.logger.error('Failed to run scheduled optimization:', error);
    }
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      config: this.config,
      patternRecognizer: this.patternRecognizer.getStatus(),
      optimizationTimerActive: !!this.optimizationTimer
    };
  }

  async getSwarmNeuralStats(swarmId: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Neural Manager not initialized');
    }

    try {
      const patterns = await this.db.getNeuralPatterns(swarmId);
      
      const stats = {
        totalPatterns: patterns.length,
        patternsByType: {} as Record<PatternType, number>,
        averageConfidence: 0,
        averageSuccessRate: 0,
        totalUsage: 0,
        mostUsedPattern: null as NeuralPattern | null,
        newestPattern: null as NeuralPattern | null,
        oldestPattern: null as NeuralPattern | null
      };

      if (patterns.length === 0) {
        return stats;
      }

      // Calculate statistics
      let totalConfidence = 0;
      let totalSuccessRate = 0;
      let totalUsage = 0;
      let mostUsed = patterns[0];
      let newest = patterns[0];
      let oldest = patterns[0];

      patterns.forEach(pattern => {
        // Count by type
        stats.patternsByType[pattern.pattern_type] = 
          (stats.patternsByType[pattern.pattern_type] || 0) + 1;

        // Sum for averages
        totalConfidence += pattern.confidence;
        totalSuccessRate += pattern.success_rate;
        totalUsage += pattern.usage_count;

        // Find extremes
        if (pattern.usage_count > mostUsed.usage_count) {
          mostUsed = pattern;
        }
        if (pattern.created_at > newest.created_at) {
          newest = pattern;
        }
        if (pattern.created_at < oldest.created_at) {
          oldest = pattern;
        }
      });

      stats.averageConfidence = totalConfidence / patterns.length;
      stats.averageSuccessRate = totalSuccessRate / patterns.length;
      stats.totalUsage = totalUsage;
      stats.mostUsedPattern = mostUsed;
      stats.newestPattern = newest;
      stats.oldestPattern = oldest;

      return stats;
    } catch (error) {
      this.logger.error('Failed to get neural stats:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = undefined;
    }

    this.isInitialized = false;
    this.logger.info('Neural Manager shutdown completed');
  }
} 