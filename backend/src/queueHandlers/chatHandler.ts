import { Job } from 'bullmq';
import { ChatJobData } from '../services/queueService';
import { chatService } from '../services/chatService';
import { langchainChatService } from '../services/langchainChatService';
import { ChatModel } from '../models/chat';

export async function handleChatJob(job: Job<ChatJobData>) {
  const { sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature, maxTokens, agentId } = job.data;
  console.log(`🎯 BullMQ task started for session ${sessionId}`);
  console.log(`📝 Message: ${message}`);
  console.log(`🤖 Agent ID: ${agentId || 'No agent'}`);
  console.log(`🔧 Model ID: ${modelId}`);

  try {
    const buffer: string[] = [];
    const assistantId = new Date().toISOString();
    const chat = await ChatModel.findById(sessionId);
    if (!chat) throw new Error(`Chat session ${sessionId} not found`);
    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: 'assistant', content: [{ text: systemPrompt }] });
    }
    const recentMessages = chat.messages.slice(-10);
    for (const msg of recentMessages) {
      messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: [{ text: extractText(msg.content) }] });
    }
    messages.push({ role: 'user', content: [{ text: extractText(message) }] });
    const assistantMessage = await chatService.addMessage(sessionId, {
      role: 'assistant', content: '', images: [], isStreaming: true, isComplete: false
    });
    let fullResponse = '';
    const chatStream = langchainChatService.chat(
      sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature, maxTokens
    );
    // เพิ่มฟังก์ชัน extractText สำหรับแปลง chunkText เป็น string
    function extractText(chunkText: any): string {
      if (Array.isArray(chunkText)) {
        return chunkText.map(extractText).join('');
      }
      if (chunkText && typeof chunkText === 'object') {
        if ('content' in chunkText && typeof chunkText.content === 'string') {
          return chunkText.content;
        }
        if ('text' in chunkText && typeof chunkText.text === 'string') {
          return chunkText.text;
        }
        return JSON.stringify(chunkText);
      }
      if (chunkText === undefined || chunkText === null) {
        return '';
      }
      return String(chunkText);
    }
    for await (const chunk of chatStream) {
      try {
        const data = JSON.parse(chunk);
        if (data.type === 'chunk') {
          const chunkText = extractText(data.data);
          buffer.push(chunkText);
          fullResponse += chunkText;
          await ChatModel.updateOne(
            { _id: sessionId, 'messages.id': assistantMessage.id },
            { $set: { 'messages.$.content': fullResponse, 'messages.$.isStreaming': true } }
          );
          await publishToRedis(`chat:${sessionId}`, { type: 'chunk', data: chunkText });
        } else if (data.type === 'tool_start' || data.type === 'tool_result' || data.type === 'tool_error') {
          // Update toolUsage array in message
          const toolUsageUpdate = {
            type: data.type,
            tool_name: data.data.tool_name,
            tool_input: data.data.tool_input,
            output: data.data.output,
            error: data.data.error,
            timestamp: new Date()
          };
          await ChatModel.updateOne(
            { _id: sessionId, 'messages.id': assistantMessage.id },
            { $push: { 'messages.$.toolUsage': toolUsageUpdate } }
          );
          await publishToRedis(`chat:${sessionId}`, data);
        } else if (data.type === 'end') {
          await publishToRedis(`chat:${sessionId}`, data);
        }
      } catch (error) {
        console.error('Error parsing chunk:', error);
        continue;
      }
    }
    await ChatModel.updateOne(
      { _id: sessionId, 'messages.id': assistantMessage.id },
      { $set: { 'messages.$.content': fullResponse, 'messages.$.isStreaming': false, 'messages.$.isComplete': true } }
    );
    console.log(`✅ Chat job completed for session ${sessionId}`);
  } catch (error) {
    console.error(`❌ Chat job failed for session ${sessionId}:`, error);
    throw error;
  }
}

async function publishToRedis(channel: string, message: any) {
  try {
    const redis = require('redis');
    const client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379/0' });
    await client.connect();
    await client.publish(channel, JSON.stringify(message));
    await client.disconnect();
    console.log(`📤 Published to Redis: ${channel}`);
  } catch (error) {
    console.error(`❌ Redis publish error: ${error}`);
  }
}