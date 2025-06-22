import { create } from 'zustand';
import type { User } from '../../../shared/types';
import { api } from '../../../shared/lib/api';

interface AuthState {
  token: string | null;
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  fetchError: string | null;
  setToken: (token: string) => void;
  fetchUser: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  logout: () => void;
  logoutSAML: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Check if we have a token at startup
  const initialToken = localStorage.getItem('auth_token');
  
  const store = {
    token: initialToken,
  user: null,
    status: initialToken ? 'loading' as const : 'unauthenticated' as const,
  fetchError: null,

    setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
      set({ token, status: 'loading' }); // Set status to loading, then fetch user
      get().fetchUser(); // Immediately fetch user data
  },

  fetchUser: async () => {
    const token = get().token;
    if (!token) {
      return set({ status: 'unauthenticated', user: null });
    }
    
    // Ensure we don't fetch unnecessarily
    if (get().status === 'authenticated') {
        return;
    }

    set({ status: 'loading' });

    try {
      const response = await api.get<User>('/api/auth/me');

      if (!response.success || !response.data) {
        localStorage.removeItem('auth_token');
        return set({ status: 'unauthenticated', user: null, token: null });
      }

      set({ status: 'authenticated', user: response.data, fetchError: null });
    } catch (error) {
      localStorage.removeItem('auth_token');
      set({ status: 'unauthenticated', user: null, token: null, fetchError: error instanceof Error ? error.message : 'Network error' });
    }
  },

    refreshToken: async (): Promise<string | null> => {
      const token = get().token;
      if (!token) {
        return null;
      }

      try {
        const response = await api.post<{ token: string }>('/api/auth/refresh', {});

        if (!response.success || !response.data) {
          // If refresh fails, logout user
          get().logout();
          return null;
        }

        const newToken = response.data.token;
        
        // Update token in store and localStorage
        localStorage.setItem('auth_token', newToken);
        set({ token: newToken });
        
        return newToken;
      } catch (error) {
        console.error('Token refresh failed:', error);
        get().logout();
        return null;
      }
    },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ token: null, user: null, status: 'unauthenticated' });
    window.location.href = '/login'; 
  },

  logoutSAML: () => {
    // Clear local storage first
    localStorage.removeItem('auth_token');
    set({ token: null, user: null, status: 'unauthenticated' });
    
    // Redirect to SAML logout endpoint to clear SAML session
    window.location.href = '/api/auth/logout/saml';
  },
  };

  // If we have a token at startup, fetch user data immediately
  if (initialToken) {
    // Use setTimeout to avoid calling async function during store creation
    setTimeout(() => {
      store.fetchUser();
    }, 0);
  }

  return store;
});

export default useAuthStore; 