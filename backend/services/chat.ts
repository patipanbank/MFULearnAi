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
   * Retrieves context from all collections selected in the model.
   * For each collection, it queries for at most 5 related document chunks (vectors).
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
    console.log("getContext: Querying all selected collections:", sanitizedCollections);

    // Precompute the query embedding once.
    const queryEmbedding = await chromaService.getQueryEmbedding(query);
    console.log("getContext: Computed query embedding:", queryEmbedding);

    // For each collection, query for at most 5 related document chunks.
    const contexts = await Promise.all(
      sanitizedCollections.map(async (collectionName) => {
        try {
          // Here n_results = 5 ensuring that from this collection, only the top 5 related items are returned.
          const result = await chromaService.queryDocumentsWithEmbedding(collectionName, queryEmbedding, 5);
          console.log(`getContext: Retrieved context from '${collectionName}':`, result);
          return result;
        } catch (error) {
          console.error(`getContext: Error querying '${collectionName}':`, error);
          return "";
        }
      })
    );

    // Concatenate all context strings (and filter out empty ones)
    const finalContext = contexts.filter(ctx => ctx.trim().length > 0).join("\n\n");
    console.log("getContext: Final combined context:", finalContext);
    return finalContext;
  }

  /**
   * Generates a chat response.
   * Loads the model to determine which collections to query, retrieves context,
   * augments the messages, and then streams the response.
   */
  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelId: string
  ): AsyncGenerator<string> {
    try {
      const model = await modelService.getModelById(modelId);
      let collections: string[] = [];
      if (model) {
        collections = model.collections;
      }

      // Fallback: if no collections are set, use the 'code' collection by default.
      if (collections.length === 0) {
        console.warn("No collections in model; using fallback collection 'code'.");
        collections = ['code'];
      }
      
      console.log("Generating response using the following collections:", collections);

      // Retrieve context from all (or fallback) collections.
      const context = await this.getContext(query, collections);
      console.log('Retrieved context length:', context.length);

      const augmentedMessages = [
        {
          role: "system" as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`,
        },
        ...messages,
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
