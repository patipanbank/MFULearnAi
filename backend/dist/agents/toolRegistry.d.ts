import { Tool } from 'langchain/tools';
import { Embeddings } from '@langchain/core/embeddings';
import { Chroma } from '@langchain/community/vectorstores/chroma';
export declare function getToolsForSession(sessionId: string): Tool[];
export declare function addChatMemory(sessionId: string, messages: any[]): void;
export declare function clearChatMemory(sessionId: string): void;
export declare function getMemoryStats(): any;
export declare function createRetrieverTool(collectionName: string, vectorStore: Chroma): Tool;
export declare function getBedrockEmbeddings(): Embeddings;
//# sourceMappingURL=toolRegistry.d.ts.map