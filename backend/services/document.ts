import { PDFImage } from 'pdf-image';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { chromaService } from './chroma';
const execAsync = promisify(exec);

export class DocumentService {
  async processFile(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();
    
    try {
      let text = '';
      const buffer = await fs.readFile(file.path);

      switch (ext) {
        case '.pdf':
          try {
            const pdfData = await pdf(buffer);
            text = pdfData.text;
            
            if (!text || text.trim().length < 100) {
              const outputPath = `${file.path}-page`;
              await execAsync(`pdftoppm -png "${file.path}" "${outputPath}"`);
              
              const worker = await createWorker('eng+tha');
              const pages = await fs.readdir(path.dirname(file.path));
              
              for (const page of pages.filter(p => p.startsWith(path.basename(outputPath)))) {
                const pagePath = path.join(path.dirname(file.path), page);
                const { data: { text: pageText } } = await worker.recognize(pagePath);
                text += pageText + '\n';
                await fs.unlink(pagePath);
              }
              await worker.terminate();
            }
          } catch (error) {
            console.error('PDF processing error:', error);
            throw error;
          }
          break;

        case '.doc':
        case '.docx':
          const wordResult = await mammoth.extractRawText({ buffer });
          text = wordResult.value;
          break;

        case '.xls':
        case '.xlsx':
          const workbook = xlsx.read(buffer);
          text = workbook.SheetNames.map(name => {
            const sheet = workbook.Sheets[name];
            return `[Sheet: ${name}]\n${xlsx.utils.sheet_to_csv(sheet)}`;
          }).join('\n\n');
          break;

        case '.txt':
          text = buffer.toString('utf-8');
          break;

        default:
          throw new Error('Unsupported file type');
      }

      const cleanedText = await this.preprocessText(text);
      
      if (await this.isDuplicate(cleanedText)) {
        console.warn('Duplicate content detected, but continuing...');
      }

      const metadata = await this.extractDetailedMetadata(file);
      return cleanedText;
    } catch (error) {
      console.error('Error in enhanced document processing:', error);
      // No fallback available, throw the error
      throw error;
    }
  }

  private async extractTextFromScannedPDF(filePath: string): Promise<string> {
    const worker = await createWorker('eng+tha');
    const pdfImage = new PDFImage(filePath);
    let fullText = '';

    try {
      const pageCount = await pdfImage.numberOfPages();
      
      for (let i = 0; i < pageCount; i++) {
        const imagePath = await pdfImage.convertPage(i);
        const { data: { text } } = await worker.recognize(imagePath);
        fullText += text + '\n';
        
        // ลบไฟล์ภาพชั่วคราว
        await fs.unlink(imagePath);
      }
    } finally {
      await worker.terminate();
    }

    return fullText;
  }

  private async performOCROnImage(imageBuffer: Buffer): Promise<string> {
    const worker = await createWorker('eng+tha');
    try {
      const { data: { text } } = await worker.recognize(imageBuffer);
      return text;
    } finally {
      await worker.terminate();
    }
  }

  private async preprocessText(text: string): Promise<string> {
    return text
      .replace(/\s+/g, ' ')                    // normalize whitespace
      .replace(/[^\w\s\u0E00-\u0E7F]/g, '')   // keep only Thai, English, numbers
      .trim();
  }

  private async isDuplicate(text: string): Promise<boolean> {
    const hash = createHash('md5').update(text).digest('hex');
    const exists = await chromaService.checkHashExists(hash);
    return exists;
  }

  private async extractDetailedMetadata(file: Express.Multer.File): Promise<{
    filename: string;
    timestamp: string;
    fileSize: number;
    mimeType: string;
    hash: string;
    processingDate: Date;
  }> {
    const stats = await fs.stat(file.path);
    const fileBuffer = await fs.readFile(file.path);

    return {
      filename: file.originalname,
      timestamp: new Date().toISOString(),
      fileSize: stats.size,
      mimeType: file.mimetype,
      hash: createHash('md5').update(fileBuffer).digest('hex'),
      processingDate: new Date(),
    };
  }
}

export const documentService = new DocumentService(); 