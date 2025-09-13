"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentFactory = exports.AgentFactory = void 0;
const AgentExecutor_1 = require("./AgentExecutor");
const AgentCache_1 = require("./AgentCache");
class AgentFactory {
    constructor() {
        this.cache = new AgentCache_1.AgentCache();
        console.log('✅ Agent factory initialized');
    }
    async createAgent(llm, tools, prompt, config) {
        const agentConfig = {
            modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            sessionId: config?.sessionId || 'default',
            temperature: config?.temperature ?? 0.7,
            maxTokens: config?.maxTokens ?? 4000,
            systemPrompt: prompt,
            toolNames: Object.keys(tools).sort()
        };
        const cacheKey = {
            modelId: agentConfig.modelId,
            systemPrompt: agentConfig.systemPrompt,
            toolNames: agentConfig.toolNames,
            temperature: agentConfig.temperature,
            maxTokens: agentConfig.maxTokens
        };
        const cached = this.cache.get(agentConfig.sessionId, cacheKey);
        if (cached) {
            console.log(`⚡ Reusing cached agent for session ${agentConfig.sessionId}`);
            return cached;
        }
        console.log(`🤖 Creating new agent for session ${agentConfig.sessionId}`);
        const executor = new AgentExecutor_1.AgentExecutor(llm, tools, agentConfig);
        await executor.initialize();
        this.cache.set(agentConfig.sessionId, cacheKey, executor);
        return executor;
    }
    clearSessionCache(sessionId) {
        this.cache.clearSession(sessionId);
    }
    clearAllCache() {
        this.cache.clearAll();
    }
    getCacheStats() {
        return this.cache.getStats();
    }
}
exports.AgentFactory = AgentFactory;
exports.agentFactory = new AgentFactory();
//# sourceMappingURL=AgentFactory.js.map