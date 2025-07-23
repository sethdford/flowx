import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  MultiFileCoordinator,
  FileCoordinationContext,
  CoordinationConfig,
  ChangeSet
} from '../../src/enterprise/multi-file-coordinator';

describe('Multi-File Coordinator Simple Integration', () => {
  let coordinator: MultiFileCoordinator;
  let mockConfig: Partial<CoordinationConfig>;

  beforeEach(() => {
    mockConfig = {
      analysis_depth: 'standard',
      validation_level: 'standard',
      optimization_strategy: 'balanced',
      concurrency_mode: 'adaptive',
      rollback_strategy: 'checkpoint_restore',
      performance_settings: {
        max_parallel_operations: 2,
        analysis_timeout: 60000,
        validation_timeout: 30000,
        memory_limit: 512,
        cache_enabled: true,
        optimization_level: 1
      },
      safety_settings: {
        dry_run_enabled: false,
        backup_creation: true,
        checkpoint_frequency: 3,
        validation_strictness: 0.7,
        rollback_triggers: ['validation_failure'],
        safety_checks: ['syntax', 'dependencies']
      }
    };
    
    coordinator = new MultiFileCoordinator(mockConfig);
  });

  afterEach(() => {
    coordinator.removeAllListeners();
  });

  describe('Basic Coordination Operations', () => {
    it('should create coordinator instance with configuration', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator).toBeInstanceOf(MultiFileCoordinator);
    });

    it('should initiate coordination sessions', async () => {
      const targetFiles = ['src/test.ts', 'src/helper.ts'];
      
      const changeSet: ChangeSet = {
        id: 'test_changeset',
        description: 'Test coordination',
        type: 'refactoring',
        scope: 'module',
        changes: [],
        validationRules: [],
        rollbackPlan: {
          strategy: 'checkpoint_restore',
          checkpoints: [],
          procedures: [],
          validation: {
            checks: [],
            success_criteria: [],
            timeout: 30000,
            escalation: []
          },
          automation: {
            enabled: true,
            triggers: [],
            conditions: [],
            actions: []
          }
        },
        impact: {
          affected_files: targetFiles,
          affected_symbols: [],
          affected_tests: [],
          affected_dependencies: [],
          risk_level: 'low',
          effort_estimate: {
            development_hours: 2,
            testing_hours: 1,
            review_hours: 0.5,
            deployment_hours: 0.5,
            total_hours: 4,
            confidence: 0.8
          },
          timeline: {
            preparation: 30,
            implementation: 60,
            validation: 30,
            deployment: 15,
            stabilization: 15,
            total: 150
          }
        }
      };

      const context: FileCoordinationContext = {
        workspaceRoot: '/mock/workspace',
        targetFiles,
        changeSet,
        dependencies: {
          nodes: [],
          edges: [],
          clusters: [],
          metrics: {
            total_nodes: 0,
            total_edges: 0,
            average_degree: 0,
            clustering_coefficient: 0,
            cyclomatic_complexity: 0,
            instability_index: 0,
            abstractness_index: 0,
            distance_from_main: 0
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          initiated_by: 'test_user',
          initiated_at: new Date(),
          context: 'simple_test',
          related_issues: [],
          related_prs: [],
          tags: ['test'],
          annotations: {}
        }
      };

      const coordinationId = await coordinator.initiateCoordination(context);
      
      expect(coordinationId).toBeDefined();
      expect(coordinationId).toMatch(/^coord_\d+_[a-z0-9]+$/);
      
      const status = await coordinator.getCoordinationStatus(coordinationId);
      expect(status).toMatch(/^(pending|analyzing|planning|failed)$/);
    });

    it('should track coordination status', async () => {
      const context: FileCoordinationContext = {
        workspaceRoot: '/mock/workspace',
        targetFiles: ['src/status-test.ts'],
        changeSet: {
          id: 'status_test',
          description: 'Test status tracking',
          type: 'bug_fix',
          scope: 'local',
          changes: [],
          validationRules: [],
          rollbackPlan: {
            strategy: 'full_revert',
            checkpoints: [],
            procedures: [],
            validation: {
              checks: [],
              success_criteria: [],
              timeout: 30000,
              escalation: []
            },
            automation: {
              enabled: false,
              triggers: [],
              conditions: [],
              actions: []
            }
          },
          impact: {
            affected_files: ['src/status-test.ts'],
            affected_symbols: [],
            affected_tests: [],
            affected_dependencies: [],
            risk_level: 'very_low',
            effort_estimate: {
              development_hours: 1,
              testing_hours: 0.5,
              review_hours: 0.5,
              deployment_hours: 0.5,
              total_hours: 2.5,
              confidence: 0.9
            },
            timeline: {
              preparation: 15,
              implementation: 30,
              validation: 15,
              deployment: 10,
              stabilization: 10,
              total: 80
            }
          }
        },
        dependencies: {
          nodes: [],
          edges: [],
          clusters: [],
          metrics: {
            total_nodes: 0,
            total_edges: 0,
            average_degree: 0,
            clustering_coefficient: 0,
            cyclomatic_complexity: 0,
            instability_index: 0,
            abstractness_index: 0,
            distance_from_main: 0
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          initiated_by: 'test_user',
          initiated_at: new Date(),
          context: 'status_test',
          related_issues: [],
          related_prs: [],
          tags: [],
          annotations: {}
        }
      };

      const coordinationId = await coordinator.initiateCoordination(context);
      
      // Check initial status
      const initialStatus = await coordinator.getCoordinationStatus(coordinationId);
      expect(initialStatus).toBeDefined();
      
      // Get full coordination results
      const results = await coordinator.getCoordinationResults(coordinationId);
      expect(results).toBeDefined();
      expect(results.id).toBe(coordinationId);
      expect(results.context).toBeDefined();
      expect(results.status).toBeDefined();
    });

    it('should cancel coordination sessions', async () => {
      const context: FileCoordinationContext = {
        workspaceRoot: '/mock/workspace',
        targetFiles: ['src/cancel-test.ts'],
        changeSet: {
          id: 'cancel_test',
          description: 'Test cancellation',
          type: 'cleanup',
          scope: 'local',
          changes: [],
          validationRules: [],
          rollbackPlan: {
            strategy: 'full_revert',
            checkpoints: [],
            procedures: [],
            validation: {
              checks: [],
              success_criteria: [],
              timeout: 30000,
              escalation: []
            },
            automation: {
              enabled: false,
              triggers: [],
              conditions: [],
              actions: []
            }
          },
          impact: {
            affected_files: ['src/cancel-test.ts'],
            affected_symbols: [],
            affected_tests: [],
            affected_dependencies: [],
            risk_level: 'very_low',
            effort_estimate: {
              development_hours: 0.5,
              testing_hours: 0.5,
              review_hours: 0.5,
              deployment_hours: 0.5,
              total_hours: 2,
              confidence: 1.0
            },
            timeline: {
              preparation: 10,
              implementation: 20,
              validation: 10,
              deployment: 5,
              stabilization: 5,
              total: 50
            }
          }
        },
        dependencies: {
          nodes: [],
          edges: [],
          clusters: [],
          metrics: {
            total_nodes: 0,
            total_edges: 0,
            average_degree: 0,
            clustering_coefficient: 0,
            cyclomatic_complexity: 0,
            instability_index: 0,
            abstractness_index: 0,
            distance_from_main: 0
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          initiated_by: 'test_user',
          initiated_at: new Date(),
          context: 'cancellation_test',
          related_issues: [],
          related_prs: [],
          tags: [],
          annotations: {}
        }
      };

      const coordinationId = await coordinator.initiateCoordination(context);
      
      await coordinator.cancelCoordination(coordinationId);
      
      const status = await coordinator.getCoordinationStatus(coordinationId);
      expect(status).toBe('cancelled');
    });
  });

  describe('Dependency Analysis', () => {
    it('should analyze dependencies without files', async () => {
      const targetFiles = ['src/mock1.ts', 'src/mock2.ts'];
      const coordinationId = await coordinator.initiateCoordination({
        workspaceRoot: '/mock/workspace',
        targetFiles,
        changeSet: {
          id: 'dep_test',
          description: 'Test dependency analysis',
          type: 'refactoring',
          scope: 'module',
          changes: [],
          validationRules: [],
          rollbackPlan: {
            strategy: 'full_revert',
            checkpoints: [],
            procedures: [],
            validation: {
              checks: [],
              success_criteria: [],
              timeout: 30000,
              escalation: []
            },
            automation: {
              enabled: false,
              triggers: [],
              conditions: [],
              actions: []
            }
          },
          impact: {
            affected_files: targetFiles,
            affected_symbols: [],
            affected_tests: [],
            affected_dependencies: [],
            risk_level: 'very_low',
            effort_estimate: {
              development_hours: 0,
              testing_hours: 0,
              review_hours: 0,
              deployment_hours: 0,
              total_hours: 0,
              confidence: 1.0
            },
            timeline: {
              preparation: 5,
              implementation: 0,
              validation: 5,
              deployment: 0,
              stabilization: 0,
              total: 10
            }
          }
        },
        dependencies: {
          nodes: [],
          edges: [],
          clusters: [],
          metrics: {
            total_nodes: 0,
            total_edges: 0,
            average_degree: 0,
            clustering_coefficient: 0,
            cyclomatic_complexity: 0,
            instability_index: 0,
            abstractness_index: 0,
            distance_from_main: 0
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          initiated_by: 'test_user',
          initiated_at: new Date(),
          context: 'dependency_test',
          related_issues: [],
          related_prs: [],
          tags: [],
          annotations: {}
        }
      });

      const dependencyGraph = await coordinator.analyzeDependencies(coordinationId, targetFiles);
      
      expect(dependencyGraph).toBeDefined();
      expect(dependencyGraph.nodes).toBeDefined();
      expect(dependencyGraph.edges).toBeDefined();
      expect(dependencyGraph.metrics).toBeDefined();
      expect(Array.isArray(dependencyGraph.nodes)).toBe(true);
      expect(Array.isArray(dependencyGraph.edges)).toBe(true);
    });
  });

  describe('Execution Planning', () => {
    it('should generate execution plans', async () => {
      const targetFiles = ['src/plan1.ts', 'src/plan2.ts'];
      const coordinationId = await coordinator.initiateCoordination({
        workspaceRoot: '/mock/workspace',
        targetFiles,
        changeSet: {
          id: 'plan_test',
          description: 'Test execution planning',
          type: 'optimization',
          scope: 'module',
          changes: [
            {
              id: 'plan_change_1',
              filePath: 'src/plan1.ts',
              changeType: 'modify',
              operations: [
                {
                  id: 'plan_op_1',
                  type: 'replace',
                  location: {
                    filePath: 'src/plan1.ts',
                    line: 5
                  },
                  content: {
                    after: 'optimized code'
                  },
                  metadata: {
                    description: 'Optimize function',
                    rationale: 'Improve performance',
                    impact: [],
                    risks: [],
                    alternatives: []
                  }
                }
              ],
              dependencies: [],
              validations: [],
              priority: 'medium',
              complexity: 'simple'
            }
          ],
          validationRules: [],
          rollbackPlan: {
            strategy: 'checkpoint_restore',
            checkpoints: [],
            procedures: [],
            validation: {
              checks: [],
              success_criteria: [],
              timeout: 30000,
              escalation: []
            },
            automation: {
              enabled: true,
              triggers: [],
              conditions: [],
              actions: []
            }
          },
          impact: {
            affected_files: targetFiles,
            affected_symbols: [],
            affected_tests: [],
            affected_dependencies: [],
            risk_level: 'low',
            effort_estimate: {
              development_hours: 1,
              testing_hours: 0.5,
              review_hours: 0.5,
              deployment_hours: 0.5,
              total_hours: 2.5,
              confidence: 0.8
            },
            timeline: {
              preparation: 15,
              implementation: 30,
              validation: 15,
              deployment: 10,
              stabilization: 10,
              total: 80
            }
          }
        },
        dependencies: {
          nodes: [],
          edges: [],
          clusters: [],
          metrics: {
            total_nodes: 0,
            total_edges: 0,
            average_degree: 0,
            clustering_coefficient: 0,
            cyclomatic_complexity: 0,
            instability_index: 0,
            abstractness_index: 0,
            distance_from_main: 0
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          initiated_by: 'test_user',
          initiated_at: new Date(),
          context: 'planning_test',
          related_issues: [],
          related_prs: [],
          tags: [],
          annotations: {}
        }
      });

      await coordinator.analyzeDependencies(coordinationId, targetFiles);
      const executionPlan = await coordinator.planExecution(coordinationId);
      
      expect(executionPlan).toBeDefined();
      expect(executionPlan.executionOrder).toBeDefined();
      expect(executionPlan.parallelGroups).toBeDefined();
      expect(executionPlan.estimates).toBeDefined();
      expect(Array.isArray(executionPlan.executionOrder)).toBe(true);
      expect(Array.isArray(executionPlan.parallelGroups)).toBe(true);
      expect(executionPlan.estimates.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Change Validation', () => {
    it('should validate changes', async () => {
      const targetFiles = ['src/validate.ts'];
      const coordinationId = await coordinator.initiateCoordination({
        workspaceRoot: '/mock/workspace',
        targetFiles,
        changeSet: {
          id: 'validation_test',
          description: 'Test change validation',
          type: 'bug_fix',
          scope: 'local',
          changes: [
            {
              id: 'validation_change',
              filePath: 'src/validate.ts',
              changeType: 'modify',
              operations: [],
              dependencies: [],
              validations: [
                {
                  type: 'syntax',
                  rule: {
                    id: 'syntax_check',
                    name: 'Syntax Validation',
                    description: 'Check syntax',
                    category: 'structural',
                    implementation: {
                      type: 'regex',
                      pattern: '.*'
                    },
                    configuration: {
                      enabled: true,
                      parameters: {},
                      exceptions: []
                    }
                  },
                  severity: 'error',
                  message: 'Syntax must be valid'
                }
              ],
              priority: 'high',
              complexity: 'simple'
            }
          ],
          validationRules: [],
          rollbackPlan: {
            strategy: 'full_revert',
            checkpoints: [],
            procedures: [],
            validation: {
              checks: [],
              success_criteria: [],
              timeout: 30000,
              escalation: []
            },
            automation: {
              enabled: false,
              triggers: [],
              conditions: [],
              actions: []
            }
          },
          impact: {
            affected_files: targetFiles,
            affected_symbols: [],
            affected_tests: [],
            affected_dependencies: [],
            risk_level: 'low',
            effort_estimate: {
              development_hours: 0.5,
              testing_hours: 0.5,
              review_hours: 0.25,
              deployment_hours: 0.25,
              total_hours: 1.5,
              confidence: 0.95
            },
            timeline: {
              preparation: 10,
              implementation: 20,
              validation: 15,
              deployment: 5,
              stabilization: 5,
              total: 55
            }
          }
        },
        dependencies: {
          nodes: [],
          edges: [],
          clusters: [],
          metrics: {
            total_nodes: 0,
            total_edges: 0,
            average_degree: 0,
            clustering_coefficient: 0,
            cyclomatic_complexity: 0,
            instability_index: 0,
            abstractness_index: 0,
            distance_from_main: 0
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          initiated_by: 'test_user',
          initiated_at: new Date(),
          context: 'validation_test',
          related_issues: [],
          related_prs: [],
          tags: [],
          annotations: {}
        }
      });

      await coordinator.analyzeDependencies(coordinationId, targetFiles);
      await coordinator.planExecution(coordinationId);
      
      const validationResult = await coordinator.validateChanges(coordinationId);
      
      expect(validationResult).toBeDefined();
      expect(validationResult.overall_status).toMatch(/^(passed|failed|warning|skipped)$/);
      expect(validationResult.syntax_validation).toBeDefined();
      expect(validationResult.dependency_validation).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    it('should emit coordination events', async () => {
      const events: string[] = [];
      
      coordinator.on('coordination:initiated', () => events.push('initiated'));
      coordinator.on('analysis:started', () => events.push('analysis_started'));
      coordinator.on('analysis:completed', () => events.push('analysis_completed'));

      const context: FileCoordinationContext = {
        workspaceRoot: '/mock/workspace',
        targetFiles: ['src/events.ts'],
        changeSet: {
          id: 'events_test',
          description: 'Test event emission',
          type: 'cleanup',
          scope: 'local',
          changes: [],
          validationRules: [],
          rollbackPlan: {
            strategy: 'full_revert',
            checkpoints: [],
            procedures: [],
            validation: {
              checks: [],
              success_criteria: [],
              timeout: 30000,
              escalation: []
            },
            automation: {
              enabled: false,
              triggers: [],
              conditions: [],
              actions: []
            }
          },
          impact: {
            affected_files: ['src/events.ts'],
            affected_symbols: [],
            affected_tests: [],
            affected_dependencies: [],
            risk_level: 'very_low',
            effort_estimate: {
              development_hours: 0,
              testing_hours: 0,
              review_hours: 0,
              deployment_hours: 0,
              total_hours: 0,
              confidence: 1.0
            },
            timeline: {
              preparation: 5,
              implementation: 0,
              validation: 5,
              deployment: 0,
              stabilization: 0,
              total: 10
            }
          }
        },
        dependencies: {
          nodes: [],
          edges: [],
          clusters: [],
          metrics: {
            total_nodes: 0,
            total_edges: 0,
            average_degree: 0,
            clustering_coefficient: 0,
            cyclomatic_complexity: 0,
            instability_index: 0,
            abstractness_index: 0,
            distance_from_main: 0
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          initiated_by: 'test_user',
          initiated_at: new Date(),
          context: 'events_test',
          related_issues: [],
          related_prs: [],
          tags: [],
          annotations: {}
        }
      };

      const coordinationId = await coordinator.initiateCoordination(context);
      
      // Give events time to be emitted
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(events).toContain('initiated');
      expect(coordinationId).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should respect custom configuration', async () => {
      const customConfig: Partial<CoordinationConfig> = {
        analysis_depth: 'shallow',
        validation_level: 'basic',
        optimization_strategy: 'conservative',
        concurrency_mode: 'sequential'
      };

      const customCoordinator = new MultiFileCoordinator(customConfig);
      
      expect(customCoordinator).toBeDefined();
      
      // Test basic functionality with custom config
      const coordinationId = await customCoordinator.initiateCoordination({
        workspaceRoot: '/mock/workspace',
        targetFiles: ['src/custom.ts'],
        changeSet: {
          id: 'custom_test',
          description: 'Test custom configuration',
          type: 'modernization',
          scope: 'local',
          changes: [],
          validationRules: [],
          rollbackPlan: {
            strategy: 'backup_restore',
            checkpoints: [],
            procedures: [],
            validation: {
              checks: [],
              success_criteria: [],
              timeout: 30000,
              escalation: []
            },
            automation: {
              enabled: false,
              triggers: [],
              conditions: [],
              actions: []
            }
          },
          impact: {
            affected_files: ['src/custom.ts'],
            affected_symbols: [],
            affected_tests: [],
            affected_dependencies: [],
            risk_level: 'low',
            effort_estimate: {
              development_hours: 1,
              testing_hours: 1,
              review_hours: 0.5,
              deployment_hours: 0.5,
              total_hours: 3,
              confidence: 0.8
            },
            timeline: {
              preparation: 20,
              implementation: 40,
              validation: 30,
              deployment: 15,
              stabilization: 15,
              total: 120
            }
          }
        },
        dependencies: {
          nodes: [],
          edges: [],
          clusters: [],
          metrics: {
            total_nodes: 0,
            total_edges: 0,
            average_degree: 0,
            clustering_coefficient: 0,
            cyclomatic_complexity: 0,
            instability_index: 0,
            abstractness_index: 0,
            distance_from_main: 0
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          initiated_by: 'test_user',
          initiated_at: new Date(),
          context: 'custom_config_test',
          related_issues: [],
          related_prs: [],
          tags: [],
          annotations: {}
        }
      });

      expect(coordinationId).toBeDefined();
      
      const status = await customCoordinator.getCoordinationStatus(coordinationId);
      expect(status).toBeDefined();

      customCoordinator.removeAllListeners();
    });
  });
}); 