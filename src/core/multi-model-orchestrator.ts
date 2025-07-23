/**
 * Multi-Model Orchestrator
 * Intelligent model selection and task routing between Claude and Gemini
 */

import { EventBus } from './event-bus.js';
import { Logger } from './logger.js';

// Supported AI model providers
export type ModelProvider = 'claude' | 'gemini' | 'auto';

// Task types that the orchestrator can handle
export type TaskType = 
  | 'code_generation' 
  | 'code_explanation' 
  | 'code_review' 
  | 'research' 
  | 'data_analysis'
  | 'architecture_design'
  | 'debugging'
  | 'testing'
  | 'documentation'
  | 'creative';

// Task specification for the multi-model orchestrator
export interface ModelTask {
  type: TaskType;
  prompt: string;
  preferredProvider?: ModelProvider;
  context?: Record<string, any>;
  priority?: 'high' | 'medium' | 'low';
  timeout?: number;
  retryCount?: number;
  fallbackProvider?: ModelProvider;
}

// Result from model execution
export interface ModelResult {
  provider: ModelProvider;
  model: string;
  result: string;
  executionTime: number;
  tokens?: {
    input: number;
    output: number;
  };
  success: boolean;
  error?: string;
}

// Configuration for the multi-model orchestrator
export interface MultiModelOrchestratorConfig {
  defaultProvider: ModelProvider;
  providers: {
    claude: {
      enabled: boolean;
      defaultModel: string;
      apiKey?: string;
      models?: string[];
    };
    gemini: {
      enabled: boolean;
      defaultModel: string;
      models?: string[];
    };
  };
  taskPreferences?: Partial<Record<TaskType, ModelProvider>>;
  enableFallbacks?: boolean;
  metricTracking?: boolean;
}

// Default task routing preferences based on model strengths
const DEFAULT_TASK_PREFERENCES: Record<TaskType, ModelProvider> = {
  code_generation: 'claude',
  code_explanation: 'claude',
  code_review: 'claude',
  research: 'gemini',
  data_analysis: 'gemini',
  architecture_design: 'claude',
  debugging: 'claude',
  testing: 'claude',
  documentation: 'claude',
  creative: 'gemini'
};

/**
 * Multi-Model Orchestrator for intelligent task routing between Claude and Gemini
 */
export class MultiModelOrchestrator {
  private readonly logger: Logger;
  private readonly eventBus: EventBus;
  private readonly config: MultiModelOrchestratorConfig;
  private readonly taskPreferences: Record<TaskType, ModelProvider>;
  private modelAvailability: Map<ModelProvider, boolean> = new Map();
  private metrics: {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    averageExecutionTime: number;
    tasksByProvider: Record<ModelProvider, number>;
    successRateByProvider: Record<ModelProvider, number>;
    fallbacks: number;
  };

  /**
   * Create a new multi-model orchestrator
   */
  constructor(config: MultiModelOrchestratorConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.eventBus = EventBus.getInstance();
    
    // Initialize task preferences with defaults and override with config
    this.taskPreferences = {
      ...DEFAULT_TASK_PREFERENCES,
      ...config.taskPreferences
    };

    // Initialize metrics
    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      tasksByProvider: { claude: 0, gemini: 0, auto: 0 },
      successRateByProvider: { claude: 0, gemini: 0, auto: 0 },
      fallbacks: 0
    };

    // Initial availability check
    this.modelAvailability.set('claude', config.providers.claude.enabled);
    this.modelAvailability.set('gemini', config.providers.gemini.enabled);
    
    // Listen for model execution events to update metrics
    this.eventBus.on('claude:execution:completed', this.handleClaudeSuccess.bind(this));
    this.eventBus.on('claude:execution:failed', this.handleClaudeFailure.bind(this));
    this.eventBus.on('gemini:execution:completed', this.handleGeminiSuccess.bind(this));
    this.eventBus.on('gemini:execution:failed', this.handleGeminiFailure.bind(this));
    
    this.logger.info('Multi-Model Orchestrator initialized', { 
      claude: config.providers.claude.enabled, 
      gemini: config.providers.gemini.enabled 
    });
  }

  /**
   * Determine the best model provider for a specific task
   */
  selectProvider(task: ModelTask): ModelProvider {
    // Honor explicit provider preference if specified
    if (task.preferredProvider && task.preferredProvider !== 'auto') {
      if (this.isProviderAvailable(task.preferredProvider)) {
        return task.preferredProvider;
      } else if (task.fallbackProvider && this.isProviderAvailable(task.fallbackProvider)) {
        this.logger.warn(`Preferred provider ${task.preferredProvider} not available, falling back to ${task.fallbackProvider}`);
        return task.fallbackProvider;
      }
    }
    
    // Use task-specific provider preference if available
    const preferredProvider = this.taskPreferences[task.type];
    if (preferredProvider && this.isProviderAvailable(preferredProvider)) {
      return preferredProvider;
    }
    
    // Fall back to default provider if specified task type preference isn't available
    if (this.isProviderAvailable(this.config.defaultProvider)) {
      return this.config.defaultProvider;
    }
    
    // Last resort: use any available provider
    if (this.isProviderAvailable('claude')) return 'claude';
    if (this.isProviderAvailable('gemini')) return 'gemini';
    
    throw new Error('No AI providers available');
  }

  /**
   * Check if a provider is available
   */
  private isProviderAvailable(provider: ModelProvider): boolean {
    if (provider === 'auto') return true;
    return this.modelAvailability.get(provider) ?? false;
  }

  /**
   * Execute a task with the appropriate model
   */
  async executeTask(task: ModelTask): Promise<ModelResult> {
    this.metrics.totalTasks++;
    
    try {
      const provider = task.preferredProvider === 'auto' 
        ? this.selectProvider(task)
        : this.selectProvider(task);
      
      this.metrics.tasksByProvider[provider]++;
      this.logger.info(`Executing task with ${provider}`, { taskType: task.type });
      
      const startTime = Date.now();
      let result: string;
      
      if (provider === 'claude') {
        result = await this.executeWithClaude(task);
      } else if (provider === 'gemini') {
        result = await this.executeWithGemini(task);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Update metrics
      this.metrics.successfulTasks++;
      this.updateAverageExecutionTime(executionTime);
      this.updateSuccessRates();
      
      return {
        provider,
        model: provider === 'claude' 
          ? this.config.providers.claude.defaultModel 
          : this.config.providers.gemini.defaultModel,
        result,
        executionTime,
        success: true
      };
    } catch (error) {
      this.metrics.failedTasks++;
      this.logger.error('Task execution failed', { error, taskType: task.type });
      
      // Try fallback if enabled
      if (this.config.enableFallbacks && task.fallbackProvider) {
        try {
          this.metrics.fallbacks++;
          this.logger.info(`Attempting fallback to ${task.fallbackProvider}`);
          
          const fallbackTask: ModelTask = {
            ...task,
            preferredProvider: task.fallbackProvider,
            fallbackProvider: undefined // Prevent infinite recursion
          };
          
          return await this.executeTask(fallbackTask);
        } catch (fallbackError) {
          this.logger.error('Fallback execution also failed', { fallbackError });
        }
      }
      
      return {
        provider: task.preferredProvider || 'auto',
        model: 'unknown',
        result: '',
        executionTime: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute a task with Claude
   */
  private async executeWithClaude(task: ModelTask): Promise<string> {
    // In a real implementation, this would use the Claude API or CLI
    // This is a placeholder for the actual implementation
    return new Promise((resolve, reject) => {
      this.eventBus.emit('claude:execution:request', {
        prompt: task.prompt,
        model: this.config.providers.claude.defaultModel,
        context: task.context
      });
      
      // Set up a one-time listener for the response
      const responseHandler = (data: any) => {
        resolve(data.result);
        this.eventBus.off('claude:execution:response', responseHandler);
      };
      
      const errorHandler = (data: any) => {
        reject(new Error(data.error || 'Claude execution failed'));
        this.eventBus.off('claude:execution:error', errorHandler);
      };
      
      this.eventBus.once('claude:execution:response', responseHandler);
      this.eventBus.once('claude:execution:error', errorHandler);
      
      // Set timeout if specified
      if (task.timeout) {
        setTimeout(() => {
                  this.eventBus.off('claude:execution:response', responseHandler);
        this.eventBus.off('claude:execution:error', errorHandler);
          reject(new Error('Claude execution timed out'));
        }, task.timeout);
      }
    });
  }

  /**
   * Execute a task with Gemini
   */
  private async executeWithGemini(task: ModelTask): Promise<string> {
    // In a real implementation, this would use the Gemini CLI
    // This is a placeholder for the actual implementation
    return new Promise((resolve, reject) => {
      this.eventBus.emit('gemini:execution:request', {
        prompt: task.prompt,
        model: this.config.providers.gemini.defaultModel,
        context: task.context
      });
      
      // Set up a one-time listener for the response
      const responseHandler = (data: any) => {
        resolve(data.result);
        this.eventBus.off('gemini:execution:response', responseHandler);
      };
      
      const errorHandler = (data: any) => {
        reject(new Error(data.error || 'Gemini execution failed'));
        this.eventBus.off('gemini:execution:error', errorHandler);
      };
      
      this.eventBus.once('gemini:execution:response', responseHandler);
      this.eventBus.once('gemini:execution:error', errorHandler);
      
      // Set timeout if specified
      if (task.timeout) {
        setTimeout(() => {
          this.eventBus.off('gemini:execution:response', responseHandler);
          this.eventBus.off('gemini:execution:error', errorHandler);
          reject(new Error('Gemini execution timed out'));
        }, task.timeout);
      }
    });
  }

  /**
   * Check model availability
   */
  async checkProviderAvailability(): Promise<Map<ModelProvider, boolean>> {
    try {
      // Check Claude availability
      const claudeAvailable = await this.checkClaudeAvailability();
      this.modelAvailability.set('claude', claudeAvailable && this.config.providers.claude.enabled);
      
      // Check Gemini availability
      const geminiAvailable = await this.checkGeminiAvailability();
      this.modelAvailability.set('gemini', geminiAvailable && this.config.providers.gemini.enabled);
      
      this.logger.info('Provider availability updated', {
        claude: this.modelAvailability.get('claude'),
        gemini: this.modelAvailability.get('gemini')
      });
      
      return this.modelAvailability;
    } catch (error) {
      this.logger.error('Error checking provider availability', { error });
      return this.modelAvailability;
    }
  }

  /**
   * Check Claude availability
   */
  private async checkClaudeAvailability(): Promise<boolean> {
    // In a real implementation, this would check if Claude is available
    // This is a placeholder for the actual implementation
    return true;
  }

  /**
   * Check Gemini availability
   */
  private async checkGeminiAvailability(): Promise<boolean> {
    try {
      // Emit an event to check Gemini availability
      this.eventBus.emit('gemini:availability:check');
      
      return new Promise((resolve) => {
        const handler = (data: { available: boolean }) => {
          resolve(data.available);
          this.eventBus.off('gemini:availability:result', handler);
        };
        
        this.eventBus.once('gemini:availability:result', handler);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          this.eventBus.off('gemini:availability:result', handler);
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      this.logger.error('Error checking Gemini availability', { error });
      return false;
    }
  }

  /**
   * Handle successful Claude execution
   */
  private handleClaudeSuccess(data: any): void {
    if (this.config.metricTracking) {
      this.metrics.successfulTasks++;
      this.updateSuccessRates();
    }
  }

  /**
   * Handle failed Claude execution
   */
  private handleClaudeFailure(data: any): void {
    if (this.config.metricTracking) {
      this.metrics.failedTasks++;
      this.updateSuccessRates();
    }
  }

  /**
   * Handle successful Gemini execution
   */
  private handleGeminiSuccess(data: any): void {
    if (this.config.metricTracking) {
      this.metrics.successfulTasks++;
      this.updateSuccessRates();
    }
  }

  /**
   * Handle failed Gemini execution
   */
  private handleGeminiFailure(data: any): void {
    if (this.config.metricTracking) {
      this.metrics.failedTasks++;
      this.updateSuccessRates();
    }
  }

  /**
   * Update average execution time
   */
  private updateAverageExecutionTime(executionTime: number): void {
    if (this.metrics.totalTasks === 1) {
      this.metrics.averageExecutionTime = executionTime;
    } else {
      const successfulTasks = this.metrics.successfulTasks;
      const currentAvg = this.metrics.averageExecutionTime;
      this.metrics.averageExecutionTime = (currentAvg * (successfulTasks - 1) + executionTime) / successfulTasks;
    }
  }

  /**
   * Update success rates by provider
   */
  private updateSuccessRates(): void {
    for (const provider of ['claude', 'gemini'] as const) {
      if (this.metrics.tasksByProvider[provider] > 0) {
        this.metrics.successRateByProvider[provider] = 
          (this.metrics.tasksByProvider[provider] - this.metrics.failedTasks) / 
          this.metrics.tasksByProvider[provider];
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get provider preferences for task types
   */
  getTaskPreferences() {
    return { ...this.taskPreferences };
  }

  /**
   * Update task preferences
   */
  updateTaskPreference(taskType: TaskType, provider: ModelProvider): void {
    this.taskPreferences[taskType] = provider;
    this.logger.info(`Updated task preference`, { taskType, provider });
  }

  /**
   * Get provider availability
   */
  getProviderAvailability(): Record<ModelProvider, boolean> {
    return {
      claude: this.modelAvailability.get('claude') || false,
      gemini: this.modelAvailability.get('gemini') || false,
      auto: true
    };
  }
}