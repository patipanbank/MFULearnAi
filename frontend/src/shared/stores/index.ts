// Auth & User Management
export { default as useAuthStore } from '../../entities/user/store';

// Layout & UI Management  
export { default as useLayoutStore } from './layoutStore';
export { default as useUIStore } from './uiStore';

// Chat & Communication
export { default as useChatStore } from './chatStore';

// Agent Management
export { default as useAgentStore } from './agentStore';

// Settings & Preferences
export { default as useSettingsStore } from './settingsStore';

// Type exports for external usage
export type { 
  ChatMessage, 
  ChatSession 
} from './chatStore';

export type {
  AgentConfig,
  AgentTool,
  AgentExecution,
  AgentTemplate
} from './agentStore';

export type {
  Toast,
  Modal,
  Notification
} from './uiStore';

export type {
  Theme,
  UserPreferences,
  UserProfile,
  PrivacySettings
} from './settingsStore'; 