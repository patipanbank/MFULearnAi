import Anthropic from '@anthropic-ai/sdk';
import config from '../config';
import { IAIRequest, IAIResponse, IAIStreamChunk } from '../types';

export class AIService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  async generateResponse(request: IAIRequest): Promise<IAIResponse> {
    try {
      const messages = request.messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

      const response = await this.client.messages.create({
        model: config.anthropic.model,
        max_tokens: request.maxTokens || config.anthropic.maxTokens,
        temperature: request.temperature || 0.7,
        system: request.systemPrompt,
        messages: messages as any[],
      });

      const content = response.content[0];
      const text = content.type === 'text' ? content.text : '';

      return {
        content: text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        stopReason: response.stop_reason || undefined,
      };
    } catch (error: any) {
      console.error('AI Service Error:', error);
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  async *streamResponse(request: IAIRequest): AsyncGenerator<IAIStreamChunk> {
    try {
      const messages = request.messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

      const stream = await this.client.messages.create({
        model: config.anthropic.model,
        max_tokens: request.maxTokens || config.anthropic.maxTokens,
        temperature: request.temperature || 0.7,
        system: request.systemPrompt,
        messages: messages as any[],
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          yield {
            type: 'content_block_delta',
            delta: {
              type: 'text_delta',
              text: (event.delta as any).text || '',
            },
          };
        } else if (event.type === 'message_start') {
          yield {
            type: 'message_start',
            message: {
              usage: {
                input_tokens: (event.message as any).usage?.input_tokens || 0,
                output_tokens: 0,
              },
            },
          };
        } else if (event.type === 'message_delta') {
          yield {
            type: 'message_delta',
            delta: {
              type: 'message_delta',
            },
            message: {
              usage: {
                input_tokens: 0,
                output_tokens: (event as any).usage?.output_tokens || 0,
              },
            },
          };
        } else if (event.type === 'message_stop') {
          yield {
            type: 'message_stop',
          };
        }
      }
    } catch (error: any) {
      console.error('AI Stream Error:', error);
      throw new Error(`Failed to stream AI response: ${error.message}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check - try to make a minimal API call
      const response = await this.client.messages.create({
        model: config.anthropic.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return !!response;
    } catch (error) {
      console.error('AI health check failed:', error);
      return false;
    }
  }
}

export const aiService = new AIService();
