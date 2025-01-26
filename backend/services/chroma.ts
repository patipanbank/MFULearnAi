import { ChromaClient, OpenAIEmbeddingFunction, Collection, IncludeEnum } from 'chromadb';
import { ollamaService } from './ollama';
import { EmbeddingService } from './embedding';

export class ChromaService {
  private client: ChromaClient;
  private collection!: Collection;
  private embedder: EmbeddingService;

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://chroma:8000'
    });
    this.embedder = new EmbeddingService();
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

      // แปลงข้อความเป็น vectors
      const embeddings = await Promise.all(
        texts.map(text => this.embedder.embed(text))
      );

      console.log('Adding documents:', {
        ids,
        embeddings: embeddings.length,
        texts,
        metadatas
      });

      // เพิ่มข้อมูลเข้า ChromaDB
      await this.collection.add({
        ids: ids,
        embeddings: embeddings,
        metadatas: metadatas,
        documents: texts
      });

    } catch (error) {
      console.error('Error adding documents:', error);
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
    try {
      // แปลงข้อความเป็น vector
      const embedding = await this.embedder.embed(text);
      
      // ค้นหาด้วย vector similarity
      const results = await this.collection.query({
        queryEmbeddings: [embedding],
        nResults: 1,
        include: ["documents"] as IncludeEnum[]
      });

      if (!results.documents || !results.documents[0]) {
        console.log('No results found');
        return [];
      }

      return results.documents[0].filter((doc): doc is string => doc !== null);
    } catch (error) {
      console.error('ChromaDB query error:', error);
      throw error;
    }
  }

  async checkCollection() {
    try {
      const count = await this.collection.count();
      console.log('Documents in collection:', count);
      return count;
    } catch (error) {
      console.error('Error checking collection:', error);
      throw error;
    }
  }
}

export const chromaService = new ChromaService(); 