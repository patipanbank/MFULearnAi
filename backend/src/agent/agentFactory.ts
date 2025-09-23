import { LLM } from './llmFactory';
import { ToolFunction } from '../services/toolRegistry';
import { createLangChainAgent, LangChainAgentConfig } from './langchainAgentFactory';
import { unifiedToolRegistry, ToolExecutionContext, ToolConfig } from '../services/unifiedToolRegistry';

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
    collectionNames?: string[];
    userId?: string;
    agentId?: string;
    allowedTools?: string[]; // รายการ tools ที่ agent ใช้ได้
  }
): Promise<AgentExecutor> {
  console.log(`🤖 Creating LangChain Agent with prompt: ${prompt.substring(0, 50)}...`);

  // Setup execution context for unified tool registry
  const toolContext: ToolExecutionContext = {
    sessionId: config?.sessionId,
    userId: config?.userId,
    agentId: config?.agentId,
    collectionNames: config?.collectionNames || [],
    config: config
  };

  // Get available tools from unified registry
  let availableTools = unifiedToolRegistry.getAvailableTools(toolContext);

  // Filter tools based on agent configuration
  if (config?.allowedTools && config.allowedTools.length > 0) {
    console.log(`🔧 Filtering tools to allowed list: ${config.allowedTools.join(', ')}`);
    availableTools = availableTools.filter(tool =>
      config.allowedTools!.includes(tool.id) ||
      config.allowedTools!.includes(tool.name.toLowerCase().replace(/\s+/g, '_'))
    );
  }

  // Create session-specific tools if sessionId provided
  if (config?.sessionId) {
    unifiedToolRegistry.createSessionTools(config.sessionId);
  }

  // Create collection-specific tools if collections provided
  if (config?.collectionNames && config.collectionNames.length > 0) {
    unifiedToolRegistry.createCollectionTools(config.collectionNames);
  }

  // Convert unified tools to legacy format for compatibility
  const unifiedTools = convertUnifiedToolsToLegacy(availableTools, toolContext);

  // Merge with existing tools (legacy compatibility) - also filter legacy tools
  let filteredLegacyTools = tools;
  if (config?.allowedTools && config.allowedTools.length > 0) {
    filteredLegacyTools = {};
    for (const [toolName, toolFunc] of Object.entries(tools)) {
      if (config.allowedTools.includes(toolName) ||
          config.allowedTools.includes(toolName.toLowerCase().replace(/\s+/g, '_'))) {
        filteredLegacyTools[toolName] = toolFunc;
      }
    }
  }

  const allTools = { ...filteredLegacyTools, ...unifiedTools };

  console.log(`🔧 Total tools available: ${Object.keys(allTools).length}`);
  console.log(`🔧 Tools: ${Object.keys(allTools).join(', ')}`);

  if (config?.allowedTools && config.allowedTools.length > 0) {
    console.log(`✅ Tools are filtered by agent configuration`);
  } else {
    console.log(`⚠️ No tool filtering applied - agent will have access to ALL tools`);
  }

  // สร้าง LangChain Agent config
  const agentConfig: LangChainAgentConfig = {
    modelId: config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    systemPrompt: prompt,
    temperature: config?.temperature || 0.7,
    maxTokens: config?.maxTokens || 4000,
    tools: allTools,
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
      } finally {
        // Cleanup session tools if this was the final execution
        if (config?.sessionId) {
          // Note: In production, you might want to cleanup tools when session ends
          // unifiedToolRegistry.cleanupSessionTools(config.sessionId);
        }
      }
    }
  };
}

/**
 * Convert unified tools to legacy format for backward compatibility
 */
function convertUnifiedToolsToLegacy(
  toolConfigs: ToolConfig[],
  context: ToolExecutionContext
): { [name: string]: ToolFunction } {
  const legacyTools: { [name: string]: ToolFunction } = {};

  for (const config of toolConfigs) {
    legacyTools[config.id] = async (input: string, sessionId?: string, legacyConfig?: any): Promise<string> => {
      try {
        const result = await unifiedToolRegistry.executeTool(config.id, input, {
          ...context,
          sessionId: sessionId || context.sessionId,
          config: { ...context.config, ...legacyConfig }
        });

        if (result.success) {
          return result.result;
        } else {
          return result.error || 'Tool execution failed';
        }
      } catch (error) {
        return `Tool error: ${(error as Error).message}`;
      }
    };
  }

  return legacyTools;
} 