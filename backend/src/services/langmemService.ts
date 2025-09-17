// Mock LangMem implementation for now - will be replaced when package is available
interface MockMemoryManager {
  processMessages: (messages: any[], options: any) => Promise<any>;
}

interface MockStoreManager {
  searchMemories: (query: string, options: any) => Promise<any>;
}

// Simple in-memory store implementation
class SimpleMemoryStore {
  private store: Map<string, any> = new Map();

  async put(namespace: string[], key: string, value: any): Promise<void> {
    const fullKey = [...namespace, key].join(':');
    this.store.set(fullKey, value);
  }

  async search(namespace: string[]): Promise<Array<{key: string, value: any}>> {
    const prefix = namespace.join(':');
    const results: Array<{key: string, value: any}> = [];

    for (const [key, value] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        results.push({ key: key.split(':').pop() || '', value });
      }
    }

    return results;
  }

  async delete(namespace: string[]): Promise<void> {
    const prefix = namespace.join(':');
    const keysToDelete: string[] = [];

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }
}

function createMemoryManager(config: any): MockMemoryManager {
  return {
    async processMessages(messages: any[], options: any) {
      return {
        memories: messages.map(msg => ({
          content: msg.content,
          relevance: 0.8,
          type: 'conversation'
        }))
      };
    }
  };
}

function createMemoryStoreManager(config: any): MockStoreManager {
  return {
    async searchMemories(query: string, options: any) {
      return {
        memories: []
      };
    }
  };
}
import { chromaService } from './chromaService';
import { embeddingService } from './embeddingService';

export interface LangMemConfig {
  maxMemories?: number;
  enableInserts?: boolean;
  enableUpdates?: boolean;
  enableDeletes?: boolean;
  namespace?: string[];
}

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'conversation' | 'fact' | 'preference' | 'context';
  namespace: string;
  metadata: {
    sessionId: string;
    userId?: string;
    timestamp: string;
    relevance?: number;
    source?: string;
  };
}

export interface ConversationContext {
  sessionId: string;
  userId?: string;
  agentId?: string;
  namespace: string;
}

export class LangMemService {
  private memoryStore: SimpleMemoryStore;
  private memoryManager: any;
  private storeManager: any;
  private initialized = false;

  constructor() {
    this.memoryStore = new SimpleMemoryStore();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🧠 Initializing LangMem service...');

      this.memoryManager = createMemoryManager({
        maxMemories: 10,
        enableInserts: true,
        enableUpdates: true,
        enableDeletes: true
      });

      this.storeManager = createMemoryStoreManager({
        store: this.memoryStore,
        namespace: ['memories'],
        maxMemories: 15,
        enableInserts: true,
        enableUpdates: true,
        enableDeletes: true
      });

      this.initialized = true;
      console.log('✅ LangMem service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LangMem service:', error);
      throw error;
    }
  }

  async processMessages(
    messages: Array<{ role: string; content: string; timestamp?: string }>,
    context: ConversationContext,
    config?: LangMemConfig
  ): Promise<MemoryEntry[]> {
    await this.initialize();

    try {
      console.log(`🧠 Processing ${messages.length} messages for context ${context.namespace}`);

      const processedMemories: MemoryEntry[] = [];
      const namespace = this.buildNamespace(context);

      for (const message of messages) {
        if (message.role === 'user' && message.content.trim()) {
          const memoryData = await this.memoryManager.processMessages([
            { role: message.role, content: message.content }
          ], {
            existingMemories: await this.getExistingMemories(namespace),
            maxMemories: config?.maxMemories || 10
          });

          if (memoryData && memoryData.memories) {
            for (const memory of memoryData.memories) {
              const memoryEntry: MemoryEntry = {
                id: this.generateMemoryId(),
                content: memory.content || memory.text || message.content,
                type: this.classifyMemoryType(memory),
                namespace: namespace.join('.'),
                metadata: {
                  sessionId: context.sessionId,
                  userId: context.userId,
                  timestamp: message.timestamp || new Date().toISOString(),
                  relevance: memory.relevance || 0.8,
                  source: 'conversation'
                }
              };

              await this.storeMemory(memoryEntry, namespace);
              processedMemories.push(memoryEntry);
            }
          }
        }
      }

      console.log(`💾 Processed ${processedMemories.length} memory entries`);
      return processedMemories;

    } catch (error) {
      console.error('❌ Error processing messages:', error);
      return [];
    }
  }

  async searchMemories(
    query: string,
    context: ConversationContext,
    options?: {
      limit?: number;
      type?: string;
      minRelevance?: number;
    }
  ): Promise<MemoryEntry[]> {
    await this.initialize();

    try {
      const namespace = this.buildNamespace(context);
      const limit = options?.limit || 5;

      console.log(`🔍 Searching memories for query: "${query}" in namespace: ${namespace.join('.')}`);

      const searchResults = await this.storeManager.searchMemories(query, {
        namespace,
        maxMemories: limit
      });

      const memories: MemoryEntry[] = [];

      if (searchResults && searchResults.memories) {
        for (const result of searchResults.memories) {
          if (result.content && (!options?.minRelevance || result.relevance >= options.minRelevance)) {
            memories.push({
              id: result.id || this.generateMemoryId(),
              content: result.content,
              type: result.type || 'conversation',
              namespace: namespace.join('.'),
              metadata: {
                sessionId: context.sessionId,
                userId: context.userId,
                timestamp: result.timestamp || new Date().toISOString(),
                relevance: result.relevance || 0.5,
                source: 'memory_search'
              }
            });
          }
        }
      }

      console.log(`📚 Found ${memories.length} relevant memories`);
      return memories.sort((a, b) => (b.metadata.relevance || 0) - (a.metadata.relevance || 0));

    } catch (error) {
      console.error('❌ Error searching memories:', error);
      return [];
    }
  }

  async addMemory(
    content: string,
    context: ConversationContext,
    options?: {
      type?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<MemoryEntry> {
    await this.initialize();

    const namespace = this.buildNamespace(context);
    const memoryEntry: MemoryEntry = {
      id: this.generateMemoryId(),
      content,
      type: (options?.type as any) || 'fact',
      namespace: namespace.join('.'),
      metadata: {
        sessionId: context.sessionId,
        userId: context.userId,
        timestamp: new Date().toISOString(),
        relevance: 1.0,
        source: 'manual',
        ...options?.metadata
      }
    };

    await this.storeMemory(memoryEntry, namespace);
    console.log(`💾 Added memory: ${content.substring(0, 50)}...`);

    return memoryEntry;
  }

  async getContextualMemories(
    context: ConversationContext,
    options?: {
      limit?: number;
      includeTypes?: string[];
    }
  ): Promise<MemoryEntry[]> {
    await this.initialize();

    try {
      const namespace = this.buildNamespace(context);
      const limit = options?.limit || 10;

      console.log(`📖 Retrieving contextual memories for namespace: ${namespace.join('.')}`);

      const allMemories = await this.getAllMemoriesFromStore(namespace);

      let filteredMemories = allMemories;
      if (options?.includeTypes) {
        filteredMemories = allMemories.filter(memory =>
          options.includeTypes!.includes(memory.type)
        );
      }

      const sortedMemories = filteredMemories
        .sort((a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime())
        .slice(0, limit);

      console.log(`📚 Retrieved ${sortedMemories.length} contextual memories`);
      return sortedMemories;

    } catch (error) {
      console.error('❌ Error getting contextual memories:', error);
      return [];
    }
  }

  async clearMemories(context: ConversationContext): Promise<void> {
    await this.initialize();

    try {
      const namespace = this.buildNamespace(context);
      console.log(`🧹 Clearing memories for namespace: ${namespace.join('.')}`);

      await this.memoryStore.delete(namespace);
      console.log(`✅ Cleared all memories for session ${context.sessionId}`);

    } catch (error) {
      console.error('❌ Error clearing memories:', error);
    }
  }

  async getMemoryStats(context: ConversationContext): Promise<{
    totalMemories: number;
    typeBreakdown: Record<string, number>;
    oldestMemory?: string;
    newestMemory?: string;
    namespaceInfo: string;
  }> {
    await this.initialize();

    try {
      const namespace = this.buildNamespace(context);
      const allMemories = await this.getAllMemoriesFromStore(namespace);

      const typeBreakdown: Record<string, number> = {};
      let oldestTimestamp = new Date().toISOString();
      let newestTimestamp = new Date(0).toISOString();

      for (const memory of allMemories) {
        typeBreakdown[memory.type] = (typeBreakdown[memory.type] || 0) + 1;

        if (memory.metadata.timestamp < oldestTimestamp) {
          oldestTimestamp = memory.metadata.timestamp;
        }
        if (memory.metadata.timestamp > newestTimestamp) {
          newestTimestamp = memory.metadata.timestamp;
        }
      }

      return {
        totalMemories: allMemories.length,
        typeBreakdown,
        oldestMemory: allMemories.length > 0 ? oldestTimestamp : undefined,
        newestMemory: allMemories.length > 0 ? newestTimestamp : undefined,
        namespaceInfo: namespace.join('.')
      };

    } catch (error) {
      console.error('❌ Error getting memory stats:', error);
      return {
        totalMemories: 0,
        typeBreakdown: {},
        namespaceInfo: 'error'
      };
    }
  }

  private buildNamespace(context: ConversationContext): string[] {
    const namespace = ['memories'];

    if (context.userId) {
      namespace.push('user', context.userId);
    }

    if (context.agentId) {
      namespace.push('agent', context.agentId);
    }

    namespace.push('session', context.sessionId);

    return namespace;
  }

  private async storeMemory(memory: MemoryEntry, namespace: string[]): Promise<void> {
    try {
      await this.memoryStore.put(namespace, memory.id, {
        content: memory.content,
        type: memory.type,
        metadata: memory.metadata
      });
    } catch (error) {
      console.error('❌ Error storing memory:', error);
      throw error;
    }
  }

  private async getExistingMemories(namespace: string[]): Promise<any[]> {
    try {
      const memories = await this.getAllMemoriesFromStore(namespace);
      return memories.map(memory => ({
        content: memory.content,
        type: memory.type,
        relevance: memory.metadata.relevance || 0.5
      }));
    } catch (error) {
      console.error('❌ Error getting existing memories:', error);
      return [];
    }
  }

  private async getAllMemoriesFromStore(namespace: string[]): Promise<MemoryEntry[]> {
    try {
      const items = await this.memoryStore.search(namespace);
      const memories: MemoryEntry[] = [];

      for (const item of items) {
        if (item.value && typeof item.value === 'object') {
          const value = item.value as any;
          memories.push({
            id: item.key,
            content: value.content || '',
            type: value.type || 'conversation',
            namespace: namespace.join('.'),
            metadata: value.metadata || {
              sessionId: '',
              timestamp: new Date().toISOString(),
              relevance: 0.5
            }
          });
        }
      }

      return memories;
    } catch (error) {
      console.error('❌ Error getting all memories from store:', error);
      return [];
    }
  }

  private classifyMemoryType(memory: any): MemoryEntry['type'] {
    if (!memory.content && !memory.text) return 'conversation';

    const content = (memory.content || memory.text || '').toLowerCase();

    if (content.includes('prefer') || content.includes('like') || content.includes('dislike')) {
      return 'preference';
    }

    if (content.includes('fact') || content.includes('information') || content.includes('data')) {
      return 'fact';
    }

    if (content.includes('context') || content.includes('situation') || content.includes('background')) {
      return 'context';
    }

    return 'conversation';
  }

  private generateMemoryId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Legacy compatibility methods
  async addRecentMessage(sessionId: string, message: any): Promise<void> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    await this.processMessages([message], context);
  }

  async getRecentMessages(sessionId: string): Promise<any[]> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    const memories = await this.getContextualMemories(context, { limit: 10 });

    return memories.map(memory => ({
      role: 'assistant',
      content: memory.content,
      timestamp: memory.metadata.timestamp
    }));
  }

  async searchMemory(sessionId: string, query: string, k: number = 3): Promise<any[]> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    const memories = await this.searchMemories(query, context, { limit: k });

    return memories.map(memory => ({
      content: memory.content,
      role: 'assistant',
      timestamp: memory.metadata.timestamp,
      relevanceScore: memory.metadata.relevance || 0.5
    }));
  }

  async embedMessage(sessionId: string, message: string): Promise<void> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    await this.addMemory(message, context, { type: 'conversation' });
  }

  async clearRecentMessages(sessionId: string): Promise<void> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    await this.clearMemories(context);
  }

  async clearAllMemory(sessionId: string): Promise<void> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    await this.clearMemories(context);
  }

  async getAllMessages(sessionId: string): Promise<any[]> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    const memories = await this.getContextualMemories(context, { limit: 100 });

    return memories.map(memory => ({
      content: memory.content,
      role: 'assistant',
      timestamp: memory.metadata.timestamp
    }));
  }

  async clearLongTermMemory(sessionId: string): Promise<void> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    await this.clearMemories(context);
  }

  async getConversationContext(sessionId: string, query?: string): Promise<any[]> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };

    if (query) {
      const memories = await this.searchMemories(query, context, { limit: 10 });
      return memories.map(memory => ({
        role: memory.type === 'conversation' ? 'assistant' : 'system',
        content: memory.content,
        timestamp: memory.metadata.timestamp
      }));
    } else {
      const memories = await this.getContextualMemories(context, { limit: 20 });
      return memories.map(memory => ({
        role: memory.type === 'conversation' ? 'assistant' : 'system',
        content: memory.content,
        timestamp: memory.metadata.timestamp
      }));
    }
  }

  async addMessage(sessionId: string, message: any): Promise<void> {
    const context: ConversationContext = { sessionId, namespace: 'legacy' };
    await this.addMemory(message.content, context, {
      type: 'conversation',
      metadata: {
        role: message.role,
        timestamp: message.timestamp || new Date().toISOString()
      }
    });
  }
}

export const langmemService = new LangMemService();