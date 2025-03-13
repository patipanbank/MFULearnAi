export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  images?: Array<{
    data: string;
    mediaType: string;
  }>;
  files?: Array<{
    name: string;
    data: string;
    mediaType: string;
    size: number;
    content?: string;
  }>;
  sources?: Array<any>;
  isImageGeneration?: boolean;
  isComplete?: boolean;
} 