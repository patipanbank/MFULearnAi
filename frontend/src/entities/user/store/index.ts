import { create } from 'zustand';
import type { User } from '../../../shared/types';
import { config } from '../../../config/config';

interface AuthState {
  token: string | null;
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  fetchError: string | null;
  setToken: (token: string) => void;
  fetchUser: () => Promise<void>;
  logout: () => void;
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
        const response = await fetch(`${config.apiUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          localStorage.removeItem('auth_token');
          return set({ status: 'unauthenticated', user: null, token: null });
        }

        const userData: User = await response.json();
        set({ status: 'authenticated', user: userData, fetchError: null });
      } catch (error) {
        localStorage.removeItem('auth_token');
        set({ status: 'unauthenticated', user: null, token: null, fetchError: error instanceof Error ? error.message : 'Network error' });
      }
    },

    logout: () => {
      localStorage.removeItem('auth_token');
      set({ token: null, user: null, status: 'unauthenticated' });
      window.location.href = '/login'; 
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