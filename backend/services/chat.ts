import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';


export class ChatService {
  private systemPrompt = ``;
  private chatModel = bedrockService.chatModel;
  // You are DinDin, a male AI. Keep responses brief and to the point.

  private isRelevantQuestion(query: string): boolean {
    return (true);
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

      // Always use the default chat model (chat model is separate from the custom model)
      for await (const chunk of bedrockService.chat(augmentedMessages, this.chatModel)) {
        yield chunk;
      }
    } catch (error) {
      console.error("Error in generateResponse:", error);
      throw error;
    }
  }

  private async getContext(query: string, collectionNames: string | string[]): Promise<string> {
    // Wrap collectionNames into an array if it's a string
    const collectionsArray: string[] = typeof collectionNames === 'string' ? [collectionNames] : collectionNames;
    if (collectionsArray.length === 0) return '';
    // Run separate queries against each collection and join the contexts.
    const contexts = await Promise.all(
      collectionsArray.map(name => chromaService.queryDocuments(name, query, 5))
    );
    return contexts.join("\n\n");
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug message');
}
