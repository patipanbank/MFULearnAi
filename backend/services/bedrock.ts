import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

class BedrockService {
  private client: BedrockRuntimeClient;
  private chatModel = 'amazon.titan-text-express-v1';
  private embeddingModel = 'amazon.titan-embed-text-v2';

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }

  async chat(messages: ChatMessage[]): Promise<{ content: string }> {
    try {
      const prompt = this.formatMessages(messages);
      
      const command = new InvokeModelCommand({
        modelId: this.chatModel,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          inputText: prompt,
          textGenerationConfig: {
            maxTokenCount: 4096,
            stopSequences: [],
            temperature: 0.7,
            topP: 0.9
          }
        })
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return { content: responseBody.results[0].outputText };
    } catch (error) {
      console.error('Bedrock chat error:', error);
      throw error;
    }
  }

  async embed(text: string): Promise<number[]> {
    try {
      const command = new InvokeModelCommand({
        modelId: this.embeddingModel,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          inputText: text
        })
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return responseBody.embedding;
    } catch (error) {
      console.error('Bedrock embedding error:', error);
      throw error;
    }
  }

  private formatMessages(messages: ChatMessage[]): string {
    let prompt = '';
    messages.forEach(msg => {
      if (msg.role === 'system') {
        prompt += `System: ${msg.content}\n\n`;
      } else if (msg.role === 'user') {
        prompt += `Human: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    });
    return prompt.trim();
  }
}

export const bedrockService = new BedrockService(); 