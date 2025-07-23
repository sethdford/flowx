/**
 * Enterprise Module Exports
 * Centralized exports for all enterprise functionality
 */

// Core Enterprise Managers
export { AnalyticsManager } from './analytics-manager.js';
export { AuditManager } from './audit-manager.js';
export { CloudManager } from './cloud-manager.js';
export { DeploymentManager } from './deployment-manager.js';
export { InfrastructureManager } from './infrastructure-manager.js';
export { ProjectManager } from './project-manager.js';

// GitHub Integration
export { GitHubCoordinator } from './github-coordinator.js';
export { IssueTracker } from './issue-tracker.js';

// Atlassian Integration
export { JiraIntegration } from './jira-integration.js';
export { ConfluenceIntegration } from './confluence-integration.js';

// Type exports to avoid conflicts
export type {
  AnalyticsMetric,
  AnalyticsDashboard,
  AnalyticsInsight,
  PerformanceMetrics as AnalyticsPerformanceMetrics,
  UsageMetrics,
  BusinessMetrics,
  PredictiveModel
} from './analytics-manager.js';

export type {
  AuditEntry,
  ComplianceFramework,
  ComplianceRequirement as AuditComplianceRequirement,
  AuditReport,
  AuditMetrics,
  AuditConfiguration
} from './audit-manager.js';

export type {
  CloudProvider,
  CloudResource,
  CloudInfrastructure,
  CloudMetrics,
  CostOptimization
} from './cloud-manager.js';

export type {
  Deployment as EnterpriseDeployment,
  DeploymentEnvironment,
  DeploymentStrategy,
  DeploymentStage,
  DeploymentMetrics,
  DeploymentPipeline as EnterpriseDeploymentPipeline
} from './deployment-manager.js';

export type {
  InfrastructureConfig,
  PerformanceMetrics as InfrastructurePerformanceMetrics,
  ContainerStatus,
  ScalingDecision
} from './infrastructure-manager.js';

export type {
  Project as EnterpriseProject,
  ProjectPhase as EnterpriseProjectPhase,
  ProjectRisk as EnterpriseProjectRisk,
  ProjectMilestone,
  ProjectResource,
  ProjectMetrics,
  ProjectReport
} from './project-manager.js';

export type {
  GitHubRepository,
  SecurityAnalysis,
  CiCdPipeline,
  WorkflowCoordination,
  MultiRepositoryOperation
} from './github-coordinator.js';

export type {
  Issue,
  Sprint,
  Project as IssueProject,
  Milestone,
  ProjectCoordination
} from './issue-tracker.js';

export type {
  JiraConfig,
  JiraIssue,
  JiraSyncResult,
  JiraWebhookEvent
} from './jira-integration.js';

export type {
  ConfluenceConfig,
  ConfluencePage,
  DocumentationSyncResult,
  ProjectDocumentation,
  DocumentationPage,
  DocumentationTemplate
} from './confluence-integration.js';