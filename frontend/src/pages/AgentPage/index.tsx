import React, { useState } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiCopy, FiUser } from 'react-icons/fi';

interface Agent {
  id: string;
  name: string;
  description: string;
  prompt: string;
  model: string;
  collections: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentPage: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([
    {
      id: '1',
      name: 'Programming Assistant',
      description: 'Expert in programming languages and software development',
      prompt: 'You are an expert programming assistant. Help users with coding questions, debugging, and best practices.',
      model: 'claude-3-sonnet',
      collections: ['programming-docs'],
      isPublic: false,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20')
    },
    {
      id: '2',
      name: 'Academic Tutor',
      description: 'Specialized in academic subjects and research',
      prompt: 'You are an academic tutor. Provide clear explanations and help students understand complex concepts.',
      model: 'claude-3-opus',
      collections: ['academic-papers', 'textbooks'],
      isPublic: true,
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-18')
    }
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleCreateAgent = () => {
    setSelectedAgent(null);
    setShowCreateModal(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowCreateModal(true);
  };

  const handleDeleteAgent = (agentId: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
    }
  };

  const handleDuplicateAgent = (agent: Agent) => {
    const newAgent: Agent = {
      ...agent,
      id: Date.now().toString(),
      name: `${agent.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setAgents(prev => [...prev, newAgent]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">AI Agents</h1>
          <p className="text-secondary mt-1">Create and manage specialized AI assistants</p>
        </div>
        
        <button
          onClick={handleCreateAgent}
          className="btn-primary flex items-center space-x-2"
        >
          <FiPlus className="h-5 w-5" />
          <span>Create Agent</span>
        </button>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <div key={agent.id} className="card card-hover p-6">
            {/* Agent Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <FiUser className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">{agent.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      agent.isPublic 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    }`}>
                      {agent.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Action Menu */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleEditAgent(agent)}
                  className="btn-ghost p-2"
                  title="Edit Agent"
                >
                  <FiEdit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDuplicateAgent(agent)}
                  className="btn-ghost p-2"
                  title="Duplicate Agent"
                >
                  <FiCopy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="btn-ghost p-2 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                  title="Delete Agent"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Agent Description */}
            <p className="text-secondary text-sm mb-4 line-clamp-2">
              {agent.description}
            </p>

            {/* Agent Details */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Model:</span>
                <span className="text-primary font-medium">{agent.model}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Collections:</span>
                <span className="text-primary">{agent.collections.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Updated:</span>
                <span className="text-primary">{agent.updatedAt.toLocaleDateString()}</span>
              </div>
            </div>

            {/* Use Agent Button */}
            <button className="w-full mt-4 btn-secondary">
              Use This Agent
            </button>
          </div>
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
      </div>

      {/* Agent Templates Section */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-primary mb-4">Agent Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Code Reviewer', description: 'Reviews code for best practices and bugs' },
            { name: 'Content Writer', description: 'Creates engaging content and copy' },
            { name: 'Data Analyst', description: 'Analyzes data and generates insights' },
            { name: 'Language Tutor', description: 'Helps learn new languages' }
          ].map((template, index) => (
            <div key={index} className="card card-hover p-4 cursor-pointer">
              <h4 className="font-medium text-primary mb-2">{template.name}</h4>
              <p className="text-secondary text-sm mb-3">{template.description}</p>
              <button className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:text-blue-700 dark:hover:text-blue-300">
                Use Template →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl w-full max-h-90vh overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-primary">
                {selectedAgent ? 'Edit Agent' : 'Create New Agent'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Programming Assistant"
                  defaultValue={selectedAgent?.name}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Description
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Brief description of what this agent does"
                  defaultValue={selectedAgent?.description}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  System Prompt
                </label>
                <textarea
                  rows={4}
                  className="input"
                  placeholder="Define the agent's personality, expertise, and behavior..."
                  defaultValue={selectedAgent?.prompt}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    AI Model
                  </label>
                  <select className="select">
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                    <option value="gpt-4">GPT-4</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Visibility
                  </label>
                  <select className="select">
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-border flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button className="btn-primary">
                {selectedAgent ? 'Update Agent' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentPage; 