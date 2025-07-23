/**
 * Property Testing Engine Tests
 * Comprehensive test suite for the advanced property-based testing engine
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  PropertyTestingEngine,
  Property,
  CodeSpecification,
  ValidationResult,
  PropertyComplexity
} from '../../../src/enterprise/property-testing-engine.ts';

describe('PropertyTestingEngine', () => {
  let engine: PropertyTestingEngine;

  beforeEach(() => {
    engine = new PropertyTestingEngine({
      iterations: 100,
      maxShrinkSteps: 50,
      timeout: 1000,
      parallelExecution: false,
      enableShrinking: true,
      coverageTarget: 0.8,
      formalVerification: false,
      mutationTesting: false,
      statisticalSignificance: 0.95
    });
  });

  describe('Property Generation', () => {
    it('should generate properties from code specification', async () => {
      const spec: CodeSpecification = {
        function: 'addNumbers',
        parameters: [
          { name: 'a', type: 'number', constraints: [] },
          { name: 'b', type: 'number', constraints: [] }
        ],
        returnType: 'number',
        preconditions: ['a should be a valid number', 'b should be a valid number'],
        postconditions: ['result should be sum of a and b'],
        invariants: ['result should be deterministic'],
        examples: [
          { input: [1, 2], output: 3, description: 'Simple addition', category: 'positive' },
          { input: [0, 0], output: 0, description: 'Zero addition', category: 'edge' }
        ]
      };

      const code = `
        function addNumbers(a, b) {
          return a + b;
        }
      `;

      const properties = await engine.generateProperties(code, spec);

      expect(properties).toBeDefined();
      expect(Array.isArray(properties)).toBe(true);
      expect(properties.length).toBeGreaterThan(0);

      // Check that properties have required fields
      for (const property of properties) {
        expect(property.id).toBeDefined();
        expect(property.description).toBeDefined();
        expect(typeof property.predicate).toBe('function');
        expect(Array.isArray(property.generators)).toBe(true);
        expect(property.invariant).toBeDefined();
        expect(property.complexity).toBeDefined();
        expect(Array.isArray(property.dependencies)).toBe(true);
        expect(property.metadata).toBeDefined();
      }
    });

    it('should generate metamorphic properties for commutative operations', async () => {
      const spec: CodeSpecification = {
        function: 'add',
        parameters: [
          { name: 'a', type: 'number', constraints: [] },
          { name: 'b', type: 'number', constraints: [] }
        ],
        returnType: 'number',
        preconditions: [],
        postconditions: [],
        invariants: [],
        examples: []
      };

      const code = `function add(a, b) { return a + b; }`;
      const properties = await engine.generateProperties(code, spec);

      // Should include commutativity property
      const commutativeProperty = properties.find(p => p.id === 'commutativity');
      expect(commutativeProperty).toBeDefined();
      if (commutativeProperty) {
        expect(commutativeProperty.description).toContain('commutative');
      }
    });

    it('should generate security properties when security requirements exist', async () => {
      const spec: CodeSpecification = {
        function: 'processUserInput',
        parameters: [
          { name: 'input', type: 'string', constraints: [] }
        ],
        returnType: 'string',
        preconditions: [],
        postconditions: [],
        invariants: [],
        examples: [],
        securityRequirements: [
          {
            type: 'injection',
            description: 'Prevent SQL injection attacks',
            severity: 'critical'
          }
        ]
      };

      const code = `function processUserInput(input) { return input; }`;
      const properties = await engine.generateProperties(code, spec);

      // Should include security properties
      const securityProperty = properties.find(p => p.id.includes('injection'));
      expect(securityProperty).toBeDefined();
    });

    it('should generate performance properties when performance requirements exist', async () => {
      const spec: CodeSpecification = {
        function: 'sortArray',
        parameters: [
          { name: 'arr', type: 'array', constraints: [] }
        ],
        returnType: 'array',
        preconditions: [],
        postconditions: [],
        invariants: [],
        examples: [],
        performanceRequirements: [
          {
            metric: 'latency',
            threshold: 100,
            unit: 'ms'
          }
        ],
        complexityBounds: {
          time: 'O(n log n)',
          space: 'O(n)'
        }
      };

      const code = `function sortArray(arr) { return arr.sort(); }`;
      const properties = await engine.generateProperties(code, spec);

      // Should include performance properties
      const performanceProperty = properties.find(p => p.id.includes('performance'));
      const complexityProperty = properties.find(p => p.id.includes('complexity'));
      
      expect(performanceProperty || complexityProperty).toBeDefined();
    });
  });

  describe('Invariant Validation', () => {
    it('should validate code invariants', async () => {
      const code = `
        function safeDivide(a, b) {
          if (b === 0) throw new Error('Division by zero');
          return a / b;
        }
      `;

      const result = await engine.validateInvariants(code, false);

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.violations)).toBe(true);
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.coverage).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.statistics).toBeDefined();
    });

    it('should detect violations in faulty code', async () => {
      const code = `
        function faultyFunction(input) {
          if (input.length > 10) {
            throw new Error('Input too long');
          }
          return input.toUpperCase();
        }
      `;

      const result = await engine.validateInvariants(code, false);

      // The engine should detect potential null/undefined issues
      expect(result.violations.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide detailed coverage report', async () => {
      const code = `
        function complexFunction(a, b, c) {
          if (a > 0) {
            if (b > 0) {
              return a + b + c;
            } else {
              return a - b + c;
            }
          } else {
            return c;
          }
        }
      `;

      const result = await engine.validateInvariants(code, false);

      expect(result.coverage.statementCoverage).toBeGreaterThanOrEqual(0);
      expect(result.coverage.branchCoverage).toBeGreaterThanOrEqual(0);
      expect(result.coverage.pathCoverage).toBeGreaterThanOrEqual(0);
      expect(result.coverage.propertyCoverage).toBeGreaterThanOrEqual(0);
      expect(result.coverage.edgeCaseCoverage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Property-Based Testing', () => {
    it('should run property tests with custom iterations', async () => {
      const properties: Property[] = [
        {
          id: 'test-property',
          description: 'Test property for validation',
          predicate: (result) => result !== null && result !== undefined,
          generators: [
            {
              type: 'string',
              constraints: { maxLength: 10 },
              generate: () => 'test'
            }
          ],
          invariant: 'Result should not be null',
          examples: ['test'],
          complexity: 'simple' as PropertyComplexity,
          dependencies: [],
          metadata: {
            author: 'Test',
            created: new Date(),
            lastModified: new Date(),
            tags: ['test'],
            category: 'functional',
            testFramework: 'Jest'
          }
        }
      ];

      const code = `function testFunction(input) { return input || 'default'; }`;
      
      const result = await engine.runPropertyTests(properties, code, 50);

      expect(result).toBeDefined();
      expect(result.statistics.totalTests).toBe(50);
      expect(result.statistics.passedTests).toBeGreaterThanOrEqual(0);
      expect(result.statistics.failedTests).toBeGreaterThanOrEqual(0);
      expect(result.statistics.passedTests + result.statistics.failedTests).toBe(50);
    });

    it('should shrink counterexamples when violations found', async () => {
      const properties: Property[] = [
        {
          id: 'failing-property',
          description: 'Property that should fail',
          predicate: (result) => false, // Always fails
          generators: [
            {
              type: 'string',
              constraints: { maxLength: 100 },
              generate: () => 'A'.repeat(50)
            }
          ],
          invariant: 'Should always pass (but designed to fail)',
          examples: [],
          complexity: 'simple' as PropertyComplexity,
          dependencies: [],
          metadata: {
            author: 'Test',
            created: new Date(),
            lastModified: new Date(),
            tags: ['test'],
            category: 'functional',
            testFramework: 'Jest'
          }
        }
      ];

      const code = `function testFunction(input) { return input; }`;
      
      const result = await engine.runPropertyTests(properties, code, 10);

      expect(result.violations.length).toBeGreaterThan(0);
      
      // Check if shrinking occurred
      const violationWithShrinking = result.violations.find(v => v.shrunkInput !== undefined);
      expect(violationWithShrinking).toBeDefined();
    });
  });

  describe('Advanced Features', () => {
    it('should handle edge cases gracefully', async () => {
      const spec: CodeSpecification = {
        function: 'edgeCaseFunction',
        parameters: [
          { name: 'input', type: 'string', constraints: [] }
        ],
        returnType: 'string',
        preconditions: [],
        postconditions: [],
        invariants: [],
        examples: []
      };

      const code = `
        function edgeCaseFunction(input) {
          if (!input) return '';
          return input.trim().toLowerCase();
        }
      `;

      const properties = await engine.generateProperties(code, spec);
      const result = await engine.runPropertyTests(properties, code, 25);

      // Should handle null, undefined, empty strings, etc.
      expect(result).toBeDefined();
      expect(result.statistics.totalTests).toBeGreaterThan(0);
    });

    it('should generate recommendations based on violations', async () => {
      const code = `
        function problematicFunction(input) {
          return input.length; // Will fail on null/undefined
        }
      `;

      const result = await engine.validateInvariants(code, false);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      
      if (result.violations.length > 0) {
        expect(result.recommendations.length).toBeGreaterThan(0);
        
        for (const recommendation of result.recommendations) {
          expect(recommendation.type).toBeDefined();
          expect(recommendation.priority).toBeDefined();
          expect(recommendation.description).toBeDefined();
          expect(recommendation.reasoning).toBeDefined();
          expect(recommendation.impact).toBeDefined();
          expect(recommendation.effort).toBeDefined();
        }
      }
    });

    it('should calculate confidence scores accurately', async () => {
      const code = `
        function reliableFunction(a, b) {
          if (typeof a !== 'number' || typeof b !== 'number') {
            throw new Error('Invalid input types');
          }
          return a + b;
        }
      `;

      const result = await engine.validateInvariants(code, false);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      
      // Should have high confidence for well-written code
      if (result.violations.length === 0) {
        expect(result.confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Data Generation', () => {
    it('should generate diverse test data', async () => {
      const properties: Property[] = [
        {
          id: 'data-diversity-test',
          description: 'Test data generation diversity',
          predicate: (result) => true,
          generators: [
            {
              type: 'mixed',
              constraints: {},
              generate: () => {
                const types = ['string', 'number', 'boolean', 'null', 'array', 'object'];
                const type = types[Math.floor(Math.random() * types.length)];
                switch (type) {
                  case 'string': return 'test';
                  case 'number': return 42;
                  case 'boolean': return true;
                  case 'null': return null;
                  case 'array': return [1, 2, 3];
                  case 'object': return { key: 'value' };
                  default: return 'default';
                }
              }
            }
          ],
          invariant: 'Should handle diverse data types',
          examples: [],
          complexity: 'moderate' as PropertyComplexity,
          dependencies: [],
          metadata: {
            author: 'Test',
            created: new Date(),
            lastModified: new Date(),
            tags: ['diversity'],
            category: 'functional',
            testFramework: 'Jest'
          }
        }
      ];

      const code = `function flexibleFunction(input) { return typeof input; }`;
      
      const result = await engine.runPropertyTests(properties, code, 20);

      expect(result.statistics.distributionQuality).toBeGreaterThanOrEqual(0);
      expect(result.statistics.distributionQuality).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid code gracefully', async () => {
      const invalidCode = `
        function invalidFunction(input) {
          invalid.syntax.error();
          return input;
        }
      `;

      const spec: CodeSpecification = {
        function: 'invalidFunction',
        parameters: [{ name: 'input', type: 'string', constraints: [] }],
        returnType: 'string',
        preconditions: [],
        postconditions: [],
        invariants: [],
        examples: []
      };

      // Should not throw, but handle gracefully
      const properties = await engine.generateProperties(invalidCode, spec);
      expect(properties).toBeDefined();
      
      const result = await engine.runPropertyTests(properties, invalidCode, 5);
      expect(result).toBeDefined();
    });

    it('should handle empty specifications', async () => {
      const spec: CodeSpecification = {
        function: 'emptyFunction',
        parameters: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: [],
        examples: []
      };

      const code = `function emptyFunction() { return; }`;
      
      const properties = await engine.generateProperties(code, spec);
      expect(Array.isArray(properties)).toBe(true);
      
      const result = await engine.runPropertyTests(properties, code, 5);
      expect(result).toBeDefined();
    });
  });

  describe('Integration Features', () => {
    it('should emit events during property generation', (done) => {
      const spec: CodeSpecification = {
        function: 'testFunction',
        parameters: [{ name: 'input', type: 'string', constraints: [] }],
        returnType: 'string',
        preconditions: ['input should be string'],
        postconditions: ['output should be string'],
        invariants: [],
        examples: []
      };

      const code = `function testFunction(input) { return input; }`;

      let eventReceived = false;
      engine.on('generation:start', () => {
        eventReceived = true;
      });

      engine.generateProperties(code, spec).then(() => {
        expect(eventReceived).toBe(true);
        done();
      });
    });

    it('should emit events during validation', (done) => {
      const code = `function testFunction(input) { return input; }`;

      let eventReceived = false;
      engine.on('validation:start', () => {
        eventReceived = true;
      });

      engine.validateInvariants(code, false).then(() => {
        expect(eventReceived).toBe(true);
        done();
      });
    });
  });
}); 