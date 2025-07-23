import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { IntelligentCodeReviewEngine, ReviewConfiguration, CodeReviewContext } from '../../src/enterprise/intelligent-code-review.js';

describe('Intelligent Code Review Integration', () => {
  let reviewEngine: IntelligentCodeReviewEngine;

  beforeEach(() => {
    reviewEngine = new IntelligentCodeReviewEngine();
  });

  afterEach(() => {
    reviewEngine.removeAllListeners();
  });

  describe('Comprehensive Code Review', () => {
    it('should perform complete code review on high-quality code', async () => {
      const highQualityCode = `
        /**
         * User service for managing user operations
         */
        interface UserRepository {
          findById(id: string): Promise<User | null>;
          save(user: User): Promise<void>;
          delete(id: string): Promise<boolean>;
        }

        /**
         * Represents a user in the system
         */
        export class User {
          constructor(
            private readonly id: string,
            private readonly email: string,
            private readonly hashedPassword: string,
            private readonly createdAt: Date = new Date()
          ) {
            this.validateEmail(email);
            this.validatePassword(hashedPassword);
          }

          /**
           * Validates email format
           */
          private validateEmail(email: string): void {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(email)) {
              throw new Error('Invalid email format');
            }
          }

          /**
           * Validates password hash
           */
          private validatePassword(hashedPassword: string): void {
            if (!hashedPassword || hashedPassword.length < 10) {
              throw new Error('Invalid password hash');
            }
          }

          getId(): string {
            return this.id;
          }

          getEmail(): string {
            return this.email;
          }

          /**
           * Verifies user password using secure comparison
           */
          async verifyPassword(plainPassword: string, bcrypt: any): Promise<boolean> {
            try {
              return await bcrypt.compare(plainPassword, this.hashedPassword);
            } catch (error) {
              console.error('Password verification failed:', error);
              return false;
            }
          }
        }

        /**
         * Service for user management operations
         */
        export class UserService {
          constructor(private readonly userRepository: UserRepository) {
            if (!userRepository) {
              throw new Error('UserRepository is required');
            }
          }

          /**
           * Creates a new user with proper validation
           */
          async createUser(email: string, password: string): Promise<User> {
            try {
              // Input validation
              if (!email || !password) {
                throw new Error('Email and password are required');
              }

              if (password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
              }

              // Check if user already exists
              const existingUser = await this.findUserByEmail(email);
              if (existingUser) {
                throw new Error('User with this email already exists');
              }

              // Hash password securely
              const bcrypt = require('bcrypt');
              const saltRounds = 12;
              const hashedPassword = await bcrypt.hash(password, saltRounds);

              // Create and save user
              const user = new User(
                this.generateSecureId(),
                email,
                hashedPassword
              );

              await this.userRepository.save(user);
              return user;

            } catch (error) {
              console.error('User creation failed:', error);
              throw error;
            }
          }

          /**
           * Finds user by email address
           */
          private async findUserByEmail(email: string): Promise<User | null> {
            // This would need implementation based on repository pattern
            return null; // Simplified for demo
          }

          /**
           * Generates cryptographically secure ID
           */
          private generateSecureId(): string {
            const crypto = require('crypto');
            return crypto.randomUUID();
          }
        }
      `;

      const events: any[] = [];
      reviewEngine.on('review:start', (data) => events.push({ type: 'start', ...data }));
      reviewEngine.on('review:complete', (data) => events.push({ type: 'complete', ...data }));

      const context: CodeReviewContext = {
        projectType: 'api',
        architecture: 'clean',
        frameworks: ['express', 'bcrypt'],
        constraints: ['security-first', 'testable']
      };

      const result = await reviewEngine.reviewCode(highQualityCode, 'user-service.ts', context);

      // Verify review completed
      expect(events.some(e => e.type === 'start')).toBe(true);
      expect(events.some(e => e.type === 'complete')).toBe(true);

      // Verify comprehensive review structure
      expect(result).toMatchObject({
        overall: expect.stringMatching(/approved|approved_with_suggestions|changes_required|rejected/),
        reviewId: expect.any(String),
        timestamp: expect.any(Date),
        reviewer: expect.objectContaining({
          type: 'ai_agent',
          name: expect.any(String),
          expertise: expect.any(Array),
          experience: expect.any(Object)
        }),
        codeAnalysis: expect.objectContaining({
          staticAnalysis: expect.any(Object),
          architecturalAnalysis: expect.any(Object),
          testCoverage: expect.any(Object),
          performanceAnalysis: expect.any(Object),
          securityAnalysis: expect.any(Object),
          maintainabilityAnalysis: expect.any(Object)
        }),
        bestPractices: expect.objectContaining({
          overallScore: expect.any(Number),
          categories: expect.any(Array),
          violations: expect.any(Array),
          recommendations: expect.any(Array)
        }),
        improvements: expect.any(Array),
        suggestions: expect.any(Array),
        automatedFixes: expect.any(Array),
        metrics: expect.any(Object),
        approval: expect.objectContaining({
          status: expect.stringMatching(/approved|approved_with_suggestions|changes_required|rejected/),
          reasoning: expect.any(String)
        }),
        confidence: expect.any(Number),
        reviewTime: expect.any(Number)
      });

      // High-quality code should get good results
      expect(result.overall).toMatch(/approved|approved_with_suggestions/);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.metrics.quality.overallScore).toBeGreaterThan(0.7);
      expect(result.bestPractices.overallScore).toBeGreaterThan(0.7);
    });

    it('should identify multiple issues in problematic code', async () => {
      const problematicCode = `
        // Poor quality code with multiple issues
        class BadUserService {
          users = []; // Public array - bad encapsulation

          // No input validation, poor naming, security issues
          createUser(e, p) {
            // Critical: eval usage - code injection vulnerability
            const userData = eval('({email: "' + e + '", password: "' + p + '"})');
            
            // High: XSS vulnerability
            document.getElementById('output').innerHTML = 'User: ' + userData.email;
            
            // No password hashing - security issue
            const user = {
              id: Math.random(), // Weak ID generation
              email: userData.email,
              password: userData.password, // Plain text password!
              created: new Date()
            };
            
            // No duplicate checking
            this.users.push(user);
            
            return user;
          }

          // Overly complex method with deep nesting
          processUserData(data) {
            let result = [];
            
            for (let i = 0; i < data.length; i++) {
              if (data[i]) {
                if (data[i].type === 'premium') {
                  for (let j = 0; j < data[i].features.length; j++) {
                    if (data[i].features[j].enabled) {
                      if (data[i].features[j].category === 'advanced') {
                        for (let k = 0; k < data[i].features[j].permissions.length; k++) {
                          if (data[i].features[j].permissions[k].active) {
                            // Deep nesting continues...
                            for (let l = 0; l < data[i].features[j].permissions[k].rules.length; l++) {
                              if (data[i].features[j].permissions[k].rules[l].valid) {
                                result.push({
                                  userId: data[i].id,
                                  permission: data[i].features[j].permissions[k].rules[l],
                                  processed: true
                                });
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            
            return result;
          }

          // Performance issue: O(n²) algorithm
          findDuplicateEmails(users1, users2) {
            const duplicates = [];
            for (let i = 0; i < users1.length; i++) {
              for (let j = 0; j < users2.length; j++) {
                if (users1[i].email === users2[j].email) {
                  duplicates.push(users1[i]);
                }
              }
            }
            return duplicates;
          }

          // No error handling
          deleteUser(id) {
            this.users = this.users.filter(u => u.id !== id);
          }

          // Unclear method name, no documentation
          doStuff(x, y) {
            return x + y;
          }
        }
      `;

      const result = await reviewEngine.reviewCode(problematicCode, 'bad-user-service.ts');

      // Should detect major issues
      expect(result.overall).toMatch(/changes_required|rejected/);

      // Should detect security vulnerabilities
      expect(result.codeAnalysis.securityAnalysis.vulnerabilityAssessment.vulnerabilities.length).toBeGreaterThan(0);

      // Should have critical security issues
      const criticalSecurityIssues = result.improvements.filter(i => 
        i.type === 'security' && i.priority === 'critical'
      );
      expect(criticalSecurityIssues.length).toBeGreaterThan(0);

      // Should detect complexity issues
      expect(result.metrics.complexity.cyclomaticComplexity).toBeGreaterThan(10);

      // Should detect performance issues
      expect(result.codeAnalysis.performanceAnalysis.optimizationOpportunities.length).toBeGreaterThan(0);

      // Should have low confidence due to many issues
      expect(result.confidence).toBeLessThan(0.6);

      // Should have blocking conditions
      expect(result.approval.blockers.length).toBeGreaterThan(0);

      // Should have many follow-up actions
      expect(result.followUp.length).toBeGreaterThan(3);

      // Should suggest improvements
      expect(result.improvements.length).toBeGreaterThan(5);
      expect(result.suggestions.length).toBeGreaterThan(3);
    });

    it('should provide detailed improvement suggestions', async () => {
      const codeNeedingImprovement = `
        class UserManager {
          processUsers(users) {
            for (let user of users) {
              if (user.active && user.type === 'premium') {
                user.benefits = this.calculateBenefits(user);
                user.notifications = this.getNotifications(user);
                user.preferences = this.loadPreferences(user);
              }
            }
          }

          calculateBenefits(u) {
            return u.tier * 100;
          }

          getNotifications(u) {
            return [];
          }

          loadPreferences(u) {
            return {};
          }
        }
      `;

      const result = await reviewEngine.reviewCode(codeNeedingImprovement, 'user-manager.ts');

      // Should provide specific suggestions
      expect(result.suggestions.length).toBeGreaterThan(0);

      // Should have naming suggestions
      const namingSuggestions = result.suggestions.filter(s => s.type === 'naming');
      expect(namingSuggestions.length).toBeGreaterThan(0);

      // Should provide code examples
      const suggestionsWithExamples = result.suggestions.filter(s => s.examples.length > 0);
      expect(suggestionsWithExamples.length).toBeGreaterThan(0);

      // Should categorize suggestions appropriately
      result.suggestions.forEach(suggestion => {
        expect(suggestion.category).toMatch(/improvement|question|praise|concern/);
        expect(suggestion.severity).toMatch(/info|suggestion|important|critical/);
        expect(suggestion.reasoning).toBeDefined();
        expect(suggestion.reasoning.length).toBeGreaterThan(10);
      });

      // Should provide alternatives
      const suggestionsWithAlternatives = result.suggestions.filter(s => s.alternatives.length > 0);
      expect(suggestionsWithAlternatives.length).toBeGreaterThan(0);
    });

    it('should generate automated fixes for simple issues', async () => {
      const fixableCode = `
        var userName = 'john';
        var userAge = 25;
        var unused = 'this variable is not used';
        
        function calculateAge() {
          return userAge + 1;
        }
      `;

      const result = await reviewEngine.reviewCode(fixableCode, 'fixable-code.ts');

      // Should have automated fixes
      expect(result.automatedFixes.length).toBeGreaterThan(0);

      // Should have high-confidence fixes
      const highConfidenceFixes = result.automatedFixes.filter(f => f.confidence > 0.8);
      expect(highConfidenceFixes.length).toBeGreaterThan(0);

      // Should have low-risk fixes
      const lowRiskFixes = result.automatedFixes.filter(f => f.risk === 'low');
      expect(lowRiskFixes.length).toBeGreaterThan(0);

      // Test applying automated fixes
      const applicableFixes = result.automatedFixes.filter(f => 
        f.confidence > 0.8 && f.risk === 'low'
      );
      
      if (applicableFixes.length > 0) {
        const fixResult = await reviewEngine.applyAutomatedFixes(fixableCode, applicableFixes);
        
        expect(fixResult.appliedFixes.length).toBeGreaterThan(0);
        expect(fixResult.modifiedCode).not.toBe(fixableCode);
        
        // Verify fixes were applied successfully
        const successfulFixes = fixResult.appliedFixes.filter(f => f.success);
        expect(successfulFixes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Best Practices Assessment', () => {
    it('should evaluate SOLID principles adherence', async () => {
      const solidCode = `
        // Single Responsibility: User entity only handles user data
        export class User {
          constructor(
            private readonly id: string,
            private readonly email: string
          ) {}

          getId(): string { return this.id; }
          getEmail(): string { return this.email; }
        }

        // Single Responsibility: Repository only handles data access
        export interface UserRepository {
          save(user: User): Promise<void>;
          findById(id: string): Promise<User | null>;
        }

        // Single Responsibility: Service only handles business logic
        export class UserService {
          constructor(private repository: UserRepository) {}

          async createUser(email: string): Promise<User> {
            const user = new User(this.generateId(), email);
            await this.repository.save(user);
            return user;
          }

          private generateId(): string {
            return Math.random().toString(36);
          }
        }
      `;

      const result = await reviewEngine.reviewCode(solidCode, 'solid-example.ts');

      // Should evaluate best practices
      expect(result.bestPractices.categories.length).toBeGreaterThan(0);

      // Should have good overall score for SOLID code
      expect(result.bestPractices.overallScore).toBeGreaterThan(0.7);

      // Should evaluate specific practices
      const codeOrganizationCategory = result.bestPractices.categories.find(c => 
        c.category === 'Code Organization'
      );
      expect(codeOrganizationCategory).toBeDefined();

      // Should have fewer violations for good code
      expect(result.bestPractices.violations.length).toBeLessThan(3);
    });

    it('should detect anti-patterns and code smells', async () => {
      const antiPatternCode = `
        // God Object anti-pattern
        class SystemManager {
          users = [];
          orders = [];
          products = [];
          notifications = [];
          analytics = [];

          // Too many responsibilities
          createUser(data) { this.users.push(data); }
          processOrder(order) { this.orders.push(order); }
          updateProduct(product) { this.products.push(product); }
          sendNotification(msg) { this.notifications.push(msg); }
          trackEvent(event) { this.analytics.push(event); }
          generateReport() { return 'report'; }
          backupData() { console.log('backup'); }
          validateSystem() { return true; }
          optimizePerformance() { console.log('optimizing'); }
          handleErrors(error) { console.log(error); }
        }

        // Long Parameter List code smell
        function createComplexObject(
          name, email, age, address, phone, country, 
          city, zipCode, preferences, settings, 
          permissions, roles, department, manager
        ) {
          return { name, email, age, address, phone, country, 
                   city, zipCode, preferences, settings, 
                   permissions, roles, department, manager };
        }

        // Duplicate Code smell
        function processUserType1(user) {
          if (user.active) {
            user.lastLogin = new Date();
            user.loginCount++;
            return user;
          }
          return null;
        }

        function processUserType2(user) {
          if (user.active) {
            user.lastLogin = new Date();
            user.loginCount++;
            return user;
          }
          return null;
        }
      `;

      const result = await reviewEngine.reviewCode(antiPatternCode, 'anti-patterns.ts');

      // Should detect code smells
      expect(result.codeAnalysis.maintainabilityAnalysis.codeSmells.smells.length).toBeGreaterThan(0);

      // Should have low maintainability score
      expect(result.metrics.maintainability.maintainabilityIndex).toBeLessThan(0.6);

      // Should suggest refactoring
      const refactoringImprovements = result.improvements.filter(i => i.type === 'refactoring');
      expect(refactoringImprovements.length).toBeGreaterThan(0);

      // Should have structural suggestions
      const structuralSuggestions = result.suggestions.filter(s => s.type === 'structure');
      expect(structuralSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Security-Focused Review', () => {
    it('should conduct thorough security analysis', async () => {
      const securityTestCode = `
        class AuthenticationService {
          // Weak: Hardcoded secret
          private secret = 'mysecret123';
          
          authenticateUser(username, password) {
            // Vulnerability: SQL injection potential
            const query = "SELECT * FROM users WHERE username = '" + username + "'";
            
            // Vulnerability: Weak password comparison
            if (password === 'admin') {
              return { success: true, token: this.generateToken() };
            }
            
            return { success: false };
          }

          generateToken() {
            // Weak: Predictable token generation
            return btoa(Date.now().toString());
          }

          validateInput(userInput) {
            // Vulnerability: eval usage
            return eval('typeof ' + userInput);
          }

          displayUserData(userData) {
            // Vulnerability: XSS
            document.getElementById('profile').innerHTML = userData.bio;
          }
        }
      `;

      const result = await reviewEngine.reviewCode(securityTestCode, 'auth-service.ts');

      // Should detect security issues
      expect(result.codeAnalysis.securityAnalysis.vulnerabilityAssessment.vulnerabilities.length).toBeGreaterThan(0);

      // Should identify threat modeling results
      expect(result.codeAnalysis.securityAnalysis.threatModeling.threatsIdentified.length).toBeGreaterThan(0);

      // Should have high risk assessment
      expect(result.codeAnalysis.securityAnalysis.vulnerabilityAssessment.overallRisk).toMatch(/medium|high|critical/);

      // Should provide security recommendations
      expect(result.codeAnalysis.securityAnalysis.securityPatterns.recommendations.length).toBeGreaterThan(0);

      // Should prioritize security fixes
      expect(result.codeAnalysis.securityAnalysis.vulnerabilityAssessment.prioritizedFixes.length).toBeGreaterThan(0);

      // Security issues should result in review rejection or changes required
      expect(result.overall).toMatch(/changes_required|rejected/);
    });

    it('should check compliance with security standards', async () => {
      const complianceCode = `
        class PaymentProcessor {
          processPayment(cardData) {
            // PCI DSS requirement: No card data storage
            const maskedCard = this.maskCardNumber(cardData.number);
            
            // Encryption for sensitive data
            const encryptedData = this.encrypt(cardData);
            
            return this.submitPayment(encryptedData);
          }

          maskCardNumber(cardNumber) {
            return cardNumber.slice(0, 4) + '*'.repeat(8) + cardNumber.slice(-4);
          }

          encrypt(data) {
            // Simplified encryption - would use proper crypto
            return Buffer.from(JSON.stringify(data)).toString('base64');
          }

          submitPayment(encryptedData) {
            // Submit to payment gateway
            return { success: true, transactionId: 'txn_123' };
          }
        }
      `;

      const result = await reviewEngine.reviewCode(complianceCode, 'payment-processor.ts');

      // Should evaluate compliance
      expect(result.codeAnalysis.securityAnalysis.complianceCheck.standards.length).toBeGreaterThan(0);

      // Should check OWASP compliance
      const owaspCompliance = result.codeAnalysis.securityAnalysis.complianceCheck.standards.find(s => 
        s.standard === 'OWASP Top 10'
      );
      expect(owaspCompliance).toBeDefined();

      // Should provide compliance recommendations if needed
      expect(result.codeAnalysis.securityAnalysis.complianceCheck.recommendations).toBeDefined();
    });
  });

  describe('Performance and Optimization Review', () => {
    it('should analyze algorithmic complexity', async () => {
      const performanceCode = `
        class DataProcessor {
          // O(n²) algorithm - performance issue
          findIntersection(array1, array2) {
            const result = [];
            for (let i = 0; i < array1.length; i++) {
              for (let j = 0; j < array2.length; j++) {
                if (array1[i] === array2[j]) {
                  result.push(array1[i]);
                }
              }
            }
            return result;
          }

          // Memory-intensive operation
          loadLargeDataset() {
            const data = new Array(1000000);
            for (let i = 0; i < data.length; i++) {
              data[i] = { id: i, value: Math.random() };
            }
            return data;
          }

          // Inefficient string concatenation
          buildString(items) {
            let result = '';
            for (let item of items) {
              result += item + ', ';
            }
            return result;
          }
        }
      `;

      const result = await reviewEngine.reviewCode(performanceCode, 'data-processor.ts');

      // Should analyze performance
      expect(result.codeAnalysis.performanceAnalysis.algorithmicComplexity.timeComplexity).toBeDefined();
      expect(result.codeAnalysis.performanceAnalysis.algorithmicComplexity.spaceComplexity).toBeDefined();

      // Should identify performance bottlenecks
      expect(result.codeAnalysis.performanceAnalysis.algorithmicComplexity.bottlenecks.length).toBeGreaterThan(0);

      // Should suggest optimizations
      expect(result.codeAnalysis.performanceAnalysis.optimizationOpportunities.length).toBeGreaterThan(0);

      // Should evaluate scalability
      expect(result.codeAnalysis.performanceAnalysis.scalabilityAssessment.scalabilityScore).toBeLessThan(0.8);

      // Should have performance-related improvements
      const performanceImprovements = result.improvements.filter(i => i.type === 'performance');
      expect(performanceImprovements.length).toBeGreaterThan(0);
    });
  });

  describe('Project-Level Review', () => {
    it('should analyze multiple files in a project', async () => {
      const projectFiles = [
        {
          path: 'src/models/user.ts',
          content: `
            export interface User {
              id: string;
              email: string;
              createdAt: Date;
            }

            export class UserValidator {
              static isValidEmail(email: string): boolean {
                return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
              }
            }
          `
        },
        {
          path: 'src/services/user-service.ts',
          content: `
            import { User, UserValidator } from '../models/user';

            export class UserService {
              async createUser(email: string): Promise<User> {
                if (!UserValidator.isValidEmail(email)) {
                  throw new Error('Invalid email');
                }

                return {
                  id: Math.random().toString(),
                  email,
                  createdAt: new Date()
                };
              }
            }
          `
        },
        {
          path: 'src/controllers/user-controller.ts',
          content: `
            import { UserService } from '../services/user-service';

            export class UserController {
              constructor(private userService: UserService) {}

              async handleCreateUser(req: any, res: any): Promise<void> {
                try {
                  const { email } = req.body;
                  const user = await this.userService.createUser(email);
                  res.json(user);
                } catch (error) {
                  res.status(400).json({ error: error.message });
                }
              }
            }
          `
        }
      ];

      const projectContext = {
        projectName: 'User Management API',
        version: '1.0.0',
        team: 'Backend Team'
      };

      const projectResult = await reviewEngine.reviewProject(projectFiles, projectContext);

      // Should analyze all files
      expect(projectResult.totalFiles).toBe(3);
      expect(projectResult.reviews.length).toBe(3);

      // Should provide project-level status
      expect(projectResult.overallStatus).toMatch(/approved|approved_with_suggestions|changes_required|rejected/);

      // Should aggregate metrics
      expect(projectResult.aggregatedMetrics.totalLinesOfCode).toBeGreaterThan(0);
      expect(projectResult.aggregatedMetrics.averageComplexity).toBeGreaterThanOrEqual(0);
      expect(projectResult.aggregatedMetrics.averageQuality).toBeGreaterThan(0);

      // Should count issues across project
      expect(projectResult.criticalIssues).toBeGreaterThanOrEqual(0);
      expect(projectResult.highIssues).toBeGreaterThanOrEqual(0);

      // Each file review should be complete
      projectResult.reviews.forEach(review => {
        expect(review.reviewId).toBeDefined();
        expect(review.confidence).toBeGreaterThan(0);
        expect(review.reviewTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect custom review configuration', async () => {
      const customConfig: Partial<ReviewConfiguration> = {
        reviewCriteria: {
          securityWeight: 0.4, // Emphasize security
          performanceWeight: 0.3,
          maintainabilityWeight: 0.2,
          testingWeight: 0.1,
          documentationWeight: 0.0,
          complexityThresholds: {
            cyclomaticComplexity: 5, // Stricter threshold
            cognitiveComplexity: 8,
            nestingDepth: 3,
            functionLength: 25,
            classSize: 100
          }
        },
        automationLevel: {
          automaticFixes: false, // Disable automatic fixes
          suggestionsOnly: true,
          humanReviewRequired: true,
          confidenceThreshold: 0.95
        },
        reviewerPreferences: {
          verbosity: 'detailed',
          focusAreas: ['security', 'performance'],
          suggestionStyle: 'educational',
          codeExamples: true
        }
      };

      const customEngine = new IntelligentCodeReviewEngine(customConfig);

      const testCode = `
        function complexFunction(a, b, c, d) {
          if (a > 0) {
            if (b > 0) {
              if (c > 0) {
                if (d > 0) {
                  return a + b + c + d;
                }
              }
            }
          }
          return 0;
        }
      `;

      const result = await customEngine.reviewCode(testCode, 'test.ts');

      // Should apply custom thresholds
      // With stricter complexity threshold (5), this function should be flagged
      expect(result.metrics.complexity.cyclomaticComplexity).toBeGreaterThan(5);

      // Should emphasize security and performance in review
      expect(result.codeAnalysis.securityAnalysis).toBeDefined();
      expect(result.codeAnalysis.performanceAnalysis).toBeDefined();

      // Clean up
      customEngine.removeAllListeners();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed code gracefully', async () => {
      const malformedCode = `
        class IncompleteClass {
          method() {
            if (condition
        }
      `;

      // Should not throw but handle gracefully
      const result = await reviewEngine.reviewCode(malformedCode, 'malformed.ts');
      
      expect(result).toBeDefined();
      expect(result.reviewId).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8); // Lower confidence for malformed code
    });

    it('should handle empty code', async () => {
      const emptyCode = '';

      const result = await reviewEngine.reviewCode(emptyCode, 'empty.ts');
      
      expect(result).toBeDefined();
      expect(result.overall).toBeDefined();
      expect(result.improvements.length).toBeGreaterThanOrEqual(0);
    });

    it('should emit error events appropriately', async () => {
      const errorEvents: any[] = [];
      reviewEngine.on('review:error', (error) => errorEvents.push(error));

      // Test with valid code - should not produce errors
      const validCode = 'const x = 1;';
      await reviewEngine.reviewCode(validCode, 'valid.ts');

      expect(errorEvents.length).toBe(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should complete review within reasonable time', async () => {
      const largeCode = `
        ${Array.from({ length: 20 }, (_, i) => `
          class Service${i} {
            private data${i}: any[] = [];

            method${i}(): string {
              return 'result${i}';
            }

            complexMethod${i}(items: any[]): any[] {
              const result = [];
              for (let item of items) {
                if (item.type === 'type${i}') {
                  if (item.active) {
                    if (item.value > ${i * 10}) {
                      result.push({
                        ...item,
                        processed: true,
                        timestamp: new Date(),
                        serviceId: ${i}
                      });
                    }
                  }
                }
              }
              return result;
            }
          }
        `).join('\n')}
      `;

      const startTime = Date.now();
      const result = await reviewEngine.reviewCode(largeCode, 'large-service.ts');
      const endTime = Date.now();

      // Should complete in reasonable time (under 10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
      expect(result.reviewTime).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
}); 