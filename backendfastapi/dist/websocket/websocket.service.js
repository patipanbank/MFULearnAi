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
var WebSocketService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const common_1 = require("@nestjs/common");
const redis_service_1 = require("../redis/redis.service");
let WebSocketService = WebSocketService_1 = class WebSocketService {
    redisService;
    logger = new common_1.Logger(WebSocketService_1.name);
    connectedUsers = new Map();
    userSockets = new Map();
    constructor(redisService) {
        this.redisService = redisService;
    }
    async handleConnection(client, userId, userInfo) {
        try {
            const user = {
                id: userId,
                username: userInfo.username,
                role: userInfo.role,
                department: userInfo.department,
                socket: client,
                lastSeen: new Date(),
            };
            this.connectedUsers.set(client.id, user);
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, []);
            }
            this.userSockets.get(userId).push(client);
            await this.redisService.set(`user_session:${userId}`, JSON.stringify({
                socketId: client.id,
                username: userInfo.username,
                role: userInfo.role,
                department: userInfo.department,
                connectedAt: new Date(),
            }), 3600);
            await this.broadcastUserStatus(userId, 'online');
            this.logger.log(`User ${userInfo.username} connected: ${client.id}`);
        }
        catch (error) {
            this.logger.error(`Error handling connection: ${error.message}`);
        }
    }
    async handleDisconnection(client) {
        try {
            const user = this.connectedUsers.get(client.id);
            if (user) {
                this.connectedUsers.delete(client.id);
                const userSockets = this.userSockets.get(user.id);
                if (userSockets) {
                    const index = userSockets.indexOf(client);
                    if (index > -1) {
                        userSockets.splice(index, 1);
                    }
                    if (userSockets.length === 0) {
                        this.userSockets.delete(user.id);
                        await this.redisService.del(`user_session:${user.id}`);
                        await this.broadcastUserStatus(user.id, 'offline');
                    }
                }
                this.logger.log(`User ${user.username} disconnected: ${client.id}`);
            }
        }
        catch (error) {
            this.logger.error(`Error handling disconnection: ${error.message}`);
        }
    }
    async sendToUser(userId, event, data) {
        try {
            const userSockets = this.userSockets.get(userId);
            if (userSockets) {
                userSockets.forEach(socket => {
                    socket.emit(event, data);
                });
                return true;
            }
            return false;
        }
        catch (error) {
            this.logger.error(`Error sending message to user ${userId}: ${error.message}`);
            return false;
        }
    }
    async broadcastToRoom(room, event, data) {
        try {
            for (const [socketId, user] of this.connectedUsers.entries()) {
                if (user.socket.rooms.has(room)) {
                    user.socket.emit(event, data);
                }
            }
        }
        catch (error) {
            this.logger.error(`Error broadcasting to room ${room}: ${error.message}`);
        }
    }
    async broadcastUserStatus(userId, status) {
        try {
            const message = {
                type: 'user_status',
                userId,
                status,
                timestamp: new Date(),
            };
            for (const [socketId, user] of this.connectedUsers.entries()) {
                user.socket.emit('user_status', message);
            }
            await this.redisService.publish('user_status', JSON.stringify(message));
        }
        catch (error) {
            this.logger.error(`Error broadcasting user status: ${error.message}`);
        }
    }
    getConnectedUsers() {
        return Array.from(this.connectedUsers.values());
    }
    getUserSocketCount(userId) {
        return this.userSockets.get(userId)?.length || 0;
    }
    isUserOnline(userId) {
        return this.userSockets.has(userId);
    }
    async joinRoom(client, room) {
        try {
            await client.join(room);
            this.logger.log(`Socket ${client.id} joined room: ${room}`);
        }
        catch (error) {
            this.logger.error(`Error joining room ${room}: ${error.message}`);
        }
    }
    async leaveRoom(client, room) {
        try {
            await client.leave(room);
            this.logger.log(`Socket ${client.id} left room: ${room}`);
        }
        catch (error) {
            this.logger.error(`Error leaving room ${room}: ${error.message}`);
        }
    }
};
exports.WebSocketService = WebSocketService;
exports.WebSocketService = WebSocketService = WebSocketService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], WebSocketService);
//# sourceMappingURL=websocket.service.js.map