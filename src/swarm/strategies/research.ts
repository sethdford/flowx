/**
 * Optimized Research Strategy Implementation
 * Provides intelligent research capabilities with parallel processing,
 * semantic clustering, caching, and progressive refinement
 */

import { BaseStrategy, DecompositionResult, StrategyMetrics, TaskBatch, AgentAllocation } from "./base.ts";
import { Logger } from "../../core/logger.ts";
import { generateId } from "../../utils/helpers.ts";
import {
  SwarmObjective, TaskDefinition, TaskId, TaskType, TaskPriority,
  SwarmConfig, SWARM_CONSTANTS,
  AgentState, AgentId
} from "../types.ts";

// Research-specific interfaces
interface ResearchQuery {
  id: string;
  query: string;
  keywords: string[];
  domains: string[];
  priority: number;
  timestamp: Date;
  sources?: string[];
  filters?: ResearchFilters;
}

interface ResearchFilters {
  dateRange?: { start: Date; end: Date };
  sourceTypes?: ('academic' | 'news' | 'blog' | 'documentation' | 'forum')[];
  languages?: string[];
  credibilityThreshold?: number;
  maxResults?: number;
}

interface ResearchResult {
  id: string;
  queryId: string;
  url: string;
  title: string;
  content: string;
  summary: string;
  credibilityScore: number;
  relevanceScore: number;
  sourceType: string;
  publishedDate?: Date;
  extractedAt: Date;
  metadata: Record<string, any>;
  semanticVector?: number[];
}

interface ResearchCluster {
  id: string;
  topic: string;
  results: ResearchResult[];
  centroid: number[];
  coherenceScore: number;
  keywords: string[];
  summary: string;
}

interface CacheEntry {
  key: string;
  data: any;
  timestamp: Date;
  ttl: number;
  accessCount: number;
  lastAccessed: Date;
}

interface ConnectionPool {
  active: number;
  idle: number;
  max: number;
  timeout: number;
  connections: Map<string, any>;
}

interface RateLimiter {
  requests: number;
  windowStart: Date;
  windowSize: number;
  maxRequests: number;
  backoffMultiplier: number;
}

export class ResearchStrategy extends BaseStrategy {
  private logger: Logger;
  private researchCache: Map<string, CacheEntry> = new Map();
  private connectionPool: ConnectionPool;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private semanticModel: any; // Placeholder for semantic analysis
  private researchQueries: Map<string, ResearchQuery> = new Map();
  private researchResults: Map<string, ResearchResult> = new Map();
  private researchClusters: Map<string, ResearchCluster> = new Map();

  // Research-specific metrics extending base metrics
  private researchMetrics = {
    queriesExecuted: 0,
    resultsCollected: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    credibilityScores: [] as number[],
    clusteringAccuracy: 0,
    parallelEfficiency: 0
  };

  constructor(config: SwarmConfig) {
    super(config);
    
    this.logger = new Logger(
      { level: 'info', format: 'text', destination: 'console' },
      { component: 'ResearchStrategy' }
    );

    // Initialize connection pool
    this.connectionPool = {
      active: 0,
      idle: 0,
      max: config.performance?.maxConcurrency || 10,
      timeout: 30000,
      connections: new Map()
    };

    this.logger.info('ResearchStrategy initialized with optimizations', {
      maxConcurrency: this.connectionPool.max,
      cacheEnabled: config.performance?.cacheEnabled !== false
    });
  }

  async decomposeObjective(objective: SwarmObjective): Promise<DecompositionResult> {
    this.logger.info('Decomposing research objective', {
      objectiveId: objective.id,
      description: objective.description
    });

    const tasks: TaskDefinition[] = [];
    const dependencies = new Map<string, string[]>();
    
    // Extract research parameters from objective
    const researchParams = this.extractResearchParameters(objective.description);
    
    // Create research query planning task
    const queryPlanningTask = this.createResearchTask(
      'query-planning',
      'research',
      'Research Query Planning',
      `Analyze the research objective and create optimized search queries:

${objective.description}

Create a comprehensive research plan that includes:
1. Primary and secondary research questions
2. Key search terms and synonyms
3. Relevant domains and sources to explore
4. Research methodology and approach
5. Quality criteria for evaluating sources

Focus on creating queries that will yield high-quality, credible results.`,
      {
        priority: 'high' as TaskPriority,
        estimatedDuration: 5 * 60 * 1000, // 5 minutes
        requiredCapabilities: ['research', 'analysis'],
        researchParams
      }
    );
    tasks.push(queryPlanningTask);

    // Create parallel web search tasks
    const webSearchTask = this.createResearchTask(
      'web-search',
      'research',
      'Parallel Web Search Execution',
      `Execute parallel web searches based on the research plan:

${objective.description}

Perform comprehensive web searches using:
1. Multiple search engines and sources
2. Parallel query execution for efficiency
3. Intelligent source ranking and filtering
4. Real-time credibility assessment
5. Deduplication of results

Collect diverse, high-quality sources relevant to the research objective.`,
      {
        priority: 'high' as TaskPriority,
        estimatedDuration: 10 * 60 * 1000, // 10 minutes
        requiredCapabilities: ['research'],
        dependencies: [queryPlanningTask.id.id],
        researchParams
      }
    );
    tasks.push(webSearchTask);
    dependencies.set(webSearchTask.id.id, [queryPlanningTask.id.id]);

    // Create data extraction and processing task
    const dataExtractionTask = this.createResearchTask(
      'data-extraction',
      'analysis',
      'Parallel Data Extraction',
      `Extract and process data from collected sources:

${objective.description}

Process the collected sources by:
1. Extracting key information and insights
2. Performing semantic analysis and clustering
3. Identifying patterns and relationships
4. Assessing information quality and reliability
5. Creating structured summaries

Use parallel processing for efficient data extraction.`,
      {
        priority: 'high' as TaskPriority,
        estimatedDuration: 8 * 60 * 1000, // 8 minutes
        requiredCapabilities: ['analysis', 'research'],
        dependencies: [webSearchTask.id.id],
        researchParams
      }
    );
    tasks.push(dataExtractionTask);
    dependencies.set(dataExtractionTask.id.id, [webSearchTask.id.id]);

    // Create semantic clustering task
    const clusteringTask = this.createResearchTask(
      'semantic-clustering',
      'analysis',
      'Semantic Clustering and Analysis',
      `Perform semantic clustering of research findings:

${objective.description}

Analyze the extracted data by:
1. Grouping related information using semantic similarity
2. Identifying key themes and topics
3. Creating coherent clusters of information
4. Generating cluster summaries and insights
5. Mapping relationships between clusters

Provide a structured analysis of the research findings.`,
      {
        priority: 'normal' as TaskPriority,
        estimatedDuration: 6 * 60 * 1000, // 6 minutes
        requiredCapabilities: ['analysis', 'research'],
        dependencies: [dataExtractionTask.id.id],
        researchParams
      }
    );
    tasks.push(clusteringTask);
    dependencies.set(clusteringTask.id.id, [dataExtractionTask.id.id]);

    // Create synthesis and reporting task
    const synthesisTask = this.createResearchTask(
      'synthesis-reporting',
      'documentation',
      'Research Synthesis and Reporting',
      `Synthesize research findings into comprehensive report:

${objective.description}

Create a comprehensive research report that includes:
1. Executive summary of key findings
2. Detailed analysis of each research cluster
3. Insights and recommendations
4. Source credibility assessment
5. Methodology and limitations
6. References and citations

Ensure the report is well-structured and actionable.`,
      {
        priority: 'normal' as TaskPriority,
        estimatedDuration: 7 * 60 * 1000, // 7 minutes
        requiredCapabilities: ['documentation', 'analysis'],
        dependencies: [clusteringTask.id.id],
        researchParams
      }
    );
    tasks.push(synthesisTask);
    dependencies.set(synthesisTask.id.id, [clusteringTask.id.id]);

    // Calculate total estimated duration
    const totalDuration = tasks.reduce((sum, task) => 
      sum + (task.requirements.estimatedDuration || 0), 0);

    // Create task batches for parallel execution
    const batchGroups: TaskBatch[] = [
      {
        id: 'research-planning-batch',
        tasks: [queryPlanningTask],
        canRunInParallel: false,
        estimatedDuration: queryPlanningTask.requirements.estimatedDuration || 0,
        requiredResources: { cpu: 1, memory: 512 }
      },
      {
        id: 'data-collection-batch',
        tasks: [webSearchTask],
        canRunInParallel: true,
        estimatedDuration: webSearchTask.requirements.estimatedDuration || 0,
        requiredResources: { cpu: 2, memory: 1024, network: 1 }
      },
      {
        id: 'analysis-batch',
        tasks: [dataExtractionTask, clusteringTask],
        canRunInParallel: true,
        estimatedDuration: Math.max(
          dataExtractionTask.requirements.estimatedDuration || 0,
          clusteringTask.requirements.estimatedDuration || 0
        ),
        requiredResources: { cpu: 2, memory: 2048 }
      },
      {
        id: 'synthesis-batch',
        tasks: [synthesisTask],
        canRunInParallel: false,
        estimatedDuration: synthesisTask.requirements.estimatedDuration || 0,
        requiredResources: { cpu: 1, memory: 1024 }
      }
    ];

    return {
      tasks,
      dependencies,
      estimatedDuration: totalDuration,
      recommendedStrategy: 'research',
      complexity: this.estimateComplexity(objective.description),
      batchGroups
    };
  }

  async selectAgentForTask(task: TaskDefinition, availableAgents: AgentState[]): Promise<string | null> {
    this.logger.debug('Selecting agent for research task', {
      taskId: task.id.id,
      taskType: task.type,
      availableAgents: availableAgents.length
    });

    // Filter agents by required capabilities
    const capableAgents = availableAgents.filter(agent => {
      const hasCapabilities = task.requirements.capabilities.every(cap => 
        agent.capabilities.domains.includes(cap) || 
        agent.capabilities.tools.includes(cap)
      );
      
      const hasAvailability = agent.workload < 0.8; // Less than 80% workload
      const isHealthy = agent.health > 0.7; // Health above 70%
      
      return hasCapabilities && hasAvailability && isHealthy;
    });

    if (capableAgents.length === 0) {
      this.logger.warn('No capable agents found for task', { taskId: task.id.id });
      return null;
    }

    // Score agents based on research-specific criteria
    const scoredAgents = capableAgents.map(agent => {
      let score = 0;
      
      // Base capability score
      score += agent.capabilities.reliability * 0.3;
      score += agent.capabilities.quality * 0.3;
      score += (1 - agent.workload) * 0.2; // Prefer less busy agents
      
      // Research-specific bonuses
      if (agent.type === 'researcher' && task.type === 'research') score += 0.3;
      if (agent.type === 'analyzer' && task.type === 'analysis') score += 0.3;
      if (agent.type === 'documenter' && task.type === 'documentation') score += 0.3;
      
      // Performance bonuses
      if (agent.metrics.successRate > 0.9) score += 0.1;
      if (agent.capabilities.research && task.type === 'research') score += 0.2;
      
      return { agent, score };
    });

    // Sort by score and select the best agent
    scoredAgents.sort((a, b) => b.score - a.score);
    const selectedAgent = scoredAgents[0].agent;
    
    this.logger.info('Selected agent for research task', {
      taskId: task.id.id,
      agentId: selectedAgent.id.id,
      agentType: selectedAgent.type,
      score: scoredAgents[0].score
    });

    return selectedAgent.id.id;
  }

  async optimizeTaskSchedule(tasks: TaskDefinition[], agents: AgentState[]): Promise<AgentAllocation[]> {
    this.logger.info('Optimizing research task schedule', {
      taskCount: tasks.length,
      agentCount: agents.length
    });

    const allocations: AgentAllocation[] = [];
    const taskQueue = [...tasks].sort((a, b) => {
      // Sort by priority first, then by dependencies
      const priorityOrder = { 'critical': 4, 'high': 3, 'normal': 2, 'low': 1, 'background': 0 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Prefer tasks with fewer dependencies
      return a.constraints.dependencies.length - b.constraints.dependencies.length;
    });

    // Create agent workload tracking
    const agentWorkloads = new Map<string, number>();
    agents.forEach(agent => {
      agentWorkloads.set(agent.id.id, agent.workload);
    });

    // Allocate tasks to agents
    for (const task of taskQueue) {
      const selectedAgentId = await this.selectAgentForTask(task, agents);
      
      if (selectedAgentId) {
        // Find existing allocation or create new one
        let allocation = allocations.find(a => a.agentId === selectedAgentId);
        if (!allocation) {
          const agent = agents.find(a => a.id.id === selectedAgentId)!;
          allocation = {
            agentId: selectedAgentId,
            tasks: [],
            estimatedWorkload: agentWorkloads.get(selectedAgentId) || 0,
            capabilities: agent.capabilities.domains
          };
          allocations.push(allocation);
        }
        
        // Add task to allocation
        allocation.tasks.push(task.id.id);
        
        // Update estimated workload
        const taskWorkload = (task.requirements.estimatedDuration || 0) / (60 * 60 * 1000); // Convert to hours
        allocation.estimatedWorkload += taskWorkload * 0.1; // 10% workload per hour
        agentWorkloads.set(selectedAgentId, allocation.estimatedWorkload);
      } else {
        this.logger.warn('Could not allocate task to any agent', { taskId: task.id.id });
      }
    }

    this.logger.info('Task schedule optimization completed', {
      allocations: allocations.length,
      totalTasks: tasks.length,
      unallocatedTasks: tasks.length - allocations.reduce((sum, a) => sum + a.tasks.length, 0)
    });

    return allocations;
  }

  // Research-specific optimizations for task execution
  async optimizeTaskExecution(task: TaskDefinition, agent: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Apply research-specific optimizations based on task type
      switch (task.type) {
        case 'research':
          return await this.executeOptimizedWebSearch(task, agent);
        case 'analysis':
          return await this.executeOptimizedClustering(task, agent);
        default:
          return await this.executeGenericResearchTask(task, agent);
      }
    } finally {
      const duration = Date.now() - startTime;
      this.updateResearchMetrics(task.type, duration);
    }
  }

  private async executeOptimizedWebSearch(task: TaskDefinition, agent: any): Promise<any> {
    this.logger.info('Executing optimized web search', { taskId: task.id.id });

    // Check cache first
    const cacheKey = this.generateCacheKey('web-search', task.description);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.researchMetrics.cacheHits++;
      return cached;
    }

    // Execute parallel web searches with rate limiting
    const queries = this.generateSearchQueries(task.description);
    const searchPromises = queries.map(query => 
      this.executeRateLimitedSearch(query, agent)
    );

    const results = await Promise.allSettled(searchPromises);
    const successfulResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value)
      .flat();

    // Rank and filter results by credibility
    const rankedResults = await this.rankResultsByCredibility(successfulResults);
    
    // Cache results
    this.setCache(cacheKey, rankedResults, 3600000); // 1 hour TTL
    this.researchMetrics.cacheMisses++;

    return {
      results: rankedResults,
      totalFound: successfulResults.length,
      queriesExecuted: queries.length,
      credibilityScores: rankedResults.map(r => r.credibilityScore)
    };
  }

  private async executeOptimizedDataExtraction(task: TaskDefinition, agent: any): Promise<any> {
    this.logger.info('Executing optimized data extraction', { taskId: task.id.id });

    // Get connection from pool
    const connection = await this.getPooledConnection();
    
    try {
      // Parallel data extraction with deduplication
      const extractionPromises = this.createParallelExtractionTasks(task, agent);
      const extractedData = await Promise.all(extractionPromises);
      
      // Deduplicate results
      const deduplicatedData = this.deduplicateResults(extractedData.flat());
      
      return {
        extractedData: deduplicatedData,
        totalExtracted: extractedData.flat().length,
        uniqueResults: deduplicatedData.length,
        deduplicationRate: 1 - (deduplicatedData.length / extractedData.flat().length)
      };
    } finally {
      this.releasePooledConnection(connection);
    }
  }

  private async executeOptimizedClustering(task: TaskDefinition, agent: any): Promise<any> {
    this.logger.info('Executing optimized semantic clustering', { taskId: task.id.id });

    // Implement semantic clustering with caching
    const data = task.input?.extractedData || [];
    const cacheKey = this.generateCacheKey('clustering', JSON.stringify(data));
    
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Perform semantic clustering
    const clusters = await this.performSemanticClustering(data);
    
    // Cache clustering results
    this.setCache(cacheKey, clusters, 7200000); // 2 hours TTL

    return {
      clusters,
      clusterCount: clusters.length,
      averageClusterSize: clusters.reduce((sum, c) => sum + c.results.length, 0) / clusters.length,
      coherenceScore: clusters.reduce((sum, c) => sum + c.coherenceScore, 0) / clusters.length
    };
  }

  private async executeGenericResearchTask(task: TaskDefinition, agent: any): Promise<any> {
    this.logger.info('Executing generic research task', { taskId: task.id.id });

    // Apply general research optimizations
    return {
      status: 'completed',
      optimizations: ['caching', 'rate-limiting', 'connection-pooling'],
      executionTime: Date.now()
    };
  }

  // Helper methods for research optimizations

  private extractResearchParameters(description: string): any {
    return {
      domains: this.extractDomains(description),
      keywords: this.extractKeywords(description),
      timeframe: this.extractTimeframe(description),
      sourceTypes: this.extractSourceTypes(description)
    };
  }

  private extractDomains(description: string): string[] {
    // Extract relevant domains from description
    const domains = [];
    if (description.includes('academic') || description.includes('research')) domains.push('academic');
    if (description.includes('news') || description.includes('current')) domains.push('news');
    if (description.includes('technical') || description.includes('documentation')) domains.push('technical');
    return domains.length > 0 ? domains : ['general'];
  }

  private extractKeywords(description: string): string[] {
    // Simple keyword extraction - in production, use NLP
    return description
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }

  private extractTimeframe(description: string): any {
    // Extract time-related constraints
    const now = new Date();
    return {
      start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      end: now
    };
  }

  private extractSourceTypes(description: string): string[] {
    return ['academic', 'news', 'documentation', 'blog'];
  }

  private generateSearchQueries(description: string): ResearchQuery[] {
    const baseQuery = description.substring(0, 100);
    const keywords = this.extractKeywords(description);
    
    return [
      {
        id: generateId('query'),
        query: baseQuery,
        keywords: keywords.slice(0, 5),
        domains: ['general'],
        priority: 1,
        timestamp: new Date()
      },
      {
        id: generateId('query'),
        query: `${baseQuery} research study`,
        keywords: [...keywords.slice(0, 3), 'research', 'study'],
        domains: ['academic'],
        priority: 2,
        timestamp: new Date()
      },
      {
        id: generateId('query'),
        query: `${baseQuery} best practices`,
        keywords: [...keywords.slice(0, 3), 'best', 'practices'],
        domains: ['technical'],
        priority: 2,
        timestamp: new Date()
      }
    ];
  }

  private async executeRateLimitedSearch(query: ResearchQuery, agent: any): Promise<ResearchResult[]> {
    const domain = query.domains[0] || 'general';
    
    // Check rate limits
    if (!this.checkRateLimit(domain)) {
      await this.waitForRateLimit(domain);
    }

    // Simulate web search with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // Simulate search execution
        const results = await this.simulateWebSearch(query);
        this.updateRateLimit(domain);
        return results;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
        await this.exponentialBackoff(attempts);
      }
    }
    
    return [];
  }

  private async simulateWebSearch(query: ResearchQuery): Promise<ResearchResult[]> {
    // Simulate web search results
    const resultCount = Math.floor(Math.random() * 10) + 5;
    const results: ResearchResult[] = [];
    
    for (let i = 0; i < resultCount; i++) {
      results.push({
        id: generateId('result'),
        queryId: query.id,
        url: `https://example.com/result-${i}`,
        title: `Research Result ${i} for ${query.query}`,
        content: `Content for ${query.query} - result ${i}`,
        summary: `Summary of result ${i}`,
        credibilityScore: Math.random() * 0.4 + 0.6, // 0.6-1.0
        relevanceScore: Math.random() * 0.3 + 0.7, // 0.7-1.0
        sourceType: query.domains[0] || 'general',
        extractedAt: new Date(),
        metadata: { queryKeywords: query.keywords }
      });
    }
    
    return results;
  }

  private async rankResultsByCredibility(results: ResearchResult[]): Promise<ResearchResult[]> {
    // Sort by combined credibility and relevance score
    return results.sort((a, b) => {
      const scoreA = (a.credibilityScore * 0.6) + (a.relevanceScore * 0.4);
      const scoreB = (b.credibilityScore * 0.6) + (b.relevanceScore * 0.4);
      return scoreB - scoreA;
    });
  }

  private createParallelExtractionTasks(task: TaskDefinition, agent: any): Promise<any>[] {
    // Create parallel extraction tasks
    const results = task.input?.results || [];
    const batchSize = Math.ceil(results.length / this.connectionPool.max);
    const batches = [];
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      batches.push(this.extractDataFromBatch(batch));
    }
    
    return batches;
  }

  private async extractDataFromBatch(batch: ResearchResult[]): Promise<any[]> {
    // Simulate parallel data extraction
    return batch.map(result => ({
      id: result.id,
      extractedData: `Extracted data from ${result.title}`,
      insights: [`Insight 1 from ${result.title}`, `Insight 2 from ${result.title}`],
      metadata: result.metadata
    }));
  }

  private deduplicateResults(results: any[]): any[] {
    const seen = new Set();
    return results.filter(result => {
      const key = result.extractedData || result.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async performSemanticClustering(data: any[]): Promise<ResearchCluster[]> {
    // Simulate semantic clustering
    const clusterCount = Math.min(Math.ceil(data.length / 5), 10);
    const clusters: ResearchCluster[] = [];
    
    for (let i = 0; i < clusterCount; i++) {
      const clusterData = data.slice(i * 5, (i + 1) * 5);
      clusters.push({
        id: generateId('cluster'),
        topic: `Research Topic ${i + 1}`,
        results: clusterData,
        centroid: Array(10).fill(0).map(() => Math.random()),
        coherenceScore: Math.random() * 0.3 + 0.7,
        keywords: [`keyword${i}1`, `keyword${i}2`],
        summary: `Summary of cluster ${i + 1}`
      });
    }
    
    return clusters;
  }

  // Connection pooling methods
  private async getPooledConnection(): Promise<any> {
    if (this.connectionPool.active >= this.connectionPool.max) {
      await this.waitForConnection();
    }
    
    this.connectionPool.active++;
    return { id: generateId('connection'), timestamp: new Date() };
  }

  private releasePooledConnection(connection: any): void {
    this.connectionPool.active--;
    this.connectionPool.idle++;
  }

  private async waitForConnection(): Promise<void> {
    return new Promise(resolve => {
      const checkConnection = () => {
        if (this.connectionPool.active < this.connectionPool.max) {
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    });
  }

  // Rate limiting methods
  private checkRateLimit(domain: string): boolean {
    const limiter = this.rateLimiters.get(domain);
    if (!limiter) {
      this.rateLimiters.set(domain, {
        requests: 0,
        windowStart: new Date(),
        windowSize: 60000, // 1 minute
        maxRequests: 10,
        backoffMultiplier: 1
      });
      return true;
    }

    const now = new Date();
    if (now.getTime() - limiter.windowStart.getTime() > limiter.windowSize) {
      limiter.requests = 0;
      limiter.windowStart = now;
    }

    return limiter.requests < limiter.maxRequests;
  }

  private updateRateLimit(domain: string): void {
    const limiter = this.rateLimiters.get(domain);
    if (limiter) {
      limiter.requests++;
    }
  }

  private async waitForRateLimit(domain: string): Promise<void> {
    const limiter = this.rateLimiters.get(domain);
    if (!limiter) return;

    const waitTime = limiter.windowSize * limiter.backoffMultiplier;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  private async exponentialBackoff(attempt: number): Promise<void> {
    const delay = Math.pow(2, attempt) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Caching methods
  private generateCacheKey(type: string, data: string): string {
    // Simple hash function instead of Buffer
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${type}:${Math.abs(hash).toString(36).substring(0, 16)}`;
  }

  private getFromCache(key: string): any | null {
    const entry = this.researchCache.get(key);
    if (!entry) return null;

    const now = new Date();
    if (now.getTime() - entry.timestamp.getTime() > entry.ttl) {
      this.researchCache.delete(key);
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = now;
    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.researchCache.set(key, {
      key,
      data,
      timestamp: new Date(),
      ttl,
      accessCount: 0,
      lastAccessed: new Date()
    });

    // Cleanup old entries if cache is too large
    if (this.researchCache.size > 1000) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const entries = Array.from(this.researchCache.entries());
    entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.researchCache.delete(entries[i][0]);
    }
  }

  private createResearchTask(
    id: string,
    type: TaskType,
    name: string,
    instructions: string,
    options: any = {}
  ): TaskDefinition {
    const taskId: TaskId = {
      id: generateId('task'),
      swarmId: 'research-swarm',
      sequence: 1,
      priority: 1
    };

    return {
      id: taskId,
      type,
      name,
      description: instructions,
      instructions,
      requirements: {
        capabilities: options.requiredCapabilities || ['research'],
        tools: ['WebFetchTool', 'WebSearch'],
        permissions: ['read', 'write']
      },
      constraints: {
        dependencies: options.dependencies || [],
        dependents: [],
        conflicts: [],
        maxRetries: 3,
        timeoutAfter: options.estimatedDuration || 300000
      },
      priority: options.priority || 'medium',
      input: options.researchParams || {},
      context: {},
      examples: [],
      status: 'created',
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: [],
      statusHistory: [{
        timestamp: new Date(),
        from: 'created',
        to: 'created',
        reason: 'Task created',
        triggeredBy: 'system'
      }]
    };
  }

  private updateResearchMetrics(taskType: string, duration: number): void {
    this.researchMetrics.queriesExecuted++;
    this.researchMetrics.averageResponseTime = 
      (this.researchMetrics.averageResponseTime + duration) / 2;
  }

  // Public API for metrics
  override getMetrics(): StrategyMetrics {
    return {
      ...this.metrics,
      // Add research-specific metrics as extensions
      cacheHitRate: this.researchMetrics.cacheHits > 0 
        ? this.researchMetrics.cacheHits / (this.researchMetrics.cacheHits + this.researchMetrics.cacheMisses)
        : 0
    };
  }

  // Get research-specific metrics
  getResearchMetrics() {
    return {
      ...this.researchMetrics,
      cacheHitRate: this.researchMetrics.cacheHits > 0 
        ? this.researchMetrics.cacheHits / (this.researchMetrics.cacheHits + this.researchMetrics.cacheMisses)
        : 0,
      averageCredibilityScore: this.researchMetrics.credibilityScores.length > 0 
        ? this.researchMetrics.credibilityScores.reduce((a, b) => a + b, 0) / this.researchMetrics.credibilityScores.length 
        : 0,
      connectionPoolUtilization: this.connectionPool.active / this.connectionPool.max,
      cacheSize: this.researchCache.size
    };
  }

  // Progressive refinement methods
  async refineResearchScope(objective: SwarmObjective, intermediateResults: any[]): Promise<SwarmObjective> {
    this.logger.info('Refining research scope based on intermediate results', {
      objectiveId: objective.id,
      resultsCount: intermediateResults.length
    });

    // Analyze intermediate results to refine scope
    const refinedObjective = { ...objective };
    
    // Update requirements based on findings
    if (intermediateResults.length > 0) {
      const avgCredibility = intermediateResults
        .map(r => r.credibilityScore || 0.5)
        .reduce((a, b) => a + b, 0) / intermediateResults.length;
      
      if (avgCredibility < 0.7) {
        refinedObjective.requirements.qualityThreshold = Math.max(
          refinedObjective.requirements.qualityThreshold,
          0.8
        );
      }
    }

    return refinedObjective;
  }
}