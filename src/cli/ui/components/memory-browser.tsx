import React, { useState, useEffect } from 'react';
import { Box, Text, Newline, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { getMemoryManager } from '../../core/global-initialization.ts';

interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  type: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  size: number;
}

interface MemoryBrowserProps {
  onBack: () => void;
}

export const MemoryBrowser: React.FC<MemoryBrowserProps> = ({ onBack }) => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'user' | 'system' | 'context' | 'task'>('all');
  const [memoryStats, setMemoryStats] = useState<any>(null);

  // Load memory data
  useEffect(() => {
    const loadMemories = async () => {
      try {
        const memoryManager = await getMemoryManager();
        
        // Get memory health status
        const healthStatus = await memoryManager.getHealthStatus();
        setMemoryStats(healthStatus.metrics || {});
        
        // Get memory entries (simulate a query for all entries)
        const queryResult = await memoryManager.query({
          search: searchTerm || undefined,
          type: filterType !== 'all' && ['observation', 'insight', 'decision', 'artifact', 'error'].includes(filterType) 
            ? filterType as 'observation' | 'insight' | 'decision' | 'artifact' | 'error'
            : undefined,
          limit: 50
        });
        
        // Transform memory entries
        const memoryList: MemoryEntry[] = queryResult.map((entry: any) => ({
          id: entry.id,
          key: entry.context?.key || entry.id || 'unnamed',
          value: entry.content || '',
          type: entry.type || 'user',
          tags: entry.tags || [],
          createdAt: new Date(entry.timestamp || Date.now()),
          updatedAt: new Date(entry.timestamp || Date.now()),
          size: JSON.stringify(entry).length
        }));

        setMemories(memoryList);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading memories:', error);
        setMemories([]);
        setIsLoading(false);
      }
    };

    loadMemories();
    const interval = setInterval(loadMemories, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [searchTerm, filterType]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onBack();
    } else if (key.upArrow && selectedMemory > 0) {
      setSelectedMemory(selectedMemory - 1);
    } else if (key.downArrow && selectedMemory < memories.length - 1) {
      setSelectedMemory(selectedMemory + 1);
    } else if (key.return) {
      setShowDetails(!showDetails);
    } else if (input === 's') {
      storeNewMemory();
    } else if (input === 'd' && memories[selectedMemory]) {
      deleteMemory(memories[selectedMemory].id);
    } else if (input === 'c') {
      clearSearch();
    } else if (input === '1') {
      setFilterType('all');
    } else if (input === '2') {
      setFilterType('user');
    } else if (input === '3') {
      setFilterType('system');
    } else if (input === '4') {
      setFilterType('context');
    } else if (input === '5') {
      setFilterType('task');
    } else if (input === '/') {
      // Toggle search mode (simplified for demo)
      setSearchTerm(searchTerm ? '' : 'search');
    }
  });

  const storeNewMemory = async () => {
    try {
      const memoryManager = await getMemoryManager();
      const timestamp = new Date().toLocaleTimeString();
      
      const memoryEntry = {
        id: `ui-memory-${Date.now()}`,
        agentId: 'ui-user',
        sessionId: 'ui-session',
        type: 'artifact' as const,
        content: `Memory created from UI at ${timestamp}`,
        context: {
          source: 'memory-browser',
          timestamp: Date.now()
        },
        timestamp: new Date(),
        tags: ['ui-created', 'demo'],
        version: 1,
        metadata: {
          source: 'memory-browser'
        }
      };

      await memoryManager.store(memoryEntry);

      // Add to local state immediately for responsiveness
      const newMemory: MemoryEntry = {
        id: memoryEntry.id,
        key: memoryEntry.id,
        value: memoryEntry.content,
        type: 'user',
        tags: ['ui-created', 'demo'],
        createdAt: new Date(),
        updatedAt: new Date(),
        size: 100
      };
      
      setMemories(prev => [newMemory, ...prev]);
    } catch (error) {
      console.error('Error storing memory:', error);
    }
  };

  const deleteMemory = async (memoryId: string) => {
    try {
      const memoryManager = await getMemoryManager();
      await memoryManager.delete(memoryId);
      setMemories(prev => prev.filter(memory => memory.id !== memoryId));
      if (selectedMemory >= memories.length - 1) {
        setSelectedMemory(Math.max(0, memories.length - 2));
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setFilterType('all');
  };

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={10}>
        {(Spinner as any)({ type: "dots" })}
        <Text> Loading memory bank...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} borderStyle="round" borderColor="yellow" padding={1}>
        <Text color="yellow" bold>🧠 Memory Bank Browser</Text>
        <Text color="gray"> • {memories.length} entries • Use ↑↓ to select, Enter for details, 's' to store, 'd' to delete, 'q' to quit</Text>
      </Box>

      {/* Filter and Search */}
      <Box marginBottom={1} borderStyle="round" borderColor="blue" padding={1}>
        <Text>
          Filter: 
          <Text color={filterType === 'all' ? 'cyan' : 'gray'}> [1]All</Text>
          <Text color={filterType === 'user' ? 'cyan' : 'gray'}> [2]User</Text>
          <Text color={filterType === 'system' ? 'cyan' : 'gray'}> [3]System</Text>
          <Text color={filterType === 'context' ? 'cyan' : 'gray'}> [4]Context</Text>
          <Text color={filterType === 'task' ? 'cyan' : 'gray'}> [5]Task</Text>
          {searchTerm && <Text color="yellow"> • Search: "{searchTerm}"</Text>}
          <Text color="gray"> [c]Clear [/]Search</Text>
        </Text>
      </Box>

      {/* Memory Statistics */}
      {memoryStats && (
        <Box marginBottom={1} borderStyle="round" borderColor="cyan" padding={1}>
          <Text color="cyan" bold>Statistics</Text>
          <Text> Entries: {memoryStats.overview.totalEntries} • Size: {(memoryStats.overview.totalSize / 1024).toFixed(1)}KB • Cache Hit: {(memoryStats.performance.cacheHitRatio * 100).toFixed(1)}%</Text>
        </Box>
      )}

      {/* Memory List */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left Panel - Memory List */}
        <Box flexDirection="column" width="60%" marginRight={2}>
          <Box borderStyle="round" borderColor="green" padding={1} flexGrow={1}>
            <Text color="green" bold>Memory Entries ({filterType})</Text>
            <Newline />
            
            {memories.length === 0 ? (
              <Text color="gray">No memories found. Press 's' to store a new memory.</Text>
            ) : (
              memories.map((memory, index) => (
                <Box key={memory.id} marginBottom={1}>
                  <Text backgroundColor={index === selectedMemory ? 'blue' : undefined}>
                    <Text color={getTypeColor(memory.type)}>●</Text>
                    <Text> {memory.key.length > 35 ? memory.key.slice(0, 32) + '...' : memory.key}</Text>
                    <Text color="gray"> ({memory.size}B)</Text>
                  </Text>
                  {index === selectedMemory && (
                    <>
                      <Text color="gray">  └─ Type: {memory.type}</Text>
                      {memory.tags.length > 0 && (
                        <Text color="gray">  └─ Tags: {memory.tags.join(', ')}</Text>
                      )}
                      <Text color="gray">  └─ {memory.value.length > 50 ? memory.value.slice(0, 47) + '...' : memory.value}</Text>
                    </>
                  )}
                </Box>
              ))
            )}
          </Box>
        </Box>

        {/* Right Panel - Memory Details */}
        <Box flexDirection="column" width="40%">
          <Box borderStyle="round" borderColor="magenta" padding={1} flexGrow={1}>
            <Text color="magenta" bold>Memory Details</Text>
            <Newline />
            
            {memories[selectedMemory] ? (
              <MemoryDetails memory={memories[selectedMemory]} showDetails={showDetails} />
            ) : (
              <Text color="gray">Select a memory to view details</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1} borderStyle="round" borderColor="gray" padding={1}>
        <Text color="gray">
          <Text color="cyan">[s]</Text> Store Memory  
          <Text color="cyan"> [d]</Text> Delete Memory  
          <Text color="cyan"> [c]</Text> Clear Filters  
          <Text color="cyan"> [/]</Text> Search  
          <Text color="cyan"> [Enter]</Text> Toggle Details  
          <Text color="cyan"> [q]</Text> Back
        </Text>
      </Box>
    </Box>
  );
};

// Memory Details Component
const MemoryDetails: React.FC<{ memory: MemoryEntry; showDetails: boolean }> = ({ memory, showDetails }) => {
  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <Box flexDirection="column">
      <Text bold>{memory.key}</Text>
      <Text color="gray">ID: {memory.id.slice(-12)}</Text>
      <Text color="gray">Type: {memory.type}</Text>
      <Text color="gray">Size: {formatSize(memory.size)}</Text>
      <Newline />
      
      <Text bold>Content:</Text>
      <Text color="cyan">
        {showDetails ? memory.value : 
         memory.value.length > 100 ? memory.value.slice(0, 97) + '...' : memory.value}
      </Text>
      
      <Newline />
      <Text bold>Tags:</Text>
      {memory.tags.length > 0 ? (
        memory.tags.map((tag, i) => (
          <Text key={i} color="yellow">#{tag} </Text>
        ))
      ) : (
        <Text color="gray">No tags</Text>
      )}
      
      <Newline />
      <Text bold>Timeline:</Text>
      <Text>Created: <Text color="gray">{formatDate(memory.createdAt)}</Text></Text>
      <Text>Updated: <Text color="gray">{formatDate(memory.updatedAt)}</Text></Text>
      
      {showDetails && (
        <>
          <Newline />
          <Text bold>Raw Data:</Text>
          <Text color="gray" wrap="wrap">
            {JSON.stringify({
              id: memory.id,
              key: memory.key,
              type: memory.type,
              tags: memory.tags,
              size: memory.size
            }, null, 2)}
          </Text>
        </>
      )}
    </Box>
  );
};

// Helper function to get type color
function getTypeColor(type: string): string {
  switch (type) {
    case 'user': return 'green';
    case 'system': return 'blue';
    case 'context': return 'yellow';
    case 'task': return 'magenta';
    default: return 'white';
  }
}

export default MemoryBrowser; 