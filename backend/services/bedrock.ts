import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

class BedrockService {
  private client: BedrockRuntimeClient;
  private models = {
    titan: 'amazon.titan-text-express-v1',
    claude: 'anthropic.claude-v2',
    nova: 'amazon.nova-micro-v1:0',
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
      if (modelId === this.models.claude) {
        return this.claudeChat(messages);
      } else if (modelId === this.models.nova) {
        return this.novaChat(messages);
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

  private async titanChat(messages: ChatMessage[]): Promise<{ content: string }> {
    const prompt = this.formatMessages(messages);
    
    const command = new InvokeModelCommand({
      modelId: this.models.titan,
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

  private async novaChat(messages: ChatMessage[]): Promise<{ content: string }> {
    const prompt = this.formatNovaMessages(messages);
    
    const command = new InvokeModelCommand({
      modelId: this.models.nova,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: prompt,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 4096,
        stop_sequences: []
      })
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return { content: responseBody.text };
  }

  private formatNovaMessages(messages: ChatMessage[]): string {
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
    prompt += 'Assistant:';
    return prompt.trim();
  }

  async testNovaModel(): Promise<boolean> {
    try {
      const command = new InvokeModelCommand({
        modelId: this.models.nova,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          prompt: "Human: Simple test\n\nAssistant:",
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 50
        })
      });

      const response = await this.client.send(command);
      console.log('Nova test response:', JSON.parse(new TextDecoder().decode(response.body)));
      return true;
    } catch (error) {
      console.error('Nova Pro test error:', error);
      return false;
    }
  }
}

export const bedrockService = new BedrockService(); 