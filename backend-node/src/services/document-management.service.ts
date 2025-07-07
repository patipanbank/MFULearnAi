import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BedrockService } from '../infrastructure/bedrock/bedrock.service';
import { ChromaService } from './chroma.service';
import { DocumentService } from './document.service';
import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentChunk {
  id: string;
  collectionId: string;
  documentId: string;
  text: string;
  embedding?: number[];
  metadata: {
    filename: string;
    page?: number;
    chunkIndex: number;
    totalChunks: number;
    characters: number;
    uploadedBy: string;
    uploadedAt: Date;
    fileType: string;
    fileSize: number;
  };
}

export interface DocumentUploadResult {
  documentId: string;
  filename: string;
  totalChunks: number;
  totalCharacters: number;
  status: 'processing' | 'completed' | 'failed';
  message?: string;
}

export interface DocumentSearchResult {
  chunks: DocumentChunk[];
  totalResults: number;
  searchTime: number;
}

@Injectable()
export class DocumentManagementService {
  private readonly logger = new Logger(DocumentManagementService.name);
  private readonly maxChunkSize = 1000; // Characters per chunk
  private readonly chunkOverlap = 100; // Overlap between chunks
  private readonly supportedFormats = ['.txt', '.pdf', '.md', '.csv', '.json'];

  constructor(
    private readonly bedrockService: BedrockService,
    private readonly chromaService: ChromaService,
    private readonly documentService: DocumentService,
  ) {}

  /**
   * Upload and process document into a collection
   */
  async uploadDocument(
    collectionId: string,
    file: Express.Multer.File,
    userId: string
  ): Promise<DocumentUploadResult> {
    const documentId = uuidv4();
    const startTime = Date.now();

    this.logger.log(`📄 Starting document upload: ${file.originalname} to collection: ${collectionId}`);

    try {
      // Validate file
      this.validateFile(file);

      // Extract text content
      const textContent = await this.extractTextContent(file);
      
      if (!textContent || textContent.trim().length === 0) {
        throw new BadRequestException('No text content found in document');
      }

      // Split into chunks
      const chunks = this.splitIntoChunks(textContent, {
        documentId,
        collectionId,
        filename: file.originalname,
        uploadedBy: userId,
        fileType: this.getFileType(file.originalname),
        fileSize: file.size
      });

      this.logger.log(`📋 Created ${chunks.length} chunks from document: ${file.originalname}`);

      // Create embeddings for chunks
      const chunksWithEmbeddings = await this.createEmbeddingsForChunks(chunks);

      // Store in vector database
      await this.storeChunksInVectorDB(collectionId, chunksWithEmbeddings);

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Document processed successfully in ${processingTime}ms: ${file.originalname}`);

      return {
        documentId,
        filename: file.originalname,
        totalChunks: chunks.length,
        totalCharacters: textContent.length,
        status: 'completed'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Document processing failed: ${errorMessage}`);
      
      return {
        documentId,
        filename: file.originalname,
        totalChunks: 0,
        totalCharacters: 0,
        status: 'failed',
        message: errorMessage
      };
    }
  }

  /**
   * Search documents in a collection
   */
  async searchDocuments(
    collectionId: string,
    query: string,
    limit: number = 10,
    minSimilarity: number = 0.7
  ): Promise<DocumentSearchResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`🔍 Searching collection ${collectionId} for: "${query}"`);

      // Create query embedding
      const queryEmbedding = await this.bedrockService.createTextEmbedding(query);
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        throw new Error('Failed to create query embedding');
      }

      // Search in ChromaDB
      const searchResults = await this.chromaService.queryCollection(
        this.getCollectionName(collectionId),
        queryEmbedding,
        limit
      );

      if (!searchResults) {
        return {
          chunks: [],
          totalResults: 0,
          searchTime: Date.now() - startTime
        };
      }

      // Filter by similarity and convert to DocumentChunk format
      const chunks = this.convertSearchResultsToChunks(searchResults, minSimilarity);
      
      const searchTime = Date.now() - startTime;
      this.logger.debug(`🎯 Found ${chunks.length} relevant chunks in ${searchTime}ms`);

      return {
        chunks,
        totalResults: chunks.length,
        searchTime
      };

    } catch (error) {
      this.logger.error(`Search failed for collection ${collectionId}: ${error}`);
      return {
        chunks: [],
        totalResults: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get documents in a collection
   */
  async getDocuments(collectionId: string, limit: number = 50): Promise<DocumentChunk[]> {
    try {
      const collectionName = this.getCollectionName(collectionId);
      const results = await this.chromaService.getDocuments(collectionName, limit);
      
      if (!results?.documents || !results?.metadatas) {
        return [];
      }

      return results.documents.map((doc, index) => ({
        id: results.ids![index],
        collectionId,
        documentId: String(results.metadatas![index]?.documentId || ''),
        text: doc || '',
        metadata: results.metadatas![index] as any
      }));

    } catch (error) {
      this.logger.error(`Failed to get documents for collection ${collectionId}: ${error}`);
      return [];
    }
  }

  /**
   * Delete document from collection
   */
  async deleteDocument(collectionId: string, documentId: string): Promise<void> {
    try {
      const collectionName = this.getCollectionName(collectionId);
      
      // Get all chunks for this document
      const allChunks = await this.chromaService.getDocuments(collectionName, 1000);
      
      if (!allChunks?.ids || !allChunks?.metadatas) {
        return;
      }

      // Filter chunks that belong to this document
      const chunkIdsToDelete = allChunks.ids.filter((id, index) => {
        const metadata = allChunks.metadatas![index];
        return metadata?.documentId === documentId;
      });

      if (chunkIdsToDelete.length > 0) {
        await this.chromaService.deleteDocuments(collectionName, chunkIdsToDelete);
        this.logger.log(`🗑️ Deleted ${chunkIdsToDelete.length} chunks for document: ${documentId}`);
      }

    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    averageChunkSize: number;
    uniqueFileTypes: string[];
  }> {
    try {
      const collectionName = this.getCollectionName(collectionId);
      const documents = await this.chromaService.getDocuments(collectionName, 1000);
      
      if (!documents?.metadatas) {
        return {
          totalDocuments: 0,
          totalChunks: 0,
          averageChunkSize: 0,
          uniqueFileTypes: []
        };
      }

      const documentIds = new Set();
      const fileTypes = new Set<string>();
      let totalCharacters = 0;

      documents.metadatas.forEach(metadata => {
        if (metadata?.documentId) {
          documentIds.add(String(metadata.documentId));
        }
        if (metadata?.fileType && typeof metadata.fileType === 'string') {
          fileTypes.add(metadata.fileType);
        }
        if (metadata?.characters && typeof metadata.characters === 'number') {
          totalCharacters += metadata.characters;
        }
      });

      return {
        totalDocuments: documentIds.size,
        totalChunks: documents.metadatas.length,
        averageChunkSize: documents.metadatas.length > 0 ? 
          Math.round(totalCharacters / documents.metadatas.length) : 0,
        uniqueFileTypes: Array.from(fileTypes)
      };

    } catch (error) {
      this.logger.error(`Failed to get stats for collection ${collectionId}: ${error}`);
      return {
        totalDocuments: 0,
        totalChunks: 0,
        averageChunkSize: 0,
        uniqueFileTypes: []
      };
    }
  }

  // Private helper methods

  private validateFile(file: Express.Multer.File): void {
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large (max 10MB)');
    }

    // Check file format
    const fileExtension = this.getFileType(file.originalname);
    if (!this.supportedFormats.includes(fileExtension)) {
      throw new BadRequestException(
        `Unsupported file format. Supported formats: ${this.supportedFormats.join(', ')}`
      );
    }
  }

  private async extractTextContent(file: Express.Multer.File): Promise<string> {
    return this.documentService.parseFileContent(file.buffer, file.originalname);
  }

  private splitIntoChunks(
    text: string, 
    baseMetadata: Partial<DocumentChunk['metadata']> & { documentId: string; collectionId: string; }
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const paragraphs = text.split(/\n\s*\n/); // Split by double newlines
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      // If adding this paragraph would exceed chunk size, finalize current chunk
      if (currentChunk.length + trimmedParagraph.length > this.maxChunkSize && currentChunk.length > 0) {
        chunks.push(this.createChunk(currentChunk, chunkIndex, baseMetadata));
        
        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 6)); // Rough word estimate
        currentChunk = overlapWords.join(' ') + ' ';
        chunkIndex++;
      }

      currentChunk += trimmedParagraph + '\n\n';
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, baseMetadata));
    }

    // Update totalChunks metadata
    return chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        totalChunks: chunks.length
      }
    }));
  }

  private createChunk(
    text: string, 
    chunkIndex: number, 
    baseMetadata: Partial<DocumentChunk['metadata']> & { documentId: string; collectionId: string; }
  ): DocumentChunk {
    return {
      id: uuidv4(),
      collectionId: baseMetadata.collectionId || '',
      documentId: baseMetadata.documentId || '',
      text: text.trim(),
      metadata: {
        filename: baseMetadata.filename || '',
        chunkIndex,
        totalChunks: 0, // Will be updated later
        characters: text.trim().length,
        uploadedBy: baseMetadata.uploadedBy || '',
        uploadedAt: new Date(),
        fileType: baseMetadata.fileType || '',
        fileSize: baseMetadata.fileSize || 0,
        ...baseMetadata
      }
    };
  }

  private async createEmbeddingsForChunks(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    this.logger.debug(`🤖 Creating embeddings for ${chunks.length} chunks`);

    // Process in batches to avoid overwhelming the embedding service
    const batchSize = 5;
    const processedChunks: DocumentChunk[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(chunk => chunk.text);
      
      try {
        const embeddings = await this.bedrockService.createBatchTextEmbeddings(texts);
        
        for (let j = 0; j < batch.length; j++) {
          processedChunks.push({
            ...batch[j],
            embedding: embeddings[j]
          });
        }

      } catch (error) {
        this.logger.warn(`Failed to create embeddings for batch ${i}: ${error}`);
        // Add chunks without embeddings
        processedChunks.push(...batch);
      }

      // Small delay between batches
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const successfulEmbeddings = processedChunks.filter(chunk => chunk.embedding).length;
    this.logger.debug(`✅ Created ${successfulEmbeddings}/${chunks.length} embeddings`);

    return processedChunks;
  }

  private async storeChunksInVectorDB(collectionId: string, chunks: DocumentChunk[]): Promise<void> {
    const collectionName = this.getCollectionName(collectionId);
    
    // Only store chunks that have embeddings
    const validChunks = chunks.filter(chunk => chunk.embedding && chunk.embedding.length > 0);
    
    if (validChunks.length === 0) {
      throw new Error('No valid chunks with embeddings to store');
    }

    const chromaDocuments = validChunks.map(chunk => ({
      id: chunk.id,
      text: chunk.text,
      embedding: chunk.embedding!,
      metadata: {
        ...chunk.metadata,
        documentId: chunk.documentId,
        collectionId: chunk.collectionId
      }
    }));

    await this.chromaService.addDocuments(collectionName, chromaDocuments);
  }

  private convertSearchResultsToChunks(searchResults: any, minSimilarity: number): DocumentChunk[] {
    if (!searchResults.documents || !searchResults.metadatas || !searchResults.distances) {
      return [];
    }

    const documents = searchResults.documents[0] || [];
    const metadatas = searchResults.metadatas[0] || [];
    const distances = searchResults.distances[0] || [];

    const chunks: DocumentChunk[] = [];

    for (let i = 0; i < documents.length; i++) {
      const similarity = 1 - distances[i]; // Convert distance to similarity
      
      if (similarity >= minSimilarity) {
        chunks.push({
          id: metadatas[i]?.id || `chunk_${i}`,
          collectionId: metadatas[i]?.collectionId || '',
          documentId: metadatas[i]?.documentId || '',
          text: documents[i],
          metadata: metadatas[i] || {}
        });
      }
    }

    return chunks;
  }

  private getCollectionName(collectionId: string): string {
    return `documents_${collectionId}`;
  }

  private getFileType(filename: string): string {
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }
} 