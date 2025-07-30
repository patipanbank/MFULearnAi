import { LLM } from './llmFactory';
import { ToolFunction } from '../services/toolRegistry';
import { createLangChainAgent, LangChainAgentConfig } from './langchainAgentFactory';

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
 * createAgent (agentFactory): สร้าง AgentExecutor สำหรับ orchestrate LLM + tools + prompt
 * - ใช้ LangChain Agent framework เต็มรูปแบบ
 * - ยังคง API interface เดิมไว้
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
    async run(messages: { role: string; content: string }[], options?: { onEvent?: (event: { type: string; data?: any }) => void; maxSteps?: number }): Promise<string> {
      console.log(`🤖 LangChain Agent.run called with ${messages.length} messages`);
      console.log(`🤖 Last message: ${messages[messages.length - 1]?.content.substring(0, 50)}...`);
      
      try {
        // ใช้ LangChain Agent
        return await langchainAgent.run(messages, options);
      } catch (error) {
        console.error('❌ Error in LangChain Agent:', error);
        throw error;
      }
    }
  };
} 