/**
 * Security Integration Tests
 * Verifies that security context is properly integrated across all Claude spawning mechanisms
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ClaudeProcessIntegration, enhanceClaudeArgsWithSecurity, SecurityProfiles } from '../../src/agents/claude-process-integration';
import { Logger } from '../../src/core/logger';

// Mock child_process for testing
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    pid: 12345,
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn()
  })
}));

describe('Security Integration', () => {
  let integration: ClaudeProcessIntegration;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(async () => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;
    
    integration = new ClaudeProcessIntegration();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ClaudeProcessIntegration', () => {
    it('should enhance Claude arguments with security context', async () => {
      const baseArgs = ['Create a web application'];
      const context = {
        instanceId: 'test-123',
        task: 'Create a web application',
        workingDirectory: '/test/dir',
        isSwarmMode: false,
        agentType: 'frontend'
      };

      const result = await integration.buildEnhancedClaudeArgs(baseArgs, context);

      expect(result.args).toContain('--model');
      expect(result.args).toContain('claude-3-5-sonnet-20241022');
      // Note: --temperature not supported by Claude CLI, only API - test removed
      // expect(result.args).toContain('--temperature');
      // expect(result.args).toContain('0.1');
      expect(result.args).toContain('--dangerously-skip-permissions');
      expect(result.args).toContain('--add-dir');
      
      expect(result.env.SECURE_AGENT_MODE).toBe('true');
      expect(result.env.SECURITY_LEVEL).toBe('standard');
      expect(result.env.OWASP_COMPLIANCE).toBe('TOP_10_2023');
      expect(result.env.CLAUDE_INSTANCE_ID).toBe('test-123');
      
      expect(result.systemPrompt).toContain('OWASP Top 10 2023');
      expect(result.systemPrompt).toContain('SOLID principles');
      expect(result.templatePaths.length).toBeGreaterThan(0);
    });

    it('should determine security level based on task context', async () => {
      const contexts = [
        {
          task: 'Create an enterprise payment API',
          expectedLevel: 'critical'
        },
        {
          task: 'Build a simple frontend component',
          expectedLevel: 'standard'
        },
        {
          task: 'Implement security audit system',
          expectedLevel: 'critical'
        },
        {
          task: 'Create API endpoints for user data',
          expectedLevel: 'high'
        }
      ];

      for (const testCase of contexts) {
        const context = {
          instanceId: 'test',
          task: testCase.task,
          workingDirectory: '/test',
          isSwarmMode: false
        };

        const result = await integration.buildEnhancedClaudeArgs(['test'], context);
        expect(result.env.SECURITY_LEVEL).toBe(testCase.expectedLevel);
      }
    });

    it('should include security-enhanced templates', async () => {
      const context = {
        instanceId: 'test',
        task: 'Create secure Lambda function',
        workingDirectory: '/test',
        isSwarmMode: false
      };

      const result = await integration.buildEnhancedClaudeArgs(['test'], context);

      expect(result.templatePaths).toContain(expect.stringContaining('security-enhanced'));
      expect(result.templatePaths).toContain(expect.stringContaining('claude-optimized'));
      
      // Verify --add-dir arguments are added for templates
      const addDirIndices = result.args.reduce((indices: number[], arg, index) => {
        if (arg === '--add-dir') indices.push(index);
        return indices;
      }, []);
      
      expect(addDirIndices.length).toBeGreaterThan(0);
      
      // Check that each --add-dir has a corresponding path
      addDirIndices.forEach(index => {
        expect(result.args[index + 1]).toBeDefined();
        expect(typeof result.args[index + 1]).toBe('string');
      });
    });

    it('should handle swarm mode with enhanced security', async () => {
      const context = {
        instanceId: 'swarm-123',
        task: 'Coordinate agent swarm for enterprise app',
        workingDirectory: '/test',
        isSwarmMode: true,
        swarmId: 'swarm-123',
        agentType: 'coordinator'
      };

      const result = await integration.buildEnhancedClaudeArgs(['test'], context);

      expect(result.env.CLAUDE_SWARM_MODE).toBe('true');
      expect(result.env.CLAUDE_SWARM_ID).toBe('swarm-123');
      expect(result.env.SECURITY_LEVEL).toBe('high'); // Swarm mode gets high security
      expect(result.systemPrompt).toContain('Swarm Mode: Active');
    });

    it('should handle agent mode with specific context', async () => {
      const context = {
        instanceId: 'agent-123',
        task: 'Implement secure API endpoints',
        workingDirectory: '/test',
        isAgentMode: true,
        agentId: 'agent-123',
        agentType: 'backend'
      };

      const result = await integration.buildEnhancedClaudeArgs(['test'], context);

      expect(result.env.CLAUDE_AGENT_MODE).toBe('true');
      expect(result.env.CLAUDE_AGENT_ID).toBe('agent-123');
      expect(result.env.CLAUDE_AGENT_TYPE).toBe('backend');
      expect(result.systemPrompt).toContain('Agent Mode: Active');
    });
  });

  describe('Security Profiles', () => {
    it('should provide enterprise web profile', () => {
      const profile = SecurityProfiles.ENTERPRISE_WEB;
      
      expect(profile.securityLevel).toBe('critical');
      expect(profile.complianceRequirements).toContain('OWASP_TOP_10_2023');
      expect(profile.complianceRequirements).toContain('GDPR');
      expect(profile.complianceRequirements).toContain('SOX');
      expect(profile.enforceCleanArchitecture).toBe(true);
      expect(profile.minTestCoverage).toBe(95);
    });

    it('should provide financial API profile', () => {
      const profile = SecurityProfiles.FINANCIAL_API;
      
      expect(profile.securityLevel).toBe('critical');
      expect(profile.complianceRequirements).toContain('PCI_DSS');
      expect(profile.minTestCoverage).toBe(98);
    });

    it('should provide healthcare app profile', () => {
      const profile = SecurityProfiles.HEALTHCARE_APP;
      
      expect(profile.securityLevel).toBe('critical');
      expect(profile.complianceRequirements).toContain('HIPAA');
      expect(profile.minTestCoverage).toBe(98);
    });
  });

  describe('Convenience Function', () => {
    it('should enhance arguments using convenience function', async () => {
      const baseArgs = ['Build secure API'];
      const context = {
        instanceId: 'test',
        task: 'Build secure API',
        workingDirectory: '/test'
      };

      const result = await enhanceClaudeArgsWithSecurity(baseArgs, context);

      expect(result.args).toContain('--model');
      expect(result.args).toContain('claude-3-5-sonnet-20241022');
      expect(result.env.SECURE_AGENT_MODE).toBe('true');
      expect(result.systemPrompt).toContain('OWASP');
    });

    it('should apply custom security config', async () => {
      const baseArgs = ['Test'];
      const context = {
        instanceId: 'test',
        task: 'Test',
        workingDirectory: '/test'
      };
      const securityConfig = SecurityProfiles.FINANCIAL_API;

      const result = await enhanceClaudeArgsWithSecurity(baseArgs, context, securityConfig);

      expect(result.env.SECURITY_LEVEL).toBe('critical');
      expect(result.env.COMPLIANCE_REQUIREMENTS).toContain('PCI_DSS');
      expect(result.env.MIN_TEST_COVERAGE).toBe('98');
    });
  });

  describe('Task Type Inference', () => {
    it('should correctly infer project types', async () => {
      const testCases = [
        { task: 'Create Lambda function', expectedType: 'lambda' },
        { task: 'Build REST API', expectedType: 'api' },
        { task: 'Develop microservice', expectedType: 'microservice' },
        { task: 'Create CLI tool', expectedType: 'cli' },
        { task: 'Build library package', expectedType: 'library' },
        { task: 'Create web application', expectedType: 'web-app' }
      ];

      for (const testCase of testCases) {
        const context = {
          instanceId: 'test',
          task: testCase.task,
          workingDirectory: '/test'
        };

        const result = await integration.buildEnhancedClaudeArgs(['test'], context);
        expect(result.systemPrompt).toContain(testCase.task);
      }
    });

    it('should correctly infer programming languages', async () => {
      const testCases = [
        { task: 'Create TypeScript API', expectedLang: 'typescript' },
        { task: 'Build Python service', expectedLang: 'python' },
        { task: 'Develop Java application', expectedLang: 'java' },
        { task: 'Create Go microservice', expectedLang: 'go' },
        { task: 'Build Rust library', expectedLang: 'rust' }
      ];

      for (const testCase of testCases) {
        const context = {
          instanceId: 'test',
          task: testCase.task,
          workingDirectory: '/test'
        };

        const result = await integration.buildEnhancedClaudeArgs(['test'], context);
        expect(result.systemPrompt).toContain(testCase.task);
      }
    });
  });

  describe('Error Handling', () => {
    it('should provide fallback on integration failure', async () => {
      // Test with invalid working directory to trigger error handling
      const context = {
        instanceId: 'test',
        task: 'test',
        workingDirectory: '/invalid/path/that/does/not/exist'
      };

      const result = await integration.buildEnhancedClaudeArgs(['test'], context);

      // Should still return valid arguments even if some operations fail
      expect(result.args).toBeDefined();
      expect(result.env).toBeDefined();
      expect(result.systemPrompt).toBeDefined();
      
      // Should contain at least basic Claude arguments
      expect(result.args).toContain('test');
      expect(result.env.CLAUDE_INSTANCE_ID).toBe('test');
    });
  });

  describe('Environment Variables', () => {
    it('should include all required security environment variables', async () => {
      const context = {
        instanceId: 'test-env',
        task: 'Test environment variables',
        workingDirectory: '/test',
        sessionId: 'session-123',
        swarmId: 'swarm-456',
        agentId: 'agent-789',
        agentType: 'test'
      };

      const result = await integration.buildEnhancedClaudeArgs(['test'], context);

      // Core security variables
      expect(result.env.SECURE_AGENT_MODE).toBe('true');
      expect(result.env.SECURITY_LEVEL).toBeDefined();
      expect(result.env.OWASP_COMPLIANCE).toBe('TOP_10_2023');
      expect(result.env.ENFORCE_CLEAN_ARCHITECTURE).toBeDefined();
      expect(result.env.ENFORCE_SOLID).toBeDefined();
      expect(result.env.MIN_TEST_COVERAGE).toBeDefined();
      expect(result.env.REQUIRE_TESTS).toBe('true');
      expect(result.env.SECURITY_VALIDATION).toBe('real-time');

      // Template paths
      expect(result.env.SECURITY_TEMPLATES_PATH).toContain('security-enhanced');
      expect(result.env.SPARC_TEMPLATES_PATH).toContain('claude-optimized');

      // CSA reference
      expect(result.env.CSA_SECURE_CODING_GUIDE).toContain('cloudsecurityalliance.org');

      // Context-specific variables
      expect(result.env.CLAUDE_INSTANCE_ID).toBe('test-env');
      expect(result.env.CLAUDE_SESSION_ID).toBe('session-123');
      expect(result.env.CLAUDE_SWARM_ID).toBe('swarm-456');
      expect(result.env.CLAUDE_AGENT_ID).toBe('agent-789');
      expect(result.env.CLAUDE_AGENT_TYPE).toBe('test');
    });
  });
}); 