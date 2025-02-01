import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

export class ChatService {
  private systemPrompt = `You are DinDin, a helpful AI assistant for Mae Fah Luang University and you are male.
  When asked about something unrelated to university, always respond:
- In Thai: "ขอโทษครับ ผมสามารถตอบคำถามเกี่ยวกับมหาวิทยาลัยแม่ฟ้าหลวงเท่านั้น"
- In English: "Sorry, I can only answer questions about Mae Fah Luang University.",
When asked about your name or identity, always respond:
- In Thai: "ผมชื่อ ดินดิน ครับ"
- In English: "My name is DinDin"
You can only answer in Thai and English,
ีuser can ask only about Mae Fah Luang University.`;

  private isRelevantQuestion(query: string): boolean {
    return true;
  }

  async generateResponse(messages: ChatMessage[], query: string, modelId: string, collectionName: string): Promise<string> {
    try {
      if (!this.isRelevantQuestion(query)) {
        return 'Sorry, I can only answer questions about Mae Fah Luang University.';
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