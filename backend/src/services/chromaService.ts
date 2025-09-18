import { ChromaClient, Collection, EmbeddingFunction } from 'chromadb';
import { realEmbeddingService } from '../core/realEmbeddingService';

// Real embedding function using AWS Bedrock
class RealEmbeddingFunction implements EmbeddingFunction {
  constructor() {}

  async generate(texts: string[]): Promise<number[][]> {
    try {
      console.log(`🔧 Generating real embeddings for ${texts.length} texts`);
      return await realEmbeddingService.embedBatch(texts);
    } catch (error) {
      console.error('❌ Failed to generate embeddings:', error);
      // Fallback to zero vectors only if absolutely necessary
      console.warn('⚠️ Using zero vectors as fallback');
      return texts.map(() => new Array(1536).fill(0));
    }
  }
}

export class ChromaService {
  private client: ChromaClient;
  private embeddingFunction: RealEmbeddingFunction;

  constructor() {
    const url = process.env.CHROMA_URL || 'http://localhost:8000';
    this.client = new ChromaClient({ path: url });
    this.embeddingFunction = new RealEmbeddingFunction();
    console.log('🚀 ChromaService initialized with real embeddings');
  }

  async getOrCreateCollection(name: string): Promise<Collection> {
    try {
      return await this.client.getOrCreateCollection({ 
        name,
        embeddingFunction: this.embeddingFunction
      });
    } catch (e) {
      console.error(`[ChromaService] Error getOrCreateCollection:`, e);
      throw e;
    }
  }

  async listCollections() {
    try {
      return await this.client.listCollections();
    } catch (e) {
      console.error(`[ChromaService] Error listCollections:`, e);
      throw e;
    }
  }

  async deleteCollection(collectionName: string) {
    try {
      return await this.client.deleteCollection({ name: collectionName });
    } catch (e) {
      console.error(`[ChromaService] Error deleteCollection:`, e);
      throw e;
    }
  }

  async addToCollection(collectionName: string, documents: string[], embeddings: number[][], metadatas: any[], ids: string[]) {
    if (!documents || documents.length === 0) {
      console.log('[ChromaService] No documents to add. Skipping.');
      return;
    }
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      return await collection.add({
        ids,
        embeddings,
        documents,
        metadatas,
      });
    } catch (e) {
      console.error(`[ChromaService] Error addToCollection:`, e);
      throw e;
    }
  }

  async addDocuments(
    collectionName: string, 
    documentsWithEmbeddings: Array<{ document: string; embedding: number[]; metadata: any; id: string }>,
    onProgress?: (completed: number, total: number) => void
  ) {
    if (!documentsWithEmbeddings || documentsWithEmbeddings.length === 0) {
      console.log('[ChromaService] No documents to process. Skipping.');
      return;
    }

    console.log(`[ChromaService] Starting to add ${documentsWithEmbeddings.length} documents to '${collectionName}'`);
    
    // Dedup by id
    const seen = new Set();
    const docs = [];
    const metadatas = [];
    const embeddings = [];
    const ids = [];
    
    for (const item of documentsWithEmbeddings) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      docs.push(item.document);
      metadatas.push(item.metadata);
      embeddings.push(item.embedding);
      ids.push(item.id);
    }
    
    if (docs.length === 0) {
      console.log('[ChromaService] All documents are duplicates. Skipping.');
      return;
    }

    try {
      // สำหรับข้อมูลจำนวนมาก ให้แบ่งเป็น batch เพื่อป้องกัน memory overflow
      if (docs.length > 100) {
        await this.addDocumentsInBatches(collectionName, {
          ids,
          embeddings,
          documents: docs,
          metadatas,
        }, onProgress);
      } else {
        const collection = await this.getOrCreateCollection(collectionName);
        await collection.add({
          ids,
          embeddings,
          documents: docs,
          metadatas,
        });
        onProgress?.(docs.length, docs.length);
      }
      
      console.log(`[ChromaService] Successfully added ${docs.length} documents to '${collectionName}'.`);
    } catch (e) {
      console.error(`[ChromaService] Error addDocuments:`, e);
      throw e;
    }
  }

  private async addDocumentsInBatches(
    collectionName: string,
    data: {
      ids: string[];
      embeddings: number[][];
      documents: string[];
      metadatas: any[];
    },
    onProgress?: (completed: number, total: number) => void
  ) {
    const BATCH_SIZE = 50; // จำนวน documents ต่อ batch
    const { ids, embeddings, documents, metadatas } = data;
    const total = documents.length;
    let completed = 0;

    console.log(`[ChromaService] Adding ${total} documents in batches of ${BATCH_SIZE}`);
    
    const collection = await this.getOrCreateCollection(collectionName);
    
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const endIndex = Math.min(i + BATCH_SIZE, total);
      const batchIds = ids.slice(i, endIndex);
      const batchEmbeddings = embeddings.slice(i, endIndex);
      const batchDocuments = documents.slice(i, endIndex);
      const batchMetadatas = metadatas.slice(i, endIndex);
      
      try {
        console.log(`[ChromaService] Adding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(total / BATCH_SIZE)}`);
        
        await collection.add({
          ids: batchIds,
          embeddings: batchEmbeddings,
          documents: batchDocuments,
          metadatas: batchMetadatas,
        });
        
        completed += batchIds.length;
        onProgress?.(completed, total);
        
        // เล็กน้อยหน่วงเวลาเพื่อป้องกัน overwhelm ChromaDB
        if (i + BATCH_SIZE < total) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`[ChromaService] Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
        throw error;
      }
    }
    
    console.log(`[ChromaService] Successfully added all ${total} documents in batches`);
  }

  async queryCollection(collectionName: string, queryEmbeddings: number[][], nResults: number = 5) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      const result = await collection.query({
        queryEmbeddings,
        nResults,
        include: ["metadatas", "documents", "distances"],
      });
      
      // ตรวจสอบและปรับปรุง response format
      if (result && result.documents) {
        console.log(`[ChromaService] Query successful for '${collectionName}': found ${result.documents.flat().length} documents`);
        return result;
      } else {
        console.log(`[ChromaService] No results found for '${collectionName}'`);
        return {
          documents: [],
          metadatas: [],
          distances: []
        };
      }
    } catch (e) {
      console.error(`[ChromaService] Error queryCollection for '${collectionName}':`, e);
      return {
        documents: [],
        metadatas: [],
        distances: []
      };
    }
  }

  async getDocuments(collectionName: string, limit: number = 100, offset: number = 0) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      if (!collection) {
        console.log(`[ChromaService] Collection '${collectionName}' not found`);
        return { documents: [], total: 0 };
      }

      const all = await collection.get();
      const totalCount = all.ids?.length || 0;
      
      const docs = [];
      if (all && all.ids) {
        for (let i = offset; i < Math.min(offset + limit, all.ids.length); i++) {
          docs.push({
            id: all.ids[i],
            document: all.documents?.[i],
            metadata: all.metadatas?.[i],
          });
        }
      }
      
      // Sample documents log
      if (docs.length > 0) {
        console.log(`[ChromaService] Sample documents in '${collectionName}':`);
        for (let i = 0; i < Math.min(2, docs.length); i++) {
          console.log(`  ${i + 1}. ${docs[i].document?.slice(0, 100)}...`);
        }
      }
      
      return { documents: docs, total: totalCount };
    } catch (e) {
      console.error(`[ChromaService] Error getDocuments:`, e);
      return { documents: [], total: 0 };
    }
  }

  async deleteDocuments(collectionName: string, documentIds: string[]) {
    if (!documentIds || documentIds.length === 0) return;
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      return await collection.delete({ ids: documentIds });
    } catch (e) {
      console.error(`[ChromaService] Error deleteDocuments:`, e);
      throw e;
    }
  }

  // Check if a document exists by id in a collection
  async documentExists(collectionName: string, id: string): Promise<boolean> {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      const res = await collection.get({ ids: [id] });
      return Array.isArray(res?.ids) && res.ids.length > 0;
    } catch (e) {
      console.error(`[ChromaService] Error documentExists:`, e);
      return false;
    }
  }

  async deleteDocumentsBySource(collectionName: string, sourceName: string) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      const results = await collection.get({ where: { source: sourceName } });
      const docIdsToDelete = results.ids;
      if (!docIdsToDelete || docIdsToDelete.length === 0) {
        console.log(`[ChromaService] No documents found with source '${sourceName}' in collection '${collectionName}'.`);
        return;
      }
      await this.deleteDocuments(collectionName, docIdsToDelete);
      console.log(`[ChromaService] Successfully deleted documents from source '${sourceName}'.`);
    } catch (e) {
      console.error(`[ChromaService] Error deleteDocumentsBySource:`, e);
      throw e;
    }
  }

  // ดึงข้อความทั้งหมดจาก collection (vectorstore)
  async getAllFromCollection(collectionName: string): Promise<Array<{ document: string | null; metadata: any }>> {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      const all = await collection.get();
      const docs = [];
      
      if (all && all.ids && all.ids.length > 0) {
        for (let i = 0; i < all.ids.length; i++) {
          docs.push({
            id: all.ids[i],
            document: all.documents?.[i] ?? null,
            metadata: all.metadatas?.[i] || {},
          });
        }
        console.log(`[ChromaService] Retrieved ${docs.length} documents from '${collectionName}'`);
      } else {
        console.log(`[ChromaService] No documents found in '${collectionName}'`);
      }
      
      return docs;
    } catch (e) {
      console.error(`[ChromaService] Error getAllFromCollection for '${collectionName}':`, e);
      return [];
    }
  }

  // Placeholder for LangChain integration (option)
  getVectorStore(collectionName: string) {
    // Not implemented in JS version, but can be extended for LangChain/JS
    console.log(`[ChromaService] getVectorStore is not implemented in this version.`);
    return null;
  }
}

export const chromaService = new ChromaService(); 