import type { ChatMessage } from '../../../shared/stores/chatStore';

export interface MessageItemProps {
  message: ChatMessage;
  onCopy: (content: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  isEditing: boolean;
  editingContent: string;
  onEditingContentChange: (content: string) => void;
  onSaveEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  showActionsMenu: boolean;
  onToggleActionsMenu: () => void;
  getInitials: () => string;
}

export interface MessageActionsProps {
  messageId: string;
  messageRole: 'user' | 'assistant' | 'system';
  messageContent: string;
  isVisible: boolean;
  onCopy: (content: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onClose: () => void;
}

export interface ChatMessagesProps {
  messages: ChatMessage[];
  onCopyMessage: (content: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onSaveEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  editingMessage: string | null;
  editingContent: string;
  onEditingContentChange: (content: string) => void;
  activeMessageMenu: string | null;
  onSetActiveMessageMenu: (messageId: string | null) => void;
  getInitials: () => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export interface WelcomeScreenProps {
  userName?: string;
}

export interface TypingIndicatorProps {
  isVisible: boolean;
}

// Hook types
export interface UseMessageActionsResult {
  activeMessageMenu: string | null;
  editingMessage: string | null;
  editingContent: string;
  handleCopyMessage: (content: string) => void;
  handleEditMessage: (messageId: string, content: string) => void;
  handleSaveEdit: (messageId: string) => void;
  handleCancelEdit: () => void;
  handleDeleteMessage: (messageId: string) => void;
  setActiveMessageMenu: (messageId: string | null) => void;
  setEditingContent: (content: string) => void;
}

export interface UseFileUploadResult {
  files: Array<{ url: string; name: string; type: string; size: number }>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveFile: (index: number) => void;
  setFiles: React.Dispatch<React.SetStateAction<Array<{ url: string; name: string; type: string; size: number }>>>;
}