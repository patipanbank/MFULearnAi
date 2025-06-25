import { create } from 'zustand';
import type { User } from '../../../shared/types';
import { api } from '../../../shared/lib/api';
import { config } from '../../../config/config';

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
      console.log('fetchUser: Attempting to fetch user data...');
      const token = get().token;
      if (!token) {
        console.log('fetchUser: No token found, setting to unauthenticated.');
        return set({ status: 'unauthenticated', user: null });
      }
      
      // Ensure we don't fetch unnecessarily
      if (get().status === 'authenticated') {
          return;
      }

      set({ status: 'loading' });

      try {
        // api object now handles base URL, token and returns data directly
        const userData = await api.get<User>('/auth/me');
        console.log('fetchUser: Successfully fetched user data:', userData);
        set({ status: 'authenticated', user: userData, fetchError: null });
      } catch (error) {
        console.error('fetchUser: Failed to fetch user data.', error);
        localStorage.removeItem('auth_token');
        set({ status: 'unauthenticated', user: null, token: null, fetchError: error instanceof Error ? error.message : 'Network error' });
      }
    },

    refreshToken: async (): Promise<string | null> => {
      try {
        // api object now handles base URL and token
        const tokenData = await api.post<{token: string}>('/auth/refresh');
        const newToken = tokenData.token;
        
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
      const loginTab = window.open(`${config.apiUrl}/api/auth/logout/saml`, '_blank');
      if (loginTab) {
        loginTab.focus();
      }
    },

    logoutSAML: () => {
      // Clear local storage first
      localStorage.removeItem('auth_token');
      set({ token: null, user: null, status: 'unauthenticated' });
      
      // Open login page in new tab
      const logoutTab = window.open('/login', '_blank');
      if (logoutTab) {
        logoutTab.focus();
      }
    },
  };

  // We no longer auto-fetch user here; AuthGuard will trigger the fetch once.

  return store;
});

export default useAuthStore; 