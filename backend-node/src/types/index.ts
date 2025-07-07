// Export all API types
export * from './api.types';

// Export all domain types
export * from './domain.types';

// Re-export commonly used types for convenience
export type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  RequestContext,
  QueryOptions,
  SortOptions,
  FilterOptions,
  FileUpload,
} from './api.types';

export type {
  User,
  UserRole,
  Message,
  MessageType,
  Chat,
  Agent,
  AgentType,
  Collection,
  CollectionType,
  Document,
  DocumentStatus,
  Embedding,
  Department,
  SystemPrompt,
  ChatStats,
  UserStats,
  Tool,
  Job,
  JobStatus,
} from './domain.types';

// Utility types
export type ID = string;
export type Timestamp = Date;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Database types
export interface MongoDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
}

// Error types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface BusinessError {
  code: string;
  message: string;
  details?: any;
}

// Event types
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  data: any;
  timestamp: Date;
  version: number;
}