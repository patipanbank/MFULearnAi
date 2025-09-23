"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleWebSocketService = void 0;
const ws_1 = require("ws");
const url_1 = require("url");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const SimpleConversationService_1 = require("./SimpleConversationService");
class SimpleWebSocketService {
    constructor(server) {
        this.connections = new Map();
        this.wss = new ws_1.WebSocketServer({
            server,
            path: '/conversation-ws'
        });
        this.setupWebSocketServer();
        this.startPingInterval();
        console.log('✅ SimpleWebSocketService initialized on /conversation-ws');
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });
    }
    async handleConnection(ws, request) {
        console.log('🌐 New conversation WebSocket connection attempt');
        try {
            const url = new url_1.URL(request.url, `http://${request.headers.host}`);
            const token = url.searchParams.get('token');
            if (!token) {
                console.log('❌ No token provided for conversation WebSocket');
                ws.close(1008, 'No token provided');
                return;
            }
            const user = await this.verifyToken(token);
            if (!user) {
                console.log('❌ Invalid token for conversation WebSocket');
                ws.close(1008, 'Invalid token');
                return;
            }
            const connectionId = (0, uuid_1.v4)();
            const connectionInfo = {
                id: connectionId,
                userId: user.id,
                ws,
                lastActivity: new Date()
            };
            this.connections.set(connectionId, connectionInfo);
            console.log(`✅ Conversation WebSocket authenticated for user: ${user.id}`);
            this.sendMessage(connectionId, {
                type: 'connected',
                data: { connectionId, userId: user.id }
            });
            ws.on('message', (data) => {
                this.handleMessage(connectionId, data.toString(), user);
            });
            ws.on('close', () => {
                console.log(`👋 Conversation WebSocket connection closed for user: ${user.id}`);
                this.connections.delete(connectionId);
            });
            ws.on('error', (error) => {
                console.error(`❌ Conversation WebSocket error for user ${user.id}:`, error);
                this.connections.delete(connectionId);
            });
        }
        catch (error) {
            console.error('❌ Error handling conversation WebSocket connection:', error);
            ws.close(1011, 'Internal server error');
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
    async handleMessage(connectionId, message, user) {
        try {
            const data = JSON.parse(message);
            console.log(`📨 Received conversation message from ${user.id}:`, data.type);
            const connection = this.connections.get(connectionId);
            if (connection) {
                connection.lastActivity = new Date();
            }
            switch (data.type) {
                case 'ping':
                    this.handlePing(connectionId);
                    break;
                case 'send_message':
                    await this.handleSendMessage(connectionId, data, user);
                    break;
                case 'join_conversation':
                    this.handleJoinConversation(connectionId, data);
                    break;
                case 'leave_conversation':
                    this.handleLeaveConversation(connectionId);
                    break;
                default:
                    console.warn(`⚠️ Unknown conversation message type: ${data.type}`);
                    this.sendError(connectionId, `Unknown message type: ${data.type}`);
            }
        }
        catch (error) {
            console.error('❌ Error handling conversation message:', error);
            this.sendError(connectionId, 'Invalid message format');
        }
    }
    handlePing(connectionId) {
        this.sendMessage(connectionId, { type: 'pong' });
    }
    async handleSendMessage(connectionId, data, user) {
        const conversationId = data.conversationId;
        const message = data.data?.content || data.data?.message || '';
        if (!conversationId) {
            this.sendError(connectionId, 'Conversation ID is required');
            return;
        }
        if (!message.trim()) {
            this.sendError(connectionId, 'Message content is required');
            return;
        }
        try {
            const connection = this.connections.get(connectionId);
            if (connection) {
                connection.currentConversationId = conversationId;
            }
            this.sendMessage(connectionId, {
                type: 'message_accepted',
                data: { conversationId, messageId: (0, uuid_1.v4)() }
            });
            const config = {
                modelId: data.data?.modelId,
                temperature: data.data?.temperature,
                maxTokens: data.data?.maxTokens,
                systemPrompt: data.data?.systemPrompt,
                agentId: data.data?.agentId,
                collectionNames: data.data?.collectionNames
            };
            const response = await SimpleConversationService_1.simpleConversationService.processMessage({
                conversationId,
                userId: user.id,
                message,
                config
            }, (chunk) => {
                this.sendMessage(connectionId, {
                    type: 'message_chunk',
                    data: {
                        conversationId,
                        content: chunk,
                        isStreaming: true
                    }
                });
            });
            this.sendMessage(connectionId, {
                type: 'message_completed',
                data: {
                    conversationId,
                    messageId: response.messageId,
                    content: response.content,
                    status: response.status,
                    tokenUsage: response.tokenUsage,
                    processingTime: response.processingTime,
                    error: response.error
                }
            });
        }
        catch (error) {
            console.error('❌ Error processing conversation message:', error);
            this.sendMessage(connectionId, {
                type: 'message_failed',
                data: {
                    conversationId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }
    handleJoinConversation(connectionId, data) {
        const conversationId = data.conversationId;
        if (!conversationId) {
            this.sendError(connectionId, 'Conversation ID is required');
            return;
        }
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.currentConversationId = conversationId;
            this.sendMessage(connectionId, {
                type: 'conversation_joined',
                data: { conversationId }
            });
        }
    }
    handleLeaveConversation(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            const conversationId = connection.currentConversationId;
            connection.currentConversationId = undefined;
            this.sendMessage(connectionId, {
                type: 'conversation_left',
                data: { conversationId }
            });
        }
    }
    sendMessage(connectionId, message) {
        const connection = this.connections.get(connectionId);
        if (connection && connection.ws.readyState === ws_1.WebSocket.OPEN) {
            try {
                connection.ws.send(JSON.stringify(message));
            }
            catch (error) {
                console.error('❌ Error sending message to connection:', error);
                this.connections.delete(connectionId);
            }
        }
    }
    sendError(connectionId, message) {
        this.sendMessage(connectionId, {
            type: 'error',
            data: { message }
        });
    }
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            const now = new Date();
            const timeout = 5 * 60 * 1000;
            for (const [connectionId, connection] of this.connections.entries()) {
                if (now.getTime() - connection.lastActivity.getTime() > timeout) {
                    console.log(`🕐 Closing inactive connection: ${connectionId}`);
                    connection.ws.close(1000, 'Connection timeout');
                    this.connections.delete(connectionId);
                }
                else if (connection.ws.readyState === ws_1.WebSocket.OPEN) {
                    this.sendMessage(connectionId, { type: 'ping' });
                }
            }
        }, 30000);
    }
    async shutdown() {
        console.log('🛑 Shutting down SimpleWebSocketService...');
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        for (const [connectionId, connection] of this.connections.entries()) {
            try {
                connection.ws.close(1000, 'Server shutdown');
            }
            catch (error) {
                console.error('❌ Error closing connection during shutdown:', error);
            }
        }
        this.connections.clear();
        return new Promise((resolve) => {
            this.wss.close(() => {
                console.log('✅ SimpleWebSocketService shutdown complete');
                resolve();
            });
        });
    }
    getStats() {
        const now = new Date();
        const activeConnections = Array.from(this.connections.values()).filter(conn => conn.ws.readyState === ws_1.WebSocket.OPEN);
        return {
            totalConnections: this.connections.size,
            activeConnections: activeConnections.length,
            connectionsInConversation: activeConnections.filter(conn => conn.currentConversationId).length,
            averageConnectionAge: activeConnections.reduce((sum, conn) => {
                return sum + (now.getTime() - conn.lastActivity.getTime());
            }, 0) / (activeConnections.length || 1)
        };
    }
}
exports.SimpleWebSocketService = SimpleWebSocketService;
//# sourceMappingURL=SimpleWebSocketService.js.map