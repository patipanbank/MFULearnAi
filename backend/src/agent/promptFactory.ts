/**
 * สร้าง prompt template สำหรับ agent (เหมือน backend-legacy/agents/prompt_factory.py)
 * - รองรับ message placeholder, system prompt, user/assistant message
 * - ใช้ LangChain PromptTemplate
 */

import { PromptTemplate } from '@langchain/core/prompts';

export function createPromptTemplate(systemPrompt: string, useHistory: boolean = true): (messages: { role: string; content: string }[], scratchpad?: string[]) => string {
  return (messages: { role: string; content: string }[], scratchpad?: string[]) => {
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
export function createLangChainPromptTemplate(systemPrompt: string, useHistory: boolean = true): PromptTemplate {
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
  
  return PromptTemplate.fromTemplate(template);
}

/**
 * สร้าง prompt template สำหรับ LangChain Agent
 * - ใช้ format ที่เหมาะสมกับ LangChain Agent
 */
export function createAgentPromptTemplate(systemPrompt: string): PromptTemplate {
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

  return PromptTemplate.fromTemplate(template);
} 