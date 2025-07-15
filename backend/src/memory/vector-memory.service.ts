import { Injectable, Logger } from '@nestjs/common';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { BedrockEmbeddings } from '@langchain/aws';
import { Document } from '@langchain/core/documents';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class VectorMemoryService {
  private readonly logger = new Logger(VectorMemoryService.name);
  private vectorStores: Map<string, Chroma> = new Map();
  private embeddings: BedrockEmbeddings | null = null;

  constructor() {
    this.initializeEmbeddings();
  }

  /**
   * Lazy initialization of embeddings (เหมือน FastAPI)
   */
  private async initializeEmbeddings(): Promise<BedrockEmbeddings> {
    if (!this.embeddings) {
      try {
        this.embeddings = new BedrockEmbeddings({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
          model: 'amazon.titan-embed-text-v1',
        });
        this.logger.log('🧠 Initialized Bedrock embeddings');
      } catch (error) {
        this.logger.error('❌ Failed to initialize embeddings:', error);
        throw error;
      }
    }
    return this.embeddings;
  }

  /**
   * Add chat messages to memory with embeddings (avoid duplicates)
   * เหมือน FastAPI add_chat_memory ทุกอย่าง
   */
  async addChatMemory(sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      // Get existing message IDs to avoid duplicates (เหมือน FastAPI)
      const existingIds = new Set<string>();
      if (this.vectorStores.has(sessionId)) {
        try {
          const vectorStore = this.vectorStores.get(sessionId)!;
          const existingDocs = await vectorStore.similaritySearch('', 9999); // Get all docs
          existingDocs.forEach(doc => {
            const messageId = doc.metadata?.message_id;
            if (messageId) {
              existingIds.add(messageId);
            }
          });
        } catch (error) {
          this.logger.warn('⚠️ Could not check existing messages:', error);
        }
      }

      // Create documents from new messages only (เหมือน FastAPI)
      const documents: Document[] = [];
      let newMessageCount = 0;

      for (const msg of messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          const content = msg.content?.trim();
          const messageId = msg.id;

          // Skip if message already exists (เหมือน FastAPI)
          if (existingIds.has(messageId)) {
            continue;
          }

          if (content) {
            // Create document with metadata (เหมือน FastAPI)
            const doc = new Document({
              pageContent: content,
              metadata: {
                session_id: sessionId,
                role: msg.role,
                timestamp: msg.timestamp || new Date().toISOString(),
                message_id: messageId,
              },
            });
            documents.push(doc);
            newMessageCount++;
          }
        }
      }

      if (documents.length > 0) {
        const embeddings = await this.initializeEmbeddings();
        
        if (this.vectorStores.has(sessionId)) {
          // Add only new documents to existing vector store (เหมือน FastAPI)
          const vectorStore = this.vectorStores.get(sessionId)!;
          await vectorStore.addDocuments(documents);
          this.logger.log(`📚 Added ${newMessageCount} new messages to existing memory for session ${sessionId}`);
        } else {
          // Create new vector store (เหมือน FastAPI)
          const vectorStore = await Chroma.fromDocuments(documents, embeddings, {
            collectionName: `chat_memory_${sessionId}`,
          });
          this.vectorStores.set(sessionId, vectorStore);
          this.logger.log(`📚 Created new memory with ${newMessageCount} messages for session ${sessionId}`);
        }
      } else {
        this.logger.log(`📚 No new messages to add for session ${sessionId}`);
      }

    } catch (error) {
      this.logger.error(`❌ Error adding chat memory: ${error}`);
      throw error;
    }
  }

  /**
   * Search through chat memory for relevant context (เหมือน FastAPI)
   */
  async searchChatMemory(sessionId: string, query: string, k: number = 5): Promise<ChatMessage[]> {
    try {
      if (!this.vectorStores.has(sessionId)) {
        return [];
      }

      const vectorStore = this.vectorStores.get(sessionId)!;
      const docs = await vectorStore.similaritySearch(query, k);

      // Format results (เหมือน FastAPI)
      const results: ChatMessage[] = [];
      for (const doc of docs) {
        results.push({
          id: doc.metadata?.message_id || '',
          role: doc.metadata?.role || 'assistant',
          content: doc.pageContent,
          timestamp: doc.metadata?.timestamp || new Date().toISOString(),
          metadata: {
            relevance_score: doc.metadata?.score || 0.0,
          },
        });
      }

      return results;

    } catch (error) {
      this.logger.error(`❌ Error searching chat memory: ${error}`);
      return [];
    }
  }

  /**
   * Get recent messages from memory (excluding the last 10 which are in Redis)
   * เหมือน FastAPI get_recent_messages
   */
  async getRecentMessages(sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    try {
      if (!this.vectorStores.has(sessionId)) {
        return [];
      }

      const vectorStore = this.vectorStores.get(sessionId)!;
      const docs = await vectorStore.similaritySearch('', 9999); // Get all docs

      // Combine documents with metadata (เหมือน FastAPI)
      const messages: ChatMessage[] = [];
      for (const doc of docs) {
        messages.push({
          id: doc.metadata?.message_id || '',
          role: doc.metadata?.role || 'assistant',
          content: doc.pageContent,
          timestamp: doc.metadata?.timestamp || new Date().toISOString(),
        });
      }

      // Sort by timestamp (oldest first) and return recent ones (เหมือน FastAPI)
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return messages.length > limit ? messages.slice(-limit) : messages;

    } catch (error) {
      this.logger.error(`❌ Error getting recent messages: ${error}`);
      return [];
    }
  }

  /**
   * Get all messages from memory (useful when Redis memory is expired)
   * เหมือน FastAPI get_all_messages
   */
  async getAllMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
      if (!this.vectorStores.has(sessionId)) {
        return [];
      }

      const vectorStore = this.vectorStores.get(sessionId)!;
      const docs = await vectorStore.similaritySearch('', 9999); // Get all docs

      // Combine documents with metadata (เหมือน FastAPI)
      const messages: ChatMessage[] = [];
      for (const doc of docs) {
        messages.push({
          id: doc.metadata?.message_id || '',
          role: doc.metadata?.role || 'assistant',
          content: doc.pageContent,
          timestamp: doc.metadata?.timestamp || new Date().toISOString(),
        });
      }

      // Sort by timestamp (oldest first) (เหมือน FastAPI)
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return messages;

    } catch (error) {
      this.logger.error(`❌ Error getting all messages: ${error}`);
      return [];
    }
  }

  /**
   * Clear chat memory for a specific session (เหมือน FastAPI)
   */
  async clearChatMemory(sessionId: string): Promise<void> {
    try {
      if (this.vectorStores.has(sessionId)) {
        const vectorStore = this.vectorStores.get(sessionId)!;
        // Note: Chroma doesn't have deleteCollection in JS, so we'll clear the map
        this.vectorStores.delete(sessionId);
        this.logger.log(`🧹 Cleared chat memory for session ${sessionId}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error clearing chat memory: ${error}`);
    }
  }

  /**
   * Get statistics about memory usage (เหมือน FastAPI)
   */
  async getMemoryStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    sessions: Record<string, any>;
  }> {
    const stats = {
      totalSessions: this.vectorStores.size,
      totalMessages: 0,
      sessions: {} as Record<string, any>,
    };

    for (const [sessionId, vectorStore] of this.vectorStores.entries()) {
      try {
        const docs = await vectorStore.similaritySearch('', 9999);
        const count = docs.length;
        stats.totalMessages += count;

        // Get message distribution by role (เหมือน FastAPI)
        const roleDistribution = { user: 0, assistant: 0 };
        docs.forEach(doc => {
          const role = doc.metadata?.role;
          if (role === 'user' || role === 'assistant') {
            roleDistribution[role]++;
          }
        });

        stats.sessions[sessionId] = {
          messageCount: count,
          roleDistribution,
        };
      } catch (error) {
        this.logger.warn(`⚠️ Error getting stats for session ${sessionId}: ${error}`);
        stats.sessions[sessionId] = {
          messageCount: 0,
          roleDistribution: { user: 0, assistant: 0 },
        };
      }
    }

    return stats;
  }

  /**
   * Check if memory should be used (equivalent to FastAPI _should_use_memory_tool)
   */
  shouldUseMemoryTool(messageCount: number): boolean {
    return messageCount > 50; // เหมือน FastAPI
  }

  /**
   * Check if messages should be embedded (equivalent to FastAPI _should_embed_messages)
   */
  shouldEmbedMessages(messageCount: number): boolean {
    return messageCount % 10 === 0 && messageCount > 0; // ทุก 10 messages เหมือน FastAPI
  }
} 