import React from 'react';
import { FiArrowRight, FiTag } from 'react-icons/fi';
import type { AgentTemplate } from '../../stores/agentStore';

interface AgentTemplateCardProps {
  template: AgentTemplate;
  onUse: (template: AgentTemplate) => void;
  className?: string;
  isLoading?: boolean;
}

const AgentTemplateCard: React.FC<AgentTemplateCardProps> = ({
  template,
  onUse,
  className = '',
  isLoading = false
}) => {
  const handleUse = () => {
    if (!isLoading) {
      onUse(template);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'Development': 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-dark',
      'Education': 'bg-success/10 text-success dark:bg-success/20 dark:text-success-dark',
      'Analytics': 'bg-info/10 text-info dark:bg-info/20 dark:text-info-dark',
      'Content': 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning-dark',
      'Research': 'bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-secondary-dark',
      'Business': 'bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-dark'
    };
    return colors[category as keyof typeof colors] || 'bg-muted/10 text-muted dark:bg-muted/20 dark:text-muted-dark';
  };

  return (
    <div 
      className={`
        relative overflow-hidden
        bg-card dark:bg-card-dark
        border border-border dark:border-border-dark
        rounded-lg shadow-sm hover:shadow-md
        transition-all duration-200
        p-6
        cursor-pointer
        ${isLoading ? 'opacity-70 pointer-events-none' : ''}
        ${className}
      `} 
      onClick={handleUse}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 dark:bg-background-dark/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Template Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{template.icon}</div>
          <div>
            <h3 className="font-semibold text-foreground dark:text-foreground-dark">
              {template.name}
            </h3>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getCategoryColor(template.category)}`}>
              {template.category}
            </span>
          </div>
        </div>
      </div>

      {/* Template Description */}
      <p className="text-muted dark:text-muted-dark text-sm mb-4 line-clamp-2">
        {template.description}
      </p>

      {/* Template Features */}
      <div className="space-y-2 text-sm mb-4">
        <div className="flex items-center justify-between">
          <span className="text-muted dark:text-muted-dark">Recommended Tools:</span>
          <span className="text-foreground dark:text-foreground-dark">
            {template.recommendedTools.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted dark:text-muted-dark">Collections:</span>
          <span className="text-foreground dark:text-foreground-dark">
            {template.recommendedCollections.length}
          </span>
        </div>
      </div>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {template.tags.slice(0, 3).map((tag, index) => (
            <div key={index} className="flex items-center space-x-1">
              <FiTag className="h-3 w-3 text-muted dark:text-muted-dark" />
              <span className="text-xs text-muted dark:text-muted-dark">{tag}</span>
            </div>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs text-muted dark:text-muted-dark">
              +{template.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Use Template Button */}
      <button 
        className="w-full btn-primary flex items-center justify-center space-x-2
          disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleUse}
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border border-white"></div>
        ) : (
          <>
            <span>Use Template</span>
            <FiArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
};

export default AgentTemplateCard; 