import { LLM } from './llmFactory';
import { ToolFunction } from '../services/toolRegistry';
import { createLangChainAgent, LangChainAgentConfig } from './langchainAgentFactory';

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
 * createAgent (agentFactory): สร้าง AgentExecutor สำหรับ orchestrate LLM + tools + prompt
 * - ใช้ LangChain Agent framework เต็มรูปแบบ
 * - ยังคง API interface เดิมไว้
 * - เพิ่มการรองรับ multimodal (รูปภาพ)
 */
export async function createAgent(
  llm: LLM,
  tools: { [name: string]: ToolFunction },
  prompt: string,
  config?: {
    modelId?: string;
    sessionId?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AgentExecutor> {
  console.log(`🤖 Creating LangChain Agent with prompt: ${prompt.substring(0, 50)}...`);
  
  // สร้าง LangChain Agent config
  const agentConfig: LangChainAgentConfig = {
    modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    systemPrompt: prompt,
    temperature: config?.temperature || 0.7,
    maxTokens: config?.maxTokens || 4000,
    tools,
    sessionId: config?.sessionId
  };
  
  // สร้าง LangChain Agent
  const langchainAgent = await createLangChainAgent(agentConfig);
  
  return {
    async run(messages: { role: string; content: string }[], options?: { 
      onEvent?: (event: { type: string; data?: any }) => void; 
      maxSteps?: number;
      images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
    }): Promise<string> {
      console.log(`🤖 LangChain Agent.run called with ${messages.length} messages`);
      console.log(`🤖 Last message: ${messages[messages.length - 1]?.content.substring(0, 50)}...`);
      console.log(`🤖 Images for multimodal: ${options?.images?.length || 0}`);
      
      try {
        // ตรวจสอบว่าต้องใช้ multimodal หรือไม่
        if (options?.images && options.images.length > 0 && options.images.some(img => img.base64Data)) {
          console.log(`🤖 Using multimodal approach with ${options.images.length} images`);

          // ใช้ multimodal LLM โดยตรงพร้อม streaming events
          const lastUserMessage = messages.slice().reverse().find((msg: { role: string; content: string }) => msg.role === 'user');
          if (lastUserMessage) {
            // สร้าง messageId ที่จะใช้ตลอดการ stream
            const messageId = Math.random().toString(36).substr(2, 9);

            // ส่ง assistant_created event ก่อน
            if (options.onEvent) {
              options.onEvent({
                type: 'assistant_created',
                data: {
                  messageId: messageId,
                  content: ''
                }
              });
            }

            const response = await llm.generate(lastUserMessage.content, options.images);

            // จำลอง streaming โดยส่งทีละคำ
            if (options.onEvent && response) {
              const words = response.split(' ');
              for (let i = 0; i < words.length; i++) {
                const chunk = (i > 0 ? ' ' : '') + words[i];
                options.onEvent({
                  type: 'chunk',
                  data: {
                    messageId: messageId,
                    delta: chunk
                  }
                });
                // เพิ่ม delay เล็กน้อยเพื่อให้ดู streaming
                await new Promise(resolve => setTimeout(resolve, 30));
              }

              // ส่ง end event
              options.onEvent({
                type: 'end',
                data: {
                  messageId: messageId,
                  answer: response,
                  inputTokens: 0,
                  outputTokens: 0
                }
              });
            }

            return response;
          }
        }
        
        // ใช้ LangChain Agent แบบเดิม
        return await langchainAgent.run(messages, options);
      } catch (error) {
        console.error('❌ Error in LangChain Agent:', error);
        throw error;
      }
    }
  };
} 