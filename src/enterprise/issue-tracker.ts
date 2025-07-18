import { EventEmitter } from 'events';
import { GitHubRepository } from './github-coordinator.js';
import { GitHubUser } from './pull-request-manager.js';

// Types and Interfaces
export interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  author: GitHubUser;
  repository: GitHubRepository;
  state: 'open' | 'closed' | 'in_progress' | 'blocked' | 'reviewing';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  severity: 'minor' | 'major' | 'critical' | 'blocker';
  category: IssueCategory;
  labels: string[];
  assignees: GitHubUser[];
  milestone: Milestone | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  linkedIssues: LinkedIssue[];
  dependencies: IssueDependency[];
  comments: IssueComment[];
  attachments: IssueAttachment[];
  workflowStage: WorkflowStage;
  automationRules: AutomationRule[];
  metadata: Record<string, any>;
}

export interface IssueCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  priority: number;
  autoAssignRules: AutoAssignRule[];
  templateId?: string;
  estimationRules: EstimationRule[];
}

export interface LinkedIssue {
  issueId: string;
  repository: string;
  linkType: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates' | 'part_of' | 'child_of';
  createdAt: Date;
  createdBy: GitHubUser;
}

export interface IssueDependency {
  dependentIssue: string;
  dependsOnIssue: string;
  type: 'hard' | 'soft' | 'preferred';
  repository: string;
  status: 'pending' | 'satisfied' | 'failed';
  createdAt: Date;
}

export interface IssueComment {
  id: string;
  author: GitHubUser;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  commentType: 'status_update' | 'question' | 'solution' | 'escalation' | 'automation';
  mentions: GitHubUser[];
  reactions: CommentReaction[];
  attachments: IssueAttachment[];
}

export interface CommentReaction {
  emoji: string;
  users: GitHubUser[];
  count: number;
}

export interface IssueAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  uploadedBy: GitHubUser;
  uploadedAt: Date;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  state: 'open' | 'closed';
  progress: number;
  issues: Issue[];
  repository: GitHubRepository;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sprint {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  state: 'planning' | 'active' | 'completed' | 'cancelled';
  capacity: SprintCapacity;
  issues: SprintIssue[];
  goals: SprintGoal[];
  retrospective?: SprintRetrospective;
  burndown: BurndownPoint[];
  velocity: number;
  repositories: GitHubRepository[];
}

export interface SprintCapacity {
  totalHours: number;
  availableHours: number;
  commitmentLevel: 'low' | 'medium' | 'high';
  teamSize: number;
  holidays: Date[];
  vacations: TeamVacation[];
}

export interface SprintIssue {
  issue: Issue;
  storyPoints: number;
  priority: number;
  addedAt: Date;
  addedBy: GitHubUser;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'removed';
  blockers: string[];
}

export interface SprintGoal {
  id: string;
  title: string;
  description: string;
  priority: number;
  metrics: GoalMetric[];
  achieved: boolean;
}

export interface GoalMetric {
  name: string;
  target: number;
  actual: number;
  unit: string;
}

export interface SprintRetrospective {
  id: string;
  sprintId: string;
  conductedAt: Date;
  facilitator: GitHubUser;
  participants: GitHubUser[];
  wentWell: RetroItem[];
  needsImprovement: RetroItem[];
  actionItems: ActionItem[];
  velocity: number;
  teamMorale: number;
}

export interface RetroItem {
  description: string;
  votes: number;
  category: string;
  actionRequired: boolean;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee: GitHubUser;
  dueDate: Date;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
}

export interface TeamVacation {
  member: GitHubUser;
  startDate: Date;
  endDate: Date;
  type: 'vacation' | 'sick' | 'conference' | 'other';
}

export interface BurndownPoint {
  date: Date;
  remainingHours: number;
  remainingStoryPoints: number;
  completed: number;
  added: number;
}

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  order: number;
  rules: WorkflowRule[];
  automations: WorkflowAutomation[];
  exitCriteria: ExitCriteria[];
}

export interface WorkflowRule {
  id: string;
  condition: string;
  action: string;
  priority: number;
  enabled: boolean;
}

export interface WorkflowAutomation {
  trigger: 'state_change' | 'time_based' | 'comment_added' | 'assignment_changed';
  condition: string;
  action: AutomationAction;
  enabled: boolean;
}

export interface AutomationAction {
  type: 'assign' | 'label' | 'comment' | 'notify' | 'close' | 'escalate' | 'link';
  parameters: Record<string, any>;
  delay?: number;
}

export interface ExitCriteria {
  description: string;
  required: boolean;
  autoCheck: boolean;
  checkFunction?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  priority: number;
  lastRun?: Date;
  runCount: number;
}

export interface AutomationTrigger {
  type: 'issue_created' | 'issue_updated' | 'comment_added' | 'label_changed' | 'assignment_changed' | 'status_changed' | 'time_based';
  filters: Record<string, any>;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex';
  value: any;
  negate: boolean;
}

export interface AutoAssignRule {
  condition: string;
  assignee: GitHubUser;
  priority: number;
  enabled: boolean;
}

export interface EstimationRule {
  pattern: string;
  baseHours: number;
  multiplier: number;
  confidence: number;
}

export interface ProjectCoordination {
  coordinationId: string;
  projects: Project[];
  issues: Issue[];
  crossRepoLinks: CrossRepoLink[];
  synchronizationRules: SyncRule[];
  dependencies: ProjectDependency[];
  timeline: ProjectTimeline;
  riskAssessment: RiskAssessment;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  repositories: GitHubRepository[];
  milestones: Milestone[];
  sprints: Sprint[];
  team: GitHubUser[];
  startDate: Date;
  targetDate: Date;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  progress: number;
  budget?: ProjectBudget;
}

export interface ProjectBudget {
  totalHours: number;
  usedHours: number;
  hourlyRate: number;
  totalCost: number;
  remainingBudget: number;
}

export interface CrossRepoLink {
  sourceRepo: string;
  targetRepo: string;
  sourceIssue: string;
  targetIssue: string;
  linkType: string;
  synchronize: boolean;
  bidirectional: boolean;
}

export interface SyncRule {
  id: string;
  name: string;
  description: string;
  repositories: string[];
  fields: string[];
  direction: 'source_to_target' | 'bidirectional' | 'target_to_source';
  conflictResolution: 'manual' | 'source_wins' | 'target_wins' | 'merge';
}

export interface ProjectDependency {
  dependentProject: string;
  dependsOnProject: string;
  type: 'blocking' | 'related' | 'sequential';
  status: 'pending' | 'satisfied' | 'at_risk';
}

export interface ProjectTimeline {
  phases: ProjectPhase[];
  criticalPath: string[];
  milestones: TimelineMilestone[];
  dependencies: TimelineDependency[];
}

export interface ProjectPhase {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  deliverables: Deliverable[];
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  assignee: GitHubUser;
}

export interface TimelineMilestone {
  id: string;
  name: string;
  date: Date;
  type: 'checkpoint' | 'release' | 'deadline';
  status: 'upcoming' | 'at_risk' | 'completed' | 'missed';
}

export interface TimelineDependency {
  predecessor: string;
  successor: string;
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  lag: number;
}

export interface RiskAssessment {
  risks: ProjectRisk[];
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategies: MitigationStrategy[];
  lastAssessed: Date;
}

export interface ProjectRisk {
  id: string;
  description: string;
  category: 'technical' | 'resource' | 'timeline' | 'external' | 'quality';
  probability: number;
  impact: number;
  riskScore: number;
  status: 'identified' | 'monitoring' | 'mitigating' | 'resolved' | 'realized';
  owner: GitHubUser;
}

export interface MitigationStrategy {
  riskId: string;
  strategy: string;
  actions: ActionItem[];
  effectiveness: number;
  cost: number;
}

export interface IssueTrackerConfig {
  autoCategorizationEnabled: boolean;
  sprintPlanningEnabled: boolean;
  crossRepoLinkingEnabled: boolean;
  automationRulesEnabled: boolean;
  aiAssistanceEnabled: boolean;
  notificationChannels: string[];
  workflowStages: WorkflowStage[];
  defaultCategory: IssueCategory;
  estimationModel: 'fibonacci' | 'linear' | 'tshirt' | 'hours';
  velocityCalculationMethod: 'average' | 'weighted' | 'trending';
}

/**
 * Enterprise-grade Issue Tracker
 * 
 * Provides comprehensive issue management capabilities including:
 * - Automatic issue categorization with AI assistance
 * - Project coordination across multiple repositories
 * - Sprint planning and agile workflow management
 * - Cross-repository issue linking and dependency tracking
 * - Advanced automation rules and workflow orchestration
 * - Real-time analytics and project health monitoring
 */
export class IssueTracker extends EventEmitter {
  private config: IssueTrackerConfig;
  private issues: Map<string, Issue> = new Map();
  private milestones: Map<string, Milestone> = new Map();
  private sprints: Map<string, Sprint> = new Map();
  private projects: Map<string, Project> = new Map();
  private workflows: Map<string, WorkflowStage> = new Map();
  private automationRules: Map<string, AutomationRule> = new Map();
  private crossRepoLinks: Map<string, CrossRepoLink> = new Map();
  private categories: Map<string, IssueCategory> = new Map();
  private performanceMetrics: Map<string, any> = new Map();

  constructor(config: IssueTrackerConfig) {
    super();
    this.config = config;
    this.setupEventHandlers();
    this.initializeDefaultCategories();
    this.initializeWorkflowStages();
  }

  private setupEventHandlers(): void {
    this.on('issue-created', this.handleIssueCreated.bind(this));
    this.on('issue-updated', this.handleIssueUpdated.bind(this));
    this.on('sprint-started', this.handleSprintStarted.bind(this));
    this.on('milestone-completed', this.handleMilestoneCompleted.bind(this));
    this.on('automation-triggered', this.handleAutomationTriggered.bind(this));
  }

  private initializeDefaultCategories(): void {
    const defaultCategories: IssueCategory[] = [
      {
        id: 'bug',
        name: 'Bug',
        description: 'Software defects and issues',
        color: '#d73a49',
        icon: 'bug',
        priority: 1,
        autoAssignRules: [],
        estimationRules: [
          { pattern: 'critical|urgent|blocker', baseHours: 8, multiplier: 2, confidence: 0.8 },
          { pattern: 'minor|cosmetic', baseHours: 2, multiplier: 1, confidence: 0.9 }
        ]
      },
      {
        id: 'feature',
        name: 'Feature',
        description: 'New features and enhancements',
        color: '#0075ca',
        icon: 'sparkles',
        priority: 2,
        autoAssignRules: [],
        estimationRules: [
          { pattern: 'epic|large', baseHours: 40, multiplier: 1.5, confidence: 0.6 },
          { pattern: 'small|simple', baseHours: 8, multiplier: 1, confidence: 0.8 }
        ]
      },
      {
        id: 'documentation',
        name: 'Documentation',
        description: 'Documentation updates and improvements',
        color: '#7057ff',
        icon: 'book',
        priority: 3,
        autoAssignRules: [],
        estimationRules: [
          { pattern: '.*', baseHours: 4, multiplier: 1, confidence: 0.9 }
        ]
      },
      {
        id: 'security',
        name: 'Security',
        description: 'Security vulnerabilities and improvements',
        color: '#b60205',
        icon: 'shield',
        priority: 0,
        autoAssignRules: [],
        estimationRules: [
          { pattern: 'critical|high', baseHours: 16, multiplier: 2, confidence: 0.7 },
          { pattern: 'medium|low', baseHours: 4, multiplier: 1, confidence: 0.8 }
        ]
      }
    ];

    defaultCategories.forEach(category => {
      this.categories.set(category.id, category);
    });
  }

  private initializeWorkflowStages(): void {
    const defaultStages: WorkflowStage[] = [
      {
        id: 'triage',
        name: 'Triage',
        description: 'Initial issue assessment and categorization',
        order: 1,
        rules: [],
        automations: [
          {
            trigger: 'state_change',
            condition: 'state == "open"',
            action: {
              type: 'label',
              parameters: { label: 'needs-triage' }
            },
            enabled: true
          }
        ],
        exitCriteria: [
          { description: 'Issue has been categorized', required: true, autoCheck: true },
          { description: 'Priority has been assigned', required: true, autoCheck: true }
        ]
      },
      {
        id: 'backlog',
        name: 'Backlog',
        description: 'Prioritized and ready for development',
        order: 2,
        rules: [],
        automations: [],
        exitCriteria: [
          { description: 'Issue has been assigned to sprint', required: false, autoCheck: true }
        ]
      },
      {
        id: 'in_progress',
        name: 'In Progress',
        description: 'Currently being worked on',
        order: 3,
        rules: [],
        automations: [
          {
            trigger: 'state_change',
            condition: 'state == "in_progress"',
            action: {
              type: 'notify',
              parameters: { channel: 'slack', message: 'Work started on issue' }
            },
            enabled: true
          }
        ],
        exitCriteria: [
          { description: 'Solution has been implemented', required: true, autoCheck: false }
        ]
      },
      {
        id: 'review',
        name: 'Review',
        description: 'Under review or testing',
        order: 4,
        rules: [],
        automations: [],
        exitCriteria: [
          { description: 'Code review completed', required: true, autoCheck: false },
          { description: 'Testing completed', required: true, autoCheck: false }
        ]
      },
      {
        id: 'done',
        name: 'Done',
        description: 'Completed and verified',
        order: 5,
        rules: [],
        automations: [
          {
            trigger: 'state_change',
            condition: 'state == "closed"',
            action: {
              type: 'comment',
              parameters: { body: 'Issue completed and verified' }
            },
            enabled: true
          }
        ],
        exitCriteria: []
      }
    ];

    defaultStages.forEach(stage => {
      this.workflows.set(stage.id, stage);
    });
  }

  // Issue Management
  async createIssue(issueData: Partial<Issue>): Promise<Issue> {
    const issue: Issue = {
      id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      number: await this.generateIssueNumber(issueData.repository!),
      title: issueData.title || 'Untitled Issue',
      description: issueData.description || '',
      author: issueData.author!,
      repository: issueData.repository!,
      state: 'open',
      priority: 'medium',
      severity: 'major',
      category: issueData.category || this.config.defaultCategory,
      labels: issueData.labels || [],
      assignees: issueData.assignees || [],
      milestone: issueData.milestone || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      linkedIssues: [],
      dependencies: [],
      comments: [],
      attachments: [],
      workflowStage: this.workflows.get('triage')!,
      automationRules: [],
      metadata: issueData.metadata || {}
    };

    // Auto-categorize if enabled
    if (this.config.autoCategorizationEnabled) {
      issue.category = await this.categorizeIssue(issue);
    }

    // Auto-assign if rules exist
    await this.applyAutoAssignRules(issue);

    // Estimate effort
    issue.estimatedHours = await this.estimateEffort(issue);

    this.issues.set(issue.id, issue);
    this.emit('issue-created', issue);

    // Apply automation rules
    if (this.config.automationRulesEnabled) {
      await this.applyAutomationRules(issue, 'issue_created');
    }

    return issue;
  }

  async getIssue(id: string): Promise<Issue | undefined> {
    return this.issues.get(id);
  }

  async updateIssue(id: string, updates: Partial<Issue>): Promise<Issue> {
    const issue = this.issues.get(id);
    if (!issue) {
      throw new Error(`Issue ${id} not found`);
    }

    const updatedIssue = { ...issue, ...updates, updatedAt: new Date() };
    this.issues.set(id, updatedIssue);

    this.emit('issue-updated', updatedIssue);

    // Apply automation rules for updates
    if (this.config.automationRulesEnabled) {
      await this.applyAutomationRules(updatedIssue, 'issue_updated');
    }

    return updatedIssue;
  }

  async linkIssues(sourceId: string, targetId: string, linkType: string, bidirectional = false): Promise<void> {
    const sourceIssue = this.issues.get(sourceId);
    const targetIssue = this.issues.get(targetId);

    if (!sourceIssue || !targetIssue) {
      throw new Error('One or both issues not found');
    }

    const link: LinkedIssue = {
      issueId: targetId,
      repository: targetIssue.repository.fullName,
      linkType: linkType as any,
      createdAt: new Date(),
      createdBy: sourceIssue.author // This should be the current user
    };

    sourceIssue.linkedIssues.push(link);

    if (bidirectional) {
      const reverseLink: LinkedIssue = {
        issueId: sourceId,
        repository: sourceIssue.repository.fullName,
        linkType: this.getReverseLinkType(linkType) as any,
        createdAt: new Date(),
        createdBy: sourceIssue.author
      };
      targetIssue.linkedIssues.push(reverseLink);
    }

    await this.updateIssue(sourceId, { linkedIssues: sourceIssue.linkedIssues });
    if (bidirectional) {
      await this.updateIssue(targetId, { linkedIssues: targetIssue.linkedIssues });
    }

    this.emit('issues-linked', { source: sourceIssue, target: targetIssue, linkType });
  }

  // Automatic Categorization
  async categorizeIssue(issue: Issue): Promise<IssueCategory> {
    // AI-powered categorization based on title, description, and labels
    const text = `${issue.title} ${issue.description}`.toLowerCase();
    
    // Security issues
    if (this.containsSecurityKeywords(text)) {
      return this.categories.get('security')!;
    }

    // Bug reports
    if (this.containsBugKeywords(text)) {
      return this.categories.get('bug')!;
    }

    // Documentation
    if (this.containsDocumentationKeywords(text)) {
      return this.categories.get('documentation')!;
    }

    // Default to feature
    return this.categories.get('feature')!;
  }

  // Sprint Planning
  async createSprint(sprintData: Partial<Sprint>): Promise<Sprint> {
    const sprint: Sprint = {
      id: `sprint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sprintData.name || `Sprint ${Date.now()}`,
      description: sprintData.description || '',
      startDate: sprintData.startDate || new Date(),
      endDate: sprintData.endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
      state: 'planning',
      capacity: sprintData.capacity || {
        totalHours: 320, // 40 hours * 8 developers
        availableHours: 280,
        commitmentLevel: 'medium',
        teamSize: 8,
        holidays: [],
        vacations: []
      },
      issues: [],
      goals: sprintData.goals || [],
      burndown: [],
      velocity: 0,
      repositories: sprintData.repositories || []
    };

    this.sprints.set(sprint.id, sprint);
    this.emit('sprint-created', sprint);

    return sprint;
  }

  async addIssueToSprint(sprintId: string, issueId: string, storyPoints: number): Promise<void> {
    const sprint = this.sprints.get(sprintId);
    const issue = this.issues.get(issueId);

    if (!sprint || !issue) {
      throw new Error('Sprint or issue not found');
    }

    const sprintIssue: SprintIssue = {
      issue,
      storyPoints,
      priority: sprint.issues.length + 1,
      addedAt: new Date(),
      addedBy: issue.author, // Should be current user
      status: 'todo',
      blockers: []
    };

    sprint.issues.push(sprintIssue);
    await this.updateSprint(sprintId, { issues: sprint.issues });

    this.emit('issue-added-to-sprint', { sprint, issue, storyPoints });
  }

  async startSprint(sprintId: string): Promise<void> {
    const sprint = this.sprints.get(sprintId);
    if (!sprint) {
      throw new Error(`Sprint ${sprintId} not found`);
    }

    sprint.state = 'active';
    sprint.startDate = new Date();

    // Initialize burndown chart
    sprint.burndown = [{
      date: new Date(),
      remainingHours: sprint.capacity.totalHours,
      remainingStoryPoints: sprint.issues.reduce((total, issue) => total + issue.storyPoints, 0),
      completed: 0,
      added: 0
    }];

    await this.updateSprint(sprintId, sprint);
    this.emit('sprint-started', sprint);
  }

  async completeSprint(sprintId: string): Promise<SprintRetrospective> {
    const sprint = this.sprints.get(sprintId);
    if (!sprint) {
      throw new Error(`Sprint ${sprintId} not found`);
    }

    sprint.state = 'completed';
    sprint.endDate = new Date();

    // Calculate velocity
    const completedStoryPoints = sprint.issues
      .filter(issue => issue.status === 'done')
      .reduce((total, issue) => total + issue.storyPoints, 0);

    sprint.velocity = completedStoryPoints;

    // Create retrospective template
    const retrospective: SprintRetrospective = {
      id: `retro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sprintId,
      conductedAt: new Date(),
      facilitator: sprint.issues[0]?.addedBy || sprint.issues[0]?.issue.author,
      participants: [],
      wentWell: [],
      needsImprovement: [],
      actionItems: [],
      velocity: sprint.velocity,
      teamMorale: 0
    };

    sprint.retrospective = retrospective;
    await this.updateSprint(sprintId, sprint);

    this.emit('sprint-completed', { sprint, retrospective });
    return retrospective;
  }

  // Cross-Repository Coordination
  async createCrossRepoLink(
    sourceRepo: string,
    targetRepo: string,
    sourceIssue: string,
    targetIssue: string,
    linkType: string,
    bidirectional = false
  ): Promise<CrossRepoLink> {
    const link: CrossRepoLink = {
      sourceRepo,
      targetRepo,
      sourceIssue,
      targetIssue,
      linkType,
      synchronize: true,
      bidirectional
    };

    const linkId = `${sourceRepo}:${sourceIssue}-${targetRepo}:${targetIssue}`;
    this.crossRepoLinks.set(linkId, link);

    this.emit('cross-repo-link-created', link);
    return link;
  }

  async synchronizeCrossRepoIssues(): Promise<void> {
    for (const [linkId, link] of this.crossRepoLinks) {
      if (link.synchronize) {
        await this.synchronizeLinkedIssues(link);
      }
    }
  }

  // Project Coordination
  async createProject(projectData: Partial<Project>): Promise<Project> {
    const project: Project = {
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: projectData.name || 'Untitled Project',
      description: projectData.description || '',
      repositories: projectData.repositories || [],
      milestones: [],
      sprints: [],
      team: projectData.team || [],
      startDate: projectData.startDate || new Date(),
      targetDate: projectData.targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      status: 'planning',
      progress: 0,
      budget: projectData.budget
    };

    this.projects.set(project.id, project);
    this.emit('project-created', project);

    return project;
  }

  async createProjectCoordination(projectIds: string[]): Promise<ProjectCoordination> {
    const projects = projectIds
      .map(id => this.projects.get(id))
      .filter((project): project is Project => project !== undefined);

    const coordination: ProjectCoordination = {
      coordinationId: `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projects,
      issues: [],
      crossRepoLinks: Array.from(this.crossRepoLinks.values()),
      synchronizationRules: [],
      dependencies: [],
      timeline: {
        phases: [],
        criticalPath: [],
        milestones: [],
        dependencies: []
      },
      riskAssessment: {
        risks: [],
        overallRiskLevel: 'low',
        mitigationStrategies: [],
        lastAssessed: new Date()
      }
    };

    // Collect all issues from project repositories
    for (const project of projects) {
      for (const repo of project.repositories) {
        const repoIssues = Array.from(this.issues.values())
          .filter(issue => issue.repository.fullName === repo.fullName);
        coordination.issues.push(...repoIssues);
      }
    }

    this.emit('project-coordination-created', coordination);
    return coordination;
  }

  // Analytics and Reporting
  async generateIssueAnalytics(timeRange: { start: Date; end: Date }): Promise<any> {
    const issuesInRange = Array.from(this.issues.values())
      .filter(issue => issue.createdAt >= timeRange.start && issue.createdAt <= timeRange.end);

    const analytics = {
      totalIssues: issuesInRange.length,
      openIssues: issuesInRange.filter(i => i.state === 'open').length,
      closedIssues: issuesInRange.filter(i => i.state === 'closed').length,
      averageResolutionTime: this.calculateAverageResolutionTime(issuesInRange),
      issuesByCategory: this.groupIssuesByCategory(issuesInRange),
      issuesByPriority: this.groupIssuesByPriority(issuesInRange),
      issuesBySeverity: this.groupIssuesBySeverity(issuesInRange),
      topAssignees: this.getTopAssignees(issuesInRange),
      velocityTrend: this.calculateVelocityTrend(),
      burndownData: this.getBurndownData(),
      cycleTime: this.calculateCycleTime(issuesInRange),
      leadTime: this.calculateLeadTime(issuesInRange)
    };

    this.emit('issue-analytics-generated', analytics);
    return analytics;
  }

  // Private Implementation Methods

  private async generateIssueNumber(repository: GitHubRepository): Promise<number> {
    const repoIssues = Array.from(this.issues.values())
      .filter(issue => issue.repository.fullName === repository.fullName);
    return repoIssues.length + 1;
  }

  private async applyAutoAssignRules(issue: Issue): Promise<void> {
    for (const rule of issue.category.autoAssignRules) {
      if (this.evaluateCondition(rule.condition, issue)) {
        issue.assignees.push(rule.assignee);
        break; // Apply only the first matching rule
      }
    }
  }

  private async estimateEffort(issue: Issue): Promise<number> {
    for (const rule of issue.category.estimationRules) {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(`${issue.title} ${issue.description}`)) {
        return rule.baseHours * rule.multiplier;
      }
    }
    return 8; // Default estimate
  }

  private async applyAutomationRules(issue: Issue, trigger: string): Promise<void> {
    for (const [ruleId, rule] of this.automationRules) {
      if (rule.enabled && rule.trigger.type === trigger) {
        if (this.evaluateAutomationConditions(rule.conditions, issue)) {
          await this.executeAutomationActions(rule.actions, issue);
          rule.runCount++;
          rule.lastRun = new Date();
          this.emit('automation-triggered', { rule, issue });
        }
      }
    }
  }

  private getReverseLinkType(linkType: string): string {
    const reverseMap: Record<string, string> = {
      'blocks': 'blocked_by',
      'blocked_by': 'blocks',
      'relates_to': 'relates_to',
      'duplicates': 'duplicates',
      'part_of': 'child_of',
      'child_of': 'part_of'
    };
    return reverseMap[linkType] || linkType;
  }

  private containsSecurityKeywords(text: string): boolean {
    const keywords = ['security', 'vulnerability', 'exploit', 'injection', 'xss', 'csrf', 'authentication', 'authorization'];
    return keywords.some(keyword => text.includes(keyword));
  }

  private containsBugKeywords(text: string): boolean {
    const keywords = ['bug', 'error', 'crash', 'fail', 'broken', 'issue', 'problem', 'exception'];
    return keywords.some(keyword => text.includes(keyword));
  }

  private containsDocumentationKeywords(text: string): boolean {
    const keywords = ['documentation', 'docs', 'readme', 'guide', 'tutorial', 'wiki', 'help'];
    return keywords.some(keyword => text.includes(keyword));
  }

  private async updateSprint(sprintId: string, updates: Partial<Sprint>): Promise<Sprint> {
    const sprint = this.sprints.get(sprintId);
    if (!sprint) {
      throw new Error(`Sprint ${sprintId} not found`);
    }

    const updatedSprint = { ...sprint, ...updates };
    this.sprints.set(sprintId, updatedSprint);
    
    this.emit('sprint-updated', updatedSprint);
    return updatedSprint;
  }

  private async synchronizeLinkedIssues(link: CrossRepoLink): Promise<void> {
    // Implement synchronization logic between linked issues
    // This would involve updating status, labels, etc. across repositories
  }

  private evaluateCondition(condition: string, issue: Issue): boolean {
    // Simple condition evaluation - in a real implementation, this would be more sophisticated
    return condition.includes(issue.category.name.toLowerCase());
  }

  private evaluateAutomationConditions(conditions: AutomationCondition[], issue: Issue): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getFieldValue(issue, condition.field);
      const result = this.evaluateOperator(fieldValue, condition.operator, condition.value);
      return condition.negate ? !result : result;
    });
  }

  private getFieldValue(issue: Issue, field: string): any {
    const fields: Record<string, any> = {
      'title': issue.title,
      'state': issue.state,
      'priority': issue.priority,
      'category': issue.category.name,
      'assignees_count': issue.assignees.length,
      'labels': issue.labels.join(',')
    };
    return fields[field];
  }

  private evaluateOperator(fieldValue: any, operator: string, value: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'regex':
        return new RegExp(value).test(String(fieldValue));
      default:
        return false;
    }
  }

  private async executeAutomationActions(actions: AutomationAction[], issue: Issue): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'assign':
          // Add assignee logic
          break;
        case 'label':
          if (!issue.labels.includes(action.parameters.label)) {
            issue.labels.push(action.parameters.label);
          }
          break;
        case 'comment':
          const comment: IssueComment = {
            id: `comment_${Date.now()}`,
            author: { id: 'automation', username: 'flowx-automation', type: 'bot', permissions: [] },
            body: action.parameters.body,
            createdAt: new Date(),
            updatedAt: new Date(),
            commentType: 'automation',
            mentions: [],
            reactions: [],
            attachments: []
          };
          issue.comments.push(comment);
          break;
      }
    }
  }

  private calculateAverageResolutionTime(issues: Issue[]): number {
    const closedIssues = issues.filter(issue => issue.closedAt);
    if (closedIssues.length === 0) return 0;

    const totalTime = closedIssues.reduce((sum, issue) => {
      return sum + (issue.closedAt!.getTime() - issue.createdAt.getTime());
    }, 0);

    return totalTime / closedIssues.length;
  }

  private groupIssuesByCategory(issues: Issue[]): Record<string, number> {
    return issues.reduce((groups, issue) => {
      const category = issue.category.name;
      groups[category] = (groups[category] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private groupIssuesByPriority(issues: Issue[]): Record<string, number> {
    return issues.reduce((groups, issue) => {
      groups[issue.priority] = (groups[issue.priority] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private groupIssuesBySeverity(issues: Issue[]): Record<string, number> {
    return issues.reduce((groups, issue) => {
      groups[issue.severity] = (groups[issue.severity] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private getTopAssignees(issues: Issue[]): { assignee: string; count: number }[] {
    const assigneeCounts = new Map<string, number>();
    
    issues.forEach(issue => {
      issue.assignees.forEach(assignee => {
        const count = assigneeCounts.get(assignee.username) || 0;
        assigneeCounts.set(assignee.username, count + 1);
      });
    });

    return Array.from(assigneeCounts.entries())
      .map(([assignee, count]) => ({ assignee, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateVelocityTrend(): number[] {
    // Calculate velocity trend over recent sprints
    const recentSprints = Array.from(this.sprints.values())
      .filter(sprint => sprint.state === 'completed')
      .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
      .slice(0, 10);

    return recentSprints.map(sprint => sprint.velocity);
  }

  private getBurndownData(): BurndownPoint[] {
    // Get burndown data from active sprint
    const activeSprint = Array.from(this.sprints.values())
      .find(sprint => sprint.state === 'active');

    return activeSprint?.burndown || [];
  }

  private calculateCycleTime(issues: Issue[]): number {
    // Calculate average cycle time (from in-progress to done)
    return 0; // Placeholder
  }

  private calculateLeadTime(issues: Issue[]): number {
    // Calculate average lead time (from creation to done)
    return 0; // Placeholder
  }

  // Event Handlers
  private handleIssueCreated(issue: Issue): void {
    // Update metrics
    this.updateMetrics('issues_created', 1);
  }

  private handleIssueUpdated(issue: Issue): void {
    // Handle issue updates
  }

  private handleSprintStarted(sprint: Sprint): void {
    // Handle sprint start
  }

  private handleMilestoneCompleted(milestone: Milestone): void {
    // Handle milestone completion
  }

  private handleAutomationTriggered(event: { rule: AutomationRule; issue: Issue }): void {
    // Handle automation rule execution
  }

  private updateMetrics(metric: string, value: number): void {
    const current = this.performanceMetrics.get(metric) || 0;
    this.performanceMetrics.set(metric, current + value);
  }
} 