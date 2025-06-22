import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiFilter, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { useAgentStore, useUIStore } from '../../shared/stores';
import AgentCard from '../../shared/ui/AgentCard';
import AgentTemplateCard from '../../shared/ui/AgentTemplateCard';
import AgentModal from '../../shared/ui/AgentModal';
import Loading from '../../shared/ui/Loading';
import { api } from '../../shared/lib/api';
import type { AgentConfig, AgentTemplate } from '../../shared/stores/agentStore';

const AgentPage: React.FC = () => {
  // Store hooks
  const {
    agents,
    agentTemplates,
    showAgentModal,
    isEditingAgent,
    isLoadingAgents,
    fetchAgents,
    fetchTemplates,
    createAgent,
    deleteAgent,
    selectAgent,
    createAgentFromTemplate,
    setShowAgentModal,
    setCreatingAgent,
    setEditingAgent
  } = useAgentStore();

  const { addToast } = useUIStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setError(null);
      try {
        await fetchAgents();
      } catch (err) {
        setError('Failed to load agents. Please try again later.');
        console.error('Error loading agents:', err);
      }
    };
    
    loadData();
  }, [fetchAgents]);
  
  // Load templates when switching to template view
  useEffect(() => {
    if (showTemplates && agentTemplates.length === 0) {
      const loadTemplates = async () => {
        setIsLoadingTemplates(true);
        try {
          await fetchTemplates();
        } catch (err) {
          setError('Failed to load templates. Please try again later.');
          console.error('Error loading templates:', err);
        } finally {
          setIsLoadingTemplates(false);
        }
      };
      
      loadTemplates();
    }
  }, [showTemplates, agentTemplates.length, fetchTemplates]);

  // Filter agents and templates
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const filteredTemplates = agentTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(agentTemplates.map(t => t.category)))];

  // Handlers
  const handleCreateAgent = () => {
    setCreatingAgent(true);
    setShowAgentModal(true);
  };

  const handleEditAgent = (agent: AgentConfig) => {
    selectAgent(agent);
    setEditingAgent(true);
    setShowAgentModal(true);
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await deleteAgent(agentId);
      addToast({
        type: 'success',
        title: 'Agent Deleted',
        message: 'Agent has been successfully deleted'
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete agent'
      });
    }
  };

  const handleDuplicateAgent = async (agent: AgentConfig) => {
    try {
      // Create a new agent based on the existing one
      const { id, usageCount, rating, createdAt, updatedAt, ...agentData } = agent;
      
      const duplicatedAgent = await createAgent({
        ...agentData,
        name: `${agent.name} (Copy)`,
      });
      
      addToast({
        type: 'success',
        title: 'Agent Duplicated',
        message: `Created "${duplicatedAgent.name}"`
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Duplication Failed',
        message: 'Failed to duplicate agent'
      });
    }
  };

  const handleCreateFromTemplate = async (template: AgentTemplate) => {
    try {
      const newAgent = await createAgentFromTemplate(template.id);
      
      addToast({
        type: 'success',
        title: 'Agent Created',
        message: `Created "${newAgent.name}" from template`
      });
      
      // Switch back to agents view to show the new agent
      setShowTemplates(false);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: 'Failed to create agent from template'
      });
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setError(null);
    try {
      if (showTemplates) {
        setIsLoadingTemplates(true);
        await fetchTemplates();
        setIsLoadingTemplates(false);
      } else {
        await fetchAgents();
      }
      
      addToast({
        type: 'success',
        title: 'Refreshed',
        message: `${showTemplates ? 'Templates' : 'Agents'} refreshed successfully`
      });
    } catch (err) {
      setError(`Failed to refresh ${showTemplates ? 'templates' : 'agents'}. Please try again.`);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        message: `Failed to refresh ${showTemplates ? 'templates' : 'agents'}`
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">AI Agents</h1>
          <p className="text-secondary mt-1">
            {showTemplates 
              ? 'Choose from pre-built agent templates'
              : 'Create and manage specialized AI assistants'
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            className="btn-ghost p-2"
            aria-label="Refresh"
            title="Refresh"
          >
            <FiRefreshCw className={`h-5 w-5 ${isLoadingAgents || isLoadingTemplates ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className={`btn ${showTemplates ? 'btn-primary' : 'btn-secondary'}`}
          >
            {showTemplates ? 'My Agents' : 'Templates'}
          </button>
          
          {!showTemplates && (
            <button
              onClick={handleCreateAgent}
              className="btn-primary flex items-center space-x-2"
            >
              <FiPlus className="h-5 w-5" />
              <span>Create Agent</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder={showTemplates ? "Search templates..." : "Search agents..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        
        {showTemplates && (
          <div className="flex items-center space-x-2">
            <FiFilter className="h-4 w-4 text-muted" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="select min-w-[120px]"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FiAlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-lg font-medium text-primary mb-2">Something went wrong</p>
          <p className="text-secondary mb-4">{error}</p>
          <button onClick={handleRefresh} className="btn-primary">
            Try Again
          </button>
        </div>
      ) : isLoadingAgents && !showTemplates ? (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-secondary">Loading agents...</p>
          </div>
        </div>
      ) : isLoadingTemplates && showTemplates ? (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-secondary">Loading templates...</p>
          </div>
        </div>
      ) : showTemplates ? (
        /* Agent Templates Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <AgentTemplateCard
              key={template.id}
              template={template}
              onUse={handleCreateFromTemplate}
            />
          ))}
          
          {filteredTemplates.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted">No templates found matching your criteria</p>
            </div>
          )}
        </div>
      ) : (
        /* My Agents Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={handleEditAgent}
              onDuplicate={handleDuplicateAgent}
              onDelete={handleDeleteAgent}
              compact={true}
            />
          ))}

          {/* Create New Agent Card */}
          <div 
            onClick={handleCreateAgent}
            className="bg-tertiary border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-border-hover hover:bg-secondary transition-colors min-h-64"
          >
            <div className="h-12 w-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <FiPlus className="h-6 w-6 text-muted" />
            </div>
            <h3 className="font-medium text-primary mb-2">Create New Agent</h3>
            <p className="text-muted text-sm">
              Build a specialized AI assistant for your specific needs
            </p>
          </div>
          
          {filteredAgents.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted">No agents found. Create your first agent to get started!</p>
            </div>
          )}
        </div>
      )}

      {/* Agent Modal */}
      <AgentModal
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        isEditing={isEditingAgent}
      />
    </div>
  );
};

export default AgentPage; 