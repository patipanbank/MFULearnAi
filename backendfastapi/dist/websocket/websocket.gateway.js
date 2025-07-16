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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const config_service_1 = require("../config/config.service");
const websocket_service_1 = require("./websocket.service");
const chat_service_1 = require("../chat/chat.service");
const chat_history_service_1 = require("../chat/chat-history.service");
const agent_service_1 = require("../agent/agent.service");
const task_queue_service_1 = require("../tasks/task-queue.service");
const redis_pubsub_service_1 = require("../redis/redis-pubsub.service");
let WebSocketGateway = class WebSocketGateway {
    jwtService;
    configService;
    webSocketService;
    chatService;
    chatHistoryService;
    agentService;
    taskQueueService;
    redisPubSubService;
    server;
    constructor(jwtService, configService, webSocketService, chatService, chatHistoryService, agentService, taskQueueService, redisPubSubService) {
        this.jwtService = jwtService;
        this.configService = configService;
        this.webSocketService = webSocketService;
        this.chatService = chatService;
        this.chatHistoryService = chatHistoryService;
        this.agentService = agentService;
        this.taskQueueService = taskQueueService;
        this.redisPubSubService = redisPubSubService;
    }
    afterInit(server) {
        this.redisPubSubService.setSocketServer(server);
        console.log('🔌 WebSocket Gateway initialized with Redis PubSub service');
    }
    async handleConnection(client) {
        try {
            console.log(`🌐 WebSocket connection attempt from: ${client.id}`);
            const token = client.handshake.query.token;
            console.log(`🎫 Token received: ${token ? token.substring(0, 50) + '...' : 'None'}`);
            if (!token) {
                console.log('❌ No token provided in query parameters');
                client.disconnect(true);
                return;
            }
            try {
                const payload = this.jwtService.verify(token);
                const userId = payload.sub;
                if (!userId) {
                    console.log('❌ No user_id in token payload');
                    client.disconnect(true);
                    return;
                }
                client.data.userId = userId;
                client.data.userInfo = {
                    id: userId,
                    username: payload.username,
                    role: payload.role,
                    department: payload.department,
                };
                await this.webSocketService.handleConnection(client, userId, client.data.userInfo);
                console.log(`✅ WebSocket authenticated for user: ${userId}`);
                client.emit('connected', {
                    type: 'connected',
                    data: { userId, message: 'WebSocket connected successfully' }
                });
            }
            catch (error) {
                console.log(`❌ JWT validation error: ${error.message}`);
                client.disconnect(true);
                return;
            }
        }
        catch (error) {
            console.log(`❌ Connection error: ${error.message}`);
            client.disconnect(true);
        }
    }
    async handleDisconnect(client) {
        try {
            await this.webSocketService.handleDisconnection(client);
        }
        catch (error) {
            console.log(`❌ Disconnection error: ${error.message}`);
        }
    }
    async handleJoinRoom(data, client) {
        try {
            const { chatId } = data;
            const userId = client.data.userId;
            console.log(`🔗 User ${userId} joining room: ${chatId}`);
            if (!chatId || chatId.length !== 24) {
                client.emit('error', {
                    type: 'error',
                    data: 'Invalid chatId for join_room'
                });
                return;
            }
            const chat = await this.chatHistoryService.getChatById(chatId);
            if (!chat) {
                client.emit('error', {
                    type: 'error',
                    data: 'Chat not found'
                });
                return;
            }
            if (chat.userId !== userId) {
                client.emit('error', {
                    type: 'error',
                    data: 'Not authorized to access this chat'
                });
                return;
            }
            await client.join(chatId);
            await this.webSocketService.joinRoom(client, chatId);
            await this.redisPubSubService.connect(chatId, client);
            client.emit('room_joined', {
                type: 'room_joined',
                data: { chatId }
            });
            console.log(`✅ User ${userId} joined room: ${chatId}`);
        }
        catch (error) {
            console.log(`❌ Join room error: ${error.message}`);
            client.emit('error', {
                type: 'error',
                data: `Failed to join room: ${error.message}`
            });
        }
    }
    async handleCreateRoom(data, client) {
        try {
            const userId = client.data.userId;
            const agentId = data.agent_id || data.agentId;
            const modelId = data.model_id || data.modelId;
            const collectionNames = data.collection_names || data.collectionNames || [];
            const systemPrompt = data.system_prompt || data.systemPrompt;
            const temperature = data.temperature || 0.7;
            const maxTokens = data.max_tokens || data.maxTokens || 4000;
            console.log(`🏗️ User ${userId} creating room with agent: ${agentId}`);
            if (agentId) {
                const agent = await this.agentService.getAgentById(agentId, userId);
                if (!agent) {
                    client.emit('error', {
                        type: 'error',
                        data: 'Agent not found or access denied'
                    });
                    return;
                }
            }
            const chatName = agentId ? `Chat with ${agentId}` : 'New Chat';
            const chat = await this.chatHistoryService.createChat(userId, chatName, agentId, modelId);
            const chatId = chat.id || chat._id?.toString();
            if (!chatId) {
                throw new Error('Chat ID not found');
            }
            await client.join(chatId);
            await this.webSocketService.joinRoom(client, chatId);
            await this.redisPubSubService.connect(chatId, client);
            client.emit('room_created', {
                type: 'room_created',
                data: {
                    chatId: chatId,
                    chatName: chat.name || chat.title,
                    agentId,
                    modelId,
                    collectionNames,
                    systemPrompt,
                    temperature,
                    maxTokens,
                }
            });
            console.log(`✅ Room created: ${chatId} for user: ${userId}`);
        }
        catch (error) {
            console.log(`❌ Create room error: ${error.message}`);
            client.emit('error', {
                type: 'error',
                data: `Failed to create room: ${error.message}`
            });
        }
    }
    async handleSendMessage(data, client) {
        try {
            const userId = client.data.userId;
            const { message, images } = data;
            const rooms = Array.from(client.rooms);
            const chatId = rooms.find(room => room !== client.id);
            if (!chatId) {
                client.emit('error', {
                    type: 'error',
                    data: 'Not in a chat room'
                });
                return;
            }
            console.log(`💬 User ${userId} sending message in chat: ${chatId}`);
            const userMessage = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                role: 'user',
                content: message,
                timestamp: new Date(),
                isStreaming: false,
                isComplete: true,
                metadata: { images },
            };
            await this.chatHistoryService.addMessageToChat(chatId, userMessage);
            client.emit('message_sent', {
                type: 'message_sent',
                data: { messageId: userMessage.id, content: message }
            });
            const chat = await this.chatHistoryService.getChatById(chatId);
            if (!chat) {
                client.emit('error', {
                    type: 'error',
                    data: 'Chat not found'
                });
                return;
            }
            const aiRequest = {
                sessionId: chatId,
                userId,
                message,
                modelId: chat.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
                collectionNames: chat.collectionNames || [],
                agentId: chat.agentId ? chat.agentId.toString() : undefined,
                systemPrompt: chat.systemPrompt,
                temperature: 0.7,
                maxTokens: 4000,
                images: images || [],
            };
            await this.taskQueueService.addChatTask('generate_response', aiRequest);
            console.log(`✅ Message queued for AI processing in chat: ${chatId}`);
        }
        catch (error) {
            console.log(`❌ Send message error: ${error.message}`);
            client.emit('error', {
                type: 'error',
                data: `Failed to send message: ${error.message}`
            });
        }
    }
    async handleLeaveRoom(client) {
        try {
            const userId = client.data.userId;
            const rooms = Array.from(client.rooms);
            const chatId = rooms.find(room => room !== client.id);
            if (chatId) {
                await client.leave(chatId);
                await this.webSocketService.leaveRoom(client, chatId);
                this.redisPubSubService.disconnect(chatId, client);
                client.emit('room_left', {
                    type: 'room_left',
                    data: { chatId }
                });
                console.log(`👋 User ${userId} left room: ${chatId}`);
            }
        }
        catch (error) {
            console.log(`❌ Leave room error: ${error.message}`);
        }
    }
};
exports.WebSocketGateway = WebSocketGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], WebSocketGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WebSocketGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('create_room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WebSocketGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('send_message'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WebSocketGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], WebSocketGateway.prototype, "handleLeaveRoom", null);
exports.WebSocketGateway = WebSocketGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
            credentials: true,
        },
        namespace: '/ws',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_service_1.ConfigService,
        websocket_service_1.WebSocketService,
        chat_service_1.ChatService,
        chat_history_service_1.ChatHistoryService,
        agent_service_1.AgentService,
        task_queue_service_1.TaskQueueService,
        redis_pubsub_service_1.RedisPubSubService])
], WebSocketGateway);
//# sourceMappingURL=websocket.gateway.js.map