import { ollamaService } from './ollama';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';
import { EmbeddingService } from './embedding';

export class ChatService {
  private systemPrompt = `You are an AI assistant for Mae Fah Luang University. 
    Answer based on the provided context. If unsure, admit it and suggest contacting relevant department.`;
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  async generateResponse(query: string, collectionName: string, messages: ChatMessage[]): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response generation timeout'));
      }, 4.5 * 60 * 1000); // 4.5 minutes (ให้น้อยกว่า server timeout)

      try {
        // สร้าง embedding สำหรับ query
        const queryEmbedding = await this.embeddingService.embedText(query);
        
        console.log('Debug Chat:');
        console.log('Query:', query);
        console.log('Query Embedding Sample:', queryEmbedding.slice(0, 5));
        console.log('Query Embedding Dimension:', queryEmbedding.length);

        // ค้นหาด้วย vector similarity
        const searchResults = await chromaService.queryDocuments(collectionName, query);
        
        console.log('Search Results:');
        console.log('Number of Results:', searchResults.documents[0].length);
        console.log('Top Result Similarity:', 1 - searchResults.distances[0][0]);
        console.log('Top Result Content:', searchResults.documents[0][0].substring(0, 100));

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
        clearTimeout(timeout);

        // 5. เตรียมข้อมูล sources สำหรับการแสดงผล
        const sources = searchResults.metadatas[0].map((metadata: any, index: number) => ({
          filename: metadata.filename,
          similarity: 1 - searchResults.distances[0][index], // แปลง distance เป็น similarity score
          modelId: metadata.modelId,
          collectionName: metadata.collectionName
        }));

        resolve({
          content: response.content,
          sources: sources
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

export const chatService = new ChatService(); 