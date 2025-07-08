import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

@Injectable()
export class BedrockService {
  private readonly client: BedrockRuntimeClient;
  private readonly logger = new Logger(BedrockService.name);

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          }
        : undefined,
    });
  }

  /**
   * Creates an embedding for a given text using Titan Text Embeddings
   * (`amazon.titan-embed-text-v1`). Returns an empty array on error.
   */
  async createTextEmbedding(text: string): Promise<number[]> {
    const modelId = 'amazon.titan-embed-text-v1';
    try {
      const cmd = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: Buffer.from(JSON.stringify({ inputText: text })),
      });
      const response = await this.client.send(cmd);
      // Response body is Uint8Array => decode as UTF-8 then parse JSON
      const json = JSON.parse(Buffer.from(response.body).toString('utf8'));
      return json.embedding ?? [];
    } catch (err) {
      this.logger.error(`createTextEmbedding error: ${err}`);
      return [];
    }
  }

  /**
   * Creates embeddings for an array of texts in parallel.
   */
  async createBatchTextEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.createTextEmbedding(t)));
  }

  /**
   * Generates an image from a text prompt using Titan Image Generator.
   * Returns base64-encoded image string or empty string on failure.
   */
  async generateImage(prompt: string): Promise<string> {
    const modelId = 'amazon.titan-image-generator-v1';
    try {
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

      const cmd = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: Buffer.from(JSON.stringify(body)),
      });
      const res = await this.client.send(cmd);
      const json = JSON.parse(Buffer.from(res.body).toString('utf8'));
      return json.images?.[0] ?? '';
    } catch (err) {
      this.logger.error(`generateImage error: ${err}`);
      return '';
    }
  }

  /**
   * Streams a chat conversation. SDK support is evolving – this currently
   * returns an empty async generator placeholder until implemented.
   */
  async converseStream({
    modelId,
    messages,
    systemPrompt,
    toolConfig,
    temperature,
    topP,
    maxTokens,
  }: {
    modelId?: string;
    messages: any[];
    systemPrompt?: string;
    toolConfig?: Record<string, any>;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  }): Promise<AsyncGenerator<any, void, unknown>> {
    // --- New implementation: call Bedrock API Gateway and stream JSON events
    const gatewayUrl =
      process.env.BEDROCK_GATEWAY_URL ||
      'http://localhost:5001/api/v1/bedrock/converse-stream';

    const axios = (await import('axios')).default;
    const readline = await import('readline');

    const payload: Record<string, any> = {
      model_id: modelId,
      messages,
    };
    if (systemPrompt) payload.system_prompt = systemPrompt;
    if (toolConfig) payload.tool_config = toolConfig;
    if (temperature !== undefined) payload.temperature = temperature;
    if (topP !== undefined) payload.top_p = topP;
    if (maxTokens !== undefined) payload.max_tokens = maxTokens;

    this.logger.debug(`Starting converseStream via gateway: ${gatewayUrl}`);

    let responseStream: NodeJS.ReadableStream;
    try {
      const res = await axios.post(gatewayUrl, payload, {
        responseType: 'stream',
        headers: { 'Content-Type': 'application/json' },
      });
      responseStream = res.data as NodeJS.ReadableStream;
    } catch (err) {
      this.logger.error(`converseStream request error: ${err}`);
      throw err;
    }

    const rl = readline.createInterface({ input: responseStream });

    // Return async generator
    async function* streamGenerator() {
      try {
        for await (const line of rl) {
          if (!line.trim()) continue;
          try {
            yield JSON.parse(line);
          } catch (parseErr) {
            // Fallback: emit raw chunk if not JSON
            yield { type: 'chunk', data: line };
          }
        }
      } finally {
        rl.close();
      }
    }

    return streamGenerator();
  }

  // Backwards-compat alias
  async embed(text: string): Promise<number[]> {
    return this.createTextEmbedding(text);
  }
} 