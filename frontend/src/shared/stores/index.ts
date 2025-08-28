// New unified services
export { useAgentStore } from '../services/agentService';
export { useChatStore } from '../services/chatService';  
export { useKnowledgeStore } from '../services/knowledgeService';

// Auth store
export { useAuthStore } from './authStore';

// Legacy stores (keeping for compatibility)
export { default as useLayoutStore } from './layoutStore';
export { default as useUIStore } from './uiStore';
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