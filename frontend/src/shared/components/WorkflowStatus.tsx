import React from 'react';

interface WorkflowStatusProps {
  isActive: boolean;
  currentNode?: string;
  workflowEngine?: string;
  features?: {
    stateManagement?: boolean;
    conditionalRouting?: boolean;
    toolIntegration?: boolean;
    memoryPersistence?: boolean;
  };
}

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({
  isActive,
  currentNode,
  workflowEngine,
  features
}) => {
  if (!workflowEngine) return null;

  return (
    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
      <div className="flex items-center space-x-1">
        <div
          className={`w-2 h-2 rounded-full ${
            isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`}
        />
        <span>{workflowEngine}</span>
      </div>

      {currentNode && (
        <div className="flex items-center space-x-1">
          <span>•</span>
          <span>{currentNode}</span>
        </div>
      )}

      {features && (
        <div className="flex items-center space-x-1">
          <span>•</span>
          <span>
            {Object.entries(features)
              .filter(([_, enabled]) => enabled)
              .map(([feature]) => feature)
              .join(', ')}
          </span>
        </div>
      )}
    </div>
  );
};

export default WorkflowStatus;