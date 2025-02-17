import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { titanEmbedService } from '../services/titan';
import { ChatMessage } from '../types/chat';


export class ChatService {
  private systemPrompt = `You are DinDin, a male AI. Keep responses brief and to the point.`;

  private isRelevantQuestion(query: string): boolean {
    return true;
  }

  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelId: string,
    collectionName: string
  ): AsyncGenerator<string> {
    try {
      console.log('Starting generateResponse:', {
        modelId,
        collectionName,
        messagesCount: messages.length,
        query,
      });

      if (!this.isRelevantQuestion(query)) {
        console.log('Query not relevant');
        yield 'Sorry, DinDin can only answer questions about Mae Fah Luang University.';
        return;
      }

      // Embed the question to create a vector representation and then retrieve context.
      const context = await this.getContext(query, collectionName);
      console.log('Retrieved context length:', context.length);

      const augmentedMessages = [
        {
          role: 'system' as const,
          content: `${this.systemPrompt}\n\nContext from documents:\n${context}`,
        },
        ...messages,
      ];

      for await (const chunk of bedrockService.chat(augmentedMessages, modelId)) {
        yield chunk;
      }
    } catch (error) {
      console.error('Error in generateResponse:', error);
      throw error;
    }
  }

  private async getContext(query: string, collectionName: string): Promise<string> {
    try {
      if (!collectionName || !query.trim()) return '';
      
      console.time('embeddingAndQuery');
      const trimmedQuery = query.trim();
      
      // Retrieve the embedding from your Titan embed service.
      const embedding: number[] = await titanEmbedService.embedText(trimmedQuery);
      console.log('Embedding vector:', embedding, 'Dimension:', embedding.length);
      
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        console.warn(`No valid embedding returned for query: "${trimmedQuery}".`);
        return '';
      }
      
      // Query the documents collection using only the embedding.
      const { documents } = await chromaService.queryDocumentsByEmbedding(collectionName, embedding, 10);
      
      // Join the document contexts.
      return documents.join('\n\n');
    } catch (error) {
      console.error('Error getting embedded context:', error);
      return '';
    } finally {
      console.timeEnd('embeddingAndQuery');
    }
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug message');
}
