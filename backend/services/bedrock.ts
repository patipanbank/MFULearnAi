import { BedrockRuntimeClient, ConverseStreamCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

interface ModelConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  stopSequences?: string[];
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  public models = {
    claude35: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    titanImage: "amazon.titan-image-generator-v1"  // Updated to image generator model
  };

  private readonly defaultConfig: ModelConfig = {
    temperature: 0.7,
    topP: 0.99,
    maxTokens: 3000
  };

  private readonly questionTypeConfigs: { [key: string]: ModelConfig } = {
    factual: {
      temperature: 0.3,  // Lower temperature for more focused, factual responses
      topP: 0.9,
      maxTokens:  3000,
      stopSequences: ["Human:", "Assistant:"]
    },
    analytical: {
      temperature: 0.7,  // Balanced for analytical thinking
      topP: 0.95,
      maxTokens: 3000
    },
    conceptual: {
      temperature: 0.6,  // Moderate temperature for clear explanations
      topP: 0.92,
      maxTokens: 3000
    },
    procedural: {
      temperature: 0.4,  // Lower temperature for precise step-by-step instructions
      topP: 0.9,
      maxTokens: 3000
    },
    clarification: {
      temperature: 0.5,  // Moderate temperature for clear clarifications
      topP: 0.9,
      maxTokens: 3000
    },
    visual: {  // New config for image-related queries
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 3000
    },
    imageGeneration: {  // New config for image generation
      temperature: 0.8,  // Higher temperature for more creative image descriptions
      topP: 0.95,
      maxTokens: 3000
    }
  };

  public chatModel = this.models.claude35;

  private lastTokenUsage = 0;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      systemClockOffset: 0,  // ให้ใช้เวลาจากระบบโดยตรง
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
      // console.error("Error generating image embedding:", error);
      throw error;
    }
  }

  private detectMessageType(messages: ChatMessage[]): string {
    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content.toLowerCase();
    const hasImage = lastMessage.images && lastMessage.images.length > 0;
    const hasFiles = lastMessage.files && lastMessage.files.length > 0;

    if (hasFiles || hasImage) return 'visual';
    if (/^(what|when|where|who|which|how many|how much)/i.test(query)) return 'factual';
    if (/^(why|how|what if|analyze|compare|contrast)/i.test(query)) return 'analytical';
    if (/^(explain|describe|define|what is|what are|how does)/i.test(query)) return 'conceptual';
    if (/^(how to|how do|what steps|how can|show me how)/i.test(query)) return 'procedural';
    if (/^(can you clarify|what do you mean|please explain|elaborate)/i.test(query)) return 'clarification';

    return 'factual'; // Default
  }

  private getModelConfig(messages: ChatMessage[]): ModelConfig {
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.isImageGeneration) {
      return {
        ...this.defaultConfig,
        ...this.questionTypeConfigs.imageGeneration
      };
    }

    const messageType = this.detectMessageType(messages);
    return {
      ...this.defaultConfig,
      ...this.questionTypeConfigs[messageType]
    };
  }

  async generateImage(prompt: string): Promise<string> {
    try {
      const command = new InvokeModelCommand({
        modelId: this.models.titanImage,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          taskType: "TEXT_IMAGE",
          textToImageParams: {
            text: prompt,
            numberOfImages: 1,
            imageHeight: 1024,
            imageWidth: 1024,
            cfgScale: 8.0,
            seed: Math.floor(Math.random() * 1000000)
          },
          imageGenerationConfig: {
            numberOfImages: 1,
            quality: "standard",
            height: 1024,
            width: 1024,
            cfgScale: 8.0
          }
        })
      });

      const response = await this.client.send(command);
      
      if (!response.body) {
        throw new Error("Empty response body");
      }

      const responseData = JSON.parse(new TextDecoder().decode(response.body));
      
      if (!responseData.images || !responseData.images[0]) {
        throw new Error("No image generated");
      }

      return responseData.images[0];
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }

  async *chat(
    messages: ChatMessage[], 
    modelId: string,
    tools?: any[],
    toolResults?: any[]
  ): AsyncGenerator<string | { type: 'tool_use', toolUseId: string, name: string, input: any }> {
    try {
      const config = this.getModelConfig(messages);
      const lastMessage = messages[messages.length - 1];
      const isImageGeneration = lastMessage.isImageGeneration;

      if (isImageGeneration) {
        try {
          const imageBase64 = await this.generateImage(lastMessage.content);
          yield JSON.stringify({
            type: 'generated-image',
            data: imageBase64
          });
          return;
        } catch (error) {
          console.error("Error in image generation:", error);
          yield "I apologize, but I encountered an error while generating the image. Please try again or contact support if the issue persists.";
          return;
        }
      }

      // Convert messages to Converse API format
      const converseMessages: any[] = [];
      
      for (const msg of messages) {
        if (msg.role === 'system') {
          continue; // System messages go in system parameter
        }

        const hasImages = msg.images && msg.images.length > 0;
        const hasFiles = msg.files && msg.files.length > 0;
        
        if (!hasImages && !hasFiles) {
          converseMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: [{ text: msg.content }]
          });
        } else {
          const content: any[] = [{ text: msg.content }];
          
          if (hasImages && msg.images) {
            msg.images.forEach(img => {
              content.push({
                image: {
                  format: img.mediaType === 'image/png' ? 'png' : 'jpeg',
                  source: {
                    bytes: Buffer.from(img.data, 'base64')
                  }
                }
              });
            });
          }
          
          if (hasFiles && msg.files) {
            msg.files.forEach(file => {
              content.push({ 
                text: `\n\n=== File: ${file.name} (${file.mediaType}) ===\n${file.content || `[Cannot read file content ${file.name}]`}\n=== End of file ===\n`
              });
            });
          }
          
          converseMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: content
          });
        }
      }

      // Extract system messages
      const systemMessages = messages
        .filter(msg => msg.role === 'system')
        .map(msg => ({ text: msg.content }));

      const input: any = {
        modelId: this.models.claude35,
        messages: converseMessages,
        inferenceConfig: {
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          topP: config.topP,
          ...(config.stopSequences && { stopSequences: config.stopSequences })
        }
      };

      if (systemMessages.length > 0) {
        input.system = systemMessages;
      }

      if (tools && tools.length > 0) {
        input.toolConfig = { tools: tools };
      }

      if (toolResults && toolResults.length > 0) {
        // Add tool use and tool result messages
        const toolUseContent = toolResults.map((result: any) => ({
          toolUse: {
            toolUseId: result.toolUseId,
            name: result.name,
            input: result.input
          }
        }));
        
        const toolResultContent = toolResults.map((result: any) => ({
          toolResult: {
            toolUseId: result.toolUseId,
            content: [{ text: result.content }],
            status: result.status || 'success'
          }
        }));

        // Add assistant message with tool use
        converseMessages.push({
          role: 'assistant',
          content: toolUseContent
        });
        
        // Add user message with tool results
        converseMessages.push({
          role: 'user',
          content: toolResultContent
        });
        
        // Update input messages
        input.messages = converseMessages;
      }

      const command = new ConverseStreamCommand(input);
      const response = await this.client.send(command);

      if (response.stream) {
        let inputTokens = 0;
        let outputTokens = 0;
        let currentToolUse: any = null;

        for await (const chunk of response.stream) {
          // Handle message start
          if (chunk.messageStart) {
            if (chunk.messageStart.message?.usage) {
              inputTokens = chunk.messageStart.message.usage.inputTokens || 0;
            }
          }

          // Handle content block start (tool use)
          if (chunk.contentBlockStart) {
            if (chunk.contentBlockStart.start?.toolUse) {
              currentToolUse = chunk.contentBlockStart.start.toolUse;
              yield {
                type: 'tool_use',
                toolUseId: currentToolUse.toolUseId,
                name: currentToolUse.name,
                input: currentToolUse.input || {}
              };
            }
          }

          // Handle content block delta (text streaming)
          if (chunk.contentBlockDelta) {
            if (chunk.contentBlockDelta.delta?.text) {
              yield chunk.contentBlockDelta.delta.text;
            }
          }

          // Handle message stop
          if (chunk.messageStop) {
            if (chunk.messageStop.usage) {
              inputTokens = chunk.messageStop.usage.inputTokens || inputTokens;
              outputTokens = chunk.messageStop.usage.outputTokens || 0;
            }
          }
        }

        const totalTokens = inputTokens + outputTokens;
        this.lastTokenUsage = totalTokens;

        console.log('[Bedrock] Final token usage:', {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens
        });
      }
    } catch (error) {
      console.error('Converse API error:', error);
      throw error;
    }
  }

  getLastTokenUsage(): number {
    return this.lastTokenUsage;
  }
}

export const bedrockService = new BedrockService();