import { createClient } from 'redis';
import { chromaService } from './chromaService';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });
redisClient.connect().catch(console.error);

export class MemoryService {
  // Redis: recent messages (last 10)
  async addRecentMessage(sessionId: string, message: any) {
    const key = `chat:recent:${sessionId}`;
    await redisClient.rPush(key, JSON.stringify(message));
    await redisClient.lTrim(key, -10, -1); // keep only last 10
  }

  async getRecentMessages(sessionId: string): Promise<any[]> {
    const key = `chat:recent:${sessionId}`;
    const items = await redisClient.lRange(key, 0, -1);
    return items.map((item) => JSON.parse(item));
  }

  async clearRecentMessages(sessionId: string) {
    const key = `chat:recent:${sessionId}`;
    await redisClient.del(key);
  }

  // ChromaDB: long-term memory
  async addLongTermMemory(sessionId: string, document: string, embedding: number[], metadata: any = {}) {
    await chromaService.addToCollection(`chat_memory_${sessionId}`, [document], [embedding], [metadata], [Date.now().toString()]);
  }

  async searchLongTermMemory(sessionId: string, queryEmbedding: number[], k: number = 3) {
    return chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k);
  }

  async clearLongTermMemory(sessionId: string) {
    await chromaService.deleteCollection(`chat_memory_${sessionId}`);
  }
}

export const memoryService = new MemoryService(); 