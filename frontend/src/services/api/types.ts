/**
 * Shared types for API services
 */

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string;
  images?: Array<{ url: string; mediaType: string }>;
  isStreaming?: boolean;
  isComplete?: boolean;
  toolUsage?: Array<{
    type: 'tool_start' | 'tool_result' | 'tool_error';
    tool_name: string;
    tool_input?: string;
    output?: string;
    error?: string;
    timestamp: Date;
  }>;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  agentId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  isPinned?: boolean;
  _id?: string; // MongoDB ID
}

// Agent types
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  type: 'function' | 'retriever' | 'web_search' | 'calculator';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  collectionNames: string[];
  tools: AgentTool[];
  temperature: number;
  maxTokens: number;
  permission: 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE';
  department?: string;
  isPublic?: boolean; // backward compatibility
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  rating: number;
}

// Collection/RAG types
export interface Collection {
  _id: string;
  id?: string;
  name: string;
  description: string;
  embeddingModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  permission?: 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE';
  department?: string;
  documentCount?: number;
  totalSize?: number;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CollectionDocument {
  id: string;
  filename: string;
  size: number;
  uploadedAt: Date | string;
  status: 'processing' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

export interface CreateCollectionDto {
  name: string;
  description: string;
  embeddingModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  permission?: 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE';
}

export interface AnalyticsData {
  totalCollections: number;
  totalDocuments: number;
  totalSize: number;
}

// Auth/User types
export interface User {
  id: string;
  _id?: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'User' | 'Admin' | 'SuperAdmin';
  department: string;
  createdAt: Date | string;
  lastLogin?: Date | string;
}

export interface Department {
  _id: string;
  name: string;
  displayName?: string;
  description?: string;
  isActive?: boolean;
  userCount?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  defaultAgent?: string;
  defaultCollections?: string[];
  preferences?: Record<string, any>;
}

// Admin types
export interface SystemAnalytics {
  userStats: {
    total: number;
    active: number;
    byRole: Record<string, number>;
    byDepartment: Record<string, number>;
  };
  usageStats: {
    totalChats: number;
    totalMessages: number;
    totalTokens: number;
  };
  systemStats: {
    uptime: number;
    version: string;
  };
}

export interface DepartmentStats {
  totalDepartments: number;
  activeDepartments: number;
  emptyDepartments: number;
  userStats: {
    totalUsers: number;
    averageUsersPerDepartment: number;
    maxUsersInDepartment: number;
    minUsersInDepartment: number;
  };
  topDepartments: Array<{
    _id?: string;
    name: string;
    displayName?: string;
    userCount: number;
  }>;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
