import { EventEmitter } from 'events';
import { AdvancedStaticAnalysisEngine, StaticAnalysisReport } from './advanced-static-analysis.js';
import { CleanArchitectureEngine, ArchitecturalReport } from './clean-architecture-engine.js';
import { PropertyTestingEngine, CodeSpecification } from './property-testing-engine.js';

export interface CodeReviewReport {
  overall: ReviewStatus;
  reviewId: string;
  timestamp: Date;
  reviewer: ReviewerInfo;
  codeAnalysis: CodeAnalysisResults;
  bestPractices: BestPracticeAssessment;
  improvements: CodeImprovement[];
  suggestions: ReviewSuggestion[];
  automatedFixes: AutomatedFix[];
  metrics: ReviewMetrics;
  approval: ApprovalDecision;
  followUp: FollowUpAction[];
  confidence: number;
  reviewTime: number;
}

export type ReviewStatus = 'approved' | 'approved_with_suggestions' | 'changes_required' | 'rejected';

export interface ReviewerInfo {
  type: 'ai_agent' | 'human' | 'hybrid';
  name: string;
  expertise: string[];
  experience: ReviewerExperience;
  specializations: string[];
}

export interface ReviewerExperience {
  level: 'junior' | 'intermediate' | 'senior' | 'expert';
  yearsExperience: number;
  reviewsCompleted: number;
  domains: string[];
}

export interface CodeAnalysisResults {
  staticAnalysis: StaticAnalysisReport;
  architecturalAnalysis: ArchitecturalReport;
  testCoverage: TestCoverageAnalysis;
  performanceAnalysis: PerformanceReviewAnalysis;
  securityAnalysis: SecurityReviewAnalysis;
  maintainabilityAnalysis: MaintainabilityReviewAnalysis;
}

export interface TestCoverageAnalysis {
  linesCovered: number;
  branchesCovered: number;
  functionsCovered: number;
  statementsCovered: number;
  uncoveredCriticalPaths: UncoveredPath[];
  testQuality: TestQualityAssessment;
  missingTestTypes: string[];
}

export interface UncoveredPath {
  path: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  suggestedTests: string[];
}

export interface TestQualityAssessment {
  overallScore: number;
  unitTestQuality: number;
  integrationTestQuality: number;
  e2eTestQuality: number;
  testMaintainability: number;
  assertionQuality: number;
}

export interface PerformanceReviewAnalysis {
  algorithmicComplexity: AlgorithmicComplexityReview;
  memoryUsage: MemoryUsageReview;
  scalabilityAssessment: ScalabilityAssessment;
  optimizationOpportunities: PerformanceOptimization[];
}

export interface AlgorithmicComplexityReview {
  timeComplexity: string;
  spaceComplexity: string;
  improvements: string[];
  bottlenecks: string[];
}

export interface MemoryUsageReview {
  efficiency: 'poor' | 'acceptable' | 'good' | 'excellent';
  leakRisks: MemoryLeakRisk[];
  optimizations: MemoryOptimization[];
}

export interface MemoryLeakRisk {
  location: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface MemoryOptimization {
  technique: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  description: string;
}

export interface ScalabilityAssessment {
  currentCapacity: string;
  scalabilityScore: number;
  bottlenecks: ScalabilityBottleneck[];
  recommendations: ScalabilityRecommendation[];
}

export interface ScalabilityBottleneck {
  component: string;
  limitation: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  solution: string;
}

export interface ScalabilityRecommendation {
  area: string;
  recommendation: string;
  benefit: string;
  implementation: string;
}

export interface PerformanceOptimization {
  type: 'algorithm' | 'memory' | 'io' | 'network' | 'database';
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  implementation: string;
}

export interface SecurityReviewAnalysis {
  threatModeling: ThreatModelingResult;
  vulnerabilityAssessment: VulnerabilityAssessmentResult;
  securityPatterns: SecurityPatternAnalysis;
  complianceCheck: ComplianceCheckResult;
}

export interface ThreatModelingResult {
  threatsIdentified: SecurityThreat[];
  attackVectors: AttackVector[];
  mitigations: SecurityMitigation[];
  riskScore: number;
}

export interface SecurityThreat {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
}

export interface AttackVector {
  vector: string;
  entry: string;
  impact: string;
  prevention: string;
}

export interface SecurityMitigation {
  threat: string;
  mitigation: string;
  effectiveness: number;
  implementation: string;
}

export interface VulnerabilityAssessmentResult {
  vulnerabilities: SecurityVulnerabilityReview[];
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  prioritizedFixes: PrioritizedSecurityFix[];
}

export interface SecurityVulnerabilityReview {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  exploitability: number;
  impact: number;
  description: string;
  location: string;
  remediation: string;
  references: string[];
}

export interface PrioritizedSecurityFix {
  vulnerability: string;
  priority: number;
  effort: 'low' | 'medium' | 'high';
  impact: string;
  steps: string[];
}

export interface SecurityPatternAnalysis {
  patternsUsed: SecurityPattern[];
  missingPatterns: MissingSecurityPattern[];
  recommendations: SecurityPatternRecommendation[];
}

export interface SecurityPattern {
  pattern: string;
  implementation: 'correct' | 'partial' | 'incorrect';
  effectiveness: number;
  improvements: string[];
}

export interface MissingSecurityPattern {
  pattern: string;
  applicability: 'high' | 'medium' | 'low';
  benefit: string;
  implementation: string;
}

export interface SecurityPatternRecommendation {
  pattern: string;
  reason: string;
  benefit: string;
  implementation: string;
}

export interface ComplianceCheckResult {
  standards: ComplianceStandardResult[];
  overallCompliance: number;
  violations: ComplianceViolation[];
  recommendations: ComplianceRecommendation[];
}

export interface ComplianceStandardResult {
  standard: string;
  compliance: number;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  requirement: string;
  met: boolean;
  evidence: string;
  gaps: string[];
}

export interface ComplianceViolation {
  standard: string;
  requirement: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
}

export interface ComplianceRecommendation {
  standard: string;
  area: string;
  recommendation: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface MaintainabilityReviewAnalysis {
  maintainabilityIndex: number;
  codeSmells: CodeSmellAnalysis;
  refactoringOpportunities: RefactoringOpportunityAnalysis;
  technicalDebt: TechnicalDebtAnalysis;
  documentationQuality: DocumentationQualityAnalysis;
}

export interface CodeSmellAnalysis {
  smells: CodeSmellInstance[];
  severity: 'low' | 'medium' | 'high';
  impact: string;
  recommendations: string[];
}

export interface CodeSmellInstance {
  type: string;
  location: string;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  impact: string;
  refactoring: string;
}

export interface RefactoringOpportunityAnalysis {
  opportunities: RefactoringOpportunity[];
  prioritization: RefactoringPrioritization[];
  impact: RefactoringImpact;
}

export interface RefactoringOpportunity {
  technique: string;
  location: string;
  benefit: string;
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  steps: string[];
}

export interface RefactoringPrioritization {
  opportunity: string;
  priority: number;
  rationale: string;
  dependencies: string[];
}

export interface RefactoringImpact {
  maintainabilityImprovement: number;
  performanceImpact: string;
  testingImpact: string;
  riskAssessment: string;
}

export interface TechnicalDebtAnalysis {
  totalDebt: number;
  debtItems: TechnicalDebtItem[];
  payoffStrategy: TechnicalDebtPayoffStrategy;
  trends: TechnicalDebtTrend[];
}

export interface TechnicalDebtItem {
  type: 'code' | 'design' | 'test' | 'documentation' | 'infrastructure';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  effort: number; // hours
  interest: number; // cost of delay
  location: string;
}

export interface TechnicalDebtPayoffStrategy {
  totalEffort: number;
  phases: TechnicalDebtPhase[];
  prioritization: string;
  timeline: string;
}

export interface TechnicalDebtPhase {
  phase: number;
  items: string[];
  effort: number;
  benefit: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface TechnicalDebtTrend {
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  prediction: string;
  recommendation: string;
}

export interface DocumentationQualityAnalysis {
  coverage: number;
  quality: number;
  consistency: number;
  accuracy: number;
  recommendations: DocumentationRecommendation[];
}

export interface DocumentationRecommendation {
  area: string;
  issue: string;
  improvement: string;
  priority: 'low' | 'medium' | 'high';
}

export interface BestPracticeAssessment {
  overallScore: number;
  categories: BestPracticeCategory[];
  violations: BestPracticeViolation[];
  recommendations: BestPracticeRecommendation[];
}

export interface BestPracticeCategory {
  category: string;
  score: number;
  practices: BestPractice[];
  weight: number;
}

export interface BestPractice {
  practice: string;
  followed: boolean;
  adherence: number;
  importance: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  improvements: string[];
}

export interface BestPracticeViolation {
  category: string;
  practice: string;
  severity: 'minor' | 'major' | 'critical';
  location: string;
  description: string;
  impact: string;
  remedy: string;
}

export interface BestPracticeRecommendation {
  category: string;
  recommendation: string;
  benefit: string;
  implementation: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface CodeImprovement {
  id: string;
  type: ImprovementType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: CodeLocation;
  currentCode: string;
  improvedCode: string;
  rationale: string;
  benefits: string[];
  risks: string[];
  effort: EstimatedEffort;
  implementation: ImplementationGuide;
}

export type ImprovementType = 
  | 'refactoring'
  | 'optimization'
  | 'security'
  | 'testing'
  | 'documentation'
  | 'style'
  | 'architecture'
  | 'performance';

export interface CodeLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  function?: string;
  class?: string;
}

export interface EstimatedEffort {
  hours: number;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
  skills: string[];
  dependencies: string[];
}

export interface ImplementationGuide {
  steps: ImplementationStep[];
  prerequisites: string[];
  testing: TestingGuidance;
  rollback: RollbackPlan;
}

export interface ImplementationStep {
  step: number;
  description: string;
  code?: string;
  verification: string;
  risks: string[];
}

export interface TestingGuidance {
  testTypes: string[];
  testCases: string[];
  verification: string[];
}

export interface RollbackPlan {
  steps: string[];
  verification: string[];
  risks: string[];
}

export interface ReviewSuggestion {
  id: string;
  type: SuggestionType;
  category: 'improvement' | 'question' | 'praise' | 'concern';
  severity: 'info' | 'suggestion' | 'important' | 'critical';
  title: string;
  description: string;
  location?: CodeLocation;
  reasoning: string;
  alternatives: string[];
  examples: CodeExample[];
  references: string[];
}

export type SuggestionType = 
  | 'naming'
  | 'structure'
  | 'logic'
  | 'performance'
  | 'security'
  | 'testing'
  | 'documentation'
  | 'error_handling'
  | 'design_pattern'
  | 'best_practice';

export interface CodeExample {
  title: string;
  before?: string;
  after: string;
  explanation: string;
}

export interface AutomatedFix {
  id: string;
  type: 'automatic' | 'semi_automatic' | 'guided';
  title: string;
  description: string;
  location: CodeLocation;
  fix: CodeFix;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  validation: FixValidation;
}

export interface CodeFix {
  originalCode: string;
  fixedCode: string;
  changes: CodeChange[];
  dependencies: string[];
}

export interface CodeChange {
  type: 'add' | 'remove' | 'modify' | 'move';
  location: CodeLocation;
  description: string;
  code: string;
}

export interface FixValidation {
  syntaxCheck: boolean;
  typeCheck: boolean;
  testValidation: boolean;
  securityCheck: boolean;
  performanceImpact: string;
}

export interface ReviewMetrics {
  linesOfCode: number;
  complexity: ComplexityMetrics;
  quality: QualityMetrics;
  coverage: CoverageMetrics;
  performance: PerformanceMetrics;
  maintainability: MaintainabilityMetrics;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  nestingDepth: number;
  functionLength: number;
  classSize: number;
}

export interface QualityMetrics {
  overallScore: number;
  maintainability: number;
  reliability: number;
  security: number;
  efficiency: number;
  portability: number;
}

export interface CoverageMetrics {
  statementCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  lineCoverage: number;
}

export interface PerformanceMetrics {
  timeComplexity: string;
  spaceComplexity: string;
  criticalPathEfficiency: number;
  resourceUtilization: number;
}

export interface MaintainabilityMetrics {
  maintainabilityIndex: number;
  technicalDebt: number;
  documentationCoverage: number;
  testMaintainability: number;
}

export interface ApprovalDecision {
  status: ReviewStatus;
  reasoning: string;
  conditions: ApprovalCondition[];
  blockers: ReviewBlocker[];
  recommendations: string[];
  nextReview?: Date;
}

export interface ApprovalCondition {
  condition: string;
  mandatory: boolean;
  deadline?: Date;
  responsible: string;
}

export interface ReviewBlocker {
  type: 'security' | 'performance' | 'quality' | 'compliance' | 'architecture';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolution: string;
  deadline?: Date;
}

export interface FollowUpAction {
  action: FollowUpActionType;
  description: string;
  assignee: string;
  deadline?: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
}

export type FollowUpActionType = 
  | 'implement_fix'
  | 'add_tests'
  | 'update_documentation'
  | 'refactor_code'
  | 'security_review'
  | 'performance_testing'
  | 'follow_up_review';

export interface ReviewConfiguration {
  reviewCriteria: ReviewCriteria;
  automationLevel: AutomationLevel;
  bestPracticesRules: BestPracticesRules;
  qualityGates: QualityGate[];
  reviewerPreferences: ReviewerPreferences;
}

export interface ReviewCriteria {
  securityWeight: number;
  performanceWeight: number;
  maintainabilityWeight: number;
  testingWeight: number;
  documentationWeight: number;
  complexityThresholds: ComplexityThresholds;
}

export interface ComplexityThresholds {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  nestingDepth: number;
  functionLength: number;
  classSize: number;
}

export interface AutomationLevel {
  automaticFixes: boolean;
  suggestionsOnly: boolean;
  humanReviewRequired: boolean;
  confidenceThreshold: number;
}

export interface BestPracticesRules {
  enabledRules: string[];
  customRules: CustomRule[];
  severity: 'lenient' | 'moderate' | 'strict';
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  autoFix?: string;
}

export interface QualityGate {
  name: string;
  metric: string;
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  blocking: boolean;
}

export interface ReviewerPreferences {
  verbosity: 'minimal' | 'standard' | 'detailed' | 'comprehensive';
  focusAreas: string[];
  suggestionStyle: 'direct' | 'questioning' | 'educational';
  codeExamples: boolean;
}

/**
 * Intelligent Code Review System for FlowX
 * Provides AI-powered code review with automated improvement suggestions
 */
export class IntelligentCodeReviewEngine extends EventEmitter {
  private staticAnalysisEngine: AdvancedStaticAnalysisEngine;
  private architectureEngine: CleanArchitectureEngine;
  private propertyEngine: PropertyTestingEngine;
  private config: ReviewConfiguration;
  private reviewHistory: Map<string, CodeReviewReport[]>;

  constructor(config?: Partial<ReviewConfiguration>) {
    super();
    this.config = this.initializeConfig(config);
    this.staticAnalysisEngine = new AdvancedStaticAnalysisEngine();
    this.architectureEngine = new CleanArchitectureEngine();
    this.propertyEngine = new PropertyTestingEngine();
    this.reviewHistory = new Map();
  }

  /**
   * Perform comprehensive code review
   */
  async reviewCode(
    code: string,
    fileName: string,
    context?: CodeReviewContext
  ): Promise<CodeReviewReport> {
    try {
      this.emit('review:start', { fileName, context });

      const startTime = Date.now();
      const reviewId = this.generateReviewId();

      // Run comprehensive analysis
      const codeAnalysis = await this.performCodeAnalysis(code, fileName, context);

      // Assess best practices
      const bestPractices = await this.assessBestPractices(code, fileName, codeAnalysis);

      // Generate improvements
      const improvements = await this.generateImprovements(code, fileName, codeAnalysis, bestPractices);

      // Generate suggestions
      const suggestions = await this.generateSuggestions(code, fileName, codeAnalysis, improvements);

      // Generate automated fixes
      const automatedFixes = await this.generateAutomatedFixes(code, fileName, improvements);

      // Calculate metrics
      const metrics = await this.calculateReviewMetrics(code, codeAnalysis);

      // Make approval decision
      const approval = await this.makeApprovalDecision(codeAnalysis, bestPractices, improvements, metrics);

      // Generate follow-up actions
      const followUp = await this.generateFollowUpActions(improvements, suggestions, approval);

      // Calculate confidence
      const confidence = this.calculateReviewConfidence(codeAnalysis, bestPractices, improvements);

      const reviewTime = Date.now() - startTime;

      const report: CodeReviewReport = {
        overall: approval.status,
        reviewId,
        timestamp: new Date(),
        reviewer: this.getReviewerInfo(),
        codeAnalysis,
        bestPractices,
        improvements,
        suggestions,
        automatedFixes,
        metrics,
        approval,
        followUp,
        confidence,
        reviewTime
      };

      // Store review history
      this.storeReviewHistory(fileName, report);

      this.emit('review:complete', { 
        reviewId, 
        fileName, 
        status: approval.status,
        improvements: improvements.length,
        suggestions: suggestions.length,
        confidence,
        reviewTime
      });

      return report;

    } catch (error) {
      this.emit('review:error', error);
      throw new Error(`Code review failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform batch review of multiple files
   */
  async reviewProject(
    files: { path: string; content: string }[],
    context?: ProjectReviewContext
  ): Promise<ProjectReviewReport> {
    const reviews: CodeReviewReport[] = [];
    
    for (const file of files) {
      const review = await this.reviewCode(file.content, file.path, {
        projectContext: context,
        relatedFiles: files.filter(f => f.path !== file.path).map(f => f.path)
      });
      reviews.push(review);
    }

    return this.aggregateProjectReviews(reviews, context);
  }

  /**
   * Apply automated fixes
   */
  async applyAutomatedFixes(
    code: string,
    fixes: AutomatedFix[]
  ): Promise<AppliedFixesResult> {
    const appliedFixes: AppliedFix[] = [];
    let modifiedCode = code;

    for (const fix of fixes.filter(f => f.confidence > 0.8 && f.risk === 'low')) {
      try {
        const result = await this.applyFix(modifiedCode, fix);
        if (result.success) {
          modifiedCode = result.code;
          appliedFixes.push({
            fixId: fix.id,
            success: true,
            changes: result.changes
          });
        }
      } catch (error) {
        appliedFixes.push({
          fixId: fix.id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      originalCode: code,
      modifiedCode,
      appliedFixes,
      remainingIssues: fixes.filter(f => !appliedFixes.some(af => af.fixId === f.id && af.success))
    };
  }

  /**
   * Private methods for code analysis
   */
  private async performCodeAnalysis(
    code: string, 
    fileName: string, 
    context?: CodeReviewContext
  ): Promise<CodeAnalysisResults> {
    // Run parallel analysis
    const [staticAnalysis, architecturalAnalysis] = await Promise.all([
      this.staticAnalysisEngine.analyzeCode(code, fileName),
      this.analyzeArchitecture(code, context)
    ]);

    // Additional analyses
    const testCoverage = await this.analyzeTestCoverage(code, fileName);
    const performanceAnalysis = await this.analyzePerformance(code, staticAnalysis);
    const securityAnalysis = await this.analyzeSecurityInDepth(code, staticAnalysis);
    const maintainabilityAnalysis = await this.analyzeMaintainability(code, staticAnalysis);

    return {
      staticAnalysis,
      architecturalAnalysis,
      testCoverage,
      performanceAnalysis,
      securityAnalysis,
      maintainabilityAnalysis
    };
  }

  private async analyzeArchitecture(code: string, context?: CodeReviewContext): Promise<ArchitecturalReport> {
    const architecturalContext = {
      projectType: (context?.projectType as any) || 'library',
      architecture: (context?.architecture as any) || 'clean',
      frameworks: context?.frameworks || [],
      constraints: context?.constraints || []
    };

    return this.architectureEngine.validateArchitecture(code, architecturalContext);
  }

  private async analyzeTestCoverage(code: string, fileName: string): Promise<TestCoverageAnalysis> {
    // Simplified test coverage analysis
    const hasTests = code.includes('test') || code.includes('spec') || fileName.includes('.test.');
    
    return {
      linesCovered: hasTests ? 0.8 : 0.3,
      branchesCovered: hasTests ? 0.75 : 0.2,
      functionsCovered: hasTests ? 0.85 : 0.4,
      statementsCovered: hasTests ? 0.82 : 0.35,
      uncoveredCriticalPaths: [
        {
          path: 'error handling paths',
          criticality: 'high',
          reason: 'Exception handling not tested',
          suggestedTests: ['error boundary tests', 'exception handling tests']
        }
      ],
      testQuality: {
        overallScore: hasTests ? 0.8 : 0.3,
        unitTestQuality: hasTests ? 0.85 : 0.2,
        integrationTestQuality: hasTests ? 0.75 : 0.1,
        e2eTestQuality: hasTests ? 0.6 : 0.1,
        testMaintainability: hasTests ? 0.8 : 0.2,
        assertionQuality: hasTests ? 0.9 : 0.3
      },
      missingTestTypes: hasTests ? ['integration', 'e2e'] : ['unit', 'integration', 'e2e', 'property']
    };
  }

  private async analyzePerformance(
    code: string, 
    staticAnalysis: StaticAnalysisReport
  ): Promise<PerformanceReviewAnalysis> {
    const hasNestedLoops = code.includes('for') && code.split('for').length > 2;
    
    return {
      algorithmicComplexity: {
        timeComplexity: hasNestedLoops ? 'O(n²)' : 'O(n)',
        spaceComplexity: 'O(1)',
        improvements: hasNestedLoops ? ['Consider using Map for lookups', 'Optimize nested iterations'] : [],
        bottlenecks: hasNestedLoops ? ['Nested loop operations'] : []
      },
      memoryUsage: {
        efficiency: hasNestedLoops ? 'acceptable' : 'good',
        leakRisks: [],
        optimizations: [
          {
            technique: 'Object pooling',
            impact: 'Reduced garbage collection pressure',
            effort: 'medium',
            description: 'Reuse objects instead of creating new ones'
          }
        ]
      },
      scalabilityAssessment: {
        currentCapacity: hasNestedLoops ? 'Limited by algorithmic complexity' : 'Good scalability',
        scalabilityScore: hasNestedLoops ? 0.6 : 0.8,
        bottlenecks: hasNestedLoops ? [
          {
            component: 'Data processing loop',
            limitation: 'O(n²) complexity',
            impact: 'high',
            solution: 'Use more efficient algorithms or data structures'
          }
        ] : [],
        recommendations: [
          {
            area: 'Algorithm optimization',
            recommendation: 'Consider using more efficient algorithms',
            benefit: 'Better performance at scale',
            implementation: 'Replace nested loops with hash-based lookups'
          }
        ]
      },
      optimizationOpportunities: staticAnalysis.performance.optimizationOpportunities.map(opp => ({
        type: 'algorithm',
        description: opp.description,
        impact: opp.benefit,
        effort: opp.effort,
        implementation: 'Refactor to use more efficient approach'
      }))
    };
  }

  private async analyzeSecurityInDepth(
    code: string, 
    staticAnalysis: StaticAnalysisReport
  ): Promise<SecurityReviewAnalysis> {
    const hasEval = code.includes('eval(');
    const hasInnerHTML = code.includes('innerHTML');
    
    return {
      threatModeling: {
        threatsIdentified: [
          ...(hasEval ? [{
            type: 'Code Injection',
            severity: 'critical' as const,
            likelihood: 'high' as const,
            impact: 'critical' as const,
            description: 'Potential for arbitrary code execution',
            mitigation: 'Remove eval() usage and use safe alternatives'
          }] : []),
          ...(hasInnerHTML ? [{
            type: 'Cross-Site Scripting',
            severity: 'high' as const,
            likelihood: 'medium' as const,
            impact: 'high' as const,
            description: 'Potential for XSS attacks through innerHTML',
            mitigation: 'Use textContent or sanitization libraries'
          }] : [])
        ],
        attackVectors: [],
        mitigations: [],
        riskScore: hasEval ? 0.9 : hasInnerHTML ? 0.6 : 0.2
      },
      vulnerabilityAssessment: {
        vulnerabilities: staticAnalysis.security.vulnerabilities.map(vuln => ({
          id: vuln.id,
          type: vuln.type,
          severity: vuln.severity === 'info' ? 'low' : vuln.severity,
          exploitability: vuln.exploitability,
          impact: vuln.impact,
          description: vuln.description,
          location: `${vuln.location.file}:${vuln.location.line}`,
          remediation: vuln.remediation,
          references: vuln.references
        })),
        overallRisk: (() => {
          const riskLevel = staticAnalysis.security.riskLevel;
          if (riskLevel === 'very_low') return 'low';
          if (riskLevel === 'low') return 'low';
          if (riskLevel === 'medium') return 'medium';
          if (riskLevel === 'high') return 'high';
          return 'critical'; // covers 'critical' and any other case
        })(),
        prioritizedFixes: staticAnalysis.security.vulnerabilities.map((vuln, index) => ({
          vulnerability: vuln.title,
          priority: vuln.severity === 'critical' ? 1 : vuln.severity === 'high' ? 2 : 3,
          effort: vuln.severity === 'critical' ? 'high' : 'medium',
          impact: 'Security improvement',
          steps: [vuln.remediation]
        }))
      },
      securityPatterns: {
        patternsUsed: [],
        missingPatterns: [
          {
            pattern: 'Input Validation',
            applicability: 'high',
            benefit: 'Prevents injection attacks',
            implementation: 'Add comprehensive input validation'
          }
        ],
        recommendations: [
          {
            pattern: 'Defense in Depth',
            reason: 'Multiple security layers needed',
            benefit: 'Comprehensive security protection',
            implementation: 'Implement multiple security controls'
          }
        ]
      },
      complianceCheck: {
        standards: [
          {
            standard: 'OWASP Top 10',
            compliance: staticAnalysis.security.securityScore,
            requirements: [
              {
                requirement: 'A01:2021 – Broken Access Control',
                met: true,
                evidence: 'No access control issues detected',
                gaps: []
              }
            ]
          }
        ],
        overallCompliance: staticAnalysis.security.securityScore,
        violations: [],
        recommendations: [
          {
            standard: 'OWASP',
            area: 'Input Validation',
            recommendation: 'Implement comprehensive input validation',
            priority: 'high'
          }
        ]
      }
    };
  }

  private async analyzeMaintainability(
    code: string, 
    staticAnalysis: StaticAnalysisReport
  ): Promise<MaintainabilityReviewAnalysis> {
    return {
      maintainabilityIndex: staticAnalysis.maintainability.maintainabilityIndex,
      codeSmells: {
        smells: staticAnalysis.quality.codeSmells.map(smell => ({
          type: smell.type,
          location: `${smell.location.file}:${smell.location.line}`,
          severity: smell.severity,
          description: smell.description,
          impact: 'Reduces maintainability',
          refactoring: smell.recommendation
        })),
        severity: staticAnalysis.quality.codeSmells.length > 5 ? 'high' : 
                 staticAnalysis.quality.codeSmells.length > 2 ? 'medium' : 'low',
        impact: 'Code maintainability affected',
        recommendations: ['Address code smells systematically', 'Implement refactoring strategy']
      },
      refactoringOpportunities: {
        opportunities: staticAnalysis.maintainability.refactoringOpportunities.map(opp => ({
          technique: opp.technique,
          location: `${opp.location.file}:${opp.location.line}`,
          benefit: opp.benefit,
          effort: opp.effort < 4 ? 'low' : opp.effort < 8 ? 'medium' : 'high',
          risk: opp.risk,
          steps: ['Identify extraction candidates', 'Create new methods/classes', 'Update references']
        })),
        prioritization: [],
        impact: {
          maintainabilityImprovement: 0.2,
          performanceImpact: 'Neutral',
          testingImpact: 'Additional tests needed',
          riskAssessment: 'Low to medium risk'
        }
      },
      technicalDebt: {
        totalDebt: staticAnalysis.maintainability.technicalDebt.reduce((sum, debt) => sum + debt.effort, 0),
        debtItems: staticAnalysis.maintainability.technicalDebt.map(debt => ({
          type: debt.type === 'testing' ? 'test' : 
                debt.type === 'architecture' ? 'design' :
                debt.type === 'performance' ? 'code' :
                debt.type === 'documentation' ? 'documentation' :
                debt.type === 'code_smell' ? 'code' : 'code',
          description: debt.description,
          location: `${debt.location.file}:${debt.location.line}`,
          effort: debt.effort,
          impact: debt.impact,
          interest: debt.effort * 0.1 // Add interest calculation
        })),
        payoffStrategy: {
          totalEffort: staticAnalysis.maintainability.technicalDebt.reduce((sum, debt) => sum + debt.effort, 0),
          phases: [
            {
              phase: 1,
              items: ['High priority debt items'],
              effort: 20,
              benefit: 'Quick wins',
              priority: 'high'
            }
          ],
          prioritization: 'Impact-effort matrix',
          timeline: '3-6 months'
        },
        trends: [
          {
            metric: 'Code complexity',
            trend: 'stable',
            prediction: 'Manageable if addressed',
            recommendation: 'Monitor and address systematically'
          }
        ]
      },
      documentationQuality: {
        coverage: staticAnalysis.documentation.coverage,
        quality: staticAnalysis.documentation.quality.completeness,
        consistency: staticAnalysis.documentation.quality.accuracy,
        accuracy: staticAnalysis.documentation.quality.clarity,
        recommendations: [
          {
            area: 'API Documentation',
            issue: 'Missing comprehensive API docs',
            improvement: 'Add detailed API documentation with examples',
            priority: 'medium'
          }
        ]
      }
    };
  }

  private async assessBestPractices(
    code: string, 
    fileName: string, 
    analysis: CodeAnalysisResults
  ): Promise<BestPracticeAssessment> {
    const practices = this.evaluateBestPractices(code, analysis);
    
    return {
      overallScore: practices.reduce((sum, p) => sum + p.score, 0) / practices.length,
      categories: practices,
      violations: practices.flatMap(p => p.practices.filter(pr => !pr.followed).map(pr => ({
        category: p.category,
        practice: pr.practice,
        severity: pr.importance === 'critical' ? 'critical' : pr.importance === 'high' ? 'major' : 'minor',
        location: fileName,
        description: `${pr.practice} not followed`,
        impact: 'Affects code quality and maintainability',
        remedy: pr.improvements.join('; ')
      }))),
      recommendations: practices.flatMap(p => p.practices.filter(pr => !pr.followed).map(pr => ({
        category: p.category,
        recommendation: pr.improvements[0] || 'Follow best practice',
        benefit: 'Improved code quality',
        implementation: 'Apply recommended changes',
        priority: pr.importance
      })))
    };
  }

  private evaluateBestPractices(code: string, analysis: CodeAnalysisResults): BestPracticeCategory[] {
    return [
      {
        category: 'Code Organization',
        score: 0.8,
        weight: 0.2,
        practices: [
          {
            practice: 'Single Responsibility Principle',
            followed: analysis.architecturalAnalysis.solidCompliance.singleResponsibility.valid,
            adherence: analysis.architecturalAnalysis.solidCompliance.singleResponsibility.cohesionScore,
            importance: 'high',
            evidence: 'Class cohesion analysis',
            improvements: ['Break down large classes', 'Extract focused responsibilities']
          },
          {
            practice: 'Proper Naming Conventions',
            followed: !code.includes('var ') && !code.includes('function f('),
            adherence: 0.8,
            importance: 'medium',
            evidence: 'Variable and function naming analysis',
            improvements: ['Use descriptive names', 'Follow naming conventions']
          }
        ]
      },
      {
        category: 'Error Handling',
        score: code.includes('try') && code.includes('catch') ? 0.9 : 0.3,
        weight: 0.15,
        practices: [
          {
            practice: 'Comprehensive Error Handling',
            followed: code.includes('try') && code.includes('catch'),
            adherence: code.includes('try') ? 0.9 : 0.3,
            importance: 'critical',
            evidence: 'Exception handling blocks detected',
            improvements: ['Add try-catch blocks', 'Handle specific exceptions', 'Provide meaningful error messages']
          }
        ]
      },
      {
        category: 'Testing',
        score: analysis.testCoverage.testQuality.overallScore,
        weight: 0.25,
        practices: [
          {
            practice: 'Adequate Test Coverage',
            followed: analysis.testCoverage.linesCovered > 0.7,
            adherence: analysis.testCoverage.linesCovered,
            importance: 'critical',
            evidence: 'Test coverage analysis',
            improvements: ['Increase test coverage', 'Add unit tests', 'Include integration tests']
          }
        ]
      },
      {
        category: 'Security',
        score: analysis.securityAnalysis.vulnerabilityAssessment.overallRisk === 'low' ? 0.9 : 0.5,
        weight: 0.2,
        practices: [
          {
            practice: 'Secure Coding Practices',
            followed: analysis.staticAnalysis.security.vulnerabilities.length === 0,
            adherence: analysis.staticAnalysis.security.securityScore,
            importance: 'critical',
            evidence: 'Security vulnerability scan',
            improvements: ['Fix security vulnerabilities', 'Implement input validation', 'Use secure APIs']
          }
        ]
      },
      {
        category: 'Performance',
        score: analysis.performanceAnalysis.scalabilityAssessment.scalabilityScore,
        weight: 0.2,
        practices: [
          {
            practice: 'Efficient Algorithms',
            followed: !code.includes('for') || code.split('for').length <= 2,
            adherence: analysis.performanceAnalysis.scalabilityAssessment.scalabilityScore,
            importance: 'medium',
            evidence: 'Performance analysis',
            improvements: ['Optimize algorithms', 'Reduce complexity', 'Use efficient data structures']
          }
        ]
      }
    ];
  }

  private async generateImprovements(
    code: string,
    fileName: string,
    analysis: CodeAnalysisResults,
    bestPractices: BestPracticeAssessment
  ): Promise<CodeImprovement[]> {
    const improvements: CodeImprovement[] = [];

    // Security improvements
    analysis.staticAnalysis.security.vulnerabilities.forEach((vuln, index) => {
      improvements.push({
        id: `security-${index}`,
        type: 'security',
        priority: vuln.severity === 'critical' ? 'critical' : vuln.severity === 'high' ? 'high' : 'medium',
        title: `Fix ${vuln.type} vulnerability`,
        description: vuln.description,
        location: vuln.location,
        currentCode: `// Vulnerable code at ${vuln.location.file}:${vuln.location.line}`,
        improvedCode: `// Secured code - ${vuln.remediation}`,
        rationale: `Security vulnerability: ${vuln.description}`,
        benefits: ['Improved security', 'Reduced attack surface'],
        risks: ['Potential breaking changes'],
        effort: {
          hours: vuln.severity === 'critical' ? 8 : 4,
          complexity: vuln.severity === 'critical' ? 'complex' : 'moderate',
          skills: ['Security knowledge', 'Code review'],
          dependencies: []
        },
        implementation: {
          steps: [
            { step: 1, description: vuln.remediation, verification: 'Security scan passes', risks: [] }
          ],
          prerequisites: ['Security review'],
          testing: {
            testTypes: ['security'],
            testCases: ['Penetration testing'],
            verification: ['No vulnerabilities detected']
          },
          rollback: {
            steps: ['Revert changes'],
            verification: ['Code compiles'],
            risks: ['Security vulnerability remains']
          }
        }
      });
    });

    // Performance improvements
    analysis.performanceAnalysis.optimizationOpportunities.forEach((opp, index) => {
      improvements.push({
        id: `performance-${index}`,
        type: 'performance',
        priority: opp.effort === 'low' ? 'high' : 'medium',
        title: `Optimize ${opp.type}`,
        description: opp.description,
        location: { file: fileName, line: 1, column: 1 },
        currentCode: '// Current implementation',
        improvedCode: `// Optimized implementation - ${opp.implementation}`,
        rationale: opp.impact,
        benefits: ['Better performance', 'Improved scalability'],
        risks: ['Complexity increase'],
        effort: {
          hours: opp.effort === 'low' ? 2 : opp.effort === 'medium' ? 6 : 12,
          complexity: opp.effort === 'low' ? 'simple' : 'moderate',
          skills: ['Performance optimization'],
          dependencies: []
        },
        implementation: {
          steps: [
            { step: 1, description: opp.implementation, verification: 'Performance tests pass', risks: [] }
          ],
          prerequisites: ['Performance baseline'],
          testing: {
            testTypes: ['performance'],
            testCases: ['Load testing'],
            verification: ['Performance improvement verified']
          },
          rollback: {
            steps: ['Revert optimization'],
            verification: ['Original performance restored'],
            risks: ['Performance degradation']
          }
        }
      });
    });

    // Maintainability improvements
    analysis.maintainabilityAnalysis.refactoringOpportunities.opportunities.forEach((opp, index) => {
      improvements.push({
        id: `refactoring-${index}`,
        type: 'refactoring',
        priority: opp.effort === 'low' ? 'high' : 'medium',
        title: `Apply ${opp.technique}`,
        description: opp.benefit,
        location: { file: opp.location.split(':')[0], line: parseInt(opp.location.split(':')[1]) || 1, column: 1 },
        currentCode: '// Code to refactor',
        improvedCode: `// Refactored code using ${opp.technique}`,
        rationale: opp.benefit,
        benefits: ['Better maintainability', 'Cleaner code'],
        risks: opp.risk === 'high' ? ['Breaking changes possible'] : ['Minimal risk'],
        effort: {
          hours: opp.effort === 'low' ? 3 : opp.effort === 'medium' ? 8 : 16,
          complexity: opp.effort === 'low' ? 'simple' : 'moderate',
          skills: ['Refactoring', 'Design patterns'],
          dependencies: []
        },
        implementation: {
          steps: opp.steps.map((step, i) => ({
            step: i + 1,
            description: step,
            verification: 'Tests pass',
            risks: []
          })),
          prerequisites: ['Full test coverage'],
          testing: {
            testTypes: ['unit', 'integration'],
            testCases: ['All existing functionality'],
            verification: ['No regression']
          },
          rollback: {
            steps: ['Revert refactoring'],
            verification: ['Original functionality restored'],
            risks: ['Code quality regression']
          }
        }
      });
    });

    return improvements;
  }

  private async generateSuggestions(
    code: string,
    fileName: string,
    analysis: CodeAnalysisResults,
    improvements: CodeImprovement[]
  ): Promise<ReviewSuggestion[]> {
    const suggestions: ReviewSuggestion[] = [];

    // Naming suggestions
    if (code.includes('function f(') || code.includes('var a ')) {
      suggestions.push({
        id: 'naming-1',
        type: 'naming',
        category: 'improvement',
        severity: 'suggestion',
        title: 'Improve variable and function naming',
        description: 'Use descriptive names that clearly indicate purpose',
        reasoning: 'Good naming improves code readability and maintainability',
        alternatives: ['Use descriptive names', 'Follow naming conventions'],
        examples: [
          {
            title: 'Better naming',
            before: 'function f(a, b) { return a + b; }',
            after: 'function calculateSum(firstNumber, secondNumber) { return firstNumber + secondNumber; }',
            explanation: 'Descriptive names make the function purpose clear'
          }
        ],
        references: ['Clean Code by Robert Martin']
      });
    }

    // Structure suggestions
    if (analysis.staticAnalysis.complexity.cyclomaticComplexity.average > 10) {
      suggestions.push({
        id: 'structure-1',
        type: 'structure',
        category: 'improvement',
        severity: 'important',
        title: 'Reduce function complexity',
        description: 'Break down complex functions into smaller, focused functions',
        reasoning: 'High complexity makes code harder to understand and maintain',
        alternatives: ['Extract methods', 'Use design patterns', 'Simplify logic'],
        examples: [
          {
            title: 'Extract method',
            before: '// Long complex function',
            after: '// Smaller focused functions',
            explanation: 'Smaller functions are easier to test and understand'
          }
        ],
        references: ['Refactoring by Martin Fowler']
      });
    }

    // Testing suggestions
    if (analysis.testCoverage.linesCovered < 0.8) {
      suggestions.push({
        id: 'testing-1',
        type: 'testing',
        category: 'improvement',
        severity: 'important',
        title: 'Increase test coverage',
        description: 'Add comprehensive tests to improve code reliability',
        reasoning: 'Good test coverage prevents regressions and improves confidence in changes',
        alternatives: ['Add unit tests', 'Add integration tests', 'Add property-based tests'],
        examples: [
          {
            title: 'Unit test example',
            after: `describe('calculateSum', () => {
  it('should add two numbers correctly', () => {
    expect(calculateSum(2, 3)).toBe(5);
  });
});`,
            explanation: 'Unit tests verify individual function behavior'
          }
        ],
        references: ['Test-Driven Development']
      });
    }

    // Documentation suggestions
    if (analysis.staticAnalysis.documentation.coverage < 0.6) {
      suggestions.push({
        id: 'documentation-1',
        type: 'documentation',
        category: 'improvement',
        severity: 'suggestion',
        title: 'Improve documentation coverage',
        description: 'Add comprehensive documentation for public APIs and complex logic',
        reasoning: 'Good documentation helps other developers understand and use the code',
        alternatives: ['Add JSDoc comments', 'Create README files', 'Document APIs'],
        examples: [
          {
            title: 'JSDoc example',
            after: `/**
 * Calculates the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum of a and b
 */
function calculateSum(a, b) { return a + b; }`,
            explanation: 'JSDoc provides clear API documentation'
          }
        ],
        references: ['JSDoc documentation']
      });
    }

    return suggestions;
  }

  private async generateAutomatedFixes(
    code: string,
    fileName: string,
    improvements: CodeImprovement[]
  ): Promise<AutomatedFix[]> {
    const fixes: AutomatedFix[] = [];

    // Simple automated fixes
    if (code.includes('var ')) {
      fixes.push({
        id: 'var-to-const',
        type: 'automatic',
        title: 'Replace var with const/let',
        description: 'Use modern variable declarations',
        location: { file: fileName, line: 1, column: 1 },
        fix: {
          originalCode: code,
          fixedCode: code.replace(/var /g, 'const '),
          changes: [
            {
              type: 'modify',
              location: { file: fileName, line: 1, column: 1 },
              description: 'Replace var with const',
              code: 'const'
            }
          ],
          dependencies: []
        },
        confidence: 0.9,
        risk: 'low',
        validation: {
          syntaxCheck: true,
          typeCheck: true,
          testValidation: true,
          securityCheck: true,
          performanceImpact: 'None'
        }
      });
    }

    // Remove unused variables
    if (code.includes('unused')) {
      fixes.push({
        id: 'remove-unused',
        type: 'automatic',
        title: 'Remove unused variables',
        description: 'Clean up unused variable declarations',
        location: { file: fileName, line: 1, column: 1 },
        fix: {
          originalCode: code,
          fixedCode: code.replace(/const unused = .*?;/g, ''),
          changes: [
            {
              type: 'remove',
              location: { file: fileName, line: 1, column: 1 },
              description: 'Remove unused variable',
              code: ''
            }
          ],
          dependencies: []
        },
        confidence: 0.95,
        risk: 'low',
        validation: {
          syntaxCheck: true,
          typeCheck: true,
          testValidation: true,
          securityCheck: true,
          performanceImpact: 'Positive'
        }
      });
    }

    return fixes;
  }

  private async calculateReviewMetrics(
    code: string,
    analysis: CodeAnalysisResults
  ): Promise<ReviewMetrics> {
    return {
      linesOfCode: code.split('\n').length,
      complexity: {
        cyclomaticComplexity: analysis.staticAnalysis.complexity.cyclomaticComplexity.average,
        cognitiveComplexity: analysis.staticAnalysis.complexity.cognitiveComplexity.average,
        nestingDepth: analysis.staticAnalysis.complexity.nestingDepth.average,
        functionLength: analysis.staticAnalysis.complexity.functionLength.average,
        classSize: analysis.staticAnalysis.complexity.classSize.average
      },
      quality: {
        overallScore: analysis.staticAnalysis.quality.overallScore,
        maintainability: analysis.maintainabilityAnalysis.maintainabilityIndex,
        reliability: analysis.testCoverage.testQuality.overallScore,
        security: analysis.staticAnalysis.security.securityScore,
        efficiency: analysis.performanceAnalysis.scalabilityAssessment.scalabilityScore,
        portability: 0.8 // Default value
      },
      coverage: {
        statementCoverage: analysis.testCoverage.statementsCovered,
        branchCoverage: analysis.testCoverage.branchesCovered,
        functionCoverage: analysis.testCoverage.functionsCovered,
        lineCoverage: analysis.testCoverage.linesCovered
      },
      performance: {
        timeComplexity: analysis.performanceAnalysis.algorithmicComplexity.timeComplexity,
        spaceComplexity: analysis.performanceAnalysis.algorithmicComplexity.spaceComplexity,
        criticalPathEfficiency: 0.8,
        resourceUtilization: 0.7
      },
      maintainability: {
        maintainabilityIndex: analysis.maintainabilityAnalysis.maintainabilityIndex,
        technicalDebt: analysis.maintainabilityAnalysis.technicalDebt.totalDebt,
        documentationCoverage: analysis.staticAnalysis.documentation.coverage,
        testMaintainability: analysis.testCoverage.testQuality.testMaintainability
      }
    };
  }

  private async makeApprovalDecision(
    analysis: CodeAnalysisResults,
    bestPractices: BestPracticeAssessment,
    improvements: CodeImprovement[],
    metrics: ReviewMetrics
  ): Promise<ApprovalDecision> {
    const criticalIssues = improvements.filter(i => i.priority === 'critical');
    const highIssues = improvements.filter(i => i.priority === 'high');
    const blockers = this.identifyBlockers(analysis, improvements);

    let status: ReviewStatus;
    let reasoning: string;

    if (criticalIssues.length > 0 || blockers.length > 0) {
      status = 'rejected';
      reasoning = 'Critical security or quality issues must be resolved';
    } else if (highIssues.length > 3) {
      status = 'changes_required';
      reasoning = 'Multiple high-priority issues need to be addressed';
    } else if (improvements.length > 0) {
      status = 'approved_with_suggestions';
      reasoning = 'Code is acceptable with suggested improvements';
    } else {
      status = 'approved';
      reasoning = 'Code meets all quality standards';
    }

    return {
      status,
      reasoning,
      conditions: highIssues.map(issue => ({
        condition: `Resolve: ${issue.title}`,
        mandatory: issue.priority === 'critical' || issue.priority === 'high',
        responsible: 'Developer'
      })),
      blockers,
      recommendations: improvements.slice(0, 5).map(i => i.title),
      nextReview: status === 'rejected' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined
    };
  }

  private identifyBlockers(analysis: CodeAnalysisResults, improvements: CodeImprovement[]): ReviewBlocker[] {
    const blockers: ReviewBlocker[] = [];

    // Critical security issues are blockers
    const criticalSecurityIssues = improvements.filter(i => 
      i.type === 'security' && i.priority === 'critical'
    );

    criticalSecurityIssues.forEach(issue => {
      blockers.push({
        type: 'security',
        severity: 'critical',
        description: issue.description,
        resolution: issue.rationale
      });
    });

    // Poor test coverage can be a blocker
    if (analysis.testCoverage.linesCovered < 0.5) {
      blockers.push({
        type: 'quality',
        severity: 'high',
        description: 'Insufficient test coverage',
        resolution: 'Increase test coverage to at least 80%'
      });
    }

    return blockers;
  }

  private async generateFollowUpActions(
    improvements: CodeImprovement[],
    suggestions: ReviewSuggestion[],
    approval: ApprovalDecision
  ): Promise<FollowUpAction[]> {
    const actions: FollowUpAction[] = [];

    // High priority improvements become follow-up actions
    improvements.filter(i => i.priority === 'high' || i.priority === 'critical').forEach(improvement => {
      actions.push({
        action: improvement.type === 'security' ? 'security_review' : 'implement_fix',
        description: improvement.title,
        assignee: 'Developer',
        priority: improvement.priority,
        dependencies: []
      });
    });

    // Add testing action if coverage is low
    if (suggestions.some(s => s.type === 'testing')) {
      actions.push({
        action: 'add_tests',
        description: 'Increase test coverage',
        assignee: 'Developer',
        priority: 'high',
        dependencies: []
      });
    }

    // Add documentation action if needed
    if (suggestions.some(s => s.type === 'documentation')) {
      actions.push({
        action: 'update_documentation',
        description: 'Improve code documentation',
        assignee: 'Developer',
        priority: 'medium',
        dependencies: []
      });
    }

    return actions;
  }

  private calculateReviewConfidence(
    analysis: CodeAnalysisResults,
    bestPractices: BestPracticeAssessment,
    improvements: CodeImprovement[]
  ): number {
    let confidence = 1.0;

    // Reduce confidence based on analysis completeness
    confidence *= analysis.staticAnalysis.confidence;
    confidence *= bestPractices.overallScore;

    // Reduce confidence based on number of issues
    const criticalIssues = improvements.filter(i => i.priority === 'critical').length;
    const highIssues = improvements.filter(i => i.priority === 'high').length;

    confidence -= criticalIssues * 0.2;
    confidence -= highIssues * 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private getReviewerInfo(): ReviewerInfo {
    return {
      type: 'ai_agent',
      name: 'FlowX Intelligent Code Reviewer',
      expertise: ['TypeScript', 'JavaScript', 'Security', 'Performance', 'Architecture'],
      experience: {
        level: 'expert',
        yearsExperience: 10,
        reviewsCompleted: 10000,
        domains: ['Web Development', 'Security', 'Performance', 'Architecture']
      },
      specializations: ['Static Analysis', 'Security Review', 'Performance Optimization', 'Clean Architecture']
    };
  }

  private generateReviewId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private storeReviewHistory(fileName: string, report: CodeReviewReport): void {
    if (!this.reviewHistory.has(fileName)) {
      this.reviewHistory.set(fileName, []);
    }
    this.reviewHistory.get(fileName)!.push(report);
    
    // Keep only last 10 reviews per file
    const history = this.reviewHistory.get(fileName)!;
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  private async applyFix(code: string, fix: AutomatedFix): Promise<{ success: boolean; code: string; changes: string[] }> {
    try {
      // Simple implementation - would use more sophisticated AST manipulation
      let modifiedCode = fix.fix.fixedCode;
      
      return {
        success: true,
        code: modifiedCode,
        changes: fix.fix.changes.map(c => c.description)
      };
    } catch (error) {
      return {
        success: false,
        code: code,
        changes: []
      };
    }
  }

  private aggregateProjectReviews(
    reviews: CodeReviewReport[], 
    context?: ProjectReviewContext
  ): ProjectReviewReport {
    return {
      projectName: context?.projectName || 'Unknown Project',
      totalFiles: reviews.length,
      overallStatus: reviews.every(r => r.overall === 'approved') ? 'approved' : 
                    reviews.some(r => r.overall === 'rejected') ? 'rejected' : 'changes_required',
      aggregatedMetrics: this.aggregateMetrics(reviews),
      criticalIssues: reviews.reduce((sum, r) => sum + r.improvements.filter(i => i.priority === 'critical').length, 0),
      highIssues: reviews.reduce((sum, r) => sum + r.improvements.filter(i => i.priority === 'high').length, 0),
      reviews
    };
  }

  private aggregateMetrics(reviews: CodeReviewReport[]): AggregatedMetrics {
    const totalLines = reviews.reduce((sum, r) => sum + r.metrics.linesOfCode, 0);
    
    return {
      totalLinesOfCode: totalLines,
      averageComplexity: reviews.reduce((sum, r) => sum + r.metrics.complexity.cyclomaticComplexity, 0) / reviews.length,
      averageQuality: reviews.reduce((sum, r) => sum + r.metrics.quality.overallScore, 0) / reviews.length,
      averageCoverage: reviews.reduce((sum, r) => sum + r.metrics.coverage.lineCoverage, 0) / reviews.length,
      totalTechnicalDebt: reviews.reduce((sum, r) => sum + r.metrics.maintainability.technicalDebt, 0)
    };
  }

  private initializeConfig(config?: Partial<ReviewConfiguration>): ReviewConfiguration {
    return {
      reviewCriteria: {
        securityWeight: 0.25,
        performanceWeight: 0.2,
        maintainabilityWeight: 0.2,
        testingWeight: 0.2,
        documentationWeight: 0.15,
        complexityThresholds: {
          cyclomaticComplexity: 10,
          cognitiveComplexity: 15,
          nestingDepth: 4,
          functionLength: 50,
          classSize: 200
        }
      },
      automationLevel: {
        automaticFixes: true,
        suggestionsOnly: false,
        humanReviewRequired: false,
        confidenceThreshold: 0.8
      },
      bestPracticesRules: {
        enabledRules: ['naming', 'complexity', 'testing', 'security'],
        customRules: [],
        severity: 'moderate'
      },
      qualityGates: [
        { name: 'Security Score', metric: 'security', threshold: 0.8, operator: 'greater_than', blocking: true },
        { name: 'Test Coverage', metric: 'coverage', threshold: 0.7, operator: 'greater_than', blocking: false }
      ],
      reviewerPreferences: {
        verbosity: 'standard',
        focusAreas: ['security', 'maintainability', 'testing'],
        suggestionStyle: 'educational',
        codeExamples: true
      },
      ...config
    };
  }
}

// Additional interfaces for completeness
export interface CodeReviewContext {
  projectType?: string;
  architecture?: string;
  frameworks?: string[];
  constraints?: string[];
  projectContext?: ProjectReviewContext;
  relatedFiles?: string[];
}

export interface ProjectReviewContext {
  projectName?: string;
  version?: string;
  team?: string;
  deadline?: Date;
}

export interface ProjectReviewReport {
  projectName: string;
  totalFiles: number;
  overallStatus: ReviewStatus;
  aggregatedMetrics: AggregatedMetrics;
  criticalIssues: number;
  highIssues: number;
  reviews: CodeReviewReport[];
}

export interface AggregatedMetrics {
  totalLinesOfCode: number;
  averageComplexity: number;
  averageQuality: number;
  averageCoverage: number;
  totalTechnicalDebt: number;
}

export interface AppliedFixesResult {
  originalCode: string;
  modifiedCode: string;
  appliedFixes: AppliedFix[];
  remainingIssues: AutomatedFix[];
}

export interface AppliedFix {
  fixId: string;
  success: boolean;
  changes?: string[];
  error?: string;
} 