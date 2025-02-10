import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

export class BedrockService {
  private client: BedrockRuntimeClient;
  private models = {
    claude35: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  };

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }

  // Streaming chat method
  async chatStream(messages: ChatMessage[], modelId: string): Promise<ReadableStream> {
    if (modelId !== this.models.claude35) {
      throw new Error('Unsupported model');
    }
    return this.claudeChatStream(messages);
  }

  private async claudeChatStream(messages: ChatMessage[]): Promise<ReadableStream> {
    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.models.claude35,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9,
        stream: true, // ✅ เปิดโหมด Streaming
        messages: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: [{ type: "text", text: msg.content }]
        })),
      })
    });

    try {
      const response = await this.client.send(command);

      if (!response.body) {
        throw new Error("Empty response body");
      }

      return new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder();
          try {
            for await (const chunk of response.body!) {
              if (chunk?.chunk?.bytes) {
                const textChunk = decoder.decode(chunk.chunk.bytes, { stream: true });
                controller.enqueue(new TextEncoder().encode(textChunk));
              }
            }
          } catch (error) {
            console.error("Error reading stream:", error);
            controller.error(error);
          } finally {
            controller.close();
          }
        }
      });

    } catch (error) {
      console.error('Claude chat stream error:', error);
      throw error;
    }
  }
}

export const bedrockService = new BedrockService();
