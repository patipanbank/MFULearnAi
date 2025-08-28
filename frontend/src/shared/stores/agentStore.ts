import { create } from 'zustand';

export interface AgentState {
  agents: any[];
  selectedAgent: any;
  isLoadingAgents: boolean;
  editingAgent: any;
  showAgentModal: boolean;
  
  // Actions
  loadAgents: () => void;
  selectAgent: (agent: any) => void;
  deleteAgent: (id: string) => void;
  fetchAgents: () => void;
  setEditingAgent: (agent: any) => void;
  setShowAgentModal: (show: boolean) => void;
  createAgent: (agent: any) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  selectedAgent: null,
  isLoadingAgents: false,
  editingAgent: null,
  showAgentModal: false,
  
  loadAgents: () => {
    set({ isLoadingAgents: true });
    // Placeholder implementation
    set({ isLoadingAgents: false });
  },
  
  selectAgent: (agent) => set({ selectedAgent: agent }),
  
  deleteAgent: (id) => {
    set((state) => ({
      agents: state.agents.filter(agent => agent.id !== id)
    }));
  },
  
  fetchAgents: () => {
    // Placeholder implementation
  },
  
  setEditingAgent: (agent) => set({ editingAgent: agent }),
  
  setShowAgentModal: (show) => set({ showAgentModal: show }),
  
  createAgent: (agent) => {
    set((state) => ({
      agents: [...state.agents, agent]
    }));
  }
}));