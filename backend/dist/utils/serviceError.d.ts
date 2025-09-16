import { ErrorCode, AppError, ErrorContext } from './errorHandler';
export declare class ServiceError {
    static execute<T>(serviceName: string, operation: string, fn: () => Promise<T>, context?: ErrorContext): Promise<T>;
    static executeSync<T>(serviceName: string, operation: string, fn: () => T, context?: ErrorContext): T;
    static handleServiceError(serviceName: string, error: Error, errorMapping?: Record<string, {
        code: ErrorCode;
        httpStatus: number;
        userMessage?: string;
    }>, context?: ErrorContext): AppError;
    static getCommonErrorMappings(): {
        database: {
            'validation failed': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            'duplicate key': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            'not found': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            connection: {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
        };
        ai: {
            quota: {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            timeout: {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            'rate limit': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            'invalid request': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
        };
        storage: {
            'file not found': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            'access denied': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            'storage limit': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
        };
        websocket: {
            connection: {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            unauthorized: {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
        };
        memory: {
            'session not found': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            'embedding failed': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
        };
        agent: {
            'agent not found': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
            'cache error': {
                code: ErrorCode;
                httpStatus: number;
                userMessage: string;
            };
        };
    };
}
export declare function HandleServiceError(serviceName: string, errorMapping?: Record<string, any>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare function createServiceErrorHandler(serviceName: string, errorMappings?: Record<string, any>): {
    execute<T>(operation: string, fn: () => Promise<T>, context?: ErrorContext): Promise<T>;
    executeSync<T>(operation: string, fn: () => T, context?: ErrorContext): T;
    handleError(error: Error, context?: ErrorContext): AppError;
    wrapMethod: (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
};
//# sourceMappingURL=serviceError.d.ts.map