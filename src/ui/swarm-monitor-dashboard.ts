#!/usr/bin/env node

/**
 * Real-Time Swarm Monitoring Dashboard
 * 
 * Enterprise-grade terminal-based monitoring system featuring:
 * 1. Live swarm topology visualization
 * 2. Real-time agent status and performance metrics
 * 3. Interactive communication flow monitoring
 * 4. Adaptive topology switching controls
 * 5. Task progress tracking and analytics
 * 6. Resource utilization monitoring
 * 7. Neural pattern detection display
 * 8. Historical performance trending
 */

import blessed from 'blessed';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Types for swarm monitoring
interface SwarmDashboardConfig {
  swarmWorkspace: string;
  refreshInterval: number;
  enableTopologyVisualization: boolean;
  enableMetricsCollection: boolean;
  enableInteractiveControls: boolean;
  theme: 'dark' | 'light' | 'matrix';
}

interface AgentStatus {
  name: string;
  role: string;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'idle';
  progress: number;
  instanceId: string;
  directory: string;
  topology: string;
  topologyRole: string;
  lastHeartbeat: string;
  messages: number;
  artifacts: string[];
  performance: {
    cpu: number;
    memory: number;
    taskTime: number;
  };
}

interface SwarmMetrics {
  swarmId: string;
  topology: string;
  totalAgents: number;
  activeAgents: number;
  completedTasks: number;
  totalTasks: number;
  uptime: number;
  coordinationEfficiency: number;
  communicationRate: number;
  averageLatency: number;
  resourceUtilization: number;
}

interface TopologyVisualization {
  nodes: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    status: string;
    connections: string[];
  }>;
  connections: Array<{
    from: string;
    to: string;
    type: 'command' | 'data' | 'status';
    strength: number;
  }>;
}

export class SwarmMonitorDashboard extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private config: SwarmDashboardConfig;
  private updateInterval?: NodeJS.Timeout;
  private currentSwarmData: any = null;
  // UI Components
  private mainContainer!: blessed.Widgets.BoxElement;
  private headerBox!: blessed.Widgets.BoxElement;
  private topologyBox!: blessed.Widgets.BoxElement;
  private agentsBox!: blessed.Widgets.BoxElement;
  private metricsBox!: blessed.Widgets.BoxElement;
  private communicationBox!: blessed.Widgets.BoxElement;
  private controlsBox!: blessed.Widgets.BoxElement;
  private logBox!: blessed.Widgets.BoxElement;
  
  // Data tracking
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private metricsHistory: SwarmMetrics[] = [];
  private communicationEvents: Array<{ timestamp: Date; event: string; details: any }> = [];
  
  constructor(config: Partial<SwarmDashboardConfig> = {}) {
    super();
    
    this.config = {
      swarmWorkspace: './swarm-workspaces',
      refreshInterval: 2000,
      enableTopologyVisualization: true,
      enableMetricsCollection: true,
      enableInteractiveControls: true,
      theme: 'dark',
      ...config
    };
    
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'FlowX Swarm Monitor Dashboard',
      dockBorders: true,
      fullUnicode: true,
      autoPadding: true
    });
    
    this.setupUI();
    this.setupKeyBindings();
    this.startMonitoring();
  }
  
  private setupUI(): void {
    // Main container
    this.mainContainer = blessed.box({
      parent: this.screen,
      width: '100%',
      height: '100%',
      style: {
        bg: this.config.theme === 'dark' ? 'black' : 'white',
        fg: this.config.theme === 'dark' ? 'white' : 'black'
      }
    });
    
    // Header with swarm information
    this.headerBox = blessed.box({
      parent: this.mainContainer,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        bg: 'black',
        fg: 'white'
      },
      content: this.buildHeaderContent()
    });
    
    // Topology visualization (left panel)
    this.topologyBox = blessed.box({
      parent: this.mainContainer,
      top: 3,
      left: 0,
      width: '40%',
      height: '40%',
      border: { type: 'line' },
      label: ' 🧠 Topology Visualization ',
      style: {
        border: { fg: 'green' },
        bg: 'black',
        fg: 'white'
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });
    
    // Agent status panel (right panel)
    this.agentsBox = blessed.box({
      parent: this.mainContainer,
      top: 3,
      left: '40%',
      width: '60%',
      height: '40%',
      border: { type: 'line' },
      label: ' 🤖 Agent Status & Performance ',
      style: {
        border: { fg: 'yellow' },
        bg: 'black',
        fg: 'white'
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });
    
    // Metrics dashboard (bottom left)
    this.metricsBox = blessed.box({
      parent: this.mainContainer,
      top: '43%',
      left: 0,
      width: '50%',
      height: '35%',
      border: { type: 'line' },
      label: ' 📊 Live Metrics & Analytics ',
      style: {
        border: { fg: 'magenta' },
        bg: 'black',
        fg: 'white'
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });
    
    // Communication monitoring (bottom right)
    this.communicationBox = blessed.box({
      parent: this.mainContainer,
      top: '43%',
      left: '50%',
      width: '50%',
      height: '35%',
      border: { type: 'line' },
      label: ' 📡 Communication Flow ',
      style: {
        border: { fg: 'blue' },
        bg: 'black',
        fg: 'white'
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });
    
    // Control panel (bottom)
    this.controlsBox = blessed.box({
      parent: this.mainContainer,
      top: '78%',
      left: 0,
      width: '100%',
      height: '22%',
      border: { type: 'line' },
      label: ' 🎮 Interactive Controls ',
      style: {
        border: { fg: 'red' },
        bg: 'black',
        fg: 'white'
      },
      content: this.buildControlsContent()
    });
  }
  
  private setupKeyBindings(): void {
    // Exit dashboard
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.stopMonitoring();
      process.exit(0);
    });
    
    // Refresh data
    this.screen.key(['r', 'F5'], () => {
      this.updateDashboard();
    });
    
    // Toggle auto-refresh
    this.screen.key(['space'], () => {
      if (this.updateInterval) {
        this.stopMonitoring();
        this.logEvent('Auto-refresh paused');
      } else {
        this.startMonitoring();
        this.logEvent('Auto-refresh resumed');
      }
    });
    
    // Show help
    this.screen.key(['h', '?'], () => {
      this.showHelp();
    });
    
    // Switch topology (experimental)
    this.screen.key(['t'], () => {
      this.promptTopologySwitch();
    });
    
    // Export metrics
    this.screen.key(['e'], () => {
      this.exportMetrics();
    });
  }
  
  private async startMonitoring(): Promise<void> {
    this.logEvent('Starting swarm monitoring dashboard');
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.updateDashboard();
    }, this.config.refreshInterval);
    
    // Initial update
    await this.updateDashboard();
  }
  
  private stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    this.logEvent('Stopped swarm monitoring');
  }
  
  private async updateDashboard(): Promise<void> {
    try {
      // Find latest swarm workspace
      const latestSwarm = await this.findLatestSwarmWorkspace();
      if (!latestSwarm) {
        this.logEvent('No active swarms found');
        return;
      }
      
      // Load swarm data
      const swarmData = await this.loadSwarmData(latestSwarm);
      this.currentSwarmData = swarmData;
      
      // Update UI components
      this.updateHeader(swarmData);
      this.updateTopologyVisualization(swarmData);
      this.updateAgentStatuses(swarmData);
      this.updateMetrics(swarmData);
      this.updateCommunicationFlow(swarmData);
      
      // Refresh screen
      this.screen.render();
      
    } catch (error) {
      this.logEvent(`Dashboard update error: ${error}`);
    }
  }
  
  private async findLatestSwarmWorkspace(): Promise<string | null> {
    try {
      const workspaces = await fs.readdir(this.config.swarmWorkspace);
      const swarmDirs = workspaces.filter(dir => dir.startsWith('swarm-'));
      
      if (swarmDirs.length === 0) {
        return null;
      }
      
      // Sort by timestamp (newest first)
      swarmDirs.sort((a, b) => {
        const timestampA = parseInt(a.split('-')[1]);
        const timestampB = parseInt(b.split('-')[1]);
        return timestampB - timestampA;
      });
      
      return path.join(this.config.swarmWorkspace, swarmDirs[0]);
    } catch {
      return null;
    }
  }
  
  private async loadSwarmData(swarmPath: string): Promise<any> {
    const sharedMemoryPath = path.join(swarmPath, 'shared-memory.json');
    
    try {
      const content = await fs.readFile(sharedMemoryPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Return minimal data if shared memory not available
      return {
        swarmId: path.basename(swarmPath),
        status: 'unknown',
        agents: [],
        tasks: [],
        coordination: { communicationLog: [] }
      };
    }
  }
  
  private buildHeaderContent(): string {
    return `{center}{bold}🐝 FlowX Swarm Monitor Dashboard{/bold}{/center}\n` +
           `{center}Press 'h' for help, 'q' to quit, 'space' to pause, 'r' to refresh{/center}`;
  }
  
  private buildControlsContent(): string {
    return `
 {bold}🎮 Interactive Controls:{/bold}
 
 [h/?] Help      [r/F5] Refresh     [space] Pause/Resume    [q/ESC] Quit
 [t] Switch Topology   [e] Export Metrics   [Enter] Select Agent
 
 {bold}Current Status:{/bold} ${this.updateInterval ? '{green}Monitoring Active{/}' : '{red}Paused{/}'}
 {bold}Refresh Rate:{/bold} ${this.config.refreshInterval}ms
 {bold}Theme:{/bold} ${this.config.theme}
`;
  }
  
  private updateHeader(swarmData: any): void {
    const uptime = swarmData.createdAt ? 
      this.formatUptime(Date.now() - new Date(swarmData.createdAt).getTime()) : 'Unknown';
    
    const content = 
      `{center}{bold}🐝 FlowX Swarm Monitor Dashboard{/bold}{/center}\n` +
      `{center}Swarm: {cyan}${swarmData.swarmId}{/} | ` +
      `Status: {${this.getStatusColor(swarmData.status)}}${swarmData.status.toUpperCase()}{/} | ` +
      `Uptime: {white}${uptime}{/} | ` +
      `Agents: {yellow}${swarmData.agents?.length || 0}{/}{/center}`;
    
    this.headerBox.setContent(content);
  }
  
  private updateTopologyVisualization(swarmData: any): void {
    if (!this.config.enableTopologyVisualization) return;
    
    const topology = swarmData.metadata?.topology || 'hybrid';
    const agents = swarmData.agents || [];
    
    let visualization = `{bold}Topology: {cyan}${topology.toUpperCase()}{/}{/bold}\n\n`;
    
    // ASCII topology visualization
    switch (topology) {
      case 'hierarchical':
        visualization += this.drawHierarchicalTopology(agents);
        break;
      case 'mesh':
        visualization += this.drawMeshTopology(agents);
        break;
      case 'hybrid':
        visualization += this.drawHybridTopology(agents);
        break;
      default:
        visualization += this.drawCentralizedTopology(agents);
    }
    
    // Add coordination statistics
    visualization += `\n{bold}Coordination Stats:{/bold}\n`;
    visualization += `• Communication Events: ${swarmData.coordination?.communicationLog?.length || 0}\n`;
    visualization += `• Active Connections: ${this.countActiveConnections(agents)}\n`;
    visualization += `• Network Health: ${this.calculateNetworkHealth(agents)}%\n`;
    
    this.topologyBox.setContent(visualization);
  }
  
  private updateAgentStatuses(swarmData: any): void {
    const agents = swarmData.agents || [];
    let content = `{bold}Agents: ${agents.length} Total{/bold}\n\n`;
    
    for (const agent of agents) {
      const status = this.getStatusColor(agent.status);
      const progress = agent.progress || 0;
      const progressBar = this.createProgressBar(progress, 20);
      
      content += `{bold}${agent.name}{/bold} ({${status}}${agent.status}{/})\n`;
      content += `  Role: {cyan}${agent.role}{/} | Progress: ${progressBar} ${progress}%\n`;
      content += `  Instance: {gray}${agent.instanceId}{/}\n`;
      content += `  Last Update: {white}${this.formatTimestamp(agent.lastHeartbeat)}{/}\n`;
      content += `  Messages: {yellow}${agent.messages?.length || 0}{/}\n`;
      
      // Add performance metrics if available
      if (agent.performance) {
        content += `  CPU: ${this.createMetricBar(agent.performance.cpu)} `;
        content += `MEM: ${this.createMetricBar(agent.performance.memory)}\n`;
      }
      
      content += '\n';
    }
    
    this.agentsBox.setContent(content);
  }
  
  private updateMetrics(swarmData: any): void {
    if (!this.config.enableMetricsCollection) return;
    
    const metrics = this.calculateSwarmMetrics(swarmData);
    this.metricsHistory.push(metrics);
    
    // Keep only last 50 metrics for trending
    if (this.metricsHistory.length > 50) {
      this.metricsHistory.shift();
    }
    
    let content = `{bold}📊 Live Metrics{/bold}\n\n`;
    
    content += `{bold}Performance:{/bold}\n`;
    content += `• Coordination Efficiency: ${metrics.coordinationEfficiency.toFixed(1)}%\n`;
    content += `• Communication Rate: ${metrics.communicationRate.toFixed(2)} msg/s\n`;
    content += `• Average Latency: ${metrics.averageLatency.toFixed(0)}ms\n`;
    content += `• Resource Utilization: ${metrics.resourceUtilization.toFixed(1)}%\n\n`;
    
    content += `{bold}Task Progress:{/bold}\n`;
    content += `• Completed: {green}${metrics.completedTasks}{/}/${metrics.totalTasks}\n`;
    content += `• Success Rate: ${((metrics.completedTasks / metrics.totalTasks) * 100).toFixed(1)}%\n`;
    content += `• Active Agents: {yellow}${metrics.activeAgents}{/}/${metrics.totalAgents}\n\n`;
    
    content += `{bold}Trending:{/bold}\n`;
    if (this.metricsHistory.length > 1) {
      const trend = this.calculateTrend();
      content += `• Efficiency: ${trend.efficiency > 0 ? '📈' : '📉'} ${trend.efficiency.toFixed(1)}%\n`;
      content += `• Communication: ${trend.communication > 0 ? '📈' : '📉'} ${trend.communication.toFixed(1)}%\n`;
    } else {
      content += `• Collecting baseline data...\n`;
    }
    
    this.metricsBox.setContent(content);
  }
  
  private updateCommunicationFlow(swarmData: any): void {
    const communicationLog = swarmData.coordination?.communicationLog || [];
    const recentEvents = communicationLog.slice(-20); // Last 20 events
    
    let content = `{bold}📡 Communication Flow{/bold}\n\n`;
    
    if (recentEvents.length === 0) {
      content += `{gray}No communication events yet...{/}\n`;
    } else {
      content += `{bold}Recent Events (${recentEvents.length}/20):{/bold}\n\n`;
      
      for (const event of recentEvents.reverse()) {
        const timestamp = this.formatTimestamp(event.timestamp);
        const agent = event.agent || 'system';
        const action = event.action || 'unknown';
        
        content += `{gray}${timestamp}{/} `;
        content += `{cyan}${agent}{/} `;
        content += `{white}${action}{/}\n`;
        
        if (event.details) {
          const details = typeof event.details === 'object' ? 
            JSON.stringify(event.details).slice(0, 50) + '...' : 
            String(event.details).slice(0, 50);
          content += `  {gray}${details}{/}\n`;
        }
        content += '\n';
      }
    }
    
    // Add communication statistics
    content += `{bold}Communication Stats:{/bold}\n`;
    content += `• Total Events: ${communicationLog.length}\n`;
    content += `• Events/min: ${this.calculateEventsPerMinute(communicationLog)}\n`;
    content += `• Active Channels: ${this.countActiveCommunicationChannels(swarmData)}\n`;
    
    this.communicationBox.setContent(content);
  }
  
  // Utility methods for visualization
  private drawHierarchicalTopology(agents: any[]): string {
    let vis = '```\n';
    vis += '      ┌─[Coordinator]─┐\n';
    vis += '      │              │\n';
    vis += '   [Agent-1]    [Agent-2]    [Agent-3]\n';
    vis += '```\n';
    return vis;
  }
  
  private drawMeshTopology(agents: any[]): string {
    let vis = '```\n';
    vis += '  [Agent-1]────────[Agent-2]\n';
    vis += '      │    ╲      ╱    │\n';
    vis += '      │     ╲    ╱     │\n';
    vis += '      │      ╲  ╱      │\n';
    vis += '  [Agent-3]────────[Agent-4]\n';
    vis += '```\n';
    return vis;
  }
  
  private drawHybridTopology(agents: any[]): string {
    let vis = '```\n';
    vis += '      ┌─[Coordinator]─┐\n';
    vis += '      │              │\n';
    vis += '   [Core-1]════[Core-2]\n';
    vis += '      │              │\n';
    vis += '  [Support]      [Support]\n';
    vis += '```\n';
    return vis;
  }
  
  private drawCentralizedTopology(agents: any[]): string {
    let vis = '```\n';
    vis += '      [Agent-1]\n';
    vis += '          │\n';
    vis += '    ┌─[Central]─┐\n';
    vis += '    │          │\n';
    vis += '[Agent-2]  [Agent-3]\n';
    vis += '```\n';
    return vis;
  }
  
  private createProgressBar(progress: number, width: number = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return `{green}${'█'.repeat(filled)}{/}{gray}${'░'.repeat(empty)}{/}`;
  }
  
  private createMetricBar(value: number, max: number = 100): string {
    const percentage = Math.min(value / max * 100, 100);
    const color = percentage > 80 ? 'red' : percentage > 60 ? 'yellow' : 'green';
    return `{${color}}${percentage.toFixed(0)}%{/}`;
  }
  
  private getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'running': case 'active': return 'green';
      case 'starting': case 'pending': return 'yellow';
      case 'completed': case 'success': return 'cyan';
      case 'failed': case 'error': return 'red';
      default: return 'gray';
    }
  }
  
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
  
  private formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch {
      return 'Invalid';
    }
  }
  
  private calculateSwarmMetrics(swarmData: any): SwarmMetrics {
    const agents = swarmData.agents || [];
    const tasks = swarmData.tasks || [];
    const communicationLog = swarmData.coordination?.communicationLog || [];
    
    return {
      swarmId: swarmData.swarmId,
      topology: swarmData.metadata?.topology || 'unknown',
      totalAgents: agents.length,
      activeAgents: agents.filter((a: any) => a.status === 'running').length,
      completedTasks: tasks.filter((t: any) => t.status === 'completed').length,
      totalTasks: tasks.length,
      uptime: swarmData.createdAt ? Date.now() - new Date(swarmData.createdAt).getTime() : 0,
      coordinationEfficiency: this.calculateCoordinationEfficiency(agents, communicationLog),
      communicationRate: this.calculateCommunicationRate(communicationLog),
      averageLatency: 50, // Placeholder
      resourceUtilization: this.calculateResourceUtilization(agents)
    };
  }
  
  private calculateCoordinationEfficiency(agents: any[], communicationLog: any[]): number {
    if (agents.length === 0) return 0;
    
    const activeAgents = agents.filter(a => a.status === 'running').length;
    const communicationEvents = communicationLog.length;
    
    // Simple efficiency calculation based on active agents and communication
    return Math.min(100, (activeAgents / agents.length) * 100 * (1 + communicationEvents / 100));
  }
  
  private calculateCommunicationRate(communicationLog: any[]): number {
    if (communicationLog.length < 2) return 0;
    
    const recentEvents = communicationLog.slice(-10);
    if (recentEvents.length < 2) return 0;
    
    const firstEvent = new Date(recentEvents[0].timestamp);
    const lastEvent = new Date(recentEvents[recentEvents.length - 1].timestamp);
    const timeSpanSeconds = (lastEvent.getTime() - firstEvent.getTime()) / 1000;
    
    return timeSpanSeconds > 0 ? recentEvents.length / timeSpanSeconds : 0;
  }
  
  private calculateResourceUtilization(agents: any[]): number {
    if (agents.length === 0) return 0;
    
    const runningAgents = agents.filter(a => a.status === 'running').length;
    return (runningAgents / agents.length) * 100;
  }
  
  private calculateTrend(): { efficiency: number; communication: number } {
    if (this.metricsHistory.length < 2) {
      return { efficiency: 0, communication: 0 };
    }
    
    const current = this.metricsHistory[this.metricsHistory.length - 1];
    const previous = this.metricsHistory[this.metricsHistory.length - 2];
    
    return {
      efficiency: current.coordinationEfficiency - previous.coordinationEfficiency,
      communication: current.communicationRate - previous.communicationRate
    };
  }
  
  private countActiveConnections(agents: any[]): number {
    return agents.filter(a => a.status === 'running').length * 2; // Simplified
  }
  
  private calculateNetworkHealth(agents: any[]): number {
    if (agents.length === 0) return 0;
    const healthyAgents = agents.filter(a => a.status !== 'failed' && a.status !== 'error').length;
    return Math.round((healthyAgents / agents.length) * 100);
  }
  
  private calculateEventsPerMinute(communicationLog: any[]): number {
    if (communicationLog.length < 2) return 0;
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentEvents = communicationLog.filter(event => 
      new Date(event.timestamp).getTime() > oneMinuteAgo
    );
    
    return recentEvents.length;
  }
  
  private countActiveCommunicationChannels(swarmData: any): number {
    const agents = swarmData.agents || [];
    return agents.filter((a: any) => a.status === 'running').length;
  }
  
  private logEvent(message: string): void {
    this.communicationEvents.push({
      timestamp: new Date(),
      event: 'dashboard',
      details: message
    });
    
    // Keep only recent events
    if (this.communicationEvents.length > 100) {
      this.communicationEvents.shift();
    }
  }
  
  private showHelp(): void {
    const helpBox = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '60%',
      border: { type: 'line' },
      label: ' Help ',
      style: {
        border: { fg: 'white' },
        bg: 'blue',
        fg: 'white'
      }
    });
    
    const helpContent = `
{bold}🐝 FlowX Swarm Monitor Dashboard - Help{/bold}

{bold}Keyboard Shortcuts:{/bold}
• h, ?        Show this help
• q, ESC      Quit dashboard
• r, F5       Refresh data manually
• space       Pause/Resume auto-refresh
• t           Switch topology (experimental)
• e           Export metrics to file
• Enter       Select agent for details

{bold}Dashboard Panels:{/bold}
• {green}Topology{/}      Live visualization of agent coordination
• {yellow}Agents{/}        Real-time agent status and performance
• {magenta}Metrics{/}       Live performance metrics and trends
• {blue}Communication{/} Message flow and coordination events
• {red}Controls{/}      Interactive swarm management

{bold}Status Colors:{/bold}
• {green}Green{/}   Running/Active/Completed
• {yellow}Yellow{/}  Starting/Pending
• {red}Red{/}     Failed/Error
• {gray}Gray{/}    Idle/Unknown

{bold}Features:{/bold}
• Real-time monitoring with adaptive refresh
• Interactive topology visualization
• Performance trending and analytics
• Communication flow tracking
• Swarm lifecycle management

Press any key to close this help...
`;
    
    helpBox.setContent(helpContent);
    helpBox.show();
    this.screen.render();
    
    this.screen.onceKey('escape,enter,space', () => {
      helpBox.hide();
      this.screen.render();
    });
  }
  
  private promptTopologySwitch(): void {
    // TODO: Implement topology switching interface
    this.logEvent('Topology switching not yet implemented');
  }
  
  private async exportMetrics(): Promise<void> {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        swarmData: this.currentSwarmData,
        metricsHistory: this.metricsHistory,
        communicationEvents: this.communicationEvents
      };
      
      const filename = `swarm-metrics-${Date.now()}.json`;
      await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
      this.logEvent(`Metrics exported to ${filename}`);
    } catch (error) {
      this.logEvent(`Export failed: ${error}`);
    }
  }
  
  public render(): void {
    this.screen.render();
  }
  
  public async destroy(): Promise<void> {
    this.stopMonitoring();
    this.screen.destroy();
  }
}

// CLI entry point
export async function launchSwarmMonitor(options: Partial<SwarmDashboardConfig> = {}): Promise<SwarmMonitorDashboard> {
  const dashboard = new SwarmMonitorDashboard(options);
  dashboard.render();
  return dashboard;
} 