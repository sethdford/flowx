/**
 * Message Broker
 * Handles message routing, queuing, and delivery across the system
 */

import { EventEmitter } from 'node:events';
import { ILogger } from "../core/logger.js";
import { IEventBus } from "../core/event-bus.js";
import { MessageBus, MessageBusConfig } from "./message-bus.js";
import { generateId } from "../utils/helpers.js";

export interface BrokerMessage {
  id: string;
  type: string;
  sender: string;
  receiver: string;
  content: any;
  correlationId?: string;
  replyTo?: string;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  ttl?: number;
  metadata?: Record<string, any>;
}

export interface MessageHandler {
  (message: BrokerMessage): Promise<void> | void;
}

export interface IMessageBroker {
  // Core messaging operations
  sendMessage(from: string, to: string, type: string, content: any, options?: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    correlationId?: string;
    replyTo?: string;
    ttl?: number;
  }): Promise<string>;

  // Request-response pattern
  sendRequest(from: string, to: string, type: string, content: any, timeout?: number): Promise<any>;
  
  // Broadcast and multicast
  broadcast(from: string, type: string, content: any, options?: { excludeAgents?: string[] }): Promise<void>;
  multicast(from: string, recipients: string[], type: string, content: any): Promise<void>;
  
  // Subscription management
  subscribe(agentId: string, messageType: string, handler: MessageHandler): string;
  unsubscribe(agentId: string, subscriptionId: string): void;
  
  // Queue management
  createQueue(name: string, config?: any): Promise<string>;
  subscribeToQueue(queueId: string, agentId: string, handler: MessageHandler): Promise<string>;
  
  // Channel management
  createChannel(name: string, type: 'broadcast' | 'multicast' | 'topic'): Promise<string>;
  joinChannel(channelId: string, agentId: string): Promise<void>;
  leaveChannel(channelId: string, agentId: string): Promise<void>;
  sendToChannel(channelId: string, from: string, type: string, content: any): Promise<void>;
  
  // System management
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getMetrics(): any;
}

/**
 * Message broker that handles routing, queuing, and delivery
 */
export class MessageBroker extends EventEmitter implements IMessageBroker {
  private messageBus: MessageBus;
  private subscriptions = new Map<string, Map<string, MessageHandler>>();
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private channels = new Map<string, { name: string; type: string; members: Set<string> }>();
  private queues = new Map<string, { name: string; messages: BrokerMessage[]; subscribers: Map<string, MessageHandler> }>();
  
  constructor(
    config: Partial<MessageBusConfig>,
    private logger: ILogger,
    private eventBus: IEventBus
  ) {
    super();
    
    this.messageBus = new MessageBus({
      strategy: 'event-driven',
      enablePersistence: true,
      enableReliability: true,
      enableOrdering: false,
      enableFiltering: true,
      ...config
    }, logger, eventBus);
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.messageBus.on('message:delivered', (data: any) => {
      this.handleDeliveredMessage(data.message, data.subscriber);
    });
    
    this.messageBus.on('message:sent', (data: any) => {
      this.emit('message:sent', {
        messageId: data.message.id,
        from: data.message.sender.id,
        to: data.message.receivers.map((r: any) => r.id)
      });
    });
  }
  
  async initialize(): Promise<void> {
    this.logger.info('Initializing message broker');
    await this.messageBus.initialize();
    
    await this.createChannel('system-coordination', 'broadcast');
    await this.createChannel('agent-coordination', 'multicast');
    await this.createChannel('task-distribution', 'topic');
    
    this.emit('broker:initialized');
  }
  
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down message broker');
    
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Message broker shutting down'));
    }
    this.pendingRequests.clear();
    
    await this.messageBus.shutdown();
    this.emit('broker:shutdown');
  }
  
  async sendMessage(
    from: string, 
    to: string, 
    type: string, 
    content: any, 
    options: {
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      correlationId?: string;
      replyTo?: string;
      ttl?: number;
    } = {}
  ): Promise<string> {
    const sender = this.createAgentId(from);
    const receiver = this.createAgentId(to);
    
    const messagePriority = this.mapPriorityToMessageBus(options.priority || 'normal');
    
    return await this.messageBus.sendMessage(
      type,
      content,
      sender,
      receiver,
      {
        priority: messagePriority,
        correlationId: options.correlationId,
        replyTo: options.replyTo,
        ttl: options.ttl
      }
    );
  }
  
  async sendRequest(
    from: string, 
    to: string, 
    type: string, 
    content: any, 
    timeout: number = 30000
  ): Promise<any> {
    const requestId = generateId('req');
    
    return new Promise(async (resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });
      
      try {
        await this.sendMessage(from, to, type, content, {
          correlationId: requestId,
          replyTo: from,
          ttl: timeout
        });
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }
  
  async broadcast(
    from: string, 
    type: string, 
    content: any, 
    options: { excludeAgents?: string[] } = {}
  ): Promise<void> {
    const channelId = this.findChannelByName('system-coordination');
    if (channelId) {
      await this.sendToChannel(channelId, from, type, content);
    } else {
      this.logger.warn('System coordination channel not found for broadcast');
    }
  }
  
  async multicast(
    from: string, 
    recipients: string[], 
    type: string, 
    content: any
  ): Promise<void> {
    const sender = this.createAgentId(from);
    const receivers = recipients.map(id => this.createAgentId(id));
    
    await this.messageBus.sendMessage(type, content, sender, receivers);
  }
  
  subscribe(agentId: string, messageType: string, handler: MessageHandler): string {
    const subscriptionId = generateId('sub');
    
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, new Map());
    }
    
    this.subscriptions.get(agentId)!.set(subscriptionId, handler);
    
    this.logger.debug('Message subscription created', {
      agentId,
      messageType,
      subscriptionId
    });
    
    return subscriptionId;
  }
  
  unsubscribe(agentId: string, subscriptionId: string): void {
    const agentSubs = this.subscriptions.get(agentId);
    if (agentSubs) {
      agentSubs.delete(subscriptionId);
      if (agentSubs.size === 0) {
        this.subscriptions.delete(agentId);
      }
    }
  }
  
  async createQueue(name: string, config: any = {}): Promise<string> {
    const queueId = generateId('queue');
    
    this.queues.set(queueId, {
      name,
      messages: [],
      subscribers: new Map()
    });
    
    this.logger.info('Queue created', { queueId, name });
    return queueId;
  }
  
  async subscribeToQueue(queueId: string, agentId: string, handler: MessageHandler): Promise<string> {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Queue ${queueId} not found`);
    }
    
    const subscriptionId = generateId('queue-sub');
    queue.subscribers.set(subscriptionId, handler);
    
    this.subscribe(agentId, `queue:${queueId}`, handler);
    
    this.logger.debug('Queue subscription created', { queueId, agentId, subscriptionId });
    return subscriptionId;
  }
  
  async createChannel(name: string, type: 'broadcast' | 'multicast' | 'topic'): Promise<string> {
    const channelId = generateId('channel');
    
    this.channels.set(channelId, {
      name,
      type,
      members: new Set()
    });
    
    this.logger.info('Channel created', { channelId, name, type });
    return channelId;
  }
  
  async joinChannel(channelId: string, agentId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    
    channel.members.add(agentId);
    this.logger.debug('Agent joined channel', { channelId, agentId });
  }
  
  async leaveChannel(channelId: string, agentId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    
    channel.members.delete(agentId);
    this.logger.debug('Agent left channel', { channelId, agentId });
  }
  
  async sendToChannel(channelId: string, from: string, type: string, content: any): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    
    const recipients = Array.from(channel.members).filter(id => id !== from);
    
    if (recipients.length > 0) {
      await this.multicast(from, recipients, type, content);
    }
  }
  
  getMetrics(): any {
    return {
      ...this.messageBus.getMetrics(),
      subscriptions: this.subscriptions.size,
      pendingRequests: this.pendingRequests.size,
      channels: this.channels.size,
      queues: this.queues.size
    };
  }
  
  private createAgentId(id: string): any {
    return {
      id,
      type: 'agent',
      swarmId: 'default',
      instance: 0
    };
  }
  
  private mapPriorityToMessageBus(priority: string): any {
    switch (priority) {
      case 'urgent': return 'high';
      case 'high': return 'high';
      case 'normal': return 'normal';
      case 'low': return 'low';
      default: return 'normal';
    }
  }
  
  private async handleDeliveredMessage(message: any, subscriber: any): Promise<void> {
    const agentId = subscriber.id;
    const agentSubs = this.subscriptions.get(agentId);
    
    if (!agentSubs) return;
    
    const brokerMessage: BrokerMessage = {
      id: message.id,
      type: message.type,
      sender: message.sender.id,
      receiver: agentId,
      content: message.content,
      correlationId: message.metadata?.correlationId,
      replyTo: message.metadata?.replyTo,
      timestamp: message.timestamp,
      priority: this.mapMessageBusPriorityToBroker(message.priority),
      ttl: message.metadata?.ttl,
      metadata: message.metadata
    };
    
    if (message.metadata?.correlationId && this.pendingRequests.has(message.metadata.correlationId)) {
      const pending = this.pendingRequests.get(message.metadata.correlationId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.metadata.correlationId);
      pending.resolve(message.content);
      return;
    }
    
    for (const [subscriptionId, handler] of agentSubs) {
      try {
        await handler(brokerMessage);
      } catch (error) {
        this.logger.error('Message handler error', {
          agentId,
          messageId: message.id,
          subscriptionId,
          error
        });
      }
    }
  }
  
  private mapMessageBusPriorityToBroker(priority: any): 'low' | 'normal' | 'high' | 'urgent' {
    switch (priority) {
      case 'high': return 'high';
      case 'normal': return 'normal';
      case 'low': return 'low';
      default: return 'normal';
    }
  }
  
  private findChannelByName(name: string): string | null {
    for (const [channelId, channel] of this.channels) {
      if (channel.name === name) {
        return channelId;
      }
    }
    return null;
  }
}

export function createMessageBroker(
  config: Partial<MessageBusConfig>,
  logger: ILogger,
  eventBus: IEventBus
): MessageBroker {
  return new MessageBroker(config, logger, eventBus);
}

export default MessageBroker;
