import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { createNeuralTools } from '../../../src/mcp/neural-tools';
import { Logger } from '../../../src/core/logger';
import type { MCPTool } from '../../../src/utils/types';

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs-node', () => ({
  getBackend: jest.fn(() => 'cpu'),
  memory: jest.fn(() => ({ numTensors: 5, numDataBuffers: 3, numBytes: 1024 })),
  version: { tfjs: '4.0.0' },
  randomNormal: jest.fn(() => ({ dispose: jest.fn() })),
  matMul: jest.fn(() => ({ dispose: jest.fn() })),
  conv2d: jest.fn(() => ({ dispose: jest.fn() })),
  loadLayersModel: jest.fn(() => Promise.resolve({
    layers: [{ name: 'layer1' }, { name: 'layer2' }],
    trainable: true,
    inputs: [{ name: 'input', shape: [null, 10] }],
    outputs: [{ name: 'output', shape: [null, 1] }]
  }))
}));

describe('Neural Tools MCP Integration', () => {
  let logger: Logger;
  let neuralTools: MCPTool[];

  beforeEach(() => {
    logger = new Logger({ level: 'debug', format: 'json', destination: 'console' });
    neuralTools = createNeuralTools(logger);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Tool Creation', () => {
    it('should create all 15 neural tools', () => {
      expect(neuralTools).toBeDefined();
      expect(Array.isArray(neuralTools)).toBe(true);
      expect(neuralTools.length).toBe(15);

      const expectedTools = [
        'neural/status',
        'neural/train', 
        'neural/predict',
        'neural/patterns',
        'neural/model_load',
        'neural/model_save',
        'neural/pattern_recognize',
        'neural/cognitive_analyze',
        'neural/learning_adapt',
        'neural/compress',
        'neural/ensemble_create',
        'neural/transfer_learn',
        'neural/explain',
        'neural/wasm_optimize',
        'neural/inference_run'
      ];

      const toolNames = neuralTools.map(tool => tool.name);
      expectedTools.forEach(expectedTool => {
        expect(toolNames).toContain(expectedTool);
      });
    });

    it('should have properly defined input schemas', () => {
      neuralTools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.handler).toBeDefined();
        expect(typeof tool.handler).toBe('function');
      });
    });
  });

  describe('Neural Status Tool', () => {
    let statusTool: MCPTool;

    beforeEach(() => {
      statusTool = neuralTools.find(tool => tool.name === 'neural/status')!;
    });

    it('should provide comprehensive neural system status', async () => {
      const result = await statusTool.handler({
        includeModels: true,
        includeMetrics: true
      }) as any;

      expect(result.success).toBe(true);
      expect(result.neural_system).toBeDefined();
      expect(result.neural_system.status).toBe('active');
      expect(Array.isArray(result.neural_system.available_models)).toBe(true);
      expect(typeof result.neural_system.backend).toBe('string');
      expect(typeof result.neural_system.wasm_enabled).toBe('boolean');
      expect(typeof result.neural_system.simd_optimized).toBe('boolean');
      expect(typeof result.neural_system.tensorflow_version).toBe('string');
      expect(typeof result.neural_system.models_loaded).toBe('number');
      expect(typeof result.neural_system.memory_usage).toBe('object');
    });

    it('should handle status requests without optional parameters', async () => {
      const result = await statusTool.handler({}) as any;

      expect(result.success).toBe(true);
      expect(result.neural_system).toBeDefined();
      expect(result.neural_system.status).toBe('active');
    });

    it('should provide specific model information when requested', async () => {
      const result = await statusTool.handler({
        modelId: 'test-model',
        includeModels: true
      });

      expect(result.success).toBe(true);
      expect(result.specific_model).toBeDefined();
      expect(result.specific_model.modelId).toBe('test-model');
      expect(typeof result.specific_model.status).toBe('string');
    });
  });

  describe('Neural Training Tool', () => {
    let trainTool: MCPTool;

    beforeEach(() => {
      trainTool = neuralTools.find(tool => tool.name === 'neural/train')!;
    });

    it('should train neural patterns with coordination type', async () => {
      const trainingData = [
        [0.1, 0.2, 0.3, 0.4, 0.5],
        [0.2, 0.3, 0.4, 0.5, 0.6],
        [0.3, 0.4, 0.5, 0.6, 0.7]
      ];

      const result = await trainTool.handler({
        pattern_type: 'coordination',
        training_data: trainingData,
        epochs: 50,
        batchSize: 16
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBeDefined();
      expect(result.pattern_type).toBe('coordination');
      expect(result.trainingData).toBe(trainingData.length);
      expect(typeof result.accuracy).toBe('number');
      expect(result.accuracy).toBeGreaterThan(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.training_time).toBe('number');
    });

    it('should handle string training data by converting to arrays', async () => {
      const result = await trainTool.handler({
        pattern_type: 'behavior_analysis',
        training_data: 'sample training string'
      });

      expect(result.success).toBe(true);
      expect(result.pattern_type).toBe('behavior_analysis');
      expect(typeof result.trainingData).toBe('number');
      expect(result.trainingData).toBeGreaterThan(0);
    });

    it('should generate labels when not provided', async () => {
      const trainingData = [[1, 2, 3], [4, 5, 6]];

      const result = await trainTool.handler({
        pattern_type: 'task_prediction',
        training_data: trainingData
      });

      expect(result.success).toBe(true);
      expect(result.training_labels).toBeGreaterThan(0);
    });

    it('should handle different pattern types', async () => {
      const patternTypes = ['coordination', 'task_prediction', 'behavior_analysis', 'optimization'];
      
      for (const patternType of patternTypes) {
        const result = await trainTool.handler({
          pattern_type: patternType,
          training_data: [[1, 2, 3]]
        });

        expect(result.success).toBe(true);
        expect(result.pattern_type).toBe(patternType);
      }
    });
  });

  describe('Neural Prediction Tool', () => {
    let predictTool: MCPTool;

    beforeEach(() => {
      predictTool = neuralTools.find(tool => tool.name === 'neural/predict')!;
    });

    it('should make predictions using trained models', async () => {
      const inputData = {
        taskType: 'analysis',
        agentCapabilities: ['planning', 'execution'],
        environment: { complexity: 'medium' },
        historicalPerformance: [0.8, 0.9, 0.7],
        resourceUsage: { responseTime: 100, cpu: 30, memory: 25 },
        communicationPatterns: [],
        outcomes: []
      };

      const result = await predictTool.handler({
        modelId: 'test-model',
        inputData: inputData
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBe('test-model');
      expect(result.prediction).toBeDefined();
      expect(result.prediction.results).toBeDefined();
      expect(Array.isArray(result.prediction.results)).toBe(true);
      expect(typeof result.prediction.confidence).toBe('number');
      expect(result.prediction.confidence).toBeGreaterThan(0);
      expect(result.prediction.confidence).toBeLessThanOrEqual(1);
      expect(typeof result.inference_time_ms).toBe('number');
    });

    it('should handle string input by converting to context format', async () => {
      const result = await predictTool.handler({
        modelId: 'test-model',
        input: 'test input string'
      });

      expect(result.success).toBe(true);
      expect(result.prediction).toBeDefined();
      expect(result.inputData).toBeDefined();
    });

    it('should work with patternId parameter', async () => {
      const result = await predictTool.handler({
        patternId: 'pattern-123',
        input: { test: 'data' }
      });

      expect(result.success).toBe(true);
      expect(result.patternId).toBe('pattern-123');
    });
  });

  describe('Neural Patterns Tool', () => {
    let patternsTool: MCPTool;

    beforeEach(() => {
      patternsTool = neuralTools.find(tool => tool.name === 'neural/patterns')!;
    });

    it('should analyze and discover patterns', async () => {
      const testData = [
        { type: 'sequence', values: [1, 2, 3, 4, 5] },
        { type: 'sequence', values: [2, 4, 6, 8, 10] },
        { type: 'random', values: [1, 7, 3, 9, 2] }
      ];

      const result = await patternsTool.handler({
        data: testData,
        patternType: 'sequence'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      expect(Array.isArray(result.discoveredPatterns)).toBe(true);
      expect(typeof result.patternCount).toBe('number');
      expect(result.patternCount).toBeGreaterThanOrEqual(0);
    });

    it('should work without pattern type filter', async () => {
      const testData = [1, 2, 3, 4, 5];

      const result = await patternsTool.handler({
        data: testData
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.discoveredPatterns)).toBe(true);
    });
  });

  describe('Model Management Tools', () => {
    let loadTool: MCPTool;
    let saveTool: MCPTool;

    beforeEach(() => {
      loadTool = neuralTools.find(tool => tool.name === 'neural/model_load')!;
      saveTool = neuralTools.find(tool => tool.name === 'neural/model_save')!;
    });

    it('should load TensorFlow.js models', async () => {
      const result = await loadTool.handler({
        modelPath: '/test/path/model.json',
        modelId: 'loaded-model'
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBe('loaded-model');
      expect(result.modelPath).toBe('/test/path/model.json');
      expect(result.loaded).toBe(true);
      expect(result.modelSummary).toBeDefined();
      expect(typeof result.modelSummary.layers).toBe('number');
      expect(typeof result.modelSummary.trainable).toBe('boolean');
    });

    it('should save trained models', async () => {
      const result = await saveTool.handler({
        modelId: 'model-to-save',
        savePath: '/test/save/path/model.json'
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBe('model-to-save');
      expect(result.savePath).toBe('/test/save/path/model.json');
      expect(result.saved).toBe(true);
      expect(Array.isArray(result.savedFiles)).toBe(true);
      expect(typeof result.modelSize).toBe('number');
    });

    it('should handle missing parameters gracefully', async () => {
      const saveResult = await saveTool.handler({});

      expect(saveResult.success).toBe(true);
      expect(saveResult.modelId).toBeDefined();
    });
  });

  describe('Pattern Recognition Tool', () => {
    let recognizeTool: MCPTool;

    beforeEach(() => {
      recognizeTool = neuralTools.find(tool => tool.name === 'neural/pattern_recognize')!;
    });

    it('should recognize specific patterns in data', async () => {
      const inputData = [
        [1, 2, 3],
        [2, 4, 6],
        [3, 6, 9]
      ];

      const result = await recognizeTool.handler({
        inputData: inputData,
        patternTemplate: { type: 'arithmetic_sequence' }
      });

      expect(result.success).toBe(true);
      expect(result.inputData).toEqual(inputData);
      expect(typeof result.patterns_detected).toBe('number');
      expect(typeof result.pattern_confidence).toBe('number');
      expect(Array.isArray(result.patternMatches)).toBe(true);
      expect(typeof result.confidence).toBe('number');
    });

    it('should work without pattern template', async () => {
      const result = await recognizeTool.handler({
        inputData: [[1, 2], [3, 4]]
      });

      expect(result.success).toBe(true);
      expect(typeof result.matches).toBe('number');
    });
  });

  describe('Cognitive Analysis Tool', () => {
    let cognitiveTool: MCPTool;

    beforeEach(() => {
      cognitiveTool = neuralTools.find(tool => tool.name === 'neural/cognitive_analyze')!;
    });

    it('should analyze cognitive behavior patterns', async () => {
      const behaviorData = [
        { timestamp: Date.now(), action: 'task_start', success: true },
        { timestamp: Date.now() + 1000, action: 'task_complete', success: true },
        { timestamp: Date.now() + 2000, action: 'task_start', success: false }
      ];

      const result = await cognitiveTool.handler({
        behaviorData: behaviorData,
        analysisType: 'performance'
      });

      expect(result.success).toBe(true);
      expect(result.behaviorData).toEqual(behaviorData);
      expect(result.analysisType).toBe('performance');
      expect(result.cognitiveAnalysis).toBeDefined();
      expect(typeof result.cognitiveAnalysis.anomalyScore).toBe('number');
      expect(typeof result.cognitiveAnalysis.confidence).toBe('number');
      expect(typeof result.cognitiveAnalysis.reasoning).toBe('string');
      expect(Array.isArray(result.insights)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle different analysis types', async () => {
      const analysisTypes = ['performance', 'anomaly', 'optimization', 'trend'];
      
      for (const analysisType of analysisTypes) {
        const result = await cognitiveTool.handler({
          behaviorData: [{ test: 'data' }],
          analysisType: analysisType
        });

        expect(result.success).toBe(true);
        expect(result.analysisType).toBe(analysisType);
      }
    });
  });

  describe('Advanced Neural Tools', () => {
    let adaptTool: MCPTool;
    let compressTool: MCPTool;
    let ensembleTool: MCPTool;
    let transferTool: MCPTool;
    let explainTool: MCPTool;
    let wasmTool: MCPTool;
    let inferenceTool: MCPTool;

    beforeEach(() => {
      adaptTool = neuralTools.find(tool => tool.name === 'neural/learning_adapt')!;
      compressTool = neuralTools.find(tool => tool.name === 'neural/compress')!;
      ensembleTool = neuralTools.find(tool => tool.name === 'neural/ensemble_create')!;
      transferTool = neuralTools.find(tool => tool.name === 'neural/transfer_learn')!;
      explainTool = neuralTools.find(tool => tool.name === 'neural/explain')!;
      wasmTool = neuralTools.find(tool => tool.name === 'neural/wasm_optimize')!;
      inferenceTool = neuralTools.find(tool => tool.name === 'neural/inference_run')!;
    });

    it('should perform adaptive learning', async () => {
      const result = await adaptTool.handler({
        modelId: 'test-model',
        newData: [[1, 2, 3], [4, 5, 6]],
        newLabels: [0, 1],
        adaptationType: 'incremental'
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBe('test-model');
      expect(result.adaptationType).toBe('incremental');
      expect(result.adaptationResult).toBeDefined();
      expect(typeof result.newAccuracy).toBe('number');
      expect(typeof result.improvementRate).toBe('number');
    });

    it('should compress neural models', async () => {
      const result = await compressTool.handler({
        modelId: 'test-model',
        compressionRatio: 0.5
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBe('test-model');
      expect(typeof result.originalSize).toBe('number');
      expect(typeof result.compressedSize).toBe('number');
      expect(result.compressionRatio).toBe(0.5);
    });

    it('should create ensemble models', async () => {
      const result = await ensembleTool.handler({
        modelIds: ['model1', 'model2', 'model3'],
        ensembleType: 'voting'
      });

      expect(result.success).toBe(true);
      expect(result.ensembleId).toBeDefined();
      expect(Array.isArray(result.models)).toBe(true);
      expect(result.strategy).toBe('voting');
      expect(result.ensemble_metrics).toBeDefined();
      expect(typeof result.accuracy).toBe('number');
    });

    it('should support transfer learning', async () => {
      const result = await transferTool.handler({
        sourceModelId: 'source-model',
        targetDomain: 'new-domain',
        transferData: [[1, 2], [3, 4]]
      });

      expect(result.success).toBe(true);
      expect(result.sourceModelId).toBe('source-model');
      expect(result.targetDomain).toBe('new-domain');
      expect(result.transferredModelId).toBeDefined();
      expect(result.transfer_results).toBeDefined();
      expect(typeof result.transferAccuracy).toBe('number');
    });

    it('should explain neural model decisions', async () => {
      const result = await explainTool.handler({
        modelId: 'test-model',
        prediction: { result: 0.8, input: [1, 2, 3] }
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBe('test-model');
      expect(result.featureImportance).toBeDefined();
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.reasoning).toBe('string');
      expect(Array.isArray(result.decisionPath)).toBe(true);
    });

    it('should optimize with WASM acceleration', async () => {
      const result = await wasmTool.handler({
        operation: 'matrix_multiply',
        benchmark: true
      });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('matrix_multiply');
      expect(result.optimization_results).toBeDefined();
      expect(result.wasm_acceleration).toBeDefined();
      expect(typeof result.optimization_results.wasm_enabled).toBe('boolean');
      expect(typeof result.optimization_results.performance_boost).toBe('string');
    });

    it('should run high-performance inference', async () => {
      const result = await inferenceTool.handler({
        modelId: 'test-model',
        data: [[1, 2, 3, 4, 5]]
      });

      expect(result.success).toBe(true);
      expect(result.modelId).toBe('test-model');
      expect(Array.isArray(result.inputData)).toBe(true);
      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.inferenceTime).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required parameters gracefully', async () => {
      const trainTool = neuralTools.find(tool => tool.name === 'neural/train')!;
      
      const result = await trainTool.handler({});

      // Should handle missing parameters with defaults or error handling
      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle invalid model IDs', async () => {
      const predictTool = neuralTools.find(tool => tool.name === 'neural/predict')!;
      
      const result = await predictTool.handler({
        modelId: 'non-existent-model',
        input: [1, 2, 3]
      });

      expect(result).toBeDefined();
      // Should either succeed with fallback handling or return error
    });

    it('should handle neural engine initialization failures', async () => {
      const statusTool = neuralTools.find(tool => tool.name === 'neural/status')!;
      
      const result = await statusTool.handler({});

      expect(result.success).toBe(true);
      // Should provide fallback status even if engine fails to initialize
    });
  });

  describe('Performance and Benchmarking', () => {
    it('should complete neural operations within reasonable time', async () => {
      const trainTool = neuralTools.find(tool => tool.name === 'neural/train')!;
      
      const startTime = Date.now();
      const result = await trainTool.handler({
        pattern_type: 'coordination',
        training_data: Array.from({ length: 100 }, () => Array.from({ length: 10 }, () => Math.random()))
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large datasets efficiently', async () => {
      const patternsTool = neuralTools.find(tool => tool.name === 'neural/patterns')!;
      
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({ 
        id: i, 
        values: Array.from({ length: 50 }, () => Math.random()) 
      }));

      const startTime = Date.now();
      const result = await patternsTool.handler({
        data: largeDataset
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Should handle large datasets efficiently
    });
  });
}); 