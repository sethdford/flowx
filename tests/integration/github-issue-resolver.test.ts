import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GitHubIssueResolverEngine, GitHubIssueResolverConfig, IssueResolutionContext } from '../../src/enterprise/github-issue-resolver';

describe('GitHub Issue Resolver Integration', () => {
  let resolverEngine: GitHubIssueResolverEngine;
  let mockConfig: Partial<GitHubIssueResolverConfig>;

  beforeEach(() => {
    mockConfig = {
      analysisDepth: 'comprehensive',
      solutionComplexity: 'any',
      testingStrategy: 'comprehensive',
      validationLevel: 'thorough',
      timeboxing: {
        analysis: 60000, // 1 minute for tests
        planning: 120000, // 2 minutes
        implementation: 300000, // 5 minutes
        testing: 180000, // 3 minutes
        validation: 120000, // 2 minutes
        total: 780000 // 13 minutes total
      }
    };
    
    resolverEngine = new GitHubIssueResolverEngine(mockConfig);
  });

  afterEach(() => {
    resolverEngine.removeAllListeners();
  });

  describe('Issue Resolution Workflow', () => {
    it('should resolve a simple bug fix issue', async () => {
      const issueTitle = 'Fix: Null pointer exception in user service';
      const issueDescription = `
        ## Bug Description
        The user service throws a null pointer exception when trying to fetch user data.
        
        ## Steps to Reproduce
        1. Call getUserById with a valid ID
        2. Service returns null instead of user object
        3. Subsequent operations fail with NPE
        
        ## Expected Behavior
        Should return user object or appropriate error message
        
        ## Environment
        - Node.js 18.x
        - Express.js 4.18
        - TypeScript 5.0
      `;

      const context: IssueResolutionContext = {
        codebase: {
          language: 'typescript',
          framework: 'express',
          version: '4.18.0',
          dependencies: {
            'express': '^4.18.0',
            'typescript': '^5.0.0'
          }
        }
      };

      const result = await resolverEngine.resolveIssue(
        'https://github.com/test/repo',
        'issue-123',
        issueTitle,
        issueDescription,
        context
      );

      // Should successfully analyze the issue
      expect(result.issueId).toBe('issue-123');
      expect(result.resolutionStatus).toMatch(/^(completed|requires_human_review)$/);
      
      // Should categorize as bug
      expect(result.analysis.category).toBe('bug');
      expect(result.analysis.severity).toMatch(/^(low|medium|high|critical)$/);
      
      // Should propose bug fix solution
      expect(result.solution.approach).toBe('bug_fix');
      expect(result.solution.summary).toContain('bug');
      expect(result.solution.complexity.overall).toMatch(/^(low|medium|high|very_high)$/);
      
      // Should generate code changes
      expect(result.codeChanges.length).toBeGreaterThan(0);
      expect(result.codeChanges[0].type).toMatch(/^(modify_function|fix_bug|modify_file)$/);
      expect(result.codeChanges[0].riskLevel).toMatch(/^(low|medium|high|critical)$/);
      
      // Should create comprehensive test suite
      expect(result.testSuite.unitTests.length).toBeGreaterThan(0);
      expect(result.testSuite.coverage.lines).toBeGreaterThan(0.7);
      
      // Should validate the solution
      expect(result.validation.overall.status).toMatch(/^(passed|failed|pending)$/);
      expect(result.validation.functional.criticalFunctionality).toMatch(/^(passed|failed|pending|not_applicable)$/);
      
      // Should have reasonable confidence
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      
      // Should complete in reasonable time
      expect(result.resolutionTime).toBeGreaterThan(0);
      expect(result.resolutionTime).toBeLessThan(120000); // 2 minutes max for test
    });

    it('should resolve a feature implementation request', async () => {
      const issueTitle = 'Feature: Add user authentication middleware';
      const issueDescription = `
        ## Feature Request
        We need to add authentication middleware to protect certain routes.
        
        ## Requirements
        - JWT token validation
        - Role-based access control
        - Proper error handling for unauthorized access
        - Support for refresh tokens
        
        ## Acceptance Criteria
        - [ ] Middleware validates JWT tokens
        - [ ] Middleware checks user roles
        - [ ] Proper HTTP status codes returned
        - [ ] Unit tests with >90% coverage
        
        ## Technical Details
        - Use jsonwebtoken library
        - Support RS256 and HS256 algorithms
        - Cache user permissions for performance
      `;

      const result = await resolverEngine.resolveIssue(
        'https://github.com/test/auth-service',
        'feature-456',
        issueTitle,
        issueDescription
      );

      // Should categorize as feature request
      expect(result.analysis.category).toBe('feature_request');
      expect(result.solution.approach).toBe('feature_implementation');
      
      // Should extract requirements
      expect(result.analysis.requirements.length).toBeGreaterThan(0);
      expect(result.analysis.requirements[0].type).toMatch(/^(functional|non_functional|constraint|assumption)$/);
      
      // Should assess higher complexity for features
      expect(result.solution.complexity.technical).toMatch(/^(medium|high|very_high)$/);
      
      // Should create implementation plan
      expect(result.implementation.phases.length).toBeGreaterThan(0);
      expect(result.implementation.phases[0].tasks.length).toBeGreaterThan(0);
      
      // Should include security validation
      expect(result.validation.security.authentication).toMatch(/^(passed|failed|pending|not_applicable)$/);
      expect(result.validation.security.authorization).toMatch(/^(passed|failed|pending|not_applicable)$/);
      
      // Should generate documentation
      expect(result.documentation.length).toBeGreaterThan(0);
      expect(result.documentation.some(doc => doc.type === 'api')).toBe(true);
    });

    it('should resolve a performance optimization issue', async () => {
      const issueTitle = 'Performance: Database queries are too slow';
      const issueDescription = `
        ## Performance Issue
        Database queries are taking too long, causing timeout errors.
        
        ## Current Performance
        - Average query time: 5-8 seconds
        - 95th percentile: 12 seconds
        - Timeout threshold: 10 seconds
        
        ## Expected Performance
        - Average query time: <500ms
        - 95th percentile: <2 seconds
        
        ## Analysis
        - Missing indexes on frequently queried columns
        - N+1 query problems in ORM
        - Large dataset without pagination
        
        ## Environment
        - PostgreSQL 14
        - Prisma ORM
        - 1M+ records in user table
      `;

      const result = await resolverEngine.resolveIssue(
        'https://github.com/test/perf-app',
        'perf-789',
        issueTitle,
        issueDescription
      );

      // Should categorize as performance issue
      expect(result.analysis.category).toBe('performance');
      expect(result.solution.approach).toBe('performance_optimization');
      
      // Should analyze impact on performance
      expect(result.solution.impact.performance).toBe('improvement');
      
      // Should include performance validation
      expect(result.validation.performance.responseTime.status).toMatch(/^(passed|failed|pending|not_applicable)$/);
      expect(result.validation.performance.throughput.current).toBeGreaterThan(0);
      
      // Should have performance-focused recommendations
      const perfRecommendations = result.analysis.requirements.filter(req => 
        req.description.toLowerCase().includes('performance')
      );
      expect(perfRecommendations.length).toBeGreaterThan(0);
    });

    it('should resolve a security vulnerability issue', async () => {
      const issueTitle = 'Security: SQL injection vulnerability in search endpoint';
      const issueDescription = `
        ## Security Vulnerability
        The search endpoint is vulnerable to SQL injection attacks.
        
        ## Vulnerability Details
        - Endpoint: POST /api/search
        - Parameter: query (not sanitized)
        - Impact: Full database access
        - CVSS Score: 9.8 (Critical)
        
        ## Proof of Concept
        \`\`\`
        POST /api/search
        {"query": "'; DROP TABLE users; --"}
        \`\`\`
        
        ## Remediation Required
        - Parameterized queries
        - Input validation
        - Output encoding
        - Security testing
      `;

      const result = await resolverEngine.resolveIssue(
        'https://github.com/test/secure-app',
        'sec-101',
        issueTitle,
        issueDescription
      );

      // Should categorize as security issue
      expect(result.analysis.category).toBe('security');
      expect(result.analysis.severity).toMatch(/^(high|critical)$/);
      expect(result.solution.approach).toBe('security_fix');
      
      // Should assess security impact
      expect(result.solution.impact.security).toBe('improvement');
      
      // Should include comprehensive security validation
      expect(result.validation.security.vulnerabilities.overallRisk).toMatch(/^(low|medium|high|critical)$/);
      expect(result.validation.security.compliance.length).toBeGreaterThan(0);
      
      // Should have urgent priority
      expect(result.analysis.priority).toMatch(/^(high|urgent)$/);
      
      // Should generate security-focused tests
      const securityTests = result.testSuite.unitTests.filter(test => 
        test.description.toLowerCase().includes('security') ||
        test.name.toLowerCase().includes('injection')
      );
      expect(securityTests.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Analysis Capabilities', () => {
    it('should perform comprehensive root cause analysis', async () => {
      const complexIssue = `
        ## Complex Bug Report
        Application crashes intermittently with different error messages.
        
        ## Error Messages
        1. "Cannot read property 'id' of undefined"
        2. "Memory leak detected"
        3. "Database connection timeout"
        
        ## Patterns Observed
        - Occurs during high traffic periods
        - More frequent on weekends
        - Started after recent deployment
        - Affects user authentication flow
        
        ## System Information
        - Node.js 18.x
        - Redis cache
        - PostgreSQL cluster
        - Kubernetes deployment
        - Load balancer with sticky sessions
      `;

      const result = await resolverEngine.resolveIssue(
        'https://github.com/test/complex-app',
        'complex-123',
        'Intermittent application crashes during high traffic',
        complexIssue
      );

      // Should identify multiple affected components
      expect(result.analysis.affectedComponents.length).toBeGreaterThan(1);
      
      // Should perform root cause analysis
      expect(result.analysis.rootCause.primary.type).toMatch(/^(code_defect|design_flaw|configuration_error|dependency_issue|environment_issue)$/);
      expect(result.analysis.rootCause.evidence.length).toBeGreaterThan(0);
      
      // Should identify contributing factors
      expect(result.analysis.rootCause.contributing).toBeDefined();
      
      // Should propose comprehensive solution
      expect(result.solution.alternatives.length).toBeGreaterThan(0);
      expect(result.solution.tradeoffs.length).toBeGreaterThan(0);
    });

    it('should generate appropriate test strategies for different issue types', async () => {
      const testingIssue = `
        ## Testing Gap
        Critical user registration flow lacks proper test coverage.
        
        ## Current State
        - Unit test coverage: 45%
        - No integration tests
        - No end-to-end tests
        - Manual testing only
        
        ## Requirements
        - Achieve 90%+ test coverage
        - Add property-based tests
        - Include edge case testing
        - Performance testing for load
      `;

      const result = await resolverEngine.resolveIssue(
        'https://github.com/test/testing-app',
        'test-456',
        'Add comprehensive test coverage for user registration',
        testingIssue
      );

      // Should have comprehensive test strategy
      expect(result.testSuite.strategy.approach).toMatch(/^(tdd|bdd|property_based|mutation_testing|hybrid)$/);
      expect(result.testSuite.strategy.frameworks.length).toBeGreaterThan(0);
      
      // Should include multiple test types
      expect(result.testSuite.unitTests.length).toBeGreaterThan(0);
      expect(result.testSuite.integrationTests.length).toBeGreaterThan(0);
      expect(result.testSuite.propertyTests.length).toBeGreaterThan(0);
      
      // Should target high coverage
      expect(result.testSuite.coverage.target.lines).toBeGreaterThan(0.85);
      expect(result.testSuite.coverage.target.functions).toBeGreaterThan(0.90);
      
      // Should include mocking strategy
      expect(result.testSuite.strategy.mocking.external_apis).toBeDefined();
      expect(result.testSuite.strategy.mocking.database).toBeDefined();
    });
  });

  describe('SWE-Bench Integration', () => {
    it('should evaluate against SWE-Bench test cases', async () => {
      const sweTestCases = [
        {
          id: 'swe-1',
          repositoryUrl: 'https://github.com/test/swe-repo-1',
          issueId: 'swe-issue-1',
          title: 'Fix array index out of bounds error',
          description: 'Array access without bounds checking causes crashes',
          codebase: {
            language: 'typescript',
            framework: 'node',
            version: '18.0.0',
            dependencies: {} as Record<string, string>
          },
          expectedTests: ['test_array_bounds_checking', 'test_error_handling'],
          constraints: ['Must maintain backward compatibility']
        },
        {
          id: 'swe-2',
          repositoryUrl: 'https://github.com/test/swe-repo-2',
          issueId: 'swe-issue-2',
          title: 'Implement caching for expensive operations',
          description: 'Add Redis caching to reduce database load',
          codebase: {
            language: 'typescript',
            framework: 'express',
            version: '4.18.0',
            dependencies: { 'redis': '^4.0.0' }
          },
          expectedTests: ['test_cache_hit', 'test_cache_miss', 'test_cache_invalidation'],
          constraints: ['Must handle Redis connection failures gracefully']
        }
      ];

      const evaluation = await resolverEngine.evaluateSWEBench(sweTestCases);

      // Should process all test cases
      expect(evaluation.totalTestCases).toBe(2);
      expect(evaluation.results.length).toBe(2);
      
      // Should have meaningful results
      expect(evaluation.results[0].testCaseId).toBe('swe-1');
      expect(evaluation.results[0].passed).toBeDefined();
      expect(evaluation.results[0].score).toBeGreaterThanOrEqual(0);
      expect(evaluation.results[0].score).toBeLessThanOrEqual(1);
      
      // Should provide evaluation feedback
      expect(evaluation.results[0].evaluation.feedback).toBeDefined();
      expect(evaluation.results[0].evaluation.criteria.length).toBeGreaterThan(0);
      
      // Should calculate aggregate metrics
      expect(evaluation.averageScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.averageScore).toBeLessThanOrEqual(1);
      expect(evaluation.passedTestCases).toBeLessThanOrEqual(evaluation.totalTestCases);
      
      // Should provide summary analysis
      expect(evaluation.summary.accuracy).toBeDefined();
      expect(evaluation.summary.passRate).toBeDefined();
      expect(evaluation.summary.timeDistribution.average).toBeGreaterThan(0);
    });

    it('should handle batch issue resolution', async () => {
      const batchIssues = [
        {
          issueId: 'batch-1',
          repositoryUrl: 'https://github.com/test/batch-repo',
          title: 'Fix memory leak in event listeners',
          description: 'Event listeners not properly cleaned up causing memory leaks',
          context: {
            codebase: {
              language: 'typescript',
              framework: 'react',
              version: '18.0.0',
              dependencies: {} as Record<string, string>
            }
          }
        },
        {
          issueId: 'batch-2',
          repositoryUrl: 'https://github.com/test/batch-repo',
          title: 'Add input validation to API endpoints',
          description: 'API endpoints lack proper input validation and sanitization',
          context: {
            codebase: {
              language: 'typescript',
              framework: 'express',
              version: '4.18.0',
              dependencies: {} as Record<string, string>
            }
          }
        },
        {
          issueId: 'batch-3',
          repositoryUrl: 'https://github.com/test/batch-repo',
          title: 'Optimize database query performance',
          description: 'Slow queries affecting application performance',
          context: {
            codebase: {
              language: 'typescript',
              framework: 'node',
              version: '18.0.0',
              dependencies: { 'prisma': '^4.0.0' } as Record<string, string>
            }
          }
        }
      ];

      const batchResult = await resolverEngine.resolveMultipleIssues(batchIssues);

      // Should process all issues
      expect(batchResult.totalIssues).toBe(3);
      expect(batchResult.results.length).toBeLessThanOrEqual(3); // Some might fail
      
      // Should track success/failure rates
      expect(batchResult.resolvedIssues).toBeLessThanOrEqual(batchResult.totalIssues);
      expect(batchResult.failedIssues).toBeLessThanOrEqual(batchResult.totalIssues);
      expect(batchResult.resolvedIssues + batchResult.failedIssues).toBe(batchResult.totalIssues);
      
      // Should calculate timing metrics
      expect(batchResult.totalTime).toBeGreaterThan(0);
      if (batchResult.results.length > 0) {
        expect(batchResult.averageResolutionTime).toBeGreaterThan(0);
      }
      
      // Should maintain individual resolution quality
      batchResult.results.forEach(result => {
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(result.resolutionStatus).toMatch(/^(completed|requires_human_review|failed)$/);
      });
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect custom configuration settings', async () => {
      const customConfig: Partial<GitHubIssueResolverConfig> = {
        analysisDepth: 'shallow',
        solutionComplexity: 'simple',
        testingStrategy: 'minimal',
        validationLevel: 'basic',
        timeboxing: {
          analysis: 30000, // 30 seconds
          planning: 60000, // 1 minute
          implementation: 120000, // 2 minutes
          testing: 60000, // 1 minute
          validation: 30000, // 30 seconds
          total: 300000 // 5 minutes total
        }
      };

      const customResolver = new GitHubIssueResolverEngine(customConfig);

      const result = await customResolver.resolveIssue(
        'https://github.com/test/simple-repo',
        'simple-123',
        'Simple bug fix needed',
        'Fix the simple bug in the code'
      );

      // Should complete faster with simpler configuration
      expect(result.resolutionTime).toBeLessThan(300000); // 5 minutes max
      
      // Should still provide basic functionality
      expect(result.analysis.category).toBeDefined();
      expect(result.solution.approach).toBeDefined();
      expect(result.codeChanges.length).toBeGreaterThanOrEqual(0);
      
      customResolver.removeAllListeners();
    });

    it('should handle quality gates and validation thresholds', async () => {
      const strictConfig: Partial<GitHubIssueResolverConfig> = {
        qualityGates: [
          {
            phase: 'implementation',
            criteria: [
              {
                metric: 'test_coverage',
                threshold: 0.95,
                operator: 'gte',
                critical: true
              },
              {
                metric: 'complexity_score',
                threshold: 10,
                operator: 'lt',
                critical: false
              }
            ],
            blocking: true,
            bypassable: false
          }
        ]
      };

      const strictResolver = new GitHubIssueResolverEngine(strictConfig);

      const result = await strictResolver.resolveIssue(
        'https://github.com/test/strict-repo',
        'strict-123',
        'High-quality implementation required',
        'This fix must meet strict quality standards'
      );

      // Should enforce quality gates
      expect(result.testSuite.coverage.lines).toBeGreaterThan(0.8);
      expect(result.validation.overall.confidence).toBeGreaterThan(0.7);
      
      strictResolver.removeAllListeners();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed issue descriptions gracefully', async () => {
      const malformedDescription = `
        ??? Invalid characters: \\x00\\x01\\x02
        ## Missing structure
        Random text without proper formatting...
        <script>alert('xss')</script>
        unicode: 🚀🔥💯
      `;

      const result = await resolverEngine.resolveIssue(
        'https://github.com/test/malformed-repo',
        'malformed-123',
        'Issue with malformed description',
        malformedDescription
      );

      // Should still process the issue
      expect(result.issueId).toBe('malformed-123');
      expect(result.analysis.category).toBeDefined();
      
      // Should handle gracefully without crashing
      expect(result.resolutionStatus).toMatch(/^(completed|requires_human_review|failed)$/);
    });

    it('should emit proper events during resolution lifecycle', async () => {
      const events: string[] = [];
      
      resolverEngine.on('resolution:start', () => events.push('start'));
      resolverEngine.on('resolution:phase', (data) => events.push(`phase:${data.phase}`));
      resolverEngine.on('resolution:complete', () => events.push('complete'));
      resolverEngine.on('resolution:error', () => events.push('error'));

      await resolverEngine.resolveIssue(
        'https://github.com/test/event-repo',
        'event-123',
        'Test issue for events',
        'Simple issue to test event emission'
      );

      // Should emit lifecycle events
      expect(events).toContain('start');
      expect(events.some(e => e.startsWith('phase:'))).toBe(true);
      expect(events).toContain('complete');
      
      // Should not emit error for successful resolution
      expect(events).not.toContain('error');
    });

    it('should handle timeout scenarios appropriately', async () => {
      const timeoutConfig: Partial<GitHubIssueResolverConfig> = {
        timeboxing: {
          analysis: 1, // 1ms - very short timeout
          planning: 1,
          implementation: 1,
          testing: 1,
          validation: 1,
          total: 5
        }
      };

      const timeoutResolver = new GitHubIssueResolverEngine(timeoutConfig);

      try {
        const result = await timeoutResolver.resolveIssue(
          'https://github.com/test/timeout-repo',
          'timeout-123',
          'This should timeout',
          'Complex issue that would take longer than timeout allows'
        );

        // If it completes, should indicate potential issues
        if (result.resolutionStatus === 'completed') {
          expect(result.confidence).toBeLessThan(0.8); // Lower confidence due to rush
        }
      } catch (error) {
        // Timeout errors are acceptable in this test
        expect(error).toBeDefined();
      }

      timeoutResolver.removeAllListeners();
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete resolution within reasonable time bounds', async () => {
      const startTime = Date.now();

      const result = await resolverEngine.resolveIssue(
        'https://github.com/test/perf-repo',
        'perf-123',
        'Performance test issue',
        'Standard issue for performance testing'
      );

      const actualTime = Date.now() - startTime;

      // Should complete within configured timeboxing
      expect(result.resolutionTime).toBeLessThan(mockConfig.timeboxing!.total! * 1.5); // 50% buffer
      expect(actualTime).toBeLessThan(60000); // 1 minute max for test
      
      // Should track time accurately
      expect(Math.abs(result.resolutionTime - actualTime)).toBeLessThan(1000); // 1 second tolerance
    });

    it('should maintain memory efficiency during batch processing', async () => {
      const batchSize = 5;
      const issues = Array.from({ length: batchSize }, (_, i) => ({
        issueId: `batch-perf-${i}`,
        repositoryUrl: 'https://github.com/test/batch-perf-repo',
        title: `Performance test issue ${i}`,
        description: `Test issue ${i} for memory efficiency testing`
      }));

      const memoryBefore = process.memoryUsage().heapUsed;
      
      const result = await resolverEngine.resolveMultipleIssues(issues);
      
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Should process all issues
      expect(result.totalIssues).toBe(batchSize);
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
      
      // Should complete batch in reasonable time
      expect(result.totalTime).toBeLessThan(300000); // 5 minutes max
    });
  });
}); 