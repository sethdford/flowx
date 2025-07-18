/**
 * Enterprise Module Exports
 * Centralized exports for all enterprise functionality
 */

// Core Enterprise Managers
export { AnalyticsManager } from './analytics-manager.ts';
export { AuditManager } from './audit-manager.ts';
export { CloudManager } from './cloud-manager.ts';
export { DeploymentManager } from './deployment-manager.ts';
export { InfrastructureManager } from './infrastructure-manager.ts';
export { ProjectManager } from './project-manager.ts';

// GitHub Integration
export { GitHubCoordinator } from './github-coordinator.ts';
export { IssueTracker } from './issue-tracker.ts';

// Atlassian Integration
export { JiraIntegration } from './jira-integration.ts';
export { ConfluenceIntegration } from './confluence-integration.ts';

// Type exports to avoid conflicts
export type {
  AnalyticsMetric,
  AnalyticsDashboard,
  AnalyticsInsight,
  PerformanceMetrics as AnalyticsPerformanceMetrics,
  UsageMetrics,
  BusinessMetrics,
  PredictiveModel
} from './analytics-manager.ts';

export type {
  AuditEntry,
  ComplianceFramework,
  ComplianceRequirement as AuditComplianceRequirement,
  AuditReport,
  AuditMetrics,
  AuditConfiguration
} from './audit-manager.ts';

export type {
  CloudProvider,
  CloudResource,
  CloudInfrastructure,
  CloudMetrics,
  CostOptimization
} from './cloud-manager.ts';

export type {
  Deployment as EnterpriseDeployment,
  DeploymentEnvironment,
  DeploymentStrategy,
  DeploymentStage,
  DeploymentMetrics,
  DeploymentPipeline as EnterpriseDeploymentPipeline
} from './deployment-manager.ts';

export type {
  InfrastructureConfig,
  PerformanceMetrics as InfrastructurePerformanceMetrics,
  ContainerStatus,
  ScalingDecision
} from './infrastructure-manager.ts';

export type {
  Project as EnterpriseProject,
  ProjectPhase as EnterpriseProjectPhase,
  ProjectRisk as EnterpriseProjectRisk,
  ProjectMilestone,
  ProjectResource,
  ProjectMetrics,
  ProjectReport
} from './project-manager.ts';

export type {
  GitHubRepository,
  SecurityAnalysis,
  CiCdPipeline,
  WorkflowCoordination,
  MultiRepositoryOperation
} from './github-coordinator.ts';

export type {
  Issue,
  Sprint,
  Project as IssueProject,
  Milestone,
  ProjectCoordination
} from './issue-tracker.ts';

export type {
  JiraConfig,
  JiraIssue,
  JiraSyncResult,
  JiraWebhookEvent
} from './jira-integration.ts';

export type {
  ConfluenceConfig,
  ConfluencePage,
  DocumentationSyncResult,
  ProjectDocumentation,
  DocumentationPage,
  DocumentationTemplate
} from './confluence-integration.ts';