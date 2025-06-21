import React from 'react';
import { FiCpu, FiTool, FiMessageSquare, FiAlertCircle, FiLoader } from 'react-icons/fi';
import type { AgentExecution } from '../../stores/agentStore';

interface AgentExecutionStatusProps {
  execution: AgentExecution | null;
  className?: string;
}

const AgentExecutionStatus: React.FC<AgentExecutionStatusProps> = ({
  execution,
  className = ''
}) => {
  if (!execution) {
    return null;
  }

  const getStatusIcon = () => {
    switch (execution.status) {
      case 'thinking':
        return <FiCpu className="h-4 w-4" />;
      case 'using_tool':
        return <FiTool className="h-4 w-4" />;
      case 'responding':
        return <FiMessageSquare className="h-4 w-4" />;
      case 'error':
        return <FiAlertCircle className="h-4 w-4" />;
      default:
        return <FiLoader className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (execution.status) {
      case 'thinking':
        return 'Agent is thinking...';
      case 'using_tool':
        return execution.currentTool 
          ? `Using ${execution.currentTool}...`
          : 'Using tool...';
      case 'responding':
        return 'Generating response...';
      case 'error':
        return 'Error occurred';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = () => {
    switch (execution.status) {
      case 'thinking':
        return 'text-blue-600 dark:text-blue-400';
      case 'using_tool':
        return 'text-purple-600 dark:text-purple-400';
      case 'responding':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProgressColor = () => {
    switch (execution.status) {
      case 'thinking':
        return 'bg-blue-500';
      case 'using_tool':
        return 'bg-purple-500';
      case 'responding':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className={`bg-secondary border border-border rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-3">
        {/* Status Icon */}
        <div className={`${getStatusColor()} ${execution.status === 'thinking' ? 'animate-pulse' : ''}`}>
          {getStatusIcon()}
        </div>

        {/* Status Text */}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            <span className="text-xs text-muted">
              {execution.progress}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 w-full bg-tertiary rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${execution.progress}%` }}
            />
          </div>

          {/* Token Usage */}
          {(execution.tokenUsage.input > 0 || execution.tokenUsage.output > 0) && (
            <div className="mt-2 flex items-center space-x-4 text-xs text-muted">
              <span>Input: {execution.tokenUsage.input} tokens</span>
              <span>Output: {execution.tokenUsage.output} tokens</span>
            </div>
          )}

          {/* Execution Time */}
          {execution.endTime && (
            <div className="mt-1 text-xs text-muted">
              Completed in {Math.round((new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime()) / 1000)}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentExecutionStatus; 