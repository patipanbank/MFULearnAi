import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import axios from 'axios';

export interface ChromaDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface ChromaQueryResult {
  ids: string[][];
  documents: string[][];
  metadatas: Record<string, any>[][];
  distances: number[][];
}

@Injectable()
export class ChromaService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.chromaUrl;
    this.apiKey = this.configService.chromaApiKey;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }

  // Collection Management
  async createCollection(name: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/api/v1/collections`,
        { name },
        { headers: this.getHeaders() }
      );
    } catch (error) {
      if (error.response?.status === 409) {
        // Collection already exists, ignore
        return;
      }
      throw new BadRequestException(`Failed to create ChromaDB collection: ${error.message}`);
    }
  }

  async deleteCollection(name: string): Promise<void> {
    try {
      await axios.delete(
        `${this.baseUrl}/api/v1/collections/${name}`,
        { headers: this.getHeaders() }
      );
    } catch (error) {
      throw new BadRequestException(`Failed to delete ChromaDB collection: ${error.message}`);
    }
  }

  async getCollectionInfo(name: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/collections/${name}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException(`Failed to get ChromaDB collection info: ${error.message}`);
    }
  }

  // Document Management
  async addDocuments(
    collectionName: string,
    documents: ChromaDocument[]
  ): Promise<void> {
    try {
      const payload = {
        ids: documents.map(doc => doc.id),
        documents: documents.map(doc => doc.content),
        metadatas: documents.map(doc => doc.metadata || {}),
        embeddings: documents.map(doc => doc.embedding || []),
      };

      await axios.post(
        `${this.baseUrl}/api/v1/collections/${collectionName}/add`,
        payload,
        { headers: this.getHeaders() }
      );
    } catch (error) {
      throw new BadRequestException(`Failed to add documents to ChromaDB: ${error.message}`);
    }
  }

  async getDocuments(
    collectionName: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ChromaDocument[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/collections/${collectionName}/get`,
        {
          params: { limit, offset },
          headers: this.getHeaders()
        }
      );

      const { ids, documents, metadatas } = response.data;
      
      return ids[0].map((id: string, index: number) => ({
        id,
        content: documents[0][index],
        metadata: metadatas[0][index],
      }));
    } catch (error) {
      throw new BadRequestException(`Failed to get documents from ChromaDB: ${error.message}`);
    }
  }

  async deleteDocuments(
    collectionName: string,
    documentIds: string[]
  ): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/api/v1/collections/${collectionName}/delete`,
        { ids: documentIds },
        { headers: this.getHeaders() }
      );
    } catch (error) {
      throw new BadRequestException(`Failed to delete documents from ChromaDB: ${error.message}`);
    }
  }

  // Search and Query
  async query(
    collectionName: string,
    queryText: string,
    nResults: number = 10,
    where?: Record<string, any>
  ): Promise<ChromaQueryResult> {
    try {
      const payload: any = {
        query_texts: [queryText],
        n_results: nResults,
      };

      if (where) {
        payload.where = where;
      }

      const response = await axios.post(
        `${this.baseUrl}/api/v1/collections/${collectionName}/query`,
        payload,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      throw new BadRequestException(`Failed to query ChromaDB: ${error.message}`);
    }
  }

  async search(
    collectionName: string,
    queryEmbeddings: number[][],
    nResults: number = 10,
    where?: Record<string, any>
  ): Promise<ChromaQueryResult> {
    try {
      const payload: any = {
        query_embeddings: queryEmbeddings,
        n_results: nResults,
      };

      if (where) {
        payload.where = where;
      }

      const response = await axios.post(
        `${this.baseUrl}/api/v1/collections/${collectionName}/query`,
        payload,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      throw new BadRequestException(`Failed to search ChromaDB: ${error.message}`);
    }
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/heartbeat`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Get collection count
  async getCollectionCount(collectionName: string): Promise<number> {
    try {
      const info = await this.getCollectionInfo(collectionName);
      return info.count || 0;
    } catch (error) {
      return 0;
    }
  }
} 