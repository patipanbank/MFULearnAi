import type { LLM } from './llmFactory';
import { toolRegistry } from './tools/ToolRegistry';
import { agentFactory as newAgentFactory } from './core/AgentFactory';
import type { AgentExecutor as NewAgentExecutor } from './core/AgentExecutor';

export interface AgentExecutor {
  run: (
    messages: { role: string; content: string }[],
    options?: {
      onEvent?: (event: { type: string; data?: any }) => void;
      maxSteps?: number;
      images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
    }
  ) => Promise<string>;
}

/**
 * createAgent (Legacy API): Wrapper ที่ใช้ระบบใหม่
 * - Backward compatibility สำหรับ API เดิม
 * - ใช้ AgentFactory และ ToolRegistry ใหม่
 * - รองรับ multimodal เหมือนเดิม
 */
export async function createAgent(
  llm: LLM,
  customTools: { [name: string]: any } = {},
  prompt: string,
  config?: {
    modelId?: string;
    sessionId?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AgentExecutor> {
  console.log(`🤖 Creating Agent (Legacy API) with prompt: ${prompt.substring(0, 50)}...`);
  
  const sessionId = config?.sessionId || 'default';
  
  // รวม tools: static + session-specific + custom
  const allTools = {
    ...toolRegistry.getStaticTools(),
    ...toolRegistry.createMemoryTools(sessionId),
    ...customTools
  };
  
  console.log(`🛠️ Total tools available: ${Object.keys(allTools).length}`);
  
  // สร้าง agent ผ่าน new AgentFactory
  const newExecutor: NewAgentExecutor = await newAgentFactory.createAgent(
    llm,
    allTools,
    prompt,
    {
      modelId: config?.modelId,
      sessionId,
      temperature: config?.temperature,
      maxTokens: config?.maxTokens
    }
  );
  
  // Wrapper เพื่อ compatibility
  return {
    async run(messages: { role: string; content: string }[], options?: { 
      onEvent?: (event: { type: string; data?: any }) => void; 
      maxSteps?: number;
      images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
    }): Promise<string> {
      console.log(`🤖 Legacy Agent Wrapper.run called`);
      
      // แปลง messages format
      const agentMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // ส่งต่อไปยัง new executor
      return await newExecutor.run(agentMessages, {
        onEvent: options?.onEvent,
        maxSteps: options?.maxSteps,
        images: options?.images
      });
    }
  };
}

// Export new factory สำหรับการใช้งานใหม่
export { agentFactory } from './core/AgentFactory';
export { toolRegistry } from './tools/ToolRegistry'; 