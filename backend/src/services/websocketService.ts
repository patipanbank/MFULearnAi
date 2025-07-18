import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { wsManager } from '../utils/websocketManager';
import { chatService } from './chatService';
import { agentService } from './agentService';
import { queueService } from './queueService';
import { redisListener } from '../utils/redisListener';
import { v4 as uuidv4 } from 'uuid';

interface WebSocketMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

interface AuthenticatedRequest extends IncomingMessage {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class WebSocketService {
  private wss: WebSocketServer;
  private pingInterval!: NodeJS.Timeout;
  private userSessions: Map<string, {
    sessionId: string | null;
    agentId: string | null;
    modelId: string | null;
    collectionNames: string[];
    systemPrompt: string | null;
    temperature: number;
    maxTokens: number;
  }> = new Map();

  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.setupWebSocketServer();
    this.startPingInterval();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    console.log('✅ WebSocket server initialized');
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    console.log('🌐 New WebSocket connection attempt');

    try {
      // Extract token from query parameters
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      // ตรวจสอบว่ามี token ที่ handshake
      if (!token) {
        console.log('❌ No token provided at WebSocket handshake');
        ws.close(1008, 'No token provided'); // Policy violation
        return;
      }

      // ตรวจสอบ JWT ด้วย secret จาก env
      const user = await this.verifyToken(token);
      if (!user) {
        console.log('❌ Invalid or expired token at WebSocket handshake');
        ws.close(1008, 'Invalid or expired token'); // Policy violation
        return;
      }

      // Generate unique connection ID
      const connectionId = uuidv4();

      // Initialize user session state (sessionId, agentId, modelId, ...)
      this.userSessions.set(connectionId, {
        sessionId: null,
        agentId: null,
        modelId: null,
        collectionNames: [],
        systemPrompt: null,
        temperature: 0.7,
        maxTokens: 4000
      });

      // Add connection to manager
      wsManager.addConnection(connectionId, ws, user.id);

      console.log(`✅ WebSocket authenticated for user: ${user.id}`);

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          this.handleMessage(connectionId, data.toString(), user);
        } catch (err) {
          // จัดการ error handling ระดับ message
          console.error('❌ Error in ws.on(message):', err);
          wsManager.sendToConnection(connectionId, JSON.stringify({ type: 'error', data: 'Internal server error' }));
          ws.close(1011, 'Internal server error');
        }
      });

      // Handle connection close
      ws.on('close', () => {
        console.log(`👋 WebSocket connection closed for user: ${user.id}`);
        // cleanup session mapping
        this.userSessions.delete(connectionId);
        wsManager.leaveSession(connectionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        // log error และปิด connection อย่างปลอดภัย
        console.error(`❌ WebSocket error for user ${user.id}:`, error);
        wsManager.sendToConnection(connectionId, JSON.stringify({ type: 'error', data: 'WebSocket error' }));
        ws.close(1011, 'WebSocket error');
      });

    } catch (error) {
      // กรณี JWT_SECRET ไม่ถูกตั้งค่า หรือ error อื่น
      console.error('❌ Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async verifyToken(token: string): Promise<any> {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET not configured');
      }

      const decoded = jwt.verify(token, secret) as any;
      return {
        id: decoded.sub || decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
    } catch (error) {
      console.error('❌ Token verification failed:', error);
      return null;
    }
  }

  private async handleMessage(connectionId: string, message: string, user: any): Promise<void> {
    try {
      const data: WebSocketMessage = JSON.parse(message);
      console.log(`📨 Received message from ${user.id}:`, data.type);

      switch (data.type) {
        case 'ping':
          this.handlePing(connectionId);
          break;

        case 'join_room':
          await this.handleJoinRoom(connectionId, data, user);
          break;

        case 'create_room':
          await this.handleCreateRoom(connectionId, data, user);
          break;

        case 'message':
          await this.handleChatMessage(connectionId, data, user);
          break;

        case 'leave_room':
          this.handleLeaveRoom(connectionId);
          break;

        default:
          console.warn(`⚠️ Unknown message type: ${data.type}`);
          this.sendError(connectionId, `Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      this.sendError(connectionId, 'Invalid message format');
    }
  }

  private handlePing(connectionId: string): void {
    wsManager.sendToConnection(connectionId, JSON.stringify({ type: 'pong' }));
  }

  private async handleJoinRoom(connectionId: string, data: WebSocketMessage, user: any): Promise<void> {
    const chatId = data.chatId;
    
    if (!chatId || typeof chatId !== 'string' || chatId.length !== 24) {
      this.sendError(connectionId, 'Invalid chatId for join_room');
      return;
    }

    // Verify user has access to this chat
    const chat = await chatService.getChat(chatId, user.id);
    if (!chat) {
      this.sendError(connectionId, 'Chat not found or access denied');
      return;
    }
    
    // Update user session state (sessionId, agentId)
    const userSession = this.userSessions.get(connectionId);
    if (userSession) {
      userSession.sessionId = chatId;
      userSession.agentId = chat.agentId || null;
      // สามารถขยายเพื่ออัปเดต modelId, collectionNames, systemPrompt, ... ได้ถ้าต้องการ
    }
    
    wsManager.joinSession(connectionId, chatId);
    
    // Send confirmation
    wsManager.sendToConnection(connectionId, JSON.stringify({
      type: 'room_joined',
      data: { chatId }
    }));

    console.log(`✅ User ${user.id} joined room ${chatId}`);
  }

  private async handleCreateRoom(connectionId: string, data: WebSocketMessage, user: any): Promise<void> {
    const agentId = data.agent_id || data.agentId;
    const name = data.name || 'New Chat';

    // Load agent configuration if provided
    let modelId: string | null = null;
    let collectionNames: string[] = [];
    let systemPrompt: string | null = null;
    let temperature = 0.7;
    let maxTokens = 4000;

    if (agentId) {
      try {
        const agent = await agentService.getAgentById(agentId);
        if (agent) {
          modelId = agent.modelId;
          collectionNames = agent.collectionNames || [];
          systemPrompt = agent.systemPrompt;
          temperature = agent.temperature;
          maxTokens = agent.maxTokens;
        }
      } catch (error) {
        this.sendError(connectionId, `Failed to load agent: ${error}`);
        return;
      }
    }

    // Create chat in chat service
    const chat = await chatService.createChat(user.id, name, agentId);
    
    // Update user session state (sessionId, agentId, modelId, ...)
    const userSession = this.userSessions.get(connectionId);
    if (userSession) {
      userSession.sessionId = chat.id;
      userSession.agentId = agentId;
      userSession.modelId = modelId;
      userSession.collectionNames = collectionNames;
      userSession.systemPrompt = systemPrompt;
      userSession.temperature = temperature;
      userSession.maxTokens = maxTokens;
    }
    
    wsManager.joinSession(connectionId, chat.id);
    
    // Send confirmation
    wsManager.sendToConnection(connectionId, JSON.stringify({
      type: 'room_created',
      data: { chatId: chat.id }
    }));

    console.log(`✅ User ${user.id} created room ${chat.id}`);
  }

  private async handleChatMessage(connectionId: string, data: WebSocketMessage, user: any): Promise<void> {
    try {
      const userSession = this.userSessions.get(connectionId);
      if (!userSession) {
        this.sendError(connectionId, 'Session not found');
        return;
      }

      const message = data.text || data.message;
      const incomingChatId = data.chatId || data.session_id;
      const newAgentId = data.agent_id || data.agentId;
      const images = data.images || [];

      if (!message) {
        return; // Ignore empty messages
      }

      // Handle session switching
      let currentChatId: string | null = userSession.sessionId;
      if (incomingChatId && incomingChatId !== currentChatId) {
        if (incomingChatId.length !== 24) {
          this.sendError(connectionId, 'Invalid or missing chatId');
          return;
        }

        // Verify user has access to the new chat
        try {
          const newChat = await chatService.getChat(incomingChatId, user.id);
          if (!newChat) {
            this.sendError(connectionId, 'Chat not found');
            return;
          }
        } catch (error) {
          this.sendError(connectionId, `Failed to validate chat: ${error}`);
          return;
        }

        // Switch to new session
        if (currentChatId) {
          wsManager.leaveSession(connectionId);
        }
        currentChatId = incomingChatId as string;
        userSession.sessionId = currentChatId;
        wsManager.joinSession(connectionId, currentChatId);
      }

      // Handle agent switching
      if (newAgentId && newAgentId !== userSession.agentId) {
        try {
          const agent = await agentService.getAgentById(newAgentId);
          if (!agent) {
            this.sendError(connectionId, 'Agent not found');
            return;
          }

          userSession.agentId = newAgentId;
          userSession.modelId = agent.modelId;
          userSession.collectionNames = agent.collectionNames || [];
          userSession.systemPrompt = agent.systemPrompt;
          userSession.temperature = agent.temperature;
          userSession.maxTokens = agent.maxTokens;
        } catch (error) {
          this.sendError(connectionId, `Failed to load agent: ${error}`);
          return;
        }
      }

      if (!currentChatId) {
        this.sendError(connectionId, 'No active chat session');
        return;
      }

      const chatId = currentChatId; // Type assertion after null check

      // Add user message to chat first
      await chatService.addMessage(chatId, {
        role: 'user',
        content: message,
        images
      });

      // Send immediate acknowledgment to client
      wsManager.sendToConnection(connectionId, JSON.stringify({
        type: 'accepted',
        data: { chatId }
      }));

      // Dispatch background generation task to queue
      const taskPayload = {
        sessionId: chatId,
        userId: user.id,
        message,
        modelId: userSession.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        collectionNames: userSession.collectionNames || [],
        images,
        systemPrompt: userSession.systemPrompt || undefined,
        temperature: userSession.temperature,
        maxTokens: userSession.maxTokens,
        agentId: userSession.agentId || undefined,
      };

      console.log(`🚀 Dispatching BullMQ task for session ${chatId}`);
      console.log(`📋 Task payload:`, taskPayload);
      
      try {
        const job = await queueService.addChatJob(taskPayload);
        // job dispatched
      } catch (error) {
        // ส่ง error event กลับ client
        wsManager.sendToConnection(connectionId, JSON.stringify({
          type: 'error',
          data: `Failed to process message: ${error}`
        }));
      }
      // ทุก event ที่เกี่ยวข้องกับข้อความ/stream/tool จะถูก broadcast ด้วย wsManager.broadcastToSession(chatId, ...)
      // (ยืนยันแล้วจาก chatService/langchainChatService)
    } catch (error) {
      // จัดการ error handling ระดับสูงสุด
      console.error('❌ Error in handleChatMessage:', error);
      wsManager.sendToConnection(connectionId, JSON.stringify({ type: 'error', data: 'Internal server error' }));
    }
  }

  private handleLeaveRoom(connectionId: string): void {
    const userSession = this.userSessions.get(connectionId);
    if (userSession?.sessionId) {
      // ลบ redisListener.unsubscribeFromChat
    }
    
    wsManager.leaveSession(connectionId);
    
    wsManager.sendToConnection(connectionId, JSON.stringify({
      type: 'room_left',
      data: { success: true }
    }));
  }

  private sendError(connectionId: string, message: string): void {
    wsManager.sendToConnection(connectionId, JSON.stringify({
      type: 'error',
      data: message
    }));
  }



  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      wsManager.pingConnections();
    }, 30000); // Ping every 30 seconds
  }

  public stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.wss.close(() => {
      console.log('🔌 WebSocket server stopped');
    });
  }

  public getStats(): any {
    return {
      totalConnections: wsManager.getConnectionCount(),
      activeSessions: wsManager.getSessionConnectionCount('all'),
      uptime: process.uptime()
    };
  }
} 