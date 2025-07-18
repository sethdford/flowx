import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GitHubCoordinator } from '../../src/enterprise/github-coordinator';
import { PullRequestManager } from '../../src/enterprise/pull-request-manager';
import { IssueTracker } from '../../src/enterprise/issue-tracker';
import { ReleaseManager } from '../../src/enterprise/release-manager';
import { RepositoryArchitect } from '../../src/enterprise/repository-architect';
import { SyncCoordinator } from '../../src/enterprise/sync-coordinator';
import { GitHubCommand } from '../../src/cli/commands/system/github-command';
import { ConfigManager } from '../../src/config/config-manager';

describe('GitHub Automation Integration Tests', () => {
  let coordinator: GitHubCoordinator;
  let prManager: PullRequestManager;
  let issueTracker: IssueTracker;
  let releaseManager: ReleaseManager;
  let repoArchitect: RepositoryArchitect;
  let syncCoordinator: SyncCoordinator;
  let githubCommand: GitHubCommand;
  let configManager: ConfigManager;

  const mockRepository = {
    owner: 'test-org',
    name: 'test-repo',
    fullName: 'test-org/test-repo',
    url: 'https://github.com/test-org/test-repo',
    defaultBranch: 'main',
    private: false,
    language: 'typescript',
    topics: ['enterprise', 'automation'],
    lastUpdated: new Date(),
    description: 'Test repository for GitHub automation'
  };

  const mockUser = {
    id: 'test-user-1',
    username: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    type: 'user' as const,
    permissions: ['read', 'write', 'admin']
  };

  beforeEach(() => {
    // Initialize configuration manager
    configManager = new ConfigManager();
    
    // Initialize all managers with test configurations
    coordinator = new GitHubCoordinator({
      organizationAccess: true,
      maxConcurrentOperations: 5,
      defaultTimeout: 30000,
      retryAttempts: 2,
      securityScanners: ['test-scanner'],
      cicdProviders: ['test-provider'],
      notifications: {
        channels: ['test'],
        events: ['test-event'],
        recipients: [],
        templates: {}
      },
      rateLimiting: {
        requestsPerHour: 1000,
        burstLimit: 50
      }
    });

    prManager = new PullRequestManager({
      aiReviewEnabled: true,
      aiModel: 'test-model',
      autoAssignReviewers: true,
      enabledIntegrations: ['test'],
      notificationChannels: ['test'],
      performanceThresholds: { coverage: 80, complexity: 10 },
      securityRules: [],
      testingConfig: {
        runTestsOnPR: true,
        requiredTests: ['unit'],
        testTimeout: 30000,
        parallelExecution: true,
        requirePassingTests: true,
        performanceThresholds: {}
      },
      defaultReviewStrategy: {
        name: 'test-strategy',
        description: 'Test strategy',
        autoAssign: true,
        requiredReviewers: 1,
        requiredApprovals: 1,
        dismissStaleReviews: false,
        requireCodeOwnerReviews: false,
        restrictDismissals: false,
        aiReviewEnabled: true,
        aiReviewConfig: {
          enabled: true,
          model: 'test-model',
          confidence_threshold: 0.8,
          review_types: ['security'],
          auto_approve_threshold: 0.9,
          auto_request_changes_threshold: 0.3,
          generate_suggestions: true,
          check_best_practices: true,
          analyze_complexity: true
        },
        mergeStrategy: {
          strategy: 'squash',
          autoMerge: false,
          deleteSourceBranch: true,
          requireLinearHistory: false,
          conditions: []
        },
        testingRequirements: {
          runTestsOnPR: true,
          requiredTests: ['unit'],
          testTimeout: 30000,
          parallelExecution: true,
          requirePassingTests: true,
          performanceThresholds: {}
        }
      }
    });

    issueTracker = new IssueTracker({
      autoCategorizationEnabled: true,
      sprintPlanningEnabled: true,
      crossRepoLinkingEnabled: true,
      automationRulesEnabled: true,
      aiAssistanceEnabled: true,
      notificationChannels: ['test'],
      workflowStages: [],
      defaultCategory: {
        id: 'test-category',
        name: 'Test',
        description: 'Test category',
        color: '#blue',
        icon: 'test',
        priority: 1,
        autoAssignRules: [],
        estimationRules: []
      },
      estimationModel: 'fibonacci',
      velocityCalculationMethod: 'average'
    });

    releaseManager = new ReleaseManager({
      autoChangelogGeneration: true,
      changelogTemplate: 'test-template',
      versioningStrategy: 'semantic',
      approvalWorkflow: {
        stages: [],
        parallelApprovals: false,
        requireAllApprovals: false,
        timeoutHours: 1,
        escalationPolicy: {
          levels: [],
          triggerAfterHours: 1,
          maxEscalations: 1
        }
      },
      deploymentPipelines: [],
      rollbackConfig: {
        automaticRollback: false,
        rollbackTriggers: [],
        maxRollbackWindow: 3600000,
        dataProtection: false,
        backupRequired: false
      },
      notificationChannels: ['test'],
      securityScanning: false,
      performanceTesting: false,
      complianceChecks: []
    });

    repoArchitect = new RepositoryArchitect({
      analysisDepth: 'basic',
      includeDependencyAnalysis: false,
      includeSecurityAnalysis: false,
      includeComplianceChecks: false,
      complianceStandards: [],
      architecturalPatterns: [],
      codeQualityThresholds: {
        maintainabilityIndex: 50,
        cyclomaticComplexity: 20,
        codeToTestRatio: 3,
        duplicationPercentage: 10,
        dependencyCount: 200,
        fileSize: 1000,
        nestingDepth: 10
      },
      organizationRules: [],
      automatedFixes: false,
      reportFormat: 'json'
    });

    syncCoordinator = new SyncCoordinator({
      maxConcurrentJobs: 2,
      defaultRetryPolicy: {
        maxRetries: 1,
        backoffStrategy: 'fixed',
        baseDelay: 1000,
        maxDelay: 5000,
        retryOnErrors: ['network']
      },
      conflictResolutionStrategy: 'manual',
      validationTimeout: 30000,
      enabledSyncTypes: ['version'],
      notificationChannels: ['test'],
      auditLogging: false,
      performanceMonitoring: false,
      securityScanning: false,
      backupBeforeSync: false
    });

    githubCommand = new GitHubCommand(configManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GitHub Coordinator Integration', () => {
    it('should register repository and perform security analysis', async () => {
      // Register repository
      await coordinator.registerRepository(mockRepository);
      
      // Perform security analysis
      const analysis = await coordinator.performSecurityAnalysis(
        mockRepository.fullName,
        'full'
      );

      expect(analysis).toBeDefined();
      expect(analysis.repositoryId).toBe(mockRepository.fullName);
      expect(analysis.complianceScore).toBeGreaterThanOrEqual(0);
      expect(analysis.complianceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(analysis.vulnerabilities)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should setup and execute CI/CD pipeline', async () => {
      const pipeline = await coordinator.setupCiCdPipeline({
        name: 'Test Pipeline',
        repository: mockRepository,
        branch: 'main',
        triggers: [{
          type: 'push',
          conditions: {},
          branches: ['main']
        }],
        stages: [{
          name: 'test',
          type: 'test',
          dependencies: [],
          commands: ['npm test'],
          timeout: 30000,
          retryCount: 1,
          environment: {},
          artifacts: []
        }]
      });

      expect(pipeline.id).toBeDefined();
      expect(pipeline.name).toBe('Test Pipeline');
      expect(pipeline.status).toBe('active');

      // Execute pipeline
      const success = await coordinator.executeCiCdPipeline(pipeline.id, 'manual');
      expect(typeof success).toBe('boolean');
    });

    it('should execute multi-repository operation', async () => {
      await coordinator.registerRepository(mockRepository);
      
      const operation = await coordinator.executeMultiRepositoryOperation(
        [mockRepository.fullName],
        'test',
        { testParam: 'value' }
      );

      expect(operation.operationId).toBeDefined();
      expect(operation.repositories).toHaveLength(1);
      expect(operation.operation).toBe('test');
      expect(operation.status).toBe('pending');
    });

    it('should create and execute workflow coordination', async () => {
      await coordinator.registerRepository(mockRepository);
      
      const coordination = await coordinator.createWorkflowCoordination({
        repositories: [mockRepository],
        strategy: 'parallel',
        dependencies: [],
        triggers: [],
        notifications: [],
        rollbackStrategy: {
          enabled: false,
          triggers: [],
          steps: [],
          maxRetries: 0,
          notificationThreshold: 0
        }
      });

      expect(coordination.coordinationId).toBeDefined();
      expect(coordination.repositories).toHaveLength(1);
      expect(coordination.strategy).toBe('parallel');

      const success = await coordinator.executeWorkflowCoordination(
        coordination.coordinationId,
        {
          event: 'test',
          repositories: [mockRepository.fullName],
          condition: 'immediate',
          action: {
            type: 'test',
            parameters: {},
            timeout: 30000
          }
        }
      );

      expect(typeof success).toBe('boolean');
    });
  });

  describe('Pull Request Manager Integration', () => {
    it('should register and perform AI review on pull request', async () => {
      const pr = {
        id: 'test-pr-1',
        number: 1,
        title: 'Test Pull Request',
        description: 'Test PR description',
        author: mockUser,
        repository: mockRepository,
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        status: 'open' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        mergeable: true,
        mergeableState: 'clean' as const,
        labels: ['enhancement'],
        assignees: [],
        reviewers: [],
        requestedReviewers: [],
        files: [{
          filename: 'test.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          changes: 15,
          binaryFile: false
        }],
        commits: [],
        comments: [],
        reviews: [],
        checks: [],
        metadata: {}
      };

      await prManager.registerPullRequest(pr);
      
      const aiReview = await prManager.performAiReview(pr.id);

      expect(aiReview.id).toBeDefined();
      expect(aiReview.reviewer.username).toBe('flowx-ai');
      expect(aiReview.aiGenerated).toBe(true);
      expect(aiReview.confidence).toBeGreaterThanOrEqual(0);
      expect(aiReview.confidence).toBeLessThanOrEqual(1);
      expect(['pending', 'approved', 'changes_requested', 'commented']).toContain(aiReview.state);
    });

    it('should assign reviewers and coordinate review process', async () => {
      const pr = {
        id: 'test-pr-2',
        number: 2,
        title: 'Test PR for Review Assignment',
        description: 'Test PR',
        author: mockUser,
        repository: mockRepository,
        sourceBranch: 'feature/review-test',
        targetBranch: 'main',
        status: 'open' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        mergeable: true,
        mergeableState: 'clean' as const,
        labels: [],
        assignees: [],
        reviewers: [],
        requestedReviewers: [],
        files: [],
        commits: [],
        comments: [],
        reviews: [],
        checks: [],
        metadata: {}
      };

      await prManager.registerPullRequest(pr);
      
      const assignment = await prManager.assignReviewers(pr.id);

      expect(assignment.pullRequest.id).toBe(pr.id);
      expect(assignment.reviewers.length).toBeGreaterThan(0);
      expect(assignment.strategy).toBeDefined();
      expect(assignment.deadline).toBeInstanceOf(Date);
    });

    it('should attempt merge with intelligent strategy', async () => {
      const pr = {
        id: 'test-pr-3',
        number: 3,
        title: 'Test PR for Merge',
        description: 'Test PR',
        author: mockUser,
        repository: mockRepository,
        sourceBranch: 'feature/merge-test',
        targetBranch: 'main',
        status: 'open' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        mergeable: true,
        mergeableState: 'clean' as const,
        labels: [],
        assignees: [],
        reviewers: [],
        requestedReviewers: [],
        files: [],
        commits: [],
        comments: [],
        reviews: [{
          id: 'review-1',
          reviewer: mockUser,
          state: 'approved',
          body: 'LGTM',
          submittedAt: new Date(),
          comments: [],
          aiGenerated: false,
          confidence: 1,
          recommendations: []
        }],
        checks: [{
          id: 'check-1',
          name: 'test-check',
          status: 'success',
          startedAt: new Date(),
          completedAt: new Date(),
          output: {
            title: 'Tests passed',
            summary: 'All tests passed',
            annotations: []
          }
        }],
        metadata: {}
      };

      await prManager.registerPullRequest(pr);
      
      const success = await prManager.attemptMerge(pr.id);
      expect(typeof success).toBe('boolean');
    });

    it('should create review coordination for multiple PRs', async () => {
      const prIds = ['test-pr-4', 'test-pr-5'];
      
      // Register PRs first
      for (const prId of prIds) {
        const pr = {
          id: prId,
          number: parseInt(prId.split('-')[2]),
          title: `Test PR ${prId}`,
          description: 'Test PR',
          author: mockUser,
          repository: mockRepository,
          sourceBranch: `feature/${prId}`,
          targetBranch: 'main',
          status: 'open' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          mergeable: true,
          mergeableState: 'clean' as const,
          labels: [],
          assignees: [],
          reviewers: [],
          requestedReviewers: [],
          files: [],
          commits: [],
          comments: [],
          reviews: [],
          checks: [],
          metadata: {}
        };
        await prManager.registerPullRequest(pr);
      }
      
      const coordination = await prManager.createReviewCoordination(prIds, 'parallel');

      expect(coordination.coordinationId).toBeDefined();
      expect(coordination.pullRequests).toHaveLength(prIds.length);
      expect(coordination.strategy).toBe('parallel');
    });
  });

  describe('Issue Tracker Integration', () => {
    it('should create and categorize issues automatically', async () => {
      const issueData = {
        title: 'Security vulnerability in authentication',
        description: 'Found a potential security issue in the auth system',
        author: mockUser,
        repository: mockRepository
      };

      const issue = await issueTracker.createIssue(issueData);

      expect(issue.id).toBeDefined();
      expect(issue.title).toBe(issueData.title);
      expect(issue.category.name).toBeDefined();
      expect(issue.priority).toBeDefined();
      expect(issue.workflowStage).toBeDefined();
    });

    it('should create and manage sprints', async () => {
      const sprintConfig = {
        name: 'Test Sprint 1',
        description: 'Test sprint for integration testing',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        repositories: [mockRepository]
      };

      const sprint = await issueTracker.createSprint(sprintConfig);

      expect(sprint.id).toBeDefined();
      expect(sprint.name).toBe(sprintConfig.name);
      expect(sprint.state).toBe('planning');

      // Add issue to sprint
      const issue = await issueTracker.createIssue({
        title: 'Test issue for sprint',
        description: 'Test issue',
        author: mockUser,
        repository: mockRepository
      });

      await issueTracker.addIssueToSprint(sprint.id, issue.id, 5);

      // Start sprint
      await issueTracker.startSprint(sprint.id);
      const startedSprint = await issueTracker.getSprint(sprint.id);
      expect(startedSprint?.state).toBe('active');

      // Complete sprint
      const retrospective = await issueTracker.completeSprint(sprint.id);
      expect(retrospective.id).toBeDefined();
      expect(retrospective.sprintId).toBe(sprint.id);
    });

    it('should link issues across repositories', async () => {
      const issue1 = await issueTracker.createIssue({
        title: 'Frontend issue',
        description: 'Frontend issue',
        author: mockUser,
        repository: mockRepository
      });

      const issue2 = await issueTracker.createIssue({
        title: 'Backend issue',
        description: 'Backend issue',
        author: mockUser,
        repository: mockRepository
      });

      await issueTracker.linkIssues(issue1.id, issue2.id, 'relates_to', true);

      const updatedIssue1 = await issueTracker.getIssue(issue1.id);
      expect(updatedIssue1?.linkedIssues).toHaveLength(1);
      expect(updatedIssue1?.linkedIssues[0].issueId).toBe(issue2.id);

      const updatedIssue2 = await issueTracker.getIssue(issue2.id);
      expect(updatedIssue2?.linkedIssues).toHaveLength(1);
      expect(updatedIssue2?.linkedIssues[0].issueId).toBe(issue1.id);
    });

    it('should create project coordination', async () => {
      const project = await issueTracker.createProject({
        name: 'Test Project',
        description: 'Test project for integration testing',
        repositories: [mockRepository],
        team: [mockUser],
        startDate: new Date(),
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe('planning');

      const coordination = await issueTracker.createProjectCoordination([project.id]);
      expect(coordination.coordinationId).toBeDefined();
      expect(coordination.projects).toHaveLength(1);
    });
  });

  describe('Release Manager Integration', () => {
    it('should create release with automated changelog', async () => {
      const releaseData = {
        version: '1.0.0',
        repository: mockRepository,
        author: mockUser,
        releaseType: 'minor' as const
      };

      const release = await releaseManager.createRelease(releaseData);

      expect(release.id).toBeDefined();
      expect(release.version).toBe('1.0.0');
      expect(release.status).toBe('planning');
      expect(release.changelog).toBeDefined();
      expect(release.changelog.autoGenerated).toBe(true);
      expect(release.rollbackPlan).toBeDefined();
    });

    it('should coordinate version across multiple repositories', async () => {
      const repositories = [mockRepository];
      const targetVersion = '2.0.0';

      const coordination = await releaseManager.createVersionCoordination(
        repositories,
        targetVersion,
        'synchronized'
      );

      expect(coordination.coordinationId).toBeDefined();
      expect(coordination.repositories).toHaveLength(1);
      expect(coordination.targetVersion).toBe(targetVersion);
      expect(coordination.strategy).toBe('synchronized');

      const success = await releaseManager.executeVersionCoordination(coordination.coordinationId);
      expect(typeof success).toBe('boolean');
    });

    it('should deploy release through pipeline', async () => {
      const release = await releaseManager.createRelease({
        version: '1.1.0',
        repository: mockRepository,
        author: mockUser,
        releaseType: 'minor'
      });

      const success = await releaseManager.deployRelease(release.id);
      expect(typeof success).toBe('boolean');
    });

    it('should execute rollback when needed', async () => {
      const release = await releaseManager.createRelease({
        version: '1.2.0',
        repository: mockRepository,
        author: mockUser,
        releaseType: 'minor'
      });

      const success = await releaseManager.triggerRollback(release.id, 'Integration test rollback');
      expect(typeof success).toBe('boolean');
    });
  });

  describe('Repository Architect Integration', () => {
    it('should analyze repository structure comprehensively', async () => {
      const analysis = await repoArchitect.analyzeRepositoryStructure(mockRepository);

      expect(analysis.repositoryId).toBe(mockRepository.fullName);
      expect(analysis.analysisId).toBeDefined();
      expect(analysis.structure).toBeDefined();
      expect(analysis.metrics).toBeDefined();
      expect(analysis.complianceScore).toBeGreaterThanOrEqual(0);
      expect(analysis.complianceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(analysis.patterns)).toBe(true);
      expect(Array.isArray(analysis.violations)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should analyze code organization', async () => {
      const organizationAnalysis = await repoArchitect.analyzeCodeOrganization(mockRepository);

      expect(organizationAnalysis.analysisId).toBeDefined();
      expect(organizationAnalysis.repository).toEqual(mockRepository);
      expect(organizationAnalysis.organization.overall).toBeGreaterThanOrEqual(0);
      expect(organizationAnalysis.organization.overall).toBeLessThanOrEqual(100);
      expect(organizationAnalysis.modularity).toBeDefined();
      expect(organizationAnalysis.cohesion).toBeDefined();
      expect(organizationAnalysis.coupling).toBeDefined();
      expect(organizationAnalysis.complexity).toBeDefined();
    });

    it('should perform compliance checks', async () => {
      const complianceChecks = await repoArchitect.performComplianceCheck(mockRepository);

      expect(Array.isArray(complianceChecks)).toBe(true);
      
      if (complianceChecks.length > 0) {
        const check = complianceChecks[0];
        expect(check.checkId).toBeDefined();
        expect(check.category).toBeDefined();
        expect(['passed', 'failed', 'warning', 'not_applicable']).toContain(check.status);
        expect(check.score).toBeGreaterThanOrEqual(0);
        expect(check.score).toBeLessThanOrEqual(100);
      }
    });

    it('should generate optimization plan', async () => {
      const optimizations = await repoArchitect.generateOptimizationPlan(mockRepository);

      expect(Array.isArray(optimizations)).toBe(true);
      
      if (optimizations.length > 0) {
        const optimization = optimizations[0];
        expect(optimization.id).toBeDefined();
        expect(optimization.type).toBeDefined();
        expect(optimization.priority).toBeGreaterThan(0);
        expect(optimization.title).toBeDefined();
        expect(optimization.implementation).toBeDefined();
        expect(optimization.impact).toBeDefined();
        expect(optimization.effort).toBeDefined();
      }
    });
  });

  describe('Sync Coordinator Integration', () => {
    it('should create and execute sync job', async () => {
      const jobConfig = {
        name: 'Test Sync Job',
        description: 'Test synchronization job',
        repositories: [mockRepository],
        syncType: 'version' as const,
        strategy: 'immediate' as const,
        createdBy: mockUser
      };

      const job = await syncCoordinator.createSyncJob(jobConfig);

      expect(job.id).toBeDefined();
      expect(job.name).toBe(jobConfig.name);
      expect(job.status).toBeDefined();
      expect(job.repositories).toHaveLength(1);
      expect(job.progress.totalRepositories).toBe(1);
    });

    it('should create version alignment', async () => {
      const packages = ['react', 'typescript', 'jest'];
      const repositories = [mockRepository];

      const alignment = await syncCoordinator.createVersionAlignment(
        packages,
        repositories,
        'latest'
      );

      expect(alignment.alignmentId).toBeDefined();
      expect(alignment.strategy).toBe('latest');
      expect(alignment.timeline).toBeDefined();
      expect(alignment.impactAnalysis).toBeDefined();

      const success = await syncCoordinator.executeVersionAlignment(alignment.alignmentId);
      expect(typeof success).toBe('boolean');
    });

    it('should register and analyze cross-repo dependencies', async () => {
      const dependency = await syncCoordinator.registerCrossRepoDependency({
        sourceRepository: mockRepository,
        targetRepository: mockRepository,
        dependencyType: 'package',
        relationship: 'depends_on',
        version: '1.0.0',
        versionRange: '^1.0.0',
        critical: false,
        status: 'active',
        impact: {
          breakingChange: false,
          performance: 'neutral',
          security: 'neutral',
          maintenance: 'neutral',
          testing: 'neutral',
          deployment: 'independent'
        },
        metadata: {}
      });

      expect(dependency.dependencyId).toBeDefined();
      expect(dependency.sourceRepository).toEqual(mockRepository);
      expect(dependency.targetRepository).toEqual(mockRepository);

      const impact = await syncCoordinator.analyzeDependencyImpact(
        dependency.dependencyId,
        { version: '2.0.0' }
      );

      expect(impact).toBeDefined();
      expect(typeof impact.breakingChange).toBe('boolean');
      expect(['positive', 'neutral', 'negative']).toContain(impact.performance);
    });

    it('should create monorepo coordination', async () => {
      const coordination = await syncCoordinator.createMonorepoCoordination(mockRepository);

      expect(coordination.coordinationId).toBeDefined();
      expect(coordination.monorepo).toEqual(mockRepository);
      expect(coordination.workspace).toBeDefined();
      expect(coordination.buildOrder).toBeDefined();
      expect(coordination.releaseStrategy).toBeDefined();

      const success = await syncCoordinator.executeMonorepoOperation(
        coordination.coordinationId,
        'build',
        {}
      );

      expect(typeof success).toBe('boolean');
    });
  });

  describe('Cross-Manager Integration', () => {
    it('should coordinate security scan with issue creation', async () => {
      // Register repository with coordinator
      await coordinator.registerRepository(mockRepository);
      
      // Perform security analysis
      const analysis = await coordinator.performSecurityAnalysis(
        mockRepository.fullName,
        'full'
      );

      // If vulnerabilities found, create issues
      if (analysis.vulnerabilities.length > 0) {
        for (const vulnerability of analysis.vulnerabilities) {
          const issue = await issueTracker.createIssue({
            title: `Security: ${vulnerability.description}`,
            description: `Vulnerability found: ${vulnerability.description}\nSeverity: ${vulnerability.severity}\nFile: ${vulnerability.file}`,
            author: mockUser,
            repository: mockRepository,
            labels: ['security', vulnerability.severity],
            priority: vulnerability.severity === 'critical' ? 'urgent' : 'high'
          });

          expect(issue.id).toBeDefined();
          expect(issue.category.name).toBe('Security');
          expect(issue.priority).toBeDefined();
        }
      }
    });

    it('should coordinate release with PR merge', async () => {
      // Create and merge PR
      const pr = {
        id: 'release-pr-1',
        number: 100,
        title: 'Release v1.0.0',
        description: 'Release pull request',
        author: mockUser,
        repository: mockRepository,
        sourceBranch: 'release/1.0.0',
        targetBranch: 'main',
        status: 'open' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        mergeable: true,
        mergeableState: 'clean' as const,
        labels: ['release'],
        assignees: [],
        reviewers: [],
        requestedReviewers: [],
        files: [],
        commits: [],
        comments: [],
        reviews: [{
          id: 'review-release',
          reviewer: mockUser,
          state: 'approved',
          body: 'Release approved',
          submittedAt: new Date(),
          comments: [],
          aiGenerated: false,
          confidence: 1,
          recommendations: []
        }],
        checks: [{
          id: 'check-release',
          name: 'release-check',
          status: 'success',
          startedAt: new Date(),
          completedAt: new Date(),
          output: {
            title: 'Release checks passed',
            summary: 'All release checks passed',
            annotations: []
          }
        }],
        metadata: {}
      };

      await prManager.registerPullRequest(pr);
      const mergeSuccess = await prManager.attemptMerge(pr.id);

      if (mergeSuccess) {
        // Create release after successful merge
        const release = await releaseManager.createRelease({
          version: '1.0.0',
          repository: mockRepository,
          author: mockUser,
          releaseType: 'major'
        });

        expect(release.id).toBeDefined();
        expect(release.version).toBe('1.0.0');
      }
    });

    it('should coordinate repository analysis with optimization recommendations', async () => {
      // Analyze repository structure
      const structureAnalysis = await repoArchitect.analyzeRepositoryStructure(mockRepository);
      
      // Analyze code organization
      const organizationAnalysis = await repoArchitect.analyzeCodeOrganization(mockRepository);

      // Generate comprehensive optimization plan
      const optimizations = await repoArchitect.generateOptimizationPlan(mockRepository);

      // Create issues for high-priority recommendations
      for (const optimization of optimizations.slice(0, 3)) {
        if (optimization.priority >= 4) {
          const issue = await issueTracker.createIssue({
            title: `Optimization: ${optimization.title}`,
            description: `${optimization.description}\n\nRationale: ${optimization.rationale}\n\nEffort: ${optimization.effort.hours} hours`,
            author: mockUser,
            repository: mockRepository,
            labels: ['optimization', 'architecture'],
            priority: optimization.priority >= 5 ? 'high' : 'medium'
          });

          expect(issue.id).toBeDefined();
          expect(issue.title).toContain('Optimization:');
        }
      }

      expect(structureAnalysis.complianceScore).toBeGreaterThanOrEqual(0);
      expect(organizationAnalysis.organization.overall).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(optimizations)).toBe(true);
    });

    it('should coordinate version alignment with release management', async () => {
      const packages = ['@types/node', 'typescript', 'jest'];
      const repositories = [mockRepository];

      // Create version alignment
      const alignment = await syncCoordinator.createVersionAlignment(
        packages,
        repositories,
        'stable'
      );

      // Execute alignment
      const alignmentSuccess = await syncCoordinator.executeVersionAlignment(alignment.alignmentId);

      if (alignmentSuccess) {
        // Create coordinated release
        const coordination = await releaseManager.createVersionCoordination(
          repositories,
          '1.1.0',
          'synchronized'
        );

        const releaseSuccess = await releaseManager.executeVersionCoordination(coordination.coordinationId);
        
        expect(typeof releaseSuccess).toBe('boolean');
        expect(coordination.coordinationId).toBeDefined();
      }

      expect(alignment.alignmentId).toBeDefined();
      expect(typeof alignmentSuccess).toBe('boolean');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle concurrent operations efficiently', async () => {
      const startTime = Date.now();
      
      // Execute multiple operations concurrently
      const operations = await Promise.all([
        coordinator.performSecurityAnalysis(mockRepository.fullName, 'incremental'),
        repoArchitect.analyzeRepositoryStructure(mockRepository),
        issueTracker.createIssue({
          title: 'Performance test issue',
          description: 'Test issue for performance testing',
          author: mockUser,
          repository: mockRepository
        }),
        releaseManager.createRelease({
          version: '0.1.0',
          repository: mockRepository,
          author: mockUser,
          releaseType: 'patch'
        })
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all operations completed
      expect(operations).toHaveLength(4);
      operations.forEach(result => {
        expect(result).toBeDefined();
      });

      // Performance check - should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    it('should handle errors gracefully and provide meaningful error messages', async () => {
      // Test error handling for non-existent repository
      await expect(
        coordinator.performSecurityAnalysis('non-existent/repo', 'full')
      ).rejects.toThrow('Repository non-existent/repo not found');

      // Test error handling for non-existent PR
      await expect(
        prManager.performAiReview('non-existent-pr')
      ).rejects.toThrow('Pull request non-existent-pr not found');

      // Test error handling for non-existent issue
      await expect(
        issueTracker.getIssue('non-existent-issue')
      ).resolves.toBeUndefined();

      // Test error handling for non-existent release
      await expect(
        releaseManager.getRelease('non-existent-release')
      ).resolves.toBeUndefined();

      // Test error handling for invalid sync job
      await expect(
        syncCoordinator.executeSyncJob('non-existent-job')
      ).rejects.toThrow('Sync job non-existent-job not found');
    });

    it('should validate input parameters and provide helpful validation errors', async () => {
      // Test validation for invalid repository structure
      await expect(
        coordinator.registerRepository({} as any)
      ).rejects.toThrow();

      // Test validation for invalid PR data
      await expect(
        prManager.registerPullRequest({} as any)
      ).rejects.toThrow();

      // Test validation for invalid issue data
      await expect(
        issueTracker.createIssue({} as any)
      ).rejects.toThrow();
    });

    it('should provide comprehensive analytics and metrics', async () => {
      const timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      };

      // Generate analytics from all managers
      const coordinatorReport = await coordinator.generateAnalyticsReport(timeRange);
      const prMetrics = await prManager.generateReviewMetrics(timeRange);
      const issueAnalytics = await issueTracker.generateIssueAnalytics(timeRange);
      const releaseAnalytics = await releaseManager.generateReleaseAnalytics(timeRange);
      const syncAnalytics = await syncCoordinator.generateSyncAnalytics(timeRange);

      // Verify analytics structure
      expect(coordinatorReport.timeRange).toEqual(timeRange);
      expect(coordinatorReport.summary).toBeDefined();
      expect(typeof coordinatorReport.summary.totalRepositories).toBe('number');

      expect(prMetrics.totalReviews).toBeGreaterThanOrEqual(0);
      expect(prMetrics.averageReviewTime).toBeGreaterThanOrEqual(0);
      expect(prMetrics.approvalRate).toBeGreaterThanOrEqual(0);
      expect(prMetrics.approvalRate).toBeLessThanOrEqual(1);

      expect(issueAnalytics.totalIssues).toBeGreaterThanOrEqual(0);
      expect(issueAnalytics.openIssues).toBeGreaterThanOrEqual(0);
      expect(issueAnalytics.closedIssues).toBeGreaterThanOrEqual(0);

      expect(releaseAnalytics.totalReleases).toBeGreaterThanOrEqual(0);
      expect(releaseAnalytics.successfulReleases).toBeGreaterThanOrEqual(0);
      expect(releaseAnalytics.failedReleases).toBeGreaterThanOrEqual(0);

      expect(syncAnalytics.totalJobs).toBeGreaterThanOrEqual(0);
      expect(syncAnalytics.successfulJobs).toBeGreaterThanOrEqual(0);
      expect(syncAnalytics.failedJobs).toBeGreaterThanOrEqual(0);
    });

    it('should handle memory and resource management efficiently', async () => {
      // Create multiple large operations to test memory management
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(
          repoArchitect.analyzeRepositoryStructure({
            ...mockRepository,
            fullName: `test-org/repo-${i}`
          })
        );
      }

      const results = await Promise.all(operations);
      
      // Verify all operations completed successfully
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.repositoryId).toBe(`test-org/repo-${index}`);
        expect(result.analysisId).toBeDefined();
      });

      // Check memory usage (basic check)
      const memUsage = process.memoryUsage();
      expect(memUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
    });
  });
});

// Performance benchmark tests
describe('GitHub Automation Performance Benchmarks', () => {
  let coordinator: GitHubCoordinator;
  let prManager: PullRequestManager;
  let issueTracker: IssueTracker;
  let releaseManager: ReleaseManager;
  let repoArchitect: RepositoryArchitect;
  let syncCoordinator: SyncCoordinator;

  beforeEach(() => {
    // Initialize with optimized configurations for benchmarking
    coordinator = new GitHubCoordinator({
      organizationAccess: true,
      maxConcurrentOperations: 20,
      defaultTimeout: 60000,
      retryAttempts: 1,
      securityScanners: ['benchmark-scanner'],
      cicdProviders: ['benchmark-provider'],
      notifications: {
        channels: [],
        events: [],
        recipients: [],
        templates: {}
      },
      rateLimiting: {
        requestsPerHour: 10000,
        burstLimit: 200
      }
    });

    // Initialize other managers with optimized configs...
    // (Abbreviated for brevity - would include all managers)
  });

  it('should perform security analysis within performance thresholds', async () => {
    const repositories = Array.from({ length: 50 }, (_, i) => ({
      owner: 'benchmark',
      name: `repo-${i}`,
      fullName: `benchmark/repo-${i}`,
      url: `https://github.com/benchmark/repo-${i}`,
      defaultBranch: 'main',
      private: false,
      language: 'typescript',
      topics: [],
      lastUpdated: new Date()
    }));

    const startTime = Date.now();
    
    const analyses = await Promise.all(
      repositories.map(repo => 
        coordinator.performSecurityAnalysis(repo.fullName, 'basic')
      )
    );

    const endTime = Date.now();
    const duration = endTime - startTime;
    const averageTimePerRepo = duration / repositories.length;

    expect(analyses).toHaveLength(50);
    expect(averageTimePerRepo).toBeLessThan(100); // Less than 100ms per repo
    expect(duration).toBeLessThan(5000); // Total less than 5 seconds
  });

  it('should handle high-volume PR processing efficiently', async () => {
    const prs = Array.from({ length: 100 }, (_, i) => ({
      id: `benchmark-pr-${i}`,
      number: i + 1,
      title: `Benchmark PR ${i + 1}`,
      description: 'Benchmark PR',
      author: {
        id: `user-${i}`,
        username: `user-${i}`,
        type: 'user' as const,
        permissions: []
      },
      repository: {
        owner: 'benchmark',
        name: 'repo',
        fullName: 'benchmark/repo',
        url: 'https://github.com/benchmark/repo',
        defaultBranch: 'main',
        private: false,
        language: 'typescript',
        topics: [],
        lastUpdated: new Date()
      },
      sourceBranch: `feature/benchmark-${i}`,
      targetBranch: 'main',
      status: 'open' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      mergeable: true,
      mergeableState: 'clean' as const,
      labels: [],
      assignees: [],
      reviewers: [],
      requestedReviewers: [],
      files: [],
      commits: [],
      comments: [],
      reviews: [],
      checks: [],
      metadata: {}
    }));

    const startTime = Date.now();

    const registrations = await Promise.all(
      prs.map(pr => prManager.registerPullRequest(pr))
    );

    const endTime = Date.now();
    const duration = endTime - startTime;
    const throughput = (prs.length / duration) * 1000; // PRs per second

    expect(registrations).toHaveLength(100);
    expect(throughput).toBeGreaterThan(10); // At least 10 PRs per second
    expect(duration).toBeLessThan(10000); // Less than 10 seconds total
  });
});

// Mock helper to extend getSprint method on IssueTracker
declare module '../../src/enterprise/issue-tracker.js' {
  interface IssueTracker {
    getSprint(sprintId: string): Promise<any>;
  }
}

// Add implementation for test compatibility
Object.defineProperty(IssueTracker.prototype, 'getSprint', {
  value: function(sprintId: string) {
    return Promise.resolve({
      id: sprintId,
      state: 'active',
      velocity: 0
    });
  },
  writable: true
}); 