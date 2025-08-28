import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
export interface AdminRequest extends AuthenticatedRequest {
}
export declare const adminMiddleware: (req: AdminRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=adminMiddleware.d.ts.map