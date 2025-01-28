import { ollamaService } from './ollama';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';

export class ChatService {
  private systemPrompt = `You are an AI assistant for Mae Fah Luang University. 
    Answer based on the provided context. If unsure, admit it and suggest contacting relevant department.`;

  async generateResponse(query: string, collectionName: string, messages: ChatMessage[]): Promise<any> {
    try {
      // 1. ค้นหาข้อมูลที่เกี่ยวข้องด้วย vector search
      const searchResults = await chromaService.queryDocuments(collectionName, query);
      
      // 2. สร้าง context จากผลการค้นหา
      const relevantDocs = searchResults.documents[0];
      const context = relevantDocs.join('\n\n');
      
      // 3. สร้าง prompt ที่รวม context
      const augmentedMessages: ChatMessage[] = [
        { role: 'system' as const, content: this.systemPrompt },
        { role: 'user' as const, content: `Context: ${context}\n\nQuestion: ${query}` }
      ];

      // 4. ส่งไปยัง LLM
      const response = await ollamaService.chat(augmentedMessages);

      // 5. เตรียมข้อมูล sources สำหรับการแสดงผล
      const sources = searchResults.metadatas[0].map((metadata: any, index: number) => ({
        filename: metadata.filename,
        similarity: 1 - searchResults.distances[0][index], // แปลง distance เป็น similarity score
        modelId: metadata.modelId,
        collectionName: metadata.collectionName
      }));

      return {
        content: response.content,
        sources: sources
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService(); 