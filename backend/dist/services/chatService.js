"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const chat_1 = require("../models/chat");
const langchainAgent_1 = require("../agent/langchainAgent");
const chainFactory_1 = require("../agent/chainFactory");
const agentService_1 = require("./agentService");
const websocketManager_1 = require("../utils/websocketManager");
const schema_1 = require("langchain/schema");
class ChatService {
    constructor() {
        this.agentInstances = new Map();
        this.chainInstances = new Map();
        console.log('✅ Chat service initialized');
    }
    async createChat(userId, agentId, name) {
        try {
            const chat = new chat_1.ChatModel({
                userId,
                agentId,
                name: name || `Chat with ${agentId}`,
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            await chat.save();
            return chat;
        }
        catch (error) {
            console.error('❌ Error creating chat:', error);
            throw error;
        }
    }
    async getChat(chatId) {
        try {
            return await chat_1.ChatModel.findById(chatId);
        }
        catch (error) {
            console.error('❌ Error getting chat:', error);
            return null;
        }
    }
    async getUserChats(userId) {
        try {
            return await chat_1.ChatModel.find({ userId }).sort({ updatedAt: -1 });
        }
        catch (error) {
            console.error('❌ Error getting user chats:', error);
            return [];
        }
    }
    async updateChatName(chatId, name) {
        try {
            const result = await chat_1.ChatModel.findByIdAndUpdate(chatId, { name });
            return !!result;
        }
        catch (error) {
            console.error('❌ Error updating chat name:', error);
            return false;
        }
    }
    async updateChatPinStatus(chatId, isPinned) {
        try {
            const result = await chat_1.ChatModel.findByIdAndUpdate(chatId, { isPinned });
            return !!result;
        }
        catch (error) {
            console.error('❌ Error updating chat pin status:', error);
            return false;
        }
    }
    async deleteChat(chatId) {
        try {
            const result = await chat_1.ChatModel.findByIdAndDelete(chatId);
            this.agentInstances.delete(chatId);
            this.chainInstances.delete(chatId);
            return !!result;
        }
        catch (error) {
            console.error('❌ Error deleting chat:', error);
            return false;
        }
    }
    async clearChatMemory(chatId) {
        try {
            this.agentInstances.delete(chatId);
            this.chainInstances.delete(chatId);
            const result = await chat_1.ChatModel.findByIdAndUpdate(chatId, { messages: [] });
            return !!result;
        }
        catch (error) {
            console.error('❌ Error clearing chat memory:', error);
            return false;
        }
    }
    async processMessage(chatId, userId, message, images) {
        try {
            const chat = await this.getChat(chatId);
            if (!chat) {
                throw new Error('Chat not found');
            }
            const userMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: message,
                timestamp: new Date(),
                images,
            };
            chat.messages.push(userMessage);
            chat.updatedAt = new Date();
            await chat.save();
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'user_message',
                data: userMessage
            }));
            const agent = await agentService_1.agentService.getAgentById(chat.agentId);
            if (!agent) {
                throw new Error('Agent not found');
            }
            const useLangChainAgent = agent.tools && agent.tools.length > 0;
            let response;
            if (useLangChainAgent) {
                response = await this.processWithLangChainAgent(chatId, agent, message, images);
            }
            else {
                response = await this.processWithChain(chatId, agent, message, images);
            }
            const assistantMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };
            chat.messages.push(assistantMessage);
            chat.updatedAt = new Date();
            await chat.save();
            await agentService_1.agentService.incrementUsage(agent.id, userId);
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'assistant_message',
                data: assistantMessage
            }));
        }
        catch (error) {
            console.error(`Error processing message in chat ${chatId}:`, error);
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
        }
    }
    async processWithLangChainAgent(chatId, agent, message, images) {
        let agentInstance = this.agentInstances.get(chatId);
        if (!agentInstance) {
            const config = {
                modelId: agent.modelId,
                systemPrompt: agent.systemPrompt,
                temperature: agent.temperature,
                maxTokens: agent.maxTokens,
                tools: agent.tools || [],
                collectionNames: agent.collectionNames || [],
                sessionId: chatId,
            };
            agentInstance = new langchainAgent_1.LangChainAgent(config);
            await agentInstance.initialize();
            this.agentInstances.set(chatId, agentInstance);
        }
        const messages = this.convertToLangChainMessages(agent.messages || []);
        messages.push(new schema_1.HumanMessage(message));
        return await agentInstance.processMessage(messages);
    }
    async processWithChain(chatId, agent, message, images) {
        let chainInstance = this.chainInstances.get(chatId);
        if (!chainInstance) {
            const config = {
                modelId: agent.modelId,
                systemPrompt: agent.systemPrompt,
                temperature: agent.temperature,
                maxTokens: agent.maxTokens,
                chainType: 'conversational',
                collectionNames: agent.collectionNames || [],
                sessionId: chatId,
            };
            chainInstance = new chainFactory_1.ChainFactory(config);
            await chainInstance.initialize();
            this.chainInstances.set(chatId, chainInstance);
        }
        const messages = this.convertToLangChainMessages(agent.messages || []);
        messages.push(new schema_1.HumanMessage(message));
        return await chainInstance.processMessage(messages);
    }
    convertToLangChainMessages(messages) {
        return messages.map(msg => {
            if (msg.role === 'user') {
                return new schema_1.HumanMessage(msg.content);
            }
            else if (msg.role === 'assistant') {
                return new schema_1.AIMessage(msg.content);
            }
            else if (msg.role === 'system') {
                return new schema_1.SystemMessage(msg.content);
            }
            return msg;
        });
    }
    normalizeChat(chat) {
        return {
            id: chat._id,
            userId: chat.userId,
            agentId: chat.agentId,
            name: chat.name,
            messages: chat.messages || [],
            isPinned: chat.isPinned || false,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
        };
    }
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
//# sourceMappingURL=chatService.js.map