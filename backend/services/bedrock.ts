import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

class BedrockService {
  private client: BedrockRuntimeClient;
  private models = {
    // titan: 'amazon.titan-text-express-v1',
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
      if (modelId === this.models.claude || 
          modelId === this.models.claude35 || 
          modelId === this.models.claude3h) {
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
      const vector = responseBody.results[0].embedding; // Adjust based on actual response structure
      console.log('Generated vector:', vector); // เพิ่มบรรทัดนี้เพื่อแสดง vector
      return vector;
    } catch (error) {
      console.error('Embedding error:', error);
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
      const vector = await this.embed(text);

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
}

export const bedrockService = new BedrockService();

async function testEmbedding() {
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
  const modelId = 'amazon.titan-embed-text-v2'; // ชื่อโมเดลที่ใช้
  const text = "This is a test sentence.";

  try {
    const command = new InvokeModelCommand({
      modelId: modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ text })
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log("Embedding vector:", responseBody.results[0].embedding); // ปรับตามโครงสร้างของการตอบสนองจริง
  } catch (error) {
    console.error("Error during embedding test:", error);
  }
}

// เรียกใช้ฟังก์ชันทดสอบ
testEmbedding();

function cleanResponse(response: string): string {
  return response.replace(/^Bot:\s*/, '').replace(/^Human:\s*/, '');
} // Output: "Hello, how can I assist you today?" 