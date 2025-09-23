"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangGraphWebSocketService = void 0;
const ws_1 = require("ws");
const url_1 = require("url");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const mongodb_1 = require("mongodb");
const LangGraphConversation_1 = require("./LangGraphConversation");
class LangGraphWebSocketService {
    constructor(server) {
        this.connections = new Map();
        this.wss = new ws_1.WebSocketServer({
            server,
            path: '/ws'
        });
        this.setupWebSocketServer();
        this.startPingInterval();
        console.log('✅ LangGraphWebSocketService initialized on /ws');
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });
    }
    async handleConnection(ws, request) {
        console.log('🌐 New LangGraph WebSocket connection attempt');
        try {
            const url = new url_1.URL(request.url, `http://${request.headers.host}`);
            const token = url.searchParams.get('token');
            if (!token) {
                console.log('❌ No token provided for LangGraph WebSocket');
                ws.close(1008, 'No token provided');
                return;
            }
            const user = await this.verifyToken(token);
            if (!user) {
                console.log('❌ Invalid token for LangGraph WebSocket');
                ws.close(1008, 'Invalid token');
                return;
            }
            const connectionId = (0, uuid_1.v4)();
            const connectionInfo = {
                id: connectionId,
                userId: user.id,
                ws,
                lastActivity: new Date(),
                isStreaming: false
            };
            this.connections.set(connectionId, connectionInfo);
            console.log(`✅ LangGraph WebSocket authenticated for user: ${user.id}`);
            this.sendMessage(connectionId, {
                type: 'connected',
                data: {
                    connectionId,
                    userId: user.id
                }
            });
            ws.on('message', (data) => {
                this.handleIncomingMessage(connectionId, data.toString(), user);
            });
            ws.on('close', () => {
                console.log(`👋 LangGraph WebSocket connection closed for user: ${user.id}`);
                this.connections.delete(connectionId);
            });
            ws.on('error', (error) => {
                console.error(`❌ LangGraph WebSocket error for user ${user.id}:`, error);
                this.connections.delete(connectionId);
            });
        }
        catch (error) {
            console.error('❌ Error handling LangGraph WebSocket connection:', error);
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
    async handleIncomingMessage(connectionId, message, user) {
        try {
            const data = JSON.parse(message);
            console.log(`📨 Received LangGraph message from ${user.id}:`, data.type);
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
                case 'create_room':
                    await this.handleCreateRoom(connectionId, data, user);
                    break;
                case 'pong':
                    console.log('WebSocket: Received pong from client');
                    break;
                default:
                    console.warn(`⚠️ Unknown LangGraph message type: ${data.type}`);
                    this.sendError(connectionId, `Unknown message type: ${data.type}`);
            }
        }
        catch (error) {
            console.error('❌ Error handling LangGraph message:', error);
            this.sendError(connectionId, 'Invalid message format');
        }
    }
    handlePing(connectionId) {
        this.sendMessage(connectionId, { type: 'pong' });
    }
    async handleMessage(connectionId, data, user) {
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
        const assistantMessageId = (0, uuid_1.v4)();
        try {
            const connection = this.connections.get(connectionId);
            if (connection) {
                connection.currentConversationId = chatId;
                connection.isStreaming = true;
            }
            this.sendMessage(connectionId, {
                type: 'accepted',
                data: { chatId, messageId: (0, uuid_1.v4)() }
            });
            const userMessageId = (0, uuid_1.v4)();
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
            const config = {
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
            const response = await LangGraphConversation_1.langGraphConversationService.processMessage({
                conversationId: chatId,
                userId: user.id,
                message,
                images: data.images,
                config
            }, (chunk) => {
                chunkCount++;
                streamBuffer += chunk;
                this.sendMessage(connectionId, {
                    type: 'message_updated',
                    data: {
                        messageId: assistantMessageId,
                        content: streamBuffer,
                        isStreaming: true
                    }
                });
            });
            if (connection) {
                connection.isStreaming = false;
            }
            this.sendMessage(connectionId, {
                type: 'message_completed',
                data: {
                    messageId: assistantMessageId,
                    content: response.content
                }
            });
        }
        catch (error) {
            console.error('❌ Error processing LangGraph message:', error);
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
    handleJoinRoom(connectionId, data) {
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
    handleLeaveRoom(connectionId) {
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
    handleGetWorkflowState(connectionId, data) {
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
    async handleCreateRoom(connectionId, data, user) {
        const agentId = data.agent_id;
        if (!agentId) {
            this.sendError(connectionId, 'Agent ID is required for room creation');
            return;
        }
        try {
            console.log(`🏗️ Creating new chat room for user ${user.id} with agent ${agentId}`);
            const roomId = new mongodb_1.ObjectId().toString();
            this.sendMessage(connectionId, {
                type: 'room_created',
                data: {
                    chatId: roomId,
                    agentId
                }
            });
            console.log(`✅ Room created successfully: ${roomId}`);
        }
        catch (error) {
            console.error('❌ Error creating room:', error);
            this.sendError(connectionId, 'Failed to create room');
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
            data: message
        });
    }
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            const now = new Date();
            const timeout = 5 * 60 * 1000;
            for (const [connectionId, connection] of this.connections.entries()) {
                if (now.getTime() - connection.lastActivity.getTime() > timeout) {
                    console.log(`🕐 Closing inactive LangGraph connection: ${connectionId}`);
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
        console.log('🛑 Shutting down LangGraphWebSocketService...');
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
                console.log('✅ LangGraphWebSocketService shutdown complete');
                resolve();
            });
        });
    }
    getStats() {
        const now = new Date();
        const activeConnections = Array.from(this.connections.values()).filter(conn => conn.ws.readyState === ws_1.WebSocket.OPEN);
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
exports.LangGraphWebSocketService = LangGraphWebSocketService;
//# sourceMappingURL=LangGraphWebSocketService.js.map