import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

export class ChatService {
  private systemPrompt = `You are DinDin, a male AI assistant. Only answer questions about Mae Fah Luang University.`;

  private isRelevantQuestion(query: string): boolean {
    // const relevantKeywords = ['university', 'MFU', 'มหาวิทยาลัย','มหาลัย',
    //                           'University','มอ','มฟล','hi','Hi','hello',
    //                           'Hello'];
    return (true);
  }

  private isGreeting(query: string): boolean {
    const greetings = ['hi', 'hello', 'hey'];
    return greetings.some(greeting => query.toLowerCase().includes(greeting));
  }

  private isThaiGreeting(query: string): boolean {
    const thaiGreetings = ['สวัสดี'];
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

      const systemPrompt = `You are DinDin, a male AI assistant. Only answer questions about Mae Fah Luang University.`;

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
    }
  }
}

export const chatService = new ChatService(); 