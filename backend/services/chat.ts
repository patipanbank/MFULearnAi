import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';


export class ChatService {
  private systemPrompt = `You are DinDin, a male AI. Keep responses brief and to the point.`;

  private isRelevantQuestion(query: string): boolean {
    return (true);
  }

  async *generateResponse(messages: ChatMessage[], query: string, modelId: string, collectionName: string): AsyncGenerator<{ content: string, estimatedTime: number }> {
    try {
      if (!this.isRelevantQuestion(query)) {
        yield { content: 'Sorry, DinDin can only answer questions about Mae Fah Luang University.', estimatedTime: 0 };
        return;
      }

      const context = await this.getContext(query, collectionName);
      console.log('Retrieved context:', context);

      const systemPrompt = `You are DinDin, a male AI. Keep responses brief and to the point.`;

      const augmentedMessages = [
        {
          role: 'system' as const,
          content: `${systemPrompt}\n\nContext from documents:\n${context}`
        },
        ...messages
      ];

      yield* bedrockService.chatWithEstimatedTime(augmentedMessages, modelId);
    } catch (error) {
      console.error('Error generating chat response:', error);
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
