export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: any;
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