"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = createAgent;
const agents_1 = require("langchain/agents");
function createAgent(llm, tools, prompt) {
    const agent = (0, agents_1.createToolCallingAgent)({
        llm,
        tools,
        prompt,
    });
    return new agents_1.AgentExecutor({
        agent,
        tools,
        verbose: true,
    });
}
//# sourceMappingURL=agentFactory.js.map