import React, { useState } from 'react';
import { FiZap, FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface ThinkingDisplayProps {
  content: string;
  isStreaming?: boolean;
  isVisible?: boolean;
  className?: string;
}

const ThinkingDisplay: React.FC<ThinkingDisplayProps> = ({
  content,
  isStreaming = false,
  isVisible = true,
  className = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isVisible || !content || content.trim() === '') {
    return null;
  }

  // Clean the content - remove thinking tags and parse the content
  const cleanContent = content
    .replace(/<thinking>/gi, '')
    .replace(/<\/thinking>/gi, '')
    .trim();

  if (!cleanContent) {
    return null;
  }

  // Parse reasoning steps if they exist
  const steps = cleanContent.split(/\d+\.\s+/).filter(step => step.trim());

  return (
    <div className={`reasoning-box border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/30 ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <FiZap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            AI Reasoning Process
          </span>
          {isStreaming && (
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          )}
        </div>
        <div className="text-blue-600 dark:text-blue-400">
          {isExpanded ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-blue-200 dark:border-blue-800">
          <div className="mt-3 space-y-3">
            {steps.length > 1 ? (
              // Structured reasoning steps
              <div className="space-y-2">
                {steps.map((step, index) => {
                  if (!step.trim()) return null;

                  // Try to extract step title and content
                  const colonIndex = step.indexOf(':');
                  let title = '';
                  let stepContent = step;

                  if (colonIndex > 0 && colonIndex < 50) {
                    title = step.substring(0, colonIndex).trim();
                    stepContent = step.substring(colonIndex + 1).trim();
                  }

                  return (
                    <div key={index} className="reasoning-step">
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300 mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          {title && (
                            <div className="font-medium text-blue-800 dark:text-blue-200 text-sm mb-1">
                              {title}
                            </div>
                          )}
                          <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                            {stepContent}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Unstructured reasoning content
              <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-wrap">
                {cleanContent}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingDisplay;