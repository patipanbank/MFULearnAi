import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromEnv } from '@aws-sdk/credential-provider-env';

export class BedrockService {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async createBatchTextEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const embeddings: number[][] = [];
      
      for (const text of texts) {
        const embedding = await this.createTextEmbedding(text);
        embeddings.push(embedding);
      }
      
      return embeddings;
    } catch (error) {
      console.error('Error creating batch embeddings:', error);
      throw error;
    }
  }

  async createTextEmbedding(text: string): Promise<number[]> {
    try {
      console.log('🔮 Creating embedding for text:', text.substring(0, 100) + '...');
      const input = {
        inputText: text,
      };

      const command = new InvokeModelCommand({
        modelId: 'amazon.titan-embed-text-v1',
        contentType: 'application/json',
        body: JSON.stringify(input),
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      console.log('✅ Embedding created successfully, dimension:', responseBody.embedding?.length);
      return responseBody.embedding;
    } catch (error) {
      console.error('❌ Error creating text embedding:', {
        message: error instanceof Error ? error.message : error,
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Return dummy embedding for now
      console.log('⚠️ Returning dummy embedding with 384 dimensions');
      return new Array(384).fill(0);
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