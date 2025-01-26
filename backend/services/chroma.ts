import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';
import { ollamaService } from './ollama';

class ChromaService {
  private client: ChromaClient;
  private collection: any;

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://chroma:8000'
    });
    this.initCollection().catch(err => {
      console.error('Error initializing ChromaDB collection:', err);
    });
  }

  private async initCollection() {
    try {
      console.log('Connecting to ChromaDB at:', process.env.CHROMA_URL || 'http://chroma:8000');
      this.collection = await this.client.getOrCreateCollection({
        name: "mfu_docs",
      });
      console.log('ChromaDB collection initialized successfully');
    } catch (error) {
      console.error('Error initializing ChromaDB collection:', error);
      // ไม่ throw error เพื่อให้ service ยังทำงานต่อได้
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

  async queryCollection(text: string, nResults: number = 5) {
    return this.collection.query({
      queryTexts: [text],
      nResults: nResults
    });
  }

  async query(text: string): Promise<string[]> {
    const results = await this.collection.query({
      queryTexts: [text],
      nResults: 1,
    });
    return results.documents?.[0] || [];
  }
}

export const chromaService = new ChromaService(); 