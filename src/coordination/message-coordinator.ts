/**
 * Message Coordinator
 * Coordinates message flow between system components using MessageBroker
 */

import { Message, CoordinationConfig, SystemEvents } from "../utils/types.js";
import { IEventBus } from "../core/event-bus.js";
import { ILogger } from "../core/logger.js";
import { generateId } from "../utils/helpers.js";
import { MessageBroker, createMessageBroker, BrokerMessage, MessageHandler } from "../communication/message-broker.js";

interface PendingResponse {
  resolve: (response: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Message coordinator that manages message flow using MessageBroker
 */
export class MessageCoordinator {
  private messageBroker: MessageBroker;
  private messageHandlers = new Map<string, Map<string, (message: Message) => void>>();
  private pendingResponses = new Map<string, PendingResponse>();
  private messageCount = 0;

  constructor(
    private config: CoordinationConfig,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {
    // Create message broker instance
    this.messageBroker = createMessageBroker(
      {
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
        metricsEnabled: true,
        debugMode: false
      },
      logger,
      eventBus
    );
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing message coordinator');
    
    // Initialize message broker
    await this.messageBroker.initialize();
    
    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down message coordinator');
    
    // Reject all pending responses
    for (const [id, pending] of this.pendingResponses) {
      pending.reject(new Error('Message coordinator shutdown'));
      clearTimeout(pending.timeout);
    }
    
    // Shutdown message broker
    await this.messageBroker.shutdown();
    
    this.messageHandlers.clear();
    this.pendingResponses.clear();
  }

  async send(from: string, to: string, payload: unknown): Promise<void> {
    const messageId = await this.messageBroker.sendMessage(
      from,
      to,
      'agent-message',
      payload,
      { priority: 'normal' }
    );
    
    this.messageCount++;
    
    this.eventBus.emit(SystemEvents.MESSAGE_SENT, { 
      from, 
      to, 
      message: { id: messageId, type: 'agent-message', payload }
    });
  }

  async sendWithResponse<T = unknown>(
    from: string,
    to: string,
    payload: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    const timeout = timeoutMs || this.config.messageTimeout;
    
    try {
      const response = await this.messageBroker.sendRequest(
        from,
        to,
        'agent-request',
        payload,
        timeout
      );
      
      this.messageCount++;
      return response as T;
    } catch (error) {
      this.logger.error('Request failed', { from, to, error });
      throw error;
    }
  }

  async broadcast(from: string, payload: unknown): Promise<void> {
    await this.messageBroker.broadcast(from, 'broadcast', payload);
    this.messageCount++;
  }

  subscribe(agentId: string, handler: (message: Message) => void): void {
    if (!this.messageHandlers.has(agentId)) {
      this.messageHandlers.set(agentId, new Map());
    }
    
    const handlerId = generateId('handler');
    this.messageHandlers.get(agentId)!.set(handlerId, handler);
    
    // Subscribe to message broker
    this.messageBroker.subscribe(agentId, '*', async (brokerMessage: BrokerMessage) => {
      // Convert BrokerMessage back to Message format for compatibility
      const message: Message = {
        id: brokerMessage.id,
        type: brokerMessage.type,
        payload: brokerMessage.content,
        timestamp: brokerMessage.timestamp,
        priority: this.convertPriorityToNumber(brokerMessage.priority)
      };
      
      // Call all handlers for this agent
      const agentHandlers = this.messageHandlers.get(agentId);
      if (agentHandlers) {
        for (const [_, handlerFn] of agentHandlers) {
          try {
            handlerFn(message);
          } catch (error) {
            this.logger.error('Message handler error', { agentId, messageId: message.id, error });
          }
        }
      }
    });
  }

  unsubscribe(agentId: string, handlerId: string): void {
    const agentHandlers = this.messageHandlers.get(agentId);
    if (agentHandlers) {
      agentHandlers.delete(handlerId);
      if (agentHandlers.size === 0) {
        this.messageHandlers.delete(agentId);
      }
    }
  }

  async sendResponse(
    originalMessageId: string,
    response: unknown,
  ): Promise<void> {
    const pending = this.pendingResponses.get(originalMessageId);
    if (!pending) {
      this.logger.warn('No pending response found', { messageId: originalMessageId });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingResponses.delete(originalMessageId);
    pending.resolve(response);
  }

  async getHealthStatus(): Promise<{ 
    healthy: boolean; 
    error?: string; 
    metrics?: Record<string, number>;
  }> {
    const brokerMetrics = this.messageBroker.getMetrics();
    
    return {
      healthy: true,
      metrics: {
        activeQueues: brokerMetrics.queues || 0,
        pendingMessages: brokerMetrics.storedMessages || 0,
        registeredHandlers: this.messageHandlers.size,
        pendingResponses: this.pendingResponses.size,
        totalMessagesSent: this.messageCount,
        channels: brokerMetrics.channels || 0,
        subscriptions: brokerMetrics.subscriptions || 0,
        successRate: brokerMetrics.busMetrics?.successRate || 100
      },
    };
  }

  // === MESSAGE BROKER DIRECT ACCESS ===
  
  /**
   * Get direct access to message broker for advanced operations
   */
  getMessageBroker(): MessageBroker {
    return this.messageBroker;
  }

  /**
   * Create a queue for task distribution
   */
  async createQueue(name: string, config?: any): Promise<string> {
    return await this.messageBroker.createQueue(name, config);
  }

  /**
   * Subscribe to a queue
   */
  async subscribeToQueue(queueId: string, agentId: string, handler: (message: Message) => void): Promise<string> {
    return await this.messageBroker.subscribeToQueue(queueId, agentId, async (brokerMessage: BrokerMessage) => {
      const message: Message = {
        id: brokerMessage.id,
        type: brokerMessage.type,
        payload: brokerMessage.content,
        timestamp: brokerMessage.timestamp,
        priority: this.convertPriorityToNumber(brokerMessage.priority)
      };
      handler(message);
    });
  }

  /**
   * Create a channel for coordination
   */
  async createChannel(name: string, type: 'broadcast' | 'multicast' | 'topic'): Promise<string> {
    return await this.messageBroker.createChannel(name, type);
  }

  /**
   * Join a channel
   */
  async joinChannel(channelId: string, agentId: string): Promise<void> {
    await this.messageBroker.joinChannel(channelId, agentId);
  }

  /**
   * Send message to channel
   */
  async sendToChannel(channelId: string, from: string, type: string, content: any): Promise<void> {
    await this.messageBroker.sendToChannel(channelId, from, type, content);
  }

  // === PRIVATE METHODS ===

  private convertPriorityToNumber(priority: string): number {
    switch (priority) {
      case 'urgent': return 3;
      case 'high': return 2;
      case 'normal': return 1;
      case 'low': return 0;
      default: return 1;
    }
  }

  private cleanup(): void {
    // Cleanup is now handled by MessageBroker
    this.logger.debug('Message coordinator cleanup completed');
  }

  async performMaintenance(): Promise<void> {
    // Maintenance is now handled by MessageBroker
    this.logger.debug('Message coordinator maintenance completed');
  }
}

// Maintain backward compatibility
export { MessageCoordinator as MessageRouter };
