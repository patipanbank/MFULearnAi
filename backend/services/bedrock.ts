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

  private async claudeChat(messages: ChatMessage[]): Promise<{ content: string }> {
    const command = new InvokeModelCommand({
      modelId: this.models.claude35,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.8,
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
        stream: true
      })
    });

    try {
      const response = await this.client.send(command);
      const stream = response.body as unknown as ReadableStream;
      const reader = stream.getReader();
      let content = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'content_block_delta') {
              content += parsed.delta.text;
            }
          } catch (e) {
            console.error('Error parsing streaming response:', e);
          }
        }
      }
      
      return { content };
    } catch (error) {
      console.error('Claude chat error:', error);
      throw error;
    }
  }

  async chatWithEstimatedTime(messages: ChatMessage[], modelId: string): Promise<{ content: string, estimatedTime: number }> {
    try {
      const estimatedTime = 10; // Simulate an estimated time of 10 seconds
      const startTime = Date.now();

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, estimatedTime * 1000));

      const response = await this.chat(messages, modelId);
      const elapsedTime = (Date.now() - startTime) / 1000;

      return { content: response.content, estimatedTime: Math.max(0, estimatedTime - elapsedTime) };
    } catch (error) {
      console.error('Bedrock chat with estimated time error:', error);
      throw error;
    }
  }
}

export const bedrockService = new BedrockService();
