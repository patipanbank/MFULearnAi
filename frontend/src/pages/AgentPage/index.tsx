import React, { useEffect, useState } from 'react';
import { FiPlus, FiSearch, FiFilter } from 'react-icons/fi';
import { useAgentStore } from '../../shared/services';
import { useUIStore } from '../../shared/stores';
import type { Agent, AgentTemplate } from '../../shared/types';

const AgentPage: React.FC = () => {
  const {
    agents,
    templates,
    activeAgent,
    loading,
    error,
    loadAgents,
    loadTemplates,
    deleteAgent,
    setActiveAgent,
    createFromTemplate
  } = useAgentStore();

  const { addToast } = useUIStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showTemplates, setShowTemplates] = useState(false);

  // Initialize data
  useEffect(() => {
    loadAgents();
    loadTemplates();
  }, [loadAgents, loadTemplates]);

  // Filter agents and templates
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  // Handlers
  const handleCreateFromTemplate = async (template: AgentTemplate) => {
    try {
      const agent = await createFromTemplate(template.id);
      addToast({
        type: 'success',
        title: 'Agent Created',
        message: `Created "${agent.name}" from template`
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: 'Failed to create agent from template'
      });
    }
  };

  const handleSetActiveAgent = (agent: Agent) => {
    setActiveAgent(agent);
    addToast({
      type: 'success',
      title: 'Agent Activated',
      message: `Switched to ${agent.name}`
    });
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
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
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">{error}</div>
        <button onClick={loadAgents} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

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
            onClick={() => setShowTemplates(!showTemplates)}
            className={`btn ${showTemplates ? 'btn-primary' : 'btn-secondary'}`}
          >
            {showTemplates ? 'My Agents' : 'Templates'}
          </button>
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
              className="input min-w-[120px]"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{template.icon}</div>
                  <div>
                    <h3 className="font-semibold text-primary">{template.name}</h3>
                    <p className="text-sm text-muted">{template.category}</p>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-secondary mb-4">{template.description}</p>
              
              <div className="flex flex-wrap gap-1 mb-4">
                {template.tags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-1 bg-secondary text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
              
              <button
                onClick={() => handleCreateFromTemplate(template)}
                className="btn-primary w-full flex items-center justify-center space-x-2"
              >
                <FiPlus className="h-4 w-4" />
                <span>Create Agent</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className={`card p-6 hover:shadow-lg transition-shadow ${
                activeAgent?.id === agent.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-primary">{agent.name}</h3>
                  <p className="text-sm text-secondary">{agent.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {activeAgent?.id === agent.id && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      Active
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-xs text-muted mb-4">
                Tools: {agent.tools.length} | Collections: {agent.collections.length}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleSetActiveAgent(agent)}
                  className="btn-secondary flex-1"
                  disabled={activeAgent?.id === agent.id}
                >
                  {activeAgent?.id === agent.id ? 'Active' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="btn-secondary text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filteredAgents.length === 0 && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted">No {showTemplates ? 'templates' : 'agents'} found</p>
        </div>
      )}
    </div>
  );
};

export default AgentPage;