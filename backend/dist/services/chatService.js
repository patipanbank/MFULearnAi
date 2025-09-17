"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const chat_1 = require("../models/chat");
const websocketManager_1 = require("../utils/websocketManager");
const agentService_1 = require("./agentService");
const usageService_1 = require("./usageService");
const agentExecutionService_1 = require("./agentExecutionService");
const memoryService_1 = require("./memoryService");
const storageService_1 = require("./storageService");
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
        console.log(`✅ Created chat session ${chat._id} for user ${userId}`);
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
            console.log(`🤖 Step 5: Processing with AI using execution service...`);
            await this.processWithExecutionService(chatId, assistantMessage.id, content, images, userId);
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
    async processWithExecutionService(chatId, assistantMessageId, userContent, images, userId) {
        try {
            console.log(`🚀 processWithExecutionService: chatId=${chatId}, assistantId=${assistantMessageId}`);
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
            let preparedImages = [];
            if (images && images.length > 0) {
                console.log(`🖼️ Preparing ${images.length} images...`);
                preparedImages = await this.prepareImagesForMultimodal(images);
            }
            const executionRequest = {
                id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                chatId,
                userId: userId || 'unknown',
                agentId: chat.agentId,
                prompt: systemPrompt,
                context: {
                    userContent,
                    images: preparedImages.filter(img => img.base64Data),
                    modelId,
                    temperature,
                    maxTokens,
                    collectionNames,
                    chatHistory: chat.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content,
                        id: msg.id,
                        timestamp: msg.timestamp
                    }))
                },
                priority: agentExecutionService_1.ExecutionPriority.NORMAL,
                timeout: 60000,
                createdAt: new Date()
            };
            let fullContent = '';
            const onExecutionEvent = async (event) => {
                if (event.executionId !== executionRequest.id)
                    return;
                const agentEvent = event.event;
                console.log(`📡 Agent event: ${agentEvent.type}`);
                if (agentEvent.type === 'chunk') {
                    const chunkContent = String(agentEvent.data || '');
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
                else if (agentEvent.type === 'tool_start') {
                    this.broadcastToChat(chatId, {
                        type: 'tool_start',
                        data: {
                            messageId: assistantMessageId,
                            toolName: agentEvent.data.tool_name,
                            toolInput: agentEvent.data.tool_input
                        }
                    });
                }
                else if (agentEvent.type === 'tool_result') {
                    this.broadcastToChat(chatId, {
                        type: 'tool_result',
                        data: {
                            messageId: assistantMessageId,
                            toolName: agentEvent.data.tool_name,
                            result: agentEvent.data.output
                        }
                    });
                }
                else if (agentEvent.type === 'end') {
                    const finalContent = String(agentEvent.data.answer || fullContent);
                    await this.updateMessageContent(chatId, assistantMessageId, finalContent);
                    this.broadcastToChat(chatId, {
                        type: 'message_completed',
                        data: {
                            messageId: assistantMessageId,
                            content: finalContent
                        }
                    });
                    if (userId && (agentEvent.data.inputTokens || agentEvent.data.outputTokens)) {
                        await usageService_1.usageService.updateUsage(userId, agentEvent.data.inputTokens || 0, agentEvent.data.outputTokens || 0);
                    }
                    console.log(`✅ AI processing completed for message ${assistantMessageId}`);
                }
            };
            agentExecutionService_1.agentExecutionService.on('execution_event', onExecutionEvent);
            try {
                const result = await agentExecutionService_1.agentExecutionService.executeAgent(executionRequest);
                if (result.success) {
                    console.log(`✅ Execution completed successfully in ${result.metrics.duration.toFixed(2)}ms`);
                    console.log(`📊 Metrics: ${result.metrics.toolCount} tools, ${result.metrics.tokenUsage.input + result.metrics.tokenUsage.output} tokens`);
                }
                else {
                    console.error(`❌ Execution failed: ${result.error}`);
                    await this.updateMessageContent(chatId, assistantMessageId, `[Error: ${result.error}]`);
                    this.broadcastToChat(chatId, {
                        type: 'message_error',
                        data: {
                            messageId: assistantMessageId,
                            error: result.error
                        }
                    });
                }
            }
            finally {
                agentExecutionService_1.agentExecutionService.off('execution_event', onExecutionEvent);
            }
        }
        catch (error) {
            console.error('❌ Error in processWithExecutionService:', error);
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
    async getUserChats(userId) {
        const chats = await chat_1.ChatModel.find({ userId })
            .sort({ updatedAt: -1 })
            .exec();
        return chats;
    }
    async deleteChat(chatId, userId) {
        const result = await chat_1.ChatModel.deleteOne({ _id: chatId, userId });
        const success = result.deletedCount > 0;
        if (success) {
            console.log(`✅ Deleted chat ${chatId} for user ${userId}`);
            try {
                await memoryService_1.memoryService.clearAllMemory(chatId);
                console.log(`🧹 Cleared memory for deleted chat ${chatId}`);
            }
            catch (err) {
                console.warn(`⚠️ Failed to clear memory for deleted chat ${chatId}:`, err);
            }
        }
        else {
            console.log(`❌ Failed to delete chat ${chatId} for user ${userId}`);
        }
        return success;
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
    async clearChatMemory(chatId) {
        try {
            await memoryService_1.memoryService.clearAllMemory(chatId);
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