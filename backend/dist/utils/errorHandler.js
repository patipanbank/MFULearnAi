"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileError = exports.aiServiceError = exports.quotaExceededError = exports.validationError = exports.forbiddenError = exports.unauthorizedError = exports.notFoundError = exports.asyncHandler = exports.handleError = exports.createError = exports.errorHandler = exports.ErrorHandler = exports.AppError = exports.ErrorCode = void 0;
const websocketManager_1 = require("./websocketManager");
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    ErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ErrorCode["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    ErrorCode["RESOURCE_ALREADY_EXISTS"] = "RESOURCE_ALREADY_EXISTS";
    ErrorCode["RESOURCE_LIMIT_EXCEEDED"] = "RESOURCE_LIMIT_EXCEEDED";
    ErrorCode["QUOTA_EXCEEDED"] = "QUOTA_EXCEEDED";
    ErrorCode["OPERATION_NOT_ALLOWED"] = "OPERATION_NOT_ALLOWED";
    ErrorCode["CONCURRENT_MODIFICATION"] = "CONCURRENT_MODIFICATION";
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorCode["AI_SERVICE_ERROR"] = "AI_SERVICE_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["STORAGE_ERROR"] = "STORAGE_ERROR";
    ErrorCode["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    ErrorCode["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    ErrorCode["FILE_TOO_LARGE"] = "FILE_TOO_LARGE";
    ErrorCode["UNSUPPORTED_FILE_TYPE"] = "UNSUPPORTED_FILE_TYPE";
    ErrorCode["FILE_PROCESSING_ERROR"] = "FILE_PROCESSING_ERROR";
    ErrorCode["WEBSOCKET_ERROR"] = "WEBSOCKET_ERROR";
    ErrorCode["CONNECTION_LOST"] = "CONNECTION_LOST";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class AppError extends Error {
    constructor(code, message, httpStatus = 500, userMessage, context, originalError) {
        super(message);
        this.isOperational = true;
        this.name = 'AppError';
        this.code = code;
        this.httpStatus = httpStatus;
        this.userMessage = userMessage || this.getDefaultUserMessage(code);
        this.context = context;
        this.timestamp = new Date();
        if (originalError) {
            this.stack = originalError.stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    getDefaultUserMessage(code) {
        const userMessages = {
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
    toJSON() {
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
exports.AppError = AppError;
class ErrorHandler {
    constructor() {
        this.logLevel = 'error';
    }
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    createError(code, message, httpStatus = 500, userMessage, context, originalError) {
        return new AppError(code, message, httpStatus, userMessage, context, originalError);
    }
    handleError(error, context) {
        let appError;
        if (error instanceof AppError) {
            appError = error;
            if (context) {
                appError.context = { ...appError.context, ...context };
            }
        }
        else {
            appError = this.convertToAppError(error, context);
        }
        this.logError(appError);
        return appError;
    }
    convertToAppError(error, context) {
        let code = ErrorCode.INTERNAL_SERVER_ERROR;
        let httpStatus = 500;
        let userMessage;
        if (error.name === 'ValidationError') {
            code = ErrorCode.VALIDATION_ERROR;
            httpStatus = 400;
        }
        else if (error.name === 'CastError' || error.name === 'ObjectParameterError') {
            code = ErrorCode.INVALID_INPUT;
            httpStatus = 400;
        }
        else if (error.name === 'MongoError' || error.name === 'MongooseError') {
            code = ErrorCode.DATABASE_ERROR;
            httpStatus = 500;
        }
        else if (error.message.includes('timeout') || error.name === 'TimeoutError') {
            code = ErrorCode.TIMEOUT_ERROR;
            httpStatus = 408;
        }
        else if (error.message.includes('unauthorized') || error.message.includes('auth')) {
            code = ErrorCode.UNAUTHORIZED;
            httpStatus = 401;
        }
        else if (error.message.includes('not found') || error.message.includes('404')) {
            code = ErrorCode.RESOURCE_NOT_FOUND;
            httpStatus = 404;
        }
        return new AppError(code, error.message, httpStatus, userMessage, context, error);
    }
    logError(error) {
        const logData = {
            timestamp: error.timestamp.toISOString(),
            code: error.code,
            message: error.message,
            httpStatus: error.httpStatus,
            context: error.context,
            stack: error.stack?.split('\n').slice(0, 10).join('\n')
        };
        const logMessage = `[${error.code}] ${error.message}`;
        if (error.httpStatus >= 500) {
            console.error('🔴 ERROR:', logMessage, logData);
        }
        else if (error.httpStatus >= 400) {
            console.warn('🟡 WARNING:', logMessage, logData);
        }
        else {
            console.info('🔵 INFO:', logMessage, logData);
        }
    }
    sendErrorResponse(res, error) {
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
    sendWebSocketError(sessionId, error) {
        if (websocketManager_1.wsManager.getSessionConnectionCount(sessionId) > 0) {
            const wsMessage = {
                type: 'error',
                data: {
                    code: error.code,
                    message: error.userMessage || error.message,
                    timestamp: error.timestamp.toISOString()
                }
            };
            websocketManager_1.wsManager.broadcastToSession(sessionId, JSON.stringify(wsMessage));
        }
    }
    expressMiddleware() {
        return (error, req, res, next) => {
            const context = {
                userId: req.user?.sub || req.user?.id,
                operation: `${req.method} ${req.originalUrl}`
            };
            const appError = this.handleError(error, context);
            this.sendErrorResponse(res, appError);
        };
    }
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
    notFound(resource, context) {
        return this.createError(ErrorCode.RESOURCE_NOT_FOUND, `${resource} not found`, 404, `The requested ${resource.toLowerCase()} was not found.`, context);
    }
    unauthorized(context) {
        return this.createError(ErrorCode.UNAUTHORIZED, 'Unauthorized access', 401, 'You need to sign in to access this resource.', context);
    }
    forbidden(context) {
        return this.createError(ErrorCode.FORBIDDEN, 'Access forbidden', 403, 'You don\'t have permission to perform this action.', context);
    }
    validationError(message, context) {
        return this.createError(ErrorCode.VALIDATION_ERROR, message, 400, 'Please check your input and try again.', context);
    }
    quotaExceeded(context) {
        return this.createError(ErrorCode.QUOTA_EXCEEDED, 'Usage quota exceeded', 429, 'You have exceeded your usage quota.', context);
    }
    aiServiceError(message, context) {
        return this.createError(ErrorCode.AI_SERVICE_ERROR, message, 503, 'The AI service encountered an error. Please try again.', context);
    }
    fileError(message, context) {
        let code = ErrorCode.FILE_PROCESSING_ERROR;
        if (message.includes('too large') || message.includes('size')) {
            code = ErrorCode.FILE_TOO_LARGE;
        }
        else if (message.includes('type') || message.includes('format')) {
            code = ErrorCode.UNSUPPORTED_FILE_TYPE;
        }
        return this.createError(code, message, 400, undefined, context);
    }
}
exports.ErrorHandler = ErrorHandler;
exports.errorHandler = ErrorHandler.getInstance();
exports.createError = exports.errorHandler.createError.bind(exports.errorHandler);
exports.handleError = exports.errorHandler.handleError.bind(exports.errorHandler);
exports.asyncHandler = exports.errorHandler.asyncHandler.bind(exports.errorHandler);
exports.notFoundError = exports.errorHandler.notFound.bind(exports.errorHandler);
exports.unauthorizedError = exports.errorHandler.unauthorized.bind(exports.errorHandler);
exports.forbiddenError = exports.errorHandler.forbidden.bind(exports.errorHandler);
exports.validationError = exports.errorHandler.validationError.bind(exports.errorHandler);
exports.quotaExceededError = exports.errorHandler.quotaExceeded.bind(exports.errorHandler);
exports.aiServiceError = exports.errorHandler.aiServiceError.bind(exports.errorHandler);
exports.fileError = exports.errorHandler.fileError.bind(exports.errorHandler);
//# sourceMappingURL=errorHandler.js.map