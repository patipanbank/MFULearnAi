import type { ToolMeta } from './ToolRegistry';

export class RetrievalTool {
  private collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  getToolMeta(): ToolMeta {
    return {
      name: `search_${this.collectionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      description: `Search documents in the "${this.collectionName}" knowledge base. Use this to find relevant information from uploaded documents in this collection.`,
      func: async (query: string, _sessionId?: string, config?: { limit?: number; threshold?: number }) => {
        try {
          const limit = config?.limit || 5;
          const threshold = config?.threshold || 0.7;

          // Search in ChromaDB
          const { chromaService } = await import('../../services/chromaService');
          const results = await chromaService.searchDocuments(
            this.collectionName,
            query,
            limit
          );

          if (!results || results.length === 0) {
            return `No relevant documents found in "${this.collectionName}" for: "${query}"`;
          }

          // Filter by threshold และจัดรูปแบบ
          const filteredResults = results
            .filter(result => result.score >= threshold)
            .slice(0, limit);

          if (filteredResults.length === 0) {
            return `No highly relevant documents found in "${this.collectionName}" for: "${query}" (all results below ${threshold} similarity threshold)`;
          }

          const formatted = filteredResults.map((result, index) => {
            const metadata = result.metadata || {};
            return `${index + 1}. ${metadata.filename || 'Unknown File'} (Score: ${(result.score * 100).toFixed(1)}%)\n` +
                   `   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n` +
                   `   Page: ${metadata.page || 'N/A'}, Chunk: ${metadata.chunk_id || 'N/A'}\n`;
          }).join('\n');

          return `Found ${filteredResults.length} relevant document(s) in "${this.collectionName}" for "${query}":\n\n${formatted}`;
        } catch (error) {
          console.error(`Retrieval tool error for ${this.collectionName}:`, error);
          return `Error searching "${this.collectionName}": ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    };
  }

  /**
   * สร้าง advanced search function
   */
  getAdvancedSearchMeta(): ToolMeta {
    return {
      name: `advanced_search_${this.collectionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      description: `Advanced search in "${this.collectionName}" with filters. Supports file type filtering, date ranges, and custom similarity thresholds.`,
      func: async (input: string, _sessionId?: string) => {
        try {
          // Parse advanced search parameters
          let params: {
            query: string;
            fileType?: string;
            dateFrom?: string;
            dateTo?: string;
            limit?: number;
            threshold?: number;
          };

          try {
            params = JSON.parse(input);
          } catch {
            // Fallback to simple query
            params = { query: input };
          }

          const { query, fileType, limit = 10, threshold = 0.6 } = params;

          if (!query) {
            return 'Error: Query is required for advanced search';
          }

          // Build filters
          const filters: any = {};
          if (fileType) {
            filters.file_type = fileType;
          }

          const { chromaService } = await import('../../services/chromaService');
          const results = await chromaService.searchDocumentsWithFilter(
            this.collectionName,
            query,
            filters,
            limit
          );

          if (!results || results.length === 0) {
            return `No documents found in "${this.collectionName}" matching the criteria`;
          }

          // Filter and format results
          const filteredResults = results.filter(result => result.score >= threshold);
          
          if (filteredResults.length === 0) {
            return `No documents found above ${threshold} similarity threshold`;
          }

          const formatted = filteredResults.map((result, index) => {
            const metadata = result.metadata || {};
            return `${index + 1}. ${metadata.filename || 'Unknown File'}\n` +
                   `   Type: ${metadata.file_type || 'Unknown'} | Score: ${(result.score * 100).toFixed(1)}%\n` +
                   `   ${result.content.substring(0, 150)}...\n`;
          }).join('\n');

          return `Advanced search results in "${this.collectionName}" (${filteredResults.length} results):\n\n${formatted}`;
        } catch (error) {
          console.error(`Advanced retrieval error for ${this.collectionName}:`, error);
          return `Error in advanced search: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    };
  }
}