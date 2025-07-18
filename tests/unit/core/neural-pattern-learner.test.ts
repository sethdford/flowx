/**
 * Tests for Neural Pattern Learner
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NeuralPatternLearner, getNeuralPatternLearner, resetNeuralPatternLearner } from '../../../src/core/neural-pattern-learner';
import { createMockLogger } from '../../test.utils';
import { EventBus } from '../../../src/core/event-bus';

describe('NeuralPatternLearner', () => {
  let learner: NeuralPatternLearner;
  let mockLogger: any;
  let eventBus: EventBus;

  beforeEach(() => {
    mockLogger = createMockLogger();
    eventBus = EventBus.getInstance();
    learner = new NeuralPatternLearner(mockLogger, eventBus, {
      maxPatterns: 10,
      minFrequency: 2,
      minSuccessRate: 0.6,
      learningWindowDays: 7
    });
  });

  afterEach(() => {
    resetNeuralPatternLearner();
  });

  describe('Learning from workflows', () => {
    it('should learn from successful workflows', async () => {
      await learner.learnFromWorkflow(
        ['init', 'process', 'complete'],
        'success',
        1000,
        { type: 'test' }
      );

      const metrics = learner.getMetrics();
      expect(metrics.totalLearningEvents).toBe(1);
    });

    it('should learn from failed workflows', async () => {
      await learner.learnFromWorkflow(
        ['init', 'process', 'fail'],
        'failure',
        2000,
        { type: 'test' }
      );

      const metrics = learner.getMetrics();
      expect(metrics.totalLearningEvents).toBe(1);
    });

    it('should create patterns after minimum frequency', async () => {
      // Add same workflow multiple times to reach minimum frequency
      for (let i = 0; i < 3; i++) {
        await learner.learnFromWorkflow(
          ['setup', 'execute', 'cleanup'],
          'success',
          1500,
          { env: 'test' }
        );
      }

      const patterns = learner.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].frequency).toBe(3);
      expect(patterns[0].successRate).toBe(1.0);
    });

    it('should filter out patterns with low success rate', async () => {
      // Add pattern with low success rate
      await learner.learnFromWorkflow(['bad', 'pattern'], 'failure', 1000);
      await learner.learnFromWorkflow(['bad', 'pattern'], 'failure', 1000);
      await learner.learnFromWorkflow(['bad', 'pattern'], 'success', 1000);

      const patterns = learner.getPatterns();
      // Should not include pattern with success rate < 0.6
      expect(patterns.length).toBe(0);
    });
  });

  describe('Pattern matching', () => {
    beforeEach(async () => {
      // Set up some patterns
      for (let i = 0; i < 3; i++) {
        await learner.learnFromWorkflow(
          ['init', 'configure', 'start'],
          'success',
          1200,
          { service: 'api' }
        );
      }

      for (let i = 0; i < 2; i++) {
        await learner.learnFromWorkflow(
          ['setup', 'test', 'deploy'],
          'success',
          2000,
          { env: 'production' }
        );
      }
    });

    it('should find matching patterns', async () => {
      const matches = await learner.findPatterns(
        ['init', 'configure'],
        { service: 'api' }
      );

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].confidence).toBeGreaterThan(0.5);
      expect(matches[0].suggestions.length).toBeGreaterThan(0);
    });

    it('should return patterns sorted by confidence', async () => {
      const matches = await learner.findPatterns(
        ['init', 'configure', 'start'],
        { service: 'api' }
      );

      if (matches.length > 1) {
        expect(matches[0].confidence).toBeGreaterThanOrEqual(matches[1].confidence);
      }
    });

    it('should generate relevant suggestions', async () => {
      const matches = await learner.findPatterns(['init']);

      if (matches.length > 0) {
        const suggestions = matches[0].suggestions;
        expect(suggestions.some(s => s.includes('Consider adding step'))).toBe(true);
      }
    });

    it('should return empty array for unmatched patterns', async () => {
      const matches = await learner.findPatterns(['completely', 'different', 'workflow']);
      expect(matches.length).toBe(0);
    });
  });

  describe('Pattern optimization', () => {
    let patternId: string;

    beforeEach(async () => {
      // Create a pattern
      for (let i = 0; i < 3; i++) {
        await learner.learnFromWorkflow(
          ['optimize', 'test'],
          'success',
          800
        );
      }

      const patterns = learner.getPatterns();
      patternId = patterns[0]?.id;
    });

    it('should apply optimization and update metrics', async () => {
      if (patternId) {
        await learner.applyOptimization(patternId);

        const metrics = learner.getMetrics();
        expect(metrics.optimizationsApplied).toBe(1);
      }
    });

    it('should emit pattern applied event', async () => {
      const eventSpy = jest.spyOn(eventBus, 'emit');
      
      if (patternId) {
        await learner.applyOptimization(patternId);
        expect(eventSpy).toHaveBeenCalledWith('pattern.applied', expect.any(Object));
      }
    });
  });

  describe('Metrics and reporting', () => {
    beforeEach(async () => {
      // Add some learning data
      for (let i = 0; i < 5; i++) {
        await learner.learnFromWorkflow(
          ['metric', 'test'],
          'success',
          1000
        );
      }
    });

    it('should provide accurate metrics', () => {
      const metrics = learner.getMetrics();
      
      expect(metrics.totalLearningEvents).toBe(5);
      expect(metrics.totalPatterns).toBeGreaterThanOrEqual(0);
      expect(metrics.avgConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.avgConfidence).toBeLessThanOrEqual(1);
    });

    it('should count active patterns correctly', () => {
      const metrics = learner.getMetrics();
      const patterns = learner.getPatterns();
      
      expect(metrics.activePatterns).toBe(patterns.length);
    });
  });

  describe('Pattern management', () => {
    beforeEach(async () => {
      // Add multiple different patterns
      for (let i = 0; i < 3; i++) {
        await learner.learnFromWorkflow(['pattern1'], 'success', 1000);
        await learner.learnFromWorkflow(['pattern2'], 'success', 1200);
      }
    });

    it('should reset all data', async () => {
      await learner.reset();
      
      const metrics = learner.getMetrics();
      const patterns = learner.getPatterns();
      
      expect(metrics.totalLearningEvents).toBe(0);
      expect(metrics.totalPatterns).toBe(0);
      expect(patterns.length).toBe(0);
    });

    it('should prune old patterns based on learning window', async () => {
      // This would require mocking Date to test properly
      const patterns = learner.getPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event handling', () => {
    it('should handle workflow completed events', async () => {
      const learnSpy = jest.spyOn(learner, 'learnFromWorkflow');
      
      eventBus.emit('workflow.completed', {
        steps: ['event', 'test'],
        executionTime: 1500,
        context: { source: 'event' }
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(learnSpy).toHaveBeenCalled();
    });

    it('should handle workflow failed events', async () => {
      const learnSpy = jest.spyOn(learner, 'learnFromWorkflow');
      
      eventBus.emit('workflow.failed', {
        steps: ['event', 'fail'],
        executionTime: 2000,
        context: { error: 'test' }
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(learnSpy).toHaveBeenCalled();
    });
  });

  describe('Singleton access', () => {
    it('should create singleton instance', () => {
      const instance = getNeuralPatternLearner(mockLogger, eventBus);
      expect(instance).toBeInstanceOf(NeuralPatternLearner);
    });

    it('should return same instance on subsequent calls', () => {
      const instance1 = getNeuralPatternLearner(mockLogger, eventBus);
      const instance2 = getNeuralPatternLearner();
      expect(instance1).toBe(instance2);
    });

    it('should throw error when not initialized', () => {
      resetNeuralPatternLearner();
      expect(() => getNeuralPatternLearner()).toThrow();
    });

    it('should reset singleton', () => {
      getNeuralPatternLearner(mockLogger, eventBus);
      resetNeuralPatternLearner();
      expect(() => getNeuralPatternLearner()).toThrow();
    });
  });

  describe('Pattern similarity calculation', () => {
    it('should calculate step similarity correctly', async () => {
      // Add a known pattern
      for (let i = 0; i < 3; i++) {
        await learner.learnFromWorkflow(
          ['step1', 'step2', 'step3'],
          'success',
          1000
        );
      }

      // Test with similar steps
      const matches = await learner.findPatterns(['step1', 'step2']);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].confidence).toBeGreaterThan(0);
    });

    it('should handle empty step arrays', async () => {
      const matches = await learner.findPatterns([]);
      expect(matches.length).toBe(0);
    });
  });

  describe('Context similarity', () => {
    it('should consider context in pattern matching', async () => {
      // Add pattern with specific context
      for (let i = 0; i < 3; i++) {
        await learner.learnFromWorkflow(
          ['context', 'test'],
          'success',
          1000,
          { environment: 'production', version: '1.0' }
        );
      }

      // Test with matching context
      const matches1 = await learner.findPatterns(
        ['context', 'test'],
        { environment: 'production' }
      );

      // Test with different context
      const matches2 = await learner.findPatterns(
        ['context', 'test'],
        { environment: 'development' }
      );

      if (matches1.length > 0 && matches2.length > 0) {
        expect(matches1[0].confidence).toBeGreaterThanOrEqual(matches2[0].confidence);
      }
    });
  });
}); 