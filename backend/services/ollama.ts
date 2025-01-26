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
      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama2',
          messages: messages,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return { content: data.message.content };
    } catch (error) {
      console.error('Ollama service error:', error);
      throw error;
    }
  }
}

export const ollamaService = new OllamaService(); 