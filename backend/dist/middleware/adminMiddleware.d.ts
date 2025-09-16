import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
export interface AdminRequest extends AuthenticatedRequest {
}
export interface SuperAdminRequest extends AuthenticatedRequest {
}
export declare const departmentMiddleware: (req: AdminRequest, res: Response, next: NextFunction) => void;
export declare const superAdminMiddleware: (req: SuperAdminRequest, res: Response, next: NextFunction) => void;
export declare const adminMiddleware: (req: AdminRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=adminMiddleware.d.ts.map