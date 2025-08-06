import { v4 as uuidv4 } from 'uuid';
import { chromaService } from './chromaService';
import { bedrockService } from './bedrockService';
import { documentService } from './documentService';
import { IUser } from '../models/user';

export class TrainingService {
  private textSplitter: any; // TODO: Implement text splitter

  constructor() {
    // TODO: Initialize text splitter
  }

  private async embedAndStore(
    text: string,
    sourceName: string,
    contentType: string,
    collectionName: string,
    user: IUser,
    modelId: string
  ): Promise<number> {
    if (!text || !text.trim()) {
      return 0;
    }

    // Simple text splitting for now
    const chunks = this.splitText(text);
    if (!chunks || chunks.length === 0) {
      return 0;
    }

    try {
      // Create embeddings using Bedrock
      const embeddings = await bedrockService.createBatchTextEmbeddings(chunks);
      if (!embeddings || embeddings.length !== chunks.length) {
        console.error(`Error: Mismatch between number of chunks (${chunks.length}) and embeddings (${embeddings?.length || 0}) for source ${sourceName}`);
        return 0;
      }

      // Prepare documents for ChromaDB
      const documentsToAdd = chunks.map((chunk, index) => ({
        id: uuidv4(),
        document: chunk,
        metadata: {
          source_type: contentType,
          source: sourceName,
          uploadedBy: user?.username || 'system',
          userId: user?._id?.toString() || 'system',
          modelId: modelId,
          collectionName: collectionName,
        },
        embedding: embeddings[index],
      }));

      if (documentsToAdd.length > 0) {
        await chromaService.addDocuments(collectionName, documentsToAdd);
      }

      return documentsToAdd.length;
    } catch (error) {
      console.error('Error in embedAndStore:', error);
      throw error;
    }
  }

  private splitText(text: string): string[] {
    // Simple text splitting - split by paragraphs and sentences
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length > 0) {
        // Split long paragraphs into sentences
        const sentences = paragraph.split(/[.!?]+/);
        let currentChunk = '';
        
        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (trimmed.length > 0) {
            if (currentChunk.length + trimmed.length > 1000) {
              if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
              }
            }
            currentChunk += (currentChunk ? ' ' : '') + trimmed;
          }
        }
        
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
        }
      }
    }
    
    return chunks;
  }

  async processAndEmbedFile(
    fileBuffer: Buffer,
    fileName: string,
    user: IUser,
    modelId: string,
    collectionName: string
  ): Promise<number> {
    if (!fileName) {
      throw new Error('File has no filename.');
    }

    try {
      console.log(`📄 Processing file: ${fileName} (${fileBuffer.length} bytes) for collection: ${collectionName}`);
      
      // Parse file content
      const textContent = await documentService.parseFileContent(fileBuffer, fileName);
      console.log(`📝 Parsed content length: ${textContent.length} characters`);
      
      const numChunks = await this.embedAndStore(
        textContent,
        fileName,
        'file',
        collectionName,
        user,
        modelId
      );

      console.log(`✅ Processed file ${fileName}: ${numChunks} chunks added to collection ${collectionName}`);
      return numChunks;
    } catch (error) {
      console.error(`❌ Error processing file ${fileName}:`, error);
      throw error;
    }
  }

  async processAndEmbedText(
    text: string,
    documentName: string,
    user: IUser,
    modelId: string,
    collectionName: string
  ): Promise<number> {
    try {
      const numChunks = await this.embedAndStore(
        text,
        documentName,
        'text',
        collectionName,
        user,
        modelId
      );

      console.log(`Processed text ${documentName}: ${numChunks} chunks added to collection ${collectionName}`);
      return numChunks;
    } catch (error) {
      console.error(`Error processing text ${documentName}:`, error);
      throw error;
    }
  }
}

export const trainingService = new TrainingService(); 