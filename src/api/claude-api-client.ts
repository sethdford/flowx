/**
 * SUPERIOR Claude API Client for Claude-Code-Flow
 * Comprehensive direct API integration with ALL Claude models
 * Exceeds original flowx with advanced features, streaming, and enterprise capabilities
 */

import { EventEmitter } from 'events';
import { ILogger } from '../core/logger.js';
import { ConfigManager } from '../config/config-manager.js';
import { ModelSelector, DEFAULT_MODEL_ID, CLAUDE_MODELS } from '../config/models.js';
// Error handler utility
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export interface ClaudeAPIConfig {
  apiKey: string;
  apiUrl?: string;
  model?: ClaudeModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  streamingEnabled?: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  fallbackModels?: ClaudeModel[];
  autoRetryOnRateLimit?: boolean;
  customHeaders?: Record<string, string>;
}

// COMPREHENSIVE model support - Uses centralized model configuration
export type ClaudeModel = keyof typeof CLAUDE_MODELS;

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

export interface ClaudeRequest {
  model: ClaudeModel;
  messages: ClaudeMessage[];
  system?: string;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  metadata?: {
    user_id?: string;
    trace_id?: string;
    session_id?: string;
  };
  stop_sequences?: string[];
  stream?: boolean;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: object;
  }>;
  tool_choice?: 'auto' | 'any' | { type: 'tool'; name: string };
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  model: ClaudeModel;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface ClaudeStreamEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'ping' | 'error';
  message?: Partial<ClaudeResponse>;
  index?: number;
  delta?: {
    type?: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
    stop_reason?: string;
    stop_sequence?: string;
  };
  content_block?: {
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    type: string;
    message: string;
  };
}

export interface ModelCapabilities {
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsToolUse: boolean;
  costPerInputToken: number;
  costPerOutputToken: number;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  strengths: string[];
  optimalUseCases: string[];
}

export interface UsageMetrics {
  totalRequests: number;
  totalTokensUsed: number;
  totalCost: number;
  averageResponseTime: number;
  successRate: number;
  errorsByType: Record<string, number>;
  requestsByModel: Record<ClaudeModel, number>;
}

export class ClaudeAPIClient extends EventEmitter {
  private config: ClaudeAPIConfig;
  private logger: ILogger;
  private configManager: ConfigManager;
  private usage: UsageMetrics;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private rateLimitState = {
    requestsThisMinute: 0,
    tokensThisMinute: 0,
    lastReset: Date.now(),
  };

  // Model capabilities database - REMOVED DUPLICATE METHOD
  
  private getModelStrengths(model: any): string[] {
    const strengths = ['reasoning'];
    if (model.capabilities.codeGeneration) strengths.push('code_generation');
    if (model.capabilities.vision) strengths.push('vision');
    if (model.capabilities.toolUse) strengths.push('tool_use');
    if (model.capabilities.extendedThinking) strengths.push('deep_reasoning');
    if (model.capabilities.computerUse) strengths.push('computer_use');
    return strengths;
  }
  
  private getOptimalUseCases(model: any): string[] {
    const useCases = ['general_tasks'];
    if (model.capabilities.codeGeneration) useCases.push('code_review', 'software_development');
    if (model.capabilities.vision) useCases.push('multimodal_tasks', 'data_analysis');
    if (model.capabilities.extendedThinking) useCases.push('complex_reasoning', 'research');
    if (model.capabilities.computerUse) useCases.push('automation', 'workflow_tasks');
    return useCases;
  }
  
  // Legacy compatibility - keeping old structure for now
  private readonly modelCapabilities: Record<string, ModelCapabilities> = {
    'claude-3-5-sonnet-20241022': {
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsVision: true,
      supportsToolUse: true,
      costPerInputToken: 0.000003,
      costPerOutputToken: 0.000015,
      rateLimit: { requestsPerMinute: 50, tokensPerMinute: 40000 },
      strengths: ['reasoning', 'code_generation', 'analysis', 'vision', 'tool_use'],
      optimalUseCases: ['complex_reasoning', 'code_review', 'data_analysis', 'multimodal_tasks']
    },
    'claude-3-5-sonnet-20240620': {
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsVision: true,
      supportsToolUse: true,
      costPerInputToken: 0.000003,
      costPerOutputToken: 0.000015,
      rateLimit: { requestsPerMinute: 50, tokensPerMinute: 40000 },
      strengths: ['reasoning', 'code_generation', 'analysis', 'vision'],
      optimalUseCases: ['complex_reasoning', 'code_review', 'data_analysis']
    },
    'claude-3-5-haiku-20241022': {
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsVision: true,
      supportsToolUse: true,
      costPerInputToken: 0.0000008,
      costPerOutputToken: 0.000004,
      rateLimit: { requestsPerMinute: 100, tokensPerMinute: 50000 },
      strengths: ['speed', 'efficiency', 'basic_reasoning'],
      optimalUseCases: ['quick_tasks', 'simple_analysis', 'fast_responses']
    },
    'claude-3-opus-20240229': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsVision: true,
      supportsToolUse: true,
      costPerInputToken: 0.000015,
      costPerOutputToken: 0.000075,
      rateLimit: { requestsPerMinute: 20, tokensPerMinute: 10000 },
      strengths: ['advanced_reasoning', 'creativity', 'complex_analysis'],
      optimalUseCases: ['research', 'creative_writing', 'complex_problem_solving']
    },
    'claude-3-sonnet-20240229': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsVision: true,
      supportsToolUse: true,
      costPerInputToken: 0.000003,
      costPerOutputToken: 0.000015,
      rateLimit: { requestsPerMinute: 50, tokensPerMinute: 40000 },
      strengths: ['balanced_performance', 'reasoning', 'analysis'],
      optimalUseCases: ['general_tasks', 'analysis', 'writing']
    },
    'claude-3-haiku-20240307': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsVision: true,
      supportsToolUse: true,
      costPerInputToken: 0.00000025,
      costPerOutputToken: 0.00000125,
      rateLimit: { requestsPerMinute: 100, tokensPerMinute: 50000 },
      strengths: ['speed', 'efficiency', 'cost_effectiveness'],
      optimalUseCases: ['simple_tasks', 'quick_responses', 'high_volume']
    },
    'claude-2.1': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsVision: false,
      supportsToolUse: false,
      costPerInputToken: 0.000008,
      costPerOutputToken: 0.000024,
      rateLimit: { requestsPerMinute: 40, tokensPerMinute: 20000 },
      strengths: ['long_context', 'reasoning'],
      optimalUseCases: ['long_document_analysis', 'legacy_support']
    },
    'claude-2.0': {
      contextWindow: 100000,
      maxOutputTokens: 4096,
      supportsVision: false,
      supportsToolUse: false,
      costPerInputToken: 0.000008,
      costPerOutputToken: 0.000024,
      rateLimit: { requestsPerMinute: 40, tokensPerMinute: 20000 },
      strengths: ['reasoning', 'writing'],
      optimalUseCases: ['general_tasks', 'legacy_support']
    },
    'claude-instant-1.2': {
      contextWindow: 100000,
      maxOutputTokens: 4096,
      supportsVision: false,
      supportsToolUse: false,
      costPerInputToken: 0.0000008,
      costPerOutputToken: 0.0000024,
      rateLimit: { requestsPerMinute: 200, tokensPerMinute: 100000 },
      strengths: ['speed', 'cost_effectiveness'],
      optimalUseCases: ['quick_tasks', 'high_volume', 'simple_responses']
    },
    'claude-instant-1.1': {
      contextWindow: 100000,
      maxOutputTokens: 4096,
      supportsVision: false,
      supportsToolUse: false,
      costPerInputToken: 0.0000008,
      costPerOutputToken: 0.0000024,
      rateLimit: { requestsPerMinute: 200, tokensPerMinute: 100000 },
      strengths: ['speed', 'cost_effectiveness'],
      optimalUseCases: ['quick_tasks', 'high_volume']
    },
    'claude-instant-1.0': {
      contextWindow: 100000,
      maxOutputTokens: 4096,
      supportsVision: false,
      supportsToolUse: false,
      costPerInputToken: 0.0000008,
      costPerOutputToken: 0.0000024,
      rateLimit: { requestsPerMinute: 200, tokensPerMinute: 100000 },
      strengths: ['speed', 'cost_effectiveness'],
      optimalUseCases: ['quick_tasks', 'legacy_support']
    }
  };

  constructor(logger: ILogger, configManager: ConfigManager, config?: Partial<ClaudeAPIConfig>) {
    super();
    this.logger = logger;
    this.configManager = configManager;
    
    // Initialize usage metrics
    this.usage = {
      totalRequests: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      averageResponseTime: 0,
      successRate: 0,
      errorsByType: {},
      requestsByModel: {} as Record<ClaudeModel, number>
    };
    
    // Load configuration
    this.config = this.loadConfiguration(config);
    
    this.logger.info('Claude API Client initialized', {
      model: this.config.model,
      apiUrl: this.config.apiUrl,
      streamingEnabled: this.config.streamingEnabled,
      rateLimit: this.config.rateLimit
    });
  }

  /**
   * Load and merge configuration from multiple sources
   */
  private loadConfiguration(overrides?: Partial<ClaudeAPIConfig>): ClaudeAPIConfig {
    const config: ClaudeAPIConfig = {
      apiKey: '',
      apiUrl: 'https://api.anthropic.com/v1/messages',
      model: DEFAULT_MODEL_ID as ClaudeModel, // Default to latest and greatest
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      topK: undefined,
      systemPrompt: undefined,
      timeout: 60000,
      retryAttempts: 3,
      retryDelay: 1000,
      streamingEnabled: false,
      rateLimit: {
        requestsPerMinute: 50,
        tokensPerMinute: 40000
      },
      fallbackModels: ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
      autoRetryOnRateLimit: true,
      customHeaders: {}
    };

    // Load from environment variables
    if (process.env.ANTHROPIC_API_KEY) config.apiKey = process.env.ANTHROPIC_API_KEY;
    if (process.env.CLAUDE_API_URL) config.apiUrl = process.env.CLAUDE_API_URL;
    if (process.env.CLAUDE_MODEL) config.model = process.env.CLAUDE_MODEL as ClaudeModel;
    if (process.env.CLAUDE_TEMPERATURE) config.temperature = parseFloat(process.env.CLAUDE_TEMPERATURE);
    if (process.env.CLAUDE_MAX_TOKENS) config.maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS);
    if (process.env.CLAUDE_STREAMING) config.streamingEnabled = process.env.CLAUDE_STREAMING === 'true';

    // Load from config manager
    try {
      const claudeConfig = this.configManager.get('claude');
      if (claudeConfig) {
        Object.assign(config, claudeConfig);
      }
    } catch (error) {
      this.logger.warn('Failed to load Claude config from ConfigManager', { error: getErrorMessage(error) });
    }

    // Apply overrides
    if (overrides) {
      Object.assign(config, overrides);
    }

    // Update rate limit based on selected model
    if (config.model && this.modelCapabilities[config.model]) {
      config.rateLimit = this.modelCapabilities[config.model].rateLimit;
    }

    return config;
  }

  /**
   * Send a message to Claude with comprehensive error handling and retries
   */
  async sendMessage(
    messages: ClaudeMessage | ClaudeMessage[],
    options: Partial<ClaudeRequest> = {}
  ): Promise<ClaudeResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    // Normalize messages
    const normalizedMessages = Array.isArray(messages) ? messages : [messages];
    
    const request: ClaudeRequest = {
      model: options.model || this.config.model!,
      messages: normalizedMessages,
      max_tokens: options.max_tokens || this.config.maxTokens!,
      temperature: options.temperature ?? this.config.temperature,
      top_p: options.top_p ?? this.config.topP,
      top_k: options.top_k ?? this.config.topK,
      system: options.system || this.config.systemPrompt,
      metadata: {
        user_id: process.env.USER || 'flowx-user',
        trace_id: requestId,
        session_id: process.env.CLAUDE_SESSION_ID || `session-${Date.now()}`,
        ...options.metadata
      },
      stop_sequences: options.stop_sequences,
      stream: options.stream ?? this.config.streamingEnabled,
      tools: options.tools,
      tool_choice: options.tool_choice
    };

    try {
      // Check rate limits
      await this.checkRateLimit(request);
      
      // Execute request with retries
      const response = await this.executeWithRetries(request, requestId);
      
      // Update metrics
      this.updateUsageMetrics(request, response, Date.now() - startTime, true);
      
      this.logger.info('Claude API request completed', {
        requestId,
        model: request.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        duration: Date.now() - startTime
      });
      
      return response;
      
    } catch (error) {
      this.updateUsageMetrics(request, null, Date.now() - startTime, false, error);
      
      this.logger.error('Claude API request failed', {
        requestId,
        model: request.model,
        error: getErrorMessage(error),
        duration: Date.now() - startTime
      });
      
      throw error;
    }
  }

  /**
   * Stream messages from Claude with real-time processing
   */
  async streamMessage(
    messages: ClaudeMessage | ClaudeMessage[],
    options: Partial<ClaudeRequest> = {},
    onChunk?: (chunk: ClaudeStreamEvent) => void
  ): Promise<ClaudeResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        const normalizedMessages = Array.isArray(messages) ? messages : [messages];
        
        const request: ClaudeRequest = {
          model: options.model || this.config.model!,
          messages: normalizedMessages,
          max_tokens: options.max_tokens || this.config.maxTokens!,
          temperature: options.temperature ?? this.config.temperature,
          stream: true,
          ...options
        };

        const response = await fetch(this.config.apiUrl!, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(request)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        if (!response.body) {
          throw new Error('No response body for streaming');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResponse: ClaudeResponse | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const chunk: ClaudeStreamEvent = JSON.parse(data);
                  
                  if (onChunk) {
                    onChunk(chunk);
                  }
                  
                  this.emit('chunk', chunk);
                  
                  // Build final response from stream events
                  if (chunk.type === 'message_start' && chunk.message) {
                    finalResponse = chunk.message as ClaudeResponse;
                  } else if (chunk.type === 'message_stop' && finalResponse) {
                    resolve(finalResponse);
                    return;
                  }
                } catch (parseError) {
                  this.logger.warn('Failed to parse stream chunk', { line, error: getErrorMessage(parseError) });
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (!finalResponse) {
          throw new Error('No complete response received from stream');
        }

        resolve(finalResponse);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get model capabilities and recommendations
   */
  getModelCapabilities(model?: ClaudeModel): ModelCapabilities {
    const targetModel = model || this.config.model!;
    return this.modelCapabilities[targetModel];
  }

  /**
   * Get all available models with their capabilities
   */
  getAllModels(): Record<ClaudeModel, ModelCapabilities> {
    return { ...this.modelCapabilities };
  }

  /**
   * Recommend best model for a specific use case
   */
  recommendModel(useCase: string, requirements?: {
    maxCost?: number;
    maxLatency?: boolean;
    needsVision?: boolean;
    needsToolUse?: boolean;
    contextLength?: number;
  }): ClaudeModel[] {
    const candidates = Object.entries(this.modelCapabilities)
      .filter(([model, caps]) => {
        if (requirements?.needsVision && !caps.supportsVision) return false;
        if (requirements?.needsToolUse && !caps.supportsToolUse) return false;
        if (requirements?.contextLength && caps.contextWindow < requirements.contextLength) return false;
        if (requirements?.maxCost && caps.costPerInputToken > requirements.maxCost) return false;
        return caps.optimalUseCases.some(uc => uc.includes(useCase.toLowerCase()));
      })
      .sort((a, b) => {
        // Sort by cost-effectiveness and capabilities
        const scoreA = this.calculateModelScore(a[1], requirements);
        const scoreB = this.calculateModelScore(b[1], requirements);
        return scoreB - scoreA;
      })
      .map(([model]) => model as ClaudeModel);

    return candidates.length > 0 ? candidates : [DEFAULT_MODEL_ID as ClaudeModel];
  }

  /**
   * Get comprehensive usage metrics and analytics
   */
  getUsageMetrics(): UsageMetrics & {
    costBreakdown: Record<ClaudeModel, number>;
    performance: {
      averageLatency: number;
      p95Latency: number;
      errorRate: number;
    };
    recommendations: string[];
  } {
    const costBreakdown: Record<ClaudeModel, number> = {} as any;
    Object.keys(this.usage.requestsByModel).forEach(model => {
      const caps = this.modelCapabilities[model as ClaudeModel];
      if (caps) {
        costBreakdown[model as ClaudeModel] = this.usage.requestsByModel[model as ClaudeModel] * caps.costPerInputToken * 1000;
      }
    });

    const recommendations = this.generateUsageRecommendations();

    return {
      ...this.usage,
      costBreakdown,
      performance: {
        averageLatency: this.usage.averageResponseTime,
        p95Latency: this.usage.averageResponseTime * 1.5, // Approximation
        errorRate: 1 - this.usage.successRate
      },
      recommendations
    };
  }

  /**
   * Test API connectivity and configuration
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    model: ClaudeModel;
    apiKeyValid: boolean;
    latency: number;
    capabilities: ModelCapabilities;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      if (!this.config.apiKey) {
        return {
          healthy: false,
          model: this.config.model!,
          apiKeyValid: false,
          latency: 0,
          capabilities: this.getModelCapabilities(),
          error: 'No API key configured'
        };
      }

      // Simple test message
      const response = await this.sendMessage({
        role: 'user',
        content: 'Reply with just "OK" to confirm connectivity.'
      }, {
        max_tokens: 10,
        temperature: 0
      });

      const latency = Date.now() - startTime;

      return {
        healthy: true,
        model: this.config.model!,
        apiKeyValid: true,
        latency,
        capabilities: this.getModelCapabilities(),
      };
      
    } catch (error) {
      return {
        healthy: false,
        model: this.config.model!,
        apiKeyValid: false,
        latency: Date.now() - startTime,
        capabilities: this.getModelCapabilities(),
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(updates: Partial<ClaudeAPIConfig>): void {
    Object.assign(this.config, updates);
    
    // Update rate limits if model changed
    if (updates.model && this.modelCapabilities[updates.model]) {
      this.config.rateLimit = this.modelCapabilities[updates.model].rateLimit;
    }
    
    this.logger.info('Claude API configuration updated', updates);
    this.emit('config:updated', this.config);
  }

  // Private helper methods

  private async executeWithRetries(request: ClaudeRequest, requestId: string): Promise<ClaudeResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        return await this.executeRequest(request, requestId);
      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry
        if (!this.shouldRetry(error as Error, attempt)) {
          break;
        }
        
        // Wait before retry
        if (attempt < this.config.retryAttempts!) {
          await this.delay(this.config.retryDelay! * Math.pow(2, attempt - 1));
        }
      }
    }
    
    throw lastError;
  }

  private async executeRequest(request: ClaudeRequest, requestId: string): Promise<ClaudeResponse> {
    const response = await fetch(this.config.apiUrl!, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result as ClaudeResponse;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'tools-2024-04-04',
      ...this.config.customHeaders
    };
  }

  private async checkRateLimit(request: ClaudeRequest): Promise<void> {
    const now = Date.now();
    
    // Reset rate limit counters if a minute has passed
    if (now - this.rateLimitState.lastReset > 60000) {
      this.rateLimitState.requestsThisMinute = 0;
      this.rateLimitState.tokensThisMinute = 0;
      this.rateLimitState.lastReset = now;
    }
    
    const rateLimit = this.config.rateLimit!;
    const estimatedTokens = this.estimateTokens(request.messages);
    
    // Check if we would exceed rate limits
    if (this.rateLimitState.requestsThisMinute >= rateLimit.requestsPerMinute ||
        this.rateLimitState.tokensThisMinute + estimatedTokens > rateLimit.tokensPerMinute) {
      
      if (this.config.autoRetryOnRateLimit) {
        const waitTime = 60000 - (now - this.rateLimitState.lastReset);
        this.logger.info('Rate limit reached, waiting', { waitTime });
        await this.delay(waitTime);
        await this.checkRateLimit(request); // Recheck after waiting
      } else {
        throw new Error('Rate limit exceeded');
      }
    }
    
    // Update counters
    this.rateLimitState.requestsThisMinute++;
    this.rateLimitState.tokensThisMinute += estimatedTokens;
  }

  private estimateTokens(messages: ClaudeMessage[]): number {
    // Rough estimation: 1 token ≈ 4 characters
    return messages.reduce((total, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : 
        msg.content.map(c => c.text || '').join('');
      return total + Math.ceil(content.length / 4);
    }, 0);
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.config.retryAttempts!) return false;
    
    const message = error.message.toLowerCase();
    
    // Retry on temporary errors
    return message.includes('timeout') ||
           message.includes('network') ||
           message.includes('503') ||
           message.includes('502') ||
           message.includes('500') ||
           message.includes('rate limit');
  }

  private updateUsageMetrics(
    request: ClaudeRequest,
    response: ClaudeResponse | null,
    duration: number,
    success: boolean,
    error?: unknown
  ): void {
    this.usage.totalRequests++;
    
    if (success && response) {
      this.usage.totalTokensUsed += response.usage.input_tokens + response.usage.output_tokens;
      
      const capabilities = this.modelCapabilities[request.model];
      if (capabilities) {
        this.usage.totalCost += 
          (response.usage.input_tokens * capabilities.costPerInputToken) +
          (response.usage.output_tokens * capabilities.costPerOutputToken);
      }
      
      // Update per-model metrics
      this.usage.requestsByModel[request.model] = (this.usage.requestsByModel[request.model] || 0) + 1;
    } else if (error) {
      const errorType = (error as Error).message.split(':')[0] || 'unknown';
      this.usage.errorsByType[errorType] = (this.usage.errorsByType[errorType] || 0) + 1;
    }
    
    // Update rolling averages
    const totalSuccessful = this.usage.totalRequests - Object.values(this.usage.errorsByType).reduce((a, b) => a + b, 0);
    this.usage.successRate = totalSuccessful / this.usage.totalRequests;
    
    // Simple moving average for response time
    this.usage.averageResponseTime = 
      (this.usage.averageResponseTime * (this.usage.totalRequests - 1) + duration) / this.usage.totalRequests;
  }

  private calculateModelScore(capabilities: ModelCapabilities, requirements?: any): number {
    let score = 100;
    
    // Factor in cost-effectiveness
    score -= capabilities.costPerInputToken * 10000;
    
    // Factor in performance
    score += capabilities.rateLimit.tokensPerMinute / 1000;
    
    // Bonus for advanced features
    if (capabilities.supportsVision) score += 10;
    if (capabilities.supportsToolUse) score += 10;
    
    return score;
  }

  private generateUsageRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.usage.successRate < 0.95) {
      recommendations.push('Consider implementing better error handling or retry logic');
    }
    
    if (this.usage.averageResponseTime > 10000) {
      recommendations.push('Response times are high, consider using faster models for simple tasks');
    }
    
    const totalCost = this.usage.totalCost;
    if (totalCost > 100) {
      recommendations.push('High API costs detected, consider optimizing prompt lengths or using cheaper models');
    }
    
    return recommendations;
  }

  private generateRequestId(): string {
    return `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close client and cleanup resources
   */
  async close(): Promise<void> {
    this.removeAllListeners();
    this.logger.info('Claude API Client closed');
  }
}

/**
 * Factory function to create optimally configured Claude API client
 */
export function createClaudeAPIClient(
  logger: ILogger, 
  configManager: ConfigManager, 
  config?: Partial<ClaudeAPIConfig>
): ClaudeAPIClient {
  return new ClaudeAPIClient(logger, configManager, config);
}

export default ClaudeAPIClient; 