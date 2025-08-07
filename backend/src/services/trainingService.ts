import { v4 as uuidv4 } from 'uuid';
import { chromaService } from './chromaService';
import { bedrockService } from './bedrockService';
import { documentService } from './documentService';
import { IUser } from '../models/user';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export class TrainingService {
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', '! ', '? ', ' ', ''],
    });
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

    // Smart text splitting using LangChain
    const chunks = await this.splitText(text);
    if (!chunks || chunks.length === 0) {
      return 0;
    }

    try {
      console.log(`🔮 Creating embeddings for ${chunks.length} chunks...`);
      
      // Create embeddings using Bedrock with retry logic
      let embeddings: number[][] | null = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          embeddings = await bedrockService.createBatchTextEmbeddings(chunks);
          break;
        } catch (embeddingError: any) {
          retryCount++;
          console.error(`❌ Embedding attempt ${retryCount} failed:`, embeddingError);
          
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to create embeddings after ${maxRetries} attempts: ${embeddingError?.message || embeddingError}`);
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      if (!embeddings || embeddings.length !== chunks.length) {
        const errorMsg = `Mismatch between chunks (${chunks.length}) and embeddings (${embeddings?.length || 0}) for source ${sourceName}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ Successfully created ${embeddings.length} embeddings`);

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
          createdAt: new Date().toISOString(),
          chunkIndex: index,
          chunkSize: chunk.length,
        },
        embedding: embeddings[index],
      }));

      if (documentsToAdd.length > 0) {
        console.log(`💾 Storing ${documentsToAdd.length} documents in ChromaDB...`);
        await chromaService.addDocuments(collectionName, documentsToAdd);
        console.log(`✅ Successfully stored documents in collection: ${collectionName}`);
      }

      return documentsToAdd.length;
    } catch (error: any) {
      console.error(`❌ Error in embedAndStore for source ${sourceName}:`, {
        error: error?.message || error,
        chunksCount: chunks?.length || 0,
        contentType,
        collectionName
      });
      throw error;
    }
  }

  private async splitText(text: string): Promise<string[]> {
    try {
      console.log(`📝 Splitting text: ${text.length} characters`);
      const chunks = await this.textSplitter.splitText(text);
      console.log(`✂️ Text split into ${chunks.length} chunks`);
      
      // Log chunk statistics
      const chunkSizes = chunks.map(chunk => chunk.length);
      const avgSize = chunkSizes.reduce((a, b) => a + b, 0) / chunks.length;
      const maxSize = Math.max(...chunkSizes);
      const minSize = Math.min(...chunkSizes);
      
      console.log(`📊 Chunk statistics: avg=${Math.round(avgSize)}, min=${minSize}, max=${maxSize}`);
      
      return chunks.filter(chunk => chunk.trim().length > 0);
    } catch (error) {
      console.error('❌ Text splitting failed:', error);
      // Fallback to simple splitting
      console.log('🔄 Using fallback text splitting');
      return this.fallbackSplitText(text);
    }
  }

  private fallbackSplitText(text: string): string[] {
    // Simple fallback text splitting
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length > 0) {
        if (paragraph.length <= 1000) {
          chunks.push(paragraph.trim());
        } else {
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
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }

  async processAndEmbedFile(
    fileBuffer: Buffer,
    fileName: string,
    user: IUser,
    modelId: string,
    collectionName: string
  ): Promise<number> {
    // Input validation
    if (!fileName) {
      throw new Error('File has no filename.');
    }
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('File buffer is empty.');
    }
    if (!collectionName) {
      throw new Error('Collection name is required.');
    }
    if (fileBuffer.length > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('File size exceeds maximum limit of 50MB.');
    }

    const startTime = Date.now();
    
    try {
      console.log(`📄 Processing file: ${fileName} (${fileBuffer.length} bytes) for collection: ${collectionName}`);
      
      // Parse file content
      const textContent = await documentService.parseFileContent(fileBuffer, fileName);
      console.log(`📝 Parsed content length: ${textContent.length} characters`);
      
      // Validate content
      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No readable content found in file.');
      }
      
      if (textContent.length < 10) {
        throw new Error('File content too short (minimum 10 characters required).');
      }
      
      const numChunks = await this.embedAndStore(
        textContent,
        fileName,
        'file',
        collectionName,
        user,
        modelId
      );

      const processingTime = Date.now() - startTime;
      console.log(`✅ Processed file ${fileName}: ${numChunks} chunks added to collection ${collectionName} in ${processingTime}ms`);
      
      return numChunks;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Error processing file ${fileName} after ${processingTime}ms:`, error);
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