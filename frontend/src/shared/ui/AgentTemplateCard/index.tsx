import React from 'react';
import { FiArrowRight, FiFileText } from 'react-icons/fi';
import type { AgentTemplate } from '../../stores/agentStore';

interface AgentTemplateCardProps {
  template: AgentTemplate;
  onUse: (template: AgentTemplate) => void;
  className?: string;
}

const AgentTemplateCard: React.FC<AgentTemplateCardProps> = ({
  template,
  onUse,
  className = ''
}) => {
  const handleUse = () => {
    onUse(template);
  };

  return (
    <div 
      className={`group card card-hover flex flex-col h-full p-6 cursor-pointer ${className}`}
      onClick={handleUse}
    >
      {/* Template Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4 flex-1">
          <div className="h-12 w-12 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
            <FiFileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-primary truncate group-hover:text-accent">{template.name}</h3>
            <span className="badge badge-secondary mt-1">
              {template.category}
            </span>
          </div>
        </div>
      </div>

      {/* Template Description */}
      <p className="text-secondary text-sm mb-4 line-clamp-2 flex-grow min-h-[40px]">
        {template.description}
      </p>

      {/* Template Features */}
      <div className="space-y-3 text-sm mb-4 pt-4 border-t border-secondary">
        <div className="flex items-center justify-between">
          <span className="text-muted">Recommended Tools</span>
          <span className="text-primary font-medium">{template.recommendedTools.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Collections</span>
          <span className="text-primary font-medium">{template.recommendedCollections.length}</span>
        </div>
      </div>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="mt-auto pt-4 border-t border-secondary flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {template.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="badge badge-outline">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Use Template Button */}
      <div className="mt-6">
        <button 
          className="w-full btn-primary flex items-center justify-center space-x-2"
          onClick={handleUse}
        >
          <span>Use Template</span>
          <FiArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AgentTemplateCard; 