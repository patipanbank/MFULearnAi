// Chat System Types
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  images?: MessageImage[];
  toolUsage?: ToolUsage[];
  isStreaming?: boolean;
  isComplete?: boolean;
}

export interface MessageImage {
  url: string;
  type: string;
  name?: string;
}

export interface ToolUsage {
  type: 'start' | 'result' | 'error';
  toolName: string;
  input?: string;
  output?: string;
  error?: string;
  duration?: number;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  agentId: string;
  context: ConversationContext;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationContext {
  summary?: string;
  topics: string[];
  entities: string[];
  userProfile?: UserProfile;
  preferences?: UserPreferences;
}

export interface UserProfile {
  id: string;
  name: string;
  role?: string;
  department?: string;
  interests: string[];
}

export interface UserPreferences {
  language: string;
  responseLength: 'short' | 'medium' | 'detailed';
  toolUsage: boolean;
  searchDepth: number;
}