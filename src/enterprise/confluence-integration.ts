/**
 * Confluence Integration for Enterprise Documentation
 * Extends existing ProjectManager with Confluence documentation synchronization
 */

import { EventEmitter } from 'node:events';
import { ILogger } from '../core/logger.js';
import { createConsoleLogger } from '../utils/logger.js';
import { Project, ProjectManager } from './project-manager.js';

export interface ConfluenceConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  spaceKey: string;
  enabled: boolean;
  syncDirection: 'flowx-to-confluence' | 'confluence-to-flowx' | 'bidirectional';
  autoPublish: boolean;
  templateMapping: ConfluenceTemplateMapping;
  customMacros: Record<string, string>;
}

export interface ConfluenceTemplateMapping {
  projectOverview: string;
  requirements: string;
  architecture: string;
  apiDocumentation: string;
  deploymentGuide: string;
  troubleshooting: string;
  changelog: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  content: {
    storage: {
      value: string;
      representation: 'storage' | 'view';
    };
  };
  space: {
    key: string;
  };
  status: string;
  version: {
    number: number;
    message?: string;
  };
  ancestors?: ConfluencePage[];
  metadata?: {
    labels: ConfluenceLabel[];
    properties: Record<string, any>;
  };
}

export interface ConfluenceLabel {
  name: string;
  prefix: string;
}

export interface ConfluenceSpace {
  key: string;
  name: string;
  description?: string;
  type: 'global' | 'personal';
  status: string;
  homepage: ConfluencePage;
}

export interface DocumentationSyncResult {
  success: boolean;
  syncedPages: number;
  createdPages: number;
  updatedPages: number;
  errors: string[];
  direction: 'flowx-to-confluence' | 'confluence-to-flowx' | 'bidirectional';
  timestamp: Date;
  duration: number;
}

export interface ProjectDocumentation {
  projectId: string;
  pages: DocumentationPage[];
  templates: DocumentationTemplate[];
  lastSync: Date;
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
}

export interface DocumentationPage {
  id: string;
  title: string;
  type: 'overview' | 'requirements' | 'architecture' | 'api' | 'deployment' | 'troubleshooting' | 'custom';
  content: string;
  format: 'markdown' | 'confluence-storage' | 'html';
  metadata: {
    projectId: string;
    tags: string[];
    lastUpdated: Date;
    author: string;
    version: number;
    confluencePageId?: string;
  };
  attachments: DocumentationAttachment[];
}

export interface DocumentationTemplate {
  id: string;
  name: string;
  type: DocumentationPage['type'];
  content: string;
  variables: TemplateVariable[];
  isDefault: boolean;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  description: string;
  defaultValue?: any;
  required: boolean;
}

export interface DocumentationAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Confluence Integration Manager
 * Synchronizes project documentation between FlowX and Confluence
 */
export class ConfluenceIntegration extends EventEmitter {
  private logger: ILogger;
  private config: ConfluenceConfig;
  private projectManager: ProjectManager;
  private projectDocs: Map<string, ProjectDocumentation> = new Map();
  private templates: Map<string, DocumentationTemplate> = new Map();
  private isInitialized = false;

  constructor(
    config: ConfluenceConfig,
    projectManager: ProjectManager,
    logger?: ILogger
  ) {
    super();
    this.logger = logger || createConsoleLogger('ConfluenceIntegration');
    this.config = config;
    this.projectManager = projectManager;
  }

  /**
   * Initialize Confluence integration
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Confluence integration disabled in configuration');
      return;
    }

    this.logger.info('Initializing Confluence integration...', {
      baseUrl: this.config.baseUrl,
      spaceKey: this.config.spaceKey,
      syncDirection: this.config.syncDirection
    });

    try {
      // Test Confluence connection
      await this.testConnection();

      // Initialize default templates
      this.initializeDefaultTemplates();

      // Setup event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      this.logger.info('Confluence integration initialized successfully');

      this.emit('initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize Confluence integration', error);
      throw error;
    }
  }

  /**
   * Generate project documentation in Confluence
   */
  async generateProjectDocumentation(projectId: string): Promise<ProjectDocumentation> {
    const project = await this.projectManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    this.logger.info(`Generating documentation for project: ${project.name}`);

    try {
      const documentation: ProjectDocumentation = {
        projectId,
        pages: [],
        templates: [],
        lastSync: new Date(),
        syncStatus: 'syncing'
      };

      // Generate different types of documentation pages
      const pages = await Promise.all([
        this.generateProjectOverview(project),
        this.generateRequirementsDoc(project),
        this.generateArchitectureDoc(project),
        this.generateDeploymentGuide(project),
        this.generateTroubleshootingGuide(project)
      ]);

      documentation.pages = pages;
      documentation.syncStatus = 'completed';

      this.projectDocs.set(projectId, documentation);

      // Sync to Confluence if enabled
      if (this.config.syncDirection === 'flowx-to-confluence' || this.config.syncDirection === 'bidirectional') {
        await this.syncToConfluence(documentation);
      }

      this.emit('documentationGenerated', { projectId, documentation });

      return documentation;

    } catch (error) {
      this.logger.error('Failed to generate project documentation', error);
      throw error;
    }
  }

  /**
   * Sync documentation between FlowX and Confluence
   */
  async syncDocumentation(
    projectId: string,
    direction?: 'flowx-to-confluence' | 'confluence-to-flowx'
  ): Promise<DocumentationSyncResult> {
    const syncDirection = direction || this.config.syncDirection;
    const startTime = Date.now();

    this.logger.info(`Starting documentation sync: ${syncDirection}`, { projectId });

    try {
      let result: DocumentationSyncResult;

      switch (syncDirection) {
        case 'flowx-to-confluence':
          result = await this.syncFlowXToConfluence(projectId);
          break;
        case 'confluence-to-flowx':
          result = await this.syncConfluenceToFlowX(projectId);
          break;
        case 'bidirectional':
          const toConfluence = await this.syncFlowXToConfluence(projectId);
          const toFlowX = await this.syncConfluenceToFlowX(projectId);
          result = {
            success: toConfluence.success && toFlowX.success,
            syncedPages: toConfluence.syncedPages + toFlowX.syncedPages,
            createdPages: toConfluence.createdPages + toFlowX.createdPages,
            updatedPages: toConfluence.updatedPages + toFlowX.updatedPages,
            errors: [...toConfluence.errors, ...toFlowX.errors],
            direction: 'bidirectional',
            timestamp: new Date(),
            duration: Date.now() - startTime
          };
          break;
        default:
          throw new Error(`Invalid sync direction: ${syncDirection}`);
      }

      this.emit('syncCompleted', result);
      return result;

    } catch (error) {
      this.logger.error('Documentation sync failed', error);
      const errorResult: DocumentationSyncResult = {
        success: false,
        syncedPages: 0,
        createdPages: 0,
        updatedPages: 0,
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
   * Create or update Confluence page
   */
  async createOrUpdatePage(page: DocumentationPage, parentPageId?: string): Promise<string> {
    const confluencePage: Partial<ConfluencePage> = {
      title: page.title,
      content: {
        storage: {
          value: this.convertToConfluenceFormat(page.content, page.format),
          representation: 'storage'
        }
      },
      space: {
        key: this.config.spaceKey
      }
    };

    if (parentPageId) {
      confluencePage.ancestors = [{ id: parentPageId } as ConfluencePage];
    }

    let pageId: string;

    if (page.metadata.confluencePageId) {
      // Update existing page
      const existingPage = await this.getConfluencePage(page.metadata.confluencePageId);
      confluencePage.version = {
        number: existingPage.version.number + 1,
        message: `Updated from FlowX project: ${page.metadata.projectId}`
      };

      await this.makeConfluenceRequest('PUT', `/rest/api/content/${page.metadata.confluencePageId}`, confluencePage);
      pageId = page.metadata.confluencePageId;

    } else {
      // Create new page
      const response = await this.makeConfluenceRequest('POST', '/rest/api/content', confluencePage);
      pageId = response.id;
    }

    this.logger.info(`${page.metadata.confluencePageId ? 'Updated' : 'Created'} Confluence page: ${page.title}`, {
      pageId,
      projectId: page.metadata.projectId
    });

    return pageId;
  }

  /**
   * Get project documentation
   */
  getProjectDocumentation(projectId: string): ProjectDocumentation | undefined {
    return this.projectDocs.get(projectId);
  }

  /**
   * Get documentation templates
   */
  getTemplates(type?: DocumentationPage['type']): DocumentationTemplate[] {
    const templates = Array.from(this.templates.values());
    return type ? templates.filter(t => t.type === type) : templates;
  }

  /**
   * Shutdown Confluence integration
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Confluence integration...');
    this.isInitialized = false;
    this.emit('shutdown', { timestamp: new Date() });
  }

  // ================================
  // Private Implementation Methods
  // ================================

  private async testConnection(): Promise<void> {
    try {
      await this.makeConfluenceRequest('GET', '/rest/api/user/current');
      this.logger.info('Confluence connection test successful');
    } catch (error) {
      throw new Error(`Confluence connection test failed: ${error}`);
    }
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: DocumentationTemplate[] = [
      {
        id: 'project-overview',
        name: 'Project Overview',
        type: 'overview',
        content: `# {{projectName}}

## Overview
{{description}}

## Project Details
- **Type**: {{type}}
- **Status**: {{status}}
- **Priority**: {{priority}}
- **Owner**: {{owner}}

## Timeline
- **Start Date**: {{startDate}}
- **Target Date**: {{targetDate}}
- **Progress**: {{progress}}%

## Team Members
{{#each teamMembers}}
- {{name}} ({{role}})
{{/each}}

## Tags
{{tags}}`,
        variables: [
          { name: 'projectName', type: 'string', description: 'Project name', required: true },
          { name: 'description', type: 'string', description: 'Project description', required: true },
          { name: 'type', type: 'string', description: 'Project type', required: true },
          { name: 'status', type: 'string', description: 'Current status', required: true },
          { name: 'priority', type: 'string', description: 'Project priority', required: true },
          { name: 'owner', type: 'string', description: 'Project owner', required: true }
        ],
        isDefault: true
      },
      {
        id: 'requirements',
        name: 'Requirements Documentation',
        type: 'requirements',
        content: `# Requirements - {{projectName}}

## Functional Requirements
{{functionalRequirements}}

## Non-Functional Requirements
{{nonFunctionalRequirements}}

## Compliance Requirements
{{#each complianceRequirements}}
### {{framework}}
- **Status**: {{status}}
- **Description**: {{description}}
- **Due Date**: {{dueDate}}
{{/each}}

## Quality Gates
{{#each qualityGates}}
### {{name}}
- **Phase**: {{phase}}
- **Status**: {{status}}
- **Criteria**: {{criteria}}
{{/each}}`,
        variables: [],
        isDefault: true
      },
      {
        id: 'architecture',
        name: 'Architecture Documentation',
        type: 'architecture',
        content: `# Architecture - {{projectName}}

## System Overview
{{systemOverview}}

## Architecture Decisions
{{architectureDecisions}}

## Component Diagram
{{componentDiagram}}

## Deployment Architecture
{{deploymentArchitecture}}

## Technology Stack
{{technologyStack}}

## Security Considerations
{{securityConsiderations}}`,
        variables: [],
        isDefault: true
      }
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }

    this.logger.info(`Initialized ${defaultTemplates.length} default templates`);
  }

  private setupEventHandlers(): void {
    // Listen to project events for automatic documentation updates
    this.projectManager.on('projectUpdated', async (project: Project) => {
      if (this.config.autoPublish) {
        try {
          await this.generateProjectDocumentation(project.id);
        } catch (error) {
          this.logger.error('Failed to auto-update project documentation', error);
        }
      }
    });
  }

  private async generateProjectOverview(project: Project): Promise<DocumentationPage> {
    const template = this.templates.get('project-overview');
    if (!template) {
      throw new Error('Project overview template not found');
    }

    const content = this.renderTemplate(template.content, {
      projectName: project.name,
      description: project.description,
      type: project.type,
      status: project.status,
      priority: project.priority,
      owner: project.owner,
      startDate: project.timeline.plannedStart?.toLocaleDateString(),
      targetDate: project.timeline.plannedEnd?.toLocaleDateString(),
      progress: this.calculateProjectProgress(project),
      teamMembers: project.collaboration?.teamMembers || [],
      tags: project.tags?.join(', ') || ''
    });

    return {
      id: `${project.id}-overview`,
      title: `${project.name} - Project Overview`,
      type: 'overview',
      content,
      format: 'markdown',
      metadata: {
        projectId: project.id,
        tags: ['project', 'overview', ...project.tags],
        lastUpdated: new Date(),
        author: 'FlowX System',
        version: 1
      },
      attachments: []
    };
  }

  private async generateRequirementsDoc(project: Project): Promise<DocumentationPage> {
    const template = this.templates.get('requirements');
    if (!template) {
      throw new Error('Requirements template not found');
    }

    const content = this.renderTemplate(template.content, {
      projectName: project.name,
      functionalRequirements: 'To be documented',
      nonFunctionalRequirements: 'To be documented',
      complianceRequirements: project.complianceRequirements || [],
      qualityGates: project.qualityGates || []
    });

    return {
      id: `${project.id}-requirements`,
      title: `${project.name} - Requirements`,
      type: 'requirements',
      content,
      format: 'markdown',
      metadata: {
        projectId: project.id,
        tags: ['project', 'requirements', ...project.tags],
        lastUpdated: new Date(),
        author: 'FlowX System',
        version: 1
      },
      attachments: []
    };
  }

  private async generateArchitectureDoc(project: Project): Promise<DocumentationPage> {
    return {
      id: `${project.id}-architecture`,
      title: `${project.name} - Architecture`,
      type: 'architecture',
      content: `# Architecture - ${project.name}\n\nArchitecture documentation to be added.`,
      format: 'markdown',
      metadata: {
        projectId: project.id,
        tags: ['project', 'architecture', ...project.tags],
        lastUpdated: new Date(),
        author: 'FlowX System',
        version: 1
      },
      attachments: []
    };
  }

  private async generateDeploymentGuide(project: Project): Promise<DocumentationPage> {
    return {
      id: `${project.id}-deployment`,
      title: `${project.name} - Deployment Guide`,
      type: 'deployment',
      content: `# Deployment Guide - ${project.name}\n\nDeployment instructions to be added.`,
      format: 'markdown',
      metadata: {
        projectId: project.id,
        tags: ['project', 'deployment', ...project.tags],
        lastUpdated: new Date(),
        author: 'FlowX System',
        version: 1
      },
      attachments: []
    };
  }

  private async generateTroubleshootingGuide(project: Project): Promise<DocumentationPage> {
    return {
      id: `${project.id}-troubleshooting`,
      title: `${project.name} - Troubleshooting`,
      type: 'troubleshooting',
      content: `# Troubleshooting - ${project.name}\n\nTroubleshooting guide to be added.`,
      format: 'markdown',
      metadata: {
        projectId: project.id,
        tags: ['project', 'troubleshooting', ...project.tags],
        lastUpdated: new Date(),
        author: 'FlowX System',
        version: 1
      },
      attachments: []
    };
  }

  private async syncToConfluence(documentation: ProjectDocumentation): Promise<void> {
    for (const page of documentation.pages) {
      try {
        const pageId = await this.createOrUpdatePage(page);
        page.metadata.confluencePageId = pageId;
      } catch (error) {
        this.logger.error(`Failed to sync page to Confluence: ${page.title}`, error);
      }
    }
  }

  private async syncFlowXToConfluence(projectId: string): Promise<DocumentationSyncResult> {
    const startTime = Date.now();
    let syncedPages = 0;
    let createdPages = 0;
    let updatedPages = 0;
    const errors: string[] = [];

    try {
      const documentation = this.projectDocs.get(projectId);
      if (!documentation) {
        throw new Error(`No documentation found for project: ${projectId}`);
      }

      for (const page of documentation.pages) {
        try {
          const wasUpdate = !!page.metadata.confluencePageId;
          await this.createOrUpdatePage(page);
          
          syncedPages++;
          if (wasUpdate) {
            updatedPages++;
          } else {
            createdPages++;
          }
        } catch (error) {
          errors.push(`Failed to sync ${page.title}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Sync preparation failed: ${error}`);
    }

    return {
      success: errors.length === 0,
      syncedPages,
      createdPages,
      updatedPages,
      errors,
      direction: 'flowx-to-confluence',
      timestamp: new Date(),
      duration: Date.now() - startTime
    };
  }

  private async syncConfluenceToFlowX(projectId: string): Promise<DocumentationSyncResult> {
    // Implementation would fetch pages from Confluence and update FlowX documentation
    return {
      success: true,
      syncedPages: 0,
      createdPages: 0,
      updatedPages: 0,
      errors: [],
      direction: 'confluence-to-flowx',
      timestamp: new Date(),
      duration: 0
    };
  }

  private convertToConfluenceFormat(content: string, format: DocumentationPage['format']): string {
    switch (format) {
      case 'markdown':
        // Convert markdown to Confluence storage format
        // This would use a markdown-to-confluence converter
        return content.replace(/^#+ /gm, '<h1>').replace(/\n/g, '</h1>\n'); // Simplified
      case 'confluence-storage':
        return content;
      case 'html':
        return content;
      default:
        return content;
    }
  }

  private renderTemplate(template: string, variables: Record<string, any>): string {
    // Simple template rendering - in production would use a proper template engine
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(value || ''));
    }
    
    return rendered;
  }

  private calculateProjectProgress(project: Project): number {
    if (!project.phases || project.phases.length === 0) return 0;
    
    const totalPhases = project.phases.length;
    const completedPhases = project.phases.filter(p => p.status === 'completed').length;
    
    return Math.round((completedPhases / totalPhases) * 100);
  }

  private async getConfluencePage(pageId: string): Promise<ConfluencePage> {
    return await this.makeConfluenceRequest('GET', `/rest/api/content/${pageId}?expand=version`);
  }

  private async makeConfluenceRequest(method: string, endpoint: string, data?: any): Promise<any> {
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
      throw new Error(`Confluence API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }
} 