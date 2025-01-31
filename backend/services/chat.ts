import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

export class ChatService {
  private systemPrompt = `You are an AI assistant for Mae Fah Luang University. 
Your role is to provide accurate and helpful information based on the university's documents.
Always be polite and professional. If you're not sure about something, admit it and suggest 
contacting the relevant department for accurate information.`;

  async generateResponse(messages: ChatMessage[], query: string): Promise<string> {
    try {
      const context = await this.getContext(query);
      
      const augmentedMessages = [
        {
          role: 'system' as const,
          content: `${this.systemPrompt}\n\nContext: ${context}`
        },
        ...messages
      ];

      const response = await bedrockService.chat(augmentedMessages);
      return response.content;
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }

  private async getContext(query: string): Promise<string> {
    try {
      const results = await chromaService.queryDocuments('default', query, 3);
      return results.documents.join('\n\n');
    } catch (error) {
      console.error('Error getting context:', error);
      return '';
    }
  }
}

export const chatService = new ChatService(); 