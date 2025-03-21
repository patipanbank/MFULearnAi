import { create } from 'zustand';

export interface TokenUsage {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}

interface TokenState {
  tokenUsage: TokenUsage[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTokenUsage: () => Promise<void>;
  addTokenUsage: (usage: TokenUsage) => void;
  clearTokenUsage: () => void;
}

export const useTokenStore = create<TokenState>((set, get) => ({
  tokenUsage: [],
  isLoading: false,
  error: null,
  
  fetchTokenUsage: async () => {
    set({ isLoading: true, error: null });
    try {
      // Replace with actual API call
      const response = await fetch('/api/token-usage');
      if (!response.ok) {
        throw new Error('Failed to fetch token usage data');
      }
      const data = await response.json();
      set({ tokenUsage: data, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        isLoading: false 
      });
    }
  },
  
  addTokenUsage: (usage: TokenUsage) => {
    set((state) => ({
      tokenUsage: [...state.tokenUsage, usage]
    }));
  },
  
  clearTokenUsage: () => {
    set({ tokenUsage: [] });
  }
})); 