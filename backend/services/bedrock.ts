import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, InvokeModelCommand, ConverseCommand, Message, ConversationRole } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

interface ModelConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  stopSequences?: string[];
}

// Define the Tool interface that our services will implement
export interface BedrockTool {
  name: string;
  description: string;
  inputSchema: any; // JSON Schema object
  execute(input: any): Promise<any>;
}

// Helper function to map our ChatMessage role to Bedrock's ConversationRole
function mapRole(role: 'user' | 'assistant'): ConversationRole {
    return role;
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  public models = {
    claude35: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    titanImage: "amazon.titan-image-generator-v1",
    titanMultimodal: "amazon.titan-embed-image-v1" // Added for multimodal embedding
  };

  private readonly defaultConfig: ModelConfig = {
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096
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
        modelId: this.models.titanMultimodal, // Use the correct model for embedding
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          inputImage: imageBase64,
          ...(text && { inputText: text })
        })
      });

      const response = await this.client.send(command);
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

  async invokeModelJSON(prompt: string, modelId: string = this.models.claude35): Promise<any> {
    try {
      const command = new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const jsonContent = JSON.parse(responseBody.content[0].text);
      
      return jsonContent;
    } catch (error) {
      console.error(`Error invoking model ${modelId} for JSON output:`, error);
      throw new Error(`Failed to get a valid JSON response from the model. Error: ${error}`);
    }
  }

  // This method is now legacy, for non-agent models
  async *generateStreaming(params: {
    systemPrompt: string,
    messages: ChatMessage[],
    context?: string,
  }): AsyncGenerator<string> {
    const { systemPrompt, messages, context } = params;
    const modelConfig = this.defaultConfig; // Use a simpler config

    // Construct a new message history with the provided context
    const finalMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    if (context) {
      finalMessages[finalMessages.length - 1].content += `\n\n--- Knowledge Base Context ---\n${context}`;
    }

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.chatModel,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        system: systemPrompt,
        messages: finalMessages,
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        top_p: modelConfig.topP,
      }),
    });
    
    try {
      const response = await this.client.send(command);
      
      if (!response.body) {
        throw new Error("Empty response body");
      }

      let totalTokens = 0;
      
      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          
          if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
            yield chunkData.delta.text;
          }
          
          if (chunkData.type === 'message_delta' && chunkData.usage) {
            totalTokens += chunkData.usage.output_tokens || 0;
          }
        }
      }
      
      this.lastTokenUsage = totalTokens;
    } catch (error) {
      console.error("Error in streaming generation:", error);
      throw error;
    }
  }

  // New method for Agentic chat using Converse API
  async *converseWithTools(params: {
    systemPrompt: string,
    messages: ChatMessage[],
    tools: BedrockTool[],
  }): AsyncGenerator<any> {
    const { systemPrompt, messages, tools } = params;
    
    // Correctly map ChatMessage[] to Message[]
    let currentMessages: Message[] = messages.map(m => ({
        role: mapRole(m.role),
        content: [{ text: m.content }]
    }));
    
    while (true) {
      const command = new ConverseCommand({
        modelId: this.models.claude35,
        system: [{ text: systemPrompt }],
        messages: currentMessages,
        toolConfig: {
          tools: tools.map(tool => ({
            toolSpec: {
              name: tool.name,
              description: tool.description,
              inputSchema: { json: tool.inputSchema },
            },
          })),
        },
      });

      const response = await this.client.send(command);
      
      // Add undefined checks
      if (!response.output?.message) {
        // Handle error case where response message is not available
        yield { type: 'error', data: 'No response message from model.' };
        break;
      }

      const responseMessage = response.output.message;
      currentMessages.push(responseMessage);

      const toolRequests = responseMessage.content?.filter((c: any) => c.toolUse) ?? [];
      
      if (toolRequests.length === 0) {
        // No more tools to call, stream the final text content
        for (const content of responseMessage.content ?? []) {
          if (content.text) {
            yield { type: 'chunk', data: content.text };
          }
        }
        break; // Exit loop
      }

      yield { type: 'tool_use', data: toolRequests.map((t:any) => t.toolUse) };

      const toolResults = await Promise.all(
        toolRequests.map(async (toolRequest: any) => {
          const tool = tools.find(t => t.name === toolRequest.toolUse.name);
          if (!tool) {
            return {
              toolUseId: toolRequest.toolUse.toolUseId,
              content: [{ json: { success: false, error: `Tool ${toolRequest.toolUse.name} not found.` } }],
            };
          }
          const result = await tool.execute(toolRequest.toolUse.input);
          return {
            toolUseId: toolRequest.toolUse.toolUseId,
            content: [{ json: result }],
          };
        })
      );
      
      currentMessages.push({
        role: "user", // Role for tool results is 'user'
        content: toolResults.map(result => ({ toolResult: result })),
      });
    }
  }

  getLastTokenUsage(): number {
    return this.lastTokenUsage;
  }
}

export const bedrockService = new BedrockService();