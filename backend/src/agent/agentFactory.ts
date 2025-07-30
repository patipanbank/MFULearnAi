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
 * createAgent (agentFactory): สร้าง AgentExecutor สำหรับ orchestrate LLM + tools + prompt (ไม่ใช่ data CRUD)
 * - ใช้ LangChain LLM แทนการ implement เอง
 * - ยังคง API interface เดิมไว้
 */
export function createAgent(
  llm: LLM,
  tools: { [name: string]: ToolFunction },
  prompt: string
): AgentExecutor {
  return {
    async run(messages: { role: string; content: string }[], options?: { onEvent?: (event: { type: string; data?: any }) => void; maxSteps?: number }): Promise<string> {
      console.log(`🤖 Agent.run called with ${messages.length} messages`);
      console.log(`🤖 Last message: ${messages[messages.length - 1]?.content.substring(0, 50)}...`);
      
      const onEvent = options?.onEvent;
      const maxSteps = options?.maxSteps ?? 5;
      
      try {
        // ใช้ LangChain LLM แต่ implement ReAct loop เอง
        console.log(`🤖 Using LangChain LLM`);
        return runWithLangChainLLM(llm, tools, prompt, messages, options);
      } catch (error) {
        // Fallback ไปใช้ ReAct loop เดิม
        console.warn('LangChain LLM failed, falling back to original LLM:', error);
        return runWithReActLoop(llm, tools, prompt, messages, options);
      }
    }
  };
}

/**
 * ใช้ LangChain LLM แต่ implement ReAct loop เอง
 */
async function runWithLangChainLLM(
  llm: LLM,
  tools: { [name: string]: ToolFunction },
  prompt: string,
  messages: { role: string; content: string }[],
  options?: { onEvent?: (event: { type: string; data?: any }) => void; maxSteps?: number }
): Promise<string> {
  console.log(`🤖 runWithLangChainLLM called with ${messages.length} messages`);
  console.log(`🤖 Prompt: ${prompt.substring(0, 50)}...`);
  
  const onEvent = options?.onEvent;
  const maxSteps = options?.maxSteps ?? 5;
  let history = [...messages];
  let scratchpad: string[] = [];
  let finalAnswer = '';
  
  for (let step = 0; step < maxSteps; step++) {
    console.log(`🤖 Step ${step + 1}/${maxSteps}`);
    
    // 1. สร้าง fullPrompt (system + history + scratchpad)
    const fullPrompt = [
      prompt,
      ...history.map(m => `${m.role}: ${m.content}`),
      ...(scratchpad.length ? ['\nAgent scratchpad:', ...scratchpad] : [])
    ].join('\n');
    
    console.log(`🤖 Full prompt length: ${fullPrompt.length} characters`);
    
    // 2. เรียก LLM (ใช้ LangChain LLM ที่อยู่ใน llm instance)
    console.log(`🤖 Calling LLM.generate...`);
    const llmResponse = await llm.generate(fullPrompt);
    console.log(`🤖 LLM response: ${llmResponse.substring(0, 100)}...`);
    if (onEvent) onEvent({ type: 'chunk', data: llmResponse });
    
    // 3. ตรวจสอบว่า LLM ตอบว่าให้ใช้ tool หรือไม่ (เช่น [TOOL:tool_name] input)
    const toolMatch = llmResponse.match(/\[TOOL:(\w+)\](.*)/s);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const toolInput = toolMatch[2]?.trim() || '';
      if (onEvent) onEvent({ type: 'tool_start', data: { tool_name: toolName, tool_input: toolInput } });
      
      const toolFn = tools[toolName];
      let toolResult = '';
      
      // ดึง sessionId จาก options หรือ messages
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

/**
 * Fallback method ใช้ ReAct loop เดิม
 */
async function runWithReActLoop(
  llm: LLM,
  tools: { [name: string]: ToolFunction },
  prompt: string,
  messages: { role: string; content: string }[],
  options?: { onEvent?: (event: { type: string; data?: any }) => void; maxSteps?: number }
): Promise<string> {
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
      
      // ดึง sessionId จาก options หรือ messages
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