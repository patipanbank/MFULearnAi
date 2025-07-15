import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '../config/config.service';

export interface ChatMessage {
  sessionId: string;
  message: string;
  timestamp: Date;
  userId: string;
  username: string;
  type: 'user' | 'ai' | 'system';
}

@Injectable()
export class RedisPubSubService {
  private readonly logger = new Logger(RedisPubSubService.name);
  private subscriber: Redis;
  private publisher: Redis;
  private activeConnections: Map<string, Set<Socket>> = new Map();
  private socketServer: Server;
  private isListening = false;

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Use ConfigService instead of process.env directly
      const redisUrl = this.configService.get<string>('REDIS_URL') || 
                      `redis://${this.configService.redisHost}:${this.configService.redisPort}`;
      
      // Separate Redis instances for pub/sub (best practice)
      this.subscriber = new Redis(redisUrl);
      this.publisher = new Redis(redisUrl);

      this.logger.log('🔴 Redis PubSub Service initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Redis PubSub Service:', error);
    }
  }

  /**
   * Set Socket.IO server instance (called from WebSocketGateway)
   */
  setSocketServer(server: Server) {
    this.socketServer = server;
    if (!this.isListening) {
      this.startRedisListener();
    }
  }

  /**
   * Start Redis listener (equivalent to FastAPI WebSocketManager._redis_listener_worker)
   */
  private startRedisListener() {
    if (this.isListening) return;
    
    this.isListening = true;
    this.logger.log('🔍 Starting Redis listener for chat channels...');
    
    try {
      // Subscribe to all chat channels (like FastAPI psubscribe("chat:*"))
      this.subscriber.psubscribe('chat:*');
      this.logger.log('✅ Redis listener subscribed to chat:* channels');
      
      // Listen for pattern messages
      this.subscriber.on('pmessage', async (pattern, channel, message) => {
        try {
          const sessionId = channel.replace('chat:', '');
          this.logger.debug(`📨 Received Redis message for session ${sessionId}: ${message.substring(0, 100)}...`);
          
          // Broadcast to all WebSocket connections for this session
          await this.broadcastToSession(sessionId, message);
        } catch (error) {
          this.logger.error(`❌ Error processing Redis message: ${error.message}`);
        }
      });

      // Handle Redis connection events
      this.subscriber.on('error', (error) => {
        this.logger.error('❌ Redis subscriber error:', error);
      });

      this.subscriber.on('connect', () => {
        this.logger.log('✅ Redis subscriber connected');
      });

    } catch (error) {
      this.logger.error('❌ Redis listener error:', error);
      this.isListening = false;
    }
  }

  /**
   * Broadcast message to all WebSocket connections for a session 
   * (equivalent to FastAPI _broadcast_to_session)
   */
  private async broadcastToSession(sessionId: string, message: string): Promise<void> {
    if (!this.activeConnections.has(sessionId)) {
      this.logger.debug(`⚠️ No active connections for session ${sessionId}`);
      return;
    }

    const connections = this.activeConnections.get(sessionId);
    if (!connections || connections.size === 0) {
      return;
    }

    this.logger.debug(`📤 Broadcasting to ${connections.size} connections for session ${sessionId}`);
    
    const deadSockets: Socket[] = [];
    for (const socket of connections) {
      try {
        // Parse message to determine event type
        let parsedMessage;
        try {
          parsedMessage = JSON.parse(message);
        } catch {
          // If not JSON, treat as plain text chunk
          parsedMessage = { type: 'chunk', data: message };
        }

        // Send appropriate event based on message type
        switch (parsedMessage.type) {
          case 'chunk':
            socket.emit('stream-chunk', parsedMessage.data);
            break;
          case 'tool_start':
            socket.emit('tool-start', parsedMessage.data);
            break;
          case 'tool_result':
            socket.emit('tool-result', parsedMessage.data);
            break;
          case 'tool_error':
            socket.emit('tool-error', parsedMessage.data);
            break;
          case 'end':
            socket.emit('stream-end', parsedMessage.data);
            break;
          case 'error':
            socket.emit('stream-error', parsedMessage.data);
            break;
          default:
            socket.emit('message', parsedMessage);
        }

        this.logger.debug(`✅ Message sent to WebSocket for session ${sessionId}`);
      } catch (error) {
        this.logger.error(`❌ Failed to send to WebSocket: ${error.message}`);
        deadSockets.push(socket);
      }
    }

    // Cleanup dead connections
    for (const socket of deadSockets) {
      this.disconnect(sessionId, socket);
    }
  }

  /**
   * Connect WebSocket to session (equivalent to FastAPI ws_manager.connect)
   */
  async connect(sessionId: string, socket: Socket): Promise<void> {
    if (!this.activeConnections.has(sessionId)) {
      this.activeConnections.set(sessionId, new Set());
    }
    
    this.activeConnections.get(sessionId)!.add(socket);
    
    const connectionCount = this.activeConnections.get(sessionId)!.size;
    this.logger.log(`🔌 WebSocket connected to session ${sessionId}, total connections: ${connectionCount}`);

    // Join Socket.IO room for this session
    socket.join(`session:${sessionId}`);
  }

  /**
   * Disconnect WebSocket from session (equivalent to FastAPI ws_manager.disconnect)
   */
  disconnect(sessionId: string, socket: Socket): void {
    if (this.activeConnections.has(sessionId)) {
      this.activeConnections.get(sessionId)!.delete(socket);
      
      // Remove session if no connections left
      if (this.activeConnections.get(sessionId)!.size === 0) {
        this.activeConnections.delete(sessionId);
      }
      
      this.logger.log(`🔌 WebSocket disconnected from session ${sessionId}`);
    }

    // Leave Socket.IO room
    socket.leave(`session:${sessionId}`);
  }

  /**
   * Publish message to Redis channel (for background tasks to use)
   */
  async publishChatMessage(sessionId: string, message: any): Promise<void> {
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      await this.publisher.publish(`chat:${sessionId}`, messageStr);
      this.logger.debug(`📤 Published message to Redis: chat:${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Redis publish error: ${error.message}`);
    }
  }

  /**
   * Broadcast to specific user (equivalent to FastAPI broadcastToUser)
   */
  async broadcastToUser(userId: string, event: string, data: any): Promise<void> {
    if (this.socketServer) {
      this.socketServer.to(`user:${userId}`).emit(event, data);
      this.logger.debug(`📢 Broadcasted ${event} to user ${userId}`);
    }
  }

  /**
   * Broadcast to specific room (equivalent to FastAPI broadcastToRoom)
   */
  async broadcastToRoom(room: string, event: string, data: any): Promise<void> {
    if (this.socketServer) {
      this.socketServer.to(room).emit(event, data);
      this.logger.debug(`📢 Broadcasted ${event} to room ${room}`);
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    let totalConnections = 0;
    for (const connections of this.activeConnections.values()) {
      totalConnections += connections.size;
    }

    return {
      activeSessions: this.activeConnections.size,
      totalConnections,
      sessions: Array.from(this.activeConnections.keys()),
    };
  }

  /**
   * Cleanup resources
   */
  async onDestroy() {
    this.isListening = false;
    await this.subscriber?.disconnect();
    await this.publisher?.disconnect();
    this.activeConnections.clear();
    this.logger.log('🔴 Redis PubSub Service destroyed');
  }
} 