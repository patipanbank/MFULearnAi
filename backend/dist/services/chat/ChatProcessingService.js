"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatProcessingService = exports.ChatProcessingService = void 0;
const chat_1 = require("../../models/chat");
const websocketManager_1 = require("../../utils/websocketManager");
const agentService_1 = require("../agentService");
const usageService_1 = require("../usageService");
const llmFactory_1 = require("../../agent/llmFactory");
const toolRegistry_1 = require("../../agent/toolRegistry");
const agentFactory_1 = require("../../agent/agentFactory");
const ChatMessageService_1 = require("./ChatMessageService");
const ChatMemoryService_1 = require("./ChatMemoryService");
class ChatProcessingService {
    constructor() {
        this.agentCache = new Map();
        console.log('✅ Chat processing service initialized');
    }
    async processMessage(chatId, userId, content, images) {
        console.log(`🔧 Processing message for chat ${chatId}, user ${userId}`);
        try {
            await ChatMessageService_1.chatMessageService.addMessage(chatId, {
                role: 'user',
                content,
                images
            });
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error(`Chat session ${chatId} not found`);
            }
            let config = {
                modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
                collectionNames: [],
                systemPrompt: null,
                temperature: 0.7,
                maxTokens: 4000,
                agentId: chat.agentId
            };
            if (chat.agentId) {
                try {
                    const agentConfig = await agentService_1.agentService.getAgentById(chat.agentId);
                    if (agentConfig) {
                        config.modelId = agentConfig.modelId;
                        config.collectionNames = agentConfig.collectionNames || [];
                        config.systemPrompt = agentConfig.systemPrompt;
                        config.temperature = agentConfig.temperature || 0.7;
                        config.maxTokens = agentConfig.maxTokens || 4000;
                    }
                }
                catch (error) {
                    console.warn(`⚠️ Failed to get agent config for ${chat.agentId}:`, error);
                }
            }
            await this.processWithAI(chatId, content, images, config, userId);
        }
        catch (error) {
            console.error('❌ Error in processMessage:', error);
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
            }
        }
    }
    async processWithAI(chatId, userMessage, images, config, userId) {
        try {
            console.log(`🤖 Processing with AI for chat ${chatId}`);
            const chat = await chat_1.ChatModel.findById(chatId);
            if (!chat) {
                throw new Error('Chat not found');
            }
            const memoryConfig = ChatMemoryService_1.chatMemoryService.analyzeMemoryNeeds(chat.messages.length);
            console.log(`🧠 Memory config:`, memoryConfig);
            const agent = await this.getOrCreateAgent(chatId, config || {});
            const messages = ChatMessageService_1.chatMessageService.enrichMessagesWithImages(chat.messages);
            const preparedImages = await ChatMessageService_1.chatMessageService.prepareImagesForMultimodal(images);
            if (userId) {
                const quotaCheck = await usageService_1.usageService.checkQuotaAndUsage(userId, 0, 100);
                if (!quotaCheck.canUse) {
                    console.warn(`⚠️ Quota check failed for user ${userId}: ${quotaCheck.reason}`);
                    if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                        websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({
                            type: 'quota_exceeded',
                            data: {
                                reason: quotaCheck.reason,
                                timestamp: new Date().toISOString()
                            }
                        }));
                    }
                    throw new Error(`Token quota exceeded: ${quotaCheck.reason}`);
                }
            }
            await this.executeAgent(chatId, agent, messages, preparedImages, userId);
        }
        catch (error) {
            console.error('❌ Error in processWithAI:', error);
            if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
            }
        }
    }
    async getOrCreateAgent(chatId, config) {
        const defaultSystemPrompt = "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.";
        const finalSystemPrompt = config.systemPrompt || defaultSystemPrompt;
        const signaturePayload = {
            modelId: config.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            temperature: config.temperature ?? 0.7,
            maxTokens: config.maxTokens ?? 4000,
            systemPrompt: finalSystemPrompt,
            collections: (config.collectionNames || []).slice().sort(),
            agentId: config.agentId || null
        };
        const signature = JSON.stringify(signaturePayload);
        const cached = this.agentCache.get(chatId);
        if (cached && cached.signature === signature) {
            console.log(`⚡ Reusing cached agent for chat ${chatId}`);
            return cached.executor;
        }
        console.log(`🤖 Creating new agent for chat ${chatId}`);
        const llm = (0, llmFactory_1.getLLM)(signaturePayload.modelId, {
            temperature: signaturePayload.temperature,
            maxTokens: signaturePayload.maxTokens,
            streaming: true
        });
        const sessionTools = (0, toolRegistry_1.createMemoryTool)(chatId);
        const allTools = {};
        for (const [k, v] of Object.entries(toolRegistry_1.toolRegistry))
            allTools[k] = v.func;
        for (const [k, v] of Object.entries(sessionTools))
            allTools[k] = v.func;
        if (signaturePayload.collections && signaturePayload.collections.length > 0) {
            const retrievalTools = (0, toolRegistry_1.createRetrievalTools)(signaturePayload.collections);
            for (const [name, tool] of Object.entries(retrievalTools)) {
                allTools[name] = tool.func;
                console.log(`🔧 Added retrieval tool: ${name}`);
            }
        }
        const agent = await (0, agentFactory_1.createAgent)(llm, allTools, finalSystemPrompt, {
            modelId: signaturePayload.modelId,
            sessionId: chatId,
            temperature: signaturePayload.temperature,
            maxTokens: signaturePayload.maxTokens
        });
        this.agentCache.set(chatId, { signature, executor: agent });
        return agent;
    }
    async executeAgent(chatId, agent, messages, preparedImages, userId) {
        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;
        let assistantMessageId = null;
        console.log(`🤖 Starting agent execution with ${messages.length} messages`);
        await agent.run(messages, {
            onEvent: async (event) => {
                await this.handleAgentEvent(event, chatId, assistantMessageId, userId);
                if (event.type === 'chunk') {
                    fullContent += event.data;
                    if (fullContent === event.data) {
                        const assistantMessage = await ChatMessageService_1.chatMessageService.addMessage(chatId, {
                            role: 'assistant',
                            content: '',
                        });
                        assistantMessageId = assistantMessage.id;
                    }
                }
                else if (event.type === 'end') {
                    if (assistantMessageId) {
                        await ChatMessageService_1.chatMessageService.updateMessage(chatId, assistantMessageId, {
                            content: event.data.answer,
                        });
                    }
                    const updatedChat = await chat_1.ChatModel.findById(chatId);
                    if (updatedChat) {
                        await ChatMemoryService_1.chatMemoryService.setupHybridMemory(chatId, updatedChat.messages);
                    }
                    if (event.data.inputTokens || event.data.outputTokens) {
                        inputTokens = event.data.inputTokens || 0;
                        outputTokens = event.data.outputTokens || 0;
                        if (userId && (inputTokens > 0 || outputTokens > 0)) {
                            const updateResult = await usageService_1.usageService.updateUsage(userId, inputTokens, outputTokens);
                            if (!updateResult.success) {
                                console.warn(`⚠️ Usage update failed for user ${userId}: ${updateResult.reason}`);
                            }
                        }
                    }
                }
            },
            maxSteps: 5,
            images: preparedImages
        });
    }
    async handleAgentEvent(event, chatId, assistantMessageId, userId) {
        console.log(`🤖 Agent event: ${event.type}`, event.data);
        if (websocketManager_1.wsManager.getSessionConnectionCount(chatId) > 0) {
            let wsMessage;
            switch (event.type) {
                case 'chunk':
                    wsMessage = {
                        type: 'chunk',
                        data: {
                            messageId: assistantMessageId,
                            delta: event.data
                        }
                    };
                    break;
                case 'tool_start':
                    wsMessage = {
                        type: 'tool_start',
                        data: {
                            tool_name: event.data.tool_name,
                            tool_input: event.data.tool_input
                        }
                    };
                    break;
                case 'tool_result':
                    wsMessage = {
                        type: 'tool_result',
                        data: {
                            tool_name: event.data.tool_name,
                            output: event.data.output || 'No output available'
                        }
                    };
                    break;
                case 'tool_error':
                    wsMessage = {
                        type: 'tool_error',
                        data: {
                            tool_name: event.data.tool_name,
                            error: event.data.error
                        }
                    };
                    break;
                case 'assistant_created':
                    wsMessage = {
                        type: 'assistant_created',
                        data: {
                            messageId: event.data.messageId,
                            content: event.data.content
                        }
                    };
                    break;
                case 'end':
                    wsMessage = {
                        type: 'end',
                        data: {
                            messageId: assistantMessageId,
                            answer: event.data.answer,
                            inputTokens: event.data.inputTokens || 0,
                            outputTokens: event.data.outputTokens || 0
                        }
                    };
                    break;
            }
            if (wsMessage) {
                websocketManager_1.wsManager.broadcastToSession(chatId, JSON.stringify(wsMessage));
            }
        }
    }
    getStats() {
        return {
            cachedAgents: this.agentCache.size,
            totalChats: 0,
            activeSessions: 0,
            totalMessages: 0
        };
    }
}
exports.ChatProcessingService = ChatProcessingService;
exports.chatProcessingService = new ChatProcessingService();
//# sourceMappingURL=ChatProcessingService.js.map