import { LLM } from './llmFactory';
import { ToolFunction } from '../services/toolRegistry';

export interface AgentExecutor {
  run: (messages: { role: string; content: string }[]) => Promise<string>;
}

/**
 * สร้าง AgentExecutor (เหมือน backend-legacy agent_factory.py)
 * - รับ LLM instance, tools, prompt
 * - คืน executor ที่สามารถ run agent graph ได้ (เรียก LLM + tools + prompt)
 */
export function createAgent(
  llm: LLM,
  tools: { [name: string]: ToolFunction },
  prompt: string
): AgentExecutor {
  return {
    async run(messages: { role: string; content: string }[]): Promise<string> {
      // รวม prompt + history
      const fullPrompt = [prompt, ...messages.map(m => `${m.role}: ${m.content}`)].join('\n');
      // (ใน legacy จะมี logic tool calling/agent graph จริง)
      // ที่นี่เรียก LLM ตรง ๆ (สามารถขยาย logic graph/tool ได้ในอนาคต)
      return llm.generate(fullPrompt);
    }
  };
} 