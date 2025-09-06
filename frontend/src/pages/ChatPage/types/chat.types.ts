export interface ChatPageProps {
  // Props that might be passed to ChatPage
}

// Import ChatMessage from store first
import type { ChatMessage } from '../../../shared/stores/chatStore';

export interface MessageDisplayProps {
  messages: ChatMessage[];
  isTyping: boolean;
  getInitials: () => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export interface WelcomeScreenProps {
  user: {
    firstName?: string;
  } | null;
}

export interface ChatBackgroundProps {
  // Props for background pattern
}

export interface TypingIndicatorProps {
  isVisible: boolean;
}

// Re-export types from stores for convenience
export type { ChatMessage } from '../../../shared/stores/chatStore';