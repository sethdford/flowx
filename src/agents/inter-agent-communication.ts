/**
 * Inter-Agent Communication System
 * Provides secure, efficient communication between isolated agent processes
 */

import { EventEmitter } from 'node:events';
import { ILogger } from '../core/logger.js';
import { AgentProcessManager } from './agent-process-manager.js';
import { generateId } from '../utils/helpers.js';

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'direct' | 'broadcast' | 'multicast' | 'coordination' | 'handshake';
  subType: 'task_request' | 'task_response' | 'status_update' | 'resource_share' | 'collaboration_invite' | 'knowledge_share' | 'error_report';
  payload: any;
  timestamp: Date;
  ttl?: number; // Time to live in milliseconds
  priority: 'low' | 'medium' | 'high' | 'critical';
  encrypted?: boolean;
  signature?: string;
  correlationId?: string;
  replyTo?: string;
}

export interface CommunicationChannel {
  id: string;
  participants: string[];
  type: 'peer_to_peer' | 'broadcast' | 'multicast' | 'coordination_hub';
  secure: boolean;
  persistent: boolean;
  messageHistory: AgentMessage[];
  created: Date;
  lastActivity: Date;
}

export interface AgentCommunicationCapabilities {
  canSendDirectMessages: boolean;
  canBroadcast: boolean;
  canCreateChannels: boolean;
  canJoinChannels: boolean;
  maxConcurrentChannels: number;
  allowedMessageTypes: string[];
  securityLevel: 'basic' | 'standard' | 'high' | 'enterprise';
}

export class InterAgentCommunication extends EventEmitter {
  private logger: ILogger;
  private processManager: AgentProcessManager;
  
  // Communication infrastructure
  private channels = new Map<string, CommunicationChannel>();
  private agentCapabilities = new Map<string, AgentCommunicationCapabilities>();
  private messageQueue = new Map<string, AgentMessage[]>(); // Agent ID -> pending messages
  private messageHistory = new Map<string, AgentMessage[]>(); // For audit and debugging
  
  // Routing and discovery
  private agentRegistry = new Map<string, {
    id: string;
    status: 'online' | 'offline' | 'busy';
    lastSeen: Date;
    capabilities: string[];
    preferredChannels: string[];
  }>();
  
  // Security and rate limiting
  private messageRateLimit = new Map<string, { count: number; window: Date }>();
  private trustedAgents = new Set<string>();
  private blacklistedAgents = new Set<string>();
  
  constructor(logger: ILogger, processManager: AgentProcessManager) {
    super();
    this.logger = logger;
    this.processManager = processManager;
    
    this.setupEventHandlers();
    this.startMessageProcessing();
    this.startCleanupTasks();
  }

  /**
   * Register an agent for communication
   */
  async registerAgent(agentId: string, capabilities: AgentCommunicationCapabilities): Promise<void> {
    this.logger.info('Registering agent for communication', { agentId });
    
    this.agentCapabilities.set(agentId, capabilities);
    this.messageQueue.set(agentId, []);
    
    this.agentRegistry.set(agentId, {
      id: agentId,
      status: 'online',
      lastSeen: new Date(),
      capabilities: [],
      preferredChannels: []
    });
    
    // Create default capabilities if not provided
    if (!capabilities) {
      this.agentCapabilities.set(agentId, {
        canSendDirectMessages: true,
        canBroadcast: false,
        canCreateChannels: true,
        canJoinChannels: true,
        maxConcurrentChannels: 5,
        allowedMessageTypes: ['task_request', 'task_response', 'status_update'],
        securityLevel: 'standard'
      });
    }
    
    this.emit('agent:registered', { agentId, capabilities });
  }

  /**
   * Send a direct message between two agents
   */
  async sendDirectMessage(
    fromAgentId: string,
    toAgentId: string,
    subType: AgentMessage['subType'],
    payload: any,
    options: {
      priority?: AgentMessage['priority'];
      ttl?: number;
      encrypted?: boolean;
      correlationId?: string;
    } = {}
  ): Promise<string> {
    const messageId = generateId('msg');
    
    // Validate sender capabilities
    const senderCapabilities = this.agentCapabilities.get(fromAgentId);
    if (!senderCapabilities?.canSendDirectMessages) {
      throw new Error(`Agent ${fromAgentId} does not have direct messaging capabilities`);
    }
    
    // Check rate limiting
    if (!this.checkRateLimit(fromAgentId)) {
      throw new Error(`Agent ${fromAgentId} has exceeded message rate limit`);
    }
    
    // Check if recipient exists and is online
    const recipient = this.agentRegistry.get(toAgentId);
    if (!recipient) {
      throw new Error(`Recipient agent ${toAgentId} not found`);
    }
    
    const message: AgentMessage = {
      id: messageId,
      from: fromAgentId,
      to: toAgentId,
      type: 'direct',
      subType,
      payload,
      timestamp: new Date(),
      ttl: options.ttl || 300000, // 5 minutes default
      priority: options.priority || 'medium',
      encrypted: options.encrypted || false,
      correlationId: options.correlationId
    };
    
    // Queue message for delivery
    await this.queueMessage(toAgentId, message);
    
    // Store in history for auditing
    this.storeMessageInHistory(message);
    
    this.logger.debug('Direct message sent', {
      messageId,
      from: fromAgentId,
      to: toAgentId,
      subType,
      priority: message.priority
    });
    
    this.emit('message:sent', { message });
    
    return messageId;
  }

  /**
   * Broadcast a message to all agents in a channel
   */
  async broadcastMessage(
    fromAgentId: string,
    channelId: string,
    subType: AgentMessage['subType'],
    payload: any,
    options: {
      priority?: AgentMessage['priority'];
      ttl?: number;
      excludeAgents?: string[];
    } = {}
  ): Promise<string> {
    const messageId = generateId('bcast');
    
    const senderCapabilities = this.agentCapabilities.get(fromAgentId);
    if (!senderCapabilities?.canBroadcast) {
      throw new Error(`Agent ${fromAgentId} does not have broadcast capabilities`);
    }
    
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    
    if (!channel.participants.includes(fromAgentId)) {
      throw new Error(`Agent ${fromAgentId} is not a participant in channel ${channelId}`);
    }
    
    const message: AgentMessage = {
      id: messageId,
      from: fromAgentId,
      to: channelId,
      type: 'broadcast',
      subType,
      payload,
      timestamp: new Date(),
      ttl: options.ttl || 600000, // 10 minutes for broadcast
      priority: options.priority || 'medium'
    };
    
    // Send to all participants except sender and excluded agents
    const recipients = channel.participants.filter(agentId => 
      agentId !== fromAgentId && 
      !(options.excludeAgents?.includes(agentId))
    );
    
    for (const recipientId of recipients) {
      await this.queueMessage(recipientId, { ...message, to: recipientId });
    }
    
    // Update channel activity
    channel.lastActivity = new Date();
    if (channel.persistent) {
      channel.messageHistory.push(message);
    }
    
    this.storeMessageInHistory(message);
    
    this.logger.info('Broadcast message sent', {
      messageId,
      from: fromAgentId,
      channel: channelId,
      recipients: recipients.length,
      subType
    });
    
    this.emit('message:broadcast', { message, recipients });
    
    return messageId;
  }

  /**
   * Create a communication channel
   */
  async createChannel(
    creatorId: string,
    type: CommunicationChannel['type'],
    options: {
      participants?: string[];
      secure?: boolean;
      persistent?: boolean;
    } = {}
  ): Promise<string> {
    const channelId = generateId('channel');
    
    const creatorCapabilities = this.agentCapabilities.get(creatorId);
    if (!creatorCapabilities?.canCreateChannels) {
      throw new Error(`Agent ${creatorId} does not have channel creation capabilities`);
    }
    
    const channel: CommunicationChannel = {
      id: channelId,
      participants: [creatorId, ...(options.participants || [])],
      type,
      secure: options.secure || false,
      persistent: options.persistent || false,
      messageHistory: [],
      created: new Date(),
      lastActivity: new Date()
    };
    
    this.channels.set(channelId, channel);
    
    this.logger.info('Communication channel created', {
      channelId,
      creator: creatorId,
      type,
      participants: channel.participants.length
    });
    
    this.emit('channel:created', { channel });
    
    return channelId;
  }

  /**
   * Join an existing channel
   */
  async joinChannel(agentId: string, channelId: string): Promise<void> {
    const agentCapabilities = this.agentCapabilities.get(agentId);
    if (!agentCapabilities?.canJoinChannels) {
      throw new Error(`Agent ${agentId} does not have channel joining capabilities`);
    }
    
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    
    if (channel.participants.includes(agentId)) {
      return; // Already a participant
    }
    
    // Check channel limits
    const agentChannelCount = Array.from(this.channels.values())
      .filter(ch => ch.participants.includes(agentId)).length;
    
    if (agentChannelCount >= agentCapabilities.maxConcurrentChannels) {
      throw new Error(`Agent ${agentId} has reached maximum channel limit`);
    }
    
    channel.participants.push(agentId);
    channel.lastActivity = new Date();
    
    this.logger.info('Agent joined channel', { agentId, channelId });
    this.emit('channel:joined', { agentId, channelId });
  }

  /**
   * Get pending messages for an agent
   */
  async getPendingMessages(agentId: string): Promise<AgentMessage[]> {
    const messages = this.messageQueue.get(agentId) || [];
    this.messageQueue.set(agentId, []); // Clear after retrieval
    
    // Filter expired messages
    const now = Date.now();
    const validMessages = messages.filter(msg => {
      if (!msg.ttl) return true;
      return (msg.timestamp.getTime() + msg.ttl) > now;
    });
    
    return validMessages.sort((a, b) => {
      // Sort by priority, then by timestamp
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      return a.timestamp.getTime() - b.timestamp.getTime(); // Older first
    });
  }

  /**
   * Get agent communication status
   */
  getAgentStatus(agentId: string): {
    status: string;
    capabilities: AgentCommunicationCapabilities | undefined;
    pendingMessages: number;
    activeChannels: string[];
    messagesSent: number;
    messagesReceived: number;
  } {
    const registry = this.agentRegistry.get(agentId);
    const capabilities = this.agentCapabilities.get(agentId);
    const pendingCount = this.messageQueue.get(agentId)?.length || 0;
    
    const activeChannels = Array.from(this.channels.values())
      .filter(ch => ch.participants.includes(agentId))
      .map(ch => ch.id);
    
    const history = this.messageHistory.get(agentId) || [];
    const sent = history.filter(msg => msg.from === agentId).length;
    const received = history.filter(msg => msg.to === agentId).length;
    
    return {
      status: registry?.status || 'unknown',
      capabilities,
      pendingMessages: pendingCount,
      activeChannels,
      messagesSent: sent,
      messagesReceived: received
    };
  }

  /**
   * Coordinate agents for collaborative tasks
   */
  async coordinateAgents(
    coordinatorId: string,
    participantIds: string[],
    coordinationRequest: {
      type: 'task_distribution' | 'resource_sharing' | 'knowledge_sync' | 'load_balancing';
      payload: any;
      deadline?: Date;
    }
  ): Promise<string> {
    const sessionId = generateId('coord');
    
    // Create temporary coordination channel
    const channelId = await this.createChannel(coordinatorId, 'coordination_hub', {
      participants: participantIds,
      secure: true,
      persistent: false
    });
    
    // Send coordination invitation to all participants
    for (const participantId of participantIds) {
      await this.sendDirectMessage(coordinatorId, participantId, 'collaboration_invite', {
        sessionId,
        channelId,
        coordinationType: coordinationRequest.type,
        deadline: coordinationRequest.deadline,
        details: coordinationRequest.payload
      }, {
        priority: 'high',
        correlationId: sessionId
      });
    }
    
    this.logger.info('Agent coordination initiated', {
      sessionId,
      coordinator: coordinatorId,
      participants: participantIds.length,
      type: coordinationRequest.type
    });
    
    this.emit('coordination:started', {
      sessionId,
      coordinatorId,
      participantIds,
      channelId,
      request: coordinationRequest
    });
    
    return sessionId;
  }

  // Private helper methods

  private async queueMessage(agentId: string, message: AgentMessage): Promise<void> {
    const queue = this.messageQueue.get(agentId) || [];
    queue.push(message);
    this.messageQueue.set(agentId, queue);
    
    // Try to deliver immediately if agent is online
    const agentInfo = this.agentRegistry.get(agentId);
    if (agentInfo?.status === 'online') {
      await this.attemptImmediateDelivery(agentId, message);
    }
  }

  private async attemptImmediateDelivery(agentId: string, message: AgentMessage): Promise<void> {
    try {
      // Use process manager to send message to agent - convert to process manager format
      await this.processManager.sendMessage(agentId, {
        id: message.id,
        type: 'command', // Use 'command' type for inter-agent communication
        timestamp: message.timestamp,
        data: {
          communicationType: message.type,
          subType: message.subType,
          from: message.from,
          to: message.to,
          payload: message.payload,
          priority: message.priority,
          correlationId: message.correlationId
        } as Record<string, unknown>
      });
      
      this.emit('message:delivered', { agentId, messageId: message.id });
      
    } catch (error) {
      this.logger.warn('Failed immediate message delivery', {
        agentId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
      // Message will remain in queue for next delivery attempt
    }
  }

  private storeMessageInHistory(message: AgentMessage): void {
    // Store for sender
    const senderHistory = this.messageHistory.get(message.from) || [];
    senderHistory.push(message);
    this.messageHistory.set(message.from, senderHistory.slice(-100)); // Keep last 100
    
    // Store for recipient(s)
    if (message.type === 'direct') {
      const receiverHistory = this.messageHistory.get(message.to) || [];
      receiverHistory.push(message);
      this.messageHistory.set(message.to, receiverHistory.slice(-100));
    }
  }

  private checkRateLimit(agentId: string): boolean {
    const now = new Date();
    const windowMs = 60000; // 1 minute window
    const maxMessages = 100; // Max 100 messages per minute
    
    const rateData = this.messageRateLimit.get(agentId);
    
    if (!rateData || (now.getTime() - rateData.window.getTime()) > windowMs) {
      // New window
      this.messageRateLimit.set(agentId, { count: 1, window: now });
      return true;
    }
    
    if (rateData.count >= maxMessages) {
      return false; // Rate limit exceeded
    }
    
    rateData.count++;
    return true;
  }

  private setupEventHandlers(): void {
    // Listen for agent process events
    this.processManager.on('agent:exited', ({ agentId }) => {
      const registry = this.agentRegistry.get(agentId);
      if (registry) {
        registry.status = 'offline';
        registry.lastSeen = new Date();
      }
    });
    
    this.processManager.on('agent:started', ({ agentId }) => {
      const registry = this.agentRegistry.get(agentId);
      if (registry) {
        registry.status = 'online';
        registry.lastSeen = new Date();
      }
    });
  }

  private startMessageProcessing(): void {
    // Process message queues every 5 seconds
    setInterval(async () => {
      for (const [agentId, queue] of this.messageQueue) {
        if (queue.length === 0) continue;
        
        const agentInfo = this.agentRegistry.get(agentId);
        if (agentInfo?.status === 'online') {
          const messages = queue.splice(0, 10); // Process up to 10 messages at a time
          for (const message of messages) {
            await this.attemptImmediateDelivery(agentId, message);
          }
        }
      }
    }, 5000);
  }

  private startCleanupTasks(): void {
    // Cleanup expired messages and inactive channels every minute
    setInterval(() => {
      const now = Date.now();
      
      // Clean expired messages
      for (const [agentId, queue] of this.messageQueue) {
        const validMessages = queue.filter(msg => {
          if (!msg.ttl) return true;
          return (msg.timestamp.getTime() + msg.ttl) > now;
        });
        this.messageQueue.set(agentId, validMessages);
      }
      
      // Clean inactive channels
      for (const [channelId, channel] of this.channels) {
        if (!channel.persistent) {
          const inactiveTime = now - channel.lastActivity.getTime();
          if (inactiveTime > 3600000) { // 1 hour
            this.channels.delete(channelId);
            this.logger.debug('Deleted inactive channel', { channelId });
          }
        }
      }
    }, 60000);
  }
} 