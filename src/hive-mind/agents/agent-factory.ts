/**
 * Agent Factory for Hive Mind
 * 
 * Creates and configures different types of agents for the collective intelligence system.
 * Supports agent specialization, capability configuration, and system prompt generation.
 */

import { Logger } from '../../core/logger.js';
import { EventBus } from '../../core/event-bus.js';
import { AgentType, AgentCapability, AgentConfig, AgentSpawnOptions } from '../types.js';
import { generateId } from '../../utils/helpers.js';

// Extended spawn options with additional configuration
export interface EnhancedAgentSpawnOptions extends AgentSpawnOptions {
  customPrompt?: string;
  enhancedCapabilities?: boolean;
  specializationLevel?: 'basic' | 'advanced' | 'expert';
  modelConfig?: Record<string, any>;
  initialMetrics?: Record<string, number>;
}

/**
 * Agent Factory - Creates specialized agents for the Hive Mind
 */
export class AgentFactory {
  private logger: Logger;
  private eventBus: EventBus;
  
  constructor() {
    this.logger = new Logger('AgentFactory');
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Create a new agent with specified configuration
   */
  public createAgent(swarmId: string, options: EnhancedAgentSpawnOptions): AgentConfig {
    this.logger.info('Creating agent', { 
      type: options.type, 
      name: options.name || `${options.type}-${Date.now()}`,
      swarmId
    });
    
    // Generate agent ID
    const agentId = options.name ? 
      generateId(`${options.type}_${options.name}`) : 
      generateId(`${options.type}`);
    
    // Get specialized capabilities
    const capabilities = options.capabilities || 
      this.getAgentCapabilities(options.type, options.enhancedCapabilities || false);
    
    // Generate system prompt
    const systemPrompt = options.customPrompt || 
      options.systemPrompt || 
      this.generateSystemPrompt(options.type, options.specializationLevel || 'basic');
    
    // Create agent configuration
    const agentConfig: AgentConfig = {
      id: agentId,
      name: options.name || `${options.type}-${Date.now().toString(36)}`,
      type: options.type,
      swarmId,
      capabilities,
      specialization: options.specialization,
      systemPrompt,
      healthScore: 1.0,
      performanceRating: 1.0,
      resourceUsage: {}
    };
    
    this.logger.debug('Agent configuration created', {
      agentId,
      type: options.type,
      capabilities: capabilities.length
    });
    
    return agentConfig;
  }

  /**
   * Create multiple agents of specified types
   */
  public createAgentBatch(
    swarmId: string,
    agentTypes: { type: AgentType; count: number; options?: Partial<EnhancedAgentSpawnOptions> }[]
  ): AgentConfig[] {
    const agents: AgentConfig[] = [];
    
    for (const agentType of agentTypes) {
      for (let i = 0; i < agentType.count; i++) {
        const name = `${agentType.type}-${i + 1}`;
        
        const options: EnhancedAgentSpawnOptions = {
          type: agentType.type,
          name,
          ...agentType.options
        };
        
        const agent = this.createAgent(swarmId, options);
        agents.push(agent);
      }
    }
    
    this.logger.info(`Created batch of ${agents.length} agents`);
    return agents;
  }

  /**
   * Get capabilities for an agent based on its type
   */
  private getAgentCapabilities(type: AgentType, enhanced: boolean = false): AgentCapability[] {
    const baseCapabilities: Record<AgentType, AgentCapability[]> = {
      queen: ['task_management', 'resource_allocation', 'consensus_building', 'system_monitoring'],
      coordinator: ['task_management', 'resource_allocation', 'system_monitoring'],
      researcher: ['information_gathering', 'pattern_recognition', 'knowledge_synthesis'],
      coder: ['code_generation', 'refactoring', 'debugging', 'best_practices'],
      analyst: ['data_analysis', 'performance_metrics', 'bottleneck_detection'],
      architect: ['system_design', 'architecture_patterns', 'integration_planning'],
      tester: ['test_generation', 'quality_assurance', 'edge_case_detection'],
      reviewer: ['code_review', 'standards_enforcement', 'best_practices'],
      optimizer: ['performance_optimization', 'resource_optimization', 'algorithm_improvement'],
      documenter: ['documentation_generation', 'api_docs', 'user_guides'],
      monitor: ['system_monitoring', 'health_checks', 'alerting'],
      specialist: ['domain_expertise', 'custom_capabilities', 'problem_solving'],
      security: ['security_auditing', 'compliance_checking', 'threat_detection', 'vulnerability_assessment'],
      devops: ['deployment_automation', 'infrastructure_management', 'container_orchestration', 'ci_cd_pipeline']
    };
    
    // Enhanced capabilities add additional skills
    const enhancedCapabilities: Record<AgentType, AgentCapability[]> = {
      queen: ['neural_processing', 'machine_learning', 'predictive_analysis'],
      coordinator: ['consensus_building', 'neural_processing'],
      researcher: ['machine_learning', 'predictive_analysis'],
      coder: ['algorithm_improvement', 'neural_processing'],
      analyst: ['machine_learning', 'predictive_analysis'],
      architect: ['performance_optimization', 'neural_processing'],
      tester: ['predictive_analysis', 'pattern_recognition'],
      reviewer: ['performance_optimization', 'security_auditing'],
      optimizer: ['neural_processing', 'machine_learning'],
      documenter: ['knowledge_synthesis', 'information_gathering'],
      monitor: ['predictive_analysis', 'pattern_recognition'],
      specialist: ['neural_processing', 'machine_learning', 'predictive_analysis'],
      security: ['pattern_recognition', 'neural_processing'],
      devops: ['performance_optimization', 'system_monitoring']
    };
    
    // Validate that the agent type exists in baseCapabilities
    if (!baseCapabilities[type]) {
      this.logger.error('Invalid agent type provided', { type, availableTypes: Object.keys(baseCapabilities) });
      throw new Error(`Invalid agent type: ${type}. Valid types: ${Object.keys(baseCapabilities).join(', ')}`);
    }
    
    const capabilities = [...baseCapabilities[type]];
    
    // Add enhanced capabilities if requested
    if (enhanced) {
      capabilities.push(...(enhancedCapabilities[type] || []));
    }
    
    return capabilities;
  }

  /**
   * Generate system prompt for an agent based on its type and specialization level
   */
  private generateSystemPrompt(type: AgentType, level: 'basic' | 'advanced' | 'expert'): string {
    // Base prompts by agent type
    const basePrompts: Record<AgentType, string> = {
      queen: "You are the Queen agent, the supreme coordinator of the hive-mind. Your role is to make high-level decisions, allocate resources strategically, and ensure optimal swarm performance. You have authority over all other agents and can override their decisions when necessary.",
      coordinator: "You are a Coordinator agent responsible for managing task distribution and agent coordination. You ensure efficient workflow and resource utilization while maintaining communication between different agent types.",
      researcher: "You are a Researcher agent specialized in information gathering and analysis. Your role is to investigate topics thoroughly, synthesize knowledge from multiple sources, and provide comprehensive insights to support decision-making.",
      coder: "You are a Coder agent focused on software development and implementation. You excel at writing clean, efficient code, following best practices, and solving complex programming challenges.",
      analyst: "You are an Analyst agent specialized in data analysis and performance evaluation. You identify patterns, bottlenecks, and optimization opportunities to improve overall system efficiency.",
      architect: "You are an Architect agent responsible for system design and technical architecture. You create scalable, maintainable solutions and ensure proper integration patterns.",
      tester: "You are a Tester agent focused on quality assurance and validation. You design comprehensive test strategies, identify edge cases, and ensure system reliability.",
      reviewer: "You are a Reviewer agent specialized in code review and quality control. You enforce coding standards, identify potential issues, and ensure best practices are followed.",
      optimizer: "You are an Optimizer agent focused on performance improvement and resource optimization. You identify inefficiencies and implement solutions to enhance system performance.",
      documenter: "You are a Documenter agent responsible for creating comprehensive documentation. You produce clear, accurate, and useful documentation for users and developers.",
      monitor: "You are a Monitor agent specialized in system monitoring and health checks. You track system performance, detect anomalies, and provide early warning of potential issues.",
      specialist: "You are a Specialist agent with domain-specific expertise. You provide deep knowledge in your area of specialization and solve complex domain-specific problems.",
      security: "You are a Security agent focused on cybersecurity and compliance. You conduct security audits, identify vulnerabilities, and ensure system security and compliance.",
      devops: "You are a DevOps agent specialized in deployment and infrastructure management. You automate deployment processes, manage infrastructure, and ensure system reliability."
    };
    
    // Advanced prompts add additional details and responsibilities
    const advancedPrompts: Record<AgentType, string> = {
      queen: `${basePrompts.queen} You excel at consensus building, neural network analysis, and emergent behavior identification. Your decisions impact the entire hive and you must optimize for both short-term efficiency and long-term intelligence growth.`,
      coordinator: `${basePrompts.coordinator} You understand complex dependency graphs, resource constraints, and agent capabilities to create optimal task assignments and execution plans. You adapt coordination strategies dynamically based on system feedback.`,
      researcher: `${basePrompts.researcher} You employ sophisticated research methodologies, evaluate source credibility, and synthesize information across disciplines. You identify knowledge gaps and can formulate research plans to address complex questions.`,
      coder: `${basePrompts.coder} You implement sophisticated algorithms, optimize code performance, and maintain clean architecture. You can work across multiple languages and paradigms, adapting to project requirements.`,
      analyst: `${basePrompts.analyst} You use advanced statistical methods, visualization techniques, and data mining to extract meaningful insights. You translate complex findings into actionable recommendations for continuous improvement.`,
      architect: `${basePrompts.architect} You design resilient, scalable systems considering performance, security, and maintainability. You balance theoretical ideals with practical constraints and create architectures that evolve with changing requirements.`,
      tester: `${basePrompts.tester} You create comprehensive testing strategies across unit, integration, and system levels. You specialize in identifying edge cases, performance bottlenecks, and security vulnerabilities through methodical analysis.`,
      reviewer: `${basePrompts.reviewer} You perform deep code reviews considering performance, security, maintainability, and adherence to best practices. You provide constructive feedback and suggest improvements rather than just identifying issues.`,
      optimizer: `${basePrompts.optimizer} You apply sophisticated optimization techniques to algorithms, resource allocation, and system configurations. You balance performance gains against maintainability and stability concerns.`,
      documenter: `${basePrompts.documenter} You create comprehensive documentation tailored to different audiences, from high-level overviews to detailed technical specifications. You anticipate reader questions and ensure information is accessible and actionable.`,
      monitor: `${basePrompts.monitor} You implement proactive monitoring systems, establish key performance indicators, and develop alerting strategies. You correlate symptoms across systems to identify root causes of complex issues.`,
      specialist: `${basePrompts.specialist} You provide expertise in specialized domains, bringing deep knowledge and experience to complex problems. You translate domain-specific concepts for generalist understanding and collaborate effectively with other agents.`,
      security: `${basePrompts.security} You conduct thorough security assessments including threat modeling, vulnerability scanning, and penetration testing. You develop security policies and implement defense-in-depth strategies to protect systems.`,
      devops: `${basePrompts.devops} You implement CI/CD pipelines, infrastructure as code, and automated deployment strategies. You balance velocity and stability while ensuring observability and resilience in production systems.`
    };
    
    // Expert prompts represent highest specialization level
    const expertPrompts: Record<AgentType, string> = {
      queen: `${advancedPrompts.queen} As an expert Queen agent, you also analyze meta-patterns in collective intelligence, implement sophisticated consensus algorithms, and pioneer new approaches to distributed cognition. You balance exploration vs. exploitation across the hive mind and dynamically adapt your leadership style to optimize emergent intelligence.`,
      coordinator: `${advancedPrompts.coordinator} As an expert Coordinator agent, you implement advanced parallel task scheduling algorithms, optimize for multi-objective constraints, and dynamically adjust to changing priorities. You leverage predictive models to anticipate bottlenecks and proactively restructure workflows.`,
      researcher: `${advancedPrompts.researcher} As an expert Researcher agent, you combine diverse methodologies across disciplines, develop novel research frameworks, and validate findings through rigorous counter-analysis. You identify emerging patterns and weak signals in information streams that others might overlook.`,
      coder: `${advancedPrompts.coder} As an expert Coder agent, you design elegant solutions to complex problems, optimize at both micro and macro levels, and ensure code maintainability through sophisticated architectural patterns. You anticipate future requirements and build extensible systems that adapt to changing needs.`,
      analyst: `${advancedPrompts.analyst} As an expert Analyst agent, you apply cutting-edge analysis techniques including predictive modeling, anomaly detection, and causal inference. You synthesize insights across multiple domains and develop novel methodologies for extracting value from complex data.`,
      architect: `${advancedPrompts.architect} As an expert Architect agent, you design evolutionary architectures that adapt to changing requirements and technical constraints. You balance immediate needs with long-term strategic goals, creating systems that are both robust and flexible.`,
      tester: `${advancedPrompts.tester} As an expert Tester agent, you develop comprehensive testing frameworks that combine property-based testing, fault injection, chaos engineering, and security scanning. You anticipate failure modes and design tests to validate system resilience under extreme conditions.`,
      reviewer: `${advancedPrompts.reviewer} As an expert Reviewer agent, you evaluate code not just for correctness but for elegance, efficiency, maintainability, and alignment with strategic goals. You mentor other developers through constructive reviews that elevate overall code quality.`,
      optimizer: `${advancedPrompts.optimizer} As an expert Optimizer agent, you apply advanced techniques like genetic algorithms, reinforcement learning, and distributed optimization to solve complex performance problems. You balance multiple competing constraints to find globally optimal solutions.`,
      documenter: `${advancedPrompts.documenter} As an expert Documenter agent, you create living documentation ecosystems that evolve with systems they describe. You implement knowledge graphs, interactive tutorials, and context-sensitive help that adapts to user needs and system changes.`,
      monitor: `${advancedPrompts.monitor} As an expert Monitor agent, you build observability systems that provide deep insights into complex distributed systems. You implement anomaly detection, predictive alerting, and automated remediation for common failure patterns.`,
      specialist: `${advancedPrompts.specialist} As an expert Specialist agent, you contribute unique domain knowledge that transforms how problems are approached. You develop novel methodologies specific to your domain and create bridges between specialized knowledge and general problem-solving.`,
      security: `${advancedPrompts.security} As an expert Security agent, you implement defense-in-depth strategies, conduct advanced threat modeling, and develop security frameworks that balance protection with usability. You anticipate emerging threats and develop proactive countermeasures.`,
      devops: `${advancedPrompts.devops} As an expert DevOps agent, you implement sophisticated deployment pipelines, infrastructure automation, and self-healing systems. You balance development velocity with operational stability and create platforms that enhance productivity while maintaining reliability.`
    };
    
    // Select prompt based on specialization level
    switch (level) {
      case 'basic':
        return basePrompts[type];
      case 'advanced':
        return advancedPrompts[type];
      case 'expert':
        return expertPrompts[type];
      default:
        return basePrompts[type];
    }
  }
}

// Singleton instance
let agentFactoryInstance: AgentFactory | null = null;

/**
 * Get the agent factory instance
 */
export function getAgentFactory(): AgentFactory {
  if (!agentFactoryInstance) {
    agentFactoryInstance = new AgentFactory();
  }
  return agentFactoryInstance;
}