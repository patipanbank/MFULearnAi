import React, { useRef, useEffect } from 'react';
import { FiChevronDown, FiUser, FiCpu, FiCheck, FiRefreshCw, FiSettings, FiStar } from 'react-icons/fi';
import useAgentStore, { type AgentConfig } from '../../stores/agentStore';
import useUIStore from '../../stores/uiStore';

const AgentSelector: React.FC = () => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openDropdowns, toggleDropdown, closeDropdown } = useUIStore();
  const { 
    agents, 
    selectedAgent, 
    isLoadingAgents,
    selectAgent, 
    fetchAgents
  } = useAgentStore();

  const dropdownId = 'agent-selector';
  const isOpen = openDropdowns.has(dropdownId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown(dropdownId);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown, dropdownId]);

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleAgentSelect = (agent: AgentConfig | null) => {
    selectAgent(agent);
    closeDropdown(dropdownId);
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchAgents();
  };

  const getAgentTypeColor = (isPublic: boolean) => {
    return isPublic 
      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Agent Selector Button */}
      <button
        onClick={() => toggleDropdown(dropdownId)}
        className="flex items-center space-x-2 md:space-x-3 px-2 md:px-4 py-1.5 md:py-2 bg-secondary hover:bg-accent rounded-lg transition-colors duration-200 min-w-48 md:min-w-64"
      >
        <FiUser className="h-3 w-3 md:h-4 md:w-4 text-blue-600 dark:text-blue-400" />
        
        <div className="flex-1 text-left">
          {selectedAgent ? (
            <>
              <div className="text-xs md:text-sm font-medium text-primary truncate">
                {selectedAgent.name}
              </div>
              <div className="text-[10px] md:text-xs text-muted">
                {selectedAgent.collectionNames?.length || 0} collections • {selectedAgent.tools?.filter((t: any) => t.enabled).length || 0} tools
              </div>
            </>
          ) : (
            <div className="text-xs md:text-sm text-muted">
              {isLoadingAgents ? 'Loading agents...' : 'Select an agent'}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1 md:space-x-2">
          {isLoadingAgents && (
            <FiRefreshCw className="h-2.5 w-2.5 md:h-3 md:w-3 text-muted animate-spin" />
          )}
          <FiChevronDown className={`h-3 w-3 md:h-4 md:w-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 md:mt-2 w-[calc(100vw-2rem)] md:w-96 bg-primary border border-border rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-200 z-50">
          {/* Header */}
          <div className="p-2 md:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm md:text-lg font-semibold text-primary">Select Agent</h3>
              <button
                onClick={handleRefresh}
                className="p-1 hover:bg-secondary rounded transition-colors"
                disabled={isLoadingAgents}
              >
                <FiRefreshCw className={`h-3 w-3 md:h-4 md:w-4 text-muted ${isLoadingAgents ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-[10px] md:text-sm text-secondary mt-0.5 md:mt-1">Choose an AI agent for your conversation</p>
          </div>

          {/* Agents List */}
          <div className="max-h-72 md:max-h-96 overflow-y-auto">
            {isLoadingAgents ? (
              <div className="p-3 md:p-6 text-center">
                <FiRefreshCw className="h-4 w-4 md:h-6 md:w-6 animate-spin mx-auto text-muted" />
                <p className="text-xs md:text-sm text-muted mt-1 md:mt-2">Loading agents...</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="p-3 md:p-6 text-center">
                <FiUser className="h-5 w-5 md:h-8 md:w-8 mx-auto text-muted opacity-50" />
                <p className="text-xs md:text-sm text-muted mt-1 md:mt-2">No agents available</p>
                <p className="text-[10px] md:text-xs text-muted mt-0.5 md:mt-1">Create your first agent to get started</p>
              </div>
            ) : (
              <div className="p-1 md:p-2">
                {agents.map((agent: AgentConfig) => (
                  <div
                    key={agent.id}
                    className={`p-1.5 md:p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedAgent?.id === agent.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-secondary'
                    }`}
                    onClick={() => handleAgentSelect(agent)}
                  >
                    <div className="flex items-start space-x-2 md:space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {selectedAgent?.id === agent.id ? (
                          <FiCheck className="h-3 w-3 md:h-4 md:w-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <FiUser className="h-3 w-3 md:h-4 md:w-4 text-muted" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1 md:space-x-2 mb-0.5 md:mb-1">
                          <h4 className="text-xs md:text-sm font-medium text-primary truncate">
                            {agent.name}
                          </h4>
                          <span className={`inline-flex items-center px-1 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${getAgentTypeColor(agent.isPublic)}`}>
                            {agent.isPublic ? 'Public' : 'Private'}
                          </span>
                          {agent.rating > 0 && (
                            <div className="flex items-center space-x-0.5 md:space-x-1">
                              <FiStar className="h-2.5 w-2.5 md:h-3 md:w-3 text-yellow-500" />
                              <span className="text-[10px] md:text-xs text-muted">{agent.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        
                        <p className="text-[10px] md:text-xs text-secondary line-clamp-1 md:line-clamp-2 mb-1 md:mb-2">
                          {agent.description}
                        </p>
                        
                        <div className="flex items-center space-x-2 md:space-x-4 text-[10px] md:text-xs text-muted">
                          <div className="flex items-center space-x-0.5 md:space-x-1">
                            <FiCpu className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span>{agent.modelId.split('/').pop() || agent.modelId}</span>
                          </div>
                          <span>{agent.collectionNames.length} collections</span>
                          <span>{agent.tools.filter((t: any) => t.enabled).length} tools</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 md:p-3 bg-secondary border-t border-border">
            <div className="flex items-center justify-between">
              <div className="text-[10px] md:text-xs text-muted">
                {selectedAgent ? (
                  <>
                    Selected: <span className="font-medium">{selectedAgent.name}</span>
                  </>
                ) : (
                  'No agent selected'
                )}
              </div>
              <button
                onClick={() => window.open('/agent', '_blank')}
                className="text-[10px] md:text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center space-x-0.5 md:space-x-1"
              >
                <FiSettings className="h-2.5 w-2.5 md:h-3 md:w-3" />
                <span>Manage Agents</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentSelector; 