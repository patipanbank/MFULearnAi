import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
export declare class JwtWsGuard implements CanActivate {
    private readonly jwtService;
    private readonly userService;
    constructor(jwtService: JwtService, userService: UserService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
