import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { WebSocketService } from './websocket.service';
import { ChatService } from '../chat/chat.service';
import { ChatHistoryService } from '../chat/chat-history.service';
import { AgentService } from '../agent/agent.service';
import { TaskQueueService } from '../tasks/task-queue.service';
import { RedisPubSubService } from '../redis/redis-pubsub.service';
import { Logger } from '@nestjs/common';

interface ChatMessage {
  type: string;
  data: any;
}

interface JoinRoomMessage {
  type: 'join_room';
  chatId: string;
}

interface CreateRoomMessage {
  type: 'create_room';
  agent_id?: string;
  agentId?: string;
  model_id?: string;
  modelId?: string;
  collection_names?: string[];
  collectionNames?: string[];
  system_prompt?: string;
  systemPrompt?: string;
  temperature?: number;
  max_tokens?: number;
  maxTokens?: number;
}

interface SendMessageMessage {
  type: 'send_message';
  message: string;
  images?: any[];
}

@NestWebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/ws',
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('WebSocketGateway');

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private webSocketService: WebSocketService,
    private chatService: ChatService,
    private chatHistoryService: ChatHistoryService,
    private agentService: AgentService,
    private taskQueueService: TaskQueueService,
    private redisPubSubService: RedisPubSubService,
  ) {
    this.logger.log('WebSocketGateway constructed');
  }

  afterInit(server: Server) {
    // Initialize Redis PubSub service with Socket.IO server
    this.redisPubSubService.setSocketServer(server);
    this.logger.log('🔌 WebSocket Gateway initialized with Redis PubSub service (afterInit)');
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`🌐 WebSocket connection attempt from: ${client.id}`);
      let token: string | undefined = undefined;
      if (client.handshake.auth && client.handshake.auth.token) {
        token = client.handshake.auth.token as string;
      } else if (client.handshake.query && typeof client.handshake.query.token === 'string') {
        token = client.handshake.query.token;
      }
      this.logger.log(`🎫 Token received: ${token ? token.substring(0, 50) + '...' : 'None'}`);
      if (!token) {
        this.logger.warn('❌ No token provided in auth object');
        client.emit('error', { type: 'error', data: 'No token provided' });
        client.disconnect(true);
        return;
      }
      try {
        const payload = this.jwtService.verify(token);
        const userId = payload.sub;
        if (!userId) {
          this.logger.warn('❌ No user_id in token payload');
          client.emit('error', { type: 'error', data: 'No user_id in token payload' });
          client.disconnect(true);
          return;
        }
        client.data.userId = userId;
        client.data.userInfo = {
          id: userId,
          username: payload.username,
          role: payload.role,
          department: payload.department,
        };
        await this.webSocketService.handleConnection(client, userId, client.data.userInfo);
        this.logger.log(`✅ WebSocket authenticated for user: ${userId}`);
        client.emit('connected', { type: 'connected', data: { userId, message: 'WebSocket connected successfully' } });
      } catch (error) {
        this.logger.error(`❌ JWT validation error: ${error.message}`);
        client.emit('error', { type: 'error', data: `JWT validation error: ${error.message}` });
        client.disconnect(true);
        return;
      }
    } catch (error) {
      this.logger.error(`❌ Connection error: ${error.message}`);
      client.emit('error', { type: 'error', data: `Connection error: ${error.message}` });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      await this.webSocketService.handleDisconnection(client);
      this.logger.log(`🔌 Disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error(`❌ Disconnection error: ${error.message}`);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomMessage,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      this.logger.log(`[WS] join_room: userId=${userId}, data=${JSON.stringify(data)}`);
      const { chatId } = data;
      this.logger.log(`🔗 User ${userId} attempting to join room: ${chatId}`);

      // Validate chatId format (24-char hex string)
      if (!chatId || typeof chatId !== 'string' || chatId.length !== 24 || !/^[a-fA-F0-9]{24}$/.test(chatId)) {
        client.emit('error', { 
          type: 'error', 
          data: 'Invalid chatId for join_room' 
        });
        return;
      }

      // Check if chat exists
      const chat = await this.chatHistoryService.getChatById(chatId);
      if (!chat) {
        client.emit('error', { 
          type: 'error', 
          data: 'Chat not found' 
        });
        return;
      }

      // Check if user is authorized (owner of chat)
      if (chat.userId.toString() !== userId) {
        client.emit('error', { 
          type: 'error', 
          data: 'Not authorized to access this chat' 
        });
        return;
      }

      // Join the room (Socket.IO)
      await client.join(chatId);
      await this.webSocketService.joinRoom(client, chatId);

      // Connect to Redis PubSub for this session
      await this.redisPubSubService.connect(chatId, client);

      // Send confirmation
      client.emit('room_joined', { 
        type: 'room_joined', 
        data: { chatId } 
      });

      this.logger.log(`✅ User ${userId} joined room: ${chatId}`);

    } catch (error) {
      this.logger.error(`❌ Join room error: ${error.message}`);
      client.emit('error', { 
        type: 'error', 
        data: `Failed to join room: ${error.message}` 
      });
    }
  }

  @SubscribeMessage('create_room')
  async handleCreateRoom(
    @MessageBody() data: CreateRoomMessage,
    @ConnectedSocket() client: Socket,
  ) {
    // เพิ่ม log สำหรับ debug
    this.logger.log(`[WS] handleCreateRoom: userId=${client.data.userId}, data=${JSON.stringify(data)}`);
    try {
      const userId = client.data.userId;
      this.logger.log(`[WS] create_room: userId=${userId}, data=${JSON.stringify(data)}`);
      const agentId = data.agent_id || data.agentId;
      const modelId = data.model_id || data.modelId;
      const collectionNames = data.collection_names || data.collectionNames || [];
      const systemPrompt = data.system_prompt || data.systemPrompt;
      const temperature = typeof data.temperature === 'number' ? data.temperature : 0.7;
      const maxTokens = typeof data.max_tokens === 'number' ? data.max_tokens : (typeof data.maxTokens === 'number' ? data.maxTokens : 4000);
      // Validate agent exists if provided
      if (agentId) {
        let agent: any = null;
        try {
          agent = await this.agentService.getAgentById(agentId, userId);
        } catch (err) {
          this.logger.error(`[WS] create_room: Error fetching agent: ${err.message}`);
          client.emit('error', { type: 'error', data: `Error fetching agent: ${err.message}` });
          return;
        }
        if (!agent) {
          this.logger.warn(`[WS] create_room: Agent not found or access denied (agentId=${agentId}, userId=${userId})`);
          client.emit('error', { type: 'error', data: `Agent not found or access denied (agentId=${agentId}, userId=${userId})` });
          return;
        }
      }
      // Create new chat (support all fields)
      let chat: any = null;
      try {
        const chatName = agentId ? `Chat with ${agentId}` : 'New Chat';
        chat = await this.chatHistoryService.createChat(
          userId,
          chatName,
          agentId,
          modelId,
          collectionNames,
          systemPrompt,
          temperature,
          maxTokens
        );
      } catch (err) {
        this.logger.error(`[WS] create_room: Error creating chat: ${err.message}`);
        client.emit('error', { type: 'error', data: `Error creating chat: ${err.message}` });
        return;
      }
      // Join the room
      const chatId = chat.id;
      if (!chatId) {
        this.logger.error(`[WS] create_room: Chat ID not found after createChat (userId=${userId}, agentId=${agentId})`);
        client.emit('error', { type: 'error', data: `Failed to create chat: Chat ID not found (userId=${userId}, agentId=${agentId})` });
        return;
      }
      try {
        await client.join(chatId);
        await this.webSocketService.joinRoom(client, chatId);
        await this.redisPubSubService.connect(chatId, client);
      } catch (err) {
        this.logger.error(`[WS] create_room: Error joining room: ${err.message}`);
        client.emit('error', { type: 'error', data: `Error joining room: ${err.message}` });
        return;
      }
      client.emit('room_created', { 
        type: 'room_created', 
        data: { 
          chatId: chatId,
          chatName: chat.name || chat.title,
          agentId,
          modelId,
          collectionNames,
          systemPrompt,
          temperature,
          maxTokens,
        } 
      });
      this.logger.log(`[WS] Room created: chatId=${chatId} for userId=${userId}`);
    } catch (error) {
      this.logger.error(`[WS] handleCreateRoom: error=${error.message}, data=${JSON.stringify(data)}`);
      client.emit('error', {
        type: 'error',
        data: `Failed to create room: ${error.message}`,
      });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: SendMessageMessage,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      this.logger.log(`[WS] send_message: userId=${userId}, data=${JSON.stringify(data)}`);
      const { message, images } = data;

      // Get chat ID from room
      const rooms = Array.from(client.rooms);
      const chatId = rooms.find(room => room !== client.id);

      if (!chatId) {
        client.emit('error', { 
          type: 'error', 
          data: 'Not in a chat room' 
        });
        return;
      }

      // ตรวจสอบ chat และสิทธิ์
      const chat = await this.chatHistoryService.getChatById(chatId);
      if (!chat) {
        client.emit('error', { 
          type: 'error', 
          data: 'Chat not found' 
        });
        return;
      }
      if (chat.userId.toString() !== userId) {
        client.emit('error', { 
          type: 'error', 
          data: 'Not authorized to send message in this chat' 
        });
        return;
      }

      this.logger.log(`💬 User ${userId} sending message in chat: ${chatId}`);

      // Add user message to chat
      const userMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'user' as const,
        content: message,
        timestamp: new Date(),
        isStreaming: false,
        isComplete: true,
        metadata: { images },
      };

      await this.chatHistoryService.addMessageToChat(chatId, userMessage);

      // Send user message confirmation
      client.emit('message_sent', { 
        type: 'message_sent', 
        data: { messageId: userMessage.id, content: message } 
      });

      // Prepare AI response request (ใช้ค่าจาก chat context จริง)
      const aiRequest = {
        sessionId: chatId,
        userId,
        message,
        modelId: chat.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        collectionNames: chat.collectionNames || [],
        agentId: chat.agentId ? chat.agentId.toString() : undefined,
        systemPrompt: chat.systemPrompt,
        temperature: typeof chat.temperature === 'number' ? chat.temperature : 0.7,
        maxTokens: typeof chat.maxTokens === 'number' ? chat.maxTokens : 4000,
        images: images || [],
      };

      // Send to background task queue (like FastAPI Celery)
      await this.taskQueueService.addChatTask('generate_response', aiRequest);

      this.logger.log(`✅ Message queued for AI processing in chat: ${chatId}`);

    } catch (error) {
      this.logger.error(`❌ Send message error: ${error.message}`);
      client.emit('error', { 
        type: 'error', 
        data: `Failed to send message: ${error.message}` 
      });
    }
  }

  // เพิ่ม handler สำหรับ event 'message' (type: 'message') ที่ frontend ใช้
  @SubscribeMessage('message')
  async handleMessageEvent(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    // เพิ่ม log สำหรับ debug
    this.logger.log(`[WS] handleMessageEvent: userId=${client.data.userId}, data=${JSON.stringify(data)}`);
    // รองรับ payload: { type: 'message', text, images, chatId, agent_id }
    try {
      const userId = client.data.userId;
      const chatId = typeof data.chatId === 'string' ? data.chatId : undefined;
      const message = data.text;
      const images = Array.isArray(data.images) ? data.images : [];
      const agentId = typeof data.agent_id === 'string' ? data.agent_id : (typeof data.agentId === 'string' ? data.agentId : undefined);

      // ถ้าไม่มี chatId ให้ตอบ error
      if (!chatId) {
        this.logger.warn(`[WS] handleMessageEvent: missing chatId, data=${JSON.stringify(data)}`);
        client.emit('error', {
          type: 'error',
          data: 'chatId is required for sending message',
        });
        return;
      }

      // ตรวจสอบ chat และสิทธิ์
      const chat = await this.chatHistoryService.getChatById(chatId);
      if (!chat) {
        this.logger.warn(`[WS] handleMessageEvent: chat not found, chatId=${chatId}`);
        client.emit('error', {
          type: 'error',
          data: 'Chat not found',
        });
        return;
      }
      if (chat.userId.toString() !== userId) {
        this.logger.warn(`[WS] handleMessageEvent: not authorized, chatId=${chatId}, userId=${userId}`);
        client.emit('error', {
          type: 'error',
          data: 'Not authorized to send message in this chat',
        });
        return;
      }

      // Add user message to chat
      const userMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'user' as const,
        content: message,
        timestamp: new Date(),
        isStreaming: false,
        isComplete: true,
        metadata: { images },
      };
      await this.chatHistoryService.addMessageToChat(chatId, userMessage);

      // ตอบกลับว่า message ถูก accepted
      client.emit('accepted', {
        type: 'accepted',
        data: { messageId: userMessage.id, content: message },
      });

      // Prepare AI response request
      const aiRequest = {
        sessionId: chatId,
        userId,
        message,
        modelId: typeof chat.modelId === 'string' ? chat.modelId : 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        collectionNames: Array.isArray(chat.collectionNames) ? chat.collectionNames : [],
        agentId: typeof chat.agentId === 'string' ? chat.agentId : agentId,
        systemPrompt: chat.systemPrompt,
        temperature: typeof chat.temperature === 'number' ? chat.temperature : 0.7,
        maxTokens: typeof chat.maxTokens === 'number' ? chat.maxTokens : 4000,
        images: images,
      };
      await this.taskQueueService.addChatTask('generate_response', aiRequest);
      // (ใน production อาจต้อง stream chunk กลับ client ด้วย)
    } catch (error) {
      this.logger.error(`[WS] handleMessageEvent: error=${error.message}, data=${JSON.stringify(data)}`);
      client.emit('error', {
        type: 'error',
        data: `Failed to send message: ${error.message}`,
      });
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      const rooms = Array.from(client.rooms);
      const chatId = rooms.find(room => room !== client.id);

      if (chatId) {
        // ตรวจสอบ chat และสิทธิ์
        const chat = await this.chatHistoryService.getChatById(chatId);
        if (!chat) {
          client.emit('error', { 
            type: 'error', 
            data: 'Chat not found' 
          });
          return;
        }
        if (chat.userId.toString() !== userId) {
          client.emit('error', { 
            type: 'error', 
            data: 'Not authorized to leave this chat' 
          });
          return;
        }

        await client.leave(chatId);
        await this.webSocketService.leaveRoom(client, chatId);
        
        // Disconnect from Redis PubSub
        this.redisPubSubService.disconnect(chatId, client);
        
        client.emit('room_left', { 
          type: 'room_left', 
          data: { chatId } 
        });

        this.logger.log(`👋 User ${userId} left room: ${chatId}`);
      }

    } catch (error) {
      this.logger.error(`❌ Leave room error: ${error.message}`);
      client.emit('error', { 
        type: 'error', 
        data: `Failed to leave room: ${error.message}` 
      });
    }
  }
} 