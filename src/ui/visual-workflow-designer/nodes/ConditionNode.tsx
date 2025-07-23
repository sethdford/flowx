/**
 * Condition Node Component
 * Custom node for workflow conditional branching
 */

import React, { memo } from 'react';

export interface ConditionNodeData {
  label: string;
  config: {
    type: string;
    value?: string;
    parameters?: Record<string, any>;
  };
  status?: 'idle' | 'running' | 'success' | 'error';
}

const ConditionNode: React.FC<{ data: ConditionNodeData; selected?: boolean }> = ({ data, selected }) => {
  const getConditionIcon = (type: string) => {
    switch (type) {
      case 'file_changed': return '📁';
      case 'branch_name': return '🌿';
      case 'label_present': return '🏷️';
      case 'time_based': return '⏰';
      case 'user_permission': return '👤';
      default: return '🔀';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'border-blue-400 bg-blue-50';
      case 'success': return 'border-green-400 bg-green-50';
      case 'error': return 'border-red-400 bg-red-50';
      default: return 'border-yellow-300 bg-yellow-50';
    }
  };

  return (
    <div 
      className={`relative min-w-[180px] p-3 rounded-lg border-2 shadow-md ${getStatusColor(data.status)} ${
        selected ? 'ring-2 ring-blue-500' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="text-xl">
          {getConditionIcon(data.config.type)}
        </div>
        
        <div className="flex-1">
          <div className="font-semibold text-gray-800 text-sm">
            {data.label}
          </div>
          <div className="text-xs text-gray-600">
            {data.config.type.replace('_', ' ').toUpperCase()}
          </div>
          
          {data.config.value && (
            <div className="text-xs text-gray-500 mt-1 truncate">
              Value: {data.config.value}
            </div>
          )}
        </div>
      </div>
      
      {/* Diamond shape overlay for condition indicator */}
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 transform rotate-45 border border-yellow-600"></div>
    </div>
  );
};

export default memo(ConditionNode); 