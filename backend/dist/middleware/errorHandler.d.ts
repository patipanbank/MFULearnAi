import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    code: string;
    statusCode: number;
    isOperational: boolean;
    details?: any;
    constructor(message: string, code?: string, statusCode?: number, isOperational?: boolean, details?: any);
}
export declare const createError: (message: string, code: string, statusCode?: number, details?: any) => AppError;
export declare const createValidationError: (details: any) => AppError;
export declare const createNotFoundError: (resource: string) => AppError;
export declare const createUnauthorizedError: (message?: string) => AppError;
export declare const createForbiddenError: (message?: string) => AppError;
export declare const createInternalError: (message?: string) => AppError;
export declare const errorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const handleUncaughtException: (error: Error) => void;
export declare const handleUnhandledRejection: (reason: any, promise: Promise<any>) => void;
//# sourceMappingURL=errorHandler.d.ts.map