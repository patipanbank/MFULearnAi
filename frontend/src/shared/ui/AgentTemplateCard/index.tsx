import React from 'react';
import { FiArrowRight, FiTag } from 'react-icons/fi';
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
  const handleUse = (event: React.MouseEvent) => {
    event.stopPropagation();
    onUse(template);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'Development': 'bg-card border border-blue-500 text-blue-800 shadow-sm',
      'Education': 'bg-card border border-green-500 text-green-800 shadow-sm',
      'Analytics': 'bg-card border border-purple-500 text-purple-800 shadow-sm',
      'Content': 'bg-card border border-orange-500 text-orange-800 shadow-sm',
      'Research': 'bg-card border border-indigo-500 text-indigo-800 shadow-sm',
      'Business': 'bg-card border border-emerald-500 text-emerald-800 shadow-sm'
    };
    return colors[category as keyof typeof colors] || 'bg-card border border-secondary text-secondary shadow-sm';
  };

  return (
    <div className={`card card-hover p-6 ${className}`}>
      {/* Template Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{template.icon}</div>
          <div>
            <h3 className="font-semibold text-primary">{template.name}</h3>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getCategoryColor(template.category)}`}>
              {template.category}
            </span>
          </div>
        </div>
      </div>

      {/* Template Description */}
      <p className="text-secondary text-sm mb-4 line-clamp-2">
        {template.description}
      </p>

      {/* Template Features */}
      <div className="space-y-2 text-sm mb-4">
        <div className="flex items-center justify-between">
          <span className="text-muted">Recommended Tools:</span>
          <span className="text-primary">{template.recommendedTools.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Collections:</span>
          <span className="text-primary">{template.recommendedCollections.length}</span>
        </div>
      </div>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {template.tags.slice(0, 3).map((tag, index) => (
            <div key={index} className="flex items-center space-x-1">
              <FiTag className="h-3 w-3 text-muted" />
              <span className="text-xs text-muted">{tag}</span>
            </div>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs text-muted">+{template.tags.length - 3} more</span>
          )}
        </div>
      )}

      {/* Use Template Button */}
      <button 
        className="w-full btn-primary flex items-center justify-center space-x-2"
        onClick={handleUse}
      >
        <span>Use Template</span>
        <FiArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export default AgentTemplateCard; 