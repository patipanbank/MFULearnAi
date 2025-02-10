import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
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

  // Regular chat method for non-streaming responses
  async chat(messages: ChatMessage[], modelId: string): Promise<{ content: string }> {
    try {
      if (modelId === this.models.claude35) {
        return this.claudeChat(messages);
      }
      throw new Error('Unsupported model');
    } catch (error) {
      console.error('Bedrock chat error:', error);
      throw error;
    }
  }

  // Streaming chat method
  async chatStream(messages: ChatMessage[], modelId: string): Promise<ReadableStream> {
    try {
      if (modelId === this.models.claude35) {
        return this.claudeChatStream(messages);
      }
      throw new Error('Unsupported model');
    } catch (error) {
      console.error('Bedrock chat stream error:', error);
      throw error;
    }
  }

  private async claudeChat(messages: ChatMessage[]): Promise<{ content: string }> {
    const command = new InvokeModelCommand({
      modelId: this.models.claude35,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9,
        messages: messages.map(msg => {
          const content = [];
          
          if (msg.images && msg.images.length > 0) {
            msg.images.forEach(image => {
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType || "image/jpeg",
                  data: image.data
                }
              });
            });
          }
          
          content.push({
            type: "text",
            text: msg.content
          });

          return {
            role: msg.role === 'user' ? 'user' : 'assistant',
            content
          };
        }),
      })
    });

    try {
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return { content: responseBody.content[0].text };
    } catch (error) {
      console.error('Claude chat error:', error);
      throw error;
    }
  }

  private async claudeChatStream(messages: ChatMessage[]): Promise<ReadableStream> {
    const command = new InvokeModelCommand({
      modelId: this.models.claude35,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9,
        stream: true, // เพิ่ม option นี้
        messages: messages.map(msg => {
          const content = [];
          
          if (msg.images && msg.images.length > 0) {
            msg.images.forEach(image => {
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType || "image/jpeg",
                  data: image.data
                }
              });
            });
          }
          
          content.push({
            type: "text",
            text: msg.content
          });

          return {
            role: msg.role === 'user' ? 'user' : 'assistant',
            content
          };
        }),
      })
    });

    try {
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const content = responseBody.content[0].text;

      return new ReadableStream({
        start(controller) {
          const chunkSize = 10;
          let offset = 0;

          const sendChunk = () => {
            if (offset < content.length) {
              const chunk = content.slice(offset, offset + chunkSize);
              controller.enqueue(new TextEncoder().encode(chunk));
              offset += chunkSize;
              setTimeout(sendChunk, 50);
            } else {
              controller.close();
            }
          };

          sendChunk();
        }
      });
    } catch (error) {
      console.error('Claude chat stream error:', error);
      throw error;
    }
  }
}

export const bedrockService = new BedrockService();