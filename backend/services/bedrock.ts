import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

class BedrockService {
  private client: BedrockRuntimeClient;
  private models = {
    titan: 'amazon.titan-text-express-v1',
    claude: 'anthropic.claude-v2',
    claude35: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    claude3h: 'anthropic.claude-3-haiku-20240307-v1:0',
    embedding: 'amazon.titan-embed-text-v2'
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
      if ( 
          modelId === this.models.claude35 ) {
        return this.claudeChat(messages);
      }
      return this.titanChat(messages);
    } catch (error) {
      console.error('Bedrock chat error:', error);
      throw error;
    }
  }

  private async claudeChat(messages: ChatMessage[]): Promise<{ content: string }> {
    const prompt = this.formatClaudeMessages(messages);
    
    const command = new InvokeModelCommand({
      modelId: this.models.claude,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: prompt,
        max_tokens_to_sample: 4096,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return { content: responseBody.completion };
  }

  private formatClaudeMessages(messages: ChatMessage[]): string {
    let prompt = '';
    messages.forEach(msg => {
      if (msg.role === 'system') {
        prompt += `\n\nHuman: ${msg.content}\n\nAssistant: I understand.`;
      } else if (msg.role === 'user') {
        prompt += `\n\nHuman: ${msg.content}`;
      } else if (msg.role === 'assistant') {
        prompt += `\n\nAssistant: ${msg.content}`;
      }
    });
    prompt += '\n\nAssistant:';
    return prompt.trim();
  }

  async embed(text: string): Promise<number[]> {
    try {
      const command = new InvokeModelCommand({
        modelId: this.models.embedding,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({ text })
      });
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // Log vector values
      console.log('Input text:', text);
      console.log('Vector embedding (first 5 dimensions):', responseBody.embedding.slice(0, 5));
      console.log('Vector dimension:', responseBody.embedding.length);
      
      return responseBody.embedding;
    } catch (error) {
      console.error('Error in embed:', error);
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

  private async titanChat(messages: ChatMessage[]): Promise<{ content: string }> {
    const prompt = this.formatMessages(messages);
    
    const command = new InvokeModelCommand({
      modelId: this.models.claude35,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: 4096,
          temperature: 0.7,
          topP: 0.9
        }
      })
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return { content: responseBody.results[0].outputText };
  }

  async chatWithVector(messages: ChatMessage[], modelId: string): Promise<{ content: string }> {
    try {
      const text = messages.map(msg => msg.content).join(' ');
      console.log("Received message:", text);
      
      // Convert message to vector using embed function
      const vector = await this.embed(text);
      
      console.log("Vectorized message:", vector);

      const command = new InvokeModelCommand({
        modelId: this.models.embedding,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          inputVector: vector,
        })
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const cleanedContent = cleanResponse(responseBody.results[0].outputText);
      return { content: cleanedContent };
    } catch (error) {
      console.error('Bedrock chat with vector error:', error);
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

function cleanResponse(response: string): string {
  return response.replace(/^Bot:\s*/, '').replace(/^Human:\s*/, '');
} 