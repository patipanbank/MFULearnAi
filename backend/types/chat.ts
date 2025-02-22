export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: Array<{
    data: string;
    mediaType: string;
  }>;
  isImageGeneration?: boolean;
} 