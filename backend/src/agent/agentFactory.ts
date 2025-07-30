import { LLM } from './llmFactory';
import { ToolFunction } from '../services/toolRegistry';

export interface AgentExecutor {
  run: (
    messages: { role: string; content: string }[],
    options?: {
      onEvent?: (event: { type: string; data?: any }) => void;
      maxSteps?: number;
    }
  ) => Promise<string>;
}

/**
 * Agent graph (ReAct/function-calling loop) ที่รองรับ tool calling จริง
 * - รับ LLM, tools, prompt
 * - วน loop: ส่ง prompt+history ให้ LLM → ถ้า LLM ตอบว่าให้ใช้ tool → execute tool → ส่งผลลัพธ์กลับเข้า LLM → repeat จนได้ final answer
 * - รองรับ event streaming (tool_start, tool_result, chunk, end) ผ่าน callback
 */
/**
 * createAgent (agentFactory): สร้าง AgentExecutor สำหรับ orchestrate LLM + tools + prompt (ไม่ใช่ data CRUD)
 * - ใช้สำหรับ agent graph, tool calling, event streaming เท่านั้น
 * - ไม่เกี่ยวกับ agentService.createAgent (data CRUD)
 */
export function createAgent(
  llm: LLM,
  tools: { [name: string]: ToolFunction },
  prompt: string
): AgentExecutor {
  return {
    async run(messages: { role: string; content: string }[], options?: { onEvent?: (event: { type: string; data?: any }) => void; maxSteps?: number }): Promise<string> {
      const onEvent = options?.onEvent;
      const maxSteps = options?.maxSteps ?? 5;
      let history = [...messages];
      let scratchpad: string[] = [];
      let finalAnswer = '';
      for (let step = 0; step < maxSteps; step++) {
        // 1. สร้าง fullPrompt (system + history + scratchpad)
        const fullPrompt = [
          prompt,
          ...history.map(m => `${m.role}: ${m.content}`),
          ...(scratchpad.length ? ['\nAgent scratchpad:', ...scratchpad] : [])
        ].join('\n');
        // 2. เรียก LLM
        const llmResponse = await llm.generate(fullPrompt);
        if (onEvent) onEvent({ type: 'chunk', data: llmResponse });
        // 3. ตรวจสอบว่า LLM ตอบว่าให้ใช้ tool หรือไม่ (เช่น [TOOL:tool_name] input)
        const toolMatch = llmResponse.match(/\[TOOL:(\w+)\](.*)/s);
        if (toolMatch) {
          const toolName = toolMatch[1];
          const toolInput = toolMatch[2]?.trim() || '';
          if (onEvent) onEvent({ type: 'tool_start', data: { tool_name: toolName, tool_input: toolInput } });
          const toolFn = tools[toolName];
          let toolResult = '';
          // ดึง sessionId จาก options หรือ messages (เช่น messages[0].sessionId หรือ options?.sessionId)
          const sessionId = (options as any)?.sessionId || (messages as any)?.sessionId || '';
          const config = (options as any)?.config || undefined;
          if (toolFn) {
            try {
              toolResult = await toolFn(toolInput, sessionId, config);
              if (onEvent) onEvent({ type: 'tool_result', data: { tool_name: toolName, output: toolResult } });
            } catch (e) {
              toolResult = `Tool error: ${(e as Error).message}`;
              if (onEvent) onEvent({ type: 'tool_error', data: { tool_name: toolName, error: toolResult } });
            }
          } else {
            toolResult = `Tool not found: ${toolName}`;
            if (onEvent) onEvent({ type: 'tool_error', data: { tool_name: toolName, error: toolResult } });
          }
          // 4. เพิ่ม scratchpad และ history
          scratchpad.push(`\n[TOOL:${toolName}] ${toolInput}\n[RESULT:${toolName}] ${toolResult}`);
          history.push({ role: 'function', content: `[${toolName} result]: ${toolResult}` });
          continue; // วน loop ต่อ
        } else {
          // ถ้าไม่มี tool calling ให้ถือว่าเป็น final answer
          finalAnswer = llmResponse;
          break;
        }
      }
      if (onEvent) onEvent({ type: 'end', data: { answer: finalAnswer } });
      return finalAnswer;
    }
  };
} 