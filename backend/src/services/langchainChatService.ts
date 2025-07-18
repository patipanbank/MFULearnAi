import { AIMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { RedisChatMessageHistory } from '@langchain/community/stores/message/redis';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Agent factories
import { getLLM } from '../agents/llmFactory';
import { buildPrompt } from '../agents/promptFactory';
import { createAgent } from '../agents/agentFactory';
import { getToolsForSession, addChatMemory } from '../agents/toolRegistry';

// Services
import { usageService } from './usageService';
import { ChatModel } from '../models/chat';

export class LangChainChatService {
  
  async clearChatMemory(sessionId: string): Promise<void> {
    try {
      // Clear Redis memory
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        const history = new RedisChatMessageHistory(sessionId, { url: redisUrl });
        await history.clear();
        console.log(`🧹 Cleared Redis memory for session ${sessionId}`);
      }
      
      // Clear memory tool
      const { clearChatMemory } = await import('../agents/toolRegistry');
      clearChatMemory(sessionId);
      console.log(`🧹 Cleared memory tool for session ${sessionId}`);
      
    } catch (error) {
      console.error(`Failed to clear memory for session ${sessionId}:`, error);
    }
  }

  private shouldUseMemoryTool(messageCount: number): boolean {
    // Use memory tool when there are more than 10 messages
    return messageCount > 10;
  }

  private shouldUseRedisMemory(messageCount: number): boolean {
    // Always use Redis memory for recent conversations
    return true;
  }

  private shouldEmbedMessages(messageCount: number): boolean {
    // Embed messages every 10 messages (10, 20, 30, etc.)
    return messageCount % 10 === 0;
  }

  async *chat(
    sessionId: string,
    userId: string,
    message: string,
    modelId: string,
    collectionNames: string[],
    images?: any[],
    systemPrompt?: string,
    temperature: number = 0.7,
    maxTokens: number = 4000
  ): AsyncGenerator<string> {
    
    try {
      // ------------------------------------------------------------------
      // 1) LLM
      // ------------------------------------------------------------------
      const llm = getLLM(
        modelId,
        true, // streaming
        temperature,
        maxTokens,
      );

      // ------------------------------------------------------------------
      // 2) Tools – static registry + dynamic retrieval tools + memory tool
      // ------------------------------------------------------------------
      const tools = getToolsForSession(sessionId);

      // Add retrieval tools for collections (if implemented)
      // TODO: Implement collection retrieval tools

      // ------------------------------------------------------------------
      // 3) Prompt
      // ------------------------------------------------------------------
      const defaultSystemPrompt = (
        "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. " +
        "Always focus on answering the current user's question. Use chat history as context to provide better responses, " +
        "but do not repeat or respond to previous questions in the history."
      );
      const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

      const prompt = buildPrompt(finalSystemPrompt);

      // ------------------------------------------------------------------
      // 4) Agent executor (without memory / output parsing)
      // ------------------------------------------------------------------
      const agentExecutor = createAgent(llm, tools, prompt);

      // ------------------------------------------------------------------
      // 5) Memory – hybrid approach: Redis for recent, Embedding tool for long-term
      // ------------------------------------------------------------------
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error("REDIS_URL must be configured for chat history support.");
      }

      // Create Redis chat message history
      const createRedisHistory = (sessionId: string) => {
        return new RedisChatMessageHistory(sessionId, { url: redisUrl });
      };

      // Smart memory management
      let agentWithHistory: RunnableWithMessageHistory<any, any>;
      
      try {
        const chatHistory = await ChatModel.findById(sessionId);
        const messageCount = chatHistory?.messages?.length || 0;
        
        // Check if Redis memory exists
        let redisMemoryExists = false;
        try {
          const history = new RedisChatMessageHistory(sessionId, { url: redisUrl });
          const messages = await history.getMessages();
          redisMemoryExists = messages.length > 0;
          console.log(`🔍 Redis memory check: ${messages.length} messages found`);
        } catch (error) {
          console.log(`⚠️ Redis memory check failed: ${error}`);
        }
        
        // Always use Redis memory for recent conversations
        agentWithHistory = new RunnableWithMessageHistory({
          runnable: agentExecutor,
          getMessageHistory: createRedisHistory,
          inputMessagesKey: "input",
          historyMessagesKey: "chat_history",
        });
        
        // If Redis memory is empty but we have messages, restore recent context
        if (!redisMemoryExists && chatHistory?.messages) {
          console.log(`🔄 Redis memory empty, restoring recent context for session ${sessionId}`);
          
          const recentMessages = chatHistory.messages.slice(-10);
          
          try {
            const history = new RedisChatMessageHistory(sessionId, redisUrl);
            for (const msg of recentMessages) {
              if (msg.role === "user") {
                await history.addUserMessage(msg.content);
              } else if (msg.role === "assistant") {
                await history.addAIChatMessage(msg.content);
              }
            }
            console.log(`💾 Restored ${recentMessages.length} messages to Redis memory`);
          } catch (error) {
            console.log(`❌ Failed to restore Redis memory: ${error}`);
          }
        }
        
        // Check if we should embed messages
        if (this.shouldEmbedMessages(messageCount) && chatHistory?.messages) {
          console.log(`🔄 Embedding messages for session ${sessionId} (message count: ${messageCount})`);
          
          const messagesForMemory = chatHistory.messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp?.toISOString() || null
          }));
          
          addChatMemory(sessionId, messagesForMemory);
          console.log(`📚 Embedded ${messagesForMemory.length} messages to memory tool for session ${sessionId}`);
        }
        
        if (this.shouldUseMemoryTool(messageCount)) {
          console.log(`🔍 Memory tool available for session ${sessionId} (${messageCount} messages)`);
        } else {
          console.log(`💾 Using Redis memory only for session ${sessionId} (${messageCount} messages)`);
        }
        
      } catch (error) {
        console.log(`⚠️ Failed to setup smart memory management: ${error}`);
        // Fallback to Redis memory
        agentWithHistory = new RunnableWithMessageHistory({
          runnable: agentExecutor,
          getMessageHistory: createRedisHistory,
          inputMessagesKey: "input",
          historyMessagesKey: "chat_history",
        });
      }

      // ------------------------------------------------------------------
      // 6) Output parsing – convert LangChain Messages to raw string for UI
      // ------------------------------------------------------------------
      const extractOutput = (res: any) => {
        if (typeof res === 'object' && res.output) {
          return res.output;
        }
        return res;
      };

      const finalRunnable = agentWithHistory
        .pipe(extractOutput)
        .pipe(new StringOutputParser());

      // Prepare the input for the agent
      const agentInput = { input: message };
      
      // Configuration for the session history
      const config = { 
        configurable: { session_id: sessionId },
        version: "v1" as const
      };

      // Stream the agent's response
      let inputTokens = 0;
      let outputTokens = 0;
      let contentReceived = false;
      let fallbackText = "";
      
      for await (const event of finalRunnable.streamEvents(agentInput, config)) {
        const kind = event.event;
        console.log(`Event received: ${kind}`);
        
        // Handle different types of streaming events
        if (kind === "on_chat_model_stream") {
          const chunk = event.data?.chunk;
          let chunkText: string | null = null;
          
          if (chunk) {
            if (typeof chunk === 'object' && 'output' in chunk && 'messages' in chunk) {
              chunkText = null; // ignore this chunk
            } else if (chunk.content) {
              chunkText = chunk.content;
            } else if (typeof chunk === 'object') {
              if (chunk.content && typeof chunk.content === 'string') {
                chunkText = chunk.content;
              } else if (chunk.text && typeof chunk.text === 'string') {
                chunkText = chunk.text;
              }
            }
          }
          
          if (chunkText) {
            contentReceived = true;
            yield JSON.stringify({ type: "chunk", data: chunkText });
          }
        }
        
        else if (kind === "on_tool_start") {
          const toolData = event.data as any;
          const toolName = toolData?.name || "Unknown Tool";
          const toolInput = toolData?.input || "";
          
          console.log(`🔧 Tool started: ${toolName}`);
          console.log(`🔧 Tool data:`, toolData);
          
          yield JSON.stringify({
            type: "tool_start",
            data: {
              tool_name: toolName,
              tool_input: toolInput
            }
          });
        }
        
        else if (kind === "on_tool_end") {
          const toolData = event.data as any;
          const toolName = toolData?.name || "Unknown Tool";
          const toolOutput = toolData?.output;
          console.log(`✅ Tool completed: ${toolName}`);
          
          if (toolOutput) {
            contentReceived = true;
            yield JSON.stringify({
              type: "tool_result",
              data: {
                tool_name: toolName,
                output: String(toolOutput)
              }
            });
          }
        }
        
        else if (kind === "on_tool_error") {
          const toolData = event.data as any;
          const toolName = toolData?.name || "Unknown Tool";
          const error = toolData?.error || "Unknown error";
          console.error(`❌ Tool error: ${toolName} - ${error}`);
          
          yield JSON.stringify({
            type: "tool_error",
            data: {
              tool_name: toolName,
              error: String(error)
            }
          });
        }
        
        else if (kind === "on_chain_end") {
          const finalOutput = event.data?.output;
          if (typeof finalOutput === 'object') {
            const usage = finalOutput.usage || {};
            const contentPiece = finalOutput.output || finalOutput;
            
            inputTokens = usage.input_tokens || 0;
            outputTokens = usage.output_tokens || 0;
            
            // Save fallback text
            if (Array.isArray(contentPiece)) {
              for (const msg of contentPiece.reverse()) {
                if (msg instanceof AIMessage && msg.content) {
                  fallbackText = typeof msg.content === 'string' ? msg.content : String(msg.content);
                  break;
                }
              }
              if (!fallbackText) {
                fallbackText = contentPiece
                  .map(m => {
                    const content = m.content;
                    return typeof content === 'string' ? content : String(content);
                  })
                  .join('\n');
              }
            } else if (contentPiece?.content) {
              const content = contentPiece.content;
              fallbackText = typeof content === 'string' ? content : String(content);
            } else {
              fallbackText = String(contentPiece);
            }
          }
        }
      }

      // Finalize the chat – if no streaming chunks were emitted, send fallback_text
      if (!contentReceived && fallbackText) {
        yield JSON.stringify({ type: "chunk", data: fallbackText });
        contentReceived = true;
      }

      // Update usage and send end event
      if (inputTokens > 0 || outputTokens > 0) {
        await usageService.updateUsage(userId, inputTokens, outputTokens);
      }

      yield JSON.stringify({ 
        type: "end", 
        data: { inputTokens, outputTokens } 
      });

    } catch (error) {
      console.error("Error during LangChain agent chat:", error);
      const errorMessage = JSON.stringify({ 
        type: "error", 
        data: `An unexpected error occurred: ${error}` 
      });
      yield errorMessage;
    }
  }
}

export const langchainChatService = new LangChainChatService(); 