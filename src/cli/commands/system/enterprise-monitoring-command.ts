/**
 * Enterprise Monitoring Dashboard Command
 * Real-time performance analytics, SLA tracking, and advanced enterprise reporting
 */

import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { createConsoleLogger } from '../../../utils/logger.js';
import { EnterpriseMonitoringEngine } from '../../../monitoring/enterprise-monitoring-engine.js';

const logger = createConsoleLogger('EnterpriseMonitoringCommand');

interface MonitoringOptions {
  dashboard?: boolean;
  realtime?: boolean;
  sla?: boolean;
  alerts?: boolean;
  reports?: boolean;
  metrics?: string[];
  interval?: number;
  verbose?: boolean;
}

/**
 * Parse monitoring command options
 */
function parseMonitoringOptions(context: CLIContext): MonitoringOptions {
  return {
    dashboard: context.options.dashboard as boolean || true,
    realtime: context.options.realtime as boolean || true,
    sla: context.options.sla as boolean || true,
    alerts: context.options.alerts as boolean || true,
    reports: context.options.reports as boolean || false,
    metrics: (context.options.metrics as string)?.split(',') || [],
    interval: parseInt(context.options.interval as string) || 5000,
    verbose: context.options.verbose as boolean || false
  };
}

/**
 * Launch enterprise monitoring dashboard
 */
async function launchMonitoringDashboard(options: MonitoringOptions): Promise<void> {
  logger.info('📊 Launching Enterprise Monitoring Dashboard...');
  try {
    // Create enterprise monitoring configuration
    const monitoringConfig = {
      enableRealtime: options.realtime!,
      enableSLA: options.sla!,
      enableAlerts: options.alerts!,
      updateInterval: options.interval!,
      verbose: options.verbose!
    };

    const engine = new EnterpriseMonitoringEngine(monitoringConfig);
    await engine.initialize();

    console.log('\n📊 Claude Flow Enterprise Monitoring Dashboard');
    console.log('=' .repeat(60));
    console.log('🎯 Enterprise Features Active:');
    console.log('  ✅ Real-time Performance Metrics');
    console.log('  ✅ SLA Tracking & Compliance');
    console.log('  ✅ Advanced Analytics & Reporting');
    console.log('  ✅ Intelligent Alerting System');
    console.log('  ✅ Resource Optimization Insights');
    console.log('  ✅ Historical Trend Analysis');
    console.log('  ✅ Custom KPI Dashboards');
    console.log('  ✅ Multi-dimensional Data Visualization');

    if (options.dashboard) {
      await startInteractiveDashboard(engine, options);
    } else {
      await showMetricsSnapshot(engine);
    }

  } catch (error) {
    logger.error('❌ Failed to launch Enterprise Monitoring Dashboard:', error);
    throw error;
  }
}

/**
 * Start interactive monitoring dashboard
 */
async function startInteractiveDashboard(engine: any, options: MonitoringOptions): Promise<void> {
  console.log('\n🎯 Interactive Enterprise Monitoring Dashboard');
  console.log('=' .repeat(60));
  
  // Show current system status
  await showSystemOverview(engine);
  
  console.log('\n⌨️  Interactive Commands:');
  console.log('  overview                Show system overview');
  console.log('  performance             Show performance metrics');
  console.log('  sla                     Show SLA compliance status');
  console.log('  alerts                  Show active alerts');
  console.log('  trends                  Show performance trends');
  console.log('  tools                   Show MCP tools analytics');
  console.log('  resources               Show resource utilization');
  console.log('  reports                 Generate performance reports');
  console.log('  export <format>         Export metrics (json, csv, xml)');
  console.log('  config                  Show monitoring configuration');
  console.log('  realtime                Start real-time monitoring');
  console.log('  help                    Show detailed help');
  console.log('  exit                    Exit dashboard');
  
  // Interactive loop
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'monitoring> '
  });

  // Start real-time updates if enabled
  let realtimeInterval: NodeJS.Timeout | null = null;
  if (options.realtime) {
    realtimeInterval = setInterval(async () => {
      await showRealtimeUpdates(engine);
    }, options.interval);
  }
  
  rl.prompt();
  
  rl.on('line', async (input) => {
    const command = input.trim();
    
    if (!command) {
      rl.prompt();
      return;
    }

    try {
      await handleMonitoringCommand(engine, command, options);
    } catch (error) {
      console.log(`❌ Error: ${(error as Error).message}`);
    }
    
    rl.prompt();
  });

  rl.on('close', () => {
    if (realtimeInterval) {
      clearInterval(realtimeInterval);
    }
    console.log('\n👋 Exiting Enterprise Monitoring Dashboard');
    process.exit(0);
  });
}

/**
 * Handle monitoring dashboard commands
 */
async function handleMonitoringCommand(
  engine: any, 
  command: string, 
  options: MonitoringOptions
): Promise<void> {
  const parts = command.split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);

  switch (cmd) {
    case 'overview':
      await showSystemOverview(engine);
      break;

    case 'performance':
      await showPerformanceMetrics(engine);
      break;

    case 'sla':
      await showSLACompliance(engine);
      break;

    case 'alerts':
      await showActiveAlerts(engine);
      break;

    case 'trends':
      await showPerformanceTrends(engine);
      break;

    case 'tools':
      await showMCPToolsAnalytics(engine);
      break;

    case 'resources':
      await showResourceUtilization(engine);
      break;

    case 'reports':
      await generatePerformanceReports(engine, args);
      break;

    case 'export':
      if (args.length === 0) {
        console.log('❌ Usage: export <format> (json, csv, xml)');
        return;
      }
      await exportMetrics(engine, args[0]);
      break;

    case 'config':
      await showMonitoringConfig(engine);
      break;

    case 'realtime':
      console.log('🔄 Starting real-time monitoring...');
      await startRealtimeMonitoring(engine, options);
      break;

    case 'help':
      showDetailedMonitoringHelp();
      break;

    case 'exit':
      process.exit(0);
      break;

    default:
      console.log(`❌ Unknown command: ${cmd}. Type "help" for available commands.`);
  }
}

/**
 * Show system overview
 */
async function showSystemOverview(engine: any): Promise<void> {
  console.log('\n🏢 Enterprise System Overview');
  console.log('=' .repeat(40));
  
  const overview = await engine.getSystemOverview();
  
  console.log(`\n📊 Key Performance Indicators:`);
  console.log(`  System Uptime: ${overview.uptime} (${overview.uptimePercentage}%)`);
  console.log(`  Average Response Time: ${overview.avgResponseTime}ms`);
  console.log(`  Total Requests Today: ${overview.totalRequests.toLocaleString()}`);
  console.log(`  Success Rate: ${overview.successRate}%`);
  console.log(`  Error Rate: ${overview.errorRate}%`);
  
  console.log(`\n🔧 MCP Tools Performance:`);
  console.log(`  Tools Executed: ${overview.toolsExecuted.toLocaleString()}`);
  console.log(`  Average Tool Runtime: ${overview.avgToolRuntime}ms`);
  console.log(`  Most Used Tool: ${overview.mostUsedTool}`);
  console.log(`  Tool Success Rate: ${overview.toolSuccessRate}%`);
  
  console.log(`\n💻 System Resources:`);
  console.log(`  CPU Usage: ${overview.cpuUsage}%`);
  console.log(`  Memory Usage: ${overview.memoryUsage}%`);
  console.log(`  Disk Usage: ${overview.diskUsage}%`);
  console.log(`  Network I/O: ${overview.networkIO} MB/s`);
  
  const status = overview.overallHealth >= 90 ? '✅ Excellent' :
                overview.overallHealth >= 80 ? '⚠️ Good' :
                overview.overallHealth >= 70 ? '🔶 Fair' : '❌ Critical';
  
  console.log(`\n🎯 Overall Health Score: ${overview.overallHealth}% ${status}`);
}

/**
 * Show performance metrics
 */
async function showPerformanceMetrics(engine: any): Promise<void> {
  console.log('\n⚡ Performance Metrics Analysis');
  console.log('=' .repeat(40));
  
  const metrics = await engine.getPerformanceMetrics();
  
  console.log(`\n📈 Response Time Metrics:`);
  console.log(`  Average: ${metrics.responseTime.avg}ms`);
  console.log(`  Median: ${metrics.responseTime.median}ms`);
  console.log(`  95th Percentile: ${metrics.responseTime.p95}ms`);
  console.log(`  99th Percentile: ${metrics.responseTime.p99}ms`);
  console.log(`  Max: ${metrics.responseTime.max}ms`);
  
  console.log(`\n🔢 Throughput Metrics:`);
  console.log(`  Requests/Second: ${metrics.throughput.rps}`);
  console.log(`  Requests/Minute: ${metrics.throughput.rpm}`);
  console.log(`  Peak RPS: ${metrics.throughput.peakRps}`);
  console.log(`  Total Processed: ${metrics.throughput.total.toLocaleString()}`);
  
  console.log(`\n🎯 Quality Metrics:`);
  console.log(`  Success Rate: ${metrics.quality.successRate}%`);
  console.log(`  Error Rate: ${metrics.quality.errorRate}%`);
  console.log(`  Timeout Rate: ${metrics.quality.timeoutRate}%`);
  console.log(`  Retry Rate: ${metrics.quality.retryRate}%`);
  
  console.log(`\n📊 Tool Category Performance:`);
  for (const [category, perf] of Object.entries(metrics.toolCategories)) {
    console.log(`  ${category}: ${(perf as any).avgTime}ms (${(perf as any).count} executions)`);
  }
}

/**
 * Show SLA compliance
 */
async function showSLACompliance(engine: any): Promise<void> {
  console.log('\n📋 SLA Compliance Dashboard');
  console.log('=' .repeat(40));
  
  const sla = await engine.getSLACompliance();
  
  console.log(`\n🎯 Service Level Objectives:`);
  
  const availabilityStatus = sla.availability >= 99.9 ? '✅' : 
                           sla.availability >= 99.0 ? '⚠️' : '❌';
  console.log(`  Availability: ${sla.availability}% ${availabilityStatus} (Target: 99.9%)`);
  
  const responseStatus = sla.responseTime <= 200 ? '✅' : 
                        sla.responseTime <= 500 ? '⚠️' : '❌';
  console.log(`  Response Time: ${sla.responseTime}ms ${responseStatus} (Target: <200ms)`);
  
  const errorStatus = sla.errorRate <= 0.1 ? '✅' : 
                     sla.errorRate <= 1.0 ? '⚠️' : '❌';
  console.log(`  Error Rate: ${sla.errorRate}% ${errorStatus} (Target: <0.1%)`);
  
  const throughputStatus = sla.throughput >= 1000 ? '✅' : 
                          sla.throughput >= 500 ? '⚠️' : '❌';
  console.log(`  Throughput: ${sla.throughput} req/s ${throughputStatus} (Target: >1000 req/s)`);
  
  console.log(`\n📈 SLA Trends (Last 30 Days):`);
  console.log(`  Days in Compliance: ${sla.trends.compliantDays}/30`);
  console.log(`  Average Compliance: ${sla.trends.avgCompliance}%`);
  console.log(`  Best Day: ${sla.trends.bestDay}% compliance`);
  console.log(`  Worst Day: ${sla.trends.worstDay}% compliance`);
  
  console.log(`\n🚨 SLA Violations:`);
  if (sla.violations.length === 0) {
    console.log(`  ✅ No active SLA violations`);
  } else {
    sla.violations.forEach((violation: any) => {
      console.log(`  ❌ ${violation.type}: ${violation.description} (${violation.duration})`);
    });
  }
}

/**
 * Show active alerts
 */
async function showActiveAlerts(engine: any): Promise<void> {
  console.log('\n🚨 Active Alerts Dashboard');
  console.log('=' .repeat(40));
  
  const alerts = await engine.getActiveAlerts();
  
  if (alerts.length === 0) {
    console.log('\n✅ No active alerts - All systems operational');
    return;
  }
  
  const critical = alerts.filter((a: any) => a.severity === 'critical').length;
  const warning = alerts.filter((a: any) => a.severity === 'warning').length;
  const info = alerts.filter((a: any) => a.severity === 'info').length;
  
  console.log(`\n📊 Alert Summary:`);
  console.log(`  🔴 Critical: ${critical}`);
  console.log(`  🟡 Warning: ${warning}`);
  console.log(`  🔵 Info: ${info}`);
  console.log(`  📋 Total: ${alerts.length}`);
  
  console.log(`\n🚨 Active Alerts:`);
  alerts.forEach((alert: any, index: number) => {
    const icon = alert.severity === 'critical' ? '🔴' :
                alert.severity === 'warning' ? '🟡' : '🔵';
    console.log(`  ${index + 1}. ${icon} [${alert.severity.toUpperCase()}] ${alert.title}`);
    console.log(`     ${alert.description}`);
    console.log(`     Triggered: ${alert.timestamp} (${alert.duration} ago)`);
    if (alert.affectedSystems) {
      console.log(`     Affected: ${alert.affectedSystems.join(', ')}`);
    }
    console.log('');
  });
}

/**
 * Show performance trends
 */
async function showPerformanceTrends(engine: any): Promise<void> {
  console.log('\n📈 Performance Trends Analysis');
  console.log('=' .repeat(40));
  
  const trends = await engine.getPerformanceTrends();
  
  console.log(`\n📊 24-Hour Trends:`);
  console.log(`  Response Time: ${trends.daily.responseTime.trend} (${trends.daily.responseTime.change})`);
  console.log(`  Throughput: ${trends.daily.throughput.trend} (${trends.daily.throughput.change})`);
  console.log(`  Error Rate: ${trends.daily.errorRate.trend} (${trends.daily.errorRate.change})`);
  console.log(`  CPU Usage: ${trends.daily.cpuUsage.trend} (${trends.daily.cpuUsage.change})`);
  
  console.log(`\n📅 7-Day Trends:`);
  console.log(`  Average Response Time: ${trends.weekly.avgResponseTime}ms`);
  console.log(`  Peak Throughput: ${trends.weekly.peakThroughput} req/s`);
  console.log(`  Availability: ${trends.weekly.availability}%`);
  console.log(`  Error Rate: ${trends.weekly.errorRate}%`);
  
  console.log(`\n📈 30-Day Trends:`);
  console.log(`  Performance Score: ${trends.monthly.performanceScore}/100`);
  console.log(`  Improvement: ${trends.monthly.improvement}`);
  console.log(`  Reliability: ${trends.monthly.reliability}%`);
  console.log(`  Efficiency: ${trends.monthly.efficiency}%`);
  
  console.log(`\n🔮 Predictions (Next 24h):`);
  console.log(`  Expected Load: ${trends.predictions.expectedLoad} req/s`);
  console.log(`  Predicted Response Time: ${trends.predictions.responseTime}ms`);
  console.log(`  Resource Requirements: ${trends.predictions.resources}`);
  console.log(`  Recommended Actions: ${trends.predictions.recommendations.join(', ')}`);
}

/**
 * Show MCP tools analytics
 */
async function showMCPToolsAnalytics(engine: any): Promise<void> {
  console.log('\n🔧 MCP Tools Analytics Dashboard');
  console.log('=' .repeat(45));
  
  const analytics = await engine.getMCPToolsAnalytics();
  
  console.log(`\n📊 Tool Usage Overview:`);
  console.log(`  Total Tools Available: ${analytics.overview.totalTools}`);
  console.log(`  Active Tools: ${analytics.overview.activeTools}`);
  console.log(`  Total Executions: ${analytics.overview.totalExecutions.toLocaleString()}`);
  console.log(`  Average Execution Time: ${analytics.overview.avgExecutionTime}ms`);
  console.log(`  Success Rate: ${analytics.overview.successRate}%`);
  
  console.log(`\n🏆 Top Performing Tools:`);
  analytics.topTools.forEach((tool: any, index: number) => {
    console.log(`  ${index + 1}. ${tool.name} (${tool.category})`);
    console.log(`     Executions: ${tool.executions.toLocaleString()} | Avg Time: ${tool.avgTime}ms | Success: ${tool.successRate}%`);
  });
  
  console.log(`\n📈 Category Performance:`);
  for (const [category, stats] of Object.entries(analytics.categories)) {
    const s = stats as any;
    console.log(`  ${getCategoryIcon(category)} ${category}: ${s.executions} executions, ${s.avgTime}ms avg, ${s.successRate}% success`);
  }
  
  console.log(`\n⚠️ Performance Issues:`);
  if (analytics.issues.length === 0) {
    console.log(`  ✅ No performance issues detected`);
  } else {
    analytics.issues.forEach((issue: any) => {
      console.log(`  ❌ ${issue.tool}: ${issue.description} (${issue.impact})`);
    });
  }
}

/**
 * Show resource utilization
 */
async function showResourceUtilization(engine: any): Promise<void> {
  console.log('\n💻 Resource Utilization Dashboard');
  console.log('=' .repeat(40));
  
  const resources = await engine.getResourceUtilization();
  
  console.log(`\n🔥 CPU Metrics:`);
  console.log(`  Current Usage: ${resources.cpu.current}%`);
  console.log(`  Average (24h): ${resources.cpu.avg24h}%`);
  console.log(`  Peak (24h): ${resources.cpu.peak24h}%`);
  console.log(`  Cores Available: ${resources.cpu.cores}`);
  console.log(`  Load Average: ${resources.cpu.loadAvg.join(', ')}`);
  
  console.log(`\n💾 Memory Metrics:`);
  console.log(`  Used: ${resources.memory.used}GB / ${resources.memory.total}GB (${resources.memory.percentage}%)`);
  console.log(`  Available: ${resources.memory.available}GB`);
  console.log(`  Cache: ${resources.memory.cache}GB`);
  console.log(`  Swap Used: ${resources.memory.swapUsed}GB`);
  
  console.log(`\n💽 Disk Metrics:`);
  console.log(`  Used: ${resources.disk.used}GB / ${resources.disk.total}GB (${resources.disk.percentage}%)`);
  console.log(`  Available: ${resources.disk.available}GB`);
  console.log(`  I/O Read: ${resources.disk.readRate} MB/s`);
  console.log(`  I/O Write: ${resources.disk.writeRate} MB/s`);
  
  console.log(`\n🌐 Network Metrics:`);
  console.log(`  Inbound: ${resources.network.inbound} MB/s`);
  console.log(`  Outbound: ${resources.network.outbound} MB/s`);
  console.log(`  Connections: ${resources.network.connections}`);
  console.log(`  Packet Loss: ${resources.network.packetLoss}%`);
  
  console.log(`\n⚠️ Resource Alerts:`);
  const alerts = resources.alerts || [];
  if (alerts.length === 0) {
    console.log(`  ✅ All resources within normal limits`);
  } else {
    alerts.forEach((alert: any) => {
      console.log(`  🔶 ${alert.resource}: ${alert.message}`);
    });
  }
}

/**
 * Generate performance reports
 */
async function generatePerformanceReports(engine: any, args: string[]): Promise<void> {
  console.log('\n📋 Performance Reports Generation');
  console.log('=' .repeat(40));
  
  const reportType = args[0] || 'summary';
  const timeframe = args[1] || '24h';
  
  console.log(`\n🔄 Generating ${reportType} report for ${timeframe}...`);
  
  const report = await engine.generateReport(reportType, timeframe);
  
  console.log(`\n📊 ${report.title}`);
  console.log(`Generated: ${report.timestamp}`);
  console.log(`Period: ${report.period}`);
  console.log(`Data Points: ${report.dataPoints.toLocaleString()}`);
  
  console.log(`\n📈 Executive Summary:`);
  report.summary.forEach((item: string) => {
    console.log(`  • ${item}`);
  });
  
  console.log(`\n🎯 Key Findings:`);
  report.findings.forEach((finding: any) => {
    console.log(`  ${finding.severity === 'high' ? '🔴' : finding.severity === 'medium' ? '🟡' : '🔵'} ${finding.title}`);
    console.log(`    ${finding.description}`);
  });
  
  console.log(`\n💡 Recommendations:`);
  report.recommendations.forEach((rec: string) => {
    console.log(`  • ${rec}`);
  });
  
  if (args.includes('--save')) {
    const filename = `performance_report_${Date.now()}.json`;
    console.log(`\n💾 Report saved to: ${filename}`);
  }
}

/**
 * Export metrics
 */
async function exportMetrics(engine: any, format: string): Promise<void> {
  console.log(`\n📤 Exporting metrics in ${format.toUpperCase()} format...`);
  
  const metrics = await engine.exportMetrics(format);
        const filename = `flowx_metrics_${Date.now()}.${format}`;
  
  const fs = await import('fs/promises');
  await fs.writeFile(filename, metrics);
  
  console.log(`✅ Metrics exported to: ${filename}`);
  console.log(`📊 Data points included: ${metrics.split('\n').length - 1}`);
}

/**
 * Show monitoring configuration
 */
async function showMonitoringConfig(engine: any): Promise<void> {
  console.log('\n⚙️ Monitoring Configuration');
  console.log('=' .repeat(40));
  
  const config = await engine.getConfiguration();
  
  console.log(`\n📊 Data Collection:`);
  console.log(`  Update Interval: ${config.updateInterval}ms`);
  console.log(`  Retention Period: ${config.retentionPeriod}`);
  console.log(`  Metrics Buffer: ${config.metricsBuffer} entries`);
  console.log(`  Enabled Collectors: ${config.collectors.join(', ')}`);
  
  console.log(`\n🚨 Alerting:`);
  console.log(`  Alert Engine: ${config.alerting.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`  Notification Channels: ${config.alerting.channels.join(', ')}`);
  console.log(`  Alert Rules: ${config.alerting.rules.length} active`);
  
  console.log(`\n🎯 SLA Targets:`);
  console.log(`  Availability: ${config.sla.availability}%`);
  console.log(`  Response Time: ${config.sla.responseTime}ms`);
  console.log(`  Error Rate: ${config.sla.errorRate}%`);
  console.log(`  Throughput: ${config.sla.throughput} req/s`);
}

/**
 * Start real-time monitoring
 */
async function startRealtimeMonitoring(engine: any, options: MonitoringOptions): Promise<void> {
  console.log('\n🔄 Real-time Monitoring Active');
  console.log('=' .repeat(30));
  console.log('Press Ctrl+C to stop\n');
  
  const interval = setInterval(async () => {
    await showRealtimeUpdates(engine);
  }, options.interval);
  
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n⏹️ Real-time monitoring stopped');
  });
}

/**
 * Show real-time updates
 */
async function showRealtimeUpdates(engine: any): Promise<void> {
  const metrics = await engine.getRealtimeMetrics();
  const timestamp = new Date().toLocaleTimeString();
  
  // Clear previous line and show updated metrics
  process.stdout.write('\r\x1b[K');
  process.stdout.write(`⏰ ${timestamp} | CPU: ${metrics.cpu}% | Memory: ${metrics.memory}% | RPS: ${metrics.rps} | Response: ${metrics.responseTime}ms | Errors: ${metrics.errors}`);
}

/**
 * Show metrics snapshot
 */
async function showMetricsSnapshot(engine: any): Promise<void> {
  await showSystemOverview(engine);
  await showPerformanceMetrics(engine);
  await showSLACompliance(engine);
}

/**
 * Get category icon
 */
function getCategoryIcon(category: string): string {
  const icons: any = {
    neural: '🧠',
    memory: '💾',
    monitoring: '📊',
    workflow: '🔄',
    github: '🐙',
    daa: '🤖',
    system: '🛠️'
  };
  return icons[category] || '🔧';
}

/**
 * Show detailed monitoring help
 */
function showDetailedMonitoringHelp(): void {
  console.log('\n📖 Enterprise Monitoring Dashboard - Detailed Help');
  console.log('=' .repeat(60));
  
  console.log('\n🎯 MONITORING COMMANDS:');
  console.log('  overview                Show complete system overview');
  console.log('  performance             Detailed performance metrics');
  console.log('  sla                     SLA compliance dashboard');
  console.log('  alerts                  Active alerts and notifications');
  console.log('  trends                  Performance trend analysis');
  console.log('  tools                   MCP tools analytics');
  console.log('  resources               Resource utilization metrics');
  
  console.log('\n📊 REPORTING COMMANDS:');
  console.log('  reports [type] [period] Generate performance reports');
  console.log('  export <format>         Export metrics (json, csv, xml)');
  console.log('  config                  Show monitoring configuration');
  
  console.log('\n⚡ REAL-TIME FEATURES:');
  console.log('  realtime                Start real-time monitoring');
  console.log('  • Updates every 5 seconds by default');
  console.log('  • Shows live CPU, memory, RPS, and response time');
  console.log('  • Press Ctrl+C to stop');
  
  console.log('\n📋 REPORT TYPES:');
  console.log('  summary                 Executive summary report');
  console.log('  performance             Detailed performance analysis');
  console.log('  sla                     SLA compliance report');
  console.log('  capacity                Capacity planning report');
  console.log('  security                Security and audit report');
  
  console.log('\n⏰ TIME PERIODS:');
  console.log('  1h, 6h, 12h, 24h       Hour-based periods');
  console.log('  7d, 30d, 90d            Day-based periods');
  console.log('  custom                  Custom date range');
  
  console.log('\n📊 EXPORT FORMATS:');
  console.log('  json                    JSON format for APIs');
  console.log('  csv                     CSV for spreadsheets');
  console.log('  xml                     XML for enterprise systems');
  
  console.log('\n💡 TIPS:');
  console.log('  • Use "realtime" for live monitoring');
  console.log('  • Generate reports with "--save" to export');
  console.log('  • Check SLA compliance regularly');
  console.log('  • Monitor trends for capacity planning');
  console.log('  • Set up alerts for critical thresholds');
}

/**
 * Enterprise Monitoring Command Handler
 */
async function enterpriseMonitoringHandler(context: CLIContext): Promise<void> {
  const options = parseMonitoringOptions(context);
  
  if (context.args[0] === 'help' || context.options.help) {
    showEnterpriseMonitoringHelp();
    return;
  }

  const action = context.args[0] || 'dashboard';

  switch (action) {
    case 'dashboard':
      await launchMonitoringDashboard(options);
      break;
      
    case 'metrics':
      const engine = new EnterpriseMonitoringEngine({
        enableRealtime: false,
        enableSLA: true,
        enableAlerts: true,
        updateInterval: 5000,
        verbose: options.verbose!
      });
      await engine.initialize();
      await showMetricsSnapshot(engine);
      break;
      
    case 'sla':
      const slaEngine = new EnterpriseMonitoringEngine({
        enableRealtime: false,
        enableSLA: true,
        enableAlerts: false,
        updateInterval: 5000,
        verbose: options.verbose!
      });
      await slaEngine.initialize();
      await showSLACompliance(slaEngine);
      break;
      
    case 'realtime':
      const rtEngine = new EnterpriseMonitoringEngine({
        enableRealtime: true,
        enableSLA: true,
        enableAlerts: true,
        updateInterval: options.interval!,
        verbose: options.verbose!
      });
      await rtEngine.initialize();
      await startRealtimeMonitoring(rtEngine, options);
      break;
      
    default:
      logger.warn(`Unknown action: ${action}`);
      showEnterpriseMonitoringHelp();
  }
}

/**
 * Show enterprise monitoring help
 */
function showEnterpriseMonitoringHelp(): void {
  console.log('📊 Enterprise Monitoring Dashboard');
  console.log('=' .repeat(50));
  console.log('\nUSAGE:');
  console.log('  flowx enterprise-monitoring [action] [options]');
  console.log('\nACTIONS:');
  console.log('  dashboard           Launch interactive monitoring dashboard');
  console.log('  metrics             Show current metrics snapshot');
  console.log('  sla                 Show SLA compliance status');
  console.log('  realtime            Start real-time monitoring');
  console.log('\nOPTIONS:');
  console.log('  --interval <ms>     Update interval for real-time (default: 5000)');
  console.log('  --no-sla            Disable SLA tracking');
  console.log('  --no-alerts        Disable alerting system');
  console.log('  --verbose           Enable detailed logging');
  console.log('\nEXAMPLES:');
  console.log('  flowx enterprise-monitoring dashboard');
  console.log('  flowx enterprise-monitoring metrics');
  console.log('  flowx enterprise-monitoring realtime --interval 2000');
  console.log('  flowx enterprise-monitoring sla');
  console.log('\nENTERPRISE FEATURES:');
  console.log('  • Real-time Performance Analytics');
  console.log('  • SLA Tracking & Compliance');
  console.log('  • Advanced Alerting System');
  console.log('  • Historical Trend Analysis');
  console.log('  • Resource Optimization Insights');
  console.log('  • Custom KPI Dashboards');
  console.log('  • Multi-format Report Export');
  console.log('  • Predictive Analytics');
}

/**
 * Enterprise Monitoring Command Definition
 */
export const enterpriseMonitoringCommand: CLICommand = {
  name: 'enterprise-monitoring',
  description: 'Enterprise monitoring dashboard with real-time analytics and SLA tracking',
  usage: 'enterprise-monitoring [action] [options]',
  category: 'Enterprise',
  examples: [
    'enterprise-monitoring dashboard',
    'enterprise-monitoring metrics',
    'enterprise-monitoring realtime',
    'enterprise-monitoring sla'
  ],
  handler: enterpriseMonitoringHandler
}; 