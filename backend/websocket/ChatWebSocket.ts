import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { chatService } from '../services/chat';
import { usageService } from '../services/usage.service';
import { AuthUser, ChatMessagePayload, WSChatMessage } from '../types/common';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const HEARTBEAT_INTERVAL = 30000;
const WS_PORT = 5001;

/**
 * Extended WebSocket interface with custom properties
 */
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: string;
  chatId?: string;
}

/**
 * Chat WebSocket server handler
 */
class ChatWebSocketServer {
  private wss: WebSocketServer;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.wss = new WebSocketServer({
      port: WS_PORT,
      path: '/ws',
      clientTracking: true,
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupEventHandlers();
    this.startHeartbeat();

    console.log(`WebSocket server started on port ${WS_PORT}`);
  }

  /**
   * Verify client connection with JWT token
   */
  private verifyClient(
    info: { req: IncomingMessage },
    callback: (result: boolean, code?: number, message?: string) => void
  ): void {
    try {
      const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        callback(false, 401, 'No token provided');
        return;
      }

      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      (info.req as any).user = decoded;
      callback(true);
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      callback(false, 401, 'Invalid token');
    }
  }

  /**
   * Set up WebSocket server event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('close', () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
    });
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const extWs = ws as ExtendedWebSocket;
        if (!extWs.isAlive) {
          return ws.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
      });
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const extWs = ws as ExtendedWebSocket;
    extWs.isAlive = true;

    // Extract connection parameters
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const urlChatId = url.searchParams.get('chat');

    if (!token) {
      ws.close(1008, 'No authentication token');
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      extWs.userId = decoded.username;

      // Validate and set chatId if provided
      if (urlChatId && this.isValidObjectId(urlChatId)) {
        extWs.chatId = urlChatId;
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      ws.close(1008, 'Invalid token');
      return;
    }

    // Set up connection event handlers
    extWs.on('pong', () => {
      extWs.isAlive = true;
    });

    extWs.on('error', (error) => {
      console.error(`WebSocket error for user ${extWs.userId}:`, error);
    });

    extWs.on('message', (message: string) => {
      this.handleMessage(extWs, message);
    });
  }

  /**
   * Validate MongoDB ObjectId format
   */
  private isValidObjectId(id: string | null): boolean {
    if (!id) return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(ws: ExtendedWebSocket, rawMessage: string): Promise<void> {
    try {
      const data: WSChatMessage = JSON.parse(rawMessage.toString());
      const userId = ws.userId;

      // Handle different message types
      switch (data.type) {
        case 'message_edited':
          this.handleMessageEdited(ws, data);
          return;
        
        case 'cancel':
          console.log(`User ${userId} cancelled generation for chat ${data.chatId}`);
          return;
        
        default:
          await this.handleChatMessage(ws, data);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      this.sendError(ws, error instanceof Error ? error.message : 'Invalid message format');
    }
  }

  /**
   * Handle message edit event
   */
  private handleMessageEdited(ws: ExtendedWebSocket, data: WSChatMessage): void {
    console.log(`User ${ws.userId} edited message in chat ${data.chatId}`);

    // Broadcast to other clients of same user
    this.broadcastToUser(ws.userId!, {
      type: 'message_edited',
      chatId: data.chatId,
      messageId: (data as any).messageId,
      content: data.content,
    }, ws);
  }

  /**
   * Handle chat message and generate response
   */
  private async handleChatMessage(ws: ExtendedWebSocket, data: WSChatMessage): Promise<void> {
    const userId = ws.userId!;

    // Check user limits
    const hasRemaining = await usageService.checkUserLimit(userId);
    if (!hasRemaining) {
      this.sendError(ws, 'You have used all your quota for today. Please wait until tomorrow.');
      return;
    }

    const { messages, modelId, isImageGeneration, chatId } = data as any;

    if (!messages || !Array.isArray(messages)) {
      this.sendError(ws, 'Invalid messages format');
      return;
    }

    if (!modelId) {
      this.sendError(ws, 'ModelId is required');
      return;
    }

    try {
      let currentChatId: string;
      
      // Create or update chat
      if (!chatId) {
        const savedChat = await chatService.saveChat(userId, modelId, messages);
        currentChatId = savedChat._id.toString();
        
        this.send(ws, {
          type: 'chat_created',
          chatId: currentChatId,
        });
      } else {
        await chatService.updateChat(chatId, userId, messages);
        currentChatId = chatId;
      }

      // Generate response
      const query = isImageGeneration
        ? messages[messages.length - 1].content
        : messages.map((msg: ChatMessagePayload) => msg.content).join('\n');

      let assistantResponse = '';
      let isCancelled = false;

      // Cancel listener
      const cancelListener = (cancelMsg: string) => {
        try {
          const cancelData = JSON.parse(cancelMsg.toString());
          if (cancelData.type === 'cancel' && cancelData.chatId === currentChatId) {
            isCancelled = true;
          }
        } catch (error) {
          // Ignore parse errors
        }
      };

      ws.on('message', cancelListener);

      try {
        for await (const content of chatService.generateResponse(messages, query, modelId, userId)) {
          if (isCancelled) break;

          assistantResponse += content;
          this.send(ws, { type: 'content', content });
        }
      } finally {
        ws.removeListener('message', cancelListener);
      }

      if (isCancelled) {
        console.log(`Generation cancelled for chat ${currentChatId}`);
        return;
      }

      // Save final response
      const allMessages = [...messages, {
        id: messages.length + 1,
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
        sources: [],
        isImageGeneration: isImageGeneration || false,
        isComplete: true,
      }];

      await chatService.updateChat(currentChatId, userId, allMessages);

      // Send completion
      this.send(ws, {
        type: 'complete',
        chatId: currentChatId,
        shouldUpdateList: true,
        timestamp: new Date().toISOString(),
      });

      // Notify other clients
      this.broadcastToUser(userId, {
        type: 'chat_updated',
        shouldUpdateList: true,
        timestamp: new Date().toISOString(),
      }, ws);

    } catch (error) {
      console.error('Error generating response:', error);
      this.sendError(ws, 'Error generating response');
    }
  }

  /**
   * Send message to WebSocket client
   */
  private send(ws: ExtendedWebSocket, message: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  private sendError(ws: ExtendedWebSocket, error: string): void {
    this.send(ws, { type: 'error', error });
  }

  /**
   * Broadcast message to all connections of a specific user
   */
  private broadcastToUser(
    userId: string,
    message: object,
    excludeWs?: ExtendedWebSocket
  ): void {
    this.wss.clients.forEach((client: WebSocket) => {
      const extClient = client as ExtendedWebSocket;
      if (extClient.userId === userId && extClient !== excludeWs) {
        this.send(extClient, message);
      }
    });
  }

  /**
   * Get WebSocket server instance
   */
  public getServer(): WebSocketServer {
    return this.wss;
  }
}

// Export singleton instance
export const chatWebSocket = new ChatWebSocketServer();
