import { Injectable, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  /**
   * Parse file content based on file type
   */
  async parseFileContent(buffer: Buffer, filename: string): Promise<string> {
    try {
      const extension = filename.split('.').pop()?.toLowerCase();
      
      switch (extension) {
        case 'txt':
          return this.parseTextFile(buffer);
        case 'pdf':
          return await this.parsePdfFile(buffer);
        case 'docx':
          return await this.parseDocxFile(buffer);
        case 'doc':
          return await this.parseDocFile(buffer);
        case 'csv':
          return this.parseCsvFile(buffer);
        case 'json':
          return this.parseJsonFile(buffer);
        case 'md':
        case 'markdown':
          return this.parseMarkdownFile(buffer);
        default:
          // Try to parse as text
          return this.parseTextFile(buffer);
      }
    } catch (error) {
      this.logger.error(`Error parsing file ${filename}: ${error.message}`);
      throw new Error(`Failed to parse file ${filename}: ${error.message}`);
    }
  }

  /**
   * Parse text file
   */
  private parseTextFile(buffer: Buffer): string {
    return buffer.toString('utf-8');
  }

  /**
   * Parse PDF file using pdf-parse
   */
  private async parsePdfFile(buffer: Buffer): Promise<string> {
    try {
      this.logger.log('📄 Parsing PDF file using pdf-parse');
      
      const data = await pdfParse(buffer);
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }
      
      this.logger.log(`✅ Successfully extracted ${data.text.length} characters from PDF`);
      return data.text;
    } catch (error) {
      this.logger.error(`Error parsing PDF: ${error.message}`);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  /**
   * Parse DOCX file using mammoth
   */
  private async parseDocxFile(buffer: Buffer): Promise<string> {
    try {
      this.logger.log('📄 Parsing DOCX file using mammoth');
      
      const result = await mammoth.extractRawText({ buffer });
      
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('No text content found in DOCX');
      }
      
      this.logger.log(`✅ Successfully extracted ${result.value.length} characters from DOCX`);
      return result.value;
    } catch (error) {
      this.logger.error(`Error parsing DOCX: ${error.message}`);
      throw new Error(`Failed to parse DOCX: ${error.message}`);
    }
  }

  /**
   * Parse DOC file (convert to DOCX first if possible)
   */
  private async parseDocFile(buffer: Buffer): Promise<string> {
    try {
      this.logger.log('📄 Attempting to parse DOC file');
      
      // Try to parse as DOCX first (some .doc files are actually DOCX)
      try {
        return await this.parseDocxFile(buffer);
      } catch (error) {
        this.logger.warn('Failed to parse as DOCX, trying alternative method');
      }
      
      // For .doc files, we might need additional libraries like antiword or catdoc
      // For now, return an error suggesting conversion
      throw new Error('DOC file parsing requires additional setup. Please convert to DOCX or PDF first.');
    } catch (error) {
      this.logger.error(`Error parsing DOC: ${error.message}`);
      throw new Error(`Failed to parse DOC: ${error.message}`);
    }
  }

  /**
   * Parse CSV file
   */
  private parseCsvFile(buffer: Buffer): string {
    const csvContent = buffer.toString('utf-8');
    // Convert CSV to readable text format
    const lines = csvContent.split('\n');
    const textLines = lines.map(line => {
      const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
      return columns.join(' | ');
    });
    return textLines.join('\n');
  }

  /**
   * Parse JSON file
   */
  private parseJsonFile(buffer: Buffer): string {
    try {
      const jsonContent = buffer.toString('utf-8');
      const parsed = JSON.parse(jsonContent);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      this.logger.error('Error parsing JSON file:', error);
      return buffer.toString('utf-8');
    }
  }

  /**
   * Parse Markdown file
   */
  private parseMarkdownFile(buffer: Buffer): string {
    const markdownContent = buffer.toString('utf-8');
    // Remove markdown formatting for better text extraction
    return markdownContent
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Convert images to alt text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .trim();
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return [
      'txt', 'pdf', 'docx', 'doc', 'csv', 'json', 'md', 'markdown'
    ];
  }

  /**
   * Check if file type is supported
   */
  isFileTypeSupported(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? this.getSupportedFileTypes().includes(extension) : false;
  }

  /**
   * Get file size in MB
   */
  getFileSizeMB(buffer: Buffer): number {
    return buffer.length / (1024 * 1024);
  }

  /**
   * Validate file size (max 50MB)
   */
  validateFileSize(buffer: Buffer, maxSizeMB: number = 50): boolean {
    const fileSizeMB = this.getFileSizeMB(buffer);
    return fileSizeMB <= maxSizeMB;
  }
} 