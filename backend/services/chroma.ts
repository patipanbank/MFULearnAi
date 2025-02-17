import { ChromaClient } from 'chromadb';
import { Collection } from '../models/Collection';
import { CollectionPermission } from '../models/Collection';

interface DocumentMetadata {
  filename: string;
  timestamp: string;
  modelId: string;
  collectionName: string;
  uploadedBy: string;
}

class ChromaService {
  private client: ChromaClient;
  private collections: Map<string, any> = new Map();
  private processingFiles = new Set<string>();

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://chroma:8000'
    });
  }

  async initCollection(collectionName: string): Promise<void> {
    try {
      if (!this.collections.has(collectionName)) {
        const collection = await this.client.getOrCreateCollection({
          name: collectionName
        });
        this.collections.set(collectionName, collection);
        console.log(`ChromaDB collection ${collectionName} initialized successfully`);
      }
    } catch (error) {
      console.error(`Error initializing ChromaDB collection ${collectionName}:`, error);
      throw error;
    }
  }

  async getCollections(): Promise<string[]> {
    try {
      const collections = await this.client.listCollections();
      return collections;
    } catch (error) {
      console.error('Error getting collections:', error);
      throw error;
    }
  }

  async addDocuments(collectionName: string, documents: Array<{text: string, metadata: any}>): Promise<void> {
    const fileKey = `${documents[0].metadata.filename}_${documents[0].metadata.uploadedBy}`;
    
    if (this.processingFiles.has(fileKey)) {
      console.log(`File ${fileKey} is already being processed`);
      return;
    }

    this.processingFiles.add(fileKey);
    
    try {
      console.log(`Adding documents to collection ${collectionName}`);
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      
      // สร้าง unique ID สำหรับชุดข้อมูลนี้
      const batchId = `batch_${Date.now()}`;
      
      // เพิ่ม batchId เข้าไปใน metadata
      const docsWithBatchId = documents.map(doc => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          batchId
        }
      }));

      // ตรวจสอบข้อมูลที่มีอยู่
      const existingDocs = await collection.get();
      const existingMetadata = existingDocs.metadatas || [];
      
      // เช็คว่ามีไฟล์นี้อยู่แล้วหรือไม่
      const fileExists = existingMetadata.some((existing: DocumentMetadata) => 
        existing.filename === documents[0].metadata.filename &&
        existing.uploadedBy === documents[0].metadata.uploadedBy
      );

      if (fileExists) {
        console.log(`File ${documents[0].metadata.filename} already exists, skipping upload`);
        return;
      }

      // แบ่ง chunks เป็น batches ขนาด 100 chunks ต่อ batch
      const BATCH_SIZE = 100;
      const batches = [];
      for (let i = 0; i < docsWithBatchId.length; i += BATCH_SIZE) {
        batches.push(docsWithBatchId.slice(i, i + BATCH_SIZE));
      }

      // เพิ่มข้อมูลทีละ batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);
        
        const ids = batch.map((_, idx) => `${batchId}_${i * BATCH_SIZE + idx}`);
        const texts = batch.map(doc => doc.text);
        const metadatas = batch.map(doc => doc.metadata);

        await collection.add({
          ids,
          documents: texts,
          metadatas
        });

        // เพิ่ม delay เล็กน้อยระหว่าง batches เพื่อให้ระบบได้พัก
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log('Documents added successfully');
    } finally {
      this.processingFiles.delete(fileKey);
    }
  }

  async queryDocuments(collectionName: string, query: string, n_results: number = 10) {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      const results = await collection.query({
        queryTexts: [query],
        nResults: n_results
      });
      return results;
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      throw error;
    }
  }

  async queryCollection(collectionName: string, text: string, nResults: number = 10) {
    await this.initCollection(collectionName);
    const collection = this.collections.get(collectionName);
    return collection.query({
      queryTexts: [text],
      nResults: nResults
    });
  }

  async query(collectionName: string, query: string): Promise<any[]> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      const results = await collection.query({
        queryTexts: [query],
        nResults: 10,
        minScore: 0.7,
        where: {},
        include: ["documents", "metadatas", "distances"]
      });

      return results.documents[0].map((doc: string, index: number) => ({
        text: doc,
        metadata: results.metadatas[0][index],
        score: results.distances ? 1 - (results.distances[0][index] || 0) : 0
      }));
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      return [];
    }
  }

  async getAllDocuments(collectionName: string): Promise<{
    ids: string[];
    documents: string[];
    metadatas: Record<string, any>[];
  }> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      const results = await collection.get();
      return {
        ids: results.ids || [],
        documents: results.documents || [],
        metadatas: results.metadatas || []
      };
    } catch (error) {
      console.error('Error fetching documents from ChromaDB:', error);
      throw error;
    }
  }

  async deleteDocument(collectionName: string, id: string): Promise<void> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection ${collectionName} not found`);
      }

      console.log(`Deleting document ${id} from collection ${collectionName}`);
      await collection.delete({
        ids: [id]
      });
      console.log('Document deleted successfully');
    } catch (error) {
      console.error(`Error deleting document from ChromaDB:`, error);
      throw error;
    }
  }

  async deleteDocumentsWithoutModelOrCollection(): Promise<void> {
    try {
      const collections = await this.getCollections();
      
      for (const collectionName of collections) {
        await this.initCollection(collectionName);
        const collection = this.collections.get(collectionName);
        const results = await collection.get();
        
        if (results && results.ids) {
          for (let i = 0; i < results.ids.length; i++) {
            const metadata = results.metadatas?.[i] || {};
            if (!metadata.modelId || !metadata.collectionName) {
              await collection.delete({ ids: [results.ids[i]] });
              console.log(`Deleted document ${results.ids[i]} without model/collection info`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up documents:', error);
      throw error;
    }
  }

  async deleteCollection(collectionName: string): Promise<void> {
    try {
      // ลบข้อมูลทั้งหมดใน collection ก่อน
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      if (collection) {
        const results = await collection.get();
        if (results && results.ids && results.ids.length > 0) {
          // ลบ chunks ทั้งหมด
          await collection.delete({
            ids: results.ids
          });
          console.log(`Deleted ${results.ids.length} chunks from collection ${collectionName}`);
        }
      }

      // ลบ collection จาก ChromaDB
      await this.client.deleteCollection({
        name: collectionName
      });
      this.collections.delete(collectionName);

      // ลบจาก MongoDB
      await Collection.deleteOne({ name: collectionName });
      
      console.log(`Collection ${collectionName} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting collection ${collectionName}:`, error);
      throw error;
    }
  }

  // เพิ่มเมธอดสำหรับลบหลาย collections พร้อมกัน
  async deleteCollections(collectionNames: string[]): Promise<void> {
    try {
      // ลบทีละ collection
      for (const name of collectionNames) {
        await this.deleteCollection(name);
      }
      console.log(`${collectionNames.length} collections deleted successfully`);
    } catch (error) {
      console.error('Error deleting collections:', error);
      throw error;
    }
  }

  async createCollection(name: string, permission: CollectionPermission, createdBy: string) {
    try {
      // 1. สร้าง collection ใน ChromaDB
      const collection = await this.client.createCollection({ name });
      
      // 2. บันทึก metadata ใน MongoDB
      await Collection.create({
        name,
        permission,
        createdBy,
        created: new Date()
      });

      return collection;
    } catch (error) {
      console.error('Error creating collection:', error);
      throw error;
    }
  }

  async deleteAllDocuments(collectionName: string): Promise<void> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection ${collectionName} not found`);
      }

      const documents = await collection.get();
      if (documents.ids.length > 0) {
        await collection.delete({
          ids: documents.ids
        });
      }
      
      console.log(`All documents in collection ${collectionName} deleted successfully`);
    } catch (error) {
      console.error('Error deleting all documents:', error);
      throw error;
    }
  }

  async checkCollectionAccess(collectionName: string, user: { nameID: string, groups: string[] }) {
    try {
      // ค้นหา collection จาก MongoDB
      const collection = await Collection.findOne({ name: collectionName });
      
      // ถ้าไม่พบ collection
      if (!collection) {
        return false;
      }

      // ตรวจสอบสิทธิ์
      switch (collection.permission) {
        case CollectionPermission.PUBLIC:
          return true;
        case CollectionPermission.STAFF_ONLY:
          return user.groups.includes('Staffs');
        case CollectionPermission.PRIVATE:
          return collection.createdBy === user.nameID;
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking collection access:', error);
      throw error;
    }
  }

  // เพิ่มเมธอดสำหรับตรวจสอบการมีอยู่ของ collection
  async ensureCollectionExists(name: string, user: { nameID: string }) {
    try {
      let collection = await Collection.findOne({ name });
      
      if (!collection) {
        collection = await Collection.create({
          name,
          permission: CollectionPermission.PUBLIC,
          createdBy: user.nameID,
          created: new Date()
        });
      }
      
      return collection;
    } catch (error) {
      console.error('Error ensuring collection exists:', error);
      throw error;
    }
  }

  /**
   * Queries documents by embedding using a vector search.
   *
   * @param collectionName - The name of the collection to search.
   * @param embedding - The embedding vector.
   * @param limit - The number of results to return.
   * @returns An object with a "documents" field which is an array of strings.
   */
  async queryDocumentsByEmbedding(
    collectionName: string,
    embedding: number[],
    limit: number
  ): Promise<{ documents: string[] }> {
    try {
      let collection = this.collections.get(collectionName);
      if (!collection) {
        collection = await this.client.getOrCreateCollection({ name: collectionName });
        this.collections.set(collectionName, collection);
      }
      
      // Build the payload with only `query_embeddings`.
      const payload: Record<string, any> = {
        query_embeddings: [embedding],
        n_results: limit,
        include: ["documents"]
      };
      
      console.log("Query payload:", payload);
      
      const result = await collection.query(payload);
      
      // Expecting result.documents to be an array of arrays; use the first element.
      return { documents: result.documents ? (result.documents[0] as string[]) : [] };
    } catch (error) {
      console.error("Error in queryDocumentsByEmbedding:", error);
      throw error;
    }
  }
}

export const chromaService = new ChromaService(); 