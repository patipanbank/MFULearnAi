"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = exports.ChatService = void 0;
const bedrock_1 = require("../bedrock");
const usage_service_1 = require("../usage.service");
const context_service_1 = require("./context.service");
const message_service_1 = require("./message.service");
const stats_service_1 = require("./stats.service");
const prompt_service_1 = require("./prompt.service");
const chatRepository_service_1 = require("./chatRepository.service");
const constants_1 = require("../../constants");
const errors_1 = require("../../errors");
/**
 * Main chat service - orchestrates response generation
 */
class ChatService {
    /**
     * Generate streaming response for chat
     */
    async *generateResponse(messages, query, modelIdOrCollections, userId) {
        try {
            const lastMessage = messages[messages.length - 1];
            const isImageGeneration = lastMessage.isImageGeneration;
            // Split messages into recent and older
            const { recent: recentMessages, older: olderMessages } = message_service_1.messageService.splitMessages(messages);
            // Get context (skip for image generation)
            let context = '';
            if (!isImageGeneration) {
                const imageBase64 = lastMessage.images?.[0]?.data;
                try {
                    const trimmedQuery = query.length > constants_1.CHAT_LIMITS.MAX_QUERY_FOR_CONTEXT
                        ? query.substring(0, constants_1.CHAT_LIMITS.MAX_QUERY_FOR_CONTEXT)
                        : query;
                    context = await this.retryOperation(async () => context_service_1.contextService.getContext(trimmedQuery, modelIdOrCollections, imageBase64), 'Failed to get context');
                }
                catch (error) {
                    console.error('Error getting context:', error);
                    // Continue without context if there's an error
                }
            }
            // Get system prompt
            const dynamicSystemPrompt = await prompt_service_1.promptService.getSystemPrompt();
            // Build system messages
            const systemMessages = [
                {
                    role: 'system',
                    content: isImageGeneration
                        ? prompt_service_1.promptService.getImageGenerationPrompt()
                        : dynamicSystemPrompt,
                },
            ];
            // Add summary of older messages
            if (olderMessages.length > 0) {
                systemMessages.push({
                    role: 'system',
                    content: message_service_1.messageService.summarizeOldMessages(olderMessages),
                });
            }
            // Add context if available
            if (context && !isImageGeneration) {
                const questionType = message_service_1.messageService.detectQuestionType(query);
                const promptTemplate = message_service_1.messageService.getPromptTemplate(questionType);
                systemMessages.push({
                    role: 'system',
                    content: `${promptTemplate}\n\n${context}`,
                });
            }
            // Combine system messages with recent user messages
            const augmentedMessages = [...systemMessages, ...recentMessages];
            // Update daily stats
            await stats_service_1.chatStatsService.updateDailyStats(userId);
            // Handle file attachments
            let finalQuery = query;
            if (lastMessage.files && lastMessage.files.length > 0) {
                finalQuery += message_service_1.messageService.formatFileAttachments(lastMessage.files);
            }
            // Generate response with retry logic
            let attempt = 0;
            while (attempt < constants_1.RETRY_CONFIG.MAX_RETRIES) {
                try {
                    // Generate response and yield chunks
                    for await (const chunk of bedrock_1.bedrockService.chat(augmentedMessages, isImageGeneration ? bedrock_1.bedrockService.models.titanImage : bedrock_1.bedrockService.chatModel)) {
                        if (typeof chunk === 'string') {
                            yield chunk;
                        }
                    }
                    // Update token usage
                    const totalTokens = bedrock_1.bedrockService.getLastTokenUsage();
                    if (totalTokens > 0) {
                        await usage_service_1.usageService.updateTokenUsage(userId, totalTokens);
                        await stats_service_1.chatStatsService.updateTokenUsage(totalTokens);
                        console.log(`[Chat] Token usage updated for ${userId}:`, {
                            used: totalTokens,
                        });
                    }
                    return; // Success, exit retry loop
                }
                catch (error) {
                    attempt++;
                    if (error instanceof Error && error.name === 'InvalidSignatureException') {
                        console.error(`Error in chat generation (Attempt ${attempt}/${constants_1.RETRY_CONFIG.MAX_RETRIES}):`, error);
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        continue;
                    }
                    throw error;
                }
            }
            throw new errors_1.InternalError('Failed to generate response after retries');
        }
        catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }
    /**
     * Retry operation with exponential backoff
     */
    async retryOperation(operation, errorMessage) {
        let lastError = null;
        for (let attempt = 1; attempt <= constants_1.RETRY_CONFIG.MAX_RETRIES; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                console.error(`${errorMessage} (Attempt ${attempt}/${constants_1.RETRY_CONFIG.MAX_RETRIES}):`, error);
                if (attempt < constants_1.RETRY_CONFIG.MAX_RETRIES) {
                    const delay = Math.min(constants_1.RETRY_CONFIG.BASE_DELAY * Math.pow(2, attempt - 1), constants_1.RETRY_CONFIG.MAX_DELAY);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        throw new errors_1.InternalError(`${errorMessage} after ${constants_1.RETRY_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`);
    }
    // Delegate CRUD operations to repository
    async getChats(userId, page = 1, limit = 5) {
        return chatRepository_service_1.chatRepositoryService.getChats(userId, page, limit);
    }
    async getChat(userId, chatId) {
        return chatRepository_service_1.chatRepositoryService.getChat(userId, chatId);
    }
    async saveChat(userId, modelId, messages) {
        // Update stats before saving
        await stats_service_1.chatStatsService.updateDailyStats(userId);
        return chatRepository_service_1.chatRepositoryService.saveChat(userId, modelId, messages);
    }
    async updateChat(chatId, userId, messages) {
        return chatRepository_service_1.chatRepositoryService.updateChat(chatId, userId, messages);
    }
    async deleteChat(chatId, userId) {
        return chatRepository_service_1.chatRepositoryService.deleteChat(chatId, userId);
    }
    async togglePinChat(chatId, userId) {
        return chatRepository_service_1.chatRepositoryService.togglePinChat(chatId, userId);
    }
}
exports.ChatService = ChatService;
exports.chatService = new ChatService();
