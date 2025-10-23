import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createChatGraph } from '../graph/chatGraph';
import { ChatState } from '../graph/state/chatState';
import config from '../config/config';
import logger from '../utils/logger';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatModel } from '../models/chat';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  currentChatId?: string;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: 'message' | 'join_room' | 'create_room' | 'send_message' | 'stop_generation' | 'ping';
  // Legacy format (from frontend)
  text?: string;
  chatId?: string;
  agent_id?: string;
  images?: Array<{ url: string; mediaType: string }>;
  // New format
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
 * Supports both legacy and new WebSocket protocols
 */
export class WebSocketController {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private chatRooms: Map<string, Set<string>> = new Map(); // chatId -> Set<sessionId>
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
        case 'message':
          // Legacy format: { type: 'message', text: '...', chatId: '...', agent_id: '...' }
          await this.handleLegacyMessage(ws, message);
          break;

        case 'join_room':
          // Frontend sends join_room when entering a chat
          await this.handleJoinRoom(ws, message);
          break;

        case 'create_room':
          // Frontend sends create_room to create a new chat session
          await this.handleCreateRoom(ws, message);
          break;

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
   * Handle create_room request (from frontend)
   */
  private async handleCreateRoom(
    ws: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    const userId = ws.userId!;
    const agentId = message.agent_id;

    if (!agentId) {
      return this.sendError(ws, 'Missing agentId', 'agent_id is required for create_room');
    }

    try {
      // Create new chat in database
      const newChat = await ChatModel.create({
        userId,
        name: 'New Chat',
        agentId,
        messages: [],
        isPinned: false,
      });

      const chatId = newChat._id.toString();

      // Store current chat ID
      ws.currentChatId = chatId;

      // Add to chat room
      if (!this.chatRooms.has(chatId)) {
        this.chatRooms.set(chatId, new Set());
      }
      this.chatRooms.get(chatId)!.add(ws.sessionId!);

      logger.info('✅ Room created successfully', {
        userId,
        sessionId: ws.sessionId,
        chatId,
        agentId,
      });

      // Send room_created confirmation
      this.sendToClient(ws, {
        type: 'room_created',
        data: { chatId, agentId },
      });
    } catch (error: any) {
      logger.error('❌ Error creating room', {
        userId,
        error: error.message,
      });
      this.sendError(ws, 'Failed to create room', error.message);
    }
  }

  /**
   * Handle join_room request (from frontend)
   */
  private async handleJoinRoom(
    ws: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    const chatId = message.chatId;

    if (!chatId) {
      return this.sendError(ws, 'Missing chatId', 'chatId is required for join_room');
    }

    // Verify chat exists and user has access
    try {
      const chat = await ChatModel.findOne({ _id: chatId, userId: ws.userId });
      if (!chat) {
        return this.sendError(ws, 'Chat not found', 'Chat does not exist or access denied');
      }

      // Store current chat ID
      ws.currentChatId = chatId;

      // Add to chat room
      if (!this.chatRooms.has(chatId)) {
        this.chatRooms.set(chatId, new Set());
      }
      this.chatRooms.get(chatId)!.add(ws.sessionId!);

      logger.info('✅ Client joined chat room', {
        userId: ws.userId,
        sessionId: ws.sessionId,
        chatId,
      });

      // Send confirmation
      this.sendToClient(ws, {
        type: 'room_joined',
        data: { chatId },
      });

      // Send accepted confirmation (for compatibility)
      this.sendToClient(ws, {
        type: 'accepted',
        data: { chatId },
      });
    } catch (error: any) {
      logger.error('❌ Error joining room', {
        userId: ws.userId,
        chatId,
        error: error.message,
      });
      this.sendError(ws, 'Failed to join room', error.message);
    }
  }

  /**
   * Handle legacy message format (from frontend)
   */
  private async handleLegacyMessage(
    ws: AuthenticatedWebSocket,
    message: WebSocketMessage
  ): Promise<void> {
    const userMessage = message.text;
    const chatId = message.chatId;
    const agentId = message.agent_id;
    const images = message.images || [];

    if (!userMessage || !chatId) {
      return this.sendError(ws, 'Missing required fields', 'text and chatId are required');
    }

    const userId = ws.userId!;
    const messageId = uuidv4();
    const assistantMessageId = uuidv4();

    // Create abort controller for this generation
    const abortController = new AbortController();
    this.activeGenerations.set(assistantMessageId, abortController);

    try {
      // Create user message in database
      const userMsg = {
        id: messageId,
        role: 'user' as const,
        content: userMessage,
        timestamp: new Date(),
        images: images.length > 0 ? images : undefined,
      };

      // Save user message to database
      await ChatModel.findByIdAndUpdate(
        chatId,
        {
          $push: { messages: userMsg },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, new: true }
      );

      // Send message_added event for user message
      this.sendToClient(ws, {
        type: 'message_added',
        data: {
          message: {
            id: messageId,
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString(),
            images: images.length > 0 ? images : undefined,
            isStreaming: false,
            isComplete: true,
          },
        },
      });

      // Create initial assistant message
      const assistantMsg = {
        id: assistantMessageId,
        role: 'assistant' as const,
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        isComplete: false,
      };

      // Save assistant message to database
      await ChatModel.findByIdAndUpdate(
        chatId,
        {
          $push: { messages: assistantMsg },
        }
      );

      // Send message_added event for assistant message
      this.sendToClient(ws, {
        type: 'message_added',
        data: {
          message: {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: true,
            isComplete: false,
          },
        },
      });

      // Create chat graph
      const chatGraph = await createChatGraph();

      // Get chat history for context
      const chatDoc = await ChatModel.findById(chatId).lean();
      const chatHistory = chatDoc?.messages || [];

      // Convert to LangChain messages
      const messages = chatHistory.map((msg: any) => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else {
          return new AIMessage(msg.content);
        }
      });

      // Initial state
      const initialState: Partial<ChatState> = {
        messages: [...messages, new HumanMessage(userMessage)],
        chatId,
        userId,
        sessionId: chatId,
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
      let fullContent = '';

      const stream = await chatGraph.stream(initialState, {
        configurable: {
          thread_id: chatId,
          checkpoint_ns: userId,
        },
        signal: abortController.signal,
      });

      // Process stream chunks
      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          logger.info('⏹️ Generation stopped by user', {
            assistantMessageId,
            chatId,
            userId,
          });
          break;
        }

        // Extract content from chunk
        const nodeNames = Object.keys(chunk);
        for (const nodeName of nodeNames) {
          const nodeData = chunk[nodeName];

          // Handle agent node output
          if (nodeName === 'agent' && nodeData.messages) {
            const lastMessage = nodeData.messages[nodeData.messages.length - 1];
            if (lastMessage && lastMessage.content) {
              const newContent = lastMessage.content;
              fullContent = newContent;

              // Send streaming update
              this.sendToClient(ws, {
                type: 'message_updated',
                data: {
                  messageId: assistantMessageId,
                  content: fullContent,
                  isStreaming: true,
                },
              });

              // Update database
              await ChatModel.findOneAndUpdate(
                { _id: chatId, 'messages.id': assistantMessageId },
                {
                  $set: {
                    'messages.$.content': fullContent,
                    'messages.$.isStreaming': true,
                  },
                }
              );
            }
          }

          // Handle tool execution events
          if (nodeName === 'tools' && nodeData.toolCalls) {
            for (const toolCall of nodeData.toolCalls) {
              // Send tool_start event
              this.sendToClient(ws, {
                type: 'tool_start',
                data: {
                  tool_name: toolCall.name,
                  tool_input: JSON.stringify(toolCall.args),
                },
              });

              // Send tool_result event (if available)
              if (toolCall.output) {
                this.sendToClient(ws, {
                  type: 'tool_result',
                  data: {
                    tool_name: toolCall.name,
                    output: toolCall.output,
                  },
                });
              }
            }
          }
        }
      }

      // Send completion event
      if (!abortController.signal.aborted) {
        // Update final message in database
        await ChatModel.findOneAndUpdate(
          { _id: chatId, 'messages.id': assistantMessageId },
          {
            $set: {
              'messages.$.content': fullContent,
              'messages.$.isStreaming': false,
              'messages.$.isComplete': true,
            },
          }
        );

        this.sendToClient(ws, {
          type: 'message_completed',
          data: {
            messageId: assistantMessageId,
            content: fullContent,
          },
        });
      }
    } catch (error: any) {
      logger.error('❌ Error processing legacy message', {
        userId,
        chatId,
        messageId: assistantMessageId,
        error: error.message,
        stack: error.stack,
      });

      this.sendToClient(ws, {
        type: 'message_error',
        data: {
          messageId: assistantMessageId,
          chatId,
          error: error.message,
        },
      });
    } finally {
      // Clean up
      this.activeGenerations.delete(assistantMessageId);
    }
  }

  /**
   * Handle send_message request (new format)
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

      // Create chat graph
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
    const chatId = ws.currentChatId;

    // Abort any active generations
    for (const [messageId, abortController] of this.activeGenerations.entries()) {
      abortController.abort();
      this.activeGenerations.delete(messageId);
    }

    // Remove from chat room
    if (chatId && this.chatRooms.has(chatId)) {
      this.chatRooms.get(chatId)!.delete(sessionId);
      if (this.chatRooms.get(chatId)!.size === 0) {
        this.chatRooms.delete(chatId);
      }
    }

    // Remove client
    this.clients.delete(sessionId);

    logger.info('👋 WebSocket client disconnected', {
      userId,
      sessionId,
      chatId,
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
    this.chatRooms.clear();

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
