"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const chat_1 = require("../models/chat");
const websocketManager_1 = require("../utils/websocketManager");
const agentService_1 = require("./agentService");
const usageService_1 = require("./usageService");
const llmFactory_1 = require("../agent/llmFactory");
const toolRegistry_1 = require("../agent/toolRegistry");
const agentFactory_1 = require("../agent/agentFactory");
const memoryService_1 = require("./memoryService");
const storageService_1 = require("./storageService");
class ChatService {
    constructor() {
        this.agentCache = new Map();
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
        console.log(`🔧 processMessage called for chat ${chatId}, user ${userId}`);
        console.log(`🔧 Content: ${content.substring(0, 50)}...`);
        console.log(`🔧 Images: ${images?.length || 0}`);
        try {
            console.log(`🔧 Adding user message to chat ${chatId}`);
            const userMessage = await this.addMessage(chatId, {
                role: 'user',
                content,
                images
            });
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
                try {
                    agentConfig = await agentService_1.agentService.getAgentById(chat.agentId);
                    if (agentConfig) {
                        modelId = agentConfig.modelId;
                        collectionNames = agentConfig.collectionNames || [];
                        systemPrompt = agentConfig.systemPrompt;
                        temperature = agentConfig.temperature || 0.7;
                        maxTokens = agentConfig.maxTokens || 4000;
                    }
                }
                catch (error) {
                    console.warn(`⚠️ Failed to get agent config for ${chat.agentId}:`, error);
                }
            }
            await this.processWithAILegacy(chatId, content, images, {
                modelId,
                collectionNames,
                systemPrompt,
                temperature,
                maxTokens,
                agentId: chat.agentId
            }, userId);
        }
        catch (error) {
            console.error('❌ Error in processMessage:', error);
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
            }
        }
    }
    async processWithAILegacy(chatId, userMessage, images, config, userId) {
        try {
            console.log(`🤖 processWithAILegacy called for chat ${chatId}`);
            console.log(`🤖 User message: ${userMessage.substring(0, 100)}...`);
            console.log(`🤖 Images: ${images?.length || 0}`);
            console.log(`🤖 Config:`, config);
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error('Chat not found');
            }
            const messageCount = chat.messages.length;
            const shouldUseMemoryTool = this.shouldUseMemoryTool(messageCount);
            const shouldUseRedisMemory = this.shouldUseRedisMemory(messageCount);
            const shouldEmbedMessages = this.shouldEmbedMessages(messageCount);
            console.log(`🧠 Memory Management: messageCount=${messageCount}, useMemoryTool=${shouldUseMemoryTool}, useRedisMemory=${shouldUseRedisMemory}, shouldEmbed=${shouldEmbedMessages}`);
            if (shouldEmbedMessages && chat.messages.length > 0) {
                console.log(`📚 Embedding messages for chat ${chatId} (message count: ${messageCount})`);
            }
            const defaultSystemPrompt = "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.";
            const finalSystemPrompt = (config?.systemPrompt || defaultSystemPrompt);
            const signaturePayload = {
                modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
                temperature: config?.temperature ?? 0.7,
                maxTokens: config?.maxTokens ?? 4000,
                systemPrompt: finalSystemPrompt,
                collections: (config?.collectionNames || []).slice().sort(),
                agentId: config?.agentId || null
            };
            const signature = JSON.stringify(signaturePayload);
            let cached = this.agentCache.get(chatId);
            let agent;
            if (cached && cached.signature === signature) {
                console.log(`⚡ Reusing cached agent for chat ${chatId}`);
                agent = cached.executor;
            }
            else {
                console.log(`🤖 Creating LLM/Agent for chat ${chatId}`);
                const llm = (0, llmFactory_1.getLLM)(signaturePayload.modelId, {
                    temperature: signaturePayload.temperature,
                    maxTokens: signaturePayload.maxTokens,
                    streaming: true
                });
                const sessionTools = (0, toolRegistry_1.createMemoryTool)(chatId);
                const allTools = {};
                for (const [k, v] of Object.entries(toolRegistry_1.toolRegistry))
                    allTools[k] = v.func;
                for (const [k, v] of Object.entries(sessionTools))
                    allTools[k] = v.func;
                if (signaturePayload.collections && signaturePayload.collections.length > 0) {
                    const retrievalTools = (0, toolRegistry_1.createRetrievalTools)(signaturePayload.collections);
                    for (const [name, tool] of Object.entries(retrievalTools)) {
                        allTools[name] = tool.func;
                        console.log(`🔧 Added retrieval tool: ${name}`);
                    }
                }
                agent = await (0, agentFactory_1.createAgent)(llm, allTools, finalSystemPrompt, {
                    modelId: signaturePayload.modelId,
                    sessionId: chatId,
                    temperature: signaturePayload.temperature,
                    maxTokens: signaturePayload.maxTokens
                });
                this.agentCache.set(chatId, { signature, executor: agent });
            }
            const chatFromDb = await chat_1.ChatModel.findById(chatId);
            if (!chatFromDb)
                throw new Error(`Chat session ${chatId} not found during AI processing`);
            let messages = chatFromDb.messages.map(msg => {
                let enrichedContent = msg.content;
                if (msg.role === 'user' && Array.isArray(msg.images) && msg.images.length > 0) {
                    const imagesDesc = msg.images
                        .map((im, idx) => `#${idx + 1} (${im.mediaType}): ${im.url}`)
                        .join('\n');
                    enrichedContent = `${enrichedContent}\n\n[Attached images]\n${imagesDesc}`;
                }
                return {
                    role: msg.role,
                    content: enrichedContent,
                    id: msg.id,
                    timestamp: msg.timestamp
                };
            });
            if (!messages.length || messages[messages.length - 1].role !== 'user') {
                const userMsg = await this.addMessage(chatId, { role: 'user', content: userMessage });
                messages.push(userMsg);
            }
            const currentMessageCount = messages.length;
            const useMemoryTool = this.shouldUseMemoryTool(currentMessageCount);
            const useRedisMemory = this.shouldUseRedisMemory(currentMessageCount);
            const shouldEmbed = this.shouldEmbedMessages(currentMessageCount);
            console.log(`🧠 Memory Management: messageCount=${currentMessageCount}, useMemoryTool=${useMemoryTool}, useRedisMemory=${useRedisMemory}, shouldEmbed=${shouldEmbed}`);
            let preparedImages = [];
            if (images && images.length > 0) {
                console.log(`🖼️ Preparing ${images.length} images for multimodal processing...`);
                preparedImages = await this.prepareImagesForMultimodal(images);
                const successCount = preparedImages.filter(img => img.base64Data).length;
                console.log(`✅ Prepared ${successCount}/${images.length} images for multimodal processing`);
                if (successCount < images.length) {
                    const failedCount = images.length - successCount;
                    const failedImages = preparedImages.filter(img => !img.base64Data);
                    let toastMessage;
                    if (failedCount === images.length) {
                        toastMessage = `Unable to process ${failedCount} image${failedCount > 1 ? 's' : ''}. Responding with text only.`;
                    }
                    else {
                        toastMessage = `${failedCount} of ${images.length} images couldn't be processed. Continuing with ${successCount}.`;
                    }
                    const errorReasons = failedImages.map(img => img.error).filter(Boolean);
                    const primaryReason = errorReasons[0];
                    if (primaryReason) {
                        if (primaryReason.includes('too large')) {
                            toastMessage += ' Try using smaller images (max 10MB).';
                        }
                        else if (primaryReason.includes('Unsupported format')) {
                            toastMessage += ' Use JPEG, PNG, GIF, or WebP formats.';
                        }
                        else if (primaryReason.includes('Failed to load')) {
                            toastMessage += ' Some images could not be loaded from storage.';
                        }
                    }
                    if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                        websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                            type: 'image_processing_error',
                            data: {
                                message: toastMessage,
                                failedCount,
                                totalCount: images.length,
                                successCount,
                                errors: errorReasons,
                                timestamp: new Date().toISOString()
                            }
                        }));
                    }
                }
            }
            if (userId) {
                const quotaCheck = await usageService_1.usageService.checkQuotaAndUsage(userId, 0, 100);
                if (!quotaCheck.canUse) {
                    console.warn(`⚠️ Pre-chat quota check failed for user ${userId}: ${quotaCheck.reason}`);
                    if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                        websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                            type: 'quota_exceeded',
                            data: {
                                reason: quotaCheck.reason,
                                timestamp: new Date().toISOString()
                            }
                        }));
                    }
                    throw new Error(`Token quota exceeded: ${quotaCheck.reason}`);
                }
            }
            console.log(`🤖 Starting agent.run with ${messages.length} messages`);
            console.log(`🤖 Last message: ${messages[messages.length - 1].content.substring(0, 50)}...`);
            console.log(`🤖 Images for multimodal: ${preparedImages.filter(img => img.base64Data).length}`);
            let fullContent = '';
            let inputTokens = 0;
            let outputTokens = 0;
            let assistantMessageId = null;
            await agent.run(messages, {
                images: preparedImages.filter(img => img.base64Data),
                onEvent: async (event) => {
                    console.log(`🤖 Agent event: ${event.type}`, event.data);
                    if (event.type === 'chunk') {
                        fullContent += event.data;
                        if (fullContent === event.data) {
                            console.log(`🤖 First chunk received, creating assistant message...`);
                            const assistantMessage = await this.addMessage(chatId, {
                                role: 'assistant',
                                content: '',
                            });
                            assistantMessageId = assistantMessage.id;
                            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                    type: 'assistant_created',
                                    data: {
                                        messageId: assistantMessage.id,
                                        content: ''
                                    }
                                }));
                            }
                        }
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'chunk',
                                data: {
                                    messageId: assistantMessageId,
                                    delta: event.data
                                }
                            }));
                        }
                    }
                    else if (event.type === 'tool_start') {
                        console.log(`🔧 Tool started: ${event.data.tool_name}`);
                        console.log(`🔧 Tool input: ${event.data.tool_input}`);
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'tool_start',
                                data: {
                                    tool_name: event.data.tool_name,
                                    tool_input: event.data.tool_input
                                }
                            }));
                        }
                    }
                    else if (event.type === 'tool_result') {
                        const output = event.data.output || 'No output available';
                        console.log(`🔧 Tool completed: ${event.data.tool_name} with result: ${output.substring(0, 100)}...`);
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'tool_result',
                                data: {
                                    tool_name: event.data.tool_name,
                                    output: output
                                }
                            }));
                        }
                    }
                    else if (event.type === 'tool_error') {
                        console.error(`❌ Tool error: ${event.data.error}`);
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'tool_error',
                                data: {
                                    tool_name: event.data.tool_name,
                                    error: event.data.error
                                }
                            }));
                        }
                    }
                    else if (event.type === 'assistant_created') {
                        console.log(`🤖 Assistant message created`, event.data);
                        const assistantMsg = {
                            id: event.data.messageId,
                            role: 'assistant',
                            content: event.data.content,
                            timestamp: new Date(),
                            isStreaming: true,
                            isComplete: false
                        };
                        await this.addMessage(chatId, assistantMsg);
                    }
                    else if (event.type === 'end') {
                        console.log(`🤖 Agent finished with answer: ${event.data.answer.substring(0, 50)}...`);
                        const chatFromDb = await chat_1.ChatModel.findById(chatId);
                        if (chatFromDb && chatFromDb.messages.length > 0) {
                            const lastMessage = chatFromDb.messages[chatFromDb.messages.length - 1];
                            if (lastMessage.role === 'assistant') {
                                await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': lastMessage.id }, {
                                    $set: {
                                        'messages.$.content': event.data.answer,
                                        updatedAt: new Date()
                                    }
                                });
                                console.log(`🤖 Updated assistant message ${lastMessage.id} with final content`);
                                if (!assistantMessageId) {
                                    assistantMessageId = lastMessage.id;
                                }
                            }
                        }
                        try {
                            const updated = await chat_1.ChatModel.findById(chatId);
                            if (updated) {
                                console.log(`💾 Setting up hybrid memory for chat ${chatId}`);
                                await memoryService_1.memoryService.setupHybridMemory(chatId, updated.messages);
                            }
                        }
                        catch (memErr) {
                            console.warn('⚠️ Hybrid memory setup failed:', memErr);
                        }
                        if (event.data.inputTokens || event.data.outputTokens) {
                            inputTokens = event.data.inputTokens || 0;
                            outputTokens = event.data.outputTokens || 0;
                            if (userId && (inputTokens > 0 || outputTokens > 0)) {
                                const updateResult = await usageService_1.usageService.updateUsage(userId, inputTokens, outputTokens);
                                if (!updateResult.success) {
                                    console.warn(`⚠️ Usage update failed for user ${userId}: ${updateResult.reason}`);
                                    if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                                        websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                            type: 'quota_exceeded',
                                            data: {
                                                reason: updateResult.reason,
                                                timestamp: new Date().toISOString()
                                            }
                                        }));
                                    }
                                }
                            }
                        }
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'end',
                                data: {
                                    messageId: assistantMessageId,
                                    answer: event.data.answer,
                                    inputTokens,
                                    outputTokens
                                }
                            }));
                        }
                    }
                },
                maxSteps: 5
            });
        }
        catch (error) {
            console.error('❌ Error in processWithAILegacy:', error);
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
            }
        }
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