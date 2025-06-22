import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { api } from '../lib/api';

// Types
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  type: 'function' | 'retriever' | 'web_search' | 'calculator';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  collectionNames: string[];
  tools: AgentTool[];
  temperature: number;
  maxTokens: number;
  isPublic: boolean;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  rating: number;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  sessionId: string;
  status: 'idle' | 'thinking' | 'using_tool' | 'responding' | 'error';
  currentTool?: string;
  progress: number;
  startTime: string;
  endTime?: string;
  tokenUsage: {
    input: number;
    output: number;
  };
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  systemPrompt: string;
  recommendedTools: string[];
  recommendedCollections: string[];
  tags: string[];
}

interface AgentStore {
  // Agent Management
  agents: AgentConfig[];
  selectedAgent: AgentConfig | null;
  agentTemplates: AgentTemplate[];
  
  // Agent Execution
  currentExecution: AgentExecution | null;
  executionHistory: AgentExecution[];
  
  // UI State
  isCreatingAgent: boolean;
  isEditingAgent: boolean;
  showAgentModal: boolean;
  isLoadingAgents: boolean;
  
  // Actions
  fetchAgents: () => Promise<void>;
  createAgent: (config: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'rating'>) => Promise<AgentConfig>;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (agent: AgentConfig | null) => void;
  
  // Agent Templates
  fetchTemplates: () => Promise<void>;
  createAgentFromTemplate: (templateId: string, customizations?: Partial<AgentConfig>) => Promise<AgentConfig>;
  
  // Agent Execution
  startExecution: (agentId: string, sessionId: string) => void;
  updateExecution: (updates: Partial<AgentExecution>) => void;
  endExecution: () => void;
  
  // UI Actions
  setCreatingAgent: (creating: boolean) => void;
  setEditingAgent: (editing: boolean) => void;
  setShowAgentModal: (show: boolean) => void;
  createDefaultAgent: () => AgentConfig;
}

const useAgentStore = create<AgentStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        agents: [],
        selectedAgent: null,
        agentTemplates: [],
        currentExecution: null,
        executionHistory: [],
        isCreatingAgent: false,
        isEditingAgent: false,
        showAgentModal: false,
        isLoadingAgents: false,

        // Actions
        fetchAgents: async () => {
          set({ isLoadingAgents: true });
          try {
            const response = await api.get<AgentConfig[]>('/api/agents/');
            
            if (response.success && Array.isArray(response.data)) {
              set(state => {
                const responseData = response.data || [];
                const newState: { agents: AgentConfig[], isLoadingAgents: boolean, selectedAgent?: AgentConfig | null } = { 
                  agents: responseData, 
                  isLoadingAgents: false 
                };
                
                // Auto-select first agent if none selected and agents exist
                if (!state.selectedAgent && responseData.length > 0) {
                  newState.selectedAgent = responseData[0];
                }
                
                return newState;
              });
            } else {
              if (response.data && !Array.isArray(response.data)) {
                console.error('Failed to fetch agents: API response is not an array.', response.data);
              } else {
                console.error('Failed to fetch agents:', response.error);
              }
              // If API call fails or returns non-array, use default agent or empty array
              const agents = get().agents || [];
              if(agents.length === 0){
                const defaultAgent = get().createDefaultAgent();
                set({ 
                  agents: [defaultAgent],
                  selectedAgent: defaultAgent,
                  isLoadingAgents: false
                });
              } else {
                 set({ isLoadingAgents: false });
              }
            }
          } catch (error) {
            console.error('Failed to fetch agents:', error);
            // If network error, use template-based default if no agents exist
            const agents = get().agents || [];
            if(agents.length === 0){
              const defaultAgent = get().createDefaultAgent();
              set({ 
                agents: [defaultAgent],
                selectedAgent: defaultAgent,
                isLoadingAgents: false
              });
            } else {
               set({ isLoadingAgents: false });
            }
            throw error;
          }
        },

        createDefaultAgent: () => {
          // Create a default agent for offline/fallback use
          // Use a valid MongoDB ObjectId format (24 hex characters)
          const defaultAgent: AgentConfig = {
            id: '000000000000000000000001',
            name: 'General Assistant',
            description: 'A helpful AI assistant for general questions and tasks',
            systemPrompt: 'You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions.',
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            collectionNames: [],
            tools: [],
            temperature: 0.7,
            maxTokens: 4000,
            isPublic: true,
            tags: ['general', 'assistant'],
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usageCount: 0,
            rating: 0
          };
          return defaultAgent;
        },

        createAgent: async (config) => {
          try {
            const response = await api.post<AgentConfig>('/api/agents/', config);

            if (response.success) {
              set(state => ({
                agents: [...state.agents, response.data!]
              }));
              return response.data!;
            } else {
              throw new Error(response.error || 'Failed to create agent');
            }
          } catch (error) {
            console.error('Failed to create agent:', error);
            throw error;
          }
        },

        updateAgent: async (id, updates) => {
          try {
            const response = await api.put<AgentConfig>(`/api/agents/${id}`, updates);

            if (response.success) {
              const updatedAgent = response.data!;
              set(state => ({
                agents: state.agents.map(agent =>
                  agent.id === id ? updatedAgent : agent
                ),
                selectedAgent: state.selectedAgent?.id === id ? updatedAgent : state.selectedAgent
              }));
            } else {
              throw new Error(response.error || `Failed to update agent: ${response.status}`);
            }
          } catch (error) {
            console.error('Failed to update agent:', error);
            throw error;
          }
        },

        deleteAgent: async (id) => {
          try {
            const response = await api.delete(`/api/agents/${id}`);

            if (response.success) {
              set(state => ({
                agents: state.agents.filter(agent => agent.id !== id),
                selectedAgent: state.selectedAgent?.id === id ? null : state.selectedAgent
              }));
            } else {
              throw new Error(response.error || `Failed to delete agent: ${response.status}`);
            }
          } catch (error) {
            console.error('Failed to delete agent:', error);
            throw error;
          }
        },

        selectAgent: (agent) => {
          set({ selectedAgent: agent });
        },

        fetchTemplates: async () => {
          try {
            const response = await api.get<AgentTemplate[]>('/api/agents/templates');
            if (response.success && Array.isArray(response.data)) {
              set({ agentTemplates: response.data || [] });
            } else {
              console.error('Failed to fetch templates:', response.error);
              set({ agentTemplates: [] });
            }
          } catch (error) {
            console.error('Failed to fetch templates:', error);
            set({ agentTemplates: [] });
            throw error;
          }
        },

        createAgentFromTemplate: async (templateId, customizations = {}) => {
          try {
            const response = await api.post<AgentConfig>('/api/agents/from-template', {
              templateId,
              ...customizations
            });

            if (response.success) {
              const newAgent = response.data!;
              set(state => ({
                agents: [...state.agents, newAgent]
              }));
              return newAgent;
            } else {
              throw new Error(response.error || 'Failed to create agent from template');
            }
          } catch (error) {
            console.error('Failed to create agent from template:', error);
            throw error;
          }
        },

        // Agent Execution
        startExecution: (agentId, sessionId) => {
          const execution: AgentExecution = {
            id: Date.now().toString(),
            agentId,
            sessionId,
            status: 'thinking',
            progress: 0,
            startTime: new Date().toISOString(),
            tokenUsage: { input: 0, output: 0 }
          };

          set({ currentExecution: execution });
        },

        updateExecution: (updates) => {
          set(state => ({
            currentExecution: state.currentExecution
              ? { ...state.currentExecution, ...updates }
              : null
          }));
        },

        endExecution: () => {
          const { currentExecution } = get();
          if (currentExecution) {
            const completedExecution = {
              ...currentExecution,
              status: 'idle' as const,
              endTime: new Date().toISOString(),
              progress: 100
            };

            set(state => ({
              currentExecution: null,
              executionHistory: [completedExecution, ...state.executionHistory.slice(0, 49)] // Keep last 50
            }));
          }
        },

        // UI Actions
        setCreatingAgent: (creating) => set({ isCreatingAgent: creating }),
        setEditingAgent: (editing) => set({ isEditingAgent: editing }),
        setShowAgentModal: (show) => set({ showAgentModal: show })
      }),
      {
        name: 'agent-store',
        partialize: (state) => ({
          agents: state.agents,
          selectedAgent: state.selectedAgent
        })
      }
    ),
    { name: 'AgentStore' }
  )
);

export default useAgentStore; 