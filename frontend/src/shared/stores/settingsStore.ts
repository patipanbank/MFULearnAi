import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';

export type Theme = 'light' | 'dark' | 'auto';

export interface UserPreferences {
  theme: Theme;
  autoSave: boolean;
  notifications: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  department: string;
  bio: string;
  avatar: string;
}

export interface PrivacySettings {
  shareData: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface SettingsState {
  // Preferences
  preferences: UserPreferences;
  setPreferences: (preferences: Partial<UserPreferences>) => void;
  
  // Profile
  profile: UserProfile;
  setProfile: (profile: Partial<UserProfile>) => void;
  
  // Privacy
  privacy: PrivacySettings;
  setPrivacy: (privacy: Partial<PrivacySettings>) => void;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  
  // API methods
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  exportSettings: () => string;
  importSettings: (data: string) => boolean;
  resetSettings: () => Promise<void>;
  
  // Theme methods
  applyTheme: (theme: Theme) => void;
  getCurrentTheme: () => 'light' | 'dark';
}

const defaultPreferences: UserPreferences = {
  theme: 'light',
  autoSave: true,
  notifications: true,
};

const defaultProfile: UserProfile = {
  name: '',
  email: '',
  department: '',
  bio: '',
  avatar: '',
};

const defaultPrivacy: PrivacySettings = {
  shareData: false,
  analytics: true,
  marketing: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state
      preferences: defaultPreferences,
      profile: defaultProfile,
      privacy: defaultPrivacy,
      isLoading: false,
      isSaving: false,

      // Setters
      setPreferences: (newPreferences) => {
        const preferences = { ...get().preferences, ...newPreferences };
        set({ preferences });
        
        // Apply theme immediately if changed
        if (newPreferences.theme) {
          get().applyTheme(newPreferences.theme);
        }
      },

      setProfile: (newProfile) => {
        set({ profile: { ...get().profile, ...newProfile } });
      },

      setPrivacy: (newPrivacy) => {
        set({ privacy: { ...get().privacy, ...newPrivacy } });
      },

      // API methods
      loadSettings: async () => {
        set({ isLoading: true });
        try {
          // The api object from api.ts automatically handles the token.
          const response = await api.get<{
            preferences: Partial<UserPreferences>;
            profile: Partial<UserProfile>;
            privacy: Partial<PrivacySettings>;
          }>('/user/settings');

          const data = response.data;

          set({
            preferences: { ...defaultPreferences, ...data.preferences },
            profile: { ...defaultProfile, ...data.profile },
            privacy: { ...defaultPrivacy, ...data.privacy },
          });
          
          // Apply loaded theme
          get().applyTheme(data.preferences?.theme || 'light');
        } catch (error) {
          console.error('Failed to load settings:', error);
          // Don't throw here, allow the app to run with default settings
        } finally {
          set({ isLoading: false });
        }
      },

      saveSettings: async () => {
        set({ isSaving: true });
        try {
          const { preferences, profile, privacy } = get();
          await api.put('/user/settings', {
            preferences,
            profile,
            privacy,
          });
        } catch (error) {
          console.error('Failed to save settings:', error);
          throw error; // Re-throw to be caught by the UI layer
        } finally {
          set({ isSaving: false });
        }
      },

      exportSettings: () => {
        const { preferences, profile, privacy } = get();
        const exportData = {
          preferences,
          profile,
          privacy,
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
        };
        return JSON.stringify(exportData, null, 2);
      },

      importSettings: (data: string) => {
        try {
          const importedData = JSON.parse(data);
          
          // Validate data structure
          if (!importedData.preferences && !importedData.profile && !importedData.privacy) {
            return false;
          }

          set({
            preferences: { ...defaultPreferences, ...importedData.preferences },
            profile: { ...defaultProfile, ...importedData.profile },
            privacy: { ...defaultPrivacy, ...importedData.privacy },
          });

          // Apply imported theme
          if (importedData.preferences?.theme) {
            get().applyTheme(importedData.preferences.theme);
          }

          return true;
        } catch (error) {
          console.error('Failed to import settings:', error);
          return false;
        }
      },

      resetSettings: async () => {
        try {
          // The api object handles the token automatically.
          await api.post('/user/settings/reset');

          set({
            preferences: defaultPreferences,
            profile: defaultProfile,
            privacy: defaultPrivacy,
          });

          // Apply default theme
          get().applyTheme('light');
        } catch (error) {
          console.error('Failed to reset settings:', error);
          throw error;
        }
      },

      // Theme methods
      applyTheme: (theme: Theme) => {
        const root = document.documentElement;
        
        if (theme === 'auto') {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          root.classList.toggle('dark', prefersDark);
          
          // Listen for system theme changes
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleChange = (e: MediaQueryListEvent) => {
            if (get().preferences.theme === 'auto') {
              root.classList.toggle('dark', e.matches);
            }
          };
          
          // Remove previous listener and add new one
          mediaQuery.removeEventListener('change', handleChange);
          mediaQuery.addEventListener('change', handleChange);
        } else {
          root.classList.toggle('dark', theme === 'dark');
        }
        
        // Store applied theme in localStorage for persistence
        localStorage.setItem('applied-theme', theme);
      },

      getCurrentTheme: () => {
        return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      },
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        preferences: state.preferences,
        profile: state.profile,
        privacy: state.privacy,
      }),
    }
  )
);

export default useSettingsStore; 