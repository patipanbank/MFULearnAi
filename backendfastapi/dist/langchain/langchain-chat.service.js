"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LangChainChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LangChainChatService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const bedrock_service_1 = require("../bedrock/bedrock.service");
const chat_memory_service_1 = require("../chat/chat-memory.service");
const memory_tool_service_1 = require("../chat/memory-tool.service");
let LangChainChatService = LangChainChatService_1 = class LangChainChatService {
    configService;
    bedrockService;
    chatMemoryService;
    memoryToolService;
    logger = new common_1.Logger(LangChainChatService_1.name);
    constructor(configService, bedrockService, chatMemoryService, memoryToolService) {
        this.configService = configService;
        this.bedrockService = bedrockService;
        this.chatMemoryService = chatMemoryService;
        this.memoryToolService = memoryToolService;
    }
    async *chat(request) {
        const { sessionId, userId, message, modelId, collectionNames, agentId, systemPrompt, temperature = 0.7, maxTokens = 4000, images = [], } = request;
        try {
            this.logger.log(`🎯 Starting chat for session ${sessionId}`);
            this.logger.log(`📝 Message: ${message}`);
            this.logger.log(`🤖 Model: ${modelId}`);
            this.logger.log(`📚 Collections: ${collectionNames.join(', ')}`);
            const defaultSystemPrompt = "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. " +
                "Always focus on answering the current user's question. Use chat history as context to provide better responses, " +
                "but do not repeat or respond to previous questions in the history.";
            const finalSystemPrompt = systemPrompt || defaultSystemPrompt;
            const memoryMessages = await this.chatMemoryService.getMessages(sessionId);
            this.logger.log(`💾 Retrieved ${memoryMessages.length} memory messages`);
            let context = '';
            if (collectionNames.length > 0) {
                try {
                    for (const collectionName of collectionNames) {
                        const searchResults = await this.memoryToolService.searchMemory(message, collectionName, 5, 'amazon.titan-embed-text-v1');
                        if (searchResults.documents.length > 0) {
                            context += `\n\nInformation from ${collectionName}:\n`;
                            searchResults.documents.forEach((doc, index) => {
                                context += `${index + 1}. ${doc.content}\n`;
                            });
                        }
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to search collections: ${error.message}`);
                }
            }
            const conversationHistory = memoryMessages.map(msg => ({
                role: msg.role,
                content: msg.content,
            }));
            const messages = [
                ...conversationHistory,
                { role: 'user', content: message + (context ? `\n\nContext:${context}` : '') }
            ];
            let responseContent = '';
            let inputTokens = 0;
            let outputTokens = 0;
            try {
                const responseStream = this.bedrockService.converseStream(modelId, messages, finalSystemPrompt, undefined, temperature, undefined);
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
                    }
                    else if (chunk.usage) {
                        inputTokens = chunk.usage.inputTokens || 0;
                        outputTokens = chunk.usage.outputTokens || 0;
                    }
                }
                if (responseContent) {
                    await this.chatMemoryService.addAiMessage(sessionId, responseContent);
                }
                yield JSON.stringify({
                    type: 'end',
                    data: {
                        inputTokens,
                        outputTokens,
                        content: responseContent
                    }
                });
                this.logger.log(`✅ Chat completed for session ${sessionId}`);
            }
            catch (bedrockError) {
                this.logger.error(`❌ Bedrock error: ${bedrockError.message}`);
                yield JSON.stringify({
                    type: 'error',
                    data: `Failed to generate response: ${bedrockError.message}`
                });
            }
        }
        catch (error) {
            this.logger.error(`❌ Chat service error: ${error.message}`);
            yield JSON.stringify({
                type: 'error',
                data: `An unexpected error occurred: ${error.message}`
            });
        }
    }
    async clearChatMemory(sessionId) {
        try {
            await this.chatMemoryService.clear(sessionId);
            await this.memoryToolService.clearChatMemory(sessionId);
            this.logger.log(`🧹 Cleared all memory for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to clear memory for session ${sessionId}: ${error.message}`);
            throw error;
        }
    }
    shouldEmbedMessages(messageCount) {
        return messageCount % 10 === 0;
    }
    shouldUseMemoryTool(messageCount) {
        return messageCount > 10;
    }
};
exports.LangChainChatService = LangChainChatService;
exports.LangChainChatService = LangChainChatService = LangChainChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_2.Inject)((0, common_2.forwardRef)(() => chat_memory_service_1.ChatMemoryService))),
    __param(3, (0, common_2.Inject)((0, common_2.forwardRef)(() => memory_tool_service_1.MemoryToolService))),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        bedrock_service_1.BedrockService,
        chat_memory_service_1.ChatMemoryService,
        memory_tool_service_1.MemoryToolService])
], LangChainChatService);
//# sourceMappingURL=langchain-chat.service.js.map