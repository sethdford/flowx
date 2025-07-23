import React, { useState, useEffect } from 'react';
import { Box, Text, Newline, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { getPersistenceManager } from '../../core/global-initialization.ts';
import type { PersistedTask } from '../../../core/persistence.ts';

interface Task {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  assignedAgent?: string;
  progress: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  dependencies: string[];
  metadata: any;
}

interface TaskManagerProps {
  onBack: () => void;
}

export const TaskManager: React.FC<TaskManagerProps> = ({ onBack }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'active' | 'completed' | 'failed'>('active');

  // Load task data
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const persistenceManager = await getPersistenceManager();
        const taskData = await persistenceManager.getActiveTasks();
        
        // Transform task data
        const taskList: Task[] = taskData.map((task: PersistedTask) => ({
          id: task.id,
          type: task.type,
          description: task.description,
          status: task.status as any,
          priority: task.priority,
          assignedAgent: task.assignedAgent,
          progress: task.progress,
          error: task.error,
          createdAt: new Date(task.createdAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          dependencies: task.dependencies ? task.dependencies.split(',').filter(d => d.trim()) : [],
          metadata: task.metadata ? JSON.parse(task.metadata) : {}
        }));

        setTasks(taskList);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading tasks:', error);
        setTasks([]);
        setIsLoading(false);
      }
    };

    loadTasks();
    const interval = setInterval(loadTasks, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, [viewMode]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onBack();
    } else if (key.upArrow && selectedTask > 0) {
      setSelectedTask(selectedTask - 1);
    } else if (key.downArrow && selectedTask < filteredTasks.length - 1) {
      setSelectedTask(selectedTask + 1);
    } else if (key.return) {
      setShowDetails(!showDetails);
    } else if (input === 'c') {
      createNewTask();
    } else if (input === 'x' && filteredTasks[selectedTask]) {
      cancelTask(filteredTasks[selectedTask].id);
    } else if (input === 'r' && filteredTasks[selectedTask]) {
      retryTask(filteredTasks[selectedTask].id);
    } else if (input === '1') {
      setViewMode('all');
    } else if (input === '2') {
      setViewMode('active');
    } else if (input === '3') {
      setViewMode('completed');
    } else if (input === '4') {
      setViewMode('failed');
    }
  });

  // Filter tasks based on view mode
  const filteredTasks = tasks.filter(task => {
    switch (viewMode) {
      case 'all': return true;
      case 'active': return ['pending', 'in_progress'].includes(task.status);
      case 'completed': return task.status === 'completed';
      case 'failed': return ['failed', 'cancelled'].includes(task.status);
      default: return true;
    }
  });

  const createNewTask = async () => {
    try {
      const persistenceManager = await getPersistenceManager();
      const newTask: PersistedTask = {
        id: `task-${Date.now()}`,
        type: 'development',
        description: `New task created at ${new Date().toLocaleTimeString()}`,
        status: 'pending',
        priority: 1,
        dependencies: '',
        metadata: JSON.stringify({ source: 'ui', automated: false }),
        progress: 0,
        createdAt: Date.now()
      };
      
      await persistenceManager.saveTask(newTask);
      
      // Add to local state immediately for responsiveness
      const task: Task = {
        id: newTask.id,
        type: newTask.type,
        description: newTask.description,
        status: 'pending',
        priority: newTask.priority,
        progress: 0,
        createdAt: new Date(),
        dependencies: [],
        metadata: { source: 'ui', automated: false }
      };
      
      setTasks(prev => [task, ...prev]);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const cancelTask = async (taskId: string) => {
    try {
      const persistenceManager = await getPersistenceManager();
      await persistenceManager.updateTaskStatus(taskId, 'cancelled');
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: 'cancelled' as const } : task
      ));
    } catch (error) {
      console.error('Error cancelling task:', error);
    }
  };

  const retryTask = async (taskId: string) => {
    try {
      const persistenceManager = await getPersistenceManager();
      await persistenceManager.updateTaskStatus(taskId, 'pending');
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: 'pending' as const, error: undefined } : task
      ));
    } catch (error) {
      console.error('Error retrying task:', error);
    }
  };

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={10}>
        {(Spinner as any)({ type: "dots" })}
        <Text> Loading task data...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1} borderStyle="round" borderColor="magenta" padding={1}>
        <Text color="magenta" bold>📋 Task Manager</Text>
        <Text color="gray"> • {filteredTasks.length} tasks • Use ↑↓ to select, Enter for details, 'c' to create, 'q' to quit</Text>
      </Box>

      {/* View Mode Selector */}
      <Box marginBottom={1} borderStyle="round" borderColor="blue" padding={1}>
        <Text>
          <Text color={viewMode === 'all' ? 'cyan' : 'gray'}>[1]</Text> All ({tasks.length})  
          <Text color={viewMode === 'active' ? 'cyan' : 'gray'}> [2]</Text> Active ({tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length})  
          <Text color={viewMode === 'completed' ? 'cyan' : 'gray'}> [3]</Text> Completed ({tasks.filter(t => t.status === 'completed').length})  
          <Text color={viewMode === 'failed' ? 'cyan' : 'gray'}> [4]</Text> Failed ({tasks.filter(t => ['failed', 'cancelled'].includes(t.status)).length})
        </Text>
      </Box>

      {/* Task List */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left Panel - Task List */}
        <Box flexDirection="column" width="60%" marginRight={2}>
          <Box borderStyle="round" borderColor="green" padding={1} flexGrow={1}>
            <Text color="green" bold>Tasks ({viewMode})</Text>
            <Newline />
            
            {filteredTasks.length === 0 ? (
              <Text color="gray">No tasks found. Press 'c' to create a new task.</Text>
            ) : (
              filteredTasks.map((task, index) => (
                <Box key={task.id} marginBottom={1}>
                  <Text backgroundColor={index === selectedTask ? 'blue' : undefined}>
                    <Text color={getStatusColor(task.status)}>●</Text>
                    <Text> {task.description.length > 40 ? task.description.slice(0, 37) + '...' : task.description}</Text>
                    <Text color="gray"> P{task.priority}</Text>
                  </Text>
                  {index === selectedTask && (
                    <>
                      <Text color="gray">  └─ Status: {task.status}</Text>
                      {task.assignedAgent && (
                        <Text color="gray">  └─ Agent: {task.assignedAgent}</Text>
                      )}
                      {task.progress > 0 && (
                        <Text color="gray">  └─ Progress: {task.progress}%</Text>
                      )}
                    </>
                  )}
                </Box>
              ))
            )}
          </Box>
        </Box>

        {/* Right Panel - Task Details */}
        <Box flexDirection="column" width="40%">
          <Box borderStyle="round" borderColor="yellow" padding={1} flexGrow={1}>
            <Text color="yellow" bold>Task Details</Text>
            <Newline />
            
            {filteredTasks[selectedTask] ? (
              <TaskDetails task={filteredTasks[selectedTask]} showDetails={showDetails} />
            ) : (
              <Text color="gray">Select a task to view details</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1} borderStyle="round" borderColor="gray" padding={1}>
        <Text color="gray">
          <Text color="cyan">[c]</Text> Create Task  
          <Text color="cyan"> [x]</Text> Cancel Task  
          <Text color="cyan"> [r]</Text> Retry Task  
          <Text color="cyan"> [Enter]</Text> Toggle Details  
          <Text color="cyan"> [q]</Text> Back
        </Text>
      </Box>
    </Box>
  );
};

// Task Details Component
const TaskDetails: React.FC<{ task: Task; showDetails: boolean }> = ({ task, showDetails }) => {
  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date();
    const diff = endTime.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <Box flexDirection="column">
      <Text bold>{task.description}</Text>
      <Text color="gray">ID: {task.id.slice(-12)}</Text>
      <Text color="gray">Type: {task.type}</Text>
      <Newline />
      
      <Text>Status: <Text color={getStatusColor(task.status)}>{task.status.toUpperCase()}</Text></Text>
      <Text>Priority: <Text color={getPriorityColor(task.priority)}>P{task.priority}</Text></Text>
      <Text>Progress: <Text color="cyan">{task.progress}%</Text></Text>
      
      {task.assignedAgent && (
        <Text>Agent: <Text color="green">{task.assignedAgent}</Text></Text>
      )}
      
      {task.error && (
        <Text>Error: <Text color="red">{task.error}</Text></Text>
      )}
      
      <Newline />
      <Text bold>Timeline:</Text>
      <Text>Created: <Text color="gray">{task.createdAt.toLocaleString()}</Text></Text>
      {task.completedAt && (
        <Text>Completed: <Text color="gray">{task.completedAt.toLocaleString()}</Text></Text>
      )}
      <Text>Duration: <Text color="cyan">{formatDuration(task.createdAt, task.completedAt)}</Text></Text>
      
      {showDetails && (
        <>
          <Newline />
          <Text bold>Dependencies:</Text>
          {task.dependencies.length > 0 ? (
            task.dependencies.map((dep, i) => (
              <Text key={i} color="gray">• {dep}</Text>
            ))
          ) : (
            <Text color="gray">No dependencies</Text>
          )}
          
          <Newline />
          <Text bold>Metadata:</Text>
          <Text color="gray">{JSON.stringify(task.metadata, null, 2)}</Text>
        </>
      )}
    </Box>
  );
};

// Helper functions
function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'yellow';
    case 'in_progress': return 'blue';
    case 'completed': return 'green';
    case 'failed': return 'red';
    case 'cancelled': return 'gray';
    default: return 'white';
  }
}

function getPriorityColor(priority: number): string {
  if (priority >= 3) return 'red';
  if (priority >= 2) return 'yellow';
  return 'green';
}

export default TaskManager; 