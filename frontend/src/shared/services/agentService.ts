import { create } from 'zustand';
import { api } from '../lib/api';
import type { Agent, AgentRuntime, AgentTemplate, Tool, ToolExecution } from '../types';

// Agent Service - handles all agent operations
class AgentManager {
  private runtimes = new Map<string, AgentRuntime>();

  // Create agent runtime
  createRuntime(agent: Agent): AgentRuntime {
    const runtime: AgentRuntime = {
      id: `runtime_${agent.id}_${Date.now()}`,
      agent,
      status: 'idle',
      progress: 0,
      metrics: {
        totalMessages: 0,
        averageResponseTime: 0,
        successRate: 1.0,
        lastUsed: new Date()
      }
    };

    this.runtimes.set(runtime.id, runtime);
    return runtime;
  }

  // Get runtime by agent ID
  getRuntime(agentId: string): AgentRuntime | null {
    for (const runtime of this.runtimes.values()) {
      if (runtime.agent.id === agentId && runtime.status !== 'error') {
        return runtime;
      }
    }
    return null;
  }

  // Update runtime status
  updateStatus(runtimeId: string, status: AgentRuntime['status'], task?: string): void {
    const runtime = this.runtimes.get(runtimeId);
    if (runtime) {
      runtime.status = status;
      runtime.currentTask = task;
      runtime.metrics.lastUsed = new Date();
    }
  }

  // Update metrics
  updateMetrics(runtimeId: string, responseTime: number, success: boolean): void {
    const runtime = this.runtimes.get(runtimeId);
    if (runtime) {
      runtime.metrics.totalMessages++;
      runtime.metrics.averageResponseTime = 
        (runtime.metrics.averageResponseTime * (runtime.metrics.totalMessages - 1) + responseTime) / 
        runtime.metrics.totalMessages;
      
      if (!success) {
        runtime.metrics.successRate = 
          (runtime.metrics.successRate * (runtime.metrics.totalMessages - 1)) / 
          runtime.metrics.totalMessages;
      }
    }
  }

  // Clean up inactive runtimes
  cleanup(): void {
    const now = Date.now();
    for (const [id, runtime] of this.runtimes.entries()) {
      const inactiveTime = now - runtime.metrics.lastUsed.getTime();
      if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
        this.runtimes.delete(id);
      }
    }
  }
}

// Tool Registry - manages available tools
class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  get(toolId: string): Tool | null {
    return this.tools.get(toolId) || null;
  }

  getAvailableTools(agentId: string): Tool[] {
    // Return tools available for this agent
    return Array.from(this.tools.values()).filter(tool => tool.enabled);
  }

  async execute(toolId: string, parameters: Record<string, any>): Promise<ToolExecution> {
    const execution: ToolExecution = {
      id: `exec_${Date.now()}`,
      toolId,
      parameters,
      duration: 0,
      timestamp: new Date()
    };

    const startTime = Date.now();

    try {
      const tool = this.tools.get(toolId);
      if (!tool) {
        throw new Error(`Tool ${toolId} not found`);
      }

      // Simulate tool execution (replace with actual implementation)
      execution.result = await this.executeTool(tool, parameters);
    } catch (error) {
      execution.error = error instanceof Error ? error.message : 'Unknown error';
    }

    execution.duration = Date.now() - startTime;
    return execution;
  }

  private async executeTool(tool: Tool, parameters: Record<string, any>): Promise<any> {
    // Tool execution logic based on category
    switch (tool.category) {
      case 'search':
        return this.executeSearchTool(parameters);
      case 'web':
        return this.executeWebTool(parameters);
      case 'calculation':
        return this.executeCalculationTool(parameters);
      default:
        throw new Error(`Tool category ${tool.category} not implemented`);
    }
  }

  private async executeSearchTool(params: any): Promise<any> {
    // Implement knowledge search
    return await api.post('/search/knowledge', params);
  }

  private async executeWebTool(params: any): Promise<any> {
    // Implement web search
    return await api.post('/search/web', params);
  }

  private async executeCalculationTool(params: any): Promise<any> {
    // Implement calculation
    return { result: eval(params.expression) };
  }
}

// Global instances
export const agentManager = new AgentManager();
export const toolRegistry = new ToolRegistry();

// Initialize default tools
toolRegistry.register({
  id: 'web_search',
  name: 'Web Search',
  description: 'Search the internet for information',
  category: 'web',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query', required: true }
  ],
  enabled: true
});

toolRegistry.register({
  id: 'knowledge_search',
  name: 'Knowledge Search',
  description: 'Search through uploaded documents',
  category: 'search',
  parameters: [
    { name: 'query', type: 'string', description: 'Search query', required: true },
    { name: 'collections', type: 'object', description: 'Collections to search', required: false }
  ],
  enabled: true
});

toolRegistry.register({
  id: 'calculator',
  name: 'Calculator',
  description: 'Perform mathematical calculations',
  category: 'calculation',
  parameters: [
    { name: 'expression', type: 'string', description: 'Mathematical expression', required: true }
  ],
  enabled: true
});

// Agent Store
interface AgentState {
  // Data
  agents: Agent[];
  templates: AgentTemplate[];
  activeAgent: Agent | null;
  activeRuntime: AgentRuntime | null;
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Actions
  loadAgents: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  createAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  setActiveAgent: (agent: Agent | null) => void;
  createFromTemplate: (templateId: string, customizations?: Partial<Agent>) => Promise<Agent>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  // Initial state
  agents: [],
  templates: [],
  activeAgent: null,
  activeRuntime: null,
  loading: false,
  error: null,

  // Load agents from API
  loadAgents: async () => {
    set({ loading: true, error: null });
    try {
      const agents = await api.get<Agent[]>('/agents');
      
      // Create default agent if none exist
      if (agents.length === 0) {
        const defaultAgent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> = {
          name: 'General Assistant',
          description: 'A helpful AI assistant for general questions',
          systemPrompt: 'You are a helpful AI assistant. Provide clear and accurate responses.',
          modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
          temperature: 0.7,
          maxTokens: 4000,
          tools: ['web_search', 'knowledge_search', 'calculator'],
          collections: [],
          isActive: true
        };
        
        const created = await get().createAgent(defaultAgent);
        set({ agents: [created], activeAgent: created });
      } else {
        set({ agents, activeAgent: agents.find(a => a.isActive) || agents[0] });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load agents' });
    } finally {
      set({ loading: false });
    }
  },

  // Load templates
  loadTemplates: async () => {
    const templates: AgentTemplate[] = [
      {
        id: 'general',
        name: 'General Assistant',
        description: 'All-purpose AI assistant',
        category: 'General',
        icon: '🤖',
        prompt: 'You are a helpful AI assistant. Provide clear and accurate responses.',
        suggestedTools: ['web_search', 'calculator'],
        suggestedCollections: [],
        tags: ['general', 'helper']
      },
      {
        id: 'researcher',
        name: 'Research Assistant',
        description: 'Specialized in research and analysis',
        category: 'Research',
        icon: '🔍',
        prompt: 'You are a research assistant. Help users find information, analyze data, and provide insights.',
        suggestedTools: ['web_search', 'knowledge_search'],
        suggestedCollections: [],
        tags: ['research', 'analysis']
      },
      {
        id: 'teacher',
        name: 'Teaching Assistant',
        description: 'Educational support and tutoring',
        category: 'Education',
        icon: '🎓',
        prompt: 'You are a teaching assistant. Explain concepts clearly and help students learn.',
        suggestedTools: ['knowledge_search', 'calculator'],
        suggestedCollections: [],
        tags: ['education', 'teaching']
      }
    ];
    set({ templates });
  },

  // Create new agent
  createAgent: async (agentData) => {
    const agent: Agent = {
      ...agentData,
      id: `agent_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const created = await api.post<Agent>('/agents', agent);
      set(state => ({ agents: [...state.agents, created] }));
      return created;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create agent');
    }
  },

  // Update agent
  updateAgent: async (id, updates) => {
    try {
      const updated = await api.put<Agent>(`/agents/${id}`, updates);
      set(state => ({
        agents: state.agents.map(a => a.id === id ? updated : a),
        activeAgent: state.activeAgent?.id === id ? updated : state.activeAgent
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update agent');
    }
  },

  // Delete agent
  deleteAgent: async (id) => {
    try {
      await api.delete(`/agents/${id}`);
      set(state => ({
        agents: state.agents.filter(a => a.id !== id),
        activeAgent: state.activeAgent?.id === id ? null : state.activeAgent
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to delete agent');
    }
  },

  // Set active agent
  setActiveAgent: (agent) => {
    const runtime = agent ? agentManager.createRuntime(agent) : null;
    set({ activeAgent: agent, activeRuntime: runtime });
  },

  // Create agent from template
  createFromTemplate: async (templateId, customizations = {}) => {
    const { templates } = get();
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    const agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> = {
      name: customizations.name || template.name,
      description: customizations.description || template.description,
      systemPrompt: customizations.systemPrompt || template.prompt,
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      temperature: 0.7,
      maxTokens: 4000,
      tools: customizations.tools || template.suggestedTools,
      collections: customizations.collections || template.suggestedCollections,
      isActive: true
    };

    return await get().createAgent(agentData);
  }
}));