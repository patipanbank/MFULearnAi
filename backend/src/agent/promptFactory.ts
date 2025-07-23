/**
 * สร้าง prompt template สำหรับ agent (เหมือน backend-legacy/agents/prompt_factory.py)
 * - รองรับ message placeholder, system prompt, user/assistant message
 */

export function createPromptTemplate(systemPrompt: string, useHistory: boolean = true): (messages: { role: string; content: string }[]) => string {
  return (messages: { role: string; content: string }[]) => {
    let prompt = systemPrompt ? `System: ${systemPrompt}\n` : '';
    if (useHistory) {
      for (const msg of messages) {
        prompt += `${msg.role}: ${msg.content}\n`;
      }
    } else {
      const last = messages[messages.length - 1];
      if (last) prompt += `${last.role}: ${last.content}\n`;
    }
    return prompt.trim();
  };
} 