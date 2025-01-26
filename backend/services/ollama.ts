import fetch from 'node-fetch';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

class OllamaService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.OLLAMA_API_URL || 'http://ollama:11434';
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