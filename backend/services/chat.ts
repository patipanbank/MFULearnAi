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

  private async buildEnhancedPrompt(messages: ChatMessage[], context: string): Promise<ChatMessage[]> {
    const basePrompt = this.systemPrompt;
    const enhancedPrompt = `
      ${basePrompt}
      
      Important Instructions:
      1. Base your answers only on the provided context
      2. If unsure, admit it and suggest contacting relevant department
      3. Maintain professional and academic tone
      4. Cite sources when possible
      
      Context: ${context}
    `;
    return [
      { role: 'user', content: enhancedPrompt },
      ...messages
    ];
  }

  private determineTemperature(messages: ChatMessage[]): number {
    // Lower temperature for factual queries, higher for creative ones
    const lastMessage = messages[messages.length - 1].content.toLowerCase();
    if (lastMessage.includes('what') || lastMessage.includes('when') || lastMessage.includes('where')) {
      return 0.3; // More precise
    }
    return 0.7; // More creative
  }

  async generateChatResponse(messages: ChatMessage[], collectionName: string): Promise<string> {
    try {
      const lastMessage = messages[messages.length - 1].content;
      
      // Try enhanced search first
      const relevantDocs = await chromaService.hybridSearch(lastMessage, collectionName);
      const context = relevantDocs.documents[0].join('\n\n');

      const enhancedPrompt = await this.buildEnhancedPrompt(messages, context);
      const temperature = this.determineTemperature(messages);

      const response = await ollamaService.chat(enhancedPrompt);
      
      // Log for analysis
      console.log('Enhanced RAG Response:', {
        query: lastMessage,
        context: context.substring(0, 100) + '...',
        temperature,
        response: response.content
      });

      return response.content;
    } catch (error) {
      console.error('Enhanced chat error:', error);
      // Fallback to original method
      return this.generateResponse(messages);
    }
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