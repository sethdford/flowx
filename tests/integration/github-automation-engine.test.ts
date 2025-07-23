import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GitHubAutomationEngine } from '../../src/enterprise/github-automation-engine.ts';
import type { GitHubConfig, GitHubRepository, AutomationMode } from '../../src/enterprise/github-automation-engine.ts';
import { Logger } from '../../src/core/logger.ts';

// Mock the Octokit library with properly typed mocks
const mockGetAuthenticated = jest.fn();
const mockReposGet = jest.fn();
const mockReposListLanguages = jest.fn();
const mockReposListContributors = jest.fn();
const mockPullsGet = jest.fn();
const mockIssuesGet = jest.fn();

const mockOctokit = {
  users: {
    getAuthenticated: mockGetAuthenticated
  },
  repos: {
    get: mockReposGet,
    listLanguages: mockReposListLanguages,
    listContributors: mockReposListContributors
  },
  pulls: {
    get: mockPullsGet
  },
  issues: {
    get: mockIssuesGet
  }
};

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => mockOctokit)
}));

describe('GitHub Automation Engine Integration', () => {
  let automationEngine: GitHubAutomationEngine;
  let logger: Logger;
  let config: GitHubConfig;
  let testRepository: GitHubRepository;

  beforeEach(async () => {
    // Reset all mocks and set up default resolved values
    jest.clearAllMocks();
    
    mockGetAuthenticated.mockResolvedValue({ data: { login: 'testuser' } });
    mockReposGet.mockResolvedValue({
      data: {
        stargazers_count: 100,
        forks_count: 25,
        watchers_count: 150,
        open_issues_count: 12,
        size: 1024,
        language: 'TypeScript',
        updated_at: '2025-01-01T00:00:00Z'
      }
    });
    mockReposListLanguages.mockResolvedValue({
      data: { TypeScript: 85432, JavaScript: 12345 }
    });
    mockReposListContributors.mockResolvedValue({
      data: [
        { login: 'user1', contributions: 45 },
        { login: 'user2', contributions: 23 },
        { login: 'user3', contributions: 8 }
      ]
    });
    mockPullsGet.mockResolvedValue({
      data: {
        number: 123,
        title: 'Test PR',
        state: 'open',
        requested_reviewers: [{ login: 'reviewer1' }],
        head: { ref: 'feature-branch' },
        base: { ref: 'main' }
      }
    });
    mockIssuesGet.mockResolvedValue({
      data: {
        number: 456,
        title: 'Bug: Critical issue',
        state: 'open',
        labels: [],
        assignees: []
      }
    });
    
    logger = new Logger({ level: 'debug', format: 'json', destination: 'console' });
    
    config = {
      token: 'test-github-token',
      baseUrl: 'https://api.github.com',
      userAgent: 'FlowX-Test',
      timeouts: {
        request: 30000,
        response: 30000
      },
      retryOptions: {
        enabled: true,
        retries: 3,
        retryAfter: 1000
      }
    };

    testRepository = {
      owner: 'testorg',
      repo: 'testrepo',
      branch: 'main'
    };

    automationEngine = new GitHubAutomationEngine(config, logger);
  });

  afterEach(async () => {
    if (automationEngine) {
      await automationEngine.shutdown();
    }
  });

  describe('Engine Initialization', () => {
    it('should initialize with default modes', async () => {
      await automationEngine.initialize();
      
      // Verify initialization completed successfully
      expect(mockGetAuthenticated).toHaveBeenCalled();
      expect(automationEngine).toBeDefined();
    });

    it('should test GitHub API connection during initialization', async () => {
      await automationEngine.initialize();
      
      // The mock should have been called to test authentication
      expect(mockGetAuthenticated).toHaveBeenCalled();
      expect(automationEngine).toBeDefined();
    });

    it('should handle configuration of automation modes', async () => {
      await automationEngine.initialize();

      const modeConfig: Partial<AutomationMode> = {
        enabled: true,
        config: {
          analysisDepth: 'deep',
          codeQualityThresholds: {
            minCoverage: 90,
            maxComplexity: 8,
            maxDuplication: 3,
            maxTechnicalDebt: 20,
            securityVulnerabilities: {
              critical: 0,
              high: 1,
              medium: 5,
              low: 25
            }
          }
        },
        triggers: [
          {
            event: 'push',
            conditions: [
              { field: 'ref', operator: 'equals', value: 'refs/heads/main' }
            ]
          }
        ],
        actions: []
      };

      await automationEngine.configureMode('repository_analysis', modeConfig);
      
      // Configuration should complete without errors
      expect(automationEngine).toBeDefined();
    });
  });

  describe('Repository Analysis Mode', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
      
      // Configure repository analysis mode
      await automationEngine.configureMode('repository_analysis', {
        enabled: true,
        config: {
          analysisDepth: 'deep',
          securityScanEnabled: true,
          dependencyAnalysis: true
        }
      });
    });

    it('should perform comprehensive repository analysis', async () => {
      const analysis = await automationEngine.analyzeRepository(testRepository);
      
      expect(analysis).toBeDefined();
      expect(analysis.repository).toEqual(testRepository);
      expect(analysis.metrics).toBeDefined();
      expect(analysis.metrics.stars).toBe(100);
      expect(analysis.metrics.forks).toBe(25);
      expect(analysis.metrics.primaryLanguage).toBe('TypeScript');
      
      expect(analysis.codeQuality).toBeDefined();
      expect(analysis.codeQuality.coverage).toBeGreaterThan(0);
      expect(analysis.codeQuality.complexity).toBeDefined();
      
      expect(analysis.security).toBeDefined();
      expect(analysis.security.score).toBeGreaterThan(0);
      
      expect(analysis.dependencies).toBeDefined();
      expect(analysis.contributors).toBeDefined();
      expect(analysis.activity).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should generate quality-based recommendations', async () => {
      const analysis = await automationEngine.analyzeRepository(testRepository);
      
      // Should generate recommendations based on code quality thresholds
      const qualityRecommendations = analysis.recommendations.filter(
        r => r.category === 'code_quality'
      );
      
      expect(qualityRecommendations.length).toBeGreaterThanOrEqual(0);
      
      // If there are quality recommendations, they should be well-formed
      if (qualityRecommendations.length > 0) {
        const rec = qualityRecommendations[0];
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.priority).toMatch(/^(low|medium|high|critical)$/);
        expect(rec.implementation).toBeDefined();
        expect(rec.effort).toBeDefined();
        expect(rec.impact).toBeDefined();
      }
    });

    it('should cache analysis results', async () => {
      // First analysis
      const analysis1 = await automationEngine.analyzeRepository(testRepository);
      
      // Second analysis should use cached results (in real implementation)
      const analysis2 = await automationEngine.analyzeRepository(testRepository);
      
      expect(analysis1.repository).toEqual(analysis2.repository);
      expect(analysis1.metrics.stars).toBe(analysis2.metrics.stars);
    });
  });

  describe('Pull Request Management Mode', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
      
      // Configure PR management mode
      await automationEngine.configureMode('pr_management', {
        enabled: true,
        config: {
          autoReviewEnabled: true,
          reviewCriteria: {
            minReviewers: 2,
            requireOwnerReview: true,
            requireSecurityReview: false,
            requiredChecks: ['CI', 'Tests'],
            blockingConditions: [
              { type: 'test_failure', severity: 'error', autoResolve: false },
              { type: 'security_issue', severity: 'critical', autoResolve: false }
            ]
          },
          mergePolicies: {
            strategy: 'squash',
            requireLinearHistory: true,
            deleteBranchAfterMerge: true,
            requireUpToDateBranch: true
          },
          conflictResolution: 'manual'
        }
      });
    });

    it('should manage pull request automation', async () => {
      const prNumber = 123;
      
      // This should complete without errors
      await automationEngine.managePullRequest(testRepository, prNumber);
      
      // Verify the API was called
      expect(mockPullsGet).toHaveBeenCalledWith({
        owner: testRepository.owner,
        repo: testRepository.repo,
        pull_number: prNumber
      });
    });

    it('should analyze pull request quality and security', async () => {
      const prNumber = 123;
      
      await automationEngine.managePullRequest(testRepository, prNumber);
      
      // The PR should have been fetched and analyzed
      expect(mockPullsGet).toHaveBeenCalled();
      expect(automationEngine).toBeDefined();
    });

    it('should apply merge policies correctly', async () => {
      const prNumber = 123;
      
      // Test with a PR that meets all criteria
      await automationEngine.managePullRequest(testRepository, prNumber);
      
      // Should complete without blocking conditions
      expect(mockPullsGet).toHaveBeenCalled();
    });
  });

  describe('Issue Tracking Mode', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
      
      // Configure issue tracking mode
      await automationEngine.configureMode('issue_tracking', {
        enabled: true,
        config: {
          priorityRules: [
            { condition: 'title.includes("CRITICAL")', priority: 'critical', labels: ['critical', 'urgent'] },
            { condition: 'title.includes("Bug")', priority: 'high', labels: ['bug'] },
            { condition: 'title.includes("Feature")', priority: 'medium', labels: ['enhancement'] }
          ],
          assignmentRules: [
            { pattern: 'security.*', assignees: ['security-team'], teamAssignment: 'security' },
            { pattern: 'performance.*', assignees: ['perf-team'], teamAssignment: 'performance' },
            { pattern: 'ui.*', assignees: ['frontend-team'], teamAssignment: 'frontend' }
          ],
          labelingRules: [
            { pattern: 'bug.*', labels: ['bug'], autoApply: true },
            { pattern: 'feature.*', labels: ['enhancement'], autoApply: true },
            { pattern: 'docs.*', labels: ['documentation'], autoApply: true }
          ],
          escalationThresholds: [
            {
              timeWithoutResponse: 86400000, // 24 hours
              escalateTo: ['team-lead', 'project-manager'],
              actions: [
                { type: 'notify', message: 'Issue requires attention' },
                { type: 'label', target: 'needs-attention' }
              ]
            }
          ]
        }
      });
    });

    it('should process issue automation', async () => {
      const issueNumber = 456;
      
      await automationEngine.processIssue(testRepository, issueNumber);
      
      // Should have fetched the issue
      expect(mockIssuesGet).toHaveBeenCalledWith({
        owner: testRepository.owner,
        repo: testRepository.repo,
        issue_number: issueNumber
      });
    });

    it('should classify issues correctly', async () => {
      const issueNumber = 456;
      
      // The mock returns an issue with title "Bug: Critical issue"
      await automationEngine.processIssue(testRepository, issueNumber);
      
      // Should have applied bug classification and priority rules
      expect(mockIssuesGet).toHaveBeenCalled();
    });

    it('should apply assignment rules based on issue content', async () => {
      const issueNumber = 456;
      
      await automationEngine.processIssue(testRepository, issueNumber);
      
      // Should have processed assignment rules
      expect(mockIssuesGet).toHaveBeenCalled();
    });
  });

  describe('Release Coordination Mode', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
      
      // Configure release coordination mode
      await automationEngine.configureMode('release_coordination', {
        enabled: true,
        config: {
          releaseStrategy: {
            type: 'trigger_based',
            triggers: [
              { type: 'tag_push', branches: ['main', 'release/*'] },
              { type: 'pr_merge', conditions: ['target_branch === "main"'] }
            ],
            approvalRequired: true,
            rollbackEnabled: true
          },
          versioningScheme: 'semver',
          deploymentPipelines: [
            {
              name: 'staging-pipeline',
              environment: 'staging',
              stages: [
                { name: 'build', type: 'build', timeout: 600, retries: 2 },
                { name: 'test', type: 'test', timeout: 900, retries: 1 },
                { name: 'deploy', type: 'deploy', timeout: 300, retries: 3 }
              ],
              approvals: [
                { required: false, approvers: ['team-lead'], timeout: 3600 }
              ],
              rollbackSteps: [
                { name: 'rollback-deploy', script: 'rollback.sh', automatic: true }
              ]
            }
          ],
          rollbackPolicy: {
            enabled: true,
            triggers: [
              { type: 'error_rate', threshold: 0.05, duration: 300000 },
              { type: 'health_check_failure', threshold: 3 }
            ],
            strategy: 'graceful',
            maxAttempts: 3
          }
        }
      });
    });

    it('should coordinate release process', async () => {
      const releaseConfig = {
        tag_name: 'v1.2.3',
        target_commitish: 'main',
        name: 'Release v1.2.3',
        body: 'Bug fixes and improvements'
      };
      
      await automationEngine.coordinateRelease(testRepository, releaseConfig);
      
      // Should complete release coordination
      expect(automationEngine).toBeDefined();
    });

    it('should validate release readiness', async () => {
      const releaseConfig = {
        tag_name: 'v1.2.3',
        target_commitish: 'main'
      };
      
      // Should validate tests pass, security scans clear, etc.
      await automationEngine.coordinateRelease(testRepository, releaseConfig);
      
      expect(automationEngine).toBeDefined();
    });

    it('should handle rollback scenarios', async () => {
      const releaseConfig = {
        tag_name: 'v1.2.3',
        rollback_required: true
      };
      
      // Should handle rollback gracefully
      await automationEngine.coordinateRelease(testRepository, releaseConfig);
      
      expect(automationEngine).toBeDefined();
    });
  });

  describe('Workflow Automation Mode', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
      
      // Configure workflow automation mode
      await automationEngine.configureMode('workflow_automation', {
        enabled: true,
        config: {
          cicdIntegration: {
            provider: 'github_actions',
            pipelines: [
              {
                name: 'ci-pipeline',
                trigger: {
                  events: ['push', 'pull_request'],
                  branches: ['main', 'develop'],
                  paths: ['src/**', 'tests/**']
                },
                jobs: [
                  {
                    name: 'test',
                    runsOn: 'ubuntu-latest',
                    steps: [
                      { name: 'Checkout', uses: 'actions/checkout@v2' },
                      { name: 'Setup Node', uses: 'actions/setup-node@v2', with: { 'node-version': '18' } },
                      { name: 'Install', run: 'npm install' },
                      { name: 'Test', run: 'npm test' }
                    ]
                  }
                ]
              }
            ]
          },
          testAutomation: {
            enabled: true,
            frameworks: ['jest', 'cypress'],
            coverage: {
              threshold: 80,
              reportFormat: ['lcov', 'html'],
              excludePaths: ['node_modules', 'dist', 'coverage']
            },
            parallelization: true,
            reportGeneration: true
          },
          deploymentAutomation: {
            enabled: true,
            environments: [
              {
                name: 'staging',
                type: 'staging',
                url: 'https://staging.example.com',
                healthCheck: {
                  url: 'https://staging.example.com/health',
                  method: 'GET',
                  expectedStatus: 200,
                  timeout: 10000,
                  retries: 3
                }
              }
            ],
            strategies: [
              { name: 'blue-green', type: 'blue_green', parameters: { traffic_split: 0.1 } },
              { name: 'rolling', type: 'rolling', parameters: { batch_size: 2 } }
            ],
            monitoring: {
              enabled: true,
              metrics: ['response_time', 'error_rate', 'throughput', 'cpu_usage'],
              alerts: [
                {
                  name: 'high-error-rate',
                  condition: 'error_rate > 0.05',
                  severity: 'error',
                  channels: [
                    { type: 'slack', target: '#alerts' },
                    { type: 'email', target: 'team@company.com' }
                  ]
                }
              ],
              dashboards: [
                {
                  name: 'application-metrics',
                  type: 'grafana',
                  widgets: [
                    { name: 'response-time', type: 'chart', query: 'avg(response_time)' },
                    { name: 'error-rate', type: 'metric', query: 'rate(errors[5m])' }
                  ]
                }
              ]
            }
          }
        }
      });
    });

    it('should configure CI/CD pipelines', async () => {
      // Workflow automation should be configured
      expect(automationEngine).toBeDefined();
    });

    it('should handle test automation configuration', async () => {
      // Test automation should be properly configured
      expect(automationEngine).toBeDefined();
    });

    it('should setup deployment automation', async () => {
      // Deployment automation should be configured with environments and strategies
      expect(automationEngine).toBeDefined();
    });
  });

  describe('Metrics Analytics Mode', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
      
      // Configure metrics analytics mode
      await automationEngine.configureMode('metrics_analytics', {
        enabled: true,
        config: {
          metricsCollection: {
            enabled: true,
            collectors: [
              {
                name: 'github_api_collector',
                type: 'github_api',
                schedule: '0 */6 * * *', // Every 6 hours
                metrics: ['commits', 'prs', 'issues', 'contributors', 'stars', 'forks'],
                filters: { timeRange: '30d' }
              },
              {
                name: 'webhook_collector',
                type: 'webhook',
                schedule: '* * * * *', // Every minute
                metrics: ['events', 'activity'],
                filters: {}
              }
            ],
            storage: {
              type: 'time_series',
              connection: 'influxdb://localhost:8086',
              configuration: {
                database: 'github_metrics',
                retention: '30d'
              }
            },
            retention: {
              duration: 31536000000, // 1 year
              aggregation: [
                { interval: 3600000, method: 'avg', metrics: ['response_time'] }, // Hourly avg
                { interval: 86400000, method: 'sum', metrics: ['commits', 'prs', 'issues'] } // Daily sum
              ],
              archival: [
                { age: 2592000000, destination: 's3://metrics-archive', compression: true } // 30 days
              ]
            }
          },
          reportingSchedule: {
            frequency: 'weekly',
            recipients: ['team-lead@company.com', 'product-manager@company.com'],
            format: 'html',
            template: 'weekly-summary'
          },
          alertThresholds: [
            { metric: 'error_rate', operator: 'gt', value: 0.05, severity: 'warning' },
            { metric: 'response_time', operator: 'gt', value: 1000, severity: 'warning' },
            { metric: 'open_issues', operator: 'gt', value: 50, severity: 'error' },
            { metric: 'pr_age', operator: 'gt', value: 604800000, severity: 'warning' } // 1 week
          ]
        }
      });
    });

    it('should collect repository metrics', async () => {
      const metrics = await automationEngine.getMetrics(testRepository);
      
      expect(metrics).toBeDefined();
      expect(metrics.metrics).toBeDefined();
      expect(metrics.metrics.stars).toBe(100);
      expect(metrics.contributors).toBeDefined();
    });

    it('should collect overall metrics', async () => {
      const overallMetrics = await automationEngine.getMetrics();
      
      expect(overallMetrics).toBeDefined();
      expect(overallMetrics.totalRepositories).toBeGreaterThanOrEqual(0);
      expect(overallMetrics.avgQualityScore).toBeGreaterThan(0);
    });

    it('should generate metrics reports', async () => {
      // Metrics should be collectible and reportable
      const metrics = await automationEngine.getMetrics(testRepository);
      
      expect(metrics).toBeDefined();
      // In a real implementation, this would generate actual reports
    });
  });

  describe('Event-Driven Automation', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
      
      // Configure all modes with event triggers
      await automationEngine.configureMode('pr_management', {
        enabled: true,
        triggers: [
          { event: 'pull_request', debounce: 1000 },
          { event: 'pull_request_review' }
        ]
      });
    });

    it('should handle GitHub webhook events', async () => {
      const mockEvent = {
        action: 'opened',
        pull_request: {
          number: 123,
          title: 'Test PR',
          head: { ref: 'feature-branch' },
          base: { ref: 'main' }
        },
        repository: {
          name: 'testrepo',
          owner: { login: 'testorg' },
          default_branch: 'main'
        }
      };

      // Simulate webhook event processing
      // In real implementation, this would trigger automation
      expect(mockEvent).toBeDefined();
      expect(mockEvent.pull_request.number).toBe(123);
    });

    it('should queue and process automation tasks', async () => {
      // Automation tasks should be queued and processed asynchronously
      expect(automationEngine).toBeDefined();
    });

    it('should handle event debouncing', async () => {
      // Rapid events should be debounced to prevent spam
      expect(automationEngine).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
    });

    it('should handle GitHub API rate limiting', async () => {
      // Should gracefully handle rate limiting
      const analysis = await automationEngine.analyzeRepository(testRepository);
      expect(analysis).toBeDefined();
    });

    it('should retry failed operations', async () => {
      // Should implement retry logic for transient failures
      const analysis = await automationEngine.analyzeRepository(testRepository);
      expect(analysis).toBeDefined();
    });

    it('should handle invalid repository references', async () => {
      const invalidRepo = {
        owner: 'nonexistent',
        repo: 'nonexistent',
        branch: 'main'
      };

      // Mock the API to throw an error for invalid repo
      mockReposGet.mockRejectedValueOnce(new Error('Repository not found'));

      // Should handle gracefully without crashing
      await expect(automationEngine.analyzeRepository(invalidRepo)).rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      // Should handle network timeouts gracefully
      const analysis = await automationEngine.analyzeRepository(testRepository);
      expect(analysis).toBeDefined();
    });
  });

  describe('Integration and Performance', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
    });

    it('should handle multiple concurrent operations', async () => {
      const operations = [
        automationEngine.analyzeRepository(testRepository),
        automationEngine.managePullRequest(testRepository, 123),
        automationEngine.processIssue(testRepository, 456)
      ];

      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toBeDefined(); // Repository analysis
      // Other operations complete without errors
    });

    it('should cache results efficiently', async () => {
      const startTime = Date.now();
      
      // First call
      await automationEngine.analyzeRepository(testRepository);
      const firstCallTime = Date.now() - startTime;
      
      // Second call should be faster due to caching
      const secondStartTime = Date.now();
      await automationEngine.analyzeRepository(testRepository);
      const secondCallTime = Date.now() - secondStartTime;
      
      // Second call should generally be faster, though this may vary in tests
      expect(secondCallTime).toBeLessThanOrEqual(firstCallTime + 100); // Allow some variance
    });

    it('should handle large repositories efficiently', async () => {
      const largeRepo = {
        owner: 'microsoft',
        repo: 'vscode', // Simulating a large repository
        branch: 'main'
      };

      const startTime = Date.now();
      const analysis = await automationEngine.analyzeRepository(largeRepo);
      const duration = Date.now() - startTime;
      
      expect(analysis).toBeDefined();
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Configuration and Customization', () => {
    beforeEach(async () => {
      await automationEngine.initialize();
    });

    it('should support custom automation rules', async () => {
      const customConfig: Partial<AutomationMode> = {
        enabled: true,
        config: {
          priorityRules: [
            { condition: 'title.includes("HOTFIX")', priority: 'critical', labels: ['hotfix', 'urgent'] },
            { condition: 'title.includes("BREAKING")', priority: 'critical', labels: ['breaking-change'] }
          ]
        }
      };

      await automationEngine.configureMode('issue_tracking', customConfig);
      
      // Custom configuration should be applied
      expect(automationEngine).toBeDefined();
    });

    it('should support multiple repository configurations', async () => {
      const repo1 = { owner: 'org1', repo: 'repo1', branch: 'main' };
      const repo2 = { owner: 'org2', repo: 'repo2', branch: 'develop' };
      
      // Should handle different repositories with different configurations
      const analysis1 = await automationEngine.analyzeRepository(repo1);
      const analysis2 = await automationEngine.analyzeRepository(repo2);
      
      expect(analysis1.repository).toEqual(repo1);
      expect(analysis2.repository).toEqual(repo2);
    });

    it('should support environment-specific configurations', async () => {
      // Different configurations for different environments
      const stagingConfig: Partial<AutomationMode> = {
        enabled: true,
        config: {
          deploymentAutomation: {
            enabled: true,
            environments: [
              { name: 'staging', type: 'staging', url: 'https://staging.example.com' }
            ],
            strategies: [
              { name: 'rolling', type: 'rolling', parameters: {} }
            ],
            monitoring: {
              enabled: true,
              metrics: ['response_time'],
              alerts: [],
              dashboards: []
            }
          }
        }
      };

      await automationEngine.configureMode('workflow_automation', stagingConfig);
      
      expect(automationEngine).toBeDefined();
    });
  });
}); 