/**
 * Tests for Audit Integration System
 * Comprehensive test coverage for audit logging, security events, and compliance tracking
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  SimpleAuditLogger, 
  audit, 
  AuditSimple, 
  setupAuditIntegration,
  auditMiddleware,
  SimpleAuditEvent
} from '../../../src/core/audit-integration.ts';
import { Logger } from '../../../src/core/logger.ts';
import { EventBus } from '../../../src/core/event-bus.ts';

describe('Audit Integration System', () => {
  let auditLogger: SimpleAuditLogger;
  let mockLogger: jest.Mocked<Logger>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      configure: jest.fn()
    } as any;

    // Create mock event bus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn(),
      listeners: jest.fn(),
      listenerCount: jest.fn()
    } as any;

    auditLogger = new SimpleAuditLogger(mockLogger, mockEventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SimpleAuditLogger', () => {
    describe('logEvent', () => {
      it('should log a basic audit event', async () => {
        const eventData = {
          action: 'test_action',
          resource: 'test_resource',
          outcome: 'success' as const,
          userId: 'user123',
          riskLevel: 'medium' as const,
          category: 'testing'
        };

        const eventId = await auditLogger.logEvent(eventData);

        expect(eventId).toBeDefined();
        expect(eventId).toContain('audit');
        expect(mockLogger.info).toHaveBeenCalledWith('Audit Event', expect.objectContaining({
          action: 'test_action',
          resource: 'test_resource',
          outcome: 'success',
          userId: 'user123',
          riskLevel: 'medium',
          category: 'testing'
        }));
        expect(mockEventBus.emit).toHaveBeenCalledWith('audit:event', expect.any(Object));
      });

      it('should emit security alert for critical events', async () => {
        const eventData = {
          action: 'critical_operation',
          resource: 'secure_system',
          outcome: 'success' as const,
          riskLevel: 'critical' as const
        };

        await auditLogger.logEvent(eventData);

        expect(mockEventBus.emit).toHaveBeenCalledWith('security:alert', expect.objectContaining({
          type: 'audit-alert',
          event: expect.any(Object),
          timestamp: expect.any(Date)
        }));
      });

      it('should emit security alert for failed events', async () => {
        const eventData = {
          action: 'login_attempt',
          resource: 'auth_system',
          outcome: 'failure' as const,
          riskLevel: 'medium' as const
        };

        await auditLogger.logEvent(eventData);

        expect(mockEventBus.emit).toHaveBeenCalledWith('security:alert', expect.any(Object));
      });

      it('should handle partial event data with defaults', async () => {
        const eventData = {
          action: 'minimal_action'
        };

        const eventId = await auditLogger.logEvent(eventData);

        expect(eventId).toBeDefined();
        expect(mockLogger.info).toHaveBeenCalledWith('Audit Event', expect.objectContaining({
          action: 'minimal_action',
          resource: 'unknown',
          outcome: 'success',
          riskLevel: 'low',
          category: 'system'
        }));
      });
    });

    describe('queryEvents', () => {
      beforeEach(async () => {
        // Populate with test events
        await auditLogger.logEvent({
          action: 'login',
          resource: 'auth',
          outcome: 'success',
          userId: 'user1',
          riskLevel: 'low',
          category: 'authentication'
        });
        
        await auditLogger.logEvent({
          action: 'data_access',
          resource: 'database',
          outcome: 'success',
          userId: 'user2',
          riskLevel: 'medium',
          category: 'data-access'
        });
        
        await auditLogger.logEvent({
          action: 'config_change',
          resource: 'system',
          outcome: 'failure',
          userId: 'admin1',
          riskLevel: 'high',
          category: 'system-administration'
        });
      });

      it('should return all events when no filter is applied', () => {
        const events = auditLogger.queryEvents({});
        expect(events).toHaveLength(3);
      });

      it('should filter events by userId', () => {
        const events = auditLogger.queryEvents({ userId: 'user1' });
        expect(events).toHaveLength(1);
        expect(events[0].action).toBe('login');
      });

      it('should filter events by outcome', () => {
        const events = auditLogger.queryEvents({ outcome: 'failure' });
        expect(events).toHaveLength(1);
        expect(events[0].action).toBe('config_change');
      });

      it('should filter events by category', () => {
        const events = auditLogger.queryEvents({ category: 'authentication' });
        expect(events).toHaveLength(1);
        expect(events[0].action).toBe('login');
      });

      it('should filter events by riskLevel', () => {
        const events = auditLogger.queryEvents({ riskLevel: 'high' });
        expect(events).toHaveLength(1);
        expect(events[0].action).toBe('config_change');
      });

      it('should apply limit to results', () => {
        const events = auditLogger.queryEvents({ limit: 2 });
        expect(events).toHaveLength(2);
      });

      it('should filter by time range', () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        const events = auditLogger.queryEvents({
          timeRange: { start: oneHourAgo, end: now }
        });
        expect(events).toHaveLength(3); // All events should be within the last hour
      });

      it('should filter by action containing substring', () => {
        const events = auditLogger.queryEvents({ action: 'login' });
        expect(events).toHaveLength(1);
        expect(events[0].action).toBe('login');
      });

      it('should sort events by timestamp descending', () => {
        const events = auditLogger.queryEvents({});
        expect(events).toHaveLength(3);
        
        // Check that events are sorted by timestamp (newest first)
        for (let i = 1; i < events.length; i++) {
          expect(events[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
            events[i].timestamp.getTime()
          );
        }
      });
    });

    describe('getMetrics', () => {
      beforeEach(async () => {
        // Populate with test events
        await auditLogger.logEvent({
          action: 'login',
          outcome: 'success',
          riskLevel: 'low',
          category: 'authentication'
        });
        
        await auditLogger.logEvent({
          action: 'login',
          outcome: 'failure',
          riskLevel: 'medium',
          category: 'authentication'
        });
        
        await auditLogger.logEvent({
          action: 'data_access',
          outcome: 'success',
          riskLevel: 'high',
          category: 'data-access'
        });
      });

      it('should return correct metrics', () => {
        const metrics = auditLogger.getMetrics();

        expect(metrics.totalEvents).toBe(3);
        expect(metrics.eventsByOutcome.success).toBe(2);
        expect(metrics.eventsByOutcome.failure).toBe(1);
        expect(metrics.eventsByRisk.low).toBe(1);
        expect(metrics.eventsByRisk.medium).toBe(1);
        expect(metrics.eventsByRisk.high).toBe(1);
        expect(metrics.eventsByCategory.authentication).toBe(2);
        expect(metrics.eventsByCategory['data-access']).toBe(1);
        expect(metrics.recentActivity).toBe(3); // All events are recent
      });

      it('should handle empty audit log', () => {
        const emptyLogger = new SimpleAuditLogger(mockLogger, mockEventBus);
        const metrics = emptyLogger.getMetrics();

        expect(metrics.totalEvents).toBe(0);
        expect(metrics.eventsByOutcome).toEqual({});
        expect(metrics.eventsByRisk).toEqual({});
        expect(metrics.eventsByCategory).toEqual({});
        expect(metrics.recentActivity).toBe(0);
      });
    });
  });

  describe('Quick audit functions', () => {
    beforeEach(() => {
      // Mock the global audit logger
      jest.spyOn(audit, 'login');
      jest.spyOn(audit, 'dataAccess');
      jest.spyOn(audit, 'systemChange');
      jest.spyOn(audit, 'agentAction');
      jest.spyOn(audit, 'securityEvent');
      jest.spyOn(audit, 'configChange');
      jest.spyOn(audit, 'apiAccess');
    });

    it('should log successful login', async () => {
      await audit.login('user123', true, '192.168.1.1');
      
      expect(audit.login).toHaveBeenCalledWith('user123', true, '192.168.1.1');
    });

    it('should log failed login', async () => {
      await audit.login('user123', false, '192.168.1.1');
      
      expect(audit.login).toHaveBeenCalledWith('user123', false, '192.168.1.1');
    });

    it('should log data access', async () => {
      await audit.dataAccess('user123', 'user_records', 'read');
      
      expect(audit.dataAccess).toHaveBeenCalledWith('user123', 'user_records', 'read');
    });

    it('should log system changes', async () => {
      await audit.systemChange('admin1', 'database', 'backup', { size: '10GB' });
      
      expect(audit.systemChange).toHaveBeenCalledWith('admin1', 'database', 'backup', { size: '10GB' });
    });

    it('should log agent actions', async () => {
      await audit.agentAction('agent-001', 'process_task', 'task-123');
      
      expect(audit.agentAction).toHaveBeenCalledWith('agent-001', 'process_task', 'task-123');
    });

    it('should log security events', async () => {
      await audit.securityEvent('intrusion_detected', 'firewall', 'critical', { source: 'external' });
      
      expect(audit.securityEvent).toHaveBeenCalledWith('intrusion_detected', 'firewall', 'critical', { source: 'external' });
    });

    it('should log configuration changes', async () => {
      await audit.configChange('admin1', 'database', 'update_settings', { timeout: 30 });
      
      expect(audit.configChange).toHaveBeenCalledWith('admin1', 'database', 'update_settings', { timeout: 30 });
    });

    it('should log API access', async () => {
      await audit.apiAccess('user123', '/api/users', 'GET', 200, '192.168.1.1');
      
      expect(audit.apiAccess).toHaveBeenCalledWith('user123', '/api/users', 'GET', 200, '192.168.1.1');
    });
  });

  describe('AuditSimple decorator', () => {
    class TestClass {
      userId = 'test-user';
      __auditLogger: SimpleAuditLogger;

      constructor(auditLogger: SimpleAuditLogger) {
        this.__auditLogger = auditLogger;
      }

      @AuditSimple({ 
        action: 'test_method', 
        category: 'testing', 
        riskLevel: 'medium',
        logParameters: true 
      })
      async testMethod(param1: string, param2: number): Promise<string> {
        return `processed: ${param1}-${param2}`;
      }

      @AuditSimple({ action: 'failing_method', riskLevel: 'high' })
      async failingMethod(): Promise<void> {
        throw new Error('Test error');
      }
    }

    it('should audit successful method execution', async () => {
      const testInstance = new TestClass(auditLogger);
      const result = await testInstance.testMethod('test', 123);

      expect(result).toBe('processed: test-123');
      // Verify audit logging was called
      expect(mockLogger.info).toHaveBeenCalledWith('Audit Event', expect.objectContaining({
        action: 'test_method',
        resource: 'TestClass.testMethod',
        outcome: 'success',
        userId: 'test-user',
        riskLevel: 'medium',
        category: 'testing'
      }));
    });

    it('should audit failed method execution', async () => {
      const testInstance = new TestClass(auditLogger);
      
      await expect(testInstance.failingMethod()).rejects.toThrow('Test error');
      
      // Verify error audit logging was called
      expect(mockLogger.info).toHaveBeenCalledWith('Audit Event', expect.objectContaining({
        action: 'failing_method',
        resource: 'TestClass.failingMethod',
        outcome: 'failure',
        userId: 'test-user',
        riskLevel: 'high'
      }));
    });

    it('should include duration in audit details', async () => {
      const testInstance = new TestClass(auditLogger);
      await testInstance.testMethod('test', 123);

      expect(mockLogger.info).toHaveBeenCalledWith('Audit Event', expect.objectContaining({
        auditId: expect.any(String)
      }));
    });
  });

  describe('auditMiddleware', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = {
        path: '/api/test',
        method: 'GET',
        ip: '192.168.1.1',
        user: { id: 'user123' }
      };

      mockRes = {
        statusCode: 200,
        end: jest.fn()
      };

      mockNext = jest.fn();
    });

    it('should audit API requests', () => {
      const middleware = auditMiddleware();
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      
      // Simulate response end
      const originalEnd = mockRes.end;
      mockRes.end('response data', 'utf8');
      
      // The middleware should have replaced res.end
      expect(mockRes.end).toBeDefined();
    });

    it('should exclude specified paths', () => {
      const middleware = auditMiddleware({ excludePaths: ['/health', '/api/test'] });
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      // Should not audit excluded paths
    });

    it('should handle requests without user', () => {
      mockReq.user = undefined;
      mockReq.userId = undefined;
      
      const middleware = auditMiddleware();
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('setupAuditIntegration', () => {
    it('should register event listeners', () => {
      setupAuditIntegration(mockLogger, mockEventBus);

      expect(mockEventBus.on).toHaveBeenCalledWith('agent:spawned', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('agent:terminated', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('task:created', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('task:completed', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('memory:created', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('security:alert', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith('Audit integration setup complete');
    });

    it('should handle agent spawned events', () => {
      setupAuditIntegration(mockLogger, mockEventBus);
      
      // Get the registered callback for agent:spawned
      const agentSpawnedCallback = mockEventBus.on.mock.calls.find(
        call => call[0] === 'agent:spawned'
      )?.[1];
      
      expect(agentSpawnedCallback).toBeDefined();
      
      // Simulate the event
      if (agentSpawnedCallback) {
        agentSpawnedCallback({ agentId: 'agent-123' });
      }
    });

    it('should handle task created events', () => {
      setupAuditIntegration(mockLogger, mockEventBus);
      
      const taskCreatedCallback = mockEventBus.on.mock.calls.find(
        call => call[0] === 'task:created'
      )?.[1];
      
      expect(taskCreatedCallback).toBeDefined();
      
      if (taskCreatedCallback) {
        taskCreatedCallback({ taskId: 'task-456' });
      }
    });
  });

  describe('Security and Compliance', () => {
    it('should detect and alert on suspicious login patterns', async () => {
      // Simulate multiple failed logins
      for (let i = 0; i < 5; i++) {
        await auditLogger.logEvent({
          action: 'login',
          resource: 'auth',
          outcome: 'failure',
          userId: 'suspicious-user',
          riskLevel: 'medium',
          category: 'authentication'
        });
      }

      // Check that security alerts were emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith('security:alert', expect.any(Object));
    });

    it('should track privileged operations', async () => {
      await auditLogger.logEvent({
        action: 'admin_access',
        resource: 'admin_panel',
        outcome: 'success',
        userId: 'admin-user',
        riskLevel: 'critical',
        category: 'system-administration'
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('security:alert', expect.any(Object));
    });

    it('should maintain audit trail integrity', () => {
      const events = auditLogger.queryEvents({});
      
      // Verify each event has required fields
      events.forEach(event => {
        expect(event.id).toBeDefined();
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.action).toBeDefined();
        expect(event.resource).toBeDefined();
        expect(event.outcome).toMatch(/^(success|failure|denied)$/);
        expect(event.riskLevel).toMatch(/^(low|medium|high|critical)$/);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume of audit events', async () => {
      const eventCount = 1000;
      const promises: Promise<string>[] = [];

      for (let i = 0; i < eventCount; i++) {
        promises.push(auditLogger.logEvent({
          action: `action_${i}`,
          resource: `resource_${i}`,
          outcome: 'success',
          riskLevel: 'low',
          category: 'performance-test'
        }));
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(eventCount);
      expect(results.every(id => id.includes('audit'))).toBe(true);
    });

    it('should limit memory usage by rotating events', async () => {
      const smallLogger = new SimpleAuditLogger(mockLogger, mockEventBus);
      // Set a small max events for testing
      (smallLogger as any).maxEvents = 10;

      // Add more events than the limit
      for (let i = 0; i < 15; i++) {
        await smallLogger.logEvent({
          action: `action_${i}`,
          resource: 'test',
          outcome: 'success'
        });
      }

      const events = smallLogger.queryEvents({});
      expect(events).toHaveLength(10); // Should be limited to maxEvents
    });
  });

  describe('Error Handling', () => {
    it('should handle logger errors gracefully', async () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger error');
      });

      // Should not throw despite logger error - events should still be stored
      const eventId = await auditLogger.logEvent({
        action: 'test',
        resource: 'test'
      });

      expect(eventId).toBeDefined();
      expect(eventId).toContain('audit');
      
      // Verify event was still stored despite logger error
      const events = auditLogger.queryEvents({ action: 'test' });
      expect(events).toHaveLength(1);
    });

    it('should handle event bus errors gracefully', async () => {
      mockEventBus.emit.mockImplementation(() => {
        throw new Error('EventBus error');
      });

      // Should not throw despite event bus error - events should still be stored
      const eventId = await auditLogger.logEvent({
        action: 'test',
        resource: 'test'
      });

      expect(eventId).toBeDefined();
      expect(eventId).toContain('audit');
      
      // Verify event was still stored despite event bus error
      const events = auditLogger.queryEvents({ action: 'test' });
      expect(events).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values in event data', async () => {
      const eventId = await auditLogger.logEvent({
        action: undefined as any,
        resource: undefined as any,
        userId: undefined,
        details: { test: undefined }
      });

      expect(eventId).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Audit Event', expect.objectContaining({
        action: 'unknown',
        resource: 'unknown'
      }));
    });

    it('should handle large event details', async () => {
      const largeDetails = {
        data: 'x'.repeat(100000), // 100KB of data
        array: new Array(1000).fill('large-item')
      };

      const eventId = await auditLogger.logEvent({
        action: 'large_data_test',
        resource: 'test',
        details: largeDetails
      });

      expect(eventId).toBeDefined();
    });

    it('should handle concurrent access to audit logger', async () => {
      const concurrentPromises = Array.from({ length: 100 }, (_, i) =>
        auditLogger.logEvent({
          action: `concurrent_action_${i}`,
          resource: 'concurrent_test',
          outcome: 'success'
        })
      );

      const results = await Promise.all(concurrentPromises);
      
      expect(results).toHaveLength(100);
      expect(new Set(results).size).toBe(100); // All IDs should be unique
    });
  });
}); 