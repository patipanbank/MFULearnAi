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
          const pdfData = await pdf(buffer);
          text = pdfData.text;
          break;

        case '.doc':
        case '.docx':
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
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
}

export const documentService = new DocumentService(); 