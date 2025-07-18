"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrompt = buildPrompt;
const prompts_1 = require("@langchain/core/prompts");
function buildPrompt(systemPrompt) {
    return prompts_1.ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        new prompts_1.MessagesPlaceholder('chat_history'),
        ['human', '{input}'],
        ['assistant', '{agent_scratchpad}'],
    ]);
}
//# sourceMappingURL=promptFactory.js.map