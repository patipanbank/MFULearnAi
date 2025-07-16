import { Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from '../auth.service';
import { ConfigService } from '../../config/config.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private authService;
    private configService;
    constructor(authService: AuthService, configService: ConfigService);
    validate(payload: JwtPayload): Promise<any>;
}
export {};
