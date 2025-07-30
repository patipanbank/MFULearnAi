"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPromptTemplate = createPromptTemplate;
function createPromptTemplate(systemPrompt, useHistory = true) {
    return (messages, scratchpad) => {
        let prompt = '';
        if (systemPrompt) {
            prompt += `System: ${systemPrompt}\n\nIMPORTANT: The chat history below is context from previous conversations. Use this context to provide better responses, but only answer the current user's question. Do not repeat or respond to previous questions in the history.\n`;
        }
        if (useHistory && messages.length > 1) {
            for (let i = 0; i < messages.length - 1; i++) {
                prompt += `${messages[i].role}: ${messages[i].content}\n`;
            }
        }
        const last = messages[messages.length - 1];
        if (last) {
            prompt += `Current question: ${last.content}\n`;
        }
        if (scratchpad && scratchpad.length) {
            prompt += `\nAgent scratchpad:\n` + scratchpad.join('\n');
        }
        return prompt.trim();
    };
}
//# sourceMappingURL=promptFactory.js.map