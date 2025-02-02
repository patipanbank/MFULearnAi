import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

const logger = {
  debug: (...args: any[]) => process.env.NODE_ENV !== 'production' && console.debug(...args),
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args)
};

export class ChatService {
  private systemPrompt = `You are DinDin, a male AI assistant. Only answer questions about Mae Fah Luang University. You are now working at Mae Fah Luang University.`;

  private isRelevantQuestion(query: string): boolean {
    // const relevantKeywords = ['university', 'MFU', 'มหาวิทยาลัย','มหาลัย',
    //                           'University','มอ','มฟล','hi','Hi','hello',
    //                           'Hello'];
    return (true);
  }

  private isGreeting(query: string): boolean {
    const greetings = ['hi', 'hello', 'hey', 'who are you'];
    return greetings.some(greeting => query.toLowerCase().includes(greeting));
  }

  private isThaiGreeting(query: string): boolean {
    const thaiGreetings = ['สวัสดี','หวัดดี','คุณคือ','เจ้าคือ'];
    return thaiGreetings.some(greeting => query.includes(greeting));
  }

  async generateResponse(messages: ChatMessage[], query: string, modelId: string, collectionName: string): Promise<string> {
    try {
      if (this.isThaiGreeting(query)) {
        return 'สวัสดีครับ ผมชื่อ ดินดิน เป็นผู้ช่วย AI ของ มหาวิทยาลัยแม่ฟ้าหลวง ฉันจะช่วยคุณอะไรได้บ้างวันนี้?';
      }

      if (this.isGreeting(query)) {
        return 'Hi! I am DinDin, AI assistant in Mae Fah Luang University. How can I help you today?';
      }

      if (!this.isRelevantQuestion(query)) {
        return 'Sorry, DinDin can only answer questions about Mae Fah Luang University.';
      }

      const context = await this.getContext(query, collectionName);
      console.log('Retrieved context:', context);

      const systemPrompt = `You are DinDin, a male AI assistant. Only answer questions about Mae Fah Luang University. You are now working at Mae Fah Luang University.`;

      const augmentedMessages = [
        {
          role: 'system' as const,
          content: `${systemPrompt}\n\nContext from documents:\n${context}`
        },
        ...messages
      ];

      const response = await bedrockService.chat(augmentedMessages, modelId);
      return response.content;
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    } finally {
      if (process.env.NODE_ENV !== 'production') {
        console.timeEnd('operation');
      }
    }
  }

  async generateResponseWithVector(messages: ChatMessage[], query: string, modelId: string, collectionName: string): Promise<string> {
    try {
      const context = await this.getContext(query, collectionName);
      console.log('Retrieved context:', context);

      const augmentedMessages = [
        {
          role: 'system' as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`
        },
        ...messages
      ];

      const response = await bedrockService.chatWithVector(augmentedMessages, modelId);
      return response.content;
    } catch (error) {
      console.error('Error generating chat response with vector:', error);
      throw error;
    } finally {
      if (process.env.NODE_ENV !== 'production') {
        console.timeEnd('operation');
      }
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

// backend/server.ts
// ถ้า log level ถูกตั้งค่าสูงเกินไป console.debug() อาจไม่แสดงผล
console.error('Always shows');  // highest priority
console.warn('Shows in most cases');
console.info('May not show');
console.debug('Lowest priority, may not show'); 