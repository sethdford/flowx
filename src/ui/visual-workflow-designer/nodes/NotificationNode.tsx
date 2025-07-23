/**
 * Notification Node Component
 * Custom node for workflow notifications
 */

import React, { memo } from 'react';

export interface NotificationNodeData {
  label: string;
  config: {
    channels: string[];
    template?: string;
    recipients?: string[];
  };
  status?: 'idle' | 'running' | 'success' | 'error';
}

const NotificationNode: React.FC<{ data: NotificationNodeData; selected?: boolean }> = ({ data, selected }) => {
  const getChannelIcons = (channels: string[]) => {
    const iconMap: Record<string, string> = {
      slack: '💬',
      email: '📧',
      github: '🐙',
      sms: '📱',
      webhook: '🔗'
    };
    
    return channels.map(channel => iconMap[channel] || '📢').join(' ');
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'border-blue-400 bg-blue-50';
      case 'success': return 'border-green-400 bg-green-50';
      case 'error': return 'border-red-400 bg-red-50';
      default: return 'border-purple-300 bg-purple-50';
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
          📢
        </div>
        
        <div className="flex-1">
          <div className="font-semibold text-gray-800 text-sm">
            {data.label}
          </div>
          <div className="text-xs text-gray-600">
            NOTIFICATION
          </div>
          
          {data.config.channels && data.config.channels.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Channels: {getChannelIcons(data.config.channels)}
            </div>
          )}
          
          {data.config.template && (
            <div className="text-xs text-gray-500">
              Template: {data.config.template}
            </div>
          )}
        </div>
      </div>
      
      {/* Bell indicator */}
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full border border-purple-600"></div>
    </div>
  );
};

export default memo(NotificationNode); 