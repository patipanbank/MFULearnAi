/**
 * 🚀 Simplified Modern Agent System
 *
 * ระบบ Agent ใหม่ที่เน้น LangChain และ LangMem เป็นหลัก
 * - ไม่ใช้ LangGraph ที่ซับซ้อน
 * - เน้น LangChain Streaming
 * - Real embedding service
 * - LangMem สำหรับ memory management
 * - ไม่มี fallback ไป Bedrock โดยตรง
 */

import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import { ChatBedrockConverse } from '@langchain/aws';
import { langmemService, ConversationContext } from '../services/langmemService';
import { realEmbeddingService } from './realEmbeddingService';
import { chromaService } from '../services/chromaService';
import { promptTemplateManager, TemplateContext } from './promptTemplateManager';
import { TaskIntent, AgentType, WorkflowComplexity } from './intentRouter';
import { unifiedToolRegistry, ToolExecutionContext } from '../services/unifiedToolRegistry';

// ================== TYPES ==================

export interface SimplifiedAgentConfig {
  modelId: string;
  systemPrompt?: string; // Now optional, can use template system
  sessionId: string;
  userId: string;
  agentId?: string;
  collectionNames?: string[];
  agentTools?: Array<{
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    config?: any;
  }>;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  // Template system integration
  intent?: TaskIntent;
  workflowComplexity?: WorkflowComplexity;
  useTemplateSystem?: boolean;
  templateContext?: TemplateContext;
}

export interface StreamingEvent {
  type: 'chunk' | 'tool_start' | 'tool_result' | 'end' | 'error';
  data: any;
}

export interface AgentExecutor {
  run: (
    messages: BaseMessage[],
    onEvent?: (event: StreamingEvent) => void
  ) => Promise<string>;
  getState: () => any;
  visualize: () => string;
}

// ================== SIMPLIFIED AGENT SYSTEM ==================

export class SimplifiedModernAgent {
  private llm: ChatBedrockConverse;
  private tools: DynamicTool[] = [];
  private config: SimplifiedAgentConfig;
  private memoryContext?: any;
  private toolsInitialized: boolean = false;
  private static toolCache: Map<string, DynamicTool[]> = new Map();

  constructor(config: SimplifiedAgentConfig) {
    this.config = config;

    // Initialize LLM with streaming
    this.llm = new ChatBedrockConverse({
      model: config.modelId,
      region: process.env.AWS_REGION || 'us-east-1',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4000,
      streaming: true
    });

    console.log(`🤖 Simplified Modern Agent initialized for session ${config.sessionId}`);
  }

  async setupTools() {
    if (this.toolsInitialized) {
      console.log('🔧 Tools already initialized, skipping...');
      return;
    }

    console.log('🔧 Setting up tools with UnifiedToolRegistry (optimized)...');
    const startTime = Date.now();

    // Create cache key based on configuration
    const cacheKey = this.createToolCacheKey();
    const cachedTools = SimplifiedModernAgent.toolCache.get(cacheKey);

    if (cachedTools) {
      console.log('⚡ Using cached tools for better performance');
      this.tools = [...cachedTools];
      this.toolsInitialized = true;
      console.log(`✅ ${this.tools.length} tools loaded from cache in ${Date.now() - startTime}ms`);
      return;
    }

    // Setup tool execution context
    const toolContext: ToolExecutionContext = {
      sessionId: this.config.sessionId,
      userId: this.config.userId,
      agentId: this.config.agentId,
      collectionNames: this.config.collectionNames,
      config: this.config
    };

    // Parallel tool creation for better performance
    const [sessionTools, memoryTools, collectionTools, availableTools] = await Promise.all([
      Promise.resolve(unifiedToolRegistry.createSessionTools(this.config.sessionId)),
      this.createMemoryToolsOptimized(),
      Promise.resolve(this.config.collectionNames && this.config.collectionNames.length > 0
        ? unifiedToolRegistry.createCollectionTools(this.config.collectionNames)
        : []),
      Promise.resolve(unifiedToolRegistry.getAvailableTools(toolContext))
    ]);

    // Convert UnifiedToolRegistry tools to LangChain DynamicTools efficiently
    const allTools = [...sessionTools, ...memoryTools, ...collectionTools, ...availableTools];
    this.tools = allTools.map(toolConfig => this.createDynamicTool(toolConfig, toolContext));

    // Cache tools for future use (excluding session-specific ones)
    if (this.config.collectionNames && this.config.collectionNames.length > 0) {
      const staticTools = [...collectionTools, ...availableTools].map(toolConfig =>
        this.createDynamicTool(toolConfig, toolContext)
      );
      SimplifiedModernAgent.toolCache.set(cacheKey, staticTools);
    }

    this.toolsInitialized = true;
    console.log(`✅ ${this.tools.length} tools configured in ${Date.now() - startTime}ms`);
    console.log(`🔧 Tools: ${this.tools.map(t => t.name).join(', ')}`);
  }

  private createToolCacheKey(): string {
    return `${this.config.collectionNames?.join(',') || 'no-collections'}_${this.config.agentId || 'default'}`;
  }

  private async createMemoryToolsOptimized(): Promise<any[]> {
    // Quick memory check without expensive queries
    try {
      const hasMemory = await langmemService.hasMemoryForSession(this.config.sessionId);
      if (hasMemory) {
        return await unifiedToolRegistry.createMemorySearchToolsIfNeeded(this.config.sessionId);
      }
      return [];
    } catch (error) {
      console.warn('⚠️ Memory check failed, skipping memory tools:', error);
      return [];
    }
  }

  private createDynamicTool(toolConfig: any, toolContext: ToolExecutionContext): DynamicTool {
    return new DynamicTool({
      name: toolConfig.name.toLowerCase().replace(/\s+/g, '_'),
      description: toolConfig.description,
      func: async (input: string) => {
        const result = await unifiedToolRegistry.executeTool(toolConfig.id, input, toolContext);
        return result.success ? result.result : `Error: ${result.error}`;
      }
    });
  }


  async run(
    messages: BaseMessage[],
    onEvent?: (event: StreamingEvent) => void
  ): Promise<string> {
    console.log(`🚀 Simplified Modern Agent running with ${messages.length} messages`);

    try {
      // Setup tools
      await this.setupTools();

      // Memory retrieval step
      await this.retrieveMemoryContext(messages);

      let iteration = 0;
      const maxIterations = this.config.maxIterations || 5;

      while (iteration < maxIterations) {
        iteration++;
        console.log(`🔄 Iteration ${iteration}/${maxIterations}`);

        // Build system prompt with context
        const systemPrompt = await this.buildSystemPrompt();
        const fullMessages = [new SystemMessage(systemPrompt), ...messages];

        // Stream response from LLM
        const { response, hasToolCalls, toolCalls } = await this.streamLLMResponse(fullMessages, onEvent);

        if (!hasToolCalls) {
          // Final answer - update memory and return
          await this.updateMemory(messages, response);

          if (onEvent) {
            onEvent({
              type: 'end',
              data: {
                answer: response,
                inputTokens: 0,
                outputTokens: 0,
                iterations: iteration
              }
            });
          }

          console.log(`✅ Completed in ${iteration} iterations`);
          return response;
        }

        // Execute tools
        const toolResults = await this.executeTools(toolCalls, onEvent);

        // Add tool results to messages
        messages.push(new AIMessage(response));
        messages.push(new HumanMessage(`Tool results: ${JSON.stringify(toolResults)}`));
      }

      // Max iterations reached
      const finalResponse = 'I need more iterations to complete this task properly.';

      if (onEvent) {
        onEvent({
          type: 'end',
          data: {
            answer: finalResponse,
            inputTokens: 0,
            outputTokens: 0,
            iterations: iteration
          }
        });
      }

      return finalResponse;

    } catch (error) {
      console.error('❌ Simplified Modern Agent execution failed:', error);

      if (onEvent) {
        onEvent({
          type: 'error',
          data: { error: (error as Error).message }
        });
      }

      throw error;
    }
  }

  private async retrieveMemoryContext(messages: BaseMessage[]) {
    console.log('🧠 Retrieving memory context (optimized)...');
    const startTime = Date.now();

    try {
      const lastUserMessage = messages
        .filter(msg => msg instanceof HumanMessage)
        .pop();

      if (!lastUserMessage) {
        this.memoryContext = null;
        return;
      }

      // Quick check if memory exists before expensive operations
      const hasMemory = await langmemService.hasMemoryForSession(this.config.sessionId);
      if (!hasMemory) {
        console.log('📭 No memory found for session, skipping memory retrieval');
        this.memoryContext = null;
        return;
      }

      const context: ConversationContext = {
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        agentId: this.config.agentId,
        namespace: 'conversation'
      };

      // Parallel memory retrieval for better performance
      const [relevantMemories, recentMessages] = await Promise.all([
        langmemService.searchMemories(
          lastUserMessage.content as string,
          context,
          { limit: 5 }
        ).catch(error => {
          console.warn('⚠️ Relevant memory search failed:', error);
          return [];
        }),
        langmemService.getContextualMemories(
          context,
          { limit: 10 }
        ).catch(error => {
          console.warn('⚠️ Recent memory retrieval failed:', error);
          return [];
        })
      ]);

      this.memoryContext = {
        relevantMemories,
        recentMessages
      };

      console.log(`📚 Memory context retrieved in ${Date.now() - startTime}ms: ${relevantMemories.length} relevant, ${recentMessages.length} recent`);
    } catch (error) {
      console.warn('⚠️ Failed to retrieve memory context:', error);
      this.memoryContext = null;
    }
  }

  private async buildSystemPrompt(): Promise<string> {
    let systemPrompt: string;

    // Use template system if enabled and context is available
    if (this.config.useTemplateSystem && this.config.intent) {
      try {
        console.log('🎯 Building prompt using template system (Simplified)...');

        const templateContext: TemplateContext = {
          intent: this.config.intent,
          agentType: AgentType.SIMPLIFIED_MODERN,
          complexity: this.config.workflowComplexity || WorkflowComplexity.SIMPLE,
          tools: this.tools.map(tool => tool.name),
          memoryContext: this.memoryContext,
          maxIterations: this.config.maxIterations,
          sessionData: { sessionId: this.config.sessionId },
          ...this.config.templateContext
        };

        const renderedTemplate = await promptTemplateManager.renderForIntentAndAgent(
          this.config.intent,
          AgentType.SIMPLIFIED_MODERN,
          templateContext
        );

        systemPrompt = renderedTemplate.content;
        console.log(`✅ Using template: ${renderedTemplate.metadata.name} (${renderedTemplate.version})`);

      } catch (error) {
        console.warn('⚠️ Template system failed, falling back to legacy prompt:', error);
        systemPrompt = this.config.systemPrompt || this.buildLegacyPrompt();
      }
    } else {
      // Fallback to legacy prompt building or provided systemPrompt
      systemPrompt = this.config.systemPrompt || this.buildLegacyPrompt();
    }

    // Add structured thinking format requirement (for non-template prompts)
    if (!this.config.useTemplateSystem || !this.config.intent) {
      systemPrompt += this.buildThinkingFormatInstructions();
    }

    // Add memory context
    if (this.memoryContext) {
      systemPrompt += this.buildMemoryContextInstructions();
    }

    // Add tool descriptions and guidelines
    if (this.tools.length > 0) {
      systemPrompt += this.buildToolInstructions();
    }

    return systemPrompt;
  }

  private buildLegacyPrompt(): string {
    return "You are a helpful AI assistant. Provide clear, accurate, and helpful responses to user questions. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.";
  }

  private buildThinkingFormatInstructions(): string {
    return `\n\n## Response Format:
When responding to user queries, structure your response using this format:

<thinking>
Your reasoning process here:
- Analyze the user's question
- Determine if tools are needed and which ones
- Plan your approach to answering
- Consider any relevant context or constraints
</thinking>

Your final answer here (clear, direct response to the user's question).

## Guidelines:
- Always include <thinking> tags for your reasoning process
- Keep thinking concise but comprehensive
- Only show tool usage reasoning in thinking, not in final answer
- Make your final answer clean and user-focused`;
  }

  private buildMemoryContextInstructions(): string {
    let instructions = '';

    if (this.memoryContext.relevantMemories.length > 0) {
      instructions += `\n\nRelevant memories: ${JSON.stringify(this.memoryContext.relevantMemories)}`;
    }

    if (this.memoryContext.recentMessages.length > 0) {
      instructions += `\n\nRecent context: ${JSON.stringify(this.memoryContext.recentMessages)}`;
    }

    return instructions;
  }

  private buildToolInstructions(): string {
    const toolDescriptions = this.tools.map(tool =>
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    return `\n\n## Available Tools:\n${toolDescriptions}

## Tool Selection Guidelines:
- Only use knowledge base tools (search_*) for domain-specific questions that require specialized information
- Use web_search for current events, recent information, or when knowledge base doesn't have relevant data
- Use calculator only for mathematical calculations or numerical computations
- Use current_date only when user asks for current time/date information
- Use search_conversation_memory only to recall previous conversation context
- THINK in <thinking> tags before selecting tools
- If the question can be answered with general knowledge, DO NOT use any tools

To use a tool, mention it clearly in your thinking: "I need to use [tool_name]" or "Let me [tool_name]".`;
  }

  private async streamLLMResponse(
    messages: BaseMessage[],
    onEvent?: (event: StreamingEvent) => void
  ): Promise<{ response: string; hasToolCalls: boolean; toolCalls: Array<{ name: string; input: string }> }> {
    let fullResponse = '';

    try {
      // Stream the response
      const stream = await this.llm.stream(messages);

      for await (const chunk of stream) {
        const content = chunk.content?.toString() || '';
        if (content) {
          fullResponse += content;

          // Emit streaming chunk
          if (onEvent) {
            onEvent({
              type: 'chunk',
              data: { delta: content }
            });
          }
        }
      }

      // Check for tool calls (simple text-based detection)
      const toolCalls = this.extractToolCalls(fullResponse);
      const hasToolCalls = toolCalls.length > 0;

      return {
        response: fullResponse,
        hasToolCalls,
        toolCalls
      };

    } catch (error) {
      console.error('❌ LLM streaming failed:', error);
      throw error;
    }
  }

  private extractToolCalls(response: string): Array<{ name: string; input: string }> {
    const calls: Array<{ name: string; input: string }> = [];

    // Simple tool call detection
    for (const tool of this.tools) {
      const patterns = [
        new RegExp(`use ${tool.name}`, 'i'),
        new RegExp(`search.*${tool.name.split('_')[1]}`, 'i'),
        new RegExp(`need to ${tool.name}`, 'i')
      ];

      for (const pattern of patterns) {
        if (pattern.test(response)) {
          // Extract query from the response
          const lines = response.split('\n');
          const relevantLine = lines.find(line => pattern.test(line));
          const query = relevantLine || response.split('.')[0] || response.substring(0, 100);

          calls.push({
            name: tool.name,
            input: query.replace(/['"]/g, '').trim()
          });
          break;
        }
      }
    }

    return calls;
  }

  private async executeTools(
    toolCalls: Array<{ name: string; input: string }>,
    onEvent?: (event: StreamingEvent) => void
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    for (const toolCall of toolCalls) {
      console.log(`🔧 Executing tool: ${toolCall.name}`);

      if (onEvent) {
        onEvent({
          type: 'tool_start',
          data: {
            tool_name: toolCall.name,
            tool_input: toolCall.input
          }
        });
      }

      try {
        const tool = this.tools.find(t => t.name === toolCall.name);
        if (!tool) {
          throw new Error(`Tool ${toolCall.name} not found`);
        }

        const result = await tool.func(toolCall.input);
        results[toolCall.name] = result;

        if (onEvent) {
          onEvent({
            type: 'tool_result',
            data: {
              tool_name: toolCall.name,
              output: result
            }
          });
        }

        console.log(`✅ Tool ${toolCall.name} executed successfully`);

      } catch (error) {
        const errorMessage = `Tool ${toolCall.name} failed: ${(error as Error).message}`;
        results[toolCall.name] = errorMessage;

        if (onEvent) {
          onEvent({
            type: 'tool_result',
            data: {
              tool_name: toolCall.name,
              output: errorMessage
            }
          });
        }

        console.error(`❌ Tool ${toolCall.name} failed:`, error);
      }
    }

    return results;
  }

  private async updateMemory(messages: BaseMessage[], response: string) {
    console.log('💾 Updating memory...');

    try {
      const context: ConversationContext = {
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        agentId: this.config.agentId,
        namespace: 'conversation'
      };

      // Process recent messages for memory
      const recentMessages = messages.slice(-2).map(msg => ({
        role: msg instanceof HumanMessage ? 'user' : 'assistant',
        content: msg.content as string,
        timestamp: new Date().toISOString()
      }));

      // Add the final response
      recentMessages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      });

      if (recentMessages.length > 0) {
        await langmemService.processMessages(recentMessages, context);
        console.log(`💾 Processed ${recentMessages.length} messages for memory`);
      }

    } catch (error) {
      console.error('❌ Memory update failed:', error);
    }
  }

  getState() {
    return {
      sessionId: this.config.sessionId,
      toolCount: this.tools.length,
      modelId: this.config.modelId,
      hasMemoryContext: !!this.memoryContext
    };
  }

  visualize(): string {
    return `Simplified Modern Agent:
- Model: ${this.config.modelId}
- Session: ${this.config.sessionId}
- Tools: ${this.tools.length}
- Collections: ${this.config.collectionNames?.length || 0}
- Max Iterations: ${this.config.maxIterations || 5}`;
  }
}

// ================== FACTORY FUNCTION ==================

export async function createSimplifiedModernAgent(config: SimplifiedAgentConfig): Promise<AgentExecutor> {
  console.log('🏭 Creating Simplified Modern Agent...');

  const agent = new SimplifiedModernAgent(config);

  return {
    run: agent.run.bind(agent),
    getState: agent.getState.bind(agent),
    visualize: agent.visualize.bind(agent)
  };
}