"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.langGraphConversationService = exports.LangGraphConversationService = void 0;
const langgraph_1 = require("@langchain/langgraph");
const messages_1 = require("@langchain/core/messages");
const uuid_1 = require("uuid");
const llmFactory_1 = require("../agent/llmFactory");
const redis_1 = require("../lib/redis");
const models_1 = require("./models");
const ConversationStateAnnotation = langgraph_1.Annotation.Root({
    ...langgraph_1.MessagesAnnotation.spec,
    conversationId: (0, langgraph_1.Annotation)(),
    userId: (0, langgraph_1.Annotation)(),
    config: (0, langgraph_1.Annotation)(),
    metadata: (0, langgraph_1.Annotation)(),
    shouldContinue: (0, langgraph_1.Annotation)(),
    toolResults: (0, langgraph_1.Annotation)()
});
class LangGraphConversationService {
    constructor() {
        this.MEMORY_KEY_PREFIX = 'langgraph_conv:';
        this.MEMORY_TTL = 24 * 60 * 60;
        this.MAX_HISTORY = 10;
        this.setupWorkflow();
        console.log('🤖 LangGraphConversationService initialized');
    }
    setupWorkflow() {
        this.workflow = new langgraph_1.StateGraph(ConversationStateAnnotation)
            .addNode("load_history", this.loadHistoryNode.bind(this))
            .addNode("call_model", this.callModelNode.bind(this))
            .addNode("save_message", this.saveMessageNode.bind(this))
            .addEdge("__start__", "load_history")
            .addEdge("load_history", "call_model")
            .addEdge("call_model", "save_message")
            .addEdge("save_message", "__end__");
        this.app = this.workflow.compile();
        console.log('✅ LangGraph workflow compiled successfully');
    }
    async loadHistoryNode(state) {
        console.log(`🧠 Loading history for conversation: ${state.conversationId}`);
        try {
            const history = await this.getConversationHistory(state.conversationId);
            const messages = [...state.messages];
            for (const msg of history) {
                if (msg.role === 'user') {
                    messages.push(new messages_1.HumanMessage({ content: msg.content }));
                }
                else if (msg.role === 'assistant') {
                    messages.push(new messages_1.AIMessage({ content: msg.content }));
                }
            }
            const lastMessage = state.messages[state.messages.length - 1];
            if (lastMessage) {
                messages.push(new messages_1.HumanMessage({ content: lastMessage.content }));
            }
            return {
                messages,
                metadata: {
                    ...state.metadata,
                    startTime: Date.now()
                }
            };
        }
        catch (error) {
            console.error('❌ Error loading history:', error);
            return {
                metadata: {
                    ...state.metadata,
                    errors: [...(state.metadata?.errors || []), error]
                }
            };
        }
    }
    async callModelNode(state) {
        console.log(`🤖 Calling model for conversation: ${state.conversationId}`);
        try {
            const config = state.config || {};
            const llm = (0, llmFactory_1.getLLM)(config.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
                temperature: config.temperature || 0.7,
                maxTokens: config.maxTokens || 4000,
                systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.'
            });
            const prompt = this.buildPromptFromMessages(state.messages, config.systemPrompt);
            const currentMessage = state.messages[state.messages.length - 1];
            const images = state.images || [];
            const response = await llm.generate(prompt, images);
            const aiMessage = new messages_1.AIMessage({ content: response });
            const tokenUsage = {
                promptTokens: Math.ceil(prompt.length / 4),
                completionTokens: Math.ceil(response.length / 4),
                totalTokens: Math.ceil((prompt.length + response.length) / 4)
            };
            return {
                messages: [...state.messages, aiMessage],
                metadata: {
                    ...state.metadata,
                    tokenUsage,
                    processingTime: Date.now() - (state.metadata?.startTime || Date.now())
                }
            };
        }
        catch (error) {
            console.error('❌ Error calling model:', error);
            const errorMessage = new messages_1.AIMessage({ content: 'I apologize, but I encountered an error while processing your request. Please try again.' });
            return {
                messages: [...state.messages, errorMessage],
                metadata: {
                    ...state.metadata,
                    errors: [...(state.metadata?.errors || []), error],
                    processingTime: Date.now() - (state.metadata?.startTime || Date.now())
                }
            };
        }
    }
    async saveMessageNode(state) {
        console.log(`💾 Saving messages for conversation: ${state.conversationId}`);
        try {
            const messages = state.messages;
            const lastMessage = messages[messages.length - 1];
            const userMessage = messages[messages.length - 2];
            await this.saveMessage(state.conversationId, {
                id: (0, uuid_1.v4)(),
                conversationId: state.conversationId,
                role: 'user',
                content: userMessage.content,
                status: 'completed',
                metadata: {
                    userId: state.userId,
                    agentId: state.config?.agentId,
                    modelId: state.config?.modelId,
                    retryCount: 0
                },
                createdAt: new Date()
            });
            const messageId = state.metadata?.messageId || (0, uuid_1.v4)();
            await this.saveMessage(state.conversationId, {
                id: messageId,
                conversationId: state.conversationId,
                role: 'assistant',
                content: lastMessage.content,
                status: state.metadata?.errors?.length ? 'failed' : 'completed',
                metadata: {
                    userId: state.userId,
                    agentId: state.config?.agentId,
                    modelId: state.config?.modelId,
                    processingTime: state.metadata?.processingTime,
                    tokenUsage: state.metadata?.tokenUsage,
                    retryCount: 0,
                    errorDetails: state.metadata?.errors?.length ? {
                        code: 'PROCESSING_ERROR',
                        message: state.metadata.errors[0]?.message || 'Unknown error',
                        timestamp: new Date(),
                        retryable: true
                    } : undefined
                },
                createdAt: new Date()
            });
            return {
                metadata: {
                    ...state.metadata,
                    messageId
                }
            };
        }
        catch (error) {
            console.error('❌ Error saving messages:', error);
            return {
                metadata: {
                    ...state.metadata,
                    errors: [...(state.metadata?.errors || []), error]
                }
            };
        }
    }
    async processMessage(request, onChunk) {
        const messageId = (0, uuid_1.v4)();
        const startTime = Date.now();
        try {
            const initialState = {
                conversationId: request.conversationId,
                userId: request.userId,
                messages: [new messages_1.HumanMessage({ content: request.message })],
                config: request.config || {},
                metadata: {
                    messageId,
                    startTime
                },
                shouldContinue: false,
                toolResults: [],
                ...(request.images && { images: request.images })
            };
            const result = await this.app.invoke(initialState);
            const lastMessage = result.messages[result.messages.length - 1];
            const content = lastMessage.content;
            onChunk(content);
            const processingTime = Date.now() - startTime;
            return {
                messageId,
                content,
                role: 'assistant',
                status: result.metadata?.errors?.length ? 'failed' : 'completed',
                tokenUsage: result.metadata?.tokenUsage,
                processingTime,
                error: result.metadata?.errors?.length ? result.metadata.errors[0]?.message : undefined
            };
        }
        catch (error) {
            console.error('❌ Error in LangGraph workflow:', error);
            const processingTime = Date.now() - startTime;
            const errorContent = 'I apologize, but I encountered an error while processing your request. Please try again.';
            onChunk(errorContent);
            return {
                messageId,
                content: errorContent,
                role: 'assistant',
                status: 'failed',
                processingTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    buildPromptFromMessages(messages, systemPrompt) {
        const prompt = systemPrompt || 'You are a helpful AI assistant.';
        let conversation = `${prompt}\n\n`;
        messages.forEach(message => {
            if (message instanceof messages_1.HumanMessage) {
                conversation += `Human: ${message.content}\n`;
            }
            else if (message instanceof messages_1.AIMessage) {
                conversation += `Assistant: ${message.content}\n`;
            }
        });
        conversation += '\nAssistant:';
        return conversation;
    }
    async getConversationHistory(conversationId) {
        try {
            const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
            const cached = await redis_1.redis.lrange(cacheKey, 0, -1);
            if (cached.length > 0) {
                return cached.map(msg => JSON.parse(msg));
            }
            const messages = await models_1.ConversationMessageModel
                .find({ conversationId })
                .sort({ createdAt: 1 })
                .limit(this.MAX_HISTORY)
                .lean();
            if (messages.length > 0) {
                const pipeline = redis_1.redis.pipeline();
                pipeline.del(cacheKey);
                for (const msg of messages) {
                    pipeline.rpush(cacheKey, JSON.stringify(msg));
                }
                pipeline.expire(cacheKey, this.MEMORY_TTL);
                await pipeline.exec();
            }
            return messages;
        }
        catch (error) {
            console.error('❌ Error loading conversation history:', error);
            return [];
        }
    }
    async saveMessage(conversationId, message) {
        try {
            const messageDoc = new models_1.ConversationMessageModel({
                ...message,
                conversationId,
                role: message.role,
                content: message.content,
                status: message.status,
                metadata: {
                    ...message.metadata,
                    retryCount: message.metadata?.retryCount || 0
                },
                attachments: [],
                toolCalls: [],
                createdAt: message.createdAt || new Date(),
                updatedAt: new Date()
            });
            await messageDoc.save();
            const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
            await redis_1.redis.rpush(cacheKey, JSON.stringify(message));
            await redis_1.redis.ltrim(cacheKey, -this.MAX_HISTORY, -1);
            await redis_1.redis.expire(cacheKey, this.MEMORY_TTL);
        }
        catch (error) {
            console.error('❌ Error saving message:', error);
        }
    }
    async clearConversation(conversationId) {
        try {
            const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
            await redis_1.redis.del(cacheKey);
            console.log(`🧹 Cleared LangGraph conversation memory: ${conversationId}`);
        }
        catch (error) {
            console.error('❌ Error clearing conversation:', error);
        }
    }
}
exports.LangGraphConversationService = LangGraphConversationService;
exports.langGraphConversationService = new LangGraphConversationService();
//# sourceMappingURL=LangGraphConversation.js.map