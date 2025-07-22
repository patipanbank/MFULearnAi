"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const ws_1 = require("ws");
const url_1 = require("url");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const websocketManager_1 = require("../utils/websocketManager");
const chatService_1 = require("./chatService");
const uuid_1 = require("uuid");
class WebSocketService {
    constructor(server) {
        this.wss = new ws_1.WebSocketServer({
            server,
            path: '/ws'
        });
        this.setupWebSocketServer();
        this.startPingInterval();
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });
        console.log('✅ WebSocket server initialized');
    }
    async handleConnection(ws, request) {
        console.log('🌐 New WebSocket connection attempt');
        try {
            const url = new url_1.URL(request.url, `http://${request.headers.host}`);
            const token = url.searchParams.get('token');
            if (!token) {
                console.log('❌ No token provided');
                ws.close(1008, 'No token provided');
                return;
            }
            const user = await this.verifyToken(token);
            if (!user) {
                console.log('❌ Invalid token');
                ws.close(1008, 'Invalid token');
                return;
            }
            const connectionId = (0, uuid_1.v4)();
            websocketManager_1.wsManager.addConnection(connectionId, ws, user.id);
            console.log(`✅ WebSocket authenticated for user: ${user.id}`);
            ws.on('message', (data) => {
                this.handleMessage(connectionId, data.toString(), user);
            });
            ws.on('close', () => {
                console.log(`👋 WebSocket connection closed for user: ${user.id}`);
            });
            ws.on('error', (error) => {
                console.error(`❌ WebSocket error for user ${user.id}:`, error);
            });
        }
        catch (error) {
            console.error('❌ Error handling WebSocket connection:', error);
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
            console.log(`📨 Received message from ${user.id}:`, data.type);
            switch (data.type) {
                case 'ping':
                    this.handlePing(connectionId);
                    break;
                case 'join_room':
                    await this.handleJoinRoom(connectionId, data, user);
                    break;
                case 'create_room':
                    await this.handleCreateRoom(connectionId, data, user);
                    break;
                case 'message':
                    await this.handleChatMessage(connectionId, data, user);
                    break;
                case 'leave_room':
                    this.handleLeaveRoom(connectionId);
                    break;
                default:
                    console.warn(`⚠️ Unknown message type: ${data.type}`);
                    this.sendError(connectionId, `Unknown message type: ${data.type}`);
            }
        }
        catch (error) {
            console.error('❌ Error handling message:', error);
            this.sendError(connectionId, 'Invalid message format');
        }
    }
    handlePing(connectionId) {
        websocketManager_1.wsManager.sendToConnection(connectionId, JSON.stringify({ type: 'pong' }));
    }
    async handleJoinRoom(connectionId, data, user) {
        const chatId = data.chatId;
        if (!chatId || typeof chatId !== 'string') {
            this.sendError(connectionId, 'Invalid chatId for join_room');
            return;
        }
        const chat = await chatService_1.chatService.getChat(chatId, user.id);
        if (!chat) {
            this.sendError(connectionId, 'Chat not found or access denied');
            return;
        }
        websocketManager_1.wsManager.joinSession(connectionId, chatId);
        websocketManager_1.wsManager.sendToConnection(connectionId, JSON.stringify({
            type: 'room_joined',
            data: { chatId }
        }));
        console.log(`✅ User ${user.id} joined room ${chatId}`);
    }
    async handleCreateRoom(connectionId, data, user) {
        const agentId = data.agent_id || data.agentId;
        const name = data.name || 'New Chat';
        const chat = await chatService_1.chatService.createChat(user.id, name, agentId);
        websocketManager_1.wsManager.joinSession(connectionId, chat.id);
        websocketManager_1.wsManager.sendToConnection(connectionId, JSON.stringify({
            type: 'room_created',
            data: { chatId: chat.id }
        }));
        console.log(`✅ User ${user.id} created room ${chat.id}`);
    }
    async handleChatMessage(connectionId, data, user) {
        const chatId = data.chatId;
        const message = data.text || data.message;
        const agentId = data.agent_id;
        const images = data.images || [];
        if (!chatId || !message) {
            this.sendError(connectionId, 'Missing chatId or message');
            return;
        }
        websocketManager_1.wsManager.sendToConnection(connectionId, JSON.stringify({
            type: 'accepted',
            data: { chatId }
        }));
        await chatService_1.chatService.processMessage(chatId, user.id, message, images);
        console.log(`💬 User ${user.id} sent message in room ${chatId}`);
    }
    handleLeaveRoom(connectionId) {
        websocketManager_1.wsManager.leaveSession(connectionId);
        websocketManager_1.wsManager.sendToConnection(connectionId, JSON.stringify({
            type: 'room_left',
            data: { success: true }
        }));
    }
    sendError(connectionId, message) {
        websocketManager_1.wsManager.sendToConnection(connectionId, JSON.stringify({
            type: 'error',
            data: message
        }));
    }
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            websocketManager_1.wsManager.pingConnections();
        }, 30000);
    }
    stop() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.wss.close(() => {
            console.log('🔌 WebSocket server stopped');
        });
    }
    getStats() {
        return {
            totalConnections: websocketManager_1.wsManager.getConnectionCount(),
            activeSessions: websocketManager_1.wsManager.getSessionConnectionCount('all'),
            uptime: process.uptime()
        };
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=websocketService.js.map