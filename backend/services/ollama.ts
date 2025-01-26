import fetch from 'node-fetch';
import { ChatMessage } from '../types/chat';

class OllamaService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.OLLAMA_API_URL || 'http://ollama:11434';
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/tags`);
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      const data = await response.json();
      return data.models.map((model: { name: string }) => model.name);
    } catch (error) {
      console.error('Error fetching available models:', error);
      throw error;
    }
  }

  async chat(messages: ChatMessage[]): Promise<{ content: string }> {
    try {
      console.log('Sending request to Ollama:', messages);
      
      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.1',
          messages: messages,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Ollama response:', data);
      
      return { content: data.message.content };
    } catch (error) {
      console.error('Ollama service error:', error);
      throw error;
    }
  }
}

export const ollamaService = new OllamaService(); 