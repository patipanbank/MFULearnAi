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
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const memory_service_1 = require("../../services/memory.service");
const jwt_guard_1 = require("../auth/jwt.guard");
let ChatController = class ChatController {
    constructor(chatService, memoryService) {
        this.chatService = chatService;
        this.memoryService = memoryService;
    }
    async list(req) {
        return this.chatService.findAllByUser(req.user.userId);
    }
    async create(req, name, agentId) {
        return this.chatService.createChat(req.user.userId, name, agentId);
    }
    async addMessage(chatId, req, content) {
        return this.chatService.addMessage(chatId, {
            role: 'user',
            content,
            timestamp: new Date(),
        });
    }
    async ask(chatId, req, content, modelId, systemPrompt, temperature, maxTokens) {
        await this.chatService.addMessage(chatId, {
            role: 'user',
            content,
            timestamp: new Date(),
        });
        await this.chatService.generateAnswer({
            sessionId: chatId,
            userId: req.user.userId,
            message: content,
            modelId,
            systemPrompt,
            temperature,
            maxTokens,
        });
        return { status: 'accepted', channel: `chat:${chatId}` };
    }
    async clearMemory(chatId) {
        await this.memoryService.clearChatMemory(chatId);
        return { status: 'cleared' };
    }
    async memoryStats(chatId) {
        return this.memoryService.getMemoryStats(chatId);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)('name')),
    __param(2, (0, common_1.Body)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Body)('content')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "addMessage", null);
__decorate([
    (0, common_1.Post)(':id/ask'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Body)('content')),
    __param(3, (0, common_1.Body)('modelId')),
    __param(4, (0, common_1.Body)('systemPrompt')),
    __param(5, (0, common_1.Body)('temperature')),
    __param(6, (0, common_1.Body)('maxTokens')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "ask", null);
__decorate([
    (0, common_1.Delete)(':id/clear-memory'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "clearMemory", null);
__decorate([
    (0, common_1.Get)(':id/memory/stats'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "memoryStats", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Controller)({
        path: 'chats',
        version: '1'
    }),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        memory_service_1.MemoryService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map