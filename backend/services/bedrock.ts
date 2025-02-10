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
            content: msg.content
          }))
        })
      });

      const response = await this.client.send(command);
      
      if (response.body) {
        for await (const chunk of response.body) {
          if (chunk.chunk?.bytes) {
            const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
            try {
              const parsedChunk = JSON.parse(decodedChunk);
              if (parsedChunk.type === 'content_block_delta' && 
                  parsedChunk.delta?.type === 'text_delta' && 
                  parsedChunk.delta?.text) {
                yield parsedChunk.delta.text;
              }
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Claude chat error:', error);
      throw error;
    }
  }

  async *chatWithEstimatedTime(messages: ChatMessage[], modelId: string): AsyncGenerator<{ content: string, estimatedTime: number }> {
    const estimatedTime = 10; // ประมาณเวลา 10 วินาที
    const startTime = Date.now();

    try {
      for await (const chunk of this.chat(messages, modelId)) {
        const elapsedTime = (Date.now() - startTime) / 1000;
        yield { 
          content: chunk, 
          estimatedTime: Math.max(0, estimatedTime - elapsedTime) 
        };
      }
    } catch (error) {
      console.error('Bedrock chat with estimated time error:', error);
      throw error;
    }
  }
}

export const bedrockService = new BedrockService();