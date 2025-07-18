import { Job } from 'bullmq';
import { chatQueue, agentQueue } from '../lib/queue';
import { chatService } from './chatService';
import { langchainChatService } from './langchainChatService';
import { ChatModel } from '../models/chat';
import { bedrockService } from './bedrockService';

export interface ChatJobData {
  sessionId: string;
  userId: string;
  message: string;
  modelId: string;
  collectionNames: string[];
  images?: any[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  agentId?: string;
}

export interface AgentJobData {
  agentId: string;
  userId: string;
  data: any;
}

export class QueueService {
  // Add chat job to queue
  async addChatJob(data: ChatJobData) {
    const job = await chatQueue.add('generate-answer', data, {
      jobId: `chat-${data.sessionId}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return job;
  }

  // Add agent job to queue
  async addAgentJob(data: AgentJobData) {
    const job = await agentQueue.add('process-agent', data, {
      jobId: `agent-${data.agentId}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return job;
  }

  // Process chat job
  async processChatJob(job: Job<ChatJobData>) {
    const { sessionId, userId, message, modelId, collectionNames, images, systemPrompt, temperature, maxTokens, agentId } = job.data;
    
    console.log(`🎯 BullMQ task started for session ${sessionId}`);
    console.log(`📝 Message: ${message}`);
    console.log(`🤖 Agent ID: ${agentId || 'No agent'}`);
    console.log(`🔧 Model ID: ${modelId}`);

    try {
      const buffer: string[] = [];
      const assistantId = new Date().toISOString();

      // Get chat history for context
      const chat = await ChatModel.findById(sessionId);
      if (!chat) {
        throw new Error(`Chat session ${sessionId} not found`);
      }

      // Prepare messages for Bedrock
      const messages: any[] = [];
      
      // Add system prompt if available
      if (systemPrompt) {
        messages.push({
          role: 'assistant',
          content: [{ text: systemPrompt }]
        });
      }

      // Add chat history (last 10 messages for context)
      const recentMessages = chat.messages.slice(-10);
      for (const msg of recentMessages) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: [{ text: msg.content }]
        });
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: [{ text: message }]
      });

      // Create assistant message in database (like in legacy)
      const assistantMessage = await chatService.addMessage(sessionId, {
        role: 'assistant',
        content: '',
        images: [],
        isStreaming: true,
        isComplete: false
      });

      let fullResponse = '';

      // Use LangChain chat service for advanced features
      const chatStream = langchainChatService.chat(
        sessionId,
        userId,
        message,
        modelId,
        collectionNames,
        images,
        systemPrompt,
        temperature,
        maxTokens
      );

      for await (const chunk of chatStream) {
        try {
          const data = JSON.parse(chunk);
          
          if (data.type === 'chunk') {
            const chunkText = data.data;
            buffer.push(chunkText);
            fullResponse += chunkText;
            
            // Update message in database (like in legacy)
            await ChatModel.updateOne(
              { _id: sessionId, 'messages.id': assistantMessage.id },
              { 
                $set: { 
                  'messages.$.content': fullResponse,
                  'messages.$.isStreaming': true
                } 
              }
            );
            
            // Publish to Redis for real-time streaming
            await this.publishToRedis(`chat:${sessionId}`, {
              type: 'chunk',
              data: chunkText,
            });
          }
          
          else if (data.type === 'tool_start') {
            // Forward tool events directly to Redis
            await this.publishToRedis(`chat:${sessionId}`, data);
          }
          
          else if (data.type === 'tool_result') {
            // Forward tool events directly to Redis
            await this.publishToRedis(`chat:${sessionId}`, data);
          }
          
          else if (data.type === 'tool_error') {
            // Forward tool events directly to Redis
            await this.publishToRedis(`chat:${sessionId}`, data);
          }
          
          else if (data.type === 'end') {
            // Publish end event
            await this.publishToRedis(`chat:${sessionId}`, data);
          }
          
        } catch (error) {
          console.error('Error parsing chunk:', error);
          continue;
        }
      }

      // Update final message in database (like in legacy)
      await ChatModel.updateOne(
        { _id: sessionId, 'messages.id': assistantMessage.id },
        { 
          $set: { 
            'messages.$.content': fullResponse,
            'messages.$.isStreaming': false,
            'messages.$.isComplete': true
          } 
        }
      );

      console.log(`✅ Chat job completed for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Chat job failed for session ${sessionId}:`, error);
      throw error;
    }
  }

  // Process agent job
  async processAgentJob(job: Job<AgentJobData>) {
    const { agentId, userId, data } = job.data;
    
    console.log(`🤖 Processing agent job for agent ${agentId}`);
    
    try {
      // Process agent-specific logic here
      // This would depend on your agent service implementation
      console.log(`✅ Agent job completed for agent ${agentId}`);
    } catch (error) {
      console.error(`❌ Agent job failed for agent ${agentId}:`, error);
      throw error;
    }
  }

  // Helper method to publish to Redis
  private async publishToRedis(channel: string, message: any) {
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

  // Get job status
  async getJobStatus(jobId: string) {
    const chatJob = await chatQueue.getJob(jobId);
    const agentJob = await agentQueue.getJob(jobId);
    
    const job = chatJob || agentJob;
    if (!job) {
      return null;
    }
    
    return {
      id: job.id,
      name: job.name,
      state: await job.getState(),
      progress: job.progress,
      data: job.data,
      failedReason: job.failedReason,
    };
  }

  // Get queue statistics
  async getQueueStats() {
    const chatStats = await chatQueue.getJobCounts();
    const agentStats = await agentQueue.getJobCounts();
    
    return {
      chat: chatStats,
      agent: agentStats,
    };
  }
}

export const queueService = new QueueService(); 