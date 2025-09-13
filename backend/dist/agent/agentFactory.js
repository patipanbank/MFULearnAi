"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = exports.agentFactory = void 0;
exports.createAgent = createAgent;
const ToolRegistry_1 = require("./tools/ToolRegistry");
const AgentFactory_1 = require("./core/AgentFactory");
async function createAgent(llm, customTools = {}, prompt, config) {
    console.log(`🤖 Creating Agent (Legacy API) with prompt: ${prompt.substring(0, 50)}...`);
    const sessionId = config?.sessionId || 'default';
    const allTools = {
        ...ToolRegistry_1.toolRegistry.getStaticTools(),
        ...ToolRegistry_1.toolRegistry.createMemoryTools(sessionId),
        ...customTools
    };
    console.log(`🛠️ Total tools available: ${Object.keys(allTools).length}`);
    const newExecutor = await AgentFactory_1.agentFactory.createAgent(llm, allTools, prompt, {
        modelId: config?.modelId,
        sessionId,
        temperature: config?.temperature,
        maxTokens: config?.maxTokens
    });
    return {
        async run(messages, options) {
            console.log(`🤖 Legacy Agent Wrapper.run called`);
            const agentMessages = messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            return await newExecutor.run(agentMessages, {
                onEvent: options?.onEvent,
                maxSteps: options?.maxSteps,
                images: options?.images
            });
        }
    };
}
var AgentFactory_2 = require("./core/AgentFactory");
Object.defineProperty(exports, "agentFactory", { enumerable: true, get: function () { return AgentFactory_2.agentFactory; } });
var ToolRegistry_2 = require("./tools/ToolRegistry");
Object.defineProperty(exports, "toolRegistry", { enumerable: true, get: function () { return ToolRegistry_2.toolRegistry; } });
//# sourceMappingURL=agentFactory.js.map