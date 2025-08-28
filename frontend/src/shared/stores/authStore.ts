import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  // Data
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,

      // Login
      login: async (email, password) => {
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token } = response;
          
          set({ user, token, isAuthenticated: true });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Login failed');
        }
      },

      // Logout
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      // Set user
      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },

      // Set token
      setToken: (token) => {
        set({ token });
      }
    }),
    { name: 'auth-store' }
  )
);