"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = exports.InternalError = exports.RateLimitError = exports.ValidationError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
/**
 * Base application error class
 * All custom errors should extend this class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true, details) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;
        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
        // Set prototype explicitly for extending built-in classes
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
/**
 * 400 Bad Request - Client sent invalid data
 */
class BadRequestError extends AppError {
    constructor(message = 'Bad Request', details) {
        super(message, 400, true, details);
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}
exports.BadRequestError = BadRequestError;
/**
 * 401 Unauthorized - Authentication required or failed
 */
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, true);
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * 403 Forbidden - User doesn't have permission
 */
class ForbiddenError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, true);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}
exports.ForbiddenError = ForbiddenError;
/**
 * 404 Not Found - Resource doesn't exist
 */
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, true);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
exports.NotFoundError = NotFoundError;
/**
 * 409 Conflict - Resource already exists or state conflict
 */
class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409, true);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}
exports.ConflictError = ConflictError;
/**
 * 422 Unprocessable Entity - Validation failed
 */
class ValidationError extends AppError {
    constructor(message = 'Validation failed', details) {
        super(message, 422, true, details);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
/**
 * 429 Too Many Requests - Rate limit exceeded
 */
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, true);
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
exports.RateLimitError = RateLimitError;
/**
 * 500 Internal Server Error - Unexpected server error
 */
class InternalError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, 500, false);
        Object.setPrototypeOf(this, InternalError.prototype);
    }
}
exports.InternalError = InternalError;
/**
 * 503 Service Unavailable - External service is down
 */
class ServiceUnavailableError extends AppError {
    constructor(message = 'Service temporarily unavailable') {
        super(message, 503, true);
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
