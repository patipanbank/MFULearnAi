import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { BedrockService } from '../bedrock/bedrock.service';
import * as chromadb from 'chromadb';

export interface ChromaDocument {
  id: string;
  document: string;
  metadata: Record<string, any>;
  embedding: number[];
}

export interface ChromaQueryResult {
  ids: string[];
  documents: string[];
  metadatas: Record<string, any>[];
  distances: number[];
}

export interface ChromaCollection {
  name: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ChromaService {
  private readonly logger = new Logger(ChromaService.name);
  private client: chromadb.ChromaClient;
  private defaultEmbeddingFunction: any;

  constructor(
    private configService: ConfigService,
    private bedrockService: BedrockService,
  ) {
    this.initializeChromaClient();
  }

  private async initializeChromaClient() {
    try {
      const chromaUrl = this.configService.get('CHROMA_URL') || 'http://localhost:8000';
      this.logger.log(`🔍 Initializing ChromaDB with URL: ${chromaUrl}`);

      // Parse URL to get host and port
      const urlParts = chromaUrl.split(':');
      const host = urlParts[1].replace('//', '');
      const port = parseInt(urlParts[2]);

      this.logger.log(`🔗 Connecting to ChromaDB at ${host}:${port}`);

      // Create real ChromaDB client
      this.client = new chromadb.ChromaClient({
        path: `${host}:${port}`,
      });

      this.logger.log('✅ ChromaDB client initialized successfully');
    } catch (error) {
      this.logger.error(`❌ Failed to initialize ChromaDB client: ${error.message}`);
      throw new Error(`Failed to initialize ChromaDB client: ${error.message}`);
    }
  }

  /**
   * Get or create a collection (like FastAPI _get_collection)
   */
  private async getCollection(name: string): Promise<chromadb.Collection> {
    if (!this.client) {
      throw new Error('ChromaDB client is not initialized');
    }

    try {
      this.logger.log(`📁 Getting or creating collection: ${name}`);
      const collection = await this.client.getOrCreateCollection({
        name: name,
      });
      this.logger.log(`✅ Successfully got collection: ${name}`);
      return collection;
    } catch (error) {
      this.logger.error(`❌ Error getting or creating collection '${name}': ${error.message}`);
      throw error;
    }
  }

  /**
   * List all collections (like FastAPI list_collections)
   */
  async listCollections(): Promise<ChromaCollection[]> {
    if (!this.client) {
      throw new Error('ChromaDB client is not initialized');
    }

    try {
      const collections = await this.client.listCollections();
      return collections.map((col: any) => ({
        name: col.name,
        metadata: col.metadata,
      }));
    } catch (error) {
      this.logger.error(`❌ Error listing collections: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a collection (like FastAPI delete_collection)
   */
  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.client) {
      throw new Error('ChromaDB client is not initialized');
    }

    try {
      await this.client.deleteCollection({
        name: collectionName,
      });
      this.logger.log(`🗑️ Collection ${collectionName} deleted successfully`);
    } catch (error) {
      this.logger.error(`❌ Error deleting collection ${collectionName}: ${error.message}`);
      throw new Error(`Failed to delete collection ${collectionName}`);
    }
  }

  /**
   * Query a collection with embeddings (like FastAPI query_collection)
   */
  async queryCollection(
    collectionName: string,
    queryEmbeddings: number[],
    nResults: number = 5
  ): Promise<ChromaQueryResult | null> {
    try {
      const collection = await this.getCollection(collectionName);
      
      const results = await collection.query({
        queryEmbeddings: [queryEmbeddings],
        nResults: nResults,
        include: ["metadatas", "documents", "distances"] as any
      });

      return {
        ids: results.ids?.[0]?.filter(id => id !== null) as string[] || [],
        documents: results.documents?.[0]?.filter(doc => doc !== null) as string[] || [],
        metadatas: results.metadatas?.[0]?.filter(meta => meta !== null).map(meta => meta as Record<string, any>) || [],
        distances: results.distances?.[0] || [],
      };
    } catch (error) {
      this.logger.error(`❌ Error querying collection '${collectionName}': ${error.message}`);
      return null;
    }
  }

  /**
   * Add documents to collection (like FastAPI add_documents)
   */
  async addDocuments(collectionName: string, documentsWithEmbeddings: ChromaDocument[]): Promise<void> {
    if (!documentsWithEmbeddings || documentsWithEmbeddings.length === 0) {
      this.logger.log('⚠️ No documents to process. Skipping.');
      return;
    }

    try {
      const collection = await this.getCollection(collectionName);

      // Unpack the list of document dictionaries into separate lists
      const docs = documentsWithEmbeddings.map(item => item.document);
      const metadatas = documentsWithEmbeddings.map(item => item.metadata);
      const embeddings = documentsWithEmbeddings.map(item => item.embedding);
      const ids = documentsWithEmbeddings.map(item => item.id);

      if (!docs.length) {
        this.logger.log('⚠️ Empty document list after unpacking. Skipping add to collection.');
        return;
      }

      await collection.add({
        ids: ids,
        embeddings: embeddings,
        documents: docs,
        metadatas: metadatas,
      });

      this.logger.log(`📚 Successfully added ${docs.length} documents to '${collectionName}'`);
    } catch (error) {
      this.logger.error(`❌ Error during batch add to collection '${collectionName}': ${error.message}`);
      throw error;
    }
  }

  /**
   * Get documents from collection (like FastAPI get_documents)
   */
  async getDocuments(
    collectionName: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ documents: any[]; total: number }> {
    try {
      const collection = await this.getCollection(collectionName);
      if (!collection) {
        this.logger.log(`❌ Collection '${collectionName}' not found`);
        return { documents: [], total: 0 };
      }

      const totalCount = await collection.count();

      const results = await collection.get({
        limit: limit,
        offset: offset,
        include: ["metadatas", "documents"] as any
      });

      // Format results
      const docs: any[] = [];
      if (results.ids && results.ids.length > 0) {
        for (let i = 0; i < results.ids.length; i++) {
          const docData = {
            id: results.ids[i],
            document: results.documents?.[i] || null,
            metadata: results.metadatas?.[i] || null
          };
          docs.push(docData);
        }
      }

      this.logger.log(`📄 Getting documents from collection '${collectionName}'`);
      return { documents: docs, total: totalCount };
    } catch (error) {
      this.logger.error(`❌ Error getting documents from collection '${collectionName}': ${error.message}`);
      return { documents: [], total: 0 };
    }
  }

  /**
   * Delete documents by IDs (like FastAPI delete_documents)
   */
  async deleteDocuments(collectionName: string, documentIds: string[]): Promise<void> {
    if (!documentIds || documentIds.length === 0) {
      return;
    }

    try {
      const collection = await this.getCollection(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found`);
      }

      await collection.delete({
        ids: documentIds
      });

      this.logger.log(`🗑️ Deleted ${documentIds.length} documents from collection '${collectionName}'`);
    } catch (error) {
      this.logger.error(`❌ Error deleting documents from collection '${collectionName}': ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete documents by source (like FastAPI delete_documents_by_source)
   */
  async deleteDocumentsBySource(collectionName: string, sourceName: string): Promise<void> {
    try {
      const collection = await this.getCollection(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found`);
      }

      // Find documents with the specified source metadata
      const results = await collection.get({
        where: { "source": sourceName },
        include: []
      });
      
      const docIdsToDelete = results.ids;

      if (!docIdsToDelete || docIdsToDelete.length === 0) {
        this.logger.log(`No documents found with source '${sourceName}' in collection '${collectionName}'.`);
        return;
      }

      this.logger.log(`Found ${docIdsToDelete.length} documents from source '${sourceName}' to delete.`);
      await this.deleteDocuments(collectionName, docIdsToDelete);
      this.logger.log(`Successfully deleted documents from source '${sourceName}'.`);
    } catch (error) {
      this.logger.error(`❌ Error deleting documents by source: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get vector store for LangChain integration (like FastAPI get_vector_store)
   */
  getVectorStore(collectionName: string): any {
    try {
      this.logger.log(`🔍 Creating vector store for collection: ${collectionName}`);

      // Return the collection itself as a vector store
      const vectorStore = {
        collection_name: collectionName,
        similarity_search: async (query: string, k: number = 5) => {
          const embedding = await this.bedrockService.createTextEmbedding(query);
          const results = await this.queryCollection(collectionName, embedding, k);
          return results?.documents?.map((doc, i) => ({
            page_content: doc,
            metadata: results.metadatas?.[i] || {},
          })) || [];
        },
        get: async () => {
          const results = await this.getDocuments(collectionName);
          return {
            documents: results.documents.map(doc => doc.document),
            metadatas: results.documents.map(doc => doc.metadata),
          };
        },
        add_documents: async (documents: any[]) => {
          const docs = documents.map(async doc => ({
            id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            document: doc.page_content,
            metadata: doc.metadata,
            embedding: await this.bedrockService.createTextEmbedding(doc.page_content),
          }));
          const resolvedDocs = await Promise.all(docs);
          await this.addDocuments(collectionName, resolvedDocs);
        },
        delete_collection: async () => {
          await this.deleteCollection(collectionName);
        },
      };

      this.logger.log(`📊 Collection '${collectionName}' vector store created`);
      return vectorStore;
    } catch (error) {
      this.logger.error(`❌ Error creating vector store for ${collectionName}: ${error.message}`);
      return null;
    }
  }
} 