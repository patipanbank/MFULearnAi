import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { MongoError } from 'mongodb';
import { AppException } from '../exceptions/app-exceptions';

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error?: string;
  code?: string;
  userMessage?: string;
  requestId?: string;
  context?: Record<string, any>;
  stack?: string;
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const errorResponse = this.buildErrorResponse(exception, request);
    
    // Log error based on severity
    this.logError(exception, errorResponse, request);
    
    // Send response
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;
    const requestId = request.headers['x-request-id'] as string;

    // Handle different exception types
    if (exception instanceof AppException) {
      return this.handleAppException(exception, { timestamp, path, method, requestId });
    }

    if (exception instanceof ZodError) {
      return this.handleZodError(exception, { timestamp, path, method, requestId });
    }

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, { timestamp, path, method, requestId });
    }

    if (this.isMongoError(exception)) {
      return this.handleMongoError(exception, { timestamp, path, method, requestId });
    }

    // Handle system errors
    if (exception instanceof Error) {
      return this.handleSystemError(exception, { timestamp, path, method, requestId });
    }

    // Handle unknown errors
    return this.handleUnknownError(exception, { timestamp, path, method, requestId });
  }

  private handleAppException(exception: AppException, context: any): ErrorResponse {
    return {
      statusCode: exception.getStatus(),
      timestamp: context.timestamp,
      path: context.path,
      method: context.method,
      message: exception.message,
      error: exception.name,
      code: exception.code,
      userMessage: exception.userMessage,
      requestId: context.requestId,
      context: exception.context,
      stack: this.shouldIncludeStack() ? exception.stack : undefined,
    };
  }

  private handleZodError(exception: ZodError, context: any): ErrorResponse {
    const errors = exception.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: context.timestamp,
      path: context.path,
      method: context.method,
      message: 'Validation failed',
      error: 'ValidationError',
      code: 'VALIDATION_001',
      userMessage: 'Invalid input data. Please check your input and try again.',
      requestId: context.requestId,
      context: { errors },
      stack: this.shouldIncludeStack() ? exception.stack : undefined,
    };
  }

  private handleHttpException(exception: HttpException, context: any): ErrorResponse {
    const status = exception.getStatus();
    const response = exception.getResponse();
    
    let message = exception.message;
    let userMessage = 'An error occurred. Please try again.';
    let errorContext = {};

    if (typeof response === 'object' && response !== null) {
      const responseObj = response as any;
      message = responseObj.message || message;
      errorContext = responseObj;
    }

    // Provide better user messages for common HTTP errors
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        userMessage = 'Please log in to access this resource.';
        break;
      case HttpStatus.FORBIDDEN:
        userMessage = 'You do not have permission to access this resource.';
        break;
      case HttpStatus.NOT_FOUND:
        userMessage = 'The requested resource was not found.';
        break;
      case HttpStatus.TOO_MANY_REQUESTS:
        userMessage = 'Too many requests. Please wait a moment and try again.';
        break;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        userMessage = 'Internal server error. Please try again later.';
        break;
      case HttpStatus.BAD_GATEWAY:
      case HttpStatus.SERVICE_UNAVAILABLE:
        userMessage = 'Service is temporarily unavailable. Please try again later.';
        break;
    }

    return {
      statusCode: status,
      timestamp: context.timestamp,
      path: context.path,
      method: context.method,
      message,
      error: exception.name,
      userMessage,
      requestId: context.requestId,
      context: errorContext,
      stack: this.shouldIncludeStack() ? exception.stack : undefined,
    };
  }

  private handleMongoError(exception: MongoError, context: any): ErrorResponse {
    let message = 'Database operation failed';
    let userMessage = 'Database error. Please try again later.';
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    // Handle specific MongoDB errors
    switch (exception.code) {
      case 11000: // Duplicate key error
        message = 'Duplicate key error';
        userMessage = 'A record with this information already exists.';
        statusCode = HttpStatus.CONFLICT;
        break;
      case 121: // Document validation failure
        message = 'Document validation failed';
        userMessage = 'Invalid data format. Please check your input.';
        statusCode = HttpStatus.BAD_REQUEST;
        break;
      default:
        message = exception.message || message;
    }

    return {
      statusCode,
      timestamp: context.timestamp,
      path: context.path,
      method: context.method,
      message,
      error: 'MongoError',
      code: `MONGO_${exception.code}`,
      userMessage,
      requestId: context.requestId,
      context: { mongoCode: exception.code },
      stack: this.shouldIncludeStack() ? exception.stack : undefined,
    };
  }

  private handleSystemError(exception: Error, context: any): ErrorResponse {
    let userMessage = 'An unexpected error occurred. Please try again later.';
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    // Handle specific system errors
    if (exception.name === 'ValidationError') {
      userMessage = 'Invalid input data. Please check your input and try again.';
      statusCode = HttpStatus.BAD_REQUEST;
    } else if (exception.name === 'TimeoutError') {
      userMessage = 'Request timeout. Please try again.';
      statusCode = HttpStatus.REQUEST_TIMEOUT;
    } else if (exception.name === 'NetworkError') {
      userMessage = 'Network error. Please check your connection and try again.';
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
    }

    return {
      statusCode,
      timestamp: context.timestamp,
      path: context.path,
      method: context.method,
      message: exception.message,
      error: exception.name,
      code: 'SYSTEM_ERROR',
      userMessage,
      requestId: context.requestId,
      stack: this.shouldIncludeStack() ? exception.stack : undefined,
    };
  }

  private handleUnknownError(exception: unknown, context: any): ErrorResponse {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: context.timestamp,
      path: context.path,
      method: context.method,
      message: 'An unknown error occurred',
      error: 'UnknownError',
      code: 'UNKNOWN_ERROR',
      userMessage: 'An unexpected error occurred. Please try again later.',
      requestId: context.requestId,
      context: { exception: String(exception) },
      stack: this.shouldIncludeStack() ? new Error().stack : undefined,
    };
  }

  private isMongoError(exception: unknown): exception is MongoError {
    return exception instanceof Error && 'code' in exception && typeof (exception as any).code === 'number';
  }

  private shouldIncludeStack(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.INCLUDE_STACK_TRACE === 'true';
  }

  private logError(exception: unknown, errorResponse: ErrorResponse, request: Request): void {
    const logContext = {
      statusCode: errorResponse.statusCode,
      method: errorResponse.method,
      path: errorResponse.path,
      requestId: errorResponse.requestId,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      userId: (request as any).user?.id,
    };

    // Log based on severity
    if (errorResponse.statusCode >= 500) {
      // Server errors - log with full details
      this.logger.error(
        `${errorResponse.code || 'SERVER_ERROR'}: ${errorResponse.message}`,
        {
          exception: exception instanceof Error ? exception.stack : String(exception),
          context: logContext,
          errorResponse,
        }
      );
    } else if (errorResponse.statusCode >= 400) {
      // Client errors - log with less details
      this.logger.warn(
        `${errorResponse.code || 'CLIENT_ERROR'}: ${errorResponse.message}`,
        {
          context: logContext,
          userMessage: errorResponse.userMessage,
        }
      );
    } else {
      // Other errors - debug log
      this.logger.debug(
        `${errorResponse.code || 'OTHER_ERROR'}: ${errorResponse.message}`,
        {
          context: logContext,
        }
      );
    }
  }
} 