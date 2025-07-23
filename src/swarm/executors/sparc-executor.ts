/**
 * SPARC Task Executor
 * Implements the SPARC methodology (Specification, Pseudocode, Architecture, Review, Code)
 * for systematic problem-solving and high-quality code generation
 */

import { EventEmitter } from 'node:events';
import { Logger } from "../../core/logger.js";
import { ClaudeConnectionPool } from "../optimizations/connection-pool.js";
import { AsyncFileManager } from "../optimizations/async-file-manager.js";
import { 
  TaskDefinition, 
  TaskResult, 
  AgentId,
  TaskStatus,
  TaskType,
  TaskPriority
} from "../types.js";

export interface SparcExecutorConfig {
  connectionPool?: {
    min?: number;
    max?: number;
  };
  fileOperations?: {
    outputDir?: string;
    concurrency?: number;
  };
  sparc?: {
    enableAllPhases?: boolean;
    skipPhases?: SparcPhase[];
    phaseTimeout?: number;
    requireReview?: boolean;
    generateTests?: boolean;
  };
  monitoring?: {
    metricsInterval?: number;
    slowTaskThreshold?: number;
  };
}

export type SparcPhase = 
  | 'specification'  // S: Define requirements and constraints
  | 'pseudocode'     // P: Create high-level algorithm
  | 'architecture'   // A: Design system architecture
  | 'review'         // R: Review and validate approach
  | 'code';          // C: Generate final implementation

export interface SparcPhaseResult {
  phase: SparcPhase;
  output: string;
  success: boolean;
  duration: number;
  quality: number;
  completeness: number;
  issues?: string[];
  recommendations?: string[];
}

export interface SparcExecutionResult extends TaskResult {
  sparcPhases: SparcPhaseResult[];
  methodology: {
    phasesCompleted: SparcPhase[];
    totalPhases: number;
    overallQuality: number;
    systemicApproach: boolean;
  };
}

export interface SparcExecutionMetrics {
  totalExecuted: number;
  totalSucceeded: number;
  totalFailed: number;
  avgExecutionTime: number;
  phaseSuccessRates: Record<SparcPhase, number>;
  methodologyCompleteness: number;
  qualityScores: number[];
}

export class SparcExecutor extends EventEmitter {
  private logger: Logger;
  private connectionPool: ClaudeConnectionPool;
  private fileManager: AsyncFileManager;
  private config: SparcExecutorConfig;
  
  private metrics = {
    totalExecuted: 0,
    totalSucceeded: 0,
    totalFailed: 0,
    totalExecutionTime: 0,
    phaseExecutions: new Map<SparcPhase, number>(),
    phaseSuccesses: new Map<SparcPhase, number>(),
    qualityScores: [] as number[]
  };
  
  private readonly sparcPhases: SparcPhase[] = [
    'specification',
    'pseudocode', 
    'architecture',
    'review',
    'code'
  ];
  
  constructor(config: SparcExecutorConfig = {}) {
    super();
    this.config = {
      ...config,
      sparc: {
        enableAllPhases: true,
        skipPhases: [],
        phaseTimeout: 120000, // 2 minutes per phase
        requireReview: true,
        generateTests: true,
        ...config.sparc
      }
    };
    
    this.logger = new Logger(
      { level: 'info', format: 'json', destination: 'console' },
      { component: 'SparcExecutor' }
    );
    
    // Initialize connection pool
    this.connectionPool = new ClaudeConnectionPool({
      min: config.connectionPool?.min || 3,
      max: config.connectionPool?.max || 8
    } as any);
    
    // Initialize file manager
    this.fileManager = new AsyncFileManager({
      write: config.fileOperations?.concurrency || 5,
      read: config.fileOperations?.concurrency || 10
    });
    
    // Initialize phase metrics
    this.sparcPhases.forEach(phase => {
      this.metrics.phaseExecutions.set(phase, 0);
      this.metrics.phaseSuccesses.set(phase, 0);
    });
    
    // Start monitoring if configured
    if (config.monitoring?.metricsInterval) {
      setInterval(() => {
        this.emitMetrics();
      }, config.monitoring.metricsInterval);
    }
  }
  
  /**
   * Execute task using SPARC methodology
   */
  async executeTaskSparc(task: TaskDefinition, agentId: AgentId): Promise<SparcExecutionResult> {
    const startTime = Date.now();
    const executionId = `sparc-${task.id.id}-${Date.now()}`;
    
    this.logger.info('Starting SPARC task execution', {
      taskId: task.id.id,
      agentId: agentId.id,
      executionId,
      methodology: 'SPARC'
    });
    
    this.metrics.totalExecuted++;
    
    try {
      // Execute SPARC phases
      const phaseResults = await this.executeSparcPhases(task, agentId, executionId);
      
      // Compile final result
      const finalResult = await this.compileFinalResult(task, agentId, phaseResults, startTime);
      
      // Calculate overall quality
      const overallQuality = this.calculateOverallQuality(phaseResults);
      this.metrics.qualityScores.push(overallQuality);
      
      this.metrics.totalSucceeded++;
      this.metrics.totalExecutionTime += Date.now() - startTime;
      
      this.logger.info('SPARC task execution completed successfully', {
        taskId: task.id.id,
        agentId: agentId.id,
        executionTime: Date.now() - startTime,
        phasesCompleted: phaseResults.length,
        overallQuality,
        executionId
      });
      
      const sparcResult: SparcExecutionResult = {
        ...finalResult,
        sparcPhases: phaseResults,
        methodology: {
          phasesCompleted: phaseResults.map(r => r.phase),
          totalPhases: this.getEnabledPhases().length,
          overallQuality,
          systemicApproach: phaseResults.length >= 4 // Systemic if at least 4 phases
        }
      };
      
      this.emit('task:completed', sparcResult);
      return sparcResult;
      
    } catch (error) {
      this.metrics.totalFailed++;
      
      const errorResult = await this.createSparcErrorResult(task, agentId, error, startTime);
      
      this.logger.error('SPARC task execution failed', {
        taskId: task.id.id,
        agentId: agentId.id,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        executionId
      });
      
      this.emit('task:failed', errorResult);
      return errorResult;
    }
  }
  
  /**
   * Execute all SPARC phases sequentially
   */
  private async executeSparcPhases(
    task: TaskDefinition, 
    agentId: AgentId, 
    executionId: string
  ): Promise<SparcPhaseResult[]> {
    const phaseResults: SparcPhaseResult[] = [];
    const enabledPhases = this.getEnabledPhases();
    
    let previousPhaseOutput = '';
    
    for (const phase of enabledPhases) {
      this.logger.debug(`Executing SPARC phase: ${phase}`, {
        taskId: task.id.id,
        phase,
        executionId
      });
      
      const phaseResult = await this.executeSparcPhase(
        phase,
        task,
        agentId,
        previousPhaseOutput,
        phaseResults
      );
      
      phaseResults.push(phaseResult);
      
      if (phaseResult.success) {
        previousPhaseOutput += `\n\n### ${phase.toUpperCase()} PHASE RESULT:\n${phaseResult.output}`;
      } else {
        this.logger.warn(`SPARC phase failed: ${phase}`, {
          taskId: task.id.id,
          phase,
          issues: phaseResult.issues
        });
        
        // Continue with other phases even if one fails
      }
    }
    
    return phaseResults;
  }
  
  /**
   * Execute a single SPARC phase
   */
  private async executeSparcPhase(
    phase: SparcPhase,
    task: TaskDefinition,
    agentId: AgentId,
    previousOutput: string,
    previousResults: SparcPhaseResult[]
  ): Promise<SparcPhaseResult> {
    const startTime = Date.now();
    
    this.metrics.phaseExecutions.set(
      phase,
      (this.metrics.phaseExecutions.get(phase) || 0) + 1
    );
    
    try {
      const phasePrompt = this.buildPhasePrompt(phase, task, previousOutput, previousResults);
      
      const result = await Promise.race([
        this.connectionPool.execute(async (api) => {
          const response = await (api as any).messages.create({
            messages: [
              {
                role: 'system',
                content: this.getPhaseSystemPrompt(phase)
              },
              {
                role: 'user',
                content: phasePrompt
              }
            ],
            model: (task.context as any)?.model || 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            temperature: phase === 'code' ? 0.1 : 0.3 // Lower temperature for code generation
          });
          
          return response.content[0]?.text || '';
        }),
        this.createPhaseTimeoutPromise(phase)
      ]);
      
      // Evaluate phase quality
      const quality = await this.evaluatePhaseQuality(phase, result, task);
      const completeness = await this.evaluatePhaseCompleteness(phase, result, task);
      
      const phaseResult: SparcPhaseResult = {
        phase,
        output: result,
        success: true,
        duration: Date.now() - startTime,
        quality,
        completeness,
        issues: [],
        recommendations: []
      };
      
      // Analyze for issues and recommendations
      await this.analyzePhaseResult(phaseResult, task);
      
      this.metrics.phaseSuccesses.set(
        phase,
        (this.metrics.phaseSuccesses.get(phase) || 0) + 1
      );
      
      return phaseResult;
      
    } catch (error) {
      return {
        phase,
        output: '',
        success: false,
        duration: Date.now() - startTime,
        quality: 0,
        completeness: 0,
        issues: [error instanceof Error ? error.message : String(error)],
        recommendations: [`Retry ${phase} phase with different approach`]
      };
    }
  }
  
  /**
   * Build prompt for specific SPARC phase
   */
  private buildPhasePrompt(
    phase: SparcPhase,
    task: TaskDefinition,
    previousOutput: string,
    previousResults: SparcPhaseResult[]
  ): string {
    const basePrompt = `Task: ${task.instructions}\n\nContext: ${JSON.stringify(task.context || {}, null, 2)}`;
    
    switch (phase) {
      case 'specification':
        return `${basePrompt}\n\nPlease create a detailed specification for this task including:
1. Clear requirements and constraints
2. Input/output definitions
3. Success criteria
4. Edge cases to consider
5. Performance requirements`;
        
      case 'pseudocode':
        return `${basePrompt}\n\nPrevious work:\n${previousOutput}\n\nPlease create detailed pseudocode for this task including:
1. Main algorithm flow
2. Key functions and their purposes
3. Data structures needed
4. Error handling approach
5. Step-by-step logic`;
        
      case 'architecture':
        return `${basePrompt}\n\nPrevious work:\n${previousOutput}\n\nPlease design the architecture including:
1. System components and their responsibilities
2. Data flow and interactions
3. Interface definitions
4. Module organization
5. Integration points`;
        
      case 'review':
        return `${basePrompt}\n\nPrevious work:\n${previousOutput}\n\nPlease review the approach and provide:
1. Analysis of the specification completeness
2. Evaluation of the pseudocode logic
3. Assessment of the architecture design
4. Identification of potential issues
5. Recommendations for improvements`;
        
      case 'code':
        return `${basePrompt}\n\nPrevious work:\n${previousOutput}\n\nPlease generate the final implementation including:
1. Complete, working code
2. Proper error handling
3. Documentation and comments
4. Unit tests (if applicable)
5. Usage examples`;
        
      default:
        return basePrompt;
    }
  }
  
  /**
   * Get system prompt for specific phase
   */
  private getPhaseSystemPrompt(phase: SparcPhase): string {
    const basePrompt = "You are an expert software engineer using the SPARC methodology.";
    
    switch (phase) {
      case 'specification':
        return `${basePrompt} Focus on creating clear, complete specifications that eliminate ambiguity.`;
      case 'pseudocode':
        return `${basePrompt} Focus on creating clear, logical pseudocode that serves as a blueprint for implementation.`;
      case 'architecture':
        return `${basePrompt} Focus on designing robust, scalable architecture that supports the requirements.`;
      case 'review':
        return `${basePrompt} Focus on critical analysis and constructive feedback to improve the solution.`;
      case 'code':
        return `${basePrompt} Focus on generating clean, efficient, well-documented code that implements the design.`;
      default:
        return basePrompt;
    }
  }
  
  /**
   * Create timeout promise for phase execution
   */
  private createPhaseTimeoutPromise(phase: SparcPhase): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`SPARC phase timeout: ${phase}`));
      }, this.config.sparc?.phaseTimeout || 120000);
    });
  }
  
  /**
   * Evaluate phase quality (0-1 score)
   */
  private async evaluatePhaseQuality(phase: SparcPhase, output: string, task: TaskDefinition): Promise<number> {
    // Simple heuristic-based quality evaluation
    // In a real implementation, this could use ML models or more sophisticated analysis
    
    const length = output.length;
    const hasStructure = output.includes('\n') && (output.includes('1.') || output.includes('-'));
    const hasDetails = length > 200;
    const phaseKeywords = this.getPhaseKeywords(phase);
    const hasKeywords = phaseKeywords.some(keyword => 
      output.toLowerCase().includes(keyword.toLowerCase())
    );
    
    let score = 0.5; // Base score
    
    if (hasStructure) score += 0.2;
    if (hasDetails) score += 0.2;
    if (hasKeywords) score += 0.1;
    
    return Math.min(1.0, score);
  }
  
  /**
   * Evaluate phase completeness (0-1 score)
   */
  private async evaluatePhaseCompleteness(phase: SparcPhase, output: string, task: TaskDefinition): Promise<number> {
    const requiredElements = this.getPhaseRequiredElements(phase);
    const presentElements = requiredElements.filter(element =>
      output.toLowerCase().includes(element.toLowerCase())
    );
    
    return presentElements.length / requiredElements.length;
  }
  
  /**
   * Get keywords expected for each phase
   */
  private getPhaseKeywords(phase: SparcPhase): string[] {
    switch (phase) {
      case 'specification':
        return ['requirements', 'constraints', 'input', 'output', 'criteria'];
      case 'pseudocode':
        return ['algorithm', 'function', 'loop', 'if', 'return'];
      case 'architecture':
        return ['component', 'module', 'interface', 'design', 'structure'];
      case 'review':
        return ['analysis', 'evaluation', 'issues', 'recommendations', 'improvement'];
      case 'code':
        return ['function', 'class', 'variable', 'return', 'import'];
      default:
        return [];
    }
  }
  
  /**
   * Get required elements for each phase
   */
  private getPhaseRequiredElements(phase: SparcPhase): string[] {
    switch (phase) {
      case 'specification':
        return ['requirements', 'constraints', 'success criteria'];
      case 'pseudocode':
        return ['algorithm', 'functions', 'logic'];
      case 'architecture':
        return ['components', 'interactions', 'interfaces'];
      case 'review':
        return ['analysis', 'recommendations'];
      case 'code':
        return ['implementation', 'functions', 'documentation'];
      default:
        return [];
    }
  }
  
  /**
   * Analyze phase result for issues and recommendations
   */
  private async analyzePhaseResult(result: SparcPhaseResult, task: TaskDefinition): Promise<void> {
    // Basic analysis - could be enhanced with ML models
    if (result.quality < 0.6) {
      result.issues?.push(`Low quality score (${result.quality.toFixed(2)}) for ${result.phase} phase`);
    }
    
    if (result.completeness < 0.7) {
      result.issues?.push(`Incomplete coverage (${result.completeness.toFixed(2)}) for ${result.phase} phase`);
    }
    
    if (result.output.length < 100) {
      result.issues?.push(`Output too brief for ${result.phase} phase`);
      result.recommendations?.push(`Provide more detailed ${result.phase} information`);
    }
  }
  
  /**
   * Get enabled phases based on configuration
   */
  private getEnabledPhases(): SparcPhase[] {
    if (!this.config.sparc?.enableAllPhases) {
      return ['specification', 'code']; // Minimal SPARC
    }
    
    const skipPhases = this.config.sparc?.skipPhases || [];
    return this.sparcPhases.filter(phase => !skipPhases.includes(phase));
  }
  
  /**
   * Calculate overall quality from phase results
   */
  private calculateOverallQuality(phaseResults: SparcPhaseResult[]): number {
    if (phaseResults.length === 0) return 0;
    
    const totalQuality = phaseResults.reduce((sum, result) => sum + result.quality, 0);
    const avgQuality = totalQuality / phaseResults.length;
    
    // Bonus for completeness
    const completenessBonus = phaseResults.length >= 4 ? 0.1 : 0;
    
    return Math.min(1.0, avgQuality + completenessBonus);
  }
  
  /**
   * Compile final result from all phases
   */
  private async compileFinalResult(
    task: TaskDefinition,
    agentId: AgentId,
    phaseResults: SparcPhaseResult[],
    startTime: number
  ): Promise<TaskResult> {
    // Get the final code from the code phase, or compile from all phases
    const codePhase = phaseResults.find(r => r.phase === 'code');
    const finalOutput = codePhase?.output || this.compilePhasesOutput(phaseResults);
    
    // Save detailed SPARC results if configured
    if (this.config.fileOperations?.outputDir) {
      const sparcPath = `${this.config.fileOperations.outputDir}/${task.id.id}-sparc.json`;
      await this.fileManager.writeJSON(sparcPath, {
        taskId: task.id.id,
        agentId: agentId.id,
        methodology: 'SPARC',
        phases: phaseResults,
        timestamp: new Date()
      });
    }
    
    return {
      output: finalOutput,
      artifacts: {
        sparc_phases: phaseResults.reduce((acc, result) => {
          acc[result.phase] = result.output;
          return acc;
        }, {} as Record<string, string>)
      },
      metadata: {
        taskId: task.id.id,
        agentId: agentId.id,
        success: phaseResults.some(r => r.success),
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
        methodology: 'SPARC'
      },
      quality: this.calculateOverallQuality(phaseResults),
      completeness: phaseResults.length / this.getEnabledPhases().length,
      accuracy: phaseResults.filter(r => r.success).length / phaseResults.length,
      executionTime: Date.now() - startTime,
      resourcesUsed: {
        cpu: 0,
        memory: 0,
        tokens: 0 // Would be calculated from API usage
      },
      validated: phaseResults.some(r => r.phase === 'review' && r.success)
    };
  }
  
  /**
   * Compile output from all phases
   */
  private compilePhasesOutput(phaseResults: SparcPhaseResult[]): string {
    return phaseResults
      .filter(r => r.success)
      .map(r => `## ${r.phase.toUpperCase()} PHASE\n\n${r.output}`)
      .join('\n\n---\n\n');
  }
  
  /**
   * Create error result for SPARC execution
   */
  private async createSparcErrorResult(
    task: TaskDefinition,
    agentId: AgentId,
    error: any,
    startTime: number
  ): Promise<SparcExecutionResult> {
    const baseResult = {
      output: '',
      artifacts: {},
      metadata: {
        taskId: task.id.id,
        agentId: agentId.id,
        success: false,
        error: {
          type: error instanceof Error ? error.constructor.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
          context: { methodology: 'SPARC' },
          recoverable: true,
          retryable: true
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
        methodology: 'SPARC'
      },
      quality: 0,
      completeness: 0,
      accuracy: 0,
      executionTime: Date.now() - startTime,
      resourcesUsed: { cpu: 0, memory: 0, tokens: 0 },
      validated: false
    };
    
    return {
      ...baseResult,
      sparcPhases: [],
      methodology: {
        phasesCompleted: [],
        totalPhases: this.getEnabledPhases().length,
        overallQuality: 0,
        systemicApproach: false
      }
    };
  }
  
  /**
   * Get execution metrics
   */
  getMetrics(): SparcExecutionMetrics {
    const totalTasks = this.metrics.totalExecuted || 1;
    
    const phaseSuccessRates: Record<SparcPhase, number> = {} as any;
    this.sparcPhases.forEach(phase => {
      const executions = this.metrics.phaseExecutions.get(phase) || 0;
      const successes = this.metrics.phaseSuccesses.get(phase) || 0;
      phaseSuccessRates[phase] = executions > 0 ? successes / executions : 0;
    });
    
    const avgMethodologyCompleteness = this.metrics.qualityScores.length > 0
      ? this.metrics.qualityScores.reduce((sum, score) => sum + score, 0) / this.metrics.qualityScores.length
      : 0;
    
    return {
      totalExecuted: this.metrics.totalExecuted,
      totalSucceeded: this.metrics.totalSucceeded,
      totalFailed: this.metrics.totalFailed,
      avgExecutionTime: this.metrics.totalExecutionTime / totalTasks,
      phaseSuccessRates,
      methodologyCompleteness: avgMethodologyCompleteness,
      qualityScores: [...this.metrics.qualityScores]
    };
  }
  
  /**
   * Emit metrics event
   */
  private emitMetrics(): void {
    const metrics = this.getMetrics();
    this.emit('metrics', metrics);
    this.logger.debug('SPARC executor metrics', metrics);
  }
  
  /**
   * Shutdown executor gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down SparcExecutor');
    this.emit('shutdown');
  }
} 