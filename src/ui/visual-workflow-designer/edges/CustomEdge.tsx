/**
 * Custom Edge Component
 * Custom edge for workflow connections
 */

import React, { memo } from 'react';

export interface CustomEdgeData {
  condition?: string;
  label?: string;
  animated?: boolean;
}

const CustomEdge: React.FC<{ data?: CustomEdgeData }> = ({ data }) => {
  // Simplified edge component without ReactFlow dependencies
  // In a full implementation, this would extend BaseEdge or SmoothStepEdge
  
  return (
    <div className="custom-edge">
      {data?.label && (
        <div className="edge-label bg-white px-2 py-1 rounded text-xs border shadow-sm">
          {data.label}
        </div>
      )}
    </div>
  );
};

export default memo(CustomEdge); 