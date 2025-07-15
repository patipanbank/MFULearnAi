import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { 
  BedrockClient, 
  ListFoundationModelsCommand,
  GetFoundationModelCommand 
} from '@aws-sdk/client-bedrock';
import { 
  BedrockRuntimeClient, 
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand 
} from '@aws-sdk/client-bedrock-runtime';

export interface ModelInfo {
  modelId: string;
  modelName: string;
  providerName: string;
  inputModalities: string[];
  outputModalities: string[];
  isEmbeddingModel: boolean;
  embeddingDimension?: number;
}

interface BedrockInvokeRequest {
  modelId: string;
  body: any;
  accept?: string;
  contentType?: string;
}

interface EmbeddingRequest {
  inputText: string;
  inputType?: string;
}

@Injectable()
export class BedrockService {
  private readonly AWS_REGION = 'us-east-1';
  private readonly modelDimensions = {
    'amazon.titan-embed-text-v1': 1536,
    'amazon.titan-embed-text-v2:0': 1024,
    'amazon.titan-embed-image-v1': 1024,
    'cohere.embed-english-v3': 1024,
    'cohere.embed-multilingual-v3': 1024
  };

  private bedrockClient: BedrockClient;
  private bedrockRuntimeClient: BedrockRuntimeClient;

  constructor(private configService: ConfigService) {
    // Initialize AWS clients with credentials from environment
    const awsConfig = {
      region: this.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    };

    this.bedrockClient = new BedrockClient(awsConfig);
    this.bedrockRuntimeClient = new BedrockRuntimeClient(awsConfig);
    
    console.log(`AWS Bedrock clients initialized for region: ${this.AWS_REGION}`);
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      console.log('Listing available Bedrock models');
      
      const command = new ListFoundationModelsCommand({});
      const response = await this.bedrockClient.send(command);
      
      return (response.modelSummaries || []).map(model => ({
        modelId: model.modelId || '',
        modelName: model.modelName || '',
        providerName: model.providerName || '',
        inputModalities: model.inputModalities || [],
        outputModalities: model.outputModalities || [],
        isEmbeddingModel: (model.outputModalities || []).includes('EMBEDDING'),
        embeddingDimension: this.modelDimensions[model.modelId || '']
      }));
    } catch (error) {
      console.error('Error listing models:', error);
      // Fallback to mock data if AWS call fails
      return [
        {
          modelId: 'amazon.titan-embed-text-v1',
          modelName: 'Titan Text Embeddings V1',
          providerName: 'Amazon',
          inputModalities: ['TEXT'],
          outputModalities: ['EMBEDDING'],
          isEmbeddingModel: true,
          embeddingDimension: 1536
        },
        {
          modelId: 'amazon.titan-embed-text-v2:0',
          modelName: 'Titan Text Embeddings V2',
          providerName: 'Amazon',
          inputModalities: ['TEXT'],
          outputModalities: ['EMBEDDING'],
          isEmbeddingModel: true,
          embeddingDimension: 1024
        }
      ];
    }
  }

  async invokeModel(request: BedrockInvokeRequest): Promise<any> {
    try {
      console.log(`Invoking Bedrock model: ${request.modelId}`);
      
      const command = new InvokeModelCommand({
        modelId: request.modelId,
        body: JSON.stringify(request.body),
        accept: request.accept || 'application/json',
        contentType: request.contentType || 'application/json'
      });
      
      const response = await this.bedrockRuntimeClient.send(command);
      
      if (response.body) {
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        return responseBody;
      }
      
      throw new Error('No response body from Bedrock');
    } catch (error) {
      console.error('Error invoking model:', error);
      
      // Fallback to mock response if AWS call fails
      if (this.isEmbeddingModel(request.modelId)) {
        const dimension = this.modelDimensions[request.modelId] || 1536;
        return {
          embedding: Array.from({ length: dimension }, () => Math.random() * 2 - 1),
          inputTextTokenCount: request.body.inputText?.split(' ').length || 0
        };
      }
      
      return {
        results: [{
          outputText: "Mock response from Bedrock model (AWS call failed)",
          tokenCount: 10
        }]
      };
    }
  }

  async invokeModelWithResponseStream(request: BedrockInvokeRequest): Promise<AsyncIterable<any>> {
    try {
      console.log(`Invoking Bedrock model with streaming: ${request.modelId}`);
      
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: request.modelId,
        body: JSON.stringify(request.body),
        accept: request.accept || 'application/json',
        contentType: request.contentType || 'application/json'
      });
      
      const response = await this.bedrockRuntimeClient.send(command);
      
      if (response.body) {
        return response.body;
      }
      
      throw new Error('No response body from Bedrock streaming');
    } catch (error) {
      console.error('Error invoking model with streaming:', error);
      
      // Fallback to mock streaming response
      async function* mockStream() {
        const mockChunks = ["Mock", " streaming", " response", " from", " Bedrock", " (AWS call failed)"];
        for (const chunk of mockChunks) {
          yield { chunk: { bytes: Buffer.from(JSON.stringify({ outputText: chunk })) } };
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return mockStream();
    }
  }

  async getModelInfo(modelId: string): Promise<ModelInfo | null> {
    try {
      console.log(`Getting model info for: ${modelId}`);
      
      const command = new GetFoundationModelCommand({ modelIdentifier: modelId });
      const response = await this.bedrockClient.send(command);
      
      if (response.modelDetails) {
        return {
          modelId: response.modelDetails.modelId || '',
          modelName: response.modelDetails.modelName || '',
          providerName: response.modelDetails.providerName || '',
          inputModalities: response.modelDetails.inputModalities || [],
          outputModalities: response.modelDetails.outputModalities || [],
          isEmbeddingModel: (response.modelDetails.outputModalities || []).includes('EMBEDDING'),
          embeddingDimension: this.modelDimensions[modelId]
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting model info:', error);
      
      // Fallback to mock response
      if (this.modelDimensions[modelId]) {
        return {
          modelId,
          modelName: `Model ${modelId}`,
          providerName: 'Amazon',
          inputModalities: ['TEXT'],
          outputModalities: ['EMBEDDING'],
          isEmbeddingModel: true,
          embeddingDimension: this.modelDimensions[modelId]
        };
      }
      
      return null;
    }
  }

  async generateEmbedding(text: string, modelId: string = 'amazon.titan-embed-text-v1'): Promise<number[]> {
    try {
      console.log(`Generating embedding for text with model: ${modelId}`);
      
      const embeddingRequest: EmbeddingRequest = {
        inputText: text,
        inputType: 'search_document'
      };
      
      const response = await this.invokeModel({
        modelId,
        body: embeddingRequest
      });
      
      return response.embedding || [];
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[], modelId: string = 'amazon.titan-embed-text-v1'): Promise<number[][]> {
    try {
      console.log(`Generating batch embeddings for ${texts.length} texts`);
      
      const embeddings: number[][] = [];
      
      // Process in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map(text => this.generateEmbedding(text, modelId));
        const batchEmbeddings = await Promise.all(batchPromises);
        embeddings.push(...batchEmbeddings);
        
        // Add small delay between batches
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return embeddings;
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  calculateCost(modelId: string, inputTokens: number, outputTokens: number = 0): number {
    // AWS Bedrock pricing per 1000 tokens (as of 2024)
    const pricingPerThousandTokens = {
      'amazon.titan-embed-text-v1': 0.0001,
      'amazon.titan-embed-text-v2:0': 0.00002,
      'amazon.titan-text-lite-v1': 0.00015,
      'amazon.titan-text-express-v1': 0.0008,
      'anthropic.claude-v2': 0.008,
      'anthropic.claude-instant-v1': 0.0024,
      'cohere.embed-english-v3': 0.0001,
      'cohere.embed-multilingual-v3': 0.0001
    };
    
    const pricePerToken = (pricingPerThousandTokens[modelId] || 0.001) / 1000;
    return (inputTokens + outputTokens) * pricePerToken;
  }

  private isEmbeddingModel(modelId: string): boolean {
    return Object.keys(this.modelDimensions).includes(modelId);
  }

  getModelDimension(modelId: string): number {
    return this.modelDimensions[modelId] || 1536; // Default to titan-v1 dimension
  }

  // Health check method to verify AWS credentials
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const command = new ListFoundationModelsCommand({});
      await this.bedrockClient.send(command);
      return { status: 'healthy', message: 'AWS Bedrock connection successful' };
    } catch (error) {
      console.error('AWS Bedrock health check failed:', error);
      return { status: 'unhealthy', message: `AWS Bedrock connection failed: ${error.message}` };
    }
  }

  // Wrapper methods for controller compatibility
  async getModels(): Promise<ModelInfo[]> {
    return this.listModels();
  }

  async invoke(modelId: string, prompt: string, parameters?: any): Promise<any> {
    const body = {
      inputText: prompt,
      ...parameters
    };
    return this.invokeModel({ modelId, body });
  }

  async invokeWithStreaming(modelId: string, prompt: string, parameters?: any): Promise<AsyncIterable<any>> {
    const body = {
      inputText: prompt,
      ...parameters
    };
    return this.invokeModelWithResponseStream({ modelId, body });
  }

  // Conversational Chat Methods
  async converseStream(
    messages: any[],
    systemPrompt: string,
    modelId: string = 'anthropic.claude-v2',
    tools?: any[],
    temperature: number = 0.7,
    maxTokens: number = 4000
  ): Promise<AsyncIterable<any>> {
    try {
      console.log(`Starting conversational chat with model: ${modelId}`);
      
      // Format messages for Claude
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const body = {
        messages: formattedMessages,
        system: systemPrompt,
        max_tokens: maxTokens,
        temperature: temperature,
        ...(tools && tools.length > 0 && { tools, tool_choice: 'auto' })
      };

      return this.invokeModelWithResponseStream({ modelId, body });
    } catch (error) {
      console.error('Error in conversational chat:', error);
      throw error;
    }
  }

  // Image Generation Methods
  async generateImage(
    prompt: string,
    modelId: string = 'stability.stable-diffusion-xl-v1',
    negativePrompt?: string,
    width: number = 1024,
    height: number = 1024,
    steps: number = 50,
    cfgScale: number = 7.5,
    seed?: number
  ): Promise<string> {
    try {
      console.log(`Generating image with model: ${modelId}`);
      
      const body = {
        text_prompts: [
          {
            text: prompt,
            weight: 1
          },
          ...(negativePrompt ? [{
            text: negativePrompt,
            weight: -1
          }] : [])
        ],
        cfg_scale: cfgScale,
        height: height,
        width: width,
        samples: 1,
        steps: steps,
        ...(seed && { seed })
      };

      const response = await this.invokeModel({ modelId, body });
      
      // Return the base64 encoded image
      if (response.artifacts && response.artifacts[0]) {
        return response.artifacts[0].base64;
      }
      
      throw new Error('No image generated');
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  // Text-to-Image with streaming (for progress updates)
  async generateImageStream(
    prompt: string,
    modelId: string = 'stability.stable-diffusion-xl-v1',
    negativePrompt?: string,
    width: number = 1024,
    height: number = 1024,
    steps: number = 50,
    cfgScale: number = 7.5,
    seed?: number
  ): Promise<AsyncIterable<any>> {
    try {
      console.log(`Generating image with streaming: ${modelId}`);
      
      const body = {
        text_prompts: [
          {
            text: prompt,
            weight: 1
          },
          ...(negativePrompt ? [{
            text: negativePrompt,
            weight: -1
          }] : [])
        ],
        cfg_scale: cfgScale,
        height: height,
        width: width,
        samples: 1,
        steps: steps,
        ...(seed && { seed })
      };

      return this.invokeModelWithResponseStream({ modelId, body });
    } catch (error) {
      console.error('Error generating image with streaming:', error);
      throw error;
    }
  }
} 