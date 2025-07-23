/**
 * Advanced messaging and communication layer for swarm coordination
 */

import { EventEmitter } from 'node:events';
import { ILogger } from "../core/logger.js";
import { IEventBus } from "../core/event-bus.js";
import { 
  SwarmEvent, 
  EventType, 
  AgentId, 
  CommunicationStrategy 
} from "../swarm/types.js";
import { generateId } from "../utils/helpers.js";
import { SystemError } from '../utils/errors.js';

// Custom error classes for message bus operations
class MessageBusError extends SystemError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, metadata);
    this.name = 'MessageBusError';
  }
}

class MessageValidationError extends MessageBusError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, metadata);
    this.name = 'MessageValidationError';
  }
}

class DeliveryError extends MessageBusError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, metadata);
    this.name = 'DeliveryError';
  }
}

class ResourceError extends MessageBusError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, metadata);
    this.name = 'ResourceError';
  }
}

export interface MessageBusConfig {
  strategy: CommunicationStrategy;
  enablePersistence: boolean;
  enableReliability: boolean;
  enableOrdering: boolean;
  enableFiltering: boolean;
  maxMessageSize: number;
  maxQueueSize: number;
  messageRetention: number;
  acknowledgmentTimeout: number;
  retryAttempts: number;
  backoffMultiplier: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  metricsEnabled: boolean;
  debugMode: boolean;
}

export interface Message {
  id: string;
  type: string;
  sender: AgentId;
  receivers: AgentId[];
  content: any;
  metadata: MessageMetadata;
  timestamp: Date;
  expiresAt?: Date | undefined;
  priority: MessagePriority;
  reliability: ReliabilityLevel;
}

export interface MessageMetadata {
  correlationId?: string | undefined;
  causationId?: string;
  replyTo?: string | undefined;
  ttl?: number | undefined;
  compressed: boolean;
  encrypted: boolean;
  size: number;
  contentType: string;
  encoding: string;
  checksum?: string;
  route?: string[];
  deadLetterReason?: string;
  deadLetterTimestamp?: Date;
}

export interface MessageChannel {
  id: string;
  name: string;
  type: ChannelType;
  participants: AgentId[];
  config: ChannelConfig;
  statistics: ChannelStatistics;
  filters: MessageFilter[];
  middleware: ChannelMiddleware[];
}

export interface ChannelConfig {
  persistent: boolean;
  ordered: boolean;
  reliable: boolean;
  maxParticipants: number;
  maxMessageSize: number;
  maxQueueDepth: number;
  retentionPeriod: number;
  accessControl: AccessControlConfig;
}

export interface AccessControlConfig {
  readPermission: 'public' | 'participants' | 'restricted';
  writePermission: 'public' | 'participants' | 'restricted';
  adminPermission: 'creator' | 'administrators' | 'system';
  allowedSenders: AgentId[];
  allowedReceivers: AgentId[];
  bannedAgents: AgentId[];
}

export interface ChannelStatistics {
  messagesTotal: number;
  messagesDelivered: number;
  messagesFailed: number;
  bytesTransferred: number;
  averageLatency: number;
  throughput: number;
  errorRate: number;
  participantCount: number;
  lastActivity: Date;
}

export interface MessageFilter {
  id: string;
  name: string;
  enabled: boolean;
  conditions: FilterCondition[];
  action: 'allow' | 'deny' | 'modify' | 'route';
  priority: number;
}

export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'matches' | 'in';
  value: any;
  caseSensitive?: boolean;
}

export interface ChannelMiddleware {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  process: (message: Message, context: MiddlewareContext) => Promise<Message | null>;
}

export interface MiddlewareContext {
  channel: MessageChannel;
  direction: 'inbound' | 'outbound';
  agent: AgentId;
  metadata: Record<string, any>;
}

export interface MessageQueue {
  id: string;
  name: string;
  type: QueueType;
  messages: Message[];
  config: QueueConfig;
  subscribers: QueueSubscriber[];
  statistics: QueueStatistics;
}

export interface QueueConfig {
  maxSize: number;
  persistent: boolean;
  ordered: boolean;
  durability: 'memory' | 'disk' | 'distributed';
  deliveryMode: 'at-most-once' | 'at-least-once' | 'exactly-once';
  deadLetterQueue?: string;
  retryPolicy: RetryPolicy;
}

export interface QueueSubscriber {
  id: string;
  agent: AgentId;
  filter?: MessageFilter;
  ackMode: 'auto' | 'manual';
  prefetchCount: number;
  lastActivity: Date;
}

export interface QueueStatistics {
  depth: number;
  enqueueRate: number;
  dequeueRate: number;
  throughput: number;
  averageWaitTime: number;
  subscriberCount: number;
  deadLetterCount: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface TopicSubscription {
  id: string;
  topic: string;
  subscriber: AgentId;
  filter?: MessageFilter | undefined;
  ackRequired: boolean;
  qos: QualityOfService;
  createdAt: Date;
  lastMessage?: Date;
}

export interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: FilterCondition[];
  actions: RoutingAction[];
}

export interface RoutingAction {
  type: 'forward' | 'duplicate' | 'transform' | 'aggregate' | 'delay';
  target?: string;
  config: Record<string, any>;
}

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';
export type ReliabilityLevel = 'best-effort' | 'at-least-once' | 'exactly-once';
export type ChannelType = 'direct' | 'broadcast' | 'multicast' | 'topic' | 'queue';
export type QueueType = 'fifo' | 'lifo' | 'priority' | 'delay' | 'round-robin';
export type QualityOfService = 0 | 1 | 2; // MQTT-style QoS levels

/**
 * Advanced message bus with support for multiple communication patterns
 */
export class MessageBus extends EventEmitter {
  private logger: ILogger;
  private eventBus: IEventBus;
  private config: MessageBusConfig;

  // Core messaging components
  private channels = new Map<string, MessageChannel>();
  private queues = new Map<string, MessageQueue>();
  private subscriptions = new Map<string, TopicSubscription>();
  private routingRules = new Map<string, RoutingRule>();

  // Message tracking
  private messageStore = new Map<string, Message>();
  private deliveryReceipts = new Map<string, DeliveryReceipt>();
  private acknowledgments = new Map<string, MessageAcknowledgment>();

  // Routing and delivery
  private router: MessageRouter;
  private deliveryManager: DeliveryManager;
  private retryManager: RetryManager;

  // Performance monitoring
  private metrics: MessageBusMetrics;
  private metricsInterval?: NodeJS.Timeout;

  constructor(
    config: Partial<MessageBusConfig>,
    logger: ILogger,
    eventBus: IEventBus
  ) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;

    this.config = {
      strategy: 'event-driven',
      enablePersistence: true,
      enableReliability: true,
      enableOrdering: false,
      enableFiltering: true,
      maxMessageSize: 1024 * 1024, // 1MB
      maxQueueSize: 10000,
      messageRetention: 86400000, // 24 hours
      acknowledgmentTimeout: 30000,
      retryAttempts: 3,
      backoffMultiplier: 2,
      compressionEnabled: false,
      encryptionEnabled: false,
      metricsEnabled: true,
      debugMode: false,
      ...config
    };

    this.router = new MessageRouter(this.config, this.logger);
    this.deliveryManager = new DeliveryManager(this.config, this.logger);
    this.retryManager = new RetryManager(this.config, this.logger);
    this.metrics = new MessageBusMetrics();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.on('agent:connected', (data: any) => {
      this.handleAgentConnected(data.agentId);
    });

    this.eventBus.on('agent:disconnected', (data: any) => {
      this.handleAgentDisconnected(data.agentId);
    });

    this.deliveryManager.on('delivery:success', (data: any) => {
      this.handleDeliverySuccess(data);
    });

    this.deliveryManager.on('delivery:failure', (data: any) => {
      this.handleDeliveryFailure(data);
    });

    this.retryManager.on('retry:exhausted', (data: any) => {
      this.handleRetryExhausted(data);
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing message bus', {
      strategy: this.config.strategy,
      persistence: this.config.enablePersistence,
      reliability: this.config.enableReliability
    });

    // Initialize components
    await this.router.initialize();
    await this.deliveryManager.initialize();
    await this.retryManager.initialize();

    // Create default channels
    await this.createDefaultChannels();

    // Start metrics collection
    if (this.config.metricsEnabled) {
      this.startMetricsCollection();
    }

    this.emit('messagebus:initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down message bus');

    // Stop metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Shutdown components
    await this.retryManager.shutdown();
    await this.deliveryManager.shutdown();
    await this.router.shutdown();

    // Persist any remaining messages if enabled
    if (this.config.enablePersistence) {
      await this.persistMessages();
    }

    this.emit('messagebus:shutdown');
  }

  // === MESSAGE OPERATIONS ===

  /**
   * Sends a message to one or more receivers
   * @param type The message type
   * @param content The message content
   * @param sender The sender agent ID
   * @param receivers The receiver agent ID(s)
   * @param options Additional message options
   * @returns The generated message ID
   * @throws MessageValidationError if the message is invalid
   * @throws DeliveryError if the message cannot be delivered
   */
  async sendMessage(
    type: string,
    content: any,
    sender: AgentId,
    receivers: AgentId | AgentId[],
    options: {
      priority?: MessagePriority | undefined;
      reliability?: ReliabilityLevel | undefined;
      ttl?: number | undefined;
      correlationId?: string | undefined;
      replyTo?: string | undefined;
      channel?: string | undefined;
    } = {}
  ): Promise<string> {
    try {
      // Input validation
      if (!type) {
        throw new MessageValidationError('Message type is required');
      }
      
      if (!sender || !sender.id) {
        throw new MessageValidationError('Valid sender is required');
      }
      
      if (!receivers) {
        throw new MessageValidationError('Receivers are required');
      }
      
      const messageId = generateId('msg');
      const now = new Date();
      
      const receiversArray = Array.isArray(receivers) ? receivers : [receivers];
      
      // Validate receivers
      const invalidReceivers = receiversArray.filter(r => !r || !r.id);
      if (invalidReceivers.length > 0) {
        throw new MessageValidationError(
          'Invalid receivers detected', 
          { invalidCount: invalidReceivers.length }
        );
      }
      
      // Process content first to get accurate size
      let processedContent;
      try {
        processedContent = await this.processContent(content);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new MessageValidationError(
          `Failed to process message content: ${errorMessage}`,
          { cause: error }
        );
      }
      const contentSize = this.calculateSize(content);
      
      // Check size limit early
      if (contentSize > this.config.maxMessageSize) {
        throw new MessageValidationError(
          `Message size ${contentSize} exceeds limit ${this.config.maxMessageSize}`
        );
      }
      
      const message: Message = {
        id: messageId,
        type,
        sender,
        receivers: receiversArray,
        content: processedContent,
        metadata: {
          correlationId: options.correlationId,
          replyTo: options.replyTo,
          ttl: options.ttl,
          compressed: this.config.compressionEnabled,
          encrypted: this.config.encryptionEnabled,
          size: contentSize,
          contentType: this.detectContentType(content),
          encoding: 'utf-8',
          route: [sender.id]
        },
        timestamp: now,
        expiresAt: options.ttl ? new Date(now.getTime() + options.ttl) : undefined,
        priority: options.priority || 'normal',
        reliability: options.reliability || 'best-effort'
      };

      // Full message validation
      this.validateMessage(message);

      // Store message if persistence is enabled
      if (this.config.enablePersistence) {
        this.messageStore.set(messageId, message);
      }

      try {
        // Route and deliver message with timeout protection
        const deliveryTimeout = options.ttl || 30000; // 30 seconds default
        const deliveryPromise = this.routeMessage(message, options.channel);
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new DeliveryError('Message delivery timeout')), deliveryTimeout);
        });
        
        await Promise.race([deliveryPromise, timeoutPromise]);
      } catch (error) {
        // Handle delivery failure
        this.logger.error('Message delivery failed', { 
          messageId, 
          error: error instanceof Error ? error.message : String(error) 
        });
        
        if (message.reliability !== 'best-effort') {
          // Only throw for reliable delivery modes
          throw new DeliveryError(
            `Failed to deliver message: ${error instanceof Error ? error.message : String(error)}`, 
            { messageId }
          );
        }
      }

      this.metrics.recordMessageSent(message);

      this.logger.debug('Message sent', {
        messageId,
        type,
        sender: sender.id,
        receivers: receiversArray.map(r => r.id),
        size: message.metadata.size
      });

      this.emit('message:sent', { message });

      return messageId;
    } catch (error) {
      // Ensure all errors are properly logged and typed
      if (!(error instanceof MessageBusError)) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        error = new MessageBusError(
          `Unexpected error during message send: ${errorMessage}`,
          { cause: error }
        );
      }
      this.logger.error('Message send error', { 
        type, 
        sender: sender?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      throw error;
    }
  }

  async broadcastMessage(
    type: string,
    content: any,
    sender: AgentId,
    options: {
      channel?: string | undefined;
      filter?: MessageFilter | undefined;
      priority?: MessagePriority | undefined;
      ttl?: number | undefined;
    } = {}
  ): Promise<string> {
    const channel = options.channel ? 
      this.channels.get(options.channel) : 
      this.getDefaultBroadcastChannel();

    if (!channel) {
      throw new Error('No broadcast channel available');
    }

    // Get all participants as receivers
    let receivers = channel.participants.filter(p => p.id !== sender.id);

    // Apply filter if provided
    if (options.filter) {
      receivers = await this.filterReceivers(receivers, options.filter, { type, content });
    }

    return this.sendMessage(type, content, sender, receivers, {
      priority: options.priority,
      ttl: options.ttl,
      channel: channel.id
    });
  }

  async subscribeToTopic(
    topic: string,
    subscriber: AgentId,
    options: {
      filter?: MessageFilter;
      qos?: QualityOfService;
      ackRequired?: boolean;
    } = {}
  ): Promise<string> {
    const subscriptionId = generateId('sub');
    
    const subscription: TopicSubscription = {
      id: subscriptionId,
      topic,
      subscriber,
      filter: options.filter,
      ackRequired: options.ackRequired || false,
      qos: options.qos || 0,
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, subscription);

    this.logger.info('Topic subscription created', {
      subscriptionId,
      topic,
      subscriber: subscriber.id,
      qos: subscription.qos
    });

    this.emit('subscription:created', { subscription });

    return subscriptionId;
  }

  async unsubscribeFromTopic(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    this.subscriptions.delete(subscriptionId);

    this.logger.info('Topic subscription removed', {
      subscriptionId,
      topic: subscription.topic,
      subscriber: subscription.subscriber.id
    });

    this.emit('subscription:removed', { subscription });
  }

  async acknowledgeMessage(messageId: string, agentId: AgentId): Promise<void> {
    const message = this.messageStore.get(messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    const ack: MessageAcknowledgment = {
      messageId,
      agentId,
      timestamp: new Date(),
      status: 'acknowledged'
    };

    this.acknowledgments.set(`${messageId}:${agentId.id}`, ack);

    this.logger.debug('Message acknowledged', {
      messageId,
      agentId: agentId.id
    });

    // Check if all receivers have acknowledged
    this.checkAllAcknowledgments(message);
  }

  // === CHANNEL MANAGEMENT ===

  async createChannel(
    name: string,
    type: ChannelType,
    config: Partial<ChannelConfig> = {}
  ): Promise<string> {
    const channelId = generateId('channel');
    
    const channel: MessageChannel = {
      id: channelId,
      name,
      type,
      participants: [],
      config: {
        persistent: true,
        ordered: false,
        reliable: true,
        maxParticipants: 1000,
        maxMessageSize: this.config.maxMessageSize,
        maxQueueDepth: this.config.maxQueueSize,
        retentionPeriod: this.config.messageRetention,
        accessControl: {
          readPermission: 'participants',
          writePermission: 'participants',
          adminPermission: 'creator',
          allowedSenders: [],
          allowedReceivers: [],
          bannedAgents: []
        },
        ...config
      },
      statistics: this.createChannelStatistics(),
      filters: [],
      middleware: []
    };

    this.channels.set(channelId, channel);

    this.logger.info('Channel created', {
      channelId,
      name,
      type,
      config: channel.config
    });

    this.emit('channel:created', { channel });

    return channelId;
  }

  async joinChannel(channelId: string, agentId: AgentId): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    // Check access permissions
    if (!this.canJoinChannel(channel, agentId)) {
      throw new Error(`Agent ${agentId.id} not allowed to join channel ${channelId}`);
    }

    // Check capacity
    if (channel.participants.length >= channel.config.maxParticipants) {
      throw new Error(`Channel ${channelId} is at capacity`);
    }

    // Add participant if not already present
    if (!channel.participants.some(p => p.id === agentId.id)) {
      channel.participants.push(agentId);
      channel.statistics.participantCount = channel.participants.length;
    }

    this.logger.info('Agent joined channel', {
      channelId,
      agentId: agentId.id,
      participantCount: channel.participants.length
    });

    this.emit('channel:joined', { channelId, agentId });
  }

  async leaveChannel(channelId: string, agentId: AgentId): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    // Remove participant
    channel.participants = channel.participants.filter(p => p.id !== agentId.id);
    channel.statistics.participantCount = channel.participants.length;

    this.logger.info('Agent left channel', {
      channelId,
      agentId: agentId.id,
      participantCount: channel.participants.length
    });

    this.emit('channel:left', { channelId, agentId });
  }

  // === QUEUE MANAGEMENT ===

  async createQueue(
    name: string,
    type: QueueType,
    config: Partial<QueueConfig> = {}
  ): Promise<string> {
    const queueId = generateId('queue');
    
    const queue: MessageQueue = {
      id: queueId,
      name,
      type,
      messages: [],
      config: {
        maxSize: this.config.maxQueueSize,
        persistent: this.config.enablePersistence,
        ordered: this.config.enableOrdering,
        durability: 'memory',
        deliveryMode: 'at-least-once',
        retryPolicy: {
          maxAttempts: this.config.retryAttempts,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffMultiplier: this.config.backoffMultiplier,
          jitter: true
        },
        ...config
      },
      subscribers: [],
      statistics: this.createQueueStatistics()
    };

    this.queues.set(queueId, queue);

    this.logger.info('Queue created', {
      queueId,
      name,
      type,
      config: queue.config
    });

    this.emit('queue:created', { queue });

    return queueId;
  }

  async enqueueMessage(queueId: string, message: Message): Promise<void> {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Queue ${queueId} not found`);
    }

    // Check queue capacity
    if (queue.messages.length >= queue.config.maxSize) {
      if (queue.config.deadLetterQueue) {
        await this.sendToDeadLetterQueue(queue.config.deadLetterQueue, message, 'queue_full');
        return;
      } else {
        throw new Error(`Queue ${queueId} is full`);
      }
    }

    // Insert message based on queue type
    this.insertMessageInQueue(queue, message);

    queue.statistics.depth = queue.messages.length;
    queue.statistics.enqueueRate++;

    this.logger.debug('Message enqueued', {
      queueId,
      messageId: message.id,
      queueDepth: queue.messages.length
    });

    this.emit('message:enqueued', { queueId, message });

    // Process queue for delivery
    await this.processQueue(queue);
  }

  async dequeueMessage(queueId: string, subscriberId: string): Promise<Message | null> {
    const queue = this.queues.get(queueId);
    if (!queue) {
      throw new Error(`Queue ${queueId} not found`);
    }

    const subscriber = queue.subscribers.find(s => s.id === subscriberId);
    if (!subscriber) {
      throw new Error(`Subscriber ${subscriberId} not found in queue ${queueId}`);
    }

    // Find next eligible message
    let message: Message | null = null;
    let messageIndex = -1;

    for (let i = 0; i < queue.messages.length; i++) {
      const msg = queue.messages[i];
      
      // Check if message matches subscriber filter
      if (subscriber.filter && !this.matchesFilter(msg, subscriber.filter)) {
        continue;
      }

      message = msg;
      messageIndex = i;
      break;
    }

    if (!message) {
      return null;
    }

    // Remove message from queue (for at-least-once, remove after ack)
    if (queue.config.deliveryMode === 'at-most-once') {
      queue.messages.splice(messageIndex, 1);
    }

    queue.statistics.depth = queue.messages.length;
    queue.statistics.dequeueRate++;
    subscriber.lastActivity = new Date();

    this.logger.debug('Message dequeued', {
      queueId,
      messageId: message.id,
      subscriberId,
      queueDepth: queue.messages.length
    });

    this.emit('message:dequeued', { queueId, message, subscriberId });

    return message;
  }

  // === ROUTING AND DELIVERY ===

  /**
   * Routes a message according to configured routing rules
   * @param message The message to route
   * @param preferredChannel Optional preferred channel for routing
   * @throws DeliveryError if routing fails
   */
  private async routeMessage(message: Message, preferredChannel?: string): Promise<void> {
    try {
      // Apply routing rules with error handling
      let route;
      try {
        route = await this.router.calculateRoute(message, preferredChannel);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new DeliveryError(
          `Route calculation failed: ${errorMessage}`,
          { messageId: message.id, preferredChannel }
        );
      }
      // Update message route with full history for traceability
      message.metadata.route = [...(message.metadata.route || []), ...route.hops];

      // Track delivery attempts and failures
      let deliveryAttempts = 0;
      let deliveryFailures = 0;
      const deliveryErrors: Record<string, string> = {};

      // Deliver to all targets with individual error handling
      const deliveryPromises = route.targets.map(async (target) => {
        try {
          deliveryAttempts++;
          await this.deliverMessage(message, target);
        } catch (error) {
          deliveryFailures++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          deliveryErrors[target.id] = errorMessage;
          
          // Log individual delivery failure
          this.logger.warn(`Failed to deliver message to target ${target.id}`, { 
            messageId: message.id, 
            targetType: target.type,
            error: error instanceof Error ? error.message : String(error)
          });
          
          // For exactly-once delivery, propagate the error
          if (message.reliability === 'exactly-once') {
            throw error;
          }
          // For at-least-once, let the retry system handle it
        }
      });

      // Wait for all deliveries to complete
      await Promise.all(deliveryPromises);
      
      // If all deliveries failed, throw an error
      if (deliveryFailures > 0 && deliveryFailures === deliveryAttempts) {
        throw new DeliveryError(
          `Failed to deliver message to any target`, 
          { messageId: message.id, errors: deliveryErrors }
        );
      }
      
      // Partial delivery - log a warning
      if (deliveryFailures > 0) {
        this.logger.warn('Partial message delivery', { 
          messageId: message.id,
          attempts: deliveryAttempts,
          failures: deliveryFailures, 
          errors: deliveryErrors
        });
      }
    } catch (error) {
      // Ensure we always return typed errors
      if (!(error instanceof DeliveryError)) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        error = new DeliveryError(
          `Message routing error: ${errorMessage}`, 
          { messageId: message.id }
        );
      }
      this.logger.error('Message routing failed', {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      throw error;
    }
  }

  /**
   * Delivers a message to a specific target with enhanced error handling
   * @param message The message to deliver
   * @param target The delivery target
   * @throws DeliveryError if delivery fails and should not be retried
   */
  private async deliverMessage(message: Message, target: DeliveryTarget): Promise<void> {
    const deliveryTimeout = message.metadata.ttl ? 
      Math.min(message.metadata.ttl, 30000) : 30000; // Max 30s timeout
    
    try {
      // Use timeout to prevent hanging deliveries
      const deliveryPromise = this.deliveryManager.deliver(message, target);
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new DeliveryError('Delivery timeout')), deliveryTimeout);
      });
      
      await Promise.race([deliveryPromise, timeoutPromise]);
      this.metrics.recordDeliverySuccess(message);
      
      this.logger.debug('Message delivered successfully', {
        messageId: message.id,
        targetId: target.id,
        targetType: target.type
      });
    } catch (error) {
      this.metrics.recordDeliveryFailure(message);
      
      // Enhance error with delivery context
      const deliveryError = new DeliveryError(
        `Delivery to ${target.type}:${target.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          messageId: message.id,
          targetId: target.id,
          targetType: target.type,
          originalError: error instanceof Error ? error.message : String(error)
        }
      );
      
      this.logger.error('Message delivery failed', {
        messageId: message.id,
        target: target.id,
        type: target.type,
        error: deliveryError.message
      });
      
      // Handle delivery failure based on reliability level
      if (message.reliability !== 'best-effort') {
        try {
          await this.retryManager.scheduleRetry(message, target, deliveryError);
        } catch (retryError) {
          this.logger.error('Failed to schedule retry', { 
            messageId: message.id, 
            error: retryError instanceof Error ? retryError.message : String(retryError) 
          });
          // Let the error propagate up for handling at higher level
          throw deliveryError;
        }
      } else {
        // For best-effort, log but don't throw
        this.logger.debug('Best-effort delivery failed, no retry scheduled', { 
          messageId: message.id, 
          targetId: target.id 
        });
      }
      
      // Only propagate errors for exactly-once reliability
      if (message.reliability === 'exactly-once') {
        throw deliveryError;
      }
    }
  }

  // === UTILITY METHODS ===

  /**
   * Validates a message before processing
   * @throws MessageValidationError if the message is invalid
   */
  private validateMessage(message: Message): void {
    // Track validation issues for comprehensive error reporting
    const validationErrors: string[] = [];
    
    // Check message size
    if (message.metadata.size > this.config.maxMessageSize) {
      validationErrors.push(
        `Message size ${message.metadata.size} exceeds limit ${this.config.maxMessageSize}`
      );
    }

    // Check expiration
    if (message.expiresAt && message.expiresAt <= new Date()) {
      validationErrors.push('Message has already expired');
    }

    // Check receivers
    if (!message.receivers || message.receivers.length === 0) {
      validationErrors.push('Message must have at least one receiver');
    } else {
      // Validate each receiver ID
      const invalidReceivers = message.receivers.filter(r => !r || !r.id);
      if (invalidReceivers.length > 0) {
        validationErrors.push('Message contains invalid receivers');
      }
    }
    
    // Check sender
    if (!message.sender || !message.sender.id) {
      validationErrors.push('Message must have a valid sender');
    }
    
    // Check message type
    if (!message.type || typeof message.type !== 'string') {
      validationErrors.push('Message must have a valid type');
    }
    
    // If any validation errors, throw a comprehensive error
    if (validationErrors.length > 0) {
      throw new MessageValidationError(
        `Message validation failed: ${validationErrors.join('; ')}`, 
        { messageId: message.id }
      );
    }
  }

  private async processContent(content: any): Promise<any> {
    let processed = content;

    // Compress if enabled
    if (this.config.compressionEnabled) {
      processed = await this.compress(processed);
    }

    // Encrypt if enabled
    if (this.config.encryptionEnabled) {
      processed = await this.encrypt(processed);
    }

    return processed;
  }

  private calculateSize(content: any): number {
    return JSON.stringify(content).length;
  }

  private detectContentType(content: any): string {
    if (typeof content === 'string') return 'text/plain';
    if (typeof content === 'object') return 'application/json';
    if (Buffer.isBuffer(content)) return 'application/octet-stream';
    return 'application/unknown';
  }

  private async filterReceivers(
    receivers: AgentId[],
    filter: MessageFilter,
    context: any
  ): Promise<AgentId[]> {
    // Implement receiver filtering logic
    if (!filter || !filter.enabled) {
      return receivers;
    }

    return receivers.filter(receiver => {
      return filter.conditions.every(condition => {
        const fieldValue = this.getFieldValue(receiver, condition.field);
        return this.evaluateCondition(fieldValue, condition.operator, condition.value);
      });
    });
  }

  private canJoinChannel(channel: MessageChannel, agentId: AgentId): boolean {
    const acl = channel.config.accessControl;
    
    // Check banned list
    if (acl.bannedAgents.some(banned => banned.id === agentId.id)) {
      return false;
    }

    // Check allowed list (if specified)
    if (acl.allowedSenders.length > 0) {
      return acl.allowedSenders.some(allowed => allowed.id === agentId.id);
    }

    return true;
  }

  private matchesFilter(message: Message, filter: MessageFilter): boolean {
    return filter.conditions.every(condition => {
      const fieldValue = this.getFieldValue(message, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  private getFieldValue(obj: any, field: string): any {
    const parts = field.split('.');
    let value: any = obj;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  private evaluateCondition(fieldValue: any, operator: string, compareValue: any): boolean {
    switch (operator) {
      case 'eq': return fieldValue === compareValue;
      case 'ne': return fieldValue !== compareValue;
      case 'gt': return fieldValue > compareValue;
      case 'lt': return fieldValue < compareValue;
      case 'contains': return String(fieldValue).includes(String(compareValue));
      case 'matches': return new RegExp(compareValue).test(String(fieldValue));
      case 'in': return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      default: return false;
    }
  }

  private insertMessageInQueue(queue: MessageQueue, message: Message): void {
    switch (queue.type) {
      case 'fifo':
        queue.messages.push(message);
        break;
      case 'lifo':
        queue.messages.unshift(message);
        break;
      case 'priority':
        this.insertByPriority(queue.messages, message);
        break;
      case 'delay':
        this.insertByTimestamp(queue.messages, message);
        break;
      default:
        queue.messages.push(message);
    }
  }

  private insertByPriority(messages: Message[], message: Message): void {
    const priorityOrder = { 'critical': 0, 'high': 1, 'normal': 2, 'low': 3 };
    const messagePriority = priorityOrder[message.priority];
    
    let insertIndex = messages.length;
    for (let i = 0; i < messages.length; i++) {
      const currentPriority = priorityOrder[messages[i].priority];
      if (messagePriority < currentPriority) {
        insertIndex = i;
        break;
      }
    }
    
    messages.splice(insertIndex, 0, message);
  }

  private insertByTimestamp(messages: Message[], message: Message): void {
    const targetTime = message.expiresAt || message.timestamp;
    
    let insertIndex = messages.length;
    for (let i = 0; i < messages.length; i++) {
      const currentTime = messages[i].expiresAt || messages[i].timestamp;
      if (targetTime <= currentTime) {
        insertIndex = i;
        break;
      }
    }
    
    messages.splice(insertIndex, 0, message);
  }

  private async processQueue(queue: MessageQueue): Promise<void> {
    // Process messages for subscribers
    for (const subscriber of queue.subscribers) {
      if (subscriber.prefetchCount > 0) {
        // Deliver up to prefetch count
        for (let i = 0; i < subscriber.prefetchCount; i++) {
          const message = await this.dequeueMessage(queue.id, subscriber.id);
          if (!message) break;
          
          await this.deliverMessageToSubscriber(message, subscriber);
        }
      }
    }
  }

  private async deliverMessageToSubscriber(message: Message, subscriber: QueueSubscriber): Promise<void> {
    try {
      // Deliver message to subscriber
      this.emit('message:delivered', {
        message,
        subscriber: subscriber.agent
      });

      // Handle acknowledgment if required
      if (subscriber.ackMode === 'auto') {
        await this.acknowledgeMessage(message.id, subscriber.agent);
      }

    } catch (error) {
      this.logger.error('Failed to deliver message to subscriber', {
        messageId: message.id,
        subscriberId: subscriber.id,
        error
      });
    }
  }

  private checkAllAcknowledgments(message: Message): void {
    const requiredAcks = message.receivers.length;
    const receivedAcks = message.receivers.filter(receiver =>
      this.acknowledgments.has(`${message.id}:${receiver.id}`)
    ).length;

    if (receivedAcks === requiredAcks) {
      this.emit('message:fully-acknowledged', { message });
      
      // Clean up acknowledgments
      message.receivers.forEach(receiver => {
        this.acknowledgments.delete(`${message.id}:${receiver.id}`);
      });
    }
  }

  private async createDefaultChannels(): Promise<void> {
    // System broadcast channel
    await this.createChannel('system-broadcast', 'broadcast', {
      persistent: true,
      reliable: true,
      maxParticipants: 10000
    });

    // Agent coordination channel
    await this.createChannel('agent-coordination', 'multicast', {
      persistent: true,
      reliable: true,
      ordered: true
    });

    // Task distribution channel
    await this.createChannel('task-distribution', 'topic', {
      persistent: true,
      reliable: false
    });
  }

  private getDefaultBroadcastChannel(): MessageChannel | undefined {
    return Array.from(this.channels.values())
      .find(channel => channel.type === 'broadcast');
  }

  private createChannelStatistics(): ChannelStatistics {
    return {
      messagesTotal: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      bytesTransferred: 0,
      averageLatency: 0,
      throughput: 0,
      errorRate: 0,
      participantCount: 0,
      lastActivity: new Date()
    };
  }

  private createQueueStatistics(): QueueStatistics {
    return {
      depth: 0,
      enqueueRate: 0,
      dequeueRate: 0,
      throughput: 0,
      averageWaitTime: 0,
      subscriberCount: 0,
      deadLetterCount: 0
    };
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 10000); // Every 10 seconds
  }

  private updateMetrics(): void {
    // Update channel statistics
    for (const channel of this.channels.values()) {
      // Calculate throughput, latency, etc.
      this.updateChannelStatistics(channel);
    }

    // Update queue statistics
    for (const queue of this.queues.values()) {
      this.updateQueueStatistics(queue);
    }

    // Emit metrics event
    this.emit('metrics:updated', { metrics: this.getMetrics() });
  }

  private updateChannelStatistics(channel: MessageChannel): void {
    // Calculate real-time statistics
    const now = new Date();
    channel.statistics.lastActivity = now;
    
    // Calculate throughput (messages per second over last minute)
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentMessages = Array.from(this.messageStore.values())
      .filter(msg => msg.timestamp >= oneMinuteAgo && 
                    msg.receivers.some(r => channel.participants.some(p => p.id === r.id)));
    
    channel.statistics.throughput = recentMessages.length / 60; // messages per second
    
    // Calculate average latency from delivery receipts
    const channelReceipts = Array.from(this.deliveryReceipts.values())
      .filter(receipt => receipt.target === channel.id);
    
    if (channelReceipts.length > 0) {
      const latencies = channelReceipts.map(receipt => 
        receipt.timestamp.getTime() - new Date(receipt.timestamp).getTime()
      );
      channel.statistics.averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    }
    
    // Calculate error rate
    const failedDeliveries = channelReceipts.filter(r => r.status === 'failed').length;
    channel.statistics.errorRate = channelReceipts.length > 0 ? 
      (failedDeliveries / channelReceipts.length) * 100 : 0;
    
    // Update message counts
    channel.statistics.messagesTotal = Array.from(this.messageStore.values())
      .filter(msg => msg.receivers.some(r => channel.participants.some(p => p.id === r.id)))
      .length;
    
    // Calculate bytes transferred
    const channelMessages = Array.from(this.messageStore.values())
      .filter(msg => msg.receivers.some(r => channel.participants.some(p => p.id === r.id)));
    
    channel.statistics.bytesTransferred = channelMessages.reduce((total, msg) => total + msg.metadata.size, 0);
    
    // Update participant count
    channel.statistics.participantCount = channel.participants.length;
  }

  private updateQueueStatistics(queue: MessageQueue): void {
    // Calculate real-time queue statistics
    const now = new Date();
    queue.statistics.depth = queue.messages.length;
    
    // Calculate enqueue/dequeue rates (per minute)
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentMessages = Array.from(this.messageStore.values())
      .filter(msg => msg.timestamp >= oneMinuteAgo);
    
    queue.statistics.enqueueRate = recentMessages.length / 60;
    
    // Calculate average wait time
    const processedMessages = recentMessages.filter(msg => msg.metadata.route && msg.metadata.route.length > 1);
    if (processedMessages.length > 0) {
      const waitTimes = processedMessages.map(msg => {
        const queueTime = new Date(msg.timestamp).getTime();
        const processTime = Date.now(); // Approximation
        return processTime - queueTime;
      });
      queue.statistics.averageWaitTime = waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length;
    }
    
    // Calculate throughput
    queue.statistics.throughput = queue.statistics.enqueueRate;
    queue.statistics.subscriberCount = queue.subscribers.length;
  }

  private handleAgentConnected(agentId: AgentId): void {
    this.logger.info('Agent connected to message bus', { agentId: agentId.id });
    this.emit('agent:connected', { agentId });
  }

  private handleAgentDisconnected(agentId: AgentId): void {
    this.logger.info('Agent disconnected from message bus', { agentId: agentId.id });
    
    // Remove from all channels
    for (const channel of this.channels.values()) {
      channel.participants = channel.participants.filter(p => p.id !== agentId.id);
    }

    // Remove subscriptions
    for (const [subId, subscription] of this.subscriptions) {
      if (subscription.subscriber.id === agentId.id) {
        this.subscriptions.delete(subId);
      }
    }

    this.emit('agent:disconnected', { agentId });
  }

  private handleDeliverySuccess(data: any): void {
    this.metrics.recordDeliverySuccess(data.message);
  }

  private handleDeliveryFailure(data: any): void {
    this.metrics.recordDeliveryFailure(data.message);
  }

  private handleRetryExhausted(data: any): void {
    this.logger.error('Message delivery retry exhausted', {
      messageId: data.message.id,
      target: data.target
    });

    // Send to dead letter queue if configured
    this.sendToDeadLetterQueue('system-dlq', data.message, 'retry_exhausted');
  }

  private async sendToDeadLetterQueue(queueId: string, message: Message, reason: string): Promise<void> {
    try {
      message.metadata.deadLetterReason = reason;
      message.metadata.deadLetterTimestamp = new Date();
      
      await this.enqueueMessage(queueId, message);
      
    } catch (error) {
      this.logger.error('Error processing dead letter queue:', (error as Error).message);
    }
  }

  private async compress(content: any): Promise<any> {
    if (!this.config.compressionEnabled) {
      return content;
    }
    
    try {
      const zlib = await import('node:zlib');
      const jsonString = JSON.stringify(content);
      const buffer = Buffer.from(jsonString, 'utf-8');
      
      // Use gzip compression
      const compressed = await new Promise<Buffer>((resolve, reject) => {
        zlib.gzip(buffer, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      const compressionRatio = compressed.length / buffer.length;
      
      this.logger.debug('Content compressed', {
        originalSize: buffer.length,
        compressedSize: compressed.length,
        ratio: compressionRatio
      });
      
      return {
        __compressed: true,
        __originalSize: buffer.length,
        __compressedSize: compressed.length,
        __compressionRatio: compressionRatio,
        __algorithm: 'gzip',
        data: compressed.toString('base64')
      };
    } catch (error) {
      this.logger.warn('Compression failed, using original content', error);
      return content;
    }
  }

  private async encrypt(content: any): Promise<any> {
    if (!this.config.encryptionEnabled) {
      return content;
    }
    
    try {
      const crypto = await import('node:crypto');
      const jsonString = JSON.stringify(content);
      
      // Generate encryption key and IV
      const algorithm = 'aes-256-gcm';
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      // Encrypt the content
      const cipher = crypto.createCipher(algorithm, key);
      let encrypted = cipher.update(jsonString, 'utf-8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag for GCM mode
      const authTag = cipher.getAuthTag ? cipher.getAuthTag() : Buffer.alloc(0);
      
      this.logger.debug('Content encrypted', {
        algorithm,
        originalSize: jsonString.length,
        encryptedSize: encrypted.length
      });
      
      return {
        __encrypted: true,
        __algorithm: algorithm,
        __timestamp: Date.now(),
        __keyId: crypto.createHash('sha256').update(key).digest('hex').substring(0, 16),
        __iv: iv.toString('hex'),
        __authTag: authTag.toString('hex'),
        data: encrypted
      };
    } catch (error) {
      this.logger.warn('Encryption failed, using original content', error);
      return content;
    }
  }

  private async persistMessages(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }
    
    try {
      const fs = await import('node:fs/promises');
      const { join } = await import('node:path');
      
      const messages = Array.from(this.messageStore.values());
      const persistenceData = {
        timestamp: Date.now(),
        version: '1.0.0',
        messageCount: messages.length,
        channels: Array.from(this.channels.values()).map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          participantCount: channel.participants.length,
          statistics: channel.statistics
        })),
        queues: Array.from(this.queues.values()).map(queue => ({
          id: queue.id,
          name: queue.name,
          type: queue.type,
          depth: queue.messages.length,
          statistics: queue.statistics
        })),
        messages: messages.map(msg => ({
          id: msg.id,
          type: msg.type,
          sender: msg.sender,
          receivers: msg.receivers,
          timestamp: msg.timestamp,
          priority: msg.priority,
          reliability: msg.reliability,
          metadata: {
            ...msg.metadata,
            // Don't persist actual content for security
            contentSize: msg.metadata.size,
            contentType: msg.metadata.contentType
          }
        }))
      };
      
      // Create persistence directory if it doesn't exist
      const persistenceDir = join(process.cwd(), '.flowx', 'message-bus');
      await fs.mkdir(persistenceDir, { recursive: true });
      
      // Write persistence data to file
      const filename = `messages-${Date.now()}.json`;
      const filepath = join(persistenceDir, filename);
      await fs.writeFile(filepath, JSON.stringify(persistenceData, null, 2));
      
      // Clean up old persistence files (keep last 10)
      const files = await fs.readdir(persistenceDir);
      const messageFiles = files.filter(f => f.startsWith('messages-') && f.endsWith('.json'))
        .sort().reverse();
      
      if (messageFiles.length > 10) {
        const filesToDelete = messageFiles.slice(10);
        for (const file of filesToDelete) {
          await fs.unlink(join(persistenceDir, file));
        }
      }
      
      this.logger.info('Messages persisted successfully', { 
        count: messages.length,
        totalSize: JSON.stringify(persistenceData).length,
        filepath: filename
      });
      
    } catch (error) {
      this.logger.error('Failed to persist messages', { error });
    }
  }

  // === PUBLIC API ===

  getChannel(channelId: string): MessageChannel | undefined {
    return this.channels.get(channelId);
  }

  getAllChannels(): MessageChannel[] {
    return Array.from(this.channels.values());
  }

  getQueue(queueId: string): MessageQueue | undefined {
    return this.queues.get(queueId);
  }

  getAllQueues(): MessageQueue[] {
    return Array.from(this.queues.values());
  }

  getSubscription(subscriptionId: string): TopicSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  getAllSubscriptions(): TopicSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  getMetrics(): any {
    return {
      channels: this.channels.size,
      queues: this.queues.size,
      subscriptions: this.subscriptions.size,
      storedMessages: this.messageStore.size,
      deliveryReceipts: this.deliveryReceipts.size,
      acknowledgments: this.acknowledgments.size,
      busMetrics: this.metrics.getMetrics()
    };
  }

  getMessage(messageId: string): Message | undefined {
    return this.messageStore.get(messageId);
  }

  async addChannelFilter(channelId: string, filter: MessageFilter): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    channel.filters.push(filter);
    channel.filters.sort((a, b) => a.priority - b.priority);
  }

  async addChannelMiddleware(channelId: string, middleware: ChannelMiddleware): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    channel.middleware.push(middleware);
    channel.middleware.sort((a, b) => a.order - b.order);
  }
}

// === HELPER CLASSES ===

interface DeliveryReceipt {
  messageId: string;
  target: string;
  status: 'delivered' | 'failed' | 'pending';
  timestamp: Date;
  attempts: number;
  error?: string;
}

interface MessageAcknowledgment {
  messageId: string;
  agentId: AgentId;
  timestamp: Date;
  status: 'acknowledged' | 'rejected';
}

interface DeliveryTarget {
  type: 'agent' | 'channel' | 'queue' | 'topic';
  id: string;
  address?: string;
}

interface RouteResult {
  targets: DeliveryTarget[];
  hops: string[];
  cost: number;
}

class MessageRouter {
  private config: MessageBusConfig;
  private logger: ILogger;
  private routingRules: Map<string, RoutingRule>;
  private topicSubscriptions: Map<string, TopicSubscription[]>;
  private channels: Map<string, MessageChannel>;
  private queues: Map<string, MessageQueue>;
  // Cache for frequently used routes
  private routeCache: Map<string, {route: RouteResult, timestamp: number}>;
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache expiration

  constructor(config: MessageBusConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.routingRules = new Map<string, RoutingRule>();
    this.topicSubscriptions = new Map<string, TopicSubscription[]>();
    this.channels = new Map<string, MessageChannel>();
    this.queues = new Map<string, MessageQueue>();
    this.routeCache = new Map();
  }

  async initialize(): Promise<void> {
    this.logger.debug('Message router initializing...');
    // Load any persisted routing rules
    await this.loadRoutingRules();
    this.logger.info('Message router initialized', { 
      ruleCount: this.routingRules.size,
      subscriptionCount: Array.from(this.topicSubscriptions.values()).reduce((sum, subs) => sum + subs.length, 0)
    });
  }

  async shutdown(): Promise<void> {
    this.logger.debug('Message router shutting down...');
    // Persist routing rules if needed
    await this.persistRoutingRules();
    // Clear caches and state
    this.routeCache.clear();
    this.logger.info('Message router shutdown');
  }

  /**
   * Calculate the optimal route for a message based on message attributes,
   * network topology, and routing rules.
   */
  async calculateRoute(message: Message, preferredChannel?: string): Promise<RouteResult> {
    // Check cache first for identical routing scenarios
    const cacheKey = this.generateRouteCacheKey(message, preferredChannel);
    const cachedRoute = this.routeCache.get(cacheKey);
    
    if (cachedRoute && Date.now() - cachedRoute.timestamp < this.CACHE_TTL_MS) {
      return cachedRoute.route;
    }

    // Start with direct routing to receivers
    const targets: DeliveryTarget[] = [];
    const hops: string[] = [];
    let routeCost = 0;

    // Phase 1: Apply routing rules based on message content and type
    const applicableRules = this.getApplicableRules(message);
    
    if (applicableRules.length > 0) {
      // Sort rules by priority (highest first)
      applicableRules.sort((a, b) => b.priority - a.priority);
      
      // Apply the highest priority rule
      const topRule = applicableRules[0];
      
      if (topRule.enabled) {
        const routeResult = await this.applyRoutingRule(message, topRule);
        if (routeResult) {
          // Cache the result for future use
          this.routeCache.set(cacheKey, { 
            route: routeResult, 
            timestamp: Date.now() 
          });
          return routeResult;
        }
      }
    }

    // Phase 2: Route based on message type and destination
    
    // Handle topic-based routing for pub/sub patterns
    if (message.type.startsWith('topic.')) {
      const topicName = message.type.substring(6); // Remove 'topic.' prefix
      const subscribers = this.topicSubscriptions.get(topicName) || [];
      
      for (const subscription of subscribers) {
        // Skip if subscription is for the sender itself
        if (subscription.subscriber.id === message.sender.id) {
          continue;
        }
        
        // Apply subscriber filter if one exists
        if (subscription.filter && !this.matchesFilter(message, subscription.filter)) {
          continue;
        }
        
        targets.push({
          type: 'agent',
          id: subscription.subscriber.id
        });
        
        hops.push(`topic:${topicName}`);
        hops.push(subscription.subscriber.id);
        
        // Add cost based on QoS level
        routeCost += (subscription.qos + 1) * 5;
      }
      
      // If we have targets from topic subscriptions, return those
      if (targets.length > 0) {
        const result: RouteResult = { targets, hops, cost: routeCost };
        this.routeCache.set(cacheKey, { route: result, timestamp: Date.now() });
        return result;
      }
    }
    
    // Phase 3: Channel-based routing
    if (preferredChannel) {
      const channel = this.channels.get(preferredChannel);
      
      if (channel) {
        // For broadcast channels, deliver to all participants except sender
        if (channel.type === 'broadcast' || channel.type === 'multicast') {
          for (const participant of channel.participants) {
            if (participant.id !== message.sender.id) {
              targets.push({
                type: 'agent',
                id: participant.id
              });
            }
          }
          
          hops.push(`channel:${preferredChannel}`);
          routeCost += targets.length * 2;
          
          const result: RouteResult = { targets, hops, cost: routeCost };
          this.routeCache.set(cacheKey, { route: result, timestamp: Date.now() });
          return result;
        }
        
        // For topic channels, create multiple delivery targets
        if (channel.type === 'topic') {
          // Implementation for topic channels
          // This would include checking topic subscribers in the channel
        }
      }
    }

    // Phase 4: Direct routing (fallback)
    for (const receiver of message.receivers) {
      targets.push({
        type: 'agent',
        id: receiver.id
      });
      hops.push(`direct:${receiver.id}`);
      // Direct routing has higher cost than optimized routes
      routeCost += 10;
    }

    // If no targets found, check if message should be queued
    if (targets.length === 0 && message.reliability !== 'best-effort') {
      // Try to find an appropriate queue based on message type
      const queueName = `queue.${message.type.replace(/\./g, '-')}`;
      const queue = this.findOrCreateQueue(queueName);
      
      if (queue) {
        targets.push({
          type: 'queue',
          id: queue.id
        });
        
        hops.push(`queue:${queue.id}`);
        routeCost += 5;
      }
    }

    // Cache and return the final route
    const result: RouteResult = { targets, hops, cost: routeCost };
    this.routeCache.set(cacheKey, { route: result, timestamp: Date.now() });
    return result;
  }
  
  /**
   * Register a routing rule for messages
   */
  registerRoutingRule(rule: RoutingRule): void {
    this.routingRules.set(rule.id, rule);
    // Invalidate cache for rules
    this.routeCache.clear();
    this.logger.info('Registered routing rule', { ruleId: rule.id, name: rule.name });
  }
  
  /**
   * Add a channel to the router
   */
  addChannel(channel: MessageChannel): void {
    this.channels.set(channel.id, channel);
    this.logger.debug('Added channel to router', { channelId: channel.id, channelName: channel.name });
  }
  
  /**
   * Add a queue to the router
   */
  addQueue(queue: MessageQueue): void {
    this.queues.set(queue.id, queue);
    this.logger.debug('Added queue to router', { queueId: queue.id, queueName: queue.name });
  }
  
  /**
   * Register a topic subscription
   */
  addTopicSubscription(subscription: TopicSubscription): void {
    if (!this.topicSubscriptions.has(subscription.topic)) {
      this.topicSubscriptions.set(subscription.topic, []);
    }
    
    this.topicSubscriptions.get(subscription.topic)!.push(subscription);
    this.logger.debug('Added topic subscription', { 
      topic: subscription.topic,
      subscriberId: subscription.subscriber.id
    });
    
    // Invalidate any cached routes for this topic
    for (const [key, value] of this.routeCache.entries()) {
      if (key.includes(`topic.${subscription.topic}`)) {
        this.routeCache.delete(key);
      }
    }
  }
  
  /**
   * Remove a topic subscription
   */
  removeTopicSubscription(subscriptionId: string): void {
    for (const [topic, subscriptions] of this.topicSubscriptions.entries()) {
      const index = subscriptions.findIndex(sub => sub.id === subscriptionId);
      
      if (index >= 0) {
        const subscription = subscriptions[index];
        subscriptions.splice(index, 1);
        
        // Remove empty topic entries
        if (subscriptions.length === 0) {
          this.topicSubscriptions.delete(topic);
        }
        
        this.logger.debug('Removed topic subscription', { 
          topic,
          subscriberId: subscription.subscriber.id
        });
        
        // Invalidate cached routes
        for (const [key, value] of this.routeCache.entries()) {
          if (key.includes(`topic.${topic}`)) {
            this.routeCache.delete(key);
          }
        }
        
        return;
      }
    }
  }
  
  /**
   * Find or create a queue for a message type
   */
  private findOrCreateQueue(queueName: string): MessageQueue | undefined {
    // Look for existing queue with this name
    for (const [id, queue] of this.queues.entries()) {
      if (queue.name === queueName) {
        return queue;
      }
    }
    
    // In production, we'd create a queue automatically here
    return undefined;
  }
  
  /**
   * Get routing rules applicable to this message
   */
  private getApplicableRules(message: Message): RoutingRule[] {
    return Array.from(this.routingRules.values())
      .filter(rule => this.ruleAppliesToMessage(rule, message));
  }
  
  /**
   * Check if a rule applies to a message
   */
  private ruleAppliesToMessage(rule: RoutingRule, message: Message): boolean {
    // A rule applies if all its conditions match
    return rule.conditions.every(condition => {
      const value = this.getFieldValue(message, condition.field);
      return this.evaluateCondition(value, condition.operator, condition.value);
    });
  }
  
  /**
   * Apply a routing rule to a message
   */
  private async applyRoutingRule(message: Message, rule: RoutingRule): Promise<RouteResult | undefined> {
    const targets: DeliveryTarget[] = [];
    const hops: string[] = [];
    let cost = 0;
    
    // Apply each action in the rule
    for (const action of rule.actions) {
      switch (action.type) {
        case 'forward':
          if (action.target) {
            const [targetType, targetId] = action.target.split(':');
            
            targets.push({
              type: targetType as 'agent' | 'channel' | 'queue' | 'topic',
              id: targetId
            });
            
            hops.push(`rule:${rule.id}:${action.type}:${action.target}`);
            cost += 5;
          }
          break;
          
        case 'duplicate':
          if (action.target) {
            const [targetType, targetId] = action.target.split(':');
            
            targets.push({
              type: targetType as 'agent' | 'channel' | 'queue' | 'topic',
              id: targetId
            });
            
            hops.push(`rule:${rule.id}:${action.type}:${action.target}`);
            cost += 8; // Duplication is more expensive
          }
          break;
          
        // Other action types would be implemented here
      }
    }
    
    if (targets.length > 0) {
      return { targets, hops, cost };
    }
    
    return undefined;
  }
  
  /**
   * Get a field value from an object using dot notation
   */
  private getFieldValue(obj: any, field: string): any {
    const parts = field.split('.');
    let value: any = obj;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }
  
  /**
   * Check if a message matches a filter
   */
  private matchesFilter(message: Message, filter: MessageFilter): boolean {
    if (!filter.enabled) {
      return true; // Disabled filters always match
    }
    
    return filter.conditions.every(condition => {
      const value = this.getFieldValue(message, condition.field);
      return this.evaluateCondition(value, condition.operator, condition.value);
    });
  }
  
  /**
   * Evaluate a filter condition
   */
  private evaluateCondition(fieldValue: any, operator: string, compareValue: any): boolean {
    switch (operator) {
      case 'eq': return fieldValue === compareValue;
      case 'ne': return fieldValue !== compareValue;
      case 'gt': return fieldValue > compareValue;
      case 'lt': return fieldValue < compareValue;
      case 'contains': return String(fieldValue).includes(String(compareValue));
      case 'matches': return new RegExp(compareValue).test(String(fieldValue));
      case 'in': return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      default: return false;
    }
  }
  
  /**
   * Generate a cache key for route lookup
   */
  private generateRouteCacheKey(message: Message, preferredChannel?: string): string {
    return `${message.type}:${message.sender.id}:${message.receivers.map(r => r.id).join(',')}:${preferredChannel || ''}`;
  }
  
  /**
   * Load routing rules from persistence
   */
  private async loadRoutingRules(): Promise<void> {
    // In a real implementation, this would load from a database or config file
    try {
      // For now, add some default routing rules
      this.registerRoutingRule({
        id: 'system-broadcast',
        name: 'System Broadcast',
        enabled: true,
        priority: 100,
        conditions: [{
          field: 'type',
          operator: 'eq',
          value: 'system.broadcast'
        }],
        actions: [{
          type: 'forward',
          target: 'channel:system-broadcast',
          config: {}
        }]
      });
      
      // Rule for error events
      this.registerRoutingRule({
        id: 'error-handling',
        name: 'Error Events',
        enabled: true,
        priority: 90,
        conditions: [{
          field: 'type',
          operator: 'contains',
          value: 'error'
        }],
        actions: [{
          type: 'forward',
          target: 'channel:error-events',
          config: {}
        }]
      });
      
    } catch (error) {
      this.logger.error('Failed to load routing rules', error);
    }
  }
  
  /**
   * Persist routing rules if needed
   */
  private async persistRoutingRules(): Promise<void> {
    // In a real implementation, this would save to a database or config file
    // No-op for now
  }
}

interface DeliveryOptions {
  timeout?: number;
  retry?: boolean;
  acknowledgment?: boolean;
  encryption?: boolean;
}

interface DeliveryAttempt {
  messageId: string;
  targetId: string;
  timestamp: Date;
  success: boolean;
  latency: number;
  error?: string;
}

class DeliveryManager extends EventEmitter {
  private config: MessageBusConfig;
  private logger: ILogger;
  private agentConnections: Map<string, AgentConnection>;
  private channelDeliveryHandlers: Map<string, ChannelDeliveryHandler>;
  private queueDeliveryHandlers: Map<string, QueueDeliveryHandler>;
  private deliveryStatistics: {
    attempts: number;
    successes: number;
    failures: number;
    totalLatency: number;
    maxLatency: number;
  };
  private deliveryHistory: DeliveryAttempt[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;

  constructor(config: MessageBusConfig, logger: ILogger) {
    super();
    this.config = config;
    this.logger = logger;
    this.agentConnections = new Map();
    this.channelDeliveryHandlers = new Map();
    this.queueDeliveryHandlers = new Map();
    this.deliveryStatistics = {
      attempts: 0,
      successes: 0,
      failures: 0,
      totalLatency: 0,
      maxLatency: 0
    };
  }

  async initialize(): Promise<void> {
    this.logger.debug('Initializing delivery manager...');
    
    // Set up channel delivery handlers
    this.setupDefaultChannelHandlers();
    
    // Set up queue delivery handlers
    this.setupDefaultQueueHandlers();
    
    this.logger.info('Delivery manager initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.debug('Shutting down delivery manager...');
    
    // Close all active connections
    for (const [agentId, connection] of this.agentConnections.entries()) {
      try {
        await connection.close();
        this.logger.debug('Closed agent connection', { agentId });
      } catch (error) {
        this.logger.warn('Failed to close agent connection', { agentId, error });
      }
    }
    
    this.logger.info('Delivery manager shutdown complete');
  }

  /**
   * Deliver a message to a target
   * @param message The message to deliver
   * @param target The target to deliver to
   * @param options Delivery options
   * @returns Promise that resolves when delivery is complete
   * @throws DeliveryError if delivery fails
   */
  async deliver(
    message: Message,
    target: DeliveryTarget,
    options: DeliveryOptions = {}
  ): Promise<void> {
    const startTime = Date.now();
    this.deliveryStatistics.attempts++;
    let success = false;
    let error: Error | undefined;
    
    try {
      this.logger.debug('Delivering message', {
        messageId: message.id,
        targetId: target.id,
        targetType: target.type
      });
      
      // Apply delivery options
      const deliveryTimeout = options.timeout || this.config.acknowledgmentTimeout;
      const encryptMessage = options.encryption ?? this.config.encryptionEnabled;
      
      // Encrypt if needed
      let deliveryContent = message.content;
      if (encryptMessage) {
        deliveryContent = await this.encryptForDelivery(message.content, target);
      }
      
      // Choose delivery strategy based on target type
      switch (target.type) {
        case 'agent':
          await this.deliverToAgent(message, target.id, deliveryContent, deliveryTimeout);
          break;
          
        case 'channel':
          await this.deliverToChannel(message, target.id, deliveryContent, deliveryTimeout);
          break;
          
        case 'queue':
          await this.deliverToQueue(message, target.id, deliveryContent);
          break;
          
        case 'topic':
          await this.deliverToTopic(message, target.id, deliveryContent);
          break;
          
        default:
          throw new DeliveryError(
            `Unsupported delivery target type: ${target.type}`,
            { messageId: message.id, targetId: target.id }
          );
      }
      
      // Record delivery success
      success = true;
      const latency = Date.now() - startTime;
      
      // Update statistics
      this.deliveryStatistics.successes++;
      this.deliveryStatistics.totalLatency += latency;
      this.deliveryStatistics.maxLatency = Math.max(this.deliveryStatistics.maxLatency, latency);
      
      // Add to history
      this.recordDeliveryAttempt({
        messageId: message.id,
        targetId: target.id,
        timestamp: new Date(),
        success: true,
        latency
      });
      
      // Emit success event
      this.emit('delivery:success', { 
        message, 
        target,
        latency
      });
    } catch (err) {
      // Handle delivery failure
      error = err instanceof Error ? err : new Error(String(err));
      
      // Update statistics
      this.deliveryStatistics.failures++;
      
      // Add to history
      this.recordDeliveryAttempt({
        messageId: message.id,
        targetId: target.id,
        timestamp: new Date(),
        success: false,
        latency: Date.now() - startTime,
        error: error.message
      });
      
      // Emit failure event
      this.emit('delivery:failure', { 
        message, 
        target, 
        error,
        attempt: this.deliveryStatistics.attempts
      });
      
      // Rethrow as DeliveryError
      if (!(error instanceof DeliveryError)) {
        error = new DeliveryError(
          `Failed to deliver message to ${target.type}:${target.id}: ${error.message}`,
          { messageId: message.id, targetId: target.id, cause: error }
        );
      }
      
      throw error;
    }
  }

  /**
   * Delivers a message to an agent
   */
  private async deliverToAgent(
    message: Message,
    agentId: string,
    content: any,
    timeout: number
  ): Promise<void> {
    // Get or create agent connection
    let connection = this.agentConnections.get(agentId);
    
    if (!connection) {
      // Create a new connection to the agent
      connection = await this.createAgentConnection(agentId);
      this.agentConnections.set(agentId, connection);
    }
    
    // Check if agent is connected
    if (!connection.isConnected()) {
      try {
        await connection.connect();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new DeliveryError(
          `Failed to connect to agent ${agentId}: ${errorMessage}`, 
          { agentId, cause: error }
        );
      }
    }
    
    // Deliver with timeout
    try {
      // Create delivery promise
      const deliveryPromise = connection.sendMessage({
        id: message.id,
        type: message.type,
        sender: message.sender,
        content,
        timestamp: message.timestamp
      });
      
      // Create timeout promise
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Delivery timeout')), timeout);
      });
      
      // Race delivery against timeout
      await Promise.race([deliveryPromise, timeoutPromise]);
    } catch (error) {
      // Handle connection issues
      if (connection.shouldReconnect(error as Error)) {
        this.logger.debug('Agent connection issue, marking for reconnect', { agentId });
        connection.markForReconnect();
      }
      
      throw new DeliveryError(
        `Failed to deliver message to agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`,
        { agentId, cause: error }
      );
    }
  }

  /**
   * Delivers a message to a channel
   */
  private async deliverToChannel(
    message: Message,
    channelId: string,
    content: any,
    timeout: number
  ): Promise<void> {
    // Get channel delivery handler
    const handler = this.channelDeliveryHandlers.get(channelId);
    
    if (!handler) {
      throw new DeliveryError(
        `No delivery handler for channel ${channelId}`,
        { channelId }
      );
    }
    
    // Deliver with timeout
    try {
      // Create delivery promise
      const deliveryPromise = handler.deliverToChannel(message, content);
      
      // Create timeout promise
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Channel delivery timeout')), timeout);
      });
      
      // Race delivery against timeout
      await Promise.race([deliveryPromise, timeoutPromise]);
    } catch (error) {
      throw new DeliveryError(
        `Failed to deliver message to channel ${channelId}: ${error instanceof Error ? error.message : String(error)}`,
        { channelId, cause: error }
      );
    }
  }

  /**
   * Delivers a message to a queue
   */
  private async deliverToQueue(
    message: Message,
    queueId: string,
    content: any
  ): Promise<void> {
    // Get queue delivery handler
    const handler = this.queueDeliveryHandlers.get(queueId);
    
    if (!handler) {
      throw new DeliveryError(
        `No delivery handler for queue ${queueId}`,
        { queueId }
      );
    }
    
    try {
      await handler.enqueueMessage(message, content);
    } catch (error) {
      throw new DeliveryError(
        `Failed to deliver message to queue ${queueId}: ${error instanceof Error ? error.message : String(error)}`,
        { queueId, cause: error }
      );
    }
  }

  /**
   * Delivers a message to a topic
   */
  private async deliverToTopic(
    message: Message,
    topicId: string,
    content: any
  ): Promise<void> {
    // In a real implementation, this would use a pub-sub system
    // For now, we'll implement it as a specialized channel
    try {
      // Convert topic delivery to channel delivery
      const channelId = `topic-${topicId}`;
      
      // Create handler if it doesn't exist
      if (!this.channelDeliveryHandlers.has(channelId)) {
        this.createTopicChannelHandler(topicId);
      }
      
      await this.deliverToChannel(message, channelId, content, this.config.acknowledgmentTimeout);
    } catch (error) {
      throw new DeliveryError(
        `Failed to deliver message to topic ${topicId}: ${error instanceof Error ? error.message : String(error)}`,
        { topicId, cause: error }
      );
    }
  }

  /**
   * Create a connection to an agent
   */
  private async createAgentConnection(agentId: string): Promise<AgentConnection> {
    try {
      // In a real implementation, this would establish a connection to the agent
      // based on the agent's connection information
      
      // For now, create a simple in-memory connection
      const connection = new InMemoryAgentConnection(agentId, this.logger);
      
      // Add connection event listeners
      connection.on('connected', () => {
        this.logger.debug('Agent connected', { agentId });
        this.emit('agent:connected', { agentId });
      });
      
      connection.on('disconnected', () => {
        this.logger.debug('Agent disconnected', { agentId });
        this.emit('agent:disconnected', { agentId });
      });
      
      connection.on('message', (message) => {
        this.logger.debug('Message from agent', { agentId, messageId: message.id });
        this.emit('agent:message', { agentId, message });
      });
      
      // Connect immediately
      await connection.connect();
      
      return connection;
    } catch (error) {
      throw new DeliveryError(
        `Failed to create connection to agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`,
        { agentId, cause: error }
      );
    }
  }

  /**
   * Set up default channel delivery handlers
   */
  private setupDefaultChannelHandlers(): void {
    // Create handlers for default channels
    this.createChannelHandler('system-broadcast', 'broadcast');
    this.createChannelHandler('agent-coordination', 'multicast');
    this.createChannelHandler('task-distribution', 'topic');
    this.createChannelHandler('error-events', 'broadcast');
  }

  /**
   * Create a channel handler
   */
  private createChannelHandler(channelId: string, type: string): void {
    const handler = new InMemoryChannelHandler(channelId, type, this.logger);
    this.channelDeliveryHandlers.set(channelId, handler);
    this.logger.debug('Created channel handler', { channelId, type });
  }

  /**
   * Create a topic channel handler
   */
  private createTopicChannelHandler(topicId: string): void {
    const channelId = `topic-${topicId}`;
    const handler = new InMemoryChannelHandler(channelId, 'topic', this.logger);
    this.channelDeliveryHandlers.set(channelId, handler);
    this.logger.debug('Created topic channel handler', { topicId, channelId });
  }

  /**
   * Set up default queue delivery handlers
   */
  private setupDefaultQueueHandlers(): void {
    // Create handlers for default queues
    this.createQueueHandler('system-dlq', 'fifo');
    this.createQueueHandler('task-queue', 'priority');
    this.createQueueHandler('event-queue', 'fifo');
  }

  /**
   * Create a queue handler
   */
  private createQueueHandler(queueId: string, type: string): void {
    const handler = new InMemoryQueueHandler(queueId, type, this.logger);
    this.queueDeliveryHandlers.set(queueId, handler);
    this.logger.debug('Created queue handler', { queueId, type });
  }

  /**
   * Encrypt message content for delivery
   */
  private async encryptForDelivery(content: any, target: DeliveryTarget): Promise<any> {
    try {
      // In a real implementation, this would use encryption based on target's keys
      // For now, we just mark it as encrypted
      return {
        __encrypted: true,
        __timestamp: Date.now(),
        __target: target.id,
        __type: target.type,
        data: typeof content === 'string' ? content : JSON.stringify(content)
      };
    } catch (error) {
      this.logger.warn('Failed to encrypt content for delivery', {
        targetId: target.id,
        error
      });
      // Return original content on encryption failure
      return content;
    }
  }

  /**
   * Record a delivery attempt
   */
  private recordDeliveryAttempt(attempt: DeliveryAttempt): void {
    this.deliveryHistory.push(attempt);
    
    // Trim history if needed
    if (this.deliveryHistory.length > this.MAX_HISTORY_SIZE) {
      this.deliveryHistory = this.deliveryHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStatistics() {
    const totalDeliveries = this.deliveryStatistics.successes + this.deliveryStatistics.failures;
    const avgLatency = totalDeliveries > 0 ?
      this.deliveryStatistics.totalLatency / totalDeliveries : 0;
    
    return {
      ...this.deliveryStatistics,
      avgLatency,
      successRate: totalDeliveries > 0 ?
        (this.deliveryStatistics.successes / totalDeliveries) * 100 : 100
    };
  }

  /**
   * Get recent delivery history
   */
  getDeliveryHistory(limit: number = 50): DeliveryAttempt[] {
    return this.deliveryHistory.slice(-limit);
  }
}

/**
 * Connection to an agent for message delivery
 */
interface AgentConnection extends EventEmitter {
  connect(): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
  sendMessage(message: any): Promise<void>;
  shouldReconnect(error: Error): boolean;
  markForReconnect(): void;
}

/**
 * In-memory implementation of agent connection
 * In a real system, this would communicate with actual agents
 */
class InMemoryAgentConnection extends EventEmitter implements AgentConnection {
  private connected = false;
  private shouldReconnectFlag = false;
  private connectionAttempts = 0;
  
  constructor(
    private agentId: string,
    private logger: ILogger
  ) {
    super();
  }
  
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    
    this.connectionAttempts++;
    
    try {
      // Simulate connection establishment
      this.connected = true;
      this.shouldReconnectFlag = false;
      this.emit('connected', { agentId: this.agentId });
      this.logger.debug('Agent connected', { agentId: this.agentId });
    } catch (error) {
      this.connected = false;
      throw new Error(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }
    
    try {
      // Simulate connection close
      this.connected = false;
      this.emit('disconnected', { agentId: this.agentId });
      this.logger.debug('Agent disconnected', { agentId: this.agentId });
    } catch (error) {
      throw new Error(`Close failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async sendMessage(message: any): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    
    try {
      // Simulate message sending - in a real system this would send to the agent
      this.logger.debug('Sending message to agent', { agentId: this.agentId, messageId: message.id });
      
      // Emit received message to simulate two-way communication
      setTimeout(() => {
        if (this.connected) {
          this.emit('message', {
            id: generateId('msg'),
            type: 'response',
            content: { received: true, messageId: message.id },
            timestamp: new Date()
          });
        }
      }, 10); // Small delay to simulate network
      
      return Promise.resolve();
    } catch (error) {
      throw new Error(`Send failed: ${error instanceof Error ? error.message : String(error)}`); 
    }
  }
  
  shouldReconnect(error: Error): boolean {
    // Connection errors should trigger reconnect
    return error.message.includes('Not connected') ||
           error.message.includes('Connection closed') ||
           error.message.includes('Network error');
  }
  
  markForReconnect(): void {
    this.shouldReconnectFlag = true;
    this.connected = false;
  }
}

/**
 * Channel delivery handler interface
 */
interface ChannelDeliveryHandler {
  deliverToChannel(message: Message, content: any): Promise<void>;
}

/**
 * In-memory channel delivery handler
 */
class InMemoryChannelHandler implements ChannelDeliveryHandler {
  // Store channel participants
  private participants: Set<string> = new Set<string>();
  // Channel message history
  private messages: Array<{ message: Message, content: any }> = [];
  private readonly MAX_HISTORY = 100;
  
  constructor(
    private channelId: string,
    private type: string,
    private logger: ILogger
  ) {}
  
  /**
   * Add a participant to the channel
   */
  addParticipant(agentId: string): void {
    this.participants.add(agentId);
    this.logger.debug('Added participant to channel', {
      channelId: this.channelId,
      agentId,
      participantCount: this.participants.size
    });
  }
  
  /**
   * Remove a participant from the channel
   */
  removeParticipant(agentId: string): void {
    this.participants.delete(agentId);
    this.logger.debug('Removed participant from channel', {
      channelId: this.channelId,
      agentId,
      participantCount: this.participants.size
    });
  }
  
  /**
   * Deliver a message to this channel
   */
  async deliverToChannel(message: Message, content: any): Promise<void> {
    // Record message in history
    this.messages.push({ message, content });
    
    // Trim history if needed
    if (this.messages.length > this.MAX_HISTORY) {
      this.messages = this.messages.slice(-this.MAX_HISTORY);
    }
    
    this.logger.debug('Message delivered to channel', {
      channelId: this.channelId,
      messageId: message.id,
      participantCount: this.participants.size
    });
    
    // In a real implementation, this would distribute the message to all participants
    // For now, we just log it
    return Promise.resolve();
  }
  
  /**
   * Get channel message history
   */
  getHistory(limit: number = 50): Array<{ message: Message, content: any }> {
    return this.messages.slice(-Math.min(limit, this.messages.length));
  }
}

/**
 * Queue delivery handler interface
 */
interface QueueDeliveryHandler {
  enqueueMessage(message: Message, content: any): Promise<void>;
  dequeueMessage(): Promise<{ message: Message, content: any } | undefined>;
  getQueueDepth(): number;
}

/**
 * In-memory queue delivery handler
 */
class InMemoryQueueHandler implements QueueDeliveryHandler {
  // Queue of messages
  private queue: Array<{ message: Message, content: any }> = [];
  private readonly MAX_QUEUE_SIZE = 1000;
  
  constructor(
    private queueId: string,
    private type: string,
    private logger: ILogger
  ) {}
  
  /**
   * Enqueue a message
   */
  async enqueueMessage(message: Message, content: any): Promise<void> {
    // Check queue capacity
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      throw new Error(`Queue ${this.queueId} is full`);
    }
    
    // Add message to queue based on type
    if (this.type === 'priority') {
      // Priority queue - insert based on message priority
      const priorityOrder = { 'critical': 0, 'high': 1, 'normal': 2, 'low': 3 };
      const messagePriority = priorityOrder[message.priority];
      
      let inserted = false;
      for (let i = 0; i < this.queue.length; i++) {
        const queuedPriority = priorityOrder[this.queue[i].message.priority];
        if (messagePriority < queuedPriority) {
          this.queue.splice(i, 0, { message, content });
          inserted = true;
          break;
        }
      }
      
      if (!inserted) {
        this.queue.push({ message, content });
      }
    } else {
      // FIFO queue - add to end
      this.queue.push({ message, content });
    }
    
    this.logger.debug('Message enqueued', {
      queueId: this.queueId,
      messageId: message.id,
      queueDepth: this.queue.length
    });
    
    return Promise.resolve();
  }
  
  /**
   * Dequeue a message
   */
  async dequeueMessage(): Promise<{ message: Message, content: any } | undefined> {
    if (this.queue.length === 0) {
      return undefined;
    }
    
    const item = this.queue.shift()!;
    
    this.logger.debug('Message dequeued', {
      queueId: this.queueId,
      messageId: item.message.id,
      queueDepth: this.queue.length
    });
    
    return item;
  }
  
  /**
   * Get current queue depth
   */
  getQueueDepth(): number {
    return this.queue.length;
  }
}

class RetryManager extends EventEmitter {
  private retryQueue: Array<{ message: Message; target: DeliveryTarget; attempts: number }> = [];
  private retryInterval?: NodeJS.Timeout;
  private config: MessageBusConfig;
  private logger: ILogger;

  constructor(config: MessageBusConfig, logger: ILogger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.startRetryProcessor();
    this.logger.debug('Retry manager initialized');
  }

  async shutdown(): Promise<void> {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
    this.logger.debug('Retry manager shutdown');
  }

  async scheduleRetry(message: Message, target: DeliveryTarget, error: any): Promise<void> {
    const existingEntry = this.retryQueue.find(entry =>
      entry.message.id === message.id && entry.target.id === target.id
    );

    if (existingEntry) {
      existingEntry.attempts++;
    } else {
      this.retryQueue.push({ message, target, attempts: 1 });
    }

    this.logger.debug('Retry scheduled', {
      messageId: message.id,
      target: target.id,
      error: error.message
    });
  }

  private startRetryProcessor(): void {
    this.retryInterval = setInterval(() => {
      this.processRetries();
    }, 5000); // Process retries every 5 seconds
  }

  private async processRetries(): Promise<void> {
    const now = Date.now();
    const toRetry = this.retryQueue.filter(entry => {
      const delay = this.calculateDelay(entry.attempts);
      return now >= entry.message.timestamp.getTime() + delay;
    });

    for (const entry of toRetry) {
      if (entry.attempts >= this.config.retryAttempts) {
        // Remove from retry queue and emit exhausted event
        this.retryQueue = this.retryQueue.filter(r => r !== entry);
        this.emit('retry:exhausted', entry);
      } else {
        // Retry delivery
        try {
          // Simulate retry delivery
          this.logger.debug('Retrying message delivery', {
            messageId: entry.message.id,
            attempt: entry.attempts
          });
          
          // Remove from retry queue on success
          this.retryQueue = this.retryQueue.filter(r => r !== entry);
          
        } catch (error) {
          // Keep in retry queue for next attempt
          this.logger.warn('Retry attempt failed', {
            messageId: entry.message.id,
            attempt: entry.attempts,
            error: (error as Error).message
          });
        }
      }
    }
  }

  private calculateDelay(attempts: number): number {
    const baseDelay = 1000; // 1 second
    return Math.min(
      baseDelay * Math.pow(this.config.backoffMultiplier, attempts - 1),
      30000 // Max 30 seconds
    );
  }
}

class MessageBusMetrics {
  private messagesSent = 0;
  private messagesDelivered = 0;
  private messagesFailed = 0;
  private bytesTransferred = 0;
  private deliveryLatencies: number[] = [];

  recordMessageSent(message: Message): void {
    this.messagesSent++;
    this.bytesTransferred += message.metadata.size;
  }

  recordDeliverySuccess(message: Message): void {
    this.messagesDelivered++;
    const latency = Date.now() - message.timestamp.getTime();
    this.deliveryLatencies.push(latency);
    
    // Keep only last 1000 latencies
    if (this.deliveryLatencies.length > 1000) {
      this.deliveryLatencies.shift();
    }
  }

  recordDeliveryFailure(message: Message): void {
    this.messagesFailed++;
  }

  getMetrics(): any {
    const avgLatency = this.deliveryLatencies.length > 0 ?
      this.deliveryLatencies.reduce((sum, lat) => sum + lat, 0) / this.deliveryLatencies.length : 0;

    return {
      messagesSent: this.messagesSent,
      messagesDelivered: this.messagesDelivered,
      messagesFailed: this.messagesFailed,
      bytesTransferred: this.bytesTransferred,
      averageLatency: avgLatency,
      successRate: this.messagesSent > 0 ? (this.messagesDelivered / this.messagesSent) * 100 : 100
    };
  }
}