import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import { RefreshTokenService } from './refresh-token.service';
import { LoginDto, RefreshTokenDto } from '../../common/schemas';
export declare class AuthController {
    private readonly userService;
    private readonly jwtService;
    private readonly refreshService;
    constructor(userService: UserService, jwtService: JwtService, refreshService: RefreshTokenService);
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
}
