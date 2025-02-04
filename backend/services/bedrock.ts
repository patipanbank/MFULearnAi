import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ChatMessage } from '../types/chat';

export class BedrockService {
  private client: BedrockRuntimeClient;
  private models = {
    // titan: 'amazon.titan-text-express-v1',
    // claude: 'anthropic.claude-v2',
    claude35: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    // claude3h: 'anthropic.claude-3-haiku-20240307-v1:0',
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
    // เก็บเฉพาะข้อความล่าสุด 5 ข้อความเพื่อลด context size
    const recentMessages = messages.slice(-5);
    
    const command = new InvokeModelCommand({
      modelId: this.models.claude35,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2048, // ลดจาก 4096 เพื่อความเร็วในการตอบกลับ
        messages: recentMessages.map(msg => {
          const content = [];
          
          // จัดการรูปภาพ
          if (msg.image) {
            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: msg.image.mediaType || "image/jpeg",
                data: msg.image.data
              }
            });
          }
          
          // เพิ่ม prompt engineering เพื่อให้ตอบแม่นยำขึ้น
          const enhancedText = msg.role === 'user' 
            ? `Please provide a clear, concise, and accurate response: ${msg.content}`
            : msg.content;

          content.push({
            type: "text",
            text: enhancedText
          });

          return {
            role: msg.role === 'user' ? 'user' : 'assistant',
            content
          };
        }),
        temperature: 0.3, // ลดลงจาก 0.7 เพื่อให้ตอบแม่นยำขึ้น
        top_p: 0.9,
        top_k: 50, // เพิ่มเพื่อควบคุมความหลากหลายของคำตอบ
        presence_penalty: 0.1, // ลดการซ้ำซ้อนในคำตอบ
        frequency_penalty: 0.1 // ลดการใช้คำซ้ำ
      })
    });

    try {
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      // ตรวจสอบคุณภาพคำตอบ
      if (!responseBody.content?.[0]?.text) {
        throw new Error('Invalid response format');
      }

      // ทำความสะอาดคำตอบ
      const cleanedContent = responseBody.content[0].text
        .trim()
        .replace(/\n{3,}/g, '\n\n'); // ลดการเว้นบรรทัดที่มากเกินไป

      return { content: cleanedContent };
    } catch (error) {
      console.error('Claude chat error:', error);
      throw error;
    }
  }

  async embed(text: string): Promise<number[]> {
    try {
      console.log('\n==========================================');
      console.log('🔍 DEBUG: Text being processed:', text);

      const command = new InvokeModelCommand({
        modelId: this.models.embedding,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({ text })
      });

      console.log('Sending request to Bedrock...');
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      console.log('=== Complete Response from Bedrock ===');
      console.log('Response Body:', JSON.stringify(responseBody, null, 2));
      console.log('Response Type:', typeof responseBody);
      console.log('Response Keys:', Object.keys(responseBody));
      
      if (responseBody.embedding) {
        console.log('=== Vector Embedding Results ===');
        console.log('First 5 dimensions:', responseBody.embedding.slice(0, 5));
        console.log('Vector dimension:', responseBody.embedding.length);
      } else {
        console.log('No embedding found in response');
        console.log('Full response:', responseBody);
      }
      console.log('✅ Vector created successfully!');
      console.log('==========================================\n');
      
      return responseBody.embedding;
    } catch (error) {
      console.error('❌ ERROR in embed function:', error);
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