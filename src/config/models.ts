/**
 * Centralized Model Configuration for FlowX
 * Supports the latest Claude models and provides a single source of truth for model names
 * 
 * NOTE: All model names are based on official Anthropic documentation
 * Last updated: January 2025
 */

export interface ModelConfig {
  id: string;
  name: string;
  family: 'claude' | 'gpt' | 'other';
  version: string;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  limits: ModelLimits;
  deprecated?: boolean;
  replacedBy?: string;
}

export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  toolUse: boolean;
  codeGeneration: boolean;
  reasoning: boolean;
  extendedThinking?: boolean;
  computerUse?: boolean;
}

export interface ModelPricing {
  inputTokensPer1M: number;
  outputTokensPer1M: number;
  currency: 'USD';
}

export interface ModelLimits {
  contextWindow: number;
  maxOutputTokens: number;
}

/**
 * Latest Claude Models (2025)
 * Based on official Anthropic API documentation - ACTUAL WORKING MODEL IDs
 */
export const CLAUDE_MODELS: Record<string, ModelConfig> = {
  // Current Claude 3.5 Models (Working API IDs)
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    family: 'claude',
    version: '3.5',
    capabilities: {
      text: true,
      vision: true,
      toolUse: true,
      codeGeneration: true,
      reasoning: true,
    },
    pricing: {
      inputTokensPer1M: 3.00,
      outputTokensPer1M: 15.00,
      currency: 'USD',
    },
    limits: {
      contextWindow: 200000,
      maxOutputTokens: 8192,
    },
  },

  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    family: 'claude',
    version: '3.5',
    capabilities: {
      text: true,
      vision: true,
      toolUse: true,
      codeGeneration: true,
      reasoning: false,
    },
    pricing: {
      inputTokensPer1M: 1.00,
      outputTokensPer1M: 5.00,
      currency: 'USD',
    },
    limits: {
      contextWindow: 200000,
      maxOutputTokens: 8192,
    },
  },

  // Claude 3 Models (Still available)
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    family: 'claude',
    version: '3.0',
    capabilities: {
      text: true,
      vision: true,
      toolUse: true,
      codeGeneration: true,
      reasoning: true,
    },
    pricing: {
      inputTokensPer1M: 15.00,
      outputTokensPer1M: 75.00,
      currency: 'USD',
    },
    limits: {
      contextWindow: 200000,
      maxOutputTokens: 4096,
    },
  },

  'claude-3-sonnet-20240229': {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    family: 'claude',
    version: '3.0',
    capabilities: {
      text: true,
      vision: true,
      toolUse: true,
      codeGeneration: true,
      reasoning: false,
    },
    pricing: {
      inputTokensPer1M: 3.00,
      outputTokensPer1M: 15.00,
      currency: 'USD',
    },
    limits: {
      contextWindow: 200000,
      maxOutputTokens: 4096,
    },
  },

  'claude-3-haiku-20240307': {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    family: 'claude',
    version: '3.0',
    capabilities: {
      text: true,
      vision: true,
      toolUse: true,
      codeGeneration: true,
      reasoning: false,
    },
    pricing: {
      inputTokensPer1M: 0.25,
      outputTokensPer1M: 1.25,
      currency: 'USD',
    },
    limits: {
      contextWindow: 200000,
      maxOutputTokens: 4096,
    },
  },
};

/**
 * Future Models - NOT YET AVAILABLE
 * These models are announced but not yet available via API
 */
export const FUTURE_MODELS: Record<string, Partial<ModelConfig>> = {
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    deprecated: false,
    replacedBy: 'claude-3-5-sonnet-20241022', // Use this instead for now
  },
  'claude-opus-4-20250514': {
    id: 'claude-opus-4-20250514', 
    name: 'Claude Opus 4',
    deprecated: false,
    replacedBy: 'claude-3-opus-20240229', // Use this instead for now
  },
};

/**
 * Deprecated Models - DO NOT USE
 * Kept for migration purposes only
 */
export const DEPRECATED_MODELS: Record<string, ModelConfig> = {
  // Example of deprecated model format:
  // 'old-model-id': {
  //   id: 'old-model-id',
  //   deprecated: true,
  //   replacedBy: 'new-model-id'
  // }
};

/**
 * Model Selection Utilities
 */
export class ModelSelector {
  /**
   * Get the default model for general use
   */
  static getDefault(): ModelConfig {
    return CLAUDE_MODELS['claude-3-5-sonnet-20241022'];
  }

  /**
   * Get the best model for coding tasks
   */
  static getBestForCoding(): ModelConfig {
    return CLAUDE_MODELS['claude-3-5-sonnet-20241022']; // Best coding performance
  }

  /**
   * Get the best model for reasoning tasks
   */
  static getBestForReasoning(): ModelConfig {
    return CLAUDE_MODELS['claude-3-opus-20240229']; // Highest capability (current available)
  }

  /**
   * Get the most cost-effective model
   */
  static getMostCostEffective(): ModelConfig {
    return CLAUDE_MODELS['claude-3-haiku-20240307']; // Lowest cost
  }

  /**
   * Get the fastest model
   */
  static getFastest(): ModelConfig {
    return CLAUDE_MODELS['claude-3-5-haiku-20241022']; // Fastest response
  }

  /**
   * Get model by ID with fallback to default
   */
  static getById(id: string): ModelConfig {
    // Check active models first
    if (CLAUDE_MODELS[id]) {
      return CLAUDE_MODELS[id];
    }
    
    // Check if it's a deprecated model and suggest replacement
    if (DEPRECATED_MODELS[id]) {
      const deprecated = DEPRECATED_MODELS[id];
      console.warn(`Model "${id}" is deprecated. Please use "${deprecated.replacedBy}" instead.`);
      
      if (deprecated.replacedBy && CLAUDE_MODELS[deprecated.replacedBy]) {
        return CLAUDE_MODELS[deprecated.replacedBy];
      }
    }
    
    // Fallback to default
    console.warn(`Model "${id}" not found. Falling back to default model.`);
    return this.getDefault();
  }

  /**
   * Check if a model is deprecated
   */
  static isDeprecated(id: string): boolean {
    return id in DEPRECATED_MODELS;
  }

  /**
   * Get all available models
   */
  static getAllModels(): ModelConfig[] {
    return Object.values(CLAUDE_MODELS);
  }

  /**
   * Get models by capability
   */
  static getByCapability(capability: keyof ModelCapabilities): ModelConfig[] {
    return Object.values(CLAUDE_MODELS).filter(model => model.capabilities[capability]);
  }

  /**
   * Get models within price range (per 1M tokens)
   */
  static getByPriceRange(maxInputPrice: number, maxOutputPrice: number): ModelConfig[] {
    return Object.values(CLAUDE_MODELS).filter(model => 
      model.pricing.inputTokensPer1M <= maxInputPrice && 
      model.pricing.outputTokensPer1M <= maxOutputPrice
    );
  }
}

/**
 * Environment-specific model selection
 */
export class EnvironmentModelSelector {
  /**
   * Get model for development environment (cost-effective)
   */
  static getForDevelopment(): ModelConfig {
    return ModelSelector.getMostCostEffective();
  }

  /**
   * Get model for production environment (balanced)
   */
  static getForProduction(): ModelConfig {
    return ModelSelector.getDefault();
  }

  /**
   * Get model for enterprise environment (most capable)
   */
  static getForEnterprise(): ModelConfig {
    return CLAUDE_MODELS['claude-3-opus-20240229']; // Most capable (current available)
  }

  /**
   * Get model based on NODE_ENV
   */
  static getForCurrentEnvironment(): ModelConfig {
    const env = process.env.NODE_ENV;
    
    switch (env) {
      case 'development':
        return this.getForDevelopment();
      case 'production':
        return this.getForProduction();
      case 'enterprise':
        return this.getForEnterprise();
      default:
        return ModelSelector.getDefault();
    }
  }
}

/**
 * Configuration validation
 */
export function validateModelConfig(config: ModelConfig): boolean {
  return !!(
    config.id &&
    config.name &&
    config.family &&
    config.version &&
    config.capabilities &&
    config.pricing &&
    config.limits
  );
}

/**
 * Export default model for backward compatibility
 */
export const DEFAULT_MODEL = ModelSelector.getDefault();
export const DEFAULT_MODEL_ID = DEFAULT_MODEL.id;

/**
 * Quick access to commonly used models
 */
export const MODELS = {
  DEFAULT: ModelSelector.getDefault(),
  CODING: ModelSelector.getBestForCoding(),
  REASONING: ModelSelector.getBestForReasoning(),
  FAST: ModelSelector.getFastest(),
  CHEAP: ModelSelector.getMostCostEffective(),
} as const; 