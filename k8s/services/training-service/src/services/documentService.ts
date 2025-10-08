import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';

export class DocumentService {
  async parseFileContent(fileBuffer: Buffer, fileName: string): Promise<string> {
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    console.log(`Parsing file: ${fileName} (${fileExtension})`);

    try {
      switch (fileExtension) {
        case 'txt':
          return this.parseTextFile(fileBuffer);
        case 'pdf':
          return await this.parsePdfFile(fileBuffer);
        case 'doc':
        case 'docx':
          return await this.parseWordFile(fileBuffer);
        case 'csv':
          return await this.parseCsvFile(fileBuffer);
        case 'xls':
        case 'xlsx':
          return this.parseExcelFile(fileBuffer);
        default:
          // For unknown file types, try to parse as text
          console.log(`Unknown file type: ${fileExtension}, trying as text`);
          return this.parseTextFile(fileBuffer);
      }
    } catch (error: any) {
      console.error(`Error parsing file ${fileName}:`, error);
      throw new Error(`Failed to parse ${fileExtension} file: ${error?.message || error}`);
    }
  }

  private parseTextFile(fileBuffer: Buffer): string {
    const content = fileBuffer.toString('utf-8');
    console.log(`Text file parsed: ${content.length} characters`);
    return content;
  }

  private async parsePdfFile(fileBuffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(fileBuffer);
      console.log(`PDF parsed: ${data.text.length} characters, ${data.numpages} pages`);
      return data.text;
    } catch (error: any) {
      console.error('PDF parsing failed:', error);
      throw new Error(`Failed to parse PDF: ${error?.message || error}`);
    }
  }

  private async parseWordFile(fileBuffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      console.log(`Word document parsed: ${result.value.length} characters`);
      if (result.messages.length > 0) {
        console.log('Word parsing warnings:', result.messages);
      }
      return result.value;
    } catch (error: any) {
      console.error('Word document parsing failed:', error);
      throw new Error(`Failed to parse Word document: ${error?.message || error}`);
    }
  }

  private async parseCsvFile(fileBuffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(fileBuffer);

      stream
        .pipe(csv())
        .on('data', (data: any) => results.push(data))
        .on('end', () => {
          try {
            // Convert CSV data to readable text
            const text = results.map(row => {
              return Object.entries(row)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            }).join('\n');

            console.log(`CSV parsed: ${results.length} rows, ${text.length} characters`);
            resolve(text);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error: any) => {
          console.error('CSV parsing failed:', error);
          reject(new Error(`Failed to parse CSV: ${error?.message || error}`));
        });
    });
  }

  private parseExcelFile(fileBuffer: Buffer): string {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      let allText = '';

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Convert sheet data to text
        const sheetText = (sheetData as any[][]).map((row: any[]) =>
          row.join(', ')
        ).join('\n');

        allText += `Sheet: ${sheetName}\n${sheetText}\n\n`;
      });

      console.log(`Excel parsed: ${workbook.SheetNames.length} sheets, ${allText.length} characters`);
      return allText;
    } catch (error: any) {
      console.error('Excel parsing failed:', error);
      throw new Error(`Failed to parse Excel file: ${error?.message || error}`);
    }
  }
}

export const documentService = new DocumentService();
