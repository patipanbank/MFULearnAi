import { BedrockRuntimeClient, InvokeModelCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: { text: string }[];
}

export interface ConverseStreamRequest {
  messages: BedrockMessage[];
  system_prompt?: string;
  model_id?: string;
  tool_config?: any;
  temperature?: number;
  top_p?: number;
}

export interface ImageGenerationRequest {
  prompt: string;
  width?: number;
  height?: number;
  quality?: string;
}

export interface ImageGenerationResponse {
  image: string;
}

export class BedrockService {
  private bedrockRuntimeClient: BedrockRuntimeClient;
  private bedrockClient: BedrockClient;
  private defaultModelId: string;

  constructor() {
    const region = process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    this.bedrockRuntimeClient = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bedrockClient = new BedrockClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.defaultModelId = process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
  }

  async createTextEmbedding(text: string, modelId?: string): Promise<number[]> {
    const model = modelId || 'amazon.titan-embed-text-v1';
    const body = { inputText: text };

    try {
      const command = new InvokeModelCommand({
        modelId: model,
        body: JSON.stringify(body),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.bedrockRuntimeClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.embedding;
    } catch (error) {
      console.error('Failed to create text embedding:', error);
      return [];
    }
  }

  async createBatchTextEmbeddings(texts: string[], modelId?: string): Promise<number[][]> {
    const promises = texts.map(text => this.createTextEmbedding(text, modelId));
    return Promise.all(promises);
  }

  async createImageEmbedding(imageBase64: string, text?: string, modelId?: string): Promise<number[]> {
    const model = modelId || 'amazon.titan-embed-image-v1';
    const body: any = { inputImage: imageBase64 };
    
    if (text) {
      body.inputText = text;
    }

    try {
      const command = new InvokeModelCommand({
        modelId: model,
        body: JSON.stringify(body),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.bedrockRuntimeClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.embedding;
    } catch (error) {
      console.error('Failed to create image embedding:', error);
      return [];
    }
  }

  async generateImage(prompt: string, width: number = 1024, height: number = 1024, quality: string = 'standard'): Promise<string> {
    const modelId = 'amazon.titan-image-generator-v1';
    const body = {
      taskType: 'TEXT_IMAGE',
      textToImageParams: { text: prompt },
      imageGenerationConfig: {
        numberOfImages: 1,
        quality,
        height,
        width,
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

      const response = await this.bedrockRuntimeClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.images[0];
    } catch (error) {
      console.error('Failed to generate image:', error);
      return '';
    }
  }

  async *converseStream(
    modelId: string,
    messages: BedrockMessage[],
    systemPrompt: string = '',
    toolConfig?: any,
    temperature?: number,
    topP?: number
  ): AsyncGenerator<any, void, unknown> {
    const model = modelId || this.defaultModelId;

    const inferenceConfig: any = {};
    if (temperature !== undefined) {
      inferenceConfig.temperature = temperature;
    }
    if (topP !== undefined) {
      inferenceConfig.topP = topP;
    }

    const systemMessages = systemPrompt ? [{ text: systemPrompt }] : [];

    try {
      const command = new ConverseStreamCommand({
        modelId: model,
        messages,
        system: systemMessages,
        toolConfig,
        inferenceConfig,
      });

      const response = await this.bedrockRuntimeClient.send(command);
      const stream = response.stream;

      if (stream) {
        for await (const event of stream) {
          yield event;
        }
      }
    } catch (error) {
      console.error('Error during Bedrock converse_stream:', error);
      yield { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async healthCheck(): Promise<any> {
    try {
      // Simple test to check if we can connect to Bedrock
      const command = new ListFoundationModelsCommand({});
      await this.bedrockClient.send(command);
      
      return {
        status: 'healthy',
        service: 'bedrock',
        timestamp: new Date().toISOString(),
        region: process.env.AWS_REGION,
        defaultModel: this.defaultModelId,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'bedrock',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const command = new ListFoundationModelsCommand({});
      const response = await this.bedrockClient.send(command);
      
      return response.modelSummaries?.map(model => model.modelId || '') || [];
    } catch (error) {
      console.error('Failed to list models:', error);
      return [];
    }
  }

  /**
   * 4.1: คืนค่ารายชื่อ model ที่รองรับ (mock)
   */
  listSupportedModels(): string[] {
    return [
      'anthropic.claude-3-5-sonnet-20240620-v1:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'amazon.titan-text-lite-v1',
      'amazon.titan-embed-text-v1',
      'amazon.titan-image-generator-v1',
      // เพิ่ม model อื่น ๆ ตามที่รองรับ
    ];
  }

  /**
   * 4.3: Mock ฟังก์ชันคืน LangChain LLM interface ที่ใช้ Bedrock SDK
   */
  getLangChainLLM(modelId?: string): any {
    // Mock: คืน object ที่มีฟังก์ชัน generate/stream โดยใช้ Bedrock SDK
    return {
      async generate(messages: BedrockMessage[], options?: any) {
        // ใช้ converseStream แบบ non-stream
        const chunks = [];
        for await (const chunk of bedrockService.converseStream(modelId || this.defaultModelId, messages, options?.systemPrompt, options?.toolConfig, options?.temperature, options?.topP)) {
          chunks.push(chunk);
        }
        return chunks;
      },
      async *stream(messages: BedrockMessage[], options?: any) {
        for await (const chunk of bedrockService.converseStream(modelId || this.defaultModelId, messages, options?.systemPrompt, options?.toolConfig, options?.temperature, options?.topP)) {
          yield chunk;
        }
      }
    };
  }
}

export const bedrockService = new BedrockService(); 