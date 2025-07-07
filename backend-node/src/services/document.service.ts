import { Injectable } from '@nestjs/common';
import pdfParse from 'pdf-parse';

@Injectable()
export class DocumentService {
  async parseFileContent(buffer: Buffer, filename: string): Promise<string> {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) {
      try {
        const data = await pdfParse(buffer);
        return data.text || '';
      } catch (e) {
        // fallback to empty
        return '';
      }
    }
    // Assume utf-8 text
    return buffer.toString('utf-8');
  }
} 