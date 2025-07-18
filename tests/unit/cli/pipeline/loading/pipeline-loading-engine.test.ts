/**
 * Unit tests for Pipeline Loading Engine (Phase 6)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PipelineLoadingEngine, LoadingPlan, DestinationConfig, LoadingStrategy } from '../../../../../src/cli/pipeline/loading/pipeline-loading-engine';
import { Logger } from '../../../../../src/core/logger';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Mock dependencies
jest.mock('../../../../../src/core/logger');
jest.mock('fs/promises');
jest.mock('fs');

describe('PipelineLoadingEngine', () => {
  let engine: PipelineLoadingEngine;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    engine = new PipelineLoadingEngine();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateLoadingPlan', () => {
    it('should generate comprehensive loading plan for Snowflake destination', async () => {
      const requirements = 'Load customer analytics data to Snowflake with real-time streaming';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan).toBeDefined();
      expect(plan.id).toMatch(/pipeline-loading-\d+/);
      expect(plan.metadata.title).toContain('Load customer analytics data to');
      expect(plan.destinations).toHaveLength(1);
      expect(plan.destinations[0].type).toBe('snowflake');
      expect(plan.loadingStrategy.strategy).toBe('streaming');
      expect(plan.governance.encryption.atRest).toBe(true);
      expect(plan.orchestration.framework).toBe('airflow');
      expect(mockLogger.info).toHaveBeenCalledWith('Generating loading plan', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('Loading plan generated successfully', expect.any(Object));
    });

    it('should optimize for Redshift with batch strategy', async () => {
      const requirements = 'Bulk load historical data to Redshift warehouse for analytics';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.destinations[0].type).toBe('redshift');
      expect(plan.loadingStrategy.strategy).toBe('bulk');
      expect(plan.loadingStrategy.batchSize).toBe(100000); // Larger for data warehouses
      expect(plan.loadingStrategy.parallelism).toBe(16); // Higher for bulk
      expect(plan.performance.memoryAllocation).toBe('8GB');
    });

    it('should configure multiple destinations for data lake architecture', async () => {
      const requirements = 'Load data to S3 data lake and BigQuery for multi-cloud analytics';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.destinations).toHaveLength(2);
      const destinationTypes = plan.destinations.map(d => d.type);
      expect(destinationTypes).toContain('s3');
      expect(destinationTypes).toContain('bigquery');
      
      const s3Config = plan.destinations.find(d => d.type === 's3');
      expect(s3Config?.partitioning?.columns).toEqual(['year', 'month', 'day']);
      
      const bqConfig = plan.destinations.find(d => d.type === 'bigquery');
      expect(bqConfig?.clustering?.columns).toEqual(['customer_id', 'product_id']);
    });

    it('should enable compliance features for regulated industries', async () => {
      const requirements = 'Load healthcare data with HIPAA compliance and GDPR requirements';
      const options = { compliance: true };
      
      const plan = await engine.generateLoadingPlan(requirements, options);

      expect(plan.governance.compliance.hipaa).toBe(true);
      expect(plan.governance.compliance.gdpr).toBe(true);
      expect(plan.governance.access.columnLevel).toBe(true);
      expect(plan.governance.access.rowLevel).toBe(true);
      expect(plan.governance.access.masking).toContain('email');
      expect(plan.governance.auditing.logLevel).toBe('comprehensive');
    });

    it('should generate implementation code when requested', async () => {
      const requirements = 'Load customer data to PostgreSQL';
      const options = { generateCode: true, outputPath: './test-output' };
      
      (mkdir as jest.MockedFunction<typeof mkdir>).mockResolvedValue(undefined);
      (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

      await engine.generateLoadingPlan(requirements, options);

      expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('code'), { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('pipeline_loader.py'), expect.stringContaining('Enterprise Data Pipeline Loader'));
      expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('Dockerfile'), expect.stringContaining('FROM python:3.11-slim'));
      expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('requirements.txt'), expect.stringContaining('pandas>=2.0.0'));
      expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('loading_dag.py'), expect.stringContaining('Airflow DAG for Pipeline Loading'));
    });

    it('should save plan to specified output path', async () => {
      const requirements = 'Load data to warehouse';
      const options = { outputPath: './test-plan.json' };
      
      (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

      await engine.generateLoadingPlan(requirements, options);

      expect(writeFile).toHaveBeenCalledWith('./test-plan.json', expect.stringContaining('"metadata"'));
    });

    it('should handle incremental loading strategy', async () => {
      const requirements = 'Incremental load of delta changes to data warehouse';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.loadingStrategy.strategy).toBe('incremental');
      expect(plan.loadingStrategy.errorHandling).toBe('retry');
      expect(plan.loadingStrategy.retryConfig?.maxRetries).toBe(3);
      expect(plan.loadingStrategy.retryConfig?.backoffStrategy).toBe('exponential');
    });

    it('should configure monitoring and alerting', async () => {
      const requirements = 'Load critical business data with SLA monitoring';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.monitoring.metrics).toContain('loading_duration');
      expect(plan.monitoring.metrics).toContain('records_loaded');
      expect(plan.monitoring.metrics).toContain('error_rate');
      expect(plan.monitoring.alerts).toHaveLength(3);
      
      const durationAlert = plan.monitoring.alerts.find(a => a.condition.includes('loading_duration'));
      expect(durationAlert?.threshold).toBe(1800);
      expect(durationAlert?.action).toBe('notify_team');
    });

    it('should generate appropriate infrastructure for cloud destinations', async () => {
      const requirements = 'Load to Snowflake and S3 with high performance';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.implementation.infrastructure).toContain('Terraform Infrastructure');
      expect(plan.implementation.infrastructure).toContain('aws_ecs_task_definition');
      expect(plan.implementation.infrastructure).toContain('snowflake');
      expect(plan.implementation.deployment).toContain('AWS ECS Fargate');
      expect(plan.implementation.testing).toContain('Integration Tests');
    });

    it('should handle error scenarios gracefully', async () => {
      const requirements = '';
      
      // Mock an error in the internal process
      const originalAnalyze = (engine as any).analyzeDestinationRequirements;
      (engine as any).analyzeDestinationRequirements = jest.fn(() => {
        throw new Error('Analysis failed');
      });

      await expect(engine.generateLoadingPlan(requirements)).rejects.toThrow('Analysis failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate loading plan', expect.any(Object));
      
      // Restore original method
      (engine as any).analyzeDestinationRequirements = originalAnalyze;
    });

    it('should use previous plan context when provided', async () => {
      const requirements = 'Load validated data to warehouse';
      const validationPlanPath = './validation-plan.json';
      const options = { validationPlan: validationPlanPath };
      
      const mockValidationPlan = {
        qualityRules: ['no_nulls', 'valid_email'],
        schema: { columns: ['id', 'name', 'email'] }
      };
      
      (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(true);
      (readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(JSON.stringify(mockValidationPlan));

      const plan = await engine.generateLoadingPlan(requirements, options);

      expect(plan).toBeDefined();
      expect(readFile).toHaveBeenCalledWith(validationPlanPath, 'utf-8');
    });

    it('should optimize performance based on destination types', async () => {
      const requirements = 'Load to BigQuery and Databricks for ML workloads';
      
      const plan = await engine.generateLoadingPlan(requirements);

      // Should optimize for cloud data warehouses
      expect(plan.performance.memoryAllocation).toBe('8GB');
      expect(plan.performance.diskIO.ioThreads).toBe(8);
      expect(plan.performance.networking.connectionPool).toBe(20);
      expect(plan.performance.caching.enabled).toBe(true);
      expect(plan.performance.compression.enabled).toBe(true);
    });

    it('should configure appropriate orchestration framework', async () => {
      const requirements = 'Load data using Dagster for orchestration';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.orchestration.framework).toBe('dagster');
      expect(plan.orchestration.dependencies).toContain('data_validation');
      expect(plan.orchestration.dependencies).toContain('data_transformation');
      expect(plan.orchestration.notifications.failure).toContain('data-team@company.com');
    });

    it('should handle MongoDB destination configuration', async () => {
      const requirements = 'Load document data to MongoDB for operational analytics';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.destinations[0].type).toBe('mongodb');
      expect(plan.loadingStrategy.strategy).toBe('batch');
      expect(plan.governance.encryption.atRest).toBe(true);
    });

    it('should generate Python code with proper dependencies', async () => {
      const requirements = 'Load to Snowflake and BigQuery';
      const options = { generateCode: true, outputPath: './test' };
      
      (mkdir as jest.MockedFunction<typeof mkdir>).mockResolvedValue(undefined);
      (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

      const plan = await engine.generateLoadingPlan(requirements, options);

      const requirementsCall = (writeFile as jest.MockedFunction<typeof writeFile>).mock.calls
        .find(call => call[0].toString().includes('requirements.txt'));
      expect(requirementsCall?.[1]).toContain('snowflake-connector-python>=3.0.0');
      expect(requirementsCall?.[1]).toContain('google-cloud-bigquery>=3.10.0');
    });

    it('should configure data governance for financial data', async () => {
      const requirements = 'Load financial transactions with SOX compliance';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.governance.compliance.sox).toBe(true);
      expect(plan.governance.encryption.keyManagement).toBe('aws-kms');
      expect(plan.governance.auditing.enabled).toBe(true);
      expect(plan.governance.compliance.dataRetention).toBe(2555); // 7 years
    });

    it('should handle micro-batch strategy for near real-time processing', async () => {
      const requirements = 'Process micro-batch data feeds for near real-time analytics';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.loadingStrategy.strategy).toBe('micro-batch');
      expect(plan.loadingStrategy.compressionType).toBe('gzip');
      expect(plan.orchestration.schedule).toContain('*'); // More frequent than daily
    });

    it('should default to PostgreSQL when no specific destination mentioned', async () => {
      const requirements = 'Load processed data for application use';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.destinations).toHaveLength(1);
      expect(plan.destinations[0].type).toBe('postgres');
      expect(plan.destinations[0].schema).toBe('public');
      expect(plan.destinations[0].indexing?.primary).toEqual(['id']);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      const requirements = 'Load data to warehouse';
      const options = { outputPath: './test', generateCode: true };
      
      (mkdir as jest.MockedFunction<typeof mkdir>).mockRejectedValue(new Error('Permission denied'));

      await expect(engine.generateLoadingPlan(requirements, options)).rejects.toThrow('Permission denied');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle missing previous plan files', async () => {
      const requirements = 'Load data';
      const options = { validationPlan: './missing-plan.json' };
      
      (existsSync as jest.MockedFunction<typeof existsSync>).mockReturnValue(false);

      const plan = await engine.generateLoadingPlan(requirements, options);
      
      expect(plan).toBeDefined();
      expect(mockLogger.warn).not.toHaveBeenCalled(); // Should not warn for missing optional files
    });
  });

  describe('performance optimization', () => {
    it('should scale resources based on data volume indicators', async () => {
      const requirements = 'Load large dataset with millions of records to data warehouse';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.loadingStrategy.batchSize).toBeGreaterThan(50000);
      expect(plan.performance.memoryAllocation).toBe('8GB');
      expect(plan.performance.networking.connectionPool).toBe(20);
    });

    it('should configure appropriate compression for different destinations', async () => {
      const requirements = 'Load compressed data to S3 and Redshift';
      
      const plan = await engine.generateLoadingPlan(requirements);

      expect(plan.loadingStrategy.compressionType).toBe('gzip');
      expect(plan.performance.compression.enabled).toBe(true);
      expect(plan.performance.compression.algorithm).toBe('gzip');
    });
  });
}); 