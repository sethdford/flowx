/**
 * Claude Process Integration Module
 * Unified integration of secure coder framework with all Claude process spawning
 * Ensures consistent security context and configuration across all spawning mechanisms
 */

import { join } from 'node:path';
import { Logger } from '../core/logger.js';
import { SecureAgentIntegration, SecureAgentSpawnOptions } from './secure-agent-integration.js';
import { SecureCoderAgent, SecureCodeGenerationContext } from './secure-coder-agent.js';
import { ModelSelector, DEFAULT_MODEL_ID } from '../config/models.js';

// Type definitions for security integration
export type SecurityLevel = 'basic' | 'standard' | 'high' | 'critical';
export type ComplianceRequirement = 'OWASP_TOP_10_2023' | 'PCI_DSS' | 'GDPR' | 'SOX' | 'HIPAA';

export interface EnhancedAgentConfig {
  securityLevel: SecurityLevel;
  complianceRequirements: ComplianceRequirement[];
  enforceCleanArchitecture: boolean;
  enforceSOLID: boolean;
  minTestCoverage: number;
  enableAutoFix: boolean;
  customSecurityRules?: string[];
}

export interface ClaudeProcessSecurityConfig {
  securityLevel: SecurityLevel;
  complianceRequirements: ComplianceRequirement[];
  enforceCleanArchitecture: boolean;
  enforceSOLID: boolean;
  minTestCoverage: number;
  enableAutoFix: boolean;
  customSecurityRules?: string[];
  projectType?: 'enterprise-web' | 'financial-api' | 'healthcare-app' | 'serverless-functions' | 'general';
}

export interface ClaudeSpawnContext {
  instanceId: string;
  task: string;
  workingDirectory: string;
  sessionId?: string;
  swarmId?: string;
  agentId?: string;
  agentType?: string;
  isSwarmMode?: boolean;
  isAgentMode?: boolean;
}

export interface EnhancedClaudeArgs {
  args: string[];
  env: Record<string, string>;
  systemPrompt: string;
  templatePaths: string[];
}

export class ClaudeProcessIntegration {
  private logger: Logger;
  private secureAgent: SecureCoderAgent;

  constructor() {
    this.logger = new Logger('ClaudeProcessIntegration');
    // Initialize with minimal dependencies for now
    this.secureAgent = new SecureCoderAgent(this.logger);
  }

  /**
   * Enhanced Claude argument builder that includes security context
   */
  async buildEnhancedClaudeArgs(
    baseArgs: string[],
    context: ClaudeSpawnContext,
    securityConfig?: Partial<ClaudeProcessSecurityConfig>
  ): Promise<EnhancedClaudeArgs> {
    try {
      // Determine security level based on context
      const securityLevel = this.determineSecurityLevel(context, securityConfig);
      
      // Get security configuration
      const fullSecurityConfig = await this.getSecurityConfig(securityLevel, securityConfig);
      
      // Build enhanced arguments
      const enhancedArgs = [...baseArgs];
      
      // Add security-specific Claude CLI arguments (only valid ones for v1.0.56)
      // Note: --model not supported in Claude CLI v1.0.56
      // enhancedArgs.push('--model', ModelSelector.getBestForCoding().id);
      
      // Always skip permissions for automation but maintain security
      if (!enhancedArgs.includes('--dangerously-skip-permissions')) {
        enhancedArgs.push('--dangerously-skip-permissions');
      }
      
      // Note: --add-dir not supported in Claude CLI v1.0.56
      // Claude CLI automatically has access to the working directory
      const templatePaths = await this.getTemplatePaths(fullSecurityConfig);
      
      // Build enhanced environment variables
      const enhancedEnv = await this.buildSecurityEnvironment(context, fullSecurityConfig);
      
      // Find the actual prompt in baseArgs (it's the last non-flag argument)
      const originalPrompt = baseArgs.find(arg => !arg.startsWith('--') && arg !== 'text') || context.task;
      
      // Generate comprehensive system prompt with security context
      const systemPrompt = await this.generateSecurityEnhancedPrompt(
        context,
        fullSecurityConfig,
        originalPrompt // Original task/prompt
      );
      
      this.logger.info('Enhanced Claude arguments with security context', {
        instanceId: context.instanceId,
        securityLevel: fullSecurityConfig.securityLevel,
        complianceRequirements: fullSecurityConfig.complianceRequirements,
        templatePaths: templatePaths.length
      });

      return {
        args: enhancedArgs,
        env: enhancedEnv,
        systemPrompt,
        templatePaths
      };
      
    } catch (error) {
      this.logger.error('Failed to build enhanced Claude arguments', error);
      // Fallback to basic security
      return this.buildFallbackArgs(baseArgs, context);
    }
  }

  /**
   * Determine appropriate security level based on context
   */
  private determineSecurityLevel(
    context: ClaudeSpawnContext,
    securityConfig?: Partial<ClaudeProcessSecurityConfig>
  ): SecurityLevel {
    // Explicit configuration takes precedence
    if (securityConfig?.securityLevel) {
      return securityConfig.securityLevel;
    }

    // Infer from context
    const task = context.task.toLowerCase();
    
    if (task.includes('enterprise') || task.includes('production') || task.includes('deploy')) {
      return 'critical';
    }
    
    if (task.includes('api') || task.includes('backend') || task.includes('database') || task.includes('auth')) {
      return 'high';
    }
    
    if (task.includes('security') || task.includes('compliance') || task.includes('audit')) {
      return 'critical';
    }
    
    if (context.isSwarmMode || context.agentType === 'security') {
      return 'high';
    }
    
    return 'standard';
  }

  /**
   * Get complete security configuration
   */
  private async getSecurityConfig(
    securityLevel: SecurityLevel,
    override?: Partial<ClaudeProcessSecurityConfig>
  ): Promise<ClaudeProcessSecurityConfig> {
    const baseConfig: ClaudeProcessSecurityConfig = {
      securityLevel,
      complianceRequirements: this.getDefaultCompliance(securityLevel),
      enforceCleanArchitecture: securityLevel !== 'basic',
      enforceSOLID: securityLevel !== 'basic',
      minTestCoverage: this.getMinTestCoverage(securityLevel),
      enableAutoFix: true,
      projectType: 'general'
    };

    return { ...baseConfig, ...override };
  }

  /**
   * Get default compliance requirements for security level
   */
  private getDefaultCompliance(securityLevel: SecurityLevel): ComplianceRequirement[] {
    switch (securityLevel) {
      case 'critical':
        return ['OWASP_TOP_10_2023', 'PCI_DSS', 'GDPR', 'SOX'];
      case 'high':
        return ['OWASP_TOP_10_2023', 'GDPR'];
      case 'standard':
        return ['OWASP_TOP_10_2023'];
      case 'basic':
        return [];
      default:
        return ['OWASP_TOP_10_2023'];
    }
  }

  /**
   * Get minimum test coverage for security level
   */
  private getMinTestCoverage(securityLevel: SecurityLevel): number {
    switch (securityLevel) {
      case 'critical': return 98;
      case 'high': return 95;
      case 'standard': return 85;
      case 'basic': return 70;
      default: return 85;
    }
  }

  /**
   * Get template paths for security context
   */
  private async getTemplatePaths(config: ClaudeProcessSecurityConfig): Promise<string[]> {
    const templatePaths: string[] = [];
    
    // Always include security-enhanced templates
    const securityTemplatePath = join(process.cwd(), 'src', 'templates', 'security-enhanced');
    templatePaths.push(securityTemplatePath);
    
    // Add SPARC templates for methodology
    const sparcTemplatePath = join(process.cwd(), 'src', 'templates', 'claude-optimized');
    templatePaths.push(sparcTemplatePath);
    
    // Add project-specific templates if available
    if (config.projectType && config.projectType !== 'general') {
      const projectTemplatePath = join(process.cwd(), 'src', 'templates', config.projectType);
      templatePaths.push(projectTemplatePath);
    }
    
    return templatePaths;
  }

  /**
   * Build security-enhanced environment variables
   */
  private async buildSecurityEnvironment(
    context: ClaudeSpawnContext,
    config: ClaudeProcessSecurityConfig
  ): Promise<Record<string, string>> {
    const env: Record<string, string> = {
      // Base FlowX environment
      ...process.env,
      
      // Security framework activation
      SECURE_AGENT_MODE: 'true',
      SECURITY_LEVEL: config.securityLevel,
      OWASP_COMPLIANCE: 'TOP_10_2023',
      
      // Compliance requirements
      COMPLIANCE_REQUIREMENTS: config.complianceRequirements.join(','),
      
      // Architecture enforcement
      ENFORCE_CLEAN_ARCHITECTURE: config.enforceCleanArchitecture.toString(),
      ENFORCE_HEXAGONAL: config.enforceCleanArchitecture.toString(),
      ENFORCE_SOLID: config.enforceSOLID.toString(),
      
      // Testing requirements
      MIN_TEST_COVERAGE: config.minTestCoverage.toString(),
      REQUIRE_TESTS: 'true',
      
      // Security automation
      ENABLE_AUTO_FIX: config.enableAutoFix.toString(),
      SECURITY_VALIDATION: 'real-time',
      
      // Template paths
      SECURITY_TEMPLATES_PATH: join(process.cwd(), 'src', 'templates', 'security-enhanced'),
      SPARC_TEMPLATES_PATH: join(process.cwd(), 'src', 'templates', 'claude-optimized'),
      
      // CSA reference
      CSA_SECURE_CODING_GUIDE: 'https://cloudsecurityalliance.org/blog/2024/11/19/secure-vibe-coding-best-practices-for-secure-application-development',
      
      // Context-specific variables
      CLAUDE_INSTANCE_ID: context.instanceId,
      CLAUDE_TASK_TYPE: this.inferTaskType(context.task),
      CLAUDE_WORKING_DIRECTORY: context.workingDirectory,
    };

    // Add context-specific environment variables
    if (context.sessionId) {
      env.CLAUDE_SESSION_ID = context.sessionId;
    }
    
    if (context.swarmId) {
      env.CLAUDE_SWARM_ID = context.swarmId;
      env.CLAUDE_SWARM_MODE = 'true';
    }
    
    if (context.agentId) {
      env.CLAUDE_AGENT_ID = context.agentId;
      env.CLAUDE_AGENT_MODE = 'true';
    }
    
    if (context.agentType) {
      env.CLAUDE_AGENT_TYPE = context.agentType;
    }

    return env;
  }

  /**
   * Generate comprehensive security-enhanced system prompt
   */
  private async generateSecurityEnhancedPrompt(
    context: ClaudeSpawnContext,
    config: ClaudeProcessSecurityConfig,
    originalTask: string
  ): Promise<string> {
    // Create the proper context for the secure coder agent
    const secureContext: SecureCodeGenerationContext = {
      projectType: this.inferProjectType(originalTask),
      securityLevel: config.securityLevel,
      complianceRequirements: config.complianceRequirements,
      architecture: this.inferArchitecture(originalTask),
      cloudProvider: this.inferCloudProvider(originalTask),
      language: this.inferLanguage(originalTask),
      framework: this.inferFramework(originalTask)
    };

    const systemPrompt = await this.secureAgent.generateSecureSystemPrompt(secureContext);
    
    // Enhance with context-specific information
    const enhancedPrompt = `${systemPrompt}

## CURRENT TASK CONTEXT

**Original Task:** ${originalTask}

**Execution Context:**
- Instance ID: ${context.instanceId}
- Working Directory: ${context.workingDirectory}
- Security Level: ${config.securityLevel}
- Compliance: ${config.complianceRequirements.join(', ')}
${context.isSwarmMode ? `- Swarm Mode: Active (Swarm ID: ${context.swarmId})` : ''}
${context.isAgentMode ? `- Agent Mode: Active (Agent ID: ${context.agentId}, Type: ${context.agentType})` : ''}

## SECURITY-FIRST APPROACH

🛡️ **MANDATORY SECURITY REQUIREMENTS:**
1. All code MUST follow OWASP Top 10 2023 guidelines
2. Input validation is REQUIRED for all user inputs
3. Output encoding is MANDATORY for all outputs
4. Authentication and authorization MUST be implemented correctly
5. Secure configuration practices MUST be followed
6. Error handling MUST NOT leak sensitive information
7. Logging and monitoring MUST be security-aware

🏗️ **CLEAN ARCHITECTURE ENFORCEMENT:**
- Follow SOLID principles strictly
- Implement proper dependency injection
- Maintain clear separation of concerns
- Use hexagonal architecture patterns
- Ensure testability at all layers

🧪 **TESTING REQUIREMENTS:**
- Minimum ${config.minTestCoverage}% test coverage
- Include security-focused test cases
- Test edge cases and error conditions
- Validate input sanitization in tests

## AVAILABLE SECURITY TOOLS AND TEMPLATES

You have access to security-enhanced templates and patterns in:
- ${join(process.cwd(), 'src', 'templates', 'security-enhanced')}
- ${join(process.cwd(), 'src', 'templates', 'claude-optimized')}

These include:
- OWASP prevention patterns
- AWS security configurations
- Secure TypeScript patterns
- Input validation utilities
- Security testing templates

## EXECUTION INSTRUCTIONS

1. **Start with security analysis** of the task requirements
2. **Design secure architecture** before implementing
3. **Implement with security patterns** from the templates
4. **Validate security compliance** throughout development
5. **Test thoroughly** including security test cases
6. **Document security considerations** in your implementation

Remember: Security is not optional - it's the foundation of everything you build.`;

    return enhancedPrompt;
  }

  /**
   * Infer task type from task description
   */
  private inferTaskType(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('api') || taskLower.includes('backend')) return 'backend';
    if (taskLower.includes('ui') || taskLower.includes('frontend')) return 'frontend';
    if (taskLower.includes('test') || taskLower.includes('testing')) return 'testing';
    if (taskLower.includes('security') || taskLower.includes('audit')) return 'security';
    if (taskLower.includes('database') || taskLower.includes('data')) return 'data';
    if (taskLower.includes('deploy') || taskLower.includes('infra')) return 'infrastructure';
    if (taskLower.includes('research') || taskLower.includes('analyze')) return 'research';
    
    return 'general';
  }

  /**
   * Infer project type from task description
   */
  private inferProjectType(task: string): 'web-app' | 'api' | 'lambda' | 'microservice' | 'cli' | 'library' {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('lambda') || taskLower.includes('serverless')) return 'lambda';
    if (taskLower.includes('api') || taskLower.includes('rest') || taskLower.includes('graphql')) return 'api';
    if (taskLower.includes('microservice') || taskLower.includes('service')) return 'microservice';
    if (taskLower.includes('cli') || taskLower.includes('command')) return 'cli';
    if (taskLower.includes('library') || taskLower.includes('package')) return 'library';
    if (taskLower.includes('web') || taskLower.includes('app')) return 'web-app';
    
    return 'web-app'; // Default
  }

  /**
   * Infer architecture from task description
   */
  private inferArchitecture(task: string): 'monolith' | 'microservices' | 'serverless' | 'hybrid' {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('serverless') || taskLower.includes('lambda')) return 'serverless';
    if (taskLower.includes('microservice') || taskLower.includes('micro-service')) return 'microservices';
    if (taskLower.includes('monolith')) return 'monolith';
    if (taskLower.includes('hybrid')) return 'hybrid';
    
    return 'monolith'; // Default
  }

  /**
   * Infer cloud provider from task description
   */
  private inferCloudProvider(task: string): 'aws' | 'gcp' | 'azure' | 'multi-cloud' | 'on-premise' {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('aws') || taskLower.includes('amazon')) return 'aws';
    if (taskLower.includes('gcp') || taskLower.includes('google cloud')) return 'gcp';
    if (taskLower.includes('azure') || taskLower.includes('microsoft')) return 'azure';
    if (taskLower.includes('multi-cloud')) return 'multi-cloud';
    if (taskLower.includes('on-premise') || taskLower.includes('on-prem')) return 'on-premise';
    
    return 'aws'; // Default to AWS
  }

  /**
   * Infer programming language from task description
   */
  private inferLanguage(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('typescript') || taskLower.includes('ts')) return 'typescript';
    if (taskLower.includes('javascript') || taskLower.includes('js')) return 'javascript';
    if (taskLower.includes('python') || taskLower.includes('py')) return 'python';
    if (taskLower.includes('java')) return 'java';
    if (taskLower.includes('go') || taskLower.includes('golang')) return 'go';
    if (taskLower.includes('rust')) return 'rust';
    if (taskLower.includes('c#') || taskLower.includes('csharp')) return 'csharp';
    
    return 'typescript'; // Default
  }

  /**
   * Infer framework from task description
   */
  private inferFramework(task: string): string | undefined {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('react')) return 'react';
    if (taskLower.includes('vue')) return 'vue';
    if (taskLower.includes('angular')) return 'angular';
    if (taskLower.includes('svelte')) return 'svelte';
    if (taskLower.includes('express')) return 'express';
    if (taskLower.includes('fastify')) return 'fastify';
    if (taskLower.includes('nest')) return 'nestjs';
    if (taskLower.includes('django')) return 'django';
    if (taskLower.includes('flask')) return 'flask';
    if (taskLower.includes('spring')) return 'spring';
    
    return undefined;
  }

  /**
   * Fallback args in case of error
   */
  private buildFallbackArgs(baseArgs: string[], context: ClaudeSpawnContext): EnhancedClaudeArgs {
    return {
      args: [
        ...baseArgs,
        '--model', DEFAULT_MODEL_ID,
        // Note: --temperature not supported by Claude CLI, only API
        // '--temperature', '0.1',
        '--dangerously-skip-permissions'
      ],
      env: {
        ...process.env,
        SECURE_AGENT_MODE: 'basic',
        SECURITY_LEVEL: 'standard',
        CLAUDE_INSTANCE_ID: context.instanceId
      },
      systemPrompt: `${baseArgs[0]}\n\nPlease follow security best practices and clean code principles.`,
      templatePaths: []
    };
  }

  /**
   * Factory method for creating secure agent wrapper
   */
  static async createSecureWrapper(): Promise<ClaudeProcessIntegration> {
    return new ClaudeProcessIntegration();
  }
}

/**
 * Convenience function to enhance Claude arguments with security
 */
export async function enhanceClaudeArgsWithSecurity(
  baseArgs: string[],
  context: ClaudeSpawnContext,
  securityConfig?: Partial<ClaudeProcessSecurityConfig>
): Promise<EnhancedClaudeArgs> {
  const integration = new ClaudeProcessIntegration();
  return integration.buildEnhancedClaudeArgs(baseArgs, context, securityConfig);
}

/**
 * Quick setup for different project types
 */
export const SecurityProfiles = {
  ENTERPRISE_WEB: {
    securityLevel: 'critical' as SecurityLevel,
    complianceRequirements: ['OWASP_TOP_10_2023', 'GDPR', 'SOX'] as ComplianceRequirement[],
    enforceCleanArchitecture: true,
    enforceSOLID: true,
    minTestCoverage: 95,
    enableAutoFix: true,
    projectType: 'enterprise-web' as const
  },
  
  FINANCIAL_API: {
    securityLevel: 'critical' as SecurityLevel,
    complianceRequirements: ['OWASP_TOP_10_2023', 'PCI_DSS', 'SOX'] as ComplianceRequirement[],
    enforceCleanArchitecture: true,
    enforceSOLID: true,
    minTestCoverage: 98,
    enableAutoFix: true,
    projectType: 'financial-api' as const
  },
  
  HEALTHCARE_APP: {
    securityLevel: 'critical' as SecurityLevel,
    complianceRequirements: ['OWASP_TOP_10_2023', 'HIPAA', 'GDPR'] as ComplianceRequirement[],
    enforceCleanArchitecture: true,
    enforceSOLID: true,
    minTestCoverage: 98,
    enableAutoFix: true,
    projectType: 'healthcare-app' as const
  },
  
  SERVERLESS_FUNCTIONS: {
    securityLevel: 'high' as SecurityLevel,
    complianceRequirements: ['OWASP_TOP_10_2023'] as ComplianceRequirement[],
    enforceCleanArchitecture: true,
    enforceSOLID: true,
    minTestCoverage: 90,
    enableAutoFix: true,
    projectType: 'serverless-functions' as const
  },
  
  DEVELOPMENT: {
    securityLevel: 'standard' as SecurityLevel,
    complianceRequirements: ['OWASP_TOP_10_2023'] as ComplianceRequirement[],
    enforceCleanArchitecture: true,
    enforceSOLID: true,
    minTestCoverage: 85,
    enableAutoFix: true,
    projectType: 'general' as const
  }
} as const; 