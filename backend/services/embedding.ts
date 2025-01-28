export class EmbeddingService {
  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch('http://ollama:11434/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1',
          prompt: text
        })
      });

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('Embedding error:', error);
      throw error;
    }
  }
} 