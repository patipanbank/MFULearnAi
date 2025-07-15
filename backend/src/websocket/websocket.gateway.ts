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

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private webSocketService: WebSocketService,
    private chatService: ChatService,
    private chatHistoryService: ChatHistoryService,
    private agentService: AgentService,
    private taskQueueService: TaskQueueService,
    private redisPubSubService: RedisPubSubService,
  ) {}

  afterInit(server: Server) {
    // Initialize Redis PubSub service with Socket.IO server
    this.redisPubSubService.setSocketServer(server);
    console.log('🔌 WebSocket Gateway initialized with Redis PubSub service');
  }

  async handleConnection(client: Socket) {
    try {
      console.log(`🌐 WebSocket connection attempt from: ${client.id}`);
      
      // Extract token from auth object (Socket.IO v4+)
      const token = client.handshake.auth?.token as string;
      console.log(`🎫 Token received: ${token ? token.substring(0, 50) + '...' : 'None'}`);

      if (!token) {
        console.log('❌ No token provided in auth object');
        client.disconnect(true);
        return;
      }

      // Validate JWT token
      try {
        const payload = this.jwtService.verify(token);
        const userId = payload.sub;
        
        if (!userId) {
          console.log('❌ No user_id in token payload');
          client.disconnect(true);
          return;
        }

        // Store user info in socket
        client.data.userId = userId;
        client.data.userInfo = {
          id: userId,
          username: payload.username,
          role: payload.role,
          department: payload.department,
        };

        // Register with WebSocket service
        await this.webSocketService.handleConnection(client, userId, client.data.userInfo);
        
        console.log(`✅ WebSocket authenticated for user: ${userId}`);
        
        // Send connection confirmation
        client.emit('connected', { 
          type: 'connected', 
          data: { userId, message: 'WebSocket connected successfully' } 
        });

      } catch (error) {
        console.log(`❌ JWT validation error: ${error.message}`);
        client.disconnect(true);
        return;
      }

    } catch (error) {
      console.log(`❌ Connection error: ${error.message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      await this.webSocketService.handleDisconnection(client);
    } catch (error) {
      console.log(`❌ Disconnection error: ${error.message}`);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomMessage,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { chatId } = data;
      const userId = client.data.userId;

      console.log(`🔗 User ${userId} attempting to join room: ${chatId}`);

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

      console.log(`✅ User ${userId} joined room: ${chatId}`);

    } catch (error) {
      console.log(`❌ Join room error: ${error.message}`);
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
    try {
      const userId = client.data.userId;
      const agentId = data.agent_id || data.agentId;
      const modelId = data.model_id || data.modelId;
      const collectionNames = data.collection_names || data.collectionNames || [];
      const systemPrompt = data.system_prompt || data.systemPrompt;
      const temperature = typeof data.temperature === 'number' ? data.temperature : 0.7;
      const maxTokens = typeof data.max_tokens === 'number' ? data.max_tokens : (typeof data.maxTokens === 'number' ? data.maxTokens : 4000);

      console.log(`🏗️ User ${userId} creating room with agent: ${agentId}`);

      // Validate agent exists if provided
      if (agentId) {
        const agent = await this.agentService.getAgentById(agentId, userId);
        if (!agent) {
          client.emit('error', { 
            type: 'error', 
            data: 'Agent not found or access denied' 
          });
          return;
        }
      }

      // Create new chat (support all fields)
      const chatName = agentId ? `Chat with ${agentId}` : 'New Chat';
      const chat = await this.chatHistoryService.createChat(
        userId,
        chatName,
        agentId,
        modelId,
        collectionNames,
        systemPrompt,
        temperature,
        maxTokens
      );

      // Join the room
      const chatId = chat.id;
      if (!chatId) {
        throw new Error('Chat ID not found');
      }
      await client.join(chatId);
      await this.webSocketService.joinRoom(client, chatId);
      
      // Connect to Redis PubSub for this session
      await this.redisPubSubService.connect(chatId, client);

      // Send confirmation
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

      console.log(`✅ Room created: ${chatId} for user: ${userId}`);

    } catch (error) {
      console.log(`❌ Create room error: ${error.message}`);
      client.emit('error', { 
        type: 'error', 
        data: `Failed to create room: ${error.message}` 
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

      console.log(`💬 User ${userId} sending message in chat: ${chatId}`);

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

      console.log(`✅ Message queued for AI processing in chat: ${chatId}`);

    } catch (error) {
      console.log(`❌ Send message error: ${error.message}`);
      client.emit('error', { 
        type: 'error', 
        data: `Failed to send message: ${error.message}` 
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

        console.log(`👋 User ${userId} left room: ${chatId}`);
      }

    } catch (error) {
      console.log(`❌ Leave room error: ${error.message}`);
      client.emit('error', { 
        type: 'error', 
        data: `Failed to leave room: ${error.message}` 
      });
    }
  }
} 