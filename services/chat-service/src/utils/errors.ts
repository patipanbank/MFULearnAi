/**
 * Custom Error Classes
 */

/**
 * Base application error
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad request error (400)
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found') {
    super(message, 404);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

/**
 * Validation error (422)
 */
export class ValidationError extends AppError {
  public errors: any[];

  constructor(message: string = 'Validation Error', errors: any[] = []) {
    super(message, 422);
    this.errors = errors;
  }
}

/**
 * Too many requests error (429)
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too Many Requests') {
    super(message, 429);
  }
}

/**
 * Internal server error (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500);
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service Unavailable') {
    super(message, 503);
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database Error') {
    super(message, 500);
  }
}

/**
 * External service error
 */
export class ExternalServiceError extends AppError {
  public service: string;

  constructor(service: string, message: string = 'External Service Error') {
    super(message, 502);
    this.service = service;
  }
}

/**
 * Agent execution error
 */
export class AgentExecutionError extends AppError {
  public agentId?: string;

  constructor(message: string = 'Agent Execution Error', agentId?: string) {
    super(message, 500);
    this.agentId = agentId;
  }
}

/**
 * Check if error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
