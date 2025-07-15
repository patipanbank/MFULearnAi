import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { BedrockRuntimeClient, InvokeModelCommand, ConverseStreamCommand, Message, ConversationRole, ToolConfiguration, ContentBlock } from '@aws-sdk/client-bedrock-runtime';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from '@aws-sdk/client-bedrock-agent-runtime';

export interface BedrockMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface BedrockSystemMessage {
  text: string;
}

export interface BedrockInferenceConfig {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface BedrockToolConfig {
  tools?: any[];
}

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private bedrockClient: BedrockRuntimeClient;
  private bedrockAgentClient: BedrockAgentRuntimeClient;

  constructor(private configService: ConfigService) {
    this.initializeBedrockClients();
  }

  private initializeBedrockClients() {
    const region = this.configService.get('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('AWS credentials not found, Bedrock service will not work properly');
    }

    this.bedrockClient = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });

    this.bedrockAgentClient = new BedrockAgentRuntimeClient({
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  async createTextEmbedding(text: string): Promise<number[]> {
    const modelId = 'amazon.titan-embed-text-v1';
    const body = { inputText: text };

    try {
      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(body),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.embedding;
    } catch (error) {
      this.logger.error(`Failed to create text embedding: ${error}`);
      return [];
    }
  }

  async createBatchTextEmbeddings(texts: string[]): Promise<number[][]> {
    const tasks = texts.map(text => this.createTextEmbedding(text));
    return Promise.all(tasks);
  }

  async createImageEmbedding(imageBase64: string, text?: string): Promise<number[]> {
    const modelId = 'amazon.titan-embed-image-v1';
    const body: any = { inputImage: imageBase64 };
    
    if (text) {
      body.inputText = text;
    }

    try {
      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(body),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.embedding;
    } catch (error) {
      this.logger.error(`Failed to create image embedding: ${error}`);
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

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.images[0];
    } catch (error) {
      this.logger.error(`Failed to generate image: ${error}`);
      return '';
    }
  }

  async *converseStream(
    modelId: string,
    messages: BedrockMessage[],
    systemPrompt: string,
    toolConfig?: BedrockToolConfig,
    temperature?: number,
    topP?: number,
  ): AsyncGenerator<any, void, unknown> {
    if (!modelId) {
      modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    }

    const inferenceConfig: BedrockInferenceConfig = {};
    if (temperature !== undefined) {
      inferenceConfig.temperature = temperature;
    }
    if (topP !== undefined) {
      inferenceConfig.topP = topP;
    }

    // Map BedrockMessage[] to Message[] for AWS SDK
    const sdkMessages: Message[] = messages.map(m => ({
      role: m.role === 'system' ? ConversationRole.USER : (m.role as ConversationRole),
      content: [{ text: m.content }],
    }));

    const systemMessages: BedrockSystemMessage[] = systemPrompt 
      ? [{ text: systemPrompt }] 
      : [];

    // ToolConfiguration must always have tools property
    const sdkToolConfig: ToolConfiguration = toolConfig && toolConfig.tools ? toolConfig as ToolConfiguration : { tools: [] };

    try {
      const command = new ConverseStreamCommand({
        modelId,
        messages: sdkMessages,
        system: systemMessages,
        toolConfig: sdkToolConfig,
        inferenceConfig,
      });

      const response = await this.bedrockClient.send(command);
      const stream = response.stream;

      if (stream) {
        for await (const event of stream) {
          yield event;
        }
      }
    } catch (error) {
      this.logger.error(`Error during Bedrock converse_stream for model ${modelId}: ${error}`);
      yield { error: String(error) };
    }
  }

  async invokeAgent(
    agentId: string,
    agentAliasId: string,
    sessionId: string,
    input: { text: string },
  ): Promise<any> {
    try {
      const command = new InvokeAgentCommand({
        agentId,
        agentAliasId,
        sessionId,
        inputText: input.text,
      });

      const response = await this.bedrockAgentClient.send(command);
      return response;
    } catch (error) {
      this.logger.error(`Error invoking agent ${agentId}: ${error}`);
      throw error;
    }
  }

  getModelDimension(modelId: string): number {
    // Return embedding dimensions for different models
    const dimensions: { [key: string]: number } = {
      'amazon.titan-embed-text-v1': 1536,
      'amazon.titan-embed-image-v1': 1024,
      'amazon.titan-embed-text-v2': 1536,
    };
    return dimensions[modelId] || 1536;
  }

  async generateEmbedding(text: string, modelId: string = 'amazon.titan-embed-text-v1'): Promise<number[]> {
    return this.createTextEmbedding(text);
  }

  async generateBatchEmbeddings(texts: string[], modelId: string = 'amazon.titan-embed-text-v1'): Promise<number[][]> {
    return this.createBatchTextEmbeddings(texts);
  }
} 