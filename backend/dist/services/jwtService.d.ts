import { IUser } from '../models/user';
export interface JwtPayload {
    sub: string;
    nameID?: string;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    groups?: string[];
    role: string;
    exp: number;
}
declare class JwtService {
    createSamlToken(user: IUser): string;
    createAdminToken(user: IUser): string;
    refreshToken(currentPayload: any): string;
    verifyToken(token: string): JwtPayload;
}
export declare const jwtService: JwtService;
export {};
//# sourceMappingURL=jwtService.d.ts.map