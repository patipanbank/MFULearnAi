"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentExecutor = void 0;
const langchainAgentFactory_1 = require("../langchainAgentFactory");
class AgentExecutor {
    constructor(llm, tools, config) {
        this.initialized = false;
        this.llm = llm;
        this.tools = tools;
        this.config = config;
    }
    async initialize() {
        if (this.initialized)
            return;
        console.log(`🤖 Initializing AgentExecutor with model: ${this.config.modelId}`);
        const agentConfig = {
            modelId: this.config.modelId,
            systemPrompt: this.config.systemPrompt,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            tools: this.tools,
            sessionId: this.config.sessionId
        };
        this.langchainAgent = await (0, langchainAgentFactory_1.createLangChainAgent)(agentConfig);
        this.initialized = true;
        console.log(`✅ AgentExecutor initialized for session: ${this.config.sessionId}`);
    }
    async run(messages, options) {
        if (!this.initialized) {
            await this.initialize();
        }
        console.log(`🤖 AgentExecutor.run called with ${messages.length} messages`);
        console.log(`🤖 Last message: ${messages[messages.length - 1]?.content.substring(0, 50)}...`);
        console.log(`🤖 Images for multimodal: ${options?.images?.length || 0}`);
        try {
            if (this.shouldUseMultimodal(options?.images)) {
                console.log(`🤖 Using multimodal approach with ${options.images.length} images`);
                return await this.runMultimodal(messages, options.images);
            }
            return await this.langchainAgent.run(messages, options);
        }
        catch (error) {
            console.error('❌ Error in AgentExecutor:', error);
            throw error;
        }
    }
    shouldUseMultimodal(images) {
        return !!(images && images.length > 0 && images.some(img => img.base64Data));
    }
    async runMultimodal(messages, images) {
        const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user');
        if (!lastUserMessage) {
            throw new Error('No user message found for multimodal processing');
        }
        const response = await this.llm.generate(lastUserMessage.content, images);
        return response;
    }
    getConfig() {
        return { ...this.config };
    }
    isInitialized() {
        return this.initialized;
    }
    dispose() {
        this.initialized = false;
        console.log(`🗑️ AgentExecutor disposed for session: ${this.config.sessionId}`);
    }
}
exports.AgentExecutor = AgentExecutor;
//# sourceMappingURL=AgentExecutor.js.map