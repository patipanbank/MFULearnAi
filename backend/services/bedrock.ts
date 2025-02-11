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

  async *chat(messages: ChatMessage[], modelId: string): AsyncGenerator<string> {
    try {
      if (modelId === this.models.claude35) {
        yield* this.claudeChat(messages);
      } else {
        throw new Error('Unsupported model');
      }
    } catch (error) {
      console.error('Bedrock chat error:', error);
      throw error;
    }
  }

  private async *claudeChat(messages: ChatMessage[]): AsyncGenerator<string> {
    try {
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: this.models.claude35,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 2000,
          temperature: 1,
          top_p: 0.99,
          messages: messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.images ? [
              { type: 'text', text: msg.content },
              ...msg.images.map(img => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: img.mediaType,
                  data: img.data
                }
              }))
            ] : msg.content
          }))
        })
      });
  
      const response = await this.client.send(command);
  
      if (!response.body) {
        console.error("Bedrock response body is empty.");
        yield "[Error]: No response from Claude 3.5.";
        return;
      }
  
      let buffer = ""; // ใช้เก็บข้อมูลเผื่อ JSON มาไม่ครบ
      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          buffer += new TextDecoder().decode(chunk.chunk.bytes);
          try {
            const parsedChunk = JSON.parse(buffer);
            if (parsedChunk.type === 'content_block_delta' && parsedChunk.delta?.type === 'text_delta' && parsedChunk.delta?.text) {
              yield parsedChunk.delta.text;
              buffer = ""; // Reset buffer หลังจาก parse สำเร็จ
            }
          } catch (e) {
            // JSON อาจจะยังมาไม่ครบ ไม่ต้องโยน Error ทิ้ง
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Claude chat error:', error);
      yield `[Error]: ${(error as Error).message}`;
    }
  }
  
}

export const bedrockService = new BedrockService();