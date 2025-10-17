/**
 * RAG Service
 * Handles collections, documents, training, and embeddings
 */

import { api } from '../../shared/lib/api';
import { config } from '../../config/config';
import type {
  Collection,
  CollectionDocument,
  CreateCollectionDto,
  AnalyticsData
} from './types';

export class RAGService {
  private static get baseUrl(): string {
    return config.services.rag.apiPath;
  }

  // ==================== Collections ====================

  /**
   * Get all accessible collections for current user
   */
  static async getCollections(): Promise<Collection[]> {
    return api.get<Collection[]>(`${this.baseUrl}/collections`);
  }

  /**
   * Get public collections
   */
  static async getPublicCollections(): Promise<Collection[]> {
    return api.get<Collection[]>(`${this.baseUrl}/collections/public`);
  }

  /**
   * Get a specific collection by ID
   */
  static async getCollection(collectionId: string): Promise<Collection> {
    return api.get<Collection>(`${this.baseUrl}/collections/${collectionId}`);
  }

  /**
   * Create a new collection
   */
  static async createCollection(data: CreateCollectionDto): Promise<Collection> {
    return api.post<Collection>(`${this.baseUrl}/collections`, data);
  }

  /**
   * Update a collection
   */
  static async updateCollection(
    collectionId: string,
    data: Partial<CreateCollectionDto>
  ): Promise<Collection> {
    return api.put<Collection>(`${this.baseUrl}/collections/${collectionId}`, data);
  }

  /**
   * Delete a collection
   */
  static async deleteCollection(collectionId: string): Promise<void> {
    return api.delete(`${this.baseUrl}/collections/${collectionId}`);
  }

  /**
   * Get analytics for collections
   */
  static async getAnalytics(): Promise<AnalyticsData> {
    return api.get<AnalyticsData>(`${this.baseUrl}/collections/analytics`);
  }

  // ==================== Documents ====================

  /**
   * Get documents in a collection
   */
  static async getDocuments(
    collectionId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<CollectionDocument[]> {
    return api.get<CollectionDocument[]>(
      `${this.baseUrl}/collections/${collectionId}/documents`,
      { params }
    );
  }

  /**
   * Get document count for a collection
   */
  static async getDocumentCount(collectionId: string): Promise<{ total: number }> {
    return api.get<{ total: number }>(
      `${this.baseUrl}/collections/${collectionId}/documents`,
      { params: { limit: 1, offset: 0 } }
    );
  }

  /**
   * Delete documents from a collection
   */
  static async deleteDocuments(
    collectionId: string,
    documentIds: string[]
  ): Promise<void> {
    return api.delete(`${this.baseUrl}/collections/${collectionId}/documents`, {
      data: { documentIds }
    });
  }

  // ==================== Upload & Training ====================

  /**
   * Upload documents for training
   */
  static async uploadDocuments(
    formData: FormData,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<any> {
    return api.post(`${this.baseUrl}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
  }

  /**
   * Upload documents to training endpoint (legacy)
   */
  static async uploadToTraining(
    formData: FormData,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<any> {
    return api.post(`${this.baseUrl}/training/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
  }

  // ==================== Models ====================

  /**
   * Get available embedding models
   */
  static async getModels(): Promise<{ models: string[] }> {
    return api.get<{ models: string[] }>(`${this.baseUrl}/models`);
  }

  /**
   * Get available Bedrock models (legacy endpoint)
   */
  static async getBedrockModels(): Promise<{ models: string[] }> {
    return api.get<{ models: string[] }>(`${this.baseUrl}/bedrock/models`);
  }
}
