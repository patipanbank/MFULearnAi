import { Tool } from 'langchain/tools';
import { DynamicStructuredTool, StructuredTool } from '@langchain/core/tools';
import { createRetrieverTool as langchainCreateRetrieverTool } from 'langchain/tools/retriever';
import { Embeddings } from '@langchain/core/embeddings';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';

// Tool registry
const TOOL_REGISTRY: Tool[] = [];

/**
 * Get tools for a specific session, รองรับ retriever tool production
 * @param sessionId
 * @param collectionNames รายชื่อ knowledge base/collection ที่ต้องการ retriever tool
 * @param vectorStores mapping { [collectionName]: vectorStoreInstance }
 */
export function getToolsForSession(sessionId: string, collectionNames: string[] = [], vectorStores: Record<string, any> = {}): Tool[] {
  const tools = [...TOOL_REGISTRY];
  // เพิ่ม retriever tool สำหรับแต่ละ collection ที่มี vectorStore จริง
  for (const col of collectionNames) {
    if (vectorStores[col]) {
      tools.push(createRetrieverTool(col, vectorStores[col]));
    }
  }
  return tools;
}

/**
 * Create a retriever tool for a collection (production)
 * @param collectionName
 * @param vectorStore (เช่น Chroma, Pinecone, OpenSearch)
 */
export function createRetrieverTool(collectionName: string, vectorStore: any): Tool {
  const retriever = vectorStore.asRetriever({
    searchType: 'similarity',
    k: 5,
  });
  const tool = langchainCreateRetrieverTool(
    retriever,
    {
      name: `search_${collectionName}`,
      description: `Search and retrieve information from the ${collectionName} knowledge base. Use this when you need specific information.`
    }
  );
  return tool as unknown as Tool;
}

/**
 * Get Bedrock embeddings instance (production)
 */
export function getBedrockEmbeddings(): Embeddings {
  // TODO: Implement Bedrock embeddings production logic
  return {
    embedDocuments: async (documents: string[]) => {
      // เรียก bedrockService.createBatchTextEmbeddings จริง
      return documents.map(() => new Array(1536).fill(0));
    },
    embedQuery: async (text: string) => {
      return new Array(1536).fill(0);
    },
  } as Embeddings;
} 