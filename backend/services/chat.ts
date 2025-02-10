import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

export class ChatService {
  private systemPrompt = `You are DinDin, a male AI. Keep responses brief and to the point.`;

  private isRelevantQuestion(query: string): boolean {
    return true;
  }

  async generateResponse(
    messages: ChatMessage[],
    query: string,
    modelId: string,
    collectionName: string
  ): Promise<ReadableStream> { // ✅ เปลี่ยนจาก string เป็น ReadableStream
    try {
      console.time('operation');
  
      if (!this.isRelevantQuestion(query)) {
        return new ReadableStream({
          start(controller) {
            controller.enqueue('Sorry, DinDin can only answer questions about Mae Fah Luang University.');
            controller.close();
          }
        });
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
  
      return await bedrockService.chatStream(augmentedMessages, modelId); // ✅ คืนค่าเป็น ReadableStream
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    } finally {
      console.timeEnd('operation');
    }
  }
  

  private async getContext(query: string, collectionName: string): Promise<string> {
    try {
      console.time('operation'); // ✅ เพิ่ม time start

      if (!collectionName) {
        return '';
      }
      const results = await chromaService.queryDocuments(collectionName, query, 3);
      return results.documents.join('\n\n');
    } catch (error) {
      console.error('Error getting context:', error);
      return '';
    } finally {
      console.timeEnd('operation'); // ✅ ทำให้แน่ใจว่า timeEnd มีคู่กับ timeStart
    }
  }
}

export const chatService = new ChatService();

// ✅ Debugging mode
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug message');
}
