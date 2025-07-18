/**
 * Unit tests for AgentBehaviorRegistry
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AgentBehaviorRegistry, SpecializedAgentBehavior } from '../../../../src/agents/specialized-behaviors/agent-behavior-registry';
import { AgentType } from '../../../../src/hive-mind/types';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('AgentBehaviorRegistry', () => {
  let registry: AgentBehaviorRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new AgentBehaviorRegistry(mockLogger as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Behavior Configuration', () => {
    it('should have behaviors defined for all standard agent types', () => {
      const standardTypes: AgentType[] = [
        'architect', 'coder', 'tester', 'security', 'researcher', 
        'analyst', 'optimizer', 'documenter', 'monitor'
      ];

      for (const type of standardTypes) {
        const behavior = registry.getBehavior(type);
        expect(behavior).toBeDefined();
        expect(behavior?.type).toBe(type);
      }
    });

    it('should return undefined for unsupported agent types', () => {
      const behavior = registry.getBehavior('unknown' as AgentType);
      expect(behavior).toBeUndefined();
    });

    it('should have complete behavior configurations', () => {
      const behavior = registry.getBehavior('architect');
      
      expect(behavior).toMatchObject({
        type: 'architect',
        name: expect.any(String),
        description: expect.any(String),
        systemPrompt: expect.any(String),
        capabilities: expect.any(Array),
        specializations: expect.any(Array),
        decisionPatterns: expect.any(Array),
        communicationStyle: expect.any(Object),
        workflowPreferences: expect.any(Object),
        performanceMetrics: expect.any(Object)
      });

      expect(behavior?.capabilities.length).toBeGreaterThan(0);
      expect(behavior?.systemPrompt.length).toBeGreaterThan(100);
    });
  });

  describe('Agent Specializations', () => {
    it('should provide distinct capabilities for each agent type', () => {
      const architectBehavior = registry.getBehavior('architect');
      const coderBehavior = registry.getBehavior('coder');
      const testerBehavior = registry.getBehavior('tester');

      expect(architectBehavior?.capabilities).not.toEqual(coderBehavior?.capabilities);
      expect(coderBehavior?.capabilities).not.toEqual(testerBehavior?.capabilities);
      expect(testerBehavior?.capabilities).not.toEqual(architectBehavior?.capabilities);
    });

    it('should have appropriate system prompts for each agent type', () => {
      const securityBehavior = registry.getBehavior('security');
      const researcherBehavior = registry.getBehavior('researcher');

      expect(securityBehavior?.systemPrompt).toContain('security');
      expect(securityBehavior?.systemPrompt).toContain('threat');
      
      expect(researcherBehavior?.systemPrompt).toContain('research');
      expect(researcherBehavior?.systemPrompt).toContain('information');
    });

    it('should have realistic proficiency levels for capabilities', () => {
      const behavior = registry.getBehavior('coder');
      
      for (const capability of behavior?.capabilities || []) {
        expect(capability.proficiency).toBeGreaterThanOrEqual(0);
        expect(capability.proficiency).toBeLessThanOrEqual(1);
        expect(capability.category).toMatch(/^(technical|cognitive|social|creative|analytical)$/);
      }
    });
  });

  describe('Behavior Instance Management', () => {
    it('should create behavior instances for valid agent types', () => {
      const agentId = 'test-agent-1';
      const instance = registry.createBehaviorInstance(agentId, 'architect');

      expect(instance).toBeInstanceOf(SpecializedAgentBehavior);
      expect(registry.getBehaviorInstance(agentId)).toBe(instance);
    });

    it('should throw error for invalid agent types', () => {
      expect(() => {
        registry.createBehaviorInstance('test-agent', 'invalid' as AgentType);
      }).toThrow('No behavior defined for agent type: invalid');
    });

    it('should support specialization when creating instances', () => {
      const agentId = 'specialized-agent';
      const instance = registry.createBehaviorInstance(agentId, 'architect', 'distributed_systems');

      expect(instance).toBeDefined();
      expect(instance.getSystemPrompt()).toContain('distributed_systems');
    });

    it('should remove behavior instances', () => {
      const agentId = 'removable-agent';
      registry.createBehaviorInstance(agentId, 'coder');
      
      expect(registry.getBehaviorInstance(agentId)).toBeDefined();
      
      registry.removeBehaviorInstance(agentId);
      expect(registry.getBehaviorInstance(agentId)).toBeUndefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should provide performance metrics for all agent types', () => {
      const types = registry.getAvailableTypes();
      
      for (const type of types) {
        const metrics = registry.getPerformanceMetrics(type);
        expect(metrics).toBeDefined();
        expect(metrics?.defaultMetrics).toBeDefined();
        expect(metrics?.strengths).toBeInstanceOf(Array);
        expect(metrics?.growthAreas).toBeInstanceOf(Array);
        expect(metrics?.performanceIndicators).toBeInstanceOf(Array);
      }
    });

    it('should have appropriate default metrics for specialized types', () => {
      const securityMetrics = registry.getPerformanceMetrics('security');
      const optimizerMetrics = registry.getPerformanceMetrics('optimizer');

      expect(securityMetrics?.defaultMetrics).toHaveProperty('security_score');
      expect(optimizerMetrics?.defaultMetrics).toHaveProperty('optimization_impact');
    });
  });

  describe('Decision Patterns', () => {
    it('should have decision patterns for each agent type', () => {
      const types = registry.getAvailableTypes();
      
      for (const type of types) {
        const behavior = registry.getBehavior(type);
        expect(behavior?.decisionPatterns.length).toBeGreaterThan(0);
        
        for (const pattern of behavior?.decisionPatterns || []) {
          expect(pattern).toMatchObject({
            name: expect.any(String),
            priority: expect.any(Number),
            conditions: expect.any(Array),
            actions: expect.any(Array),
            reasoning: expect.any(String)
          });
        }
      }
    });

    it('should have logical decision patterns for specific agent types', () => {
      const testerBehavior = registry.getBehavior('tester');
      const architectBehavior = registry.getBehavior('architect');

      expect(testerBehavior?.decisionPatterns[0].name).toContain('test');
      expect(architectBehavior?.decisionPatterns[0].name).toContain('architecture');
    });
  });

  describe('Communication Styles', () => {
    it('should define appropriate communication styles', () => {
      const researcherBehavior = registry.getBehavior('researcher');
      const monitorBehavior = registry.getBehavior('monitor');

      expect(researcherBehavior?.communicationStyle.formality).toBe('academic');
      expect(researcherBehavior?.communicationStyle.verbosity).toBe('comprehensive');

      expect(monitorBehavior?.communicationStyle.formality).toBe('technical');
      expect(monitorBehavior?.communicationStyle.responsePattern).toBe('immediate');
    });

    it('should have valid communication style values', () => {
      const types = registry.getAvailableTypes();
      
      for (const type of types) {
        const behavior = registry.getBehavior(type);
        const style = behavior?.communicationStyle;
        
        expect(['casual', 'professional', 'academic', 'technical']).toContain(style?.formality);
        expect(['concise', 'moderate', 'detailed', 'comprehensive']).toContain(style?.verbosity);
        expect(['immediate', 'thoughtful', 'collaborative', 'directive']).toContain(style?.responsePattern);
        expect(['independent', 'consultative', 'team-oriented', 'leadership']).toContain(style?.collaborationPreference);
      }
    });
  });

  describe('Workflow Preferences', () => {
    it('should define appropriate workflow preferences for each type', () => {
      const optimizerBehavior = registry.getBehavior('optimizer');
      const securityBehavior = registry.getBehavior('security');

      expect(optimizerBehavior?.workflowPreferences.planningStyle).toBe('iterative');
      expect(optimizerBehavior?.workflowPreferences.qualityVsSpeed).toBeLessThan(0.7); // Speed focused

      expect(securityBehavior?.workflowPreferences.riskTolerance).toBe('conservative');
      expect(securityBehavior?.workflowPreferences.qualityVsSpeed).toBeGreaterThan(0.9); // Quality focused
    });

    it('should have valid workflow preference values', () => {
      const types = registry.getAvailableTypes();
      
      for (const type of types) {
        const behavior = registry.getBehavior(type);
        const prefs = behavior?.workflowPreferences;
        
        expect(['iterative', 'comprehensive', 'agile', 'waterfall']).toContain(prefs?.planningStyle);
        expect(['urgency', 'importance', 'complexity', 'dependencies']).toContain(prefs?.taskPrioritization);
        expect(['conservative', 'moderate', 'aggressive']).toContain(prefs?.riskTolerance);
        expect(['continuous', 'milestone', 'completion']).toContain(prefs?.feedbackFrequency);
        
        expect(prefs?.qualityVsSpeed).toBeGreaterThanOrEqual(0);
        expect(prefs?.qualityVsSpeed).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('SpecializedAgentBehavior', () => {
  let registry: AgentBehaviorRegistry;
  let behaviorInstance: SpecializedAgentBehavior;

  beforeEach(() => {
    registry = new AgentBehaviorRegistry(mockLogger as any);
    behaviorInstance = registry.createBehaviorInstance('test-agent', 'architect');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Decision Making', () => {
    it('should make decisions based on context', () => {
      const decision = behaviorInstance.makeDecision({
        new_system_design: true,
        complexity: 'high'
      });

      // Test matches actual decision pattern reasoning for architecture_first pattern
      expect(decision).toContain('Establish solid architectural foundation before implementation');
      expect(typeof decision).toBe('string');
      expect(decision.length).toBeGreaterThan(0);
    });

    it('should apply decision patterns when conditions match', () => {
      const decision = behaviorInstance.makeDecision({
        new_system_design: true
      });

      expect(decision).toBeDefined();
      expect(typeof decision).toBe('string');
    });

    it('should provide default decisions for unmatched contexts', () => {
      const decision = behaviorInstance.makeDecision({
        random_context: true
      });

      expect(decision).toBeDefined();
      expect(decision.length).toBeGreaterThan(0);
    });
  });

  describe('System Prompt Generation', () => {
    it('should generate specialized system prompts', () => {
      const prompt = behaviorInstance.getSystemPrompt();
      
      expect(prompt).toContain('System Architect');
      expect(prompt).toContain('distributed systems');
      expect(prompt).toContain('scalability');
    });

    it('should include specialization details when provided', () => {
      const specializedInstance = registry.createBehaviorInstance(
        'specialized-agent', 
        'security', 
        'application_security'
      );
      
      const prompt = specializedInstance.getSystemPrompt();
      expect(prompt).toContain('application_security');
    });

    it('should maintain base prompt when no specialization provided', () => {
      const basePrompt = behaviorInstance.getSystemPrompt();
      expect(basePrompt).toContain('System Architect');
      expect(basePrompt.length).toBeGreaterThan(100);
    });
  });

  describe('Metrics Management', () => {
    it('should initialize with default metrics', () => {
      const metrics = behaviorInstance.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
      expect(metrics.design_quality).toBeDefined();
    });

    it('should update metrics correctly', () => {
      const initialMetrics = behaviorInstance.getMetrics();
      
      behaviorInstance.updateMetrics({
        design_quality: 0.95,
        custom_metric: 0.8
      });
      
      const updatedMetrics = behaviorInstance.getMetrics();
      expect(updatedMetrics.design_quality).toBe(0.95);
      expect(updatedMetrics.custom_metric).toBe(0.8);
      
      // Should preserve existing metrics
      expect(updatedMetrics.system_reliability).toBe(initialMetrics.system_reliability);
    });

    it('should emit metrics updated events', () => {
      const metricsListener = jest.fn();
      behaviorInstance.on('metrics:updated', metricsListener);
      
      behaviorInstance.updateMetrics({ test_metric: 0.7 });
      
      expect(metricsListener).toHaveBeenCalledWith({
        agentId: 'test-agent',
        metrics: expect.objectContaining({ test_metric: 0.7 })
      });
    });
  });

  describe('Behavior Configuration Access', () => {
    it('should provide access to behavior configuration', () => {
      const behavior = behaviorInstance.getBehavior();
      
      expect(behavior.type).toBe('architect');
      expect(behavior.capabilities.length).toBeGreaterThan(0);
      expect(behavior.specializations.length).toBeGreaterThan(0);
    });

    it('should maintain immutability of behavior configuration', () => {
      const behavior1 = behaviorInstance.getBehavior();
      const behavior2 = behaviorInstance.getBehavior();
      
      expect(behavior1).toBe(behavior2); // Same reference
      expect(behavior1.capabilities).toEqual(behavior2.capabilities);
    });
  });

  describe('Type-Specific Behavior Validation', () => {
    it('should validate coder agent behavior', () => {
      const coderInstance = registry.createBehaviorInstance('coder-agent', 'coder');
      const behavior = coderInstance.getBehavior();
      
      expect(behavior.systemPrompt).toContain('Software Developer');
      expect(behavior.capabilities.some(c => c.name === 'code_generation')).toBe(true);
      expect(behavior.capabilities.some(c => c.name === 'debugging')).toBe(true);
    });

    it('should validate security agent behavior', () => {
      const securityInstance = registry.createBehaviorInstance('security-agent', 'security');
      const behavior = securityInstance.getBehavior();
      
      expect(behavior.systemPrompt).toContain('Security Engineer');
      expect(behavior.capabilities.some(c => c.name === 'threat_modeling')).toBe(true);
      expect(behavior.capabilities.some(c => c.name === 'vulnerability_assessment')).toBe(true);
    });

    it('should validate tester agent behavior', () => {
      const testerInstance = registry.createBehaviorInstance('tester-agent', 'tester');
      const behavior = testerInstance.getBehavior();
      
      expect(behavior.systemPrompt).toContain('Quality Assurance');
      expect(behavior.capabilities.some(c => c.name === 'test_design')).toBe(true);
      expect(behavior.capabilities.some(c => c.name === 'automation')).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty decision context gracefully', () => {
      const decision = behaviorInstance.makeDecision({});
      
      expect(decision).toBeDefined();
      expect(decision.length).toBeGreaterThan(0);
    });

    it('should handle null/undefined metrics updates', () => {
      expect(() => {
        behaviorInstance.updateMetrics({});
      }).not.toThrow();
      
      const metrics = behaviorInstance.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should handle large numbers of metrics updates', () => {
      for (let i = 0; i < 100; i++) {
        behaviorInstance.updateMetrics({ [`metric_${i}`]: Math.random() });
      }
      
      const metrics = behaviorInstance.getMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Performance and Resource Usage', () => {
    it('should handle creation of many behavior instances efficiently', () => {
      const startTime = Date.now();
      const instances: SpecializedAgentBehavior[] = [];
      
      for (let i = 0; i < 100; i++) {
        instances.push(registry.createBehaviorInstance(`agent-${i}`, 'coder'));
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(instances.length).toBe(100);
      
      // Cleanup
      for (let i = 0; i < 100; i++) {
        registry.removeBehaviorInstance(`agent-${i}`);
      }
    });

    it('should maintain consistent behavior across instances', () => {
      const instance1 = registry.createBehaviorInstance('agent-1', 'researcher');
      const instance2 = registry.createBehaviorInstance('agent-2', 'researcher');
      
      expect(instance1.getBehavior()).toEqual(instance2.getBehavior());
      expect(instance1.getSystemPrompt()).toBe(instance2.getSystemPrompt());
    });
  });
});

describe('Integration Tests', () => {
  let registry: AgentBehaviorRegistry;

  beforeEach(() => {
    registry = new AgentBehaviorRegistry(mockLogger as any);
  });

  describe('Multi-Agent Coordination', () => {
    it('should support different agent types working together', () => {
      const architect = registry.createBehaviorInstance('architect-1', 'architect');
      const coder = registry.createBehaviorInstance('coder-1', 'coder');
      const tester = registry.createBehaviorInstance('tester-1', 'tester');
      
      const architectDecision = architect.makeDecision({ project_start: true });
      const coderDecision = coder.makeDecision({ implementation_needed: true });
      const testerDecision = tester.makeDecision({ testing_required: true });
      
      expect(architectDecision).toContain('Design');
      expect(coderDecision).toContain('code');
      expect(testerDecision).toContain('test');
      
      // Different decision patterns
      expect(architectDecision).not.toBe(coderDecision);
      expect(coderDecision).not.toBe(testerDecision);
    });

    it('should maintain consistent capabilities across agent types', () => {
      const types: AgentType[] = ['architect', 'coder', 'tester', 'security'];
      const allCapabilities = new Set<string>();
      
      for (const type of types) {
        const behavior = registry.getBehavior(type);
        for (const capability of behavior?.capabilities || []) {
          allCapabilities.add(capability.name);
        }
      }
      
      expect(allCapabilities.size).toBeGreaterThan(10);
      expect(allCapabilities.has('system_design')).toBe(true);
      expect(allCapabilities.has('code_generation')).toBe(true);
      expect(allCapabilities.has('test_design')).toBe(true);
    });
  });

  describe('Behavior Registry Lifecycle', () => {
    it('should handle registry initialization and cleanup', () => {
      expect(registry.getAvailableTypes().length).toBeGreaterThan(5);
      
      // Create multiple instances
      const instances = [
        registry.createBehaviorInstance('agent-1', 'architect'),
        registry.createBehaviorInstance('agent-2', 'coder'),
        registry.createBehaviorInstance('agent-3', 'tester')
      ];
      
      expect(instances.length).toBe(3);
      
      // Cleanup
      registry.removeBehaviorInstance('agent-1');
      registry.removeBehaviorInstance('agent-2');
      registry.removeBehaviorInstance('agent-3');
      
      expect(registry.getBehaviorInstance('agent-1')).toBeUndefined();
      expect(registry.getBehaviorInstance('agent-2')).toBeUndefined();
      expect(registry.getBehaviorInstance('agent-3')).toBeUndefined();
    });
  });
}); 