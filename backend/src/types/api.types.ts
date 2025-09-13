/**
 * API Response Types - Standardized response format
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
  stack?: string; // Only in development
}

// Common API error codes
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

// HTTP Status mappings
export const getHttpStatusForErrorCode = (code: ApiErrorCode): number => {
  const mapping: Record<ApiErrorCode, number> = {
    [API_ERROR_CODES.UNAUTHORIZED]: 401,
    [API_ERROR_CODES.FORBIDDEN]: 403,
    [API_ERROR_CODES.TOKEN_EXPIRED]: 401,
    [API_ERROR_CODES.INVALID_CREDENTIALS]: 401,
    [API_ERROR_CODES.VALIDATION_ERROR]: 400,
    [API_ERROR_CODES.INVALID_INPUT]: 400,
    [API_ERROR_CODES.MISSING_REQUIRED_FIELD]: 400,
    [API_ERROR_CODES.NOT_FOUND]: 404,
    [API_ERROR_CODES.ALREADY_EXISTS]: 409,
    [API_ERROR_CODES.RESOURCE_CONFLICT]: 409,
    [API_ERROR_CODES.OPERATION_FAILED]: 400,
    [API_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
    [API_ERROR_CODES.RATE_LIMITED]: 429,
    [API_ERROR_CODES.QUOTA_EXCEEDED]: 429,
    [API_ERROR_CODES.INTERNAL_ERROR]: 500,
    [API_ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
    [API_ERROR_CODES.DATABASE_ERROR]: 500,
    [API_ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
    [API_ERROR_CODES.CHAT_NOT_FOUND]: 404,
    [API_ERROR_CODES.MESSAGE_SEND_ERROR]: 400,
    [API_ERROR_CODES.AGENT_EXECUTION_ERROR]: 500,
    [API_ERROR_CODES.WEBSOCKET_CONNECTION_ERROR]: 500
  };
  
  return mapping[code] || 500;
};

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