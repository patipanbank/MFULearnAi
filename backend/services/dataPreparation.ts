// import { PDFExtract } from 'pdf.js-extract';
import { createEmbedding } from './embedding';

export class DataPreparationService {
  private async extractPDF(file: Express.Multer.File): Promise<string> {
    try {
      // TODO: เพิ่มการแปลง PDF เป็นข้อความ
      return file.buffer.toString('utf-8');
    } catch (error) {
      console.error('Error extracting PDF:', error);
      throw error;
    }
  }

  // A. Raw Data Sources - รับไฟล์หลายประเภท
  async extractRawData(file: Express.Multer.File) {
    const fileType = file.mimetype;
    let rawText = '';

    switch (fileType) {
      case 'application/pdf':
        rawText = await this.extractPDF(file);
        break;
      case 'text/plain':
        rawText = file.buffer.toString('utf-8');
        break;
      // เพิ่มประเภทไฟล์อื่นๆ ตามต้องการ
    }
    return rawText;
  }

  // B. Information Extraction
  async extractInformation(rawText: string) {
    // ทำ OCR หรือ extract ข้อมูลตามประเภทเอกสาร
    return rawText;
  }

  // C. Chunking - แบ่งข้อความเป็นส่วนๆ
  async createChunks(text: string, chunkSize: number = 1000) {
    const chunks = [];
    let currentChunk = '';
    const sentences = text.split('. ');

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length < chunkSize) {
        currentChunk += sentence + '. ';
      } else {
        chunks.push(currentChunk);
        currentChunk = sentence + '. ';
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  // D. Embedding - สร้าง vector จากข้อความ
  async createEmbeddings(chunks: string[]) {
    const embeddings = [];
    for (const chunk of chunks) {
      const embedding = await createEmbedding(chunk);
      embeddings.push(embedding);
    }
    return embeddings;
  }
} 