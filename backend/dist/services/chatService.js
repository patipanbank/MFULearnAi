"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const websocketManager_1 = require("../utils/websocketManager");
const chat_1 = require("../models/chat");
const uuid_1 = require("uuid");
class ChatService {
    constructor() {
        console.log('✅ Chat service initialized');
    }
    async createChat(userId, name, agentId) {
        const chat = new chat_1.ChatModel({
            userId,
            name,
            agentId,
            messages: [],
            isPinned: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await chat.save();
        console.log(`✅ Created chat session ${chat._id} for user ${userId}`);
        return chat;
    }
    async getChat(chatId, userId) {
        const chat = await chat_1.ChatModel.findOne({ _id: chatId, userId });
        if (!chat) {
            return null;
        }
        return chat;
    }
    async addMessage(chatId, message) {
        const chat = await chat_1.ChatModel.findById(chatId);
        if (!chat) {
            throw new Error(`Chat session ${chatId} not found`);
        }
        const newMessage = {
            ...message,
            id: (0, uuid_1.v4)(),
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
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'user_message',
                data: {
                    message: userMessage,
                    sessionId: chatId
                }
            }));
            await this.processWithAI(chatId, content, images);
        }
        catch (error) {
            console.error('❌ Error processing message:', error);
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'error',
                data: 'Failed to process message'
            }));
        }
    }
    async processWithAI(chatId, userMessage, images) {
        const chat = await chat_1.ChatModel.findById(chatId);
        if (!chat) {
            throw new Error(`Chat session ${chatId} not found`);
        }
        const assistantMessage = await this.addMessage(chatId, {
            role: 'assistant',
            content: 'กำลังประมวลผล...',
            toolUsage: []
        });
        websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
            type: 'assistant_start',
            data: {
                messageId: assistantMessage.id,
                sessionId: chatId
            }
        }));
        await this.simulateAIProcessing(chatId, assistantMessage.id, userMessage, images);
    }
    async simulateAIProcessing(chatId, messageId, userMessage, images) {
        await this.delay(1000);
        if (Math.random() > 0.5) {
            await this.simulateToolUsage(chatId, messageId, 'web_search');
        }
        const response = this.generateResponse(userMessage, images);
        await this.streamResponse(chatId, messageId, response);
        websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
            type: 'end',
            data: {
                messageId,
                sessionId: chatId
            }
        }));
    }
    async simulateToolUsage(chatId, messageId, toolName) {
        websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
            type: 'tool_start',
            data: {
                messageId,
                tool_name: toolName,
                tool_input: 'Searching for information...',
                timestamp: new Date()
            }
        }));
        await this.delay(500);
        websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
            type: 'tool_result',
            data: {
                messageId,
                tool_name: toolName,
                output: 'Found relevant information about the topic.',
                timestamp: new Date()
            }
        }));
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
            websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'chunk',
                data: {
                    messageId,
                    chunk,
                    fullContent
                }
            }));
            await this.delay(100);
        }
    }
    generateResponse(userMessage, images) {
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
            "ข้อมูลนี้จะช่วยให้คุณเข้าใจแนวคิดได้ดีขึ้น และสามารถนำไปประยุกต์ใช้ในสถานการณ์จริงได้.",
            "หากคุณต้องการข้อมูลเพิ่มเติมหรือมีคำถามอื่นๆ อย่าลังเลที่จะถามได้เลย.",
            "ฉันหวังว่าคำตอบนี้จะช่วยให้คุณเข้าใจประเด็นนี้ได้ชัดเจนขึ้น.",
            "หากมีส่วนไหนที่ยังไม่ชัดเจน กรุณาแจ้งให้ฉันทราบเพื่อที่ฉันจะได้อธิบายเพิ่มเติม."
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
            console.log(`📌 Updated pin status for session ${chatId}`);
        }
        return chat;
    }
    getStats() {
        return {
            totalSessions: 0,
            totalMessages: 0
        };
    }
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
//# sourceMappingURL=chatService.js.map