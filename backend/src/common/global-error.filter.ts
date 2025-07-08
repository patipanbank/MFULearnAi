import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoError } from 'mongodb';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
  stack?: string;
}

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;
    const requestId = (request as any).requestId || 'unknown';

    let errorResponse: ErrorResponse;

    if (exception instanceof HttpException) {
      errorResponse = this.handleHttpException(exception, timestamp, path, method, requestId);
    } else if (this.isMongoError(exception)) {
      errorResponse = this.handleMongoError(exception, timestamp, path, method, requestId);
    } else if (exception instanceof Error) {
      errorResponse = this.handleGenericError(exception, timestamp, path, method, requestId);
    } else {
      errorResponse = this.handleUnknownError(exception, timestamp, path, method, requestId);
    }

    // Log error details
    this.logError(exception, errorResponse, request);

    // Send response
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  /**
   * Handle HTTP exceptions
   */
  private handleHttpException(
    exception: HttpException,
    timestamp: string,
    path: string,
    method: string,
    requestId: string
  ): ErrorResponse {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    
    let message: string | string[];
    let error: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      error = exception.name;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const response = exceptionResponse as any;
      message = response.message || response.error || 'Bad Request';
      error = response.error || exception.name;
    } else {
      message = 'Internal server error';
      error = 'InternalServerError';
    }

    return {
      statusCode,
      message,
      error,
      timestamp,
      path,
      method,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: exception.stack })
    };
  }

  /**
   * Handle MongoDB errors
   */
  private handleMongoError(
    exception: MongoError,
    timestamp: string,
    path: string,
    method: string,
    requestId: string
  ): ErrorResponse {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error occurred';
    let error = 'DatabaseError';

    // Handle specific MongoDB errors
    if (exception.code === 11000) {
      statusCode = HttpStatus.CONFLICT;
      message = 'Duplicate entry found';
      error = 'DuplicateError';
    } else if (exception.code === 11001) {
      statusCode = HttpStatus.CONFLICT;
      message = 'Shutting down';
      error = 'ShutdownError';
    } else if (exception.name === 'ValidationError') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      error = 'ValidationError';
    } else if (exception.name === 'CastError') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid data format';
      error = 'CastError';
    } else if (exception.name === 'MongoNetworkError') {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection failed';
      error = 'DatabaseConnectionError';
    }

    return {
      statusCode,
      message,
      error,
      timestamp,
      path,
      method,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: exception.stack })
    };
  }

  /**
   * Handle generic errors
   */
  private handleGenericError(
    exception: Error,
    timestamp: string,
    path: string,
    method: string,
    requestId: string
  ): ErrorResponse {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';

    // Handle specific error types
    if (exception.name === 'ValidationError') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = exception.message;
      error = 'ValidationError';
    } else if (exception.name === 'UnauthorizedError') {
      statusCode = HttpStatus.UNAUTHORIZED;
      message = 'Unauthorized access';
      error = 'UnauthorizedError';
    } else if (exception.name === 'ForbiddenError') {
      statusCode = HttpStatus.FORBIDDEN;
      message = 'Access forbidden';
      error = 'ForbiddenError';
    } else if (exception.name === 'NotFoundError') {
      statusCode = HttpStatus.NOT_FOUND;
      message = 'Resource not found';
      error = 'NotFoundError';
    } else if (exception.name === 'TypeError') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid data type';
      error = 'TypeError';
    } else if (exception.name === 'ReferenceError') {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Reference error';
      error = 'ReferenceError';
    } else if (exception.name === 'SyntaxError') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Syntax error in request';
      error = 'SyntaxError';
    } else if (exception.name === 'RangeError') {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Value out of range';
      error = 'RangeError';
    } else if (exception.message.includes('timeout')) {
      statusCode = HttpStatus.REQUEST_TIMEOUT;
      message = 'Request timeout';
      error = 'TimeoutError';
    } else if (exception.message.includes('network')) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Network error';
      error = 'NetworkError';
    }

    return {
      statusCode,
      message: process.env.NODE_ENV === 'production' ? message : exception.message,
      error,
      timestamp,
      path,
      method,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: exception.stack })
    };
  }

  /**
   * Handle unknown errors
   */
  private handleUnknownError(
    exception: unknown,
    timestamp: string,
    path: string,
    method: string,
    requestId: string
  ): ErrorResponse {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'UnknownError',
      timestamp,
      path,
      method,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: exception instanceof Error ? exception.stack : String(exception)
      })
    };
  }

  /**
   * Log error details
   */
  private logError(exception: unknown, errorResponse: ErrorResponse, request: Request) {
    const user = (request as any).user;
    const userId = user ? user.id : 'Anonymous';
    const userRole = user ? user.role : 'Unknown';
    const ip = this.getClientIp(request);
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const logContext = {
      requestId: errorResponse.requestId,
      userId,
      userRole,
      ip,
      userAgent: userAgent.substring(0, 100),
      path: errorResponse.path,
      method: errorResponse.method,
      statusCode: errorResponse.statusCode,
      errorType: errorResponse.error,
      message: errorResponse.message,
      timestamp: errorResponse.timestamp
    };

    // Log based on severity
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `🚨 Server Error: ${errorResponse.error} - ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : String(exception),
        logContext
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `⚠️  Client Error: ${errorResponse.error} - ${errorResponse.message}`,
        logContext
      );
    } else {
      this.logger.log(
        `ℹ️  Info: ${errorResponse.error} - ${errorResponse.message}`,
        logContext
      );
    }

    // Additional logging for specific errors
    if (errorResponse.statusCode === HttpStatus.UNAUTHORIZED) {
      this.logger.warn(`🔐 Unauthorized access attempt from ${ip} - User: ${userId}`);
    } else if (errorResponse.statusCode === HttpStatus.FORBIDDEN) {
      this.logger.warn(`🚫 Forbidden access attempt from ${ip} - User: ${userId} (${userRole})`);
    } else if (errorResponse.statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(`🚦 Rate limit exceeded from ${ip} - User: ${userId}`);
    }

    // Record error metrics if available
    this.recordErrorMetrics(errorResponse, request);
  }

  /**
   * Record error metrics
   */
  private recordErrorMetrics(errorResponse: ErrorResponse, request: Request) {
    try {
      // Try to get performance service from global if available
      const performanceService = (global as any).performanceService;
      if (performanceService && typeof performanceService.addMetric === 'function') {
        performanceService.addMetric('error_count', 1, 'count', {
          statusCode: errorResponse.statusCode.toString(),
          errorType: errorResponse.error,
          method: errorResponse.method,
          path: errorResponse.path
        });
      }
    } catch (error) {
      // Silently ignore if performance service is not available
    }
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0] : request.ip;
    return ip || 'unknown';
  }

  /**
   * Check if error is a MongoDB error
   */
  private isMongoError(exception: unknown): exception is MongoError {
    return exception instanceof Error && 
           (exception.name === 'MongoError' || 
            exception.name === 'MongoNetworkError' ||
            exception.name === 'ValidationError' ||
            exception.name === 'CastError' ||
            'code' in exception);
  }
} 