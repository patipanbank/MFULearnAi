import { AIMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { RedisChatMessageHistory } from '@langchain/community/stores/message/redis';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createClient } from 'redis';

// Agent factories
import { getLLM } from '../agents/llmFactory';
import { buildPrompt } from '../agents/promptFactory';
import { createAgent } from '../agents/agentFactory';
import { getToolsForSession, createRetrieverTool } from '../agents/toolRegistry';

// Services
import { usageService } from './usageService';
import { ChatModel } from '../models/chat';

export class LangChainChatService {
  
  async clearChatMemory(sessionId: string): Promise<void> {
    try {
      // Clear Redis memory
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        const redisClient = createClient({ url: redisUrl });
        await redisClient.connect();
        const history = new RedisChatMessageHistory({ sessionId, client: redisClient });
        await history.clear();
        await redisClient.disconnect();
        console.log(`🧹 Cleared Redis memory for session ${sessionId}`);
      }
      
      // Clear memory tool
      // (ลบการเรียกใช้ toolRegistry.clearChatMemory ที่ไม่ถูกต้องออก)
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
    maxTokens: number = 4000,
    vectorStores: Record<string, any> = {}, // เพิ่ม vectorStores production
    agentType: string = 'single' // อ่านจาก agent config จริง
  ): AsyncGenerator<string> {
    let redisClient: any = undefined;
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
      // 2) Tools – dynamic registry + retriever tool production
      let tools = getToolsForSession(sessionId, collectionNames, vectorStores);
      // เพิ่ม retriever tool สำหรับแต่ละ collection (production)
      let retrieverTools: any[] = [];
      if (collectionNames && collectionNames.length > 0) {
        for (const col of collectionNames) {
          if (vectorStores[col]) {
            retrieverTools.push(createRetrieverTool(col, vectorStores[col]));
          }
        }
      }
      tools = [...tools, ...retrieverTools];

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
      // 4) Agent executor (เลือกตาม agent config production)
      // agentType อ่านจาก agent config จริง (single, sequential, parallel, hierarchical)
      let agentExecutor;
      if (agentType === 'single') {
        agentExecutor = createAgent(llm, tools, prompt);
      } else if (agentType === 'sequential') {
        // TODO: ใช้ LangChain graph/flow จริงสำหรับ sequential agent
        agentExecutor = createAgent(llm, tools, prompt); // fallback single
      } else if (agentType === 'parallel') {
        // TODO: ใช้ LangChain graph/flow จริงสำหรับ parallel agent
        agentExecutor = createAgent(llm, tools, prompt); // fallback single
      } else {
        agentExecutor = createAgent(llm, tools, prompt);
      }

      // ------------------------------------------------------------------
      // 5) Memory – hybrid approach: Redis for recent, Embedding tool for long-term
      // ------------------------------------------------------------------
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error("REDIS_URL must be configured for chat history support.");
      }

      if (redisUrl) {
        redisClient = createClient({ url: redisUrl });
        await redisClient.connect();
      }

      // Create Redis chat message history
      const createRedisHistory = (sessionId: string) => {
        if (!redisClient) throw new Error('Redis client not initialized');
        return new RedisChatMessageHistory({ sessionId, client: redisClient });
      };

      // Smart memory management
      let agentWithHistory: RunnableWithMessageHistory<any, any>;
      
      try {
        const chatHistory = await ChatModel.findById(sessionId);
        const messageCount = chatHistory?.messages?.length || 0;
        
        // Check if Redis memory exists
        let redisMemoryExists = false;
        try {
          const history = new RedisChatMessageHistory({ sessionId, client: redisClient });
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
            const history = new RedisChatMessageHistory({ sessionId, client: redisClient });
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
          // (ลบการเรียก addChatMemory ที่ไม่ได้ import)
          // สามารถใช้ memoryService.addChatMemory ได้ถ้าต้องการ
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
        let outVal: any;
        if (typeof res === 'object' && res.output !== undefined) {
          outVal = res.output;
        } else {
          outVal = res;
        }

        // ถ้าเป็น list ให้ join content
        if (Array.isArray(outVal)) {
          outVal = outVal.map((m: any) =>
            m && typeof m === 'object' && 'content' in m && m.content
              ? String(m.content)
              : String(m)
          ).join('\n');
        }

        // fallback เป็น string เสมอ
        if (outVal === undefined || outVal === null) {
          return '';
        }
        return String(outVal);
      };

      const finalRunnable = agentWithHistory
        .pipe(extractOutput)
        .pipe(new StringOutputParser());

      // Prepare the input for the agent
      const agentInput = { input: message };
      
      // Configuration for the session history
      const config = { 
        configurable: { sessionId },
        version: "v1" as const
      };

      // Stream the agent's response
      let inputTokens = 0;
      let outputTokens = 0;
      let contentReceived = false;
      let fallbackText = "";
      
      // ฟังก์ชันช่วยดึงข้อความจาก chunk (รองรับ string, object, list)
      function extractText(chunkText: any): string {
        if (Array.isArray(chunkText)) {
          return chunkText.map(extractText).join('');
        }
        if (chunkText && typeof chunkText === 'object') {
          // รองรับกรณี content เป็น array หรือ object
          if ('content' in chunkText) {
            if (typeof chunkText.content === 'string') {
              return chunkText.content;
            }
            if (Array.isArray(chunkText.content)) {
              return chunkText.content.map(extractText).join('');
            }
            if (typeof chunkText.content === 'object') {
              return extractText(chunkText.content);
            }
          }
          if ('text' in chunkText && typeof chunkText.text === 'string') {
            return chunkText.text;
          }
          // fallback: stringify object
          return JSON.stringify(chunkText);
        }
        if (chunkText === undefined || chunkText === null) {
          return '';
        }
        return String(chunkText);
      }

      for await (const event of finalRunnable.streamEvents(agentInput, config)) {
        const kind = event.event;
        console.log(`Event received: ${kind}`);
        
        // Handle different types of streaming events
        if (kind === "on_chat_model_stream") {
          const chunk = event.data?.chunk;
          if (chunk) {
            const contentString = extractText(chunk);
            if (contentString && contentString.trim() !== "") {
              const wsMessage = {
                type: 'chunk',
                data: {
                  id: Date.now().toString() + '_assistant',
                  role: 'assistant',
                  content: contentString,
                  timestamp: new Date(),
                  isStreaming: true,
                  isComplete: false,
                  toolUsage: [],
                  images: []
                }
              };
              yield JSON.stringify(wsMessage);
            }
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
    } finally {
      if (redisClient) {
        await redisClient.disconnect();
      }
    }
  }
}

export const langchainChatService = new LangChainChatService(); 