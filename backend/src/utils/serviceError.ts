import { ErrorCode, errorHandler, AppError, ErrorContext } from './errorHandler';

/**
 * Service Error Wrapper
 * Provides consistent error handling for service methods
 */
export class ServiceError {
  /**
   * Wrap service methods with automatic error handling
   */
  static async execute<T>(
    serviceName: string,
    operation: string,
    fn: () => Promise<T>,
    context?: ErrorContext
  ): Promise<T> {
    const operationContext: ErrorContext = {
      ...context,
      operation: `${serviceName}.${operation}`
    };

    try {
      const result = await fn();
      return result;
    } catch (error) {
      const appError = errorHandler.handleError(error as Error, operationContext);
      throw appError;
    }
  }

  /**
   * Wrap synchronous service methods with error handling
   */
  static executeSync<T>(
    serviceName: string,
    operation: string,
    fn: () => T,
    context?: ErrorContext
  ): T {
    const operationContext: ErrorContext = {
      ...context,
      operation: `${serviceName}.${operation}`
    };

    try {
      const result = fn();
      return result;
    } catch (error) {
      const appError = errorHandler.handleError(error as Error, operationContext);
      throw appError;
    }
  }

  /**
   * Handle specific service errors with custom mapping
   */
  static handleServiceError(
    serviceName: string,
    error: Error,
    errorMapping?: Record<string, { code: ErrorCode; httpStatus: number; userMessage?: string }>,
    context?: ErrorContext
  ): AppError {
    const operationContext: ErrorContext = {
      ...context,
      operation: serviceName
    };

    // Check for custom error mapping
    if (errorMapping) {
      for (const [pattern, errorConfig] of Object.entries(errorMapping)) {
        if (error.message.includes(pattern) || error.name === pattern) {
          return errorHandler.createError(
            errorConfig.code,
            error.message,
            errorConfig.httpStatus,
            errorConfig.userMessage,
            operationContext,
            error
          );
        }
      }
    }

    // Default error handling
    return errorHandler.handleError(error, operationContext);
  }

  /**
   * Common error mappings for different services
   */
  static getCommonErrorMappings() {
    return {
      database: {
        'validation failed': {
          code: ErrorCode.VALIDATION_ERROR,
          httpStatus: 400,
          userMessage: 'Please check your input and try again.'
        },
        'duplicate key': {
          code: ErrorCode.RESOURCE_ALREADY_EXISTS,
          httpStatus: 409,
          userMessage: 'This resource already exists.'
        },
        'not found': {
          code: ErrorCode.RESOURCE_NOT_FOUND,
          httpStatus: 404,
          userMessage: 'The requested resource was not found.'
        },
        'connection': {
          code: ErrorCode.DATABASE_ERROR,
          httpStatus: 500,
          userMessage: 'Database connection error. Please try again later.'
        }
      },

      ai: {
        'quota': {
          code: ErrorCode.QUOTA_EXCEEDED,
          httpStatus: 429,
          userMessage: 'You have exceeded your AI usage quota.'
        },
        'timeout': {
          code: ErrorCode.TIMEOUT_ERROR,
          httpStatus: 408,
          userMessage: 'AI processing timed out. Please try again.'
        },
        'rate limit': {
          code: ErrorCode.RESOURCE_LIMIT_EXCEEDED,
          httpStatus: 429,
          userMessage: 'AI service rate limit exceeded. Please wait and try again.'
        },
        'invalid request': {
          code: ErrorCode.INVALID_INPUT,
          httpStatus: 400,
          userMessage: 'Invalid request to AI service.'
        }
      },

      storage: {
        'file not found': {
          code: ErrorCode.RESOURCE_NOT_FOUND,
          httpStatus: 404,
          userMessage: 'The requested file was not found.'
        },
        'access denied': {
          code: ErrorCode.FORBIDDEN,
          httpStatus: 403,
          userMessage: 'Access denied to storage resource.'
        },
        'storage limit': {
          code: ErrorCode.RESOURCE_LIMIT_EXCEEDED,
          httpStatus: 413,
          userMessage: 'Storage limit exceeded.'
        }
      },

      websocket: {
        'connection': {
          code: ErrorCode.CONNECTION_LOST,
          httpStatus: 500,
          userMessage: 'Connection was lost. Please refresh the page.'
        },
        'unauthorized': {
          code: ErrorCode.UNAUTHORIZED,
          httpStatus: 401,
          userMessage: 'WebSocket authentication failed.'
        }
      },

      memory: {
        'session not found': {
          code: ErrorCode.RESOURCE_NOT_FOUND,
          httpStatus: 404,
          userMessage: 'Chat session not found.'
        },
        'embedding failed': {
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          httpStatus: 503,
          userMessage: 'Memory processing failed. Please try again.'
        }
      },

      agent: {
        'agent not found': {
          code: ErrorCode.RESOURCE_NOT_FOUND,
          httpStatus: 404,
          userMessage: 'The requested agent was not found.'
        },
        'cache error': {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          httpStatus: 500,
          userMessage: 'Agent cache error occurred.'
        }
      }
    };
  }
}

/**
 * Service method decorator for automatic error handling
 */
export function HandleServiceError(serviceName: string, errorMapping?: Record<string, any>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const appError = ServiceError.handleServiceError(
          `${serviceName}.${propertyKey}`,
          error as Error,
          errorMapping,
          {
            metadata: { args: args.length > 0 ? 'present' : 'none' }
          }
        );
        throw appError;
      }
    };

    return descriptor;
  };
}

/**
 * Helper function to create service-specific error handlers
 */
export function createServiceErrorHandler(serviceName: string, errorMappings?: Record<string, any>) {
  return {
    async execute<T>(operation: string, fn: () => Promise<T>, context?: ErrorContext): Promise<T> {
      return ServiceError.execute(serviceName, operation, fn, context);
    },

    executeSync<T>(operation: string, fn: () => T, context?: ErrorContext): T {
      return ServiceError.executeSync(serviceName, operation, fn, context);
    },

    handleError(error: Error, context?: ErrorContext): AppError {
      return ServiceError.handleServiceError(serviceName, error, errorMappings, context);
    },

    wrapMethod: HandleServiceError(serviceName, errorMappings)
  };
}