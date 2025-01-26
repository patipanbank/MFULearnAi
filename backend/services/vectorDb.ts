import { ChromaClient, Collection, CreateCollectionParams } from 'chromadb';

export class VectorDBService {
  private client: ChromaClient;
  private collection!: Collection;
  private embedder: any;

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_HOST
    });
    this.initCollection();
    this.initEmbedder();
  }

  private async initEmbedder() {
    const { pipeline } = await import('@xenova/transformers');
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  private async initCollection() {
    try {
      this.collection = await this.client.createCollection({
        name: 'mfu_knowledge',
        metadata: { description: 'MFU knowledge base' }
      });
    } catch (error) {
      this.collection = await this.client.getCollection({
        name: 'mfu_knowledge',
        embeddingFunction: { generate: this.generateEmbedding }
      });
    }
  }

  private async generateEmbedding(texts: string[]): Promise<number[][]> {
    const embeddings = await Promise.all(texts.map(async (text) => {
      const output = await this.embedder(text);
      return Array.from(output.data) as number[];
    }));
    return embeddings;
  }

  async addDocument(text: string, metadata: any) {
    const embeddings = await this.generateEmbedding([text]);
    await this.collection.add({
      ids: [metadata.id],
      embeddings: embeddings,
      metadatas: [metadata],
      documents: [text]
    });
  }

  async querySimular(query: string, limit: number = 5) {
    const embeddings = await this.generateEmbedding([query]);
    return await this.collection.query({
      queryEmbeddings: embeddings,
      nResults: limit
    });
  }
} 