import { BedrockRuntimeClient, InvokeModelCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromEnv } from '@aws-sdk/credential-provider-env';

export interface LLMOptions {
  streaming?: boolean;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  model_kwargs?: Record<string, any>;
  [key: string]: any;
}

export class LLM {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private options: LLMOptions;

  constructor(modelId: string, options: LLMOptions = {}) {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      credentials: fromEnv(),
      maxAttempts: 3,
    });
    this.modelId = modelId;
    this.options = options;
  }

  /**
   * Generate text from prompt using Bedrock LLM
   * - Supports model_kwargs (for model-specific params)
   * - Supports temperature, maxTokens, topP, topK, and any extra kwargs
   * - TODO: รองรับ LLM อื่น (OpenAI, HuggingFace) ในอนาคต
   */
  async generate(prompt: string): Promise<string> {
    // Extract model-level keyword arguments (legacy style, whitelist only allowed keys, use snake_case)
    const allowedParams: Record<string, string> = {
      temperature: 'temperature',
      topP: 'top_p',
      topK: 'top_k',
    };
    const model_kwargs: Record<string, any> = {};
    for (const [camel, snake] of Object.entries(allowedParams)) {
      if (this.options[camel] !== undefined) {
        model_kwargs[snake] = this.options[camel];
      }
    }
    // Build request body ตาม modelId
    let body: any = {};
    if (this.modelId.startsWith('anthropic.')) {
      // Claude (Anthropic)
      body = {
        prompt,
        max_tokens_to_sample: this.options.maxTokens ?? 4000,
        ...model_kwargs,
      };
    } else if (this.modelId.startsWith('amazon.titan')) {
      // Titan
      body = {
        inputText: prompt,
        maxTokenCount: this.options.maxTokens ?? 4000,
        ...model_kwargs,
      };
    } else if (this.modelId.startsWith('meta.llama')) {
      // Llama
      body = {
        prompt,
        max_gen_len: this.options.maxTokens ?? 4000,
        ...model_kwargs,
      };
    } else {
      // Default (OpenAI, etc.)
      body = {
        prompt,
        max_tokens: this.options.maxTokens ?? 4000,
        ...model_kwargs,
      };
    }
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });
    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    if (responseBody.results && responseBody.results[0]?.outputText) {
      return responseBody.results[0].outputText;
    }
    if (responseBody.completion) {
      return responseBody.completion;
    }
    return JSON.stringify(responseBody);
  }

  /**
   * Streaming generation using Bedrock streaming API (ConverseStreamCommand)
   * - รองรับเฉพาะ message-based model (Claude 3, Nova, Llama 3, ฯลฯ)
   * - ถ้า model ไม่รองรับ message-based ให้ throw error
   * - TODO: รองรับ LLM อื่น (OpenAI, HuggingFace) ในอนาคต
   */
  async *stream(prompt: string): AsyncGenerator<string, void, unknown> {
    // ตัวอย่างนี้รองรับเฉพาะ message-based (Claude 3, Nova, Llama 3)
    // ถ้าต้องการรองรับ native payload (Cohere, Mistral) ต้อง implement เพิ่ม
    const modelId = this.modelId;
    // เตรียม message format ตาม Bedrock Messages API
    const messages: any[] = [
      {
        role: 'user' as const,
        content: [{ type: 'text', text: prompt }],
      },
    ];
    const inferenceConfig: any = {};
    if (this.options.maxTokens !== undefined) inferenceConfig.maxTokens = this.options.maxTokens;
    if (this.options.temperature !== undefined) inferenceConfig.temperature = this.options.temperature;
    if (this.options.topP !== undefined) inferenceConfig.topP = this.options.topP;
    // สร้าง command
    const command = new ConverseStreamCommand({
      modelId,
      messages,
      inferenceConfig,
    });
    // ส่ง request และอ่าน stream
    const response = await this.client.send(command);
    if (!response.stream) {
      return; // Early return if no stream is available
    }
    for await (const item of response.stream) {
      if (item.contentBlockDelta) {
        const text = item.contentBlockDelta.delta?.text;
        if (text) yield text;
      }
    }
  }
}

/**
 * getLLM: Return a Bedrock LLM instance for the requested modelId and options
 * - Compatible with backend-legacy/agents/llm_factory.py
 */
export function getLLM(modelId: string, options: LLMOptions = {}): LLM {
  return new LLM(modelId, options);
} 