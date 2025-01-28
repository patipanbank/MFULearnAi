export class EmbeddingService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.OLLAMA_API_URL || 'http://ollama:11434';
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1',
          prompt: text,
          options: { temperature: 0 }
        })
      });

      if (!response.ok) {
        throw new Error('Embedding generation failed');
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
}

export const embeddingService = new EmbeddingService(); 