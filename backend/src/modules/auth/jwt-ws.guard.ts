import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UserService } from '../users/user.service';

@Injectable()
export class JwtWsGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      
      // Extract token from query params or auth object
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        return false;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Get user from database
      const user = await this.userService.findByUsername(payload.username);
      if (!user) {
        return false;
      }

      // Attach user to socket
      client.data.user = user;
      client.data.userId = user.id;
      
      return true;
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      return false;
    }
  }
} 