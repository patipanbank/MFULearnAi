import { PDFImage } from 'pdf-image';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
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
          // ลองใช้ pdf-parse ก่อน
          try {
            const dataBuffer = await fs.readFile(file.path);
            const pdfData = await pdf(dataBuffer);
            text = pdfData.text;
            
            // ถ้าข้อความว่างหรือมีน้อยเกินไป จึงค่อยใช้ OCR
            if (!text || text.trim().length < 100) {
              text = await this.processScannedPDF(file.path);
            }
          } catch (error) {
            // ถ้า pdf-parse ล้มเหลว ให้ใช้ OCR
            text = await this.processScannedPDF(file.path);
          }
          break;
        case '.doc':
        case '.docx':
          const buffer = await fs.readFile(file.path);
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
          break;
        case '.xls':
        case '.xlsx':
          const workbook = xlsx.readFile(file.path);
          let fullText = '';
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const sheetText = xlsx.utils.sheet_to_txt(sheet);
            fullText += `Sheet: ${sheetName}\n${sheetText}\n\n`;
          }
          text = fullText;
          break;
        case '.txt':
          text = await fs.readFile(file.path, 'utf-8');
          break;
        default:
          throw new Error('Unsupported file type');
      }

      // ลบไฟล์หลังจากประมวลผลเสร็จ
      await fs.unlink(file.path);
      return text;
    } catch (error) {
      console.error('Error processing file:', error);
      // ลบไฟล์ในกรณีที่เกิดข้อผิดพลาด
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
      throw error;
    }
  }

  private async processScannedPDF(filePath: string): Promise<string> {
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
}

export const documentService = new DocumentService(); 