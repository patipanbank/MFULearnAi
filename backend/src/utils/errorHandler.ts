import { Request, Response, NextFunction } from 'express';
import { wsManager } from './websocketManager';

export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resources
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_LIMIT_EXCEEDED = 'RESOURCE_LIMIT_EXCEEDED',

  // Business Logic
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',

  // External Services
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',

  // System
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // File Processing
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',

  // WebSocket
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  CONNECTION_LOST = 'CONNECTION_LOST'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  chatId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  httpStatus: number;
  userMessage?: string; // User-friendly message
  context?: ErrorContext;
  originalError?: Error;
  timestamp: Date;
  requestId?: string;
}

/**
 * AppError - Custom error class with structured error information
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly userMessage?: string;
  public context?: ErrorContext;
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly isOperational: boolean = true;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: number = 500,
    userMessage?: string,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message);

    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.userMessage = userMessage || this.getDefaultUserMessage(code);
    this.context = context;
    this.timestamp = new Date();

    // Capture stack trace
    if (originalError) {
      this.stack = originalError.stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private getDefaultUserMessage(code: ErrorCode): string {
    const userMessages: Record<ErrorCode, string> = {
      [ErrorCode.UNAUTHORIZED]: 'You need to sign in to access this resource.',
      [ErrorCode.FORBIDDEN]: 'You don\'t have permission to perform this action.',
      [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
      [ErrorCode.INVALID_CREDENTIALS]: 'Invalid username or password.',

      [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
      [ErrorCode.INVALID_INPUT]: 'The provided input is not valid.',
      [ErrorCode.MISSING_REQUIRED_FIELD]: 'Please fill in all required fields.',

      [ErrorCode.RESOURCE_NOT_FOUND]: 'The requested resource was not found.',
      [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'This resource already exists.',
      [ErrorCode.RESOURCE_LIMIT_EXCEEDED]: 'You have exceeded the resource limit.',

      [ErrorCode.QUOTA_EXCEEDED]: 'You have exceeded your usage quota.',
      [ErrorCode.OPERATION_NOT_ALLOWED]: 'This operation is not allowed.',
      [ErrorCode.CONCURRENT_MODIFICATION]: 'This resource was modified by another user. Please refresh and try again.',

      [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'An external service is temporarily unavailable.',
      [ErrorCode.AI_SERVICE_ERROR]: 'The AI service encountered an error. Please try again.',
      [ErrorCode.DATABASE_ERROR]: 'A database error occurred. Please try again later.',
      [ErrorCode.STORAGE_ERROR]: 'A file storage error occurred.',

      [ErrorCode.INTERNAL_SERVER_ERROR]: 'An internal server error occurred.',
      [ErrorCode.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable.',
      [ErrorCode.TIMEOUT_ERROR]: 'The operation timed out. Please try again.',

      [ErrorCode.FILE_TOO_LARGE]: 'The file is too large. Please use a smaller file.',
      [ErrorCode.UNSUPPORTED_FILE_TYPE]: 'This file type is not supported.',
      [ErrorCode.FILE_PROCESSING_ERROR]: 'Failed to process the file.',

      [ErrorCode.WEBSOCKET_ERROR]: 'Connection error occurred.',
      [ErrorCode.CONNECTION_LOST]: 'Connection was lost. Attempting to reconnect...'
    };

    return userMessages[code] || 'An error occurred. Please try again.';
  }

  public toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp,
      requestId: this.requestId
    };
  }
}

/**
 * ErrorHandler - Centralized error handling and logging
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private logLevel: 'error' | 'warn' | 'info' | 'debug' = 'error';

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Create a new AppError with standardized format
   */
  createError(
    code: ErrorCode,
    message: string,
    httpStatus: number = 500,
    userMessage?: string,
    context?: ErrorContext,
    originalError?: Error
  ): AppError {
    return new AppError(code, message, httpStatus, userMessage, context, originalError);
  }

  /**
   * Handle and log errors with proper formatting
   */
  handleError(error: Error | AppError, context?: ErrorContext): AppError {
    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
      // Merge additional context if provided
      if (context) {
        appError.context = { ...appError.context, ...context };
      }
    } else {
      // Convert regular Error to AppError
      appError = this.convertToAppError(error, context);
    }

    // Log the error
    this.logError(appError);

    return appError;
  }

  /**
   * Convert regular Error to AppError with automatic categorization
   */
  private convertToAppError(error: Error, context?: ErrorContext): AppError {
    let code = ErrorCode.INTERNAL_SERVER_ERROR;
    let httpStatus = 500;
    let userMessage: string | undefined;

    // Auto-categorize common errors
    if (error.name === 'ValidationError') {
      code = ErrorCode.VALIDATION_ERROR;
      httpStatus = 400;
    } else if (error.name === 'CastError' || error.name === 'ObjectParameterError') {
      code = ErrorCode.INVALID_INPUT;
      httpStatus = 400;
    } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
      code = ErrorCode.DATABASE_ERROR;
      httpStatus = 500;
    } else if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      code = ErrorCode.TIMEOUT_ERROR;
      httpStatus = 408;
    } else if (error.message.includes('unauthorized') || error.message.includes('auth')) {
      code = ErrorCode.UNAUTHORIZED;
      httpStatus = 401;
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      code = ErrorCode.RESOURCE_NOT_FOUND;
      httpStatus = 404;
    }

    return new AppError(code, error.message, httpStatus, userMessage, context, error);
  }

  /**
   * Log error with structured format
   */
  private logError(error: AppError): void {
    const logData = {
      timestamp: error.timestamp.toISOString(),
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
      context: error.context,
      stack: error.stack?.split('\n').slice(0, 10).join('\n') // Limit stack trace
    };

    const logMessage = `[${error.code}] ${error.message}`;

    if (error.httpStatus >= 500) {
      console.error('🔴 ERROR:', logMessage, logData);
    } else if (error.httpStatus >= 400) {
      console.warn('🟡 WARNING:', logMessage, logData);
    } else {
      console.info('🔵 INFO:', logMessage, logData);
    }
  }

  /**
   * Send error response to HTTP client
   */
  sendErrorResponse(res: Response, error: AppError): void {
    const response = {
      success: false,
      error: {
        code: error.code,
        message: error.userMessage || error.message,
        timestamp: error.timestamp.toISOString()
      },
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          originalMessage: error.message,
          stack: error.stack,
          context: error.context
        }
      })
    };

    res.status(error.httpStatus).json(response);
  }

  /**
   * Send error to WebSocket clients
   */
  sendWebSocketError(sessionId: string, error: AppError): void {
    if (wsManager.getSessionConnectionCount(sessionId) > 0) {
      const wsMessage = {
        type: 'error',
        data: {
          code: error.code,
          message: error.userMessage || error.message,
          timestamp: error.timestamp.toISOString()
        }
      };

      wsManager.broadcastToSession(sessionId, JSON.stringify(wsMessage));
    }
  }

  /**
   * Express middleware for handling errors
   */
  expressMiddleware() {
    return (error: Error | AppError, req: Request, res: Response, next: NextFunction): void => {
      const context: ErrorContext = {
        userId: (req as any).user?.sub || (req as any).user?.id,
        operation: `${req.method} ${req.originalUrl}`
      };

      const appError = this.handleError(error, context);
      this.sendErrorResponse(res, appError);
    };
  }

  /**
   * Async handler wrapper to catch async errors
   */
  asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create specific error types for common scenarios
   */
  notFound(resource: string, context?: ErrorContext): AppError {
    return this.createError(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resource} not found`,
      404,
      `The requested ${resource.toLowerCase()} was not found.`,
      context
    );
  }

  unauthorized(context?: ErrorContext): AppError {
    return this.createError(
      ErrorCode.UNAUTHORIZED,
      'Unauthorized access',
      401,
      'You need to sign in to access this resource.',
      context
    );
  }

  forbidden(context?: ErrorContext): AppError {
    return this.createError(
      ErrorCode.FORBIDDEN,
      'Access forbidden',
      403,
      'You don\'t have permission to perform this action.',
      context
    );
  }

  validationError(message: string, context?: ErrorContext): AppError {
    return this.createError(
      ErrorCode.VALIDATION_ERROR,
      message,
      400,
      'Please check your input and try again.',
      context
    );
  }

  quotaExceeded(context?: ErrorContext): AppError {
    return this.createError(
      ErrorCode.QUOTA_EXCEEDED,
      'Usage quota exceeded',
      429,
      'You have exceeded your usage quota.',
      context
    );
  }

  aiServiceError(message: string, context?: ErrorContext): AppError {
    return this.createError(
      ErrorCode.AI_SERVICE_ERROR,
      message,
      503,
      'The AI service encountered an error. Please try again.',
      context
    );
  }

  fileError(message: string, context?: ErrorContext): AppError {
    let code = ErrorCode.FILE_PROCESSING_ERROR;

    if (message.includes('too large') || message.includes('size')) {
      code = ErrorCode.FILE_TOO_LARGE;
    } else if (message.includes('type') || message.includes('format')) {
      code = ErrorCode.UNSUPPORTED_FILE_TYPE;
    }

    return this.createError(code, message, 400, undefined, context);
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Helper functions for common error scenarios
export const createError = errorHandler.createError.bind(errorHandler);
export const handleError = errorHandler.handleError.bind(errorHandler);
export const asyncHandler = errorHandler.asyncHandler.bind(errorHandler);

// Common error creators
export const notFoundError = errorHandler.notFound.bind(errorHandler);
export const unauthorizedError = errorHandler.unauthorized.bind(errorHandler);
export const forbiddenError = errorHandler.forbidden.bind(errorHandler);
export const validationError = errorHandler.validationError.bind(errorHandler);
export const quotaExceededError = errorHandler.quotaExceeded.bind(errorHandler);
export const aiServiceError = errorHandler.aiServiceError.bind(errorHandler);
export const fileError = errorHandler.fileError.bind(errorHandler);