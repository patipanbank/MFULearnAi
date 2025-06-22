import React from 'react';
import { FiEdit, FiCopy, FiTrash2, FiPlay, FiSettings, FiStar, FiZap } from 'react-icons/fi';
import type { AgentConfig } from '../../stores/agentStore';

interface AgentCardProps {
  agent: AgentConfig;
  onEdit?: (agent: AgentConfig) => void;
  onDuplicate?: (agent: AgentConfig) => void;
  onDelete?: (agentId: string) => void;
  onUse?: (agent: AgentConfig) => void;
  onConfigure?: (agent: AgentConfig) => void;
  compact?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onDuplicate,
  onDelete,
  onUse,
  onConfigure,
  compact = false
}) => {
  const handleGenericClick = (e: React.MouseEvent, action?: (agent: AgentConfig) => void) => {
    e.stopPropagation();
    action?.(agent);
  };
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
      onDelete?.(agent.id);
    }
  };

  const handleUse = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUse?.(agent);
  };

  return (
    <div 
      className={`group card card-hover flex flex-col h-full ${compact ? 'p-4' : 'p-6'}`}
      onClick={handleUse}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4 flex-1">
          <div className="h-12 w-12 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
            <FiZap className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary truncate group-hover:text-accent">{agent.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`badge ${agent.isPublic ? 'badge-secondary' : 'badge-outline'}`}>
                {agent.isPublic ? 'Public' : 'Private'}
              </span>
              {agent.rating > 0 && (
                <div className="flex items-center space-x-1">
                  <FiStar className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs text-secondary">{agent.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Menu - only shows on hover on non-compact cards */}
        {!compact && (
          <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onConfigure && <button onClick={(e) => handleGenericClick(e, onConfigure)} className="btn-ghost p-2" title="Configure"><FiSettings className="h-4 w-4" /></button>}
            {onEdit && <button onClick={(e) => handleGenericClick(e, onEdit)} className="btn-ghost p-2" title="Edit"><FiEdit className="h-4 w-4" /></button>}
            {onDuplicate && <button onClick={(e) => handleGenericClick(e, onDuplicate)} className="btn-ghost p-2" title="Duplicate"><FiCopy className="h-4 w-4" /></button>}
            {onDelete && <button onClick={handleDeleteClick} className="btn-ghost p-2 text-muted hover:text-destructive" title="Delete"><FiTrash2 className="h-4 w-4" /></button>}
          </div>
        )}
      </div>

      {/* Description - not in compact mode */}
      {!compact && (
        <p className="text-secondary text-sm mb-4 line-clamp-2 flex-grow-0">
          {agent.description || 'No description provided.'}
        </p>
      )}

      {/* Stats - flex-grow to push footer down */}
      <div className="flex-grow space-y-3 text-sm pt-4 border-t border-secondary">
        <div className="flex items-center justify-between">
          <span className="text-muted">Model</span>
          <span className="font-mono text-xs bg-tertiary px-2 py-1 rounded-md text-primary truncate">
            {agent.modelId.split('/').pop() || agent.modelId}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Collections</span>
          <span className="text-primary font-medium">{agent.collectionNames.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Tools</span>
          <span className="text-primary font-medium">{agent.tools.filter(t => t.enabled).length}</span>
        </div>
      </div>
      
      {/* Tags - not in compact mode */}
      {!compact && agent.tags.length > 0 && (
        <div className="mt-4 pt-4 border-t border-secondary flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {agent.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="badge badge-outline">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 flex-shrink-0">
        {compact ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Used {agent.usageCount} times</span>
            <div className="flex items-center">
              {onEdit && <button onClick={(e) => handleGenericClick(e, onEdit)} className="btn-ghost p-1.5" title="Edit"><FiEdit className="h-4 w-4" /></button>}
              {onDelete && <button onClick={handleDeleteClick} className="btn-ghost p-1.5 text-muted hover:text-destructive" title="Delete"><FiTrash2 className="h-4 w-4" /></button>}
            </div>
          </div>
        ) : (
          <button 
            className="w-full btn-primary flex items-center justify-center space-x-2"
            onClick={handleUse}
          >
            <FiPlay className="h-4 w-4" />
            <span>Use This Agent</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AgentCard;