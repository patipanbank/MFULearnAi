/**
 * HTTP Clients for calling other microservices
 * Replaces direct service imports with HTTP calls
 */

import axios from 'axios';
import config from '../config/config';

// RAG Service Client
export const ragClient = {
  async searchMemory(sessionId: string, query: string, limit: number = 5) {
    try {
      const response = await axios.post(`${config.ragServiceUrl}/api/memory/search`, {
        sessionId,
        query,
        limit
      });
      return response.data;
    } catch (error) {
      console.error('RAG service error:', error);
      return [];
    }
  },

  async embedMessage(sessionId: string, content: string) {
    try {
      await axios.post(`${config.ragServiceUrl}/api/memory/embed`, {
        sessionId,
        content
      });
    } catch (error) {
      console.error('RAG service error:', error);
    }
  },

  async searchCollection(collectionName: string, query: string, limit: number = 5) {
    try {
      const response = await axios.post(`${config.ragServiceUrl}/api/collections/search`, {
        collectionName,
        query,
        limit
      });
      return response.data;
    } catch (error) {
      console.error('RAG service error:', error);
      return { documents: [], metadatas: [] };
    }
  },

  async embed(text: string) {
    try {
      const response = await axios.post(`${config.ragServiceUrl}/api/embed`, {
        text
      });
      return response.data.embedding;
    } catch (error) {
      console.error('RAG service error:', error);
      return [];
    }
  }
};

// Storage Service Client
export const storageClient = {
  async getDocument(documentId: string) {
    try {
      const response = await axios.get(`${config.storageServiceUrl}/api/documents/${documentId}`);
      return response.data;
    } catch (error) {
      console.error('Storage service error:', error);
      return null;
    }
  }
};

// Note: Bedrock Gateway has been removed. Use AWS SDK directly if needed.
