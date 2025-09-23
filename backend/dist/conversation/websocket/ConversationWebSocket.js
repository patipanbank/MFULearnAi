"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationWebSocket = void 0;
const ws_1 = require("ws");
const url_1 = require("url");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const events_1 = require("events");
const uuid_1 = require("uuid");
const types_1 = require("../types");
class ConversationWebSocket extends events_1.EventEmitter {
    constructor(server) {
        super();
        this.connections = new Map();
        this.rooms = new Map();
        this.userConnections = new Map();
        this.HEARTBEAT_INTERVAL = 30000;
        this.CONNECTION_TIMEOUT = 60000;
        this.MAX_CONNECTIONS_PER_USER = 5;
        this.MESSAGE_RATE_LIMIT = 10;
        this.wss = new ws_1.WebSocketServer({
            server,
            path: '/ws',
            clientTracking: true
        });
        this.setupWebSocketServer();
        this.startHeartbeat();
        this.startCleanup();
        console.log('✅ ConversationWebSocket initialized');
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });
        this.wss.on('error', (error) => {
            console.error('❌ WebSocket Server Error:', error);
            this.emit('server_error', error);
        });
        console.log('🌐 WebSocket server listening on /ws');
    }
    async handleConnection(ws, request) {
        const connectionId = (0, uuid_1.v4)();
        const startTime = Date.now();
        try {
            const url = new url_1.URL(request.url, `http://${request.headers.host}`);
            const token = url.searchParams.get('token');
            if (!token) {
                this.closeWithError(ws, types_1.ErrorCode.AUTH_FAILED, 'No authentication token provided');
                return;
            }
            const user = await this.verifyToken(token);
            if (!user) {
                this.closeWithError(ws, types_1.ErrorCode.AUTH_FAILED, 'Invalid authentication token');
                return;
            }
            if (!this.checkConnectionLimits(user.id)) {
                this.closeWithError(ws, types_1.ErrorCode.RATE_LIMIT_EXCEEDED, 'Too many connections for this user');
                return;
            }
            const connectionInfo = {
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
            this.connections.set(connectionId, connectionInfo);
            this.addUserConnection(user.id, connectionId);
            this.setupConnectionHandlers(connectionId);
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
        }
        catch (error) {
            console.error('❌ Error handling WebSocket connection:', error);
            this.closeWithError(ws, types_1.ErrorCode.INTERNAL_ERROR, 'Connection setup failed');
        }
    }
    setupConnectionHandlers(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return;
        const { ws } = connection;
        ws.on('message', (data) => {
            this.handleMessage(connectionId, data.toString());
        });
        ws.on('pong', () => {
            this.handlePong(connectionId);
        });
        ws.on('close', (code, reason) => {
            this.handleDisconnection(connectionId, code, reason.toString());
        });
        ws.on('error', (error) => {
            this.handleConnectionError(connectionId, error);
        });
    }
    async handleMessage(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return;
        try {
            connection.metadata.lastActivity = new Date();
            connection.metadata.messageCount++;
            const data = JSON.parse(message);
            if (!this.validateMessage(data)) {
                this.sendError(connectionId, types_1.ErrorCode.INVALID_INPUT, 'Invalid message format');
                return;
            }
            if (!this.checkRateLimit(connectionId)) {
                this.sendError(connectionId, types_1.ErrorCode.RATE_LIMIT_EXCEEDED, 'Message rate limit exceeded');
                return;
            }
            console.log(`📨 Received message: ${data.type} from ${connectionId}`);
            await this.routeMessage(connectionId, data);
        }
        catch (error) {
            console.error(`❌ Error handling message from ${connectionId}:`, error);
            connection.metadata.errorCount++;
            this.sendError(connectionId, types_1.ErrorCode.INVALID_INPUT, 'Failed to process message');
        }
    }
    async routeMessage(connectionId, message) {
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
                this.sendError(connectionId, types_1.ErrorCode.INVALID_INPUT, `Unknown message type: ${message.type}`);
        }
    }
    handleHeartbeat(connectionId) {
        this.sendToConnection(connectionId, {
            type: 'heartbeat_ack',
            data: { timestamp: new Date().toISOString() },
            success: true,
            timestamp: new Date().toISOString()
        });
    }
    async handleJoinConversation(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return;
        const conversationId = message.conversationId;
        if (!conversationId) {
            this.sendError(connectionId, types_1.ErrorCode.INVALID_INPUT, 'Conversation ID required');
            return;
        }
        try {
            if (connection.conversationId) {
                this.leaveRoom(connectionId, connection.conversationId);
            }
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
        }
        catch (error) {
            this.sendError(connectionId, types_1.ErrorCode.INTERNAL_ERROR, 'Failed to join conversation');
        }
    }
    handleLeaveConversation(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.conversationId)
            return;
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
    async handleSendMessage(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.conversationId) {
            this.sendError(connectionId, types_1.ErrorCode.INVALID_INPUT, 'Not in a conversation');
            return;
        }
        try {
            this.emit('message_received', {
                connectionId,
                userId: connection.userId,
                conversationId: connection.conversationId,
                message: message.data,
                timestamp: new Date()
            });
            this.sendToConnection(connectionId, {
                type: 'message_acknowledged',
                conversationId: connection.conversationId,
                messageId: message.messageId,
                data: { received: true },
                success: true,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.sendError(connectionId, types_1.ErrorCode.INTERNAL_ERROR, 'Failed to process message');
        }
    }
    handleTypingStart(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.conversationId)
            return;
        this.broadcastToRoom(connection.conversationId, {
            type: 'user_typing_start',
            conversationId: connection.conversationId,
            data: { userId: connection.userId },
            success: true,
            timestamp: new Date().toISOString()
        }, connectionId);
    }
    handleTypingStop(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection || !connection.conversationId)
            return;
        this.broadcastToRoom(connection.conversationId, {
            type: 'user_typing_stop',
            conversationId: connection.conversationId,
            data: { userId: connection.userId },
            success: true,
            timestamp: new Date().toISOString()
        }, connectionId);
    }
    joinRoom(connectionId, conversationId) {
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
    leaveRoom(connectionId, conversationId) {
        const room = this.rooms.get(conversationId);
        if (!room)
            return;
        room.connections.delete(connectionId);
        room.lastActivity = new Date();
        if (room.connections.size === 0) {
            this.rooms.delete(conversationId);
            console.log(`🏠 Room ${conversationId} deleted (empty)`);
        }
        else {
            console.log(`🏠 Connection ${connectionId} left room ${conversationId} (${room.connections.size} remaining)`);
        }
    }
    broadcastToRoom(conversationId, message, excludeConnectionId) {
        const room = this.rooms.get(conversationId);
        if (!room)
            return;
        let sentCount = 0;
        const deadConnections = [];
        for (const connectionId of room.connections) {
            if (excludeConnectionId && connectionId === excludeConnectionId) {
                continue;
            }
            if (this.sendToConnection(connectionId, message)) {
                sentCount++;
            }
            else {
                deadConnections.push(connectionId);
            }
        }
        deadConnections.forEach(connectionId => {
            this.handleDisconnection(connectionId, 1006, 'Connection lost');
        });
        if (sentCount > 0) {
            console.log(`📤 Broadcasted to ${sentCount} connections in room ${conversationId}`);
        }
    }
    sendToConnection(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.ws.readyState !== ws_1.WebSocket.OPEN) {
            return false;
        }
        try {
            connection.ws.send(JSON.stringify(message));
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to send message to ${connectionId}:`, error);
            return false;
        }
    }
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.performHeartbeat();
        }, this.HEARTBEAT_INTERVAL);
    }
    performHeartbeat() {
        const deadConnections = [];
        for (const [connectionId, connection] of this.connections) {
            if (!connection.isAlive) {
                deadConnections.push(connectionId);
                continue;
            }
            connection.isAlive = false;
            try {
                connection.ws.ping();
            }
            catch (error) {
                deadConnections.push(connectionId);
            }
        }
        deadConnections.forEach(connectionId => {
            this.handleDisconnection(connectionId, 1006, 'Heartbeat timeout');
        });
        if (deadConnections.length > 0) {
            console.log(`💀 Removed ${deadConnections.length} dead connections`);
        }
    }
    handlePong(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.isAlive = true;
            connection.lastHeartbeat = new Date();
        }
    }
    startCleanup() {
        this.cleanupTimer = setInterval(() => {
            this.performCleanup();
        }, 5 * 60 * 1000);
    }
    performCleanup() {
        let roomsDeleted = 0;
        for (const [conversationId, room] of this.rooms) {
            const inactiveTime = Date.now() - room.lastActivity.getTime();
            if (inactiveTime > 60 * 60 * 1000 && room.connections.size === 0) {
                this.rooms.delete(conversationId);
                roomsDeleted++;
            }
        }
        if (roomsDeleted > 0) {
            console.log(`🧹 Cleaned up ${roomsDeleted} inactive rooms`);
        }
    }
    async verifyToken(token) {
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET not configured');
            }
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            return {
                id: decoded.sub || decoded.userId,
                email: decoded.email,
                role: decoded.role
            };
        }
        catch (error) {
            console.error('❌ Token verification failed:', error);
            return null;
        }
    }
    checkConnectionLimits(userId) {
        const userConnections = this.userConnections.get(userId);
        return !userConnections || userConnections.size < this.MAX_CONNECTIONS_PER_USER;
    }
    checkRateLimit(connectionId) {
        return true;
    }
    validateMessage(message) {
        return message && typeof message.type === 'string';
    }
    getClientIP(request) {
        return request.headers['x-forwarded-for']?.split(',')[0] ||
            request.socket.remoteAddress ||
            'unknown';
    }
    addUserConnection(userId, connectionId) {
        if (!this.userConnections.has(userId)) {
            this.userConnections.set(userId, new Set());
        }
        this.userConnections.get(userId).add(connectionId);
    }
    removeUserConnection(userId, connectionId) {
        const userConnections = this.userConnections.get(userId);
        if (userConnections) {
            userConnections.delete(connectionId);
            if (userConnections.size === 0) {
                this.userConnections.delete(userId);
            }
        }
    }
    sendError(connectionId, code, message) {
        const errorDetails = {
            code,
            message,
            timestamp: new Date(),
            retryable: code !== types_1.ErrorCode.AUTH_FAILED
        };
        this.sendToConnection(connectionId, {
            type: 'error',
            data: errorDetails,
            success: false,
            error: errorDetails,
            timestamp: new Date().toISOString()
        });
    }
    closeWithError(ws, code, message) {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                data: { code, message },
                success: false,
                timestamp: new Date().toISOString()
            }));
            ws.close(1008, message);
        }
        catch (error) {
            ws.close(1008, message);
        }
    }
    handleConnectionError(connectionId, error) {
        console.error(`❌ WebSocket connection error ${connectionId}:`, error);
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.metadata.errorCount++;
        }
        this.emit('connection_error', { connectionId, error });
    }
    handleDisconnection(connectionId, code, reason) {
        const connection = this.connections.get(connectionId);
        if (!connection)
            return;
        if (connection.conversationId) {
            this.leaveRoom(connectionId, connection.conversationId);
        }
        this.removeUserConnection(connection.userId, connectionId);
        this.connections.delete(connectionId);
        console.log(`👋 WebSocket disconnected: ${connectionId} (code: ${code}, reason: ${reason})`);
        this.emit('connection_closed', { connectionId, userId: connection.userId, code, reason });
    }
    getStats() {
        return {
            totalConnections: this.connections.size,
            totalRooms: this.rooms.size,
            authenticatedConnections: Array.from(this.connections.values()).filter(c => c.isAuthenticated).length,
            totalUsers: this.userConnections.size
        };
    }
    getRoomStats(conversationId) {
        const room = this.rooms.get(conversationId);
        return room ? {
            connectionCount: room.connections.size,
            createdAt: room.createdAt,
            lastActivity: room.lastActivity,
            messageCount: room.messageCount
        } : null;
    }
    async shutdown() {
        console.log('🔌 Shutting down ConversationWebSocket...');
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        for (const connection of this.connections.values()) {
            try {
                connection.ws.close(1001, 'Server shutdown');
            }
            catch (error) {
            }
        }
        return new Promise((resolve) => {
            this.wss.close(() => {
                console.log('🔌 ConversationWebSocket shut down complete');
                resolve();
            });
        });
    }
}
exports.ConversationWebSocket = ConversationWebSocket;
//# sourceMappingURL=ConversationWebSocket.js.map