"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = exports.WebSocketManager = void 0;
const redis_1 = require("../lib/redis");
const events_1 = require("events");
class WebSocketManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.sessionConnections = new Map();
        this.isRedisConnected = false;
        this.initializeRedis();
    }
    async initializeRedis() {
        try {
            this.redisClient = redis_1.redis;
            this.redisSubscriber = redis_1.redis.duplicate();
            await this.redisSubscriber.psubscribe('chat:*');
            this.redisSubscriber.on('pmessage', (_pattern, channel, message) => {
                try {
                    const sessionId = typeof channel === 'string' ? channel.replace('chat:', '') : '';
                    if (sessionId) {
                        this.broadcastToSession(sessionId, message);
                    }
                }
                catch (err) {
                    console.error('❌ Error handling pmessage:', err);
                }
            });
            this.isRedisConnected = true;
            console.log('✅ Redis connected and subscribed to chat channels');
        }
        catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
            this.isRedisConnected = false;
        }
    }
    addConnection(connectionId, ws, userId) {
        const connection = {
            ws,
            userId,
            isAlive: true
        };
        this.connections.set(connectionId, connection);
        ws.on('pong', () => {
            const conn = this.connections.get(connectionId);
            if (conn) {
                conn.isAlive = true;
            }
        });
        ws.on('close', () => {
            this.removeConnection(connectionId);
        });
        console.log(`✅ WebSocket connected: ${connectionId} for user: ${userId}`);
    }
    joinSession(connectionId, sessionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            console.warn(`⚠️ Connection ${connectionId} not found`);
            return;
        }
        connection.sessionId = sessionId;
        if (!this.sessionConnections.has(sessionId)) {
            this.sessionConnections.set(sessionId, new Set());
        }
        this.sessionConnections.get(sessionId).add(connectionId);
        console.log(`✅ User ${connection.userId} joined session ${sessionId}`);
    }
    connect(sessionId, ws) {
        console.log(`🔗 Legacy connect called for session ${sessionId}`);
    }
    leaveSession(connectionId) {
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
    removeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return;
        }
        if (connection.sessionId) {
            this.leaveSession(connectionId);
        }
        this.connections.delete(connectionId);
        console.log(`❌ WebSocket disconnected: ${connectionId}`);
    }
    sendToConnection(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return false;
        }
        try {
            connection.ws.send(message);
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to send message to ${connectionId}:`, error);
            this.removeConnection(connectionId);
            return false;
        }
    }
    broadcastToSession(sessionId, message) {
        const sessionConnections = this.sessionConnections.get(sessionId);
        if (!sessionConnections) {
            console.log(`⚠️ No connections for session ${sessionId}`);
            return;
        }
        const deadConnections = [];
        let sentCount = 0;
        for (const connectionId of sessionConnections) {
            if (this.sendToConnection(connectionId, message)) {
                sentCount++;
            }
            else {
                deadConnections.push(connectionId);
            }
        }
        deadConnections.forEach(connectionId => {
            this.removeConnection(connectionId);
        });
        console.log(`📤 Broadcasted to ${sentCount} connections in session ${sessionId}`);
    }
    broadcast(sessionId, message) {
        this.broadcastToSession(sessionId, message);
    }
    broadcastToUser(userId, message) {
        let sentCount = 0;
        const deadConnections = [];
        for (const [connectionId, connection] of this.connections) {
            if (connection.userId === userId) {
                if (this.sendToConnection(connectionId, message)) {
                    sentCount++;
                }
                else {
                    deadConnections.push(connectionId);
                }
            }
        }
        deadConnections.forEach(connectionId => {
            this.removeConnection(connectionId);
        });
        console.log(`📤 Broadcasted to ${sentCount} connections for user ${userId}`);
    }
    publishToRedis(channel, message) {
        if (!this.isRedisConnected || !this.redisClient) {
            console.warn('⚠️ Redis not connected, cannot publish message');
            return;
        }
        this.redisClient.publish(channel, message)
            .catch((error) => {
            console.error(`❌ Failed to publish to Redis:`, error);
        });
    }
    getConnectionCount() {
        return this.connections.size;
    }
    getSessionConnectionCount(sessionId) {
        const sessionConnections = this.sessionConnections.get(sessionId);
        return sessionConnections ? sessionConnections.size : 0;
    }
    getConnectionInfo(connectionId) {
        return this.connections.get(connectionId);
    }
    getUserConnections(userId) {
        const userConnections = [];
        for (const [connectionId, connection] of this.connections) {
            if (connection.userId === userId) {
                userConnections.push(connectionId);
            }
        }
        return userConnections;
    }
    pingConnections() {
        for (const [connectionId, connection] of this.connections) {
            if (!connection.isAlive) {
                console.log(`💀 Removing dead connection: ${connectionId}`);
                this.removeConnection(connectionId);
                continue;
            }
            connection.isAlive = false;
            try {
                connection.ws.ping();
            }
            catch (error) {
                console.error(`❌ Failed to ping connection ${connectionId}:`, error);
                this.removeConnection(connectionId);
            }
        }
    }
    async cleanup() {
        for (const [connectionId, connection] of this.connections) {
            try {
                connection.ws.close();
            }
            catch (error) {
                console.error(`❌ Error closing connection ${connectionId}:`, error);
            }
        }
        this.connections.clear();
        this.sessionConnections.clear();
        if (this.redisClient) {
            await this.redisClient.quit();
        }
        if (this.redisSubscriber) {
            await this.redisSubscriber.quit();
        }
        console.log('🧹 WebSocket manager cleaned up');
    }
}
exports.WebSocketManager = WebSocketManager;
exports.wsManager = new WebSocketManager();
//# sourceMappingURL=websocketManager.js.map