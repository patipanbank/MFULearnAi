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
  isLoading?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onDuplicate,
  onDelete,
  onUse,
  onConfigure,
  showActions = true,
  compact = false,
  isLoading = false
}) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(agent);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(agent);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      try {
        await onDelete?.(agent.id);
      } catch (error) {
        console.error('Failed to delete agent:', error);
      }
    }
  };

  const handleConfigure = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfigure?.(agent);
  };

  const handleUse = () => {
    if (!isLoading) {
      onUse?.(agent);
    }
  };

  return (
    <div 
      className={`
        relative overflow-hidden
        bg-card dark:bg-card-dark
        border border-border dark:border-border-dark
        rounded-lg shadow-sm hover:shadow-md
        transition-all duration-200
        ${compact ? 'p-4' : 'p-6'} 
        ${onUse ? 'cursor-pointer' : ''}
        ${isLoading ? 'opacity-70 pointer-events-none' : ''}
      `}
      onClick={handleUse}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 dark:bg-background-dark/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Agent Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1">
          <div className="h-10 w-10 bg-gradient-to-br from-primary/80 to-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <FiUser className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground dark:text-foreground-dark truncate">
              {agent.name}
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`
                inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                ${agent.isPublic 
                  ? 'bg-success/10 text-success dark:bg-success/20 dark:text-success-dark' 
                  : 'bg-muted/10 text-muted dark:bg-muted/20 dark:text-muted-dark'}
              `}>
                {agent.isPublic ? 'Public' : 'Private'}
              </span>
              {agent.rating > 0 && (
                <div className="flex items-center space-x-1">
                  <FiStar className="h-3 w-3 text-warning" />
                  <span className="text-xs text-muted dark:text-muted-dark">
                    {agent.rating.toFixed(1)}
                  </span>
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
                className="btn-ghost p-2 text-muted hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark"
                title="Configure Agent"
              >
                <FiSettings className="h-4 w-4" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={handleEdit}
                className="btn-ghost p-2 text-muted hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark"
                title="Edit Agent"
              >
                <FiEdit className="h-4 w-4" />
              </button>
            )}
            {onDuplicate && (
              <button
                onClick={handleDuplicate}
                className="btn-ghost p-2 text-muted hover:text-foreground dark:text-muted-dark dark:hover:text-foreground-dark"
                title="Duplicate Agent"
              >
                <FiCopy className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="btn-ghost p-2 text-muted hover:text-error dark:text-muted-dark dark:hover:text-error-dark"
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
        <p className="text-muted dark:text-muted-dark text-sm mb-4 line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Agent Stats */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted dark:text-muted-dark">Model:</span>
          <span className="text-foreground dark:text-foreground-dark font-medium text-xs truncate ml-2">
            {agent.modelId.split('/').pop() || agent.modelId}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted dark:text-muted-dark">Collections:</span>
          <span className="text-foreground dark:text-foreground-dark">
            {agent.collectionNames.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted dark:text-muted-dark">Tools:</span>
          <span className="text-foreground dark:text-foreground-dark">
            {agent.tools.filter(t => t.enabled).length}
          </span>
        </div>
        {!compact && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted dark:text-muted-dark">Usage:</span>
              <span className="text-foreground dark:text-foreground-dark">
                {agent.usageCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted dark:text-muted-dark">Updated:</span>
              <span className="text-foreground dark:text-foreground-dark">
                {new Date(agent.updatedAt).toLocaleDateString()}
              </span>
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
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium
                bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-dark"
            >
              {tag}
            </span>
          ))}
          {agent.tags.length > 3 && (
            <span className="text-xs text-muted dark:text-muted-dark">
              +{agent.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Use Agent Button */}
      {!compact && onUse && (
        <button 
          className="w-full mt-4 btn-secondary flex items-center justify-center space-x-2
            disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleUse}
          disabled={isLoading}
        >
          <FiPlay className="h-4 w-4" />
          <span>Use This Agent</span>
        </button>
      )}
    </div>
  );
};

export default AgentCard; 