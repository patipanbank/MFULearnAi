import React from 'react';
import { FiUser, FiEdit, FiCopy, FiTrash2, FiPlay, FiSettings, FiStar, FiTag } from 'react-icons/fi';
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

  // Format date in a readable way
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric' 
      });
    } catch (err) {
      return 'Unknown';
    }
  };

  // Get model display name from ID
  const getModelDisplayName = (modelId: string) => {
    if (!modelId) return 'Unknown';

    // Example model ID: anthropic.claude-3-5-sonnet-20240620-v1:0
    const parts = modelId.split('.');
    if (parts.length > 1) {
      // Extract readable name from the second part
      const modelName = parts[1].split('-').join(' ');
      return modelName.charAt(0).toUpperCase() + modelName.slice(1);
    }
    
    // Fallback to original ID
    return modelId;
  };

  return (
    <div className="card card-hover cursor-pointer transition-all duration-200" onClick={handleUse}>
      {/* Agent Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex items-center space-x-3 flex-1">
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FiUser className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary truncate">{agent.name}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                agent.isPublic 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-secondary text-muted'
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
                className="btn-ghost p-2 rounded-full"
                title="Configure Agent"
              >
                <FiSettings className="h-4 w-4" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={handleEdit}
                className="btn-ghost p-2 rounded-full"
                title="Edit Agent"
              >
                <FiEdit className="h-4 w-4" />
              </button>
            )}
            {onDuplicate && (
              <button
                onClick={handleDuplicate}
                className="btn-ghost p-2 rounded-full"
                title="Duplicate Agent"
              >
                <FiCopy className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="btn-ghost p-2 rounded-full hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
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
        <div className="px-4">
          <p className="text-secondary text-sm line-clamp-2">
            {agent.description || "No description provided"}
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-border-secondary my-2 mx-4"></div>

      {/* Agent Stats */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="col-span-2 flex items-center justify-between pb-1">
            <span className="text-muted">Model:</span>
            <span className="text-primary font-medium text-xs truncate ml-2 max-w-[70%]">
              {getModelDisplayName(agent.modelId)}
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
                <span className="text-primary">{formatDate(agent.updatedAt)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div className="px-4 pt-1 pb-3 flex flex-wrap gap-1">
          {agent.tags.slice(0, 3).map((tag, index) => (
            <div 
              key={index} 
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary"
            >
              <FiTag className="h-3 w-3 mr-1 text-muted" />
              {tag}
            </div>
          ))}
          {agent.tags.length > 3 && (
            <span className="text-xs text-muted">+{agent.tags.length - 3} more</span>
          )}
        </div>
      )}

      {/* Use Agent Button */}
      {!compact && (
        <div className="p-4 pt-2">
          <button 
            className="w-full btn-primary flex items-center justify-center space-x-2"
            onClick={handleUse}
          >
            <FiPlay className="h-4 w-4" />
            <span>Use This Agent</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AgentCard; 