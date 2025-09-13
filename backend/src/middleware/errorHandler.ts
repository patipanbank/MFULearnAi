import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiErrorResponse, API_ERROR_CODES, getHttpStatusForErrorCode } from '../types/api.types';

/**
 * Global Error Handler - จัดการ errors แบบ centralized
 */

export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(
    message: string,
    code: string = API_ERROR_CODES.INTERNAL_ERROR,
    statusCode?: number,
    isOperational = true,
    details?: any
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode || getHttpStatusForErrorCode(code as any);
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (
  message: string,
  code: string,
  statusCode?: number,
  details?: any
): AppError => {
  return new AppError(message, code, statusCode, true, details);
};

// Specific error creators
export const createValidationError = (details: any): AppError => {
  return createError(
    'Validation failed',
    API_ERROR_CODES.VALIDATION_ERROR,
    400,
    details
  );
};

export const createNotFoundError = (resource: string): AppError => {
  return createError(
    `${resource} not found`,
    API_ERROR_CODES.NOT_FOUND,
    404
  );
};

export const createUnauthorizedError = (message = 'Unauthorized'): AppError => {
  return createError(
    message,
    API_ERROR_CODES.UNAUTHORIZED,
    401
  );
};

export const createForbiddenError = (message = 'Forbidden'): AppError => {
  return createError(
    message,
    API_ERROR_CODES.FORBIDDEN,
    403
  );
};

export const createInternalError = (message = 'Internal server error'): AppError => {
  return createError(
    message,
    API_ERROR_CODES.INTERNAL_ERROR,
    500
  );
};

// Error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log error
  console.error(`[${requestId}] Error:`, {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  let response: ApiErrorResponse;

  if (error instanceof AppError) {
    // Our custom application errors
    response = {
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
      meta: {
        requestId: requestId as string,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }

    res.status(error.statusCode).json(response);
  } else if (error instanceof z.ZodError) {
    // Zod validation errors
    response = {
      success: false,
      error: 'Validation failed',
      code: API_ERROR_CODES.VALIDATION_ERROR,
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
        value: err.input
      })),
      meta: {
        requestId: requestId as string,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };

    res.status(400).json(response);
  } else if (error.name === 'ValidationError') {
    // Mongoose validation errors
    const details = Object.keys((error as any).errors).map(key => ({
      field: key,
      message: (error as any).errors[key].message
    }));

    response = {
      success: false,
      error: 'Database validation failed',
      code: API_ERROR_CODES.VALIDATION_ERROR,
      details,
      meta: {
        requestId: requestId as string,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };

    res.status(400).json(response);
  } else if (error.name === 'CastError') {
    // MongoDB cast errors
    response = {
      success: false,
      error: 'Invalid data format',
      code: API_ERROR_CODES.INVALID_INPUT,
      details: {
        field: (error as any).path,
        value: (error as any).value,
        type: (error as any).kind
      },
      meta: {
        requestId: requestId as string,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };

    res.status(400).json(response);
  } else if ((error as any).code === 11000) {
    // MongoDB duplicate key errors
    const field = Object.keys((error as any).keyValue)[0];
    response = {
      success: false,
      error: `${field} already exists`,
      code: API_ERROR_CODES.ALREADY_EXISTS,
      details: {
        field,
        value: (error as any).keyValue[field]
      },
      meta: {
        requestId: requestId as string,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };

    res.status(409).json(response);
  } else {
    // Unknown errors
    response = {
      success: false,
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      meta: {
        requestId: requestId as string,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }

    res.status(500).json(response);
  }
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiErrorResponse = {
    success: false,
    error: `Route ${req.originalUrl} not found`,
    code: API_ERROR_CODES.NOT_FOUND,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  };

  res.status(404).json(response);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Process error handlers
export const handleUncaughtException = (error: Error): void => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  process.exit(1);
};

export const handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...', {
    reason,
    promise,
    timestamp: new Date().toISOString()
  });
  
  // Give server time to finish processing current requests
  setTimeout(() => process.exit(1), 1000);
};