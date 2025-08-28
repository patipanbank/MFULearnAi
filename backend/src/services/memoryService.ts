import { chromaService } from './chromaService';
import { embeddingService } from './embeddingService';
import { redis } from '../lib/redis';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Modern Memory Service with intelligent conversation management
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface MemorySearchResult {
  content: string;
  role: string;
  timestamp: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

export interface ConversationSummary {
  sessionId: string;
  summary: string;
  messageCount: number;
  lastUpdated: string;
  keyTopics: string[];
}

export class MemoryService {
  private bedrock: BedrockRuntimeClient;
  private readonly BUFFER_WINDOW_SIZE = 20; // Increased buffer
  private readonly TOKEN_LIMIT = 4000; // Context window limit
  private readonly SUMMARY_THRESHOLD = 30; // Messages before summarization
  private readonly MIN_RELEVANCE_SCORE = 0.7;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  // ===== MAIN API METHODS =====

  /**
   * Add message with intelligent management
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    try {
      // 1. Add to buffer
      await this.addToBuffer(sessionId, message);
      
      // 2. Check if we need summarization
      const bufferSize = await this.getBufferSize(sessionId);
      if (bufferSize >= this.SUMMARY_THRESHOLD) {
        await this.performSummarization(sessionId);
      }
      
      // 3. Add to vector store for semantic search
      await this.addToVectorStore(sessionId, message);
      
    } catch (error) {
      console.error(`❌ Error adding message: ${error}`);
      throw error;
    }
  }

  /**
   * Get conversation context with smart retrieval
   */
  async getConversationContext(sessionId: string, query?: string): Promise<ConversationMessage[]> {
    try {
      // 1. Get recent buffer messages
      const recentMessages = await this.getBufferMessages(sessionId);
      
      // 2. Get conversation summary if exists
      const summary = await this.getConversationSummary(sessionId);
      
      // 3. If query provided, get relevant messages
      let relevantMessages: ConversationMessage[] = [];
      if (query) {
        const searchResults = await this.semanticSearch(sessionId, query, 5);
        relevantMessages = searchResults.map(result => ({
          role: result.role as 'user' | 'assistant',
          content: result.content,
          timestamp: result.timestamp,
          metadata: { ...result.metadata, relevanceScore: result.relevanceScore }
        }));
      }
      
      // 4. Combine and optimize
      return this.combineMessages(recentMessages, relevantMessages, summary);
      
    } catch (error) {
      console.error(`❌ Error getting conversation context: ${error}`);
      return [];
    }
  }

  /**
   * Legacy compatibility - add recent message
   */
  async addRecentMessage(sessionId: string, message: any) {
    const msg: ConversationMessage = {
      role: message.role || 'user',
      content: message.content || '',
      timestamp: message.timestamp || new Date().toISOString(),
      metadata: message.metadata
    };
    await this.addMessage(sessionId, msg);
  }

  /**
   * Legacy compatibility - get recent messages
   */
  async getRecentMessages(sessionId: string): Promise<any[]> {
    const messages = await this.getBufferMessages(sessionId);
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      ...msg.metadata
    }));
  }

  /**
   * Search memory with semantic understanding
   */
  async searchMemory(sessionId: string, query: string, k: number = 3): Promise<any[]> {
    try {
      const results = await this.semanticSearch(sessionId, query, k);
      return results.map(result => ({
        content: result.content,
        role: result.role,
        timestamp: result.timestamp,
        relevanceScore: result.relevanceScore
      }));
    } catch (error) {
      console.error(`❌ Error searching memory: ${error}`);
      return [];
    }
  }

  // ===== BUFFER MANAGEMENT =====

  private async addToBuffer(sessionId: string, message: ConversationMessage): Promise<void> {
    const key = `memory:buffer:${sessionId}`;
    const messageStr = JSON.stringify(message);
    
    await redis.lpush(key, messageStr);
    await redis.ltrim(key, 0, this.BUFFER_WINDOW_SIZE - 1);
    await redis.expire(key, 86400); // 24 hours
  }

  private async getBufferMessages(sessionId: string): Promise<ConversationMessage[]> {
    const key = `memory:buffer:${sessionId}`;
    const items = await redis.lrange(key, 0, -1);
    
    return items.map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean).reverse(); // Chronological order
  }

  private async getBufferSize(sessionId: string): Promise<number> {
    const key = `memory:buffer:${sessionId}`;
    return await redis.llen(key);
  }

  private async clearBuffer(sessionId: string): Promise<void> {
    const key = `memory:buffer:${sessionId}`;
    await redis.del(key);
  }

  // ===== SUMMARIZATION =====

  private async performSummarization(sessionId: string): Promise<void> {
    try {
      const messages = await this.getBufferMessages(sessionId);
      if (messages.length < 15) return;
      
      // Keep recent 10, summarize older ones
      const messagesToSummarize = messages.slice(0, -10);
      const remainingMessages = messages.slice(-10);
      
      // Generate summary
      const newSummary = await this.generateSummary(sessionId, messagesToSummarize);
      
      // Update summary
      await this.updateSummary(sessionId, newSummary);
      
      // Reset buffer
      await this.clearBuffer(sessionId);
      for (const msg of remainingMessages) {
        await this.addToBuffer(sessionId, msg);
      }
      
      console.log(`🧠 Summarized ${messagesToSummarize.length} messages for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error in summarization: ${error}`);
    }
  }

  private async generateSummary(sessionId: string, messages: ConversationMessage[]): Promise<ConversationSummary> {
    try {
      const conversationText = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      
      const prompt = `Summarize this conversation focusing on key points, decisions, and context needed for continuation:\n\n${conversationText}\n\nProvide a concise summary:`;

      const command = new InvokeModelCommand({
        modelId: 'amazon.titan-text-express-v1',
        body: JSON.stringify({
          inputText: prompt,
          textGenerationConfig: {
            maxTokenCount: 500,
            temperature: 0.3,
            topP: 0.9
          }
        }),
        contentType: 'application/json'
      });

      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const summary = responseBody.results[0].outputText.trim();
      
      // Extract key topics
      const keyTopics = this.extractKeyTopics(conversationText);
      
      return {
        sessionId,
        summary,
        messageCount: messages.length,
        lastUpdated: new Date().toISOString(),
        keyTopics
      };
      
    } catch (error) {
      console.error(`❌ Error generating summary: ${error}`);
      return {
        sessionId,
        summary: `Conversation summary (${messages.length} messages)`,
        messageCount: messages.length,
        lastUpdated: new Date().toISOString(),
        keyTopics: []
      };
    }
  }

  private extractKeyTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can']);
    
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  // ===== SUMMARY MANAGEMENT =====

  private async updateSummary(sessionId: string, summary: ConversationSummary): Promise<void> {
    const key = `memory:summary:${sessionId}`;
    await redis.set(key, JSON.stringify(summary), { EX: 604800 }); // 7 days
  }

  private async getConversationSummary(sessionId: string): Promise<ConversationSummary | null> {
    const key = `memory:summary:${sessionId}`;
    const summaryStr = await redis.get(key);
    
    if (!summaryStr) return null;
    
    try {
      return JSON.parse(summaryStr);
    } catch {
      return null;
    }
  }

  // ===== VECTOR STORE OPERATIONS =====

  private async addToVectorStore(sessionId: string, message: ConversationMessage): Promise<void> {
    try {
      const contentHash = Buffer.from(message.content + message.timestamp).toString('base64');
      const collectionName = `memory_${sessionId}`;
      
      // Check if exists
      const exists = await chromaService.documentExists(collectionName, contentHash);
      if (exists) return;
      
      // Generate embedding
      const embedding = await embeddingService.embed(message.content);
      if (!embedding || embedding.length === 0) return;
      
      // Add to ChromaDB
      await chromaService.addToCollection(
        collectionName,
        [message.content],
        [embedding],
        [{
          role: message.role,
          timestamp: message.timestamp,
          sessionId,
          ...message.metadata
        }],
        [contentHash]
      );
      
    } catch (error) {
      console.error(`❌ Error adding to vector store: ${error}`);
    }
  }

  private async semanticSearch(sessionId: string, query: string, k: number = 5): Promise<MemorySearchResult[]> {
    try {
      const queryEmbedding = await embeddingService.embed(query);
      if (!queryEmbedding || queryEmbedding.length === 0) return [];
      
      const results = await chromaService.queryCollection(`memory_${sessionId}`, [queryEmbedding], k);
      if (!results) return [];
      
      const processedResults: MemorySearchResult[] = [];
      
      if (results.documents && results.distances && results.metadatas) {
        const documents = results.documents.flat();
        const distances = results.distances.flat();
        const metadatas = results.metadatas.flat();
        
        for (let i = 0; i < documents.length; i++) {
          const relevanceScore = Math.max(0, 1 - (distances[i] || 1));
          
          if (relevanceScore >= this.MIN_RELEVANCE_SCORE) {
            processedResults.push({
              content: documents[i] || '',
              role: metadatas[i]?.role || 'user',
              timestamp: metadatas[i]?.timestamp || '',
              relevanceScore,
              metadata: metadatas[i]
            });
          }
        }
      }
      
      return processedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
    } catch (error) {
      console.error(`❌ Error in semantic search: ${error}`);
      return [];
    }
  }

  // ===== UTILITY METHODS =====

  private combineMessages(
    recentMessages: ConversationMessage[],
    relevantMessages: ConversationMessage[],
    summary: ConversationSummary | null
  ): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    
    // Add summary as context
    if (summary) {
      messages.push({
        role: 'system',
        content: `Previous conversation: ${summary.summary}`,
        timestamp: summary.lastUpdated,
        metadata: { type: 'summary', keyTopics: summary.keyTopics }
      });
    }
    
    // Deduplicate and combine
    const seen = new Set<string>();
    const allMessages = [...relevantMessages, ...recentMessages];
    
    for (const msg of allMessages) {
      const key = `${msg.content}_${msg.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        messages.push(msg);
      }
    }
    
    // Sort by timestamp and apply token limit
    const sorted = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return this.trimToTokenLimit(sorted);
  }

  private trimToTokenLimit(messages: ConversationMessage[]): ConversationMessage[] {
    let totalTokens = 0;
    const result: ConversationMessage[] = [];
    
    // Process from most recent backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const estimatedTokens = Math.ceil(msg.content.length / 4);
      
      if (totalTokens + estimatedTokens <= this.TOKEN_LIMIT) {
        result.unshift(msg);
        totalTokens += estimatedTokens;
      } else if (msg.role === 'system') {
        // Always keep system messages (summaries)
        result.unshift(msg);
      } else {
        break;
      }
    }
    
    return result;
  }

  // ===== LEGACY COMPATIBILITY =====

  async embedMessage(sessionId: string, message: string) {
    const msg: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    await this.addMessage(sessionId, msg);
  }

  async getAllMessages(sessionId: string): Promise<any[]> {
    try {
      const results = await chromaService.getAllFromCollection(`memory_${sessionId}`);
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

  async setupHybridMemory(sessionId: string, messages: any[]) {
    try {
      console.log(`🧠 Setting up memory for session ${sessionId}`);
      
      const recentMessages = messages.slice(-this.BUFFER_WINDOW_SIZE);
      await this.clearBuffer(sessionId);
      
      for (const msg of recentMessages) {
        const message: ConversationMessage = {
          role: msg.role || 'user',
          content: msg.content || '',
          timestamp: msg.timestamp || new Date().toISOString(),
          metadata: msg.metadata
        };
        await this.addToBuffer(sessionId, message);
      }
      
      console.log(`💾 Memory initialized with ${recentMessages.length} messages`);
    } catch (error) {
      console.error(`❌ Error setting up memory: ${error}`);
    }
  }

  async getMemoryStats(sessionId: string): Promise<any> {
    try {
      const bufferSize = await this.getBufferSize(sessionId);
      const summary = await this.getConversationSummary(sessionId);
      
      let vectorStoreCount = 0;
      try {
        const allMessages = await chromaService.getAllFromCollection(`memory_${sessionId}`);
        vectorStoreCount = Array.isArray(allMessages) ? allMessages.length : 0;
      } catch {
        vectorStoreCount = 0;
      }
      
      return {
        sessionId,
        bufferSize,
        vectorStoreCount,
        hasSummary: !!summary,
        summaryMessageCount: summary?.messageCount || 0,
        keyTopics: summary?.keyTopics || [],
        lastSummaryUpdate: summary?.lastUpdated || null,
        memoryType: 'intelligent_hybrid'
      };
    } catch (error) {
      console.error(`❌ Error getting memory stats: ${error}`);
      return { error: 'Memory stats unavailable' };
    }
  }

  async clearRecentMessages(sessionId: string) {
    await this.clearBuffer(sessionId);
  }

  async clearLongTermMemory(sessionId: string) {
    try {
      await chromaService.deleteCollection(`memory_${sessionId}`);
    } catch (error) {
      console.error(`❌ Error clearing long-term memory: ${error}`);
    }
  }

  async clearAllMemory(sessionId: string) {
    try {
      await this.clearBuffer(sessionId);
      await redis.del(`memory:summary:${sessionId}`);
      await chromaService.deleteCollection(`memory_${sessionId}`);
      console.log(`🧹 Cleared all memory for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error clearing memory: ${error}`);
    }
  }

  // Development/testing methods
  async forceSummarization(sessionId: string): Promise<ConversationSummary | null> {
    try {
      await this.performSummarization(sessionId);
      return await this.getConversationSummary(sessionId);
    } catch (error) {
      console.error(`❌ Error in force summarization: ${error}`);
      return null;
    }
  }
}

export const memoryService = new MemoryService(); 