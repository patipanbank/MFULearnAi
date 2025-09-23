/**
 * New Conversation System Types
 *
 * ประเภทข้อมูลและ interfaces สำหรับระบบ conversation ใหม่
 * ออกแบบให้รองรับ LangGraph และ streaming real-time
 */

import { Document } from '@langchain/core/documents';

// ============= CORE TYPES =============

export enum ConversationStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
  ARCHIVED = 'archived'
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool'
}

export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export enum WorkflowNodeType {
  MEMORY = 'memory',
  TOOL = 'tool',
  LLM = 'llm',
  ROUTER = 'router',
  AGGREGATOR = 'aggregator'
}

// ============= MESSAGE TYPES =============

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  metadata: MessageMetadata;
  attachments?: MessageAttachment[];
  toolCalls?: ToolCall[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageMetadata {
  userId: string;
  agentId?: string;
  modelId?: string;
  tokenUsage?: TokenUsage;
  processingTime?: number;
  retryCount: number;
  errorDetails?: ErrorDetails;
  sourceNode?: string;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'document' | 'audio' | 'video';
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: string;
}

// ============= CONVERSATION TYPES =============

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  agentId?: string;
  modelId: string;
  systemPrompt?: string;
  configuration: ConversationConfiguration;
  metadata: ConversationMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

export interface ConversationConfiguration {
  temperature: number;
  maxTokens: number;
  collectionNames: string[];
  enabledTools: string[];
  memorySettings: MemorySettings;
  streamingEnabled: boolean;
  autoSave: boolean;
  timeoutMs: number;
}

export interface ConversationMetadata {
  messageCount: number;
  totalTokens: number;
  averageResponseTime: number;
  errorCount: number;
  lastError?: ErrorDetails;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
}

export interface MemorySettings {
  shortTermEnabled: boolean;
  longTermEnabled: boolean;
  embeddingEnabled: boolean;
  maxShortTermMessages: number;
  embeddingThreshold: number;
  contextWindow: number;
}

// ============= WORKFLOW TYPES =============

export interface WorkflowState {
  conversationId: string;
  messages: ConversationMessage[];
  currentMessage?: ConversationMessage;
  memory: MemoryState;
  tools: ToolState;
  config: ConversationConfiguration;
  metadata: WorkflowMetadata;
}

export interface WorkflowMetadata {
  stepCount: number;
  startTime: Date;
  lastStepTime: Date;
  totalTokens: number;
  errors: ErrorDetails[];
  nodeHistory: string[];
}

export interface MemoryState {
  shortTerm: ConversationMessage[];
  longTerm: Document[];
  context: string;
  embeddings: EmbeddingState[];
  lastUpdate: Date;
}

export interface EmbeddingState {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface ToolState {
  availableTools: string[];
  executionHistory: ToolExecution[];
  currentExecution?: ToolExecution;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  input: Record<string, any>;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  error?: ErrorDetails;
}

// ============= STREAMING TYPES =============

export interface StreamingEvent {
  type: StreamingEventType;
  conversationId: string;
  messageId?: string;
  data: any;
  timestamp: Date;
}

export enum StreamingEventType {
  // Conversation events
  CONVERSATION_STARTED = 'conversation_started',
  CONVERSATION_ENDED = 'conversation_ended',

  // Message events
  MESSAGE_STARTED = 'message_started',
  MESSAGE_CHUNK = 'message_chunk',
  MESSAGE_COMPLETED = 'message_completed',
  MESSAGE_FAILED = 'message_failed',

  // Tool events
  TOOL_STARTED = 'tool_started',
  TOOL_COMPLETED = 'tool_completed',
  TOOL_FAILED = 'tool_failed',

  // Workflow events
  WORKFLOW_STEP = 'workflow_step',
  WORKFLOW_ERROR = 'workflow_error',

  // System events
  CONNECTION_STATUS = 'connection_status',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat'
}

// ============= ERROR TYPES =============

export interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: Date;
  retryable: boolean;
}

export enum ErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',

  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Processing errors
  LLM_ERROR = 'LLM_ERROR',
  TOOL_ERROR = 'TOOL_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',

  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// ============= API TYPES =============

export interface CreateConversationRequest {
  title?: string;
  agentId?: string;
  modelId?: string;
  configuration?: Partial<ConversationConfiguration>;
}

export interface SendMessageRequest {
  content: string;
  attachments?: MessageAttachment[];
  metadata?: Partial<MessageMetadata>;
}

export interface ConversationResponse {
  conversation: Conversation;
  messages?: ConversationMessage[];
}

export interface MessageResponse {
  message: ConversationMessage;
  workflow?: WorkflowMetadata;
}

// ============= WEBSOCKET TYPES =============

export interface WebSocketMessage {
  type: string;
  conversationId?: string;
  messageId?: string;
  data: any;
  requestId?: string;
  timestamp: string;
}

export interface WebSocketResponse {
  type: string;
  conversationId?: string;
  messageId?: string;
  data: any;
  requestId?: string;
  success: boolean;
  error?: ErrorDetails;
  timestamp: string;
}

// ============= UTILITY TYPES =============

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchOptions {
  query?: string;
  status?: ConversationStatus;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  totalTokensUsed: number;
  averageResponseTime: number;
  errorRate: number;
}