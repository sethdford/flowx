/**
 * Event bus implementation with typed events
 */

import { EventEmitter } from 'node:events';
import { generateId } from "../utils/helpers.js";

export interface IEventBus {
  emit(event: string, data?: any): boolean;
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string): this;
  getMaxListeners(): number;
  setMaxListeners(n: number): this;
  listeners(event: string): Function[];
  listenerCount(event: string): number;
}

export interface EventMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  averageProcessingTime: number;
  errorRate: number;
  lastEventTime: Date;
}

/**
 * Typed event bus with metrics and error handling
 */
export class TypedEventBus extends EventEmitter implements IEventBus {
  private metrics: EventMetrics;
  private eventHistory: Array<{ event: string; timestamp: Date; data?: any }> = [];
  private maxHistorySize = 100; // Reduced from 1000 to prevent memory growth
  private historyRetentionMs = 3600000; // 1 hour retention

  constructor() {
    super();
    this.metrics = {
      totalEvents: 0,
      eventsByType: {},
      averageProcessingTime: 0,
      errorRate: 0,
      lastEventTime: new Date()
    };
    
    this.setMaxListeners(100); // Increase default limit
  }

  override emit(event: string | symbol, ...args: any[]): boolean {
    const startTime = Date.now();
    
    try {
      // Update metrics
      this.metrics.totalEvents++;
      this.metrics.eventsByType[event.toString()] = (this.metrics.eventsByType[event.toString()] || 0) + 1;
      this.metrics.lastEventTime = new Date();
      
      // Add to history - only store first argument which is typically the event payload
      // This avoids storing large arrays of arguments that contribute to memory leaks
      const payload = args.length > 0 ? args[0] : undefined;
      this.addToHistory(event.toString(), payload);
      
      // Emit the event
      const result = super.emit(event, ...args);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);
      
      return result;
      
    } catch (error) {
      this.metrics.errorRate++;
      console.error('Event emission error:', error);
      return false;
    }
  }

  /**
   * Get event metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent event history
   */
  getEventHistory(limit: number = 50): Array<{ event: string; timestamp: Date; data?: any }> {
    // Clean history first to avoid returning expired events
    this.cleanEventHistory();
    
    // Apply the requested limit
    return this.eventHistory.slice(-Math.min(limit, this.eventHistory.length));
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
  
  /**
   * Configure event history settings
   */
  configureHistory(options: { maxSize?: number; retentionMs?: number }): void {
    if (options.maxSize !== undefined && options.maxSize >= 0) {
      this.maxHistorySize = options.maxSize;
    }
    
    if (options.retentionMs !== undefined && options.retentionMs >= 0) {
      this.historyRetentionMs = options.retentionMs;
    }
    
    // Apply new settings to existing history
    this.cleanEventHistory();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalEvents: 0,
      eventsByType: {},
      averageProcessingTime: 0,
      errorRate: 0,
      lastEventTime: new Date()
    };
  }

  /**
   * Add an event to history with memory leak prevention:
   * 1. Limits total history size
   * 2. Uses weak references for data when possible
   * 3. Cleans up old events periodically
   * 4. Doesn't store large payloads directly
   */
  private addToHistory(event: string, data?: any): void {
    // Don't store large data objects directly - store a summary or reference
    let processedData = data;
    
    if (data && typeof data === 'object') {
      try {
        // Use a safe JSON stringify that handles circular references
        const dataSize = this.safeStringify(data).length;
        if (dataSize > 1000) {
          // For large data, just keep keys and type info
          processedData = {
            __summary: true,
            __type: data.constructor ? data.constructor.name : typeof data,
            __keys: Object.keys(data),
            __size: dataSize
          };
        }
      } catch (error) {
        // If we can't stringify (circular refs, etc), create a simple summary
        processedData = {
          __summary: true,
          __type: data.constructor ? data.constructor.name : typeof data,
          __keys: Object.keys(data),
          __error: 'Cannot serialize (circular reference)'
        };
      }
    }
    
    this.eventHistory.push({
      event,
      timestamp: new Date(),
      data: processedData
    });
    
    // Clean old events regularly based on both size limit and age
    this.cleanEventHistory();
  }

  /**
   * Safe JSON stringify that handles circular references
   */
  private safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, val) => {
      if (val != null && typeof val === 'object') {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }
      return val;
    });
  }
  
  /**
   * Clean event history to prevent memory leaks
   */
  private cleanEventHistory(): void {
    // Apply size limit
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
    
    // Apply age limit
    const cutoffTime = Date.now() - this.historyRetentionMs;
    this.eventHistory = this.eventHistory.filter(
      entry => entry.timestamp.getTime() >= cutoffTime
    );
  }

  private updateAverageProcessingTime(newTime: number): void {
    const currentAvg = this.metrics.averageProcessingTime;
    const totalEvents = this.metrics.totalEvents;
    
    // Calculate running average
    this.metrics.averageProcessingTime = 
      ((currentAvg * (totalEvents - 1)) + newTime) / totalEvents;
  }
}

/**
 * Global event bus for system-wide communication
 */
export class EventBus implements IEventBus {
  private static instance: EventBus;
  private typedBus: TypedEventBus;
  // Scheduled cleanup to prevent memory leaks
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.typedBus = new TypedEventBus();
    // Only start cleanup interval in production/non-test environments
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupInterval();
    }
  }

  /**
   * Starts the cleanup interval
   */
  private startCleanupInterval(): void {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.typedBus.getEventHistory(0); // This triggers cleanEventHistory()
      }, 600000); // 10 minutes
    }
  }

  /**
   * Stops the cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Destroys the EventBus instance and cleans up resources
   */
  destroy(): void {
    this.stopCleanupInterval();
    this.removeAllListeners();
    this.typedBus.removeAllListeners();
    this.typedBus.clearHistory();
    this.typedBus.resetMetrics();
  }

  /**
   * Resets the singleton instance (for testing)
   */
  static reset(): void {
    if (EventBus.instance) {
      EventBus.instance.destroy();
      EventBus.instance = null as any;
    }
  }

  /**
   * Gets the singleton instance of the event bus
   */
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emit(event: string, data?: any): boolean {
    return this.typedBus.emit(event, data);
  }

  on(event: string, listener: (...args: any[]) => void): this {
    this.typedBus.on(event, listener);
    return this;
  }

  off(event: string, listener: (...args: any[]) => void): this {
    this.typedBus.off(event, listener);
    return this;
  }

  once(event: string, listener: (...args: any[]) => void): this {
    this.typedBus.once(event, listener);
    return this;
  }

  removeAllListeners(event?: string): this {
    this.typedBus.removeAllListeners(event);
    return this;
  }

  getMaxListeners(): number {
    return this.typedBus.getMaxListeners();
  }

  setMaxListeners(n: number): this {
    this.typedBus.setMaxListeners(n);
    return this;
  }

  listeners(event: string): Function[] {
    return this.typedBus.listeners(event);
  }

  listenerCount(event: string): number {
    return this.typedBus.listenerCount(event);
  }

  /**
   * Get event metrics
   */
  getMetrics(): EventMetrics {
    return this.typedBus.getMetrics();
  }

  /**
   * Get recent event history
   */
  getEventHistory(limit?: number): Array<{ event: string; timestamp: Date; data?: any }> {
    return this.typedBus.getEventHistory(limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.typedBus.clearHistory();
  }
  
  /**
   * Configure event history settings
   */
  configureHistory(options: { maxSize?: number; retentionMs?: number }): void {
    this.typedBus.configureHistory(options);
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.typedBus.resetMetrics();
  }

  /**
   * Wait for a specific event to be emitted
   */
  waitFor(event: string, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = timeout ? setTimeout(() => {
        this.off(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout) : null;

      const handler = (data: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(data);
      };

      this.once(event, handler);
    });
  }

  /**
   * Add a filtered event listener
   */
  onFiltered(event: string, filter: (data: any) => boolean, listener: (data: any) => void): this {
    const filteredListener = (data: any) => {
      if (filter(data)) {
        listener(data);
      }
    };
    
    this.on(event, filteredListener);
    return this;
  }
}

// Create and export a default instance
export const eventBus = EventBus.getInstance();
export default eventBus;