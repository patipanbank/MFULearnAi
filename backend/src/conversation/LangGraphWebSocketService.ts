/**
 * LangGraphWebSocketService - Advanced WebSocket Handler with LangGraph
 *
 * ระบบ WebSocket ที่ใช้ LangGraph สำหรับ conversation processing
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { langGraphConversationService, LangGraphConversationConfig } from './LangGraphConversation';

interface WebSocketMessage {
  type: string;
  conversationId?: string;
  data?: any;
  [key: string]: any;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

interface ConnectionInfo {
  id: string;
  userId: string;
  ws: WebSocket;
  currentConversationId?: string;
  lastActivity: Date;
  isStreaming: boolean;
}

export class LangGraphWebSocketService {
  private wss: WebSocketServer;
  private connections: Map<string, ConnectionInfo> = new Map();
  private pingInterval!: NodeJS.Timeout;

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws'
    });

    this.setupWebSocketServer();
    this.startPingInterval();
    console.log('✅ LangGraphWebSocketService initialized on /ws');
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    console.log('🌐 New LangGraph WebSocket connection attempt');

    try {
      // Extract token from query parameters
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        console.log('❌ No token provided for LangGraph WebSocket');
        ws.close(1008, 'No token provided');
        return;
      }

      // Verify JWT token
      const user = await this.verifyToken(token);
      if (!user) {
        console.log('❌ Invalid token for LangGraph WebSocket');
        ws.close(1008, 'Invalid token');
        return;
      }

      // Generate unique connection ID
      const connectionId = uuidv4();

      // Store connection info
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        userId: user.id,
        ws,
        lastActivity: new Date(),
        isStreaming: false
      };

      this.connections.set(connectionId, connectionInfo);

      console.log(`✅ LangGraph WebSocket authenticated for user: ${user.id}`);

      // Send welcome message
      this.sendMessage(connectionId, {
        type: 'connected',
        data: {
          connectionId,
          userId: user.id
        }
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        this.handleIncomingMessage(connectionId, data.toString(), user);
      });

      // Handle connection close
      ws.on('close', () => {
        console.log(`👋 LangGraph WebSocket connection closed for user: ${user.id}`);
        this.connections.delete(connectionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`❌ LangGraph WebSocket error for user ${user.id}:`, error);
        this.connections.delete(connectionId);
      });

    } catch (error) {
      console.error('❌ Error handling LangGraph WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async verifyToken(token: string): Promise<AuthenticatedUser | null> {
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

  private async handleIncomingMessage(connectionId: string, message: string, user: AuthenticatedUser): Promise<void> {
    try {
      const data: WebSocketMessage = JSON.parse(message);
      console.log(`📨 Received LangGraph message from ${user.id}:`, data.type);

      // Update last activity
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastActivity = new Date();
      }

      switch (data.type) {
        case 'ping':
          this.handlePing(connectionId);
          break;

        case 'message':
          await this.handleMessage(connectionId, data, user);
          break;

        case 'join_room':
          this.handleJoinRoom(connectionId, data);
          break;

        case 'leave_room':
          this.handleLeaveRoom(connectionId);
          break;

        case 'get_workflow_state':
          this.handleGetWorkflowState(connectionId, data);
          break;

        default:
          console.warn(`⚠️ Unknown LangGraph message type: ${data.type}`);
          this.sendError(connectionId, `Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('❌ Error handling LangGraph message:', error);
      this.sendError(connectionId, 'Invalid message format');
    }
  }

  private handlePing(connectionId: string): void {
    this.sendMessage(connectionId, { type: 'pong' });
  }

  private async handleMessage(connectionId: string, data: WebSocketMessage, user: AuthenticatedUser): Promise<void> {
    const chatId = data.chatId;
    const message = data.text || '';

    if (!chatId) {
      this.sendError(connectionId, 'Chat ID is required');
      return;
    }

    if (!message.trim()) {
      this.sendError(connectionId, 'Message content is required');
      return;
    }

    const assistantMessageId = uuidv4();

    try {
      // Mark connection as streaming
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.currentConversationId = chatId;
        connection.isStreaming = true;
      }

      // Send message acceptance
      this.sendMessage(connectionId, {
        type: 'accepted',
        data: { chatId, messageId: uuidv4() }
      });

      // Add user message
      const userMessageId = uuidv4();
      this.sendMessage(connectionId, {
        type: 'message_added',
        data: {
          message: {
            id: userMessageId,
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
            images: data.images,
            isStreaming: false,
            isComplete: true
          }
        }
      });

      // Configure LangGraph workflow
      const config: LangGraphConversationConfig = {
        modelId: data.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        temperature: data.temperature || 0.7,
        maxTokens: data.maxTokens || 4000,
        systemPrompt: data.systemPrompt || 'You are a helpful AI assistant.',
        agentId: data.agent_id,
        enableTools: data.enableTools || false,
        tools: data.tools || []
      };

      let streamBuffer = '';
      let chunkCount = 0;

      // Add assistant message (streaming)
      this.sendMessage(connectionId, {
        type: 'message_added',
        data: {
          message: {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: true,
            isComplete: false
          }
        }
      });

      // Process with LangGraph service
      const response = await langGraphConversationService.processMessage(
        {
          conversationId: chatId,
          userId: user.id,
          message,
          images: data.images,
          config
        },
        (chunk: string) => {
          chunkCount++;
          streamBuffer += chunk;

          // Send streaming chunk
          this.sendMessage(connectionId, {
            type: 'message_updated',
            data: {
              messageId: assistantMessageId,
              content: streamBuffer,
              isStreaming: true
            }
          });
        }
      );

      // Mark connection as not streaming
      if (connection) {
        connection.isStreaming = false;
      }

      // Send message completion
      this.sendMessage(connectionId, {
        type: 'message_completed',
        data: {
          messageId: assistantMessageId,
          content: response.content
        }
      });

    } catch (error) {
      console.error('❌ Error processing LangGraph message:', error);

      // Mark connection as not streaming
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.isStreaming = false;
      }

      this.sendMessage(connectionId, {
        type: 'message_error',
        data: {
          messageId: assistantMessageId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  private handleJoinRoom(connectionId: string, data: WebSocketMessage): void {
    const chatId = data.chatId;

    if (!chatId) {
      this.sendError(connectionId, 'Chat ID is required');
      return;
    }

    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.currentConversationId = chatId;
      this.sendMessage(connectionId, {
        type: 'room_joined',
        data: {
          chatId
        }
      });
    }
  }

  private handleLeaveRoom(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const chatId = connection.currentConversationId;
      connection.currentConversationId = undefined;
      this.sendMessage(connectionId, {
        type: 'room_left',
        data: { chatId }
      });
    }
  }

  private handleGetWorkflowState(connectionId: string, data: WebSocketMessage): void {
    const conversationId = data.conversationId;
    const connection = this.connections.get(connectionId);

    if (!connection || !conversationId) {
      this.sendError(connectionId, 'Invalid workflow state request');
      return;
    }

    this.sendMessage(connectionId, {
      type: 'workflow_state',
      data: {
        conversationId,
        isActive: connection.isStreaming,
        currentNode: connection.isStreaming ? 'call_model' : 'idle',
        workflowEngine: 'langgraph',
        features: {
          stateManagement: true,
          conditionalRouting: true,
          toolIntegration: true,
          memoryPersistence: true
        }
      }
    });
  }

  private sendMessage(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Error sending message to connection:', error);
        this.connections.delete(connectionId);
      }
    }
  }

  private sendError(connectionId: string, message: string): void {
    this.sendMessage(connectionId, {
      type: 'error',
      data: message
    });
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000; // 5 minutes

      // Check for inactive connections
      for (const [connectionId, connection] of this.connections.entries()) {
        if (now.getTime() - connection.lastActivity.getTime() > timeout) {
          console.log(`🕐 Closing inactive LangGraph connection: ${connectionId}`);
          connection.ws.close(1000, 'Connection timeout');
          this.connections.delete(connectionId);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping to active connections
          this.sendMessage(connectionId, { type: 'ping' });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down LangGraphWebSocketService...');

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all connections
    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        connection.ws.close(1000, 'Server shutdown');
      } catch (error) {
        console.error('❌ Error closing connection during shutdown:', error);
      }
    }

    this.connections.clear();

    // Close WebSocket server
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log('✅ LangGraphWebSocketService shutdown complete');
        resolve();
      });
    });
  }

  public getStats(): any {
    const now = new Date();
    const activeConnections = Array.from(this.connections.values()).filter(
      conn => conn.ws.readyState === WebSocket.OPEN
    );

    const streamingConnections = activeConnections.filter(conn => conn.isStreaming);

    return {
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      streamingConnections: streamingConnections.length,
      connectionsInConversation: activeConnections.filter(conn => conn.currentConversationId).length,
      averageConnectionAge: activeConnections.reduce((sum, conn) => {
        return sum + (now.getTime() - conn.lastActivity.getTime());
      }, 0) / (activeConnections.length || 1),
      workflowEngine: 'langgraph',
      version: '1.0.0'
    };
  }
}