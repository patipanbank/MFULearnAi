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
const chat_history_service_1 = require("./chat-history.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const role_guard_1 = require("../auth/guards/role.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const user_model_1 = require("../models/user.model");
let ChatController = class ChatController {
    chatService;
    chatHistoryService;
    constructor(chatService, chatHistoryService) {
        this.chatService = chatService;
        this.chatHistoryService = chatHistoryService;
    }
    async getChatHistory(req) {
        try {
            const userId = req.user.id;
            const chats = await this.chatHistoryService.getChatHistoryForUser(userId);
            return {
                success: true,
                data: chats,
                message: 'Chat history retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get chat history: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getChatById(chatId, req) {
        try {
            const userId = req.user.id;
            const chat = await this.chatHistoryService.getChatById(chatId);
            if (!chat) {
                throw new common_1.HttpException('Chat not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.HttpException('Access denied', common_1.HttpStatus.FORBIDDEN);
            }
            return {
                success: true,
                data: chat,
                message: 'Chat retrieved successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to get chat: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async createChat(createChatDto, req) {
        try {
            const userId = req.user.id;
            const { name, agentId, modelId } = createChatDto;
            const chat = await this.chatHistoryService.createChat(userId, name || 'New Chat', agentId, modelId);
            return {
                success: true,
                data: chat,
                message: 'Chat created successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to create chat: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateChatName(chatId, body, req) {
        try {
            const userId = req.user.id;
            const chat = await this.chatHistoryService.getChatById(chatId);
            if (!chat) {
                throw new common_1.HttpException('Chat not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.HttpException('Access denied', common_1.HttpStatus.FORBIDDEN);
            }
            const updatedChat = await this.chatHistoryService.updateChatName(chatId, body.name);
            return {
                success: true,
                data: updatedChat,
                message: 'Chat name updated successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to update chat name: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async updateChatPinStatus(chatId, body, req) {
        try {
            const userId = req.user.id;
            const chat = await this.chatHistoryService.getChatById(chatId);
            if (!chat) {
                throw new common_1.HttpException('Chat not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.HttpException('Access denied', common_1.HttpStatus.FORBIDDEN);
            }
            const updatedChat = await this.chatHistoryService.updateChatPinStatus(chatId, body.isPinned);
            return {
                success: true,
                data: updatedChat,
                message: 'Chat pin status updated successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to update chat pin status: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async deleteChat(chatId, req) {
        try {
            const userId = req.user.id;
            const chat = await this.chatHistoryService.getChatById(chatId);
            if (!chat) {
                throw new common_1.HttpException('Chat not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.HttpException('Access denied', common_1.HttpStatus.FORBIDDEN);
            }
            const deleted = await this.chatHistoryService.deleteChat(chatId);
            if (!deleted) {
                throw new common_1.HttpException('Failed to delete chat', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
            }
            return {
                success: true,
                message: 'Chat deleted successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to delete chat: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async clearChatMemory(chatId, req) {
        try {
            const userId = req.user.id;
            const chat = await this.chatHistoryService.getChatById(chatId);
            if (!chat) {
                throw new common_1.HttpException('Chat not found', common_1.HttpStatus.NOT_FOUND);
            }
            if (chat.userId.toString() !== userId) {
                throw new common_1.HttpException('Access denied', common_1.HttpStatus.FORBIDDEN);
            }
            await this.chatService.clearChatMemory(chatId, userId);
            return {
                success: true,
                message: 'Chat memory cleared successfully',
            };
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(`Failed to clear chat memory: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getUserChatStats(req) {
        try {
            const userId = req.user.id;
            const stats = await this.chatService.getUserChatStats(userId);
            return {
                success: true,
                data: stats,
                message: 'User chat stats retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get user chat stats: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getMemoryStats() {
        try {
            const stats = await this.chatService.getMemoryStats();
            return {
                success: true,
                data: stats,
                message: 'Memory stats retrieved successfully',
            };
        }
        catch (error) {
            throw new common_1.HttpException(`Failed to get memory stats: ${error.message}`, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getChatHistory", null);
__decorate([
    (0, common_1.Get)(':chatId'),
    __param(0, (0, common_1.Param)('chatId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getChatById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "createChat", null);
__decorate([
    (0, common_1.Put)(':chatId/name'),
    __param(0, (0, common_1.Param)('chatId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "updateChatName", null);
__decorate([
    (0, common_1.Put)(':chatId/pin'),
    __param(0, (0, common_1.Param)('chatId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "updateChatPinStatus", null);
__decorate([
    (0, common_1.Delete)(':chatId'),
    __param(0, (0, common_1.Param)('chatId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "deleteChat", null);
__decorate([
    (0, common_1.Post)(':chatId/clear-memory'),
    __param(0, (0, common_1.Param)('chatId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "clearChatMemory", null);
__decorate([
    (0, common_1.Get)('stats/user'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getUserChatStats", null);
__decorate([
    (0, common_1.Get)('stats/memory'),
    (0, common_1.UseGuards)(role_guard_1.RoleGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserRole.ADMIN),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getMemoryStats", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('chat'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        chat_history_service_1.ChatHistoryService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map