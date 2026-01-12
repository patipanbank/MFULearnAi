import { Request } from 'express';
import { UserRole } from '../models/User';

/**
 * Authenticated user interface - contains decoded JWT payload
 */
export interface AuthUser {
  userId?: string;
  nameID: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: UserRole;
  groups: string[];
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * API response types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
  statusCode: number;
}

/**
 * WebSocket message types
 */
export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export interface WSChatMessage extends WSMessage {
  type: 'chat' | 'content' | 'complete' | 'error' | 'chat_created' | 'chat_updated' | 'cancel' | 'message_edited';
  messages?: ChatMessagePayload[];
  modelId?: string;
  chatId?: string;
  content?: string;
  error?: string;
  shouldUpdateList?: boolean;
  timestamp?: string;
}

export interface ChatMessagePayload {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date | { $date: string };
  images?: ImagePayload[];
  files?: FilePayload[];
  sources?: SourcePayload[];
  isImageGeneration?: boolean;
  isComplete?: boolean;
  isEdited?: boolean;
}

export interface ImagePayload {
  data: string;
  mediaType: string;
}

export interface FilePayload {
  name: string;
  data: string;
  mediaType: string;
  size: number;
  content?: string;
}

export interface SourcePayload {
  modelId: string;
  collectionName: string;
  filename: string;
  similarity: number;
}

/**
 * Service response types
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
