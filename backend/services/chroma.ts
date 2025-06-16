import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb';
import { ICollection, CollectionModel, CollectionDocument } from '../models/Collection';
import { CollectionPermission } from '../models/Collection';
import { TitanEmbedService } from '../services/titan';
import { bedrockService } from '../services/bedrock';
import { HydratedDocument } from 'mongoose';

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
  private titanEmbedService: TitanEmbedService;

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://chroma:8000'
    });
    this.titanEmbedService = new TitanEmbedService();
  }

  async initCollection(collectionName: string): Promise<void> {
    try {
      if (!this.collections.has(collectionName)) {
        const collection = await this.client.getOrCreateCollection({
          name: collectionName
        });
        this.collections.set(collectionName, collection);
        // console.log(`ChromaService: Collection '${collectionName}' initialized.`);
      }
    } catch (error) {
      console.error(`ChromaService: Error initializing collection '${collectionName}':`, error);
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

  /**
   * Adds an array of documents (with precomputed embeddings) to ChromaDB.
   * Each document must have an `embedding` property in addition to text and metadata.
   */
  async addDocuments(collectionName: string, documents: Array<{ text: string, metadata: any, embedding: number[] }>): Promise<void> {
    const fileKey = `${documents[0].metadata.filename}_${documents[0].metadata.uploadedBy}`;

    if (this.processingFiles.has(fileKey)) {
      // console.log(`File ${fileKey} is already being processed`);
      return;
    }

    this.processingFiles.add(fileKey);

    try {
      // console.log(`Adding documents to collection ${collectionName}`);
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);

      // Create a unique batch ID for this file upload
      const batchId = `batch_${Date.now()}`;

      // Enhance each document with a batchId and a 'processed' flag.
      const docsWithBatchId = documents.map(doc => ({
        text: doc.text,
        metadata: {
          ...doc.metadata,
          batchId,
          processed: true // Mark as fully processed
        },
        embedding: doc.embedding // Use the precomputed embedding
      }));

      // Check for duplicate files (avoid duplicate ingestion)
      const existingDocs = await collection.get();
      const existingMetadata = existingDocs.metadatas || [];

      const fileExists = existingMetadata.some((existing: DocumentMetadata) =>
        existing.filename === documents[0].metadata.filename &&
        existing.uploadedBy === documents[0].metadata.uploadedBy
      );

      if (fileExists) {
        // console.log(`File ${documents[0].metadata.filename} already exists, skipping upload`);
        return;
      }

      // Split document chunks into batches (100 chunks per batch)
      const BATCH_SIZE = 100;
      const batches = [];
      for (let i = 0; i < docsWithBatchId.length; i += BATCH_SIZE) {
        batches.push(docsWithBatchId.slice(i, i + BATCH_SIZE));
      }

      // Process and add each batch, now with embeddings
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        // console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);

        const ids = batch.map((_, idx) => `${batchId}_${i * BATCH_SIZE + idx}`);
        const texts = batch.map(doc => doc.text);
        const metadatas = batch.map(doc => doc.metadata);
        const embeddings = batch.map(doc => doc.embedding); // Retrieve the embedding values

        await collection.add({
          ids,
          documents: texts,
          metadatas,
          embeddings // Store the actual vector embeddings for similarity search
        });

        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // console.log('Documents added successfully');
    } finally {
      this.processingFiles.delete(fileKey);
    }
  }

  /**
   * Computes and returns the query embedding vector using the Titan embedding service.
   */
  async getQueryEmbedding(query: string): Promise<number[]> {
    try {
      const embedding = await this.titanEmbedService.embedText(query);
      return embedding;
    } catch (error) {
      console.error("ChromaService: Error computing query embedding:", error);
      throw error;
    }
  }

  /**
   * Performs a similarity search on the specified collection using the provided query embedding.
   * Returns the concatenated document text from the top n_results.
   */
  async queryDocumentsWithEmbedding(collectionName: string, queryEmbedding: number[], n_results: number): Promise<{
    documents: string[];
    metadatas: Array<{
      modelId: string;
      filename: string;
      [key: string]: any;
    }>;
    distances?: number[];
  }> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`ChromaService: Collection '${collectionName}' not found.`);
      }

      // Check if collection has any documents
      const collectionContents = await collection.get();
      // console.log(`ChromaService: Collection '${collectionName}' contains:`, {
      //   documentCount: collectionContents.documents?.length || 0,
      //   metadataCount: collectionContents.metadatas?.length || 0,
      //   // Log a few sample documents with their metadata
      //   sampleDocs: (collectionContents.documents || []).slice(0, 2).map((doc: string, i: number) => ({
      //     text: doc.substring(0, 100) + '...',
      //     metadata: collectionContents.metadatas?.[i],
      //     id: collectionContents.ids?.[i]
      //   }))
      // });

      // ขอผลลัพธ์มากขึ้นเพื่อให้มีโอกาสได้ข้อมูลที่เกี่ยวข้องมากขึ้น
      // แต่จะกรองเฉพาะที่เกี่ยวข้องจริงๆ ในภายหลัง
      const QUERY_MULTIPLIER = 3; // เพิ่มจาก 2 เป็น 3
      
      const queryResult = await collection.query({
        queryEmbeddings: [queryEmbedding],
        n_results: n_results * QUERY_MULTIPLIER, // Request more results initially for better filtering
        include: ["documents", "metadatas", "distances"],
        where: { processed: true } // Only include fully processed documents
      });

      if (!queryResult.documents || !Array.isArray(queryResult.documents)) {
        throw new Error("ChromaService: queryResult.documents is not an array.");
      }

      // ปรับค่า MAX_L2_DISTANCE และ MIN_SIMILARITY_THRESHOLD
      // เพื่อให้กรองข้อมูลที่เกี่ยวข้องได้ดีขึ้น
      const MAX_L2_DISTANCE = 2.0; // ลดจาก 2.0 เพื่อให้ similarity score สูงขึ้น
      const MIN_SIMILARITY_THRESHOLD = 0.1; // เพิ่มจาก 0.0 เพื่อกรองข้อมูลที่ไม่เกี่ยวข้อง

      const documents = queryResult.documents[0];
      const distances = queryResult.distances?.[0] || [];
      const metadatas = queryResult.metadatas?.[0] || [];
      
      interface QueryResult {
        text: string;
        metadata: {
          modelId: string;
          filename: string;
          [key: string]: any;
        };
        similarity: number;
      }

      // ปรับฟังก์ชัน l2DistanceToSimilarity ให้คำนวณค่า similarity ได้แม่นยำขึ้น
      const l2DistanceToSimilarity = (distance: number): number => {
        // ใช้ exponential decay function เพื่อให้ค่า similarity ลดลงเร็วขึ้นเมื่อ distance สูงขึ้น
        return Math.exp(-distance / MAX_L2_DISTANCE);
      };

      // Log raw distances and computed similarities
      const rawScores = distances.map((distance: number, index: number) => ({
        distance,
        similarity: l2DistanceToSimilarity(distance),
        text: documents[index].substring(0, 100) + '...' // First 100 chars of document
      }));
      // console.log(`ChromaService: Raw similarity scores:`, rawScores);

      const filteredResults = documents
        .map((doc: string, index: number): QueryResult => ({
          text: doc,
          metadata: metadatas[index],
          similarity: l2DistanceToSimilarity(distances[index] || 0)
        }))
        .filter((result: QueryResult) => result.similarity >= MIN_SIMILARITY_THRESHOLD)
        .sort((a: QueryResult, b: QueryResult) => b.similarity - a.similarity)
        .slice(0, n_results);

      return {
        documents: filteredResults.map((r: QueryResult) => r.text),
        metadatas: filteredResults.map((r: QueryResult) => r.metadata),
        distances: filteredResults.map((r: QueryResult) => 1 - r.similarity)
      };
    } catch (error) {
      console.error(`ChromaService: Error querying documents in '${collectionName}':`, error);
      return {
        documents: [],
        metadatas: [],
        distances: []
      };
    }
  }

  async queryDocuments(collectionName: string, query: string, n_results: number = 5) {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      // This method is now deprecated in favor of queryDocumentsWithEmbedding.
      const queryEmbedding = await this.titanEmbedService.embedText(query);
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: n_results,
        where: { processed: true }
      });
      return results;
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      throw error;
    }
  }

  async queryCollection(collectionName: string, query: string, limit: number = 5) {
    await this.initCollection(collectionName);
    const collection = this.collections.get(collectionName);
    const queryEmbedding = await this.titanEmbedService.embedText(query);
    const results = await this.queryDocumentsWithEmbedding(collectionName, queryEmbedding, limit);
    return results.documents.slice(0, limit);
  }

  async query(collectionName: string, query: string): Promise<any[]> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      const results = await collection.query({
        queryTexts: [query],
        nResults: 5,
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

      // console.log(`Deleting document ${id} from collection ${collectionName}`);
      await collection.delete({
        ids: [id]
      });
      // console.log('Document deleted successfully');
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
              // console.log(`Deleted document ${results.ids[i]} without model/collection info`);
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
      // Delete all documents in the collection first
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      if (collection) {
        const results = await collection.get();
        if (results && results.ids && results.ids.length > 0) {
          // Delete all document chunks and log each deletion
          for (let i = 0; i < results.ids.length; i++) {
            const metadata = results.metadatas?.[i];
            if (metadata && metadata.filename) {
              // console.log(`Deleting file: ${metadata.filename} (id: ${results.ids[i]}) from collection ${collectionName}`);
            } else {
              // console.log(`Deleting document with id: ${results.ids[i]} from collection ${collectionName}`);
            }
          }
          await collection.delete({
            ids: results.ids
          });
          // console.log(`Deleted ${results.ids.length} chunks from collection ${collectionName}`);
        }
      }

      // Delete collection from ChromaDB
      await this.client.deleteCollection({
        name: collectionName
      });
      this.collections.delete(collectionName);

      // Delete from MongoDB
      await CollectionModel.deleteOne({ name: collectionName });
      
      // console.log(`Collection ${collectionName} deleted successfully`);
    } catch (error) {
      // console.error(`Error deleting collection ${collectionName}:`, error);
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
      // console.log(`${collectionNames.length} collections deleted successfully`);
    } catch (error) {
      console.error('Error deleting collections:', error);
      throw error;
    }
  }

  async createCollection(name: string, permission: CollectionPermission, createdBy: string): Promise<HydratedDocument<CollectionDocument>> {
    try {
      // Check if collection already exists
      const existingCollection = await CollectionModel.findOne({ name });
      if (existingCollection) {
        return existingCollection;
      }

      // Create collection in MongoDB
      const collection = await CollectionModel.create({
        name,
        permission,
        createdBy
      });

      // Initialize collection in ChromaDB
      await this.initCollection(name);

      return collection;
    } catch (error) {
      console.error('Error creating collection:', error);
      throw error;
    }
  }

  async ensureDefaultCollection(): Promise<void> {
    try {
      const defaultCollection = await CollectionModel.findOne({ name: 'Default' });
      if (!defaultCollection) {
        await this.createCollection('Default', CollectionPermission.PUBLIC, 'system');
        // console.log('Created default collection');
      }
    } catch (error) {
      console.error('Error ensuring default collection:', error);
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
      
      // console.log(`All documents in collection ${collectionName} deleted successfully`);
    } catch (error) {
      // console.error('Error deleting all documents:', error);
      throw error;
    }
  }

  async checkCollectionAccess(collectionName: string, user: { nameID: string, username: string, groups: string[] }) {
    try {
      // ค้นหา collection จาก MongoDB
      const collection = await CollectionModel.findOne({ name: collectionName });
      
      // ถ้าไม่พบ collection
      if (!collection) {
        return false;
      }

      // Admin has access to all collections
      if (user.groups.includes('Admin') || user.groups.includes('SuperAdmin')) {
        return true;
      }

      // Get user identifier (nameID or username)
      const userId = user.nameID || user.username;

      // ตรวจสอบสิทธิ์
      switch (collection.permission) {
        case CollectionPermission.PUBLIC:
          return true;
        case CollectionPermission.PRIVATE:
          return collection.createdBy === userId;
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
      let collection = await CollectionModel.findOne({ name });
      
      if (!collection) {
        collection = await CollectionModel.create({
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
   * Performs hybrid search combining semantic and keyword search
   */
  async hybridSearch(collectionName: string, query: string, n_results: number = 5, filter?: Record<string, any>): Promise<{
    documents: string[];
    metadatas: Array<{
      modelId: string;
      filename: string;
      [key: string]: any;
    }>;
    scores: number[];
    searchType: string[];
  }> {
    try {
      await this.initCollection(collectionName);
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`ChromaService: Collection '${collectionName}' not found.`);
      }

      const queryEmbedding = await this.getQueryEmbedding(query);
      const semanticResults = await collection.query({
        queryEmbeddings: [queryEmbedding],
        n_results: n_results,
        include: ["documents", "metadatas", "distances"],
        where: filter // Apply the filter here
      });

      const keywordResults = await this.keywordSearch(collectionName, query, n_results);

      // 3. Fusion of results using Reciprocal Rank Fusion (RRF)
      const fusedResults = this.fuseSearchResults(
        semanticResults,
        keywordResults,
        n_results
      );

      return fusedResults;
    } catch (error) {
      console.error(`ChromaService: Error in hybrid search for '${collectionName}':`, error);
      // Fallback to semantic search only
      const queryEmbedding = await this.getQueryEmbedding(query);
      const fallbackResults = await this.queryDocumentsWithEmbedding(collectionName, queryEmbedding, n_results);
      return {
        documents: fallbackResults.documents,
        metadatas: fallbackResults.metadatas,
        scores: fallbackResults.distances?.map(d => 1 - d) || [],
        searchType: Array(fallbackResults.documents.length).fill('semantic')
      };
    }
  }

  /**
   * Performs keyword-based search using text matching
   */
  private async keywordSearch(collectionName: string, query: string, n_results: number): Promise<{
    documents: string[];
    metadatas: Array<{
      modelId: string;
      filename: string;
      [key: string]: any;
    }>;
    scores: number[];
  }> {
    try {
      const collection = this.collections.get(collectionName);
      if (!collection) {
        throw new Error(`Collection '${collectionName}' not found.`);
      }

      // Get all documents from collection
      const allDocs = await collection.get({
        where: { processed: true },
        include: ["documents", "metadatas"]
      });

      if (!allDocs.documents || allDocs.documents.length === 0) {
        return { documents: [], metadatas: [], scores: [] };
      }

      // Simple keyword matching with TF-IDF-like scoring
      const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      const scoredResults: Array<{
        document: string;
        metadata: any;
        score: number;
        index: number;
      }> = [];

      allDocs.documents.forEach((doc: string, index: number) => {
        const docText = doc.toLowerCase();
        let score = 0;
        let matchedTerms = 0;

        queryTerms.forEach(term => {
          const termCount = (docText.match(new RegExp(term, 'g')) || []).length;
          if (termCount > 0) {
            matchedTerms++;
            // TF-IDF-like scoring: term frequency * inverse document frequency approximation
            const tf = termCount / docText.split(/\s+/).length;
            const idf = Math.log(allDocs.documents.length / (termCount + 1));
            score += tf * idf;
          }
        });

        // Boost score for exact phrase matches
        if (docText.includes(query.toLowerCase())) {
          score *= 2;
        }

        // Only include documents that match at least one term
        if (matchedTerms > 0) {
          scoredResults.push({
            document: doc,
            metadata: allDocs.metadatas?.[index] || {},
            score,
            index
          });
        }
      });

      // Sort by score and take top results
      const topResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, n_results);

      return {
        documents: topResults.map(r => r.document),
        metadatas: topResults.map(r => r.metadata),
        scores: topResults.map(r => r.score)
      };
    } catch (error) {
      console.error(`ChromaService: Error in keyword search:`, error);
      return { documents: [], metadatas: [], scores: [] };
    }
  }

  /**
   * Fuses semantic and keyword search results using Reciprocal Rank Fusion
   */
  private fuseSearchResults(
    semanticResults: { documents: string[]; metadatas: any[]; distances?: number[] },
    keywordResults: { documents: string[]; metadatas: any[]; scores: number[] },
    n_results: number
  ): {
    documents: string[];
    metadatas: Array<{
      modelId: string;
      filename: string;
      [key: string]: any;
    }>;
    scores: number[];
    searchType: string[];
  } {
    const k = 60; // RRF parameter
    const fusedScores = new Map<string, {
      document: string;
      metadata: any;
      score: number;
      searchTypes: Set<string>;
    }>();

    // Process semantic results
    semanticResults.documents.forEach((doc, index) => {
      const docKey = doc.substring(0, 100); // Use first 100 chars as key
      const rank = index + 1;
      const rrf_score = 1 / (k + rank);
      const similarity = semanticResults.distances ? 1 - semanticResults.distances[index] : 0.5;
      const combined_score = rrf_score * (1 + similarity); // Boost by similarity

      fusedScores.set(docKey, {
        document: doc,
        metadata: semanticResults.metadatas[index],
        score: combined_score,
        searchTypes: new Set(['semantic'])
      });
    });

    // Process keyword results and merge
    keywordResults.documents.forEach((doc, index) => {
      const docKey = doc.substring(0, 100);
      const rank = index + 1;
      const rrf_score = 1 / (k + rank);
      const keyword_score = keywordResults.scores[index] || 0;
      const combined_score = rrf_score * (1 + keyword_score);

      if (fusedScores.has(docKey)) {
        // Document found in both searches - boost score
        const existing = fusedScores.get(docKey)!;
        existing.score += combined_score * 1.5; // Boost for appearing in both
        existing.searchTypes.add('keyword');
      } else {
        // Document only in keyword search
        fusedScores.set(docKey, {
          document: doc,
          metadata: keywordResults.metadatas[index],
          score: combined_score,
          searchTypes: new Set(['keyword'])
        });
      }
    });

    // Sort by fused score and return top results
    const sortedResults = Array.from(fusedScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, n_results);

    return {
      documents: sortedResults.map(r => r.document),
      metadatas: sortedResults.map(r => r.metadata),
      scores: sortedResults.map(r => r.score),
      searchType: sortedResults.map(r => Array.from(r.searchTypes).join('+'))
    };
  }

  /**
   * Re-ranks search results using LLM to improve relevance
   */
  async reRankResults(
    query: string,
    documents: string[],
    metadatas: any[],
    scores: number[],
    maxResults: number = 5
  ): Promise<{
    documents: string[];
    metadatas: any[];
    scores: number[];
    reranked: boolean;
  }> {
    try {
      if (documents.length <= maxResults) {
        // No need to re-rank if we already have few results
        return {
          documents,
          metadatas,
          scores,
          reranked: false
        };
      }

      // Prepare documents for re-ranking (truncate long documents)
      const truncatedDocs = documents.map((doc, index) => ({
        index,
        content: doc.length > 1000 ? doc.substring(0, 1000) + '...' : doc,
        originalScore: scores[index] || 0
      }));

      // Create re-ranking prompt
      const reRankPrompt = this.createReRankPrompt(query, truncatedDocs);

      // Call LLM for re-ranking
      const reRankResponse = await bedrockService.invokeModelJSON(
        reRankPrompt,
        bedrockService.models.claude35
      );

      // Parse re-ranking results
      const rankedIndices = this.parseReRankResponse(reRankResponse, documents.length);

      // Apply re-ranking
      const reRankedResults = rankedIndices
        .slice(0, maxResults)
        .map(index => ({
          document: documents[index],
          metadata: metadatas[index],
          score: scores[index] || 0
        }));

      return {
        documents: reRankedResults.map(r => r.document),
        metadatas: reRankedResults.map(r => r.metadata),
        scores: reRankedResults.map(r => r.score),
        reranked: true
      };

    } catch (error) {
      console.error('ChromaService: Error in LLM re-ranking:', error);
      // Fallback to original ranking
      return {
        documents: documents.slice(0, maxResults),
        metadatas: metadatas.slice(0, maxResults),
        scores: scores.slice(0, maxResults),
        reranked: false
      };
    }
  }

  /**
   * Creates a prompt for LLM re-ranking
   */
  private createReRankPrompt(query: string, documents: Array<{index: number, content: string, originalScore: number}>): string {
    const docList = documents.map((doc, i) => 
      `Document ${doc.index}: ${doc.content}`
    ).join('\n\n');

    return `You are a search relevance expert. Your task is to re-rank the following documents based on their relevance to the user query.

User Query: "${query}"

Documents to rank:
${docList}

Instructions:
1. Analyze each document's relevance to the query
2. Consider semantic meaning, not just keyword matching
3. Rank documents from most relevant (1) to least relevant (${documents.length})
4. Return ONLY a JSON array of document indices in order of relevance

Example response format: [2, 0, 4, 1, 3]

Your ranking (JSON array only):`;
  }

  /**
   * Parses LLM re-ranking response
   */
  private parseReRankResponse(response: string, totalDocs: number): number[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\d,\s]+\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in response');
      }

      const rankedIndices = JSON.parse(jsonMatch[0]);
      
      // Validate indices
      if (!Array.isArray(rankedIndices) || 
          rankedIndices.length !== totalDocs ||
          !rankedIndices.every(idx => typeof idx === 'number' && idx >= 0 && idx < totalDocs)) {
        throw new Error('Invalid ranking indices');
      }

      return rankedIndices;
    } catch (error) {
      console.error('ChromaService: Error parsing re-rank response:', error);
      // Fallback to original order
      return Array.from({ length: totalDocs }, (_, i) => i);
    }
  }

  /**
   * Enhanced hybrid search with LLM re-ranking
   */
  async hybridSearchWithReRanking(
    collectionName: string, 
    query: string, 
    n_results: number = 5,
    filter?: Record<string, any>
  ): Promise<{
    documents: string[];
    metadatas: Array<{
      modelId: string;
      filename: string;
      [key: string]: any;
    }>;
    scores: number[];
    searchType: string[];
    reranked: boolean;
  }> {
    const results = await this.hybridSearch(collectionName, query, n_results * 3, filter);
    
    if (!results.documents || results.documents.length === 0) {
      return { documents: [], metadatas: [], scores: [], searchType: [], reranked: false };
    }
    
    const reRankedResults = await this.reRankResults(
      query,
      results.documents,
      results.metadatas,
      results.scores,
      n_results // This is the correct n_results
    );

    return {
      documents: reRankedResults.documents,
      metadatas: reRankedResults.metadatas,
      scores: reRankedResults.scores,
      searchType: results.searchType.slice(0, reRankedResults.documents.length),
      reranked: reRankedResults.reranked
    };
  }

  /**
   * Compresses context using LLM to extract only relevant information
   */
  async compressContext(
    query: string,
    documents: string[],
    maxLength: number = 4000
  ): Promise<{
    compressedContext: string;
    compressionRatio: number;
    originalLength: number;
  }> {
    try {
      const originalContext = documents.join('\n\n---\n\n');
      const originalLength = originalContext.length;

      // If context is already short enough, return as-is
      if (originalLength <= maxLength) {
        return {
          compressedContext: originalContext,
          compressionRatio: 1.0,
          originalLength
        };
      }

      // Create compression prompt
      const compressionPrompt = this.createCompressionPrompt(query, documents, maxLength);

      // Call LLM for compression
      const compressedResponse = await bedrockService.invokeModelJSON(
        compressionPrompt,
        bedrockService.models.claude35
      );

      const compressedContext = this.parseCompressionResponse(compressedResponse);
      const compressionRatio = compressedContext.length / originalLength;

      return {
        compressedContext,
        compressionRatio,
        originalLength
      };

    } catch (error) {
      console.error('ChromaService: Error in context compression:', error);
      // Fallback to truncation
      const originalContext = documents.join('\n\n---\n\n');
      const truncatedContext = originalContext.length > maxLength 
        ? originalContext.substring(0, maxLength) + '...'
        : originalContext;

      return {
        compressedContext: truncatedContext,
        compressionRatio: truncatedContext.length / originalContext.length,
        originalLength: originalContext.length
      };
    }
  }

  /**
   * Creates a prompt for context compression
   */
  private createCompressionPrompt(query: string, documents: string[], maxLength: number): string {
    const contextText = documents.map((doc, i) => 
      `Document ${i + 1}:\n${doc}`
    ).join('\n\n---\n\n');

    return `You are an expert at extracting and summarizing relevant information. Your task is to compress the following context while preserving all information relevant to answering the user's query.

User Query: "${query}"

Context to compress:
${contextText}

Instructions:
1. Extract ONLY information that is directly relevant to answering the query
2. Preserve key facts, numbers, dates, and specific details
3. Remove redundant or irrelevant information
4. Maintain the logical flow and relationships between concepts
5. Keep the compressed version under ${maxLength} characters
6. Return the result in JSON format with a "compressed_context" field

Example response format:
{
  "compressed_context": "Your compressed context here..."
}

Your compressed context:`;
  }

  /**
   * Parses compression response from LLM
   */
  private parseCompressionResponse(response: any): string {
    try {
      if (typeof response === 'object' && response.compressed_context) {
        return response.compressed_context;
      }
      
      if (typeof response === 'string') {
        // Try to extract JSON from string response
        const jsonMatch = response.match(/\{[\s\S]*"compressed_context"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.compressed_context || response;
        }
        return response;
      }

      return String(response);
    } catch (error) {
      console.error('ChromaService: Error parsing compression response:', error);
      return String(response);
    }
  }

  /**
   * Intelligent context selection and compression
   */
  async selectAndCompressContext(
    query: string,
    documents: string[],
    metadatas: any[],
    scores: number[],
    maxContextLength: number = 4000
  ): Promise<{
    selectedDocuments: string[];
    compressedContext: string;
    compressionStats: {
      originalLength: number;
      compressedLength: number;
      compressionRatio: number;
      documentsUsed: number;
    };
  }> {
    try {
      // Step 1: Select most relevant documents based on scores and diversity
      const selectedIndices = this.selectDiverseDocuments(documents, scores, maxContextLength);
      const selectedDocs = selectedIndices.map(i => documents[i]);

      // Step 2: Compress the selected context
      const compressionResult = await this.compressContext(query, selectedDocs, maxContextLength);

      return {
        selectedDocuments: selectedDocs,
        compressedContext: compressionResult.compressedContext,
        compressionStats: {
          originalLength: compressionResult.originalLength,
          compressedLength: compressionResult.compressedContext.length,
          compressionRatio: compressionResult.compressionRatio,
          documentsUsed: selectedDocs.length
        }
      };

    } catch (error) {
      console.error('ChromaService: Error in context selection and compression:', error);
      // Fallback to simple truncation
      const fallbackContext = documents.slice(0, 3).join('\n\n---\n\n');
      const truncatedContext = fallbackContext.length > maxContextLength
        ? fallbackContext.substring(0, maxContextLength) + '...'
        : fallbackContext;

      return {
        selectedDocuments: documents.slice(0, 3),
        compressedContext: truncatedContext,
        compressionStats: {
          originalLength: fallbackContext.length,
          compressedLength: truncatedContext.length,
          compressionRatio: truncatedContext.length / fallbackContext.length,
          documentsUsed: Math.min(3, documents.length)
        }
      };
    }
  }

  /**
   * Selects diverse documents to avoid redundancy
   */
  private selectDiverseDocuments(documents: string[], scores: number[], maxLength: number): number[] {
    const selected: number[] = [];
    const usedKeywords = new Set<string>();
    let currentLength = 0;

    // Sort by score (highest first)
    const sortedIndices = documents
      .map((_, index) => ({ index, score: scores[index] || 0 }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.index);

    for (const index of sortedIndices) {
      const doc = documents[index];
      
      // Check if adding this document would exceed length limit
      if (currentLength + doc.length > maxLength && selected.length > 0) {
        break;
      }

      // Extract keywords from document for diversity check
      const docKeywords = this.extractKeywords(doc);
      const newKeywords = docKeywords.filter(kw => !usedKeywords.has(kw));

      // Select document if it adds new information or is highly relevant
      if (newKeywords.length > docKeywords.length * 0.3 || selected.length === 0) {
        selected.push(index);
        currentLength += doc.length;
        docKeywords.forEach(kw => usedKeywords.add(kw));
      }

      // Ensure we have at least one document
      if (selected.length >= 5) break; // Limit to top 5 diverse documents
    }

    return selected;
  }

  /**
   * Extracts keywords from text for diversity analysis
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'would', 'there', 'could', 'other', 'more', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'also', 'your', 'work', 'life', 'only', 'can', 'still', 'should', 'after', 'being', 'now', 'made', 'before', 'here', 'through', 'when', 'where', 'much', 'some', 'these', 'many', 'then', 'them', 'well', 'were'].includes(word))
      .slice(0, 20); // Top 20 keywords
  }
}

export const chromaService = new ChromaService(); 