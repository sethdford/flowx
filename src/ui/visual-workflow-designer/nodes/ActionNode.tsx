/**
 * Action Node Component
 * Custom node for workflow actions
 */

import React, { memo } from 'react';

export interface ActionNodeData {
  label: string;
  config: {
    type: string;
    timeout?: number;
    retries?: number;
  };
  status?: 'idle' | 'running' | 'success' | 'error';
  executionTime?: number;
}

// Simplified React component without ReactFlow dependencies for now
const ActionNode: React.FC<{ data: ActionNodeData; selected?: boolean }> = ({ data, selected }) => {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'lint-check': return '🔍';
      case 'security-scan': return '🛡️';
      case 'coverage-check': return '📊';
      case 'deploy': return '🚀';
      case 'test': return '🧪';
      default: return '⚡';
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

  return (
    <div 
      className={`relative min-w-[200px] p-4 rounded-lg border-2 shadow-md ${getStatusColor(data.status)} ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="text-2xl">
          {getActionIcon(data.config.type)}
        </div>
        
        <div className="flex-1">
          <div className="font-semibold text-gray-800">
            {data.label}
          </div>
          <div className="text-sm text-gray-600">
            {data.config.type.replace('-', ' ').toUpperCase()}
          </div>
          
          {data.config.timeout && (
            <div className="text-xs text-gray-500 mt-1">
              Timeout: {data.config.timeout}s
            </div>
          )}
          
          {data.executionTime && (
            <div className="text-xs text-gray-500 mt-1">
              Runtime: {data.executionTime}ms
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ActionNode); 