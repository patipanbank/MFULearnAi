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
            let messages = chatFromDb.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                id: msg.id,
                timestamp: msg.timestamp
            }));
            if (!messages.length || messages[messages.length - 1].role !== 'user') {
                const userMsg = await this.addMessage(chatId, { role: 'user', content: userMessage });
                messages.push(userMsg);
            }
            const currentMessageCount = messages.length;
            const useMemoryTool = this.shouldUseMemoryTool(currentMessageCount);
            const useRedisMemory = this.shouldUseRedisMemory(currentMessageCount);
            const shouldEmbed = this.shouldEmbedMessages(currentMessageCount);
            console.log(`🧠 Memory Management: messageCount=${currentMessageCount}, useMemoryTool=${useMemoryTool}, useRedisMemory=${useRedisMemory}, shouldEmbed=${shouldEmbed}`);
            console.log(`🤖 Starting agent.run with ${messages.length} messages`);
            console.log(`🤖 Last message: ${messages[messages.length - 1].content.substring(0, 50)}...`);
            let fullContent = '';
            let inputTokens = 0;
            let outputTokens = 0;
            let assistantMessageId = null;
            await agent.run(messages, {
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
                                await usageService_1.usageService.updateUsage(userId, inputTokens, outputTokens);
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
    async streamResponse(chatId, messageId, response) {
        const words = response.split(' ');
        let fullContent = '';
        for (let i = 0; i < words.length; i++) {
            const chunk = (i > 0 ? ' ' : '') + words[i];
            fullContent += chunk;
            await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': messageId }, {
                $set: {
                    'messages.$.content': fullContent,
                    updatedAt: new Date()
                }
            });
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'chunk',
                    data: chunk
                }));
            }
            await this.delay(100);
        }
    }
    async streamResponseLegacy(chatId, response) {
        const words = response.split(' ');
        let fullContent = '';
        const assistantMessage = await this.addMessage(chatId, {
            role: 'assistant',
            content: 'กำลังคิด...'
        });
        for (let i = 0; i < words.length; i++) {
            const chunk = (i > 0 ? ' ' : '') + words[i];
            fullContent += chunk;
            await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': assistantMessage.id }, {
                $set: {
                    'messages.$.content': fullContent,
                    updatedAt: new Date()
                }
            });
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'chunk',
                    data: chunk
                }));
            }
            await this.delay(100);
        }
    }
    generateResponse(userMessage, images, config) {
        if (config?.systemPrompt) {
            const responses = [
                `ตามที่กำหนดในระบบ: ${config.systemPrompt}\n\nสำหรับคำถาม "${userMessage}" นี่คือคำตอบ:`,
                `ตามแนวทางของ AI Assistant: ${config.systemPrompt}\n\nคำตอบสำหรับ "${userMessage}":`
            ];
            const baseResponse = responses[Math.floor(Math.random() * responses.length)];
            return `${baseResponse} ${this.generateDetailedResponse()}`;
        }
        const responses = [
            `ฉันเข้าใจคำถามของคุณเกี่ยวกับ "${userMessage}" แล้ว นี่คือคำตอบที่ครอบคลุม:`,
            `ขอบคุณสำหรับคำถาม "${userMessage}" ฉันจะอธิบายให้คุณฟัง:`,
            `สำหรับคำถาม "${userMessage}" นี่คือข้อมูลที่เกี่ยวข้อง:`,
            `ฉันได้วิเคราะห์คำถาม "${userMessage}" ของคุณแล้ว และนี่คือสิ่งที่ฉันพบ:`
        ];
        const baseResponse = responses[Math.floor(Math.random() * responses.length)];
        return `${baseResponse} ${this.generateDetailedResponse()}`;
    }
    generateDetailedResponse() {
        const responses = [
            "นี่คือข้อมูลที่ครอบคลุมและทันสมัยเกี่ยวกับเรื่องที่คุณถาม",
            "ฉันได้รวบรวมข้อมูลจากแหล่งที่เชื่อถือได้เพื่อตอบคำถามของคุณ",
            "ข้อมูลนี้ได้รับการอัปเดตล่าสุดและมีความแม่นยำสูง",
            "ฉันหวังว่าข้อมูลนี้จะช่วยตอบคำถามของคุณได้อย่างครบถ้วน"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
            if (typeof global.clearChatMemoryTool === 'function') {
                await global.clearChatMemoryTool(chatId);
            }
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