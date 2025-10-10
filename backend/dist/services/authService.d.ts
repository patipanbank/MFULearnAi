import { IUser } from '../models/user';
declare class AuthService {
    handleSamlLogin(samlProfile: any): Promise<{
        token: string;
        user: IUser;
    }>;
    handleAdminLogin(username: string, password: string): Promise<{
        token: string;
        user: IUser;
    }>;
    refreshToken(currentUser: any): string;
    formatUserResponse(user: any): {
        _id: {
            $oid: any;
        };
        nameID: any;
        username: any;
        email: any;
        firstName: any;
        lastName: any;
        department: any;
        role: any;
        groups: any;
        tokenQuota: any;
        dailyTokenLimit: any;
        created: any;
        updated: any;
    };
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=authService.d.ts.map