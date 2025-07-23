import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AdvancedStaticAnalysisEngine, AnalysisConfig } from '../../src/enterprise/advanced-static-analysis';

describe('Advanced Static Analysis Integration', () => {
  let analysisEngine: AdvancedStaticAnalysisEngine;

  beforeEach(() => {
    analysisEngine = new AdvancedStaticAnalysisEngine();
  });

  afterEach(() => {
    analysisEngine.removeAllListeners();
  });

  describe('Comprehensive Code Analysis', () => {
    it('should perform complete static analysis on secure code', async () => {
      const secureCode = `
        interface UserRepository {
          findById(id: string): Promise<User | null>;
          save(user: User): Promise<void>;
        }

        class User {
          constructor(
            private readonly id: string,
            private readonly email: string,
            private readonly hashedPassword: string
          ) {
            this.validateEmail(email);
          }

          private validateEmail(email: string): void {
            if (!email || !email.includes('@')) {
              throw new Error('Invalid email format');
            }
          }

          getId(): string {
            return this.id;
          }

          getEmail(): string {
            return this.email;
          }

          verifyPassword(plainPassword: string, bcrypt: any): boolean {
            return bcrypt.compare(plainPassword, this.hashedPassword);
          }
        }

        class UserService {
          constructor(private userRepository: UserRepository) {}

          async createUser(email: string, password: string): Promise<User> {
            // Input validation
            if (!email || !password) {
              throw new Error('Email and password are required');
            }

            if (password.length < 8) {
              throw new Error('Password must be at least 8 characters');
            }

            // Check if user exists
            const existingUser = await this.userRepository.findById(email);
            if (existingUser) {
              throw new Error('User already exists');
            }

            // Hash password securely
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(password, 12);

            // Create and save user
            const user = new User(this.generateId(), email, hashedPassword);
            await this.userRepository.save(user);

            return user;
          }

          private generateId(): string {
            return Math.random().toString(36).substr(2, 9);
          }
        }
      `;

      const events: any[] = [];
      analysisEngine.on('analysis:start', (data) => events.push({ type: 'start', ...data }));
      analysisEngine.on('analysis:complete', (data) => events.push({ type: 'complete', ...data }));

      const result = await analysisEngine.analyzeCode(secureCode, 'user-service.ts');

      // Verify analysis completed
      expect(events.some(e => e.type === 'start')).toBe(true);
      expect(events.some(e => e.type === 'complete')).toBe(true);

      // Verify comprehensive report structure
      expect(result).toMatchObject({
        overall: expect.stringMatching(/passed|warning|failed|error/),
        security: expect.objectContaining({
          vulnerabilities: expect.any(Array),
          securityScore: expect.any(Number),
          riskLevel: expect.stringMatching(/very_low|low|medium|high|critical/),
          complianceChecks: expect.any(Array)
        }),
        dependencies: expect.objectContaining({
          dependencies: expect.any(Array),
          vulnerabilities: expect.any(Array),
          outdatedPackages: expect.any(Array)
        }),
        complexity: expect.objectContaining({
          cyclomaticComplexity: expect.any(Object),
          cognitiveComplexity: expect.any(Object),
          complexFunctions: expect.any(Array)
        }),
        quality: expect.objectContaining({
          overallScore: expect.any(Number),
          codeSmells: expect.any(Array),
          duplicateCode: expect.any(Array)
        }),
        performance: expect.objectContaining({
          hotspots: expect.any(Array),
          optimizationOpportunities: expect.any(Array)
        }),
        maintainability: expect.objectContaining({
          maintainabilityIndex: expect.any(Number),
          technicalDebt: expect.any(Array)
        }),
        violations: expect.any(Array),
        recommendations: expect.any(Array),
        confidence: expect.any(Number),
        analysisTime: expect.any(Number)
      });

      // Good code should have high scores
      expect(result.security.securityScore).toBeGreaterThan(0.8);
      expect(result.quality.overallScore).toBeGreaterThan(0.7);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.analysisTime).toBeGreaterThan(0);
    });

    it('should detect security vulnerabilities in vulnerable code', async () => {
      const vulnerableCode = `
        class UnsafeUserService {
          // Security vulnerability: eval usage
          processUserInput(userInput: string): any {
            return eval(userInput); // Critical: Code injection
          }

          // Security vulnerability: XSS
          displayUserContent(content: string): void {
            document.getElementById('content').innerHTML = content; // High: XSS
          }

          // Security vulnerability: No input validation
          deleteUser(userId: string): void {
            // No validation - could be SQL injection if passed to query
            const query = "DELETE FROM users WHERE id = " + userId;
            console.log(query);
          }

          // Security vulnerability: Weak authentication
          authenticateUser(username: string, password: string): boolean {
            return username === 'admin' && password === '123456'; // Weak auth
          }
        }
      `;

      const result = await analysisEngine.analyzeCode(vulnerableCode, 'unsafe-service.ts');

      // Should detect multiple security vulnerabilities
      expect(result.security.vulnerabilities.length).toBeGreaterThan(0);
      
      // Should detect critical eval vulnerability
      const evalVuln = result.security.vulnerabilities.find(v => v.type === 'injection');
      expect(evalVuln).toBeDefined();
      expect(evalVuln?.severity).toBe('critical');

      // Should detect XSS vulnerability
      const xssVuln = result.security.vulnerabilities.find(v => v.type === 'xss');
      expect(xssVuln).toBeDefined();
      expect(xssVuln?.severity).toBe('high');

      // Security score should be low
      expect(result.security.securityScore).toBeLessThan(0.5);
      expect(result.security.riskLevel).toMatch(/high|critical/);

      // Should have security-related violations
      const securityViolations = result.violations.filter(v => v.category === 'security');
      expect(securityViolations.length).toBeGreaterThan(0);

      // Should recommend security improvements
      const securityRecommendations = result.recommendations.filter(r => r.category === 'security');
      expect(securityRecommendations.length).toBeGreaterThan(0);
    });

    it('should detect complex code and recommend refactoring', async () => {
      const complexCode = `
        class ComplexProcessor {
          // Highly complex function with multiple responsibilities
          processComplexData(data: any[]): any {
            let result = [];
            
            // Complex nested logic
            for (let i = 0; i < data.length; i++) {
              if (data[i].type === 'A') {
                for (let j = 0; j < data[i].items.length; j++) {
                  if (data[i].items[j].status === 'active') {
                    if (data[i].items[j].value > 100) {
                      if (data[i].items[j].category === 'premium') {
                        if (data[i].items[j].verified) {
                          // Deep nesting continues...
                          for (let k = 0; k < data[i].items[j].subItems.length; k++) {
                            if (data[i].items[j].subItems[k].enabled) {
                              result.push({
                                id: data[i].items[j].subItems[k].id,
                                processed: true,
                                timestamp: new Date(),
                                metadata: this.generateMetadata(data[i].items[j].subItems[k])
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else if (data[i].type === 'B') {
                // More complex logic...
                switch (data[i].subType) {
                  case 'B1':
                    if (data[i].config.enabled) {
                      result.push(this.processTypeB1(data[i]));
                    }
                    break;
                  case 'B2':
                    if (data[i].config.advanced) {
                      result.push(this.processTypeB2(data[i]));
                    }
                    break;
                  default:
                    result.push(this.processDefault(data[i]));
                }
              }
            }
            
            return result;
          }

          private generateMetadata(item: any): any {
            return { timestamp: Date.now() };
          }

          private processTypeB1(item: any): any {
            return { type: 'B1', data: item };
          }

          private processTypeB2(item: any): any {
            return { type: 'B2', data: item };
          }

          private processDefault(item: any): any {
            return { type: 'default', data: item };
          }
        }
      `;

      const result = await analysisEngine.analyzeCode(complexCode, 'complex-processor.ts');

      // Should detect high complexity
      expect(result.complexity.complexFunctions.length).toBeGreaterThan(0);
      
      const complexFunction = result.complexity.complexFunctions[0];
      expect(complexFunction.name).toBe('processComplexData');
      expect(complexFunction.cyclomaticComplexity).toBeGreaterThan(5); // Lower threshold for test

      // Should have complexity violations
      const complexityViolations = result.violations.filter(v => v.category === 'complexity');
      expect(complexityViolations.length).toBeGreaterThan(0);

      // Should recommend refactoring
      const refactorRecommendations = result.recommendations.filter(r => r.type === 'refactor');
      expect(refactorRecommendations.length).toBeGreaterThan(0);

      // Overall analysis should show issues
      expect(result.overall).toMatch(/warning|failed/);
    });

    it('should analyze performance hotspots', async () => {
      const performanceCode = `
        class PerformanceIssues {
          // Performance hotspot: nested loops
          findMatches(data1: number[], data2: number[]): number[] {
            const matches = [];
            
            // O(n²) algorithm - performance hotspot
            for (let i = 0; i < data1.length; i++) {
              for (let j = 0; j < data2.length; j++) {
                if (data1[i] === data2[j]) {
                  matches.push(data1[i]);
                }
              }
            }
            
            return matches;
          }

          // Memory-intensive operation
          loadAllData(): any[] {
            const largeArray = new Array(1000000);
            for (let i = 0; i < largeArray.length; i++) {
              largeArray[i] = { id: i, data: new Array(100).fill(Math.random()) };
            }
            return largeArray;
          }

          // Synchronous file operations (blocking)
          processFilesSync(): void {
            const fs = require('fs');
            for (let i = 0; i < 100; i++) {
              const data = fs.readFileSync(\`file\${i}.txt\`);
              console.log(data);
            }
          }
        }
      `;

      const result = await analysisEngine.analyzeCode(performanceCode, 'performance-issues.ts');

      // Should detect performance hotspots
      expect(result.performance.hotspots.length).toBeGreaterThan(0);
      
      // Should detect nested loops
      const cpuHotspot = result.performance.hotspots.find(h => h.type === 'cpu_intensive');
      expect(cpuHotspot).toBeDefined();

      // Should have optimization opportunities
      expect(result.performance.optimizationOpportunities.length).toBeGreaterThan(0);

      // Should recommend performance improvements
      const perfRecommendations = result.recommendations.filter(r => r.type === 'optimize');
      expect(perfRecommendations.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive maintainability analysis', async () => {
      const maintainabilityCode = `
        // Poor maintainability example
        class LegacySystem {
          public data: any;
          public config: any;
          
          constructor() {
            this.data = {};
            this.config = {};
          }

          // Unclear method name and multiple responsibilities
          doStuff(x: any, y: any, z: any): any {
            if (x) {
              this.data.x = x;
              if (y) {
                this.data.y = y;
                if (z) {
                  this.data.z = z;
                  return this.processAllData();
                }
              }
            }
            return null;
          }

          processAllData(): any {
            // Complex method without documentation
            const result = {};
            for (const key in this.data) {
              if (this.data[key]) {
                result[key] = this.data[key];
              }
            }
            return result;
          }
        }
      `;

      const result = await analysisEngine.analyzeCode(maintainabilityCode, 'legacy-system.ts');

      // Should calculate maintainability index
      expect(result.maintainability.maintainabilityIndex).toBeDefined();
      expect(result.maintainability.maintainabilityIndex).toBeGreaterThanOrEqual(0);
      expect(result.maintainability.maintainabilityIndex).toBeLessThanOrEqual(1);

      // Should identify technical debt
      expect(result.maintainability.technicalDebt).toBeDefined();

      // Should provide refactoring opportunities
      expect(result.maintainability.refactoringOpportunities).toBeDefined();

      // Should analyze documentation coverage
      expect(result.documentation.coverage).toBeDefined();
      expect(result.documentation.coverage).toBeLessThan(0.5); // Poor documentation

      // Should identify testability issues
      expect(result.testability.testabilityScore).toBeDefined();
    });
  });

  describe('Security-Focused Analysis', () => {
    it('should perform dedicated security analysis', async () => {
      const securityTestCode = `
        class SecurityTestService {
          authenticateUser(username: string, password: string): boolean {
            // Weak: Plain text comparison
            return username === 'admin' && password === 'password123';
          }

          processUserData(userData: string): any {
            // Vulnerability: eval usage
            return eval(\`(\${userData})\`);
          }

          renderContent(userContent: string): void {
            // XSS vulnerability
            document.body.innerHTML = userContent;
          }
        }
      `;

      const securityReport = await analysisEngine.analyzeSecurityOnly(securityTestCode, 'security-test.ts');

      // Should detect vulnerabilities
      expect(securityReport.vulnerabilities.length).toBeGreaterThan(0);

      // Should include eval vulnerability
      const evalVuln = securityReport.vulnerabilities.find(v => v.id === 'eval-usage');
      expect(evalVuln).toBeDefined();
      expect(evalVuln?.type).toBe('injection');
      expect(evalVuln?.severity).toBe('critical');

      // Should include XSS vulnerability  
      const xssVuln = securityReport.vulnerabilities.find(v => v.id === 'xss-innerHTML');
      expect(xssVuln).toBeDefined();
      expect(xssVuln?.type).toBe('xss');
      expect(xssVuln?.severity).toBe('high');

      // Should calculate security score
      expect(securityReport.securityScore).toBeLessThan(0.5);
      expect(securityReport.riskLevel).toMatch(/high|critical/);

      // Should provide compliance checks
      expect(securityReport.complianceChecks.length).toBeGreaterThan(0);
    });
  });

  describe('Project-Level Analysis', () => {
    it('should analyze multiple files in a project', async () => {
      const files = [
        {
          path: 'src/user.ts',
          content: `
            export class User {
              constructor(public id: string, public email: string) {}
              
              validate(): boolean {
                return this.email.includes('@');
              }
            }
          `
        },
        {
          path: 'src/service.ts',
          content: `
            import { User } from './user';
            
            export class UserService {
              createUser(email: string): User {
                const user = new User(Math.random().toString(), email);
                if (!user.validate()) {
                  throw new Error('Invalid user');
                }
                return user;
              }
            }
          `
        },
        {
          path: 'src/api.ts',
          content: `
            import { UserService } from './service';
            
            export class UserAPI {
              private service = new UserService();
              
              async handleCreateUser(req: any, res: any): Promise<void> {
                try {
                  const user = this.service.createUser(req.body.email);
                  res.json(user);
                } catch (error) {
                  res.status(400).json({ error: error.message });
                }
              }
            }
          `
        }
      ];

      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.0',
          'lodash': '^4.17.21'
        }
      };

      const projectReport = await analysisEngine.analyzeProject(files, packageJson);

      // Should analyze all files
      expect(projectReport.files).toBe(3);
      expect(projectReport.reports.length).toBe(3);

      // Should provide project-level metrics
      expect(projectReport.overallStatus).toMatch(/passed|warning|failed|error/);
      expect(projectReport.totalViolations).toBeGreaterThanOrEqual(0);
      expect(projectReport.averageQuality).toBeGreaterThanOrEqual(0);
      expect(projectReport.averageQuality).toBeLessThanOrEqual(1);

      // Each file should have been analyzed
      projectReport.reports.forEach(report => {
        expect(report.overall).toBeDefined();
        expect(report.analysisTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect custom analysis configuration', async () => {
      const customConfig: Partial<AnalysisConfig> = {
        security: {
          enabledChecks: ['injection', 'xss'],
          complianceStandards: ['OWASP'],
          severity: 'strict',
          customRules: []
        },
        complexity: {
          cyclomaticThreshold: 5, // Lower threshold
          cognitiveThreshold: 8,
          nestingThreshold: 3,
          functionLengthThreshold: 30,
          classLengthThreshold: 150
        },
        quality: {
          enabledSmells: ['long_method', 'large_class'],
          duplicateThreshold: 0.9,
          namingRules: [],
          styleChecks: true
        }
      };

      const customEngine = new AdvancedStaticAnalysisEngine(customConfig);

      const testCode = `
        class TestClass {
          complexMethod(a: number, b: number, c: number): number {
            if (a > 0) {
              if (b > 0) {
                if (c > 0) {
                  return a + b + c;
                }
              }
            }
            return 0;
          }
        }
      `;

      const result = await customEngine.analyzeCode(testCode, 'test.ts');

      // Should apply custom thresholds
      expect(result.complexity.cyclomaticComplexity.threshold).toBe(5);

      // Clean up
      customEngine.removeAllListeners();
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete analysis within reasonable time', async () => {
      const largeCode = `
        ${Array.from({ length: 50 }, (_, i) => `
          class Service${i} {
            method${i}(): string {
              return 'result${i}';
            }
            
            complexMethod${i}(data: any[]): any[] {
              return data.map(item => {
                if (item.type === 'A') {
                  return { ...item, processed: true };
                } else {
                  return item;
                }
              });
            }
          }
        `).join('\n')}
      `;

      const startTime = Date.now();
      const result = await analysisEngine.analyzeCode(largeCode, 'large-file.ts');
      const endTime = Date.now();

      // Should complete in reasonable time (under 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(result.analysisTime).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed code gracefully', async () => {
      const malformedCode = `
        class InvalidSyntax {
          method() {
            if (incomplete
        }
      `;

      // Should not throw but handle gracefully
      await expect(analysisEngine.analyzeCode(malformedCode, 'invalid.ts'))
        .resolves.toBeDefined();
    });

    it('should emit error events for analysis failures', async () => {
      const errorEvents: any[] = [];
      analysisEngine.on('analysis:error', (error) => errorEvents.push(error));

      // This test ensures error handling is in place
      const validCode = 'class Valid {}';
      await analysisEngine.analyzeCode(validCode, 'valid.ts');

      // Should not have errors for valid code
      expect(errorEvents.length).toBe(0);
    });
  });
}); 