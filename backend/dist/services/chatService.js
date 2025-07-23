"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const chat_1 = require("../models/chat");
const websocketManager_1 = require("../utils/websocketManager");
const agentService_1 = require("./agentService");
const usageService_1 = require("./usageService");
const llmFactory_1 = require("../agent/llmFactory");
const toolRegistry_1 = require("../agent/toolRegistry");
const promptFactory_1 = require("../agent/promptFactory");
const agentFactory_1 = require("../agent/agentFactory");
const redis_1 = require("../lib/redis");
const memoryService_1 = require("./memoryService");
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
    async processWithAILegacy(chatId, userMessage, images, config, userId) {
        try {
            await this.delay(1000);
            const agentId = config?.agentId;
            if (!agentId)
                throw new Error('No agentId');
            const llm = (0, llmFactory_1.getLLM)(config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
                temperature: config?.temperature,
                maxTokens: config?.maxTokens
            });
            const sessionTools = (0, toolRegistry_1.createMemoryTool)(chatId);
            const allTools = {};
            for (const [k, v] of Object.entries(toolRegistry_1.toolRegistry))
                allTools[k] = v.func;
            for (const [k, v] of Object.entries(sessionTools))
                allTools[k] = v.func;
            const promptTemplate = (0, promptFactory_1.createPromptTemplate)(config?.systemPrompt || '', true);
            const agent = (0, agentFactory_1.createAgent)(llm, allTools, config?.systemPrompt || '');
            const chatFromDb = await chat_1.ChatModel.findById(chatId);
            if (!chatFromDb) {
                throw new Error(`Chat session ${chatId} not found during AI processing`);
            }
            let messages = chatFromDb.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                id: msg.id,
                timestamp: msg.timestamp
            }));
            const userMessageInDb = messages[messages.length - 1];
            messages = messages.slice(0, messages.length - 1);
            messages.push(userMessageInDb);
            await memoryService_1.memoryService.addRecentMessage(chatId, userMessageInDb);
            const currentMessageCount = chatFromDb.messages.length;
            if (this.shouldEmbedMessages(currentMessageCount)) {
            }
            const assistantMessage = await this.addMessage(chatId, {
                role: 'assistant',
                content: '',
            });
            messages.push(assistantMessage);
            let fullContent = '';
            let turn = 0;
            let done = false;
            while (!done && turn < 5) {
                turn++;
                const prompt = promptTemplate(messages);
                let output = '';
                let isToolCall = false;
                let toolMatch = null;
                let chunkBuffer = '';
                try {
                    for await (const chunk of llm.stream(prompt)) {
                        chunkBuffer += chunk;
                        toolMatch = chunkBuffer.match(/\[TOOL:([\w_]+)\](.*)/s);
                        if (toolMatch) {
                            isToolCall = true;
                            break;
                        }
                        output += chunk;
                        fullContent += chunk;
                        await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': assistantMessage.id }, { $set: { 'messages.$.content': fullContent, updatedAt: new Date() } });
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'chunk',
                                data: chunk
                            }));
                        }
                    }
                }
                catch (err) {
                    console.error('❌ Error during LLM streaming:', err);
                    break;
                }
                if (isToolCall && toolMatch) {
                    const toolName = toolMatch[1];
                    const toolInput = toolMatch[2]?.trim() || '';
                    if (allTools[toolName]) {
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'tool_start',
                                data: {
                                    tool_name: toolName,
                                    tool_input: toolInput
                                }
                            }));
                        }
                        const toolResult = await allTools[toolName](toolInput, chatId);
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'tool_result',
                                data: {
                                    tool_name: toolName,
                                    output: toolResult
                                }
                            }));
                        }
                        const toolResultMessage = await this.addMessage(chatId, {
                            role: 'user',
                            content: `[TOOL_RESULT:${toolName}] ${toolResult}`,
                        });
                        messages.push(toolResultMessage);
                        continue;
                    }
                    else {
                        messages.push({ ...assistantMessage, content: `[Error: Tool ${toolName} not found]` });
                        done = true;
                        fullContent += `[Error: Tool ${toolName} not found]`;
                        break;
                    }
                }
                else {
                    messages.push({ ...assistantMessage, content: output });
                    fullContent += output;
                    done = true;
                }
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
                    await memoryService_1.memoryService.addRecentMessage(chatId, lastMessage);
                }
                else if (lastMessage && lastMessage.role === 'user' && lastMessage.content && lastMessage.content.startsWith('[TOOL_RESULT:')) {
                    await memoryService_1.memoryService.addRecentMessage(chatId, lastMessage);
                }
            }
            const inputTokens = Math.floor(userMessage.length / 4);
            const outputTokens = Math.floor(fullContent.length / 4);
            if (userId) {
                await usageService_1.usageService.updateUsage(userId, inputTokens, outputTokens);
            }
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'end',
                    data: {
                        sessionId: chatId,
                        inputTokens,
                        outputTokens
                    }
                }));
            }
        }
        catch (error) {
            console.error('❌ Error in AI processing:', error);
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'error',
                    data: 'Failed to process AI response'
                }));
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
            content: ''
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
        if (images && images.length > 0) {
            return `${baseResponse} ฉันเห็นว่าคุณได้แนบรูปภาพมาด้วย ฉันจะวิเคราะห์ทั้งข้อความและรูปภาพเพื่อให้คำตอบที่ครบถ้วนที่สุด. ${this.generateDetailedResponse()}`;
        }
        return `${baseResponse} ${this.generateDetailedResponse()}`;
    }
    generateDetailedResponse() {
        const details = [
            `ข้อมูลนี้จะช่วยให้คุณเข้าใจแนวคิดได้ดีขึ้น และสามารถนำไปประยุกต์ใช้ในสถานการณ์จริงได้.`,
            `หากคุณต้องการข้อมูลเพิ่มเติมหรือมีคำถามอื่นๆ อย่าลังเลที่จะถามได้เลย.`,
            `ฉันหวังว่าคำตอบนี้จะช่วยให้คุณเข้าใจประเด็นนี้ได้ชัดเจนขึ้น.`,
            `หากมีส่วนไหนที่ยังไม่ชัดเจน กรุณาแจ้งให้ฉันทราบเพื่อที่ฉันจะได้อธิบายเพิ่มเติม.`
        ];
        return details[Math.floor(Math.random() * details.length)];
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
            await redis_1.redis.del(`chat:history:${chatId}`);
            if (typeof global.clearChatMemoryTool === 'function') {
                await global.clearChatMemoryTool(chatId);
            }
            console.log(`✅ Memory cleared for chat ${chatId}`);
        }
        catch (error) {
            console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
        }
    }
    async getRecentMessagesFromRedis(chatId) {
        try {
            const data = await redis_1.redis.get(`chat:history:${chatId}`);
            if (!data)
                return [];
            return JSON.parse(data);
        }
        catch (e) {
            return [];
        }
    }
    async setRecentMessagesToRedis(chatId, messages) {
        try {
            await redis_1.redis.set(`chat:history:${chatId}`, JSON.stringify(messages), 'EX', 86400);
        }
        catch (e) {
        }
    }
    async restoreRecentContextIfNeeded(chatId, allMessages) {
        const redisMessages = await this.getRecentMessagesFromRedis(chatId);
        if (!redisMessages || redisMessages.length === 0) {
            const recent = allMessages.slice(-10);
            await this.setRecentMessagesToRedis(chatId, recent);
            console.log(`🔄 Restored recent context to Redis for chat ${chatId}`);
        }
    }
    async embedMessagesIfNeeded(chatId, allMessages) {
        if (allMessages.length % 10 === 0 && allMessages.length > 0) {
            if (typeof global.addChatMemoryTool === 'function') {
                await global.addChatMemoryTool(chatId, allMessages);
                console.log(`📚 Embedded ${allMessages.length} messages to memory tool for chat ${chatId}`);
            }
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