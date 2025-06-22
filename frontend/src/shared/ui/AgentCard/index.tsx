import React from 'react';
import { FiUser, FiEdit, FiCopy, FiTrash2, FiPlay, FiSettings, FiStar } from 'react-icons/fi';
import type { AgentConfig } from '../../stores/agentStore';

interface AgentCardProps {
  agent: AgentConfig;
  onEdit?: (agent: AgentConfig) => void;
  onDuplicate?: (agent: AgentConfig) => void;
  onDelete?: (agentId: string) => void;
  onUse?: (agent: AgentConfig) => void;
  onConfigure?: (agent: AgentConfig) => void;
  showActions?: boolean;
  compact?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onDuplicate,
  onDelete,
  onUse,
  onConfigure,
  showActions = true,
  compact = false
}) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(agent);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(agent);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      onDelete?.(agent.id);
    }
  };

  const handleConfigure = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfigure?.(agent);
  };

  const handleUse = () => {
    onUse?.(agent);
  };

  return (
    <div className={`card card-hover ${compact ? 'p-4' : 'p-6'} cursor-pointer`} onClick={handleUse}>
      {/* Agent Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1">
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FiUser className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary truncate">{agent.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                agent.isPublic 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}>
                {agent.isPublic ? 'Public' : 'Private'}
              </span>
              {agent.rating > 0 && (
                <div className="flex items-center space-x-1">
                  <FiStar className="h-3 w-3 text-yellow-500" />
                  <span className="text-xs text-muted">{agent.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Menu */}
        {showActions && (
          <div className="flex items-center space-x-1 flex-shrink-0">
            {onConfigure && (
              <button
                onClick={handleConfigure}
                className="btn-ghost p-2"
                title="Configure Agent"
              >
                <FiSettings className="h-4 w-4" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={handleEdit}
                className="btn-ghost p-2"
                title="Edit Agent"
              >
                <FiEdit className="h-4 w-4" />
              </button>
            )}
            {onDuplicate && (
              <button
                onClick={handleDuplicate}
                className="btn-ghost p-2"
                title="Duplicate Agent"
              >
                <FiCopy className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="btn-ghost p-2 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                title="Delete Agent"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Agent Description */}
      {!compact && (
        <p className="text-secondary text-sm mb-4 line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Agent Stats */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Model:</span>
          <span className="text-primary font-medium text-xs truncate ml-2">
            {agent.modelId.split('/').pop() || agent.modelId}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Collections:</span>
          <span className="text-primary">{agent.collectionNames.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Tools:</span>
          <span className="text-primary">{agent.tools.filter(t => t.enabled).length}</span>
        </div>
        {!compact && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted">Usage:</span>
              <span className="text-primary">{agent.usageCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Updated:</span>
              <span className="text-primary">{new Date(agent.updatedAt).toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>

      {/* Tags */}
      {!compact && agent.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {agent.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {tag}
            </span>
          ))}
          {agent.tags.length > 3 && (
            <span className="text-xs text-muted">+{agent.tags.length - 3} more</span>
          )}
        </div>
      )}

      {/* Use Agent Button */}
      {!compact && (
        <button 
          className="w-full mt-4 btn-secondary flex items-center justify-center space-x-2"
          onClick={handleUse}
        >
          <FiPlay className="h-4 w-4" />
          <span>Use This Agent</span>
        </button>
      )}
    </div>
  );
};

export default AgentCard; 