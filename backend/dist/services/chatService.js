"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const chat_1 = require("../models/chat");
const websocketManager_1 = require("../utils/websocketManager");
const agentService_1 = require("./agentService");
const usageService_1 = require("./usageService");
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
        return await chat_1.ChatModel.findOne({ _id: chatId, userId });
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
        try {
            const userMessage = await this.addMessage(chatId, {
                role: 'user',
                content,
                images
            });
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'user_message',
                    data: {
                        message: userMessage,
                        sessionId: chatId
                    }
                }));
            }
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error(`Chat session ${chatId} not found`);
            }
            await this.processWithAI(chatId, content, images, chat.agentId, userId);
        }
        catch (error) {
            console.error('❌ Error processing message:', error);
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                    type: 'error',
                    data: 'Failed to process message'
                }));
            }
        }
    }
    async processWithAI(chatId, userMessage, images, agentId, userId) {
        const chat = await chat_1.ChatModel.findById(chatId);
        if (!chat) {
            throw new Error(`Chat session ${chatId} not found`);
        }
        const assistantMessage = await this.addMessage(chatId, {
            role: 'assistant',
            content: 'กำลังประมวลผล...',
            toolUsage: []
        });
        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'assistant_start',
                data: {
                    messageId: assistantMessage.id,
                    sessionId: chatId
                }
            }));
        }
        let agentConfig = null;
        if (agentId) {
            agentConfig = await agentService_1.agentService.getAgentById(agentId);
        }
        await this.simulateAIProcessing(chatId, assistantMessage.id, userMessage, images, agentConfig, userId);
    }
    async simulateAIProcessing(chatId, messageId, userMessage, images, agentConfig, userId) {
        await this.delay(1000);
        const toolsUsed = await this.simulateToolUsage(chatId, messageId, userMessage, agentConfig);
        const response = this.generateResponse(userMessage, images, agentConfig, toolsUsed);
        await this.streamResponse(chatId, messageId, response);
        const inputTokens = Math.floor(userMessage.length / 4);
        const outputTokens = Math.floor(response.length / 4);
        if (userId) {
            await usageService_1.usageService.updateUsage(userId, inputTokens, outputTokens);
        }
        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'end',
                data: {
                    messageId,
                    sessionId: chatId,
                    inputTokens,
                    outputTokens
                }
            }));
        }
    }
    async simulateToolUsage(chatId, messageId, userMessage, agentConfig) {
        const toolsUsed = [];
        if (userMessage.toLowerCase().includes('search') || userMessage.toLowerCase().includes('find')) {
            toolsUsed.push('web_search');
            await this.simulateToolExecution(chatId, messageId, 'web_search', 'Searching for information...', 'Found relevant information about the topic.');
        }
        if (userMessage.toLowerCase().includes('calculate') || userMessage.toLowerCase().includes('math')) {
            toolsUsed.push('calculator');
            await this.simulateToolExecution(chatId, messageId, 'calculator', 'Performing calculation...', 'Calculation completed successfully.');
        }
        if (userMessage.toLowerCase().includes('knowledge') || userMessage.toLowerCase().includes('database')) {
            toolsUsed.push('knowledge_base');
            await this.simulateToolExecution(chatId, messageId, 'knowledge_base', 'Searching knowledge base...', 'Retrieved relevant information from knowledge base.');
        }
        return toolsUsed;
    }
    async simulateToolExecution(chatId, messageId, toolName, input, output) {
        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'tool_start',
                data: {
                    messageId,
                    tool_name: toolName,
                    tool_input: input,
                    timestamp: new Date()
                }
            }));
        }
        await this.delay(500);
        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'tool_result',
                data: {
                    messageId,
                    tool_name: toolName,
                    output: output,
                    timestamp: new Date()
                }
            }));
        }
        await this.delay(300);
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
                    data: {
                        messageId,
                        chunk,
                        fullContent
                    }
                }));
            }
            await this.delay(100);
        }
    }
    generateResponse(userMessage, images, agentConfig, toolsUsed) {
        if (agentConfig?.systemPrompt) {
            const responses = [
                `ตามที่กำหนดในระบบ: ${agentConfig.systemPrompt}\n\nสำหรับคำถาม "${userMessage}" นี่คือคำตอบ:`,
                `ตามแนวทางของ ${agentConfig.name || 'AI Assistant'}: ${agentConfig.systemPrompt}\n\nคำตอบสำหรับ "${userMessage}":`
            ];
            const baseResponse = responses[Math.floor(Math.random() * responses.length)];
            return `${baseResponse} ${this.generateDetailedResponse(toolsUsed)}`;
        }
        const responses = [
            `ฉันเข้าใจคำถามของคุณเกี่ยวกับ "${userMessage}" แล้ว นี่คือคำตอบที่ครอบคลุม:`,
            `ขอบคุณสำหรับคำถาม "${userMessage}" ฉันจะอธิบายให้คุณฟัง:`,
            `สำหรับคำถาม "${userMessage}" นี่คือข้อมูลที่เกี่ยวข้อง:`,
            `ฉันได้วิเคราะห์คำถาม "${userMessage}" ของคุณแล้ว และนี่คือสิ่งที่ฉันพบ:`
        ];
        const baseResponse = responses[Math.floor(Math.random() * responses.length)];
        if (images && images.length > 0) {
            return `${baseResponse} ฉันเห็นว่าคุณได้แนบรูปภาพมาด้วย ฉันจะวิเคราะห์ทั้งข้อความและรูปภาพเพื่อให้คำตอบที่ครบถ้วนที่สุด. ${this.generateDetailedResponse(toolsUsed)}`;
        }
        return `${baseResponse} ${this.generateDetailedResponse(toolsUsed)}`;
    }
    generateDetailedResponse(toolsUsed) {
        let toolInfo = '';
        if (toolsUsed && toolsUsed.length > 0) {
            toolInfo = `ฉันได้ใช้เครื่องมือ ${toolsUsed.join(', ')} เพื่อหาข้อมูลที่เกี่ยวข้อง. `;
        }
        const details = [
            `${toolInfo}ข้อมูลนี้จะช่วยให้คุณเข้าใจแนวคิดได้ดีขึ้น และสามารถนำไปประยุกต์ใช้ในสถานการณ์จริงได้.`,
            `${toolInfo}หากคุณต้องการข้อมูลเพิ่มเติมหรือมีคำถามอื่นๆ อย่าลังเลที่จะถามได้เลย.`,
            `${toolInfo}ฉันหวังว่าคำตอบนี้จะช่วยให้คุณเข้าใจประเด็นนี้ได้ชัดเจนขึ้น.`,
            `${toolInfo}หากมีส่วนไหนที่ยังไม่ชัดเจน กรุณาแจ้งให้ฉันทราบเพื่อที่ฉันจะได้อธิบายเพิ่มเติม.`
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
        await chat_1.ChatModel.updateOne({ _id: chatId }, {
            $set: {
                messages: [],
                updatedAt: new Date()
            }
        });
        console.log(`🧹 Cleared memory for chat session ${chatId}`);
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