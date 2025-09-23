"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = createAgent;
const simpleLanggraphAgent_1 = require("./simpleLanggraphAgent");
const unifiedToolRegistry_1 = require("../services/unifiedToolRegistry");
async function createAgent(llm, tools, prompt, config) {
    console.log(`🤖 Creating LangGraph Agent with prompt: ${prompt.substring(0, 50)}...`);
    const toolContext = {
        sessionId: config?.sessionId,
        userId: config?.userId,
        agentId: config?.agentId,
        collectionNames: config?.collectionNames || [],
        config: config
    };
    if (config?.sessionId) {
        unifiedToolRegistry_1.unifiedToolRegistry.createSessionTools(config.sessionId);
        await unifiedToolRegistry_1.unifiedToolRegistry.createMemorySearchToolsIfNeeded(config.sessionId);
    }
    if (config?.collectionNames && config.collectionNames.length > 0) {
        unifiedToolRegistry_1.unifiedToolRegistry.createCollectionTools(config.collectionNames);
    }
    console.log(`🔧 Tool filtering: ${config?.allowedTools ? config.allowedTools.join(', ') : 'All tools allowed'}`);
    const agentConfig = {
        modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        systemPrompt: prompt,
        temperature: config?.temperature || 0.7,
        maxTokens: config?.maxTokens || 4000,
        sessionId: config?.sessionId,
        userId: config?.userId,
        agentId: config?.agentId,
        collectionNames: config?.collectionNames || [],
        allowedTools: config?.allowedTools,
        maxIterations: 5
    };
    const langgraphAgent = await (0, simpleLanggraphAgent_1.createSimpleLangGraphAgent)(agentConfig);
    return {
        async run(messages, options) {
            console.log(`🤖 LangGraph Agent.run called with ${messages.length} messages`);
            console.log(`🤖 Last message: ${messages[messages.length - 1]?.content.substring(0, 50)}...`);
            console.log(`🤖 Images for multimodal: ${options?.images?.length || 0}`);
            try {
                if (options?.images && options.images.length > 0 && options.images.some(img => img.base64Data)) {
                    console.log(`🤖 Using multimodal approach with ${options.images.length} images`);
                    const lastUserMessage = messages.slice().reverse().find((msg) => msg.role === 'user');
                    if (lastUserMessage) {
                        const messageId = Math.random().toString(36).substr(2, 9);
                        if (options.onEvent) {
                            options.onEvent({
                                type: 'assistant_created',
                                data: { messageId, content: '' }
                            });
                        }
                        const response = await llm.generate(lastUserMessage.content, options.images);
                        if (options.onEvent && response) {
                            const words = response.split(' ');
                            for (let i = 0; i < words.length; i++) {
                                const chunk = (i > 0 ? ' ' : '') + words[i];
                                options.onEvent({
                                    type: 'chunk',
                                    data: { messageId, delta: chunk }
                                });
                                await new Promise(resolve => setTimeout(resolve, 30));
                            }
                            options.onEvent({
                                type: 'end',
                                data: {
                                    messageId,
                                    answer: response,
                                    inputTokens: 0,
                                    outputTokens: 0
                                }
                            });
                        }
                        return response;
                    }
                }
                return await langgraphAgent.run(messages, options);
            }
            catch (error) {
                console.error('❌ Error in LangGraph Agent:', error);
                throw error;
            }
            finally {
                console.log('🧹 LangGraph Agent execution completed');
            }
        },
        getState: () => langgraphAgent.getState(),
        visualize: () => langgraphAgent.visualize()
    };
}
//# sourceMappingURL=agentFactory.js.map