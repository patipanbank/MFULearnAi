import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, errorHandler, createError } from '../utils/errorHandler';

/**
 * Global error handling middleware
 * This should be registered as the last middleware in the Express app
 */
export const globalErrorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const context = {
    userId: (req as any).user?.sub || (req as any).user?.id,
    operation: `${req.method} ${req.originalUrl}`,
    metadata: {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      params: req.params,
      query: req.query
    }
  };

  const appError = errorHandler.handleError(error, context);
  errorHandler.sendErrorResponse(res, appError);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createError(
    ErrorCode.RESOURCE_NOT_FOUND,
    `Route ${req.originalUrl} not found`,
    404,
    'The requested page or resource was not found.',
    {
      operation: `${req.method} ${req.originalUrl}`
    }
  );

  next(error);
};

/**
 * Request timeout middleware
 */
export const timeoutMiddleware = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error = createError(
          ErrorCode.TIMEOUT_ERROR,
          `Request timeout after ${timeoutMs}ms`,
          408,
          'The request took too long to process. Please try again.',
          {
            operation: `${req.method} ${req.originalUrl}`
          }
        );
        next(error);
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Validation error handler for express-validator
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error: any) => `${error.param}: ${error.msg}`);
    const error = createError(
      ErrorCode.VALIDATION_ERROR,
      `Validation failed: ${errorMessages.join(', ')}`,
      400,
      'Please check your input and try again.',
      {
        userId: (req as any).user?.sub || (req as any).user?.id,
        operation: `${req.method} ${req.originalUrl}`,
        metadata: {
          validationErrors: errors.array()
        }
      }
    );

    return next(error);
  }

  next();
};

/**
 * Rate limiting error handler
 */
export const rateLimitErrorHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createError(
    ErrorCode.RESOURCE_LIMIT_EXCEEDED,
    'Too many requests',
    429,
    'You have made too many requests. Please try again later.',
    {
      userId: (req as any).user?.sub || (req as any).user?.id,
      operation: `${req.method} ${req.originalUrl}`,
      metadata: {
        ip: req.ip
      }
    }
  );

  errorHandler.sendErrorResponse(res, error);
};

/**
 * Database connection error handler
 */
export const handleDatabaseError = (error: Error, context?: any): AppError => {
  if (error.name === 'MongoError' || error.name === 'MongooseError') {
    return createError(
      ErrorCode.DATABASE_ERROR,
      `Database error: ${error.message}`,
      500,
      'A database error occurred. Please try again later.',
      context
    );
  }

  return createError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    error.message,
    500,
    undefined,
    context
  );
};

/**
 * File upload error handler
 */
export const handleFileUploadError = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  let appError: AppError;

  if (error.message === 'File too large') {
    appError = createError(
      ErrorCode.FILE_TOO_LARGE,
      error.message,
      400,
      'The uploaded file is too large. Please use a smaller file.',
      {
        userId: (req as any).user?.sub || (req as any).user?.id,
        operation: 'file_upload'
      }
    );
  } else if (error.message.includes('filetype')) {
    appError = createError(
      ErrorCode.UNSUPPORTED_FILE_TYPE,
      error.message,
      400,
      'This file type is not supported.',
      {
        userId: (req as any).user?.sub || (req as any).user?.id,
        operation: 'file_upload'
      }
    );
  } else {
    appError = createError(
      ErrorCode.FILE_PROCESSING_ERROR,
      error.message,
      400,
      'Failed to process the uploaded file.',
      {
        userId: (req as any).user?.sub || (req as any).user?.id,
        operation: 'file_upload'
      }
    );
  }

  next(appError);
};

/**
 * Authentication error handler
 */
export const handleAuthError = (error: Error, context?: any): AppError => {
  if (error.message.includes('token') || error.message.includes('expired')) {
    return createError(
      ErrorCode.TOKEN_EXPIRED,
      error.message,
      401,
      'Your session has expired. Please sign in again.',
      context
    );
  }

  if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
    return createError(
      ErrorCode.UNAUTHORIZED,
      error.message,
      401,
      'You need to sign in to access this resource.',
      context
    );
  }

  return createError(
    ErrorCode.UNAUTHORIZED,
    error.message,
    401,
    'Authentication failed.',
    context
  );
};