import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
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

      // ส่ง chunk แบบ streaming
      for await (const chunk of bedrockService.chatWithEstimatedTime(augmentedMessages, modelId)) {
        if (chunk.content) {
          // ส่ง chunk ในรูปแบบที่ frontend ต้องการ
          yield JSON.stringify({ content: chunk.content }) + '\n';
        }
      }
    } catch (error) {
      console.error('Error in generateResponse:', error);
      throw error;
    }
  }

  private async getContext(query: string, collectionName: string): Promise<string> {
    try {
      if (!collectionName) {
        return '';
      }
      const results = await chromaService.queryDocuments(collectionName, query, 3);
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
