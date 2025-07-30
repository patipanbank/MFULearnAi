// @ts-nocheck
import { createClient } from 'redis';
import { chromaService } from './chromaService';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });
redisClient.connect().catch(console.error);

function isArrayOfMemoryDocs(arr: any): arr is Array<{ document: string | null; metadata: any }> {
  return Array.isArray(arr) && arr.every(item => typeof item === 'object' && 'document' in item);
}

export class MemoryService {
  // Redis: recent messages (last 10) - เหมือน Legacy
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

  // ChromaDB: long-term memory - เหมือน Legacy
  async addLongTermMemory(sessionId: string, document: string, embedding: number[], metadata: any = {}) {
    await chromaService.addToCollection(`chat_memory_${sessionId}`, [document], [embedding], [metadata], [Date.now().toString()]);
  }

  async searchLongTermMemory(sessionId: string, queryEmbedding: number[], k: number = 3) {
    return chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k);
  }

  async clearLongTermMemory(sessionId: string) {
    await chromaService.deleteCollection(`chat_memory_${sessionId}`);
  }

  // Embed message into long-term memory (vectorstore) - เหมือน Legacy
  async embedMessage(sessionId: string, message: string) {
    try {
      // TODO: ใช้ embedding model จริง (เช่น OpenAI, Bedrock, HuggingFace) แทน mock
      // ตัวอย่าง: const embedding = await embeddingService.embed(message);
      // ชั่วคราว: mock embedding เป็น array ศูนย์
      const embedding = Array(768).fill(0);
      await this.addLongTermMemory(sessionId, message, embedding, { 
        role: 'user',
        timestamp: new Date().toISOString(),
        sessionId 
      });
      console.log(`📚 Embedded message to long-term memory for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error embedding message: ${error}`);
    }
  }

  // Search memory (vectorstore) - เหมือน Legacy
  async searchMemory(sessionId: string, query: string, k: number = 3): Promise<any[]> {
    try {
      // TODO: ใช้ embedding model จริง (เช่น OpenAI, Bedrock, HuggingFace) แทน mock
      const queryEmbedding = Array(768).fill(0);
      const results = await this.searchLongTermMemory(sessionId, queryEmbedding, k);
      
      // สมมติ chromaService.queryCollection คืน [{ document, metadata }]
      if (!results || !results.documents) return [];
      
      return results.documents.flat().map((doc: string | null, i: number) => ({
        content: doc || '',
        role: results.metadatas?.[i]?.role || 'user',
        timestamp: results.metadatas?.[i]?.timestamp || null
      }));
    } catch (error) {
      console.error(`❌ Error searching memory: ${error}`);
      return [];
    }
  }

  // Get all messages from long-term memory (vectorstore) - เหมือน Legacy
  async getAllMessages(sessionId: string): Promise<any[]> {
    try {
      // TODO: ดึงทั้งหมดจาก chromaService
      // สมมติ chromaService.getAllFromCollection คืน Array<{ document: string, metadata: any }>
      const results = await chromaService.getAllFromCollection(`chat_memory_${sessionId}`);
      if (!Array.isArray(results)) return [];
      
      return results.map((r: { document: string | null; metadata: any }) => ({
        content: r.document ?? '',
        role: r.metadata?.role || 'user',
        timestamp: r.metadata?.timestamp || null
      }));
    } catch (error) {
      console.error(`❌ Error getting all messages: ${error}`);
      return [];
    }
  }

  // Hybrid memory management - เหมือน Legacy
  async setupHybridMemory(sessionId: string, messages: any[]) {
    try {
      console.log(`🧠 Setting up hybrid memory for session ${sessionId}`);
      
      // 1. Redis memory for recent messages (last 10)
      const recentMessages = messages.slice(-10);
      if (recentMessages.length > 0) {
        for (const msg of recentMessages) {
          await this.addRecentMessage(sessionId, msg);
        }
        console.log(`💾 Stored ${recentMessages.length} recent messages in Redis`);
      }
      
      // 2. Vectorstore memory for long-term storage (every 10 messages)
      if (messages.length % 10 === 0 && messages.length > 0) {
        const messagesForEmbedding = messages.map(msg => ({
          content: msg.content,
          role: msg.role,
          timestamp: new Date().toISOString()
        }));
        
        // Embed messages into vectorstore
        for (const msg of messagesForEmbedding) {
          await this.embedMessage(sessionId, msg.content);
        }
        
        console.log(`📚 Embedded ${messagesForEmbedding.length} messages to vectorstore`);
      }
      
    } catch (error) {
      console.error(`❌ Error setting up hybrid memory: ${error}`);
    }
  }

  // Get memory statistics - เหมือน Legacy
  async getMemoryStats(sessionId: string): Promise<any> {
    try {
      const recent = await this.getRecentMessages(sessionId);
      const all = await this.getAllMessages(sessionId);
      
      return {
        sessionId,
        recentCount: recent.length,
        totalCount: all.length,
        hybridMemory: true
      };
    } catch (error) {
      console.error(`❌ Error getting memory stats: ${error}`);
      return { error: 'Memory stats unavailable' };
    }
  }

  // Clear all memory for session - เหมือน Legacy
  async clearAllMemory(sessionId: string) {
    try {
      await this.clearRecentMessages(sessionId);
      await this.clearLongTermMemory(sessionId);
      console.log(`🧹 Cleared all memory for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error clearing memory: ${error}`);
    }
  }
}

export const memoryService = new MemoryService(); 