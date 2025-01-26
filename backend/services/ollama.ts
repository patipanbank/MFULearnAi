import axios from 'axios';

const OLLAMA_API = process.env.OLLAMA_API_URL || 'http://localhost:11434';

export const ollamaService = {
  async generateEmbedding(text: string) {
    try {
      const response = await axios.post(`${OLLAMA_API}/api/embeddings`, {
        model: "llama3.1",
        prompt: text
      });
      return response.data.embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  },

  async chat(messages: Array<{role: string, content: string}>) {
    try {
      const response = await axios.post(`${OLLAMA_API}/api/chat`, {
        model: "llama3.1",
        messages,
        stream: false
      });
      return response.data.message;
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }
}; 