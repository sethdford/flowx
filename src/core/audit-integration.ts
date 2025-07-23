/**
 * Audit Integration for FlowX
 * Simplified audit logging that integrates with existing Logger and EventBus
 */

import { ILogger, Logger } from './logger';
import { IEventBus, EventBus } from './event-bus';
import { generateId } from '../utils/helpers';

// Simple audit event structure
export interface SimpleAuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'denied';
  details: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Simple Enterprise Audit Logger
 */
export class SimpleAuditLogger {
  private logger: ILogger;
  private eventBus: IEventBus;
  private auditEvents: SimpleAuditEvent[] = [];
  private maxEvents = 10000;

  constructor(logger?: ILogger, eventBus?: IEventBus) {
    this.logger = logger || new Logger(
      { level: 'info', format: 'json', destination: 'console' },
      { component: 'AuditLogger' }
    );
    this.eventBus = eventBus || EventBus.getInstance();
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Partial<SimpleAuditEvent>): Promise<string> {
    const auditEvent: SimpleAuditEvent = {
      id: generateId('audit'),
      timestamp: new Date(),
      action: event.action || 'unknown',
      resource: event.resource || 'unknown',
      outcome: event.outcome || 'success',
      details: event.details || {},
      riskLevel: event.riskLevel || 'low',
      category: event.category || 'system',
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent
    };

    // Store event
    this.auditEvents.push(auditEvent);
    if (this.auditEvents.length > this.maxEvents) {
      this.auditEvents.shift();
    }

    try {
      // Log to system logger
      this.logger.info('Audit Event', {
        auditId: auditEvent.id,
        action: auditEvent.action,
        resource: auditEvent.resource,
        outcome: auditEvent.outcome,
        userId: auditEvent.userId,
        riskLevel: auditEvent.riskLevel,
        category: auditEvent.category
      });
    } catch (error) {
      // Silently continue if logging fails
      console.error('Audit logger error:', error);
    }

    try {
      // Emit event for real-time processing
      this.eventBus.emit('audit:event', auditEvent);

      // Emit security alert for high-risk events
      if (auditEvent.riskLevel === 'critical' || auditEvent.outcome === 'failure') {
        this.eventBus.emit('security:alert', {
          type: 'audit-alert',
          event: auditEvent,
          timestamp: new Date()
        });
      }
    } catch (error) {
      // Silently continue if event bus fails
      console.error('Audit event bus error:', error);
    }

    return auditEvent.id;
  }

  /**
   * Query audit events
   */
  queryEvents(filter: {
    timeRange?: { start: Date; end: Date };
    userId?: string;
    action?: string;
    resource?: string;
    outcome?: string;
    riskLevel?: string;
    category?: string;
    limit?: number;
  }): SimpleAuditEvent[] {
    let events = [...this.auditEvents];

    // Apply filters
    if (filter.timeRange) {
      events = events.filter(e => 
        e.timestamp >= filter.timeRange!.start && 
        e.timestamp <= filter.timeRange!.end
      );
    }
    if (filter.userId) {
      events = events.filter(e => e.userId === filter.userId);
    }
    if (filter.action) {
      events = events.filter(e => e.action.includes(filter.action!));
    }
    if (filter.resource) {
      events = events.filter(e => e.resource.includes(filter.resource!));
    }
    if (filter.outcome) {
      events = events.filter(e => e.outcome === filter.outcome);
    }
    if (filter.riskLevel) {
      events = events.filter(e => e.riskLevel === filter.riskLevel);
    }
    if (filter.category) {
      events = events.filter(e => e.category === filter.category);
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filter.limit) {
      events = events.slice(0, filter.limit);
    }

    return events;
  }

  /**
   * Get audit metrics
   */
  getMetrics(): {
    totalEvents: number;
    eventsByOutcome: Record<string, number>;
    eventsByRisk: Record<string, number>;
    eventsByCategory: Record<string, number>;
    recentActivity: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentEvents = this.auditEvents.filter(e => 
      e.timestamp.getTime() > oneHourAgo
    );

    const eventsByOutcome: Record<string, number> = {};
    const eventsByRisk: Record<string, number> = {};
    const eventsByCategory: Record<string, number> = {};

    for (const event of this.auditEvents) {
      eventsByOutcome[event.outcome] = (eventsByOutcome[event.outcome] || 0) + 1;
      eventsByRisk[event.riskLevel] = (eventsByRisk[event.riskLevel] || 0) + 1;
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;
    }

    return {
      totalEvents: this.auditEvents.length,
      eventsByOutcome,
      eventsByRisk,
      eventsByCategory,
      recentActivity: recentEvents.length
    };
  }
}

// Global instance
export const simpleAuditLogger = new SimpleAuditLogger();

/**
 * Quick audit logging functions
 */
export const audit = {
  // Authentication events
  login: (userId: string, success: boolean, ipAddress?: string) =>
    simpleAuditLogger.logEvent({
      action: 'user_login',
      resource: 'authentication',
      outcome: success ? 'success' : 'failure',
      userId,
      riskLevel: success ? 'low' : 'medium',
      category: 'authentication',
      ipAddress,
      details: { loginAttempt: true, success }
    }),

  // Data access events
  dataAccess: (userId: string, resource: string, action: string) =>
    simpleAuditLogger.logEvent({
      action,
      resource,
      outcome: 'success',
      userId,
      riskLevel: 'medium',
      category: 'data-access',
      details: { dataAccess: true }
    }),

  // System administration events
  systemChange: (userId: string, resource: string, action: string, details?: any) =>
    simpleAuditLogger.logEvent({
      action,
      resource,
      outcome: 'success',
      userId,
      riskLevel: 'high',
      category: 'system-administration',
      details: details || {}
    }),

  // Agent coordination events
  agentAction: (agentId: string, action: string, resource: string) =>
    simpleAuditLogger.logEvent({
      action,
      resource,
      outcome: 'success',
      userId: agentId,
      riskLevel: 'low',
      category: 'agent-coordination',
      details: { agentAction: true }
    }),

  // Security events
  securityEvent: (action: string, resource: string, riskLevel: 'low' | 'medium' | 'high' | 'critical', details?: any) =>
    simpleAuditLogger.logEvent({
      action,
      resource,
      outcome: 'success',
      riskLevel,
      category: 'security',
      details: details || {}
    }),

  // Configuration changes
  configChange: (userId: string, configType: string, action: string, details?: any) =>
    simpleAuditLogger.logEvent({
      action,
      resource: `config-${configType}`,
      outcome: 'success',
      userId,
      riskLevel: 'high',
      category: 'configuration',
      details: details || {}
    }),

  // API access
  apiAccess: (userId: string, endpoint: string, method: string, statusCode: number, ipAddress?: string) =>
    simpleAuditLogger.logEvent({
      action: `${method}_${endpoint}`,
      resource: 'api-endpoint',
      outcome: statusCode < 400 ? 'success' : statusCode < 500 ? 'denied' : 'failure',
      userId,
      riskLevel: statusCode >= 400 ? 'medium' : 'low',
      category: 'api-access',
      ipAddress,
      details: { method, endpoint, statusCode }
    })
};

/**
 * Simple audit decorator
 */
export function AuditSimple(options: {
  action?: string;
  category?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  logParameters?: boolean;
} = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!descriptor || !descriptor.value) {
      throw new Error(`Invalid descriptor for ${target.constructor?.name || 'unknown'}.${propertyKey}. Make sure the decorator is applied to a method.`);
    }
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        
        // Log successful execution - use the same instance from test or global
        const logger = (this as any).__auditLogger || simpleAuditLogger;
        await logger.logEvent({
          action: options.action || propertyKey,
          resource: `${target.constructor.name}.${propertyKey}`,
          outcome: 'success',
          userId: (this as any).userId || 'system',
          riskLevel: options.riskLevel || 'low',
          category: options.category || 'system',
          details: {
            className: target.constructor.name,
            methodName: propertyKey,
            duration: Date.now() - startTime,
            ...(options.logParameters && { parameterCount: args.length })
          }
        });
        
        return result;
        
      } catch (error) {
        // Log failed execution
        const logger = (this as any).__auditLogger || simpleAuditLogger;
        await logger.logEvent({
          action: options.action || propertyKey,
          resource: `${target.constructor.name}.${propertyKey}`,
          outcome: 'failure',
          userId: (this as any).userId || 'system',
          riskLevel: 'high',
          category: options.category || 'system',
          details: {
            className: target.constructor.name,
            methodName: propertyKey,
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
          }
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Express middleware for audit logging
 */
export function auditMiddleware(options: {
  excludePaths?: string[];
} = {}) {
  const excludePaths = new Set(options.excludePaths || ['/health', '/metrics']);

  return (req: any, res: any, next: any) => {
    if (excludePaths.has(req.path)) {
      return next();
    }

    const startTime = Date.now();

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function (chunk: any, encoding: any) {
      const duration = Date.now() - startTime;
      
      // Log the API access
      audit.apiAccess(
        req.user?.id || req.userId || 'anonymous',
        req.path,
        req.method,
        res.statusCode,
        req.ip
      );

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Integration with existing FlowX systems
 */
export function setupAuditIntegration(logger: ILogger, eventBus: IEventBus) {
  // Listen for system events and create audit trails
  eventBus.on('agent:spawned', (data: any) => {
    audit.agentAction(data.agentId, 'agent_spawned', 'agent-system');
  });

  eventBus.on('agent:terminated', (data: any) => {
    audit.agentAction(data.agentId, 'agent_terminated', 'agent-system');
  });

  eventBus.on('task:created', (data: any) => {
    audit.systemChange('system', 'task-engine', 'task_created', { taskId: data.taskId });
  });

  eventBus.on('task:completed', (data: any) => {
    audit.systemChange('system', 'task-engine', 'task_completed', { taskId: data.taskId });
  });

  eventBus.on('memory:created', (data: any) => {
    audit.dataAccess('system', 'memory-system', 'memory_created');
  });

  eventBus.on('security:alert', (data: any) => {
    audit.securityEvent('security_alert', 'security-system', 'critical', data);
  });

  logger.info('Audit integration setup complete');
} 