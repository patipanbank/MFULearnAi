import { DynamicTool } from "@langchain/core/tools";
import logger from "../../utils/logger";
import { ragClient } from "../../clients/ragClient";
import { ChatModel } from "../../models/chat";

/**
 * Tool Registry
 * Manages available tools for agents
 * Tools are registered dynamically based on context
 */

export interface ToolContext {
  userId: string;
  chatId: string;
  collectionNames?: string[];
  allowedTools?: string[];
}

/**
 * Memory Tool - Search conversation history
 */
function createMemoryTool(context: ToolContext): DynamicTool {
  return new DynamicTool({
    name: "search_memory",
    description: "Search through the conversation history to find relevant past messages. Input should be a search query string.",
    func: async (query: string) => {
      logger.info('🔍 Memory Tool: Searching conversation history', {
        chatId: context.chatId,
        query: query.substring(0, 100),
      });

      try {
        // Search in chat history
        const chat = await ChatModel.findById(context.chatId).lean();

        if (!chat || !chat.messages || chat.messages.length === 0) {
          return `No conversation history found for this chat.`;
        }

        // Simple keyword search in message content
        const lowerQuery = query.toLowerCase();
        const relevantMessages = chat.messages
          .filter((msg: any) =>
            msg.content.toLowerCase().includes(lowerQuery)
          )
          .slice(-5); // Get last 5 matches

        if (relevantMessages.length === 0) {
          return `No messages found matching "${query}" in conversation history.`;
        }

        const results = relevantMessages
          .map((msg: any, idx: number) =>
            `${idx + 1}. [${msg.role}]: ${msg.content.substring(0, 200)}...`
          )
          .join('\n\n');

        return `Found ${relevantMessages.length} relevant message(s):\n\n${results}`;

      } catch (error: any) {
        logger.error('❌ Memory Tool: Search failed', {
          chatId: context.chatId,
          error: error.message,
        });
        return `Error searching memory: ${error.message}`;
      }
    },
  });
}

/**
 * RAG Tool - Retrieve from knowledge base
 */
function createRAGTool(context: ToolContext): DynamicTool {
  return new DynamicTool({
    name: "rag_retrieval",
    description: "Retrieve relevant information from the knowledge base. Use this when you need factual information from documents. Input should be a search query.",
    func: async (query: string) => {
      logger.info('📚 RAG Tool: Retrieving from knowledge base', {
        chatId: context.chatId,
        collections: context.collectionNames,
        query: query.substring(0, 100),
      });

      try {
        const collectionName = context.collectionNames?.[0] || 'default';

        // Call RAG service
        const results = await ragClient.search(query, {
          userId: context.userId,
          collectionName,
          topK: 5,
          minScore: 0.7,
        });

        if (!results || results.length === 0) {
          return `No relevant information found in knowledge base for "${query}".`;
        }

        // Format results
        const formattedResults = results
          .map((result: any, idx: number) => {
            const content = result.content || result.text || result.document || '';
            const score = result.score || result.similarity || 0;
            return `${idx + 1}. [Score: ${score.toFixed(2)}]\n${content.substring(0, 300)}...`;
          })
          .join('\n\n');

        return `Found ${results.length} relevant document(s):\n\n${formattedResults}`;

      } catch (error: any) {
        logger.error('❌ RAG Tool: Retrieval failed', {
          chatId: context.chatId,
          error: error.message,
        });
        return `Error retrieving from knowledge base: ${error.message}`;
      }
    },
  });
}

/**
 * Web Search Tool - Search the internet
 */
function createWebSearchTool(context: ToolContext): DynamicTool {
  return new DynamicTool({
    name: "web_search",
    description: "Search the internet for current information. Use this for recent events or information not in the knowledge base. Input should be a search query.",
    func: async (query: string) => {
      logger.info('🌐 Web Search Tool: Searching internet', {
        chatId: context.chatId,
        query: query.substring(0, 100),
      });

      try {
        // TODO: Implement web search
        // For now, return placeholder
        return `Web search for "${query}" - Web search service not yet implemented`;

      } catch (error: any) {
        logger.error('❌ Web Search Tool: Search failed', {
          chatId: context.chatId,
          error: error.message,
        });
        return `Error searching web: ${error.message}`;
      }
    },
  });
}

/**
 * Calculator Tool - Perform calculations
 */
function createCalculatorTool(context: ToolContext): DynamicTool {
  return new DynamicTool({
    name: "calculator",
    description: "Perform mathematical calculations. Input should be a mathematical expression like '2 + 2' or '10 * 5'.",
    func: async (expression: string) => {
      logger.info('🔢 Calculator Tool: Evaluating expression', {
        chatId: context.chatId,
        expression,
      });

      try {
        // Safe evaluation (simple cases only)
        const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');

        if (sanitized !== expression) {
          return "Invalid mathematical expression. Only numbers and operators (+, -, *, /, parentheses) are allowed.";
        }

        // eslint-disable-next-line no-eval
        const result = eval(sanitized);

        logger.info('✅ Calculator Tool: Calculation successful', {
          chatId: context.chatId,
          expression,
          result,
        });

        return `${expression} = ${result}`;

      } catch (error: any) {
        logger.error('❌ Calculator Tool: Calculation failed', {
          chatId: context.chatId,
          error: error.message,
        });
        return `Error calculating: ${error.message}`;
      }
    },
  });
}

/**
 * Tool Registry Class
 */
class ToolRegistry {
  private availableTools: Map<string, (context: ToolContext) => DynamicTool> = new Map();

  constructor() {
    // Register default tools
    this.registerTool('search_memory', createMemoryTool);
    this.registerTool('rag_retrieval', createRAGTool);
    this.registerTool('web_search', createWebSearchTool);
    this.registerTool('calculator', createCalculatorTool);

    logger.info('✅ Tool registry initialized', {
      toolCount: this.availableTools.size,
      tools: Array.from(this.availableTools.keys()),
    });
  }

  /**
   * Register a new tool
   */
  registerTool(name: string, factory: (context: ToolContext) => DynamicTool) {
    this.availableTools.set(name, factory);
    logger.debug('🔧 Tool registered', { name });
  }

  /**
   * Get tools for a specific context
   */
  async getTools(context: ToolContext): Promise<DynamicTool[]> {
    const tools: DynamicTool[] = [];

    // Get all tool names
    let toolNames = Array.from(this.availableTools.keys());

    // Filter by allowed tools if specified
    if (context.allowedTools && context.allowedTools.length > 0) {
      toolNames = toolNames.filter(name => context.allowedTools!.includes(name));
    }

    // Create tool instances
    for (const name of toolNames) {
      const factory = this.availableTools.get(name);
      if (factory) {
        const tool = factory(context);
        tools.push(tool);
      }
    }

    logger.info('🔧 Tools prepared for agent', {
      chatId: context.chatId,
      requestedTools: context.allowedTools,
      toolCount: tools.length,
      toolNames: tools.map(t => t.name),
    });

    return tools;
  }

  /**
   * Check if a tool is available
   */
  hasTool(name: string): boolean {
    return this.availableTools.has(name);
  }

  /**
   * Get all available tool names
   */
  getAvailableToolNames(): string[] {
    return Array.from(this.availableTools.keys());
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
