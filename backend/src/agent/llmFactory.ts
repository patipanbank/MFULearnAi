import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { ChatMessage } from "langchain/schema";

export interface LLMOptions {
  region?: string;
  model?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
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
      topP: options.topP,
      topK: options.topK,
      systemPrompt: options.systemPrompt,
    });
  }

  async generate(messages: ChatMessage[]): Promise<string> {
    const response = await this.chat.invoke(messages);
    return response.content;
  }
}

export function getLLM(options: LLMOptions): LLM {
  return new LLM(options);
} 