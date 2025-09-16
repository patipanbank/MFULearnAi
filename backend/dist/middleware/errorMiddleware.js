"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAuthError = exports.handleFileUploadError = exports.handleDatabaseError = exports.rateLimitErrorHandler = exports.handleValidationErrors = exports.timeoutMiddleware = exports.notFoundHandler = exports.globalErrorHandler = void 0;
const errorHandler_1 = require("../utils/errorHandler");
const globalErrorHandler = (error, req, res, next) => {
    const context = {
        userId: req.user?.sub || req.user?.id,
        operation: `${req.method} ${req.originalUrl}`,
        metadata: {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            params: req.params,
            query: req.query
        }
    };
    const appError = errorHandler_1.errorHandler.handleError(error, context);
    errorHandler_1.errorHandler.sendErrorResponse(res, appError);
};
exports.globalErrorHandler = globalErrorHandler;
const notFoundHandler = (req, res, next) => {
    const error = (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.RESOURCE_NOT_FOUND, `Route ${req.originalUrl} not found`, 404, 'The requested page or resource was not found.', {
        operation: `${req.method} ${req.originalUrl}`
    });
    next(error);
};
exports.notFoundHandler = notFoundHandler;
const timeoutMiddleware = (timeoutMs = 30000) => {
    return (req, res, next) => {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                const error = (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.TIMEOUT_ERROR, `Request timeout after ${timeoutMs}ms`, 408, 'The request took too long to process. Please try again.', {
                    operation: `${req.method} ${req.originalUrl}`
                });
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
exports.timeoutMiddleware = timeoutMiddleware;
const handleValidationErrors = (req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => `${error.param}: ${error.msg}`);
        const error = (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.VALIDATION_ERROR, `Validation failed: ${errorMessages.join(', ')}`, 400, 'Please check your input and try again.', {
            userId: req.user?.sub || req.user?.id,
            operation: `${req.method} ${req.originalUrl}`,
            metadata: {
                validationErrors: errors.array()
            }
        });
        return next(error);
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
const rateLimitErrorHandler = (req, res, next) => {
    const error = (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.RESOURCE_LIMIT_EXCEEDED, 'Too many requests', 429, 'You have made too many requests. Please try again later.', {
        userId: req.user?.sub || req.user?.id,
        operation: `${req.method} ${req.originalUrl}`,
        metadata: {
            ip: req.ip
        }
    });
    errorHandler_1.errorHandler.sendErrorResponse(res, error);
};
exports.rateLimitErrorHandler = rateLimitErrorHandler;
const handleDatabaseError = (error, context) => {
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
        return (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.DATABASE_ERROR, `Database error: ${error.message}`, 500, 'A database error occurred. Please try again later.', context);
    }
    return (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.INTERNAL_SERVER_ERROR, error.message, 500, undefined, context);
};
exports.handleDatabaseError = handleDatabaseError;
const handleFileUploadError = (error, req, res, next) => {
    let appError;
    if (error.message === 'File too large') {
        appError = (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.FILE_TOO_LARGE, error.message, 400, 'The uploaded file is too large. Please use a smaller file.', {
            userId: req.user?.sub || req.user?.id,
            operation: 'file_upload'
        });
    }
    else if (error.message.includes('filetype')) {
        appError = (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.UNSUPPORTED_FILE_TYPE, error.message, 400, 'This file type is not supported.', {
            userId: req.user?.sub || req.user?.id,
            operation: 'file_upload'
        });
    }
    else {
        appError = (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.FILE_PROCESSING_ERROR, error.message, 400, 'Failed to process the uploaded file.', {
            userId: req.user?.sub || req.user?.id,
            operation: 'file_upload'
        });
    }
    next(appError);
};
exports.handleFileUploadError = handleFileUploadError;
const handleAuthError = (error, context) => {
    if (error.message.includes('token') || error.message.includes('expired')) {
        return (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.TOKEN_EXPIRED, error.message, 401, 'Your session has expired. Please sign in again.', context);
    }
    if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
        return (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.UNAUTHORIZED, error.message, 401, 'You need to sign in to access this resource.', context);
    }
    return (0, errorHandler_1.createError)(errorHandler_1.ErrorCode.UNAUTHORIZED, error.message, 401, 'Authentication failed.', context);
};
exports.handleAuthError = handleAuthError;
//# sourceMappingURL=errorMiddleware.js.map