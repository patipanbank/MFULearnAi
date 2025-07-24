"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPromptTemplate = createPromptTemplate;
function createPromptTemplate(systemPrompt, useHistory = true) {
    return (messages) => {
        let prompt = systemPrompt ? `System: ${systemPrompt}\n` : '';
        if (useHistory) {
            for (const msg of messages) {
                prompt += `${msg.role}: ${msg.content}\n`;
            }
        }
        else {
            const last = messages[messages.length - 1];
            if (last)
                prompt += `${last.role}: ${last.content}\n`;
        }
        return prompt.trim();
    };
}
//# sourceMappingURL=promptFactory.js.map