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
    },
    // Intent-specific configurations
    greeting: {
      temperature: 0.7,  // Friendly, conversational temperature
      topP: 0.95,
      maxTokens: 1000,  // Shorter responses for greetings
    },
    farewell: {
      temperature: 0.7,  // Friendly, conversational temperature
      topP: 0.95,
      maxTokens: 1000,  // Shorter responses for farewells
    },
    gratitude: {
      temperature: 0.7,  // Friendly, conversational temperature
      topP: 0.95,
      maxTokens: 1000,  // Shorter responses for thank you messages
    },
    academic_help: {
      temperature: 0.5,  // Moderate temperature for educational responses
      topP: 0.92,
      maxTokens: 3500,  // Longer responses for academic help
    },
    course_inquiry: {
      temperature: 0.4,  // Lower temperature for precise information
      topP: 0.9,
      maxTokens: 3000,
    },
    enrollment_inquiry: {
      temperature: 0.4,  // Lower temperature for precise information
      topP: 0.9,
      maxTokens: 3000,
    },
    schedule_inquiry: {
      temperature: 0.4,  // Lower temperature for precise information
      topP: 0.9,
      maxTokens: 3000,
    },
    facility_inquiry: {
      temperature: 0.4,  // Lower temperature for precise information
      topP: 0.9,
      maxTokens: 3000,
    },
    technical_help: {
      temperature: 0.3,  // Lower temperature for technical precision
      topP: 0.9,
      maxTokens: 3000,
    },
    feedback: {
      temperature: 0.7,  // Higher temperature for more nuanced responses
      topP: 0.95,
      maxTokens: 2500,
    },
    image_analysis: {
      temperature: 0.4,  // Lower temperature for accuracy
      topP: 0.9,
      maxTokens: 3000,
    },
    
    // Topic-specific configurations
    admission: {
      temperature: 0.4,  // Lower temperature for accurate information
      topP: 0.9,
      maxTokens: 3000,
    },
    tuition: {
      temperature: 0.3,  // Very low temperature for financial accuracy
      topP: 0.88,
      maxTokens: 2500,
    },
    academic_programs: {
      temperature: 0.4,  // Lower temperature for program details
      topP: 0.9,
      maxTokens: 3500,  // Longer responses for program descriptions
    },
    courses: {
      temperature: 0.4,  // Lower temperature for course details
      topP: 0.9,
      maxTokens: 3000,
    },
    examinations: {
      temperature: 0.3,  // Low temperature for exam policy precision
      topP: 0.88,
      maxTokens: 2500,
    },
    registration: {
      temperature: 0.3,  // Low temperature for registration procedure accuracy
      topP: 0.88,
      maxTokens: 2500,
    },
    academic_calendar: {
      temperature: 0.3,  // Low temperature for date accuracy
      topP: 0.85,
      maxTokens: 2000,
    },
    campus_facilities: {
      temperature: 0.5,  // Moderate temperature for facility descriptions
      topP: 0.9,
      maxTokens: 2500,
    },
    student_services: {
      temperature: 0.5,  // Moderate temperature for service descriptions
      topP: 0.9,
      maxTokens: 2500,
    },
    housing: {
      temperature: 0.4,  // Lower temperature for housing details
      topP: 0.9,
      maxTokens: 2500,
    },
    technology: {
      temperature: 0.3,  // Low temperature for technical accuracy
      topP: 0.88,
      maxTokens: 2500,
    },
    extracurricular: {
      temperature: 0.6,  // Higher temperature for engaging activity descriptions
      topP: 0.92,
      maxTokens: 2500,
    },
    international: {
      temperature: 0.4,  // Lower temperature for international student info
      topP: 0.9,
      maxTokens: 3000,
    },
    research: {
      temperature: 0.5,  // Moderate temperature for research descriptions
      topP: 0.92,
      maxTokens: 3500,  // Longer responses for research details
    },
    faculty: {
      temperature: 0.5,  // Moderate temperature for faculty information
      topP: 0.9,
      maxTokens: 2500,
    },
    graduation: {
      temperature: 0.4,  // Lower temperature for graduation requirement accuracy
      topP: 0.9,
      maxTokens: 2500,
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

  private getModelConfig(messages: ChatMessage[]): ModelConfig {
    const lastMessage = messages[messages.length - 1];
    
    // Check for image generation intent
    if (lastMessage.isImageGeneration) {
      return {
        ...this.defaultConfig,
        ...this.questionTypeConfigs.imageGeneration
      };
    }
    
    // Check for intent and topic information in message metadata
    if (lastMessage.metadata) {
      const primaryIntent = lastMessage.metadata.primaryIntent;
      const intentConfidence = lastMessage.metadata.intentConfidence;
      const primaryTopic = lastMessage.metadata.primaryTopic;
      const topicConfidence = lastMessage.metadata.topicConfidence;
      
      // Check if we have both intent and topic with good confidence
      if (primaryIntent && primaryTopic && 
          intentConfidence && topicConfidence && 
          intentConfidence > 0.6 && topicConfidence > 0.6) {
        
        console.log(`Using combined intent (${primaryIntent}) and topic (${primaryTopic}) model config`);
        
        // Use the more specific configuration if available
        const intentConfig = this.questionTypeConfigs[primaryIntent];
        const topicConfig = this.questionTypeConfigs[primaryTopic];
        
        if (intentConfig && topicConfig) {
          // Blend configurations, preferring the one with higher confidence
          if (intentConfidence >= topicConfidence) {
            // Prefer intent config with some topic adjustments
            return {
              ...this.defaultConfig,
              ...topicConfig,  // Base with topic config
              ...intentConfig,  // Override with intent config for most parameters
              temperature: (intentConfig.temperature + topicConfig.temperature) / 2, // Blend temperature
              maxTokens: Math.max(intentConfig.maxTokens, topicConfig.maxTokens) // Use larger token limit
            };
          } else {
            // Prefer topic config with some intent adjustments
            return {
              ...this.defaultConfig,
              ...intentConfig,  // Base with intent config
              ...topicConfig,   // Override with topic config for most parameters
              temperature: (intentConfig.temperature + topicConfig.temperature) / 2, // Blend temperature
              maxTokens: Math.max(intentConfig.maxTokens, topicConfig.maxTokens) // Use larger token limit
            };
          }
        }
      }
      
      // Use intent-specific config when confidence is high enough
      if (primaryIntent && intentConfidence && intentConfidence > 0.6 && this.questionTypeConfigs[primaryIntent]) {
        console.log(`Using intent-specific model config for: ${primaryIntent} (confidence: ${intentConfidence})`);
        return {
          ...this.defaultConfig,
          ...this.questionTypeConfigs[primaryIntent]
        };
      }
      
      // Use topic-specific config when confidence is high and no strong intent match
      if (primaryTopic && topicConfidence && topicConfidence > 0.6 && 
          this.questionTypeConfigs[primaryTopic] && 
          (!intentConfidence || intentConfidence < 0.6)) {
        console.log(`Using topic-specific model config for: ${primaryTopic} (confidence: ${topicConfidence})`);
        return {
          ...this.defaultConfig,
          ...this.questionTypeConfigs[primaryTopic]
        };
      }
      
      // Check for specific intent flags for backward compatibility
      if (lastMessage.metadata.requiresImageAnalysis) {
        return {
          ...this.defaultConfig,
          ...this.questionTypeConfigs.image_analysis
        };
      }
    }

    // Default to general config if no intent or topic is detected
    return {
      ...this.defaultConfig,
      ...this.questionTypeConfigs.factual // Use factual as the default
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

  async *chat(messages: ChatMessage[], modelId: string): AsyncGenerator<string> {
    try {
      const config = this.getModelConfig(messages);
      // console.log('Using model config:', config);

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
          messages: messages.map(msg => {
            // ตรวจสอบว่ามีไฟล์หรือรูปภาพหรือไม่
            const hasImages = msg.images && msg.images.length > 0;
            const hasFiles = msg.files && msg.files.length > 0;
            
            // ถ้าไม่มีไฟล์หรือรูปภาพ ส่งแค่ข้อความอย่างเดียว
            if (!hasImages && !hasFiles) {
              return {
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
              };
            }
            
            // สร้าง content array แบบ multimodal
            let content = [];
            
            // เพิ่มข้อความหลัก
            content.push({ type: 'text', text: msg.content });
            
            // เพิ่มรูปภาพถ้ามี
            if (hasImages && msg.images) {
              msg.images.forEach(img => {
                content.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: img.mediaType,
                    data: img.data
                  }
                });
              });
            }
            
            // เพิ่มข้อมูลไฟล์ถ้ามี
            if (hasFiles && msg.files) {
              msg.files.forEach(file => {
                // เพิ่มชื่อไฟล์
                content.push({ 
                  type: 'text', 
                  text: `\n\n=== File: ${file.name} (${file.mediaType}) ===\n`
                });
                
                // เพิ่มเนื้อหาของไฟล์
                if (file.content) {
                  content.push({
                    type: 'text',
                    text: file.content
                  });
                } else {
                  content.push({
                    type: 'text',
                    text: `[Cannot read file content ${file.name}]`
                  });
                }
                
                content.push({
                  type: 'text',
                  text: '\n=== End of file ===\n'
                });
              });
            }
            
            return {
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: content
            };
          })
        })
      });

      const response = await this.client.send(command);

      if (response.body) {
        let inputTokens = 0;
        let outputTokens = 0;

        for await (const chunk of response.body) {
          if (chunk.chunk?.bytes) {
            const decodedChunk = new TextDecoder().decode(chunk.chunk.bytes);
            try {
              const parsedChunk = JSON.parse(decodedChunk);
              
              if (parsedChunk.type === 'message_start' && parsedChunk.message?.usage?.input_tokens) {
                inputTokens = parsedChunk.message.usage.input_tokens;
              }

              if (parsedChunk.type === 'message_delta' && parsedChunk.usage?.output_tokens) {
                outputTokens = parsedChunk.usage.output_tokens;
              }

              if (parsedChunk.type === 'message_stop' && parsedChunk['amazon-bedrock-invocationMetrics']) {
                const metrics = parsedChunk['amazon-bedrock-invocationMetrics'];
                inputTokens = metrics.inputTokenCount;
                outputTokens = metrics.outputTokenCount;
              }

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

        const totalTokens = inputTokens + outputTokens;
        this.lastTokenUsage = totalTokens;

        console.log('[Bedrock] Final token usage:', {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens
        });
      }
    } catch (error) {
      console.error('Claude chat error:', error);
      throw error;
    }
  }

  getLastTokenUsage(): number {
    return this.lastTokenUsage;
  }
}

export const bedrockService = new BedrockService();