import React, { useState, useEffect } from 'react';
import { Box, Text, Newline, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import { SystemMonitor } from '../commands/start/system-monitor.ts';
import { ProcessManager } from '../commands/start/process-manager.ts';
import { getMemoryManager } from '../core/global-initialization.ts';
import AgentMonitor from './components/agent-monitor.tsx';
import TaskManager from './components/task-manager.tsx';
import MemoryBrowser from './components/memory-browser.tsx';
import { getWebSocketClient } from './services/websocket-client.ts';
import { getKeyboardHandler } from './services/keyboard-handler.ts';
import HelpOverlay from './components/help-overlay.tsx';

interface DashboardProps {
  processManager: ProcessManager;
  systemMonitor: SystemMonitor;
}

type ViewMode = 'overview' | 'agents' | 'tasks' | 'memory' | 'logs' | 'config';

export const InkDashboard: React.FC<DashboardProps> = ({ processManager, systemMonitor }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [processes, setProcesses] = useState<any[]>([]);
  const [memoryStats, setMemoryStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [helpVisible, setHelpVisible] = useState(false);
  const { exit } = useApp();

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    const wsClient = getWebSocketClient();
    
    const connectWebSocket = async () => {
      try {
        await wsClient.connect();
        setWsConnected(true);
        
        // Subscribe to real-time updates
        wsClient.subscribe('system-metrics');
        wsClient.subscribe('agent-updates');
        wsClient.subscribe('task-updates');
        wsClient.subscribe('memory-updates');
        
        // Handle real-time data updates
        wsClient.on('system-metrics', (data) => {
          if (liveUpdates) {
            setSystemHealth(data);
          }
        });
        
        wsClient.on('agent-update', (data) => {
          if (liveUpdates) {
            setProcesses(prev => {
              const updated = [...prev];
              const index = updated.findIndex(p => p.id === data.id);
              if (index >= 0) {
                updated[index] = { ...updated[index], ...data };
              } else {
                updated.push(data);
              }
              return updated;
            });
          }
        });
        
        wsClient.on('memory-update', (data) => {
          if (liveUpdates) {
            setMemoryStats(data);
          }
        });
        
        wsClient.on('disconnected', () => {
          setWsConnected(false);
        });
        
        wsClient.on('reconnecting', () => {
          setWsConnected(false);
        });
        
        wsClient.on('connected', () => {
          setWsConnected(true);
        });
        
      } catch (error) {
        // WebSocket connection failed - work in offline mode
        console.log('WebSocket connection failed, working in offline mode');
        setWsConnected(false);
        // Continue without WebSocket connection
      }
    };

    // Try to connect but don't fail if it doesn't work
    connectWebSocket().catch(() => {
      // Silently handle connection failures
      setWsConnected(false);
    });
    
    return () => {
      // Only disconnect if we have a connection
      try {
        wsClient.disconnect();
      } catch (error) {
        // Ignore disconnection errors
      }
    };
  }, [liveUpdates]);

  // Initialize keyboard handler
  useEffect(() => {
    const keyboardHandler = getKeyboardHandler();
    keyboardHandler.pushContext('dashboard');

    const handleKeyboardAction = (action: any) => {
      switch (action.type) {
        case 'quit':
          exit();
          break;
        case 'navigate':
          if (action.payload?.view) {
            setCurrentView(action.payload.view);
          }
          break;
        case 'back':
          if (currentView !== 'overview') {
            setCurrentView('overview');
          } else {
            exit();
          }
          break;
        case 'refresh':
          setLiveUpdates(!liveUpdates);
          break;
        case 'toggle-help':
        case 'show-help':
          setHelpVisible(!helpVisible);
          break;
      }
    };

    const handleHelpToggle = (data: any) => {
      setHelpVisible(data.visible);
    };

    keyboardHandler.on('action', handleKeyboardAction);
    keyboardHandler.on('help-toggled', handleHelpToggle);

    return () => {
      keyboardHandler.off('action', handleKeyboardAction);
      keyboardHandler.off('help-toggled', handleHelpToggle);
      keyboardHandler.popContext();
    };
  }, [exit, currentView, liveUpdates, helpVisible]);

  // Update system data every 2 seconds (fallback when WebSocket is not available)
  useEffect(() => {
    if (!wsConnected || !liveUpdates) {
      const updateData = async () => {
        try {
          const health = systemMonitor.getSystemHealth();
          const processData = processManager.getAllProcesses();
          const memoryManager = await getMemoryManager();
          const memStats = await memoryManager.getHealthStatus();

          setSystemHealth(health);
          setProcesses(processData);
          setMemoryStats(memStats);
          setIsLoading(false);
        } catch (error) {
          console.error('Error updating dashboard data:', error);
        }
      };

      updateData();
      const interval = setInterval(updateData, 2000);
      return () => clearInterval(interval);
    }
    return undefined; // Return undefined when not setting up interval
  }, [processManager, systemMonitor, wsConnected, liveUpdates]);

  // Handle keyboard input using the keyboard handler
  useInput((input, key) => {
    // Don't handle input if help is visible (let help overlay handle it)
    if (helpVisible && (input === 'h' || key.escape)) {
      setHelpVisible(false);
      return;
    }

    // Only handle input if we're in the main dashboard view
    const isMainView = ['overview', 'logs', 'config'].includes(currentView);
    
    if (isMainView) {
      const keyboardHandler = getKeyboardHandler();
      const handled = keyboardHandler.handleKeyPress(input, key);
      
      // If not handled by keyboard handler, use fallback logic
      if (!handled) {
        if (key.escape || input === 'q') {
          exit();
        } else if (input === 'h') {
          setHelpVisible(true);
        }
      }
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={10}>
        {(Spinner as any)({ type: "dots" })}
        <Text> Loading Claude Flow Dashboard...</Text>
      </Box>
    );
  }

  // Render sub-components with back navigation
  switch (currentView) {
    case 'agents':
      return <AgentMonitor onBack={() => setCurrentView('overview')} />;
    case 'tasks':
      return <TaskManager onBack={() => setCurrentView('overview')} />;
    case 'memory':
      return <MemoryBrowser onBack={() => setCurrentView('overview')} />;
    default:
      break;
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Gradient name="rainbow">
          <BigText text="FlowX" font="tiny" />
        </Gradient>
      </Box>

      {/* Navigation */}
      <Box marginBottom={1} borderStyle="round" borderColor="cyan" padding={1}>
        <Text>
          <Text color={(currentView as ViewMode) === 'overview' ? 'cyan' : 'gray'}>[1]</Text> Overview  
          <Text color={(currentView as ViewMode) === 'agents' ? 'cyan' : 'gray'}> [2]</Text> Agents  
          <Text color={(currentView as ViewMode) === 'tasks' ? 'cyan' : 'gray'}> [3]</Text> Tasks  
          <Text color={(currentView as ViewMode) === 'memory' ? 'cyan' : 'gray'}> [4]</Text> Memory  
          <Text color={(currentView as ViewMode) === 'logs' ? 'cyan' : 'gray'}> [5]</Text> Logs  
          <Text color={(currentView as ViewMode) === 'config' ? 'cyan' : 'gray'}> [6]</Text> Config  
          <Text color="gray"> [q]</Text> Quit
        </Text>
      </Box>

      {/* Main Content */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left Panel - Current View */}
        <Box flexDirection="column" width="70%" marginRight={2}>
          {currentView === 'overview' && <OverviewPanel systemHealth={systemHealth} processes={processes} />}
          {currentView === 'logs' && <LogsPanel />}
          {currentView === 'config' && <ConfigPanel />}
        </Box>

        {/* Right Panel - System Status */}
        <Box flexDirection="column" width="30%" borderStyle="round" borderColor="green" padding={1}>
          <Text color="green" bold>System Status</Text>
          <Text color={wsConnected ? 'green' : 'red'}>
            {wsConnected ? '🟢 Live Updates' : '🔴 Polling Mode'}
          </Text>
          <Newline />
          
          {systemHealth && (
            <>
              <Text>
                Health: {systemHealth.overall === 'healthy' ? 
                  <Text color="green">✓ Healthy</Text> : 
                  systemHealth.overall === 'warning' ? 
                    <Text color="yellow">⚠ Warning</Text> : 
                    <Text color="red">✗ Critical</Text>
                }
              </Text>
              
              <Text>Processes: {systemHealth.processes} running</Text>
              <Text>Memory: {systemHealth.memory.percentage.toFixed(1)}%</Text>
              <Text>Uptime: {Math.floor(systemHealth.uptime / 1000)}s</Text>
              
              {systemHealth.alerts.length > 0 && (
                <>
                  <Newline />
                  <Text color="yellow" bold>Alerts:</Text>
                  {systemHealth.alerts.map((alert: string, i: number) => (
                    <Text key={i} color="yellow">• {alert}</Text>
                  ))}
                </>
              )}
            </>
          )}
        </Box>
      </Box>

      {      /* Footer */}
      <Box marginTop={1} borderStyle="round" borderColor="gray" padding={1}>
        <Text color="gray">
          Use number keys to navigate • Press 'q' to quit • Press 'r' to toggle real-time updates
          {wsConnected ? ' • 🟢 Live' : ' • 🔴 Polling (2s)'}
        </Text>
      </Box>
    </Box>
  );
};

// Overview Panel Component
const OverviewPanel: React.FC<{ systemHealth: any; processes: any[] }> = ({ systemHealth, processes }) => {
  const runningProcesses = processes.filter(p => p.status === 'running');
  const errorProcesses = processes.filter(p => p.status === 'error');

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1}>
      <Text color="blue" bold>System Overview</Text>
      <Newline />
      
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="column" width="50%">
          <Text bold>Process Status</Text>
          <Text>Total: {processes.length}</Text>
          <Text color="green">Running: {runningProcesses.length}</Text>
          <Text color="red">Errors: {errorProcesses.length}</Text>
        </Box>
        
        <Box flexDirection="column" width="50%">
          <Text bold>Resource Usage</Text>
          <Text>Memory: {systemHealth?.memory.percentage.toFixed(1)}%</Text>
          <Text>CPU: {systemHealth?.cpu?.usage || 0}%</Text>
          <Text>Uptime: {Math.floor((systemHealth?.uptime || 0) / 1000)}s</Text>
        </Box>
      </Box>
      
      <Newline />
      <Text bold>Running Processes:</Text>
      {runningProcesses.map((process, i) => (
        <Text key={i} color="green">
          • {process.name} (PID: {process.pid || 'N/A'})
        </Text>
      ))}
      
      <Newline />
      <Text color="cyan" bold>Quick Actions:</Text>
      <Text color="gray">• Press [2] to manage agents</Text>
      <Text color="gray">• Press [3] to view tasks</Text>
      <Text color="gray">• Press [4] to browse memory bank</Text>
    </Box>
  );
};

// Tasks Panel Component
const TasksPanel: React.FC = () => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
      <Text color="magenta" bold>Task Management</Text>
      <Newline />
      <Text color="gray">Task management interface coming soon...</Text>
      <Text color="gray">This will show:</Text>
      <Text color="gray">• Active tasks and their progress</Text>
      <Text color="gray">• Task queue and priorities</Text>
      <Text color="gray">• Task assignment to agents</Text>
      <Text color="gray">• Task completion statistics</Text>
    </Box>
  );
};

// Memory Panel Component
const MemoryPanel: React.FC<{ memoryStats: any }> = ({ memoryStats }) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Text color="yellow" bold>Memory Bank</Text>
      <Newline />
      
      {memoryStats ? (
        <>
          <Text>Total Entries: {memoryStats.overview.totalEntries}</Text>
          <Text>Total Size: {(memoryStats.overview.totalSize / 1024 / 1024).toFixed(2)} MB</Text>
          <Text>Cache Hit Rate: {(memoryStats.performance.cacheHitRatio * 100).toFixed(1)}%</Text>
          <Text>Health: {memoryStats.health.recommendedCleanup ? 
            <Text color="yellow">⚠ Needs Cleanup</Text> : 
            <Text color="green">✓ Healthy</Text>
          }</Text>
          
          <Newline />
          <Text bold>Performance Metrics:</Text>
          <Text>Avg Query Time: {memoryStats.performance.averageQueryTime.toFixed(2)}ms</Text>
          <Text>Avg Write Time: {memoryStats.performance.averageWriteTime.toFixed(2)}ms</Text>
          <Text>Compressed Entries: {memoryStats.overview.compressedEntries}</Text>
        </>
      ) : (
        <Text color="gray">Loading memory statistics...</Text>
      )}
    </Box>
  );
};

// Logs Panel Component
const LogsPanel: React.FC = () => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="white" padding={1}>
      <Text color="white" bold>System Logs</Text>
      <Newline />
      <Text color="gray">Log viewer interface coming soon...</Text>
      <Text color="gray">This will show:</Text>
      <Text color="gray">• Real-time log streaming</Text>
      <Text color="gray">• Log filtering and search</Text>
      <Text color="gray">• Error log analysis</Text>
      <Text color="gray">• Performance metrics</Text>
    </Box>
  );
};

// Config Panel Component
const ConfigPanel: React.FC = () => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
      <Text color="gray" bold>Configuration</Text>
      <Newline />
      <Text color="gray">Configuration interface coming soon...</Text>
      <Text color="gray">This will allow:</Text>
      <Text color="gray">• System settings management</Text>
      <Text color="gray">• Agent configuration</Text>
      <Text color="gray">• Performance tuning</Text>
      <Text color="gray">• Profile management</Text>
    </Box>
  );
};

export default InkDashboard; 