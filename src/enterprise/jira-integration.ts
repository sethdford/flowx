/**
 * JIRA Integration for Enterprise Issue Tracking
 * Extends existing IssueTracker with JIRA synchronization capabilities
 */

import { EventEmitter } from 'node:events';
import { ILogger } from '../core/logger.ts';
import { createConsoleLogger } from '../utils/logger.ts';
import { Issue, IssueTracker, Sprint, Project } from './issue-tracker.ts';
import { ProjectManager } from './project-manager.ts';

export interface JiraConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  projectKey: string;
  enabled: boolean;
  syncDirection: 'flowx-to-jira' | 'jira-to-flowx' | 'bidirectional';
  syncInterval: number; // minutes
  fieldMappings: JiraFieldMapping;
  webhookSecret?: string;
  customFields: Record<string, string>;
}

export interface JiraFieldMapping {
  // FlowX field -> JIRA field mapping
  title: string;           // summary
  description: string;     // description  
  priority: string;        // priority
  status: string;          // status
  assignee: string;        // assignee
  labels: string;          // labels
  category: string;        // customfield_xxxxx
  estimatedHours: string;  // timeoriginalestimate
  actualHours: string;     // timespent
  dueDate: string;         // duedate
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    priority: { name: string };
    status: { name: string };
    assignee: { displayName: string; emailAddress: string } | null;
    labels: string[];
    created: string;
    updated: string;
    duedate?: string;
    timeoriginalestimate?: number;
    timespent?: number;
    [key: string]: any;
  };
}

export interface JiraSyncResult {
  success: boolean;
  syncedIssues: number;
  errors: string[];
  direction: 'flowx-to-jira' | 'jira-to-flowx' | 'bidirectional';
  timestamp: Date;
  duration: number;
}

export interface JiraWebhookEvent {
  webhookEvent: string;
  issue: JiraIssue;
  user: {
    displayName: string;
    emailAddress: string;
  };
  changelog?: {
    items: Array<{
      field: string;
      fromString: string;
      toString: string;
    }>;
  };
}

/**
 * JIRA Integration Manager
 * Synchronizes issues and projects between FlowX and JIRA
 */
export class JiraIntegration extends EventEmitter {
  private logger: ILogger;
  private config: JiraConfig;
  private issueTracker: IssueTracker;
  private projectManager: ProjectManager;
  private syncInterval?: NodeJS.Timeout;
  private lastSyncTime: Date = new Date(0);
  private isInitialized = false;

  constructor(
    config: JiraConfig,
    issueTracker: IssueTracker,
    projectManager: ProjectManager,
    logger?: ILogger
  ) {
    super();
    this.logger = logger || createConsoleLogger('JiraIntegration');
    this.config = config;
    this.issueTracker = issueTracker;
    this.projectManager = projectManager;
  }

  /**
   * Initialize JIRA integration
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('JIRA integration disabled in configuration');
      return;
    }

    this.logger.info('Initializing JIRA integration...', {
      baseUrl: this.config.baseUrl,
      projectKey: this.config.projectKey,
      syncDirection: this.config.syncDirection
    });

    try {
      // Test JIRA connection
      await this.testConnection();

      // Start periodic sync if enabled
      if (this.config.syncInterval > 0) {
        this.startPeriodicSync();
      }

      // Setup webhook handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      this.logger.info('JIRA integration initialized successfully');

      this.emit('initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize JIRA integration', error);
      throw error;
    }
  }

  /**
   * Synchronize issues between FlowX and JIRA
   */
  async syncIssues(direction?: 'flowx-to-jira' | 'jira-to-flowx'): Promise<JiraSyncResult> {
    const syncDirection = direction || this.config.syncDirection;
    const startTime = Date.now();

    this.logger.info(`Starting issue sync: ${syncDirection}`);

    try {
      let result: JiraSyncResult;

      switch (syncDirection) {
        case 'flowx-to-jira':
          result = await this.syncFlowXToJira();
          break;
        case 'jira-to-flowx':
          result = await this.syncJiraToFlowX();
          break;
        case 'bidirectional':
          const toJira = await this.syncFlowXToJira();
          const toFlowX = await this.syncJiraToFlowX();
          result = {
            success: toJira.success && toFlowX.success,
            syncedIssues: toJira.syncedIssues + toFlowX.syncedIssues,
            errors: [...toJira.errors, ...toFlowX.errors],
            direction: 'bidirectional',
            timestamp: new Date(),
            duration: Date.now() - startTime
          };
          break;
        default:
          throw new Error(`Invalid sync direction: ${syncDirection}`);
      }

      this.lastSyncTime = new Date();
      this.emit('syncCompleted', result);

      return result;

    } catch (error) {
      this.logger.error('Issue sync failed', error);
      const errorResult: JiraSyncResult = {
        success: false,
        syncedIssues: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        direction: syncDirection as any,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };

      this.emit('syncFailed', errorResult);
      return errorResult;
    }
  }

  /**
   * Handle JIRA webhook events
   */
  async handleWebhook(event: JiraWebhookEvent): Promise<void> {
    this.logger.info(`Received JIRA webhook: ${event.webhookEvent}`, {
      issueKey: event.issue.key
    });

    try {
      switch (event.webhookEvent) {
        case 'jira:issue_created':
          await this.handleJiraIssueCreated(event);
          break;
        case 'jira:issue_updated':
          await this.handleJiraIssueUpdated(event);
          break;
        case 'jira:issue_deleted':
          await this.handleJiraIssueDeleted(event);
          break;
        default:
          this.logger.debug(`Unhandled webhook event: ${event.webhookEvent}`);
      }

      this.emit('webhookProcessed', { event: event.webhookEvent, issue: event.issue.key });

    } catch (error) {
      this.logger.error('Failed to process JIRA webhook', error);
      this.emit('webhookError', { event, error });
    }
  }

  /**
   * Create JIRA issue from FlowX issue
   */
  async createJiraIssue(flowxIssue: Issue): Promise<string> {
    const jiraIssue = this.mapFlowXToJira(flowxIssue);

    const response = await this.makeJiraRequest('POST', '/rest/api/3/issue', {
      fields: jiraIssue
    });

    const jiraKey = response.key;
    this.logger.info(`Created JIRA issue: ${jiraKey}`, { flowxId: flowxIssue.id });

    return jiraKey;
  }

  /**
   * Update JIRA issue from FlowX issue
   */
  async updateJiraIssue(jiraKey: string, flowxIssue: Issue): Promise<void> {
    const jiraFields = this.mapFlowXToJira(flowxIssue);

    await this.makeJiraRequest('PUT', `/rest/api/3/issue/${jiraKey}`, {
      fields: jiraFields
    });

    this.logger.info(`Updated JIRA issue: ${jiraKey}`, { flowxId: flowxIssue.id });
  }

  /**
   * Get sync status and statistics
   */
  getSyncStatus(): {
    enabled: boolean;
    lastSync: Date;
    nextSync?: Date;
    isRunning: boolean;
    totalSynced: number;
    errorCount: number;
  } {
    return {
      enabled: this.config.enabled,
      lastSync: this.lastSyncTime,
      nextSync: this.syncInterval ? new Date(Date.now() + this.config.syncInterval * 60000) : undefined,
      isRunning: !!this.syncInterval,
      totalSynced: 0, // Would track in metrics
      errorCount: 0   // Would track in metrics
    };
  }

  /**
   * Shutdown JIRA integration
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down JIRA integration...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    this.isInitialized = false;
    this.emit('shutdown', { timestamp: new Date() });
  }

  // ================================
  // Private Implementation Methods
  // ================================

  private async testConnection(): Promise<void> {
    try {
      await this.makeJiraRequest('GET', '/rest/api/3/myself');
      this.logger.info('JIRA connection test successful');
    } catch (error) {
      throw new Error(`JIRA connection test failed: ${error}`);
    }
  }

  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncIssues();
      } catch (error) {
        this.logger.error('Periodic sync failed', error);
      }
    }, this.config.syncInterval * 60000);

    this.logger.info(`Started periodic sync every ${this.config.syncInterval} minutes`);
  }

  private setupEventHandlers(): void {
    // Listen to FlowX issue events for real-time sync
    this.issueTracker.on('issueCreated', async (issue: Issue) => {
      if (this.config.syncDirection === 'flowx-to-jira' || this.config.syncDirection === 'bidirectional') {
        try {
          await this.createJiraIssue(issue);
        } catch (error) {
          this.logger.error('Failed to sync new issue to JIRA', error);
        }
      }
    });

    this.issueTracker.on('issueUpdated', async (issue: Issue) => {
      if (this.config.syncDirection === 'flowx-to-jira' || this.config.syncDirection === 'bidirectional') {
        try {
          const jiraKey = issue.metadata?.jiraKey;
          if (jiraKey) {
            await this.updateJiraIssue(jiraKey, issue);
          }
        } catch (error) {
          this.logger.error('Failed to sync updated issue to JIRA', error);
        }
      }
    });
  }

  private async syncFlowXToJira(): Promise<JiraSyncResult> {
    // Implementation would sync FlowX issues to JIRA
    const startTime = Date.now();
    let syncedCount = 0;
    const errors: string[] = [];

    // Get all FlowX issues that need syncing
    // Create or update corresponding JIRA issues
    // Track results

    return {
      success: errors.length === 0,
      syncedIssues: syncedCount,
      errors,
      direction: 'flowx-to-jira',
      timestamp: new Date(),
      duration: Date.now() - startTime
    };
  }

  private async syncJiraToFlowX(): Promise<JiraSyncResult> {
    // Implementation would sync JIRA issues to FlowX
    const startTime = Date.now();
    let syncedCount = 0;
    const errors: string[] = [];

    try {
      // Get updated JIRA issues since last sync
      const jql = `project = ${this.config.projectKey} AND updated >= "${this.lastSyncTime.toISOString()}"`;
      const jiraIssues = await this.searchJiraIssues(jql);

      for (const jiraIssue of jiraIssues) {
        try {
          const flowxIssue = this.mapJiraToFlowX(jiraIssue);
          await this.issueTracker.createIssue(flowxIssue);
          syncedCount++;
        } catch (error) {
          errors.push(`Failed to sync ${jiraIssue.key}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Failed to fetch JIRA issues: ${error}`);
    }

    return {
      success: errors.length === 0,
      syncedIssues: syncedCount,
      errors,
      direction: 'jira-to-flowx',
      timestamp: new Date(),
      duration: Date.now() - startTime
    };
  }

  private async handleJiraIssueCreated(event: JiraWebhookEvent): Promise<void> {
    if (this.config.syncDirection === 'jira-to-flowx' || this.config.syncDirection === 'bidirectional') {
      const flowxIssue = this.mapJiraToFlowX(event.issue);
      await this.issueTracker.createIssue(flowxIssue);
    }
  }

  private async handleJiraIssueUpdated(event: JiraWebhookEvent): Promise<void> {
    if (this.config.syncDirection === 'jira-to-flowx' || this.config.syncDirection === 'bidirectional') {
      const flowxIssue = this.mapJiraToFlowX(event.issue);
      const existingIssue = await this.issueTracker.getIssue(event.issue.key);
      
      if (existingIssue) {
        await this.issueTracker.updateIssue(existingIssue.id, flowxIssue);
      }
    }
  }

  private async handleJiraIssueDeleted(event: JiraWebhookEvent): Promise<void> {
    // Handle issue deletion - maybe mark as closed instead of deleting
    this.logger.info(`JIRA issue deleted: ${event.issue.key}`);
  }

  private mapFlowXToJira(issue: Issue): any {
    const mapping = this.config.fieldMappings;
    
    return {
      project: { key: this.config.projectKey },
      issuetype: { name: 'Task' }, // Could be configurable
      [mapping.title]: issue.title,
      [mapping.description]: issue.description,
      [mapping.priority]: { name: this.mapPriority(issue.priority) },
      [mapping.labels]: issue.labels,
      [mapping.dueDate]: issue.dueDate?.toISOString().split('T')[0],
      [mapping.estimatedHours]: issue.estimatedHours ? issue.estimatedHours * 3600 : undefined, // Convert to seconds
      ...this.mapCustomFields(issue)
    };
  }

  private mapJiraToFlowX(jiraIssue: JiraIssue): Partial<Issue> {
    const mapping = this.config.fieldMappings;
    
    return {
      title: jiraIssue.fields.summary,
      description: jiraIssue.fields.description || '',
      priority: this.mapJiraPriority(jiraIssue.fields.priority?.name),
      labels: jiraIssue.fields.labels || [],
      dueDate: jiraIssue.fields.duedate ? new Date(jiraIssue.fields.duedate) : undefined,
      estimatedHours: jiraIssue.fields.timeoriginalestimate ? jiraIssue.fields.timeoriginalestimate / 3600 : undefined,
      actualHours: jiraIssue.fields.timespent ? jiraIssue.fields.timespent / 3600 : undefined,
      metadata: {
        jiraKey: jiraIssue.key,
        jiraId: jiraIssue.id
      }
    };
  }

  private mapCustomFields(issue: Issue): Record<string, any> {
    const customFields: Record<string, any> = {};
    
    for (const [flowxField, jiraField] of Object.entries(this.config.customFields)) {
      const value = (issue as any)[flowxField];
      if (value !== undefined) {
        customFields[jiraField] = value;
      }
    }
    
    return customFields;
  }

  private mapPriority(flowxPriority: string): string {
    const priorityMap: Record<string, string> = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'critical': 'Highest',
      'urgent': 'Highest'
    };
    
    return priorityMap[flowxPriority] || 'Medium';
  }

  private mapJiraPriority(jiraPriority?: string): 'low' | 'medium' | 'high' | 'critical' | 'urgent' {
    if (!jiraPriority) return 'medium';
    
    const priorityMap: Record<string, any> = {
      'Lowest': 'low',
      'Low': 'low',
      'Medium': 'medium',
      'High': 'high',
      'Highest': 'critical'
    };
    
    return priorityMap[jiraPriority] || 'medium';
  }

  private async searchJiraIssues(jql: string): Promise<JiraIssue[]> {
    const response = await this.makeJiraRequest('GET', '/rest/api/3/search', {
      jql,
      maxResults: 100
    });
    
    return response.issues || [];
  }

  private async makeJiraRequest(method: string, endpoint: string, data?: any): Promise<any> {
    let url = `${this.config.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${this.config.username}:${this.config.apiToken}`).toString('base64');
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (data) {
      if (method === 'GET') {
        const params = new URLSearchParams(data);
        url += `?${params}`;
      } else {
        options.body = JSON.stringify(data);
      }
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JIRA API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }
} 