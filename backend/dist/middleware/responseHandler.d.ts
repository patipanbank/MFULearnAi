import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Response {
            success<T>(data?: T, message?: string, meta?: any): void;
            successList<T>(data: T[], meta: any): void;
            error(error: string, code: string, statusCode?: number, details?: any): void;
            paginate<T>(data: T[], total: number, limit?: number, offset?: number): void;
        }
    }
}
export declare const responseHandler: (req: Request, res: Response, next: NextFunction) => void;
export declare const responseTime: (req: Request, res: Response, next: NextFunction) => void;
export declare const corsHandler: (req: Request, res: Response, next: NextFunction) => void;
export declare const securityHeaders: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=responseHandler.d.ts.map