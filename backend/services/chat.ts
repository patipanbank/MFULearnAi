import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

export class ChatService {
  private systemPrompt = `You are DinDin, a helpful AI assistant for Mae Fah Luang University and you are male.
When asked about your name or identity, always respond:
- In Thai: "ผมชื่อ ดินดิน ครับ"
- In English: "My name is DinDin"
You can only answer in Thai and English`;

  private isRelevantQuestion(query: string): boolean {
    const keywords = ['มหาวิทยาลัยแม่ฟ้าหลวง', 'MFU', 'Mae Fah Luang University','มหาวิทยาลัยนี้', 'this university',];
    return keywords.some(keyword => query.includes(keyword));
  }

  async generateResponse(messages: ChatMessage[], query: string, modelId: string, collectionName: string): Promise<string> {
    try {
      if (!this.isRelevantQuestion(query)) {
        return 'ขออภัย ผมสามารถตอบคำถามเกี่ยวกับมหาวิทยาลัยแม่ฟ้าหลวงเท่านั้น';
      }

      const context = await this.getContext(query, collectionName);
      console.log('Retrieved context:', context);

      const augmentedMessages = [
        {
          role: 'system' as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`
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