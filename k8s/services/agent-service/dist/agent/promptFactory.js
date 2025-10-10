"use strict";
/**
 * สร้าง prompt template สำหรับ agent (เหมือน backend-legacy/agents/prompt_factory.py)
 * - รองรับ message placeholder, system prompt, user/assistant message
 * - ใช้ LangChain PromptTemplate
 * - เพิ่ม tool instructions แบบ legacy
 */
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
        // Current question
        const last = messages[messages.length - 1];
        if (last) {
            prompt += `Current question: ${last.content}\n`;
        }
        // Agent scratchpad (tool reasoning)
        if (scratchpad && scratchpad.length) {
            prompt += `\nAgent scratchpad:\n` + scratchpad.join('\n');
        }
        return prompt.trim();
    };
}
/**
 * สร้าง LangChain PromptTemplate สำหรับ agent
 * - ใช้ LangChain PromptTemplate แทนการสร้าง prompt string เอง
 * - รองรับ system prompt, history, และ scratchpad
 */
function createLangChainPromptTemplate(systemPrompt, useHistory = true) {
    let template = '';
    if (systemPrompt) {
        template += `System: ${systemPrompt}\n\nIMPORTANT: The chat history below is context from previous conversations. Use this context to provide better responses, but only answer the current user's question. Do not repeat or respond to previous questions in the history.\n`;
    }
    if (useHistory) {
        template += `{history}\n`;
    }
    template += `Current question: {input}\n`;
    // Agent scratchpad (tool reasoning)
    template += `{scratchpad}`;
    return prompts_1.PromptTemplate.fromTemplate(template);
}
/**
 * สร้าง prompt template สำหรับ LangChain Agent (เหมือน Legacy)
 * - ใช้ format ที่เหมาะสมกับ LangChain Agent
 * - เพิ่ม tool instructions แบบ legacy
 */
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
/**
 * สร้าง system prompt แบบ legacy (เหมือน backend-legacy)
 * - รวม tool instructions
 * - รองรับ hybrid memory management
 */
function createLegacySystemPrompt(basePrompt) {
    const defaultPrompt = "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.";
    const systemPrompt = basePrompt || defaultPrompt;
    return `${systemPrompt}

IMPORTANT INSTRUCTIONS:
1. If the user asks you to search for information, you MUST use the web_search tool
2. If the user asks for calculations, use the calculator tool
3. If you need to recall previous conversation context, use memory tools
4. Always use the appropriate tool when needed - do not try to answer without tools
5. When using web_search, provide the search query as input
6. When using calculator, provide the mathematical expression as input
7. When using knowledge base search, provide the search query as input
8. Use memory tools to maintain conversation context across long conversations
9. Hybrid memory management: Redis for recent messages, Vectorstore for long-term storage

Available tools:
- web_search: Search the web for current information
- calculator: Perform mathematical calculations
- current_date: Get current date and time
- memory_search: Search conversation memory
- memory_embed: Store information in memory
- Various session-specific memory tools
- Knowledge base search tools

Please provide clear, helpful responses to user questions.`;
}
/**
 * สร้าง ChatPromptTemplate สำหรับ LangChain Agent (เหมือน Legacy)
 * - ใช้ format ที่เหมาะสมกับ LangChain Agent
 * - รองรับ hybrid memory management
 */
function createLegacyChatPromptTemplate(systemPrompt) {
    const finalSystemPrompt = createLegacySystemPrompt(systemPrompt);
    return prompts_2.ChatPromptTemplate.fromMessages([
        ["system", finalSystemPrompt],
        ["human", "Question: {input}\nThought: {agent_scratchpad}"]
    ]);
}
//# sourceMappingURL=promptFactory.js.map