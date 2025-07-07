// User Types
export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Chat Types
export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  SYSTEM = 'system',
}

export interface Message {
  id: string;
  chatId: string;
  userId: string;
  type: MessageType;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  agentId?: string;
  messages: Message[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Agent Types
export enum AgentType {
  GENERAL = 'general',
  DOCUMENT_QA = 'document_qa',
  CODE_ASSISTANT = 'code_assistant',
  MATH_TUTOR = 'math_tutor',
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  model: string;
  systemPrompt: string;
  tools: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Collection Types
export enum CollectionType {
  DOCUMENT = 'document',
  WEBPAGE = 'webpage',
  API = 'api',
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  type: CollectionType;
  vectorCount: number;
  department?: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Document Types
export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Document {
  id: string;
  collectionId: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  status: DocumentStatus;
  chunkCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Embedding Types
export interface Embedding {
  id: string;
  documentId: string;
  content: string;
  vector: number[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

// Department Types
export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// System Prompt Types
export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  category: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Statistics Types
export interface ChatStats {
  totalChats: number;
  totalMessages: number;
  averageMessagesPerChat: number;
  dailyStats: {
    date: string;
    chats: number;
    messages: number;
  }[];
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  usersByRole: Record<UserRole, number>;
  usersByDepartment: Record<string, number>;
}

// Tool Types
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  required?: string[];
}

// Job Types
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Job {
  id: string;
  type: string;
  data: any;
  status: JobStatus;
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
} 