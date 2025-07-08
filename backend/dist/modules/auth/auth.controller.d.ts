import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import { RefreshTokenService } from './refresh-token.service';
import { SamlStrategy } from './saml.strategy';
import { LoginDto, RefreshTokenDto } from '../../common/schemas';
export declare class AuthController {
    private readonly userService;
    private readonly jwtService;
    private readonly refreshService;
    private readonly samlStrategy;
    constructor(userService: UserService, jwtService: JwtService, refreshService: RefreshTokenService, samlStrategy: SamlStrategy);
    login(body: LoginDto): Promise<{
        error: string;
        accessToken?: undefined;
        refreshToken?: undefined;
        user?: undefined;
    } | {
        accessToken: string;
        refreshToken: string;
        user: import("mongoose").Document<unknown, {}, import("..").UserDocument, {}> & import("..").UserDocument & Required<{
            _id: unknown;
        }> & {
            __v: number;
        };
        error?: undefined;
    }>;
    refreshToken(body: RefreshTokenDto): Promise<{
        error: string;
        accessToken?: undefined;
        refreshToken?: undefined;
    } | {
        accessToken: string;
        refreshToken: string;
        error?: undefined;
    }>;
    me(req: any): Promise<any>;
    logout(): Promise<{
        success: boolean;
    }>;
    samlLogin(): Promise<void>;
    samlLogout(req: any): Promise<void>;
    samlLogoutCallback(): Promise<{
        success: boolean;
    }>;
    samlCallback(req: any): Promise<{
        token: string;
        user: import("mongoose").Document<unknown, {}, import("..").UserDocument, {}> & import("..").UserDocument & Required<{
            _id: unknown;
        }> & {
            __v: number;
        };
    }>;
    metadata(res: any): Promise<void>;
}
