"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = createAgent;
const langchainAgentFactory_1 = require("./langchainAgentFactory");
async function createAgent(llm, tools, prompt, config) {
    console.log(`🤖 Creating LangChain Agent with prompt: ${prompt.substring(0, 50)}...`);
    const agentConfig = {
        modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        systemPrompt: prompt,
        temperature: config?.temperature || 0.7,
        maxTokens: config?.maxTokens || 4000,
        tools,
        sessionId: config?.sessionId
    };
    const langchainAgent = await (0, langchainAgentFactory_1.createLangChainAgent)(agentConfig);
    return {
        async run(messages, options) {
            console.log(`🤖 LangChain Agent.run called with ${messages.length} messages`);
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
                                data: {
                                    messageId: messageId,
                                    content: ''
                                }
                            });
                        }
                        const response = await llm.generate(lastUserMessage.content, options.images);
                        if (options.onEvent && response) {
                            const words = response.split(' ');
                            for (let i = 0; i < words.length; i++) {
                                const chunk = (i > 0 ? ' ' : '') + words[i];
                                options.onEvent({
                                    type: 'chunk',
                                    data: {
                                        messageId: messageId,
                                        delta: chunk
                                    }
                                });
                                await new Promise(resolve => setTimeout(resolve, 30));
                            }
                            options.onEvent({
                                type: 'end',
                                data: {
                                    messageId: messageId,
                                    answer: response,
                                    inputTokens: 0,
                                    outputTokens: 0
                                }
                            });
                        }
                        return response;
                    }
                }
                return await langchainAgent.run(messages, options);
            }
            catch (error) {
                console.error('❌ Error in LangChain Agent:', error);
                throw error;
            }
        }
    };
}
//# sourceMappingURL=agentFactory.js.map