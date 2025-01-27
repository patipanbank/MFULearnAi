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
          text = await this.processPDF(file.path);
          break;
        case '.doc':
        case '.docx':
          text = await this.processWord(file.path);
          break;
        case '.xls':
        case '.xlsx':
          text = await this.processExcel(file.path);
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
      throw error;
    }
  }

  private async processPDF(filePath: string): Promise<string> {
    try {
      // อ่านไฟล์ PDF ด้วย pdf-parse
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer);
      let text = pdfData.text;

      // ถ้าไม่มีข้อความ (อาจเป็น scanned PDF) ให้ใช้ OCR
      if (!text.trim()) {
        text = await this.processScannedPDF(filePath);
      }

      return text;
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }

  private async processScannedPDF(filePath: string): Promise<string> {
    try {
      const pdfImage = new PDFImage(filePath);
      const numberOfPages = await pdfImage.numberOfPages();
      let fullText = '';

      // สร้าง Tesseract worker
      const worker = await createWorker('eng+tha');

      // ประมวลผลทีละหน้า
      for (let i = 0; i < numberOfPages; i++) {
        const imagePath = await pdfImage.convertPage(i);
        const { data: { text } } = await worker.recognize(imagePath);
        fullText += text + '\n';
        
        // ลบไฟล์ภาพชั่วคราว
        await fs.unlink(imagePath);
      }

      await worker.terminate();
      return fullText;
    } catch (error) {
      console.error('Error processing scanned PDF:', error);
      throw error;
    }
  }

  private async processWord(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Error processing Word document:', error);
      throw error;
    }
  }

  private async processExcel(filePath: string): Promise<string> {
    try {
      const workbook = xlsx.readFile(filePath);
      let fullText = '';

      // รวมข้อความจากทุก sheet
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const sheetText = xlsx.utils.sheet_to_txt(sheet);
        fullText += `Sheet: ${sheetName}\n${sheetText}\n\n`;
      }

      return fullText;
    } catch (error) {
      console.error('Error processing Excel file:', error);
      throw error;
    }
  }
}

export const documentService = new DocumentService(); 