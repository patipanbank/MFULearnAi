import type { LLM } from '../llmFactory';
import type { ToolFunction } from '../tools/ToolRegistry';
import { createLangChainAgent, LangChainAgentConfig } from '../langchainAgentFactory';
import type { AgentConfig, AgentExecutorOptions, AgentMessage } from './types/agent.types';

/**
 * AgentExecutor - รัน agent และจัดการ execution flow
 * - Wrapper around LangChain agent
 * - Multimodal support
 * - Event handling
 */
export class AgentExecutor {
  private llm: LLM;
  private tools: { [name: string]: ToolFunction };
  private config: Required<AgentConfig>;
  private langchainAgent: any;
  private initialized = false;

  constructor(
    llm: LLM,
    tools: { [name: string]: ToolFunction },
    config: Required<AgentConfig>
  ) {
    this.llm = llm;
    this.tools = tools;
    this.config = config;
  }

  /**
   * Initialize the executor
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log(`🤖 Initializing AgentExecutor with model: ${this.config.modelId}`);

    // สร้าง LangChain Agent config
    const agentConfig: LangChainAgentConfig = {
      modelId: this.config.modelId,
      systemPrompt: this.config.systemPrompt,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      tools: this.tools,
      sessionId: this.config.sessionId
    };

    // สร้าง LangChain Agent
    this.langchainAgent = await createLangChainAgent(agentConfig);
    this.initialized = true;

    console.log(`✅ AgentExecutor initialized for session: ${this.config.sessionId}`);
  }

  /**
   * รัน agent กับ messages
   */
  public async run(
    messages: AgentMessage[],
    options?: AgentExecutorOptions
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`🤖 AgentExecutor.run called with ${messages.length} messages`);
    console.log(`🤖 Last message: ${messages[messages.length - 1]?.content.substring(0, 50)}...`);
    console.log(`🤖 Images for multimodal: ${options?.images?.length || 0}`);

    try {
      // ตรวจสอบว่าต้องใช้ multimodal หรือไม่
      if (this.shouldUseMultimodal(options?.images)) {
        console.log(`🤖 Using multimodal approach with ${options!.images!.length} images`);
        return await this.runMultimodal(messages, options!.images!);
      }

      // ใช้ LangChain Agent แบบปกติ
      return await this.langchainAgent.run(messages, options);
    } catch (error) {
      console.error('❌ Error in AgentExecutor:', error);
      throw error;
    }
  }

  /**
   * ตรวจสอบว่าควรใช้ multimodal หรือไม่
   */
  private shouldUseMultimodal(images?: Array<{ url: string; mediaType: string; base64Data?: string }>): boolean {
    return !!(images && images.length > 0 && images.some(img => img.base64Data));
  }

  /**
   * รัน multimodal mode
   */
  private async runMultimodal(
    messages: AgentMessage[],
    images: Array<{ url: string; mediaType: string; base64Data?: string }>
  ): Promise<string> {
    // ใช้ multimodal LLM โดยตรง
    const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user');
    if (!lastUserMessage) {
      throw new Error('No user message found for multimodal processing');
    }

    const response = await this.llm.generate(lastUserMessage.content, images);
    return response;
  }

  /**
   * ดูข้อมูล configuration
   */
  public getConfig(): Required<AgentConfig> {
    return { ...this.config };
  }

  /**
   * ตรวจสอบว่า initialized แล้วหรือไม่
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    // Cleanup any resources if needed
    this.initialized = false;
    console.log(`🗑️ AgentExecutor disposed for session: ${this.config.sessionId}`);
  }
}