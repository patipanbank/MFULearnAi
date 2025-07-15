import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { Socket } from 'socket.io';

interface ConnectedUser {
  id: string;
  username: string;
  role: string;
  department: string;
  socket: Socket;
  lastSeen: Date;
}

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);
  private connectedUsers = new Map<string, ConnectedUser>();
  private userSockets = new Map<string, Socket[]>();

  constructor(private readonly redisService: RedisService) {}

  async handleConnection(client: Socket, userId: string, userInfo: any) {
    try {
      const user: ConnectedUser = {
        id: userId,
        username: userInfo.username,
        role: userInfo.role,
        department: userInfo.department,
        socket: client,
        lastSeen: new Date(),
      };

      this.connectedUsers.set(client.id, user);
      
      // Track multiple sockets per user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId)!.push(client);

      // Store user session in Redis
      await this.redisService.set(
        `user_session:${userId}`,
        JSON.stringify({
          socketId: client.id,
          username: userInfo.username,
          role: userInfo.role,
          department: userInfo.department,
          connectedAt: new Date(),
        }),
        3600 // 1 hour
      );

      // Broadcast user online status
      await this.broadcastUserStatus(userId, 'online');

      this.logger.log(`User ${userInfo.username} connected: ${client.id}`);
    } catch (error) {
      this.logger.error(`Error handling connection: ${error.message}`);
    }
  }

  async handleDisconnection(client: Socket) {
    try {
      const user = this.connectedUsers.get(client.id);
      if (user) {
        // Remove from connected users
        this.connectedUsers.delete(client.id);

        // Remove socket from user's socket array
        const userSockets = this.userSockets.get(user.id);
        if (userSockets) {
          const index = userSockets.indexOf(client);
          if (index > -1) {
            userSockets.splice(index, 1);
          }
          
          // If no more sockets, remove user completely
          if (userSockets.length === 0) {
            this.userSockets.delete(user.id);
            await this.redisService.del(`user_session:${user.id}`);
            await this.broadcastUserStatus(user.id, 'offline');
          }
        }

        this.logger.log(`User ${user.username} disconnected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`Error handling disconnection: ${error.message}`);
    }
  }

  async sendToUser(userId: string, event: string, data: any) {
    try {
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.forEach(socket => {
          socket.emit(event, data);
        });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error sending message to user ${userId}: ${error.message}`);
      return false;
    }
  }

  async broadcastToRoom(room: string, event: string, data: any) {
    try {
      for (const [socketId, user] of this.connectedUsers.entries()) {
        if (user.socket.rooms.has(room)) {
          user.socket.emit(event, data);
        }
      }
    } catch (error) {
      this.logger.error(`Error broadcasting to room ${room}: ${error.message}`);
    }
  }

  async broadcastUserStatus(userId: string, status: 'online' | 'offline') {
    try {
      const message = {
        type: 'user_status',
        userId,
        status,
        timestamp: new Date(),
      };

      // Broadcast to all connected users
      for (const [socketId, user] of this.connectedUsers.entries()) {
        user.socket.emit('user_status', message);
      }

      // Store in Redis for persistence
      await this.redisService.publish('user_status', JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Error broadcasting user status: ${error.message}`);
    }
  }

  getConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values());
  }

  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.length || 0;
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  async joinRoom(client: Socket, room: string) {
    try {
      await client.join(room);
      this.logger.log(`Socket ${client.id} joined room: ${room}`);
    } catch (error) {
      this.logger.error(`Error joining room ${room}: ${error.message}`);
    }
  }

  async leaveRoom(client: Socket, room: string) {
    try {
      await client.leave(room);
      this.logger.log(`Socket ${client.id} left room: ${room}`);
    } catch (error) {
      this.logger.error(`Error leaving room ${room}: ${error.message}`);
    }
  }
} 