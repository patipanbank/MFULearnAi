"use strict";
/**
 * LangGraph Execution Service
 *
 * Handles agent execution using LangGraph StateGraph
 * Replaces the old AgentExecutor-based approach
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.langGraphExecutionService = void 0;
const events_1 = require("events");
const messages_1 = require("@langchain/core/messages");
const langgraphAgent_1 = require("../agent/langgraphAgent");
const agentService_1 = require("./agentService");
class LangGraphExecutionService extends events_1.EventEmitter {
    constructor() {
        super();
    }
    static getInstance() {
        if (!LangGraphExecutionService.instance) {
            LangGraphExecutionService.instance = new LangGraphExecutionService();
        }
        return LangGraphExecutionService.instance;
    }
    /**
     * Execute agent with streaming support
     */
    async executeAgent(request, onEvent) {
        console.log(`🚀 LangGraph Execution: chatId=${request.chatId}, agentId=${request.agentId}`);
        try {
            // 1. Get agent configuration
            const agentConfig = await this.getAgentConfig(request);
            // 2. Prepare chat history
            const messages = this.prepareChatHistory(request.chatHistory || []);
            // 3. Create LangGraph agent
            const agent = await (0, langgraphAgent_1.createLangGraphAgent)({
                modelId: agentConfig.modelId,
                systemPrompt: agentConfig.systemPrompt,
                temperature: agentConfig.temperature,
                maxTokens: agentConfig.maxTokens,
                collectionNames: agentConfig.collectionNames,
                sessionId: request.chatId,
                tools: {} // Tools are registered inside langgraphAgent.ts
            });
            console.log('✅ LangGraph agent created');
            // 4. Execute with streaming
            let fullContent = '';
            const result = await agent.run(request.userContent, messages, (chunk) => {
                fullContent = chunk;
                // Stream chunks to caller
                if (onEvent) {
                    onEvent({
                        type: 'chunk',
                        data: chunk
                    });
                }
            });
            console.log(`✅ LangGraph execution completed: ${result.toolsUsed.length} tools used`);
            // 5. Send completion event
            if (onEvent) {
                onEvent({
                    type: 'end',
                    data: {
                        answer: result.answer,
                        metadata: result.metadata,
                        toolsUsed: result.toolsUsed
                    }
                });
            }
            return {
                success: true,
                answer: result.answer,
                metadata: result.metadata,
                toolsUsed: result.toolsUsed
            };
        }
        catch (error) {
            console.error('❌ LangGraph execution error:', error);
            if (onEvent) {
                onEvent({
                    type: 'error',
                    data: { error: error?.message || 'Unknown error' }
                });
            }
            return {
                success: false,
                answer: '',
                error: error?.message || 'Unknown error'
            };
        }
    }
    /**
     * Get agent configuration with defaults
     */
    async getAgentConfig(request) {
        let modelId = request.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
        let systemPrompt = request.systemPrompt || 'You are a helpful AI assistant. Use available tools when needed.';
        let temperature = request.temperature || 0.7;
        let maxTokens = request.maxTokens || 4000;
        let collectionNames = request.collectionNames || [];
        // If agentId is provided, fetch agent config
        if (request.agentId) {
            try {
                const agent = await agentService_1.agentService.getAgentById(request.agentId);
                if (agent) {
                    modelId = agent.modelId || modelId;
                    systemPrompt = agent.systemPrompt || systemPrompt;
                    temperature = agent.temperature ?? temperature;
                    maxTokens = agent.maxTokens ?? maxTokens;
                    collectionNames = agent.collectionNames || collectionNames;
                }
            }
            catch (error) {
                console.warn(`⚠️ Failed to fetch agent config:`, error);
            }
        }
        return {
            modelId,
            systemPrompt,
            temperature,
            maxTokens,
            collectionNames
        };
    }
    /**
     * Prepare chat history for LangChain messages
     */
    prepareChatHistory(chatHistory) {
        const messages = [];
        // Take last 10 messages for context
        const recentHistory = chatHistory.slice(-10);
        for (const msg of recentHistory) {
            if (msg.role === 'user') {
                messages.push(new messages_1.HumanMessage(msg.content));
            }
            else if (msg.role === 'assistant' && msg.content) {
                messages.push(new messages_1.AIMessage(msg.content));
            }
        }
        return messages;
    }
    /**
     * Get execution statistics
     */
    getStatistics() {
        return {
            activeExecutions: 0,
            totalExecutions: 0,
            averageExecutionTime: 0
        };
    }
}
exports.langGraphExecutionService = LangGraphExecutionService.getInstance();
//# sourceMappingURL=langGraphExecutionService.js.map