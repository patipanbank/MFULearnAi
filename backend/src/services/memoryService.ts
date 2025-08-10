import { chromaService } from './chromaService';
import { embeddingService } from './embeddingService';
import { redis } from '../lib/redis';

function isArrayOfMemoryDocs(arr: any): arr is Array<{ document: string | null; metadata: any }> {
  return Array.isArray(arr) && arr.every(item => typeof item === 'object' && 'document' in item);
}

export class MemoryService {
  // Redis: recent messages (last 10) - เหมือน Legacy
  async addRecentMessage(sessionId: string, message: any) {
    try {
      const key = `chat:recent:${sessionId}`;
      const currentLen = await redis.llen(key);
      if (currentLen >= 10) {
        // Embed existing 10 messages as a batch then reset window
        const items = await redis.lrange(key, 0, -1);
        const parsed = items.map((item) => {
          try { return JSON.parse(item); } catch { return null; }
        }).filter(Boolean) as Array<{ content?: string; role?: string }>;

        const contents = parsed.map((m) => String(m?.content ?? '')).filter((c) => c.trim().length > 0);
        if (contents.length > 0) {
          try {
            const embeddings = await embeddingService.embedBatch(contents);
            const ids = contents.map((c) => Buffer.from(c).toString('base64'));
            const metadatas = parsed.map((m) => ({
              role: m?.role || 'user',
              timestamp: new Date().toISOString(),
              sessionId
            }));
            await chromaService.addToCollection(`chat_memory_${sessionId}`,
              contents, embeddings, metadatas, ids);
            console.log(`📦 Embedded batch of ${contents.length} messages and reset Redis window for ${sessionId}`);
          } catch (err) {
            console.warn('⚠️ Batch embedding failed, will keep Redis window intact:', err);
          }
        }
        await redis.del(key);
      }
      await redis.rpush(key, JSON.stringify(message));
    } catch (error) {
      console.error(`❌ Error adding recent message: ${error}`);
    }
  }

  async getRecentMessages(sessionId: string): Promise<any[]> {
    try {
      const key = `chat:recent:${sessionId}`;
      const items = await redis.lrange(key, 0, -1);
      return items.map((item) => {
        try { return JSON.parse(item); } catch { return null; }
      }).filter(Boolean) as any[];
    } catch (error) {
      console.error(`❌ Error getting recent messages: ${error}`);
      return [];
    }
  }

  async clearRecentMessages(sessionId: string) {
    try {
      const key = `chat:recent:${sessionId}`;
      await redis.del(key);
    } catch (error) {
      console.error(`❌ Error clearing recent messages: ${error}`);
    }
  }

  // ChromaDB: long-term memory - เหมือน Legacy
  async addLongTermMemory(sessionId: string, document: string, embedding: number[], metadata: any = {}) {
    try {
      await chromaService.addToCollection(`chat_memory_${sessionId}`, [document], [embedding], [metadata], [Date.now().toString()]);
    } catch (error) {
      console.error(`❌ Error adding to long-term memory: ${error}`);
    }
  }

  async searchLongTermMemory(sessionId: string, queryEmbedding: number[], k: number = 3) {
    try {
      return await chromaService.queryCollection(`chat_memory_${sessionId}`, [queryEmbedding], k);
    } catch (error) {
      console.error(`❌ Error searching long-term memory: ${error}`);
      return null;
    }
  }

  async clearLongTermMemory(sessionId: string) {
    try {
      await chromaService.deleteCollection(`chat_memory_${sessionId}`);
    } catch (error) {
      console.error(`❌ Error clearing long-term memory: ${error}`);
    }
  }

  // Embed message into long-term memory (vectorstore) - incremental + dedup by content hash
  async embedMessage(sessionId: string, message: string) {
    try {
      // Dedup id by content hash (base64 of content)
      const contentHash = Buffer.from(message).toString('base64');
      const collectionName = `chat_memory_${sessionId}`;

      // Skip if exists
      const exists = await chromaService.documentExists(collectionName, contentHash);
      if (exists) {
        console.log(`🔁 Skip embedding duplicate content for session ${sessionId}`);
        return;
      }

      // Generate embedding
      const embedding = await embeddingService.embed(message);
      if (embedding && embedding.length > 0) {
        await chromaService.addToCollection(collectionName, [message], [embedding], [{ 
          role: 'user',
          timestamp: new Date().toISOString(),
          sessionId 
        }], [contentHash]);
        console.log(`📚 Embedded message to long-term memory for session ${sessionId}`);
      } else {
        console.warn(`⚠️ Failed to get embedding for message in session ${sessionId}`);
      }
    } catch (error) {
      console.error(`❌ Error embedding message: ${error}`);
      // No fallback to mock embedding (to avoid vector noise)
    }
  }

  // Search memory (vectorstore) - แก้ไขให้ใช้ embedding service จริง
  async searchMemory(sessionId: string, query: string, k: number = 3): Promise<any[]> {
    try {
      // ใช้ embedding service จริงสำหรับ query
      const queryEmbedding = await embeddingService.embed(query);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn(`⚠️ Failed to get query embedding for session ${sessionId}`);
        return [];
      }
      
      const results = await this.searchLongTermMemory(sessionId, queryEmbedding, k);
      
      // ปรับปรุงการจัดการ response format
      if (!results) return [];
      
      // ตรวจสอบ format ของ results
      if (results.documents && Array.isArray(results.documents)) {
        const documents = results.documents.flat();
        const metadatas = results.metadatas?.flat() || [];
        
        return documents.map((doc: string | null, i: number) => ({
          content: doc || '',
          role: metadatas[i]?.role || 'user',
          timestamp: metadatas[i]?.timestamp || null
        }));
      } else if (Array.isArray(results)) {
        // ถ้า results เป็น array โดยตรง
        return results.map((r: { document: string | null; metadata: any }) => ({
          content: r.document ?? '',
          role: r.metadata?.role || 'user',
          timestamp: r.metadata?.timestamp || null
        }));
      }
      
      return [];
    } catch (error) {
      console.error(`❌ Error searching memory: ${error}`);
      return [];
    }
  }

  // Get all messages from long-term memory (vectorstore) - แก้ไขการจัดการ response
  async getAllMessages(sessionId: string): Promise<any[]> {
    try {
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

  // Hybrid memory management - windowed: use Redis as primary, embed in batches of 10
  async setupHybridMemory(sessionId: string, messages: any[]) {
    try {
      console.log(`🧠 Setting up hybrid memory for session ${sessionId}`);
      
      // Redis window is the primary store; just ensure the last up-to-10 messages are present
      const recentMessages = messages.slice(-10);
      await redis.del(`chat:recent:${sessionId}`);
      for (const msg of recentMessages) {
        await this.addRecentMessage(sessionId, msg);
      }
      console.log(`💾 Redis window refreshed with ${recentMessages.length} messages`);
      
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