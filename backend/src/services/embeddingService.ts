import { bedrockService } from './bedrockService';

export class EmbeddingService {
  async getTextEmbeddings(input: string[], model: string = 'amazon.titan-embed-text-v1') {
    // model argument is for compatibility, currently only titan-embed-text-v1 is used
    return bedrockService.createBatchTextEmbeddings(input);
  }

  // เพิ่ม method embed เพื่อความเข้ากันได้กับ memoryService
  async embed(text: string, model: string = 'amazon.titan-embed-text-v1'): Promise<number[]> {
    const embeddings = await this.getTextEmbeddings([text], model);
    return embeddings && embeddings.length > 0 ? embeddings[0] : [];
  }

  // เพิ่ม method สำหรับ embed หลายข้อความพร้อมกัน
  async embedBatch(texts: string[], model: string = 'amazon.titan-embed-text-v1'): Promise<number[][]> {
    return this.getTextEmbeddings(texts, model);
  }
}

export const embeddingService = new EmbeddingService(); 