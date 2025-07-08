"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var WsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const zod_validation_pipe_1 = require("../../common/zod-validation.pipe");
const user_service_1 = require("../../modules/users/user.service");
const ws_auth_middleware_1 = require("../../modules/auth/ws-auth.middleware");
const jwt_ws_guard_1 = require("../../modules/auth/jwt-ws.guard");
const event_emitter_1 = require("@nestjs/event-emitter");
const ioredis_1 = require("ioredis");
const jwt_1 = require("@nestjs/jwt");
const schemas_1 = require("../../common/schemas");
let WsGateway = WsGateway_1 = class WsGateway {
    constructor(redis, jwtService, userService, wsAuthMiddleware, eventEmitter) {
        this.redis = redis;
        this.jwtService = jwtService;
        this.userService = userService;
        this.wsAuthMiddleware = wsAuthMiddleware;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(WsGateway_1.name);
        this.connectedUsers = new Map();
        this.streamingSessions = new Map();
    }
    afterInit(server) {
        this.logger.log('🚀 WebSocket Gateway initialized');
        server.use(this.wsAuthMiddleware.createMiddleware());
        this.redis.psubscribe('chat:*', (err) => {
            if (err) {
                this.logger.error(`Redis psubscribe error: ${err}`);
            }
            else {
                this.logger.log('📡 Subscribed to Redis chat channels');
            }
        });
        this.redis.on('pmessage', (pattern, channel, message) => {
            try {
                const data = JSON.parse(message);
                this.server.to(channel).emit('stream', data);
                this.logger.debug(`📤 Forwarded message to channel: ${channel}`);
            }
            catch (error) {
                this.logger.error(`Failed to parse Redis message: ${error}`);
            }
        });
    }
    async handleConnection(client) {
        const userId = client.data.userId;
        const username = client.data.username;
        if (!userId || !username) {
            this.logger.error('❌ Connection rejected: Missing user data');
            client.disconnect(true);
            return;
        }
        this.connectedUsers.set(client.id, userId);
        await client.join(`user:${userId}`);
        this.logger.log(`✅ User connected: ${username} (${userId}) - Socket: ${client.id}`);
        client.emit('connected', {
            status: 'connected',
            userId,
            username,
            message: 'Successfully connected to WebSocket'
        });
    }
    async handleDisconnect(client) {
        const userId = this.connectedUsers.get(client.id);
        const username = client.data.username || 'Unknown';
        if (userId) {
            this.connectedUsers.delete(client.id);
            this.logger.log(`❌ User disconnected: ${username} (${userId}) - Socket: ${client.id}`);
        }
    }
    handlePing(data, client) {
        this.logger.debug(`🏓 Ping received from ${client.data.username}: ${data}`);
        return { event: 'pong', data: `Pong: ${data}` };
    }
    async handleJoinRoom(data, client) {
        try {
            const { chatId } = data;
            const userId = client.data.userId;
            const username = client.data.username;
            if (!chatId) {
                client.emit('error', { message: 'Chat ID is required' });
                return;
            }
            await client.join(`chat:${chatId}`);
            this.logger.log(`🔗 User ${username} joined chat room: ${chatId}`);
            client.emit('joined-room', {
                chatId,
                message: `Successfully joined chat: ${chatId}`
            });
            client.to(`chat:${chatId}`).emit('user-joined', {
                userId,
                username,
                chatId,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error(`Failed to join room: ${error}`);
            client.emit('error', { message: 'Failed to join chat room' });
        }
    }
    async handleLeaveRoom(data, client) {
        try {
            const { chatId } = data;
            const userId = client.data.userId;
            const username = client.data.username;
            if (!chatId) {
                client.emit('error', { message: 'Chat ID is required' });
                return;
            }
            await client.leave(`chat:${chatId}`);
            this.logger.log(`❌ User ${username} left chat room: ${chatId}`);
            client.emit('left-room', {
                chatId,
                message: `Successfully left chat: ${chatId}`
            });
            client.to(`chat:${chatId}`).emit('user-left', {
                userId,
                username,
                chatId,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.logger.error(`Failed to leave room: ${error}`);
            client.emit('error', { message: 'Failed to leave chat room' });
        }
    }
    async handleSendMessage(data, client) {
        try {
            const { chatId, content, type = 'user' } = data;
            const userId = client.data.userId;
            const username = client.data.username;
            if (!chatId || !content) {
                client.emit('error', { message: 'Chat ID and content are required' });
                return;
            }
            const message = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                chatId,
                userId,
                username,
                content,
                timestamp: new Date(),
                type
            };
            this.server.to(`chat:${chatId}`).emit('message', message);
            this.logger.log(`📨 Message sent to chat ${chatId} by ${username}: ${content.substring(0, 50)}...`);
            client.emit('message-sent', {
                messageId: message.id,
                chatId,
                timestamp: message.timestamp
            });
        }
        catch (error) {
            this.logger.error(`Failed to send message: ${error}`);
            client.emit('error', { message: 'Failed to send message' });
        }
    }
    async handleTypingStart(data, client) {
        const { chatId } = data;
        const userId = client.data.userId;
        const username = client.data.username;
        if (!chatId)
            return;
        client.to(`chat:${chatId}`).emit('user-typing', {
            userId,
            username,
            chatId,
            isTyping: true
        });
    }
    async handleTypingStop(data, client) {
        const { chatId } = data;
        const userId = client.data.userId;
        const username = client.data.username;
        if (!chatId)
            return;
        client.to(`chat:${chatId}`).emit('user-typing', {
            userId,
            username,
            chatId,
            isTyping: false
        });
    }
    async broadcastToUser(userId, event, data) {
        this.server.to(`user:${userId}`).emit(event, data);
    }
    async broadcastToChat(chatId, event, data) {
        this.server.to(`chat:${chatId}`).emit(event, data);
    }
    getOnlineUsersCount() {
        return this.connectedUsers.size;
    }
    async getOnlineUsersInChat(chatId) {
        const room = this.server.sockets.adapter.rooms.get(`chat:${chatId}`);
        if (!room)
            return [];
        const userIds = [];
        for (const socketId of room) {
            const userId = this.connectedUsers.get(socketId);
            if (userId)
                userIds.push(userId);
        }
        return userIds;
    }
    async handleSubscribeStream(data, client) {
        try {
            const { sessionId, executionId } = data;
            const userId = client.data.userId;
            const username = client.data.username;
            if (!this.streamingSessions.has(sessionId)) {
                this.streamingSessions.set(sessionId, new Set());
            }
            this.streamingSessions.get(sessionId).add(client.id);
            await client.join(`stream:${sessionId}`);
            this.logger.log(`📡 User ${username} subscribed to stream: ${sessionId}`);
            client.emit('stream-subscribed', {
                sessionId,
                executionId,
                message: `Successfully subscribed to stream: ${sessionId}`
            });
        }
        catch (error) {
            this.logger.error(`Failed to subscribe to stream: ${error}`);
            client.emit('error', { message: 'Failed to subscribe to stream' });
        }
    }
    async handleUnsubscribeStream(data, client) {
        try {
            const { sessionId, executionId } = data;
            const userId = client.data.userId;
            const username = client.data.username;
            if (this.streamingSessions.has(sessionId)) {
                this.streamingSessions.get(sessionId).delete(client.id);
                if (this.streamingSessions.get(sessionId).size === 0) {
                    this.streamingSessions.delete(sessionId);
                }
            }
            await client.leave(`stream:${sessionId}`);
            this.logger.log(`❌ User ${username} unsubscribed from stream: ${sessionId}`);
            client.emit('stream-unsubscribed', {
                sessionId,
                executionId,
                message: `Successfully unsubscribed from stream: ${sessionId}`
            });
        }
        catch (error) {
            this.logger.error(`Failed to unsubscribe from stream: ${error}`);
            client.emit('error', { message: 'Failed to unsubscribe from stream' });
        }
    }
    handleStreamEvent(payload) {
        const { sessionId, event } = payload;
        this.server.to(`stream:${sessionId}`).emit('stream-event', event);
        this.logger.debug(`📤 Stream event emitted for session: ${sessionId}, type: ${event.type}`);
    }
    handleStreamStart(payload) {
        const { sessionId, event } = payload;
        this.server.to(`stream:${sessionId}`).emit('stream-start', event);
        this.logger.debug(`🚀 Stream start event for session: ${sessionId}`);
    }
    handleStreamChunk(payload) {
        const { sessionId, event } = payload;
        this.server.to(`stream:${sessionId}`).emit('stream-chunk', event);
    }
    handleStreamToolCall(payload) {
        const { sessionId, event } = payload;
        this.server.to(`stream:${sessionId}`).emit('stream-tool-call', event);
        this.logger.debug(`🔧 Stream tool call event for session: ${sessionId}`);
    }
    handleStreamToolResult(payload) {
        const { sessionId, event } = payload;
        this.server.to(`stream:${sessionId}`).emit('stream-tool-result', event);
        this.logger.debug(`⚙️ Stream tool result event for session: ${sessionId}`);
    }
    handleStreamComplete(payload) {
        const { sessionId, event } = payload;
        this.server.to(`stream:${sessionId}`).emit('stream-complete', event);
        this.logger.log(`✅ Stream complete event for session: ${sessionId}`);
        setTimeout(() => {
            if (this.streamingSessions.has(sessionId)) {
                this.streamingSessions.delete(sessionId);
            }
        }, 5000);
    }
    handleStreamError(payload) {
        const { sessionId, event } = payload;
        this.server.to(`stream:${sessionId}`).emit('stream-error', event);
        this.logger.error(`❌ Stream error event for session: ${sessionId}`);
        if (this.streamingSessions.has(sessionId)) {
            this.streamingSessions.delete(sessionId);
        }
    }
    getStreamingSessionInfo(sessionId) {
        const subscribers = this.streamingSessions.get(sessionId);
        return {
            subscriberCount: (subscribers === null || subscribers === void 0 ? void 0 : subscribers.size) || 0,
            socketIds: subscribers ? Array.from(subscribers) : [],
        };
    }
};
exports.WsGateway = WsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], WsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('ping'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handlePing", null);
__decorate([
    (0, common_1.UseGuards)(jwt_ws_guard_1.JwtWsGuard),
    (0, websockets_1.SubscribeMessage)('join-room'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schemas_1.joinRoomSchema)),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WsGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, common_1.UseGuards)(jwt_ws_guard_1.JwtWsGuard),
    (0, websockets_1.SubscribeMessage)('leave-room'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schemas_1.leaveRoomSchema)),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WsGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, common_1.UseGuards)(jwt_ws_guard_1.JwtWsGuard),
    (0, websockets_1.SubscribeMessage)('send-message'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schemas_1.wsMessageSchema)),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WsGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, common_1.UseGuards)(jwt_ws_guard_1.JwtWsGuard),
    (0, websockets_1.SubscribeMessage)('typing-start'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schemas_1.typingStartSchema)),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WsGateway.prototype, "handleTypingStart", null);
__decorate([
    (0, common_1.UseGuards)(jwt_ws_guard_1.JwtWsGuard),
    (0, websockets_1.SubscribeMessage)('typing-stop'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schemas_1.typingStopSchema)),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WsGateway.prototype, "handleTypingStop", null);
__decorate([
    (0, common_1.UseGuards)(jwt_ws_guard_1.JwtWsGuard),
    (0, websockets_1.SubscribeMessage)('subscribe-stream'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schemas_1.wsStreamSubscribeSchema)),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WsGateway.prototype, "handleSubscribeStream", null);
__decorate([
    (0, common_1.UseGuards)(jwt_ws_guard_1.JwtWsGuard),
    (0, websockets_1.SubscribeMessage)('unsubscribe-stream'),
    (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schemas_1.wsStreamUnsubscribeSchema)),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WsGateway.prototype, "handleUnsubscribeStream", null);
__decorate([
    (0, event_emitter_1.OnEvent)('stream.event'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleStreamEvent", null);
__decorate([
    (0, event_emitter_1.OnEvent)('stream.stream_start'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleStreamStart", null);
__decorate([
    (0, event_emitter_1.OnEvent)('stream.stream_chunk'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleStreamChunk", null);
__decorate([
    (0, event_emitter_1.OnEvent)('stream.stream_tool_call'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleStreamToolCall", null);
__decorate([
    (0, event_emitter_1.OnEvent)('stream.stream_tool_result'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleStreamToolResult", null);
__decorate([
    (0, event_emitter_1.OnEvent)('stream.stream_complete'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleStreamComplete", null);
__decorate([
    (0, event_emitter_1.OnEvent)('stream.stream_error'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WsGateway.prototype, "handleStreamError", null);
exports.WsGateway = WsGateway = WsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true
        },
        transports: ['websocket', 'polling']
    }),
    __param(0, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [ioredis_1.Redis,
        jwt_1.JwtService,
        user_service_1.UserService,
        ws_auth_middleware_1.WsAuthMiddleware,
        event_emitter_1.EventEmitter2])
], WsGateway);
//# sourceMappingURL=ws.gateway.js.map