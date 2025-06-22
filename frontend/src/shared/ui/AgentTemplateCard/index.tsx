import React from 'react';
import { FiArrowRight, FiTag, FiBox } from 'react-icons/fi';
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

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'Development': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Education': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Analytics': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Content': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Research': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'Business': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
    };
    return colors[category] || 'bg-secondary text-muted';
  };

  return (
    <div className={`card card-hover transition-all duration-200 ${className}`} onClick={handleUse}>
      {/* Template Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 bg-secondary rounded-lg flex items-center justify-center text-2xl">
            {template.icon || <FiBox className="h-6 w-6 text-muted" />}
          </div>
          <div>
            <h3 className="font-semibold text-primary">{template.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getCategoryColor(template.category)}`}>
              {template.category}
            </span>
          </div>
        </div>
      </div>

      {/* Template Description */}
      <div className="px-4">
        <p className="text-secondary text-sm line-clamp-2">
          {template.description || "No description provided"}
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-border-secondary my-3 mx-4"></div>

      {/* Template Features */}
      <div className="px-4 py-1">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Tools:</span>
            <span className="text-primary">{template.recommendedTools.length || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Collections:</span>
            <span className="text-primary">{template.recommendedCollections.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      {template.tags && template.tags.length > 0 && (
        <div className="px-4 pt-2 pb-3 flex flex-wrap gap-1">
          {template.tags.slice(0, 3).map((tag, index) => (
            <div key={index} className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-secondary text-secondary">
              <FiTag className="h-3 w-3 mr-1 text-muted" />
              <span>{tag}</span>
            </div>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs text-muted">+{template.tags.length - 3} more</span>
          )}
        </div>
      )}

      {/* Use Template Button */}
      <div className="p-4 pt-3">
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