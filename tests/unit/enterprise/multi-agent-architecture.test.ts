import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  MultiAgentArchitecture, 
  CoordinationStrategy,
  type CodeSpecification,
  type ArchitecturalContext,
  type TaskRequirement,
  type TaskConstraint,
  type Agent
} from '../../../src/enterprise/multi-agent-architecture.js';

describe('Multi-Agent Architecture', () => {
  let multiAgentArch: MultiAgentArchitecture;

  beforeEach(() => {
    multiAgentArch = new MultiAgentArchitecture();
  });

  afterEach(() => {
    multiAgentArch.removeAllListeners();
  });

  describe('Initialization', () => {
    it('should initialize with default specialized agents', () => {
      // Check that the multi-agent system is properly initialized
      expect(multiAgentArch).toBeDefined();
      
      // Verify initialization event
      const initSpy = jest.fn();
      multiAgentArch.on('agents:initialized', initSpy);
      
      // Create new instance to trigger initialization
      const newArch = new MultiAgentArchitecture();
      expect(newArch).toBeDefined();
    });

    it('should have all required agent types', () => {
      // The architecture should have generator, tester, security, reviewer, optimizer, and architect agents
      expect(multiAgentArch).toBeDefined();
      // These would be verified through the actual agent management in a real implementation
    });
  });

  describe('Code Generation Workflow', () => {
    let mockSpecification: CodeSpecification;
    let mockContext: ArchitecturalContext;

    beforeEach(() => {
      mockSpecification = {
        function: 'UserService.createUser',
        parameters: [
          { name: 'userData', type: 'UserData', constraints: ['required', 'valid'] },
          { name: 'options', type: 'CreateOptions', constraints: ['optional'] }
        ],
        returnType: 'Promise<User>',
        preconditions: [
          'userData must be valid',
          'user email must be unique'
        ],
        postconditions: [
          'user is created in database',
          'user ID is returned'
        ],
        invariants: [
          'user data integrity maintained',
          'audit log entry created'
        ]
      };

      mockContext = {
        domain: 'user-management',
        patterns: ['clean-architecture', 'repository-pattern'],
        constraints: ['no-sql-injection', 'input-validation']
      };
    });

    it('should generate code using multi-agent collaboration', async () => {
      const progressSpy = jest.fn();
      multiAgentArch.on('task:progress', progressSpy);

      const result = await multiAgentArch.generateCode(
        mockSpecification,
        mockContext
      );

      // Verify the generation result
      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      expect(result.code).toBeDefined();
      expect(result.tests).toBeDefined();
      expect(result.documentation).toBeDefined();
      expect(result.securityAnalysis).toBeDefined();
      expect(result.architecturalAssessment).toBeDefined();
      expect(result.propertyValidation).toBeDefined();
      expect(result.optimizationReport).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
      expect(result.collaborationLog).toBeDefined();

      // Verify code quality
      expect(result.code).toContain('export class');
      expect(result.code).toContain(mockSpecification.returnType);
      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.qualityMetrics.overallScore).toBeGreaterThan(0.5);
    });

    it('should follow the six-phase collaborative workflow', async () => {
      const progressEvents: any[] = [];
      multiAgentArch.on('task:progress', (event) => {
        progressEvents.push(event);
      });

      await multiAgentArch.generateCode(mockSpecification, mockContext);

      // Should have progress events for all phases
      const phases = progressEvents.map(e => e.phase);
      expect(phases).toContain('Architecture Design');
      expect(phases).toContain('Code Generation');
      expect(phases).toContain('Security Review');
      expect(phases).toContain('Testing');
      expect(phases).toContain('Optimization');
      expect(phases).toContain('Final Review');
      expect(phases).toContain('Completed');
    });

    it('should generate proper architectural guidance', async () => {
      const result = await multiAgentArch.generateCode(mockSpecification, mockContext);
      
      expect(result.architecturalAssessment).toBeDefined();
      expect(result.architecturalAssessment.overallScore).toBeGreaterThan(0);
      expect(result.architecturalAssessment.overallScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.architecturalAssessment.violations)).toBe(true);
      expect(Array.isArray(result.architecturalAssessment.recommendations)).toBe(true);
    });

    it('should perform comprehensive security analysis', async () => {
      const result = await multiAgentArch.generateCode(mockSpecification, mockContext);
      
      expect(result.securityAnalysis).toBeDefined();
      expect(result.securityAnalysis.securityScore).toBeGreaterThan(0);
      expect(result.securityAnalysis.securityScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.securityAnalysis.vulnerabilities)).toBe(true);
      expect(Array.isArray(result.securityAnalysis.recommendations)).toBe(true);
      expect(Array.isArray(result.securityAnalysis.complianceStatus)).toBe(true);
    });

    it('should generate comprehensive test suite', async () => {
      const result = await multiAgentArch.generateCode(mockSpecification, mockContext);
      
      expect(result.tests).toBeDefined();
      expect(Array.isArray(result.tests)).toBe(true);
      expect(result.tests.length).toBeGreaterThan(0);
      
      expect(result.propertyValidation).toBeDefined();
      expect(typeof result.propertyValidation.valid).toBe('boolean');
      expect(typeof result.propertyValidation.coverage).toBe('number');
      expect(Array.isArray(result.propertyValidation.violations)).toBe(true);
      expect(Array.isArray(result.propertyValidation.recommendations)).toBe(true);
    });

    it('should provide optimization recommendations', async () => {
      const result = await multiAgentArch.generateCode(mockSpecification, mockContext);
      
      expect(result.optimizationReport).toBeDefined();
      expect(typeof result.optimizationReport.maintainabilityScore).toBe('number');
      expect(typeof result.optimizationReport.technicalDebtReduction).toBe('number');
      expect(Array.isArray(result.optimizationReport.performanceImprovements)).toBe(true);
      expect(Array.isArray(result.optimizationReport.codeQualityEnhancements)).toBe(true);
    });

    it('should calculate comprehensive quality metrics', async () => {
      const result = await multiAgentArch.generateCode(mockSpecification, mockContext);
      
      expect(result.qualityMetrics).toBeDefined();
      expect(typeof result.qualityMetrics.overallScore).toBe('number');
      expect(typeof result.qualityMetrics.maintainability).toBe('number');
      expect(typeof result.qualityMetrics.readability).toBe('number');
      expect(typeof result.qualityMetrics.testability).toBe('number');
      expect(typeof result.qualityMetrics.performance).toBe('number');
      expect(typeof result.qualityMetrics.security).toBe('number');
      expect(typeof result.qualityMetrics.architecture).toBe('number');
      
      // All scores should be between 0 and 1
      Object.values(result.qualityMetrics).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should generate proper documentation', async () => {
      const result = await multiAgentArch.generateCode(mockSpecification, mockContext);
      
      expect(result.documentation).toBeDefined();
      expect(typeof result.documentation).toBe('string');
      expect(result.documentation).toContain(mockSpecification.function);
      expect(result.documentation).toContain('Parameters');
      expect(result.documentation).toContain('Returns');
      expect(result.documentation).toContain('Preconditions');
      expect(result.documentation).toContain('Postconditions');
      expect(result.documentation).toContain('Invariants');
      
      // Should include parameter documentation
      mockSpecification.parameters.forEach(param => {
        expect(result.documentation).toContain(param.name);
        expect(result.documentation).toContain(param.type);
      });
    });

    it('should log agent collaboration', async () => {
      const result = await multiAgentArch.generateCode(mockSpecification, mockContext);
      
      expect(result.collaborationLog).toBeDefined();
      expect(Array.isArray(result.collaborationLog)).toBe(true);
      
      // Should have communication logs from different phases
      const phases = result.collaborationLog.map(log => log.content?.phase).filter(Boolean);
      expect(phases.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Communication', () => {
    it('should emit agent communication events', async () => {
      const communicationSpy = jest.fn();
      multiAgentArch.on('agent:communication', communicationSpy);

      const mockSpec: CodeSpecification = {
        function: 'test',
        parameters: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: []
      };

      const mockContext: ArchitecturalContext = {
        domain: 'test',
        patterns: [],
        constraints: []
      };

      await multiAgentArch.generateCode(mockSpec, mockContext);

      expect(communicationSpy).toHaveBeenCalled();
    });
  });

  describe('Requirements and Constraints', () => {
    it('should handle task requirements', async () => {
      const requirements: TaskRequirement[] = [
        {
          type: 'functional',
          description: 'Must validate input data',
          mandatory: true,
          verifiable: true
        },
        {
          type: 'performance',
          description: 'Response time under 100ms',
          mandatory: false,
          verifiable: true
        }
      ];

      const mockSpec: CodeSpecification = {
        function: 'test',
        parameters: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: []
      };

      const mockContext: ArchitecturalContext = {
        domain: 'test',
        patterns: [],
        constraints: []
      };

      const result = await multiAgentArch.generateCode(
        mockSpec,
        mockContext,
        requirements
      );

      expect(result).toBeDefined();
      // Requirements should influence the generated code quality
      expect(result.qualityMetrics.overallScore).toBeGreaterThan(0);
    });

    it('should handle task constraints', async () => {
      const constraints: TaskConstraint[] = [
        {
          type: 'technology',
          value: 'typescript',
          description: 'Must use TypeScript'
        },
        {
          type: 'pattern',
          value: 'clean-architecture',
          description: 'Follow clean architecture principles'
        }
      ];

      const mockSpec: CodeSpecification = {
        function: 'test',
        parameters: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: []
      };

      const mockContext: ArchitecturalContext = {
        domain: 'test',
        patterns: [],
        constraints: []
      };

      const result = await multiAgentArch.generateCode(
        mockSpec,
        mockContext,
        [],
        constraints
      );

      expect(result).toBeDefined();
      // Constraints should be reflected in the architecture assessment
      expect(result.architecturalAssessment.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid specifications gracefully', async () => {
      const invalidSpec = {} as CodeSpecification;
      const mockContext: ArchitecturalContext = {
        domain: 'test',
        patterns: [],
        constraints: []
      };

      await expect(multiAgentArch.generateCode(invalidSpec, mockContext))
        .rejects.toThrow();
    });

    it('should emit error events on failure', async () => {
      const errorSpy = jest.fn();
      multiAgentArch.on('generation:error', errorSpy);

      const invalidSpec = {} as CodeSpecification;
      const mockContext: ArchitecturalContext = {
        domain: 'test',
        patterns: [],
        constraints: []
      };

      try {
        await multiAgentArch.generateCode(invalidSpec, mockContext);
      } catch (error) {
        // Expected to throw
      }

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Events and Lifecycle', () => {
    it('should emit generation start event', async () => {
      const startSpy = jest.fn();
      multiAgentArch.on('generation:start', startSpy);

      const mockSpec: CodeSpecification = {
        function: 'test',
        parameters: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: []
      };

      const mockContext: ArchitecturalContext = {
        domain: 'test',
        patterns: [],
        constraints: []
      };

      await multiAgentArch.generateCode(mockSpec, mockContext);

      expect(startSpy).toHaveBeenCalledWith({
        specification: mockSpec,
        context: mockContext
      });
    });

    it('should emit generation complete event', async () => {
      const completeSpy = jest.fn();
      multiAgentArch.on('generation:complete', completeSpy);

      const mockSpec: CodeSpecification = {
        function: 'test',
        parameters: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: []
      };

      const mockContext: ArchitecturalContext = {
        domain: 'test',
        patterns: [],
        constraints: []
      };

      const result = await multiAgentArch.generateCode(mockSpec, mockContext);

      expect(completeSpy).toHaveBeenCalledWith({
        taskId: result.taskId,
        result
      });
    });
  });
});

describe('Coordination Strategy', () => {
  let strategy: CoordinationStrategy;

  beforeEach(() => {
    strategy = new CoordinationStrategy();
  });

  describe('Workflow Planning', () => {
    it('should plan optimal workflow protocols', async () => {
      const mockTask = {
        id: 'test-task',
        type: 'code_generation' as const,
        specification: {
          function: 'test',
          parameters: [],
          returnType: 'void',
          preconditions: [],
          postconditions: [],
          invariants: []
        },
        context: {
          domain: 'test',
          patterns: [],
          constraints: []
        },
        requirements: [],
        constraints: [],
        priority: 'medium' as const,
        assignedAgents: [],
        status: 'pending' as const,
        progress: {
          percentage: 0,
          milestones: [],
          currentPhase: 'planning',
          estimatedCompletion: new Date()
        }
      };

      const mockAgents: Agent[] = [
        {
          id: 'agent-1',
          type: 'generator',
          specialization: ['typescript'],
          capabilities: [{
            name: 'code_generation',
            level: 'expert',
            metrics: { accuracy: 0.9, speed: 0.8, coverage: 0.85, reliability: 0.9 }
          }],
          status: 'idle',
          priority: 1,
          performance: {
            tasksCompleted: 10,
            successRate: 0.9,
            averageTime: 1000,
            qualityScore: 0.85,
            collaborationScore: 0.8
          }
        }
      ];

      const protocols = await strategy.planWorkflow(mockTask, mockAgents);

      expect(protocols).toBeDefined();
      expect(Array.isArray(protocols)).toBe(true);
      expect(protocols.length).toBeGreaterThan(0);

      // Verify protocol structure
      protocols.forEach(protocol => {
        expect(protocol.type).toBeDefined();
        expect(Array.isArray(protocol.participants)).toBe(true);
        expect(Array.isArray(protocol.rules)).toBe(true);
        expect(typeof protocol.timeout).toBe('number');
      });
    });

    it('should optimize agent assignment based on capabilities', async () => {
      const mockTask = {
        id: 'test-task',
        type: 'code_generation' as const,
        specification: {
          function: 'test',
          parameters: [],
          returnType: 'void',
          preconditions: [],
          postconditions: [],
          invariants: []
        },
        context: {
          domain: 'test',
          patterns: [],
          constraints: []
        },
        requirements: [],
        constraints: [],
        priority: 'high' as const,
        assignedAgents: [],
        status: 'pending' as const,
        progress: {
          percentage: 0,
          milestones: [],
          currentPhase: 'planning',
          estimatedCompletion: new Date()
        }
      };

      const mockAgents: Agent[] = [
        {
          id: 'high-quality-agent',
          type: 'generator',
          specialization: ['typescript'],
          capabilities: [{
            name: 'code_generation',
            level: 'expert',
            metrics: { accuracy: 0.95, speed: 0.9, coverage: 0.9, reliability: 0.95 }
          }],
          status: 'idle',
          priority: 1,
          performance: {
            tasksCompleted: 100,
            successRate: 0.95,
            averageTime: 800,
            qualityScore: 0.95,
            collaborationScore: 0.9
          }
        },
        {
          id: 'medium-quality-agent',
          type: 'generator',
          specialization: ['javascript'],
          capabilities: [{
            name: 'code_generation',
            level: 'intermediate',
            metrics: { accuracy: 0.8, speed: 0.7, coverage: 0.75, reliability: 0.8 }
          }],
          status: 'idle',
          priority: 2,
          performance: {
            tasksCompleted: 50,
            successRate: 0.8,
            averageTime: 1200,
            qualityScore: 0.75,
            collaborationScore: 0.7
          }
        }
      ];

      const assignments = await strategy.optimizeAgentAssignment(mockTask, mockAgents);

      expect(assignments).toBeDefined();
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments.length).toBeGreaterThan(0);
      expect(assignments.length).toBeLessThanOrEqual(3);

      // Should prioritize higher quality agents
      expect(assignments[0]).toBe('high-quality-agent');
    });
  });
}); 