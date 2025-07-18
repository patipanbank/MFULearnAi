import { Tool } from '@langchain/core/tools';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createRetrieverTool as langchainCreateRetrieverTool } from 'langchain/tools/retriever';
import { Embeddings } from '@langchain/core/embeddings';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';

// Memory storage for chat sessions
const chatMemory: Map<string, any[]> = new Map();

// Tool registry
const TOOL_REGISTRY: Tool[] = [];

/**
 * Get tools for a specific session including memory tool
 */
export function getToolsForSession(sessionId: string): Tool[] {
  const tools = [...TOOL_REGISTRY];
  
  // Add memory tool if available for this session
  if (chatMemory.has(sessionId)) {
    const memoryTool = createMemoryTool(sessionId);
    tools.push(memoryTool);
  }
  
  return tools;
}

/**
 * Create a memory tool for searching chat history
 */
function createMemoryTool(sessionId: string): Tool {
  return new DynamicStructuredTool({
    name: 'search_chat_memory',
    description: 'Search through previous conversation history to find relevant information. Use this when you need to reference what was discussed earlier.',
    schema: z.object({
      query: z.string().describe('The search query to find relevant information in chat history')
    }),
    func: async ({ query }: { query: string }) => {
      const memory = chatMemory.get(sessionId) || [];
      if (memory.length === 0) {
        return 'No previous conversation history available.';
      }
      
      // Simple search implementation
      const relevantMessages = memory.filter(msg => 
        msg.content.toLowerCase().includes(query.toLowerCase())
      );
      
      if (relevantMessages.length === 0) {
        return 'No relevant information found in conversation history.';
      }
      
      return relevantMessages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
    },
  });
}

/**
 * Add chat memory for a session
 */
export function addChatMemory(sessionId: string, messages: any[]): void {
  chatMemory.set(sessionId, messages);
  console.log(`📚 Added ${messages.length} messages to memory for session ${sessionId}`);
}

/**
 * Clear chat memory for a session
 */
export function clearChatMemory(sessionId: string): void {
  chatMemory.delete(sessionId);
  console.log(`🧹 Cleared memory for session ${sessionId}`);
}

/**
 * Get memory statistics
 */
export function getMemoryStats(): any {
  return {
    totalSessions: chatMemory.size,
    totalMessages: Array.from(chatMemory.values()).reduce((sum, messages) => sum + messages.length, 0),
  };
}

/**
 * Create a retriever tool for a collection
 */
export function createRetrieverTool(collectionName: string, vectorStore: Chroma): Tool {
  const retriever = vectorStore.asRetriever({
    searchType: 'similarity',
    k: 5,
  });

  return langchainCreateRetrieverTool(
    retriever,
    {
      name: `search_${collectionName}`,
      description: `Search and retrieve information from the ${collectionName} knowledge base. Use this when you need specific information.`
    }
  );
}

/**
 * Get Bedrock embeddings instance
 */
export function getBedrockEmbeddings(): Embeddings {
  // For now, return a simple implementation
  // TODO: Implement proper Bedrock embeddings
  return {
    embedDocuments: async (documents: string[]) => {
      return documents.map(() => new Array(1536).fill(0));
    },
    embedQuery: async (text: string) => {
      return new Array(1536).fill(0);
    },
  } as Embeddings;
} 