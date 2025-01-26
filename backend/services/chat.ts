import { ollamaService } from './ollama';
import { chromaService } from './chroma';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatService {
  private systemPrompt = `You are an AI assistant for Mae Fah Luang University. 
Your role is to provide accurate and helpful information based on the university's documents.
Always be polite and professional. If you're not sure about something, admit it and suggest 
contacting the relevant department for accurate information.`;

  private async getRelevantContext(query: string, collectionName: string): Promise<string> {
    const results = await chromaService.queryDocuments(collectionName, query);
    return results.documents[0].join('\n\n');
  }

  async generateResponse(messages: ChatMessage[]): Promise<string> {
    try {
      // ดึงข้อความล่าสุดของผู้ใช้
      const userQuery = messages[messages.length - 1].content;

      // ดึงข้อมูลที่เกี่ยวข้อง
      const context = await this.getRelevantContext(userQuery, 'university');

      // สร้าง prompt ที่รวม context
      const augmentedMessages: ChatMessage[] = [
        { role: 'user', content: this.systemPrompt },
        { role: 'user', content: `Relevant information: ${context}` },
        ...messages
      ];

      // ส่งไปยัง Ollama
      const response = await ollamaService.chat(augmentedMessages);
      return response.content;
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService(); 