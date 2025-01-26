import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Document } from "@langchain/core/documents";
import KnowledgeBase from '../models/KnowledgeBase';
import AIModel from '../models/AIModel';

export class VectorStoreManager {
  private static instance: VectorStoreManager;
  private stores: Map<string, Chroma> = new Map();

  private constructor() {}

  static getInstance(): VectorStoreManager {
    if (!VectorStoreManager.instance) {
      VectorStoreManager.instance = new VectorStoreManager();
    }
    return VectorStoreManager.instance;
  }

  async getStore(knowledgeBaseId: string): Promise<Chroma> {
    if (!this.stores.has(knowledgeBaseId)) {
      const kb = await KnowledgeBase.findById(knowledgeBaseId).populate('baseModelId');
      if (!kb) {
        throw new Error('Knowledge base not found');
      }

      const model = kb.baseModelId as any;
      
      const embeddings = new OllamaEmbeddings({
        model: model.modelType,
        baseUrl: "http://ollama:11434"
      });
      
      const store = await Chroma.fromDocuments(
        [], 
        embeddings,
        {
          collectionName: kb.collectionName,
          url: process.env.CHROMA_URL || "http://chroma:8000"
        }
      );
      this.stores.set(knowledgeBaseId, store);
      return store;
    }
    return this.stores.get(knowledgeBaseId)!;
  }

  async addDocuments(knowledgeBaseId: string, documents: Document[]): Promise<void> {
    const store = await this.getStore(knowledgeBaseId);
    await store.addDocuments(documents);
  }
} 