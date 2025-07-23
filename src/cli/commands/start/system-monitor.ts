/**
 * System Monitor for Claude Flow CLI
 * Monitors system health and process status
 */

import { EventEmitter } from 'node:events';
import { ProcessManager } from './process-manager.js';

export interface MonitoringConfig {
  interval: number;
  alertThresholds: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  processes: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  uptime: number;
  alerts: string[];
}

export class SystemMonitor extends EventEmitter {
  private processManager: ProcessManager;
  private config: MonitoringConfig;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private recentEvents: Array<{ type: string; timestamp: Date; data: any }> = [];
  private maxEvents = 100;

  constructor(processManager: ProcessManager, config?: Partial<MonitoringConfig>) {
    super();
    this.processManager = processManager;
    this.config = {
      interval: 5000, // 5 seconds
      alertThresholds: {
        memoryUsage: 80, // 80%
        cpuUsage: 80,    // 80%
        diskUsage: 90    // 90%
      },
      ...config
    };

    this.setupProcessManagerListeners();
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.interval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval) as unknown as NodeJS.Timeout;

    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval as unknown as number);
      this.interval = null;
    }

    this.emit('stopped');
  }

  getSystemHealth(): SystemHealth {
    const stats = this.processManager.getSystemStats();
    const memoryUsage = process.memoryUsage();
    const alerts: string[] = [];

    // Calculate memory percentage (simplified)
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    // Check thresholds
    if (memoryPercentage > this.config.alertThresholds.memoryUsage) {
      alerts.push(`High memory usage: ${memoryPercentage.toFixed(1)}%`);
    }

    if (stats.errorProcesses > 0) {
      alerts.push(`${stats.errorProcesses} processes in error state`);
    }

    // Determine overall health
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (alerts.length > 0) {
      overall = stats.errorProcesses > 0 ? 'critical' : 'warning';
    }

    return {
      overall,
      processes: stats.runningProcesses,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: memoryPercentage
      },
      cpu: {
        usage: 0 // Simplified for now
      },
      uptime: stats.uptime,
      alerts
    };
  }

  getRecentEvents(limit: number = 50): Array<{ type: string; timestamp: Date; data: any }> {
    return this.recentEvents.slice(-limit);
  }

  printEventLog(limit: number = 20): void {
    const events = this.getRecentEvents(limit);
    console.log(`\n📋 Recent Events (${events.length}):`);
    console.log('─'.repeat(50));
    
    if (events.length === 0) {
      console.log('No recent events');
      return;
    }

    events.forEach(event => {
      const icon = this.getEventIcon(event.type);
      const time = event.timestamp.toLocaleTimeString();
      const message = this.formatEventMessage(event);
      console.log(`${icon} ${time} - ${message}`);
    });
  }

  printSystemHealth(): void {
    const health = this.getSystemHealth();
    const statusIcon = health.overall === 'healthy' ? '✅' : 
                      health.overall === 'warning' ? '⚠️' : '❌';
    
    console.log(`\n${statusIcon} System Health: ${health.overall.toUpperCase()}`);
    console.log('─'.repeat(40));
    console.log(`📊 Processes: ${health.processes} running`);
    console.log(`💾 Memory: ${(health.memory.percentage).toFixed(1)}% (${Math.round(health.memory.used / 1024 / 1024)}MB)`);
    console.log(`⏱️  Uptime: ${this.formatUptime(health.uptime)}`);
    
    if (health.alerts.length > 0) {
      console.log('\n🚨 Alerts:');
      health.alerts.forEach(alert => console.log(`  • ${alert}`));
    }

    // Show recent errors if any
    const errorEvents = this.recentEvents
      .filter(e => e.type === 'system_error' || e.type === 'process_error')
      .slice(-3);
    
    if (errorEvents.length > 0) {
      console.log('\n🔥 Recent Errors:');
      errorEvents.forEach(event => {
        const time = event.timestamp.toLocaleTimeString();
        console.log(`  • ${time} - ${this.formatEventMessage(event)}`);
      });
    }
  }

  private addEvent(type: string, data: any): void {
    const event = {
      type,
      timestamp: new Date(),
      data
    };
    
    this.recentEvents.push(event);
    
    // Keep only the most recent events
    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents = this.recentEvents.slice(-this.maxEvents);
    }
  }

  private getEventIcon(type: string): string {
    const icons: Record<string, string> = {
      'agent_spawned': '🚀',
      'agent_terminated': '🛑',
      'task_assigned': '📋',
      'task_completed': '✅',
      'task_failed': '❌',
      'system_error': '🔥',
      'process_started': '▶️',
      'process_stopped': '⏹️',
      'process_error': '💥'
    };
    return icons[type] || '📌';
  }

  private formatEventMessage(event: { type: string; data: any }): string {
    switch (event.type) {
      case 'agent_spawned':
        return `Agent ${event.data.agentId} spawned`;
      case 'agent_terminated':
        return `Agent ${event.data.agentId} terminated`;
      case 'task_assigned':
        return `Task ${event.data.taskId} assigned to ${event.data.agentId}`;
      case 'task_completed':
        return `Task ${event.data.taskId} completed`;
      case 'task_failed':
        return `Task ${event.data.taskId} failed: ${event.data.error}`;
      case 'system_error':
        return `System error: ${event.data.message}`;
      case 'process_started':
        return `Process ${event.data.processId} started`;
      case 'process_stopped':
        return `Process ${event.data.processId} stopped`;
      case 'process_error':
        return `Process ${event.data.processId} error: ${event.data.error}`;
      default:
        return `${event.type}: ${JSON.stringify(event.data)}`;
    }
  }

  private formatUptime(uptime: number): string {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private performHealthCheck(): void {
    const health = this.getSystemHealth();
    this.emit('healthCheck', health);

    if (health.overall === 'critical') {
      this.emit('criticalAlert', health);
    } else if (health.overall === 'warning') {
      this.emit('warning', health);
    }
  }

  private setupProcessManagerListeners(): void {
    this.processManager.on('processStarted', (data) => {
      this.addEvent('process_started', data);
      this.emit('processEvent', { type: 'started', ...data });
    });

    this.processManager.on('processStopped', (data) => {
      this.addEvent('process_stopped', data);
      this.emit('processEvent', { type: 'stopped', ...data });
    });

    this.processManager.on('processError', (data) => {
      this.addEvent('process_error', data);
      this.emit('processEvent', { type: 'error', ...data });
    });

    this.processManager.on('statusChanged', (data) => {
      this.emit('statusChanged', data);
    });
  }
} 