import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { BaseMessage } from "@langchain/core/messages";

export interface LLMOptions {
  region?: string;
  model?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  maxTokens?: number;
  temperature?: number;
  // ...อื่นๆ
}

export class LLM {
  private chat: BedrockChat;
  private options: LLMOptions;

  constructor(options: LLMOptions) {
    this.options = options;
    this.chat = new BedrockChat({
      region: options.region || process.env.AWS_REGION,
      model: options.model,
      credentials: {
        accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY!,
      },
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
  }

  async generate(messages: BaseMessage[]): Promise<string> {
    const response = await this.chat.invoke(messages);
    const content = response.content;
    return typeof content === 'string' ? content : JSON.stringify(content);
  }
}

export function getLLM(options: LLMOptions): LLM {
  return new LLM(options);
} 