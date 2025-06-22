import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiFilter, FiAlertCircle } from 'react-icons/fi';
import { useAgentStore, useUIStore } from '../../shared/stores';
import AgentCard from '../../shared/ui/AgentCard';
import AgentTemplateCard from '../../shared/ui/AgentTemplateCard';
import AgentModal from '../../shared/ui/AgentModal';
import Loading from '../../shared/ui/Loading';
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
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null);
        await Promise.all([fetchAgents(), fetchTemplates()]);
      } catch (err) {
        setError('Failed to load agents. Please try again later.');
        console.error('Error loading agents:', err);
      }
    };
    loadData();
  }, [fetchAgents, fetchTemplates]);

  // Filter agents and templates
  const filteredAgents = agents.filter(agent => {
    const searchTerms = searchQuery.toLowerCase().split(' ');
    return searchTerms.every(term => 
      agent.name.toLowerCase().includes(term) ||
      agent.description.toLowerCase().includes(term) ||
      agent.tags.some(tag => tag.toLowerCase().includes(term))
    );
  });

  const filteredTemplates = agentTemplates.filter(template => {
    const searchTerms = searchQuery.toLowerCase().split(' ');
    const matchesSearch = searchTerms.every(term =>
      template.name.toLowerCase().includes(term) ||
      template.description.toLowerCase().includes(term)
    );
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
      setLoadingStates(prev => ({ ...prev, [agentId]: true }));
      await deleteAgent(agentId);
      addToast({
        type: 'success',
        title: 'Agent Deleted',
        message: 'Agent has been successfully deleted'
      });
    } catch (error) {
      console.error('Delete failed:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete agent. Please try again.'
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleDuplicateAgent = async (agent: AgentConfig) => {
    try {
      setLoadingStates(prev => ({ ...prev, [agent.id]: true }));
      const duplicatedAgent = await createAgent({
        ...agent,
        name: `${agent.name} (Copy)`,
        createdBy: 'current-user' // This should come from auth store
      });
      
      addToast({
        type: 'success',
        title: 'Agent Duplicated',
        message: `Created "${duplicatedAgent.name}"`
      });
    } catch (error) {
      console.error('Duplication failed:', error);
      addToast({
        type: 'error',
        title: 'Duplication Failed',
        message: 'Failed to duplicate agent. Please try again.'
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [agent.id]: false }));
    }
  };

  const handleCreateFromTemplate = async (template: AgentTemplate) => {
    try {
      setLoadingStates(prev => ({ ...prev, [template.id]: true }));
      const newAgent = await createAgentFromTemplate(template.id, {
        createdBy: 'current-user' // This should come from auth store
      });
      
      addToast({
        type: 'success',
        title: 'Agent Created',
        message: `Created "${newAgent.name}" from template`
      });
    } catch (error) {
      console.error('Creation from template failed:', error);
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: 'Failed to create agent from template. Please try again.'
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, [template.id]: false }));
    }
  };

  if (isLoadingAgents && !agents.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading size="lg" fullScreen={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <FiAlertCircle className="h-12 w-12 text-error mb-4" />
        <h2 className="text-xl font-semibold text-foreground dark:text-foreground-dark mb-2">
          Something went wrong
        </h2>
        <p className="text-muted dark:text-muted-dark mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-foreground-dark">
            AI Agents
          </h1>
          <p className="text-muted dark:text-muted-dark mt-1">
            {showTemplates 
              ? 'Choose from pre-built agent templates'
              : 'Create and manage specialized AI assistants'
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
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
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted dark:text-muted-dark" />
          <input
            type="text"
            placeholder={showTemplates ? "Search templates..." : "Search agents..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full bg-background dark:bg-background-dark"
          />
        </div>
        
        {showTemplates && (
          <div className="flex items-center space-x-2">
            <FiFilter className="h-4 w-4 text-muted dark:text-muted-dark" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input min-w-[120px] bg-background dark:bg-background-dark"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <AgentTemplateCard
              key={template.id}
              template={template}
              onUse={handleCreateFromTemplate}
              isLoading={loadingStates[template.id]}
            />
          ))}
          
          {filteredTemplates.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted dark:text-muted-dark">
                No templates found matching your criteria
              </p>
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
              isLoading={loadingStates[agent.id]}
              compact={true}
            />
          ))}

          {/* Create New Agent Card */}
          <div 
            onClick={handleCreateAgent}
            className="bg-card dark:bg-card-dark border-2 border-dashed border-border dark:border-border-dark 
              rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer 
              hover:border-border-hover dark:hover:border-border-hover-dark 
              hover:bg-background dark:hover:bg-background-dark 
              transition-colors min-h-64"
          >
            <div className="h-12 w-12 bg-background dark:bg-background-dark rounded-lg 
              flex items-center justify-center mb-4 border border-border dark:border-border-dark">
              <FiPlus className="h-6 w-6 text-muted dark:text-muted-dark" />
            </div>
            <h3 className="font-medium text-foreground dark:text-foreground-dark mb-2">
              Create New Agent
            </h3>
            <p className="text-muted dark:text-muted-dark text-sm">
              Build a specialized AI assistant for your specific needs
            </p>
          </div>
          
          {filteredAgents.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted dark:text-muted-dark">
                No agents found. Create your first agent to get started!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Agent Modal */}
      <AgentModal
        isOpen={showAgentModal}
        onClose={() => {
          setShowAgentModal(false);
          setCreatingAgent(false);
          setEditingAgent(false);
          selectAgent(null);
        }}
      />
    </div>
  );
};

export default AgentPage; 