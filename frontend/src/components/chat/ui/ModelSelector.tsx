import React, { useRef, useState } from 'react';
import { Model, Usage } from '../utils/types';

interface ModelSelectorProps {
  models: Model[];
  selectedModel: string;
  onSelectModel: (id: string) => void;
  usage?: Usage | null;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  models, 
  selectedModel, 
  onSelectModel,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 
          hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 min-w-[120px] md:min-w-[180px]"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="text-xs md:text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">
          {selectedModel ? (models.find(m => m.id === selectedModel)?.name ?? 'Select Model') : 'Select Model'}
        </span>
      </button>

      {isDropdownOpen && (
        <div 
          className="absolute bottom-full left-0 mb-2 p-2 rounded-lg border border-gray-300 dark:border-gray-600 
            bg-white dark:bg-gray-700 shadow-lg z-50 max-h-[200px] overflow-y-auto min-w-[200px]"
        >
          {models.map(model => (
            <button
              key={model.id}
              className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-600
                text-gray-900 dark:text-white transition-colors flex items-center gap-2 ${
                  model.id === selectedModel ? 'bg-blue-100 dark:bg-blue-900' : ''
                }`}
              onClick={() => {
                onSelectModel(model.id);
                setIsDropdownOpen(false);
              }}
            >
              <span className="truncate flex-1 font-medium">{model.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">({model.modelType})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector; 