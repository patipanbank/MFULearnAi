/**
 * สร้าง prompt template สำหรับ agent (เหมือน backend-legacy/agents/prompt_factory.py)
 * - รองรับ message placeholder, system prompt, user/assistant message
 */

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