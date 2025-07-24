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

  // Embed message into long-term memory (vectorstore)
  async embedMessage(sessionId: string, message: string) {
    // TODO: ใช้ embedding model จริง (เช่น OpenAI, Bedrock, HuggingFace) แทน mock
    // ตัวอย่าง: const embedding = await embeddingService.embed(message);
    // ชั่วคราว: mock embedding เป็น array ศูนย์
    const embedding = Array(768).fill(0);
    await this.addLongTermMemory(sessionId, message, embedding, { role: 'user' });
  }

  // Search memory (vectorstore)
  async searchMemory(sessionId: string, query: string, k: number = 3): Promise<any[]> {
    // TODO: ใช้ embedding model จริง (เช่น OpenAI, Bedrock, HuggingFace) แทน mock
    const queryEmbedding = Array(768).fill(0);
    const results = await this.searchLongTermMemory(sessionId, queryEmbedding, k);
    // สมมติ chromaService.queryCollection คืน [{ document, metadata }]
    return (results || []).map((r: any) => ({
      content: r.document,
      role: r.metadata?.role || 'user',
      timestamp: r.metadata?.timestamp || null
    }));
  }

  // Get all messages from long-term memory (vectorstore)
  async getAllMessages(sessionId: string): Promise<any[]> {
    // TODO: ดึงทั้งหมดจาก chromaService
    // สมมติ chromaService.getAllFromCollection คืน [{ document, metadata }]
    if (!chromaService.getAllFromCollection) return [];
    const results = await chromaService.getAllFromCollection(`chat_memory_${sessionId}`);
    return (results || []).map((r: any) => ({
      content: r.document,
      role: r.metadata?.role || 'user',
      timestamp: r.metadata?.timestamp || null
    }));
  }
}

export const memoryService = new MemoryService(); 