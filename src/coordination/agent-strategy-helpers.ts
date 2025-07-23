import type { AgentType } from './swarm-coordinator.js';

/**
 * Get agent types for a given strategy
 */
export function getAgentTypesForStrategy(strategy: string): AgentType[] {
  const strategyMapping: Record<string, AgentType[]> = {
    research: [
      'coordinator',
      'researcher',
      'analyst',
      'documenter'
    ],
    development: [
      'coordinator',
      'architect',
      'coder',
      'tester',
      'reviewer'
    ],
    analysis: [
      'coordinator',
      'analyst',
      'researcher',
      'specialist',
      'documenter'
    ],
    testing: [
      'coordinator',
      'tester',
      'coder',
      'reviewer'
    ],
    optimization: [
      'coordinator',
      'optimizer',
      'analyst',
      'architect'
    ],
    maintenance: [
      'coordinator',
      'optimizer',
      'tester',
      'reviewer',
      'monitor'
    ],
    auto: [
      'coordinator',
      'coder',
      'analyst',
      'researcher',
      'tester'
    ]
  };

  return strategyMapping[strategy] || strategyMapping.auto;
}

/**
 * Get capabilities for a given agent type
 */
export function getCapabilitiesForType(agentType: AgentType): string[] {
  const capabilityMapping: Record<AgentType, string[]> = {
    coordinator: [
      'task_coordination',
      'agent_management',
      'decision_making',
      'conflict_resolution',
      'resource_allocation',
      'progress_monitoring',
      'communication',
      'planning'
    ],
    researcher: [
      'information_gathering',
      'web_search',
      'data_collection',
      'source_verification',
      'knowledge_synthesis',
      'report_generation',
      'fact_checking',
      'literature_review'
    ],
    coder: [
      'code_generation',
      'programming',
      'debugging',
      'code_review',
      'refactoring',
      'testing',
      'documentation',
      'version_control',
      'api_development',
      'database_operations'
    ],
    analyst: [
      'data_analysis',
      'pattern_recognition',
      'statistical_analysis',
      'performance_analysis',
      'trend_analysis',
      'visualization',
      'reporting',
      'metrics_collection',
      'insight_generation'
    ],
    architect: [
      'system_design',
      'architecture_planning',
      'technical_specification',
      'scalability_design',
      'integration_planning',
      'technology_selection',
      'design_patterns',
      'performance_optimization',
      'security_design'
    ],
    tester: [
      'test_planning',
      'test_execution',
      'automation_testing',
      'unit_testing',
      'integration_testing',
      'performance_testing',
      'security_testing',
      'quality_assurance',
      'bug_detection',
      'test_reporting'
    ],
    reviewer: [
      'code_review',
      'quality_assessment',
      'best_practices_enforcement',
      'security_review',
      'performance_review',
      'documentation_review',
      'compliance_checking',
      'feedback_generation'
    ],
    optimizer: [
      'performance_optimization',
      'resource_optimization',
      'cost_optimization',
      'efficiency_analysis',
      'bottleneck_identification',
      'scaling_optimization',
      'algorithm_optimization',
      'system_tuning'
    ],
    documenter: [
      'documentation_writing',
      'technical_writing',
      'user_guides',
      'api_documentation',
      'tutorial_creation',
      'knowledge_base_management',
      'content_organization',
      'style_guide_enforcement'
    ],
    monitor: [
      'system_monitoring',
      'health_checks',
      'alert_management',
      'log_analysis',
      'performance_monitoring',
      'uptime_monitoring',
      'error_tracking',
      'metric_collection',
      'dashboard_creation'
    ],
    specialist: [
      'domain_expertise',
      'specialized_knowledge',
      'consultation',
      'expert_advice',
      'problem_solving',
      'technical_guidance',
      'best_practices',
      'specialized_tools'
    ]
  };

  return capabilityMapping[agentType] || [];
}

/**
 * Get system prompt for a given agent type
 */
export function getSystemPromptForType(agentType: AgentType, context?: string): string {
  const basePrompts: Record<AgentType, string> = {
    coordinator: `You are a Coordinator agent specializing in task coordination and agent management. Your role is to:
- Coordinate activities between multiple agents
- Make strategic decisions about task allocation
- Resolve conflicts between agents
- Monitor overall progress
- Ensure efficient resource utilization
- Maintain clear communication channels
${context ? `\nContext: ${context}` : ''}`,

    researcher: `You are a Researcher agent specializing in information gathering and analysis. Your role is to:
- Conduct thorough research on assigned topics
- Gather information from reliable sources
- Verify facts and validate information
- Synthesize findings into coherent reports
- Identify knowledge gaps and research opportunities
- Maintain objectivity and accuracy
${context ? `\nContext: ${context}` : ''}`,

    coder: `You are a Coder agent specializing in software development. Your role is to:
- Write clean, efficient, and maintainable code
- Implement features according to specifications
- Debug and fix issues in existing code
- Follow coding best practices and standards
- Create comprehensive tests for your code
- Document your implementations clearly
${context ? `\nContext: ${context}` : ''}`,

    analyst: `You are an Analyst agent specializing in data analysis and insights. Your role is to:
- Analyze data to identify patterns and trends
- Generate actionable insights from complex datasets
- Create visualizations and reports
- Perform statistical analysis
- Monitor key performance metrics
- Provide data-driven recommendations
${context ? `\nContext: ${context}` : ''}`,

    architect: `You are an Architect agent specializing in system design. Your role is to:
- Design scalable and maintainable system architectures
- Create technical specifications and blueprints
- Select appropriate technologies and frameworks
- Plan system integrations and interfaces
- Ensure security and performance considerations
- Guide implementation teams with architectural decisions
${context ? `\nContext: ${context}` : ''}`,

    tester: `You are a Tester agent specializing in quality assurance. Your role is to:
- Design comprehensive test strategies and plans
- Execute various types of testing (unit, integration, performance, security)
- Identify and report bugs and issues
- Automate testing processes where possible
- Ensure software meets quality standards
- Collaborate with development teams to improve quality
${context ? `\nContext: ${context}` : ''}`,

    reviewer: `You are a Reviewer agent specializing in quality assessment. Your role is to:
- Review code, documentation, and technical designs
- Ensure adherence to best practices and standards
- Provide constructive feedback for improvements
- Identify potential security and performance issues
- Maintain consistency across projects
- Mentor and guide other team members
${context ? `\nContext: ${context}` : ''}`,

    optimizer: `You are an Optimizer agent specializing in performance optimization. Your role is to:
- Identify performance bottlenecks and inefficiencies
- Optimize code, algorithms, and system performance
- Reduce resource consumption and costs
- Improve scalability and responsiveness
- Monitor and measure optimization results
- Recommend infrastructure and architectural improvements
${context ? `\nContext: ${context}` : ''}`,

    documenter: `You are a Documenter agent specializing in technical writing. Your role is to:
- Create clear, comprehensive documentation
- Write user guides, API documentation, and tutorials
- Organize and maintain knowledge bases
- Ensure documentation stays up-to-date
- Follow documentation standards and style guides
- Make complex technical concepts accessible
${context ? `\nContext: ${context}` : ''}`,

    monitor: `You are a Monitor agent specializing in system observation. Your role is to:
- Monitor system health and performance
- Set up and manage alerts and notifications
- Analyze logs and metrics for issues
- Track uptime and availability
- Generate monitoring reports and dashboards
- Ensure proactive issue detection and response
${context ? `\nContext: ${context}` : ''}`,

    specialist: `You are a Specialist agent with domain-specific expertise. Your role is to:
- Provide specialized knowledge and expertise
- Offer consultation on complex technical problems
- Guide decision-making with expert insights
- Share best practices and proven solutions
- Adapt expertise to specific project needs
- Mentor others in your area of specialization
${context ? `\nContext: ${context}` : ''}`
  };

  return basePrompts[agentType] || basePrompts.specialist;
}

/**
 * Check if an agent type is suitable for a task type
 */
export function isAgentSuitableForTask(agentType: AgentType, taskType: string): boolean {
  const taskMapping: Record<string, AgentType[]> = {
    // Research tasks
    'research': ['researcher', 'analyst', 'specialist'],
    'information_gathering': ['researcher', 'analyst'],
    'data_collection': ['researcher', 'analyst'],
    'analysis': ['analyst', 'researcher'],
    'investigation': ['researcher', 'analyst'],

    // Development tasks
    'coding': ['coder'],
    'programming': ['coder'],
    'implementation': ['coder'],
    'development': ['coder'],
    'refactoring': ['coder', 'reviewer'],
    'debugging': ['coder', 'tester'],

    // Architecture tasks
    'design': ['architect'],
    'architecture': ['architect'],
    'planning': ['architect', 'coordinator'],
    'specification': ['architect'],
    'system_design': ['architect'],

    // Testing tasks
    'testing': ['tester', 'coder'],
    'quality_assurance': ['tester', 'reviewer'],
    'validation': ['tester', 'reviewer'],
    'verification': ['tester', 'reviewer'],

    // Review tasks
    'review': ['reviewer', 'architect'],
    'code_review': ['reviewer', 'coder'],
    'quality_review': ['reviewer', 'tester'],
    'assessment': ['reviewer', 'analyst'],

    // Documentation tasks
    'documentation': ['documenter', 'coder'],
    'writing': ['documenter', 'researcher'],
    'reporting': ['documenter', 'analyst'],

    // Optimization tasks
    'optimization': ['optimizer', 'architect'],
    'performance': ['optimizer', 'analyst'],
    'tuning': ['optimizer', 'monitor'],

    // Monitoring tasks
    'monitoring': ['monitor', 'analyst'],
    'observation': ['monitor', 'analyst'],
    'tracking': ['monitor', 'analyst'],
    'alerting': ['monitor', 'optimizer'],

    // Coordination tasks
    'coordination': ['coordinator'],
    'management': ['coordinator'],
    'orchestration': ['coordinator'],
    'leadership': ['coordinator']
  };

  // Check direct matches
  const suitableAgents = taskMapping[taskType.toLowerCase()];
  if (suitableAgents?.includes(agentType)) {
    return true;
  }

  // Check partial matches
  for (const [task, agents] of Object.entries(taskMapping)) {
    if (taskType.toLowerCase().includes(task) && agents.includes(agentType)) {
      return true;
    }
  }

  // Coordinator can handle any task type
  return agentType === 'coordinator';
}

/**
 * Get priority score for an agent type handling a specific task
 */
export function getAgentPriorityForTask(agentType: AgentType, taskType: string): number {
  // Base priority scores
  const basePriority: Record<AgentType, number> = {
    coordinator: 5,
    specialist: 4,
    architect: 4,
    coder: 3,
    analyst: 3,
    researcher: 3,
    tester: 3,
    reviewer: 3,
    optimizer: 3,
    documenter: 2,
    monitor: 2
  };

  let priority = basePriority[agentType] || 1;

  // Boost priority for perfect matches
  if (isAgentSuitableForTask(agentType, taskType)) {
    priority += 5;
  }

  // Specific priority boosts
  const taskLower = taskType.toLowerCase();
  
  if (taskLower.includes('coordinate') && agentType === 'coordinator') priority += 10;
  if (taskLower.includes('code') && agentType === 'coder') priority += 8;
  if (taskLower.includes('design') && agentType === 'architect') priority += 8;
  if (taskLower.includes('test') && agentType === 'tester') priority += 8;
  if (taskLower.includes('research') && agentType === 'researcher') priority += 8;
  if (taskLower.includes('analyze') && agentType === 'analyst') priority += 8;
  if (taskLower.includes('review') && agentType === 'reviewer') priority += 8;
  if (taskLower.includes('optimize') && agentType === 'optimizer') priority += 8;
  if (taskLower.includes('document') && agentType === 'documenter') priority += 8;
  if (taskLower.includes('monitor') && agentType === 'monitor') priority += 8;

  return priority;
}

/**
 * Recommend agent composition for a strategy
 */
export function recommendAgentComposition(strategy: string, maxAgents: number, objective: string): {
  agentType: AgentType;
  priority: number;
  reason: string;
}[] {
  const agentTypes = getAgentTypesForStrategy(strategy);
  const recommendations: { agentType: AgentType; priority: number; reason: string; }[] = [];

  // Always include a coordinator for multi-agent scenarios
  if (maxAgents > 1) {
    recommendations.push({
      agentType: 'coordinator',
      priority: 10,
      reason: 'Essential for coordinating multiple agents'
    });
  }

  // Add strategy-specific agents
  for (const agentType of agentTypes.slice(0, maxAgents - (maxAgents > 1 ? 1 : 0))) {
    if (agentType !== 'coordinator') {
      recommendations.push({
        agentType,
        priority: getAgentPriorityForTask(agentType, objective),
        reason: `Specialized for ${strategy} strategy`
      });
    }
  }

  // Sort by priority
  recommendations.sort((a, b) => b.priority - a.priority);

  // Limit to maxAgents
  return recommendations.slice(0, maxAgents);
}

/**
 * Calculate how suitable an agent is for a specific task
 */
export function calculateAgentSuitability(
  agentType: AgentType,
  taskType: string,
  requiredCapabilities: string[] = []
): number {
  let suitability = 0;

  // Base suitability based on agent type and task type
  const baseSuitability: Record<string, Record<string, number>> = {
    coordinator: { coordination: 1.0, analysis: 0.8, 'default': 0.6 },
    researcher: { research: 1.0, analysis: 0.9, documentation: 0.7, 'default': 0.5 },
    coder: { coding: 1.0, implementation: 0.9, testing: 0.6, 'default': 0.4 },
    analyst: { analysis: 1.0, research: 0.8, review: 0.7, 'default': 0.5 },
    architect: { 'system-design': 1.0, architecture: 1.0, analysis: 0.8, 'default': 0.6 },
    tester: { testing: 1.0, validation: 0.9, review: 0.7, 'default': 0.4 },
    reviewer: { review: 1.0, testing: 0.8, analysis: 0.7, 'default': 0.5 },
    optimizer: { optimization: 1.0, performance: 0.9, analysis: 0.7, 'default': 0.5 },
    documenter: { documentation: 1.0, analysis: 0.6, review: 0.5, 'default': 0.4 },
    monitor: { monitoring: 1.0, analysis: 0.7, 'default': 0.4 },
    specialist: { 'default': 0.8 }
  };

  // Get base suitability
  const agentCapabilities = baseSuitability[agentType] || baseSuitability.specialist;
  suitability = agentCapabilities[taskType] || agentCapabilities['default'] || 0.5;

  // Capability matching bonus
  if (requiredCapabilities.length > 0) {
    const agentSkills = getCapabilitiesForType(agentType);
    const matchedCapabilities = requiredCapabilities.filter(cap => 
      agentSkills.includes(cap)
    );
    const capabilityMatch = matchedCapabilities.length / requiredCapabilities.length;
    suitability += capabilityMatch * 0.3; // 30% bonus for capability match
  }

  return Math.min(1.0, suitability);
} 