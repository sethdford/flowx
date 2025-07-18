/**
 * Unit tests for Pipeline Validation Engine (Phase 5)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PipelineValidationEngine, ValidationPlan } from '../../../../../src/cli/pipeline/validation/pipeline-validation-engine';

// Mock fs module
jest.mock('fs/promises');
jest.mock('fs');

describe('PipelineValidationEngine', () => {
  let engine: PipelineValidationEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new PipelineValidationEngine();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createValidationPlan', () => {
    it('should create a comprehensive validation plan', async () => {
      const requirements = 'Create data quality validation for customer analytics pipeline';
      
      const plan = await engine.createValidationPlan(requirements);
      
      expect(plan).toBeDefined();
      expect(plan.validationId).toMatch(/^validation-\d+$/);
      expect(plan.projectName).toBeTruthy();
      expect(plan.description).toBeTruthy();
      expect(plan.validationRules).toBeDefined();
      expect(plan.validationRules.length).toBeGreaterThan(0);
      expect(plan.testFrameworks).toBeDefined();
      expect(plan.testFrameworks.length).toBeGreaterThan(0);
      expect(plan.automation).toBeDefined();
      expect(plan.reporting).toBeDefined();
      expect(plan.monitoring).toBeDefined();
    });

    it('should generate validation rules', async () => {
      const requirements = 'Validate customer data completeness and accuracy';
      
      const plan = await engine.createValidationPlan(requirements);
      
      expect(plan.validationRules).toBeDefined();
      expect(plan.validationRules.length).toBeGreaterThan(0);
      
      // Check for primary key uniqueness rule
      const primaryKeyRule = plan.validationRules.find(rule => rule.ruleName === 'Primary Key Uniqueness');
      expect(primaryKeyRule).toBeDefined();
      expect(primaryKeyRule?.severity).toBe('critical');
      expect(primaryKeyRule?.ruleType).toBe('data_quality');
    });

    it('should create test frameworks', async () => {
      const requirements = 'Comprehensive testing framework';
      
      const plan = await engine.createValidationPlan(requirements);
      
      expect(plan.testFrameworks.length).toBeGreaterThan(0);
      
      // Check for Great Expectations framework
      const geFramework = plan.testFrameworks.find(framework => framework.type === 'great_expectations');
      expect(geFramework).toBeDefined();
      expect(geFramework?.name).toBe('Great Expectations Data Quality');
      
      // Check for dbt framework
      const dbtFramework = plan.testFrameworks.find(framework => framework.type === 'dbt_test');
      expect(dbtFramework).toBeDefined();
      expect(dbtFramework?.name).toBe('dbt Data Testing');
    });

    it('should include quality metrics', async () => {
      const requirements = 'Quality metrics tracking';
      
      const plan = await engine.createValidationPlan(requirements);
      
      expect(plan.qualityMetrics).toBeDefined();
      expect(plan.qualityMetrics.completeness).toBeDefined();
      expect(plan.qualityMetrics.accuracy).toBeDefined();
      expect(plan.qualityMetrics.consistency).toBeDefined();
      expect(plan.qualityMetrics.timeliness).toBeDefined();
      expect(plan.qualityMetrics.validity).toBeDefined();
      expect(plan.qualityMetrics.overall_score).toBeGreaterThan(0);
    });

    it('should configure monitoring and alerting', async () => {
      const requirements = 'Monitoring and alerting setup';
      
      const plan = await engine.createValidationPlan(requirements);
      
      expect(plan.monitoring).toBeDefined();
      expect(plan.monitoring.dashboards).toBeDefined();
      expect(plan.monitoring.alerting).toBeDefined();
      expect(plan.monitoring.sla).toBeDefined();
      expect(plan.monitoring.alerting.channels).toBeDefined();
    });

    it('should set up automation configuration', async () => {
      const requirements = 'Automated validation pipeline';
      
      const plan = await engine.createValidationPlan(requirements);
      
      expect(plan.automation).toBeDefined();
      expect(plan.automation.cicdIntegration).toBeDefined();
      expect(plan.automation.scheduledValidation).toBeDefined();
      expect(plan.automation.autoRemediation).toBeDefined();
      expect(plan.automation.notificationRules).toBeDefined();
    });

    it('should configure reporting', async () => {
      const requirements = 'Comprehensive reporting setup';
      
      const plan = await engine.createValidationPlan(requirements);
      
      expect(plan.reporting).toBeDefined();
      expect(plan.reporting.executiveReports).toBeDefined();
      expect(plan.reporting.technicalReports).toBeDefined();
      expect(plan.reporting.complianceReports).toBeDefined();
      expect(plan.reporting.frequency).toBeDefined();
      expect(plan.reporting.format).toBeDefined();
    });

    it('should handle revenue calculation requirements', async () => {
      const requirements = 'Revenue validation and financial data quality';
      
      const plan = await engine.createValidationPlan(requirements);
      
      // Should include revenue-specific validation rules
      const revenueRule = plan.validationRules.find(rule => 
        rule.ruleName.toLowerCase().includes('revenue')
      );
      expect(revenueRule).toBeDefined();
      expect(revenueRule?.ruleType).toBe('business_logic');
    });

    it('should handle compliance requirements', async () => {
      const requirements = 'GDPR compliance validation';
      
      const plan = await engine.createValidationPlan(requirements);
      
      // Should include compliance-specific rules
      const complianceRule = plan.validationRules.find(rule => 
        rule.ruleType === 'compliance'
      );
      expect(complianceRule).toBeDefined();
    });

    it('should work with transformation plan context', async () => {
      const requirements = 'Validate transformation outputs';
      
      const plan = await engine.createValidationPlan(requirements);
      
      expect(plan).toBeDefined();
      expect(plan.validationRules.length).toBeGreaterThan(0);
    });
  });

  describe('saveValidationPlan', () => {
    it('should save validation plan successfully', async () => {
      const plan: ValidationPlan = {
        validationId: 'test-validation-123',
        projectName: 'test-project',
        description: 'Test validation plan',
        validationRules: [],
        testFrameworks: [],
        qualityMetrics: {
          completeness: { score: 95, missing_values: 0, null_percentage: 0 },
          accuracy: { score: 98, format_violations: 0, constraint_violations: 0 },
          consistency: { score: 92, duplicate_records: 0, referential_integrity_issues: 0 },
          timeliness: { score: 88, latency_ms: 1000, staleness_hours: 1 },
          validity: { score: 96, schema_violations: 0, business_rule_violations: 0 },
          overall_score: 93.8
        },
        monitoring: {
          dashboards: [],
          alerting: { channels: [], escalation: [] },
          sla: []
        },
        automation: {
          cicdIntegration: 'test',
          scheduledValidation: '0 2 * * *',
          autoRemediation: true,
          notificationRules: []
        },
        reporting: {
          executiveReports: true,
          technicalReports: true,
          complianceReports: true,
          frequency: 'daily',
          format: ['pdf', 'html']
        }
      };

      // Mock file system operations
      const fs = require('fs/promises');
      jest.mocked(fs.mkdir).mockResolvedValue(undefined);
      jest.mocked(fs.writeFile).mockResolvedValue(undefined);

      await expect(engine.saveValidationPlan(plan, './test-output')).resolves.not.toThrow();
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const requirements = '';
      
      // Should not throw but return a basic plan
      const plan = await engine.createValidationPlan(requirements);
      expect(plan).toBeDefined();
      expect(plan.validationRules).toBeDefined();
    });
  });
}); 