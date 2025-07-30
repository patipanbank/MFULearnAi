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
            try {
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