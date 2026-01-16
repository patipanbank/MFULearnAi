import { bedrockService } from '../bedrock';
import { usageService } from '../usage.service';
import { ChatMessage } from '../../types/chat';
import { contextService } from './context.service';
import { messageService } from './message.service';
import { chatStatsService } from './stats.service';
import { promptService } from './prompt.service';
import { chatRepositoryService } from './chatRepository.service';
import { CHAT_LIMITS, RETRY_CONFIG } from '../../constants';
import { InternalError } from '../../errors';

/**
 * Main chat service - orchestrates response generation
 */
export class ChatService {
  /**
   * Generate streaming response for chat
   */
  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelIdOrCollections: string | string[],
    userId: string
  ): AsyncGenerator<string> {
    try {
      const lastMessage = messages[messages.length - 1];
      const isImageGeneration = lastMessage.isImageGeneration;

      // Split messages into recent and older
      const { recent: recentMessages, older: olderMessages } = messageService.splitMessages(messages);

      // Get context (skip for image generation)
      let context = '';
      if (!isImageGeneration) {
        const imageBase64 = lastMessage.images?.[0]?.data;
        try {
          const trimmedQuery =
            query.length > CHAT_LIMITS.MAX_QUERY_FOR_CONTEXT
              ? query.substring(0, CHAT_LIMITS.MAX_QUERY_FOR_CONTEXT)
              : query;

          context = await this.retryOperation(
            async () => contextService.getContext(trimmedQuery, modelIdOrCollections, imageBase64),
            'Failed to get context'
          );
        } catch (error) {
          console.error('Error getting context:', error);
          // Continue without context if there's an error
        }
      }

      // Get system prompt
      const dynamicSystemPrompt = await promptService.getSystemPrompt();

      // Build system messages
      const systemMessages: ChatMessage[] = [
        {
          role: 'system',
          content: isImageGeneration
            ? promptService.getImageGenerationPrompt()
            : dynamicSystemPrompt,
        },
      ];

      // Add summary of older messages
      if (olderMessages.length > 0) {
        systemMessages.push({
          role: 'system',
          content: messageService.summarizeOldMessages(olderMessages),
        });
      }

      // Add context if available
      if (context && !isImageGeneration) {
        const questionType = messageService.detectQuestionType(query);
        const promptTemplate = messageService.getPromptTemplate(questionType);
        systemMessages.push({
          role: 'system',
          content: `${promptTemplate}\n\n${context}`,
        });
      }

      // Combine system messages with recent user messages
      const augmentedMessages = [...systemMessages, ...recentMessages];

      // Update daily stats
      await chatStatsService.updateDailyStats(userId);

      // Handle file attachments
      let finalQuery = query;
      if (lastMessage.files && lastMessage.files.length > 0) {
        finalQuery += messageService.formatFileAttachments(lastMessage.files);
      }

      // Generate response with retry logic
      let attempt = 0;
      while (attempt < RETRY_CONFIG.MAX_RETRIES) {
        try {
          // Generate response and yield chunks
          for await (const chunk of bedrockService.chat(
            augmentedMessages,
            isImageGeneration ? bedrockService.models.titanImage : bedrockService.chatModel
          )) {
            if (typeof chunk === 'string') {
              yield chunk;
            }
          }

          // Update token usage
          const totalTokens = bedrockService.getLastTokenUsage();
          if (totalTokens > 0) {
            await usageService.updateTokenUsage(userId, totalTokens);
            await chatStatsService.updateTokenUsage(totalTokens);

            console.log(`[Chat] Token usage updated for ${userId}:`, {
              used: totalTokens,
            });
          }

          return; // Success, exit retry loop
        } catch (error: unknown) {
          attempt++;
          if (error instanceof Error && error.name === 'InvalidSignatureException') {
            console.error(`Error in chat generation (Attempt ${attempt}/${RETRY_CONFIG.MAX_RETRIES}):`, error);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          throw error;
        }
      }

      throw new InternalError('Failed to generate response after retries');
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`${errorMessage} (Attempt ${attempt}/${RETRY_CONFIG.MAX_RETRIES}):`, error);

        if (attempt < RETRY_CONFIG.MAX_RETRIES) {
          const delay = Math.min(
            RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt - 1),
            RETRY_CONFIG.MAX_DELAY
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new InternalError(`${errorMessage} after ${RETRY_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  // Delegate CRUD operations to repository
  async getChats(userId: string, page: number = 1, limit: number = 5) {
    return chatRepositoryService.getChats(userId, page, limit);
  }

  async getChat(userId: string, chatId: string) {
    return chatRepositoryService.getChat(userId, chatId);
  }

  async saveChat(userId: string, modelId: string, messages: any[]) {
    // Update stats before saving
    await chatStatsService.updateDailyStats(userId);
    return chatRepositoryService.saveChat(userId, modelId, messages);
  }

  async updateChat(chatId: string, userId: string, messages: any[]) {
    return chatRepositoryService.updateChat(chatId, userId, messages);
  }

  async deleteChat(chatId: string, userId: string) {
    return chatRepositoryService.deleteChat(chatId, userId);
  }

  async togglePinChat(chatId: string, userId: string) {
    return chatRepositoryService.togglePinChat(chatId, userId);
  }
}

export const chatService = new ChatService();
