import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrainingHistory, TrainingHistoryDocument, TrainingAction } from '../models/training-history.model';
import { ChromaService } from '../collection/chroma.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { DocumentService } from '../upload/document.service';
import { WebScraperService } from '../upload/web-scraper.service';
import { ConfigService } from '../config/config.service';

export interface TrainingDocument {
  id: string;
  document: string;
  metadata: Record<string, any>;
  embedding: number[];
}

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);
  private readonly CHUNK_SIZE = 1000;
  private readonly CHUNK_OVERLAP = 200;

  constructor(
    @InjectModel(TrainingHistory.name) private trainingHistoryModel: Model<TrainingHistoryDocument>,
    private chromaService: ChromaService,
    private bedrockService: BedrockService,
    private documentService: DocumentService,
    private webScraperService: WebScraperService,
    private configService: ConfigService,
  ) {}

  /**
   * Split text into chunks (like FastAPI RecursiveCharacterTextSplitter)
   */
  private splitTextIntoChunks(text: string): string[] {
    if (!text || !text.trim()) {
      return [];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const words = text.split(/\s+/);

    for (const word of words) {
      if ((currentChunk + ' ' + word).length > this.CHUNK_SIZE) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Embed and store text chunks (like FastAPI _embed_and_store)
   */
  private async embedAndStore(
    text: string,
    sourceName: string,
    contentType: string,
    collectionName: string,
    userId: string,
    username: string,
    modelId: string
  ): Promise<number> {
    if (!text || !text.trim()) {
      return 0;
    }

    const chunks = this.splitTextIntoChunks(text);
    if (!chunks.length) {
      return 0;
    }

    this.logger.log(`📝 Processing ${chunks.length} chunks for source: ${sourceName}`);

    // Create embeddings for all chunks
    const embeddings = await Promise.all(
      chunks.map(chunk => this.bedrockService.createTextEmbedding(chunk))
    );

    // Filter out failed embeddings
    const validChunks: TrainingDocument[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (embeddings[i] && embeddings[i].length > 0) {
        validChunks.push({
          id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          document: chunks[i],
          metadata: {
            source_type: contentType,
            source: sourceName,
            uploadedBy: username || 'system',
            userId: userId || 'system',
            modelId: modelId,
            collectionName: collectionName,
          },
          embedding: embeddings[i],
        });
      }
    }

    if (validChunks.length > 0) {
      await this.chromaService.addDocuments(collectionName, validChunks);
      this.logger.log(`✅ Added ${validChunks.length} documents to collection: ${collectionName}`);
    }

    return validChunks.length;
  }

  /**
   * Process and embed file (like FastAPI process_and_embed_file)
   */
  async uploadDocument(
    userId: string,
    username: string,
    collectionName: string,
    documentName: string,
    file: Express.Multer.File,
    modelId: string,
  ): Promise<any> {
    try {
      this.logger.log(`📁 Uploading document ${documentName} to collection ${collectionName}`);

      // Parse file content
      const textContent = await this.documentService.parseFileContent(file.buffer, file.originalname);
      if (!textContent) {
        throw new Error('Could not extract text content from file');
      }

      // Embed and store
      const chunksCount = await this.embedAndStore(
        textContent,
        documentName,
        'file',
        collectionName,
        userId,
        username,
        modelId
      );

      // Create training history record
      const history = new this.trainingHistoryModel({
        userId,
        username,
        collectionName,
        documentName,
        action: TrainingAction.UPLOAD,
        details: {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          modelId,
          chunks_added: chunksCount,
          source_type: 'file',
        },
      });

      await history.save();

      return {
        success: true,
        message: 'Document uploaded successfully',
        documentName,
        collectionName,
        chunks: chunksCount,
      };
    } catch (error) {
      this.logger.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Process and embed URL (like FastAPI process_and_embed_url)
   */
  async scrapeUrl(
    userId: string,
    username: string,
    collectionName: string,
    url: string,
    modelId: string,
  ): Promise<any> {
    try {
      this.logger.log(`🌐 Scraping URL ${url} for collection ${collectionName}`);

      // Scrape URL content
      const textContent = await this.webScraperService.scrapeUrl(url);
      if (!textContent) {
        throw new Error('Could not scrape any text from the URL');
      }

      // Embed and store
      const chunksCount = await this.embedAndStore(
        textContent,
        url,
        'url',
        collectionName,
        userId,
        username,
        modelId
      );

      // Create training history record
      const history = new this.trainingHistoryModel({
        userId,
        username,
        collectionName,
        documentName: url,
        action: TrainingAction.UPLOAD,
        details: {
          modelId,
          chunks_added: chunksCount,
          source_type: 'url',
        },
      });

      await history.save();

      return {
        success: true,
        message: 'URL scraped successfully',
        url,
        collectionName,
        chunks: chunksCount,
      };
    } catch (error) {
      this.logger.error('Error scraping URL:', error);
      throw error;
    }
  }

  /**
   * Process and embed text (like FastAPI process_and_embed_text)
   */
  async processText(
    userId: string,
    username: string,
    collectionName: string,
    documentName: string,
    text: string,
    modelId: string,
  ): Promise<any> {
    try {
      this.logger.log(`📝 Processing text ${documentName} for collection ${collectionName}`);

      // Embed and store
      const chunksCount = await this.embedAndStore(
        text,
        documentName,
        'text',
        collectionName,
        userId,
        username,
        modelId
      );

      // Create training history record
      const history = new this.trainingHistoryModel({
        userId,
        username,
        collectionName,
        documentName,
        action: TrainingAction.UPLOAD,
        details: {
          modelId,
          chunks_added: chunksCount,
          source_type: 'text',
        },
      });

      await history.save();

      return {
        success: true,
        message: 'Text processed successfully',
        documentName,
        collectionName,
        chunks: chunksCount,
      };
    } catch (error) {
      this.logger.error('Error processing text:', error);
      throw error;
    }
  }

  /**
   * Delete document from collection (like FastAPI delete_document)
   */
  async deleteDocument(
    userId: string,
    username: string,
    collectionName: string,
    documentName: string,
  ): Promise<any> {
    try {
      this.logger.log(`🗑️ Deleting document ${documentName} from collection ${collectionName}`);

      // Delete from ChromaDB
      await this.chromaService.deleteDocumentsBySource(collectionName, documentName);

      // Create training history record
      const history = new this.trainingHistoryModel({
        userId,
        username,
        collectionName,
        documentName,
        action: TrainingAction.DELETE,
        details: { document: documentName },
      });

      await history.save();

      return {
        success: true,
        message: 'Document deleted successfully',
        documentName,
        collectionName,
      };
    } catch (error) {
      this.logger.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Create collection (like FastAPI create_collection)
   */
  async createCollection(
    userId: string,
    username: string,
    collectionName: string,
    description?: string,
  ): Promise<any> {
    try {
      this.logger.log(`📁 Creating collection ${collectionName}`);

      // Create training history record
      const history = new this.trainingHistoryModel({
        userId,
        username,
        collectionName,
        action: TrainingAction.CREATE_COLLECTION,
        details: { description },
      });

      await history.save();

      return {
        success: true,
        message: 'Collection created successfully',
        collectionName,
      };
    } catch (error) {
      this.logger.error('Error creating collection:', error);
      throw error;
    }
  }

  /**
   * Update collection (like FastAPI update_collection)
   */
  async updateCollection(
    userId: string,
    username: string,
    collectionName: string,
    updates: any,
  ): Promise<any> {
    try {
      this.logger.log(`✏️ Updating collection ${collectionName}`);

      // Create training history record
      const history = new this.trainingHistoryModel({
        userId,
        username,
        collectionName,
        action: TrainingAction.UPDATE_COLLECTION,
        details: updates,
      });

      await history.save();

      return {
        success: true,
        message: 'Collection updated successfully',
        collectionName,
      };
    } catch (error) {
      this.logger.error('Error updating collection:', error);
      throw error;
    }
  }

  /**
   * Delete collection (like FastAPI delete_collection)
   */
  async deleteCollection(
    userId: string,
    username: string,
    collectionName: string,
  ): Promise<any> {
    try {
      this.logger.log(`🗑️ Deleting collection ${collectionName}`);

      // Delete from ChromaDB
      await this.chromaService.deleteCollection(collectionName);

      // Create training history record
      const history = new this.trainingHistoryModel({
        userId,
        username,
        collectionName,
        action: TrainingAction.DELETE_COLLECTION,
      });

      await history.save();

      return {
        success: true,
        message: 'Collection deleted successfully',
        collectionName,
      };
    } catch (error) {
      this.logger.error('Error deleting collection:', error);
      throw error;
    }
  }

  /**
   * Get training history for user
   */
  async getTrainingHistory(userId: string, limit: number = 50): Promise<TrainingHistory[]> {
    try {
      const history = await this.trainingHistoryModel
        .find({ userId })
        .sort({ created: -1 })
        .limit(limit)
        .exec();

      return history;
    } catch (error) {
      this.logger.error('Error getting training history:', error);
      return [];
    }
  }

  /**
   * Get training statistics
   */
  async getTrainingStats(userId?: string): Promise<any> {
    try {
      const filter = userId ? { userId } : {};

      const stats = await this.trainingHistoryModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            totalChunks: { $sum: { $ifNull: ['$details.chunks_added', 0] } },
          },
        },
      ]);

      return {
        totalActions: stats.reduce((sum, stat) => sum + stat.count, 0),
        totalChunks: stats.reduce((sum, stat) => sum + stat.totalChunks, 0),
        actionBreakdown: stats,
      };
    } catch (error) {
      this.logger.error('Error getting training stats:', error);
      return {
        totalActions: 0,
        totalChunks: 0,
        actionBreakdown: [],
      };
    }
  }
} 