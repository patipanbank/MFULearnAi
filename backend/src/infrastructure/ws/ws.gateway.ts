import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UsePipes, Inject } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { StreamingService } from '../../services/streaming.service';
import { ChromaService } from '../../services/chroma.service';
import { UserService } from '../../modules/users/user.service';
import { WsAuthMiddleware } from '../../modules/auth/ws-auth.middleware';
import { JwtWsGuard } from '../../modules/auth/jwt-ws.guard';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { 
  joinRoomSchema, 
  leaveRoomSchema, 
  typingStartSchema, 
  typingStopSchema, 
  wsMessageSchema,
  wsStreamSubscribeSchema,
  wsStreamUnsubscribeSchema,
  JoinRoomDto,
  LeaveRoomDto,
  TypingStartDto,
  TypingStopDto,
  WsMessageDto,
  WsStreamSubscribeDto,
  WsStreamUnsubscribeDto,
  StreamEvent
} from '../../common/schemas';

interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system';
}

interface JoinRoomData {
  chatId: string;
}

interface SendMessageData {
  chatId: string;
  content: string;
  type?: 'user' | 'system';
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  },
  transports: ['websocket', 'polling']
})
export class WsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);
  private connectedUsers = new Map<string, string>(); // socketId -> userId
  private streamingSessions = new Map<string, Set<string>>(); // sessionId -> Set of socketIds

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly wsAuthMiddleware: WsAuthMiddleware,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🚀 WebSocket Gateway initialized');
    
    // Apply authentication middleware
    server.use(this.wsAuthMiddleware.createMiddleware());
    
    // Subscribe to Redis patterns for chat channels
    this.redis.psubscribe('chat:*', (err) => {
      if (err) {
        this.logger.error(`Redis psubscribe error: ${err}`);
      } else {
        this.logger.log('📡 Subscribed to Redis chat channels');
      }
    });

    // Handle Redis messages
    this.redis.on('pmessage', (pattern: string, channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        this.server.to(channel).emit('stream', data);
        this.logger.debug(`📤 Forwarded message to channel: ${channel}`);
      } catch (error) {
        this.logger.error(`Failed to parse Redis message: ${error}`);
      }
    });
  }

  async handleConnection(client: Socket) {
    const userId = client.data.userId;
    const username = client.data.username;
    
    if (!userId || !username) {
      this.logger.error('❌ Connection rejected: Missing user data');
      client.disconnect(true);
      return;
    }

    // Track connected user
    this.connectedUsers.set(client.id, userId);
    
    // Join user to their personal room
    await client.join(`user:${userId}`);
    
    this.logger.log(`✅ User connected: ${username} (${userId}) - Socket: ${client.id}`);
    
    // Emit connection success
    client.emit('connected', {
      status: 'connected',
      userId,
      username,
      message: 'Successfully connected to WebSocket'
    });
  }

  async handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    const username = client.data.username || 'Unknown';
    
    if (userId) {
      this.connectedUsers.delete(client.id);
      this.logger.log(`❌ User disconnected: ${username} (${userId}) - Socket: ${client.id}`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
    this.logger.debug(`🏓 Ping received from ${client.data.username}: ${data}`);
    return { event: 'pong', data: `Pong: ${data}` };
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('create_room')
  async handleCreateRoom(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    try {
      const { agent_id, text, images } = data;
      const userId = client.data.userId;
      const username = client.data.username;

      // Generate a new chat ID (MongoDB ObjectId format)
      const chatId = `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
      
      this.logger.log(`🆕 Creating new room: ${chatId} for user ${username} with agent ${agent_id}`);
      
      // Join the new room
      await client.join(`chat:${chatId}`);
      
      // Emit room created event
      client.emit('room_created', {
        chatId,
        agentId: agent_id,
        userId,
        username,
        message: `Successfully created chat room: ${chatId}`,
        timestamp: new Date()
      });

      // If there's an initial message, handle it
      if (text) {
        // Create initial message
        const initialMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          chatId,
          userId,
          username,
          content: text,
          timestamp: new Date(),
          type: 'user' as const,
          images: images || []
        };

        // Emit the initial message to the room
        this.server.to(`chat:${chatId}`).emit('message', initialMessage);
        
        this.logger.log(`📨 Initial message sent to room ${chatId}: ${text.substring(0, 50)}...`);
      }

    } catch (error) {
      this.logger.error(`Failed to create room: ${error}`);
      client.emit('error', { message: 'Failed to create chat room' });
    }
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('join_room')
  @UsePipes(new ZodValidationPipe(joinRoomSchema))
  async handleJoinRoom(@MessageBody() data: JoinRoomDto, @ConnectedSocket() client: Socket) {
    try {
      const { chatId } = data;
      const userId = client.data.userId;
      const username = client.data.username;

      if (!chatId) {
        client.emit('error', { message: 'Chat ID is required' });
        return;
      }

      // Join the chat room
      await client.join(`chat:${chatId}`);
      
      this.logger.log(`🔗 User ${username} joined chat room: ${chatId}`);
      
      // Emit success response
      client.emit('room_joined', {
        chatId,
        message: `Successfully joined chat: ${chatId}`
      });

      // Notify others in the room (optional)
      client.to(`chat:${chatId}`).emit('user-joined', {
        userId,
        username,
        chatId,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error(`Failed to join room: ${error}`);
      client.emit('error', { message: 'Failed to join chat room' });
    }
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('leave_room')
  @UsePipes(new ZodValidationPipe(leaveRoomSchema))
  async handleLeaveRoom(@MessageBody() data: LeaveRoomDto, @ConnectedSocket() client: Socket) {
    try {
      const { chatId } = data;
      const userId = client.data.userId;
      const username = client.data.username;

      if (!chatId) {
        client.emit('error', { message: 'Chat ID is required' });
        return;
      }

      // Leave the chat room
      await client.leave(`chat:${chatId}`);
      
      this.logger.log(`❌ User ${username} left chat room: ${chatId}`);
      
      // Emit success response
      client.emit('left-room', {
        chatId,
        message: `Successfully left chat: ${chatId}`
      });

      // Notify others in the room (optional)
      client.to(`chat:${chatId}`).emit('user-left', {
        userId,
        username,
        chatId,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error(`Failed to leave room: ${error}`);
      client.emit('error', { message: 'Failed to leave chat room' });
    }
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('message')
  @UsePipes(new ZodValidationPipe(wsMessageSchema))
  async handleSendMessage(@MessageBody() data: WsMessageDto, @ConnectedSocket() client: Socket) {
    try {
      const { chatId, content, type = 'user' } = data;
      const userId = client.data.userId;
      const username = client.data.username;

      if (!chatId || !content) {
        client.emit('error', { message: 'Chat ID and content are required' });
        return;
      }

      // Create message object
      const message: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chatId,
        userId,
        username,
        content,
        timestamp: new Date(),
        type
      };

      // Emit message to all users in the chat room
      this.server.to(`chat:${chatId}`).emit('message', message);
      
      this.logger.log(`📨 Message sent to chat ${chatId} by ${username}: ${content.substring(0, 50)}...`);

      // Acknowledge message sent
      client.emit('message-sent', {
        messageId: message.id,
        chatId,
        timestamp: message.timestamp
      });

    } catch (error) {
      this.logger.error(`Failed to send message: ${error}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('typing_start')
  @UsePipes(new ZodValidationPipe(typingStartSchema))
  async handleTypingStart(@MessageBody() data: TypingStartDto, @ConnectedSocket() client: Socket) {
    const { chatId } = data;
    const userId = client.data.userId;
    const username = client.data.username;

    if (!chatId) return;

    // Notify others in the room that user is typing
    client.to(`chat:${chatId}`).emit('user-typing', {
      userId,
      username,
      chatId,
      isTyping: true
    });
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('typing_stop')
  @UsePipes(new ZodValidationPipe(typingStopSchema))
  async handleTypingStop(@MessageBody() data: TypingStopDto, @ConnectedSocket() client: Socket) {
    const { chatId } = data;
    const userId = client.data.userId;
    const username = client.data.username;

    if (!chatId) return;

    // Notify others in the room that user stopped typing
    client.to(`chat:${chatId}`).emit('user-typing', {
      userId,
      username,
      chatId,
      isTyping: false
    });
  }

  // Utility method to broadcast to specific user
  async broadcastToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Utility method to broadcast to specific chat
  async broadcastToChat(chatId: string, event: string, data: any) {
    this.server.to(`chat:${chatId}`).emit(event, data);
  }

  // Get online users count
  getOnlineUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get online users in specific chat
  async getOnlineUsersInChat(chatId: string): Promise<string[]> {
    const room = this.server.sockets.adapter.rooms.get(`chat:${chatId}`);
    if (!room) return [];

    const userIds: string[] = [];
    for (const socketId of room) {
      const userId = this.connectedUsers.get(socketId);
      if (userId) userIds.push(userId);
    }
    return userIds;
  }

  // Streaming event handlers
  @UseGuards(JwtWsGuard)
  @SubscribeMessage('subscribe_stream')
  @UsePipes(new ZodValidationPipe(wsStreamSubscribeSchema))
  async handleSubscribeStream(@MessageBody() data: WsStreamSubscribeDto, @ConnectedSocket() client: Socket) {
    try {
      const { sessionId, executionId } = data;
      const userId = client.data.userId;
      const username = client.data.username;

      // Add client to streaming session
      if (!this.streamingSessions.has(sessionId)) {
        this.streamingSessions.set(sessionId, new Set());
      }
      this.streamingSessions.get(sessionId)!.add(client.id);

      // Join streaming room
      await client.join(`stream:${sessionId}`);
      
      this.logger.log(`📡 User ${username} subscribed to stream: ${sessionId}`);
      
      // Emit success response
      client.emit('stream-subscribed', {
        sessionId,
        executionId,
        message: `Successfully subscribed to stream: ${sessionId}`
      });

    } catch (error) {
      this.logger.error(`Failed to subscribe to stream: ${error}`);
      client.emit('error', { message: 'Failed to subscribe to stream' });
    }
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('unsubscribe_stream')
  @UsePipes(new ZodValidationPipe(wsStreamUnsubscribeSchema))
  async handleUnsubscribeStream(@MessageBody() data: WsStreamUnsubscribeDto, @ConnectedSocket() client: Socket) {
    try {
      const { sessionId, executionId } = data;
      const userId = client.data.userId;
      const username = client.data.username;

      // Remove client from streaming session
      if (this.streamingSessions.has(sessionId)) {
        this.streamingSessions.get(sessionId)!.delete(client.id);
        if (this.streamingSessions.get(sessionId)!.size === 0) {
          this.streamingSessions.delete(sessionId);
        }
      }

      // Leave streaming room
      await client.leave(`stream:${sessionId}`);
      
      this.logger.log(`❌ User ${username} unsubscribed from stream: ${sessionId}`);
      
      // Emit success response
      client.emit('stream-unsubscribed', {
        sessionId,
        executionId,
        message: `Successfully unsubscribed from stream: ${sessionId}`
      });

    } catch (error) {
      this.logger.error(`Failed to unsubscribe from stream: ${error}`);
      client.emit('error', { message: 'Failed to unsubscribe from stream' });
    }
  }

  // Event listener for streaming events
  @OnEvent('stream.event')
  handleStreamEvent(payload: { sessionId: string; event: StreamEvent }) {
    const { sessionId, event } = payload;
    
    // Emit to all clients subscribed to this stream
    this.server.to(`stream:${sessionId}`).emit('stream-event', event);
    
    this.logger.debug(`📤 Stream event emitted for session: ${sessionId}, type: ${event.type}`);
  }

  // Specific event handlers for different stream events
  @OnEvent('stream.stream_start')
  handleStreamStart(payload: { sessionId: string; event: StreamEvent }) {
    const { sessionId, event } = payload;
    this.server.to(`stream:${sessionId}`).emit('stream-start', event);
    this.logger.debug(`🚀 Stream start event for session: ${sessionId}`);
  }

  @OnEvent('stream.stream_chunk')
  handleStreamChunk(payload: { sessionId: string; event: StreamEvent }) {
    const { sessionId, event } = payload;
    this.server.to(`stream:${sessionId}`).emit('stream-chunk', event);
  }

  @OnEvent('stream.stream_tool_call')
  handleStreamToolCall(payload: { sessionId: string; event: StreamEvent }) {
    const { sessionId, event } = payload;
    this.server.to(`stream:${sessionId}`).emit('stream-tool-call', event);
    this.logger.debug(`🔧 Stream tool call event for session: ${sessionId}`);
  }

  @OnEvent('stream.stream_tool_result')
  handleStreamToolResult(payload: { sessionId: string; event: StreamEvent }) {
    const { sessionId, event } = payload;
    this.server.to(`stream:${sessionId}`).emit('stream-tool-result', event);
    this.logger.debug(`⚙️ Stream tool result event for session: ${sessionId}`);
  }

  @OnEvent('stream.stream_complete')
  handleStreamComplete(payload: { sessionId: string; event: StreamEvent }) {
    const { sessionId, event } = payload;
    this.server.to(`stream:${sessionId}`).emit('stream-complete', event);
    this.logger.log(`✅ Stream complete event for session: ${sessionId}`);
    
    // Clean up streaming session
    setTimeout(() => {
      if (this.streamingSessions.has(sessionId)) {
        this.streamingSessions.delete(sessionId);
      }
    }, 5000);
  }

  @OnEvent('stream.stream_error')
  handleStreamError(payload: { sessionId: string; event: StreamEvent }) {
    const { sessionId, event } = payload;
    this.server.to(`stream:${sessionId}`).emit('stream-error', event);
    this.logger.error(`❌ Stream error event for session: ${sessionId}`);
    
    // Clean up streaming session immediately
    if (this.streamingSessions.has(sessionId)) {
      this.streamingSessions.delete(sessionId);
    }
  }

  // Utility method to get streaming session info
  getStreamingSessionInfo(sessionId: string): { subscriberCount: number; socketIds: string[] } {
    const subscribers = this.streamingSessions.get(sessionId);
    return {
      subscriberCount: subscribers?.size || 0,
      socketIds: subscribers ? Array.from(subscribers) : [],
    };
  }
} 