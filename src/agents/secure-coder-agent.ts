/**
 * Secure Coder Agent Framework
 * Integrates CSA (Cloud Security Alliance) guidelines and R.A.I.L.G.U.A.R.D principles
 * Ensures all generated code follows secure-by-default patterns and clean architecture
 */

import { EventEmitter } from 'node:events';
import { ILogger } from '../core/logger.js';
import { AgentProcessConfig } from './agent-process-manager.js';
import { ModelSelector, DEFAULT_MODEL_ID } from '../config/models.js';

export interface SecureCoderConfig {
  // Security Standards
  enableCSAGuidelines: boolean;
  enableOWASPCompliance: boolean;
  enableAWSSecurityPatterns: boolean;
  enableCleanArchitecture: boolean;
  enableRAILGUARDPrinciples: boolean;
  
  // Code Quality Requirements
  minTestCoverage: number; // Default: 95%
  enforceTypeSafety: boolean;
  enableSecurityLinting: boolean;
  requireSecurityReviews: boolean;
  
  // Architecture Patterns
  enforceSOLIDPrinciples: boolean;
  requireHexagonalArchitecture: boolean;
  enableDependencyInjection: boolean;
  enforceImmutability: boolean;
  
  // AWS Specific
  enforceIAMLeastPrivilege: boolean;
  enableSecretsManager: boolean;
  requireEncryptionAtRest: boolean;
  enableCloudTrailLogging: boolean;
}

export interface SecureCodeGenerationContext {
  projectType: 'web-app' | 'api' | 'lambda' | 'microservice' | 'cli' | 'library';
  securityLevel: 'basic' | 'standard' | 'high' | 'critical';
  complianceRequirements: string[]; // ['PCI-DSS', 'SOX', 'HIPAA', 'GDPR']
  architecture: 'monolith' | 'microservices' | 'serverless' | 'hybrid';
  cloudProvider: 'aws' | 'gcp' | 'azure' | 'multi-cloud' | 'on-premise';
  language: string;
  framework?: string;
}

export class SecureCoderAgent extends EventEmitter {
  private logger: ILogger;
  private config: SecureCoderConfig;
  
  constructor(logger: ILogger, config: Partial<SecureCoderConfig> = {}) {
    super();
    this.logger = logger;
    this.config = {
      enableCSAGuidelines: true,
      enableOWASPCompliance: true,
      enableAWSSecurityPatterns: true,
      enableCleanArchitecture: true,
      enableRAILGUARDPrinciples: true,
      minTestCoverage: 95,
      enforceTypeSafety: true,
      enableSecurityLinting: true,
      requireSecurityReviews: true,
      enforceSOLIDPrinciples: true,
      requireHexagonalArchitecture: true,
      enableDependencyInjection: true,
      enforceImmutability: true,
      enforceIAMLeastPrivilege: true,
      enableSecretsManager: true,
      requireEncryptionAtRest: true,
      enableCloudTrailLogging: true,
      ...config
    };
  }

  /**
   * Generate secure agent configuration with embedded security rules
   */
  generateSecureAgentConfig(
    baseConfig: AgentProcessConfig,
    context: SecureCodeGenerationContext
  ): AgentProcessConfig {
    const securityRules = this.buildSecurityRules(context);
    const architecturePatterns = this.buildArchitecturePatterns(context);
    const awsSecurityConfig = this.buildAWSSecurityConfiguration(context);
    
    return {
      ...baseConfig,
      environment: {
        ...baseConfig.environment,
        
        // Security Standards
        SECURITY_FRAMEWORK: 'CSA_RAILGUARD',
        OWASP_COMPLIANCE: 'TOP_10_2023',
        SECURITY_LEVEL: context.securityLevel,
        COMPLIANCE_REQUIREMENTS: context.complianceRequirements.join(','),
        
        // Clean Architecture
        ARCHITECTURE_PATTERN: context.architecture,
        ENFORCE_HEXAGONAL: this.config.requireHexagonalArchitecture.toString(),
        ENFORCE_SOLID: this.config.enforceSOLIDPrinciples.toString(),
        DEPENDENCY_INJECTION: this.config.enableDependencyInjection.toString(),
        
        // Code Quality
        MIN_TEST_COVERAGE: this.config.minTestCoverage.toString(),
        ENFORCE_TYPE_SAFETY: this.config.enforceTypeSafety.toString(),
        IMMUTABILITY_REQUIRED: this.config.enforceImmutability.toString(),
        
        // AWS Security
        IAM_LEAST_PRIVILEGE: this.config.enforceIAMLeastPrivilege.toString(),
        USE_SECRETS_MANAGER: this.config.enableSecretsManager.toString(),
        ENCRYPTION_AT_REST: this.config.requireEncryptionAtRest.toString(),
        CLOUDTRAIL_LOGGING: this.config.enableCloudTrailLogging.toString(),
        
        // Serialized configurations
        SECURITY_RULES: JSON.stringify(securityRules),
        ARCHITECTURE_PATTERNS: JSON.stringify(architecturePatterns),
        AWS_SECURITY_CONFIG: JSON.stringify(awsSecurityConfig),
        
        // Template locations
        SECURITY_TEMPLATES_PATH: 'src/templates/security-enhanced',
        SPARC_TEMPLATES_PATH: 'src/templates/claude-optimized/.claude',
        
        // R.A.I.L.G.U.A.R.D Principles
        RAILGUARD_RELIABILITY: 'true',
        RAILGUARD_AVAILABILITY: 'true', 
        RAILGUARD_INTEGRITY: 'true',
        RAILGUARD_LEGALITY: 'true',
        RAILGUARD_GOVERNANCE: 'true',
        RAILGUARD_USABILITY: 'true',
        RAILGUARD_AUDITABILITY: 'true',
        RAILGUARD_RESILIENCE: 'true',
        RAILGUARD_DEFENSIBILITY: 'true'
      },
      claudeConfig: {
        ...baseConfig.claudeConfig,
        temperature: 0.1, // Lower temperature for more deterministic secure code
        maxTokens: 8192,
        model: ModelSelector.getBestForCoding().id // Latest model for best security understanding
      }
    };
  }

  /**
   * Build comprehensive security rules based on CSA and OWASP guidelines
   */
  private buildSecurityRules(context: SecureCodeGenerationContext): any {
    return {
      // CSA Cloud Security Guidelines
      csa: {
        governanceAndRiskManagement: {
          enabled: true,
          requireRiskAssessment: context.securityLevel !== 'basic',
          enforceComplianceFramework: context.complianceRequirements.length > 0
        },
        legalAndCompliance: {
          enabled: true,
          requirements: context.complianceRequirements,
          dataLocalization: context.cloudProvider !== 'multi-cloud',
          privacyByDesign: true
        },
        informationSecurityManagement: {
          enabled: true,
          classification: context.securityLevel,
          dataHandling: {
            encryption: this.config.requireEncryptionAtRest,
            masking: true,
            anonymization: context.complianceRequirements.includes('GDPR')
          }
        }
      },
      
      // OWASP Top 10 2023
      owasp: {
        a01_brokenAccessControl: {
          enforceRBAC: true,
          defaultDeny: true,
          principleOfLeastPrivilege: true,
          sessionManagement: context.projectType === 'web-app'
        },
        a02_cryptographicFailures: {
          enforceEncryption: true,
          algorithmWhitelist: ['AES-256-GCM', 'ChaCha20-Poly1305'],
          saltedHashing: true,
          secureRandom: true
        },
        a03_injection: {
          parameterizedQueries: true,
          inputValidation: true,
          outputEncoding: true,
          sqlInjectionPrevention: true,
          noSQLInjectionPrevention: true
        },
        a04_insecureDesign: {
          threatModeling: context.securityLevel !== 'basic',
          secureDesignPatterns: true,
          defenseProgramming: true
        },
        a05_securityMisconfiguration: {
          secureDefaults: true,
          configurationManagement: true,
          environmentSeparation: true,
          headerSecurity: context.projectType === 'web-app'
        },
        a06_vulnerableComponents: {
          dependencyScanning: true,
          versionControl: true,
          securityPatches: true,
          supplychainSecurity: true
        },
        a07_authenticationFailures: {
          multiFactorAuth: context.securityLevel !== 'basic',
          strongPasswords: true,
          sessionSecurity: true,
          bruteForceProtection: true
        },
        a08_softwareIntegrityFailures: {
          codeSignature: context.securityLevel === 'critical',
          dependencyIntegrity: true,
          cicdSecurity: true
        },
        a09_loggingMonitoringFailures: {
          securityLogging: true,
          monitoring: true,
          alerting: context.securityLevel !== 'basic',
          auditTrails: true
        },
        a10_ssrf: {
          urlValidation: true,
          networkSegmentation: true,
          allowlistingApproach: true
        }
      },
      
      // Language-specific security rules
      languageSpecific: this.getLanguageSpecificRules(context.language),
      
      // Framework-specific security rules
      frameworkSpecific: context.framework ? this.getFrameworkSpecificRules(context.framework) : {}
    };
  }

  /**
   * Build clean architecture patterns and SOLID principles
   */
  private buildArchitecturePatterns(context: SecureCodeGenerationContext): any {
    return {
      // SOLID Principles
      solid: {
        singleResponsibility: {
          enabled: this.config.enforceSOLIDPrinciples,
          maxMethodsPerClass: 10,
          maxLinesPerMethod: 20,
          cohesionChecks: true
        },
        openClosed: {
          enabled: this.config.enforceSOLIDPrinciples,
          preferComposition: true,
          interfaceSegregation: true,
          strategyPattern: true
        },
        liskovSubstitution: {
          enabled: this.config.enforceSOLIDPrinciples,
          contractChecking: true,
          behaviorPreservation: true
        },
        interfaceSegregation: {
          enabled: this.config.enforceSOLIDPrinciples,
          smallInterfaces: true,
          clientSpecificInterfaces: true
        },
        dependencyInversion: {
          enabled: this.config.enableDependencyInjection,
          abstractionLayers: true,
          injectionContainers: true
        }
      },
      
      // Clean Architecture Layers
      cleanArchitecture: {
        enabled: this.config.enableCleanArchitecture,
        layers: {
          domain: {
            entities: true,
            valueObjects: true,
            domainServices: true,
            businessRules: true
          },
          application: {
            useCases: true,
            applicationServices: true,
            inputPorts: true,
            outputPorts: true
          },
          infrastructure: {
            repositories: true,
            externalServices: true,
            frameworks: true,
            drivers: true
          },
          interfaces: {
            controllers: true,
            presenters: true,
            gateways: true
          }
        },
        dependencyRule: {
          onlyInward: true,
          noCrossBoundaryDependencies: true,
          interfaceAbstractions: true
        }
      },
      
      // Hexagonal Architecture
      hexagonal: {
        enabled: this.config.requireHexagonalArchitecture,
        ports: {
          inputPorts: true,
          outputPorts: true,
          adapters: true
        },
        isolation: {
          businessLogic: true,
          externalConcerns: true,
          testability: true
        }
      },
      
      // Design Patterns
      designPatterns: {
        repository: context.projectType !== 'cli',
        factory: true,
        builder: true,
        observer: true,
        strategy: true,
        command: true,
        decorator: true
      }
    };
  }

  /**
   * Build AWS-specific security configuration
   */
  private buildAWSSecurityConfiguration(context: SecureCodeGenerationContext): any {
    if (context.cloudProvider !== 'aws') {
      return {};
    }

    return {
      iam: {
        leastPrivilege: this.config.enforceIAMLeastPrivilege,
        roleBased: true,
        assumeRolePattern: true,
        crossAccountAccess: false,
        mfaRequired: context.securityLevel !== 'basic'
      },
      
      secrets: {
        useSecretsManager: this.config.enableSecretsManager,
        noHardcodedSecrets: true,
        rotationPolicy: true,
        encryptionInTransit: true
      },
      
      encryption: {
        atRest: this.config.requireEncryptionAtRest,
        inTransit: true,
        kmsManaged: true,
        customerManagedKeys: context.securityLevel === 'critical'
      },
      
      logging: {
        cloudTrail: this.config.enableCloudTrailLogging,
        vpcFlowLogs: true,
        applicationLogs: true,
        securityEventLogging: true
      },
      
      networking: {
        vpcIsolation: context.architecture === 'microservices',
        securityGroups: true,
        nacls: context.securityLevel !== 'basic',
        privateSubnets: true
      },
      
      lambda: context.projectType === 'lambda' ? {
        runtimeSecurity: true,
        layerSecurity: true,
        environmentVariables: false, // Use Secrets Manager instead
        deadLetterQueues: true,
        errorHandling: true
      } : {}
    };
  }

  /**
   * Get language-specific security rules
   */
  private getLanguageSpecificRules(language: string): any {
    const rules: Record<string, any> = {
      typescript: {
        strictMode: true,
        noImplicitAny: true,
        noImplicitReturns: true,
        typeChecking: true,
        eslintSecurity: true,
        dependencyValidation: true
      },
      
      javascript: {
        strictMode: true,
        eslintSecurity: true,
        prototypeProtection: true,
        evalRestrictions: true,
        jsonSanitization: true
      },
      
      python: {
        banditSecurity: true,
        typingEnforcement: true,
        sqlAlchemyORM: true,
        flaskSecurity: true,
        requestsValidation: true
      },
      
      java: {
        spotBugsSecurity: true,
        owasp: true,
        springSecurityConfig: true,
        jwtValidation: true,
        hibernateConfig: true
      },
      
      go: {
        gosecSecurity: true,
        memoryManagement: true,
        concurrencySafety: true,
        httpSecurity: true
      }
    };

    return rules[language.toLowerCase()] || {};
  }

  /**
   * Get framework-specific security rules
   */
  private getFrameworkSpecificRules(framework: string): any {
    const rules: Record<string, any> = {
      express: {
        helmet: true,
        rateLimiting: true,
        cors: true,
        sessionSecurity: true,
        bodyParserLimits: true
      },
      
      fastify: {
        rateLimiting: true,
        cors: true,
        helmetSecurity: true,
        multipart: true
      },
      
      nestjs: {
        guards: true,
        interceptors: true,
        pipes: true,
        middleware: true,
        passport: true
      },
      
      spring: {
        springSecurity: true,
        methodSecurity: true,
        webSecurity: true,
        oauth2: true,
        jwt: true
      },
      
      django: {
        middlewareSecurity: true,
        csrf: true,
        xss: true,
        sqlInjection: true,
        authentication: true
      },
      
      flask: {
        flaskSecurity: true,
        flaskLogin: true,
        flaskWTF: true,
        flaskCORS: true
      }
    };

    return rules[framework.toLowerCase()] || {};
  }

  /**
   * Generate system prompt with embedded security context
   */
  generateSecureSystemPrompt(context: SecureCodeGenerationContext): string {
    return `You are a SECURE CODER AGENT with expertise in building mission-critical, enterprise-grade applications that follow the highest security standards.

## 🔐 SECURITY FRAMEWORKS YOU MUST FOLLOW:

### Cloud Security Alliance (CSA) Guidelines:
- Governance and Risk Management
- Legal and Compliance (${context.complianceRequirements.join(', ')})
- Information Security Management
- Human Resources Security
- Physical and Environmental Security
- Communications and Operations Management
- Access Control
- Systems Development and Maintenance
- Business Continuity Management
- Compliance

### R.A.I.L.G.U.A.R.D Security Principles:
- **R**eliability: Build fault-tolerant systems
- **A**vailability: Ensure 99.9%+ uptime
- **I**ntegrity: Maintain data accuracy and consistency
- **L**egality: Comply with all regulations (${context.complianceRequirements.join(', ')})
- **G**overnance: Implement proper oversight
- **U**sability: Secure but user-friendly
- **A**uditability: Complete audit trails
- **R**esilience: Self-healing systems
- **D**efensibility: Defense in depth

### OWASP Top 10 2023 - MANDATORY PREVENTION:
1. Broken Access Control → Implement RBAC with default deny
2. Cryptographic Failures → Use AES-256-GCM, proper key management
3. Injection → Parameterized queries, input validation, output encoding
4. Insecure Design → Threat modeling, secure design patterns
5. Security Misconfiguration → Secure defaults, configuration management
6. Vulnerable Components → Dependency scanning, version control
7. Authentication Failures → MFA, strong passwords, session security
8. Software Integrity Failures → Code signing, dependency integrity
9. Logging & Monitoring Failures → Security logging, monitoring, alerting
10. SSRF → URL validation, network segmentation

## 🏗️ CLEAN ARCHITECTURE REQUIREMENTS:

### SOLID Principles (MANDATORY):
- **S**ingle Responsibility: One reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Subtypes must be substitutable
- **I**nterface Segregation: Client-specific interfaces
- **D**ependency Inversion: Depend on abstractions

### Hexagonal Architecture:
- Domain layer isolated from external concerns
- Input/Output ports and adapters
- Business logic independent of frameworks
- Testable architecture with dependency injection

### Clean Code Standards:
- Functions < 20 lines
- Classes < 200 lines
- Files < 500 lines
- Meaningful names, no abbreviations
- Pure functions when possible
- Immutable data structures
- Comprehensive error handling

## 🔧 TECHNICAL REQUIREMENTS:

### Security Level: ${context.securityLevel.toUpperCase()}
### Project Type: ${context.projectType}
### Architecture: ${context.architecture}
### Cloud Provider: ${context.cloudProvider}
### Language: ${context.language}
${context.framework ? `### Framework: ${context.framework}` : ''}

### Code Quality Standards:
- Test Coverage: Minimum ${this.config.minTestCoverage}%
- Type Safety: ${this.config.enforceTypeSafety ? 'REQUIRED' : 'Optional'}
- Security Linting: ${this.config.enableSecurityLinting ? 'ENABLED' : 'Disabled'}
- Immutability: ${this.config.enforceImmutability ? 'ENFORCED' : 'Optional'}

### AWS Security (if applicable):
- IAM Least Privilege: ${this.config.enforceIAMLeastPrivilege ? 'ENFORCED' : 'Optional'}
- Secrets Manager: ${this.config.enableSecretsManager ? 'REQUIRED' : 'Optional'}  
- Encryption at Rest: ${this.config.requireEncryptionAtRest ? 'REQUIRED' : 'Optional'}
- CloudTrail Logging: ${this.config.enableCloudTrailLogging ? 'ENABLED' : 'Disabled'}

## 📋 MANDATORY DELIVERABLES:

1. **Secure Code**: Follow all security frameworks above
2. **Clean Architecture**: Implement hexagonal/clean architecture patterns  
3. **Comprehensive Tests**: ${this.config.minTestCoverage}% coverage minimum
4. **Security Documentation**: Document all security controls
5. **Compliance Evidence**: Show compliance with ${context.complianceRequirements.join(', ')}
6. **Performance**: Sub-100ms response times for APIs
7. **Monitoring**: Health checks and security monitoring
8. **Error Handling**: Secure error responses without data leakage

## 🚨 SECURITY-FIRST APPROACH:

- NEVER hardcode secrets, credentials, or sensitive data
- ALWAYS validate input and sanitize output
- ALWAYS use parameterized queries
- ALWAYS implement proper authentication and authorization
- ALWAYS encrypt sensitive data at rest and in transit
- ALWAYS implement comprehensive logging and monitoring
- ALWAYS follow the principle of least privilege
- ALWAYS implement proper error handling without information disclosure

Remember: Security is not optional. Every line of code must meet enterprise security standards. If you're unsure about a security control, choose the most secure option.`;
  }

  /**
   * Generate Claude CLI arguments with security context
   */
  generateSecureClaudeArgs(
    prompt: string,
    context: SecureCodeGenerationContext,
    workingDirectory: string
  ): string[] {
    const systemPrompt = this.generateSecureSystemPrompt(context);
    const combinedPrompt = `${systemPrompt}\n\n---\n\nUser Request: ${prompt}`;
    
    return [
      combinedPrompt,
      // Note: --model not supported in Claude CLI v1.0.56
      // '--model', ModelSelector.getBestForCoding().id,
      // Note: --temperature not supported by Claude CLI, only API
      // '--temperature', '0.1',
      // Note: --max-tokens not supported by Claude CLI, only API
      // '--max-tokens', '8192',
      // Note: --add-dir not supported in Claude CLI v1.0.56
      // '--add-dir', workingDirectory,
      // '--add-dir', 'src/templates/security-enhanced',
      // '--add-dir', 'src/templates/claude-optimized/.claude',
      '--dangerously-skip-permissions' // For automation in enterprise environments
    ];
  }
}

/**
 * Factory function to create secure coder agent configurations
 */
export function createSecureCoderAgent(
  logger: ILogger,
  context: SecureCodeGenerationContext,
  config: Partial<SecureCoderConfig> = {}
): SecureCoderAgent {
  return new SecureCoderAgent(logger, {
    // Default to highest security for enterprise use
    enableCSAGuidelines: true,
    enableOWASPCompliance: true,
    enableAWSSecurityPatterns: context.cloudProvider === 'aws',
    enableCleanArchitecture: true,
    enableRAILGUARDPrinciples: true,
    minTestCoverage: context.securityLevel === 'critical' ? 98 : 95,
    enforceTypeSafety: true,
    enableSecurityLinting: true,
    requireSecurityReviews: context.securityLevel !== 'basic',
    enforceSOLIDPrinciples: true,
    requireHexagonalArchitecture: context.architecture !== 'monolith',
    enableDependencyInjection: true,
    enforceImmutability: context.language === 'typescript' || context.language === 'javascript',
    ...config
  });
} 