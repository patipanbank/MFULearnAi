/**
 * ConversationWebSocket - New Reliable WebSocket System
 *
 * ระบบ WebSocket ใหม่ที่มี reliability, heartbeat และ error recovery
 * ออกแบบให้รองรับ conversation workflow และ streaming
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  WebSocketMessage,
  WebSocketResponse,
  StreamingEvent,
  StreamingEventType,
  ErrorCode,
  ErrorDetails
} from '../types';

// ============= INTERFACES =============

interface ConnectionInfo {
  id: string;
  ws: WebSocket;
  userId: string;
  conversationId?: string;
  isAuthenticated: boolean;
  isAlive: boolean;
  lastHeartbeat: Date;
  metadata: ConnectionMetadata;
}

interface ConnectionMetadata {
  userAgent?: string;
  ipAddress?: string;
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
  errorCount: number;
}

interface ConversationRoom {
  id: string;
  connections: Set<string>;
  createdAt: Date;
  lastActivity: Date;
  messageCount: number;
}

// ============= MAIN CLASS =============

export class ConversationWebSocket extends EventEmitter {
  private wss: WebSocketServer;
  private connections: Map<string, ConnectionInfo> = new Map();
  private rooms: Map<string, ConversationRoom> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();

  // Configuration
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds
  private readonly MAX_CONNECTIONS_PER_USER = 5;
  private readonly MESSAGE_RATE_LIMIT = 10; // messages per minute

  // Timers
  private heartbeatTimer!: NodeJS.Timeout;
  private cleanupTimer!: NodeJS.Timeout;

  constructor(server: any) {
    super();

    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      clientTracking: true
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startCleanup();

    console.log('✅ ConversationWebSocket initialized');
  }

  // ============= SERVER SETUP =============

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('❌ WebSocket Server Error:', error);
      this.emit('server_error', error);
    });

    console.log('🌐 WebSocket server listening on /ws');
  }

  // ============= CONNECTION HANDLING =============

  private async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const connectionId = uuidv4();
    const startTime = Date.now();

    try {
      // Extract and validate token
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        this.closeWithError(ws, ErrorCode.AUTH_FAILED, 'No authentication token provided');
        return;
      }

      // Verify JWT token
      const user = await this.verifyToken(token);
      if (!user) {
        this.closeWithError(ws, ErrorCode.AUTH_FAILED, 'Invalid authentication token');
        return;
      }

      // Check connection limits
      if (!this.checkConnectionLimits(user.id)) {
        this.closeWithError(ws, ErrorCode.RATE_LIMIT_EXCEEDED, 'Too many connections for this user');
        return;
      }

      // Create connection info
      const connectionInfo: ConnectionInfo = {
        id: connectionId,
        ws,
        userId: user.id,
        isAuthenticated: true,
        isAlive: true,
        lastHeartbeat: new Date(),
        metadata: {
          userAgent: request.headers['user-agent'],
          ipAddress: this.getClientIP(request),
          connectedAt: new Date(),
          lastActivity: new Date(),
          messageCount: 0,
          errorCount: 0
        }
      };

      // Store connection
      this.connections.set(connectionId, connectionInfo);
      this.addUserConnection(user.id, connectionId);

      // Setup connection event handlers
      this.setupConnectionHandlers(connectionId);

      // Send connection success
      this.sendToConnection(connectionId, {
        type: 'connection_established',
        data: {
          connectionId,
          serverTime: new Date().toISOString()
        },
        success: true,
        timestamp: new Date().toISOString()
      });

      const duration = Date.now() - startTime;
      console.log(`✅ WebSocket connection established: ${connectionId} for user ${user.id} (${duration}ms)`);

      this.emit('connection_established', { connectionId, userId: user.id });

    } catch (error) {
      console.error('❌ Error handling WebSocket connection:', error);
      this.closeWithError(ws, ErrorCode.INTERNAL_ERROR, 'Connection setup failed');
    }
  }

  private setupConnectionHandlers(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { ws } = connection;

    // Message handler
    ws.on('message', (data: Buffer) => {
      this.handleMessage(connectionId, data.toString());
    });

    // Pong handler (heartbeat response)
    ws.on('pong', () => {
      this.handlePong(connectionId);
    });

    // Close handler
    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(connectionId, code, reason.toString());
    });

    // Error handler
    ws.on('error', (error: Error) => {
      this.handleConnectionError(connectionId, error);
    });
  }

  // ============= MESSAGE HANDLING =============

  private async handleMessage(connectionId: string, message: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Update activity
      connection.metadata.lastActivity = new Date();
      connection.metadata.messageCount++;

      // Parse message
      const data: WebSocketMessage = JSON.parse(message);

      // Validate message
      if (!this.validateMessage(data)) {
        this.sendError(connectionId, ErrorCode.INVALID_INPUT, 'Invalid message format');
        return;
      }

      // Check rate limits
      if (!this.checkRateLimit(connectionId)) {
        this.sendError(connectionId, ErrorCode.RATE_LIMIT_EXCEEDED, 'Message rate limit exceeded');
        return;
      }

      console.log(`📨 Received message: ${data.type} from ${connectionId}`);

      // Route message based on type
      await this.routeMessage(connectionId, data);

    } catch (error) {
      console.error(`❌ Error handling message from ${connectionId}:`, error);
      connection.metadata.errorCount++;
      this.sendError(connectionId, ErrorCode.INVALID_INPUT, 'Failed to process message');
    }
  }

  private async routeMessage(connectionId: string, message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'heartbeat':
        this.handleHeartbeat(connectionId);
        break;

      case 'join_conversation':
        await this.handleJoinConversation(connectionId, message);
        break;

      case 'leave_conversation':
        this.handleLeaveConversation(connectionId);
        break;

      case 'send_message':
        await this.handleSendMessage(connectionId, message);
        break;

      case 'typing_start':
        this.handleTypingStart(connectionId);
        break;

      case 'typing_stop':
        this.handleTypingStop(connectionId);
        break;

      default:
        this.sendError(connectionId, ErrorCode.INVALID_INPUT, `Unknown message type: ${message.type}`);
    }
  }

  // ============= MESSAGE HANDLERS =============

  private handleHeartbeat(connectionId: string): void {
    this.sendToConnection(connectionId, {
      type: 'heartbeat_ack',
      data: { timestamp: new Date().toISOString() },
      success: true,
      timestamp: new Date().toISOString()
    });
  }

  private async handleJoinConversation(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const conversationId = message.conversationId;
    if (!conversationId) {
      this.sendError(connectionId, ErrorCode.INVALID_INPUT, 'Conversation ID required');
      return;
    }

    try {
      // Leave current conversation if any
      if (connection.conversationId) {
        this.leaveRoom(connectionId, connection.conversationId);
      }

      // Join new conversation
      connection.conversationId = conversationId;
      this.joinRoom(connectionId, conversationId);

      this.sendToConnection(connectionId, {
        type: 'conversation_joined',
        conversationId,
        data: { conversationId },
        success: true,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ User ${connection.userId} joined conversation ${conversationId}`);

    } catch (error) {
      this.sendError(connectionId, ErrorCode.INTERNAL_ERROR, 'Failed to join conversation');
    }
  }

  private handleLeaveConversation(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.conversationId) return;

    const conversationId = connection.conversationId;
    this.leaveRoom(connectionId, conversationId);
    connection.conversationId = undefined;

    this.sendToConnection(connectionId, {
      type: 'conversation_left',
      data: { conversationId },
      success: true,
      timestamp: new Date().toISOString()
    });

    console.log(`👋 User ${connection.userId} left conversation ${conversationId}`);
  }

  private async handleSendMessage(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.conversationId) {
      this.sendError(connectionId, ErrorCode.INVALID_INPUT, 'Not in a conversation');
      return;
    }

    try {
      // Emit message event for processing
      this.emit('message_received', {
        connectionId,
        userId: connection.userId,
        conversationId: connection.conversationId,
        message: message.data,
        timestamp: new Date()
      });

      // Send acknowledgment
      this.sendToConnection(connectionId, {
        type: 'message_acknowledged',
        conversationId: connection.conversationId,
        messageId: message.messageId,
        data: { received: true },
        success: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.sendError(connectionId, ErrorCode.INTERNAL_ERROR, 'Failed to process message');
    }
  }

  private handleTypingStart(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.conversationId) return;

    this.broadcastToRoom(connection.conversationId, {
      type: 'user_typing_start',
      conversationId: connection.conversationId,
      data: { userId: connection.userId },
      success: true,
      timestamp: new Date().toISOString()
    }, connectionId); // Exclude sender
  }

  private handleTypingStop(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.conversationId) return;

    this.broadcastToRoom(connection.conversationId, {
      type: 'user_typing_stop',
      conversationId: connection.conversationId,
      data: { userId: connection.userId },
      success: true,
      timestamp: new Date().toISOString()
    }, connectionId); // Exclude sender
  }

  // ============= ROOM MANAGEMENT =============

  private joinRoom(connectionId: string, conversationId: string): void {
    let room = this.rooms.get(conversationId);
    if (!room) {
      room = {
        id: conversationId,
        connections: new Set(),
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0
      };
      this.rooms.set(conversationId, room);
    }

    room.connections.add(connectionId);
    room.lastActivity = new Date();

    console.log(`🏠 Connection ${connectionId} joined room ${conversationId} (${room.connections.size} total)`);
  }

  private leaveRoom(connectionId: string, conversationId: string): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;

    room.connections.delete(connectionId);
    room.lastActivity = new Date();

    if (room.connections.size === 0) {
      this.rooms.delete(conversationId);
      console.log(`🏠 Room ${conversationId} deleted (empty)`);
    } else {
      console.log(`🏠 Connection ${connectionId} left room ${conversationId} (${room.connections.size} remaining)`);
    }
  }

  // ============= BROADCASTING =============

  public broadcastToRoom(conversationId: string, message: WebSocketResponse, excludeConnectionId?: string): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;

    let sentCount = 0;
    const deadConnections: string[] = [];

    for (const connectionId of room.connections) {
      if (excludeConnectionId && connectionId === excludeConnectionId) {
        continue;
      }

      if (this.sendToConnection(connectionId, message)) {
        sentCount++;
      } else {
        deadConnections.push(connectionId);
      }
    }

    // Clean up dead connections
    deadConnections.forEach(connectionId => {
      this.handleDisconnection(connectionId, 1006, 'Connection lost');
    });

    if (sentCount > 0) {
      console.log(`📤 Broadcasted to ${sentCount} connections in room ${conversationId}`);
    }
  }

  public sendToConnection(connectionId: string, message: WebSocketResponse): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message to ${connectionId}:`, error);
      return false;
    }
  }

  // ============= HEARTBEAT & CLEANUP =============

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private performHeartbeat(): void {
    const deadConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      if (!connection.isAlive) {
        deadConnections.push(connectionId);
        continue;
      }

      connection.isAlive = false;
      try {
        connection.ws.ping();
      } catch (error) {
        deadConnections.push(connectionId);
      }
    }

    // Remove dead connections
    deadConnections.forEach(connectionId => {
      this.handleDisconnection(connectionId, 1006, 'Heartbeat timeout');
    });

    if (deadConnections.length > 0) {
      console.log(`💀 Removed ${deadConnections.length} dead connections`);
    }
  }

  private handlePong(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isAlive = true;
      connection.lastHeartbeat = new Date();
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private performCleanup(): void {
    // Clean up inactive rooms
    let roomsDeleted = 0;
    for (const [conversationId, room] of this.rooms) {
      const inactiveTime = Date.now() - room.lastActivity.getTime();
      if (inactiveTime > 60 * 60 * 1000 && room.connections.size === 0) { // 1 hour
        this.rooms.delete(conversationId);
        roomsDeleted++;
      }
    }

    if (roomsDeleted > 0) {
      console.log(`🧹 Cleaned up ${roomsDeleted} inactive rooms`);
    }
  }

  // ============= UTILITY METHODS =============

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

  private checkConnectionLimits(userId: string): boolean {
    const userConnections = this.userConnections.get(userId);
    return !userConnections || userConnections.size < this.MAX_CONNECTIONS_PER_USER;
  }

  private checkRateLimit(connectionId: string): boolean {
    // Simple rate limiting - could be enhanced with Redis
    return true; // Placeholder
  }

  private validateMessage(message: any): message is WebSocketMessage {
    return message && typeof message.type === 'string';
  }

  private getClientIP(request: IncomingMessage): string {
    return (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           request.socket.remoteAddress ||
           'unknown';
  }

  private addUserConnection(userId: string, connectionId: string): void {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);
  }

  private removeUserConnection(userId: string, connectionId: string): void {
    const userConnections = this.userConnections.get(userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(userId);
      }
    }
  }

  // ============= ERROR HANDLING =============

  private sendError(connectionId: string, code: ErrorCode, message: string): void {
    const errorDetails: ErrorDetails = {
      code,
      message,
      timestamp: new Date(),
      retryable: code !== ErrorCode.AUTH_FAILED
    };

    this.sendToConnection(connectionId, {
      type: 'error',
      data: errorDetails,
      success: false,
      error: errorDetails,
      timestamp: new Date().toISOString()
    });
  }

  private closeWithError(ws: WebSocket, code: ErrorCode, message: string): void {
    try {
      ws.send(JSON.stringify({
        type: 'error',
        data: { code, message },
        success: false,
        timestamp: new Date().toISOString()
      }));
      ws.close(1008, message);
    } catch (error) {
      ws.close(1008, message);
    }
  }

  private handleConnectionError(connectionId: string, error: Error): void {
    console.error(`❌ WebSocket connection error ${connectionId}:`, error);
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.metadata.errorCount++;
    }
    this.emit('connection_error', { connectionId, error });
  }

  private handleDisconnection(connectionId: string, code: number, reason: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Leave conversation if in one
    if (connection.conversationId) {
      this.leaveRoom(connectionId, connection.conversationId);
    }

    // Remove from user connections
    this.removeUserConnection(connection.userId, connectionId);

    // Remove from connections
    this.connections.delete(connectionId);

    console.log(`👋 WebSocket disconnected: ${connectionId} (code: ${code}, reason: ${reason})`);

    this.emit('connection_closed', { connectionId, userId: connection.userId, code, reason });
  }

  // ============= PUBLIC API =============

  public getStats(): any {
    return {
      totalConnections: this.connections.size,
      totalRooms: this.rooms.size,
      authenticatedConnections: Array.from(this.connections.values()).filter(c => c.isAuthenticated).length,
      totalUsers: this.userConnections.size
    };
  }

  public getRoomStats(conversationId: string): any {
    const room = this.rooms.get(conversationId);
    return room ? {
      connectionCount: room.connections.size,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      messageCount: room.messageCount
    } : null;
  }

  // ============= CLEANUP =============

  public async shutdown(): Promise<void> {
    console.log('🔌 Shutting down ConversationWebSocket...');

    // Stop timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.ws.close(1001, 'Server shutdown');
      } catch (error) {
        // Ignore errors during shutdown
      }
    }

    // Close server
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log('🔌 ConversationWebSocket shut down complete');
        resolve();
      });
    });
  }
}