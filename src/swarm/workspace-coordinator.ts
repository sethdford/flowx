/**
 * Workspace Coordinator
 * 
 * Manages real agent workspaces, file sharing, and task coordination.
 * Enables agents to collaborate by sharing files, reviewing work, and handoffs.
 * 
 * Features:
 * 1. Shared workspace management across agents
 * 2. File versioning and change tracking
 * 3. Agent handoff coordination
 * 4. Work review and validation
 * 5. Task dependency management
 * 6. Real-time workspace synchronization
 */

import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Logger } from '../core/logger.js';
import { generateId } from '../utils/helpers.js';
import { TaskDefinition, AgentState } from './types.js';

// Workspace interfaces
interface SharedWorkspace {
  id: string;
  name: string;
  baseDir: string;
  sharedDir: string;
  agents: Set<string>;
  files: Map<string, WorkspaceFile>;
  handoffs: Map<string, AgentHandoff>;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  lastActivity: Date;
}

interface WorkspaceFile {
  path: string;
  content: string;
  author: string;
  lastModified: Date;
  version: number;
  checksum: string;
  reviews: FileReview[];
  status: 'draft' | 'review' | 'approved' | 'merged';
}

interface FileReview {
  reviewerId: string;
  status: 'pending' | 'approved' | 'changes-requested';
  comments: string[];
  timestamp: Date;
}

interface AgentHandoff {
  id: string;
  fromAgent: string;
  toAgent: string;
  taskId: string;
  files: string[];
  instructions: string;
  status: 'pending' | 'accepted' | 'completed' | 'rejected';
  timestamp: Date;
  notes?: string;
}

interface WorkspaceUpdate {
  type: 'file-created' | 'file-updated' | 'file-deleted' | 'handoff-created' | 'handoff-completed';
  agentId: string;
  details: any;
  timestamp: Date;
}

/**
 * Coordinates shared workspaces between agents for real collaboration
 */
export class WorkspaceCoordinator extends EventEmitter {
  private logger: Logger;
  private workspaces = new Map<string, SharedWorkspace>();
  private agentWorkspaces = new Map<string, Set<string>>(); // agentId -> workspaceIds
  private baseWorkspaceDir: string;

  constructor(logger: Logger, baseDir = './shared-workspaces') {
    super();
    this.logger = logger;
    this.baseWorkspaceDir = baseDir;
  }

  /**
   * Create a shared workspace for multi-agent collaboration
   */
  async createSharedWorkspace(
    name: string, 
    initialAgents: string[] = [],
    options: { 
      template?: string;
      description?: string;
    } = {}
  ): Promise<string> {
    const workspaceId = generateId('workspace');
    const workspaceDir = path.join(this.baseWorkspaceDir, workspaceId);
    const sharedDir = path.join(workspaceDir, 'shared');

    // Create workspace directories
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(sharedDir, { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'handoffs'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'reviews'), { recursive: true });

    const workspace: SharedWorkspace = {
      id: workspaceId,
      name,
      baseDir: workspaceDir,
      sharedDir,
      agents: new Set(initialAgents),
      files: new Map(),
      handoffs: new Map(),
      status: 'active',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    // Create workspace manifest
    await this.createWorkspaceManifest(workspace, options);

    // Create agent-specific directories
    for (const agentId of initialAgents) {
      await fs.mkdir(path.join(workspaceDir, 'agents', agentId), { recursive: true });
      
      if (!this.agentWorkspaces.has(agentId)) {
        this.agentWorkspaces.set(agentId, new Set());
      }
      this.agentWorkspaces.get(agentId)!.add(workspaceId);
    }

    this.workspaces.set(workspaceId, workspace);

    this.logger.info('🏗️ Created shared workspace', {
      workspaceId,
      name,
      agents: initialAgents,
      baseDir: workspaceDir
    });

    this.emit('workspace-created', { workspaceId, workspace });
    return workspaceId;
  }

  /**
   * Add an agent to a shared workspace
   */
  async addAgentToWorkspace(workspaceId: string, agentId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (workspace.agents.has(agentId)) {
      return; // Already added
    }

    // Create agent directory
    await fs.mkdir(path.join(workspace.baseDir, 'agents', agentId), { recursive: true });

    workspace.agents.add(agentId);
    workspace.lastActivity = new Date();

    if (!this.agentWorkspaces.has(agentId)) {
      this.agentWorkspaces.set(agentId, new Set());
    }
    this.agentWorkspaces.get(agentId)!.add(workspaceId);

    this.logger.info('👥 Added agent to workspace', { workspaceId, agentId });
    this.emit('agent-joined', { workspaceId, agentId });
  }

  /**
   * Store a file in the shared workspace with versioning
   */
  async storeWorkspaceFile(
    workspaceId: string,
    filePath: string,
    content: string,
    authorId: string,
    options: {
      status?: 'draft' | 'review' | 'approved';
      reviewRequired?: boolean;
    } = {}
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!workspace.agents.has(authorId)) {
      throw new Error(`Agent ${authorId} not part of workspace ${workspaceId}`);
    }

    const existingFile = workspace.files.get(filePath);
    const version = existingFile ? existingFile.version + 1 : 1;
    const checksum = this.calculateChecksum(content);

    const workspaceFile: WorkspaceFile = {
      path: filePath,
      content,
      author: authorId,
      lastModified: new Date(),
      version,
      checksum,
      reviews: [],
      status: options.status || (options.reviewRequired ? 'review' : 'draft')
    };

    // Store file in filesystem
    const fullPath = path.join(workspace.sharedDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);

    // Store versioned copy
    const versionPath = path.join(workspace.baseDir, 'versions', `${filePath}.v${version}`);
    await fs.mkdir(path.dirname(versionPath), { recursive: true });
    await fs.writeFile(versionPath, content);

    workspace.files.set(filePath, workspaceFile);
    workspace.lastActivity = new Date();

    this.logger.info('📄 Stored workspace file', {
      workspaceId,
      filePath,
      author: authorId,
      version,
      status: workspaceFile.status
    });

    this.emit('file-stored', {
      workspaceId,
      filePath,
      authorId,
      version,
      status: workspaceFile.status
    });

    // Auto-request review if needed
    if (workspaceFile.status === 'review') {
      await this.requestFileReview(workspaceId, filePath, authorId);
    }
  }

  /**
   * Request review of a file from other agents
   */
  async requestFileReview(
    workspaceId: string,
    filePath: string,
    authorId: string
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const file = workspace.files.get(filePath);
    if (!file) {
      throw new Error(`File ${filePath} not found in workspace`);
    }

    // Find other agents who can review
    const reviewers = Array.from(workspace.agents).filter(id => id !== authorId);

    for (const reviewerId of reviewers) {
      const review: FileReview = {
        reviewerId,
        status: 'pending',
        comments: [],
        timestamp: new Date()
      };

      file.reviews.push(review);
    }

    file.status = 'review';

    this.logger.info('📋 Requested file review', {
      workspaceId,
      filePath,
      author: authorId,
      reviewers
    });

    this.emit('review-requested', {
      workspaceId,
      filePath,
      authorId,
      reviewers
    });
  }

  /**
   * Submit a review for a file
   */
  async submitFileReview(
    workspaceId: string,
    filePath: string,
    reviewerId: string,
    status: 'approved' | 'changes-requested',
    comments: string[] = []
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const file = workspace.files.get(filePath);
    if (!file) {
      throw new Error(`File ${filePath} not found`);
    }

    const review = file.reviews.find(r => r.reviewerId === reviewerId);
    if (!review) {
      throw new Error(`No review found for reviewer ${reviewerId}`);
    }

    review.status = status;
    review.comments = comments;
    review.timestamp = new Date();

    // Check if all reviews are complete
    const allReviews = file.reviews.every(r => r.status !== 'pending');
    const allApproved = file.reviews.every(r => r.status === 'approved');

    if (allReviews) {
      file.status = allApproved ? 'approved' : 'draft';
    }

    this.logger.info('✅ Submitted file review', {
      workspaceId,
      filePath,
      reviewerId,
      status,
      allApproved
    });

    this.emit('review-submitted', {
      workspaceId,
      filePath,
      reviewerId,
      status,
      allReviews,
      allApproved
    });
  }

  /**
   * Create a handoff from one agent to another
   */
  async createAgentHandoff(
    workspaceId: string,
    fromAgent: string,
    toAgent: string,
    taskId: string,
    files: string[],
    instructions: string
  ): Promise<string> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!workspace.agents.has(fromAgent) || !workspace.agents.has(toAgent)) {
      throw new Error('Both agents must be part of the workspace');
    }

    const handoffId = generateId('handoff');
    const handoff: AgentHandoff = {
      id: handoffId,
      fromAgent,
      toAgent,
      taskId,
      files,
      instructions,
      status: 'pending',
      timestamp: new Date()
    };

    workspace.handoffs.set(handoffId, handoff);

    // Create handoff manifest file
    const handoffManifest = {
      id: handoffId,
      from: fromAgent,
      to: toAgent,
      task: taskId,
      files,
      instructions,
      timestamp: handoff.timestamp.toISOString(),
      status: 'pending'
    };

    await fs.writeFile(
      path.join(workspace.baseDir, 'handoffs', `${handoffId}.json`),
      JSON.stringify(handoffManifest, null, 2)
    );

    this.logger.info('🤝 Created agent handoff', {
      workspaceId,
      handoffId,
      fromAgent,
      toAgent,
      taskId,
      files: files.length
    });

    this.emit('handoff-created', {
      workspaceId,
      handoffId,
      handoff
    });

    return handoffId;
  }

  /**
   * Accept a handoff and begin work
   */
  async acceptHandoff(
    workspaceId: string,
    handoffId: string,
    acceptingAgent: string
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const handoff = workspace.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff ${handoffId} not found`);
    }

    if (handoff.toAgent !== acceptingAgent) {
      throw new Error(`Handoff is not intended for agent ${acceptingAgent}`);
    }

    handoff.status = 'accepted';

    // Copy relevant files to accepting agent's workspace
    await this.copyFilesToAgent(workspace, handoff.files, acceptingAgent);

    this.logger.info('✅ Accepted handoff', {
      workspaceId,
      handoffId,
      acceptingAgent,
      fromAgent: handoff.fromAgent
    });

    this.emit('handoff-accepted', {
      workspaceId,
      handoffId,
      acceptingAgent,
      handoff
    });
  }

  /**
   * Complete a handoff with results
   */
  async completeHandoff(
    workspaceId: string,
    handoffId: string,
    completingAgent: string,
    notes?: string
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const handoff = workspace.handoffs.get(handoffId);
    if (!handoff) {
      throw new Error(`Handoff ${handoffId} not found`);
    }

    if (handoff.toAgent !== completingAgent) {
      throw new Error(`Handoff not assigned to agent ${completingAgent}`);
    }

    handoff.status = 'completed';
    handoff.notes = notes;

    // Update handoff manifest
    const manifestPath = path.join(workspace.baseDir, 'handoffs', `${handoffId}.json`);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    manifest.status = 'completed';
    manifest.completedAt = new Date().toISOString();
    if (notes) manifest.notes = notes;

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    this.logger.info('🎉 Completed handoff', {
      workspaceId,
      handoffId,
      completingAgent,
      notes: notes ? 'with notes' : 'no notes'
    });

    this.emit('handoff-completed', {
      workspaceId,
      handoffId,
      completingAgent,
      handoff
    });
  }

  /**
   * Get workspace info and current state
   */
  getWorkspace(workspaceId: string): SharedWorkspace | undefined {
    return this.workspaces.get(workspaceId);
  }

  /**
   * Get all workspaces for an agent
   */
  getAgentWorkspaces(agentId: string): SharedWorkspace[] {
    const workspaceIds = this.agentWorkspaces.get(agentId) || new Set();
    return Array.from(workspaceIds)
      .map(id => this.workspaces.get(id))
      .filter(Boolean) as SharedWorkspace[];
  }

  /**
   * Get files in a workspace
   */
  getWorkspaceFiles(workspaceId: string): WorkspaceFile[] {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return [];
    
    return Array.from(workspace.files.values());
  }

  /**
   * Get pending handoffs for an agent
   */
  getPendingHandoffs(agentId: string): AgentHandoff[] {
    const handoffs: AgentHandoff[] = [];
    
    for (const workspace of this.workspaces.values()) {
      for (const handoff of workspace.handoffs.values()) {
        if (handoff.toAgent === agentId && handoff.status === 'pending') {
          handoffs.push(handoff);
        }
      }
    }
    
    return handoffs;
  }

  /**
   * Get workspace activity summary
   */
  getWorkspaceActivity(workspaceId: string): {
    files: number;
    pendingReviews: number;
    activeHandoffs: number;
    agents: number;
  } {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return { files: 0, pendingReviews: 0, activeHandoffs: 0, agents: 0 };
    }

    const pendingReviews = Array.from(workspace.files.values())
      .filter(file => file.status === 'review').length;

    const activeHandoffs = Array.from(workspace.handoffs.values())
      .filter(handoff => handoff.status === 'pending' || handoff.status === 'accepted').length;

    return {
      files: workspace.files.size,
      pendingReviews,
      activeHandoffs,
      agents: workspace.agents.size
    };
  }

  /**
   * Private helper methods
   */
  private async createWorkspaceManifest(
    workspace: SharedWorkspace,
    options: { template?: string; description?: string }
  ): Promise<void> {
    const manifest = {
      id: workspace.id,
      name: workspace.name,
      description: options.description || `Shared workspace for ${workspace.name}`,
      template: options.template,
      agents: Array.from(workspace.agents),
      createdAt: workspace.createdAt.toISOString(),
      status: workspace.status,
      structure: {
        shared: 'Shared files across all agents',
        agents: 'Agent-specific working directories',
        handoffs: 'Agent handoff coordination files',
        reviews: 'File review and approval tracking',
        versions: 'File version history'
      }
    };

    await fs.writeFile(
      path.join(workspace.baseDir, 'workspace.json'),
      JSON.stringify(manifest, null, 2)
    );
  }

  private async copyFilesToAgent(
    workspace: SharedWorkspace,
    filePaths: string[],
    agentId: string
  ): Promise<void> {
    const agentDir = path.join(workspace.baseDir, 'agents', agentId);
    
    for (const filePath of filePaths) {
      const file = workspace.files.get(filePath);
      if (file) {
        const targetPath = path.join(agentDir, filePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, file.content);
      }
    }
  }

  private calculateChecksum(content: string): string {
    // Simple checksum calculation (could use crypto for production)
    let checksum = 0;
    for (let i = 0; i < content.length; i++) {
      checksum = ((checksum << 5) - checksum + content.charCodeAt(i)) & 0xffffffff;
    }
    return checksum.toString(16);
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup(): Promise<void> {
    this.workspaces.clear();
    this.agentWorkspaces.clear();
    
    this.logger.info('🧹 Workspace coordinator cleaned up');
  }
} 