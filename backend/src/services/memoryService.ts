import { ChatMessage } from '../models/chat';
import { bedrockService } from './bedrockService';

export interface MemoryEntry {
  content: string;
  role: string;
  timestamp: Date;
  messageId: string;
  embedding?: number[];
}

export class MemoryService {
  private memoryStores: Map<string, MemoryEntry[]> = new Map();

  constructor() {
    console.log('✅ Memory service initialized');
  }

  public async addChatMemory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const existingIds = new Set(
        this.memoryStores.get(sessionId)?.map(entry => entry.messageId) || []
      );

      const newEntries: MemoryEntry[] = [];
      
      for (const msg of messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          if (!existingIds.has(msg.id) && msg.content.trim()) {
            // Create embedding for the message
            const embedding = await bedrockService.createTextEmbedding(msg.content);
            
            const entry: MemoryEntry = {
              content: msg.content,
              role: msg.role,
              timestamp: msg.timestamp,
              messageId: msg.id,
              embedding
            };
            
            newEntries.push(entry);
          }
        }
      }

      if (newEntries.length > 0) {
        const currentMemory = this.memoryStores.get(sessionId) || [];
        this.memoryStores.set(sessionId, [...currentMemory, ...newEntries]);
        
        console.log(`📚 Added ${newEntries.length} messages to memory for session ${sessionId}`);
      }
    } catch (error) {
      console.error(`❌ Error adding chat memory for session ${sessionId}:`, error);
    }
  }

  public async searchChatMemory(sessionId: string, query: string, k: number = 5): Promise<MemoryEntry[]> {
    try {
      const memory = this.memoryStores.get(sessionId);
      if (!memory || memory.length === 0) {
        return [];
      }

      // Create embedding for the query
      const queryEmbedding = await bedrockService.createTextEmbedding(query);
      
      // Calculate similarity scores
      const scoredEntries = memory
        .filter(entry => entry.embedding)
        .map(entry => ({
          ...entry,
          similarity: this.calculateCosineSimilarity(queryEmbedding, entry.embedding!)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, k);

      return scoredEntries;
    } catch (error) {
      console.error(`❌ Error searching chat memory for session ${sessionId}:`, error);
      return [];
    }
  }

  public getRecentMessages(sessionId: string, limit: number = 10): MemoryEntry[] {
    const memory = this.memoryStores.get(sessionId);
    if (!memory) {
      return [];
    }

    return memory
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-limit);
  }

  public getAllMessages(sessionId: string): MemoryEntry[] {
    const memory = this.memoryStores.get(sessionId);
    if (!memory) {
      return [];
    }

    return memory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  public clearChatMemory(sessionId: string): void {
    this.memoryStores.delete(sessionId);
    console.log(`🧹 Cleared chat memory for session ${sessionId}`);
  }

  public getMemoryStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalSessions: this.memoryStores.size,
      totalMessages: 0,
      sessions: {}
    };

    for (const [sessionId, memory] of this.memoryStores) {
      stats.totalMessages += memory.length;
      stats.sessions[sessionId] = {
        messageCount: memory.length,
        lastUpdated: memory.length > 0 ? memory[memory.length - 1].timestamp : null
      };
    }

    return stats;
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  public shouldUseMemoryTool(messageCount: number): boolean {
    // Use memory tool when there are more than 10 messages
    return messageCount > 10;
  }

  public shouldEmbedMessages(messageCount: number): boolean {
    // Embed messages every 10 messages (10, 20, 30, etc.)
    return messageCount % 10 === 0;
  }
}

export const memoryService = new MemoryService(); 