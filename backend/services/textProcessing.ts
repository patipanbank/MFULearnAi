// import { pipeline } from '@xenova/transformers';

export class TextProcessing {
  static splitIntoChunks(text: string, maxChunkSize: number = 500): string[] {
    const chunks = [];
    let currentChunk = '';
    
    const sentences = text.split('. ');
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize) {
        chunks.push(currentChunk);
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '. ';
      }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  static async generateResponse(prompt: string): Promise<string> {
    try {
      const { pipeline } = await import('@xenova/transformers');
      const generator = await pipeline('text-generation', 'Xenova/llama2-7b');
      const result = await generator(prompt, {
        max_length: 200,
        temperature: 0.7
      }) as any;
      return Array.isArray(result) ? result[0].generated_text : result.generated_text;
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error('Failed to generate response');
    }
  }

  static async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    if (!file) throw new Error('No file provided');
    
    // ใช้ OCR หรือ text extraction ตามประเภทไฟล์
    const text = file.buffer.toString('utf-8');
    return text;
  }
} 