/**
 * Unit tests for neural workflow integration
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the Logger using the centralized mock
jest.mock('../../../../src/core/logger', () => {
  return require('../../../helpers/logger-mock.js');
});

import { NeuralWorkflow } from '../../../../src/hive-mind/neural/neural-workflow';
import { PatternRecognizer } from '../../../../src/hive-mind/neural/pattern-recognizer';
import { NeuralManager } from '../../../../src/hive-mind/neural/neural-manager';
import { EventBus } from '../../../../src/core/event-bus';
import { Logger } from '../../../../src/core/logger';

// Mock dependencies
jest.mock('../../../../src/hive-mind/neural/pattern-recognizer');
jest.mock('../../../../src/hive-mind/neural/neural-manager');
jest.mock('../../../../src/core/event-bus');

describe('NeuralWorkflow', () => {
  let workflow: NeuralWorkflow;
  let mockPatternRecognizer: jest.Mocked<PatternRecognizer>;
  let mockNeuralManager: jest.Mocked<NeuralManager>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockPatternRecognizer = {
      recognizePattern: jest.fn(),
      getStatus: jest.fn(),
    } as any;
    
    mockNeuralManager = {
      initialize: jest.fn().mockImplementation(async () => {}),
      recognizePattern: jest.fn(),
      getStatus: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    } as any;

    // Create workflow instance with proper config
    const config = {
      batchProcessing: true,
      parallelExecution: false,
      adaptiveLearning: true,
      reinforcementCycles: 3,
      feedbackThreshold: 0.8,
      enableOptimization: true,
      neuralNetworkConfig: {
        layers: [64, 32, 16],
        activationFunction: 'relu' as const,
        learningRate: 0.01
      },
      patternRecognitionConfig: {
        confidenceThreshold: 0.7,
        learningRate: 0.01,
        tensorFlowModels: {}
      }
    };

    workflow = new NeuralWorkflow(
      mockPatternRecognizer,
      mockNeuralManager,
      mockEventBus,
      config
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should create workflow instance', () => {
      expect(workflow).toBeDefined();
    });

    it('should have mock eventBus', () => {
      expect(mockEventBus.emit).toBeDefined();
      expect(typeof mockEventBus.emit).toBe('function');
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await workflow.initialize();
      
      expect(mockNeuralManager.initialize).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('neural:workflow:initialized', expect.objectContaining({
        timestamp: expect.any(String),
        config: expect.any(Object)
      }));
    });

    it('should handle initialization errors', async () => {
      mockNeuralManager.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(workflow.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('pattern recognition workflow', () => {
    it('should execute pattern recognition successfully', async () => {
      const inputData = { type: 'test', data: [1, 2, 3] };
      const expectedResult = [{
        patternId: 'test-pattern',
        confidence: 0.85,
        timestamp: new Date().toISOString(),
        modelName: 'test-model',
        matchedFeatures: ['feature1'],
        metadata: { source: 'test' }
      }];
      
      mockPatternRecognizer.recognizePattern.mockResolvedValue(expectedResult);
      
      const result = await workflow.executePatternRecognition(inputData);
      
      expect(mockPatternRecognizer.recognizePattern).toHaveBeenCalledWith('default-swarm', inputData, 'coordination');
      expect(result).toEqual(expectedResult);
      expect(mockEventBus.emit).toHaveBeenCalledWith('neural:pattern:recognition:complete', expect.objectContaining({
        patterns: expectedResult,
        inputData: inputData,
        timestamp: expect.any(String)
      }));
    });

    it('should handle pattern recognition errors', async () => {
      const inputData = { type: 'test', data: [1, 2, 3] };
      mockPatternRecognizer.recognizePattern.mockRejectedValue(new Error('Recognition failed'));
      
      await expect(workflow.executePatternRecognition(inputData)).rejects.toThrow('Recognition failed');
    });
  });

  describe('neural processing workflow', () => {
    it('should process neural data successfully', async () => {
      const inputData = { neurons: [1, 2, 3], weights: [0.5, 0.3, 0.2] };
      const expectedResult = [{
        patternId: 'neural-pattern',
        confidence: 0.92,
        timestamp: new Date().toISOString(),
        modelName: 'neural-model',
        matchedFeatures: ['neural'],
        metadata: { output: [0.8] }
      }];
      
      mockNeuralManager.recognizePattern.mockResolvedValue(expectedResult);
      
      const result = await workflow.executeNeuralProcessing(inputData);
      
      expect(mockNeuralManager.recognizePattern).toHaveBeenCalledWith('default-swarm', inputData, 'coordination');
      expect(result).toEqual(expectedResult);
      expect(mockEventBus.emit).toHaveBeenCalledWith('neural:processing:complete', expect.any(Object));
    });

    it('should handle neural processing errors', async () => {
      const inputData = { neurons: [1, 2, 3], weights: [0.5, 0.3, 0.2] };
      mockNeuralManager.recognizePattern.mockRejectedValue(new Error('Processing failed'));
      
      await expect(workflow.executeNeuralProcessing(inputData)).rejects.toThrow('Processing failed');
    });
  });

  describe('combined workflow', () => {
    it('should execute combined pattern recognition and neural processing', async () => {
      const inputData = { type: 'combined', data: [1, 2, 3], neurons: [0.5, 0.3, 0.2] };
      const patternResult = [{
        patternId: 'combined-pattern',
        confidence: 0.88,
        timestamp: new Date().toISOString(),
        modelName: 'pattern-model',
        matchedFeatures: ['combined'],
        metadata: { type: 'pattern' }
      }];
      const neuralResult = [{
        patternId: 'neural-pattern',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        modelName: 'neural-model',
        matchedFeatures: ['neural'],
        metadata: { output: [0.9] }
      }];
      
      mockPatternRecognizer.recognizePattern.mockResolvedValue(patternResult);
      mockNeuralManager.recognizePattern.mockResolvedValue(neuralResult);
      
      const result = await workflow.executeCombinedWorkflow(inputData);
      
      expect(mockPatternRecognizer.recognizePattern).toHaveBeenCalled();
      expect(result).toEqual({
        pattern: patternResult,
        neural: neuralResult
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith('neural:combined:workflow:complete', expect.any(Object));
    });

    it('should handle partial failures in combined workflow', async () => {
      const inputData = { data: [1, 2, 3], type: 'test' };
      const patternResult = [{
        patternId: 'test-pattern',
        confidence: 0.85,
        timestamp: new Date().toISOString(),
        modelName: 'test-model',
        matchedFeatures: ['feature1'],
        metadata: { source: 'test' }
      }];
      
      mockPatternRecognizer.recognizePattern.mockResolvedValue(patternResult);
      mockNeuralManager.recognizePattern.mockRejectedValue(new Error('Neural processing failed'));
      
      const result = await workflow.executeCombinedWorkflow(inputData);
      
      expect(result).toEqual({
        pattern: patternResult,
        neural: {
          error: 'Neural processing failed',
          details: expect.any(Error)
        }
      });
    });
  });

  describe('workflow metrics', () => {
    it('should collect and return workflow metrics', async () => {
      const patternStatus = { accuracy: 0.85, totalPatterns: 10 };
      const neuralStatus = { throughput: 100, accuracy: 0.9 };
      
      mockPatternRecognizer.getStatus.mockReturnValue(patternStatus);
      mockNeuralManager.getStatus.mockReturnValue(neuralStatus);
      
      const metrics = await workflow.getMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        patternRecognitionMetrics: patternStatus,
        neuralProcessingMetrics: neuralStatus
      }));
    });
  });

  describe('workflow shutdown', () => {
    it('should shutdown all components gracefully', async () => {
      await workflow.shutdown();
      
      expect(mockNeuralManager.shutdown).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('neural:workflow:shutdown', expect.objectContaining({
        timestamp: expect.any(String)
      }));
    });

    it('should handle shutdown errors gracefully', async () => {
      // Mock the shutdown method to reject with an error
      mockNeuralManager.shutdown.mockRejectedValue(new Error('Shutdown failed'));
      
      await workflow.shutdown();
      
      expect(mockNeuralManager.shutdown).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('neural:workflow:shutdown', expect.objectContaining({
        timestamp: expect.any(String)
      }));
    });
  });
});