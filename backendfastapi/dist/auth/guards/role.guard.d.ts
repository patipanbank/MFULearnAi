import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../models/user.model';
export declare const Roles: import("@nestjs/core").ReflectableDecorator<UserRole[], UserRole[]>;
export declare class RoleGuard implements CanActivate {
    private reflector;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
}
export declare const RequireRoles: (...roles: UserRole[]) => import("@nestjs/common").CustomDecorator;
