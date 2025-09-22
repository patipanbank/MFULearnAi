import { LLM } from './llmFactory';
import { ToolFunction } from '../services/toolRegistry';
import { createSimpleLangGraphAgent, SimpleLangGraphConfig } from './simpleLanggraphAgent';
import { unifiedToolRegistry, ToolExecutionContext, ToolConfig } from '../services/unifiedToolRegistry';
import { createLangMemTools, createLegacyLangMemTools } from '../services/langmemTools';

export interface AgentExecutor {
  run: (
    messages: { role: string; content: string }[],
    options?: {
      onEvent?: (event: { type: string; data?: any }) => void;
      maxSteps?: number;
      images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
    }
  ) => Promise<string>;
  getState?: () => any;
  visualize?: () => string;
}

/**
 * createAgent (agentFactory): สร้าง AgentExecutor สำหรับ orchestrate LLM + tools + prompt
 * - ใช้ LangGraph framework สำหรับ stateful workflow
 * - ยังคง API interface เดิมไว้
 * - เพิ่มการรองรับ multimodal (รูปภาพ)
 * - เพิ่ม state management และ better debugging
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
    collectionNames?: string[];
    userId?: string;
    agentId?: string;
    allowedTools?: string[]; // รายการ tools ที่ agent ใช้ได้
  }
): Promise<AgentExecutor> {
  console.log(`🤖 Creating LangGraph Agent with prompt: ${prompt.substring(0, 50)}...`);

  // Setup execution context for unified tool registry
  const toolContext: ToolExecutionContext = {
    sessionId: config?.sessionId,
    userId: config?.userId,
    agentId: config?.agentId,
    collectionNames: config?.collectionNames || [],
    config: config
  };

  // Create session-specific tools if sessionId provided
  if (config?.sessionId) {
    unifiedToolRegistry.createSessionTools(config.sessionId);
    await unifiedToolRegistry.createMemorySearchToolsIfNeeded(config.sessionId);
  }

  // Create collection-specific tools if collections provided
  if (config?.collectionNames && config.collectionNames.length > 0) {
    unifiedToolRegistry.createCollectionTools(config.collectionNames);
  }

  console.log(`🔧 Tool filtering: ${config?.allowedTools ? config.allowedTools.join(', ') : 'All tools allowed'}`);

  // Create Simple LangGraph Agent config
  const agentConfig: SimpleLangGraphConfig = {
    modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    systemPrompt: prompt,
    temperature: config?.temperature || 0.7,
    maxTokens: config?.maxTokens || 4000,
    sessionId: config?.sessionId,
    userId: config?.userId,
    agentId: config?.agentId,
    collectionNames: config?.collectionNames || [],
    allowedTools: config?.allowedTools,
    maxIterations: 5
  };

  // Create Simple LangGraph Agent
  const langgraphAgent = await createSimpleLangGraphAgent(agentConfig);
  
  return {
    async run(messages: { role: string; content: string }[], options?: {
      onEvent?: (event: { type: string; data?: any }) => void;
      maxSteps?: number;
      images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
    }): Promise<string> {
      console.log(`🤖 LangGraph Agent.run called with ${messages.length} messages`);
      console.log(`🤖 Last message: ${messages[messages.length - 1]?.content.substring(0, 50)}...`);
      console.log(`🤖 Images for multimodal: ${options?.images?.length || 0}`);

      try {
        // Handle multimodal case with direct LLM call
        if (options?.images && options.images.length > 0 && options.images.some(img => img.base64Data)) {
          console.log(`🤖 Using multimodal approach with ${options.images.length} images`);

          const lastUserMessage = messages.slice().reverse().find((msg: { role: string; content: string }) => msg.role === 'user');
          if (lastUserMessage) {
            const messageId = Math.random().toString(36).substr(2, 9);

            if (options.onEvent) {
              options.onEvent({
                type: 'assistant_created',
                data: { messageId, content: '' }
              });
            }

            const response = await llm.generate(lastUserMessage.content, options.images);

            if (options.onEvent && response) {
              const words = response.split(' ');
              for (let i = 0; i < words.length; i++) {
                const chunk = (i > 0 ? ' ' : '') + words[i];
                options.onEvent({
                  type: 'chunk',
                  data: { messageId, delta: chunk }
                });
                await new Promise(resolve => setTimeout(resolve, 30));
              }

              options.onEvent({
                type: 'end',
                data: {
                  messageId,
                  answer: response,
                  inputTokens: 0,
                  outputTokens: 0
                }
              });
            }

            return response;
          }
        }

        // Use LangGraph Agent for standard workflow
        return await langgraphAgent.run(messages, options);
      } catch (error) {
        console.error('❌ Error in LangGraph Agent:', error);
        throw error;
      } finally {
        // Cleanup handled by LangGraph state management
        console.log('🧹 LangGraph Agent execution completed');
      }
    },

    // Additional LangGraph specific methods
    getState: () => langgraphAgent.getState(),
    visualize: () => langgraphAgent.visualize()
  };
}

 