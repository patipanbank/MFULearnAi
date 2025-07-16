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
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const common_2 = require("@nestjs/common");
const mongoose_2 = require("mongoose");
const chat_model_1 = require("../models/chat.model");
const user_model_1 = require("../models/user.model");
const redis_service_1 = require("../redis/redis.service");
const chat_memory_service_1 = require("./chat-memory.service");
const memory_tool_service_1 = require("./memory-tool.service");
const langchain_chat_service_1 = require("../langchain/langchain-chat.service");
let ChatService = class ChatService {
    chatModel;
    userModel;
    redisService;
    chatMemoryService;
    memoryToolService;
    langchainChatService;
    constructor(chatModel, userModel, redisService, chatMemoryService, memoryToolService, langchainChatService) {
        this.chatModel = chatModel;
        this.userModel = userModel;
        this.redisService = redisService;
        this.chatMemoryService = chatMemoryService;
        this.memoryToolService = memoryToolService;
        this.langchainChatService = langchainChatService;
    }
    async createChat(userId, createChatDto) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            const chat = new this.chatModel({
                userId,
                title: createChatDto.title || 'New Chat',
                agentId: createChatDto.agentId,
                department: createChatDto.department || user.department,
                isPrivate: createChatDto.isPrivate || false,
                messages: [],
                metadata: {
                    createdBy: userId,
                    createdAt: new Date(),
                },
            });
            const savedChat = await chat.save();
            await this.redisService.set(`chat:${savedChat._id}`, JSON.stringify(savedChat), 3600);
            return savedChat;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException) {
                throw error;
            }
            throw new common_1.BadRequestException('Failed to create chat');
        }
    }
    async sendMessage(chatId, userId, messageDto) {
        try {
            const chat = await this.chatModel.findById(chatId);
            if (!chat) {
                throw new common_1.NotFoundException('Chat not found');
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.BadRequestException('Access denied');
            }
            const message = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                content: messageDto.content,
                role: messageDto.role || 'user',
                timestamp: new Date(),
                isStreaming: false,
                isComplete: true,
                metadata: messageDto.metadata || {},
            };
            chat.messages.push(message);
            chat.updated = new Date();
            const savedChat = await chat.save();
            await this.redisService.set(`chat:${chatId}`, JSON.stringify(savedChat), 3600);
            await this.redisService.publishChatMessage(chatId, message);
            if (messageDto.role === 'user') {
                await this.chatMemoryService.addUserMessage(chatId, messageDto.content);
            }
            else if (messageDto.role === 'assistant') {
                await this.chatMemoryService.addAiMessage(chatId, messageDto.content);
            }
            const messageCount = chat.messages.length;
            if (this.memoryToolService.shouldEmbedMessages(messageCount)) {
                const messagesForMemory = chat.messages.map(msg => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp.toISOString(),
                }));
                await this.memoryToolService.addChatMemory(chatId, messagesForMemory);
            }
            return savedChat;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Failed to send message');
        }
    }
    async getChats(query) {
        try {
            const filter = {};
            if (query.userId) {
                filter.userId = query.userId;
            }
            if (query.agentId) {
                filter.agentId = query.agentId;
            }
            if (query.department) {
                filter.department = query.department;
            }
            const page = query.page || 1;
            const limit = query.limit || 20;
            const skip = (page - 1) * limit;
            const [chats, total] = await Promise.all([
                this.chatModel
                    .find(filter)
                    .sort({ updatedAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate('userId', 'username email role')
                    .exec(),
                this.chatModel.countDocuments(filter),
            ]);
            return { chats, total };
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get chats');
        }
    }
    async getChatById(chatId, userId) {
        try {
            const cachedChat = await this.redisService.get(`chat:${chatId}`);
            if (cachedChat) {
                const chat = JSON.parse(cachedChat);
                if (chat.userId === userId) {
                    return chat;
                }
            }
            const chat = await this.chatModel
                .findById(chatId)
                .populate('userId', 'username email role')
                .exec();
            if (!chat) {
                throw new common_1.NotFoundException('Chat not found');
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.BadRequestException('Access denied');
            }
            await this.redisService.set(`chat:${chatId}`, JSON.stringify(chat), 3600);
            return chat;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Failed to get chat');
        }
    }
    async deleteChat(chatId, userId) {
        try {
            const chat = await this.chatModel.findById(chatId);
            if (!chat) {
                throw new common_1.NotFoundException('Chat not found');
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.BadRequestException('Access denied');
            }
            await this.chatModel.findByIdAndDelete(chatId);
            await this.redisService.del(`chat:${chatId}`);
            await this.clearChatMemory(chatId, userId);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Failed to delete chat');
        }
    }
    async getChatHistory(chatId, userId) {
        const chat = await this.getChatById(chatId, userId);
        return chat.messages || [];
    }
    async updateChatTitle(chatId, userId, title) {
        try {
            const chat = await this.chatModel.findById(chatId);
            if (!chat) {
                throw new common_1.NotFoundException('Chat not found');
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.BadRequestException('Access denied');
            }
            chat.title = title;
            chat.updated = new Date();
            const savedChat = await chat.save();
            await this.redisService.set(`chat:${chatId}`, JSON.stringify(savedChat), 3600);
            return savedChat;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Failed to update chat title');
        }
    }
    async getUserChatStats(userId) {
        try {
            const totalChats = await this.chatModel.countDocuments({ userId });
            const totalMessages = await this.chatModel.aggregate([
                { $match: { userId } },
                { $project: { messageCount: { $size: '$messages' } } },
                { $group: { _id: null, total: { $sum: '$messageCount' } } },
            ]);
            const redisMemoryStats = await this.chatMemoryService.getMemoryStats();
            const memoryToolStats = await this.memoryToolService.getMemoryStats();
            return {
                totalChats,
                totalMessages: totalMessages[0]?.total || 0,
                redisMemory: redisMemoryStats,
                memoryTool: memoryToolStats,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get user chat stats');
        }
    }
    async clearChatMemory(chatId, userId) {
        try {
            const chat = await this.chatModel.findById(chatId);
            if (!chat) {
                throw new common_1.NotFoundException('Chat not found');
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.BadRequestException('Not authorized to clear memory for this chat');
            }
            await this.chatMemoryService.clear(chatId);
            await this.memoryToolService.clearChatMemory(chatId);
            console.log(`🧹 Cleared all memory for chat ${chatId} (Redis + Memory Tool)`);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Failed to clear chat memory');
        }
    }
    async restoreRedisMemoryFromHistory(chatId) {
        try {
            const chat = await this.chatModel.findById(chatId);
            if (!chat || !chat.messages) {
                return;
            }
            const hasMemory = await this.chatMemoryService.hasMemory(chatId);
            if (hasMemory) {
                return;
            }
            const memoryMessages = chat.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                id: msg.id,
            }));
            await this.chatMemoryService.restoreFromHistory(chatId, memoryMessages);
        }
        catch (error) {
            console.error(`Failed to restore Redis memory for chat ${chatId}:`, error);
        }
    }
    async getMemoryStats() {
        try {
            const redisStats = await this.chatMemoryService.getMemoryStats();
            const memoryToolStats = await this.memoryToolService.getMemoryStats();
            return {
                redis: redisStats,
                memoryTool: memoryToolStats,
                combined: {
                    totalSessions: Math.max(redisStats.totalSessions, memoryToolStats.totalSessions),
                    totalMessages: redisStats.totalMessages + memoryToolStats.totalMessages,
                },
            };
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get memory stats');
        }
    }
    async pinChat(chatId, userId, isPinned) {
        try {
            const chat = await this.chatModel.findById(chatId);
            if (!chat) {
                throw new common_1.NotFoundException('Chat not found');
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.BadRequestException('Access denied');
            }
            chat.isPinned = isPinned;
            chat.updated = new Date();
            const savedChat = await chat.save();
            await this.redisService.set(`chat:${chatId}`, JSON.stringify(savedChat), 3600);
            return savedChat;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Failed to pin/unpin chat');
        }
    }
    async *generateResponse(request) {
        try {
            const langchainService = this.langchainChatService;
            const chatRequest = {
                sessionId: request.sessionId,
                userId: request.userId,
                message: request.message,
                modelId: request.modelId,
                collectionNames: request.collectionNames,
                agentId: request.agentId,
                systemPrompt: request.systemPrompt,
                temperature: request.temperature || 0.7,
                maxTokens: request.maxTokens || 4000,
                images: request.images || [],
            };
            for await (const chunk of langchainService.chat(chatRequest)) {
                yield chunk;
            }
        }
        catch (error) {
            yield JSON.stringify({
                type: 'error',
                data: `Failed to generate response: ${error.message}`
            });
        }
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_model_1.Chat.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_model_1.User.name)),
    __param(5, (0, common_2.Inject)((0, common_2.forwardRef)(() => langchain_chat_service_1.LangChainChatService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        redis_service_1.RedisService,
        chat_memory_service_1.ChatMemoryService,
        memory_tool_service_1.MemoryToolService,
        langchain_chat_service_1.LangChainChatService])
], ChatService);
//# sourceMappingURL=chat.service.js.map