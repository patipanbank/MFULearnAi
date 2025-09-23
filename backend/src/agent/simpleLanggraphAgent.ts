import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicTool } from '@langchain/core/tools';
import { unifiedToolRegistry, ToolExecutionContext } from '../services/unifiedToolRegistry';
import { langmemService } from '../services/langmemService';

export interface SimpleLangGraphConfig {
  modelId: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  userId?: string;
  agentId?: string;
  collectionNames?: string[];
  allowedTools?: string[];
  maxIterations?: number;
}

export interface SimpleLangGraphExecutor {
  run: (
    messages: { role: string; content: string }[],
    options?: {
      onEvent?: (event: { type: string; data?: any }) => void;
      maxSteps?: number;
      images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
    }
  ) => Promise<string>;
  getState: () => any;
  visualize: () => string;
}

/**
 * Simplified LangGraph-inspired agent without complex graph dependencies
 * Provides the same benefits but with simpler implementation
 */
export async function createSimpleLangGraphAgent(config: SimpleLangGraphConfig): Promise<SimpleLangGraphExecutor> {
  console.log(`🤖 Creating Simple LangGraph Agent with model: ${config.modelId}`);

  // Create LLM
  const llm = createLLM(config.modelId, {
    temperature: config.temperature || 0.7,
    maxTokens: config.maxTokens || 4000
  });

  // Setup tool execution context
  const toolContext: ToolExecutionContext = {
    sessionId: config.sessionId,
    userId: config.userId,
    agentId: config.agentId,
    collectionNames: config.collectionNames || [],
    config: config
  };

  // Get and filter tools
  let availableTools = unifiedToolRegistry.getAvailableTools(toolContext);
  if (config.allowedTools && config.allowedTools.length > 0) {
    availableTools = availableTools.filter(tool =>
      config.allowedTools!.includes(tool.id) ||
      config.allowedTools!.includes(tool.name.toLowerCase().replace(/\s+/g, '_'))
    );
  }

  // Create LangChain tools
  const tools = convertToLangChainTools(availableTools, toolContext);
  const toolMap = new Map(tools.map(tool => [tool.name, tool]));

  console.log(`🔧 Available tools: ${tools.map(t => t.name).join(', ')}`);

  // Agent state
  let currentState = {
    messages: [] as BaseMessage[],
    sessionId: config.sessionId,
    userId: config.userId,
    memoryContext: null as any,
    toolResults: {} as Record<string, any>,
    iterations: 0,
    reasoning: [] as string[]
  };

  return {
    async run(
      messages: { role: string; content: string }[],
      options?: {
        onEvent?: (event: { type: string; data?: any }) => void;
        maxSteps?: number;
        images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
      }
    ): Promise<string> {
      console.log(`🤖 Simple LangGraph Agent.run called with ${messages.length} messages`);

      const onEvent = options?.onEvent;
      const maxSteps = options?.maxSteps || config.maxIterations || 5;

      try {
        // Convert messages to LangChain format
        const langchainMessages = convertMessagesToLangChain(messages);
        currentState.messages = langchainMessages;

        // Emit start event
        if (onEvent) {
          onEvent({
            type: 'assistant_created',
            data: {
              messageId: Math.random().toString(36).substr(2, 9),
              content: ''
            }
          });
        }

        // Step 1: Memory Retrieval
        await memoryRetrievalStep();

        let finalAnswer = '';
        let iterations = 0;

        // Main agent loop
        while (iterations < maxSteps) {
          iterations++;
          console.log(`🔄 Agent iteration ${iterations}/${maxSteps}`);

          // Step 2: Agent reasoning
          const agentResponse = await agentReasoningStep();

          // Check if agent wants to use tools
          const toolCalls = extractToolCalls(agentResponse);

          if (toolCalls.length === 0) {
            // No tools needed, we have our final answer
            finalAnswer = agentResponse.content.toString();
            break;
          }

          // Step 3: Execute tools
          for (const toolCall of toolCalls) {
            await executeToolStep(toolCall, onEvent);
          }

          // Add agent response to state
          currentState.messages.push(agentResponse);
        }

        // Step 4: Memory Update
        await memoryUpdateStep();

        // Emit streaming response
        if (onEvent && finalAnswer) {
          const words = finalAnswer.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = (i > 0 ? ' ' : '') + words[i];
            onEvent({
              type: 'chunk',
              data: {
                messageId: Math.random().toString(36).substr(2, 9),
                delta: chunk
              }
            });
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }

        // Emit end event
        if (onEvent) {
          onEvent({
            type: 'end',
            data: {
              messageId: Math.random().toString(36).substr(2, 9),
              answer: finalAnswer,
              inputTokens: 0,
              outputTokens: 0,
              reasoning: currentState.reasoning
            }
          });
        }

        console.log(`🤖 Simple LangGraph execution completed. Result: ${finalAnswer.substring(0, 100)}...`);
        return finalAnswer;

      } catch (error) {
        console.error('❌ Error in Simple LangGraph Agent:', error);
        if (onEvent) {
          onEvent({
            type: 'error',
            data: { error: (error as Error).message }
          });
        }
        throw error;
      }
    },

    getState: () => currentState,

    visualize: () => `
      Simple LangGraph Agent Workflow:
      1. Memory Retrieval → 2. Agent Reasoning → 3. Tool Execution (if needed) → 4. Memory Update

      Current State:
      - Messages: ${currentState.messages.length}
      - Iterations: ${currentState.iterations}
      - Session: ${currentState.sessionId}
    `
  };

  // Helper functions

  async function memoryRetrievalStep() {
    console.log('🧠 Memory Retrieval Step');

    if (!config.sessionId) {
      currentState.reasoning.push('No session ID - skipping memory retrieval');
      return;
    }

    try {
      const lastUserMessage = [...currentState.messages]
        .reverse()
        .find(msg => msg instanceof HumanMessage);

      if (lastUserMessage) {
        const context = await langmemService.getConversationContext(
          config.sessionId,
          lastUserMessage.content.toString()
        );

        const relevantMemories = await langmemService.searchMemory(
          config.sessionId,
          lastUserMessage.content.toString(),
          5
        );

        currentState.memoryContext = { context, relevantMemories };
        currentState.reasoning.push('Retrieved conversation context and relevant memories');
      }
    } catch (error) {
      console.warn('Memory retrieval failed:', error);
      currentState.reasoning.push('Memory retrieval failed - proceeding without context');
    }
  }

  async function agentReasoningStep(): Promise<AIMessage> {
    console.log('🤖 Agent Reasoning Step');

    // Build enhanced system prompt
    let enhancedSystemPrompt = config.systemPrompt;

    if (currentState.memoryContext) {
      enhancedSystemPrompt += `\n\nConversation Context: ${JSON.stringify(currentState.memoryContext.context)}`;
      enhancedSystemPrompt += `\nRelevant Memories: ${JSON.stringify(currentState.memoryContext.relevantMemories)}`;
    }

    if (Object.keys(currentState.toolResults).length > 0) {
      enhancedSystemPrompt += `\n\nTool Results: ${JSON.stringify(currentState.toolResults)}`;
    }

    enhancedSystemPrompt += `\n\nAvailable Tools: ${tools.map(t => `${t.name}: ${t.description}`).join(', ')}`;

    const systemMessage = new SystemMessage(enhancedSystemPrompt);

    // Invoke LLM
    const response = await llm.invoke([systemMessage, ...currentState.messages]);

    currentState.reasoning.push(`Agent responded - checking for tool calls`);
    return response as AIMessage;
  }

  function extractToolCalls(message: AIMessage): Array<{ name: string; input: string }> {
    // Simple tool call extraction - look for tool mentions in text
    const content = message.content.toString();
    const toolCalls: Array<{ name: string; input: string }> = [];

    // Check for explicit tool calls in response
    if ((message as any).tool_calls) {
      return (message as any).tool_calls.map((call: any) => ({
        name: call.name,
        input: JSON.stringify(call.args)
      }));
    }

    // Fallback: parse tool mentions from text
    for (const tool of tools) {
      const pattern = new RegExp(`use ${tool.name}\\(([^)]+)\\)`, 'i');
      const match = content.match(pattern);
      if (match) {
        toolCalls.push({
          name: tool.name,
          input: match[1]
        });
      }
    }

    return toolCalls;
  }

  async function executeToolStep(
    toolCall: { name: string; input: string },
    onEvent?: (event: { type: string; data?: any }) => void
  ) {
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
      const tool = toolMap.get(toolCall.name);
      if (!tool) {
        throw new Error(`Tool ${toolCall.name} not found`);
      }

      const result = await tool.func(toolCall.input);

      currentState.toolResults[toolCall.name] = result;
      currentState.reasoning.push(`Executed ${toolCall.name} successfully`);

      if (onEvent) {
        onEvent({
          type: 'tool_result',
          data: {
            tool_name: toolCall.name,
            output: result
          }
        });
      }

      // Add tool result to conversation
      const toolMessage = new AIMessage(`Tool ${toolCall.name} result: ${result}`);
      currentState.messages.push(toolMessage);

    } catch (error) {
      console.error(`Tool ${toolCall.name} failed:`, error);
      currentState.reasoning.push(`Tool ${toolCall.name} failed: ${(error as Error).message}`);

      if (onEvent) {
        onEvent({
          type: 'tool_error',
          data: {
            tool_name: toolCall.name,
            error: (error as Error).message
          }
        });
      }
    }
  }

  async function memoryUpdateStep() {
    console.log('💾 Memory Update Step');

    if (!config.sessionId) {
      return;
    }

    try {
      const recentMessages = currentState.messages.slice(-2);

      for (const message of recentMessages) {
        await langmemService.addMessage(config.sessionId!, {
          role: message instanceof HumanMessage ? 'user' : 'assistant',
          content: message.content.toString(),
          timestamp: new Date().toISOString()
        });
      }

      currentState.reasoning.push('Updated conversation memory');
    } catch (error) {
      console.warn('Memory update failed:', error);
    }
  }
}

// Helper functions

function createLLM(modelId: string, config: { temperature?: number; maxTokens?: number }) {
  if (modelId.includes('anthropic') || modelId.includes('claude')) {
    return new ChatBedrockConverse({
      model: modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  } else if (modelId.includes('gpt') || modelId.includes('openai')) {
    return new ChatOpenAI({
      modelName: modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      openAIApiKey: process.env.OPENAI_API_KEY
    });
  } else {
    return new ChatBedrockConverse({
      model: modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
}

function convertToLangChainTools(
  toolConfigs: any[],
  context: ToolExecutionContext
): DynamicTool[] {
  return toolConfigs.map(config =>
    new DynamicTool({
      name: config.id,
      description: config.description || `Tool: ${config.id}`,
      func: async (input: string) => {
        try {
          const result = await unifiedToolRegistry.executeTool(config.id, input, context);
          return result.success ? result.result : result.error || 'Tool execution failed';
        } catch (error) {
          return `Tool error: ${(error as Error).message}`;
        }
      }
    })
  );
}

function convertMessagesToLangChain(messages: { role: string; content: string }[]): BaseMessage[] {
  return messages.map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content);
    } else {
      return new AIMessage(msg.content);
    }
  });
}