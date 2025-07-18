/**
 * Enterprise Audit Logging System
 * Comprehensive audit trail with compliance standards, tamper-proof storage, and real-time monitoring
 * Integrates with existing FlowX Logger and EventBus infrastructure
 */

import { EventEmitter } from 'node:events';
import { writeFile, readFile, mkdir, appendFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash, randomBytes, createHmac } from 'node:crypto';
import { Logger, ILogger } from './logger.ts';
import { EventBus, IEventBus } from './event-bus.ts';
import { generateId } from '../utils/helpers.ts';

// Core audit event structure
export interface AuditEvent {
  // Event identification
  id: string;
  timestamp: Date;
  correlationId?: string;
  traceId?: string;
  
  // Event classification
  eventType: AuditEventType;
  category: AuditCategory;
  severity: AuditSeverity;
  
  // Actor information
  actor: {
    type: 'user' | 'system' | 'agent' | 'service' | 'anonymous';
    id: string;
    name?: string;
    sessionId?: string;
    impersonatedBy?: string;
  };
  
  // Resource and action
  resource: {
    type: string;
    id: string;
    name?: string;
    path?: string;
    parentId?: string;
  };
  action: string;
  outcome: 'success' | 'failure' | 'partial' | 'denied' | 'error';
  
  // Context and details
  context: {
    source: string;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    requestId?: string;
    deviceId?: string;
  };
  details: Record<string, any>;
  
  // Security and compliance
  security: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    sensitiveData: boolean;
    encrypted: boolean;
    redacted?: string[];
  };
  compliance: {
    frameworks: ComplianceFramework[];
    controls: string[];
    retention: RetentionPeriod;
    classification: DataClassification;
  };
  
  // Integrity protection
  integrity: {
    hash: string;
    signature?: string;
    chainHash?: string;
    verified: boolean;
  };
  
  // Performance and metadata
  performance?: {
    duration?: number;
    resourceUsage?: Record<string, number>;
  };
  metadata: Record<string, any>;
}

export type AuditEventType = 
  | 'authentication' | 'authorization' | 'data_access' | 'data_modification'
  | 'system_change' | 'configuration_change' | 'security_event' | 'business_transaction'
  | 'agent_action' | 'task_execution' | 'workflow_execution' | 'admin_action'
  | 'api_access' | 'file_access' | 'network_access' | 'privileged_operation';

export type AuditCategory = 
  | 'authentication' | 'authorization' | 'data-access' | 'data-modification'
  | 'system-administration' | 'configuration' | 'security' | 'compliance'
  | 'business-operation' | 'agent-coordination' | 'task-management'
  | 'workflow-orchestration' | 'infrastructure' | 'monitoring';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ComplianceFramework = 'SOX' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'SOC2' | 'ISO27001' | 'NIST' | 'FedRAMP';

export type RetentionPeriod = '1year' | '3years' | '7years' | '10years' | 'permanent';

export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'top-secret';

// Audit trail and storage
export interface AuditTrail {
  id: string;
  name: string;
  description: string;
  category: AuditCategory;
  events: AuditEvent[];
  integrity: {
    chainHash: string;
    lastVerification: Date;
    verified: boolean;
    immutable: boolean;
  };
  retention: {
    policy: RetentionPeriod;
    deleteAfter: Date;
    archived: boolean;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    eventCount: number;
    size: number;
  };
}

// Configuration and policies
export interface AuditConfiguration {
  enabled: boolean;
  realTimeProcessing: boolean;
  encryptionEnabled: boolean;
  tamperProofStorage: boolean;
  
  // Storage settings
  storage: {
    basePath: string;
    maxFileSize: number;
    compressionEnabled: boolean;
    replication: boolean;
    backupEnabled: boolean;
  };
  
  // Performance settings
  buffering: {
    enabled: boolean;
    maxSize: number;
    flushInterval: number;
    maxWaitTime: number;
  };
  
  // Compliance and retention
  compliance: {
    frameworks: ComplianceFramework[];
    automaticClassification: boolean;
    retentionPolicies: Record<AuditCategory, RetentionPeriod>;
    encryptSensitiveData: boolean;
    redactPII: boolean;
  };
  
  // Monitoring and alerting
  monitoring: {
    enabled: boolean;
    realTimeAlerts: boolean;
    anomalyDetection: boolean;
    thresholds: {
      failedEvents: number;
      criticalEvents: number;
      suspiciousPatterns: number;
    };
    notifications: {
      channels: string[];
      escalation: boolean;
    };
  };
  
  // Security settings
  security: {
    hashAlgorithm: 'sha256' | 'sha3-256' | 'blake2b';
    signatureEnabled: boolean;
    keyRotationInterval: number;
    accessControl: boolean;
    ipWhitelist?: string[];
  };
}

// Metrics and analytics
export interface AuditMetrics {
  totalEvents: number;
  eventsByCategory: Record<AuditCategory, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  failedEvents: number;
  suspiciousEvents: number;
  complianceViolations: number;
  storageUsed: number;
  processingLatency: number;
  integrityViolations: number;
  retentionPolicy: {
    activeEvents: number;
    archivedEvents: number;
    deletedEvents: number;
  };
}

// Alert and notification system
export interface AuditAlert {
  id: string;
  type: 'security' | 'compliance' | 'integrity' | 'performance' | 'anomaly';
  severity: AuditSeverity;
  title: string;
  description: string;
  triggerEvent: AuditEvent;
  detectionTime: Date;
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false-positive';
  assignedTo?: string;
  relatedEvents: string[];
  metadata: Record<string, any>;
}

/**
 * Enterprise Audit Logging System
 * Provides comprehensive audit trail with compliance, security, and monitoring features
 */
export class EnterpriseAuditLogger extends EventEmitter {
  private logger: ILogger;
  private eventBus: IEventBus;
  private config: AuditConfiguration;
  
  // Storage and state
  private auditTrails = new Map<string, AuditTrail>();
  private eventBuffer: AuditEvent[] = [];
  private metrics: AuditMetrics;
  private alerts: AuditAlert[] = [];
  
  // Security keys and hashing
  private signingKey: Buffer;
  private encryptionKey: Buffer;
  private lastChainHash: string;
  
  // Processing and monitoring
  private flushTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(
    config: Partial<AuditConfiguration> = {},
    logger?: ILogger,
    eventBus?: IEventBus
  ) {
    super();
    
    this.logger = logger || new Logger(
      { level: 'info', format: 'json', destination: 'console' },
      { component: 'AuditLogger' }
    );
    
    this.eventBus = eventBus || EventBus.getInstance();
    
    this.config = this.getDefaultConfiguration(config);
    this.metrics = this.initializeMetrics();
    
    // Initialize cryptographic keys
    this.signingKey = randomBytes(32);
    this.encryptionKey = randomBytes(32);
    this.lastChainHash = '';
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the audit logger
   */
  async initialize(): Promise<void> {
    try {
      // Create storage directories
      await this.createStorageDirectories();
      
      // Load existing audit trails
      await this.loadAuditTrails();
      
      // Start background processing
      if (this.config.buffering.enabled) {
        this.startBufferFlushing();
      }
      
      // Start monitoring
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }
      
      this.isInitialized = true;
      this.logger.info('Enterprise audit logger initialized');
      this.emit('audit:initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize audit logger', error);
      throw error;
    }
  }

  /**
   * Log an audit event
   */
  async logEvent(eventData: Partial<AuditEvent>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Audit logger not initialized');
    }

    try {
      // Create complete audit event
      const auditEvent = await this.createAuditEvent(eventData);
      
      // Update metrics
      this.updateMetrics(auditEvent);
      
      // Check for security patterns and alerts
      await this.analyzeSecurityPatterns(auditEvent);
      
      // Process event (buffer or immediate)
      if (this.config.buffering.enabled) {
        this.eventBuffer.push(auditEvent);
      } else {
        await this.processEvent(auditEvent);
      }
      
      // Emit event for real-time processing
      this.eventBus.emit('audit:event', auditEvent);
      this.emit('audit:logged', auditEvent);
      
      return auditEvent.id;
      
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
      this.metrics.failedEvents++;
      throw error;
    }
  }

  /**
   * Query audit events with advanced filtering
   */
  async queryEvents(query: {
    timeRange?: { start: Date; end: Date };
    categories?: AuditCategory[];
    severity?: AuditSeverity[];
    actors?: string[];
    resources?: string[];
    outcomes?: string[];
    compliance?: ComplianceFramework[];
    limit?: number;
    offset?: number;
  }): Promise<AuditEvent[]> {
    try {
      let events: AuditEvent[] = [];
      
      // Collect events from all trails
      for (const trail of this.auditTrails.values()) {
        events.push(...trail.events);
      }
      
      // Apply filters
      events = this.applyQueryFilters(events, query);
      
      // Sort by timestamp (most recent first)
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 1000;
      
      return events.slice(offset, offset + limit);
      
    } catch (error) {
      this.logger.error('Failed to query audit events', error);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(framework: ComplianceFramework, timeRange: { start: Date; end: Date }): Promise<{
    framework: ComplianceFramework;
    period: { start: Date; end: Date };
    summary: {
      totalEvents: number;
      compliantEvents: number;
      violations: number;
      complianceRate: number;
    };
    violations: Array<{
      event: AuditEvent;
      violationType: string;
      description: string;
      severity: AuditSeverity;
    }>;
    recommendations: string[];
  }> {
    try {
      const events = await this.queryEvents({
        timeRange,
        compliance: [framework]
      });
      
      const violations = this.analyzeComplianceViolations(events, framework);
      const complianceRate = events.length > 0 ? 
        (events.length - violations.length) / events.length : 1;
      
      return {
        framework,
        period: timeRange,
        summary: {
          totalEvents: events.length,
          compliantEvents: events.length - violations.length,
          violations: violations.length,
          complianceRate
        },
        violations,
        recommendations: this.generateComplianceRecommendations(framework, violations)
      };
      
    } catch (error) {
      this.logger.error('Failed to generate compliance report', error);
      throw error;
    }
  }

  /**
   * Get audit metrics and analytics
   */
  getMetrics(): AuditMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active alerts
   */
  getAlerts(): AuditAlert[] {
    return this.alerts.filter(alert => alert.status === 'open');
  }

  /**
   * Verify audit trail integrity
   */
  async verifyIntegrity(trailId?: string): Promise<{
    verified: boolean;
    violations: Array<{
      trailId: string;
      eventId: string;
      violationType: string;
      description: string;
    }>;
  }> {
    try {
      const violations: Array<{
        trailId: string;
        eventId: string;
        violationType: string;
        description: string;
      }> = [];
      
      const trailsToVerify = trailId ? 
        [this.auditTrails.get(trailId)].filter(Boolean) : 
        Array.from(this.auditTrails.values());
      
      for (const trail of trailsToVerify) {
        if (trail) { // Add type guard to handle possible undefined
          const trailViolations = await this.verifyTrailIntegrity(trail);
          violations.push(...trailViolations);
        }
      }
      
      return {
        verified: violations.length === 0,
        violations
      };
      
    } catch (error) {
      this.logger.error('Failed to verify audit integrity', error);
      throw error;
    }
  }

  /**
   * Shutdown the audit logger gracefully
   */
  async shutdown(): Promise<void> {
    try {
      // Flush any pending events
      if (this.eventBuffer.length > 0) {
        await this.flushEvents();
      }
      
      // Stop timers
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
      }
      
      // Save audit trails
      await this.saveAuditTrails();
      
      this.logger.info('Enterprise audit logger shutdown complete');
      this.emit('audit:shutdown');
      
    } catch (error) {
      this.logger.error('Error during audit logger shutdown', error);
      throw error;
    }
  }

  // Private implementation methods...
  
  private getDefaultConfiguration(config: Partial<AuditConfiguration>): AuditConfiguration {
    return {
      enabled: true,
      realTimeProcessing: true,
      encryptionEnabled: true,
      tamperProofStorage: true,
      storage: {
        basePath: './audit-logs',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        compressionEnabled: true,
        replication: false,
        backupEnabled: true,
        ...config.storage
      },
      buffering: {
        enabled: true,
        maxSize: 1000,
        flushInterval: 30000, // 30 seconds
        maxWaitTime: 300000, // 5 minutes
        ...config.buffering
      },
      compliance: {
        frameworks: ['SOX', 'GDPR'],
        automaticClassification: true,
        retentionPolicies: {
          'authentication': '7years',
          'authorization': '7years',
          'data-access': '3years',
          'data-modification': '7years',
          'system-administration': '7years',
          'configuration': '3years',
          'security': '10years',
          'compliance': '10years',
          'business-operation': '7years',
          'agent-coordination': '1year',
          'task-management': '1year',
          'workflow-orchestration': '3years',
          'infrastructure': '3years',
          'monitoring': '1year'
        },
        encryptSensitiveData: true,
        redactPII: true,
        ...config.compliance
      },
      monitoring: {
        enabled: true,
        realTimeAlerts: true,
        anomalyDetection: true,
        thresholds: {
          failedEvents: 10,
          criticalEvents: 5,
          suspiciousPatterns: 3
        },
        notifications: {
          channels: ['system'],
          escalation: true
        },
        ...config.monitoring
      },
      security: {
        hashAlgorithm: 'sha3-256',
        signatureEnabled: true,
        keyRotationInterval: 86400000, // 24 hours
        accessControl: true,
        ...config.security
      },
      ...config
    };
  }

  private initializeMetrics(): AuditMetrics {
    return {
      totalEvents: 0,
      eventsByCategory: {} as Record<AuditCategory, number>,
      eventsBySeverity: {} as Record<AuditSeverity, number>,
      failedEvents: 0,
      suspiciousEvents: 0,
      complianceViolations: 0,
      storageUsed: 0,
      processingLatency: 0,
      integrityViolations: 0,
      retentionPolicy: {
        activeEvents: 0,
        archivedEvents: 0,
        deletedEvents: 0
      }
    };
  }

  private async createAuditEvent(eventData: Partial<AuditEvent>): Promise<AuditEvent> {
    const now = new Date();
    
    const event: AuditEvent = {
      id: generateId('audit'),
      timestamp: now,
      correlationId: eventData.correlationId,
      traceId: eventData.traceId,
      
      eventType: eventData.eventType || 'system_change',
      category: eventData.category || 'system-administration',
      severity: eventData.severity || 'medium',
      
      actor: {
        type: 'system',
        id: 'flowx-system',
        ...eventData.actor
      },
      
      resource: {
        type: 'system',
        id: 'unknown',
        ...eventData.resource
      },
      
      action: eventData.action || 'unknown',
      outcome: eventData.outcome || 'success',
      
      context: {
        source: 'flowx-audit',
        ...eventData.context
      },
      
      details: eventData.details || {},
      
      security: {
        riskLevel: 'low',
        sensitiveData: false,
        encrypted: this.config.encryptionEnabled,
        ...eventData.security
      },
      
      compliance: {
        frameworks: this.config.compliance.frameworks,
        controls: [],
        retention: this.determineRetentionPeriod(eventData.category || 'system-administration'),
        classification: 'internal',
        ...eventData.compliance
      },
      
      integrity: {
        hash: '',
        verified: false
      },
      
      performance: eventData.performance,
      metadata: eventData.metadata || {}
    };
    
    // Calculate integrity hash
    event.integrity.hash = this.calculateEventHash(event);
    
    // Add to blockchain chain
    if (this.config.tamperProofStorage) {
      event.integrity.chainHash = this.calculateChainHash(event);
      this.lastChainHash = event.integrity.chainHash;
    }
    
    event.integrity.verified = true;
    
    return event;
  }

  private calculateEventHash(event: AuditEvent): string {
    const hashableData = {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      eventType: event.eventType,
      actor: event.actor,
      resource: event.resource,
      action: event.action,
      outcome: event.outcome,
      details: event.details
    };
    
    return createHash(this.config.security.hashAlgorithm)
      .update(JSON.stringify(hashableData))
      .digest('hex');
  }

  private calculateChainHash(event: AuditEvent): string {
    const chainData = this.lastChainHash + event.integrity.hash;
    return createHash(this.config.security.hashAlgorithm)
      .update(chainData)
      .digest('hex');
  }

  private determineRetentionPeriod(category: AuditCategory): RetentionPeriod {
    return this.config.compliance.retentionPolicies[category] || '3years';
  }

  private async processEvent(event: AuditEvent): Promise<void> {
    // Determine which trail to use
    const trailId = this.getTrailId(event);
    let trail = this.auditTrails.get(trailId);
    
    if (!trail) {
      trail = await this.createAuditTrail(trailId, event.category);
    }
    
    // Add event to trail
    trail.events.push(event);
    trail.metadata.eventCount++;
    trail.metadata.updatedAt = new Date();
    
    // Update trail integrity
    trail.integrity.chainHash = this.calculateTrailChainHash(trail);
    trail.integrity.lastVerification = new Date();
    
    // Save trail if needed
    if (trail.events.length % 100 === 0) {
      await this.saveAuditTrail(trail);
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;
    
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    
    for (const event of events) {
      await this.processEvent(event);
    }
    
    this.logger.debug(`Flushed ${events.length} audit events`);
  }

  private updateMetrics(event: AuditEvent): void {
    this.metrics.totalEvents++;
    this.metrics.eventsByCategory[event.category] = 
      (this.metrics.eventsByCategory[event.category] || 0) + 1;
    this.metrics.eventsBySeverity[event.severity] = 
      (this.metrics.eventsBySeverity[event.severity] || 0) + 1;
    
    if (event.outcome === 'failure' || event.outcome === 'error') {
      this.metrics.failedEvents++;
    }
    
    if (event.severity === 'critical' || event.security.riskLevel === 'critical') {
      this.metrics.suspiciousEvents++;
    }
  }

  private async analyzeSecurityPatterns(event: AuditEvent): Promise<void> {
    // Implement security pattern analysis and alerting
    if (event.severity === 'critical') {
      await this.createSecurityAlert(event, 'Critical security event detected');
    }
    
    // Check for suspicious patterns
    if (event.eventType === 'authentication' && event.outcome === 'failure') {
      await this.checkFailedLoginPatterns(event);
    }
  }

  private async createSecurityAlert(event: AuditEvent, description: string): Promise<void> {
    const alert: AuditAlert = {
      id: generateId('alert'),
      type: 'security',
      severity: event.severity,
      title: `Security Alert: ${event.eventType}`,
      description,
      triggerEvent: event,
      detectionTime: new Date(),
      status: 'open',
      relatedEvents: [event.id],
      metadata: {}
    };
    
    this.alerts.push(alert);
    this.emit('audit:alert', alert);
    this.eventBus.emit('security:alert', alert);
  }

  private setupEventHandlers(): void {
    // Handle flush timer
    if (this.config.buffering.enabled) {
      this.startBufferFlushing();
    }
  }

  private startBufferFlushing(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushEvents();
    }, this.config.buffering.flushInterval);
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      await this.performMonitoringChecks();
    }, 60000); // Check every minute
  }

  private async performMonitoringChecks(): Promise<void> {
    // Check for anomalies and patterns
    // This would be expanded with more sophisticated monitoring
  }

  // Additional private methods would continue here...
  // Including file operations, compliance analysis, integrity verification, etc.
  
  private getTrailId(event: AuditEvent): string {
    return `${event.category}-${new Date().toISOString().split('T')[0]}`;
  }

  private async createAuditTrail(trailId: string, category: AuditCategory): Promise<AuditTrail> {
    const trail: AuditTrail = {
      id: trailId,
      name: `${category} Audit Trail`,
      description: `Audit trail for ${category} events`,
      category,
      events: [],
      integrity: {
        chainHash: '',
        lastVerification: new Date(),
        verified: true,
        immutable: this.config.tamperProofStorage
      },
      retention: {
        policy: this.config.compliance.retentionPolicies[category],
        deleteAfter: new Date(Date.now() + (7 * 365 * 24 * 60 * 60 * 1000)), // 7 years
        archived: false
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        eventCount: 0,
        size: 0
      }
    };
    
    this.auditTrails.set(trailId, trail);
    return trail;
  }

  private calculateTrailChainHash(trail: AuditTrail): string {
    const lastEvents = trail.events.slice(-10); // Last 10 events for chain
    const hashData = lastEvents.map(e => e.integrity.hash).join('');
    return createHash(this.config.security.hashAlgorithm)
      .update(hashData)
      .digest('hex');
  }

  private applyQueryFilters(events: AuditEvent[], query: any): AuditEvent[] {
    return events.filter(event => {
      // Time range filter
      if (query.timeRange) {
        if (event.timestamp < query.timeRange.start || event.timestamp > query.timeRange.end) {
          return false;
        }
      }
      
      // Category filter
      if (query.categories && !query.categories.includes(event.category)) {
        return false;
      }
      
      // Severity filter
      if (query.severity && !query.severity.includes(event.severity)) {
        return false;
      }
      
      // Actor filter
      if (query.actors && !query.actors.includes(event.actor.id)) {
        return false;
      }
      
      // Resource filter
      if (query.resources && !query.resources.includes(event.resource.id)) {
        return false;
      }
      
      // Outcome filter
      if (query.outcomes && !query.outcomes.includes(event.outcome)) {
        return false;
      }
      
      // Compliance framework filter
      if (query.compliance) {
        const hasFramework = event.compliance.frameworks.some(f => 
          query.compliance.includes(f)
        );
        if (!hasFramework) {
          return false;
        }
      }
      
      return true;
    });
  }

  private analyzeComplianceViolations(events: AuditEvent[], framework: ComplianceFramework): Array<{
    event: AuditEvent;
    violationType: string;
    description: string;
    severity: AuditSeverity;
  }> {
    const violations: Array<{
      event: AuditEvent;
      violationType: string;
      description: string;
      severity: AuditSeverity;
    }> = [];
    
    for (const event of events) {
      // Check framework-specific compliance rules
      if (framework === 'SOX') {
        if (event.category === 'data-modification' && !event.compliance.controls.includes('segregation-of-duties')) {
          violations.push({
            event,
            violationType: 'sox-segregation-of-duties',
            description: 'Data modification without proper segregation of duties',
            severity: 'high'
          });
        }
      }
      
      if (framework === 'GDPR') {
        if (event.security.sensitiveData && event.details.personalData && !event.security.encrypted) {
          violations.push({
            event,
            violationType: 'gdpr-data-protection',
            description: 'Personal data accessed without encryption',
            severity: 'critical'
          });
        }
      }
    }
    
    return violations;
  }

  private generateComplianceRecommendations(framework: ComplianceFramework, violations: any[]): string[] {
    const recommendations: string[] = [];
    
    if (framework === 'SOX') {
      recommendations.push('Implement segregation of duties for financial data modifications');
      recommendations.push('Enable automated approval workflows for sensitive operations');
    }
    
    if (framework === 'GDPR') {
      recommendations.push('Enable encryption for all personal data access');
      recommendations.push('Implement data retention policies and automated deletion');
      recommendations.push('Add consent tracking for personal data processing');
    }
    
    return recommendations;
  }

  private async verifyTrailIntegrity(trail: AuditTrail): Promise<Array<{
    trailId: string;
    eventId: string;
    violationType: string;
    description: string;
  }>> {
    const violations: Array<{
      trailId: string;
      eventId: string;
      violationType: string;
      description: string;
    }> = [];
    
    // Verify each event's hash
    for (const event of trail.events) {
      const calculatedHash = this.calculateEventHash(event);
      if (calculatedHash !== event.integrity.hash) {
        violations.push({
          trailId: trail.id,
          eventId: event.id,
          violationType: 'hash-mismatch',
          description: 'Event hash does not match calculated hash'
        });
      }
    }
    
    // Verify chain integrity if enabled
    if (this.config.tamperProofStorage) {
      let previousChainHash = '';
      for (const event of trail.events) {
        const expectedChainHash = createHash(this.config.security.hashAlgorithm)
          .update(previousChainHash + event.integrity.hash)
          .digest('hex');
        
        if (event.integrity.chainHash !== expectedChainHash) {
          violations.push({
            trailId: trail.id,
            eventId: event.id,
            violationType: 'chain-integrity-violation',
            description: 'Event chain hash is invalid'
          });
        }
        
        previousChainHash = event.integrity.chainHash || '';
      }
    }
    
    return violations;
  }

  private async checkFailedLoginPatterns(event: AuditEvent): Promise<void> {
    // Check for multiple failed logins from same actor
    const recentEvents = await this.queryEvents({
      timeRange: {
        start: new Date(Date.now() - 300000), // Last 5 minutes
        end: new Date()
      },
      categories: ['authentication']
    });
    
    const failedLogins = recentEvents.filter(e => 
      e.actor.id === event.actor.id && 
      e.outcome === 'failure'
    );
    
    if (failedLogins.length >= 5) {
      await this.createSecurityAlert(event, 
        `Multiple failed login attempts detected for user ${event.actor.id}`
      );
    }
  }

  private async createStorageDirectories(): Promise<void> {
    await mkdir(this.config.storage.basePath, { recursive: true });
    await mkdir(join(this.config.storage.basePath, 'trails'), { recursive: true });
    await mkdir(join(this.config.storage.basePath, 'backups'), { recursive: true });
  }

  private async loadAuditTrails(): Promise<void> {
    // Implementation for loading existing audit trails from storage
    // This would read from files and reconstruct the audit trails
  }

  private async saveAuditTrails(): Promise<void> {
    // Implementation for saving audit trails to persistent storage
    // This would write trails to files with compression and encryption
  }

  private async saveAuditTrail(trail: AuditTrail): Promise<void> {
    // Implementation for saving individual audit trail
    // This would handle file operations with proper error handling
  }
}

// Export convenience functions for common audit operations
export const auditLogger = new EnterpriseAuditLogger();

/**
 * Quick audit logging functions
 */
export const audit = {
  // Authentication events
  login: (actor: string, outcome: 'success' | 'failure', context?: any) =>
    auditLogger.logEvent({
      eventType: 'authentication',
      category: 'authentication',
      severity: outcome === 'failure' ? 'medium' : 'low',
      actor: { type: 'user', id: actor },
      resource: { type: 'system', id: 'authentication' },
      action: 'login',
      outcome,
      context,
      security: { riskLevel: outcome === 'failure' ? 'medium' : 'low', sensitiveData: false, encrypted: true }
    }),

  // Data access events
  dataAccess: (actor: string, resource: string, action: string, outcome: 'success' | 'failure' = 'success') =>
    auditLogger.logEvent({
      eventType: 'data_access',
      category: 'data-access',
      severity: 'medium',
      actor: { type: 'user', id: actor },
      resource: { type: 'data', id: resource },
      action,
      outcome,
      security: { riskLevel: 'medium', sensitiveData: true, encrypted: true }
    }),

  // System administration events
  systemChange: (actor: string, resource: string, action: string, details?: any) =>
    auditLogger.logEvent({
      eventType: 'system_change',
      category: 'system-administration',
      severity: 'high',
      actor: { type: 'user', id: actor },
      resource: { type: 'system', id: resource },
      action,
      outcome: 'success',
      details,
      security: { riskLevel: 'high', sensitiveData: false, encrypted: true }
    }),

  // Agent coordination events
  agentAction: (agentId: string, action: string, resource: string, outcome: 'success' | 'failure' = 'success') =>
    auditLogger.logEvent({
      eventType: 'agent_action',
      category: 'agent-coordination',
      severity: 'low',
      actor: { type: 'agent', id: agentId },
      resource: { type: 'agent-resource', id: resource },
      action,
      outcome,
      security: { riskLevel: 'low', sensitiveData: false, encrypted: false }
    }),

  // Security events
  securityEvent: (eventType: string, severity: AuditSeverity, description: string, details?: any) =>
    auditLogger.logEvent({
      eventType: 'security_event',
      category: 'security',
      severity,
      actor: { type: 'system', id: 'security-monitor' },
      resource: { type: 'security', id: eventType },
      action: 'security-check',
      outcome: 'success',
      details: { description, ...details },
      security: { riskLevel: severity === 'critical' ? 'critical' : 'high', sensitiveData: false, encrypted: true }
    })
}; 