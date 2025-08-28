"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPromptTemplate = createPromptTemplate;
exports.createLangChainPromptTemplate = createLangChainPromptTemplate;
exports.createAgentPromptTemplate = createAgentPromptTemplate;
exports.createLegacySystemPrompt = createLegacySystemPrompt;
exports.createLegacyChatPromptTemplate = createLegacyChatPromptTemplate;
const prompts_1 = require("@langchain/core/prompts");
const prompts_2 = require("@langchain/core/prompts");
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
function createLegacySystemPrompt(basePrompt) {
    const defaultPrompt = "You are a helpful AI assistant with access to various tools. Think step by step and use tools when needed to provide accurate, helpful responses.";
    const systemPrompt = basePrompt || defaultPrompt;
    return `${systemPrompt}

THINKING PROCESS:
Before responding, always think:
1. What is the user asking?
2. What information do I need?
3. Which tools should I use?
4. How should I structure my response?

TOOL USAGE RULES:
1. MUST use web_search for current events, recent information, or fact-checking
2. MUST use calculator for any mathematical calculations
3. MUST use memory tools to maintain conversation context
4. MUST use knowledge_search for domain-specific information
5. Always explain why you're using a tool
6. If a tool fails, try alternative approaches

TOOL DESCRIPTIONS:
- web_search: Get current information from the internet (input: search query)
- calculator: Perform mathematical calculations (input: expression like "2+2" or "sqrt(16)")
- current_date: Get current date and time (no input needed)
- memory_search: Search previous conversation (input: search terms)
- memory_embed: Store important information (input: information to remember)
- knowledge_search: Search knowledge base (input: search query)

RESPONSE GUIDELINES:
- Think out loud - show your reasoning
- Use tools proactively, don't just say you will use them
- Cite sources when using external information
- If unsure, ask clarifying questions
- Provide structured, clear answers

CRITICAL: Don't guess or make assumptions. Use tools to get accurate information.`;
}
function createLegacyChatPromptTemplate(systemPrompt) {
    const finalSystemPrompt = createLegacySystemPrompt(systemPrompt);
    return prompts_2.ChatPromptTemplate.fromMessages([
        ["system", finalSystemPrompt],
        ["human", "Question: {input}\nThought: {agent_scratchpad}"]
    ]);
}
//# sourceMappingURL=promptFactory.js.map