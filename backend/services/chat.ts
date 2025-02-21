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
   * Sanitizes a collection name by replacing disallowed characters.
   * IMPORTANT: Ensure that the sanitized name is exactly the same as the identifier
   * used during file uploads and stored in ChromaDB.
   */
  private sanitizeCollectionName(name: string): string {
    return name.replace(/:/g, '-');
  }

  /**
   * Generates a chat response.
   * Retrieves the selected model from the database; if the model is custom, it
   * uses its associated collections for context retrieval. Then, it augments the
   * messages with the retrieved context and streams the response.
   */
  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelId: string
  ): AsyncGenerator<string> {
    try {
      // Load the model data (custom model or default model).
      const model = await modelService.getModelById(modelId);
      let collections: string[] = [];
      if (model) {
        collections = model.collections;
      }      
      console.log("Generating response for model with collections:", collections);

      // Retrieve context from all collections.
      const context = await this.getContext(query, collections);
      console.log('Retrieved context length:', context.length);

      // Augment messages with system prompt and retrieved context.
      const augmentedMessages = [
        {
          role: "system" as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`,
        },
        ...messages,
      ];

      // Stream responses using the chosen chat model.
      for await (const chunk of bedrockService.chat(augmentedMessages, this.chatModel)) {
        yield chunk;
      }
    } catch (error) {
      console.error("Error in generateResponse:", error);
      throw error;
    }
  }

  /**
   * Retrieves context from collections.
   * Precomputes the query embedding once and then applies it to each sanitized collection.
   */
  private async getContext(query: string, collectionNames: string[]): Promise<string> {
    if (collectionNames.length === 0) {
      console.log("getContext: No collections provided. Returning empty context.");
      return '';
    }

    // Sanitize each collection name and log the mapping.
    const sanitizedCollections = collectionNames.map(name => {
      const sanitized = this.sanitizeCollectionName(name);
      console.log(`getContext: Original collection name: '${name}' sanitized to: '${sanitized}'`);
      return sanitized;
    });
    console.log("getContext: Querying collections:", sanitizedCollections);

    // Precompute the query embedding once.
    const queryEmbedding = await chromaService.getQueryEmbedding(query);
    console.log("getContext: Computed query embedding:", queryEmbedding);

    // Query each collection using the precomputed embedding.
    const contexts = await Promise.all(
      sanitizedCollections.map(async (collectionName) => {
        try {
          const result = await chromaService.queryDocumentsWithEmbedding(collectionName, queryEmbedding, 5);
          console.log(`getContext: Result for collection '${collectionName}':`, result);
          return result;
        } catch (error) {
          console.error(`getContext: Error querying collection '${collectionName}':`, error);
          return "";
        }
      })
    );

    const finalContext = contexts.filter(ctx => ctx.trim().length > 0).join("\n\n");
    console.log("getContext: Final concatenated context:", finalContext);
    return finalContext;
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug message');
}
