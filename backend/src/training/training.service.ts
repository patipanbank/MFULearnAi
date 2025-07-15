import { Injectable, BadRequestException } from '@nestjs/common';
import { BedrockService } from '../bedrock/bedrock.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { Collection } from '../models/collection.model';
import { TrainingHistoryService } from './training-history.service';
import { TrainingAction } from '../models/training-history.model';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as csv from 'csv-parse';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface ProcessedDocument {
  filename: string;
  content: string;
  chunkCount: number;
  metadata: Record<string, any>;
}

interface DocumentChunk {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

@Injectable()
export class TrainingService {
  constructor(
    private bedrockService: BedrockService,
    private embeddingService: EmbeddingService,
    private trainingHistoryService: TrainingHistoryService,
  ) {}

  // Text chunking algorithm matching FastAPI
  private recursiveCharacterTextSplit(
    text: string,
    chunkSize: number = 1000,
    chunkOverlap: number = 200,
    separators: string[] = ['\n\n', '\n', ' ', '']
  ): string[] {
    const chunks: string[] = [];
    
    if (text.length <= chunkSize) {
      return [text];
    }

    for (const separator of separators) {
      if (separator === '') {
        // If we reach the last separator (empty string), just split by character
        for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
          const chunk = text.slice(i, i + chunkSize);
          if (chunk.trim()) {
            chunks.push(chunk.trim());
          }
        }
        break;
      }

      const parts = text.split(separator);
      let currentChunk = '';

      for (const part of parts) {
        const testChunk = currentChunk + (currentChunk ? separator : '') + part;
        
        if (testChunk.length <= chunkSize) {
          currentChunk = testChunk;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          
          if (part.length > chunkSize) {
            // Recursively split the oversized part
            const subChunks = this.recursiveCharacterTextSplit(
              part, chunkSize, chunkOverlap, separators.slice(separators.indexOf(separator) + 1)
            );
            chunks.push(...subChunks);
            currentChunk = '';
          } else {
            currentChunk = part;
          }
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      break; // Successfully split with current separator
    }

    // Add overlap between chunks
    const overlappedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let finalChunk = chunks[i];
      
      // Add overlap from previous chunk
      if (i > 0 && chunkOverlap > 0) {
        const prevChunk = chunks[i - 1];
        const overlapText = prevChunk.slice(-chunkOverlap);
        finalChunk = overlapText + ' ' + finalChunk;
      }
      
      overlappedChunks.push(finalChunk.trim());
    }

    return overlappedChunks.filter(chunk => chunk.length > 0);
  }

  async uploadFiles(
    files: Express.Multer.File[],
    collectionId: string,
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<{ success: boolean; message: string; processedFiles: ProcessedDocument[] }> {
    try {
      console.log(`Processing ${files.length} files for collection ${collectionId}`);
      
      const processedFiles: ProcessedDocument[] = [];
      const allChunks: DocumentChunk[] = [];

      for (const file of files) {
        console.log(`Processing file: ${file.originalname}`);
        
        const content = await this.extractTextFromFile(file);
        const chunks = this.recursiveCharacterTextSplit(content);
        
        console.log(`Extracted ${content.length} characters, created ${chunks.length} chunks`);
        
        // Generate embeddings for all chunks
        const embeddings = await this.bedrockService.generateBatchEmbeddings(chunks, modelId);
        
        // Create document chunks with embeddings
        const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
          id: uuidv4(),
          content: chunk,
          metadata: {
            source: file.originalname,
            source_type: 'file',
            chunk_index: index,
            total_chunks: chunks.length,
            collection_id: collectionId,
            model_id: modelId,
            embedding_dimension: this.bedrockService.getModelDimension(modelId),
            created_at: new Date().toISOString()
          },
          embedding: embeddings[index]
        }));
        
        allChunks.push(...documentChunks);
        
        processedFiles.push({
          filename: file.originalname,
          content: content.substring(0, 1000) + '...', // Preview
          chunkCount: chunks.length,
          metadata: {
            fileSize: file.size,
            mimeType: file.mimetype,
            totalChunks: chunks.length
          }
        });
      }

      // Store all chunks in ChromaDB
      if (allChunks.length > 0) {
        await this.embeddingService.addDocuments(collectionId, allChunks.map(chunk => ({
          id: chunk.id,
          document: chunk.content,
          embedding: chunk.embedding || [],
          metadata: chunk.metadata
        })));
      }

      // Update collection statistics
      await this.updateCollectionStats(collectionId, allChunks.length, files);

      return {
        success: true,
        message: `Successfully processed ${files.length} files with ${allChunks.length} total chunks`,
        processedFiles
      };
    } catch (error) {
      console.error('Error processing files:', error);
      throw new BadRequestException(`File processing failed: ${error.message}`);
    }
  }

  async ingestDirectory(
    directoryPath: string,
    collectionId: string,
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<{ success: boolean; message: string; processedFiles: string[] }> {
    try {
      console.log(`Ingesting directory: ${directoryPath}`);
      
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
      }

      const files = fs.readdirSync(directoryPath);
      const supportedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.md'];
      const validFiles = files.filter(file => 
        supportedExtensions.some(ext => file.toLowerCase().endsWith(ext))
      );

      if (validFiles.length === 0) {
        throw new Error('No supported files found in directory');
      }

      const processedFiles: string[] = [];
      const allChunks: DocumentChunk[] = [];

      for (const filename of validFiles) {
        const filePath = path.join(directoryPath, filename);
        const fileBuffer = fs.readFileSync(filePath);
        
        const mockFile: Express.Multer.File = {
          fieldname: 'file',
          originalname: filename,
          encoding: '7bit',
          mimetype: this.getMimeTypeFromExtension(filename),
          size: fileBuffer.length,
          buffer: fileBuffer,
          destination: '',
          filename: filename,
          path: filePath,
          stream: null as any
        };

        const content = await this.extractTextFromFile(mockFile);
        const chunks = this.recursiveCharacterTextSplit(content);
        
        const embeddings = await this.bedrockService.generateBatchEmbeddings(chunks, modelId);
        
        const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
          id: uuidv4(),
          content: chunk,
          metadata: {
            source: filename,
            source_type: 'directory',
            chunk_index: index,
            total_chunks: chunks.length,
            collection_id: collectionId,
            model_id: modelId,
            embedding_dimension: this.bedrockService.getModelDimension(modelId),
            created_at: new Date().toISOString()
          },
          embedding: embeddings[index]
        }));
        
        allChunks.push(...documentChunks);
        processedFiles.push(filename);
      }

      // Store in ChromaDB
      if (allChunks.length > 0) {
        await this.embeddingService.addDocuments(collectionId, allChunks.map(chunk => ({
          id: chunk.id,
          document: chunk.content,
          embedding: chunk.embedding || [],
          metadata: chunk.metadata
        })));
      }

      await this.updateCollectionStats(collectionId, allChunks.length, []);

      return {
        success: true,
        message: `Successfully processed ${processedFiles.length} files from directory`,
        processedFiles
      };
    } catch (error) {
      console.error('Error ingesting directory:', error);
      throw new BadRequestException(`Directory ingestion failed: ${error.message}`);
    }
  }

  private async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    const extension = path.extname(file.originalname).toLowerCase();
    
    try {
      switch (extension) {
        case '.pdf':
          return await this.parsePDF(file.buffer);
        case '.docx':
          return await this.parseDOCX(file.buffer);
        case '.doc':
          return await this.parseDOC(file.buffer);
        case '.csv':
          return await this.parseCSV(file.buffer);
        case '.txt':
        case '.md':
          return file.buffer.toString('utf-8');
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }
    } catch (error) {
      console.error(`Error parsing ${file.originalname}:`, error);
      throw new Error(`Failed to parse ${file.originalname}: ${error.message}`);
    }
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return this.cleanExtractedText(data.text);
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  private async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return this.cleanExtractedText(result.value);
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  private async parseDOC(buffer: Buffer): Promise<string> {
    // For .doc files, we'll attempt to use mammoth as well
    // Note: mammoth primarily supports .docx, so .doc support might be limited
    try {
      const result = await mammoth.extractRawText({ buffer });
      return this.cleanExtractedText(result.value);
    } catch (error) {
      throw new Error(`DOC parsing failed (limited support): ${error.message}`);
    }
  }

  private async parseCSV(buffer: Buffer): Promise<string> {
    try {
      const csvText = buffer.toString('utf-8');
      const records: any[] = [];
      
      return new Promise((resolve, reject) => {
        csv.parse(csvText, {
          columns: true,
          skip_empty_lines: true
        })
        .on('data', (row) => records.push(row))
        .on('end', () => {
          // Convert CSV rows to readable text
          const textContent = records.map(row => 
            Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(', ')
          ).join('\n');
          resolve(this.cleanExtractedText(textContent));
        })
        .on('error', (error) => reject(error));
      });
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }

  async ingestWebUrls(
    urls: string[],
    collectionId: string,
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<{ success: boolean; message: string; processedUrls: ProcessedDocument[] }> {
    try {
      console.log(`Processing ${urls.length} URLs for collection ${collectionId}`);
      
      const processedUrls: ProcessedDocument[] = [];
      const allChunks: DocumentChunk[] = [];

      for (const url of urls) {
        try {
          const content = await this.scrapeWebContent(url);
          const chunks = this.recursiveCharacterTextSplit(content);
          
          console.log(`Scraped ${content.length} characters from ${url}, created ${chunks.length} chunks`);
          
          const embeddings = await this.bedrockService.generateBatchEmbeddings(chunks, modelId);
          
          const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
            id: uuidv4(),
            content: chunk,
            metadata: {
              source: url,
              source_type: 'url',
              chunk_index: index,
              total_chunks: chunks.length,
              collection_id: collectionId,
              model_id: modelId,
              embedding_dimension: this.bedrockService.getModelDimension(modelId),
              created_at: new Date().toISOString()
            },
            embedding: embeddings[index]
          }));
          
          allChunks.push(...documentChunks);
          
          processedUrls.push({
            filename: url,
            content: content.substring(0, 1000) + '...', // Preview
            chunkCount: chunks.length,
            metadata: {
              url: url,
              contentLength: content.length,
              totalChunks: chunks.length
            }
          });
        } catch (urlError) {
          console.error(`Error processing URL ${url}:`, urlError);
          processedUrls.push({
            filename: url,
            content: 'Error: Failed to scrape content',
            chunkCount: 0,
            metadata: {
              url: url,
              error: urlError.message
            }
          });
        }
      }

      // Store valid chunks in ChromaDB
      const validChunks = allChunks.filter(chunk => chunk.content.length > 0);
      if (validChunks.length > 0) {
        await this.embeddingService.addDocuments(collectionId, validChunks.map(chunk => ({
          id: chunk.id,
          document: chunk.content,
          embedding: chunk.embedding || [],
          metadata: chunk.metadata
        })));
      }

      await this.updateCollectionStats(collectionId, validChunks.length, []);

      return {
        success: true,
        message: `Successfully processed ${processedUrls.length} URLs with ${validChunks.length} total chunks`,
        processedUrls
      };
    } catch (error) {
      console.error('Error processing URLs:', error);
      throw new BadRequestException(`URL processing failed: ${error.message}`);
    }
  }

  private async scrapeWebContent(url: string): Promise<string> {
    try {
      console.log(`Scraping content from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Remove unwanted elements
      $('script, style, nav, header, footer, aside, .advertisement, .ads').remove();
      
      // Extract main content
      let content = '';
      
      // Try to find main content areas
      const contentSelectors = [
        'main', 'article', '.content', '.main-content', 
        '.post-content', '.entry-content', '[role="main"]'
      ];
      
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text();
          break;
        }
      }
      
      // Fallback to body if no main content found
      if (!content) {
        content = $('body').text();
      }
      
      return this.cleanExtractedText(content);
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      throw new Error(`Web scraping failed for ${url}: ${error.message}`);
    }
  }

  private cleanExtractedText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove multiple line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Remove leading/trailing whitespace
      .trim()
      // Remove very short content
      .length < 10 ? '' : text.trim();
  }

  private getMimeTypeFromExtension(filename: string): string {
    const extension = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.md': 'text/markdown'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  private async updateCollectionStats(collectionId: string, chunkCount: number, files: Express.Multer.File[]): Promise<void> {
    try {
      // Update MongoDB collection document count and size
      console.log(`Updating collection ${collectionId} stats: +${chunkCount} chunks, +${files.length} files`);
      
      // This would update the collection stats in MongoDB
      // await Collection.findByIdAndUpdate(collectionId, {
      //   $inc: {
      //     documentCount: chunkCount,
      //     fileCount: files.length,
      //     totalSize: files.reduce((sum, file) => sum + file.size, 0)
      //   },
      //   lastUpdated: new Date()
      // });
      
      console.log(`Collection stats updated for ${collectionId}`);
    } catch (error) {
      console.error('Error updating collection stats:', error);
      // Don't throw error - this shouldn't fail the main operation
    }
  }

  async processTextContent(
    content: string,
    collectionId: string,
    sourceName: string = 'text_input',
    modelId: string = 'amazon.titan-embed-text-v1'
  ): Promise<{ success: boolean; message: string; chunkCount: number }> {
    try {
      console.log(`Processing text content for collection ${collectionId}`);
      
      const chunks = this.recursiveCharacterTextSplit(content);
      const embeddings = await this.bedrockService.generateBatchEmbeddings(chunks, modelId);
      
      const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
        id: uuidv4(),
        content: chunk,
        metadata: {
          source: sourceName,
          source_type: 'text',
          chunk_index: index,
          total_chunks: chunks.length,
          collection_id: collectionId,
          model_id: modelId,
          embedding_dimension: this.bedrockService.getModelDimension(modelId),
          created_at: new Date().toISOString()
        },
        embedding: embeddings[index]
      }));

      await this.embeddingService.addDocuments(collectionId, documentChunks.map(chunk => ({
        id: chunk.id,
        document: chunk.content,
        embedding: chunk.embedding || [],
        metadata: chunk.metadata
      })));

      await this.updateCollectionStats(collectionId, chunks.length, []);

      return {
        success: true,
        message: `Successfully processed text content with ${chunks.length} chunks`,
        chunkCount: chunks.length
      };
    } catch (error) {
      console.error('Error processing text content:', error);
      throw new BadRequestException(`Text processing failed: ${error.message}`);
    }
  }

  // Wrapper methods for controller compatibility
  async processAndEmbedFile(
    file: Express.Multer.File,
    user: any,
    modelId: string,
    collectionName: string
  ): Promise<number> {
    try {
      const result = await this.uploadFiles([file], collectionName, modelId);
      return result.processedFiles[0]?.chunkCount || 0;
    } catch (error) {
      throw new BadRequestException(`File processing failed: ${error.message}`);
    }
  }

  async processAndEmbedUrl(
    url: string,
    user: any,
    modelId: string,
    collectionName: string
  ): Promise<number> {
    try {
      const result = await this.ingestWebUrls([url], collectionName, modelId);
      return result.processedUrls[0]?.chunkCount || 0;
    } catch (error) {
      throw new BadRequestException(`URL processing failed: ${error.message}`);
    }
  }

  async processAndEmbedText(
    text: string,
    user: any,
    modelId: string,
    collectionName: string,
    documentName: string
  ): Promise<number> {
    try {
      const result = await this.processTextContent(text, collectionName, documentName, modelId);
      return result.chunkCount;
    } catch (error) {
      throw new BadRequestException(`Text processing failed: ${error.message}`);
    }
  }
} 