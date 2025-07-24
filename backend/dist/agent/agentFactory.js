"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = createAgent;
function createAgent(llm, tools, prompt) {
    return {
        async run(messages) {
            const fullPrompt = [prompt, ...messages.map(m => `${m.role}: ${m.content}`)].join('\n');
            return llm.generate(fullPrompt);
        }
    };
}
//# sourceMappingURL=agentFactory.js.map