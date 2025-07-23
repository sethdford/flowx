/**
 * Audit Decorators for Automatic Security Event Logging
 * Provides TypeScript decorators to automatically audit method calls, data access, and security events
 */

import { auditLogger, AuditEventType, AuditCategory, AuditSeverity } from './audit-logger.js';
import { generateId } from '../utils/helpers.js';

// Decorator metadata storage
const auditMetadata = new WeakMap();

/**
 * Audit decorator for automatic method call logging
 */
export function Audit(options: {
  eventType?: AuditEventType;
  category?: AuditCategory;
  severity?: AuditSeverity;
  action?: string;
  resourceType?: string;
  logParameters?: boolean;
  logResults?: boolean;
  sensitive?: boolean;
  compliance?: string[];
} = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const correlationId = generateId('correlation');
      
      // Prepare audit event data
      let auditData = {
        eventType: options.eventType || 'system_change',
        category: options.category || 'system-administration',
        severity: options.severity || 'medium',
        correlationId,
        actor: {
          type: 'user' as const,
          id: (this as any).userId || (this as any).actorId || 'system',
          sessionId: (this as any).sessionId
        },
        resource: {
          type: options.resourceType || 'method',
          id: `${target.constructor.name}.${propertyKey}`,
          name: propertyKey
        },
        action: options.action || propertyKey,
        context: {
          source: 'audit-decorator',
          className: target.constructor.name,
          methodName: propertyKey
        },
        details: {
           ...(options.logParameters && { parameters: AuditUtils.sanitizeParameters(args) }),
           timestamp: new Date().toISOString()
        },
        security: {
          riskLevel: options.sensitive ? 'high' as const : 'low' as const,
          sensitiveData: options.sensitive || false,
          encrypted: true
        },
        compliance: {
           frameworks: (options.compliance || []) as import('./audit-logger.ts').ComplianceFramework[],
           controls: [],
           retention: '3years' as const,
           classification: options.sensitive ? 'confidential' as const : 'internal' as const
        }
      };
      
      try {
        
        // Execute the original method
        const result = await originalMethod.apply(this, args);
        
                 // Log successful execution
         const duration = Date.now() - startTime;
         await auditLogger.logEvent({
           ...auditData,
           outcome: 'success',
           details: {
             ...auditData.details,
             ...(options.logResults && { result: AuditUtils.sanitizeResult(result) })
           },
           performance: {
             duration,
             resourceUsage: { executionTime: duration }
           },
           compliance: {
             frameworks: (options.compliance || []) as any[],
             controls: [],
             retention: '3years' as const,
             classification: options.sensitive ? 'confidential' as const : 'internal' as const
           }
         });
         
         return result;
         
       } catch (error) {
         // Log failed execution
         const duration = Date.now() - startTime;
         await auditLogger.logEvent({
           ...auditData,
           outcome: 'failure',
           severity: 'high',
           details: {
             ...auditData.details,
             error: error instanceof Error ? error.message : String(error),
             stack: error instanceof Error ? error.stack : undefined
           },
           performance: {
             duration,
             resourceUsage: { executionTime: duration }
           },
           compliance: {
             frameworks: (options.compliance || []) as any[],
             controls: [],
             retention: '3years' as const,
             classification: options.sensitive ? 'confidential' as const : 'internal' as const
           }
         });
        
        throw error;
      }
    };
    
    // Store metadata for later inspection
    auditMetadata.set(descriptor.value, {
      originalMethod,
      options,
      target,
      propertyKey
    });
    
    return descriptor;
  };
}

/**
 * Decorator specifically for authentication events
 */
export function AuditAuth(options: {
  action?: string;
  sensitive?: boolean;
} = {}) {
  return Audit({
    eventType: 'authentication',
    category: 'authentication',
    severity: 'medium',
    action: options.action || 'authenticate',
    resourceType: 'authentication',
    logParameters: false, // Never log auth parameters
    logResults: false,    // Never log auth results
    sensitive: true,
    compliance: ['SOX', 'GDPR', 'HIPAA']
  });
}

/**
 * Decorator for data access operations
 */
export function AuditDataAccess(options: {
  dataType?: string;
  sensitive?: boolean;
  action?: string;
} = {}) {
  return Audit({
    eventType: 'data_access',
    category: 'data-access',
    severity: options.sensitive ? 'high' : 'medium',
    action: options.action || 'access_data',
    resourceType: options.dataType || 'data',
    logParameters: true,
    logResults: false, // Don't log actual data in results
    sensitive: options.sensitive || false,
    compliance: ['GDPR', 'HIPAA', 'PCI-DSS']
  });
}

/**
 * Decorator for privileged operations
 */
export function AuditPrivileged(options: {
  operation?: string;
  requiresApproval?: boolean;
} = {}) {
  return Audit({
    eventType: 'privileged_operation',
    category: 'system-administration',
    severity: 'critical',
    action: options.operation || 'privileged_operation',
    resourceType: 'system',
    logParameters: true,
    logResults: true,
    sensitive: true,
    compliance: ['SOX', 'SOC2', 'ISO27001']
  });
}

/**
 * Decorator for configuration changes
 */
export function AuditConfig(options: {
  configType?: string;
  critical?: boolean;
} = {}) {
  return Audit({
    eventType: 'configuration_change',
    category: 'configuration',
    severity: options.critical ? 'high' : 'medium',
    action: 'modify_configuration',
    resourceType: options.configType || 'configuration',
    logParameters: true,
    logResults: true,
    sensitive: options.critical || false,
    compliance: ['SOX', 'SOC2']
  });
}

/**
 * Decorator for business transactions
 */
export function AuditTransaction(options: {
  transactionType?: string;
  financialImpact?: boolean;
} = {}) {
  return Audit({
    eventType: 'business_transaction',
    category: 'business-operation',
    severity: options.financialImpact ? 'high' : 'medium',
    action: 'execute_transaction',
    resourceType: options.transactionType || 'transaction',
    logParameters: true,
    logResults: true,
    sensitive: options.financialImpact || false,
    compliance: ['SOX', 'PCI-DSS']
  });
}

/**
 * Decorator for agent operations
 */
export function AuditAgent(options: {
  agentAction?: string;
  resourceType?: string;
} = {}) {
  return Audit({
    eventType: 'agent_action',
    category: 'agent-coordination',
    severity: 'low',
    action: options.agentAction || 'agent_operation',
    resourceType: options.resourceType || 'agent',
    logParameters: true,
    logResults: false,
    sensitive: false,
    compliance: []
  });
}

/**
 * Class-level decorator to audit all methods in a class
 */
export function AuditClass(options: {
  category?: AuditCategory;
  severity?: AuditSeverity;
  excludeMethods?: string[];
  includePrivate?: boolean;
} = {}) {
  return function <T extends { new(...args: any[]): {} }>(constructor: T) {
    const excludeMethods = new Set([
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
      ...(options.excludeMethods || [])
    ]);
    
    // Get all method names
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype)
      .filter(name => {
        if (excludeMethods.has(name)) return false;
        if (!options.includePrivate && name.startsWith('_')) return false;
        
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        return descriptor && typeof descriptor.value === 'function';
      });
    
    // Apply audit decorator to each method
    methodNames.forEach(methodName => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      if (descriptor) {
        const auditDecorator = Audit({
          category: options.category || 'system-administration',
          severity: options.severity || 'medium',
          action: methodName,
          resourceType: constructor.name.toLowerCase()
        });
        
        auditDecorator(prototype, methodName, descriptor);
        Object.defineProperty(prototype, methodName, descriptor);
      }
    });
    
    return constructor;
  };
}

/**
 * Utility decorator to enable audit context tracking
 */
export function AuditContext(contextProvider?: () => { userId?: string; sessionId?: string; traceId?: string }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      // Add audit context to the instance
      if (contextProvider) {
        const context = contextProvider();
        Object.assign(this, context);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Performance monitoring decorator with audit integration
 */
export function AuditPerformance(options: {
  thresholdMs?: number;
  logSlowOperations?: boolean;
} = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const threshold = options.thresholdMs || 1000; // 1 second default
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - startTime;
      
      // Log slow operations as audit events
      if (options.logSlowOperations && duration > threshold) {
        await auditLogger.logEvent({
          eventType: 'system_change',
          category: 'monitoring',
          severity: 'medium',
          actor: {
            type: 'system',
            id: 'performance-monitor'
          },
          resource: {
            type: 'method',
            id: `${target.constructor.name}.${propertyKey}`,
            name: propertyKey
          },
          action: 'slow_operation_detected',
          outcome: 'success',
          details: {
            duration,
            threshold,
            className: target.constructor.name,
            methodName: propertyKey
          },
          performance: {
            duration,
            resourceUsage: { executionTime: duration }
          },
          security: {
            riskLevel: 'low',
            sensitiveData: false,
            encrypted: false
          }
        });
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Utility functions for data sanitization in audit logs
 */
export const AuditUtils = {
  /**
   * Sanitize method parameters for audit logging
   */
  sanitizeParameters(params: any[]): any[] {
    return params.map(param => {
      if (typeof param === 'string' && this.isPassword(param)) {
        return '[REDACTED-PASSWORD]';
      }
      if (typeof param === 'object' && param !== null) {
        return this.sanitizeObject(param);
      }
      if (typeof param === 'string' && param.length > 1000) {
        return param.substring(0, 1000) + '...[TRUNCATED]';
      }
      return param;
    });
  },

  /**
   * Sanitize method results for audit logging
   */
  sanitizeResult(result: any): any {
    if (typeof result === 'object' && result !== null) {
      return this.sanitizeObject(result);
    }
    if (typeof result === 'string' && result.length > 1000) {
      return result.substring(0, 1000) + '...[TRUNCATED]';
    }
    return result;
  },

  /**
   * Sanitize object by removing sensitive fields
   */
  sanitizeObject(obj: any): any {
    const sensitiveFields = [
      'password', 'passwd', 'secret', 'token', 'key', 'auth',
      'credential', 'authorization', 'session', 'cookie',
      'ssn', 'social', 'credit', 'card', 'cvv', 'pin'
    ];
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '...[TRUNCATED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  },

  /**
   * Check if a string is likely a password
   */
  isPassword(str: string): boolean {
    // Basic heuristics for password detection
    return str.length > 6 && 
           /[A-Za-z]/.test(str) && 
           /[0-9]/.test(str) &&
           (str.includes('$') || str.includes('!') || str.includes('@') || str.includes('#'));
  }
};

// Add sanitization methods to function prototype for use in decorators
declare global {
  interface Function {
    sanitizeParameters(params: any[]): any[];
    sanitizeResult(result: any): any;
  }
}

Function.prototype.sanitizeParameters = AuditUtils.sanitizeParameters.bind(AuditUtils);
Function.prototype.sanitizeResult = AuditUtils.sanitizeResult.bind(AuditUtils);

/**
 * Express middleware for automatic request auditing
 */
export function auditMiddleware(options: {
  excludePaths?: string[];
  includeBody?: boolean;
  includeQuery?: boolean;
  sensitiveHeaders?: string[];
} = {}) {
  const excludePaths = new Set(options.excludePaths || ['/health', '/metrics']);
  const sensitiveHeaders = new Set((options.sensitiveHeaders || [
    'authorization', 'cookie', 'x-api-key', 'x-auth-token'
  ]).map(h => h.toLowerCase()));

  return async (req: any, res: any, next: any) => {
    if (excludePaths.has(req.path)) {
      return next();
    }

    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] || generateId('correlation');

    // Sanitize headers
    const sanitizedHeaders: any = {};
    for (const [key, value] of Object.entries(req.headers)) {
      sanitizedHeaders[key] = sensitiveHeaders.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }

    // Prepare audit data
    const auditData = {
      eventType: 'api_access' as AuditEventType,
      category: 'data-access' as AuditCategory,
      severity: 'low' as AuditSeverity,
      correlationId,
      actor: {
        type: 'user' as const,
        id: req.user?.id || req.userId || 'anonymous',
        sessionId: req.sessionID || req.session?.id
      },
      resource: {
        type: 'api-endpoint',
        id: `${req.method} ${req.path}`,
        path: req.path
      },
      action: `http_${req.method.toLowerCase()}`,
      context: {
        source: 'http-middleware',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: correlationId
      },
      details: {
        method: req.method,
        path: req.path,
        headers: sanitizedHeaders,
        ...(options.includeQuery && { query: req.query }),
        ...(options.includeBody && req.body && { body: AuditUtils.sanitizeObject(req.body) })
      },
      security: {
        riskLevel: req.method === 'GET' ? 'low' as const : 'medium' as const,
        sensitiveData: req.path.includes('user') || req.path.includes('admin'),
        encrypted: req.secure
      }
    };

    // Override res.end to capture response
    const originalEnd = res.end;
    res.end = function (chunk: any, encoding: any) {
      const duration = Date.now() - startTime;
      
      // Determine outcome based on status code
      const outcome = res.statusCode < 400 ? 'success' : 
                     res.statusCode < 500 ? 'denied' : 'failure';

      // Log the audit event
      auditLogger.logEvent({
        ...auditData,
        outcome,
        severity: res.statusCode >= 500 ? 'high' : auditData.severity,
        details: {
          ...auditData.details,
          statusCode: res.statusCode,
          responseSize: chunk ? chunk.length : 0
        },
        performance: {
          duration,
          resourceUsage: { responseTime: duration }
        }
      }).catch(error => {
        console.error('Failed to log audit event:', error);
      });

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Audit event builder for fluent API
 */
export class AuditEventBuilder {
  private event: Partial<import('./audit-logger.ts').AuditEvent> = {};

  actor(type: 'user' | 'system' | 'agent' | 'service', id: string, sessionId?: string): this {
    this.event.actor = { type, id, sessionId };
    return this;
  }

  resource(type: string, id: string, name?: string): this {
    this.event.resource = { type, id, name };
    return this;
  }

  action(action: string): this {
    this.event.action = action;
    return this;
  }

  category(category: AuditCategory): this {
    this.event.category = category;
    return this;
  }

  severity(severity: AuditSeverity): this {
    this.event.severity = severity;
    return this;
  }

  outcome(outcome: 'success' | 'failure' | 'partial' | 'denied'): this {
    this.event.outcome = outcome;
    return this;
  }

  details(details: Record<string, any>): this {
    this.event.details = { ...this.event.details, ...details };
    return this;
  }

  sensitive(sensitive: boolean = true): this {
    this.event.security = {
      ...this.event.security,
      sensitiveData: sensitive,
      riskLevel: sensitive ? 'high' : 'medium',
      encrypted: true
    };
    return this;
  }

  compliance(frameworks: string[]): this {
    this.event.compliance = {
      ...this.event.compliance,
      frameworks: frameworks as any[],
      controls: [],
      retention: '3years' as const,
      classification: 'confidential' as const
    };
    return this;
  }

  context(context: Record<string, any>): this {
    this.event.context = { 
      ...this.event.context, 
      ...context,
      source: context.source || 'audit-decorator'
    };
    return this;
  }

  async log(): Promise<string> {
    return await auditLogger.logEvent(this.event);
  }
}

/**
 * Factory function for creating audit event builders
 */
export function createAuditEvent(): AuditEventBuilder {
  return new AuditEventBuilder();
}

// Export commonly used audit logging patterns
export const AuditPatterns = {
  /**
   * Quick audit for user login
   */
  userLogin: (userId: string, success: boolean, ipAddress?: string) =>
    createAuditEvent()
      .actor('user', userId)
      .resource('authentication', 'login')
      .action('user_login')
      .category('authentication')
      .severity(success ? 'low' : 'medium')
      .outcome(success ? 'success' : 'failure')
      .context({ source: 'auth-system', ipAddress })
      .log(),

  /**
   * Quick audit for data access
   */
  dataAccess: (userId: string, resourceId: string, action: string, sensitive = false) =>
    createAuditEvent()
      .actor('user', userId)
      .resource('data', resourceId)
      .action(action)
      .category('data-access')
      .severity(sensitive ? 'high' : 'medium')
      .outcome('success')
      .sensitive(sensitive)
      .log(),

  /**
   * Quick audit for system changes
   */
  systemChange: (userId: string, resourceId: string, action: string, details?: any) =>
    createAuditEvent()
      .actor('user', userId)
      .resource('system', resourceId)
      .action(action)
      .category('system-administration')
      .severity('high')
      .outcome('success')
      .details(details || {})
      .compliance(['SOX', 'SOC2'])
      .log(),

  /**
   * Quick audit for agent actions
   */
  agentAction: (agentId: string, action: string, resourceId: string, outcome = 'success') =>
    createAuditEvent()
      .actor('agent', agentId)
      .resource('agent-resource', resourceId)
      .action(action)
      .category('agent-coordination')
      .severity('low')
      .outcome(outcome as any)
      .log()
}; 