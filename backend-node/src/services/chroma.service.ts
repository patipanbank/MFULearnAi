import { Injectable, Logger } from '@nestjs/common';
import { ChromaClient } from 'chromadb';

export interface ChromaDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name);
  private readonly client: ChromaClient;

  constructor() {
    const url = process.env.CHROMA_URL || 'http://localhost:8000';
    this.logger.debug(`Connecting to ChromaDB at ${url}`);
    this.client = new ChromaClient({ path: url });
  }

  private async getCollection(name: string) {
    return this.client.getOrCreateCollection({ name });
  }

  async addDocuments(collectionName: string, docs: ChromaDocument[]): Promise<void> {
    if (!docs.length) return;
    const col = await this.getCollection(collectionName);
    await col.add({
      ids: docs.map((d) => d.id),
      documents: docs.map((d) => d.text),
      embeddings: docs.map((d) => d.embedding),
      metadatas: docs.map((d) => d.metadata ?? {}),
    });
  }

  async queryCollection(collectionName: string, embedding: number[], topK = 5) {
    const col = await this.getCollection(collectionName);
    return col.query({ queryEmbeddings: [embedding], nResults: topK, include: ['documents', 'metadatas'] });
  }

  async getDocuments(collectionName: string, limit = 100, offset = 0) {
    const col = await this.getCollection(collectionName);
    return col.get({ limit, offset, include: ['documents', 'metadatas'] });
  }

  async deleteDocuments(collectionName: string, ids: string[]) {
    const col = await this.getCollection(collectionName);
    await col.delete({ ids });
  }

  async countDocuments(collectionName: string): Promise<number> {
    const col = await this.getCollection(collectionName);
    // The Chroma JS client currently doesn't expose a direct count method; workaround via get with limit 1
    const res = await col.get({ limit: 1000000, include: [] });
    return res?.ids?.length ?? 0;
  }

  async deleteCollection(collectionName: string): Promise<void> {
    try {
      await this.client.deleteCollection({ name: collectionName });
    } catch (err) {
      this.logger.warn(`deleteCollection ${collectionName} failed: ${err}`);
    }
  }
} 