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
var RedisPubSubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisPubSubService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let RedisPubSubService = RedisPubSubService_1 = class RedisPubSubService {
    logger = new common_1.Logger(RedisPubSubService_1.name);
    subscriber;
    publisher;
    activeConnections = new Map();
    socketServer;
    isListening = false;
    constructor() {
        this.initializeRedis();
    }
    async initializeRedis() {
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            this.subscriber = new ioredis_1.default(redisUrl);
            this.publisher = new ioredis_1.default(redisUrl);
            this.logger.log('🔴 Redis PubSub Service initialized successfully');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize Redis PubSub Service:', error);
        }
    }
    setSocketServer(server) {
        this.socketServer = server;
        if (!this.isListening) {
            this.startRedisListener();
        }
    }
    startRedisListener() {
        if (this.isListening)
            return;
        this.isListening = true;
        this.logger.log('🔍 Starting Redis listener for chat channels...');
        try {
            this.subscriber.psubscribe('chat:*');
            this.logger.log('✅ Redis listener subscribed to chat:* channels');
            this.subscriber.on('pmessage', async (pattern, channel, message) => {
                try {
                    const sessionId = channel.replace('chat:', '');
                    this.logger.debug(`📨 Received Redis message for session ${sessionId}: ${message.substring(0, 100)}...`);
                    await this.broadcastToSession(sessionId, message);
                }
                catch (error) {
                    this.logger.error(`❌ Error processing Redis message: ${error.message}`);
                }
            });
            this.subscriber.on('error', (error) => {
                this.logger.error('❌ Redis subscriber error:', error);
            });
            this.subscriber.on('connect', () => {
                this.logger.log('✅ Redis subscriber connected');
            });
        }
        catch (error) {
            this.logger.error('❌ Redis listener error:', error);
            this.isListening = false;
        }
    }
    async broadcastToSession(sessionId, message) {
        if (!this.activeConnections.has(sessionId)) {
            this.logger.debug(`⚠️ No active connections for session ${sessionId}`);
            return;
        }
        const connections = this.activeConnections.get(sessionId);
        if (!connections || connections.size === 0) {
            return;
        }
        this.logger.debug(`📤 Broadcasting to ${connections.size} connections for session ${sessionId}`);
        const deadSockets = [];
        for (const socket of connections) {
            try {
                let parsedMessage;
                try {
                    parsedMessage = JSON.parse(message);
                }
                catch {
                    parsedMessage = { type: 'chunk', data: message };
                }
                switch (parsedMessage.type) {
                    case 'chunk':
                        socket.emit('stream-chunk', parsedMessage.data);
                        break;
                    case 'tool_start':
                        socket.emit('tool-start', parsedMessage.data);
                        break;
                    case 'tool_result':
                        socket.emit('tool-result', parsedMessage.data);
                        break;
                    case 'tool_error':
                        socket.emit('tool-error', parsedMessage.data);
                        break;
                    case 'end':
                        socket.emit('stream-end', parsedMessage.data);
                        break;
                    case 'error':
                        socket.emit('stream-error', parsedMessage.data);
                        break;
                    default:
                        socket.emit('message', parsedMessage);
                }
                this.logger.debug(`✅ Message sent to WebSocket for session ${sessionId}`);
            }
            catch (error) {
                this.logger.error(`❌ Failed to send to WebSocket: ${error.message}`);
                deadSockets.push(socket);
            }
        }
        for (const socket of deadSockets) {
            this.disconnect(sessionId, socket);
        }
    }
    async connect(sessionId, socket) {
        if (!this.activeConnections.has(sessionId)) {
            this.activeConnections.set(sessionId, new Set());
        }
        this.activeConnections.get(sessionId).add(socket);
        const connectionCount = this.activeConnections.get(sessionId).size;
        this.logger.log(`🔌 WebSocket connected to session ${sessionId}, total connections: ${connectionCount}`);
        socket.join(`session:${sessionId}`);
    }
    disconnect(sessionId, socket) {
        if (this.activeConnections.has(sessionId)) {
            this.activeConnections.get(sessionId).delete(socket);
            if (this.activeConnections.get(sessionId).size === 0) {
                this.activeConnections.delete(sessionId);
            }
            this.logger.log(`🔌 WebSocket disconnected from session ${sessionId}`);
        }
        socket.leave(`session:${sessionId}`);
    }
    async publishChatMessage(sessionId, message) {
        try {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            await this.publisher.publish(`chat:${sessionId}`, messageStr);
            this.logger.debug(`📤 Published message to Redis: chat:${sessionId}`);
        }
        catch (error) {
            this.logger.error(`❌ Redis publish error: ${error.message}`);
        }
    }
    async broadcastToUser(userId, event, data) {
        if (this.socketServer) {
            this.socketServer.to(`user:${userId}`).emit(event, data);
            this.logger.debug(`📢 Broadcasted ${event} to user ${userId}`);
        }
    }
    async broadcastToRoom(room, event, data) {
        if (this.socketServer) {
            this.socketServer.to(room).emit(event, data);
            this.logger.debug(`📢 Broadcasted ${event} to room ${room}`);
        }
    }
    getConnectionStats() {
        let totalConnections = 0;
        for (const connections of this.activeConnections.values()) {
            totalConnections += connections.size;
        }
        return {
            activeSessions: this.activeConnections.size,
            totalConnections,
            sessions: Array.from(this.activeConnections.keys()),
        };
    }
    async onDestroy() {
        this.isListening = false;
        await this.subscriber?.disconnect();
        await this.publisher?.disconnect();
        this.activeConnections.clear();
        this.logger.log('🔴 Redis PubSub Service destroyed');
    }
};
exports.RedisPubSubService = RedisPubSubService;
exports.RedisPubSubService = RedisPubSubService = RedisPubSubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisPubSubService);
//# sourceMappingURL=redis-pubsub.service.js.map