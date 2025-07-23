import React, { useState, useEffect } from 'react';
import { Box, Text, Newline, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { getMemoryManager, getPersistenceManager } from '../../core/global-initialization.ts';
import type { PersistedAgent } from '../../../core/persistence.ts';
import SearchFilter from './search-filter.tsx';
import type { FilterResult } from '../services/filter-service.js';
import ExportPanel from './export-panel.tsx';
import type { ExportResult } from '../services/export-service.js';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'working' | 'error' | 'offline';
  currentTask?: string;
  tasksCompleted: number;
  tasksFailed: number;
  lastActivity: Date;
  pid?: number;
  memoryUsage: number;
  cpuUsage: number;
  capabilities: string;
  priority: number;
}

interface AgentMonitorProps {
  onBack: () => void;
}

export const AgentMonitor: React.FC<AgentMonitorProps> = ({ onBack }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Load agent data
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const persistenceManager = await getPersistenceManager();
        const agentData = await persistenceManager.getAllAgents();
        
        // Transform agent data and add mock runtime metrics
        const agentList: Agent[] = agentData.map((agent: PersistedAgent) => ({
          id: agent.id,
          name: agent.name || `Agent-${agent.id.slice(-8)}`,
          type: agent.type || 'general',
          status: agent.status === 'active' ? 'working' : 'idle',
          currentTask: `Processing ${agent.type} tasks`,
          tasksCompleted: Math.floor(Math.random() * 50),
          tasksFailed: Math.floor(Math.random() * 5),
          lastActivity: new Date(agent.createdAt),
          memoryUsage: Math.random() * 100,
          cpuUsage: Math.random() * 50,
          capabilities: agent.capabilities,
          priority: agent.priority
        }));

        setAgents(agentList);
        setFilteredAgents(agentList); // Initialize filtered agents
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading agents:', error);
        setAgents([]);
        setFilteredAgents([]);
        setIsLoading(false);
      }
    };

    loadAgents();
    const interval = setInterval(loadAgents, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle filter results
  const handleFilteredData = (result: FilterResult<Agent>) => {
    setFilteredAgents(result.items);
    // Reset selection if current selection is out of bounds
    if (selectedAgent >= result.items.length) {
      setSelectedAgent(Math.max(0, result.items.length - 1));
    }
  };

  // Handle keyboard input
  useInput((input, key) => {
    if (showFilter || showExport) {
      // Filter/Export components handle their own input
      return;
    }
    
    if (key.escape || input === 'q') {
      onBack();
    } else if (key.upArrow && selectedAgent > 0) {
      setSelectedAgent(selectedAgent - 1);
    } else if (key.downArrow && selectedAgent < filteredAgents.length - 1) {
      setSelectedAgent(selectedAgent + 1);
    } else if (key.return) {
      setShowDetails(!showDetails);
    } else if (input === 's') {
      spawnNewAgent();
    } else if (input === 'k' && filteredAgents[selectedAgent]) {
      killAgent(filteredAgents[selectedAgent].id);
    } else if (input === 'f') {
      setShowFilter(!showFilter);
    } else if (input === 'e') {
      setShowExport(!showExport);
    }
  });

  const spawnNewAgent = async () => {
    try {
      const persistenceManager = await getPersistenceManager();
      const newAgent: PersistedAgent = {
        id: `agent-${Date.now()}`,
        name: `Agent-${Date.now().toString().slice(-4)}`,
        type: 'general',
        status: 'active',
        capabilities: 'general-purpose,task-execution',
        systemPrompt: 'You are a helpful AI assistant.',
        maxConcurrentTasks: 3,
        priority: 1,
        createdAt: Date.now()
      };
      
      await persistenceManager.saveAgent(newAgent);
      
      // Add to local state immediately for responsiveness
      const agent: Agent = {
        id: newAgent.id,
        name: newAgent.name,
        type: newAgent.type,
        status: 'working',
        currentTask: 'Initializing...',
        tasksCompleted: 0,
        tasksFailed: 0,
        lastActivity: new Date(),
        memoryUsage: Math.random() * 30,
        cpuUsage: Math.random() * 20,
        capabilities: newAgent.capabilities,
        priority: newAgent.priority
      };
      
      setAgents(prev => {
        const newAgents = [...prev, agent];
        setFilteredAgents(newAgents); // Update filtered list too
        return newAgents;
      });
    } catch (error) {
      console.error('Error spawning agent:', error);
    }
  };

  const killAgent = async (agentId: string) => {
    try {
      const persistenceManager = await getPersistenceManager();
      await persistenceManager.updateAgentStatus(agentId, 'removed');
      setAgents(prev => {
        const newAgents = prev.filter(agent => agent.id !== agentId);
        setFilteredAgents(current => current.filter(agent => agent.id !== agentId));
        return newAgents;
      });
      if (selectedAgent >= filteredAgents.length - 1) {
        setSelectedAgent(Math.max(0, filteredAgents.length - 2));
      }
    } catch (error) {
      console.error('Error killing agent:', error);
    }
  };

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={10}>
        {(Spinner as any)({ type: "dots" })}
        <Text> Loading agent data...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Search Filter */}
      {showFilter && (
        <SearchFilter
          data={agents}
          onFilteredData={handleFilteredData}
          placeholder="Search agents by name, type, status..."
          searchFields={['name', 'type', 'status', 'capabilities', 'currentTask']}
          enableFacets={true}
          enableSavedFilters={true}
          visible={showFilter}
          onClose={() => setShowFilter(false)}
        />
      )}

      {/* Export Panel */}
      {showExport && (
        <ExportPanel
          data={filteredAgents}
          title="Export Agent Data"
          defaultFields={['name', 'type', 'status', 'tasksCompleted', 'tasksFailed', 'memoryUsage', 'cpuUsage']}
          visible={showExport}
          onClose={() => setShowExport(false)}
          onExportComplete={(result: ExportResult) => {
            // Could show a notification here
            console.log('Export completed:', result);
          }}
        />
      )}

      {/* Header */}
      <Box marginBottom={1} borderStyle="round" borderColor="cyan" padding={1}>
        <Text color="cyan" bold>🤖 Agent Monitor</Text>
        <Text color="gray"> • {filteredAgents.length} of {agents.length} agents • 'f' filter, 'e' export, ↑↓ select, Enter details, 's' spawn, 'k' kill, 'q' quit</Text>
      </Box>

      {/* Agent List */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left Panel - Agent List */}
        <Box flexDirection="column" width="60%" marginRight={2}>
          <Box borderStyle="round" borderColor="blue" padding={1} flexGrow={1}>
            <Text color="blue" bold>Active Agents</Text>
            <Newline />
            
            {filteredAgents.length === 0 ? (
              <Text color="gray">
                {agents.length === 0 
                  ? "No agents running. Press 's' to spawn a new agent."
                  : "No agents match current filters. Press 'f' to adjust filters."
                }
              </Text>
            ) : (
              filteredAgents.map((agent, index) => (
                <Box key={agent.id} marginBottom={1}>
                  <Text backgroundColor={index === selectedAgent ? 'blue' : undefined}>
                    <Text color={getStatusColor(agent.status)}>●</Text>
                    <Text> {agent.name}</Text>
                    <Text color="gray"> ({agent.type})</Text>
                    <Text color="gray"> P{agent.priority}</Text>
                  </Text>
                  {index === selectedAgent && (
                    <Text color="gray">  └─ {agent.currentTask || 'Idle'}</Text>
                  )}
                </Box>
              ))
            )}
          </Box>
        </Box>

        {/* Right Panel - Agent Details */}
        <Box flexDirection="column" width="40%">
          <Box borderStyle="round" borderColor="green" padding={1} flexGrow={1}>
            <Text color="green" bold>Agent Details</Text>
            <Newline />
            
            {filteredAgents[selectedAgent] ? (
              <AgentDetails agent={filteredAgents[selectedAgent]} showDetails={showDetails} />
            ) : (
              <Text color="gray">Select an agent to view details</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1} borderStyle="round" borderColor="gray" padding={1}>
        <Text color="gray">
          <Text color="cyan">[s]</Text> Spawn Agent  
          <Text color="cyan"> [k]</Text> Kill Agent  
          <Text color="cyan"> [Enter]</Text> Toggle Details  
          <Text color="cyan"> [q]</Text> Back
        </Text>
      </Box>
    </Box>
  );
};

// Agent Details Component
const AgentDetails: React.FC<{ agent: Agent; showDetails: boolean }> = ({ agent, showDetails }) => {
  const formatUptime = (lastActivity: Date) => {
    const now = new Date();
    const diff = now.getTime() - lastActivity.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <Box flexDirection="column">
      <Text bold>{agent.name}</Text>
      <Text color="gray">ID: {agent.id.slice(-12)}</Text>
      <Text color="gray">Type: {agent.type}</Text>
      <Text color="gray">Priority: {agent.priority}</Text>
      <Newline />
      
      <Text>Status: <Text color={getStatusColor(agent.status)}>{agent.status.toUpperCase()}</Text></Text>
      
      {agent.currentTask && (
        <Text>Task: <Text color="yellow">{agent.currentTask}</Text></Text>
      )}
      
      <Newline />
      <Text bold>Performance:</Text>
      <Text>Tasks Completed: <Text color="green">{agent.tasksCompleted}</Text></Text>
      <Text>Tasks Failed: <Text color="red">{agent.tasksFailed}</Text></Text>
      <Text>Success Rate: <Text color="cyan">
        {agent.tasksCompleted + agent.tasksFailed > 0 
          ? `${Math.round((agent.tasksCompleted / (agent.tasksCompleted + agent.tasksFailed)) * 100)}%`
          : 'N/A'
        }
      </Text></Text>
      
      {showDetails && (
        <>
          <Newline />
          <Text bold>System Resources:</Text>
          <Text>Memory: <Text color="yellow">{agent.memoryUsage.toFixed(1)}%</Text></Text>
          <Text>CPU: <Text color="yellow">{agent.cpuUsage.toFixed(1)}%</Text></Text>
          <Text>Uptime: <Text color="cyan">{formatUptime(agent.lastActivity)}</Text></Text>
          
          <Newline />
          <Text bold>Capabilities:</Text>
          <Text color="gray">{agent.capabilities}</Text>
        </>
      )}
    </Box>
  );
};

// Helper function to get status color
function getStatusColor(status: string): string {
  switch (status) {
    case 'working': return 'green';
    case 'idle': return 'yellow';
    case 'error': return 'red';
    case 'offline': return 'gray';
    default: return 'white';
  }
}

export default AgentMonitor; 