import React, { useState } from 'react';
import { FiChevronDown, FiChevronRight, FiCpu } from 'react-icons/fi';

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
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isVisible || !content.trim()) {
    return null;
  }

  const shouldShow = content.trim().length > 0;

  if (!shouldShow) {
    return null;
  }

  return (
    <div className={`thinking-display mb-3 ${className}`}>
      {/* Thinking Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 w-full text-left p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors group"
      >
        <div className="flex items-center space-x-2 flex-1">
          <FiCpu className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {isStreaming ? 'Thinking...' : 'AI Reasoning'}
          </span>
          {isStreaming && (
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" />
              <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          )}
        </div>
        <div className="flex items-center">
          {isExpanded ? (
            <FiChevronDown className="h-4 w-4 text-blue-600 group-hover:text-blue-700" />
          ) : (
            <FiChevronRight className="h-4 w-4 text-blue-600 group-hover:text-blue-700" />
          )}
        </div>
      </button>

      {/* Thinking Content */}
      {isExpanded && (
        <div className="mt-2 p-4 bg-blue-25 border border-blue-100 rounded-lg">
          <div className="text-sm text-blue-900 whitespace-pre-wrap font-mono leading-relaxed">
            {content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingDisplay;