/**
 * Tests for Agent Capability Index
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AgentCapabilityIndex } from "../../../../src/swarm/optimizations/agent-capability-index.js";
import type { 
  AgentCapability, 
  AgentPerformanceMetrics, 
  CapabilityMatch 
} from "../../../../src/swarm/optimizations/agent-capability-index.js";
import type { AgentId, TaskType, TaskPriority } from "../../../../src/swarm/types.js";

describe('AgentCapabilityIndex', () => {
  let index: AgentCapabilityIndex;
  let testAgents: { id: AgentId; capabilities: AgentCapability[] }[];
  let agent1Id: AgentId;
  let agent2Id: AgentId;
  let agent3Id: AgentId;
  let agent4Id: AgentId;

  beforeEach(async () => {
    index = new AgentCapabilityIndex({
      performanceHistorySize: 10,
      capabilityCacheTimeout: 1000,
      minConfidenceThreshold: 0.5,
      maxRecommendations: 3
    });

    // Create test agents with different capabilities
    testAgents = [
      {
        id: { id: 'agent-1', swarmId: 'test-swarm', type: 'analyzer', instance: 1 },
        capabilities: [
          {
            taskType: 'analysis',
            priority: 'high',
            complexity: 'high',
            specialization: ['data-analysis', 'statistics']
          },
          {
            taskType: 'coding',
            priority: 'normal',
            complexity: 'medium',
            specialization: ['typescript', 'nodejs']
          }
        ]
      },
      {
        id: { id: 'agent-2', swarmId: 'test-swarm', type: 'analyzer', instance: 2 },
        capabilities: [
          {
            taskType: 'analysis',
            priority: 'high',
            complexity: 'medium',
            specialization: ['data-analysis', 'research']
          }
        ]
      },
      {
        id: { id: 'agent-3', swarmId: 'test-swarm', type: 'developer', instance: 1 },
        capabilities: [
          {
            taskType: 'coding',
            priority: 'high',
            complexity: 'high',
            specialization: ['python', 'machine-learning']
          }
        ]
      },
      {
        id: { id: 'agent-4', swarmId: 'test-swarm', type: 'coordinator', instance: 1 },
        capabilities: [
          {
            taskType: 'coordination',
            priority: 'low',
            complexity: 'low',
            specialization: ['task-management']
          }
        ]
      }
    ];

    await index.initialize(testAgents);
  });

  afterEach(async () => {
    await index.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully with agents', async () => {
      const stats = index.getIndexStats();
      expect(stats.totalAgents).toBe(4);
      expect(stats.capabilityTypes).toBeGreaterThan(0);
      expect(stats.averageReliability).toBe(1.0); // New agents start with perfect reliability
    });

    it('should register agent capabilities correctly', async () => {
      const allAgents = index.getAllAgents();
      expect(allAgents).toHaveLength(4);
      expect(allAgents).toContain('agent-1');
      expect(allAgents).toContain('agent-2');
      expect(allAgents).toContain('agent-3');
      expect(allAgents).toContain('agent-4');
    });

    it('should initialize agent performance metrics', () => {
      const metrics = index.getAgentMetrics('agent-1');
      expect(metrics).toBeDefined();
      expect(metrics!.agentId).toBe('agent-1');
      expect(metrics!.totalTasks).toBe(0);
      expect(metrics!.reliabilityScore).toBe(1.0);
      expect(metrics!.workloadScore).toBe(1.0);
    });
  });

  describe('Agent Discovery - O(1) Lookup', () => {
    it('should find agents for exact capability match', async () => {
      const matches = await index.findBestAgents(
        'analysis',
        'high',
        'high',
        ['data-analysis']
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].agentId).toBe('agent-1');
      expect(matches[0].matchScore).toBeGreaterThan(0.8);
    });

    it('should find multiple qualified agents', async () => {
      const matches = await index.findBestAgents(
        'analysis',
        'high',
        'medium'
      );

      expect(matches.length).toBeGreaterThanOrEqual(1);
      // Should include agent-2 (exact match) and possibly agent-1 (close match)
      const agentIds = matches.map(m => m.agentId);
      expect(agentIds).toContain('agent-2');
    });

    it('should return empty array when no agents match', async () => {
      const matches = await index.findBestAgents(
        'unknown-task' as TaskType,
        'critical' as TaskPriority,
        'high'
      );

      expect(matches).toHaveLength(0);
    });

    it('should rank agents by combined score', async () => {
      // Add some performance history to differentiate agents
      await index.updateAgentPerformance('agent-1', 'analysis', 1000, true);
      await index.updateAgentPerformance('agent-2', 'analysis', 2000, false);

      const matches = await index.findBestAgents(
        'analysis',
        'high',
        'medium'
      );

      if (matches.length > 1) {
        // First match should have higher combined score
        expect(matches[0].combinedScore).toBeGreaterThanOrEqual(matches[1].combinedScore);
      }
    });

    it('should respect confidence threshold', async () => {
      const indexWithHighThreshold = new AgentCapabilityIndex({
        minConfidenceThreshold: 0.9 // Very high threshold
      });

      await indexWithHighThreshold.initialize(testAgents);

      const matches = await indexWithHighThreshold.findBestAgents(
        'coding',
        'low',
        'high' // Mismatch that should reduce confidence
      );

      // Should filter out low-confidence matches
      for (const match of matches) {
        expect(match.confidence).toBeGreaterThanOrEqual(0.9);
      }

      await indexWithHighThreshold.shutdown();
    });
  });

  describe('Performance Tracking', () => {
    it('should update performance metrics correctly', async () => {
      await index.updateAgentPerformance('agent-1', 'analysis', 1500, true, 'data-analysis');

      const metrics = index.getAgentMetrics('agent-1');
      expect(metrics!.totalTasks).toBe(1);
      expect(metrics!.successfulTasks).toBe(1);
      expect(metrics!.reliabilityScore).toBe(1.0);
      expect(metrics!.averageExecutionTime).toBe(1500);

      // Check specialty score update
      expect(metrics!.specialtyScores.get('data-analysis')).toBeGreaterThan(0.5);
    });

    it('should handle task failures correctly', async () => {
      await index.updateAgentPerformance('agent-1', 'analysis', 1000, false);

      const metrics = index.getAgentMetrics('agent-1');
      expect(metrics!.totalTasks).toBe(1);
      expect(metrics!.successfulTasks).toBe(0);
      expect(metrics!.reliabilityScore).toBe(0.0);
    });

    it('should update average execution time with exponential smoothing', async () => {
      await index.updateAgentPerformance('agent-1', 'analysis', 1000, true);
      await index.updateAgentPerformance('agent-1', 'analysis', 2000, true);

      const metrics = index.getAgentMetrics('agent-1');
      // Should be between 1000 and 2000, closer to 1000 due to smoothing
      expect(metrics!.averageExecutionTime).toBeGreaterThan(1000);
      expect(metrics!.averageExecutionTime).toBeLessThan(2000);
    });

    it('should track specialty performance separately', async () => {
      await index.updateAgentPerformance('agent-1', 'analysis', 1000, true, 'data-analysis');
      await index.updateAgentPerformance('agent-1', 'analysis', 1000, false, 'statistics');

      const metrics = index.getAgentMetrics('agent-1');
      expect(metrics!.specialtyScores.get('data-analysis')).toBeGreaterThan(0.5);
      expect(metrics!.specialtyScores.get('statistics')).toBeLessThan(0.5);
    });
  });

  describe('Workload Balancing', () => {
    it('should update workload scores', () => {
      index.updateAgentWorkload('agent-1', 5);
      index.updateAgentWorkload('agent-2', 1);

      const metrics1 = index.getAgentMetrics('agent-1');
      const metrics2 = index.getAgentMetrics('agent-2');

      expect(metrics1!.currentLoad).toBe(5);
      expect(metrics2!.currentLoad).toBe(1);
      
      // Agent with lower load should have higher workload score
      expect(metrics2!.workloadScore).toBeGreaterThan(metrics1!.workloadScore);
    });

    it('should consider workload in agent ranking', async () => {
      // Set different workloads
      index.updateAgentWorkload('agent-1', 8); // High load
      index.updateAgentWorkload('agent-2', 1); // Low load

      const matches = await index.findBestAgents('analysis', 'high', 'medium');

      if (matches.length > 1) {
        const agent1Match = matches.find(m => m.agentId === 'agent-1');
        const agent2Match = matches.find(m => m.agentId === 'agent-2');

        if (agent1Match && agent2Match) {
          // Agent with lower workload should rank higher
          expect(agent2Match.workloadScore).toBeGreaterThan(agent1Match.workloadScore);
        }
      }
    });
  });

  describe('Caching', () => {
    it('should cache search results', async () => {
      const startTime = Date.now();
      const matches1 = await index.findBestAgents('analysis', 'high', 'high');
      const firstCallTime = Date.now() - startTime;

      const startTime2 = Date.now();
      const matches2 = await index.findBestAgents('analysis', 'high', 'high');
      const secondCallTime = Date.now() - startTime2;

      // Second call should be faster (cached)
      expect(secondCallTime).toBeLessThan(firstCallTime);
      expect(matches2).toEqual(matches1);
    });

    it('should invalidate cache after performance updates', async () => {
      const matches1 = await index.findBestAgents('analysis', 'high', 'high');
      
      // Update performance (should invalidate cache)
      await index.updateAgentPerformance('agent-1', 'analysis', 1000, true);
      
      const matches2 = await index.findBestAgents('analysis', 'high', 'high');
      
      // Results might be different due to updated performance
      const match1 = matches1.find(m => m.agentId === 'agent-1');
      const match2 = matches2.find(m => m.agentId === 'agent-1');
      
      if (match1 && match2) {
        // Performance score might have changed
        expect(match2.performanceScore).toBeDefined();
      }
    });

    it('should provide cache statistics', () => {
      const stats = index.getIndexStats();
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Score Calculation', () => {
    it('should calculate match scores correctly', async () => {
      const matches = await index.findBestAgents(
        'analysis',
        'high',
        'high',
        ['data-analysis']
      );

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];
      
      expect(match.matchScore).toBeGreaterThan(0);
      expect(match.performanceScore).toBeGreaterThan(0);
      expect(match.workloadScore).toBeGreaterThan(0);
      expect(match.combinedScore).toBeGreaterThan(0);
      expect(match.confidence).toBeGreaterThan(0);
      expect(match.estimatedExecutionTime).toBeGreaterThan(0);
    });

    it('should estimate execution time based on complexity', async () => {
      // Add performance history
      await index.updateAgentPerformance('agent-1', 'analysis', 1000, true);

      const lowComplexityMatches = await index.findBestAgents('analysis', 'high', 'low');
      const highComplexityMatches = await index.findBestAgents('analysis', 'high', 'high');

      const lowMatch = lowComplexityMatches.find(m => m.agentId === 'agent-1');
      const highMatch = highComplexityMatches.find(m => m.agentId === 'agent-1');

      if (lowMatch && highMatch) {
        // High complexity should take longer
        expect(highMatch.estimatedExecutionTime).toBeGreaterThan(lowMatch.estimatedExecutionTime);
      }
    });
  });

  describe('Fallback Handling', () => {
    it('should find agents with relaxed matching when exact match fails', async () => {
      const matches = await index.findBestAgents(
        'analysis',
        'high',
        'low' // No agent has this exact combination
      );

      // Should still find analysis agents with different complexity
      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        const agentCapabilities = testAgents.find(a => a.id === match.agentId)?.capabilities;
        const hasAnalysisCapability = agentCapabilities?.some(c => c.taskType === 'analysis');
        expect(hasAnalysisCapability).toBe(true);
      }
    });

    it('should handle non-existent agents gracefully', async () => {
      await index.updateAgentPerformance('non-existent-agent', 'analysis', 1000, true);
      
      // Should not throw error, just log warning
      const metrics = index.getAgentMetrics('non-existent-agent');
      expect(metrics).toBeUndefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive index statistics', () => {
      const stats = index.getIndexStats();
      
      expect(stats.totalAgents).toBe(4);
      expect(stats.capabilityTypes).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.averageReliability).toBe(1.0);
    });

    it('should track average reliability correctly', async () => {
      await index.updateAgentPerformance('agent-1', 'analysis', 1000, true);
      await index.updateAgentPerformance('agent-2', 'analysis', 1000, false);

      const stats = index.getIndexStats();
      expect(stats.averageReliability).toBeLessThan(1.0);
      expect(stats.averageReliability).toBeGreaterThan(0.5);
    });
  });

  describe('Event Emission', () => {
    it('should emit events for agent registration', async (done) => {
      const newIndex = new AgentCapabilityIndex();
      
      newIndex.on('agentRegistered', (data) => {
        expect(data.agentId).toBe('test-agent');
        expect(data.capabilityCount).toBe(1);
        newIndex.shutdown().then(() => done());
      });

      await newIndex.registerAgent('test-agent', [{
        taskType: 'test',
        priority: 'low',
        complexity: 'low'
      }]);
    });

    it('should emit events for agent searches', async (done) => {
      index.on('agentsFound', (data) => {
        expect(data.taskType).toBe('analysis');
        expect(data.capableAgents).toBeGreaterThan(0);
        done();
      });

      await index.findBestAgents('analysis', 'high', 'high');
    });

    it('should emit events for performance updates', async (done) => {
      index.on('performanceUpdated', (data) => {
        expect(data.agentId).toBe('agent-1');
        expect(data.reliabilityScore).toBe(1.0);
        expect(data.averageExecutionTime).toBe(1000);
        done();
      });

      await index.updateAgentPerformance('agent-1', 'analysis', 1000, true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when searching before initialization', async () => {
      const uninitializedIndex = new AgentCapabilityIndex();
      
      await expect(uninitializedIndex.findBestAgents('analysis', 'high', 'high'))
        .rejects.toThrow('AgentCapabilityIndex not initialized');
      
      await uninitializedIndex.shutdown();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on shutdown', async () => {
      const stats = index.getIndexStats();
      expect(stats.totalAgents).toBe(4);

      await index.shutdown();

      const postShutdownStats = index.getIndexStats();
      expect(postShutdownStats.totalAgents).toBe(0);
    });
  });
}); 