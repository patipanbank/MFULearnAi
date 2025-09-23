/**
 * ConversationLLMManager
 *
 * จัดการ LLM generation สำหรับ conversation workflow
 * รองรับ streaming และ multiple model providers
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ConversationMessage, MessageRole, TokenUsage, MemoryState } from '../types';
import { getLLM } from '../../agent/llmFactory';

interface LLMGenerationContext {
  messages: ConversationMessage[];
  currentMessage: ConversationMessage;
  memory: MemoryState;
  toolOutput?: any;
  config: any;
}

interface LLMResponse {
  content: string;
  tokenUsage?: TokenUsage;
  finishReason?: string;
}

export class ConversationLLMManager {
  private readonly DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Use the provided tools when appropriate to answer questions accurately.

If you have tool results available, incorporate them naturally into your response. Always be helpful, accurate, and conversational.

Memory context:
{memory_context}

Tool results:
{tool_results}`;

  constructor() {
    console.log('🤖 ConversationLLMManager initialized');
  }

  // ============= RESPONSE GENERATION =============

  /**
   * สร้าง response ด้วย LLM พร้อม streaming
   */
  public async generateResponse(
    context: LLMGenerationContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🤖 Generating response for conversation ${context.currentMessage.conversationId}`);

    try {
      // Prepare prompt
      const prompt = await this.preparePrompt(context);

      // Get LLM instance
      const llm = getLLM(context.config.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
        temperature: context.config.temperature || 0.7,
        maxTokens: context.config.maxTokens || 4000,
        streaming: true
      });

      // Generate response with streaming
      let fullContent = '';
      let tokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      const stream = await llm.stream(prompt.formatMessages({
        memory_context: context.memory.context,
        tool_results: this.formatToolResults(context.toolOutput),
        user_message: context.currentMessage.content
      }));

      for await (const chunk of stream) {
        const chunkContent = chunk.content || '';
        if (chunkContent) {
          fullContent += chunkContent;
          onChunk(chunkContent);
        }

        // Update token usage if available
        if (chunk.response_metadata?.tokenUsage) {
          tokenUsage = chunk.response_metadata.tokenUsage;
        }
      }

      return {
        content: fullContent,
        tokenUsage,
        finishReason: 'stop'
      };

    } catch (error) {
      console.error('❌ LLM generation failed:', error);
      throw new Error(`LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============= PROMPT PREPARATION =============

  /**
   * เตรียม prompt สำหรับ LLM
   */
  private async preparePrompt(context: LLMGenerationContext): Promise<ChatPromptTemplate> {
    // Get system prompt
    const systemPrompt = context.config.systemPrompt || this.DEFAULT_SYSTEM_PROMPT;

    // Build conversation history
    const conversationMessages = this.buildConversationHistory(context.messages);

    // Create prompt template
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ...conversationMessages,
      ['human', '{user_message}']
    ]);

    return promptTemplate;
  }

  /**
   * สร้าง conversation history สำหรับ prompt
   */
  private buildConversationHistory(messages: ConversationMessage[]): Array<[string, string]> {
    const history: Array<[string, string]> = [];

    // Take recent messages for context (prevent token limit issues)
    const recentMessages = messages.slice(-10);

    recentMessages.forEach(message => {
      const role = this.mapMessageRoleToPromptRole(message.role);
      if (role) {
        let content = message.content;

        // Add tool information if available
        if (message.toolCalls && message.toolCalls.length > 0) {
          const toolInfo = message.toolCalls
            .filter(tc => tc.status === 'completed')
            .map(tc => `Used ${tc.name}: ${tc.output}`)
            .join('\\n');
          if (toolInfo) {
            content += `\\n\\n[Tools used: ${toolInfo}]`;
          }
        }

        history.push([role, content]);
      }
    });

    return history;
  }

  /**
   * แปลง MessageRole เป็น prompt role
   */
  private mapMessageRoleToPromptRole(role: MessageRole): string | null {
    switch (role) {
      case MessageRole.USER:
        return 'human';
      case MessageRole.ASSISTANT:
        return 'assistant';
      case MessageRole.SYSTEM:
        return 'system';
      default:
        return null;
    }
  }

  // ============= TOOL RESULT FORMATTING =============

  /**
   * จัดรูปแบบ tool results สำหรับ prompt
   */
  private formatToolResults(toolOutput?: any): string {
    if (!toolOutput) {
      return 'No tools were used for this response.';
    }

    if (Array.isArray(toolOutput)) {
      return toolOutput
        .filter(execution => execution.status === 'completed')
        .map(execution => {
          return `${execution.toolName}: ${this.formatSingleToolResult(execution.output)}`;
        })
        .join('\\n\\n');
    }

    return this.formatSingleToolResult(toolOutput);
  }

  /**
   * จัดรูปแบบ tool result เดียว
   */
  private formatSingleToolResult(output: any): string {
    if (typeof output === 'string') {
      return output;
    }

    if (typeof output === 'object') {
      // Handle common tool output formats
      if (output.results && Array.isArray(output.results)) {
        // Web search results
        return output.results
          .slice(0, 3)
          .map((result: any) => `- ${result.title || result.name}: ${result.snippet || result.description}`)
          .join('\\n');
      }

      if (output.result !== undefined) {
        // Calculator or simple result
        return String(output.result);
      }

      if (output.documents && Array.isArray(output.documents)) {
        // Document search results
        return output.documents
          .slice(0, 3)
          .map((doc: any) => `- ${doc.title || 'Document'}: ${doc.content?.substring(0, 200)}...`)
          .join('\\n');
      }

      // Generic object
      return JSON.stringify(output, null, 2);
    }

    return String(output);
  }

  // ============= RESPONSE VALIDATION =============

  /**
   * ตรวจสอบและปรับปรุง response
   */
  public validateAndEnhanceResponse(
    response: string,
    context: LLMGenerationContext
  ): string {
    let enhancedResponse = response;

    // Remove excessive whitespace
    enhancedResponse = enhancedResponse.trim().replace(/\\n{3,}/g, '\\n\\n');

    // Ensure response is not empty
    if (!enhancedResponse) {
      enhancedResponse = 'I apologize, but I couldn\\'t generate a proper response. Please try rephrasing your question.';
    }

    // Add context if response is too short and tools were used
    if (enhancedResponse.length < 50 && context.toolOutput) {
      enhancedResponse += '\\n\\nI used the available tools to gather information for this response.';
    }

    return enhancedResponse;
  }

  // ============= MODEL UTILITIES =============

  /**
   * ตรวจสอบ model capabilities
   */
  public getModelCapabilities(modelId: string): {
    supportsVision: boolean;
    supportsStreaming: boolean;
    maxTokens: number;
    supportedTools: string[];
  } {
    // Model capability mapping
    const capabilities: Record<string, any> = {
      'anthropic.claude-3-5-sonnet-20240620-v1:0': {
        supportsVision: true,
        supportsStreaming: true,
        maxTokens: 200000,
        supportedTools: ['web_search', 'calculator', 'current_date', 'memory_search']
      },
      'anthropic.claude-3-haiku-20240307-v1:0': {
        supportsVision: true,
        supportsStreaming: true,
        maxTokens: 200000,
        supportedTools: ['web_search', 'calculator', 'current_date']
      }
    };

    return capabilities[modelId] || {
      supportsVision: false,
      supportsStreaming: true,
      maxTokens: 4000,
      supportedTools: ['calculator', 'current_date']
    };
  }

  /**
   * คำนวณ token usage estimate
   */
  public estimateTokenUsage(content: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }

  // ============= ERROR HANDLING =============

  /**
   * จัดการ LLM errors
   */
  public handleLLMError(error: any, context: LLMGenerationContext): string {
    console.error('❌ LLM Error:', error);

    // Generate appropriate error response based on error type
    if (error.message?.includes('token')) {
      return 'I apologize, but your message is too long. Please try breaking it into smaller parts.';
    }

    if (error.message?.includes('rate limit')) {
      return 'I\\'m currently experiencing high demand. Please try again in a moment.';
    }

    if (error.message?.includes('content policy')) {
      return 'I can\\'t provide a response to that request. Please try rephrasing your question.';
    }

    return 'I apologize, but I encountered an error while processing your request. Please try again.';
  }

  // ============= CLEANUP =============

  public cleanup(): void {
    console.log('🧹 ConversationLLMManager cleaned up');
  }
}