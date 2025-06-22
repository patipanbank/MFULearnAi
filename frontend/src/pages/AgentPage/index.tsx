import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiFilter, FiBox, FiGrid } from 'react-icons/fi';
import { useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import AgentCard from '../../shared/ui/AgentCard';
import AgentTemplateCard from '../../shared/ui/AgentTemplateCard';
import AgentModal from '../../shared/ui/AgentModal';
import type { AgentConfig, AgentTemplate } from '../../shared/stores/agentStore';

const AgentPage: React.FC = () => {
  // Store hooks
  const {
    agents,
    agentTemplates,
    showAgentModal,
    isEditingAgent,
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

  const { user } = useAuthStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showTemplates, setShowTemplates] = useState(false);

  // Initialize data
  useEffect(() => {
    fetchAgents();
    fetchTemplates();
  }, [fetchAgents, fetchTemplates]);

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
    // Reset selected agent and set editing state
    selectAgent(null);
    setEditingAgent(false);
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
    if (!user?._id) {
      addToast({ type: 'error', title: 'Authentication Error', message: 'You must be logged in to duplicate an agent.' });
      return;
    }

    try {
      const duplicatedAgent = await createAgent({
        ...agent,
        name: `${agent.name} (Copy)`,
        createdBy: user._id.$oid,
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
    if (!user?._id) {
      addToast({ type: 'error', title: 'Authentication Error', message: 'You must be logged in to create an agent.' });
      return;
    }

    try {
      const newAgent = await createAgentFromTemplate(template.id, {
        createdBy: user._id.$oid,
      });
      
      addToast({
        type: 'success',
        title: 'Agent Created',
        message: `Created "${newAgent.name}" from template`
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: 'Failed to create agent from template'
      });
    }
  };

  return (
    <div className="flex-1 bg-primary p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary">AI Agents</h1>
            <p className="text-secondary mt-1">
              {showTemplates 
                ? 'Choose from pre-built agent templates to get started.'
                : 'Create and manage your specialized AI assistants.'
              }
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="btn-secondary"
            >
              {showTemplates ? 'My Agents' : 'View Templates'}
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
        <div className="flex items-center space-x-4 mb-8">
          <div className="relative flex-1 max-w-lg">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted" />
            <input
              type="text"
              placeholder={showTemplates ? "Search templates by name or description..." : "Search agents by name, description, or tag..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full pl-12"
            />
          </div>
          
          {showTemplates && (
            <div className="relative">
              <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="select pl-10"
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
        {showTemplates ? (
          /* Agent Templates Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTemplates.map((template) => (
              <AgentTemplateCard
                key={template.id}
                template={template}
                onUse={handleCreateFromTemplate}
              />
            ))}
            
            {filteredTemplates.length === 0 && (
              <div className="col-span-full text-center py-20 card border-dashed">
                <FiSearch className="mx-auto h-12 w-12 text-muted" />
                <h3 className="mt-4 text-lg font-medium text-primary">No Templates Found</h3>
                <p className="mt-1 text-sm text-secondary">
                  Your search for "{searchQuery}" did not match any templates.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* My Agents Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Create New Agent Card */}
            <div 
              onClick={handleCreateAgent}
              className="card border-2 border-dashed border-border flex flex-col items-center justify-center text-center cursor-pointer group hover:border-accent hover:bg-secondary transition-all"
            >
              <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center mb-4 group-hover:bg-accent transition-colors">
                <FiPlus className="h-8 w-8 text-primary group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-medium text-primary text-lg">Create New Agent</h3>
              <p className="text-muted text-sm mt-1 px-4">
                Build a specialized AI assistant from scratch.
              </p>
            </div>

            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={handleEditAgent}
                onDuplicate={handleDuplicateAgent}
                onDelete={handleDeleteAgent}
                onUse={() => { /* maybe navigate to chat with this agent */ }}
                compact={false}
              />
            ))}
            
            {filteredAgents.length === 0 && (
              <div className="col-span-full text-center py-20 card border-dashed">
                <FiGrid className="mx-auto h-12 w-12 text-muted" />
                <h3 className="mt-4 text-lg font-medium text-primary">No Agents Found</h3>
                <p className="mt-1 text-sm text-secondary">
                  Create your first agent to get started.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Agent Modal */}
        <AgentModal
          isOpen={showAgentModal}
          isEditing={isEditingAgent}
          onClose={() => setShowAgentModal(false)}
        />
      </div>
    </div>
  );
};

export default AgentPage; 