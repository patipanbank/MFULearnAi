export interface ChatMessage {
  role: string;
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
  id?: string;
  parentMessageId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isEdited?: boolean;
  imageEmbeddings?: any[];
  processedFiles?: {
    name: string;
    extractedText?: string;
    [key: string]: any;
  }[];
} 