import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UserService } from '../users/user.service';

export type SocketMiddleware = (socket: Socket, next: (err?: Error) => void) => void;

@Injectable()
export class WsAuthMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  createMiddleware(): SocketMiddleware {
    return async (socket: Socket, next: (err?: Error) => void) => {
      try {
        // Extract token from query params or auth object
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        
        if (!token) {
          throw new Error('Authentication token is missing');
        }

        // Verify JWT token
        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
        });

        if (!payload || !payload.sub) {
          throw new Error('Invalid token payload');
        }

        // Get user from database
        const user = await this.userService.findByUsername(payload.username);
        if (!user) {
          throw new Error('User not found');
        }

        // Attach user to socket
        socket.data.user = user;
        socket.data.userId = user.id;
        socket.data.username = user.username;

        console.log(`✅ WebSocket authenticated for user: ${user.username} (${user.id})`);
        next();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ WebSocket authentication failed:`, errorMessage);
        next(new Error('Authentication failed'));
      }
    };
  }
} 