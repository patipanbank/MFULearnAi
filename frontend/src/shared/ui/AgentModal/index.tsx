import React, { useState, useEffect, useMemo } from 'react';
import { FiX, FiPlus, FiTrash2, FiGlobe, FiLock, FiUsers } from 'react-icons/fi';
import { useAgentStore, useAuthStore } from '../../stores';
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

interface CollectionOption {
  _id: string;
  name: string;
  permission: string;
  createdBy: string;
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
    setEditingAgent,
    setShowAgentModal
  } = useAgentStore();

  // Local state for models and collections
  const [models, setModels] = useState<ModelOption[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);

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
    permission: 'PRIVATE', // Changed from isPublic to permission
    tags: [],
    createdBy: 'current-user'
  });

  const { user } = useAuthStore();

  // Get available permission options based on user role
  const availablePermissions = useMemo(() => {
    if (!user) return [{ value: 'PRIVATE', label: 'Private', icon: FiLock, description: 'Only you can access' }];

    const permissions = [{ value: 'PRIVATE', label: 'Private', icon: FiLock, description: 'Only you can access' }];

    // Staff, Admin, SuperAdmin can create department agents
    if (['Staffs', 'Admin', 'SuperAdmin'].includes(user.role)) {
      permissions.push({ value: 'DEPARTMENT', label: 'Department', icon: FiUsers, description: `Accessible by ${user.department || 'your department'} members` });
    }

    // Only Admin and SuperAdmin can create public agents
    if (['Admin', 'SuperAdmin'].includes(user.role)) {
      permissions.push({ value: 'PUBLIC', label: 'Public', icon: FiGlobe, description: 'Anyone can access' });
    }

    return permissions;
  }, [user]);

  const [newTag, setNewTag] = useState('');

  // Available tools (อัปเดตตาม backend capabilities)
  const availableTools = [
    { id: 'web_search', name: 'Web Search', description: 'Search the web for current information. Uses Google Search API or DuckDuckGo fallback.' },
    { id: 'calculator', name: 'Calculator', description: 'Perform mathematical calculations and expressions.' },
    { id: 'current_date', name: 'Current Date', description: 'Get current date and time with timezone support (Asia/Bangkok default).' },
    { id: 'memory_search', name: 'Memory Search', description: 'Search through chat memory for relevant context using vector similarity.' },
    { id: 'memory_embed', name: 'Memory Embed', description: 'Embed new information into chat memory for future retrieval.' }
  ];

  // Initialize models and fetch collections
  const initializeData = async () => {
    // Set default models (อัปเดตตาม backend support)
    setLoadingModels(true);
    const defaultModels = [
      { id: 'anthropic.claude-3-5-sonnet-20240620-v1:0', name: 'Claude 3.5 Sonnet (Recommended)' },
      { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku (Fast)' },
      { id: 'anthropic.claude-3-opus-20240229-v1:0', name: 'Claude 3 Opus (Most Capable)' },
      { id: 'anthropic.claude-3-sonnet-20240229-v1:0', name: 'Claude 3 Sonnet (Balanced)' }
    ];
    setModels(defaultModels);
    setLoadingModels(false);

    setLoadingCollections(true);
    try {
      // First, try fetching the user's private and public collections
      const loadedCollections = await api.get<CollectionOption[]>('/collections/');
      setCollections(loadedCollections);
    } catch (error: any) {
      // If the first attempt fails with an authentication error, try the public endpoint
      if (error.response?.status === 401) {
        try {
          const publicCollections = await api.get<CollectionOption[]>('/collections/public/');
          setCollections(publicCollections);
        } catch (publicError: any) {
          console.warn('Failed to load public collections as well:', publicError);
          setCollections([]); // Continue with empty collections
        }
      } else {
        // For any other error (network, server error, etc.), fail gracefully
        console.warn('Failed to load collections:', error);
        setCollections([]);
      }
    } finally {
      setLoadingCollections(false);
    }
  };

  // Initialize data (models and collections) when the modal opens
  useEffect(() => {
    if (isOpen) {
      initializeData();
    }
  }, [isOpen]); // Run only when the modal's open state changes

  // Initialize form data based on edit mode and selected agent
  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && selectedAgent) {
      // Normalize agent data to ensure permission field exists
      const normalizedAgent = {
        ...selectedAgent,
        permission: selectedAgent.permission || (selectedAgent.isPublic ? 'PUBLIC' : 'PRIVATE')
      };
      setFormData(normalizedAgent);
    } else {
      // Reset to default for new agent creation
      const defaultPermission = availablePermissions.length > 0 ? availablePermissions[0].value : 'PRIVATE';
      setFormData({
        name: '',
        description: '',
        systemPrompt: '',
        modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        collectionNames: [],
        tools: [],
        temperature: 0.7,
        maxTokens: 4000,
        permission: defaultPermission,
        tags: [],
        createdBy: 'current-user'
      });
    }
  }, [isEditing, selectedAgent, isOpen, availablePermissions]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing && selectedAgent) {
      updateAgent(selectedAgent.id, formData);
    } else {
      createAgent(formData as Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'rating'>);
    }
    
    handleClose();
  };

  const handleClose = () => {
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
                  disabled={loadingModels}
                >
                  <option value="">Select a model</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                {formData.modelId && (
                  <div className="mt-2 p-2 bg-secondary rounded-lg">
                    <div className="text-xs text-muted">
                      {formData.modelId === 'anthropic.claude-3-5-sonnet-20240620-v1:0' && 
                        '🎯 Best overall performance for most tasks. Latest and most capable model with excellent reasoning.'}
                      {formData.modelId === 'anthropic.claude-3-haiku-20240307-v1:0' && 
                        '⚡ Fastest model, ideal for quick responses and simple tasks. Cost-effective choice.'}
                      {formData.modelId === 'anthropic.claude-3-opus-20240229-v1:0' && 
                        '🧠 Most intelligent model for complex reasoning and analysis. Best for sophisticated tasks.'}
                      {formData.modelId === 'anthropic.claude-3-sonnet-20240229-v1:0' && 
                        '⚖️ Balanced performance between speed and capability. Good for general-purpose use.'}
                    </div>
                  </div>
                )}
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
                <span className="text-xs text-muted ml-2">(Define agent's role, expertise, and behavior)</span>
              </label>
              <textarea
                required
                rows={6}
                className="input"
                placeholder="Example: You are a helpful programming assistant with expertise in TypeScript, React, and Node.js. You provide clear, practical code examples and explanations. Always include error handling and follow best practices. When using knowledge base information, cite your sources clearly."
                value={formData.systemPrompt || ''}
                onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
              />
              <div className="text-xs text-muted mt-1">
                💡 Pro tip: Mention that the agent should use the available tools and knowledge base collections when relevant to user queries.
              </div>
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
                  {formData.temperature || 0.7} - 
                  {(formData.temperature || 0.7) <= 0.3 && ' Very focused and deterministic'}
                  {(formData.temperature || 0.7) > 0.3 && (formData.temperature || 0.7) <= 0.7 && ' Balanced creativity and focus'}
                  {(formData.temperature || 0.7) > 0.7 && ' More creative and varied'}
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
                  step="100"
                  className="input"
                  value={formData.maxTokens || 4000}
                  onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                />
                <div className="text-xs text-muted mt-1">
                  {formData.maxTokens || 4000} tokens ≈ {Math.round((formData.maxTokens || 4000) * 0.75)} words max response length
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-3">
                  Permission
                </label>
                <div className="space-y-3">
                  {availablePermissions.map((permOption) => {
                    const IconComponent = permOption.icon;
                    const isSelected = formData.permission === permOption.value;
                    return (
                      <div
                        key={permOption.value}
                        className={`relative cursor-pointer rounded-xl border-2 p-3 transition-all duration-200 hover:shadow-sm ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 ring-opacity-20 dark:bg-blue-900/20 dark:border-blue-400'
                            : 'border-border bg-card hover:border-border-hover'
                        }`}
                        onClick={() => handleInputChange('permission', permOption.value)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`flex-shrink-0 p-1.5 rounded-lg ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-secondary text-muted'
                          }`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium text-sm ${
                              isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-primary'
                            }`}>
                              {permOption.label}
                            </div>
                            <div className={`text-xs mt-0.5 leading-relaxed ${
                              isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-secondary'
                            }`}>
                              {permOption.description}
                            </div>
                          </div>
                          <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-border'
                          }`}>
                            {isSelected && (
                              <div className="w-full h-full rounded-full bg-white transform scale-50"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Collections */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Knowledge Collections
              </label>
              {loadingCollections ? (
                <div className="p-4 text-center text-muted">Loading collections...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {collections.map((collection) => (
                    <div
                      key={collection._id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        (formData.collectionNames || []).includes(collection.name)
                          ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:ring-blue-400'
                          : 'border-border hover:border-border-hover'
                      }`}
                      onClick={() => handleCollectionToggle(collection.name)}
                    >
                      <div className="font-medium text-sm">{collection.name}</div>
                      <div className="text-xs text-muted">{collection.permission}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tools */}
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Available Tools
              </label>
              
              {/* Static Tools */}
              <div className="space-y-2 mb-4">
                <h4 className="text-sm font-medium text-secondary mb-2">System Tools</h4>
                {availableTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handleToolToggle(tool.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      (formData.tools || []).some((t: any) => t.id === tool.id)
                        ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:ring-blue-400'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <div className="font-medium text-sm">{tool.name}</div>
                    <div className="text-xs text-muted">{tool.description}</div>
                  </button>
                ))}
              </div>

              {/* Dynamic Knowledge Base Tools */}
              {formData.collectionNames && formData.collectionNames.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-secondary mb-2">
                    Knowledge Base Search Tools
                    <span className="text-xs text-muted ml-2">(Auto-generated from selected collections)</span>
                  </h4>
                  <div className="bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 rounded-lg p-3">
                    <div className="space-y-2">
                      {formData.collectionNames.map((collectionName) => (
                        <div key={collectionName} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <div className="flex-1">
                            <div className="font-medium text-sm text-blue-700 dark:text-blue-300">
                              search_{collectionName}
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              Search and retrieve information from the {collectionName} knowledge base using vector similarity
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 italic">
                      💡 These tools are automatically created and will allow the agent to search through your selected knowledge base collections.
                    </div>
                  </div>
                </div>
              )}
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
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-card border border-blue-500 text-blue-800 shadow-sm"
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