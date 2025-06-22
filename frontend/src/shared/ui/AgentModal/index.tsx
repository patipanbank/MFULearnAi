import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiPlus, FiToggleLeft, FiToggleRight, FiRefreshCw, FiAlertCircle, FiTag } from 'react-icons/fi';
import { useAgentStore, useUIStore } from '../../stores';
import { api } from '../../lib/api';
import type { AgentConfig, AgentTool } from '../../stores/agentStore';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing?: boolean;
}

interface ModelOption {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  permission: string;
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
    isCreatingAgent,
    setCreatingAgent,
    setEditingAgent,
    setShowAgentModal
  } = useAgentStore();
  
  const { addToast } = useUIStore();

  // Local state for models and collections
  const [models, setModels] = useState<ModelOption[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to track if we've already initialized data
  const hasInitializedRef = useRef(false);

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
  });

  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});
  const [newTag, setNewTag] = useState('');

  // Available tools with icons, descriptions and more details
  const availableTools = [
    { 
      id: 'web_search', 
      name: 'Web Search', 
      description: 'Search the web for current information and facts',
      details: 'Provides access to up-to-date information from the internet'
    },
    { 
      id: 'calculator', 
      name: 'Calculator', 
      description: 'Perform mathematical calculations',
      details: 'Solves mathematical problems and equations'
    },
    { 
      id: 'retriever', 
      name: 'Knowledge Retriever', 
      description: 'Retrieve information from knowledge collections',
      details: 'Accesses information from the selected knowledge collections'
    }
  ];

  // Initialize models and fetch collections
  const initializeData = async () => {
    // Prevent duplicate API calls
    if (hasInitializedRef.current) return;
    
    setError(null);
    
    // Set default models (no API call needed)
    setLoadingModels(true);
    try {
      // In a real implementation, this could be an API call
      const defaultModels = [
        { id: 'anthropic.claude-3-5-sonnet-20240620-v1:0', name: 'Claude 3.5 Sonnet' },
        { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku' },
        { id: 'anthropic.claude-3-opus-20240229-v1:0', name: 'Claude 3 Opus' },
        { id: 'amazon.titan-text-express-v1', name: 'Titan Text Express' }
      ];
      setModels(defaultModels);
    } catch (error) {
      console.error('Error fetching models:', error);
      setError('Failed to load model options');
    } finally {
      setLoadingModels(false);
    }
    
    // Fetch collections
    setLoadingCollections(true);
    try {
      const response = await api.get<Collection[]>('/api/collections');
      if (response.success && Array.isArray(response.data)) {
        setCollections(response.data);
      } else {
        console.error('Failed to fetch collections:', response.error);
        setCollections([]);
        setError('Failed to load collections');
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      setCollections([]);
      setError('Failed to load collections');
    } finally {
      setLoadingCollections(false);
    }
    
    // Mark as initialized
    hasInitializedRef.current = true;
  };

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen) {
      initializeData();
      setFormErrors({});
    } else {
      // Reset the flag when modal closes so we can fetch fresh data next time
      hasInitializedRef.current = false;
    }
  }, [isOpen]);
  
  // Set form data when agent or models change
  useEffect(() => {
    if (isOpen) {
      if (isEditing && selectedAgent) {
        setFormData(selectedAgent);
      } else {
        setFormData({
          name: '',
          description: '',
          systemPrompt: '',
          modelId: models.length > 0 ? models[0].id : 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          collectionNames: [],
          tools: [],
          temperature: 0.7,
          maxTokens: 4000,
          isPublic: false,
          tags: [],
        });
      }
    }
  }, [isEditing, selectedAgent, models, isOpen]);

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Name must be at least 3 characters';
    }
    
    if (!formData.description?.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!formData.systemPrompt?.trim()) {
      errors.systemPrompt = 'System prompt is required';
    }
    
    if (!formData.modelId) {
      errors.modelId = 'Please select a model';
    }
    
    if (formData.temperature === undefined || formData.temperature < 0 || formData.temperature > 1) {
      errors.temperature = 'Temperature must be between 0 and 1';
    }
    
    if (formData.maxTokens === undefined || formData.maxTokens < 100 || formData.maxTokens > 8000) {
      errors.maxTokens = 'Max tokens must be between 100 and 8000';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof AgentConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field if it exists
    if (formErrors[field]) {
      setFormErrors(prev => {
        const updatedErrors = { ...prev };
        delete updatedErrors[field];
        return updatedErrors;
      });
    }
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
    const existingTool = currentTools.find((t: any) => t.id === toolId);
    
    if (existingTool) {
      handleInputChange('tools', currentTools.filter((t: any) => t.id !== toolId));
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
    
    // Validate form
    if (!validateForm()) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fix the errors in the form'
      });
      return;
    }
    
    try {
      setError(null);
      setCreatingAgent(true);
      
      if (isEditing && selectedAgent) {
        await updateAgent(selectedAgent.id, formData);
        addToast({
          type: 'success',
          title: 'Agent Updated',
          message: `${formData.name} has been updated successfully`
        });
      } else {
        await createAgent(formData as Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'rating'>);
        addToast({
          type: 'success',
          title: 'Agent Created',
          message: `${formData.name} has been created successfully`
        });
      }
      
      handleClose();
    } catch (error) {
      console.error('Failed to save agent:', error);
      setError(typeof error === 'string' ? error : 'An error occurred while saving the agent');
      addToast({
        type: 'error',
        title: `${isEditing ? 'Update' : 'Creation'} Failed`,
        message: `Failed to ${isEditing ? 'update' : 'create'} agent. Please try again.`
      });
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleClose = () => {
    setCreatingAgent(false);
    setEditingAgent(false);
    setShowAgentModal(false);
    setError(null);
    setFormErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay z-50">
      <div className="modal-content max-w-4xl w-full max-h-[85vh] overflow-y-auto bg-card border border-border rounded-xl shadow-lg">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary">
              {isEditing ? 'Edit Agent' : 'Create New Agent'}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="btn-ghost p-2 rounded-full"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center">
              <FiAlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className={`input ${formErrors.name ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
                  placeholder="e.g., Programming Assistant"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  AI Model <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className={`select ${formErrors.modelId ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
                  value={formData.modelId || ''}
                  onChange={(e) => handleInputChange('modelId', e.target.value)}
                  disabled={loadingModels}
                >
                  <option value="">Select a model</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                {formErrors.modelId && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.modelId}</p>
                )}
                {loadingModels && (
                  <p className="mt-1 text-xs text-muted">Loading models...</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className={`input ${formErrors.description ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
                placeholder="Brief description of what this agent does"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
              {formErrors.description && (
                <p className="mt-1 text-xs text-red-500">{formErrors.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                System Prompt <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                className={`input ${formErrors.systemPrompt ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
                placeholder="Define the agent's personality, expertise, and behavior..."
                value={formData.systemPrompt || ''}
                onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
              />
              {formErrors.systemPrompt && (
                <p className="mt-1 text-xs text-red-500">{formErrors.systemPrompt}</p>
              )}
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
                  className="w-full accent-blue-500"
                  value={formData.temperature || 0.7}
                  onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                />
                <div className="flex justify-between text-xs text-muted mt-1">
                  <span>Precise (0.0)</span>
                  <span>{formData.temperature || 0.7}</span>
                  <span>Creative (1.0)</span>
                </div>
                {formErrors.temperature && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.temperature}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="100"
                  max="8000"
                  className={`input ${formErrors.maxTokens ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
                  value={formData.maxTokens || 4000}
                  onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                />
                <div className="text-xs text-muted mt-1">
                  Maximum tokens in the response
                </div>
                {formErrors.maxTokens && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.maxTokens}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Visibility
                </label>
                <button
                  type="button"
                  onClick={() => handleInputChange('isPublic', !formData.isPublic)}
                  className="flex items-center space-x-2 p-2 rounded-lg border border-border hover:bg-secondary transition-colors w-full"
                >
                  {formData.isPublic ? (
                    <FiToggleRight className="h-5 w-5 text-green-500" />
                  ) : (
                    <FiToggleLeft className="h-5 w-5 text-muted" />
                  )}
                  <span className="text-sm">
                    {formData.isPublic ? 'Public - Everyone can use' : 'Private - Only you can use'}
                  </span>
                </button>
              </div>
            </div>

            {/* Knowledge Collections */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Knowledge Collections
                <span className="text-xs text-muted ml-2">(Optional)</span>
              </label>
              {loadingCollections ? (
                <div className="p-4 text-center">
                  <div className="animate-spin inline-block h-5 w-5 border-2 border-t-transparent border-primary rounded-full mr-2"></div>
                  <span className="text-muted">Loading collections...</span>
                </div>
              ) : collections.length === 0 ? (
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm text-muted">
                    No collections available. Create collections first to enhance your agent's knowledge.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      type="button"
                      onClick={() => handleCollectionToggle(collection.name)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        (formData.collectionNames || []).includes(collection.name)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-border hover:bg-secondary'
                      }`}
                    >
                      <div className="font-medium text-sm">{collection.name}</div>
                      <div className="text-xs text-muted line-clamp-1">{collection.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tools */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Available Tools
                <span className="text-xs text-muted ml-2">(Optional)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {availableTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolToggle(tool.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      (formData.tools || []).some((t: any) => t.id === tool.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-xs text-muted">{tool.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Tags
                <span className="text-xs text-muted ml-2">(Optional)</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(formData.tags || []).map((tag) => (
                  <div
                    key={tag}
                    className="px-2 py-1 rounded-full bg-secondary text-sm flex items-center"
                  >
                    <FiTag className="h-3 w-3 mr-1 text-muted" />
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 p-1 rounded-full hover:bg-tertiary hover:text-red-500"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <FiX className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Add a tag (e.g., coding, research)"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="btn-primary px-4"
                  disabled={!newTag.trim()}
                  aria-label="Add tag"
                >
                  <FiPlus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex justify-end space-x-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary min-w-24"
              disabled={isCreatingAgent}
            >
              {isCreatingAgent ? (
                <FiRefreshCw className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                isEditing ? 'Update Agent' : 'Create Agent'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentModal; 