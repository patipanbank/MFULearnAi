import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisPubSubService } from '../redis/redis-pubsub.service';
import { TaskQueueService } from '../tasks/task-queue.service';
import { AgentService } from '../agent/agent.service';
import { ChatService } from '../chat/chat.service';

interface JoinRoomData {
  chatId: string;
  userId?: string;
}

interface CreateRoomData {
  agent_id?: string;
  agentId?: string;
  name?: string;
}

interface MessageData {
  type?: string;
  message?: string;
  text?: string;
  chatId?: string;
  session_id?: string;
  agent_id?: string;
  agentId?: string;
  images?: any[];
}

@WSGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);

  // Keep track of user sessions and agent configurations per socket
  private socketSessions = new Map<string, {
    sessionId?: string;
    userId: string;
    username: string;
    role: string;
    department: string;
    agentId?: string;
    modelId?: string;
    collectionNames?: string[];
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisPubSubService: RedisPubSubService,
    private readonly taskQueueService: TaskQueueService,
    private readonly agentService: AgentService,
    private readonly chatService: ChatService,
  ) {}

  afterInit(server: Server) {
    // Initialize Redis PubSub with Socket.IO server
    this.redisPubSubService.setSocketServer(server);
    this.logger.log('🌐 WebSocket Gateway initialized with Redis PubSub');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`🌐 WebSocket connection attempt from: ${client.handshake.address}`);
    this.logger.debug(`🔗 WebSocket query params: ${JSON.stringify(client.handshake.query)}`);
    
    try {
      // SECURITY: Get token from Authorization header (like FastAPI)
      const authHeader = client.handshake.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        this.logger.warn(`❌ No valid authorization header provided`);
        client.emit('error', { message: 'Authorization required' });
        client.disconnect();
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Validate JWT token
      let payload: any;
      try {
        payload = this.jwtService.verify(token);
        this.logger.debug(`✅ Token decoded successfully for user: ${payload.username}`);
      } catch (jwtError) {
        this.logger.warn(`❌ Invalid JWT token: ${jwtError.message}`);
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      // Extract user info from JWT payload
      const userId = payload.sub || payload.userId;
      const username = payload.username;
      const role = payload.role || 'Student';
      const department = payload.department || 'default';

      if (!userId || !username) {
        this.logger.warn(`❌ Missing user info in token payload`);
        client.emit('error', { message: 'Invalid user data in token' });
        client.disconnect();
        return;
      }

      // Store user session info
      this.socketSessions.set(client.id, {
        userId,
        username,
        role,
        department,
      });

      // Join user to their personal room
      client.join(`user:${userId}`);

      this.logger.log(`✅ User ${username} (${userId}) authenticated and connected`);

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to MFU Learn AI',
        userId,
        timestamp: new Date(),
      });

      // NOW WAIT FOR INITIAL MESSAGE TO DETERMINE FLOW (like FastAPI)
      // The client must send one of: join_room, create_room, or legacy message
      
    } catch (error) {
      this.logger.error(`❌ Connection error: ${error.message}`);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const session = this.socketSessions.get(client.id);
    if (session) {
      // Disconnect from Redis PubSub if connected to a session
      if (session.sessionId) {
        this.redisPubSubService.disconnect(session.sessionId, client);
      }
      
      // Clean up session data
      this.socketSessions.delete(client.id);
      this.logger.log(`🔌 User ${session.username} (${session.userId}) disconnected`);
    }
  }

  /**
   * FLOW 1: Join existing room (like FastAPI join_room)
   */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomData,
  ) {
    try {
      const session = this.socketSessions.get(client.id);
      if (!session) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const chatId = data.chatId;
      if (!chatId || chatId.length !== 24) {
        client.emit('error', { message: 'Invalid chatId for join_room' });
        return;
      }

      this.logger.log(`🏠 User ${session.username} joining room ${chatId}`);

      // Verify chat exists and user has access
      try {
        const chat = await this.chatService.getChatById(chatId, session.userId);
        if (!chat) {
          client.emit('error', { message: 'Chat not found' });
          return;
        }

        // Check if user has access to this chat
        if ((chat as any).userId.toString() !== session.userId) {
          client.emit('error', { message: 'Access denied to this chat' });
          return;
        }

        // Load agent configuration if chat has an agent
        if ((chat as any).agentId) {
          try {
            const agent = await this.agentService.getAgentById((chat as any).agentId.toString(), session.userId);
            session.agentId = (agent as any)._id.toString();
            session.modelId = agent.modelId;
            session.collectionNames = agent.collectionNames || [];
            session.systemPrompt = agent.systemPrompt;
            session.temperature = agent.temperature || 0.7;
            session.maxTokens = agent.maxTokens || 4000;
          } catch (error) {
            this.logger.warn(`Failed to load agent ${(chat as any).agentId}: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error verifying chat access: ${error.message}`);
        client.emit('error', { message: 'Failed to verify chat access' });
        return;
      }

      // Connect to Redis PubSub for this session
      await this.redisPubSubService.connect(chatId, client);
      
      // Update session with current chat
      session.sessionId = chatId;
      this.socketSessions.set(client.id, session);

      // Send confirmation (like FastAPI)
      client.emit('room_joined', {
        chatId,
        message: `Joined room: ${chatId}`,
        timestamp: new Date(),
      });

      this.logger.log(`✅ User ${session.username} joined room ${chatId}`);

    } catch (error) {
      this.logger.error(`❌ Error joining room: ${error.message}`);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * FLOW 2: Create new room (like FastAPI create_room)
   */
  @SubscribeMessage('create_room')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateRoomData,
  ) {
    try {
      const session = this.socketSessions.get(client.id);
      if (!session) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const agentId = data.agent_id || data.agentId;
      const chatName = data.name || 'New Chat';

      this.logger.log(`🆕 User ${session.username} creating new room with agent ${agentId}`);

      // Load agent configuration if provided
      if (agentId) {
        try {
          const agent = await this.agentService.getAgentById(agentId, session.userId);
          session.agentId = (agent as any)._id.toString();
          session.modelId = agent.modelId;
          session.collectionNames = agent.collectionNames || [];
          session.systemPrompt = agent.systemPrompt;
          session.temperature = agent.temperature || 0.7;
          session.maxTokens = agent.maxTokens || 4000;
        } catch (error) {
          client.emit('error', { message: `Failed to load agent: ${error.message}` });
          return;
        }
      }

      // Create new chat in database
      let newChatId: string;
      try {
        const newChat = await this.chatService.createChat(session.userId, {
          title: chatName,
          agentId: session.agentId,
        });
        newChatId = (newChat as any)._id.toString();
      } catch (error) {
        this.logger.error(`Failed to create chat: ${error.message}`);
        client.emit('error', { message: 'Failed to create chat' });
        return;
      }

      // Clear any existing Redis memory for fresh start
      try {
        // TODO: Implement clear_chat_memory equivalent
        // For now, just log that we would clear memory
        this.logger.log(`Would clear Redis memory for new chat ${newChatId}`);
      } catch (error) {
        this.logger.warn(`Failed to clear chat memory: ${error.message}`);
      }

      // Connect to Redis PubSub for new session
      await this.redisPubSubService.connect(newChatId, client);
      
      // Update session with new chat
      session.sessionId = newChatId;
      this.socketSessions.set(client.id, session);

      // Send confirmation (like FastAPI)
      client.emit('room_created', {
        chatId: newChatId,
        message: `Created room: ${newChatId}`,
        timestamp: new Date(),
      });

      this.logger.log(`✅ User ${session.username} created room ${newChatId}`);

    } catch (error) {
      this.logger.error(`❌ Error creating room: ${error.message}`);
      client.emit('error', { message: 'Failed to create room' });
    }
  }

  /**
   * MAIN MESSAGE HANDLER (like FastAPI main message loop)
   */
  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MessageData,
  ) {
    try {
      const session = this.socketSessions.get(client.id);
      if (!session) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Handle different message types
      const messageType = data.type || 'message';

      if (messageType === 'ping') {
        client.emit('pong');
        return;
      }

      if (messageType === 'create_room') {
        // Handle inline room creation (like FastAPI)
        await this.handleCreateRoom(client, data as CreateRoomData);
        return;
      }

      // Handle actual chat message
      const message = data.text || data.message;
      if (!message) {
        client.emit('error', { message: 'No message content provided' });
        return;
      }

      // Determine session ID (can switch during conversation like FastAPI)
      const incomingSessionId = data.chatId || data.session_id || session.sessionId;
      if (!incomingSessionId || incomingSessionId.length !== 24) {
        client.emit('error', { message: 'Invalid or missing chatId' });
        return;
      }

      // Handle session switching (like FastAPI)
      if (incomingSessionId !== session.sessionId) {
        this.logger.log(`🔄 User ${session.username} switching from ${session.sessionId} to ${incomingSessionId}`);
        
        // Disconnect from previous session
        if (session.sessionId) {
          this.redisPubSubService.disconnect(session.sessionId, client);
        }
        
        // Connect to new session
        await this.redisPubSubService.connect(incomingSessionId, client);
        session.sessionId = incomingSessionId;
        
        // TODO: Clear Redis memory when switching sessions (like FastAPI)
      }

      // Handle agent switching (like FastAPI)
      const newAgentId = data.agent_id || data.agentId;
      if (newAgentId && newAgentId !== session.agentId) {
        this.logger.log(`🤖 User ${session.username} switching agent from ${session.agentId} to ${newAgentId}`);
        
        // TODO: Load new agent configuration
        session.agentId = newAgentId;
        // TODO: Clear Redis memory when switching agents (like FastAPI)
      }

      // Add user message to chat history (like FastAPI)
      // TODO: Implement chat history persistence

      // Dispatch background task for AI generation (like FastAPI Celery)
      const taskPayload = {
        session_id: incomingSessionId,
        user_id: session.userId,
        message,
        model_id: session.modelId || 'claude-3-haiku-20240307',
        collection_names: session.collectionNames || [],
        images: data.images || [],
        system_prompt: session.systemPrompt,
        temperature: session.temperature || 0.7,
        max_tokens: session.maxTokens || 4000,
        agent_id: session.agentId,
      };

      this.logger.log(`🚀 Dispatching background task for session ${incomingSessionId}`);
      await this.taskQueueService.addGenerateAnswerTask(taskPayload);

      // Send immediate acknowledgment (like FastAPI)
      client.emit('accepted', {
        chatId: incomingSessionId,
        message: 'Message accepted for processing',
        timestamp: new Date(),
      });

      this.logger.log(`✅ Message accepted and queued for session ${incomingSessionId}`);

    } catch (error) {
      this.logger.error(`❌ Error handling message: ${error.message}`);
      client.emit('error', { message: 'Failed to process message' });
    }
  }

  /**
   * Handle typing indicators
   */
  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; userId: string; username: string },
  ) {
    const session = this.socketSessions.get(client.id);
    if (!session) return;

    // Broadcast to others in the session
    client.to(`session:${data.sessionId}`).emit('typing_start', {
      userId: data.userId,
      username: data.username,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; userId: string },
  ) {
    const session = this.socketSessions.get(client.id);
    if (!session) return;

    // Broadcast to others in the session
    client.to(`session:${data.sessionId}`).emit('typing_stop', {
      userId: data.userId,
      timestamp: new Date(),
    });
  }

  /**
   * Get online users for a session
   */
  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const session = this.socketSessions.get(client.id);
    if (!session || !session.sessionId) return;

    // TODO: Get actual online users for session
    const onlineUsers = []; // Mock for now

    client.emit('online_users', {
      sessionId: session.sessionId,
      users: onlineUsers,
      count: onlineUsers.length,
    });
  }

  /**
   * Broadcast to user (utility method)
   */
  async broadcastToUser(userId: string, event: string, data: any) {
    await this.redisPubSubService.broadcastToUser(userId, event, data);
  }

  /**
   * Broadcast to room (utility method)
   */
  async broadcastToRoom(room: string, event: string, data: any) {
    await this.redisPubSubService.broadcastToRoom(room, event, data);
  }
} 