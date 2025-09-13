"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUnhandledRejection = exports.handleUncaughtException = exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = exports.createInternalError = exports.createForbiddenError = exports.createUnauthorizedError = exports.createNotFoundError = exports.createValidationError = exports.createError = exports.AppError = void 0;
const zod_1 = require("zod");
const api_types_1 = require("../types/api.types");
class AppError extends Error {
    constructor(message, code = api_types_1.API_ERROR_CODES.INTERNAL_ERROR, statusCode, isOperational = true, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode || (0, api_types_1.getHttpStatusForErrorCode)(code);
        this.isOperational = isOperational;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const createError = (message, code, statusCode, details) => {
    return new AppError(message, code, statusCode, true, details);
};
exports.createError = createError;
const createValidationError = (details) => {
    return (0, exports.createError)('Validation failed', api_types_1.API_ERROR_CODES.VALIDATION_ERROR, 400, details);
};
exports.createValidationError = createValidationError;
const createNotFoundError = (resource) => {
    return (0, exports.createError)(`${resource} not found`, api_types_1.API_ERROR_CODES.NOT_FOUND, 404);
};
exports.createNotFoundError = createNotFoundError;
const createUnauthorizedError = (message = 'Unauthorized') => {
    return (0, exports.createError)(message, api_types_1.API_ERROR_CODES.UNAUTHORIZED, 401);
};
exports.createUnauthorizedError = createUnauthorizedError;
const createForbiddenError = (message = 'Forbidden') => {
    return (0, exports.createError)(message, api_types_1.API_ERROR_CODES.FORBIDDEN, 403);
};
exports.createForbiddenError = createForbiddenError;
const createInternalError = (message = 'Internal server error') => {
    return (0, exports.createError)(message, api_types_1.API_ERROR_CODES.INTERNAL_ERROR, 500);
};
exports.createInternalError = createInternalError;
const errorHandler = (error, req, res, next) => {
    const requestId = req.headers['x-request-id'] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.error(`[${requestId}] Error:`, {
        message: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
    let response;
    if (error instanceof AppError) {
        response = {
            success: false,
            error: error.message,
            code: error.code,
            details: error.details,
            meta: {
                requestId: requestId,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }
        };
        if (process.env.NODE_ENV === 'development') {
            response.stack = error.stack;
        }
        res.status(error.statusCode).json(response);
    }
    else if (error instanceof zod_1.z.ZodError) {
        response = {
            success: false,
            error: 'Validation failed',
            code: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
            details: error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
                value: err.input || 'N/A'
            })),
            meta: {
                requestId: requestId,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }
        };
        res.status(400).json(response);
    }
    else if (error.name === 'ValidationError') {
        const details = Object.keys(error.errors).map(key => ({
            field: key,
            message: error.errors[key].message
        }));
        response = {
            success: false,
            error: 'Database validation failed',
            code: api_types_1.API_ERROR_CODES.VALIDATION_ERROR,
            details,
            meta: {
                requestId: requestId,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }
        };
        res.status(400).json(response);
    }
    else if (error.name === 'CastError') {
        response = {
            success: false,
            error: 'Invalid data format',
            code: api_types_1.API_ERROR_CODES.INVALID_INPUT,
            details: [{
                    field: error.path,
                    value: error.value,
                    type: error.kind
                }],
            meta: {
                requestId: requestId,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }
        };
        res.status(400).json(response);
    }
    else if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        response = {
            success: false,
            error: `${field} already exists`,
            code: api_types_1.API_ERROR_CODES.ALREADY_EXISTS,
            details: [{
                    field,
                    value: error.keyValue[field]
                }],
            meta: {
                requestId: requestId,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }
        };
        res.status(409).json(response);
    }
    else {
        response = {
            success: false,
            error: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : error.message,
            code: api_types_1.API_ERROR_CODES.INTERNAL_ERROR,
            meta: {
                requestId: requestId,
                timestamp: new Date().toISOString(),
                version: '1.0'
            }
        };
        if (process.env.NODE_ENV === 'development') {
            response.stack = error.stack;
        }
        res.status(500).json(response);
    }
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    const response = {
        success: false,
        error: `Route ${req.originalUrl} not found`,
        code: api_types_1.API_ERROR_CODES.NOT_FOUND,
        meta: {
            timestamp: new Date().toISOString(),
            version: '1.0'
        }
    };
    res.status(404).json(response);
};
exports.notFoundHandler = notFoundHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const handleUncaughtException = (error) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    process.exit(1);
};
exports.handleUncaughtException = handleUncaughtException;
const handleUnhandledRejection = (reason, promise) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...', {
        reason,
        promise,
        timestamp: new Date().toISOString()
    });
    setTimeout(() => process.exit(1), 1000);
};
exports.handleUnhandledRejection = handleUnhandledRejection;
//# sourceMappingURL=errorHandler.js.map