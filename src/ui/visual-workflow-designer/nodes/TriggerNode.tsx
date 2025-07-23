/**
 * Trigger Node Component
 * Custom node for workflow triggers
 */

import React, { memo } from 'react';
// import { Handle, Position, NodeProps } from 'reactflow'; // Module not available
const Handle = ({ type, position, style }: any) => <div data-handle={type} style={style} />;
const Position = { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' };
type NodeProps<T = any> = { data: T; id: string; selected: boolean };

export interface TriggerNodeData {
  label: string;
  config: {
    type: 'push' | 'pull_request' | 'issue' | 'release' | 'schedule';
    branches?: string[];
    paths?: string[];
  };
  status?: 'idle' | 'running' | 'success' | 'error';
  executionTime?: number;
}

const TriggerNode: React.FC<NodeProps<TriggerNodeData>> = ({ data, selected }) => {
  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'push': return '📤';
      case 'pull_request': return '🔀';
      case 'issue': return '🐛';
      case 'release': return '🚀';
      case 'schedule': return '⏰';
      default: return '🚀';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'border-blue-400 bg-blue-50';
      case 'success': return 'border-green-400 bg-green-50';
      case 'error': return 'border-red-400 bg-red-50';
      default: return 'border-gray-300 bg-white';
    }
  };

  const getStatusIndicator = (status?: string) => {
    switch (status) {
      case 'running': return <div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />;
      case 'success': return <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full" />;
      case 'error': return <div className="absolute top-1 right-1 w-2 h-2 bg-red-400 rounded-full" />;
      default: return null;
    }
  };

  return (
    <div 
      className={`relative min-w-[200px] p-4 rounded-lg border-2 shadow-md ${getStatusColor(data.status)} ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}
    >
      {getStatusIndicator(data.status)}
      
      <div className="flex items-center space-x-3">
        <div className="text-2xl">
          {getTriggerIcon(data.config.type)}
        </div>
        
        <div className="flex-1">
          <div className="font-semibold text-gray-800">
            {data.label}
          </div>
          <div className="text-sm text-gray-600">
            {data.config.type.replace('_', ' ').toUpperCase()}
          </div>
          
          {data.config.branches && data.config.branches.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Branches: {data.config.branches.slice(0, 2).join(', ')}
              {data.config.branches.length > 2 && ` +${data.config.branches.length - 2} more`}
            </div>
          )}
          
          {data.executionTime && (
            <div className="text-xs text-gray-500 mt-1">
              Last run: {data.executionTime}ms
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
};

export default memo(TriggerNode); 