/**
 * Chroma Service stub - Direct API calls to RAG service used in LangGraph
 */

export const chromaService = {
  searchCollection: async (collectionName: string, query: string, nResults: number = 5) => {
    return { documents: [], metadatas: [] };
  },
  embedText: async (text: string) => {
    return [];
  },
  queryCollection: async (collectionName: string, queryEmbeddings: any[], nResults: number = 5) => {
    return { documents: [], metadatas: [], distances: [] };
  },
  getDocuments: async (collectionName: string) => {
    return { documents: [], metadatas: [], ids: [] };
  },
  addToCollection: async (collectionName: string, documents: string[], metadatas: any[], ids: string[]) => {
    console.warn('chromaService.addToCollection stub');
  }
};
