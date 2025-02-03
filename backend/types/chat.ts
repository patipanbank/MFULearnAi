export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: {
    data: string;
    mediaType: string;
  };
} 