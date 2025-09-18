import { realEmbeddingService } from '../core/realEmbeddingService';

export class EmbeddingService {
  async getTextEmbeddings(input: string[], model: string = 'amazon.titan-embed-text-v1') {
    // Use real embedding service instead of bedrock service
    return realEmbeddingService.embedBatch(input, { model });
  }

  // เพิ่ม method embed เพื่อความเข้ากันได้กับ memoryService
  async embed(text: string, model: string = 'amazon.titan-embed-text-v1'): Promise<number[]> {
    return realEmbeddingService.embed(text, { model });
  }

  // เพิ่ม method สำหรับ embed หลายข้อความพร้อมกัน
  async embedBatch(texts: string[], model: string = 'amazon.titan-embed-text-v1'): Promise<number[][]> {
    return realEmbeddingService.embedBatch(texts, { model });
  }

  // เพิ่ม health check method
  async healthCheck(): Promise<boolean> {
    return realEmbeddingService.healthCheck();
  }
}

export const embeddingService = new EmbeddingService(); 