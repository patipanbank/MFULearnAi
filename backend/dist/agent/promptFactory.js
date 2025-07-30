"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPromptTemplate = createPromptTemplate;
exports.createLangChainPromptTemplate = createLangChainPromptTemplate;
exports.createAgentPromptTemplate = createAgentPromptTemplate;
const prompts_1 = require("@langchain/core/prompts");
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
function createLangChainPromptTemplate(systemPrompt, useHistory = true) {
    let template = '';
    if (systemPrompt) {
        template += `System: ${systemPrompt}\n\nIMPORTANT: The chat history below is context from previous conversations. Use this context to provide better responses, but only answer the current user's question. Do not repeat or respond to previous questions in the history.\n`;
    }
    if (useHistory) {
        template += `{history}\n`;
    }
    template += `Current question: {input}\n`;
    template += `{scratchpad}`;
    return prompts_1.PromptTemplate.fromTemplate(template);
}
function createAgentPromptTemplate(systemPrompt) {
    const template = `You are a helpful AI assistant. ${systemPrompt}

You have access to the following tools:
{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Question: {input}
Thought:{agent_scratchpad}`;
    return prompts_1.PromptTemplate.fromTemplate(template);
}
//# sourceMappingURL=promptFactory.js.map