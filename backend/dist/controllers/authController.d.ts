import { Request, Response, NextFunction } from 'express';
declare class AuthController {
    samlLogin: any;
    samlCallback: (req: Request, res: Response, next: NextFunction) => void;
    samlMetadata: (req: Request, res: Response) => void;
    samlLogout: (req: Request, res: Response) => void;
    samlLogoutManual: (req: Request, res: Response) => void;
    samlLogoutCallbackPost: (req: Request, res: Response) => void;
    samlLogoutCallbackGet: (req: Request, res: Response) => void;
    adminLogin: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    getCurrentUser: (req: Request, res: Response) => Response<any, Record<string, any>>;
    refreshToken: (req: Request, res: Response) => Response<any, Record<string, any>>;
    logout: (req: Request, res: Response) => void;
}
export declare const authController: AuthController;
export {};
//# sourceMappingURL=authController.d.ts.map