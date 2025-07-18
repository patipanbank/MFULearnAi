"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChatJob = handleChatJob;
const chatService_1 = require("../services/chatService");
const langchainChatService_1 = require("../services/langchainChatService");
const chat_1 = require("../models/chat");
async function handleChatJob(job) {
    const { sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature, maxTokens, agentId } = job.data;
    console.log(`🎯 BullMQ task started for session ${sessionId}`);
    console.log(`📝 Message: ${message}`);
    console.log(`🤖 Agent ID: ${agentId || 'No agent'}`);
    console.log(`🔧 Model ID: ${modelId}`);
    try {
        const buffer = [];
        const assistantId = new Date().toISOString();
        const chat = await chat_1.ChatModel.findById(sessionId);
        if (!chat)
            throw new Error(`Chat session ${sessionId} not found`);
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'assistant', content: [{ text: systemPrompt }] });
        }
        const recentMessages = chat.messages.slice(-10);
        for (const msg of recentMessages) {
            messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: [{ text: msg.content }] });
        }
        messages.push({ role: 'user', content: [{ text: message }] });
        const assistantMessage = await chatService_1.chatService.addMessage(sessionId, {
            role: 'assistant', content: '', images: [], isStreaming: true, isComplete: false
        });
        let fullResponse = '';
        const chatStream = langchainChatService_1.langchainChatService.chat(sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature, maxTokens);
        for await (const chunk of chatStream) {
            try {
                const data = JSON.parse(chunk);
                if (data.type === 'chunk') {
                    const chunkText = data.data;
                    buffer.push(chunkText);
                    fullResponse += chunkText;
                    await chat_1.ChatModel.updateOne({ _id: sessionId, 'messages.id': assistantMessage.id }, { $set: { 'messages.$.content': fullResponse, 'messages.$.isStreaming': true } });
                    await publishToRedis(`chat:${sessionId}`, { type: 'chunk', data: chunkText });
                }
                else if (data.type === 'tool_start' || data.type === 'tool_result' || data.type === 'tool_error') {
                    const toolUsageUpdate = {
                        type: data.type,
                        tool_name: data.data.tool_name,
                        tool_input: data.data.tool_input,
                        output: data.data.output,
                        error: data.data.error,
                        timestamp: new Date()
                    };
                    await chat_1.ChatModel.updateOne({ _id: sessionId, 'messages.id': assistantMessage.id }, { $push: { 'messages.$.toolUsage': toolUsageUpdate } });
                    await publishToRedis(`chat:${sessionId}`, data);
                }
                else if (data.type === 'end') {
                    await publishToRedis(`chat:${sessionId}`, data);
                }
            }
            catch (error) {
                console.error('Error parsing chunk:', error);
                continue;
            }
        }
        await chat_1.ChatModel.updateOne({ _id: sessionId, 'messages.id': assistantMessage.id }, { $set: { 'messages.$.content': fullResponse, 'messages.$.isStreaming': false, 'messages.$.isComplete': true } });
        console.log(`✅ Chat job completed for session ${sessionId}`);
    }
    catch (error) {
        console.error(`❌ Chat job failed for session ${sessionId}:`, error);
        throw error;
    }
}
async function publishToRedis(channel, message) {
    try {
        const redis = require('redis');
        const client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379/0' });
        await client.connect();
        await client.publish(channel, JSON.stringify(message));
        await client.disconnect();
        console.log(`📤 Published to Redis: ${channel}`);
    }
    catch (error) {
        console.error(`❌ Redis publish error: ${error}`);
    }
}
//# sourceMappingURL=chatHandler.js.map