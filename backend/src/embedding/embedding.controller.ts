import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { EmbeddingService, CreateEmbeddingDto, BatchEmbeddingDto } from './embedding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('embedding')
@UseGuards(JwtAuthGuard)
export class EmbeddingController {
  constructor(private embeddingService: EmbeddingService) {}

  @Post('create')
  async createEmbedding(@Body() body: CreateEmbeddingDto): Promise<any> {
    try {
      const { text, modelId } = body;

      if (!text) {
        throw new HttpException('Text is required', HttpStatus.BAD_REQUEST);
      }

      const embedding = await this.embeddingService.createEmbedding(text, modelId);

      return {
        success: true,
        data: { embedding },
        message: 'Embedding created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create embedding: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('batch')
  async createBatchEmbeddings(@Body() body: BatchEmbeddingDto): Promise<any> {
    try {
      const { texts, modelId } = body;

      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        throw new HttpException('Texts array is required and cannot be empty', HttpStatus.BAD_REQUEST);
      }

      const embeddings = await this.embeddingService.createBatchEmbeddings(texts, modelId);

      return {
        success: true,
        data: { embeddings },
        message: 'Batch embeddings created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create batch embeddings: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('image')
  async createImageEmbedding(@Body() body: { imageBase64: string; text?: string; modelId?: string }): Promise<any> {
    try {
      const { imageBase64, text, modelId } = body;

      if (!imageBase64) {
        throw new HttpException('Image base64 is required', HttpStatus.BAD_REQUEST);
      }

      const embedding = await this.embeddingService.createImageEmbedding(imageBase64, text, modelId);

      return {
        success: true,
        data: { embedding },
        message: 'Image embedding created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create image embedding: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('query')
  async querySimilarDocuments(@Body() body: {
    collectionName: string;
    queryText: string;
    nResults?: number;
    modelId?: string;
  }): Promise<any> {
    try {
      const { collectionName, queryText, nResults = 5, modelId } = body;

      if (!collectionName) {
        throw new HttpException('Collection name is required', HttpStatus.BAD_REQUEST);
      }

      if (!queryText) {
        throw new HttpException('Query text is required', HttpStatus.BAD_REQUEST);
      }

      const results = await this.embeddingService.querySimilarDocuments(
        collectionName,
        queryText,
        nResults,
        modelId,
      );

      return {
        success: true,
        data: results,
        message: 'Similar documents queried successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to query similar documents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('add-to-collection')
  async addDocumentsToCollection(@Body() body: {
    collectionName: string;
    documents: Array<{ text: string; metadata?: any; id?: string }>;
    modelId?: string;
  }): Promise<any> {
    try {
      const { collectionName, documents, modelId } = body;

      if (!collectionName) {
        throw new HttpException('Collection name is required', HttpStatus.BAD_REQUEST);
      }

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        throw new HttpException('Documents array is required and cannot be empty', HttpStatus.BAD_REQUEST);
      }

      await this.embeddingService.addDocumentsToCollection(collectionName, documents, modelId);

      return {
        success: true,
        message: `Successfully added ${documents.length} documents to collection: ${collectionName}`,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to add documents to collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('compare')
  async compareEmbeddings(@Body() body: { embedding1: number[]; embedding2: number[] }): Promise<any> {
    try {
      const { embedding1, embedding2 } = body;

      if (!embedding1 || !Array.isArray(embedding1)) {
        throw new HttpException('Embedding1 is required and must be an array', HttpStatus.BAD_REQUEST);
      }

      if (!embedding2 || !Array.isArray(embedding2)) {
        throw new HttpException('Embedding2 is required and must be an array', HttpStatus.BAD_REQUEST);
      }

      const similarity = await this.embeddingService.compareEmbeddings(embedding1, embedding2);

      return {
        success: true,
        data: { similarity },
        message: 'Embeddings compared successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to compare embeddings: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('validate')
  async validateEmbedding(@Body() body: { embedding: number[] }): Promise<any> {
    try {
      const { embedding } = body;

      if (!embedding) {
        throw new HttpException('Embedding is required', HttpStatus.BAD_REQUEST);
      }

      const isValid = await this.embeddingService.validateEmbedding(embedding);

      return {
        success: true,
        data: { isValid },
        message: 'Embedding validation completed',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to validate embedding: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('dimension')
  async getModelDimension(@Body() body: { modelId: string }): Promise<any> {
    try {
      const { modelId } = body;

      if (!modelId) {
        throw new HttpException('Model ID is required', HttpStatus.BAD_REQUEST);
      }

      const dimension = await this.embeddingService.getModelDimension(modelId);

      return {
        success: true,
        data: { dimension, modelId },
        message: 'Model dimension retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get model dimension: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 