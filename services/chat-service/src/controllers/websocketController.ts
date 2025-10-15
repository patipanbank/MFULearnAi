import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createChatGraph } from '../graph/chatGraph';
import { StreamingCallbackHandler } from '../callbacks/streamingCallback';
import { ChatState } from '../graph/state/chatState';
import config from '../config/config';
import logger from '../utils/logger';
import { HumanMessage } from '@langchain/core/messages';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: 'send_message' | 'stop_generation' | 'ping';
  data?: {
    message?: string;
    chatId?: string;
    agentId?: string;
    sessionId?: string;
  };
}

/**
 * WebSocket Controller
 * Handles real-time chat communication with streaming responses
 */
export class WebSocketController {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private activeGenerations: Map<string, AbortController> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/chat',
      verifyClient: this.verifyClient.bind(this),
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();

    logger.info('✅ WebSocket server initialized', { path: '/ws/chat' });
  }

  /**
   * Verify client authentication via JWT token
   */
  private verifyClient(
    info: { origin: string; secure: boolean; req: any },
    callback: (result: boolean, code?: number, message?: string) => void
  ): void {
    try {
      const url = new URL(info.req.url!, `ws://${info.req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        logger.warn('❌ WebSocket connection rejected: No token provided');
        return callback(false, 401, 'Authentication required');
      }

      // Verify JWT token
      jwt.verify(token, config.JWT_SECRET, (err, decoded: any) => {
        if (err) {
          logger.warn('❌ WebSocket connection rejected: Invalid token', {
            error: err.message,
          });
          return callback(false, 401, 'Invalid token');
        }

        // Store user info in request for later use
        info.req.userId = decoded.sub || decoded.id;
        info.req.sessionId = uuidv4();

        logger.info('✅ WebSocket client authenticated', {
          userId: info.req.userId,
          sessionId: info.req.sessionId,
        });

        callback(true);
      });
    } catch (error: any) {
      logger.error('❌ Error verifying WebSocket client', {
        error: error.message,
      });
      callback(false, 500, 'Internal server error');
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedWebSocket, req: any): void {
    const userId = req.userId;
    const sessionId = req.sessionId;

    ws.userId = userId;
    ws.sessionId = sessionId;
    ws.isAlive = true;

    this.clients.set(sessionId, ws);

    logger.info('✅ WebSocket client connected', {
      userId,
      sessionId,
      totalClients: this.clients.size,
    });

    // Send connection confirmation
    this.sendToClient(ws, {
      type: 'connection_established',
      data: { sessionId, userId },
    });

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data).catch((error) => {
        logger.error('❌ Error handling WebSocket message', {
          userId,
          sessionId,
          error: error.message,
        });
        this.sendError(ws, 'Failed to process message', error.message);
      });
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('❌ WebSocket error', {
        userId,
        sessionId,
        error: error.message,
      });
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(
    ws: AuthenticatedWebSocket,
    data: Buffer
  ): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      logger.debug('📥 WebSocket message received', {
        userId: ws.userId,
        sessionId: ws.sessionId,
        type: message.type,
      });

      switch (message.type) {
        case 'send_message':
          await this.handleSendMessage(ws, message);
          break;

        case 'stop_generation':
          await this.handleStopGeneration(ws, message);
          break;

        case 'ping':
          this.sendToClient(ws, { type: 'pong', data: {} });
          break;

        default:
          this.sendError(ws, 'Unknown message type', `Type: ${message.type}`);
      }
    } catch (error: any) {
      logger.error('❌ Error parsing WebSocket message', {
        userId: ws.userId,
        error: error.message,
      });
      this.sendError(ws, 'Invalid message format', error.message);
    }
  }

  /**
   * Handle send_message request
   */
  private async handleSendMessage(
    ws: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    const { message: userMessage, chatId, agentId, sessionId } = message.data || {};

    if (!userMessage || !chatId) {
      return this.sendError(ws, 'Missing required fields', 'message and chatId are required');
    }

    const userId = ws.userId!;
    const messageId = uuidv4();

    // Create abort controller for this generation
    const abortController = new AbortController();
    this.activeGenerations.set(messageId, abortController);

    try {
      // Send message start event
      this.sendToClient(ws, {
        type: 'message_start',
        data: { messageId, chatId },
      });

      // Create streaming callback handler
      const streamingCallback = new StreamingCallbackHandler({
        ws,
        chatId,
        messageId,
        userId,
      });

      // Create chat graph with checkpointer
      const chatGraph = await createChatGraph();

      // Initial state
      const initialState: Partial<ChatState> = {
        messages: [new HumanMessage(userMessage)],
        chatId,
        userId,
        sessionId: sessionId || chatId,
        agentId,
        tools: ['search_memory', 'rag_retrieval', 'calculator'],
        currentIteration: 0,
        maxIterations: config.MAX_ITERATIONS,
        shouldContinue: true,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      };

      // Stream graph execution
      const stream = await chatGraph.stream(initialState, {
        configurable: {
          thread_id: chatId,
          checkpoint_ns: userId,
        },
        callbacks: [streamingCallback],
        signal: abortController.signal,
      });

      // Process stream chunks
      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          logger.info('⏹️ Generation stopped by user', {
            messageId,
            chatId,
            userId,
          });
          break;
        }

        // Send state updates
        this.sendToClient(ws, {
          type: 'state_update',
          data: {
            messageId,
            node: Object.keys(chunk)[0],
            state: chunk,
          },
        });
      }

      // Send completion event
      if (!abortController.signal.aborted) {
        this.sendToClient(ws, {
          type: 'message_complete',
          data: { messageId, chatId },
        });
      }
    } catch (error: any) {
      logger.error('❌ Error processing message', {
        userId,
        chatId,
        messageId,
        error: error.message,
      });

      this.sendToClient(ws, {
        type: 'message_error',
        data: {
          messageId,
          chatId,
          error: error.message,
        },
      });
    } finally {
      // Clean up
      this.activeGenerations.delete(messageId);
    }
  }

  /**
   * Handle stop_generation request
   */
  private async handleStopGeneration(
    ws: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    const { sessionId } = message.data || {};

    if (!sessionId) {
      return this.sendError(ws, 'Missing sessionId', 'sessionId is required');
    }

    // Find and abort the active generation
    for (const [messageId, abortController] of this.activeGenerations.entries()) {
      abortController.abort();
      this.activeGenerations.delete(messageId);

      logger.info('⏹️ Generation stopped', {
        userId: ws.userId,
        sessionId: ws.sessionId,
        messageId,
      });

      this.sendToClient(ws, {
        type: 'generation_stopped',
        data: { messageId, sessionId },
      });
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    const sessionId = ws.sessionId!;
    const userId = ws.userId!;

    // Abort any active generations
    for (const [messageId, abortController] of this.activeGenerations.entries()) {
      abortController.abort();
      this.activeGenerations.delete(messageId);
    }

    // Remove client
    this.clients.delete(sessionId);

    logger.info('👋 WebSocket client disconnected', {
      userId,
      sessionId,
      totalClients: this.clients.size,
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  private sendError(ws: WebSocket, error: string, details?: string): void {
    this.sendToClient(ws, {
      type: 'error',
      data: { error, details },
    });
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          logger.warn('💔 Terminating dead WebSocket connection', {
            userId: ws.userId,
            sessionId: ws.sessionId,
          });
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  /**
   * Cleanup and close WebSocket server
   */
  public async close(): Promise<void> {
    logger.info('🛑 Closing WebSocket server...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Abort all active generations
    for (const abortController of this.activeGenerations.values()) {
      abortController.abort();
    }
    this.activeGenerations.clear();

    // Close all client connections
    for (const ws of this.clients.values()) {
      ws.close(1000, 'Server shutting down');
    }
    this.clients.clear();

    // Close WebSocket server
    await new Promise<void>((resolve, reject) => {
      this.wss.close((err) => {
        if (err) {
          logger.error('❌ Error closing WebSocket server', {
            error: err.message,
          });
          reject(err);
        } else {
          logger.info('✅ WebSocket server closed');
          resolve();
        }
      });
    });
  }
}
