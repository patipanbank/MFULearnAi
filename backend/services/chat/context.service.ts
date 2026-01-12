import { chromaService } from '../chroma';
import { bedrockService } from '../bedrock';
import { webSearchService } from '../webSearch';
import { ModelModel } from '../../models/Model';
import { COLLECTION_CONFIG } from '../../constants';

interface QueryResult {
  text: string;
  metadata: {
    modelId: string;
    filename: string;
    [key: string]: any;
  };
  similarity: number;
}

interface ChromaQueryResult {
  documents: string[];
  metadatas: Array<{
    modelId: string;
    filename: string;
    [key: string]: any;
  }>;
  distances?: number[];
}

interface CollectionQueryResult {
  context: string;
  sources: Array<{
    modelId: string;
    collectionName: string;
    filename: string;
    similarity: number;
  }>;
}

/**
 * Service for retrieving and processing context from collections and web
 */
export class ContextService {
  /**
   * Sanitize collection name for ChromaDB
   */
  private sanitizeCollectionName(name: string): string {
    return name.replace(/:/g, '-');
  }

  /**
   * Resolve collections from model ID or return directly if array provided
   */
  async resolveCollections(modelIdOrCollections: string | string[]): Promise<string[]> {
    try {
      if (Array.isArray(modelIdOrCollections)) {
        return modelIdOrCollections;
      }

      const model = await ModelModel.findById(modelIdOrCollections);
      if (!model) {
        console.error('Model not found:', modelIdOrCollections);
        return [];
      }

      return model.collections;
    } catch (error) {
      console.error('Error resolving collections:', error);
      return [];
    }
  }

  /**
   * Process batch of collections
   */
  private async processBatch(
    batch: string[],
    queryEmbedding: number[],
    imageEmbedding?: number[]
  ): Promise<CollectionQueryResult[]> {
    return Promise.all(
      batch.map(async (name): Promise<CollectionQueryResult> => {
        try {
          const queryResult = (await chromaService.queryDocumentsWithEmbedding(
            name,
            imageEmbedding || queryEmbedding,
            COLLECTION_CONFIG.MAX_RESULTS_PER_COLLECTION
          )) as ChromaQueryResult;

          if (!queryResult?.documents || !queryResult?.metadatas) {
            return { context: '', sources: [] };
          }

          const results = queryResult.documents.map((doc: string, index: number): QueryResult => ({
            text: doc,
            metadata: queryResult.metadatas[index],
            similarity: 1 - (queryResult.distances?.[index] || 0),
          }));

          const filteredResults = results
            .filter((result) => result.similarity >= COLLECTION_CONFIG.MIN_SIMILARITY_THRESHOLD)
            .sort((a, b) => b.similarity - a.similarity);

          const sources = filteredResults.map((result) => ({
            modelId: result.metadata.modelId,
            collectionName: name,
            filename: result.metadata.filename,
            similarity: result.similarity,
          }));

          return {
            context: filteredResults.map((r) => r.text).join('\n\n'),
            sources,
          };
        } catch (error) {
          console.error(`Error querying collection ${name}:`, error);
          return { context: '', sources: [] };
        }
      })
    );
  }

  /**
   * Process and filter collection results
   */
  private processResults(results: CollectionQueryResult[]): string {
    const contexts = results
      .filter((r) => {
        if (r.sources.length === 0) return false;
        const maxSimilarity = Math.max(...r.sources.map((s) => s.similarity));
        return maxSimilarity >= COLLECTION_CONFIG.MIN_COLLECTION_SIMILARITY;
      })
      .sort((a, b) => {
        const aMaxSim = Math.max(...a.sources.map((s) => s.similarity));
        const bMaxSim = Math.max(...b.sources.map((s) => s.similarity));
        return bMaxSim - aMaxSim;
      })
      .map((r) => r.context);

    let context = '';

    for (const result of contexts) {
      if (result && result.length > 0) {
        let resultToAdd = result;
        if (resultToAdd.length > COLLECTION_CONFIG.MAX_CONTEXT_LENGTH) {
          resultToAdd = resultToAdd.substring(0, COLLECTION_CONFIG.MAX_CONTEXT_LENGTH);
          const lastPeriodIndex = resultToAdd.lastIndexOf('.');
          const lastNewlineIndex = resultToAdd.lastIndexOf('\n');
          const lastBreakIndex = Math.max(lastPeriodIndex, lastNewlineIndex);
          if (lastBreakIndex > COLLECTION_CONFIG.MAX_CONTEXT_LENGTH * 0.8) {
            resultToAdd = resultToAdd.substring(0, lastBreakIndex + 1);
          }
        }

        if (context.length + resultToAdd.length > COLLECTION_CONFIG.MAX_CONTEXT_LENGTH) {
          break;
        }
        context += resultToAdd + '\n';
      }
    }

    return context;
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get context from collections and web search
   */
  async getContext(
    query: string,
    modelIdOrCollections: string | string[],
    imageBase64?: string
  ): Promise<string> {
    const collectionNames = await this.resolveCollections(modelIdOrCollections);
    let context = '';

    // Get context from collections
    if (collectionNames.length > 0) {
      const sanitizedCollections = collectionNames.map((name) => this.sanitizeCollectionName(name));

      const truncatedQuery = query.slice(0, 512);
      let queryEmbedding = await chromaService.getQueryEmbedding(truncatedQuery);
      let imageEmbedding: number[] | undefined;

      if (imageBase64) {
        try {
          imageEmbedding = await bedrockService.embedImage(imageBase64, truncatedQuery);
        } catch (error) {
          console.error('Error generating image embedding:', error);
        }
      }

      const batches = this.createBatches(sanitizedCollections, COLLECTION_CONFIG.BATCH_SIZE);
      let allResults: CollectionQueryResult[] = [];

      for (const batch of batches) {
        const batchResults = await this.processBatch(batch, queryEmbedding, imageEmbedding);
        allResults = allResults.concat(batchResults);
      }

      context = this.processResults(allResults);
    }

    // Get web search results
    const lastQuestion = query.split('\n').pop() || query;
    try {
      const webResults = await webSearchService.searchWeb(lastQuestion);
      if (webResults) {
        if (context) {
          context += '\n\nAdditional supporting information:\n' + webResults;
        } else {
          context = 'Based on web search results:\n' + webResults;
        }
      }
    } catch (error) {
      console.error('Error fetching web results:', error);
    }

    return context;
  }
}

export const contextService = new ContextService();
