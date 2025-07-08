"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const app_exceptions_1 = require("../exceptions/app-exceptions");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const errorResponse = this.buildErrorResponse(exception, request);
        this.logError(exception, errorResponse, request);
        response.status(errorResponse.statusCode).json(errorResponse);
    }
    buildErrorResponse(exception, request) {
        const timestamp = new Date().toISOString();
        const path = request.url;
        const method = request.method;
        const requestId = request.headers['x-request-id'];
        if (exception instanceof app_exceptions_1.AppException) {
            return this.handleAppException(exception, { timestamp, path, method, requestId });
        }
        if (exception instanceof zod_1.ZodError) {
            return this.handleZodError(exception, { timestamp, path, method, requestId });
        }
        if (exception instanceof common_1.HttpException) {
            return this.handleHttpException(exception, { timestamp, path, method, requestId });
        }
        if (this.isMongoError(exception)) {
            return this.handleMongoError(exception, { timestamp, path, method, requestId });
        }
        if (exception instanceof Error) {
            return this.handleSystemError(exception, { timestamp, path, method, requestId });
        }
        return this.handleUnknownError(exception, { timestamp, path, method, requestId });
    }
    handleAppException(exception, context) {
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
    handleZodError(exception, context) {
        const errors = exception.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
        }));
        return {
            statusCode: common_1.HttpStatus.BAD_REQUEST,
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
    handleHttpException(exception, context) {
        const status = exception.getStatus();
        const response = exception.getResponse();
        let message = exception.message;
        let userMessage = 'An error occurred. Please try again.';
        let errorContext = {};
        if (typeof response === 'object' && response !== null) {
            const responseObj = response;
            message = responseObj.message || message;
            errorContext = responseObj;
        }
        switch (status) {
            case common_1.HttpStatus.UNAUTHORIZED:
                userMessage = 'Please log in to access this resource.';
                break;
            case common_1.HttpStatus.FORBIDDEN:
                userMessage = 'You do not have permission to access this resource.';
                break;
            case common_1.HttpStatus.NOT_FOUND:
                userMessage = 'The requested resource was not found.';
                break;
            case common_1.HttpStatus.TOO_MANY_REQUESTS:
                userMessage = 'Too many requests. Please wait a moment and try again.';
                break;
            case common_1.HttpStatus.INTERNAL_SERVER_ERROR:
                userMessage = 'Internal server error. Please try again later.';
                break;
            case common_1.HttpStatus.BAD_GATEWAY:
            case common_1.HttpStatus.SERVICE_UNAVAILABLE:
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
    handleMongoError(exception, context) {
        let message = 'Database operation failed';
        let userMessage = 'Database error. Please try again later.';
        let statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        switch (exception.code) {
            case 11000:
                message = 'Duplicate key error';
                userMessage = 'A record with this information already exists.';
                statusCode = common_1.HttpStatus.CONFLICT;
                break;
            case 121:
                message = 'Document validation failed';
                userMessage = 'Invalid data format. Please check your input.';
                statusCode = common_1.HttpStatus.BAD_REQUEST;
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
    handleSystemError(exception, context) {
        let userMessage = 'An unexpected error occurred. Please try again later.';
        let statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        if (exception.name === 'ValidationError') {
            userMessage = 'Invalid input data. Please check your input and try again.';
            statusCode = common_1.HttpStatus.BAD_REQUEST;
        }
        else if (exception.name === 'TimeoutError') {
            userMessage = 'Request timeout. Please try again.';
            statusCode = common_1.HttpStatus.REQUEST_TIMEOUT;
        }
        else if (exception.name === 'NetworkError') {
            userMessage = 'Network error. Please check your connection and try again.';
            statusCode = common_1.HttpStatus.SERVICE_UNAVAILABLE;
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
    handleUnknownError(exception, context) {
        return {
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
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
    isMongoError(exception) {
        return exception instanceof Error && 'code' in exception && typeof exception.code === 'number';
    }
    shouldIncludeStack() {
        return process.env.NODE_ENV === 'development' || process.env.INCLUDE_STACK_TRACE === 'true';
    }
    logError(exception, errorResponse, request) {
        var _a;
        const logContext = {
            statusCode: errorResponse.statusCode,
            method: errorResponse.method,
            path: errorResponse.path,
            requestId: errorResponse.requestId,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            userId: (_a = request.user) === null || _a === void 0 ? void 0 : _a.id,
        };
        if (errorResponse.statusCode >= 500) {
            this.logger.error(`${errorResponse.code || 'SERVER_ERROR'}: ${errorResponse.message}`, {
                exception: exception instanceof Error ? exception.stack : String(exception),
                context: logContext,
                errorResponse,
            });
        }
        else if (errorResponse.statusCode >= 400) {
            this.logger.warn(`${errorResponse.code || 'CLIENT_ERROR'}: ${errorResponse.message}`, {
                context: logContext,
                userMessage: errorResponse.userMessage,
            });
        }
        else {
            this.logger.debug(`${errorResponse.code || 'OTHER_ERROR'}: ${errorResponse.message}`, {
                context: logContext,
            });
        }
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map