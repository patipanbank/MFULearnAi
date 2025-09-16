import { Request, Response, NextFunction } from 'express';
export declare enum ErrorCode {
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_INPUT = "INVALID_INPUT",
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
    RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS",
    RESOURCE_LIMIT_EXCEEDED = "RESOURCE_LIMIT_EXCEEDED",
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
    OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED",
    CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    AI_SERVICE_ERROR = "AI_SERVICE_ERROR",
    DATABASE_ERROR = "DATABASE_ERROR",
    STORAGE_ERROR = "STORAGE_ERROR",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    FILE_TOO_LARGE = "FILE_TOO_LARGE",
    UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE",
    FILE_PROCESSING_ERROR = "FILE_PROCESSING_ERROR",
    WEBSOCKET_ERROR = "WEBSOCKET_ERROR",
    CONNECTION_LOST = "CONNECTION_LOST"
}
export interface ErrorContext {
    userId?: string;
    sessionId?: string;
    chatId?: string;
    operation?: string;
    metadata?: Record<string, any>;
}
export interface ErrorDetails {
    code: ErrorCode;
    message: string;
    httpStatus: number;
    userMessage?: string;
    context?: ErrorContext;
    originalError?: Error;
    timestamp: Date;
    requestId?: string;
}
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly httpStatus: number;
    readonly userMessage?: string;
    context?: ErrorContext;
    readonly timestamp: Date;
    readonly requestId?: string;
    readonly isOperational: boolean;
    constructor(code: ErrorCode, message: string, httpStatus?: number, userMessage?: string, context?: ErrorContext, originalError?: Error);
    private getDefaultUserMessage;
    toJSON(): ErrorDetails;
}
export declare class ErrorHandler {
    private static instance;
    private logLevel;
    private constructor();
    static getInstance(): ErrorHandler;
    createError(code: ErrorCode, message: string, httpStatus?: number, userMessage?: string, context?: ErrorContext, originalError?: Error): AppError;
    handleError(error: Error | AppError, context?: ErrorContext): AppError;
    private convertToAppError;
    private logError;
    sendErrorResponse(res: Response, error: AppError): void;
    sendWebSocketError(sessionId: string, error: AppError): void;
    expressMiddleware(): (error: Error | AppError, req: Request, res: Response, next: NextFunction) => void;
    asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): (req: Request, res: Response, next: NextFunction) => void;
    notFound(resource: string, context?: ErrorContext): AppError;
    unauthorized(context?: ErrorContext): AppError;
    forbidden(context?: ErrorContext): AppError;
    validationError(message: string, context?: ErrorContext): AppError;
    quotaExceeded(context?: ErrorContext): AppError;
    aiServiceError(message: string, context?: ErrorContext): AppError;
    fileError(message: string, context?: ErrorContext): AppError;
}
export declare const errorHandler: ErrorHandler;
export declare const createError: (code: ErrorCode, message: string, httpStatus?: number, userMessage?: string, context?: ErrorContext, originalError?: Error) => AppError;
export declare const handleError: (error: Error | AppError, context?: ErrorContext) => AppError;
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundError: (resource: string, context?: ErrorContext) => AppError;
export declare const unauthorizedError: (context?: ErrorContext) => AppError;
export declare const forbiddenError: (context?: ErrorContext) => AppError;
export declare const validationError: (message: string, context?: ErrorContext) => AppError;
export declare const quotaExceededError: (context?: ErrorContext) => AppError;
export declare const aiServiceError: (message: string, context?: ErrorContext) => AppError;
export declare const fileError: (message: string, context?: ErrorContext) => AppError;
//# sourceMappingURL=errorHandler.d.ts.map