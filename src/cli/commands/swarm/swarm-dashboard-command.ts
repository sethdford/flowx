import type { CLICommand, CLIContext } from '../../interfaces/index.js';
import { printInfo, printSuccess, printError } from '../../core/output-formatter.js';
import { launchSwarmMonitor, SwarmMonitorDashboard } from '../../../ui/swarm-monitor-dashboard.js';

async function launchDashboard(context: CLIContext): Promise<void> {
  const { args, options } = context;
  
  try {
    printInfo('🚀 Launching FlowX Swarm Monitor Dashboard...');
    
    // Configuration from CLI options
    const dashboardConfig = {
      swarmWorkspace: options.workspace || './swarm-workspaces',
      refreshInterval: parseInt(options.refresh) || 2000,
      enableTopologyVisualization: !options.noTopology,
      enableMetricsCollection: !options.noMetrics,
      enableInteractiveControls: !options.noControls,
      theme: options.theme || 'dark'
    };
    
    printInfo('📊 Dashboard Configuration:');
    printInfo(`   Workspace: ${dashboardConfig.swarmWorkspace}`);
    printInfo(`   Refresh: ${dashboardConfig.refreshInterval}ms`);
    printInfo(`   Theme: ${dashboardConfig.theme}`);
    printInfo(`   Features: ${[
      dashboardConfig.enableTopologyVisualization && 'topology',
      dashboardConfig.enableMetricsCollection && 'metrics', 
      dashboardConfig.enableInteractiveControls && 'controls'
    ].filter(Boolean).join(', ')}`);
    
    printSuccess('✅ Starting real-time swarm monitoring...');
    printInfo('📺 Dashboard will open in a new terminal UI');
    printInfo('💡 Press "h" for help, "q" to quit');
    
    // Launch the dashboard
    const dashboard = await launchSwarmMonitor(dashboardConfig);
    
    // Handle cleanup on exit
    process.on('SIGINT', async () => {
      printInfo('\n🛑 Shutting down dashboard...');
      await dashboard.destroy();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await dashboard.destroy();
      process.exit(0);
    });
    
  } catch (error) {
    printError(`Failed to launch dashboard: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

const swarmDashboardCommand: CLICommand = {
  name: 'dashboard',
  description: 'Launch real-time swarm monitoring dashboard',
  handler: launchDashboard,
  arguments: [],
  options: [
    {
      name: 'workspace',
      short: 'w',
      description: 'Swarm workspace directory',
      type: 'string',
      default: './swarm-workspaces'
    },
    {
      name: 'refresh',
      short: 'r',
      description: 'Refresh interval in milliseconds',
      type: 'string',
      default: '2000'
    },
    {
      name: 'theme',
      short: 't',
      description: 'Dashboard theme',
      type: 'string',
      choices: ['dark', 'light', 'matrix'],
      default: 'dark'
    },
    {
      name: 'no-topology',
      description: 'Disable topology visualization',
      type: 'boolean'
    },
    {
      name: 'no-metrics',
      description: 'Disable metrics collection',
      type: 'boolean'
    },
    {
      name: 'no-controls',
      description: 'Disable interactive controls',
      type: 'boolean'
    },
    {
      name: 'help',
      short: 'h',
      description: 'Show help information',
      type: 'boolean'
    }
  ],
  examples: [
    'flowx swarm dashboard',
    'flowx swarm dashboard --workspace ./my-swarms --refresh 1000',
    'flowx swarm dashboard --theme matrix --no-topology',
    'flowx swarm dashboard --workspace ./production-swarms --refresh 5000'
  ]
};

export default swarmDashboardCommand; 