import { PDFImage } from 'pdf-image';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { exec } from 'child_process';
import { promisify } from 'util';
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