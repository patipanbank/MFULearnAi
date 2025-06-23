import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { showSuccessToast, showErrorToast } from './uiStore';

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
  startExecution: () => void;
  updateExecution: (updates: Partial<AgentExecution>) => void;
  endExecution: () => void;
  
  // UI Actions
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
        isEditingAgent: false,
        showAgentModal: false,
        isLoadingAgents: false,

        // Actions
        fetchAgents: async () => {
          set({ isLoadingAgents: true });
          try {
            const agents = await api.get<AgentConfig[]>('/agents/');
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
            const newAgent = await api.post<AgentConfig>('/agents/', config);
            set(state => ({
              agents: [...state.agents, newAgent]
            }));
            showSuccessToast('Agent Created', `Successfully created "${newAgent.name}".`);
            return newAgent;
          } catch (error) {
            console.error('Failed to create agent:', error);
            showErrorToast('Creation Failed', 'Could not create the agent. Please try again.');
            throw error;
          }
        },

        updateAgent: async (id, updates) => {
          try {
            const updatedAgent = await api.put<AgentConfig>(`/agents/${id}`, updates);
            set(state => ({
              agents: state.agents.map(agent => 
                agent.id === id ? { ...agent, ...updatedAgent } : agent
              ),
              ...(state.selectedAgent?.id === id && { selectedAgent: { ...state.selectedAgent, ...updatedAgent } })
            }));
            showSuccessToast('Agent Updated', `Successfully updated "${updatedAgent.name}".`);
          } catch (error) {
            console.error(`Failed to update agent ${id}:`, error);
            showErrorToast('Update Failed', 'Could not update the agent. Please try again.');
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
          // This can be implemented to fetch templates from an API
          // For now, it uses the hardcoded templates.
        },

        createAgentFromTemplate: async (templateId, customizations) => {
          const template = get().agentTemplates.find(t => t.id === templateId);
          if (!template) {
            throw new Error('Template not found');
          }
      
          const agentConfig: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'| 'usageCount' | 'rating'> = {
            name: customizations?.name || template.name,
            description: customizations?.description || template.description,
            systemPrompt: customizations?.systemPrompt || template.systemPrompt,
            modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            collectionNames: template.recommendedCollections,
            tools: [], // Implement tool mapping based on recommendedTools
            temperature: 0.7,
            maxTokens: 4000,
            isPublic: false,
            tags: template.tags,
            createdBy: 'current-user',
          };
          
          return get().createAgent(agentConfig);
        },

        // Agent Execution
        startExecution: () => {
          // Logic to start an agent execution
        },

        updateExecution: (updates) => {
          set(state => ({
            currentExecution: state.currentExecution ? { ...state.currentExecution, ...updates } : null
          }));
        },

        endExecution: () => {
          // Logic to end an agent execution
        },

        // UI Actions
        setEditingAgent: (editing) => set({ isEditingAgent: editing }),
        setShowAgentModal: (show) => set({ showAgentModal: show }),
      }),
      {
        name: 'agent-store',
      }
    )
  )
);

export default useAgentStore; 