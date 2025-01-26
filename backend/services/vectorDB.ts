import { ChromaClient, Collection } from 'chromadb';

const dummyEmbeddingFunction = {
  encode: async (texts: string[]) => {
    return texts.map(() => new Array(384).fill(0));
  },
  generate: async (texts: string[]) => {
    return texts.map(() => new Array(384).fill(0));
  }
};

export class VectorDBService {
  private client: ChromaClient;
  
  constructor() {
    this.client = new ChromaClient();
  }

  // สร้าง collection ใหม่
  async createCollection(name: string) {
    return await this.client.createCollection({ name });
  }

  // เพิ่ม embeddings เข้า collection
  async addEmbeddings(collectionName: string, embeddings: number[][], texts: string[]) {
    const collection = await this.client.getCollection({ 
      name: collectionName,
      embeddingFunction: dummyEmbeddingFunction
    });
    
    await collection.add({
      embeddings: embeddings,
      documents: texts,
      ids: texts.map((_, i) => `id${i}`)
    });
  }

  // ค้นหาข้อมูลที่เกี่ยวข้องจาก vector
  async queryRelevantData(collectionName: string, queryEmbedding: number[], limit: number = 5) {
    const collection = await this.client.getCollection({ 
      name: collectionName,
      embeddingFunction: dummyEmbeddingFunction
    });
    return await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: limit
    });
  }
}