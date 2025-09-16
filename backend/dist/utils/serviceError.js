"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceError = void 0;
exports.HandleServiceError = HandleServiceError;
exports.createServiceErrorHandler = createServiceErrorHandler;
const errorHandler_1 = require("./errorHandler");
class ServiceError {
    static async execute(serviceName, operation, fn, context) {
        const operationContext = {
            ...context,
            operation: `${serviceName}.${operation}`
        };
        try {
            const result = await fn();
            return result;
        }
        catch (error) {
            const appError = errorHandler_1.errorHandler.handleError(error, operationContext);
            throw appError;
        }
    }
    static executeSync(serviceName, operation, fn, context) {
        const operationContext = {
            ...context,
            operation: `${serviceName}.${operation}`
        };
        try {
            const result = fn();
            return result;
        }
        catch (error) {
            const appError = errorHandler_1.errorHandler.handleError(error, operationContext);
            throw appError;
        }
    }
    static handleServiceError(serviceName, error, errorMapping, context) {
        const operationContext = {
            ...context,
            operation: serviceName
        };
        if (errorMapping) {
            for (const [pattern, errorConfig] of Object.entries(errorMapping)) {
                if (error.message.includes(pattern) || error.name === pattern) {
                    return errorHandler_1.errorHandler.createError(errorConfig.code, error.message, errorConfig.httpStatus, errorConfig.userMessage, operationContext, error);
                }
            }
        }
        return errorHandler_1.errorHandler.handleError(error, operationContext);
    }
    static getCommonErrorMappings() {
        return {
            database: {
                'validation failed': {
                    code: errorHandler_1.ErrorCode.VALIDATION_ERROR,
                    httpStatus: 400,
                    userMessage: 'Please check your input and try again.'
                },
                'duplicate key': {
                    code: errorHandler_1.ErrorCode.RESOURCE_ALREADY_EXISTS,
                    httpStatus: 409,
                    userMessage: 'This resource already exists.'
                },
                'not found': {
                    code: errorHandler_1.ErrorCode.RESOURCE_NOT_FOUND,
                    httpStatus: 404,
                    userMessage: 'The requested resource was not found.'
                },
                'connection': {
                    code: errorHandler_1.ErrorCode.DATABASE_ERROR,
                    httpStatus: 500,
                    userMessage: 'Database connection error. Please try again later.'
                }
            },
            ai: {
                'quota': {
                    code: errorHandler_1.ErrorCode.QUOTA_EXCEEDED,
                    httpStatus: 429,
                    userMessage: 'You have exceeded your AI usage quota.'
                },
                'timeout': {
                    code: errorHandler_1.ErrorCode.TIMEOUT_ERROR,
                    httpStatus: 408,
                    userMessage: 'AI processing timed out. Please try again.'
                },
                'rate limit': {
                    code: errorHandler_1.ErrorCode.RESOURCE_LIMIT_EXCEEDED,
                    httpStatus: 429,
                    userMessage: 'AI service rate limit exceeded. Please wait and try again.'
                },
                'invalid request': {
                    code: errorHandler_1.ErrorCode.INVALID_INPUT,
                    httpStatus: 400,
                    userMessage: 'Invalid request to AI service.'
                }
            },
            storage: {
                'file not found': {
                    code: errorHandler_1.ErrorCode.RESOURCE_NOT_FOUND,
                    httpStatus: 404,
                    userMessage: 'The requested file was not found.'
                },
                'access denied': {
                    code: errorHandler_1.ErrorCode.FORBIDDEN,
                    httpStatus: 403,
                    userMessage: 'Access denied to storage resource.'
                },
                'storage limit': {
                    code: errorHandler_1.ErrorCode.RESOURCE_LIMIT_EXCEEDED,
                    httpStatus: 413,
                    userMessage: 'Storage limit exceeded.'
                }
            },
            websocket: {
                'connection': {
                    code: errorHandler_1.ErrorCode.CONNECTION_LOST,
                    httpStatus: 500,
                    userMessage: 'Connection was lost. Please refresh the page.'
                },
                'unauthorized': {
                    code: errorHandler_1.ErrorCode.UNAUTHORIZED,
                    httpStatus: 401,
                    userMessage: 'WebSocket authentication failed.'
                }
            },
            memory: {
                'session not found': {
                    code: errorHandler_1.ErrorCode.RESOURCE_NOT_FOUND,
                    httpStatus: 404,
                    userMessage: 'Chat session not found.'
                },
                'embedding failed': {
                    code: errorHandler_1.ErrorCode.EXTERNAL_SERVICE_ERROR,
                    httpStatus: 503,
                    userMessage: 'Memory processing failed. Please try again.'
                }
            },
            agent: {
                'agent not found': {
                    code: errorHandler_1.ErrorCode.RESOURCE_NOT_FOUND,
                    httpStatus: 404,
                    userMessage: 'The requested agent was not found.'
                },
                'cache error': {
                    code: errorHandler_1.ErrorCode.INTERNAL_SERVER_ERROR,
                    httpStatus: 500,
                    userMessage: 'Agent cache error occurred.'
                }
            }
        };
    }
}
exports.ServiceError = ServiceError;
function HandleServiceError(serviceName, errorMapping) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            try {
                return await originalMethod.apply(this, args);
            }
            catch (error) {
                const appError = ServiceError.handleServiceError(`${serviceName}.${propertyKey}`, error, errorMapping, {
                    metadata: { args: args.length > 0 ? 'present' : 'none' }
                });
                throw appError;
            }
        };
        return descriptor;
    };
}
function createServiceErrorHandler(serviceName, errorMappings) {
    return {
        async execute(operation, fn, context) {
            return ServiceError.execute(serviceName, operation, fn, context);
        },
        executeSync(operation, fn, context) {
            return ServiceError.executeSync(serviceName, operation, fn, context);
        },
        handleError(error, context) {
            return ServiceError.handleServiceError(serviceName, error, errorMappings, context);
        },
        wrapMethod: HandleServiceError(serviceName, errorMappings)
    };
}
//# sourceMappingURL=serviceError.js.map