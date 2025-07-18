import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { tmpdir } from 'os';
import { 
  PipelineDiscoveryEngine, 
  PipelineDiscoveryConfig,
  DataSource,
  DataTarget,
  PipelineRequirements 
} from '../../../../../src/cli/pipeline/discovery/pipeline-discovery-engine';
import { Logger } from '../../../../../src/core/logger';

// Extend global namespace to include mockFs
declare global {
  // eslint-disable-next-line no-var
  var mockFs: {
    mkdir: jest.Mock;
    writeFile: jest.Mock;
  };
}

// Mock fs module
interface MockFunctions {
  mkdir: jest.Mock;
  writeFile: jest.Mock;
}

jest.mock('fs', () => {
  const mockFs: MockFunctions = {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  };
  // Export the mockFs to make it accessible in the test
  (global as any).mockFs = mockFs;
  
  return {
    promises: mockFs
  };
});

// Mock Logger
jest.mock('../../../../../src/core/logger');

// Import the mock to make it accessible
const mockFs = global.mockFs as MockFunctions;

// Mock Logger
jest.mock('../../../../../src/core/logger');

describe('PipelineDiscoveryEngine', () => {
  let engine: PipelineDiscoveryEngine;
  let config: PipelineDiscoveryConfig;
  let mockLogger: jest.Mocked<Logger>;
  let testOutputDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock logger
    mockLogger = {
      configure: jest.fn<() => Promise<void>>().mockResolvedValue(),
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      child: jest.fn().mockReturnThis(),
      close: jest.fn<() => Promise<void>>().mockResolvedValue()
    } as unknown as jest.Mocked<Logger>;
    
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    
    testOutputDir = join(tmpdir(), 'pipeline-test');
    config = {
      namespace: 'test-pipeline',
      outputDir: testOutputDir,
      format: 'markdown' as const,
      awsProfile: 'test-profile',
      interactive: true,
      verbose: true,
      dryRun: false
    };

    engine = new PipelineDiscoveryEngine(config);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create engine with correct configuration', () => {
      expect(engine).toBeInstanceOf(PipelineDiscoveryEngine);
      
      const { Logger } = require('../../../../../src/core/logger.js');
      expect(Logger).toHaveBeenCalledWith({ level: 'info' }, { component: 'test-pipeline' });
    });
  });

  describe('discoverPipeline', () => {
    it('should successfully discover pipeline for Salesforce to Snowflake', async () => {
      const taskDescription = 'Build customer analytics pipeline from Salesforce to Snowflake';
      
      // Mock fs operations
      mockFs.mkdir.mockImplementation(() => Promise.resolve());
      mockFs.writeFile.mockImplementation(() => Promise.resolve());

      const result = await engine.discoverPipeline(taskDescription);

      expect(result).toBeDefined();
      // The engine detects at least one source
      expect(result.sourceAnalysis.length).toBeGreaterThanOrEqual(1);
      // Find Salesforce source by name
      const salesforceSource = result.sourceAnalysis.find((s: DataSource) => s.name === 'Salesforce CRM');
      expect(salesforceSource).toBeDefined();
      expect(salesforceSource!.type).toBe('api');
      expect(salesforceSource!.technology).toBe('Salesforce REST API');
      
      // The engine discovers multiple targets
      expect(result.targetAnalysis.length).toBeGreaterThanOrEqual(1);
      // Find Snowflake target by name
      const snowflakeTarget = result.targetAnalysis.find((t: DataTarget) => t.name === 'Snowflake Data Warehouse');
      expect(snowflakeTarget).toBeDefined();
      expect(snowflakeTarget!.type).toBe('warehouse');
      expect(snowflakeTarget!.technology).toBe('Snowflake');
      
      expect(result.requirements.businessObjective).toContain('Customer analytics pipeline from Salesforce to Snowflake');
      expect(result.recommendations).toContain('Implement API rate limiting and retry logic for reliable data ingestion');
      expect(result.nextSteps).toHaveLength(6);
      expect(result.planFile).toMatch(/pipeline-discovery-plan-\d{4}-\d{2}-\d{2}\.md/);

      // Verify logger calls
      expect(mockLogger.info).toHaveBeenCalledWith('Starting pipeline discovery', { task: taskDescription });
      expect(mockLogger.info).toHaveBeenCalledWith('Pipeline discovery completed', expect.objectContaining({
        sources: expect.any(Number),
        targets: expect.any(Number),
        planFile: expect.any(String)
      }));
    });

    it('should handle database to data lake pipeline', async () => {
      const taskDescription = 'Extract data from PostgreSQL database to S3 data lake';
      
      mockFs.mkdir.mockImplementation(() => Promise.resolve());
      mockFs.writeFile.mockImplementation(() => Promise.resolve());

      const result = await engine.discoverPipeline(taskDescription);

      // The engine detects multiple sources
      expect(result.sourceAnalysis.length).toBeGreaterThanOrEqual(1);
      // Find database source
      const dbSource = result.sourceAnalysis.find((s: DataSource) => s.name === 'Production Database');
      expect(dbSource).toBeDefined();
      expect(dbSource!.type).toBe('database');
      
      // The engine discovers multiple targets
      expect(result.targetAnalysis.length).toBeGreaterThanOrEqual(1);
      // Find data lake target
      const lakeTarget = result.targetAnalysis.find((t: DataTarget) => t.name === 'Data Lake');
      expect(lakeTarget).toBeDefined();
      expect(lakeTarget!.type).toBe('lake');
      
      expect(result.recommendations).toContain('Use CDC (Change Data Capture) for efficient database replication');
    });

    it('should handle real-time streaming pipeline', async () => {
      const taskDescription = 'Build real-time streaming analytics from API to warehouse';
      
      mockFs.mkdir.mockImplementation(() => Promise.resolve());
      mockFs.writeFile.mockImplementation(() => Promise.resolve());

      const result = await engine.discoverPipeline(taskDescription);

      expect(result.requirements.frequency).toBe('Real-time/Streaming');
      expect(result.requirements.latency).toBe('Near real-time (<1 minute)');
      expect(result.recommendations).toContain('Consider Amazon Kinesis for real-time data streaming');
      expect(result.recommendations).toContain('Use Lambda functions for event-driven processing');
    });

    it('should handle large data volume pipeline', async () => {
      const taskDescription = 'Process massive datasets from files to analytics warehouse';
      
      mockFs.mkdir.mockImplementation(() => Promise.resolve());
      mockFs.writeFile.mockImplementation(() => Promise.resolve());

      const result = await engine.discoverPipeline(taskDescription);

      expect(result.requirements.dataVolume).toBe('Large (>1TB)');
      expect(result.recommendations).toContain('Use AWS Glue for ETL processing to handle large data volumes efficiently');
      expect(result.recommendations).toContain('Implement data partitioning strategies for optimal performance');
    });

    it('should handle compliance requirements', async () => {
      const taskDescription = 'Build GDPR and HIPAA compliant pipeline for healthcare data';
      
      mockFs.mkdir.mockImplementation(() => Promise.resolve());
      mockFs.writeFile.mockImplementation(() => Promise.resolve());

      const result = await engine.discoverPipeline(taskDescription);

      expect(result.requirements.compliance).toContain('GDPR');
      expect(result.requirements.compliance).toContain('HIPAA');
      expect(result.recommendations).toContain('Implement data encryption at rest and in transit');
      expect(result.recommendations).toContain('Set up data governance and lineage tracking');
    });

    it('should work in dry-run mode', async () => {
      const dryRunConfig = { ...config, dryRun: true };
      const dryRunEngine = new PipelineDiscoveryEngine(dryRunConfig);
      
      const taskDescription = 'Test pipeline discovery';
      
      mockFs.mkdir.mockImplementation(() => Promise.resolve());

      const result = await dryRunEngine.discoverPipeline(taskDescription);

      expect(result).toBeDefined();
      expect(mockFs.writeFile).not.toHaveBeenCalled(); // Should not write file in dry-run mode
      
      // Should still log dry-run mode
      expect(mockLogger.info).toHaveBeenCalledWith('DRY RUN: Pipeline discovery simulation');
    });

    it('should handle directory creation failure', async () => {
      const taskDescription = 'Test pipeline discovery';
      
      const error = new Error('Permission denied');
      mockFs.mkdir.mockImplementation(() => Promise.reject(error));

      await expect(engine.discoverPipeline(taskDescription)).rejects.toThrow('Permission denied');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create output directory', {
        error,
        dir: testOutputDir
      });
    });
  });

  describe('extractBusinessObjective', () => {
    it('should clean up common prefixes', () => {
      const engine = new PipelineDiscoveryEngine(config);
      
      // Access private method through bracket notation for testing
      const extractBusinessObjective = (engine as any).extractBusinessObjective.bind(engine);
      
      expect(extractBusinessObjective('build customer analytics pipeline')).toBe('Customer analytics pipeline');
      expect(extractBusinessObjective('create data warehouse')).toBe('Data warehouse');
      expect(extractBusinessObjective('implement ETL process')).toBe('ETL process');
      expect(extractBusinessObjective('Customer analytics')).toBe('Customer analytics');
    });
  });

  describe('extractDataVolume', () => {
    it('should correctly identify data volumes', () => {
      const engine = new PipelineDiscoveryEngine(config);
      const extractDataVolume = (engine as any).extractDataVolume.bind(engine);
      
      expect(extractDataVolume('process large datasets')).toBe('Large (>1TB)');
      expect(extractDataVolume('handle big data')).toBe('Large (>1TB)');
      expect(extractDataVolume('small file processing')).toBe('Small (<100GB)');
      expect(extractDataVolume('regular data processing')).toBe('Medium (100GB-1TB)');
    });
  });

  describe('extractFrequency', () => {
    it('should correctly identify processing frequencies', () => {
      const engine = new PipelineDiscoveryEngine(config);
      const extractFrequency = (engine as any).extractFrequency.bind(engine);
      
      expect(extractFrequency('real-time processing')).toBe('Real-time/Streaming');
      expect(extractFrequency('streaming data')).toBe('Real-time/Streaming');
      expect(extractFrequency('daily batch processing')).toBe('Daily');
      expect(extractFrequency('hourly updates')).toBe('Hourly');
      expect(extractFrequency('standard processing')).toBe('Batch (Configurable)');
    });
  });

  describe('extractLatency', () => {
    it('should correctly identify latency requirements', () => {
      const engine = new PipelineDiscoveryEngine(config);
      const extractLatency = (engine as any).extractLatency.bind(engine);
      
      expect(extractLatency('real-time processing')).toBe('Near real-time (<1 minute)');
      expect(extractLatency('immediate updates')).toBe('Near real-time (<1 minute)');
      expect(extractLatency('fast processing')).toBe('Low latency (<15 minutes)');
      expect(extractLatency('quick updates')).toBe('Low latency (<15 minutes)');
      expect(extractLatency('standard processing')).toBe('Standard (1-4 hours)');
    });
  });

  describe('extractCompliance', () => {
    it('should correctly identify compliance requirements', () => {
      const engine = new PipelineDiscoveryEngine(config);
      const extractCompliance = (engine as any).extractCompliance.bind(engine);
      
      expect(extractCompliance('GDPR compliant pipeline')).toEqual(['GDPR']);
      expect(extractCompliance('HIPAA and SOX requirements')).toEqual(['HIPAA', 'SOX']);
      expect(extractCompliance('PCI DSS compliant')).toEqual(['PCI DSS']);
      expect(extractCompliance('no compliance requirements')).toEqual([]);
    });
  });

  describe('discoverDataSources', () => {
    it('should discover Salesforce source', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const discoverDataSources = (engine as any).discoverDataSources.bind(engine);
      
      const requirements: PipelineRequirements = {
        businessObjective: 'Salesforce customer data to analytics',
        dataVolume: 'Medium',
        frequency: 'Daily',
        latency: 'Standard',
        compliance: [],
        performance: {},
        quality: {}
      };

      const sources = await discoverDataSources(requirements);
      
      expect(sources).toHaveLength(1);
      expect(sources[0].name).toBe('Salesforce CRM');
      expect(sources[0].type).toBe('api');
      expect(sources[0].technology).toBe('Salesforce REST API');
    });

    it('should discover database source', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const discoverDataSources = (engine as any).discoverDataSources.bind(engine);
      
      const requirements: PipelineRequirements = {
        businessObjective: 'PostgreSQL database to warehouse',
        dataVolume: 'Large',
        frequency: 'Batch',
        latency: 'Standard',
        compliance: [],
        performance: {},
        quality: {}
      };

      const sources = await discoverDataSources(requirements);
      
      expect(sources).toHaveLength(1);
      expect(sources[0].name).toBe('Production Database');
      expect(sources[0].type).toBe('database');
      expect(sources[0].technology).toBe('PostgreSQL/MySQL');
    });

    it('should discover file source', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const discoverDataSources = (engine as any).discoverDataSources.bind(engine);
      
      const requirements: PipelineRequirements = {
        businessObjective: 'S3 CSV files to analytics',
        dataVolume: 'Variable',
        frequency: 'Hourly',
        latency: 'Standard',
        compliance: [],
        performance: {},
        quality: {}
      };

      const sources = await discoverDataSources(requirements);
      
      expect(sources).toHaveLength(1);
      expect(sources[0].name).toBe('S3 Data Files');
      expect(sources[0].type).toBe('file');
      expect(sources[0].technology).toBe('Amazon S3');
    });
  });

  describe('discoverDataTargets', () => {
    it('should discover Snowflake target', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const discoverDataTargets = (engine as any).discoverDataTargets.bind(engine);
      
      const requirements: PipelineRequirements = {
        businessObjective: 'Data to Snowflake analytics warehouse',
        dataVolume: 'Large',
        frequency: 'Daily',
        latency: 'Standard',
        compliance: [],
        performance: {},
        quality: {}
      };

      const targets = await discoverDataTargets(requirements);
      
      expect(targets.length).toBeGreaterThanOrEqual(1);
      const snowflake = targets.find((t: DataTarget) => t.name === 'Snowflake Data Warehouse');
      expect(snowflake).toBeDefined();
      expect(snowflake!.type).toBe('warehouse');
      expect(snowflake!.technology).toBe('Snowflake');
    });

    it('should discover Redshift target', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const discoverDataTargets = (engine as any).discoverDataTargets.bind(engine);
      
      const requirements: PipelineRequirements = {
        businessObjective: 'Data to analytics warehouse',
        dataVolume: 'Large',
        frequency: 'Daily',
        latency: 'Standard',
        compliance: [],
        performance: {},
        quality: {}
      };

      const targets = await discoverDataTargets(requirements);
      
      expect(targets).toHaveLength(1);
      expect(targets[0].name).toBe('Amazon Redshift');
      expect(targets[0].type).toBe('warehouse');
      expect(targets[0].technology).toBe('Amazon Redshift');
    });

    it('should discover data lake target', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const discoverDataTargets = (engine as any).discoverDataTargets.bind(engine);
      
      const requirements: PipelineRequirements = {
        businessObjective: 'Data to S3 data lake',
        dataVolume: 'Large',
        frequency: 'Streaming',
        latency: 'Real-time',
        compliance: [],
        performance: {},
        quality: {}
      };

      const targets = await discoverDataTargets(requirements);
      
      expect(targets).toHaveLength(1);
      expect(targets[0].name).toBe('Data Lake');
      expect(targets[0].type).toBe('lake');
      expect(targets[0].technology).toBe('Amazon S3 + Glue');
    });
  });

  describe('generateRecommendations', () => {
    it('should generate volume-based recommendations', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const generateRecommendations = (engine as any).generateRecommendations.bind(engine);
      
      const sources: DataSource[] = [];
      const targets: DataTarget[] = [];
      const requirements: PipelineRequirements = {
        businessObjective: 'Large data processing',
        dataVolume: 'Large (>1TB)',
        frequency: 'Daily',
        latency: 'Standard',
        compliance: [],
        performance: {},
        quality: {}
      };

      const recommendations = await generateRecommendations(sources, targets, requirements);
      
      expect(recommendations).toContain('Use AWS Glue for ETL processing to handle large data volumes efficiently');
      expect(recommendations).toContain('Implement data partitioning strategies for optimal performance');
    });

    it('should generate streaming recommendations', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const generateRecommendations = (engine as any).generateRecommendations.bind(engine);
      
      const sources: DataSource[] = [];
      const targets: DataTarget[] = [];
      const requirements: PipelineRequirements = {
        businessObjective: 'Real-time processing',
        dataVolume: 'Medium',
        frequency: 'Real-time/Streaming',
        latency: 'Near real-time',
        compliance: [],
        performance: {},
        quality: {}
      };

      const recommendations = await generateRecommendations(sources, targets, requirements);
      
      expect(recommendations).toContain('Consider Amazon Kinesis for real-time data streaming');
      expect(recommendations).toContain('Use Lambda functions for event-driven processing');
    });

    it('should generate API-specific recommendations', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const generateRecommendations = (engine as any).generateRecommendations.bind(engine);
      
      const sources: DataSource[] = [
        {
          name: 'API Source',
          type: 'api',
          technology: 'REST API',
          volume: 'Medium',
          frequency: 'Hourly'
        }
      ];
      const targets: DataTarget[] = [];
      const requirements: PipelineRequirements = {
        businessObjective: 'API data processing',
        dataVolume: 'Medium',
        frequency: 'Hourly',
        latency: 'Standard',
        compliance: [],
        performance: {},
        quality: {}
      };

      const recommendations = await generateRecommendations(sources, targets, requirements);
      
      expect(recommendations).toContain('Implement API rate limiting and retry logic for reliable data ingestion');
    });

    it('should generate database-specific recommendations', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const generateRecommendations = (engine as any).generateRecommendations.bind(engine);
      
      const sources: DataSource[] = [
        {
          name: 'Database Source',
          type: 'database',
          technology: 'PostgreSQL',
          volume: 'Large',
          frequency: 'Daily'
        }
      ];
      const targets: DataTarget[] = [];
      const requirements: PipelineRequirements = {
        businessObjective: 'Database replication',
        dataVolume: 'Large',
        frequency: 'Daily',
        latency: 'Standard',
        compliance: [],
        performance: {},
        quality: {}
      };

      const recommendations = await generateRecommendations(sources, targets, requirements);
      
      expect(recommendations).toContain('Use CDC (Change Data Capture) for efficient database replication');
    });

    it('should generate compliance recommendations', async () => {
      const engine = new PipelineDiscoveryEngine(config);
      const generateRecommendations = (engine as any).generateRecommendations.bind(engine);
      
      const sources: DataSource[] = [];
      const targets: DataTarget[] = [];
      const requirements: PipelineRequirements = {
        businessObjective: 'Compliant data processing',
        dataVolume: 'Medium',
        frequency: 'Daily',
        latency: 'Standard',
        compliance: ['GDPR', 'HIPAA'],
        performance: {},
        quality: {}
      };

      const recommendations = await generateRecommendations(sources, targets, requirements);
      
      expect(recommendations).toContain('Implement data encryption at rest and in transit');
      expect(recommendations).toContain('Set up data governance and lineage tracking');
    });
  });

  describe('generateNextSteps', () => {
    it('should generate correct next steps', () => {
      const engine = new PipelineDiscoveryEngine(config);
      const generateNextSteps = (engine as any).generateNextSteps.bind(engine);
      
      const sources: DataSource[] = [];
      const targets: DataTarget[] = [];
      
      const nextSteps = generateNextSteps(sources, targets);
      
      expect(nextSteps).toHaveLength(6);
      expect(nextSteps[0]).toBe('Phase 2: Design pipeline architecture and data flow diagrams');
      expect(nextSteps[1]).toBe('Phase 3: Set up data extraction from identified sources');
      expect(nextSteps[2]).toBe('Phase 4: Design and implement data transformation logic');
      expect(nextSteps[3]).toBe('Phase 5: Implement data quality validation and testing');
      expect(nextSteps[4]).toBe('Phase 6: Configure data loading to target systems');
      expect(nextSteps[5]).toBe('Phase 7: Set up monitoring, alerting, and maintenance procedures');
    });
  });

  describe('formatPipelinePlan', () => {
    it('should format pipeline plan correctly', () => {
      const engine = new PipelineDiscoveryEngine(config);
      const formatPipelinePlan = (engine as any).formatPipelinePlan.bind(engine);
      
      const data = {
        sourceAnalysis: [
          {
            name: 'Test Source',
            type: 'api' as const,
            technology: 'REST API',
            volume: 'Medium',
            frequency: 'Hourly'
          }
        ],
        targetAnalysis: [
          {
            name: 'Test Target',
            type: 'warehouse' as const,
            technology: 'Snowflake',
            requirements: ['Performance', 'Scalability']
          }
        ],
        requirements: {
          businessObjective: 'Test pipeline',
          dataVolume: 'Medium',
          frequency: 'Hourly',
          latency: 'Standard',
          compliance: ['GDPR'],
          performance: {},
          quality: {}
        },
        recommendations: ['Test recommendation'],
        nextSteps: ['Test next step']
      };

      const plan = formatPipelinePlan(data);
      
      expect(plan).toContain('# Enterprise Data Pipeline Discovery Plan');
      expect(plan).toContain('Namespace: test-pipeline');
      expect(plan).toContain('**Objective:** Test pipeline');
      expect(plan).toContain('### 1. Test Source');
      expect(plan).toContain('### 1. Test Target');
      expect(plan).toContain('1. Test recommendation');
      expect(plan).toContain('1. Test next step');
    });
  });

  describe('error handling', () => {
    it('should handle missing task description', async () => {
      // This test would require modifying the discoverPipeline method to handle empty strings
      // For now, we'll test that it processes empty string gracefully
      const taskDescription = '';
      
      mockFs.mkdir.mockImplementation(() => Promise.resolve());
      mockFs.writeFile.mockImplementation(() => Promise.resolve());

      const result = await engine.discoverPipeline(taskDescription);
      
      expect(result).toBeDefined();
      expect(result.requirements.businessObjective).toBe('');
    });

    it('should handle file write errors', async () => {
      const taskDescription = 'Test pipeline';
      
      mockFs.mkdir.mockImplementation(() => Promise.resolve());
      mockFs.writeFile.mockImplementation(() => Promise.reject(new Error('Write failed')));

      await expect(engine.discoverPipeline(taskDescription)).rejects.toThrow('Write failed');
    });
  });

  describe('configuration variants', () => {
    it('should work with different output formats', () => {
      const jsonConfig = { ...config, format: 'json' as const };
      const textConfig = { ...config, format: 'text' as const };
      
      const jsonEngine = new PipelineDiscoveryEngine(jsonConfig);
      const textEngine = new PipelineDiscoveryEngine(textConfig);
      
      expect(jsonEngine).toBeInstanceOf(PipelineDiscoveryEngine);
      expect(textEngine).toBeInstanceOf(PipelineDiscoveryEngine);
    });

    it('should work in non-interactive mode', () => {
      const nonInteractiveConfig = { ...config, interactive: false };
      const nonInteractiveEngine = new PipelineDiscoveryEngine(nonInteractiveConfig);
      
      expect(nonInteractiveEngine).toBeInstanceOf(PipelineDiscoveryEngine);
    });

    it('should work in non-verbose mode', () => {
      const quietConfig = { ...config, verbose: false };
      const quietEngine = new PipelineDiscoveryEngine(quietConfig);
      
      expect(quietEngine).toBeInstanceOf(PipelineDiscoveryEngine);
    });
  });
}); 