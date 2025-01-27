import { PDFImage } from 'pdf-image';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { createWorker } from 'tesseract.js';

export class DocumentService {
  async processFile(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();
    
    try {
      let text = '';
      const buffer = await fs.readFile(file.path);

      switch (ext) {
        case '.pdf':
          try {
            // ลองใช้ pdf-parse ก่อน
            const pdfData = await pdf(buffer);
            text = pdfData.text;
            
            // ถ้าข้อความน้อยเกินไป แสดงว่าอาจเป็น scanned PDF
            if (!text || text.trim().length < 100) {
              text = await this.extractTextFromScannedPDF(file.path);
            }
          } catch (error) {
            // ถ้า pdf-parse ไม่สำเร็จ ให้ใช้ OCR
            text = await this.extractTextFromScannedPDF(file.path);
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

      await fs.unlink(file.path);
      return text.trim();
      
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      await fs.unlink(file.path).catch(console.error);
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
}

export const documentService = new DocumentService(); 