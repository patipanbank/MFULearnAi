"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalErrorFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalErrorFilter = void 0;
const common_1 = require("@nestjs/common");
let GlobalErrorFilter = GlobalErrorFilter_1 = class GlobalErrorFilter {
    constructor() {
        this.logger = new common_1.Logger(GlobalErrorFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const timestamp = new Date().toISOString();
        const path = request.url;
        const method = request.method;
        const requestId = request.requestId || 'unknown';
        let errorResponse;
        if (exception instanceof common_1.HttpException) {
            errorResponse = this.handleHttpException(exception, timestamp, path, method, requestId);
        }
        else if (this.isMongoError(exception)) {
            errorResponse = this.handleMongoError(exception, timestamp, path, method, requestId);
        }
        else if (exception instanceof Error) {
            errorResponse = this.handleGenericError(exception, timestamp, path, method, requestId);
        }
        else {
            errorResponse = this.handleUnknownError(exception, timestamp, path, method, requestId);
        }
        this.logError(exception, errorResponse, request);
        response.status(errorResponse.statusCode).json(errorResponse);
    }
    handleHttpException(exception, timestamp, path, method, requestId) {
        const statusCode = exception.getStatus();
        const exceptionResponse = exception.getResponse();
        let message;
        let error;
        if (typeof exceptionResponse === 'string') {
            message = exceptionResponse;
            error = exception.name;
        }
        else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
            const response = exceptionResponse;
            message = response.message || response.error || 'Bad Request';
            error = response.error || exception.name;
        }
        else {
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
    handleMongoError(exception, timestamp, path, method, requestId) {
        let statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Database error occurred';
        let error = 'DatabaseError';
        if (exception.code === 11000) {
            statusCode = common_1.HttpStatus.CONFLICT;
            message = 'Duplicate entry found';
            error = 'DuplicateError';
        }
        else if (exception.code === 11001) {
            statusCode = common_1.HttpStatus.CONFLICT;
            message = 'Shutting down';
            error = 'ShutdownError';
        }
        else if (exception.name === 'ValidationError') {
            statusCode = common_1.HttpStatus.BAD_REQUEST;
            message = 'Validation failed';
            error = 'ValidationError';
        }
        else if (exception.name === 'CastError') {
            statusCode = common_1.HttpStatus.BAD_REQUEST;
            message = 'Invalid data format';
            error = 'CastError';
        }
        else if (exception.name === 'MongoNetworkError') {
            statusCode = common_1.HttpStatus.SERVICE_UNAVAILABLE;
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
    handleGenericError(exception, timestamp, path, method, requestId) {
        let statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let error = 'InternalServerError';
        if (exception.name === 'ValidationError') {
            statusCode = common_1.HttpStatus.BAD_REQUEST;
            message = exception.message;
            error = 'ValidationError';
        }
        else if (exception.name === 'UnauthorizedError') {
            statusCode = common_1.HttpStatus.UNAUTHORIZED;
            message = 'Unauthorized access';
            error = 'UnauthorizedError';
        }
        else if (exception.name === 'ForbiddenError') {
            statusCode = common_1.HttpStatus.FORBIDDEN;
            message = 'Access forbidden';
            error = 'ForbiddenError';
        }
        else if (exception.name === 'NotFoundError') {
            statusCode = common_1.HttpStatus.NOT_FOUND;
            message = 'Resource not found';
            error = 'NotFoundError';
        }
        else if (exception.name === 'TypeError') {
            statusCode = common_1.HttpStatus.BAD_REQUEST;
            message = 'Invalid data type';
            error = 'TypeError';
        }
        else if (exception.name === 'ReferenceError') {
            statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            message = 'Reference error';
            error = 'ReferenceError';
        }
        else if (exception.name === 'SyntaxError') {
            statusCode = common_1.HttpStatus.BAD_REQUEST;
            message = 'Syntax error in request';
            error = 'SyntaxError';
        }
        else if (exception.name === 'RangeError') {
            statusCode = common_1.HttpStatus.BAD_REQUEST;
            message = 'Value out of range';
            error = 'RangeError';
        }
        else if (exception.message.includes('timeout')) {
            statusCode = common_1.HttpStatus.REQUEST_TIMEOUT;
            message = 'Request timeout';
            error = 'TimeoutError';
        }
        else if (exception.message.includes('network')) {
            statusCode = common_1.HttpStatus.SERVICE_UNAVAILABLE;
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
    handleUnknownError(exception, timestamp, path, method, requestId) {
        return {
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
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
    logError(exception, errorResponse, request) {
        const user = request.user;
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
        if (errorResponse.statusCode >= 500) {
            this.logger.error(`🚨 Server Error: ${errorResponse.error} - ${errorResponse.message}`, exception instanceof Error ? exception.stack : String(exception), logContext);
        }
        else if (errorResponse.statusCode >= 400) {
            this.logger.warn(`⚠️  Client Error: ${errorResponse.error} - ${errorResponse.message}`, logContext);
        }
        else {
            this.logger.log(`ℹ️  Info: ${errorResponse.error} - ${errorResponse.message}`, logContext);
        }
        if (errorResponse.statusCode === common_1.HttpStatus.UNAUTHORIZED) {
            this.logger.warn(`🔐 Unauthorized access attempt from ${ip} - User: ${userId}`);
        }
        else if (errorResponse.statusCode === common_1.HttpStatus.FORBIDDEN) {
            this.logger.warn(`🚫 Forbidden access attempt from ${ip} - User: ${userId} (${userRole})`);
        }
        else if (errorResponse.statusCode === common_1.HttpStatus.TOO_MANY_REQUESTS) {
            this.logger.warn(`🚦 Rate limit exceeded from ${ip} - User: ${userId}`);
        }
        this.recordErrorMetrics(errorResponse, request);
    }
    recordErrorMetrics(errorResponse, request) {
        try {
            const performanceService = global.performanceService;
            if (performanceService && typeof performanceService.addMetric === 'function') {
                performanceService.addMetric('error_count', 1, 'count', {
                    statusCode: errorResponse.statusCode.toString(),
                    errorType: errorResponse.error,
                    method: errorResponse.method,
                    path: errorResponse.path
                });
            }
        }
        catch (error) {
        }
    }
    getClientIp(request) {
        const forwarded = request.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0] : request.ip;
        return ip || 'unknown';
    }
    isMongoError(exception) {
        return exception instanceof Error &&
            (exception.name === 'MongoError' ||
                exception.name === 'MongoNetworkError' ||
                exception.name === 'ValidationError' ||
                exception.name === 'CastError' ||
                'code' in exception);
    }
};
exports.GlobalErrorFilter = GlobalErrorFilter;
exports.GlobalErrorFilter = GlobalErrorFilter = GlobalErrorFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalErrorFilter);
//# sourceMappingURL=global-error.filter.js.map