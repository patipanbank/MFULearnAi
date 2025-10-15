import axios, { AxiosInstance } from 'axios';
import config from '../config/config';
import logger from '../utils/logger';

/**
 * RAG Service Client
 * HTTP client for communicating with the RAG service
 */
export class RAGClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.RAG_SERVICE_URL,
      timeout: 60000, // RAG operations can take longer
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('📤 RAG service request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('❌ RAG service request error', {
          error: error.message,
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('📥 RAG service response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('❌ RAG service response error', {
          status: error.response?.status,
          url: error.config?.url,
          error: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Search for relevant documents
   */
  async search(
    query: string,
    options?: {
      userId?: string;
      collectionName?: string;
      topK?: number;
      minScore?: number;
    }
  ): Promise<any[]> {
    try {
      const response = await this.client.post('/api/search', {
        query,
        user_id: options?.userId,
        collection_name: options?.collectionName || 'default',
        top_k: options?.topK || 5,
        min_score: options?.minScore || 0.7,
      });

      return response.data.results || [];
    } catch (error: any) {
      logger.error('❌ Error searching RAG', {
        query,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Retrieve document by ID
   */
  async retrieveDocument(documentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/documents/${documentId}`);
      return response.data;
    } catch (error: any) {
      logger.error('❌ Error retrieving document', {
        documentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Upload document for indexing
   */
  async uploadDocument(
    content: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      const response = await this.client.post('/api/documents', {
        content,
        metadata,
      });
      return response.data.document_id;
    } catch (error: any) {
      logger.error('❌ Error uploading document', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      await this.client.delete(`/api/documents/${documentId}`);
      return true;
    } catch (error: any) {
      logger.error('❌ Error deleting document', {
        documentId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * List collections
   */
  async listCollections(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/collections');
      return response.data.collections || [];
    } catch (error: any) {
      logger.error('❌ Error listing collections', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create collection
   */
  async createCollection(
    name: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      await this.client.post('/api/collections', {
        name,
        metadata,
      });
      return true;
    } catch (error: any) {
      logger.error('❌ Error creating collection', {
        name,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Delete collection
   */
  async deleteCollection(name: string): Promise<boolean> {
    try {
      await this.client.delete(`/api/collections/${name}`);
      return true;
    } catch (error: any) {
      logger.error('❌ Error deleting collection', {
        name,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const ragClient = new RAGClient();
