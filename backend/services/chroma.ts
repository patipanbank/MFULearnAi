import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';
import { ollamaService } from './ollama';

class ChromaService {
  private client: ChromaClient;
  private collection: any;

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    });
    this.initCollection();
  }

  private async initCollection() {
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: "mfu_documents",
        embeddingFunction: {
          generate: async (texts: string[]) => {
            const embeddings = await Promise.all(
              texts.map(text => ollamaService.generateEmbedding(text))
            );
            return embeddings;
          }
        }
      });
    } catch (error) {
      console.error('Error initializing ChromaDB collection:', error);
      throw error;
    }
  }

  async addDocuments(documents: Array<{text: string, metadata: any}>) {
    try {
      const ids = documents.map((_, i) => `doc_${Date.now()}_${i}`);
      const texts = documents.map(doc => doc.text);
      const metadatas = documents.map(doc => doc.metadata);

      await this.collection.add({
        ids,
        documents: texts,
        metadatas
      });
    } catch (error) {
      console.error('Error adding documents to ChromaDB:', error);
      throw error;
    }
  }

  async queryDocuments(query: string, n_results: number = 5) {
    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: n_results
      });
      return results;
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      throw error;
    }
  }
}

export const chromaService = new ChromaService(); 