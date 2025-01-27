import { PDFImage } from 'pdf-image';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { createWorker } from 'tesseract.js';

export class DocumentService {
  async processFile(file: Express.Multer.File) {
    const ext = path.extname(file.originalname).toLowerCase();
    let text = '';

    try {
      switch (ext) {
        case '.pdf':
          text = await this.processPDF(file.path);
          break;
        case '.doc':
        case '.docx':
          text = await this.processWord(file.path);
          break;
        case '.txt':
          text = await fs.readFile(file.path, 'utf-8');
          break;
        default:
          throw new Error('Unsupported file type');
      }

      // ทำความสะอาดข้อความ
      text = this.cleanText(text);
      
      // แบ่งข้อความเป็นชิ้นๆ
      const chunks = this.chunkText(text);

      return chunks;
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    } finally {
      // ลบไฟล์ชั่วคราว
      await fs.unlink(file.path).catch(console.error);
    }
  }

  private async processPDF(filePath: string): Promise<string> {
    try {
      // เพิ่ม timeout และ memory limit สำหรับ pdf-parse
      const options = {
        max: 50 * 1024 * 1024, // 50MB
        timeout: 5000 * 60, // 5 minutes
      };

      // กรณีที่ PDF เป็นภาพ
      const pdfImage = new PDFImage(filePath, {
        combinedImage: true,
        convertOptions: {
          '-density': '300',
          '-quality': '100',
        }
      });
      const numberOfPages = await pdfImage.numberOfPages();
      let text = '';

      if (numberOfPages > 0) {
        const worker = await createWorker('eng+tha');
        
        for (let i = 0; i < numberOfPages; i++) {
          const imagePath = await pdfImage.convertPage(i);
          const { data: { text: pageText } } = await worker.recognize(imagePath);
          text += pageText + '\n';
          await fs.unlink(imagePath).catch(console.error);
        }

        await worker.terminate();
      } else {
        // กรณีที่ PDF เป็นข้อความ
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdf(dataBuffer, options);
        text = pdfData.text;
      }

      return text;
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }

  private async processWord(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.,!?()]/g, '')
      .trim();
  }

  private chunkText(text: string, maxLength: number = 8000): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += sentence + ' ';
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

export const documentService = new DocumentService(); 