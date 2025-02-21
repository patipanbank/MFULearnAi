import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';
import { ChatHistory } from '../models/ChatHistory';
import { HydratedDocument } from 'mongoose';
import { CollectionModel } from '../models/Collection';
import { ModelModel } from '../models/Model';

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

interface IChatHistory {
  sources: Array<{
    modelId: string;
    collectionName: string;
    filename: string;
    similarity: number;
  }>;
  save(): Promise<void>;
}

export class ChatService {
  private systemPrompt = ``;
  private chatModel = bedrockService.chatModel;
  private currentChatHistory?: HydratedDocument<IChatHistory>;
  private readonly BATCH_SIZE = 3; // Number of collections to query simultaneously
  private readonly MIN_SIMILARITY_THRESHOLD = 0.6;
  // You are DinDin, a male AI. Keep responses brief and to the point.

  private isRelevantQuestion(query: string): boolean {
    return true;
  }

  /**
   * Sanitizes a collection name by replacing invalid characters.
   * Here we replace any colon (:) with a hyphen (-) to conform to ChromaDB's requirements.
   */
  private sanitizeCollectionName(name: string): string {
    return name.replace(/:/g, '-');
  }

  /**
   * Gets collection names for a model ID or returns the collection names if directly provided
   */
  private async resolveCollections(modelIdOrCollections: string | string[]): Promise<string[]> {
    try {
      if (Array.isArray(modelIdOrCollections)) {
        return modelIdOrCollections; // Collection names directly provided
      }

      // Try to find the model and get its collections
      const model = await ModelModel.findById(modelIdOrCollections);
      if (!model) {
        console.error('Model not found:', modelIdOrCollections);
        return [];
      }

      console.log('Found model collections:', model.collections);
      return model.collections;
    } catch (error) {
      console.error('Error resolving collections:', error);
      return [];
    }
  }

  private async processBatch(
    batch: string[],
    queryEmbedding: number[]
  ): Promise<CollectionQueryResult[]> {
    return Promise.all(
      batch.map(async (name): Promise<CollectionQueryResult> => {
        try {
          const queryResult = await chromaService.queryDocumentsWithEmbedding(
            name,
            queryEmbedding,
            5
          ) as ChromaQueryResult;

          if (!queryResult?.documents || !queryResult?.metadatas) {
            return { context: '', sources: [] };
          }

          const results = queryResult.documents
            .map((doc: string, index: number): QueryResult => ({
              text: doc,
              metadata: queryResult.metadatas[index],
              similarity: 1 - (queryResult.distances?.[index] || 0)
            }));

          // Calculate dynamic threshold based on result distribution
          const similarities = results.map(r => r.similarity);
          const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
          const stdDev = Math.sqrt(
            similarities.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / similarities.length
          );
          const dynamicThreshold = Math.max(
            this.MIN_SIMILARITY_THRESHOLD,
            mean - stdDev
          );

          const filteredResults = results
            .filter(result => result.similarity >= dynamicThreshold)
            .sort((a, b) => b.similarity - a.similarity);

          const sources = filteredResults.map(result => ({
            modelId: result.metadata.modelId,
            collectionName: name,
            filename: result.metadata.filename,
            similarity: result.similarity
          }));

          return {
            context: filteredResults.map(r => r.text).join("\n\n"),
            sources
          };
        } catch (error) {
          console.error(`Error querying collection ${name}:`, error);
          return { context: '', sources: [] };
        }
      })
    );
  }

  private async getContext(query: string, modelIdOrCollections: string | string[]): Promise<string> {
    // Get collection names from model ID or use provided collection names
    const collectionNames = await this.resolveCollections(modelIdOrCollections);
    if (collectionNames.length === 0) {
      console.error('No collections found for:', modelIdOrCollections);
      return '';
    }

    console.log('Resolved collection names:', collectionNames);

    const sanitizedCollections = collectionNames.map(name => 
      this.sanitizeCollectionName(name)
    );

    console.log('Querying collections:', sanitizedCollections);

    const queryEmbedding = await chromaService.getQueryEmbedding(query);
    
    const batches: string[][] = [];
    for (let i = 0; i < sanitizedCollections.length; i += this.BATCH_SIZE) {
      batches.push(sanitizedCollections.slice(i, i + this.BATCH_SIZE));
    }

    let allResults: CollectionQueryResult[] = [];
    for (const batch of batches) {
      const batchResults = await this.processBatch(batch, queryEmbedding);
      allResults = allResults.concat(batchResults);
    }

    const allSources = allResults
      .flatMap(r => r.sources)
      .sort((a, b) => b.similarity - a.similarity);

    if (this.currentChatHistory) {
      this.currentChatHistory.sources = allSources;
      await this.currentChatHistory.save();
    }

    const contexts = allResults
      .filter(r => r.sources.length > 0)
      .sort((a, b) => {
        const aMaxSim = Math.max(...a.sources.map(s => s.similarity));
        const bMaxSim = Math.max(...b.sources.map(s => s.similarity));
        return bMaxSim - aMaxSim;
      })
      .map(r => r.context);

    return contexts.join("\n\n");
  }

  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelIdOrCollections: string | string[]
  ): AsyncGenerator<string> {
    try {
      console.log("Starting generateResponse with:", modelIdOrCollections);
      const context = await this.getContext(query, modelIdOrCollections);
      console.log('Retrieved context length:', context.length);

      const augmentedMessages = [
        {
          role: "system" as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`
        },
        ...messages
      ];

      for await (const chunk of bedrockService.chat(augmentedMessages, this.chatModel)) {
        yield chunk;
      }
    } catch (error) {
      console.error("Error in generateResponse:", error);
      throw error;
    }
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug message');
}
