/**
 * Frontend API Types - Mirror backend API types for consistency
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  meta?: {
    timestamp?: string;
    requestId?: string;
    version?: string;
    [key: string]: any;
  };
}

export interface ApiListResponse<T = any> extends ApiResponse<T[]> {
  meta: {
    total: number;
    limit?: number | null;
    offset?: number;
    page?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    timestamp?: string;
    requestId?: string;
    version?: string;
  };
}

export interface ApiErrorResponse extends ApiResponse<never> {
  success: false;
  error: string;
  code: string;
  details?: any[];
}

// Error codes (must match backend)
export const API_ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // Business Logic
  OPERATION_FAILED: 'OPERATION_FAILED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // System Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Chat & Agent specific
  CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
  MESSAGE_SEND_ERROR: 'MESSAGE_SEND_ERROR',
  AGENT_EXECUTION_ERROR: 'AGENT_EXECUTION_ERROR',
  WEBSOCKET_CONNECTION_ERROR: 'WEBSOCKET_CONNECTION_ERROR'
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

// Request types
export interface PaginationQuery {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface SearchQuery {
  query?: string;
  fields?: string[];
  caseSensitive?: boolean;
}

export interface DateRangeQuery {
  from?: string;
  to?: string;
}

export interface SortQuery {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type CommonQuery = PaginationQuery & SearchQuery & DateRangeQuery & SortQuery;

// API Client Error class
export class ApiError extends Error {
  public code: ApiErrorCode;
  public statusCode: number;
  public details?: any;
  public requestId?: string;

  constructor(response: ApiErrorResponse, statusCode: number = 500) {
    super(response.error);
    this.name = 'ApiError';
    this.code = response.code as ApiErrorCode;
    this.statusCode = statusCode;
    this.details = response.details;
    this.requestId = response.meta?.requestId;
  }

  isAuthError(): boolean {
    return [
      API_ERROR_CODES.UNAUTHORIZED,
      API_ERROR_CODES.FORBIDDEN,
      API_ERROR_CODES.TOKEN_EXPIRED,
      API_ERROR_CODES.INVALID_CREDENTIALS
    ].includes(this.code);
  }

  isValidationError(): boolean {
    return [
      API_ERROR_CODES.VALIDATION_ERROR,
      API_ERROR_CODES.INVALID_INPUT,
      API_ERROR_CODES.MISSING_REQUIRED_FIELD
    ].includes(this.code);
  }

  isNotFoundError(): boolean {
    return this.code === API_ERROR_CODES.NOT_FOUND;
  }

  isServerError(): boolean {
    return [
      API_ERROR_CODES.INTERNAL_ERROR,
      API_ERROR_CODES.SERVICE_UNAVAILABLE,
      API_ERROR_CODES.DATABASE_ERROR,
      API_ERROR_CODES.EXTERNAL_SERVICE_ERROR
    ].includes(this.code);
  }
}