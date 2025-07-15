import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ChromaClient, Collection } from 'chromadb';

export interface ChromaDocument {
  id: string;
  document: string;
  metadata?: any;
  embedding?: number[];
}

export interface ChromaQueryResult {
  ids: string[][];
  distances: number[][] | null;
  metadatas: any[][];
  documents: string[][];
}

@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name);
  private client: ChromaClient;

  constructor(private configService: ConfigService) {
    this.initializeChromaClient();
  }

  private initializeChromaClient() {
    const chromaUrl = this.configService.get('CHROMA_URL');
    
    if (!chromaUrl) {
      throw new Error('CHROMA_URL is not set in the environment variables.');
    }

    try {
      const urlParts = chromaUrl.split(':');
      const host = urlParts[1].replace('//', '');
      const port = parseInt(urlParts[2]);

      this.logger.log(`Connecting to ChromaDB at ${host}:${port}`);
      this.client = new ChromaClient({
        path: `http://${host}:${port}`,
      });
      this.logger.log('ChromaDB client initialized successfully.');
    } catch (error) {
      this.logger.error(`Failed to initialize ChromaDB client: ${error}`);
      throw new Error(`Failed to initialize ChromaDB client: ${error}`);
    }
  }

  private async getCollection(name: string): Promise<Collection> {
    if (!this.client) {
      throw new Error('ChromaDB client is not initialized.');
    }

    try {
      this.logger.log(`Getting or creating collection: ${name}`);
      const collection = await this.client.getOrCreateCollection({ name });
      this.logger.log(`Successfully got collection: ${name}`);
      return collection;
    } catch (error) {
      this.logger.error(`Error getting or creating collection '${name}': ${error}`);
      throw error;
    }
  }

  async listCollections(): Promise<any[]> {
    if (!this.client) {
      throw new Error('ChromaDB client is not initialized.');
    }

    try {
      const collections = await this.client.listCollections();
      return collections;
    } catch (error) {
      this.logger.error(`Error listing collections: ${error}`);
      throw error;
    }
  }

  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.client) {
      throw new Error('ChromaDB client is not initialized.');
    }

    try {
      await this.client.deleteCollection({ name: collectionName });
      this.logger.log(`Collection ${collectionName} deleted successfully.`);
    } catch (error) {
      this.logger.error(`Error deleting collection '${collectionName}': ${error}`);
      throw new Error(`Failed to delete collection ${collectionName}`);
    }
  }

  async queryCollection(
    collectionName: string,
    queryEmbeddings: number[][],
    nResults: number = 5,
  ): Promise<ChromaQueryResult | null> {
    try {
      const collection = await this.getCollection(collectionName);
      const results = await collection.query({
        queryEmbeddings,
        nResults,
        include: ['documents', 'metadatas', 'distances'] as any,
      });
      // แปลงผลลัพธ์ให้ documents เป็น string[][] ไม่ใช่ (string|null)[][]
      if (results && results.documents) {
        results.documents = results.documents.map(arr => arr.map(doc => doc || ''));
      }
      return results as ChromaQueryResult;
    } catch (error) {
      this.logger.error(`Error querying collection '${collectionName}': ${error}`);
      return null;
    }
  }

  async addToCollection(
    collectionName: string,
    documents: string[],
    embeddings: number[][],
    metadatas: any[],
    ids: string[],
  ): Promise<void> {
    if (!documents.length) {
      this.logger.log('No documents to add. Skipping.');
      return;
    }

    const collection = await this.getCollection(collectionName);

    try {
      await collection.add({
        ids,
        embeddings: embeddings ?? [],
        documents: documents ?? [],
        metadatas: metadatas ?? [],
      });
      this.logger.log(`Successfully added ${documents.length} documents to '${collectionName}'.`);
    } catch (error) {
      this.logger.error(`Error adding to collection '${collectionName}': ${error}`);
      throw error;
    }
  }

  async addDocuments(
    collectionName: string,
    documentsWithEmbeddings: ChromaDocument[],
  ): Promise<void> {
    if (!documentsWithEmbeddings.length) {
      this.logger.log('No documents to process. Skipping.');
      return;
    }

    const collection = await this.getCollection(collectionName);

    const docs = documentsWithEmbeddings.map(item => item.document);
    const metadatas = documentsWithEmbeddings.map(item => item.metadata);
    const embeddings = documentsWithEmbeddings.map(item => item.embedding ?? []);
    const ids = documentsWithEmbeddings.map(item => item.id);

    if (!docs.length) {
      this.logger.log('Empty document list after unpacking. Skipping add to collection.');
      return;
    }

    try {
      await collection.add({
        ids,
        embeddings,
        documents: docs,
        metadatas,
      });
      this.logger.log(`Successfully added ${docs.length} documents to '${collectionName}'.`);
    } catch (error) {
      this.logger.error(`Error during batch add to collection '${collectionName}': ${error}`);
      throw error;
    }
  }

  async getDocuments(
    collectionName: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ documents: ChromaDocument[]; total: number }> {
    try {
      const collection = await this.getCollection(collectionName);
      if (!collection) {
        this.logger.log(`Collection '${collectionName}' not found`);
        return { documents: [], total: 0 };
      }

      const totalCount = await collection.count();
      const results = await collection.get({
        limit,
        offset,
        include: ['documents', 'metadatas'] as any,
      });

      const docs: ChromaDocument[] = [];
      if (results && results.ids) {
        for (let i = 0; i < results.ids.length; i++) {
          const docData: ChromaDocument = {
            id: results.ids[i],
            document: results.documents?.[i] || '',
            metadata: results.metadatas?.[i] || {},
          };
          docs.push(docData);
        }
      }

      return { documents: docs, total: totalCount };
    } catch (error) {
      this.logger.error(`Error getting documents from collection '${collectionName}': ${error}`);
      return { documents: [], total: 0 };
    }
  }

  async deleteDocuments(collectionName: string, documentIds: string[]): Promise<void> {
    if (!documentIds.length) {
      return;
    }

    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection '${collectionName}' not found.`);
    }

    await collection.delete({ ids: documentIds });
  }

  async deleteDocumentsBySource(collectionName: string, sourceName: string): Promise<void> {
    const collection = await this.getCollection(collectionName);
    if (!collection) {
      throw new Error(`Collection '${collectionName}' not found.`);
    }

    const results = await collection.get({
      where: { source: sourceName },
      include: [],
    });

    const docIdsToDelete = results.ids;

    if (!docIdsToDelete.length) {
      this.logger.log(`No documents found with source '${sourceName}' in collection '${collectionName}'.`);
      return;
    }

    this.logger.log(`Found ${docIdsToDelete.length} documents from source '${sourceName}' to delete.`);
    await this.deleteDocuments(collectionName, docIdsToDelete);
    this.logger.log(`Successfully deleted documents from source '${sourceName}'.`);
  }

  async updateCollection(
    collectionName: string,
    ids: string[],
    embeddings?: number[][],
    documents?: string[],
    metadatas?: any[],
  ): Promise<void> {
    const collection = await this.getCollection(collectionName);
    
    try {
      await collection.update({
        ids,
        embeddings: embeddings ?? [],
        documents: documents ?? [],
        metadatas: metadatas ?? [],
      });
      this.logger.log(`Successfully updated ${ids.length} documents in '${collectionName}'.`);
    } catch (error) {
      this.logger.error(`Error updating collection '${collectionName}': ${error}`);
      throw error;
    }
  }

  async upsertCollection(
    collectionName: string,
    ids: string[],
    embeddings?: number[][],
    documents?: string[],
    metadatas?: any[],
  ): Promise<void> {
    const collection = await this.getCollection(collectionName);
    
    try {
      await collection.upsert({
        ids,
        embeddings: embeddings ?? [],
        documents: documents ?? [],
        metadatas: metadatas ?? [],
      });
      this.logger.log(`Successfully upserted ${ids.length} documents in '${collectionName}'.`);
    } catch (error) {
      this.logger.error(`Error upserting collection '${collectionName}': ${error}`);
      throw error;
    }
  }
} 