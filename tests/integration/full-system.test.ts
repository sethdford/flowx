/**
 * Full system integration tests
 * Tests the complete Claude-Flow system with all components working together
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  assertEquals,
  assertExists,
  assertRejects,
  spy,
} from '../test.utils.ts';
import { Orchestrator } from '../../src/core/orchestrator.ts';
import { TerminalManager } from '../../src/terminal/manager.ts';
import eventBus, { EventBus } from '../../src/core/event-bus.ts';
import { Logger } from '../../src/core/logger.ts';
import { ConfigManager } from '../../src/core/config.ts';
import {
  MockMemoryManager,
  MockCoordinationManager,
  MockMCPServer,
  MockMCPTransport,
} from '../mocks/index.ts';
import {
  Config,
  AgentProfile,
  Task,
  TaskStatus,
  MCPTool,
  MCPContext,
  MCPToolCall,
} from '../../src/utils/types.ts';
import { cleanupTestEnv, setupTestEnv } from '../test.config.ts';
import { generateId, delay } from '../../src/utils/helpers.ts';

describe('Full System Integration', () => {
  let orchestrator: Orchestrator;
  let terminalManager: TerminalManager;
  let eventBus: EventBus;
  let logger: Logger;
  let configManager: ConfigManager;
  let memoryManager: MockMemoryManager;
  let coordinationManager: MockCoordinationManager;
  let mcpServer: MockMCPServer;
  let config: Config;

  beforeEach(async () => {
    setupTestEnv();

    // Initialize configuration
    configManager = ConfigManager.getInstance();
    config = await configManager.load();

    // Override with test-specific settings
    config.orchestrator.maxConcurrentAgents = 3;
    config.terminal.poolSize = 3;
    config.memory.backend = 'sqlite';
    config.mcp.transport = 'stdio';
    config.logging.level = 'debug';

    // Initialize core components
    EventBus.reset();
    eventBus = EventBus.getInstance();
    logger = new Logger(config.logging);
    memoryManager = new MockMemoryManager();
    coordinationManager = new MockCoordinationManager();
    terminalManager = new TerminalManager(config.terminal, eventBus, logger);

    // Initialize MCP server
    const mcpTransport = new MockMCPTransport();
    mcpServer = new MockMCPServer(mcpTransport, logger);

    // Initialize orchestrator with all components
    orchestrator = new Orchestrator(
      config,
      eventBus,
      logger,
      terminalManager,
      memoryManager,
      coordinationManager
    );

    await orchestrator.initialize();
    await mcpServer.initialize();
  });

  afterEach(async () => {
    await orchestrator.shutdown();
    await mcpServer.shutdown();
    await cleanupTestEnv();
  });

  describe('complete workflow scenarios', () => {
    it('should execute a complete research and implementation workflow', async () => {
      // Register MCP tools for different agent types
      const researchTool: MCPTool = {
        name: 'research_topic',
        description: 'Research a specific topic',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            depth: { type: 'string', enum: ['basic', 'detailed'], default: 'basic' },
          },
          required: ['topic'],
        },
        handler: async (input: any, context?: MCPContext) => {
          const findings = input.depth === 'detailed' 
            ? `Detailed research findings on ${input.topic}: In-depth analysis shows...`
            : `Basic research on ${input.topic}: Overview indicates...`;

          // Store research in memory
          if (context?.agentId) {
            await memoryManager.storeEntry({
              id: generateId('memory'),
              agentId: context.agentId,
              sessionId: context.sessionId,
              type: 'insight',
              content: findings,
              context: { topic: input.topic, depth: input.depth },
              timestamp: new Date(),
              tags: ['research', input.topic],
              version: 1,
            });
          }

          return {
            content: [{
              type: 'text',
              text: findings,
            }],
          };
        },
      };

      const implementTool: MCPTool = {
        name: 'implement_solution',
        description: 'Implement a solution based on research',
        inputSchema: {
          type: 'object',
          properties: {
            solution: { type: 'string' },
            language: { type: 'string' },
            research_id: { type: 'string' },
          },
          required: ['solution', 'language'],
        },
        handler: async (input: any, context?: MCPContext) => {
          // Retrieve research from memory if provided
          let researchContext = '';
          if (input.research_id && context?.sessionId) {
            const researchEntries = await memoryManager.queryEntries({
              sessionId: context.sessionId,
              type: 'insight',
              tags: ['research'],
            });
            
            if (researchEntries.length > 0) {
              researchContext = `Based on research: ${researchEntries[0].content}`;
            }
          }

          const implementation = `
${researchContext}

Implementation in ${input.language}:
// ${input.solution}
function solution() {
  console.log("Implementing: ${input.solution}");
}
`;

          // Store implementation artifact
          if (context?.agentId) {
            await memoryManager.storeEntry({
              id: generateId('memory'),
              agentId: context.agentId,
              sessionId: context.sessionId,
              type: 'artifact',
              content: implementation,
              context: { 
                language: input.language,
                solution: input.solution,
                research_id: input.research_id,
              },
              timestamp: new Date(),
              tags: ['implementation', input.language],
              version: 1,
            });
          }

          return {
            content: [{
              type: 'text',
              text: implementation,
            }],
          };
        },
      };

      await mcpServer.registerTool(researchTool);
      await mcpServer.registerTool(implementTool);

      // Create agent profiles
      const researcherProfile: AgentProfile = {
        id: 'researcher-agent',
        name: 'Research Specialist',
        type: 'researcher',
        capabilities: ['research_topic', 'analysis'],
        systemPrompt: 'You are an expert researcher',
        maxConcurrentTasks: 2,
        priority: 1,
      };

      const implementerProfile: AgentProfile = {
        id: 'implementer-agent',
        name: 'Implementation Specialist',
        type: 'implementer',
        capabilities: ['implement_solution', 'terminal', 'coding'],
        systemPrompt: 'You are an expert implementer',
        maxConcurrentTasks: 2,
        priority: 2,
      };

      // Spawn agents
      const researcherSession = await orchestrator.spawnAgent(researcherProfile);
      const implementerSession = await orchestrator.spawnAgent(implementerProfile);

      // Step 1: Research task
      const researchTask: Task = {
        id: 'research-task',
        type: 'mcp-tool-call',
        description: 'Research best practices for Deno applications',
        priority: 1,
        dependencies: [],
        status: 'pending' as TaskStatus,
        input: {
          tool: 'research_topic',
          arguments: {
            topic: 'Deno best practices',
            depth: 'detailed',
          },
          agentId: researcherProfile.id,
        },
        createdAt: new Date(),
      };

      const researchResult = await orchestrator.executeTask(researchTask);
      assertEquals(researchResult.status, 'completed');
      assertExists(researchResult.output);

      // Step 2: Implementation task (depends on research)
      const implementTask: Task = {
        id: 'implement-task',
        type: 'mcp-tool-call',
        description: 'Implement Deno application based on research',
        priority: 2,
        dependencies: ['research-task'],
        status: 'pending' as TaskStatus,
        input: {
          tool: 'implement_solution',
          arguments: {
            solution: 'Deno web server with best practices',
            language: 'TypeScript',
            research_id: researchTask.id,
          },
          agentId: implementerProfile.id,
        },
        createdAt: new Date(),
      };

      const implementResult = await orchestrator.executeTask(implementTask);
      assertEquals(implementResult.status, 'completed');
      assertExists(implementResult.output);

      // Verify memory contains both research and implementation
      const allMemories = await memoryManager.queryEntries({
        limit: 10,
      });

      const researchMemories = allMemories.filter(m => 
        m.type === 'insight' && m.tags.includes('research')
      );
      const implementMemories = allMemories.filter(m => 
        m.type === 'artifact' && m.tags.includes('implementation')
      );

      assertEquals(researchMemories.length, 1);
      assertEquals(implementMemories.length, 1);
      assertEquals(researchMemories[0].agentId, researcherProfile.id);
      assertEquals(implementMemories[0].agentId, implementerProfile.id);
    });

    it('should handle complex multi-agent coordination scenario', async () => {
      // Register coordination tools
      const coordinationTool: MCPTool = {
        name: 'coordinate_task',
        description: 'Coordinate task assignment between agents',
        inputSchema: {
          type: 'object',
          properties: {
            task_type: { type: 'string' },
            target_agent: { type: 'string' },
            priority: { type: 'number' },
          },
          required: ['task_type', 'target_agent'],
        },
        handler: async (input: any, context?: MCPContext) => {
          // Use coordination manager to send message
          if (context?.agentId) {
            await coordinationManager.sendMessage(
              context.agentId,
              input.target_agent,
              {
                id: generateId('message'),
                type: 'task-assignment',
                payload: {
                  taskType: input.task_type,
                  priority: input.priority || 1,
                },
                timestamp: new Date(),
                priority: input.priority || 1,
              }
            );
          }

          return {
            content: [{
              type: 'text',
              text: `Coordinated ${input.task_type} task with ${input.target_agent}`,
            }],
          };
        },
      };

      const statusTool: MCPTool = {
        name: 'report_status',
        description: 'Report agent status and progress',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            progress: { type: 'number', minimum: 0, maximum: 100 },
            details: { type: 'string' },
          },
          required: ['status', 'progress'],
        },
        handler: async (input: any, context?: MCPContext) => {
          // Store status in memory
          if (context?.agentId) {
            await memoryManager.storeEntry({
              id: generateId('memory'),
              agentId: context.agentId,
              sessionId: context.sessionId,
              type: 'observation',
              content: `Status: ${input.status} (${input.progress}%)`,
              context: {
                status: input.status,
                progress: input.progress,
                details: input.details,
              },
              timestamp: new Date(),
              tags: ['status', 'progress'],
              version: 1,
            });
          }

          return {
            content: [{
              type: 'text',
              text: `Status reported: ${input.status} - ${input.progress}% complete`,
            }],
          };
        },
      };

      await mcpServer.registerTool(coordinationTool);
      await mcpServer.registerTool(statusTool);

      // Create multiple agent profiles
      const coordinatorProfile: AgentProfile = {
        id: 'coordinator',
        name: 'Project Coordinator',
        type: 'coordinator',
        capabilities: ['coordinate_task', 'planning'],
        systemPrompt: 'You coordinate project tasks',
        maxConcurrentTasks: 5,
        priority: 1,
      };

      const workerProfiles = Array.from({ length: 3 }, (_, i) => ({
        id: `worker-${i + 1}`,
        name: `Worker Agent ${i + 1}`,
        type: 'implementer' as const,
        capabilities: ['report_status', 'execute'],
        systemPrompt: `You are worker agent ${i + 1}`,
        maxConcurrentTasks: 2,
        priority: 3,
      }));

      // Spawn all agents
      const coordinatorSession = await orchestrator.spawnAgent(coordinatorProfile);
      const workerSessions = await Promise.all(
        workerProfiles.map(profile => orchestrator.spawnAgent(profile))
      );

      // Coordinator assigns tasks to workers
      const coordinationTasks = workerProfiles.map((worker, index) => ({
        id: `coordination-${index}`,
        type: 'mcp-tool-call',
        description: `Assign task to ${worker.id}`,
        priority: 1,
        dependencies: [],
        status: 'pending' as TaskStatus,
        input: {
          tool: 'coordinate_task',
          arguments: {
            task_type: `subtask-${index + 1}`,
            target_agent: worker.id,
            priority: index + 1,
          },
          agentId: coordinatorProfile.id,
        },
        createdAt: new Date(),
      }));

      // Execute coordination tasks
      const coordinationResults = await Promise.all(
        coordinationTasks.map(task => orchestrator.executeTask(task))
      );

      // All coordination tasks should complete
      coordinationResults.forEach(result => {
        assertEquals(result.status, 'completed');
      });

      // Workers report their status
      const statusTasks = workerProfiles.map((worker, index) => ({
        id: `status-${index}`,
        type: 'mcp-tool-call',
        description: `${worker.id} reports status`,
        priority: 2,
        dependencies: [`coordination-${index}`],
        status: 'pending' as TaskStatus,
        input: {
          tool: 'report_status',
          arguments: {
            status: 'working',
            progress: (index + 1) * 25,
            details: `Working on subtask-${index + 1}`,
          },
          agentId: worker.id,
        },
        createdAt: new Date(),
      }));

      const statusResults = await Promise.all(
        statusTasks.map(task => orchestrator.executeTask(task))
      );

      // All status reports should complete
      statusResults.forEach(result => {
        assertEquals(result.status, 'completed');
      });

      // Verify coordination messages were sent
      assertEquals(coordinationManager.sendMessage.calls.length, 3);

      // Verify status was stored in memory
      const statusMemories = await memoryManager.queryEntries({
        tags: ['status'],
        limit: 10,
      });

      assertEquals(statusMemories.length, 3);
      statusMemories.forEach((memory, index) => {
        assertEquals(memory.agentId, `worker-${index + 1}`);
        assertEquals(memory.context.progress, (index + 1) * 25);
      });
    });

    it('should handle system stress and recovery', async () => {
      // Register a resource-intensive tool
      const heavyTool: MCPTool = {
        name: 'heavy_computation',
        description: 'Performs heavy computation',
        inputSchema: {
          type: 'object',
          properties: {
            iterations: { type: 'number', default: 1000 },
            delay_ms: { type: 'number', default: 100 },
          },
        },
        handler: async (input: any, context?: MCPContext) => {
          const { iterations = 1000, delay_ms = 100 } = input;
          
          // Simulate heavy computation
          for (let i = 0; i < iterations; i++) {
            if (i % 100 === 0) {
              await delay(delay_ms / 10); // Small delays to simulate work
            }
          }

          return {
            content: [{
              type: 'text',
              text: `Completed ${iterations} iterations`,
            }],
          };
        },
      };

      await mcpServer.registerTool(heavyTool);

      // Create multiple agents for stress testing
      const stressAgents = Array.from({ length: 5 }, (_, i) => ({
        id: `stress-agent-${i}`,
        name: `Stress Test Agent ${i}`,
        type: 'implementer' as const,
        capabilities: ['heavy_computation'],
        systemPrompt: 'You perform heavy computations',
        maxConcurrentTasks: 1,
        priority: 1,
      }));

      // Spawn agents
      const stressSessions = await Promise.all(
        stressAgents.map(agent => orchestrator.spawnAgent(agent))
      );

      assertEquals(stressSessions.length, 5);

      // Create many concurrent heavy tasks
      const heavyTasks = stressAgents.flatMap((agent, agentIndex) =>
        Array.from({ length: 3 }, (_, taskIndex) => ({
          id: `heavy-${agentIndex}-${taskIndex}`,
          type: 'mcp-tool-call',
          description: `Heavy task ${agentIndex}-${taskIndex}`,
          priority: 1,
          dependencies: [],
          status: 'pending' as TaskStatus,
          input: {
            tool: 'heavy_computation',
            arguments: {
              iterations: 500, // Smaller iterations for faster testing
              delay_ms: 50,
            },
            agentId: agent.id,
          },
          createdAt: new Date(),
        }))
      );

      // Execute all heavy tasks concurrently
      const startTime = Date.now();
      const results = await Promise.all(
        heavyTasks.map(task => orchestrator.executeTask(task))
      );
      const duration = Date.now() - startTime;

      // Verify all tasks completed
      assertEquals(results.length, 15); // 5 agents × 3 tasks
      results.forEach(result => {
        assertEquals(result.status, 'completed');
      });

      // System should handle the load reasonably well
      assertEquals(duration < 30000, true); // Should complete within 30 seconds

      // Check system health after stress test
      const orchestratorHealth = await orchestrator.getHealthStatus();
      assertEquals(orchestratorHealth.healthy, true);

      const terminalHealth = await terminalManager.getHealthStatus();
      assertEquals(terminalHealth.healthy, true);

      // Verify all agents are still active
      const activeSessions = orchestrator.getActiveSessions();
      assertEquals(activeSessions.length, 5);
    });
  });

  describe('error handling and recovery', () => {
    it('should recover from component failures', async () => {
      // Register tools that may fail
      let failureCount = 0;
      const unreliableTool: MCPTool = {
        name: 'unreliable_service',
        description: 'Service that sometimes fails',
        inputSchema: {
          type: 'object',
          properties: {
            force_failure: { type: 'boolean', default: false },
          },
        },
        handler: async (input: any) => {
          failureCount++;
          
          if (input.force_failure || failureCount % 3 === 0) {
            throw new Error('Service temporarily unavailable');
          }

          return {
            content: [{
              type: 'text',
              text: `Service call successful (attempt ${failureCount})`,
            }],
          };
        },
      };

      await mcpServer.registerTool(unreliableTool);

      const agentProfile: AgentProfile = {
        id: 'resilient-agent',
        name: 'Resilient Agent',
        type: 'implementer',
        capabilities: ['unreliable_service'],
        systemPrompt: 'You handle unreliable services',
        maxConcurrentTasks: 1,
        priority: 1,
      };

      const session = await orchestrator.spawnAgent(agentProfile);

      // Create tasks that will encounter failures
      const resilientTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `resilient-${i}`,
        type: 'mcp-tool-call',
        description: `Resilient task ${i}`,
        priority: 1,
        dependencies: [],
        status: 'pending' as TaskStatus,
        input: {
          tool: 'unreliable_service',
          arguments: {},
          agentId: agentProfile.id,
          maxRetries: 3, // Enable retries
        },
        createdAt: new Date(),
      }));

      // Execute tasks with potential failures
      const results = await Promise.all(
        resilientTasks.map(task => orchestrator.executeTask(task))
      );

      // Some tasks should succeed despite initial failures
      const successfulTasks = results.filter(r => r.status === 'completed');
      const failedTasks = results.filter(r => r.status === 'failed');

      assertEquals(successfulTasks.length > 0, true);
      assertEquals(results.length, 10);

      // System should still be healthy
      const health = await orchestrator.getHealthStatus();
      assertEquals(health.healthy, true);
    });

    it('should handle memory conflicts and coordination deadlocks', async () => {
      // Create conflicting memory operations
      const conflictTool: MCPTool = {
        name: 'memory_conflict',
        description: 'Creates memory conflicts',
        inputSchema: {
          type: 'object',
          properties: {
            entry_id: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['entry_id', 'value'],
        },
        handler: async (input: any, context?: MCPContext) => {
          const { entry_id, value } = input;
          
          // Simulate conflict resolution
          const lockId = `conflict-${entry_id}`;
          await coordinationManager.acquireResource(lockId, context?.agentId || 'unknown');

          try {
            // Check if entry exists
            let entry;
            try {
              entry = await memoryManager.getEntry(entry_id);
            } catch {
              // Entry doesn't exist, create it
            }

            if (entry) {
              // Update existing entry
              await memoryManager.updateEntry(entry_id, {
                ...entry,
                content: value,
                version: entry.version + 1,
              });
            } else {
              // Create new entry
              await memoryManager.storeEntry({
                id: entry_id,
                agentId: context?.agentId || 'unknown',
                sessionId: context?.sessionId || generateId('session'),
                type: 'observation',
                content: value,
                context: { conflictTest: true },
                timestamp: new Date(),
                tags: ['conflict'],
                version: 1,
              });
            }

            return {
              content: [{
                type: 'text',
                text: `Memory operation completed: ${entry_id} = ${value}`,
              }],
            };

          } finally {
            await coordinationManager.releaseResource(lockId, context?.agentId || 'unknown');
          }
        },
      };

      await mcpServer.registerTool(conflictTool);

      // Create agents that will create conflicts
      const conflictAgents = Array.from({ length: 3 }, (_, i) => ({
        id: `conflict-agent-${i}`,
        name: `Conflict Agent ${i}`,
        type: 'implementer' as const,
        capabilities: ['memory_conflict'],
        systemPrompt: 'You create memory conflicts',
        maxConcurrentTasks: 1,
        priority: 1,
      }));

      const sessions = await Promise.all(
        conflictAgents.map(agent => orchestrator.spawnAgent(agent))
      );

      // Create concurrent tasks that operate on the same memory entries
      const sharedEntryId = generateId('shared-entry');
      const conflictTasks = conflictAgents.map((agent, index) => ({
        id: `conflict-task-${index}`,
        type: 'mcp-tool-call',
        description: `Conflict task from ${agent.id}`,
        priority: 1,
        dependencies: [],
        status: 'pending' as TaskStatus,
        input: {
          tool: 'memory_conflict',
          arguments: {
            entry_id: sharedEntryId,
            value: `Value from ${agent.id}`,
          },
          agentId: agent.id,
        },
        createdAt: new Date(),
      }));

      // Execute conflicting tasks
      const results = await Promise.all(
        conflictTasks.map(task => orchestrator.executeTask(task))
      );

      // All tasks should complete (conflicts resolved)
      results.forEach(result => {
        assertEquals(result.status, 'completed');
      });

      // Final entry should exist with one of the values
      const finalEntry = await memoryManager.getEntry(sharedEntryId);
      assertExists(finalEntry);
      assertEquals(finalEntry.version >= 1, true);

      // Verify coordination prevented deadlocks
      assertEquals(coordinationManager.acquireResource.calls.length, 3);
      assertEquals(coordinationManager.releaseResource.calls.length, 3);
    });
  });

  describe('performance metrics and monitoring', () => {
    it('should collect and report system metrics', async () => {
      // Track metrics events
      const metricsEvents: any[] = [];
      eventBus.on('metrics:collected', (metrics) => {
        metricsEvents.push(metrics);
      });

      // Register a metrics tool
      const metricsTool: MCPTool = {
        name: 'generate_metrics',
        description: 'Generates system metrics',
        inputSchema: { type: 'object' },
        handler: async () => {
          const metrics = await orchestrator.getMetrics();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(metrics, null, 2),
            }],
          };
        },
      };

      await mcpServer.registerTool(metricsTool);

      const metricsAgent: AgentProfile = {
        id: 'metrics-agent',
        name: 'Metrics Agent',
        type: 'analyst',
        capabilities: ['generate_metrics'],
        systemPrompt: 'You generate system metrics',
        maxConcurrentTasks: 1,
        priority: 1,
      };

      const session = await orchestrator.spawnAgent(metricsAgent);

      // Execute some tasks to generate metrics
      const workloadTasks = Array.from({ length: 5 }, (_, i) => ({
        id: `metrics-task-${i}`,
        type: 'mcp-tool-call',
        description: `Metrics workload task ${i}`,
        priority: 1,
        dependencies: [],
        status: 'pending' as TaskStatus,
        input: {
          tool: 'generate_metrics',
          arguments: {},
          agentId: metricsAgent.id,
        },
        createdAt: new Date(),
      }));

      await Promise.all(
        workloadTasks.map(task => orchestrator.executeTask(task))
      );

      // Get final metrics
      const finalMetrics = await orchestrator.getMetrics();

      // Verify metrics structure
      assertExists(finalMetrics.uptime);
      assertExists(finalMetrics.totalAgents);
      assertExists(finalMetrics.activeAgents);
      assertExists(finalMetrics.totalTasks);
      assertExists(finalMetrics.completedTasks);
      assertExists(finalMetrics.memoryUsage);
      assertExists(finalMetrics.cpuUsage);

      // Verify metric values make sense
      assertEquals(finalMetrics.activeAgents, 1);
      assertEquals(finalMetrics.completedTasks >= 5, true);
      assertEquals(finalMetrics.totalTasks >= 5, true);

      // Check memory and CPU usage are reasonable
      assertEquals(finalMetrics.memoryUsage.rss > 0, true);
      assertEquals(finalMetrics.cpuUsage.user >= 0, true);
    });
  });
});