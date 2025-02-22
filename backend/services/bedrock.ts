import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

interface ModelConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  stopSequences?: string[];
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  private models = {
    claude35: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    titanImage: "amazon.titan-embed-image-v1"
  };

  private readonly defaultConfig: ModelConfig = {
    temperature: 0.7,
    topP: 0.99,
    maxTokens: 2048
  };

  private readonly questionTypeConfigs: { [key: string]: ModelConfig } = {
    factual: {
      temperature: 0.3,  // Lower temperature for more focused, factual responses
      topP: 0.9,
      maxTokens: 1024,
      stopSequences: ["Human:", "Assistant:"]
    },
    analytical: {
      temperature: 0.7,  // Balanced for analytical thinking
      topP: 0.95,
      maxTokens: 2048
    },
    conceptual: {
      temperature: 0.6,  // Moderate temperature for clear explanations
      topP: 0.92,
      maxTokens: 2048
    },
    procedural: {
      temperature: 0.4,  // Lower temperature for precise step-by-step instructions
      topP: 0.9,
      maxTokens: 2048
    },
    clarification: {
      temperature: 0.5,  // Moderate temperature for clear clarifications
      topP: 0.9,
      maxTokens: 1024
    },
    visual: {  // New config for image-related queries
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 2048
    }
  };

  public chatModel = this.models.claude35;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }

  async embedImage(imageBase64: string, text?: string): Promise<number[]> {
    try {
      const command = new InvokeModelCommand({
        modelId: this.models.titanImage,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          inputImage: imageBase64,
          ...(text && { inputText: text })
        })
      });

      const response = await this.client.send(command);
      
      if (!response.body) {
        throw new Error("Empty response body");
      }

      const responseData = JSON.parse(new TextDecoder().decode(response.body));
      
      if (!responseData.embedding) {
        throw new Error("No embedding field in the response");
      }

      return responseData.embedding;
    } catch (error) {
      console.error("Error generating image embedding:", error);
      throw error;
    }
  }

  private detectMessageType(messages: ChatMessage[]): string {
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content.toLowerCase();
    const hasImage = lastMessage.images && lastMessage.images.length > 0;

    if (hasImage) return 'visual';
    if (/^(what|when|where|who|which|how many|how much)/i.test(query)) return 'factual';
    if (/^(why|how|what if|analyze|compare|contrast)/i.test(query)) return 'analytical';
    if (/^(explain|describe|define|what is|what are|how does)/i.test(query)) return 'conceptual';
    if (/^(how to|how do|what steps|how can|show me how)/i.test(query)) return 'procedural';
    if (/^(can you clarify|what do you mean|please explain|elaborate)/i.test(query)) return 'clarification';

    return 'factual'; // Default
  }

  private getModelConfig(messages: ChatMessage[]): ModelConfig {
    const messageType = this.detectMessageType(messages);
    return this.questionTypeConfigs[messageType] || this.defaultConfig;
  }

  async *chat(messages: ChatMessage[], modelId: string): AsyncGenerator<string> {
    try {
      const config = this.getModelConfig(messages);
      console.log('Using model config:', config);

      const command = new InvokeModelWithResponseStreamCommand({
        modelId: this.models.claude35,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          top_p: config.topP,
          stop_sequences: config.stopSequences,
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
}

export const bedrockService = new BedrockService();