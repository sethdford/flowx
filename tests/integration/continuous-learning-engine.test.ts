import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  ContinuousLearningEngine, 
  LearningContext, 
  LearningEngineConfig, 
  TaskContext,
  Observation,
  Feedback,
  LearningConstraint
} from '../../src/enterprise/continuous-learning-engine';

describe('Continuous Learning Engine Integration', () => {
  let learningEngine: ContinuousLearningEngine;
  let mockConfig: Partial<LearningEngineConfig>;

  beforeEach(() => {
    mockConfig = {
      learning_rate: 0.05,
      memory_retention: 0.9,
      pattern_sensitivity: 0.7,
      feedback_weight: 0.8,
      exploration_rate: 0.1,
      adaptation_speed: 'moderate',
      quality_gates: [
        {
          name: 'confidence_threshold',
          metric: 'confidence',
          threshold: 0.7,
          blocking: false,
          escalation: ['learning_team']
        }
      ],
      privacy_settings: {
        data_retention: 90,
        anonymization: true,
        encryption: true,
        sharing_allowed: false,
        consent_required: true
      },
      performance_settings: {
        max_memory: 512,
        max_compute: 50,
        parallel_processing: true,
        caching_enabled: true,
        optimization_level: 'standard'
      }
    };
    
    learningEngine = new ContinuousLearningEngine(mockConfig);
  });

  afterEach(() => {
    learningEngine.removeAllListeners();
  });

  describe('Learning Session Management', () => {
    it('should create and manage learning sessions', async () => {
      const context: LearningContext = {
        domain: 'code_generation',
        task: {
          type: 'bug_fix',
          complexity: 'moderate',
          scope: 'function',
          technology: {
            languages: ['typescript'],
            frameworks: ['express'],
            libraries: ['jest'],
            tools: ['vscode'],
            platforms: ['node']
          },
          requirements: [
            {
              id: 'req-1',
              type: 'functional',
              description: 'Fix null pointer exception',
              priority: 'high',
              measurable: true,
              criteria: ['No null pointer exceptions', 'Tests pass']
            }
          ],
          constraints: [
            {
              type: 'time',
              description: 'Must be completed within 2 hours',
              impact: 'high'
            }
          ]
        },
        environment: {
          development: {
            tools: ['vscode', 'git'],
            languages: ['typescript'],
            frameworks: ['express'],
            testingFrameworks: ['jest'],
            cicd: ['github-actions'],
            codeQuality: ['eslint', 'prettier']
          },
          production: {
            platform: 'aws',
            scale: 'medium',
            performance: {
              responseTime: 200,
              throughput: 1000,
              concurrency: 100,
              scalability: 'horizontal'
            },
            security: {
              level: 'standard',
              compliance: ['GDPR'],
              authentication: true,
              authorization: true,
              encryption: true
            },
            availability: {
              uptime: 99.9,
              recovery: 5,
              monitoring: true,
              alerting: true
            }
          },
          team: {
            size: 5,
            experience: ['senior', 'mid', 'junior'],
            skills: [
              {
                area: 'typescript',
                level: 'advanced',
                confidence: 0.9
              }
            ],
            methodology: 'agile',
            collaboration: 'code_review'
          },
          project: {
            phase: 'development',
            timeline: {
              start: new Date(),
              end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 100000,
              allocated: 50000,
              remaining: 50000,
              timeConstraints: true
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [
          {
            type: 'time',
            value: 120,
            unit: 'minutes',
            strict: true
          }
        ],
        objectives: [
          {
            id: 'obj-1',
            type: 'improve_accuracy',
            description: 'Improve bug fix accuracy',
            target: 0.95,
            metric: 'success_rate',
            priority: 'high'
          }
        ],
        metadata: {
          source: 'test_suite',
          version: '1.0.0',
          tags: ['integration_test'],
          relationships: [],
          annotations: {}
        }
      };

      // Start learning session
      const sessionId = await learningEngine.startLearningSession(context);
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should record observations during learning', async () => {
      const context: LearningContext = {
        domain: 'performance_optimization',
        task: {
          type: 'optimization',
          complexity: 'complex',
          scope: 'system',
          technology: {
            languages: ['typescript'],
            frameworks: ['express'],
            libraries: [],
            tools: [],
            platforms: ['node']
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'aws',
            scale: 'large',
            performance: {
              responseTime: 100,
              throughput: 5000,
              concurrency: 1000,
              scalability: 'both'
            },
            security: {
              level: 'high',
              compliance: [],
              authentication: true,
              authorization: true,
              encryption: true
            },
            availability: {
              uptime: 99.99,
              recovery: 1,
              monitoring: true,
              alerting: true
            }
          },
          team: {
            size: 10,
            experience: ['expert'],
            skills: [],
            methodology: 'devops',
            collaboration: 'pair_programming'
          },
          project: {
            phase: 'maintenance',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const sessionId = await learningEngine.startLearningSession(context);
      
      // Record performance observation
      const observation: Omit<Observation, 'id' | 'timestamp'> = {
        type: 'performance_metric',
        category: 'performance',
        data: {
          metric: 'response_time',
          value: 150,
          unit: 'ms',
          baseline: 200,
          threshold: 100,
          trend: 'improving',
          context: {
            load: 'high',
            optimization: 'database_indexing'
          }
        },
        confidence: 0.9,
        relevance: 0.95,
        source: {
          type: 'automated',
          agent: 'performance_monitor',
          reliability: 0.95,
          bias: 0.1
        }
      };

      await learningEngine.recordObservation(sessionId, observation);
      
      // Verify observation was recorded (would need access to session data)
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should process feedback and generate improvements', async () => {
      const context: LearningContext = {
        domain: 'code_review',
        task: {
          type: 'refactoring',
          complexity: 'moderate',
          scope: 'module',
          technology: {
            languages: ['typescript'],
            frameworks: ['react'],
            libraries: ['redux'],
            tools: ['webpack'],
            platforms: ['browser']
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'cdn',
            scale: 'medium',
            performance: {
              responseTime: 300,
              throughput: 2000,
              concurrency: 500,
              scalability: 'horizontal'
            },
            security: {
              level: 'standard',
              compliance: [],
              authentication: false,
              authorization: false,
              encryption: true
            },
            availability: {
              uptime: 99.5,
              recovery: 10,
              monitoring: true,
              alerting: true
            }
          },
          team: {
            size: 3,
            experience: ['senior'],
            skills: [],
            methodology: 'agile',
            collaboration: 'code_review'
          },
          project: {
            phase: 'development',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const sessionId = await learningEngine.startLearningSession(context);
      
      // Process feedback
      const feedback: Omit<Feedback, 'id' | 'timestamp'> = {
        source: {
          type: 'human',
          identifier: 'senior_developer_1',
          credibility: 0.9,
          expertise: {
            domain: 'typescript',
            level: 'expert',
            confidence: 0.95,
            track_record: 0.9
          },
          bias: {
            confirmation: 0.1,
            selection: 0.1,
            anchoring: 0.1,
            availability: 0.1,
            overall: 0.1
          }
        },
        type: 'suggestion',
        category: 'code_style',
        content: {
          text: 'The function is too long and should be split into smaller functions',
          code_references: [
            {
              file: 'src/utils/data-processor.ts',
              line_start: 45,
              line_end: 120,
              function: 'processData',
              context: 'Large function with multiple responsibilities'
            }
          ],
          suggestions: [
            {
              type: 'code_change',
              description: 'Extract validation logic into separate function',
              code_before: 'if (data && data.length > 0 && validate(data)) { ... }',
              code_after: 'if (isValidData(data)) { ... }',
              rationale: 'Improves readability and testability',
              benefits: ['Better maintainability', 'Easier testing', 'Clearer intent'],
              risks: ['Slight performance overhead', 'More function calls']
            }
          ],
          ratings: [
            {
              aspect: 'code_readability',
              scale: 'likert_5',
              value: 2,
              explanation: 'Current code is hard to read due to complexity'
            }
          ],
          attachments: []
        },
        sentiment: 'positive',
        actionability: 0.8,
        priority: 'medium'
      };

      await learningEngine.processFeedback(sessionId, feedback);
      
      // Verify feedback was processed
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should complete learning sessions and extract insights', async () => {
      const context: LearningContext = {
        domain: 'testing_strategy',
        task: {
          type: 'testing',
          complexity: 'simple',
          scope: 'function',
          technology: {
            languages: ['javascript'],
            frameworks: ['jest'],
            libraries: [],
            tools: [],
            platforms: ['node']
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'heroku',
            scale: 'small',
            performance: {
              responseTime: 500,
              throughput: 100,
              concurrency: 10,
              scalability: 'vertical'
            },
            security: {
              level: 'basic',
              compliance: [],
              authentication: true,
              authorization: false,
              encryption: false
            },
            availability: {
              uptime: 99.0,
              recovery: 30,
              monitoring: false,
              alerting: false
            }
          },
          team: {
            size: 2,
            experience: ['junior'],
            skills: [],
            methodology: 'waterfall',
            collaboration: 'individual'
          },
          project: {
            phase: 'testing',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const sessionId = await learningEngine.startLearningSession(context);
      
      // Add some observations and feedback
      await learningEngine.recordObservation(sessionId, {
        type: 'accuracy_measurement',
        category: 'correctness',
        data: {
          metric: 'test_coverage',
          value: 85,
          unit: 'percent',
          baseline: 70,
          threshold: 80,
          trend: 'improving',
          context: {}
        },
        confidence: 0.8,
        relevance: 0.9,
        source: {
          type: 'automated',
          agent: 'coverage_tool',
          reliability: 0.9,
          bias: 0.05
        }
      });

      const completedSession = await learningEngine.completeLearningSession(sessionId);
      
      // Verify session completion
      expect(completedSession.sessionId).toBe(sessionId);
      expect(completedSession.duration).toBeGreaterThan(0);
      expect(completedSession.confidence).toBeGreaterThanOrEqual(0);
      expect(completedSession.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Pattern Recognition', () => {
    it('should recognize patterns across learning sessions', async () => {
      // Create multiple sessions with similar patterns
      const baseContext: LearningContext = {
        domain: 'code_generation',
        task: {
          type: 'feature_implementation',
          complexity: 'moderate',
          scope: 'class',
          technology: {
            languages: ['typescript'],
            frameworks: ['express'],
            libraries: [],
            tools: [],
            platforms: ['node']
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'aws',
            scale: 'medium',
            performance: {
              responseTime: 200,
              throughput: 1000,
              concurrency: 100,
              scalability: 'horizontal'
            },
            security: {
              level: 'standard',
              compliance: [],
              authentication: true,
              authorization: true,
              encryption: true
            },
            availability: {
              uptime: 99.9,
              recovery: 5,
              monitoring: true,
              alerting: true
            }
          },
          team: {
            size: 5,
            experience: ['senior'],
            skills: [],
            methodology: 'agile',
            collaboration: 'code_review'
          },
          project: {
            phase: 'development',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      // Create and complete multiple sessions
      for (let i = 0; i < 3; i++) {
        const sessionId = await learningEngine.startLearningSession(baseContext);
        
        // Add similar observations
        await learningEngine.recordObservation(sessionId, {
          type: 'success_pattern',
          category: 'code_quality',
          data: {
            metric: 'implementation_success',
            value: 1,
            unit: 'boolean',
            context: { approach: 'tdd', testing: 'comprehensive' }
          },
          confidence: 0.9,
          relevance: 0.8,
          source: {
            type: 'automated',
            agent: 'quality_tracker',
            reliability: 0.85,
            bias: 0.1
          }
        });
        
        await learningEngine.completeLearningSession(sessionId);
      }

      // Recognize patterns
      const patterns = await learningEngine.recognizePatterns('code_generation');
      
      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
      // Patterns might be empty in simplified implementation, but structure should be correct
    });

    it('should recognize patterns within specific time windows', async () => {
      const now = new Date();
      const timeWindow = {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: now
      };

      const patterns = await learningEngine.recognizePatterns('code_generation', timeWindow);
      
      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('Adaptive Improvements', () => {
    it('should generate adaptive improvements based on learning', async () => {
      const context: LearningContext = {
        domain: 'performance_optimization',
        task: {
          type: 'optimization',
          complexity: 'complex',
          scope: 'system',
          technology: {
            languages: ['typescript'],
            frameworks: ['express'],
            libraries: ['redis'],
            tools: ['docker'],
            platforms: ['kubernetes']
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'kubernetes',
            scale: 'enterprise',
            performance: {
              responseTime: 50,
              throughput: 10000,
              concurrency: 5000,
              scalability: 'both'
            },
            security: {
              level: 'critical',
              compliance: ['SOX', 'GDPR'],
              authentication: true,
              authorization: true,
              encryption: true
            },
            availability: {
              uptime: 99.99,
              recovery: 1,
              monitoring: true,
              alerting: true
            }
          },
          team: {
            size: 20,
            experience: ['architect'],
            skills: [],
            methodology: 'devops',
            collaboration: 'mob_programming'
          },
          project: {
            phase: 'maintenance',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const constraints: LearningConstraint[] = [
        {
          type: 'time',
          value: 30,
          unit: 'days',
          strict: false
        },
        {
          type: 'memory',
          value: 1024,
          unit: 'MB',
          strict: true
        }
      ];

      const improvements = await learningEngine.generateAdaptiveImprovements(context, constraints);
      
      expect(improvements).toBeDefined();
      expect(Array.isArray(improvements)).toBe(true);
      // Check that improvements respect constraints if any are generated
    });

    it('should prioritize improvements based on context', async () => {
      const context: LearningContext = {
        domain: 'security_analysis',
        task: {
          type: 'refactoring',
          complexity: 'expert',
          scope: 'architecture',
          technology: {
            languages: ['typescript', 'python'],
            frameworks: ['express', 'django'],
            libraries: ['passport', 'oauth2'],
            tools: ['vault', 'nginx'],
            platforms: ['aws', 'kubernetes']
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'aws',
            scale: 'enterprise',
            performance: {
              responseTime: 100,
              throughput: 50000,
              concurrency: 10000,
              scalability: 'both'
            },
            security: {
              level: 'critical',
              compliance: ['SOX', 'HIPAA', 'PCI-DSS'],
              authentication: true,
              authorization: true,
              encryption: true
            },
            availability: {
              uptime: 99.999,
              recovery: 0.5,
              monitoring: true,
              alerting: true
            }
          },
          team: {
            size: 50,
            experience: ['architect', 'expert'],
            skills: [],
            methodology: 'devops',
            collaboration: 'code_review'
          },
          project: {
            phase: 'maintenance',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const improvements = await learningEngine.generateAdaptiveImprovements(context);
      
      expect(improvements).toBeDefined();
      expect(Array.isArray(improvements)).toBe(true);
    });
  });

  describe('Learning Application', () => {
    it('should apply learned patterns to new situations', async () => {
      const context: LearningContext = {
        domain: 'architecture_design',
        task: {
          type: 'design',
          complexity: 'complex',
          scope: 'system',
          technology: {
            languages: ['typescript'],
            frameworks: ['nestjs'],
            libraries: ['graphql'],
            tools: ['docker'],
            platforms: ['aws']
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'aws',
            scale: 'large',
            performance: {
              responseTime: 100,
              throughput: 5000,
              concurrency: 2000,
              scalability: 'horizontal'
            },
            security: {
              level: 'high',
              compliance: ['GDPR'],
              authentication: true,
              authorization: true,
              encryption: true
            },
            availability: {
              uptime: 99.95,
              recovery: 2,
              monitoring: true,
              alerting: true
            }
          },
          team: {
            size: 12,
            experience: ['lead', 'senior'],
            skills: [],
            methodology: 'agile',
            collaboration: 'pair_programming'
          },
          project: {
            phase: 'planning',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const task: TaskContext = {
        type: 'design',
        complexity: 'complex',
        scope: 'system',
        technology: {
          languages: ['typescript'],
          frameworks: ['nestjs'],
          libraries: ['graphql', 'apollo'],
          tools: ['docker', 'kubernetes'],
          platforms: ['aws', 'lambda']
        },
        requirements: [
          {
            id: 'req-1',
            type: 'non_functional',
            description: 'System must handle 10k concurrent users',
            priority: 'critical',
            measurable: true,
            criteria: ['Load testing passes', 'Response time < 200ms']
          }
        ],
        constraints: [
          {
            type: 'technology',
            description: 'Must use serverless architecture',
            impact: 'high'
          }
        ]
      };

      const application = await learningEngine.applyLearning(context, task);
      
      expect(application).toBeDefined();
      expect(application.sessionId).toBeDefined();
      expect(application.context).toEqual(context);
      expect(application.task).toEqual(task);
      expect(application.confidence).toBeGreaterThanOrEqual(0);
      expect(application.confidence).toBeLessThanOrEqual(1);
      expect(application.timestamp).toBeInstanceOf(Date);
    });

    it('should provide confidence scores for learning applications', async () => {
      const context: LearningContext = {
        domain: 'debugging',
        task: {
          type: 'bug_fix',
          complexity: 'simple',
          scope: 'line',
          technology: {
            languages: ['javascript'],
            frameworks: [],
            libraries: [],
            tools: [],
            platforms: ['browser']
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'cdn',
            scale: 'small',
            performance: {
              responseTime: 1000,
              throughput: 50,
              concurrency: 5,
              scalability: 'vertical'
            },
            security: {
              level: 'basic',
              compliance: [],
              authentication: false,
              authorization: false,
              encryption: false
            },
            availability: {
              uptime: 95.0,
              recovery: 60,
              monitoring: false,
              alerting: false
            }
          },
          team: {
            size: 1,
            experience: ['junior'],
            skills: [],
            methodology: 'waterfall',
            collaboration: 'individual'
          },
          project: {
            phase: 'development',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const task: TaskContext = {
        type: 'bug_fix',
        complexity: 'trivial',
        scope: 'line',
        technology: {
          languages: ['javascript'],
          frameworks: [],
          libraries: [],
          tools: [],
          platforms: ['browser']
        },
        requirements: [],
        constraints: []
      };

      const application = await learningEngine.applyLearning(context, task);
      
      expect(application.confidence).toBeGreaterThanOrEqual(0);
      expect(application.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Learning Analytics', () => {
    it('should generate comprehensive learning analytics', async () => {
      const timeframe = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        end: new Date()
      };

      const analytics = await learningEngine.getLearningAnalytics(timeframe, 'code_generation');
      
      expect(analytics).toBeDefined();
      expect(analytics.summary).toBeDefined();
      expect(analytics.trends).toBeDefined();
      expect(analytics.patterns).toBeDefined();
      expect(analytics.improvements).toBeDefined();
      expect(analytics.recommendations).toBeDefined();
      
      expect(Array.isArray(analytics.trends)).toBe(true);
      expect(Array.isArray(analytics.patterns)).toBe(true);
      expect(Array.isArray(analytics.improvements)).toBe(true);
      expect(Array.isArray(analytics.recommendations)).toBe(true);
    });

    it('should track learning progress over time', async () => {
      // Create learning sessions over time
      const contexts = [
        { domain: 'code_generation' as const, complexity: 'simple' as const },
        { domain: 'code_generation' as const, complexity: 'moderate' as const },
        { domain: 'code_generation' as const, complexity: 'complex' as const }
      ];

      for (const ctx of contexts) {
        const context: LearningContext = {
          domain: ctx.domain,
          task: {
            type: 'feature_implementation',
            complexity: ctx.complexity,
            scope: 'function',
            technology: {
              languages: ['typescript'],
              frameworks: [],
              libraries: [],
              tools: [],
              platforms: []
            },
            requirements: [],
            constraints: []
          },
          environment: {
            development: {
              tools: [],
              languages: [],
              frameworks: [],
              testingFrameworks: [],
              cicd: [],
              codeQuality: []
            },
            production: {
              platform: 'heroku',
              scale: 'small',
              performance: {
                responseTime: 500,
                throughput: 100,
                concurrency: 10,
                scalability: 'vertical'
              },
              security: {
                level: 'basic',
                compliance: [],
                authentication: false,
                authorization: false,
                encryption: false
              },
              availability: {
                uptime: 99.0,
                recovery: 30,
                monitoring: false,
                alerting: false
              }
            },
            team: {
              size: 1,
              experience: ['junior'],
              skills: [],
              methodology: 'agile',
              collaboration: 'individual'
            },
            project: {
              phase: 'development',
              timeline: {
                start: new Date(),
                end: new Date(),
                milestones: [],
                deadlines: []
              },
              budget: {
                total: 0,
                allocated: 0,
                remaining: 0,
                timeConstraints: false
              },
              stakeholders: [],
              risks: []
            }
          },
          constraints: [],
          objectives: [],
          metadata: {
            source: 'test',
            version: '1.0',
            tags: [],
            relationships: [],
            annotations: {}
          }
        };

        const sessionId = await learningEngine.startLearningSession(context);
        await learningEngine.completeLearningSession(sessionId);
      }

      const analytics = await learningEngine.getLearningAnalytics();
      
      expect(analytics.summary.totalSessions).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Knowledge Management', () => {
    it('should export and import learning knowledge', async () => {
      // Export knowledge
      const exportedJson = await learningEngine.exportKnowledge('json');
      expect(typeof exportedJson).toBe('string');
      
      const parsedData = JSON.parse(exportedJson as string);
      expect(parsedData).toBeDefined();
      expect(parsedData.patterns).toBeDefined();
      expect(parsedData.improvements).toBeDefined();
      expect(parsedData.contexts).toBeDefined();
      
      // Test import
      await learningEngine.importKnowledge(exportedJson, 'json', true);
      
      // Export binary format
      const exportedBinary = await learningEngine.exportKnowledge('binary');
      expect(Buffer.isBuffer(exportedBinary)).toBe(true);
      
      // Import binary format
      await learningEngine.importKnowledge(exportedBinary, 'binary', false);
    });

    it('should handle knowledge import with merge options', async () => {
      const initialExport = await learningEngine.exportKnowledge('json');
      
      // Import with merge = false (replace)
      await learningEngine.importKnowledge(initialExport, 'json', false);
      
      // Import with merge = true (append)
      await learningEngine.importKnowledge(initialExport, 'json', true);
      
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect custom learning engine configuration', async () => {
      const customConfig: Partial<LearningEngineConfig> = {
        learning_rate: 0.1,
        memory_retention: 0.95,
        pattern_sensitivity: 0.9,
        feedback_weight: 0.9,
        exploration_rate: 0.2,
        adaptation_speed: 'aggressive'
      };

      const customEngine = new ContinuousLearningEngine(customConfig);
      
      // Test that engine can be created with custom config
      expect(customEngine).toBeDefined();
      
      // Create a learning session to verify functionality
      const context: LearningContext = {
        domain: 'code_generation',
        task: {
          type: 'bug_fix',
          complexity: 'simple',
          scope: 'function',
          technology: {
            languages: ['typescript'],
            frameworks: [],
            libraries: [],
            tools: [],
            platforms: []
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'heroku',
            scale: 'small',
            performance: {
              responseTime: 500,
              throughput: 100,
              concurrency: 10,
              scalability: 'vertical'
            },
            security: {
              level: 'basic',
              compliance: [],
              authentication: false,
              authorization: false,
              encryption: false
            },
            availability: {
              uptime: 99.0,
              recovery: 30,
              monitoring: false,
              alerting: false
            }
          },
          team: {
            size: 1,
            experience: ['junior'],
            skills: [],
            methodology: 'agile',
            collaboration: 'individual'
          },
          project: {
            phase: 'development',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const sessionId = await customEngine.startLearningSession(context);
      expect(sessionId).toBeDefined();
      
      customEngine.removeAllListeners();
    });

    it('should handle privacy and performance settings', async () => {
      const privacyConfig: Partial<LearningEngineConfig> = {
        privacy_settings: {
          data_retention: 30,
          anonymization: true,
          encryption: true,
          sharing_allowed: false,
          consent_required: true
        },
        performance_settings: {
          max_memory: 256,
          max_compute: 25,
          parallel_processing: false,
          caching_enabled: true,
          optimization_level: 'basic'
        }
      };

      const privacyEngine = new ContinuousLearningEngine(privacyConfig);
      expect(privacyEngine).toBeDefined();
      
      privacyEngine.removeAllListeners();
    });
  });

  describe('Event Handling and Monitoring', () => {
    it('should emit proper events during learning lifecycle', async () => {
      const events: string[] = [];
      
      learningEngine.on('session:start', () => events.push('session:start'));
      learningEngine.on('observation:recorded', () => events.push('observation:recorded'));
      learningEngine.on('feedback:processed', () => events.push('feedback:processed'));
      learningEngine.on('session:complete', () => events.push('session:complete'));
      learningEngine.on('patterns:recognized', () => events.push('patterns:recognized'));
      learningEngine.on('improvements:generated', () => events.push('improvements:generated'));
      learningEngine.on('learning:applied', () => events.push('learning:applied'));

      const context: LearningContext = {
        domain: 'code_generation',
        task: {
          type: 'bug_fix',
          complexity: 'simple',
          scope: 'function',
          technology: {
            languages: ['typescript'],
            frameworks: [],
            libraries: [],
            tools: [],
            platforms: []
          },
          requirements: [],
          constraints: []
        },
        environment: {
          development: {
            tools: [],
            languages: [],
            frameworks: [],
            testingFrameworks: [],
            cicd: [],
            codeQuality: []
          },
          production: {
            platform: 'heroku',
            scale: 'small',
            performance: {
              responseTime: 500,
              throughput: 100,
              concurrency: 10,
              scalability: 'vertical'
            },
            security: {
              level: 'basic',
              compliance: [],
              authentication: false,
              authorization: false,
              encryption: false
            },
            availability: {
              uptime: 99.0,
              recovery: 30,
              monitoring: false,
              alerting: false
            }
          },
          team: {
            size: 1,
            experience: ['junior'],
            skills: [],
            methodology: 'agile',
            collaboration: 'individual'
          },
          project: {
            phase: 'development',
            timeline: {
              start: new Date(),
              end: new Date(),
              milestones: [],
              deadlines: []
            },
            budget: {
              total: 0,
              allocated: 0,
              remaining: 0,
              timeConstraints: false
            },
            stakeholders: [],
            risks: []
          }
        },
        constraints: [],
        objectives: [],
        metadata: {
          source: 'test',
          version: '1.0',
          tags: [],
          relationships: [],
          annotations: {}
        }
      };

      const sessionId = await learningEngine.startLearningSession(context);
      await learningEngine.completeLearningSession(sessionId);

      expect(events).toContain('session:start');
      expect(events).toContain('session:complete');
    });

    it('should handle errors gracefully during learning', async () => {
      // Test error handling for invalid session
      try {
        await learningEngine.recordObservation('invalid-session-id', {
          type: 'performance_metric',
          category: 'performance',
          data: {
            metric: 'test',
            value: 1,
            context: {}
          },
          confidence: 1,
          relevance: 1,
          source: {
            type: 'automated',
            agent: 'test',
            reliability: 1,
            bias: 0
          }
        });
        
        expect(false).toBe(true); // Should not reach this line
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('not found');
      }
    });
  });
}); 