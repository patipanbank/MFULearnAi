import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { useAgentStore, useModelsStore } from '../../stores';
import type { AgentConfig, AgentTool } from '../../stores/agentStore';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
}

const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  onClose,
  isEditing = false
}) => {
  const {
    selectedAgent,
    createAgent,
    updateAgent,
    setCreatingAgent,
    setEditingAgent,
    setShowAgentModal
  } = useAgentStore();

  const { models, collections } = useModelsStore();

  // Form state
  const [formData, setFormData] = useState<Partial<AgentConfig>>({
    name: '',
    description: '',
    systemPrompt: '',
    modelId: '',
    collectionNames: [],
    tools: [],
    temperature: 0.7,
    maxTokens: 4000,
    isPublic: false,
    tags: [],
    createdBy: 'current-user'
  });

  const [newTag, setNewTag] = useState('');

  // Available tools
  const availableTools = [
    { id: 'web_search', name: 'Web Search', description: 'Search the web for current information' },
    { id: 'calculator', name: 'Calculator', description: 'Perform mathematical calculations' },
    { id: 'function', name: 'Custom Function', description: 'Custom function tools' }
  ];

  // Initialize form data
  useEffect(() => {
    if (isEditing && selectedAgent) {
      setFormData(selectedAgent);
    } else {
      setFormData({
        name: '',
        description: '',
        systemPrompt: '',
        modelId: models.length > 0 ? models[0].id : '',
        collectionNames: [],
        tools: [],
        temperature: 0.7,
        maxTokens: 4000,
        isPublic: false,
        tags: [],
        createdBy: 'current-user'
      });
    }
  }, [isEditing, selectedAgent, models]);

  const handleInputChange = (field: keyof AgentConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCollectionToggle = (collectionName: string) => {
    const currentCollections = formData.collectionNames || [];
    const isSelected = currentCollections.includes(collectionName);
    
    if (isSelected) {
      handleInputChange('collectionNames', currentCollections.filter(c => c !== collectionName));
    } else {
      handleInputChange('collectionNames', [...currentCollections, collectionName]);
    }
  };

  const handleToolToggle = (toolId: string) => {
    const currentTools = formData.tools || [];
    const existingTool = currentTools.find(t => t.id === toolId);
    
    if (existingTool) {
      handleInputChange('tools', currentTools.filter(t => t.id !== toolId));
    } else {
      const toolInfo = availableTools.find(t => t.id === toolId);
      if (toolInfo) {
        const newTool: AgentTool = {
          id: toolId,
          name: toolInfo.name,
          description: toolInfo.description,
          type: toolId as AgentTool['type'],
          config: {},
          enabled: true
        };
        handleInputChange('tools', [...currentTools, newTool]);
      }
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !(formData.tags || []).includes(newTag.trim())) {
      handleInputChange('tags', [...(formData.tags || []), newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleInputChange('tags', (formData.tags || []).filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isEditing && selectedAgent) {
        await updateAgent(selectedAgent.id, formData);
      } else {
        await createAgent(formData as Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'rating'>);
      }
      
      handleClose();
    } catch (error) {
      console.error('Failed to save agent:', error);
    }
  };

  const handleClose = () => {
    setCreatingAgent(false);
    setEditingAgent(false);
    setShowAgentModal(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-4xl w-full max-h-90vh overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary">
              {isEditing ? 'Edit Agent' : 'Create New Agent'}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="btn-ghost p-2"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g., Programming Assistant"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  AI Model *
                </label>
                <select
                  required
                  className="select"
                  value={formData.modelId || ''}
                  onChange={(e) => handleInputChange('modelId', e.target.value)}
                >
                  <option value="">Select a model</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Description *
              </label>
              <input
                type="text"
                required
                className="input"
                placeholder="Brief description of what this agent does"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                System Prompt *
              </label>
              <textarea
                required
                rows={4}
                className="input"
                placeholder="Define the agent's personality, expertise, and behavior..."
                value={formData.systemPrompt || ''}
                onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
              />
            </div>

            {/* Advanced Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Temperature
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  className="w-full"
                  value={formData.temperature || 0.7}
                  onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                />
                <div className="text-xs text-muted mt-1">
                  {formData.temperature || 0.7} (Creativity)
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="100"
                  max="8000"
                  className="input"
                  value={formData.maxTokens || 4000}
                  onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Visibility
                </label>
                <button
                  type="button"
                  onClick={() => handleInputChange('isPublic', !formData.isPublic)}
                  className="flex items-center space-x-2 p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
                >
                  {formData.isPublic ? (
                    <FiToggleRight className="h-5 w-5 text-green-500" />
                  ) : (
                    <FiToggleLeft className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="text-sm">
                    {formData.isPublic ? 'Public' : 'Private'}
                  </span>
                </button>
              </div>
            </div>

            {/* Collections */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Knowledge Collections
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {collections.map((collection) => (
                  <button
                    key={collection.name}
                    type="button"
                    onClick={() => handleCollectionToggle(collection.name)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      (formData.collectionNames || []).includes(collection.name)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <div className="font-medium text-sm">{collection.name}</div>
                    <div className="text-xs text-muted">{collection.permission}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tools */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Available Tools
              </label>
              <div className="space-y-2">
                {availableTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolToggle(tool.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      (formData.tools || []).some(t => t.id === tool.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <div className="font-medium text-sm">{tool.name}</div>
                    <div className="text-xs text-muted">{tool.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.tags || []).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 hover:text-red-600"
                    >
                      <FiTrash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="btn-secondary"
                >
                  <FiPlus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              {isEditing ? 'Update Agent' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentModal; 