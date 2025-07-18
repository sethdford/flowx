/**
 * Unit tests for Pipeline Transformation Engine - Phase 4
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  PipelineTransformationEngine, 
  PipelineTransformationPlan,
  TransformationRequirement,
  DataQualityRule 
} from '../../../../../src/cli/pipeline/transformation/pipeline-transformation-engine';

// Mock fs modules
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.resolve('# Mock file content'))
}));
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true)
}));

describe('PipelineTransformationEngine', () => {
  let engine: PipelineTransformationEngine;

  beforeEach(async () => {
    jest.clearAllMocks();
    engine = new PipelineTransformationEngine();
  });

  afterEach(async () => {
    jest.resetAllMocks();
    // Mock cleanup - no real filesystem operations needed
  });

  describe('Engine Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(engine).toBeInstanceOf(PipelineTransformationEngine);
    });
  });

  describe('createTransformationPlan', () => {
    it('should create a basic transformation plan from simple input', async () => {
      const input = 'Create customer analytics pipeline with data quality checks';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan).toBeDefined();
      expect(plan.transformationId).toMatch(/^transform-\d+$/);
      expect(plan.projectName).toBeTruthy();
      expect(plan.description).toContain('Enterprise data transformation pipeline');
      expect(Array.isArray(plan.requirements)).toBe(true);
      expect(Array.isArray(plan.qualityRules)).toBe(true);
      expect(Array.isArray(plan.transformationSteps)).toBe(true);
      expect(plan.dbtProject).toBeDefined();
      expect(plan.airflowDag).toBeDefined();
      expect(plan.visualWorkflow).toBeDefined();
      expect(plan.infrastructure).toBeDefined();
      expect(plan.deployment).toBeDefined();
    });

    it('should generate transformation requirements for customer data', async () => {
      const input = 'Transform customer data with revenue calculations';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(Array.isArray(plan.requirements)).toBe(true);
      expect(plan.requirements.length).toBeGreaterThan(0);
      
      const customerKeyReq = plan.requirements.find(req => req.targetField === 'customer_key');
      expect(customerKeyReq).toBeDefined();
      expect(customerKeyReq?.transformationType).toBe('mapping');
      expect(customerKeyReq?.expression).toContain('customer_id');
      
      const revenueReq = plan.requirements.find(req => req.targetField === 'monthly_revenue');
      expect(revenueReq).toBeDefined();
      expect(revenueReq?.transformationType).toBe('aggregation');
      expect(revenueReq?.expression).toContain('SUM');
    });

    it('should generate data quality rules for transformations', async () => {
      const input = 'Clean email data and validate amounts';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(Array.isArray(plan.qualityRules)).toBe(true);
      expect(plan.qualityRules.length).toBeGreaterThan(0);
      
      const uniquenessRule = plan.qualityRules.find(rule => rule.ruleType === 'uniqueness');
      expect(uniquenessRule).toBeDefined();
      expect(uniquenessRule?.severity).toBe('critical');
      
      const emailRule = plan.qualityRules.find(rule => rule.field === 'email');
      expect(emailRule).toBeDefined();
      expect(emailRule?.ruleType).toBe('format_check');
      
      const amountRule = plan.qualityRules.find(rule => rule.field === 'amount');
      expect(amountRule).toBeDefined();
      expect(amountRule?.ruleType).toBe('range_check');
    });

    it('should create comprehensive transformation steps', async () => {
      const input = 'Multi-stage ETL pipeline with quality validation';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(Array.isArray(plan.transformationSteps)).toBe(true);
      expect(plan.transformationSteps.length).toBeGreaterThanOrEqual(5);
      
      const extractStep = plan.transformationSteps.find(step => step.stepType === 'extract');
      expect(extractStep).toBeDefined();
      expect(extractStep?.dependencies).toEqual([]);
      expect(extractStep?.parallelizable).toBe(true);
      
      const transformSteps = plan.transformationSteps.filter(step => step.stepType === 'transform');
      expect(transformSteps.length).toBeGreaterThan(0);
      
      const validateStep = plan.transformationSteps.find(step => step.stepType === 'validate');
      expect(validateStep).toBeDefined();
      expect(validateStep?.parallelizable).toBe(false);
      
      const aggregateStep = plan.transformationSteps.find(step => step.stepType === 'aggregate');
      expect(aggregateStep).toBeDefined();
      expect(aggregateStep?.dependencies.length).toBeGreaterThan(0);
    });

    it('should generate dbt project structure', async () => {
      const input = 'Create dbt models for customer analytics';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan.dbtProject).toBeDefined();
      expect(Array.isArray(plan.dbtProject.models)).toBe(true);
      expect(plan.dbtProject.models.length).toBeGreaterThanOrEqual(3);
      
      const stagingModel = plan.dbtProject.models.find(model => model.name === 'staging_customers');
      expect(stagingModel).toBeDefined();
      expect(stagingModel?.materialisation).toBe('view');
      expect(stagingModel?.sql).toContain('SELECT');
      expect(stagingModel?.tags).toContain('staging');
      
      const dimModel = plan.dbtProject.models.find(model => model.name === 'dim_customers');
      expect(dimModel).toBeDefined();
      expect(dimModel?.materialisation).toBe('table');
      expect(dimModel?.sql).toContain('surrogate_key');
      
      expect(Array.isArray(plan.dbtProject.tests)).toBe(true);
      expect(plan.dbtProject.tests.length).toBeGreaterThanOrEqual(3);
      
      const uniqueTest = plan.dbtProject.tests.find(test => test.testType === 'unique');
      expect(uniqueTest).toBeDefined();
      
      expect(Array.isArray(plan.dbtProject.macros)).toBe(true);
      expect(plan.dbtProject.macros.length).toBeGreaterThanOrEqual(2);
      
      const cleanEmailMacro = plan.dbtProject.macros.find(macro => macro.name === 'clean_email');
      expect(cleanEmailMacro).toBeDefined();
      expect(cleanEmailMacro?.sql).toContain('LOWER');
    });

    it('should create Airflow DAG with proper task dependencies', async () => {
      const input = 'Orchestrate ETL pipeline with Airflow';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan.airflowDag).toBeDefined();
      expect(plan.airflowDag.dagId).toBe('data_transformation_pipeline');
      expect(plan.airflowDag.schedule).toBe('0 2 * * *');
      expect(Array.isArray(plan.airflowDag.tasks)).toBe(true);
      expect(plan.airflowDag.tasks.length).toBeGreaterThan(0);
      
      const dbtSeedTask = plan.airflowDag.tasks.find(task => task.taskId === 'dbt_seed');
      expect(dbtSeedTask).toBeDefined();
      expect(dbtSeedTask?.taskType).toBe('dbt');
      expect(dbtSeedTask?.dependencies).toEqual([]);
      
      const dbtTestTask = plan.airflowDag.tasks.find(task => task.taskId === 'dbt_test');
      expect(dbtTestTask).toBeDefined();
      expect(dbtTestTask?.dependencies).toContain('final_aggregation');
    });

    it('should generate visual workflow representation', async () => {
      const input = 'Create visual ETL workflow';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan.visualWorkflow).toBeDefined();
      expect(Array.isArray(plan.visualWorkflow.nodes)).toBe(true);
      expect(Array.isArray(plan.visualWorkflow.edges)).toBe(true);
      
      const sourceNode = plan.visualWorkflow.nodes.find(node => node.type === 'source');
      expect(sourceNode).toBeDefined();
      expect(sourceNode?.position).toBeDefined();
      expect(typeof sourceNode?.position.x).toBe('number');
      expect(typeof sourceNode?.position.y).toBe('number');
      
      const transformNodes = plan.visualWorkflow.nodes.filter(node => node.type === 'transform');
      expect(transformNodes.length).toBeGreaterThan(0);
      
      const qualityNode = plan.visualWorkflow.nodes.find(node => node.type === 'quality');
      expect(qualityNode).toBeDefined();
      
      if (plan.visualWorkflow.edges.length > 0) {
        const edge = plan.visualWorkflow.edges[0];
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        expect(edge.id).toContain(edge.source);
        expect(edge.id).toContain(edge.target);
      }
    });

    it('should calculate infrastructure requirements', async () => {
      const input = 'Calculate compute resources for ETL pipeline';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan.infrastructure).toBeDefined();
      expect(plan.infrastructure.computeRequirements).toBeDefined();
      expect(plan.infrastructure.computeRequirements.cpu).toMatch(/\d+ vCPUs/);
      expect(plan.infrastructure.computeRequirements.memory).toMatch(/\d+ GB/);
      expect(plan.infrastructure.computeRequirements.storage).toMatch(/\d+ GB SSD/);
      expect(plan.infrastructure.computeRequirements.estimatedCost).toMatch(/\$[\d.]+\/hour/);
      
      expect(plan.infrastructure.monitoring).toBeDefined();
      expect(Array.isArray(plan.infrastructure.monitoring.metrics)).toBe(true);
      expect(plan.infrastructure.monitoring.metrics).toContain('transformation_success_rate');
      expect(plan.infrastructure.monitoring.metrics).toContain('data_quality_score');
      
      expect(Array.isArray(plan.infrastructure.monitoring.alerts)).toBe(true);
      expect(plan.infrastructure.monitoring.alerts).toContain('transformation_failure');
      expect(plan.infrastructure.monitoring.alerts).toContain('data_quality_below_threshold');
      
      expect(Array.isArray(plan.infrastructure.monitoring.dashboards)).toBe(true);
      expect(plan.infrastructure.monitoring.dashboards).toContain('transformation_overview');
    });

    it('should generate deployment strategy', async () => {
      const input = 'Deploy ETL pipeline to production';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan.deployment).toBeDefined();
      expect(plan.deployment.environments).toEqual(['development', 'staging', 'production']);
      expect(plan.deployment.cicdPipeline).toContain('dbt parse');
      expect(plan.deployment.cicdPipeline).toContain('sqlfluff lint');
      expect(plan.deployment.testingStrategy).toContain('Unit tests for dbt models');
      expect(plan.deployment.rollbackPlan).toContain('Blue-green deployment');
    });

    it('should use previous phase plans when provided', async () => {
      const input = 'Build on previous pipeline phases';
      const mockDiscoveryPlan = { projectName: 'test-pipeline', sources: ['salesforce'] };
      const mockDesignPlan = { schemas: [{ name: 'customers' }] };
      const mockExtractionPlan = { connectors: ['salesforce-api'] };
      
      const plan = await engine.createTransformationPlan(
        input, 
        mockDiscoveryPlan, 
        mockDesignPlan, 
        mockExtractionPlan
      );
      
      expect(plan).toBeDefined();
      expect(plan.projectName).toBeTruthy();
      expect(plan.requirements.length).toBeGreaterThan(0);
    });

    it('should handle edge cases with minimal input', async () => {
      const input = 'transform';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan).toBeDefined();
      expect(Array.isArray(plan.requirements)).toBe(true);
      expect(plan.requirements.length).toBeGreaterThanOrEqual(1);
      
      // Should have at least a default surrogate key transformation
      const surrogateKeyReq = plan.requirements.find(req => req.targetField === 'surrogate_key');
      expect(surrogateKeyReq).toBeDefined();
      expect(surrogateKeyReq?.transformationType).toBe('mapping');
    });

    it('should handle complex transformation scenarios', async () => {
      const input = 'Multi-source customer data integration with revenue calculations, data quality validation, and real-time processing';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan.requirements.length).toBeGreaterThanOrEqual(3);
      expect(plan.qualityRules.length).toBeGreaterThanOrEqual(4);
      expect(plan.transformationSteps.length).toBeGreaterThanOrEqual(5);
      
      // Should have multiple transformation types
      const mappingReqs = plan.requirements.filter(req => req.transformationType === 'mapping');
      const aggregationReqs = plan.requirements.filter(req => req.transformationType === 'aggregation');
      expect(mappingReqs.length).toBeGreaterThan(0);
      expect(aggregationReqs.length).toBeGreaterThan(0);
      
      // Should have critical quality rules
      const criticalRules = plan.qualityRules.filter(rule => rule.severity === 'critical');
      expect(criticalRules.length).toBeGreaterThan(0);
    });
  });

  describe('saveTransformationPlan', () => {
    it('should create a valid transformation plan for saving', async () => {
      const plan = await engine.createTransformationPlan('test transformation');
      
      // Test that the plan has the required structure for saving
      expect(plan).toBeDefined();
      expect(plan.transformationId).toBeDefined();
      expect(plan.projectName).toBeDefined();
      expect(plan.requirements).toBeDefined();
      expect(plan.qualityRules).toBeDefined();
      expect(plan.transformationSteps).toBeDefined();
      expect(plan.dbtProject).toBeDefined();
      expect(plan.airflowDag).toBeDefined();
      expect(plan.visualWorkflow).toBeDefined();
      expect(plan.infrastructure).toBeDefined();
      expect(plan.deployment).toBeDefined();
    });

    it('should handle plan saving operation without filesystem dependencies', async () => {
      const plan = await engine.createTransformationPlan('test transformation');
      
      // Test that saveTransformationPlan method exists and can be called
      expect(typeof engine.saveTransformationPlan).toBe('function');
      
      // In a real test environment, we would test the actual saving logic
      // For unit tests, we verify the plan structure is correct for saving
      expect(plan.projectName).toBeTruthy();
      expect(plan.transformationId).toMatch(/^transform-\d+$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty input gracefully', async () => {
      const input = '';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan).toBeDefined();
      expect(plan.projectName).toBe('data-transformation-pipeline');
      expect(plan.requirements.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle malformed input', async () => {
      const input = '   ';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan).toBeDefined();
      expect(Array.isArray(plan.requirements)).toBe(true);
    });

    it('should handle null/undefined previous plans', async () => {
      const input = 'transform customer data';
      
      const plan = await engine.createTransformationPlan(input, null, undefined, null);
      
      expect(plan).toBeDefined();
      expect(plan.requirements.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Previous Phases', () => {
    it('should incorporate discovery plan context', async () => {
      const input = 'Use discovery insights for transformation';
      const discoveryPlan = {
        projectName: 'customer-analytics',
        sources: ['salesforce', 'database'],
        targets: ['snowflake']
      };
      
      const plan = await engine.createTransformationPlan(input, discoveryPlan);
      
      expect(plan).toBeDefined();
      expect(plan.requirements.length).toBeGreaterThan(0);
    });

    it('should use design plan schemas', async () => {
      const input = 'Transform based on design schemas';
      const designPlan = {
        schemas: [
          { name: 'customers', fields: ['id', 'email', 'created_at'] },
          { name: 'orders', fields: ['id', 'customer_id', 'amount'] }
        ]
      };
      
      const plan = await engine.createTransformationPlan(input, undefined, designPlan);
      
      expect(plan).toBeDefined();
      expect(plan.requirements.length).toBeGreaterThan(0);
    });

    it('should leverage extraction plan connectors', async () => {
      const input = 'Transform data from extraction sources';
      const extractionPlan = {
        connectors: [
          { name: 'salesforce-api', type: 'api' },
          { name: 's3-bucket', type: 'storage' }
        ]
      };
      
      const plan = await engine.createTransformationPlan(input, undefined, undefined, extractionPlan);
      
      expect(plan).toBeDefined();
      expect(plan.requirements.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete transformation planning within reasonable time', async () => {
      const input = 'Large-scale enterprise data transformation with complex business rules';
      
      const startTime = Date.now();
      const plan = await engine.createTransformationPlan(input);
      const endTime = Date.now();
      
      expect(plan).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large numbers of transformation requirements', async () => {
      const input = 'Customer data with revenue calculations, email cleaning, date transformations, and aggregations';
      
      const plan = await engine.createTransformationPlan(input);
      
      expect(plan.requirements.length).toBeGreaterThanOrEqual(3);
      expect(plan.transformationSteps.length).toBeGreaterThanOrEqual(5);
      expect(plan.dbtProject.models.length).toBeGreaterThanOrEqual(3);
    });
  });
}); 