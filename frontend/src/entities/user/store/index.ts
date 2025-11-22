import { create } from 'zustand';
import type { User } from '../../../shared/types';
import { normalizeUser } from '../../../shared/types';
import { AuthService } from '../../../services/api';
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
  let initialToken = localStorage.getItem('auth_token');
  let initialUser = null;
  let initialStatus: 'loading' | 'authenticated' | 'unauthenticated' = initialToken ? 'loading' : 'unauthenticated';
  
  // In development mode, always set up mock authentication
  console.log('AuthStore: Initializing, isDevelopment:', config.isDevelopment, 'initialToken:', initialToken ? 'exists' : 'none');
  if (config.isDevelopment) {
    // If token exists but is not the dev mock token, replace it
    if (initialToken && initialToken !== 'dev-mock-token') {
      console.log('AuthStore: Development mode - replacing non-mock token with dev-mock-token');
      initialToken = 'dev-mock-token';
      localStorage.setItem('auth_token', initialToken);
    } else if (!initialToken) {
      console.log('AuthStore: Development mode - setting up mock authentication');
      initialToken = 'dev-mock-token';
      localStorage.setItem('auth_token', initialToken);
    }
    
    // Always set mock user in development mode
    initialUser = {
      _id: { $oid: 'dev-user-id' },
      id: 'dev-user-id',
      nameID: 'dev-user',
      username: 'dev-user',
      email: 'dev@localhost.local',
      firstName: 'Development',
      lastName: 'User',
      department: 'Development',
      role: 'Students',
      groups: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    initialStatus = 'authenticated';
    console.log('AuthStore: Development mode - mock user set, status:', initialStatus, 'user:', initialUser);
  } else {
    console.log('AuthStore: Production mode - no mock user');
  }
  
  const store = {
    token: initialToken,
    user: initialUser,
    status: initialStatus,
    fetchError: null,

    setToken: (token: string) => {
      console.log('setToken: Setting new token and triggering fetchUser');
      localStorage.setItem('auth_token', token);
      set({ token, status: 'loading' }); // Set status to loading, then fetch user
      // Immediately fetch user after setting token
      get().fetchUser();
    },

    fetchUser: async () => {
      console.log('fetchUser: Attempting to fetch user data...');
      const token = get().token;
      if (!token) {
        console.log('fetchUser: No token found, setting to unauthenticated.');
        set({ status: 'unauthenticated', user: null });
        return;
      }
      
      // In development mode, if we have a mock token, skip API call
      if (config.isDevelopment && token === 'dev-mock-token') {
        console.log('fetchUser: Development mode with mock token, skipping API call');
        // If we already have a mock user, don't do anything
        if (get().user) {
          set({ status: 'authenticated' });
          return;
        }
        // Otherwise, set a mock user
        set({
          status: 'authenticated',
          user: {
            _id: { $oid: 'dev-user-id' },
            id: 'dev-user-id',
            nameID: 'dev-user',
            username: 'dev-user',
            email: 'dev@localhost.local',
            firstName: 'Development',
            lastName: 'User',
            department: 'Development',
            role: 'Students',
            groups: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
          fetchError: null,
        });
        return;
      }
      
      // Ensure we don't fetch unnecessarily
      if (get().status === 'authenticated') {
        return;
      }

      set({ status: 'loading' });

      try {
        // Use AuthService to fetch user data
        console.log('fetchUser: Making API call to AuthService.getMe with token:', token?.substring(0, 20) + '...');
        const userData = await AuthService.getMe();
        console.log('fetchUser: Successfully fetched user data:', userData);

        // Normalize user data from backend format
        const normalizedUser = normalizeUser(userData);
        console.log('fetchUser: Normalized user data:', normalizedUser);
        console.log('fetchUser: Setting status to authenticated');

        set({ status: 'authenticated', user: normalizedUser, fetchError: null });
      } catch (error) {
        console.error('fetchUser: Failed to fetch user data.', error);
        localStorage.removeItem('auth_token');
        set({
          status: 'unauthenticated',
          user: null,
          token: null,
          fetchError: error instanceof Error ? error.message : 'Network error'
        });
      }
    },

    refreshToken: async (): Promise<string | null> => {
      try {
        // Use AuthService to refresh token
        const tokenData = await AuthService.refreshToken();
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
      // Login disabled - just clear state and stay on current page
      localStorage.removeItem('auth_token');
      set({ token: null, user: null, status: 'unauthenticated' });
      // In development mode, set mock user again
      if (config.isDevelopment) {
        const mockToken = 'dev-mock-token';
        localStorage.setItem('auth_token', mockToken);
        set({
          token: mockToken,
          status: 'authenticated',
          user: {
            _id: { $oid: 'dev-user-id' },
            id: 'dev-user-id',
            nameID: 'dev-user',
            username: 'dev-user',
            email: 'dev@localhost.local',
            firstName: 'Development',
            lastName: 'User',
            department: 'Development',
            role: 'Students',
            groups: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        });
      }
    },

    logoutSAML: () => {
      // Login disabled - just clear state and stay on current page
      localStorage.removeItem('auth_token');
      set({ token: null, user: null, status: 'unauthenticated' });
      // In development mode, set mock user again
      if (config.isDevelopment) {
        const mockToken = 'dev-mock-token';
        localStorage.setItem('auth_token', mockToken);
        set({
          token: mockToken,
          status: 'authenticated',
          user: {
            _id: { $oid: 'dev-user-id' },
            id: 'dev-user-id',
            nameID: 'dev-user',
            username: 'dev-user',
            email: 'dev@localhost.local',
            firstName: 'Development',
            lastName: 'User',
            department: 'Development',
            role: 'Students',
            groups: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        });
      }
    },
  };

  // We no longer auto-fetch user here; AuthGuard will trigger the fetch once.

  return store;
});

export default useAuthStore; 