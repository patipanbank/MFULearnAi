"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const chat_1 = require("../models/chat");
const websocketManager_1 = require("../utils/websocketManager");
const agentService_1 = require("./agentService");
const usageService_1 = require("./usageService");
const agentCacheManager_1 = require("./agentCacheManager");
const smartMemoryService_1 = require("./smartMemoryService");
const storageService_1 = require("./storageService");
const serviceError_1 = require("../utils/serviceError");
class ChatService {
    constructor() {
        this.errorHandler = (0, serviceError_1.createServiceErrorHandler)('ChatService');
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
        console.log(`✅ Created chat session ${chat._id} for user ${userId}`);
        return chat;
    }
    async getChat(chatId, userId, includeDeleted = false) {
        console.log(`🔍 Looking for chat: ${chatId} for user: ${userId} (includeDeleted: ${includeDeleted})`);
        const query = { _id: chatId, userId };
        if (!includeDeleted) {
            query.isDeleted = { $ne: true };
        }
        const chat = await chat_1.ChatModel.findOne(query);
        if (chat) {
            console.log(`✅ Found chat: ${chatId} ${chat.isDeleted ? '(deleted)' : ''}`);
        }
        else {
            console.log(`❌ Chat not found: ${chatId}`);
            const chatWithoutUser = await chat_1.ChatModel.findById(chatId);
            if (chatWithoutUser) {
                if (chatWithoutUser.userId !== userId) {
                    console.log(`⚠️ Chat exists but belongs to user: ${chatWithoutUser.userId}`);
                }
                else if (chatWithoutUser.isDeleted && !includeDeleted) {
                    console.log(`⚠️ Chat exists but is deleted`);
                }
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
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const isDuplicate = chat.messages.some(msg => msg.role === message.role &&
            msg.content === message.content &&
            Math.abs(new Date().getTime() - msg.timestamp.getTime()) < 5000);
        if (isDuplicate) {
            console.log(`⚠️ Duplicate message detected and skipped for chat ${chatId}`);
            return chat.messages[chat.messages.length - 1];
        }
        const newMessage = {
            id: messageId,
            ...message,
            timestamp: new Date()
        };
        chat.messages.push(newMessage);
        chat.updatedAt = new Date();
        await chat.save();
        console.log(`✅ Added message to session ${chatId}:`, messageId);
        return newMessage;
    }
    async prepareImagesForMultimodal(images) {
        if (!images || images.length === 0) {
            return [];
        }
        const preparedImages = [];
        const maxImageSize = 10 * 1024 * 1024;
        const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        console.log(`🖼️ Preparing ${images.length} images for vision processing...`);
        for (const [index, image] of images.entries()) {
            try {
                console.log(`🖼️ Processing image ${index + 1}/${images.length}: ${image.url.substring(0, 50)}...`);
                if (!supportedFormats.includes(image.mediaType)) {
                    console.warn(`⚠️ Unsupported image format: ${image.mediaType}`);
                    preparedImages.push({
                        ...image,
                        base64Data: undefined,
                        error: `Unsupported format: ${image.mediaType}. Supported: JPEG, PNG, GIF, WebP`
                    });
                    continue;
                }
                const base64Data = await storageService_1.storageService.getFileAsBase64(image.url);
                if (base64Data) {
                    const base64Size = base64Data.data.length * 0.75;
                    if (base64Size > maxImageSize) {
                        const sizeInMB = (base64Size / 1024 / 1024).toFixed(1);
                        console.warn(`⚠️ Image too large for vision processing: ${sizeInMB}MB`);
                        preparedImages.push({
                            ...image,
                            base64Data: undefined,
                            error: `Image too large: ${sizeInMB}MB (max 10MB)`
                        });
                        continue;
                    }
                    preparedImages.push({
                        ...image,
                        base64Data: base64Data.data,
                        mediaType: base64Data.mediaType || image.mediaType
                    });
                    console.log(`✅ Image ${index + 1} prepared successfully: ${base64Data.mediaType}, size: ${Math.round(base64Data.data.length / 1024)}KB`);
                }
                else {
                    console.warn(`⚠️ Failed to prepare image ${index + 1}: ${image.url}`);
                    preparedImages.push({
                        ...image,
                        base64Data: undefined,
                        error: 'Failed to load image'
                    });
                }
            }
            catch (error) {
                console.error(`❌ Error preparing image ${index + 1} (${image.url}):`, error.message);
                preparedImages.push({
                    ...image,
                    base64Data: undefined,
                    error: error.message || 'Unknown error'
                });
            }
        }
        const successCount = preparedImages.filter(img => img.base64Data).length;
        console.log(`📊 Vision preparation complete: ${successCount}/${images.length} images ready for processing`);
        return preparedImages;
    }
    async processMessage(chatId, userId, content, images) {
        console.log(`🚀 [NEW] processMessage: chat=${chatId}, user=${userId}`);
        console.log(`🚀 Content: "${content.substring(0, 50)}...", Images: ${images?.length || 0}`);
        try {
            console.log(`💾 Step 1: Saving user message to database...`);
            const userMessage = await this.addMessage(chatId, {
                role: 'user',
                content,
                images
            });
            console.log(`📡 Step 2: Notifying frontend about user message...`);
            this.broadcastToChat(chatId, {
                type: 'message_added',
                data: {
                    message: {
                        id: userMessage.id,
                        role: 'user',
                        content: userMessage.content,
                        timestamp: userMessage.timestamp.toISOString(),
                        images: userMessage.images
                    }
                }
            });
            console.log(`🤖 Step 3: Creating assistant message...`);
            const assistantMessage = await this.addMessage(chatId, {
                role: 'assistant',
                content: ''
            });
            console.log(`📡 Step 4: Notifying frontend about assistant message...`);
            this.broadcastToChat(chatId, {
                type: 'message_added',
                data: {
                    message: {
                        id: assistantMessage.id,
                        role: 'assistant',
                        content: '',
                        timestamp: assistantMessage.timestamp.toISOString(),
                        isStreaming: true
                    }
                }
            });
            console.log(`🤖 Step 5: Processing with AI...`);
            await this.processWithAISimple(chatId, assistantMessage.id, content, images, userId);
        }
        catch (error) {
            console.error('❌ Error in processMessage:', error);
            this.broadcastToChat(chatId, {
                type: 'error',
                data: { message: 'Failed to process message' }
            });
        }
    }
    broadcastToChat(chatId, data) {
        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify(data));
        }
    }
    async processWithAISimple(chatId, assistantMessageId, userContent, images, userId) {
        try {
            console.log(`🤖 processWithAISimple: chatId=${chatId}, assistantId=${assistantMessageId}`);
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error(`Chat not found: ${chatId}`);
            }
            let agentConfig = null;
            let modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
            let collectionNames = [];
            let systemPrompt = "You are a helpful assistant. Use tools when appropriate.";
            let temperature = 0.7;
            let maxTokens = 4000;
            if (chat.agentId) {
                try {
                    agentConfig = await agentService_1.agentService.getAgentById(chat.agentId);
                    if (agentConfig) {
                        modelId = agentConfig.modelId;
                        collectionNames = agentConfig.collectionNames || [];
                        systemPrompt = agentConfig.systemPrompt || systemPrompt;
                        temperature = agentConfig.temperature || 0.7;
                        maxTokens = agentConfig.maxTokens || 4000;
                    }
                }
                catch (error) {
                    console.warn(`⚠️ Failed to get agent config:`, error);
                }
            }
            console.log(`🔧 Getting agent from cache manager...`);
            const agentCacheConfig = {
                modelId,
                temperature,
                maxTokens,
                systemPrompt,
                collectionNames,
                sessionId: chatId
            };
            const agent = await agentCacheManager_1.agentCacheManager.getAgent(agentCacheConfig);
            const chatHistory = chat.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                id: msg.id,
                timestamp: msg.timestamp
            }));
            let preparedImages = [];
            if (images && images.length > 0) {
                console.log(`🖼️ Preparing ${images.length} images...`);
                preparedImages = await this.prepareImagesForMultimodal(images);
            }
            let fullContent = '';
            console.log(`🚀 Starting agent.run...`);
            await agent.run(chatHistory, {
                images: preparedImages.filter(img => img.base64Data),
                onEvent: async (event) => {
                    console.log(`📡 Agent event: ${event.type}`);
                    if (event.type === 'chunk') {
                        const chunkContent = String(event.data || '');
                        fullContent += chunkContent;
                        await this.updateMessageContent(chatId, assistantMessageId, fullContent);
                        this.broadcastToChat(chatId, {
                            type: 'message_updated',
                            data: {
                                messageId: assistantMessageId,
                                content: fullContent,
                                isStreaming: true
                            }
                        });
                    }
                    else if (event.type === 'tool_start') {
                        this.broadcastToChat(chatId, {
                            type: 'tool_start',
                            data: {
                                messageId: assistantMessageId,
                                toolName: event.data.tool_name,
                                toolInput: event.data.tool_input
                            }
                        });
                    }
                    else if (event.type === 'tool_result') {
                        this.broadcastToChat(chatId, {
                            type: 'tool_result',
                            data: {
                                messageId: assistantMessageId,
                                toolName: event.data.tool_name,
                                result: event.data.output
                            }
                        });
                    }
                    else if (event.type === 'end') {
                        const finalContent = String(event.data.answer || fullContent);
                        await this.updateMessageContent(chatId, assistantMessageId, finalContent);
                        this.broadcastToChat(chatId, {
                            type: 'message_completed',
                            data: {
                                messageId: assistantMessageId,
                                content: finalContent
                            }
                        });
                        if (userId && (event.data.inputTokens || event.data.outputTokens)) {
                            await usageService_1.usageService.updateUsage(userId, event.data.inputTokens || 0, event.data.outputTokens || 0);
                        }
                        console.log(`✅ AI processing completed for message ${assistantMessageId}`);
                    }
                },
                maxSteps: 5
            });
        }
        catch (error) {
            console.error('❌ Error in processWithAISimple:', error);
            const errorMessage = error instanceof Error ? error.message : 'AI processing failed';
            await this.updateMessageContent(chatId, assistantMessageId, `[Error: ${errorMessage}]`);
            this.broadcastToChat(chatId, {
                type: 'message_error',
                data: {
                    messageId: assistantMessageId,
                    error: errorMessage
                }
            });
        }
    }
    async updateMessageContent(chatId, messageId, content) {
        await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': messageId }, {
            $set: {
                'messages.$.content': content,
                updatedAt: new Date()
            }
        });
    }
    async getUserChats(userId, includeDeleted = false) {
        const query = { userId };
        if (!includeDeleted) {
            query.isDeleted = { $ne: true };
        }
        const chats = await chat_1.ChatModel.find(query)
            .sort({ updatedAt: -1 })
            .exec();
        return chats;
    }
    async getUserDeletedChats(userId) {
        const chats = await chat_1.ChatModel.find({
            userId,
            isDeleted: true
        })
            .sort({ deletedAt: -1 })
            .exec();
        return chats;
    }
    async deleteChat(chatId, userId) {
        const result = await chat_1.ChatModel.findOneAndUpdate({ _id: chatId, userId, isDeleted: { $ne: true } }, {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: userId,
            updatedAt: new Date()
        }, { new: true });
        const success = !!result;
        if (success) {
            console.log(`🗑️ Soft deleted chat ${chatId} for user ${userId}`);
        }
        else {
            console.log(`❌ Failed to soft delete chat ${chatId} for user ${userId}`);
        }
        return success;
    }
    async permanentlyDeleteChat(chatId, userId) {
        const result = await chat_1.ChatModel.deleteOne({ _id: chatId, userId });
        const success = result.deletedCount > 0;
        if (success) {
            console.log(`💀 Permanently deleted chat ${chatId} for user ${userId}`);
            try {
                await smartMemoryService_1.smartMemoryService.clearSession(chatId);
                console.log(`🧹 Cleared memory for permanently deleted chat ${chatId}`);
            }
            catch (err) {
                console.warn(`⚠️ Failed to clear memory for permanently deleted chat ${chatId}:`, err);
            }
        }
        else {
            console.log(`❌ Failed to permanently delete chat ${chatId} for user ${userId}`);
        }
        return success;
    }
    async restoreChat(chatId, userId) {
        const chat = await chat_1.ChatModel.findOneAndUpdate({ _id: chatId, userId, isDeleted: true }, {
            isDeleted: false,
            deletedAt: undefined,
            deletedBy: undefined,
            updatedAt: new Date()
        }, { new: true });
        if (chat) {
            console.log(`♻️ Restored chat ${chatId} for user ${userId}`);
        }
        else {
            console.log(`❌ Failed to restore chat ${chatId} for user ${userId}`);
        }
        return chat;
    }
    async updateChatName(chatId, userId, name) {
        const chat = await chat_1.ChatModel.findOneAndUpdate({ _id: chatId, userId }, { name, updatedAt: new Date() }, { new: true });
        if (chat) {
            console.log(`📝 Updated chat name for session ${chatId}: ${name}`);
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
    async deleteMessage(chatId, messageId, userId) {
        const result = await chat_1.ChatModel.updateOne({
            _id: chatId,
            userId,
            isDeleted: { $ne: true },
            'messages.id': messageId,
            'messages.isDeleted': { $ne: true }
        }, {
            $set: {
                'messages.$.isDeleted': true,
                'messages.$.deletedAt': new Date(),
                updatedAt: new Date()
            }
        });
        const success = result.modifiedCount > 0;
        if (success) {
            console.log(`🗑️ Soft deleted message ${messageId} in chat ${chatId}`);
        }
        else {
            console.log(`❌ Failed to soft delete message ${messageId} in chat ${chatId}`);
        }
        return success;
    }
    async restoreMessage(chatId, messageId, userId) {
        const result = await chat_1.ChatModel.updateOne({
            _id: chatId,
            userId,
            'messages.id': messageId,
            'messages.isDeleted': true
        }, {
            $set: {
                'messages.$.isDeleted': false,
                'messages.$.deletedAt': undefined,
                updatedAt: new Date()
            }
        });
        const success = result.modifiedCount > 0;
        if (success) {
            console.log(`♻️ Restored message ${messageId} in chat ${chatId}`);
        }
        else {
            console.log(`❌ Failed to restore message ${messageId} in chat ${chatId}`);
        }
        return success;
    }
    async getChatWithActiveMessages(chatId, userId) {
        const chat = await this.getChat(chatId, userId);
        if (chat) {
            chat.messages = chat.messages.filter(msg => !msg.isDeleted);
        }
        return chat;
    }
    async clearChatMemory(chatId) {
        try {
            await smartMemoryService_1.smartMemoryService.clearSession(chatId);
            console.log(`✅ Memory cleared for chat ${chatId}`);
        }
        catch (error) {
            console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
        }
    }
    shouldUseMemoryTool(messageCount) {
        return messageCount > 10;
    }
    shouldUseRedisMemory(messageCount) {
        return true;
    }
    shouldEmbedMessages(messageCount) {
        return messageCount % 10 === 0;
    }
    getStats() {
        const cacheStats = agentCacheManager_1.agentCacheManager.getStats();
        return {
            totalChats: 0,
            activeSessions: 0,
            totalMessages: 0,
            agentCache: {
                totalAgents: cacheStats.totalEntries,
                maxCacheSize: cacheStats.maxSize,
                ttlHours: cacheStats.ttlMs / (60 * 60 * 1000),
                topAgents: cacheStats.entries.slice(0, 5)
            }
        };
    }
    getAgentCacheStats() {
        return agentCacheManager_1.agentCacheManager.getStats();
    }
    clearAgentCache() {
        agentCacheManager_1.agentCacheManager.clearCache();
    }
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
//# sourceMappingURL=chatService.js.map