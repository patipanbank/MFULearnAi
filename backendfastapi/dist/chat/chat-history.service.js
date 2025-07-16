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
exports.ChatHistoryService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_model_1 = require("../models/chat.model");
let ChatHistoryService = class ChatHistoryService {
    chatModel;
    constructor(chatModel) {
        this.chatModel = chatModel;
    }
    async getChatHistoryForUser(userId) {
        try {
            const chats = await this.chatModel
                .find({ userId })
                .sort({ updatedAt: -1 })
                .exec();
            return chats;
        }
        catch (error) {
            throw new Error(`Failed to get chat history for user: ${error.message}`);
        }
    }
    async getChatById(chatId) {
        try {
            const chat = await this.chatModel.findById(chatId).exec();
            return chat;
        }
        catch (error) {
            throw new Error(`Failed to get chat by ID: ${error.message}`);
        }
    }
    async createChat(userId, name, agentId, modelId) {
        try {
            const chatData = {
                userId,
                name,
                messages: [],
                isPinned: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            if (agentId) {
                chatData['agentId'] = agentId;
            }
            else if (modelId) {
                chatData['modelId'] = modelId;
            }
            const chat = new this.chatModel(chatData);
            const savedChat = await chat.save();
            return savedChat;
        }
        catch (error) {
            throw new Error(`Failed to create chat: ${error.message}`);
        }
    }
    async addMessageToChat(chatId, message) {
        try {
            const result = await this.chatModel.findByIdAndUpdate(chatId, {
                $push: { messages: message },
                $set: { updatedAt: new Date() },
            }, { new: true }).exec();
            return result;
        }
        catch (error) {
            throw new Error(`Failed to add message to chat: ${error.message}`);
        }
    }
    async deleteChat(chatId) {
        try {
            const result = await this.chatModel.findByIdAndDelete(chatId).exec();
            return !!result;
        }
        catch (error) {
            throw new Error(`Failed to delete chat: ${error.message}`);
        }
    }
    async updateChatName(chatId, name) {
        try {
            const result = await this.chatModel.findByIdAndUpdate(chatId, {
                $set: { name, updatedAt: new Date() },
            }, { new: true }).exec();
            return result;
        }
        catch (error) {
            throw new Error(`Failed to update chat name: ${error.message}`);
        }
    }
    async updateChatPinStatus(chatId, isPinned) {
        try {
            const result = await this.chatModel.findByIdAndUpdate(chatId, {
                $set: { isPinned, updatedAt: new Date() },
            }, { new: true }).exec();
            return result;
        }
        catch (error) {
            throw new Error(`Failed to update chat pin status: ${error.message}`);
        }
    }
};
exports.ChatHistoryService = ChatHistoryService;
exports.ChatHistoryService = ChatHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_model_1.Chat.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ChatHistoryService);
//# sourceMappingURL=chat-history.service.js.map