import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ChatService } from '../chat/chat.service';
import { ChatHistoryService } from '../chat/chat-history.service';
import { RedisPubSubService } from '../redis/redis-pubsub.service';

interface ChatTaskPayload {
  sessionId: string;
  userId: string;
  message: string;
  modelId: string;
  collectionNames: string[];
  agentId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  images?: any[];
}

@Injectable()
export class TaskQueueService {
  private readonly logger = new Logger(TaskQueueService.name);

  constructor(
    private redisService: RedisService,
    private chatService: ChatService,
    private chatHistoryService: ChatHistoryService,
    private redisPubSubService: RedisPubSubService,
  ) {}

  async addChatTask(taskType: string, payload: ChatTaskPayload): Promise<void> {
    try {
      const taskData = {
        type: taskType,
        payload,
        timestamp: new Date().toISOString(),
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // Add to Redis queue (like Celery)
      await this.redisService.lpush('chat_tasks', JSON.stringify(taskData));
      
      // Process task immediately (for now, can be changed to background processing)
      await this.processChatTask(taskData);
      
      this.logger.log(`✅ Chat task added and processed: ${taskType}`);
    } catch (error) {
      this.logger.error(`❌ Failed to add chat task: ${error.message}`);
      throw error;
    }
  }

  async processChatTask(taskData: any): Promise<void> {
    try {
      const { type, payload } = taskData;
      
      if (type === 'generate_response') {
        await this.generateResponse(payload);
      } else {
        this.logger.warn(`Unknown task type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to process chat task: ${error.message}`);
    }
  }

  async generateResponse(payload: ChatTaskPayload): Promise<void> {
    const {
      sessionId,
      userId,
      message,
      modelId,
      collectionNames,
      agentId,
      systemPrompt,
      temperature = 0.7,
      maxTokens = 4000,
      images = [],
    } = payload;

    try {
      this.logger.log(`🎯 Generating response for session ${sessionId}`);
      this.logger.log(`📝 Message: ${message}`);
      this.logger.log(`🤖 Agent ID: ${agentId || 'None'}`);
      this.logger.log(`🔧 Model ID: ${modelId}`);

      const assistantId = `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const buffer: string[] = [];

      // Generate response using ChatService (like FastAPI chat_service.chat)
      const responseGenerator = this.chatService.generateResponse({
        sessionId,
        userId,
        message,
        modelId,
        collectionNames,
        agentId,
        systemPrompt,
        temperature,
        maxTokens,
        images,
      });

      // Process streaming response
      for await (const chunk of responseGenerator) {
        try {
          const data = JSON.parse(chunk);

          if (data.type === 'chunk') {
            const chunkPayload = data.data;
            let chunkText = '';

            // Normalize chunk payload (like FastAPI)
            if (Array.isArray(chunkPayload)) {
              const textParts: string[] = [];
              for (const part of chunkPayload) {
                if (typeof part === 'string') {
                  textParts.push(part);
                } else if (typeof part === 'object') {
                  for (const key of ['text', 'content', 'value']) {
                    if (part[key] && typeof part[key] === 'string') {
                      textParts.push(part[key]);
                      break;
                    }
                  }
                } else {
                  textParts.push(String(part));
                }
              }
              chunkText = textParts.join('');
            } else if (typeof chunkPayload === 'object') {
              for (const key of ['text', 'content', 'value']) {
                if (chunkPayload[key] && typeof chunkPayload[key] === 'string') {
                  chunkText = chunkPayload[key];
                  break;
                }
              }
              if (!chunkText) {
                chunkText = String(chunkPayload);
              }
            } else {
              chunkText = String(chunkPayload);
            }

            buffer.push(chunkText);

            // Publish to Redis for streaming (like FastAPI)
            const message = JSON.stringify({ type: 'chunk', data: chunkText });
            await this.redisPubSubService.publishChatMessage(sessionId, message);
            this.logger.log(`📤 Published chunk to Redis: chat:${sessionId}`);

          } else if (['tool_start', 'tool_result', 'tool_error'].includes(data.type)) {
            // Forward tool events directly to Redis
            const message = JSON.stringify(data);
            await this.redisPubSubService.publishChatMessage(sessionId, message);
            this.logger.log(`🔧 Published ${data.type} to Redis: chat:${sessionId}`);

          } else if (data.type === 'end') {
            const finalText = buffer.join('');
            
            // Add assistant message to chat history (like FastAPI)
            const assistantMessage = {
              id: assistantId,
              role: 'assistant' as const,
              content: finalText,
              timestamp: new Date(),
              isStreaming: false,
              isComplete: true,
            };

            await this.chatHistoryService.addMessageToChat(sessionId, assistantMessage);

            // Publish end event
            const message = JSON.stringify({ type: 'end' });
            await this.redisPubSubService.publishChatMessage(sessionId, message);
            this.logger.log(`🏁 Published end event to Redis: chat:${sessionId}`);
          }

        } catch (parseError) {
          this.logger.warn(`⚠️ Failed to parse chunk: ${parseError.message}`);
          continue;
        }
      }

      this.logger.log(`✅ Response generation completed for session ${sessionId}`);

    } catch (error) {
      this.logger.error(`❌ Failed to generate response: ${error.message}`);
      
      // Send error to client
      const errorMessage = JSON.stringify({
        type: 'error',
        data: `Failed to generate response: ${error.message}`,
      });
      await this.redisPubSubService.publishChatMessage(sessionId, errorMessage);
    }
  }

  async getTaskStatus(taskId: string): Promise<any> {
    try {
      const status = await this.redisService.get(`task_status:${taskId}`);
      return status ? JSON.parse(status) : null;
    } catch (error) {
      this.logger.error(`❌ Failed to get task status: ${error.message}`);
      return null;
    }
  }

  async updateTaskStatus(taskId: string, status: any): Promise<void> {
    try {
      await this.redisService.set(
        `task_status:${taskId}`,
        JSON.stringify(status),
        3600 // 1 hour TTL
      );
    } catch (error) {
      this.logger.error(`❌ Failed to update task status: ${error.message}`);
    }
  }
} 