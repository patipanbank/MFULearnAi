import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';


export class ChatService {
  private systemPrompt = ``;
  private chatModel = bedrockService.chatModel;
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

  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    customCollectionNames: string | string[]
  ): AsyncGenerator<string> {
    try {
      console.log("Starting generateResponse with custom collections:", customCollectionNames);
      // Retrieve context from all selected collections (custom model)
      const context = await this.getContext(query, customCollectionNames);
      console.log('Retrieved context length:', context.length);

      // Augment messages using the default chat system prompt and retrieved context
      const augmentedMessages = [
        {
          role: "system" as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`
        },
        ...messages
      ];

      // Always use the default chat model
      for await (const chunk of bedrockService.chat(augmentedMessages, this.chatModel)) {
        yield chunk;
      }
    } catch (error) {
      console.error("Error in generateResponse:", error);
      throw error;
    }
  }

  private async getContext(query: string, collectionNames: string | string[]): Promise<string> {
    // Convert collectionNames to an array if it's not already one.
    const collectionsArray: string[] =
      typeof collectionNames === 'string' ? [collectionNames] : collectionNames;
    if (collectionsArray.length === 0) return '';

    // Debug: Log the received collection names.
    console.log("getContext: Received collectionNames:", collectionNames);

    // Sanitize each collection name and log the transformation.
    const sanitizedCollections = collectionsArray.map((name) => {
      const sanitized = this.sanitizeCollectionName(name);
      console.log(`getContext: Sanitized '${name}' to '${sanitized}'`);
      return sanitized;
    });

    console.log("getContext: Querying collections:", sanitizedCollections);

    // Precompute the query embedding once and log the result.
    const queryEmbedding = await chromaService.getQueryEmbedding(query);
    console.log("getContext: Computed query embedding:", queryEmbedding);

    // Query each collection using the precomputed embedding and log individual results.
    const contexts = await Promise.all(
      sanitizedCollections.map(name =>
        chromaService.queryDocumentsWithEmbedding(name, queryEmbedding, 5).then(result => {
          console.log(`getContext: Result for collection '${name}':`, result);
          return result;
        })
      )
    );

    // Join all context pieces and log the final concatenated context.
    const finalContext = contexts.join("\n\n");
    console.log("getContext: Final concatenated context:", finalContext);
    return finalContext;
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug message');
}
