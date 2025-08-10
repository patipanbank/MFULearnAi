import { WebSocket } from 'ws';
import { redis as sharedRedis } from '../lib/redis';
import { EventEmitter } from 'events';

interface WebSocketConnection {
  ws: WebSocket;
  userId: string;
  sessionId?: string;
  isAlive: boolean;
}

export class WebSocketManager extends EventEmitter {
  private connections: Map<string, WebSocketConnection> = new Map();
  private sessionConnections: Map<string, Set<string>> = new Map();
  private redisClient: any;
  private redisSubscriber: any;
  private isRedisConnected = false;

  constructor() {
    super();
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Reuse shared ioredis instance for publish; create a lightweight subscriber for pattern subscribe
      this.redisClient = sharedRedis; // ioredis instance
      this.redisSubscriber = sharedRedis.duplicate();

      // Subscribe pattern and handle messages via 'pmessage' event (ioredis semantics)
      await this.redisSubscriber.psubscribe('chat:*');
      this.redisSubscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
        try {
          const sessionId = typeof channel === 'string' ? channel.replace('chat:', '') : '';
          if (sessionId) {
            this.broadcastToSession(sessionId, message);
          }
        } catch (err) {
          console.error('❌ Error handling pmessage:', err);
        }
      });

      this.isRedisConnected = true;
      console.log('✅ Redis connected and subscribed to chat channels');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      this.isRedisConnected = false;
    }
  }

  public addConnection(connectionId: string, ws: WebSocket, userId: string): void {
    const connection: WebSocketConnection = {
      ws,
      userId,
      isAlive: true
    };

    this.connections.set(connectionId, connection);

    // Set up ping/pong for connection health
    ws.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.isAlive = true;
      }
    });

    // Handle connection close
    ws.on('close', () => {
      this.removeConnection(connectionId);
    });

    console.log(`✅ WebSocket connected: ${connectionId} for user: ${userId}`);
  }

  public joinSession(connectionId: string, sessionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`⚠️ Connection ${connectionId} not found`);
      return;
    }

    connection.sessionId = sessionId;

    if (!this.sessionConnections.has(sessionId)) {
      this.sessionConnections.set(sessionId, new Set());
    }
    this.sessionConnections.get(sessionId)!.add(connectionId);

    console.log(`✅ User ${connection.userId} joined session ${sessionId}`);
  }

  // Legacy method for backward compatibility
  public connect(sessionId: string, ws: WebSocket): void {
    // This method is for legacy compatibility
    // In the new implementation, we use connectionId-based approach
    console.log(`🔗 Legacy connect called for session ${sessionId}`);
  }

  public leaveSession(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.sessionId) {
      return;
    }

    const sessionId = connection.sessionId;
    const sessionConnections = this.sessionConnections.get(sessionId);
    if (sessionConnections) {
      sessionConnections.delete(connectionId);
      if (sessionConnections.size === 0) {
        this.sessionConnections.delete(sessionId);
      }
    }

    connection.sessionId = undefined;
    console.log(`👋 User ${connection.userId} left session ${sessionId}`);
  }

  public removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Leave session if connected to one
    if (connection.sessionId) {
      this.leaveSession(connectionId);
    }

    this.connections.delete(connectionId);
    console.log(`❌ WebSocket disconnected: ${connectionId}`);
  }

  public sendToConnection(connectionId: string, message: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      connection.ws.send(message);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send message to ${connectionId}:`, error);
      this.removeConnection(connectionId);
      return false;
    }
  }

  public broadcastToSession(sessionId: string, message: string): void {
    const sessionConnections = this.sessionConnections.get(sessionId);
    if (!sessionConnections) {
      console.log(`⚠️ No connections for session ${sessionId}`);
      return;
    }

    const deadConnections: string[] = [];
    let sentCount = 0;

    for (const connectionId of sessionConnections) {
      if (this.sendToConnection(connectionId, message)) {
        sentCount++;
      } else {
        deadConnections.push(connectionId);
      }
    }

    // Clean up dead connections
    deadConnections.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    console.log(`📤 Broadcasted to ${sentCount} connections in session ${sessionId}`);
  }

  // Legacy method for backward compatibility
  public broadcast(sessionId: string, message: string): void {
    this.broadcastToSession(sessionId, message);
  }

  public broadcastToUser(userId: string, message: string): void {
    let sentCount = 0;
    const deadConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      if (connection.userId === userId) {
        if (this.sendToConnection(connectionId, message)) {
          sentCount++;
        } else {
          deadConnections.push(connectionId);
        }
      }
    }

    // Clean up dead connections
    deadConnections.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    console.log(`📤 Broadcasted to ${sentCount} connections for user ${userId}`);
  }

  public publishToRedis(channel: string, message: string): void {
    if (!this.isRedisConnected || !this.redisClient) {
      console.warn('⚠️ Redis not connected, cannot publish message');
      return;
    }

    this.redisClient.publish(channel, message)
      .catch((error: any) => {
        console.error(`❌ Failed to publish to Redis:`, error);
      });
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getSessionConnectionCount(sessionId: string): number {
    const sessionConnections = this.sessionConnections.get(sessionId);
    return sessionConnections ? sessionConnections.size : 0;
  }

  public getConnectionInfo(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  // Health check for connections
  public pingConnections(): void {
    for (const [connectionId, connection] of this.connections) {
      if (!connection.isAlive) {
        console.log(`💀 Removing dead connection: ${connectionId}`);
        this.removeConnection(connectionId);
        continue;
      }

      connection.isAlive = false;
      try {
        connection.ws.ping();
      } catch (error) {
        console.error(`❌ Failed to ping connection ${connectionId}:`, error);
        this.removeConnection(connectionId);
      }
    }
  }

  // Cleanup method
  public async cleanup(): Promise<void> {
    // Close all WebSocket connections
    for (const [connectionId, connection] of this.connections) {
      try {
        connection.ws.close();
      } catch (error) {
        console.error(`❌ Error closing connection ${connectionId}:`, error);
      }
    }

    this.connections.clear();
    this.sessionConnections.clear();

    // Close Redis connections
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    if (this.redisSubscriber) {
      await this.redisSubscriber.quit();
    }

    console.log('🧹 WebSocket manager cleaned up');
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager(); 