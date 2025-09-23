/**
 * LangGraphConversation - Modern LangGraph-based Conversation System
 *
 * ระบบ conversation ที่ใช้ LangGraph StateGraph อย่างถูกต้อง
 * ตามข้อมูลล่าสุดของ September 2025
 */

import { StateGraph, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from 'uuid';
import { getLLM } from '../agent/llmFactory';
import { redis } from '../lib/redis';
import { ConversationMessageModel } from './models';

// Define our custom state that extends MessagesAnnotation
const ConversationStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  conversationId: Annotation<string>(),
  userId: Annotation<string>(),
  config: Annotation<{
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    agentId?: string;
  }>(),
  metadata: Annotation<{
    messageId?: string;
    startTime?: number;
    processingTime?: number;
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    errors?: any[];
  }>(),
  shouldContinue: Annotation<boolean>(),
  toolResults: Annotation<any[]>()
});

type ConversationState = typeof ConversationStateAnnotation.State;

export interface LangGraphConversationConfig {
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  agentId?: string;
  enableTools?: boolean;
  tools?: string[];
}

export interface ConversationRequest {
  conversationId: string;
  userId: string;
  message: string;
  images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
  config?: LangGraphConversationConfig;
}

export interface ConversationResponse {
  messageId: string;
  content: string;
  role: 'assistant';
  status: 'completed' | 'failed';
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingTime: number;
  error?: string;
}

export class LangGraphConversationService {
  private workflow: any;
  private app: any;
  private readonly MEMORY_KEY_PREFIX = 'langgraph_conv:';
  private readonly MEMORY_TTL = 24 * 60 * 60; // 24 hours
  private readonly MAX_HISTORY = 10;

  constructor() {
    this.setupWorkflow();
    console.log('🤖 LangGraphConversationService initialized');
  }

  private setupWorkflow(): void {
    // Create the StateGraph workflow
    this.workflow = new StateGraph(ConversationStateAnnotation)
      .addNode("load_history", this.loadHistoryNode.bind(this))
      .addNode("call_model", this.callModelNode.bind(this))
      .addNode("save_message", this.saveMessageNode.bind(this))
      .addEdge("__start__", "load_history")
      .addEdge("load_history", "call_model")
      .addEdge("call_model", "save_message")
      .addEdge("save_message", "__end__");

    // Compile the workflow
    this.app = this.workflow.compile();
    console.log('✅ LangGraph workflow compiled successfully');
  }

  // ============= WORKFLOW NODES =============

  /**
   * โหลด conversation history
   */
  private async loadHistoryNode(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log(`🧠 Loading history for conversation: ${state.conversationId}`);

    try {
      const history = await this.getConversationHistory(state.conversationId);

      // Convert history to LangChain messages
      const messages: BaseMessage[] = [...state.messages];

      // Add history messages
      for (const msg of history) {
        if (msg.role === 'user') {
          messages.push(new HumanMessage({ content: msg.content }));
        } else if (msg.role === 'assistant') {
          messages.push(new AIMessage({ content: msg.content }));
        }
      }

      // Add current user message
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage) {
        messages.push(new HumanMessage({ content: lastMessage.content as string }));
      }

      return {
        messages,
        metadata: {
          ...state.metadata,
          startTime: Date.now()
        }
      };
    } catch (error) {
      console.error('❌ Error loading history:', error);
      return {
        metadata: {
          ...state.metadata,
          errors: [...(state.metadata?.errors || []), error]
        }
      };
    }
  }

  /**
   * เรียก LLM model
   */
  private async callModelNode(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log(`🤖 Calling model for conversation: ${state.conversationId}`);

    try {
      const config = state.config || {};

      // Get LLM instance
      const llm = getLLM(config.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4000,
        systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.'
      });

      // Build prompt from messages
      const prompt = this.buildPromptFromMessages(state.messages, config.systemPrompt);

      // Check for images in the current message
      const currentMessage = state.messages[state.messages.length - 1];
      const images = (state as any).images || [];

      // Generate response (with image support if available)
      const response = await llm.generate(prompt, images);

      // Create AI message
      const aiMessage = new AIMessage({ content: response });

      // Estimate token usage
      const tokenUsage = {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(response.length / 4),
        totalTokens: Math.ceil((prompt.length + response.length) / 4)
      };

      return {
        messages: [...state.messages, aiMessage],
        metadata: {
          ...state.metadata,
          tokenUsage,
          processingTime: Date.now() - (state.metadata?.startTime || Date.now())
        }
      };
    } catch (error) {
      console.error('❌ Error calling model:', error);

      // Create error message
      const errorMessage = new AIMessage({ content: 'I apologize, but I encountered an error while processing your request. Please try again.' });

      return {
        messages: [...state.messages, errorMessage],
        metadata: {
          ...state.metadata,
          errors: [...(state.metadata?.errors || []), error],
          processingTime: Date.now() - (state.metadata?.startTime || Date.now())
        }
      };
    }
  }

  /**
   * บันทึกข้อความ
   */
  private async saveMessageNode(state: ConversationState): Promise<Partial<ConversationState>> {
    console.log(`💾 Saving messages for conversation: ${state.conversationId}`);

    try {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;

      // Save user message
      const userMessage = messages[messages.length - 2] as HumanMessage;
      await this.saveMessage(state.conversationId, {
        id: uuidv4(),
        conversationId: state.conversationId,
        role: 'user',
        content: userMessage.content as string,
        status: 'completed',
        metadata: {
          userId: state.userId,
          agentId: state.config?.agentId,
          modelId: state.config?.modelId,
          retryCount: 0
        },
        createdAt: new Date()
      });

      // Save assistant message
      const messageId = state.metadata?.messageId || uuidv4();
      await this.saveMessage(state.conversationId, {
        id: messageId,
        conversationId: state.conversationId,
        role: 'assistant',
        content: lastMessage.content as string,
        status: state.metadata?.errors?.length ? 'failed' : 'completed',
        metadata: {
          userId: state.userId,
          agentId: state.config?.agentId,
          modelId: state.config?.modelId,
          processingTime: state.metadata?.processingTime,
          tokenUsage: state.metadata?.tokenUsage,
          retryCount: 0,
          errorDetails: state.metadata?.errors?.length ? {
            code: 'PROCESSING_ERROR',
            message: state.metadata.errors[0]?.message || 'Unknown error',
            timestamp: new Date(),
            retryable: true
          } : undefined
        },
        createdAt: new Date()
      });

      return {
        metadata: {
          ...state.metadata,
          messageId
        }
      };
    } catch (error) {
      console.error('❌ Error saving messages:', error);
      return {
        metadata: {
          ...state.metadata,
          errors: [...(state.metadata?.errors || []), error]
        }
      };
    }
  }

  // ============= PUBLIC API =============

  /**
   * ประมวลผลข้อความแบบ streaming
   */
  public async processMessage(
    request: ConversationRequest,
    onChunk: (chunk: string) => void
  ): Promise<ConversationResponse> {
    const messageId = uuidv4();
    const startTime = Date.now();

    try {
      // Prepare initial state
      const initialState: ConversationState = {
        conversationId: request.conversationId,
        userId: request.userId,
        messages: [new HumanMessage({ content: request.message })],
        config: request.config || {},
        metadata: {
          messageId,
          startTime
        },
        shouldContinue: false,
        toolResults: [],
        ...(request.images && { images: request.images })
      } as any;

      // Run the workflow
      const result = await this.app.invoke(initialState);

      const lastMessage = result.messages[result.messages.length - 1] as AIMessage;
      const content = lastMessage.content as string;

      // Emit the complete response as a single chunk for streaming
      onChunk(content);

      const processingTime = Date.now() - startTime;

      return {
        messageId,
        content,
        role: 'assistant',
        status: result.metadata?.errors?.length ? 'failed' : 'completed',
        tokenUsage: result.metadata?.tokenUsage,
        processingTime,
        error: result.metadata?.errors?.length ? result.metadata.errors[0]?.message : undefined
      };

    } catch (error) {
      console.error('❌ Error in LangGraph workflow:', error);
      const processingTime = Date.now() - startTime;

      // Send error message as chunk
      const errorContent = 'I apologize, but I encountered an error while processing your request. Please try again.';
      onChunk(errorContent);

      return {
        messageId,
        content: errorContent,
        role: 'assistant',
        status: 'failed',
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============= HELPER METHODS =============

  private buildPromptFromMessages(messages: BaseMessage[], systemPrompt?: string): string {
    const prompt = systemPrompt || 'You are a helpful AI assistant.';
    let conversation = `${prompt}\n\n`;

    messages.forEach(message => {
      if (message instanceof HumanMessage) {
        conversation += `Human: ${message.content}\n`;
      } else if (message instanceof AIMessage) {
        conversation += `Assistant: ${message.content}\n`;
      }
    });

    conversation += '\nAssistant:';
    return conversation;
  }

  private async getConversationHistory(conversationId: string): Promise<any[]> {
    try {
      const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
      const cached = await redis.lrange(cacheKey, 0, -1);

      if (cached.length > 0) {
        return cached.map(msg => JSON.parse(msg));
      }

      // Fallback to database
      const messages = await ConversationMessageModel
        .find({ conversationId })
        .sort({ createdAt: 1 })
        .limit(this.MAX_HISTORY)
        .lean();

      // Cache for next time
      if (messages.length > 0) {
        const pipeline = redis.pipeline();
        pipeline.del(cacheKey);
        for (const msg of messages) {
          pipeline.rpush(cacheKey, JSON.stringify(msg));
        }
        pipeline.expire(cacheKey, this.MEMORY_TTL);
        await pipeline.exec();
      }

      return messages;
    } catch (error) {
      console.error('❌ Error loading conversation history:', error);
      return [];
    }
  }

  private async saveMessage(conversationId: string, message: any): Promise<void> {
    try {
      // Save to database
      const messageDoc = new ConversationMessageModel({
        ...message,
        conversationId,
        role: message.role,
        content: message.content,
        status: message.status,
        metadata: {
          ...message.metadata,
          retryCount: message.metadata?.retryCount || 0
        },
        attachments: [],
        toolCalls: [],
        createdAt: message.createdAt || new Date(),
        updatedAt: new Date()
      });

      await messageDoc.save();

      // Update cache
      const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
      await redis.rpush(cacheKey, JSON.stringify(message));
      await redis.ltrim(cacheKey, -this.MAX_HISTORY, -1);
      await redis.expire(cacheKey, this.MEMORY_TTL);

    } catch (error) {
      console.error('❌ Error saving message:', error);
    }
  }

  public async clearConversation(conversationId: string): Promise<void> {
    try {
      const cacheKey = `${this.MEMORY_KEY_PREFIX}${conversationId}`;
      await redis.del(cacheKey);
      console.log(`🧹 Cleared LangGraph conversation memory: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error clearing conversation:', error);
    }
  }
}

// Export singleton instance
export const langGraphConversationService = new LangGraphConversationService();