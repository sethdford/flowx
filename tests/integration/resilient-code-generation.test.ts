import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PropertyTestingEngine, CodeSpecification } from '../../src/enterprise/property-testing-engine';
import { CleanArchitectureEngine, ArchitecturalContext } from '../../src/enterprise/clean-architecture-engine';

describe('Resilient Code Generation Integration', () => {
  let propertyEngine: PropertyTestingEngine;
  let architectureEngine: CleanArchitectureEngine;

  beforeEach(() => {
    propertyEngine = new PropertyTestingEngine();
    architectureEngine = new CleanArchitectureEngine();
  });

  afterEach(() => {
    propertyEngine.removeAllListeners();
    architectureEngine.removeAllListeners();
  });

  describe('Property-Based Testing Engine', () => {
    it('should generate properties from code specification', async () => {
      const spec: CodeSpecification = {
        function: 'calculateDiscount',
        parameters: [
          { name: 'price', type: 'number', constraints: ['positive'] },
          { name: 'discountPercent', type: 'number', constraints: ['0-100'] }
        ],
        returnType: 'number',
        preconditions: ['price > 0', 'discountPercent >= 0', 'discountPercent <= 100'],
        postconditions: ['result >= 0', 'result <= price'],
        invariants: ['discounted price should not exceed original price'],
        examples: [
          { input: [100, 10], output: 90, description: 'basic discount' },
          { input: [100, 0], output: 100, description: 'no discount' }
        ]
      };

      const code = `
        function calculateDiscount(price: number, discountPercent: number): number {
          if (discountPercent < 0 || discountPercent > 100) {
            throw new Error('Invalid discount percentage');
          }
          return price * (1 - discountPercent / 100);
        }
      `;

      const properties = await propertyEngine.generateProperties(code, spec);

      expect(properties.length).toBeGreaterThan(0);
      expect(properties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining('null-safety'),
            description: expect.stringContaining('null'),
            invariant: expect.any(String)
          })
        ])
      );
    });

    it('should validate invariants and detect violations', async () => {
      const code = `
        function unsafeCalculateDiscount(price: number, discountPercent: number): number {
          // Bug: doesn't validate input ranges
          return price * (1 - discountPercent / 100);
        }
      `;

      const result = await propertyEngine.validateInvariants(code);

      expect(result).toMatchObject({
        valid: expect.any(Boolean),
        violations: expect.any(Array),
        coverage: expect.any(Number),
        confidence: expect.any(Number),
        recommendations: expect.any(Array)
      });
    });

    it('should run property-based tests with generated data', async () => {
      const properties = [
        {
          id: 'positive-result',
          description: 'Result should be positive for valid inputs',
          predicate: (result: any) => result && result.success && result.data >= 0,
          generators: [
            {
              type: 'number',
              constraints: { min: 1, max: 1000 },
              generate: () => Math.random() * 1000 + 1
            }
          ],
          invariant: 'Result >= 0',
          examples: []
        }
      ];

      const code = 'function test(x) { return { success: true, data: Math.abs(x) }; }';
      const result = await propertyEngine.runPropertyTests(properties, code, 100);

      expect(result.valid).toBe(true);
      expect(result.coverage).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Clean Architecture Engine', () => {
    it('should validate SOLID principles in code', async () => {
      const context: ArchitecturalContext = {
        projectType: 'api',
        architecture: 'clean',
        frameworks: ['express'],
        constraints: ['no-external-dependencies-in-domain']
      };

      const code = `
        // Good: Single Responsibility
        class UserValidator {
          validateEmail(email: string): boolean {
            return email.includes('@');
          }
        }

        class UserRepository {
          save(user: User): void {
            // Save user to database
          }
        }

        // Bad: Multiple Responsibilities
        class UserManager {
          validateEmail(email: string): boolean {
            return email.includes('@');
          }
          
          saveUser(user: User): void {
            // Save user to database
          }
          
          sendWelcomeEmail(user: User): void {
            // Send email
          }
          
          generateReport(): string {
            return 'report';
          }
        }
      `;

      const report = await architectureEngine.validateArchitecture(code, context);

      expect(report).toMatchObject({
        solidCompliance: expect.objectContaining({
          singleResponsibility: expect.objectContaining({
            valid: expect.any(Boolean),
            classResponsibilities: expect.any(Array),
            cohesionScore: expect.any(Number)
          }),
          overallScore: expect.any(Number)
        }),
        layerSeparation: expect.any(Object),
        dependencyDirection: expect.any(Object),
        designPatterns: expect.any(Object),
        recommendations: expect.any(Array),
        overallScore: expect.any(Number)
      });

      // Should detect SRP violation in UserManager
      const srpViolations = report.solidCompliance.singleResponsibility.classResponsibilities
        .filter(r => r.violatesRule);
      
      expect(srpViolations.length).toBeGreaterThan(0);
      expect(srpViolations[0].className).toBe('UserManager');
    });

    it('should generate architectural recommendations', async () => {
      const context: ArchitecturalContext = {
        projectType: 'web',
        architecture: 'layered',
        frameworks: ['react'],
        constraints: []
      };

      const codeWithViolations = `
        // Anti-pattern: God Object
        class ApplicationController {
          handleUserRegistration() {}
          handleUserLogin() {}
          handlePasswordReset() {}
          handleEmailVerification() {}
          handlePaymentProcessing() {}
          handleInventoryManagement() {}
          handleReportGeneration() {}
          generatePDF() {}
          sendNotifications() {}
          validateInputs() {}
        }
      `;

      const report = await architectureEngine.validateArchitecture(codeWithViolations, context);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/refactor|pattern|structure|dependency/),
            priority: expect.stringMatching(/low|medium|high|critical/),
            description: expect.any(String),
            benefit: expect.any(String),
            effort: expect.any(String),
            steps: expect.any(Array)
          })
        ])
      );
    });

    it('should calculate overall architectural score', async () => {
      const context: ArchitecturalContext = {
        projectType: 'api',
        architecture: 'clean',
        frameworks: [],
        constraints: []
      };

      const goodCode = `
        interface UserRepository {
          findById(id: string): User | null;
          save(user: User): void;
        }

        class User {
          constructor(
            private readonly id: string,
            private readonly email: string
          ) {}

          getId(): string { return this.id; }
          getEmail(): string { return this.email; }
        }

        class UserService {
          constructor(private userRepository: UserRepository) {}

          createUser(email: string): User {
            const user = new User(generateId(), email);
            this.userRepository.save(user);
            return user;
          }
        }
      `;

      const report = await architectureEngine.validateArchitecture(goodCode, context);

      expect(report.overallScore).toBeGreaterThanOrEqual(0);
             expect(report.overallScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Integrated Resilient Code Generation', () => {
    it('should combine property-based testing with architectural validation', async () => {
      const spec: CodeSpecification = {
        function: 'UserService.createUser',
        parameters: [
          { name: 'email', type: 'string', constraints: ['valid-email'] }
        ],
        returnType: 'User',
        preconditions: ['email is valid format'],
        postconditions: ['user is created', 'user has valid id'],
        invariants: ['user email matches input email'],
        examples: [
          { input: ['test@example.com'], output: 'User', description: 'create valid user' }
        ]
      };

      const context: ArchitecturalContext = {
        projectType: 'api',
        architecture: 'clean',
        frameworks: [],
        constraints: ['domain-purity']
      };

      const code = `
        class User {
          constructor(
            private readonly id: string,
            private readonly email: string
          ) {}

          getId(): string { return this.id; }
          getEmail(): string { return this.email; }
        }

        interface UserRepository {
          save(user: User): void;
        }

        class UserService {
          constructor(private userRepository: UserRepository) {}

          createUser(email: string): User {
            if (!this.isValidEmail(email)) {
              throw new Error('Invalid email format');
            }
            
            const user = new User(this.generateId(), email);
            this.userRepository.save(user);
            return user;
          }

          private isValidEmail(email: string): boolean {
            return email.includes('@') && email.includes('.');
          }

          private generateId(): string {
            return Math.random().toString(36).substr(2, 9);
          }
        }
      `;

      // Test both engines together
      const [properties, architecturalReport] = await Promise.all([
        propertyEngine.generateProperties(code, spec),
        architectureEngine.validateArchitecture(code, context)
      ]);

      // Property-based testing should generate relevant properties
      expect(properties.length).toBeGreaterThan(0);
      
      // Architecture should be well-structured
      expect(architecturalReport.overallScore).toBeGreaterThan(0.7);
      expect(architecturalReport.solidCompliance.singleResponsibility.valid).toBe(true);

      // Should have minimal recommendations (good architecture)
      expect(architecturalReport.recommendations.length).toBeLessThan(3);

      // Run property tests to validate code behavior
      const propertyTestResult = await propertyEngine.runPropertyTests(properties, code, 50);
      expect(propertyTestResult.confidence).toBeGreaterThan(0.8);
    });

    it('should provide comprehensive resilient code assessment', async () => {
      const badCode = `
        // Violates multiple principles
        class UserManagerGodClass {
          private database: any;
          private emailService: any;
          private logger: any;

          // SRP violation: multiple responsibilities
          createUser(email: string, password: string) {
            // No input validation
            const user = { id: Math.random(), email, password };
            
            // Direct database access (DIP violation)
            this.database.users.push(user);
            
            // Multiple responsibilities
            this.sendWelcomeEmail(email);
            this.logUserCreation(user);
            this.updateStatistics();
            
            return user;
          }

          validateEmail(email: string) {
            return true; // No actual validation
          }

          sendWelcomeEmail(email: string) {
            this.emailService.send(email, 'Welcome!');
          }

          logUserCreation(user: any) {
            this.logger.log('User created: ' + user.id);
          }

          updateStatistics() {
            // Statistics logic mixed in
          }

          // ISP violation: unrelated method
          generateReport() {
            return 'Some report';
          }
        }
      `;

      const spec: CodeSpecification = {
        function: 'createUser',
        parameters: [
          { name: 'email', type: 'string', constraints: ['required', 'valid-email'] },
          { name: 'password', type: 'string', constraints: ['required', 'min-length-8'] }
        ],
        returnType: 'User',
        preconditions: ['email is valid', 'password meets requirements'],
        postconditions: ['user is created', 'user is persisted'],
        invariants: ['user data integrity'],
        examples: []
      };

      const context: ArchitecturalContext = {
        projectType: 'web',
        architecture: 'clean',
        frameworks: [],
        constraints: ['no-god-objects']
      };

      const [properties, architecturalReport] = await Promise.all([
        propertyEngine.generateProperties(badCode, spec),
        architectureEngine.validateArchitecture(badCode, context)
      ]);

      // Should detect multiple architectural issues
      expect(architecturalReport.overallScore).toBeLessThan(0.5);
      expect(architecturalReport.recommendations.length).toBeGreaterThan(0);
      
      // Should include SRP violations
      expect(architecturalReport.solidCompliance.singleResponsibility.valid).toBe(false);
      
      // Property tests should detect edge case issues
      const propertyTestResult = await propertyEngine.runPropertyTests(properties, badCode, 50);
      expect(propertyTestResult.confidence).toBeLessThan(0.8);
      expect(propertyTestResult.violations.length).toBeGreaterThan(0);

      // Combined assessment should recommend refactoring
      const criticalRecommendations = architecturalReport.recommendations
        .filter(r => r.priority === 'critical' || r.priority === 'high');
      
      expect(criticalRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    it('should emit events during property generation', async () => {
      const events: string[] = [];
      
      propertyEngine.on('generation:start', () => events.push('generation:start'));
      propertyEngine.on('generation:complete', () => events.push('generation:complete'));

      const spec: CodeSpecification = {
        function: 'test',
        parameters: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: [],
        examples: []
      };

      await propertyEngine.generateProperties('function test() {}', spec);

      expect(events).toContain('generation:start');
      expect(events).toContain('generation:complete');
    });

    it('should emit events during architectural validation', async () => {
      const events: string[] = [];
      
      architectureEngine.on('validation:start', () => events.push('validation:start'));
      architectureEngine.on('validation:complete', () => events.push('validation:complete'));

      const context: ArchitecturalContext = {
        projectType: 'api',
        architecture: 'clean',
        frameworks: [],
        constraints: []
      };

      await architectureEngine.validateArchitecture('class Test {}', context);

      expect(events).toContain('validation:start');
      expect(events).toContain('validation:complete');
    });
  });
}); 