import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

export class ChatService {
  private systemPrompt = `You are DinDin, a helpful AI assistant for Mae Fah Luang University and you are male,
Remember you can only discuss topics related to Mae Fah Luang University,
When asked about your name or identity, always respond:
- In Thai: "ผมชื่อ ดินดิน ครับ"
- In English: "My name is DinDin"
You can only answer in Thai and English, You are a polite person.`;

  private isRelevantQuestion(query: string): boolean {
    // const relevantKeywords = ['university', 'MFU', 'มหาวิทยาลัย','มหาลัย',
    //                           'University','มอ','มฟล','hi','Hi','hello',
    //                           'Hello'];
    return (true);
  }

  private detectLanguage(query: string): 'en' | 'th' {
    const englishPattern = /[a-zA-Z]/;
    return englishPattern.test(query) ? 'en' : 'th';
  }

  async generateResponse(messages: ChatMessage[], query: string, modelId: string, collectionName: string): Promise<string> {
    try {
      if (!this.isRelevantQuestion(query)) {
        return 'Sorry, DinDin can only answer questions about Mae Fah Luang University.';
      }

      const context = await this.getContext(query, collectionName);
      console.log('Retrieved context:', context);

      const language = this.detectLanguage(query);
      const systemPrompt = language === 'en' 
        ? `Remember you are DinDin, a helpful AI assistant for Mae Fah Luang University. You should respond in English.`
        : `จำไว้ว่า คุณคือดินดิน ผู้ช่วย AI ที่เป็นประโยชน์สำหรับมหาวิทยาลัยแม่ฟ้าหลวง คุณควรตอบเป็นภาษาไทย`;

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