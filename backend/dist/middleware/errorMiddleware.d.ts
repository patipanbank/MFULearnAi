import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errorHandler';
export declare const globalErrorHandler: (error: Error | AppError, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response, next: NextFunction) => void;
export declare const timeoutMiddleware: (timeoutMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const handleValidationErrors: (req: Request, res: Response, next: NextFunction) => void;
export declare const rateLimitErrorHandler: (req: Request, res: Response, next: NextFunction) => void;
export declare const handleDatabaseError: (error: Error, context?: any) => AppError;
export declare const handleFileUploadError: (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const handleAuthError: (error: Error, context?: any) => AppError;
//# sourceMappingURL=errorMiddleware.d.ts.map