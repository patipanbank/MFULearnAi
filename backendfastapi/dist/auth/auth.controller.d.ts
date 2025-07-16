import { Response } from 'express';
import { AuthService } from './auth.service';
import { SAMLService } from './saml.service';
export declare class AuthController {
    private readonly authService;
    private readonly samlService;
    constructor(authService: AuthService, samlService: SAMLService);
    samlLogin(req: any, res: Response): Promise<void>;
    samlCallback(req: any, res: Response): Promise<void>;
    samlMetadata(res: Response): Promise<void>;
    login(req: any): Promise<{
        access_token: string;
        user: {
            id: any;
            nameID: any;
            username: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            department: any;
            groups: any;
        };
    }>;
    getProfile(user: any): Promise<import("../models/user.model").User | null>;
    logout(req: any, res: Response): Promise<void>;
    refreshToken(req: any): Promise<{
        access_token: string;
        user: {
            id: any;
            nameID: any;
            username: any;
            email: any;
            firstName: any;
            lastName: any;
            role: any;
            department: any;
            groups: any;
        };
    }>;
}
