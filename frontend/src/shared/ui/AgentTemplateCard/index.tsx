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
  const handleUse = () => {
    onUse(template);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'Development': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Education': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Analytics': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Content': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Research': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'Business': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  return (
    <div className={`card card-hover p-6 cursor-pointer ${className}`} onClick={handleUse}>
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