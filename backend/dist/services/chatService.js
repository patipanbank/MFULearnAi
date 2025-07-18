"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const chat_1 = require("../models/chat");
const websocketManager_1 = require("../utils/websocketManager");
const agentService_1 = require("./agentService");
const usageService_1 = require("./usageService");
const bedrockService_1 = require("./bedrockService");
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
            if (memoryService_1.memoryService.shouldEmbedMessages(chat.messages.length)) {
                await memoryService_1.memoryService.addChatMemory(chatId, chat.messages);
            }
            await this.processWithAIEnhanced(chatId, content, images, {
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
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error(`Chat session ${chatId} not found`);
            }
            const messages = [];
            if (config?.systemPrompt) {
                messages.push({
                    role: 'assistant',
                    content: [{ text: config.systemPrompt }]
                });
            }
            const recentMessages = chat.messages.slice(-10);
            for (const msg of recentMessages) {
                messages.push({
                    role: msg.role,
                    content: [{ text: msg.content }]
                });
            }
            messages.push({
                role: 'user',
                content: [{ text: userMessage }]
            });
            const modelId = config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
            const temperature = config?.temperature || 0.7;
            await this.streamBedrockResponse(chatId, messages, modelId, temperature, userId);
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
    async processWithAIEnhanced(chatId, userMessage, images, config, userId) {
        try {
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error(`Chat session ${chatId} not found`);
            }
            const messages = [];
            if (config?.systemPrompt) {
                messages.push({
                    role: 'assistant',
                    content: [{ text: config.systemPrompt }]
                });
            }
            if (memoryService_1.memoryService.shouldUseMemoryTool(chat.messages.length)) {
                const memoryResults = await memoryService_1.memoryService.searchChatMemory(chatId, userMessage, 3);
                if (memoryResults.length > 0) {
                    const memoryContext = memoryResults
                        .map(result => `${result.role}: ${result.content}`)
                        .join('\n');
                    messages.push({
                        role: 'assistant',
                        content: [{ text: `Previous relevant context:\n${memoryContext}\n\nNow, let me help you with your current question.` }]
                    });
                }
            }
            const recentMessages = chat.messages.slice(-10);
            for (const msg of recentMessages) {
                messages.push({
                    role: msg.role,
                    content: [{ text: msg.content }]
                });
            }
            messages.push({
                role: 'user',
                content: [{ text: userMessage }]
            });
            const modelId = config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
            const temperature = config?.temperature || 0.7;
            await this.streamBedrockResponse(chatId, messages, modelId, temperature, userId);
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
    async streamBedrockResponse(chatId, messages, modelId, temperature, userId) {
        const assistantMessage = await this.addMessage(chatId, {
            role: 'assistant',
            content: '',
            images: []
        });
        let fullResponse = '';
        let inputTokens = 0;
        let outputTokens = 0;
        try {
            const stream = bedrockService_1.bedrockService.converseStream(modelId, messages, '', undefined, temperature);
            for await (const event of stream) {
                if (event.error) {
                    throw new Error(event.error);
                }
                if (event.chunk?.bytes) {
                    const chunk = event.chunk.bytes;
                    const text = new TextDecoder().decode(chunk);
                    if (text) {
                        fullResponse += text;
                        await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': assistantMessage.id }, { $set: { 'messages.$.content': fullResponse } });
                        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                                type: 'chunk',
                                data: {
                                    sessionId: chatId,
                                    messageId: assistantMessage.id,
                                    content: text
                                }
                            }));
                        }
                    }
                }
                if (event.usage?.inputTokens) {
                    inputTokens = event.usage.inputTokens;
                }
                if (event.usage?.outputTokens) {
                    outputTokens = event.usage.outputTokens;
                }
            }
            if (userId && (inputTokens > 0 || outputTokens > 0)) {
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
            console.error('❌ Error streaming Bedrock response:', error);
            await chat_1.ChatModel.updateOne({ _id: chatId, 'messages.id': assistantMessage.id }, { $set: { 'messages.$.content': 'ขออภัย เกิดข้อผิดพลาดในการประมวลผล' } });
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'error',
                    data: 'Failed to process AI response'
                }));
            }
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
            console.log(`🧹 Clearing memory for chat ${chatId}`);
            memoryService_1.memoryService.clearChatMemory(chatId);
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