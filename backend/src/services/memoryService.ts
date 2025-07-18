import { ChatMessage } from '../models/chat';
import { bedrockService } from './bedrockService';
import { createClient } from 'redis';

export interface MemoryEntry {
  content: string;
  role: string;
  timestamp: Date;
  messageId: string;
  embedding?: number[];
}

export class MemoryService {
  private redisClient: ReturnType<typeof createClient>;

  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    this.redisClient.connect().then(() => {
      console.log('✅ MemoryService: Connected to Redis');
    }).catch((err) => {
      console.error('❌ MemoryService: Failed to connect to Redis:', err);
    });
  }

  /**
   * เพิ่มข้อความลง memory (buffer/vector) ใน Redis ต่อ sessionId
   */
  public async addChatMemory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      for (const msg of messages) {
        if ((msg.role === 'user' || msg.role === 'assistant') && msg.content.trim()) {
          // สร้าง embedding จริง
          const embedding = await bedrockService.createTextEmbedding(msg.content);
          const entry: MemoryEntry = {
            content: msg.content,
            role: msg.role,
            timestamp: msg.timestamp,
            messageId: msg.id,
            embedding
          };
          // เก็บเป็น JSON string ใน Redis list
          await this.redisClient.rPush(`memory:${sessionId}`, JSON.stringify(entry));
        }
      }
      console.log(`📚 [Redis] Added ${messages.length} messages to memory for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ [Redis] Error adding chat memory for session ${sessionId}:`, error);
    }
  }

  /**
   * ค้นหา memory ใน Redis ด้วย embedding similarity
   */
  public async searchChatMemory(sessionId: string, query: string, k: number = 5): Promise<MemoryEntry[]> {
    try {
      const memoryRaw = await this.redisClient.lRange(`memory:${sessionId}`, 0, -1);
      if (!memoryRaw || memoryRaw.length === 0) return [];
      const memory: MemoryEntry[] = memoryRaw.map((m) => JSON.parse(m));
      const queryEmbedding = await bedrockService.createTextEmbedding(query);
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
      console.error(`❌ [Redis] Error searching chat memory for session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * ดึง recent buffer (n ล่าสุด) จาก Redis
   */
  public async getRecentMessages(sessionId: string, limit: number = 10): Promise<MemoryEntry[]> {
    try {
      const memoryRaw = await this.redisClient.lRange(`memory:${sessionId}`, -limit, -1);
      if (!memoryRaw) return [];
      return memoryRaw.map((m) => JSON.parse(m));
    } catch {
      return [];
    }
  }

  /**
   * ดึง memory ทั้งหมดจาก Redis
   */
  public async getAllMessages(sessionId: string): Promise<MemoryEntry[]> {
    try {
      const memoryRaw = await this.redisClient.lRange(`memory:${sessionId}`, 0, -1);
      if (!memoryRaw) return [];
      return memoryRaw.map((m) => JSON.parse(m));
    } catch {
      return [];
    }
  }

  /**
   * ลบ memory ทั้งหมดของ sessionId ใน Redis
   */
  public async clearChatMemory(sessionId: string): Promise<void> {
    await this.redisClient.del(`memory:${sessionId}`);
    console.log(`🧹 [Redis] Cleared chat memory for session ${sessionId}`);
  }

  public getMemoryStats(): Record<string, any> {
    // สำหรับ production: สามารถนับ keys ใน Redis หรือ query stats ได้
    return { redis: true };
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  public shouldUseMemoryTool(messageCount: number): boolean {
    return messageCount > 10;
  }

  public shouldEmbedMessages(messageCount: number): boolean {
    return messageCount % 10 === 0;
  }
}

export const memoryService = new MemoryService(); 