import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
export interface ErrorResponse {
    statusCode: number;
    timestamp: string;
    path: string;
    method: string;
    message: string;
    error?: string;
    code?: string;
    userMessage?: string;
    requestId?: string;
    context?: Record<string, any>;
    stack?: string;
}
export declare class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger;
    catch(exception: unknown, host: ArgumentsHost): void;
    private buildErrorResponse;
    private handleAppException;
    private handleZodError;
    private handleHttpException;
    private handleMongoError;
    private handleSystemError;
    private handleUnknownError;
    private isMongoError;
    private shouldIncludeStack;
    private logError;
}
