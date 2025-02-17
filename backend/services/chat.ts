import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { titanEmbedService } from './titan';
import { ChatMessage } from '../types/chat';


export class ChatService {
  private systemPrompt = `You are DinDin, a male AI. Keep responses brief and to the point.`;

  private isRelevantQuestion(query: string): boolean {
    return (true);
  }

  async *generateResponse(messages: ChatMessage[], query: string, modelId: string, collectionName: string): AsyncGenerator<string> {
    try {
      console.log('Starting generateResponse:', {
        modelId,
        collectionName,
        messagesCount: messages.length,
        query
      });

      if (!this.isRelevantQuestion(query)) {
        console.log('Query not relevant');
        yield 'Sorry, DinDin can only answer questions about Mae Fah Luang University.';
        return;
      }

      console.log('Getting context for query:', query);
      const context = await this.getContext(query, collectionName);
      console.log('Retrieved context length:', context.length);

      const augmentedMessages = [
        {
          role: 'system' as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`
        },
        ...messages
      ];

      // ส่ง response แบบ streaming ทันที
      for await (const chunk of bedrockService.chat(augmentedMessages, modelId)) {
        yield chunk;
      }
    } catch (error) {
      console.error('Error in generateResponse:', error);
      throw error;
    }
  }

  private async getContext(query: string, collectionName: string): Promise<string> {
    try {
      if (!collectionName) return '';

      // Embed the user query
      const queryEmbedding = await titanEmbedService.embedText(query);

      // Use the embedding to query ChromaDB (update chromaService.queryDocumentsByEmbedding accordingly)
      const results = await chromaService.queryDocumentsByEmbedding(collectionName, queryEmbedding, 10);
      return results.documents.join('\n\n');
    } catch (error) {
      console.error('Error getting context:', error);
      return '';
    } finally {
      if (process.env.NODE_ENV !== 'production') {
        console.timeEnd('operation');
      }
    }
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug message');
}
