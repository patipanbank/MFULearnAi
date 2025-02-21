import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';
import { modelService } from './modelService';

export class ChatService {
  private systemPrompt = ``;
  private chatModel = bedrockService.chatModel;
  // You are DinDin, a male AI. Keep responses brief and to the point.

  private isRelevantQuestion(query: string): boolean {
    return true;
  }

  /**
   * Sanitizes a collection name so that it exactly matches the name used during file uploads.
   * For example, replace any disallowed characters (like ':' with '-').
   */
  private sanitizeCollectionName(name: string): string {
    return name.replace(/:/g, '-');
  }

  /**
   * Retrieves context from all collections provided.
   * For each collection, it queries for at most 5 related document chunks.
   */
  private async getContext(query: string, collectionNames: string[]): Promise<string> {
    if (collectionNames.length === 0) {
      console.log("getContext: No collections provided. Returning empty context.");
      return '';
    }

    // Sanitize each collection name and log the transformation.
    const sanitizedCollections = collectionNames.map(name => {
      const sanitized = this.sanitizeCollectionName(name);
      console.log(`getContext: Original collection name '${name}' sanitized to '${sanitized}'`);
      return sanitized;
    });
    console.log("getContext: Querying collections:", sanitizedCollections);

    // Precompute the query embedding once.
    const queryEmbedding = await chromaService.getQueryEmbedding(query);
    console.log("getContext: Computed query embedding:", queryEmbedding);

    // For each collection, query for at most 5 related document chunks.
    const contexts = await Promise.all(
      sanitizedCollections.map(async (collectionName) => {
        try {
          // n_results = 5 ensures that from this collection, only the top 5 related items are returned.
          const result = await chromaService.queryDocumentsWithEmbedding(collectionName, queryEmbedding, 5);
          console.log(`getContext: Retrieved context from '${collectionName}':`, result);
          return result;
        } catch (error) {
          console.error(`getContext: Error querying '${collectionName}':`, error);
          return "";
        }
      })
    );

    const finalContext = contexts.filter(ctx => ctx.trim().length > 0).join("\n\n");
    console.log("getContext: Final combined context:", finalContext);
    return finalContext;
  }

  /**
   * Generates a chat response.
   * Loads the model to determine which collections to query _only_ if the model contains collections.
   * If the model has no collections (e.g. default model), no vector context will be appended.
   */
  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelId: string,
    collections?: string[]
  ): AsyncGenerator<string> {
    try {
      // Retrieve the model (custom or default) from the backend.
      const model = await modelService.getModelById(modelId);
      let collectionsToQuery: string[] = [];
      if (model) {
        collectionsToQuery = collections || [model.collection.collectionName];
      }
      
      // Do not force a fallback: if there are no collections, skip vector query.
      if (collectionsToQuery.length === 0) {
        console.warn("No collections provided for this model; skipping vector context retrieval.");
      }
    
      // Retrieve context only if collections are provided.
      let context = "";
      if (collectionsToQuery.length > 0) {
        context = await this.getContext(query, collectionsToQuery);
        console.log("Retrieved context length:", context.length);
      }

      // Augment chat messages with system prompt and retrieved context (if any).
      const augmentedMessages = [
        {
          role: "system" as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`,
        },
        ...messages,
      ];

      // Stream the final response using the chat model.
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
