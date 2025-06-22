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
        agentTemplates: [
          {
            id: 'programming-assistant',
            name: 'Programming Assistant',
            description: 'Expert in programming languages, debugging, and code review',
            category: 'Development',
            icon: '💻',
            systemPrompt: 'You are an expert programming assistant. Help users with coding questions, debugging, code review, and software development best practices. Provide clear, practical solutions with examples.',
            recommendedTools: ['web_search', 'calculator'],
            recommendedCollections: ['programming-docs', 'api-documentation'],
            tags: ['programming', 'coding', 'development']
          },
          {
            id: 'academic-tutor',
            name: 'Academic Tutor',
            description: 'Specialized in academic subjects and research assistance',
            category: 'Education',
            icon: '🎓',
            systemPrompt: 'You are an academic tutor. Provide clear explanations, help students understand complex concepts, and assist with research. Use evidence-based information and cite sources when appropriate.',
            recommendedTools: ['web_search'],
            recommendedCollections: ['academic-papers', 'textbooks', 'research-data'],
            tags: ['education', 'academic', 'research']
          },
          {
            id: 'data-analyst',
            name: 'Data Analyst',
            description: 'Analyzes data and generates insights with visualizations',
            category: 'Analytics',
            icon: '📊',
            systemPrompt: 'You are a data analyst. Help users analyze data, create visualizations, interpret statistics, and generate actionable insights. Explain methodologies and provide data-driven recommendations.',
            recommendedTools: ['calculator', 'web_search'],
            recommendedCollections: ['datasets', 'analytics-guides'],
            tags: ['data', 'analytics', 'statistics']
          },
          {
            id: 'content-writer',
            name: 'Content Writer',
            description: 'Creates engaging content and copy for various purposes',
            category: 'Content',
            icon: '✍️',
            systemPrompt: 'You are a professional content writer. Create engaging, well-structured content for various purposes including articles, marketing copy, social media posts, and documentation. Adapt your tone and style to the target audience.',
            recommendedTools: ['web_search'],
            recommendedCollections: ['writing-guides', 'style-guides'],
            tags: ['writing', 'content', 'marketing']
          }
        ],
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
            const response = await api.get<AgentConfig[]>('/agents/');
            const agents = response.data;
            set(state => {
              const newState: Partial<AgentStore> = { agents, isLoadingAgents: false };
              if (!state.selectedAgent && agents.length > 0) {
                newState.selectedAgent = agents[0];
              }
              return newState;
            });
          } catch (error) {
            console.error('Failed to fetch agents:', error);
            const defaultAgent = get().createDefaultAgent();
            set({ 
              agents: [defaultAgent],
              selectedAgent: defaultAgent,
              isLoadingAgents: false
            });
          }
        },

        createDefaultAgent: () => {
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
            const response = await api.post<AgentConfig>('/agents/', config);
            const newAgent = response.data;
            set(state => ({
              agents: [...state.agents, newAgent]
            }));
            return newAgent;
          } catch (error) {
            console.error('Failed to create agent:', error);
            throw error;
          }
        },

        updateAgent: async (id, updates) => {
          try {
            await api.put(`/agents/${id}`, updates);
            set(state => ({
              agents: state.agents.map(agent => 
                agent.id === id ? { ...agent, ...updates } : agent
              ),
              ...(state.selectedAgent?.id === id && { selectedAgent: { ...state.selectedAgent, ...updates } })
            }));
          } catch (error) {
            console.error(`Failed to update agent ${id}:`, error);
            throw error;
          }
        },

        deleteAgent: async (id: string) => {
          try {
            await api.delete(`/agents/${id}`);
            set(state => {
              const newAgents = state.agents.filter(agent => agent.id !== id);
              const newSelectedAgent = state.selectedAgent?.id === id ? (newAgents[0] || null) : state.selectedAgent;
              return {
                agents: newAgents,
                selectedAgent: newSelectedAgent
              };
            });
          } catch (error) {
            console.error(`Failed to delete agent ${id}:`, error);
            throw error;
          }
        },
        
        selectAgent: (agent) => {
          set({ selectedAgent: agent });
        },

        fetchTemplates: async () => {
          try {
            const response = await api.get<AgentTemplate[]>('/agents/templates');
            set({ agentTemplates: response.data });
          } catch (error) {
            console.error('Failed to fetch agent templates:', error);
          }
        },

        createAgentFromTemplate: async (templateId, customizations) => {
          const template = get().agentTemplates.find(t => t.id === templateId);
          if (!template) throw new Error('Template not found');

          const newAgentConfig = {
            name: customizations?.name || template.name,
            description: customizations?.description || template.description,
            systemPrompt: customizations?.systemPrompt || template.systemPrompt,
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            collectionNames: template.recommendedCollections,
            tools: template.recommendedTools.map(toolId => ({ id: toolId, name: toolId, type: 'web_search', enabled: true, config: {}, description: '' })), // Simplified tool creation
            temperature: 0.7,
            maxTokens: 4000,
            isPublic: false,
            tags: template.tags,
            createdBy: 'current-user',
          };
          
          return get().createAgent(newAgentConfig as any);
        },

        // Agent Execution
        startExecution: (agentId, sessionId) => {
          set({ 
            currentExecution: {
              id: `exec_${Date.now()}`,
              agentId,
              sessionId,
              status: 'idle',
              progress: 0,
              startTime: new Date().toISOString(),
              tokenUsage: { input: 0, output: 0 }
            } 
          });
        },

        updateExecution: (updates) => {
          set(state => ({
            currentExecution: state.currentExecution ? { ...state.currentExecution, ...updates } : null
          }));
        },

        endExecution: () => {
          set(state => {
            if (state.currentExecution) {
              const finalExecution = { ...state.currentExecution, endTime: new Date().toISOString() };
              return {
                currentExecution: null,
                executionHistory: [finalExecution, ...state.executionHistory]
              };
            }
            return state;
          });
        },

        // UI Actions
        setCreatingAgent: (creating) => set({ isCreatingAgent: creating }),
        setEditingAgent: (editing) => set({ isEditingAgent: editing }),
        setShowAgentModal: (show) => set({ showAgentModal: show }),
      }),
      {
        name: 'agent-storage',
        partialize: (state) => ({
          agents: state.agents,
          selectedAgent: state.selectedAgent,
          agentTemplates: state.agentTemplates,
        }),
      }
    )
  )
);

export default useAgentStore; 