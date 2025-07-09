import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import { SamlStrategy } from './saml.strategy';
export declare class SamlController {
    private readonly userService;
    private readonly jwtService;
    private readonly samlStrategy;
    constructor(userService: UserService, jwtService: JwtService, samlStrategy: SamlStrategy);
    samlLogin(): Promise<void>;
    samlLogout(req: any): Promise<void>;
    samlLogoutCallback(): Promise<{
        success: boolean;
    }>;
    samlCallback(req: any, res: any): Promise<any>;
    metadata(res: any): Promise<void>;
}
