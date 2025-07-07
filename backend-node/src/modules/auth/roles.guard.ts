import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      // No roles required for this route
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !Array.isArray(user.roles)) {
      return false;
    }
    return requiredRoles.some((role: string) => user.roles.includes(role));
  }
} 