export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: Array<{
    data: string;
    mediaType: string;
  }>;
  files?: Array<{
    name: string;
    data: string;
    mediaType: string;
    size: number;
  }>;
  sources?: Array<any>;
  isImageGeneration?: boolean;
  isComplete?: boolean;
} 