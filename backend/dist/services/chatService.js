"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const chat_1 = require("../models/chat");
const websocketManager_1 = require("../utils/websocketManager");
const agentService_1 = require("./agentService");
const memoryService_1 = require("./memoryService");
const langchainChatService_1 = require("./langchainChatService");
class ChatService {
    constructor() {
        console.log('✅ Chat service initialized');
    }
    async createChat(userId, name, agentId) {
        const chat = new chat_1.ChatModel({
            userId,
            name,
            messages: [],
            agentId,
            isPinned: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await chat.save();
        console.log(`✅ Created chat session ${chat._id} for user ${userId} (agentId: ${agentId || 'none'})`);
        return chat;
    }
    async getChat(chatId, userId) {
        console.log(`🔍 Looking for chat: ${chatId} for user: ${userId}`);
        const chat = await chat_1.ChatModel.findOne({ _id: chatId, userId });
        if (chat) {
            console.log(`✅ Found chat: ${chatId}`);
        }
        else {
            console.log(`❌ Chat not found: ${chatId}`);
            const chatWithoutUser = await chat_1.ChatModel.findById(chatId);
            if (chatWithoutUser) {
                console.log(`⚠️ Chat exists but belongs to user: ${chatWithoutUser.userId}`);
            }
            else {
                console.log(`❌ Chat doesn't exist in database: ${chatId}`);
            }
        }
        return chat;
    }
    async addMessage(chatId, message) {
        const chat = await chat_1.ChatModel.findById(chatId);
        if (!chat) {
            throw new Error(`Chat session ${chatId} not found`);
        }
        if (!message.content || message.content.trim() === '') {
            message.content = 'กำลังประมวลผล...';
        }
        const newMessage = {
            id: Math.random().toString(36).substr(2, 9),
            ...message,
            timestamp: new Date()
        };
        chat.messages.push(newMessage);
        chat.updatedAt = new Date();
        await chat.save();
        console.log(`✅ Added message to session ${chatId}`);
        return newMessage;
    }
    async processMessage(chatId, userId, content, images) {
        try {
            const userMessage = await this.addMessage(chatId, {
                role: 'user',
                content,
                images
            });
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'accepted',
                    data: { chatId }
                }));
            }
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error(`Chat session ${chatId} not found`);
            }
            let agentConfig = null;
            let modelId = null;
            let collectionNames = [];
            let systemPrompt = null;
            let temperature = 0.7;
            let maxTokens = 4000;
            if (chat.agentId) {
                agentConfig = await agentService_1.agentService.getAgentById(chat.agentId);
                if (agentConfig) {
                    modelId = agentConfig.modelId;
                    collectionNames = agentConfig.collectionNames || [];
                    systemPrompt = agentConfig.systemPrompt;
                    temperature = agentConfig.temperature;
                    maxTokens = agentConfig.maxTokens;
                }
            }
            await this.processWithLangChain(chatId, content, images, {
                modelId,
                collectionNames,
                systemPrompt,
                temperature,
                maxTokens,
                agentId: chat.agentId
            }, userId);
        }
        catch (error) {
            console.error('❌ Error processing message:', error);
            if (error instanceof Error && error.message.includes('validation failed')) {
                console.error('Validation error details:', error);
                try {
                    await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.content': { $exists: false } }, { $set: { 'messages.$.content': 'กำลังประมวลผล...' } });
                }
                catch (fixError) {
                    console.error('Failed to fix validation error:', fixError);
                }
            }
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'error',
                    data: 'Failed to process message'
                }));
            }
        }
    }
    async processWithLangChain(chatId, userMessage, images, config, userId) {
        try {
            const assistantMessage = await this.addMessage(chatId, {
                role: 'assistant',
                content: '',
                images: [],
                isStreaming: true,
                isComplete: false
            });
            let fullResponse = '';
            const chatStream = langchainChatService_1.langchainChatService.chat(chatId, userId || '', userMessage, config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', config?.collectionNames || [], images, config?.systemPrompt || undefined, config?.temperature || 0.7, config?.maxTokens || 4000);
            for await (const chunk of chatStream) {
                try {
                    const data = JSON.parse(chunk);
                    if (data.type === 'chunk') {
                        const chunkText = data.data;
                        fullResponse += chunkText;
                        await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': assistantMessage.id }, {
                            $set: {
                                'messages.$.content': fullResponse,
                                'messages.$.isStreaming': true
                            }
                        });
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'chunk',
                                data: chunkText
                            }));
                        }
                    }
                    else if (data.type === 'tool_start') {
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify(data));
                        }
                    }
                    else if (data.type === 'tool_result') {
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify(data));
                        }
                    }
                    else if (data.type === 'tool_error') {
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify(data));
                        }
                    }
                    else if (data.type === 'end') {
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify(data));
                        }
                    }
                }
                catch (error) {
                    console.error('Error parsing chunk:', error);
                    continue;
                }
            }
            await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': assistantMessage.id }, {
                $set: {
                    'messages.$.content': fullResponse,
                    'messages.$.isStreaming': false,
                    'messages.$.isComplete': true
                }
            });
        }
        catch (error) {
            console.error('❌ Error in LangChain processing:', error);
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'error',
                    data: 'Failed to process AI response'
                }));
            }
        }
    }
    async getUserChats(userId) {
        const chats = await chat_1.ChatModel.find({ userId })
            .sort({ isPinned: -1, updatedAt: -1 })
            .exec();
        return chats;
    }
    async deleteChat(chatId, userId) {
        const result = await chat_1.ChatModel.deleteOne({ _id: chatId, userId });
        const success = result.deletedCount > 0;
        if (success) {
            console.log(`🗑️ Deleted chat session ${chatId}`);
        }
        return success;
    }
    async updateChatName(chatId, userId, name) {
        const chat = await chat_1.ChatModel.findOneAndUpdate({ _id: chatId, userId }, { name, updatedAt: new Date() }, { new: true });
        if (chat) {
            console.log(`✏️ Updated chat name for session ${chatId}`);
        }
        return chat;
    }
    async updateChatPinStatus(chatId, userId, isPinned) {
        const chat = await chat_1.ChatModel.findOneAndUpdate({ _id: chatId, userId }, { isPinned, updatedAt: new Date() }, { new: true });
        if (chat) {
            console.log(`📌 Updated pin status for session ${chatId}: ${isPinned}`);
        }
        return chat;
    }
    async clearChatMemory(chatId) {
        try {
            console.log(`🧹 Clearing memory for chat ${chatId}`);
            await langchainChatService_1.langchainChatService.clearChatMemory(chatId);
            memoryService_1.memoryService.clearChatMemory(chatId);
            console.log(`✅ Memory cleared for chat ${chatId}`);
        }
        catch (error) {
            console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
        }
    }
    getStats() {
        return {
            totalChats: 0,
            activeSessions: 0,
            totalMessages: 0
        };
    }
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
//# sourceMappingURL=chatService.js.map