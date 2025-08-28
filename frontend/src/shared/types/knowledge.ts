// Knowledge System Types
export interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'xlsx' | 'csv';
  size: number;
  content: string;
  metadata: DocumentMetadata;
  collectionId: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  language?: string;
  keywords: string[];
  summary?: string;
  pageCount?: number;
  wordCount?: number;
}

export interface Collection {
  _id: string;
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private';
  documents: Document[];
  documentCount: number;
  totalSize: number;
  tags: string[];
  department?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchContext {
  agentId?: string;
  conversationId?: string;
  previousQueries: string[];
  userIntent?: string;
  filters?: {
    collections?: string[];
    documentTypes?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
}

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  score: number;
  metadata: DocumentMetadata;
  collection: {
    id: string;
    name: string;
  };
  highlights: string[];
}

export interface QueryAnalysis {
  intent: 'search' | 'question' | 'analysis' | 'summary';
  entities: string[];
  keywords: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  suggestedCollections: string[];
}