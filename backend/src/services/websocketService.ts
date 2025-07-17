import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { wsManager } from '../utils/websocketManager';
import { chatService } from './chatService';
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

      if (!token) {
        console.log('❌ No token provided');
        ws.close(1008, 'No token provided');
        return;
      }

      // Verify JWT token
      const user = await this.verifyToken(token);
      if (!user) {
        console.log('❌ Invalid token');
        ws.close(1008, 'Invalid token');
        return;
      }

      // Generate unique connection ID
      const connectionId = uuidv4();

      // Add connection to manager
      wsManager.addConnection(connectionId, ws, user.id);

      console.log(`✅ WebSocket authenticated for user: ${user.id}`);

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        this.handleMessage(connectionId, data.toString(), user);
      });

      // Handle connection close
      ws.on('close', () => {
        console.log(`👋 WebSocket connection closed for user: ${user.id}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for user ${user.id}:`, error);
      });

    } catch (error) {
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
    
    if (!chatId || typeof chatId !== 'string') {
      this.sendError(connectionId, 'Invalid chatId for join_room');
      return;
    }

    // Verify user has access to this chat
    const chat = await chatService.getChat(chatId, user.id);
    if (!chat) {
      this.sendError(connectionId, 'Chat not found or access denied');
      return;
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

    // Create chat in chat service
    const chat = await chatService.createChat(user.id, name, agentId);
    
    wsManager.joinSession(connectionId, chat.id);
    
    // Send confirmation
    wsManager.sendToConnection(connectionId, JSON.stringify({
      type: 'room_created',
      data: { chatId: chat.id }
    }));

    console.log(`✅ User ${user.id} created room ${chat.id}`);
  }

  private async handleChatMessage(connectionId: string, data: WebSocketMessage, user: any): Promise<void> {
    const chatId = data.chatId;
    const message = data.text || data.message;
    const agentId = data.agent_id;
    const images = data.images || [];

    if (!chatId || !message) {
      this.sendError(connectionId, 'Missing chatId or message');
      return;
    }

    // Send acceptance confirmation
    wsManager.sendToConnection(connectionId, JSON.stringify({
      type: 'accepted',
      data: { chatId }
    }));

    // Process message with chat service
    await chatService.processMessage(chatId, user.id, message, images);

    console.log(`💬 User ${user.id} sent message in room ${chatId}`);
  }

  private handleLeaveRoom(connectionId: string): void {
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