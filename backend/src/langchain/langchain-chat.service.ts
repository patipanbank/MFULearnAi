import { Injectable, Logger } from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChatMemoryService } from '../chat/chat-memory.service';
import { MemoryToolService } from '../chat/memory-tool.service';

interface ChatRequest {
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

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  id?: string;
}

@Injectable()
export class LangChainChatService {
  private readonly logger = new Logger(LangChainChatService.name);

  constructor(
    private configService: ConfigService,
    private bedrockService: BedrockService,
    @Inject(forwardRef(() => ChatMemoryService))
    private chatMemoryService: ChatMemoryService,
    @Inject(forwardRef(() => MemoryToolService))
    private memoryToolService: MemoryToolService,
  ) {}

  async *chat(request: ChatRequest): AsyncGenerator<string, void, unknown> {
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
    } = request;

    try {
      this.logger.log(`🎯 Starting chat for session ${sessionId}`);
      this.logger.log(`📝 Message: ${message}`);
      this.logger.log(`🤖 Model: ${modelId}`);
      this.logger.log(`📚 Collections: ${collectionNames.join(', ')}`);

      // 1. Get system prompt
      const defaultSystemPrompt = 
        "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. " +
        "Always focus on answering the current user's question. Use chat history as context to provide better responses, " +
        "but do not repeat or respond to previous questions in the history.";
      
      const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

      // 2. Get chat memory
      const memoryMessages = await this.chatMemoryService.getMessages(sessionId);
      this.logger.log(`💾 Retrieved ${memoryMessages.length} memory messages`);

      // 3. Build context from collections
      let context = '';
      if (collectionNames.length > 0) {
        try {
          for (const collectionName of collectionNames) {
            const searchResults = await this.memoryToolService.searchMemory(
              message,
              collectionName,
              5,
              'amazon.titan-embed-text-v1'
            );
            
            if (searchResults.documents.length > 0) {
              context += `\n\nInformation from ${collectionName}:\n`;
              searchResults.documents.forEach((doc: any, index: number) => {
                context += `${index + 1}. ${doc.content}\n`;
              });
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to search collections: ${error.message}`);
        }
      }

      // 4. Build conversation history
      const conversationHistory = memoryMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      // 5. Prepare messages for Bedrock
      const messages = [
        ...conversationHistory,
        { role: 'user' as const, content: message + (context ? `\n\nContext:${context}` : '') }
      ];

      // 6. Stream response from Bedrock
      let responseContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const responseStream = this.bedrockService.converseStream(
          modelId,
          messages,
          finalSystemPrompt,
          undefined,
          temperature,
          undefined
        );

        for await (const chunk of responseStream) {
          if (chunk.content && chunk.content.length > 0) {
            const text = chunk.content[0]?.text || '';
            if (text) {
              responseContent += text;
              yield JSON.stringify({
                type: 'chunk',
                data: text
              });
            }
          } else if (chunk.usage) {
            inputTokens = chunk.usage.inputTokens || 0;
            outputTokens = chunk.usage.outputTokens || 0;
          }
        }

        // 7. Add assistant message to memory
        if (responseContent) {
          await this.chatMemoryService.addAiMessage(sessionId, responseContent);
        }

        // 8. Send end event with usage
        yield JSON.stringify({
          type: 'end',
          data: {
            inputTokens,
            outputTokens,
            content: responseContent
          }
        });

        this.logger.log(`✅ Chat completed for session ${sessionId}`);

      } catch (bedrockError) {
        this.logger.error(`❌ Bedrock error: ${bedrockError.message}`);
        yield JSON.stringify({
          type: 'error',
          data: `Failed to generate response: ${bedrockError.message}`
        });
      }

    } catch (error) {
      this.logger.error(`❌ Chat service error: ${error.message}`);
      yield JSON.stringify({
        type: 'error',
        data: `An unexpected error occurred: ${error.message}`
      });
    }
  }

  /**
   * Clear chat memory (equivalent to FastAPI clear_chat_memory)
   */
  async clearChatMemory(sessionId: string): Promise<void> {
    try {
      // Clear Redis memory
      await this.chatMemoryService.clear(sessionId);
      
      // Clear memory tool
      await this.memoryToolService.clearChatMemory(sessionId);
      
      this.logger.log(`🧹 Cleared all memory for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to clear memory for session ${sessionId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if should embed messages (every 10 messages like FastAPI)
   */
  shouldEmbedMessages(messageCount: number): boolean {
    return messageCount % 10 === 0;
  }

  /**
   * Check if should use memory tool (more than 10 messages)
   */
  shouldUseMemoryTool(messageCount: number): boolean {
    return messageCount > 10;
  }
} 