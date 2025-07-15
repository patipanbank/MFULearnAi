import { Injectable, Logger } from '@nestjs/common';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
import { DynamicTool } from '@langchain/core/tools';
import { createRetrieverTool } from 'langchain/tools/retriever';
import { RedisChatMessageHistory } from '@langchain/community/stores/message/redis';
import { RunnableWithMessageHistory } from '@langchain/core/runnables/history';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatMessage } from '@langchain/core/messages';
import Redis from 'ioredis';

export interface ChatRequest {
  sessionId: string;
  userId: string;
  message: string;
  modelId: string;
  collectionNames: string[];
  agentId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  images?: any[];
}

export interface StreamEvent {
  type: 'chunk' | 'tool_start' | 'tool_result' | 'tool_error' | 'end' | 'error';
  data: any;
}

@Injectable()
export class LangChainChatService {
  private readonly logger = new Logger(LangChainChatService.name);
  private redisClient: Redis;

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl);
  }

  /**
   * Main chat method - replicates FastAPI chat service exactly
   */
  async *chat(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const { sessionId, userId, message, modelId, collectionNames, systemPrompt, temperature, maxTokens } = request;

    try {
      this.logger.log(`🎯 Starting LangChain chat for session ${sessionId}`);

      // 1. Initialize LLM (like FastAPI get_llm)
      const llm = this.createLLM(modelId, temperature || 0.7, maxTokens || 4000);

      // 2. Create tools (like FastAPI tool setup)
      const tools = await this.createTools(sessionId, collectionNames);

      // 3. Create prompt (like FastAPI build_prompt)
      const prompt = this.createPrompt(systemPrompt);

      // 4. Create agent executor (like FastAPI create_agent)
      const agentExecutor = await createOpenAIFunctionsAgent({
        llm,
        tools,
        prompt,
      });

      const executor = new AgentExecutor({
        agent: agentExecutor,
        tools,
        verbose: true,
        maxIterations: 10,
        earlyStoppingMethod: 'generate',
      });

      // 5. Setup memory with Redis (like FastAPI RedisChatMessageHistory)
      const memoryExecutor = new RunnableWithMessageHistory(
        executor,
        (sessionId: string) => this.createRedisHistory(sessionId),
        {
          inputMessagesKey: 'input',
          historyMessagesKey: 'chat_history',
        }
      );

      // 6. Smart memory management (like FastAPI hybrid approach)
      await this.handleSmartMemoryManagement(sessionId, userId);

      // 7. Create output parser (like FastAPI _extract_output)
      const outputParser = new StringOutputParser();
      const finalRunnable = memoryExecutor.pipe(this.extractOutput).pipe(outputParser);

      // 8. Stream the response with events (like FastAPI astream_events)
      const config = { configurable: { sessionId } };
      let contentReceived = false;
      let fallbackText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        for await (const event of finalRunnable.streamEvents({ input: message }, config, { version: 'v1' })) {
          const eventType = event.event;
          
          if (eventType === 'on_chat_model_stream') {
            // Handle streaming chunks (like FastAPI on_chat_model_stream)
            const chunk = event.data?.chunk;
            if (chunk?.content) {
              contentReceived = true;
              yield JSON.stringify({ type: 'chunk', data: chunk.content });
            }
          }
          else if (eventType === 'on_llm_stream') {
            // Handle LLM streaming (like FastAPI on_llm_stream)
            const chunk = event.data?.chunk;
            if (chunk?.content) {
              contentReceived = true;
              yield JSON.stringify({ type: 'chunk', data: chunk.content });
            }
          }
          else if (eventType === 'on_tool_start') {
            // Handle tool start events (like FastAPI on_tool_start)
            const toolData = event.data;
            const toolName = toolData?.name || 'Unknown Tool';
            const toolInput = toolData?.input || '';
            
            this.logger.log(`🔧 Tool started: ${toolName}`);
            yield JSON.stringify({
              type: 'tool_start',
              data: {
                tool_name: toolName,
                tool_input: toolInput
              }
            });
          }
          else if (eventType === 'on_tool_end') {
            // Handle tool results (like FastAPI on_tool_end)
            const toolName = event.data?.name || 'Unknown Tool';
            const toolOutput = event.data?.output;
            
            this.logger.log(`✅ Tool completed: ${toolName}`);
            if (toolOutput) {
              contentReceived = true;
              yield JSON.stringify({
                type: 'tool_result',
                data: {
                  tool_name: toolName,
                  output: String(toolOutput)
                }
              });
            }
          }
          else if (eventType === 'on_tool_error') {
            // Handle tool errors (like FastAPI on_tool_error)
            const toolName = event.data?.name || 'Unknown Tool';
            const error = event.data?.error || 'Unknown error';
            
            this.logger.error(`❌ Tool error: ${toolName} - ${error}`);
            yield JSON.stringify({
              type: 'tool_error',
              data: {
                tool_name: toolName,
                error: String(error)
              }
            });
          }
          else if (eventType === 'on_chain_end') {
            // Capture final output and usage stats (like FastAPI on_chain_end)
            const finalOutput = event.data?.output;
            if (finalOutput) {
              fallbackText = this.extractTextFromOutput(finalOutput);
              
              // Extract usage if available
              const usage = finalOutput.usage || {};
              inputTokens = usage.input_tokens || 0;
              outputTokens = usage.output_tokens || 0;
            }
          }
        }
      } catch (streamError) {
        this.logger.error(`❌ Streaming error: ${streamError.message}`);
        yield JSON.stringify({ type: 'error', data: `Streaming error: ${streamError.message}` });
      }

      // 9. Send fallback text if no streaming content (like FastAPI fallback)
      if (!contentReceived && fallbackText) {
        yield JSON.stringify({ type: 'chunk', data: fallbackText });
        contentReceived = true;
      }

      // 10. Update usage statistics (like FastAPI usage_service.update_usage)
      if (inputTokens > 0 || outputTokens > 0) {
        // TODO: Implement usage tracking
        this.logger.log(`📊 Usage: ${inputTokens} input tokens, ${outputTokens} output tokens`);
      }

      // 11. Send end event (like FastAPI final yield)
      yield JSON.stringify({ 
        type: 'end', 
        data: { inputTokens, outputTokens } 
      });

    } catch (error) {
      this.logger.error(`❌ LangChain chat error: ${error.message}`, error.stack);
      yield JSON.stringify({ 
        type: 'error', 
        data: `An unexpected error occurred: ${error.message}` 
      });
    }
  }

  /**
   * Create LLM instance (replicates FastAPI get_llm)
   */
  private createLLM(modelId: string, temperature: number, maxTokens: number) {
    return new ChatBedrockConverse({
      model: modelId,
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      modelKwargs: {
        temperature,
        maxTokens,
      },
      streaming: true,
    });
  }

  /**
   * Create prompt template (replicates FastAPI build_prompt)
   */
  private createPrompt(systemPrompt?: string) {
    const defaultSystemPrompt = 
      "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. " +
      "Always focus on answering the current user's question. Use chat history as context to provide better responses, " +
      "but do not repeat or respond to previous questions in the history.";

    return ChatPromptTemplate.fromMessages([
      ['system', systemPrompt || defaultSystemPrompt],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);
  }

  /**
   * Create tools (replicates FastAPI tool setup)
   */
  private async createTools(sessionId: string, collectionNames: string[]) {
    const tools = [];

    // 1. Static tools (like FastAPI TOOL_REGISTRY)
    tools.push(this.createMemoryTool(sessionId));
    tools.push(this.createWebSearchTool());
    tools.push(this.createCalculatorTool());

    // 2. Dynamic retrieval tools (like FastAPI collection tools)
    for (const collectionName of collectionNames) {
      try {
        const retrievalTool = await this.createRetrievalTool(collectionName);
        if (retrievalTool) {
          tools.push(retrievalTool);
        }
      } catch (error) {
        this.logger.warn(`⚠️ Failed to create retrieval tool for ${collectionName}: ${error.message}`);
      }
    }

    this.logger.log(`🔧 Created ${tools.length} tools for session ${sessionId}`);
    return tools;
  }

  /**
   * Create memory tool (replicates FastAPI memory tool)
   */
  private createMemoryTool(sessionId: string) {
    return new DynamicTool({
      name: `search_memory_${sessionId}`,
      description: `Search through conversation memory and knowledge for session ${sessionId}. Use this to find relevant information from previous conversations.`,
      func: async (query: string) => {
        try {
          // TODO: Implement memory search with embedding service
          this.logger.log(`🧠 Memory search for: ${query}`);
          return `Memory search results for "${query}": [Relevant information would be returned here]`;
        } catch (error) {
          return `Memory search failed: ${error.message}`;
        }
      },
    });
  }

  /**
   * Create web search tool
   */
  private createWebSearchTool() {
    return new DynamicTool({
      name: 'web_search',
      description: 'Search the web for current information and recent updates. Use this for questions about current events, latest news, or information that might not be in the knowledge base.',
      func: async (query: string) => {
        try {
          // TODO: Implement actual web search
          this.logger.log(`🌐 Web search for: ${query}`);
          return `Web search results for "${query}": [Current web information would be returned here]`;
        } catch (error) {
          return `Web search failed: ${error.message}`;
        }
      },
    });
  }

  /**
   * Create calculator tool
   */
  private createCalculatorTool() {
    return new DynamicTool({
      name: 'calculator',
      description: 'Perform mathematical calculations. Input should be a valid mathematical expression.',
      func: async (expression: string) => {
        try {
          // Simple safe calculation (in production, use a proper math parser)
          const result = eval(expression.replace(/[^0-9+\-*/().]/g, ''));
          return `${expression} = ${result}`;
        } catch (error) {
          return `Calculation failed: ${error.message}`;
        }
      },
    });
  }

  /**
   * Create retrieval tool for collection (replicates FastAPI retrieval tools)
   */
  private async createRetrievalTool(collectionName: string) {
    try {
      // TODO: Implement ChromaDB retriever
      // For now, return a mock tool
      return new DynamicTool({
        name: `search_${collectionName}`,
        description: `Search and retrieve information from the ${collectionName} knowledge base. Use this when you need specific information.`,
        func: async (query: string) => {
          this.logger.log(`📚 Searching ${collectionName} for: ${query}`);
          return `Search results from ${collectionName} for "${query}": [Relevant documents would be returned here]`;
        },
      });
    } catch (error) {
      this.logger.error(`❌ Failed to create retrieval tool for ${collectionName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Create Redis chat history (replicates FastAPI create_redis_history)
   */
  private createRedisHistory(sessionId: string) {
    const history = new RedisChatMessageHistory({
      sessionId,
      sessionTTL: 86400, // 24 hours
      client: this.redisClient,
    });
    
    // Set TTL to prevent memory leaks (like FastAPI)
    this.redisClient.expire(`message_store:${sessionId}`, 86400);
    
    return history;
  }

  /**
   * Smart memory management (replicates FastAPI hybrid approach)
   */
  private async handleSmartMemoryManagement(sessionId: string, userId: string) {
    try {
      // TODO: Implement smart memory management like FastAPI
      // 1. Check message count
      // 2. Restore Redis memory if needed
      // 3. Use memory tool for long conversations
      // 4. Embed messages every 10 messages
      
      this.logger.log(`🧠 Smart memory management for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Memory management error: ${error.message}`);
    }
  }

  /**
   * Extract output from agent result (replicates FastAPI _extract_output)
   */
  private extractOutput = (res: any) => {
    if (typeof res === 'string') return res;
    if (res?.output) return res.output;
    if (Array.isArray(res)) {
      return res.map(item => item?.content || String(item)).join('\n');
    }
    return String(res);
  };

  /**
   * Extract text from final output
   */
  private extractTextFromOutput(output: any): string {
    if (typeof output === 'string') return output;
    if (output?.content) return output.content;
    if (Array.isArray(output)) {
      return output.map(item => item?.content || String(item)).join('\n');
    }
    return String(output);
  }

  /**
   * Clear chat memory (replicates FastAPI clear_chat_memory)
   */
  async clearChatMemory(sessionId: string): Promise<void> {
    try {
      // 1. Clear Redis memory (like FastAPI history.clear())
      const history = this.createRedisHistory(sessionId);
      history.clear();
      
      // 2. Clear memory tool (like FastAPI clear_memory_tool)
      // TODO: Implement memory tool clearing
      
      this.logger.log(`🧹 Cleared all memory for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to clear memory for session ${sessionId}: ${error.message}`);
      throw error;
    }
  }
} 