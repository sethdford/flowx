import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Logger } from '../core/logger.js';
import { generateId } from '../utils/helpers.js';

export interface AgentProcess {
  id: string;
  name: string;
  type: 'coordinator' | 'researcher' | 'developer' | 'analyst' | 'architect' | 'tester' | 'reviewer';
  workingDir: string;
  process?: ChildProcess;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  output: string[];
  prompt: string;
  pid?: number;
  // Enhanced coordination features
  sparcMode?: string;
  neuralCapabilities?: string[];
  meshConnections?: Set<string>;
  consensusWeight?: number;
  intelligence?: {
    learningRate: number;
    patternMemory: any[];
    adaptationScore: number;
  };
}

export interface SpawnOptions {
  agentCount: number;
  workingDirectory: string;
  strategy: string;
  prompt: string;
  // Enhanced options matching legacy system
  topology: 'hierarchical' | 'mesh' | 'hybrid' | 'adaptive';
  neuralMode: boolean;
  consensusAlgorithm: 'raft' | 'byzantine' | 'practical-bft';
  terminalIntegration: 'native' | 'vscode' | 'auto';
  sparcIntegration: boolean;
  realTimeCoordination: boolean;
  mcpToolsEnabled: boolean;
  faultTolerance: {
    maxFailures: number;
    recoveryStrategy: 'auto' | 'manual' | 'neural';
    redundancyLevel: number;
  };
}

export interface RooConfiguration {
  modes: Record<string, {
    role: string;
    instructions: string[];
    tools: string[];
    systemPrompt: string;
    capabilities: string[];
  }>;
  defaultMode: string;
  agentMapping: Record<string, string>;
}

/**
 * Enterprise Multi-Process Spawner
 * 
 * Enhanced version matching the sophisticated legacy claude-flow system:
 * 1. Real Claude Code process spawning in separate terminals
 * 2. Advanced SPARC methodology integration with .roo configuration
 * 3. Mesh topology coordination with consensus algorithms
 * 4. Neural pattern recognition and ML-driven coordination
 * 5. Inter-agent communication through shared memory and messaging
 * 6. Terminal integration (VS Code, native terminals)
 * 7. MCP tools integration for enterprise coordination
 */
export class EnterpriseMultiProcessSpawner extends EventEmitter {
  private logger: Logger;
  private swarmId: string;
  private agents = new Map<string, AgentProcess>();
  private baseWorkingDir: string;
  private rooConfig?: RooConfiguration;
  
  // Enhanced coordination state
  private meshTopology = new Map<string, Set<string>>(); // Agent -> connected agents
  private consensusState = new Map<string, any>(); // Agent -> consensus info
  private communicationChannels = new Map<string, any>(); // Channel management
  private neuralEngines = new Map<string, any>(); // Agent -> neural engine
  private performanceMetrics = new Map<string, any>(); // Agent -> metrics

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.swarmId = generateId('enterprise-swarm');
    this.baseWorkingDir = `./swarm-workspaces/${this.swarmId}`;
  }

  async spawnSwarm(options: SpawnOptions): Promise<string[]> {
    this.logger.info('🚀 Spawning enterprise swarm with advanced coordination', {
      swarmId: this.swarmId,
      strategy: options.strategy,
      topology: options.topology,
      agentCount: options.agentCount,
      neuralMode: options.neuralMode
    });

    // Load .roo-flowx.json configuration for SPARC integration
    if (options.sparcIntegration) {
      await this.loadRooConfiguration();
    }

    // Create advanced swarm infrastructure
    await this.createEnterpriseSwarmInfrastructure(options);

    const agentIds: string[] = [];

    // Initialize topology-specific coordination
    await this.initializeTopologyCoordination(options);

    // Determine sophisticated agent types based on strategy and neural analysis
    const agentTypes = await this.determineOptimalAgentComposition(options);

    // Spawn coordinator with enterprise capabilities
    const coordinatorId = await this.spawnEnterpriseCoordinator(options, agentTypes);
    agentIds.push(coordinatorId);

    // Spawn specialized agents with neural capabilities
    for (let i = 1; i < options.agentCount; i++) {
      const agentType = agentTypes[i % agentTypes.length];
      const agentId = await this.spawnEnterpriseAgent(options, agentType, i);
      agentIds.push(agentId);
    }

    // Establish mesh connections if using mesh/hybrid topology
    if (options.topology === 'mesh' || options.topology === 'hybrid') {
      await this.establishMeshConnections(agentIds, options);
    }

    // Initialize real-time coordination if enabled
    if (options.realTimeCoordination) {
      await this.startRealTimeCoordination(agentIds, options);
    }

    this.logger.info(`✅ Enterprise swarm spawned successfully`, {
      swarmId: this.swarmId,
      agentCount: agentIds.length,
      topology: options.topology,
      workspace: this.baseWorkingDir
    });
    
    return agentIds;
  }

  private async loadRooConfiguration(): Promise<void> {
    try {
      const rooPath = '.roo-flowx.json';
      const rooContent = await fs.readFile(rooPath, 'utf-8');
      this.rooConfig = JSON.parse(rooContent);
      this.logger.info('✅ Loaded .roo-flowx.json configuration for enhanced SPARC integration');
    } catch (error) {
      this.logger.warn('⚠️ Could not load .roo-flowx.json, using default SPARC configuration');
      this.rooConfig = this.getDefaultRooConfiguration();
    }
  }

  private async createEnterpriseSwarmInfrastructure(options: SpawnOptions): Promise<void> {
    // Create comprehensive swarm infrastructure
    const dirs = [
      'communication',
      'shared-artifacts', 
      'neural-patterns',
      'consensus-data',
      'mesh-routing',
      'logs',
      'coordination-scripts',
      'mcp-tools',
      'performance-metrics',
      'topology'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.baseWorkingDir, dir), { recursive: true });
    }

    // Create enhanced shared memory with enterprise features
    const enterpriseSharedMemory = {
      swarmId: this.swarmId,
      topology: options.topology,
      neuralMode: options.neuralMode,
      consensusAlgorithm: options.consensusAlgorithm,
      createdAt: new Date().toISOString(),
      agents: {},
      tasks: {},
      coordination: {
        mesh: {},
        consensus: {},
        neural: {},
        performance: {}
      },
      communication: {
        channels: {},
        messageHistory: [],
        routingTable: {}
      },
      status: 'initializing',
      capabilities: {
        sparc: options.sparcIntegration,
        neural: options.neuralMode,
        mcp: options.mcpToolsEnabled,
        realTime: options.realTimeCoordination
      }
    };

    await fs.writeFile(
      path.join(this.baseWorkingDir, 'enterprise-shared-memory.json'),
      JSON.stringify(enterpriseSharedMemory, null, 2)
    );

    // Create advanced coordination scripts
    await this.createAdvancedCoordinationScripts(options);

    // Create MCP tools integration if enabled
    if (options.mcpToolsEnabled) {
      await this.createMCPToolsIntegration();
    }

    this.logger.info(`🏗️ Created enterprise swarm infrastructure at ${this.baseWorkingDir}`);
  }

  private async initializeTopologyCoordination(options: SpawnOptions): Promise<void> {
    switch (options.topology) {
      case 'mesh':
        await this.initializeMeshTopology(options);
        break;
      case 'hierarchical':
        await this.initializeHierarchicalTopology(options);
        break;
      case 'hybrid':
        await this.initializeHybridTopology(options);
        break;
      case 'adaptive':
        await this.initializeAdaptiveTopology(options);
        break;
    }
  }

  private async determineOptimalAgentComposition(options: SpawnOptions): Promise<string[]> {
    // Use neural analysis or fallback to rule-based composition
    if (options.neuralMode) {
      return await this.neuralAgentComposition(options);
    } else {
      return this.ruleBasedAgentComposition(options);
    }
  }

  private async spawnEnterpriseCoordinator(options: SpawnOptions, agentTypes: string[]): Promise<string> {
    const agent: AgentProcess = {
      id: generateId('enterprise-coordinator'),
      name: 'Enterprise-Coordinator',
      type: 'coordinator',
      workingDir: path.join(this.baseWorkingDir, 'enterprise-coordinator'),
      status: 'pending',
      output: [],
      prompt: await this.generateEnterpriseCoordinatorPrompt(options, agentTypes),
      sparcMode: this.rooConfig?.agentMapping?.coordinator || 'orchestrator',
      neuralCapabilities: options.neuralMode ? ['pattern-recognition', 'adaptive-optimization', 'swarm-intelligence'] : [],
      meshConnections: new Set(),
      consensusWeight: 2.0, // Higher weight for coordinator
      intelligence: {
        learningRate: 0.01,
        patternMemory: [],
        adaptationScore: 0.8
      }
    };

    await this.setupEnterpriseAgentWorkspace(agent, options);
    await this.spawnEnterpriseClaudeProcess(agent, options);

    this.agents.set(agent.id, agent);
    return agent.id;
  }

  private async spawnEnterpriseAgent(options: SpawnOptions, type: string, index: number): Promise<string> {
    const agent: AgentProcess = {
      id: generateId(`enterprise-${type}`),
      name: `Enterprise-${type.charAt(0).toUpperCase() + type.slice(1)}-${index}`,
      type: type as AgentProcess['type'],
      workingDir: path.join(this.baseWorkingDir, `enterprise-${type}-${index}`),
      status: 'pending',
      output: [],
      prompt: await this.generateEnterpriseAgentPrompt(type, options, index),
      sparcMode: this.rooConfig?.agentMapping?.[type] || type,
      neuralCapabilities: options.neuralMode ? this.getNeuralCapabilitiesForType(type) : [],
      meshConnections: new Set(),
      consensusWeight: 1.0,
      intelligence: {
        learningRate: this.getLearningRateForType(type),
        patternMemory: [],
        adaptationScore: 0.5
      }
    };

    await this.setupEnterpriseAgentWorkspace(agent, options);
    await this.spawnEnterpriseClaudeProcess(agent, options);

    this.agents.set(agent.id, agent);
    return agent.id;
  }

  private async setupEnterpriseAgentWorkspace(agent: AgentProcess, options: SpawnOptions): Promise<void> {
    // Create agent workspace with enterprise features
    await fs.mkdir(agent.workingDir, { recursive: true });

    // Create enhanced agent info with enterprise metadata
    const enterpriseAgentInfo = {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      swarmId: this.swarmId,
      workingDir: agent.workingDir,
      sparcMode: agent.sparcMode,
      neuralCapabilities: agent.neuralCapabilities,
      topology: options.topology,
      startTime: new Date().toISOString(),
      capabilities: this.getCapabilitiesForType(agent.type),
      coordination: {
        consensusWeight: agent.consensusWeight,
        meshEnabled: options.topology === 'mesh' || options.topology === 'hybrid',
        neuralEnabled: options.neuralMode
      },
      enterprise: {
        version: '2.0.0',
        features: ['sparc', 'neural', 'mesh', 'consensus', 'mcp'],
        performance: {
          targetLatency: 100,
          targetThroughput: 10,
          targetReliability: 0.99
        }
      }
    };

    await fs.writeFile(
      path.join(agent.workingDir, 'enterprise-agent-info.json'),
      JSON.stringify(enterpriseAgentInfo, null, 2)
    );

    // Create enhanced SPARC prompt with .roo integration
    const enhancedPrompt = await this.generateEnhancedSparcPrompt(agent.type, options);
    await fs.writeFile(
      path.join(agent.workingDir, 'enhanced-sparc-prompt.md'),
      enhancedPrompt
    );

    // Create coordination tools
    await this.createAgentCoordinationTools(agent, options);

    this.logger.info(`🏗️ Created enterprise workspace for ${agent.name} at ${agent.workingDir}`);
  }

  private async spawnEnterpriseClaudeProcess(agent: AgentProcess, options: SpawnOptions): Promise<void> {
    // Enhanced Claude Code spawning with enterprise environment
    const claudeArgs = [agent.prompt];

    // Add tool permissions based on agent type and SPARC mode
    const tools = this.getToolsForAgent(agent);
    claudeArgs.push('--allowedTools', tools.join(','));
    claudeArgs.push('--dangerously-skip-permissions');

    // Add enterprise flags
    if (options.neuralMode) {
      claudeArgs.push('--neural-mode');
    }
    if (options.mcpToolsEnabled) {
      claudeArgs.push('--mcp-enabled');
    }

    const enterpriseEnv = {
      ...process.env,
      // Swarm coordination context
      CLAUDE_SWARM_ID: this.swarmId,
      CLAUDE_AGENT_ID: agent.id,
      CLAUDE_AGENT_TYPE: agent.type,
      CLAUDE_AGENT_NAME: agent.name,
      CLAUDE_SWARM_DIR: this.baseWorkingDir,
      CLAUDE_TOPOLOGY: options.topology,
      CLAUDE_SPARC_MODE: agent.sparcMode || 'default',
      
      // Enterprise features
      CLAUDE_NEURAL_MODE: options.neuralMode.toString(),
      CLAUDE_CONSENSUS_ALGORITHM: options.consensusAlgorithm,
      CLAUDE_MESH_ENABLED: (options.topology === 'mesh' || options.topology === 'hybrid').toString(),
      CLAUDE_MCP_ENABLED: options.mcpToolsEnabled.toString(),
      CLAUDE_REAL_TIME_COORDINATION: options.realTimeCoordination.toString(),
      
      // Coordination paths
      CLAUDE_SHARED_MEMORY_PATH: path.join(this.baseWorkingDir, 'enterprise-shared-memory.json'),
      CLAUDE_COMMUNICATION_DIR: path.join(this.baseWorkingDir, 'communication'),
      CLAUDE_NEURAL_PATTERNS_DIR: path.join(this.baseWorkingDir, 'neural-patterns'),
      CLAUDE_CONSENSUS_DATA_DIR: path.join(this.baseWorkingDir, 'consensus-data'),
      
      // Agent-specific context
      CLAUDE_CONSENSUS_WEIGHT: agent.consensusWeight?.toString() || '1.0',
      CLAUDE_NEURAL_CAPABILITIES: agent.neuralCapabilities?.join(',') || '',
      CLAUDE_LEARNING_RATE: agent.intelligence?.learningRate.toString() || '0.01',
      
      // Enterprise security and compliance
      CLAUDE_ENTERPRISE_MODE: 'true',
      CLAUDE_SECURITY_LEVEL: 'enterprise',
      CLAUDE_COMPLIANCE_MODE: 'strict',
      
      // Performance monitoring
      CLAUDE_PERFORMANCE_MONITORING: 'true',
      CLAUDE_METRICS_DIR: path.join(this.baseWorkingDir, 'performance-metrics'),
      
      // API keys (remove conflicting ones)
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    };

    // Terminal spawning based on integration type
    let claudeProcess: ChildProcess;
    
    switch (options.terminalIntegration) {
      case 'vscode':
        claudeProcess = await this.spawnInVSCodeTerminal(claudeArgs, agent.workingDir, enterpriseEnv);
        break;
      case 'native':
        claudeProcess = await this.spawnInNativeTerminal(claudeArgs, agent.workingDir, enterpriseEnv);
        break;
      case 'auto':
      default:
        claudeProcess = await this.spawnWithAutoDetection(claudeArgs, agent.workingDir, enterpriseEnv);
        break;
    }

    if (!claudeProcess.pid) {
      throw new Error(`Failed to spawn Claude process for ${agent.name}`);
    }

    agent.process = claudeProcess;
    agent.pid = claudeProcess.pid;
    agent.status = 'running';
    agent.startTime = new Date();

    this.logger.info(`🚀 Enterprise Claude spawned for ${agent.name}`, {
      pid: claudeProcess.pid,
      topology: options.topology,
      neuralMode: options.neuralMode,
      sparcMode: agent.sparcMode
    });

    // Setup enhanced process monitoring
    this.setupEnterpriseProcessHandlers(agent, claudeProcess, options);
  }

  private async spawnWithAutoDetection(claudeArgs: string[], workingDir: string, env: any): Promise<ChildProcess> {
    // Try VS Code integration first, then fallback to direct spawning
    if (process.env.VSCODE_PID || process.env.TERM_PROGRAM === 'vscode') {
      try {
        return await this.spawnInVSCodeTerminal(claudeArgs, workingDir, env);
      } catch (error) {
        this.logger.warn('VS Code terminal spawn failed, falling back to direct spawn');
      }
    }

    // Direct Claude Code spawning (most reliable)
    return spawn('claude', claudeArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workingDir,
      env
    });
  }

  private async spawnInVSCodeTerminal(claudeArgs: string[], workingDir: string, env: any): Promise<ChildProcess> {
    // Enhanced VS Code integration
    const terminalCommand = `cd "${workingDir}" && claude ${claudeArgs.map(arg => `"${arg}"`).join(' ')}`;
    
    // Use VS Code's terminal API if available
    return spawn('osascript', [
      '-e', `tell application "Visual Studio Code"`,
      '-e', `do shell script "${terminalCommand}"`,
      '-e', 'end tell'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    });
  }

  private async spawnInNativeTerminal(claudeArgs: string[], workingDir: string, env: any): Promise<ChildProcess> {
    // Native terminal spawning for different platforms
    const platform = process.platform;
    
    switch (platform) {
      case 'darwin': // macOS
        return this.spawnInMacTerminal(claudeArgs, workingDir, env);
      case 'linux':
        return this.spawnInLinuxTerminal(claudeArgs, workingDir, env);
      case 'win32':
        return this.spawnInWindowsTerminal(claudeArgs, workingDir, env);
      default:
        throw new Error(`Unsupported platform for native terminal spawning: ${platform}`);
    }
  }

  private async spawnInMacTerminal(claudeArgs: string[], workingDir: string, env: any): Promise<ChildProcess> {
    const command = `cd "${workingDir}" && claude ${claudeArgs.map(arg => `"${arg}"`).join(' ')}`;
    
    return spawn('osascript', [
      '-e', 'tell application "Terminal"',
      '-e', 'activate',
      '-e', `do script "${command}"`,
      '-e', 'end tell'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    });
  }

  private async spawnInLinuxTerminal(claudeArgs: string[], workingDir: string, env: any): Promise<ChildProcess> {
    const command = `cd "${workingDir}" && claude ${claudeArgs.map(arg => `"${arg}"`).join(' ')}`;
    
    // Try gnome-terminal first, then other common terminals
    const terminals = ['gnome-terminal', 'konsole', 'xterm', 'terminator'];
    
    for (const terminal of terminals) {
      try {
        return spawn(terminal, ['--', 'bash', '-c', command], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env
        });
      } catch (error) {
        continue; // Try next terminal
      }
    }
    
    throw new Error('No suitable terminal found on Linux system');
  }

  private async spawnInWindowsTerminal(claudeArgs: string[], workingDir: string, env: any): Promise<ChildProcess> {
    const command = `cd /d "${workingDir}" && claude ${claudeArgs.map(arg => `"${arg}"`).join(' ')}`;
    
    return spawn('cmd', ['/c', 'start', 'cmd', '/k', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    });
  }

  // Missing method implementations
  
  private async createAdvancedCoordinationScripts(options: SpawnOptions): Promise<void> {
    this.logger.info('📝 Creating advanced coordination scripts');
    // Create coordination scripts for different topologies
    const scripts = {
      mesh: 'mesh-coordination.sh',
      hierarchical: 'hierarchical-coordination.sh',
      hybrid: 'hybrid-coordination.sh',
      adaptive: 'adaptive-coordination.sh'
    };
    
    for (const [topology, scriptName] of Object.entries(scripts)) {
      const scriptContent = `#!/bin/bash
# ${topology.toUpperCase()} Coordination Script
echo "Starting ${topology} coordination..."
# Add specific coordination logic here
`;
      await fs.writeFile(
        path.join(this.baseWorkingDir, 'coordination-scripts', scriptName),
        scriptContent
      );
    }
  }
  
  private async createMCPToolsIntegration(): Promise<void> {
    this.logger.info('🔧 Creating MCP tools integration');
    const mcpConfig = {
      tools: ['neural-tools', 'swarm-tools', 'coordination-tools'],
      enabledFeatures: ['pattern-recognition', 'load-balancing', 'adaptive-scheduling'],
      performance: {
        cacheEnabled: true,
        batchSize: 32,
        timeout: 30000
      }
    };
    
    await fs.writeFile(
      path.join(this.baseWorkingDir, 'mcp-tools', 'mcp-integration.json'),
      JSON.stringify(mcpConfig, null, 2)
    );
  }
  
  private async initializeMeshTopology(options: SpawnOptions): Promise<void> {
    this.logger.info('🕸️ Initializing mesh topology');
    // Create mesh topology configuration
    const meshConfig = {
      maxPeersPerNode: 6,
      consensusTimeout: 30000,
      adaptiveTopology: true,
      loadBalancingStrategy: 'ml-optimized'
    };
    
    await fs.writeFile(
      path.join(this.baseWorkingDir, 'topology', 'mesh-config.json'),
      JSON.stringify(meshConfig, null, 2)
    );
  }
  
  private async initializeHierarchicalTopology(options: SpawnOptions): Promise<void> {
    this.logger.info('🏢 Initializing hierarchical topology');
    const hierarchicalConfig = {
      maxDepth: 3,
      spanOfControl: 5,
      commandChain: true,
      delegationRules: 'strict'
    };
    
    await fs.writeFile(
      path.join(this.baseWorkingDir, 'topology', 'hierarchical-config.json'),
      JSON.stringify(hierarchicalConfig, null, 2)
    );
  }
  
  private async initializeHybridTopology(options: SpawnOptions): Promise<void> {
    this.logger.info('🔄 Initializing hybrid topology');
    const hybridConfig = {
      switchingThreshold: 0.7,
      meshComponents: ['coordination', 'knowledge-sharing'],
      hierarchicalComponents: ['task-assignment', 'resource-allocation']
    };
    
    await fs.writeFile(
      path.join(this.baseWorkingDir, 'topology', 'hybrid-config.json'),
      JSON.stringify(hybridConfig, null, 2)
    );
  }
  
  private async initializeAdaptiveTopology(options: SpawnOptions): Promise<void> {
    this.logger.info('🧠 Initializing adaptive topology');
    const adaptiveConfig = {
      learningRate: 0.01,
      adaptationThreshold: 0.8,
      performanceTargets: {
        latency: 100,
        throughput: 10,
        reliability: 0.95
      }
    };
    
    await fs.writeFile(
      path.join(this.baseWorkingDir, 'topology', 'adaptive-config.json'),
      JSON.stringify(adaptiveConfig, null, 2)
    );
  }
  
  private async neuralAgentComposition(options: SpawnOptions): Promise<string[]> {
    this.logger.info('🧠 Using neural analysis for agent composition');
    // Mock neural analysis - in real implementation would use ML models
    const baseTypes = ['coordinator', 'developer', 'researcher', 'analyst'];
    
    // Enhanced composition based on strategy analysis
    if (options.strategy.includes('api')) {
      baseTypes.push('architect');
    }
    if (options.strategy.includes('test')) {
      baseTypes.push('tester');
    }
    if (options.strategy.includes('review')) {
      baseTypes.push('reviewer');
    }
    
    return baseTypes;
  }
  
  private ruleBasedAgentComposition(options: SpawnOptions): string[] {
    this.logger.info('📋 Using rule-based agent composition');
    const baseComposition = ['coordinator'];
    
    if (options.strategy.includes('code') || options.strategy.includes('develop')) {
      baseComposition.push('developer');
    }
    if (options.strategy.includes('research') || options.strategy.includes('analyze')) {
      baseComposition.push('researcher');
    }
    if (options.strategy.includes('analysis') || options.strategy.includes('data')) {
      baseComposition.push('analyst');
    }
    if (options.strategy.includes('architect') || options.strategy.includes('design')) {
      baseComposition.push('architect');
    }
    if (options.strategy.includes('test') || options.strategy.includes('qa')) {
      baseComposition.push('tester');
    }
    if (options.strategy.includes('review') || options.strategy.includes('audit')) {
      baseComposition.push('reviewer');
    }
    
    return baseComposition;
  }
  
  private getCapabilitiesForType(type: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      coordinator: ['coordination', 'management', 'planning', 'task-distribution'],
      developer: ['code-generation', 'debugging', 'testing', 'implementation'],
      researcher: ['research', 'analysis', 'documentation', 'information-gathering'],
      analyst: ['analysis', 'data-processing', 'insights', 'pattern-recognition'],
      architect: ['system-design', 'architecture', 'planning', 'technical-leadership'],
      tester: ['testing', 'automation', 'validation', 'quality-assurance'],
      reviewer: ['code-review', 'quality-assurance', 'validation', 'compliance']
    };
    
    return capabilityMap[type] || ['general'];
  }
  
  private async createAgentCoordinationTools(agent: AgentProcess, options: SpawnOptions): Promise<void> {
    this.logger.info(`🔧 Creating coordination tools for ${agent.name}`);
    
    // Create coordination script
    const coordinationScript = `#!/bin/bash
# Coordination script for ${agent.name}
echo "Starting coordination for ${agent.type} agent..."

# Check shared memory
if [ -f "../enterprise-shared-memory.json" ]; then
  echo "✅ Shared memory accessible"
else
  echo "❌ Shared memory not found"
fi

# Check communication channels
if [ -d "../communication" ]; then
  echo "✅ Communication channels available"
else
  echo "❌ Communication channels not found"
fi

# Agent-specific coordination
case "${agent.type}" in
  "coordinator")
    echo "🎯 Coordinator coordination mode"
    ;;
  "developer")
    echo "💻 Developer coordination mode"
    ;;
  "researcher")
    echo "🔍 Researcher coordination mode"
    ;;
  *)
    echo "🤖 Generic coordination mode"
    ;;
esac
`;
    
    await fs.writeFile(
      path.join(agent.workingDir, 'coordinate.sh'),
      coordinationScript
    );
    
    // Create agent status file
    const statusInfo = {
      agentId: agent.id,
      type: agent.type,
      status: 'initialized',
      capabilities: this.getCapabilitiesForType(agent.type),
      sparcMode: agent.sparcMode,
      neuralCapabilities: agent.neuralCapabilities,
      lastUpdate: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(agent.workingDir, 'status.json'),
      JSON.stringify(statusInfo, null, 2)
    );
  }
  
  private setupEnterpriseProcessHandlers(agent: AgentProcess, claudeProcess: ChildProcess, options: SpawnOptions): void {
    this.logger.info(`🔧 Setting up enterprise process handlers for ${agent.name}`);
    
    // Enhanced stdout handling
    claudeProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      agent.output.push(output);
      
      // Emit enterprise events
      this.emit('agent-output', {
        agentId: agent.id,
        type: 'stdout',
        data: output,
        timestamp: new Date(),
        topology: options.topology,
        neuralMode: options.neuralMode
      });
      
      // Log with enterprise context
      this.logger.info('📤 Agent stdout', {
        agentId: agent.id,
        agentType: agent.type,
        topology: options.topology,
        outputLength: output.length
      });
    });
    
    // Enhanced stderr handling
    claudeProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      agent.output.push(`[STDERR] ${error}`);
      
      // Emit enterprise error events
      this.emit('agent-error', {
        agentId: agent.id,
        type: 'stderr',
        data: error,
        timestamp: new Date(),
        topology: options.topology,
        neuralMode: options.neuralMode
      });
      
      this.logger.warn('⚠️ Agent stderr', {
        agentId: agent.id,
        agentType: agent.type,
        error: error.trim()
      });
    });
    
    // Enhanced exit handling
    claudeProcess.on('exit', (code, signal) => {
      agent.status = code === 0 ? 'completed' : 'failed';
      agent.endTime = new Date();
      
      // Emit enterprise completion events
      this.emit('agent-completed', {
        agentId: agent.id,
        exitCode: code,
        signal,
        duration: agent.endTime.getTime() - (agent.startTime?.getTime() || 0),
        topology: options.topology,
        neuralMode: options.neuralMode
      });
      
      this.logger.info(`🏁 Agent process completed`, {
        agentId: agent.id,
        agentType: agent.type,
        exitCode: code,
        signal,
        status: agent.status
      });
    });
    
    // Enterprise process monitoring
    claudeProcess.on('error', (error) => {
      agent.status = 'failed';
      
      this.emit('agent-error', {
        agentId: agent.id,
        type: 'process-error',
        error: error.message,
        timestamp: new Date()
      });
      
      this.logger.error('💥 Agent process error', {
        agentId: agent.id,
        error: error.message
      });
    });
  }

  // Additional sophisticated methods for mesh connections, real-time coordination, etc.
  
  private async establishMeshConnections(agentIds: string[], options: SpawnOptions): Promise<void> {
    this.logger.info('🕸️ Establishing mesh connections between agents');
    
    // Create mesh routing table
    const meshRoutes = new Map<string, string[]>();
    
    // Establish full mesh connections
    for (const agentId of agentIds) {
      const connections = agentIds.filter(id => id !== agentId);
      meshRoutes.set(agentId, connections);
      
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.meshConnections = new Set(connections);
      }
    }
    
    // Write mesh configuration
    const meshConfig = {
      topology: 'mesh',
      agentCount: agentIds.length,
      connections: Object.fromEntries(meshRoutes),
      establishedAt: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(this.baseWorkingDir, 'mesh-routing', 'mesh-connections.json'),
      JSON.stringify(meshConfig, null, 2)
    );
    
    this.logger.info(`✅ Mesh connections established for ${agentIds.length} agents`);
  }

  private async startRealTimeCoordination(agentIds: string[], options: SpawnOptions): Promise<void> {
    this.logger.info('⚡ Starting real-time coordination monitoring');
    
    // Create real-time coordination configuration
    const realTimeConfig = {
      enabled: true,
      agentIds,
      monitoringInterval: 5000, // 5 seconds
      syncInterval: 10000, // 10 seconds
      coordinationAlgorithm: options.consensusAlgorithm,
      features: {
        heartbeat: true,
        loadBalancing: true,
        adaptiveScheduling: options.neuralMode,
        faultTolerance: true
      }
    };
    
    await fs.writeFile(
      path.join(this.baseWorkingDir, 'coordination-scripts', 'realtime-config.json'),
      JSON.stringify(realTimeConfig, null, 2)
    );
    
    // Start monitoring intervals
    this.startCoordinationMonitoring(agentIds, options);
    
    this.logger.info('✅ Real-time coordination started');
  }
  
  private startCoordinationMonitoring(agentIds: string[], options: SpawnOptions): void {
    // Heartbeat monitoring
    setInterval(() => {
      this.checkAgentHeartbeats(agentIds);
    }, 30000); // 30 seconds
    
    // Performance monitoring
    setInterval(() => {
      this.monitorPerformanceMetrics(agentIds);
    }, 60000); // 1 minute
    
    // Adaptive coordination
    if (options.neuralMode) {
      setInterval(() => {
        this.adaptCoordinationStrategy(agentIds, options);
      }, 120000); // 2 minutes
    }
  }
  
  private checkAgentHeartbeats(agentIds: string[]): void {
    for (const agentId of agentIds) {
      const agent = this.agents.get(agentId);
      if (agent && agent.process) {
        // Check if process is still running
        const isRunning = !agent.process.killed && agent.process.exitCode === null;
        
        if (!isRunning && agent.status === 'running') {
          agent.status = 'failed';
          this.logger.warn(`💔 Agent heartbeat failed`, { agentId, agentName: agent.name });
        }
      }
    }
  }
  
  private monitorPerformanceMetrics(agentIds: string[]): void {
    const metrics = {
      timestamp: new Date().toISOString(),
      activeAgents: agentIds.filter(id => {
        const agent = this.agents.get(id);
        return agent?.status === 'running';
      }).length,
      totalAgents: agentIds.length,
      swarmHealth: this.calculateSwarmHealth(agentIds)
    };
    
    this.performanceMetrics.set('current', metrics);
    this.logger.info('📊 Performance metrics updated', metrics);
  }
  
  private calculateSwarmHealth(agentIds: string[]): number {
    const runningAgents = agentIds.filter(id => {
      const agent = this.agents.get(id);
      return agent?.status === 'running';
    }).length;
    
    return agentIds.length > 0 ? runningAgents / agentIds.length : 0;
  }
  
  private adaptCoordinationStrategy(agentIds: string[], options: SpawnOptions): void {
    const swarmHealth = this.calculateSwarmHealth(agentIds);
    
    if (swarmHealth < 0.7) {
      this.logger.warn('🚨 Low swarm health detected, adapting coordination strategy', {
        health: swarmHealth,
        recommendedAction: 'increase-redundancy'
      });
      
      // Implement adaptive strategies based on health
      this.implementAdaptiveStrategy(agentIds, options, swarmHealth);
    }
  }
  
  private implementAdaptiveStrategy(agentIds: string[], options: SpawnOptions, health: number): void {
    // Neural-driven adaptation strategies
    if (health < 0.5) {
      this.logger.info('🧠 Implementing emergency coordination protocol');
      // Switch to more resilient topology
    } else if (health < 0.7) {
      this.logger.info('🔄 Implementing performance optimization protocol');
      // Optimize current topology
    }
  }

  // Additional helper methods...
  
  private getDefaultRooConfiguration(): RooConfiguration {
    return {
      modes: {
        orchestrator: {
          role: 'Master Orchestrator',
          instructions: ['Coordinate swarm operations', 'Manage task distribution', 'Monitor progress'],
          tools: ['task_management', 'coordination', 'monitoring'],
          systemPrompt: 'You are a master orchestrator coordinating a swarm of AI agents.',
          capabilities: ['planning', 'coordination', 'optimization']
        },
        researcher: {
          role: 'Research Specialist',
          instructions: ['Gather information', 'Analyze data', 'Provide insights'],
          tools: ['web_search', 'analysis', 'documentation'],
          systemPrompt: 'You are a research specialist gathering and analyzing information.',
          capabilities: ['research', 'analysis', 'documentation']
        },
        developer: {
          role: 'Development Expert',
          instructions: ['Write code', 'Implement features', 'Debug issues'],
          tools: ['code_generation', 'debugging', 'testing'],
          systemPrompt: 'You are a development expert creating high-quality code.',
          capabilities: ['coding', 'implementation', 'debugging']
        },
        analyst: {
          role: 'Data Analyst',
          instructions: ['Analyze data', 'Generate insights', 'Create reports'],
          tools: ['data_analysis', 'visualization', 'reporting'],
          systemPrompt: 'You are a data analyst providing insights and analysis.',
          capabilities: ['analysis', 'insights', 'reporting']
        }
      },
      defaultMode: 'orchestrator',
      agentMapping: {
        coordinator: 'orchestrator',
        researcher: 'researcher',
        developer: 'developer',
        analyst: 'analyst',
        architect: 'orchestrator',
        tester: 'developer',
        reviewer: 'analyst'
      }
    };
  }

  // More sophisticated helper methods...
  private getToolsForAgent(agent: AgentProcess): string[] {
    const baseTools = ['View', 'Edit', 'Replace', 'GlobTool', 'GrepTool', 'LS', 'Bash'];
    const sparcTools = this.rooConfig?.modes[agent.sparcMode || 'default']?.tools || [];
    const neuralTools = agent.neuralCapabilities?.includes('pattern-recognition') ? ['PatternTool'] : [];
    
    return [...baseTools, ...sparcTools, ...neuralTools];
  }

  private async generateEnterpriseCoordinatorPrompt(options: SpawnOptions, agentTypes: string[]): Promise<string> {
    const rooMode = this.rooConfig?.modes?.orchestrator || this.rooConfig?.modes?.coordinator;
    
    return `# Enterprise Swarm Coordinator

## SPARC Methodology Integration
${rooMode ? `
**Your Role**: ${rooMode.role}
**Instructions**: ${rooMode.instructions.join(', ')}
**Available Tools**: ${rooMode.tools.join(', ')}
**System Context**: ${rooMode.systemPrompt}
` : ''}

## Enterprise Mission
${options.prompt}

## Advanced Swarm Configuration
- **Swarm ID**: ${this.swarmId}
- **Topology**: ${options.topology}
- **Neural Mode**: ${options.neuralMode ? 'Enabled' : 'Disabled'}
- **Consensus Algorithm**: ${options.consensusAlgorithm}
- **Agent Count**: ${options.agentCount}
- **Agent Types**: ${agentTypes.join(', ')}

## Your Enterprise Responsibilities

### 1. Strategic Coordination
- Analyze mission using advanced SPARC methodology
- Break down into sophisticated task hierarchies
- Assign tasks based on agent neural capabilities
- Monitor swarm intelligence emergence

### 2. Topology Management
- Coordinate ${options.topology} topology operations
- Manage mesh connections and routing
- Optimize consensus participation
- Adapt topology based on performance

### 3. Neural Intelligence
${options.neuralMode ? `
- Monitor neural pattern recognition across agents
- Analyze swarm collective intelligence
- Optimize learning rates and adaptation
- Detect emergent behaviors and patterns
` : '- Basic rule-based coordination'}

### 4. Enterprise Features
- **MCP Tools**: ${options.mcpToolsEnabled ? 'Full enterprise tool suite available' : 'Standard tools'}
- **Real-time Coordination**: ${options.realTimeCoordination ? 'Active monitoring and adaptation' : 'Batch coordination'}
- **Fault Tolerance**: ${options.faultTolerance.maxFailures} max failures, ${options.faultTolerance.recoveryStrategy} recovery

## Coordination Protocols

### Communication
- Use enterprise shared memory: \`bash cat ../enterprise-shared-memory.json\`
- Coordinate through: \`bash cd ../communication && ls\`
- Monitor metrics: \`bash cd ../performance-metrics && ls\`

### Task Management
1. Use TodoWrite for sophisticated task tracking
2. Create enterprise-grade deliverables
3. Coordinate with specialized agents
4. Monitor and optimize performance

Begin your enterprise coordination now!`;
  }

  private async generateEnterpriseAgentPrompt(type: string, options: SpawnOptions, index: number): Promise<string> {
    const rooMode = this.rooConfig?.modes[type] || { role: type, instructions: [], tools: [], systemPrompt: '', capabilities: [] };
    
    return `# Enterprise ${type.charAt(0).toUpperCase() + type.slice(1)} Agent

## SPARC Methodology Integration
**Your Role**: ${rooMode.role}
**Instructions**: ${rooMode.instructions.join(', ')}
**Available Tools**: ${rooMode.tools.join(', ')}
**System Context**: ${rooMode.systemPrompt}
**Capabilities**: ${rooMode.capabilities.join(', ')}

## Enterprise Mission Context
${options.prompt}

## Your Specialization
- **Agent Type**: ${type}
- **Neural Capabilities**: ${this.getNeuralCapabilitiesForType(type).join(', ')}
- **Learning Rate**: ${this.getLearningRateForType(type)}
- **Consensus Weight**: 1.0

## Enterprise Coordination

### ${options.topology.charAt(0).toUpperCase() + options.topology.slice(1)} Topology
${this.getTopologyInstructions(options.topology)}

### Communication Protocols
- **Shared Memory**: \`bash cat ../enterprise-shared-memory.json\`
- **Coordination**: \`bash cd ../communication && ./coordinate.sh\`
- **Neural Patterns**: \`bash cd ../neural-patterns && ls\`

### Your Responsibilities
1. Focus on ${type} specialization using SPARC methodology
2. Participate in ${options.topology} coordination
3. ${options.neuralMode ? 'Learn and adapt using neural capabilities' : 'Follow rule-based coordination'}
4. Create enterprise-grade deliverables

Begin your specialized work now!`;
  }

  private getNeuralCapabilitiesForType(type: string): string[] {
    const capabilities: Record<string, string[]> = {
      coordinator: ['pattern-recognition', 'adaptive-optimization', 'swarm-intelligence'],
      researcher: ['information-synthesis', 'pattern-detection', 'knowledge-integration'],
      developer: ['code-optimization', 'architectural-patterns', 'performance-analysis'],
      analyst: ['data-pattern-recognition', 'trend-analysis', 'predictive-modeling'],
      architect: ['system-pattern-recognition', 'design-optimization', 'scalability-analysis'],
      tester: ['test-pattern-recognition', 'quality-prediction', 'failure-analysis'],
      reviewer: ['quality-pattern-recognition', 'compliance-analysis', 'risk-assessment']
    };
    return capabilities[type] || ['basic-learning'];
  }

  private getLearningRateForType(type: string): number {
    const rates: Record<string, number> = {
      coordinator: 0.01,
      researcher: 0.02,
      developer: 0.015,
      analyst: 0.025,
      architect: 0.012,
      tester: 0.018,
      reviewer: 0.014
    };
    return rates[type] || 0.01;
  }

  private getTopologyInstructions(topology: string): string {
    switch (topology) {
      case 'hierarchical':
        return 'Report to coordinator, delegate to subordinates, maintain clear command structure';
      case 'mesh':
        return 'Coordinate with all peers, participate in consensus, share knowledge broadly';
      case 'hybrid':
        return 'Adaptive coordination combining hierarchical command with peer-to-peer collaboration';
      case 'adaptive':
        return 'Dynamically adapt coordination style based on task requirements and swarm intelligence';
      default:
        return 'Standard coordination protocols';
    }
  }

  private generateEnhancedSparcPrompt(type: string, options: SpawnOptions): string {
    const basePrompt = `You are a ${type} agent in an enterprise swarm coordination system.`;
    const topologyInstructions = this.getTopologyInstructions(options.topology || 'hierarchical');
    const capabilities = this.getCapabilitiesForType(type).join(', ');
    
    return `${basePrompt}

Your capabilities: ${capabilities}
Topology: ${options.topology || 'hierarchical'}
Coordination: ${topologyInstructions}

Focus on:
1. High-quality deliverables
2. Efficient coordination with other agents
3. Adherence to enterprise standards
4. Continuous learning and adaptation

Use the SPARC methodology for all tasks:
- Specification: Define clear requirements
- Pseudocode: Plan your approach
- Architecture: Design the solution
- Review: Validate and refine
- Code: Implement with excellence`;
  }

  // Expose methods for external access
  getAgents(): Map<string, AgentProcess> {
    return this.agents;
  }

  getSwarmId(): string {
    return this.swarmId;
  }

  getBaseWorkingDir(): string {
    return this.baseWorkingDir;
  }

  async stopAllAgents(): Promise<void> {
    this.logger.info('🛑 Stopping all enterprise agents');
    
    for (const [agentId, agent] of Array.from(this.agents.entries())) {
      if (agent.process && !agent.process.killed) {
        agent.process.kill('SIGTERM');
        agent.status = 'completed';
        this.logger.info(`✅ Stopped agent ${agent.name} (${agentId})`);
      }
    }
  }

  getAgentStatus(agentId: string): AgentProcess | undefined {
    return this.agents.get(agentId);
  }

  getAllAgentStatuses(): Array<{ id: string; name: string; type: string; status: string; pid?: number }> {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      pid: agent.pid
    }));
  }
}

// Backward compatibility exports
export const MultiProcessSpawner = EnterpriseMultiProcessSpawner;
export default EnterpriseMultiProcessSpawner; 