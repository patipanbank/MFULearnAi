import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromEnv } from '@aws-sdk/credential-provider-env';

export class BedrockService {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async createBatchTextEmbeddings(
    texts: string[], 
    onProgress?: (completed: number, total: number) => void
  ): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    console.log(`🔮 Starting batch embedding for ${texts.length} texts`);
    
    try {
      // สำหรับข้อความจำนวนมาก ให้แบ่งเป็น batch ย่อย
      if (texts.length > 50) {
        return await this.createLargeBatchEmbeddings(texts, onProgress);
      }
      
      // สำหรับข้อความน้อย ใช้ parallel processing
      return await this.createParallelEmbeddings(texts, onProgress);
      
    } catch (error) {
      console.error('Error creating batch embeddings:', error);
      throw error;
    }
  }

  private async createLargeBatchEmbeddings(
    texts: string[], 
    onProgress?: (completed: number, total: number) => void
  ): Promise<number[][]> {
    const BATCH_SIZE = 10; // จำนวน embedding ที่ทำพร้อมกัน
    const DELAY_BETWEEN_BATCHES = 200; // หน่วงเวลาระหว่าง batch (ms)
    
    const allEmbeddings: number[][] = [];
    let completed = 0;
    
    console.log(`📦 Processing ${texts.length} texts in batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      
      try {
        console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`);
        
        const batchEmbeddings = await this.createParallelEmbeddings(batch);
        allEmbeddings.push(...batchEmbeddings);
        
        completed += batch.length;
        onProgress?.(completed, texts.length);
        
        // หน่วงเวลาเล็กน้อยเพื่อป้องกัน rate limiting
        if (i + BATCH_SIZE < texts.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
        
      } catch (error) {
        console.error(`❌ Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
        
        // ลองทำทีละอันสำหรับ batch ที่ล้มเหลว
        console.log(`🔄 Retrying batch ${Math.floor(i / BATCH_SIZE) + 1} sequentially`);
        const fallbackEmbeddings = await this.createSequentialEmbeddings(batch);
        allEmbeddings.push(...fallbackEmbeddings);
        
        completed += batch.length;
        onProgress?.(completed, texts.length);
      }
    }
    
    console.log(`✅ Completed batch embedding: ${allEmbeddings.length} embeddings`);
    return allEmbeddings;
  }

  private async createParallelEmbeddings(
    texts: string[], 
    onProgress?: (completed: number, total: number) => void
  ): Promise<number[][]> {
    const MAX_CONCURRENT = 5; // จำกัดจำนวน concurrent requests
    const embeddings: number[][] = [];
    let completed = 0;
    
    // แบ่งเป็น chunks เพื่อจำกัด concurrent requests
    for (let i = 0; i < texts.length; i += MAX_CONCURRENT) {
      const chunk = texts.slice(i, i + MAX_CONCURRENT);
      
      const chunkPromises = chunk.map(async (text, index) => {
        try {
          const embedding = await this.createTextEmbedding(text);
          return { index: i + index, embedding, success: true };
        } catch (error) {
          console.warn(`⚠️ Failed to embed text ${i + index}, will retry`);
          return { index: i + index, embedding: null, success: false, error };
        }
      });
      
      const chunkResults = await Promise.allSettled(chunkPromises);
      
      // Process results and handle failures
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          const { index, embedding, success } = result.value;
          
          if (success && embedding) {
            embeddings[index] = embedding;
          } else {
            // Retry failed embedding sequentially
            try {
              console.log(`🔄 Retrying embedding for index ${index}`);
              const retryEmbedding = await this.createTextEmbedding(texts[index]);
              embeddings[index] = retryEmbedding;
            } catch (retryError) {
              console.error(`❌ Final failure for text ${index}:`, retryError);
              throw new Error(`Failed to create embedding for text at index ${index}`);
            }
          }
        } else {
          throw new Error(`Chunk processing failed: ${result.reason}`);
        }
        
        completed++;
        onProgress?.(completed, texts.length);
      }
    }
    
    return embeddings.filter(e => e); // Remove any null/undefined entries
  }

  private async createSequentialEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        console.log(`🔄 Sequential embedding ${i + 1}/${texts.length}`);
        const embedding = await this.createTextEmbedding(texts[i]);
        embeddings.push(embedding);
        
        // Small delay to prevent overwhelming the service
        if (i < texts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Failed to create embedding ${i + 1}:`, error);
        throw error;
      }
    }
    
    return embeddings;
  }

  async createTextEmbedding(text: string): Promise<number[]> {
    try {
      console.log('🔮 Creating embedding for text:', text.substring(0, 100) + '...');
      
      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Empty text provided for embedding');
      }
      
      // Truncate text if too long (Titan limit is ~8000 tokens)
      const maxLength = 25000; // Conservative estimate for characters
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
      
      if (text.length !== truncatedText.length) {
        console.warn(`⚠️ Text truncated from ${text.length} to ${truncatedText.length} characters`);
      }

      const input = {
        inputText: truncatedText,
      };

      const command = new InvokeModelCommand({
        modelId: 'amazon.titan-embed-text-v1',
        contentType: 'application/json',
        body: JSON.stringify(input),
      });

      const response = await this.client.send(command);
      
      if (!response.body) {
        throw new Error('Empty response from Bedrock');
      }
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      if (!responseBody.embedding || !Array.isArray(responseBody.embedding)) {
        throw new Error('Invalid embedding response format');
      }
      
      console.log('✅ Embedding created successfully, dimension:', responseBody.embedding.length);
      return responseBody.embedding;
      
    } catch (error: any) {
      console.error('❌ Error creating text embedding:', {
        message: error instanceof Error ? error.message : error,
        name: error instanceof Error ? error.name : 'Unknown',
        code: error.code || 'Unknown',
        statusCode: error.$metadata?.httpStatusCode
      });
      
      // Check for specific AWS errors
      if (error.name === 'ThrottlingException') {
        throw new Error('Bedrock service is throttled. Please try again later.');
      }
      if (error.name === 'ValidationException') {
        throw new Error('Invalid input for embedding model.');
      }
      if (error.name === 'AccessDeniedException') {
        throw new Error('Access denied to Bedrock service. Check AWS credentials.');
      }
      if (error.name === 'ServiceUnavailableException') {
        throw new Error('Bedrock service is temporarily unavailable.');
      }
      
      // For development/testing, you might want to return dummy embeddings
      // Comment out the lines below for production
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: Returning dummy embedding with 1536 dimensions');
        return new Array(1536).fill(0.001); // Titan embedding dimension
      }
      
      // Re-throw the error in production
      throw error;
    }
  }

  async createImageEmbedding(imageBase64: string, text?: string): Promise<number[]> {
    const modelId = 'amazon.titan-embed-image-v1';
    const body: any = { inputImage: imageBase64 };
    if (text) body.inputText = text;
    try {
      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(body),
        contentType: 'application/json',
        accept: 'application/json',
      });
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.embedding;
    } catch (error) {
      console.error('Failed to create image embedding:', error);
      return [];
    }
  }

  async generateImage(prompt: string): Promise<string> {
    const modelId = 'amazon.titan-image-generator-v1';
    const body = {
      taskType: 'TEXT_IMAGE',
      textToImageParams: { text: prompt },
      imageGenerationConfig: {
        numberOfImages: 1,
        quality: 'standard',
        height: 1024,
        width: 1024,
        cfgScale: 8.0,
        seed: 0,
      },
    };
    try {
      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(body),
        contentType: 'application/json',
        accept: 'application/json',
      });
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.images?.[0] || '';
    } catch (error) {
      console.error('Failed to generate image:', error);
      return '';
    }
  }

  async *converseStream(
    modelId: string,
    messages: any[],
    systemPrompt: string,
    toolConfig?: any,
    temperature?: number,
    topP?: number
  ): AsyncGenerator<any, void, unknown> {
    // หมายเหตุ converseStream ยังไม่มีใน JS SDK v3 (2024/07) ใช้ invokeModel แบบปกติแทน
    // หรือถ้า Bedrock รองรับ streaming ในอนาคต ให้เปลี่ยนมาใช้ method ที่เหมาะสม
    const body: any = {
      messages,
      system: systemPrompt ? [{ text: systemPrompt }] : [],
      toolConfig,
      inferenceConfig: {},
    };
    if (temperature !== undefined) body.inferenceConfig.temperature = temperature;
    if (topP !== undefined) body.inferenceConfig.topP = topP;
    try {
      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(body),
        contentType: 'application/json',
        accept: 'application/json',
      });
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      // จำลอง streaming: yield ทั้งหมดทีเดียว (ถ้าอนาคต SDK รองรับ streaming ให้แก้ไขตรงนี้)
      yield responseBody;
    } catch (error) {
      console.error('Error during converseStream:', error);
      yield { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const bedrockService = new BedrockService(); 