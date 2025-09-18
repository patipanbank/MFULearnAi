"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.langmemService = exports.LangMemService = void 0;
class SimpleMemoryStore {
    constructor() {
        this.store = new Map();
    }
    async put(namespace, key, value) {
        const fullKey = [...namespace, key].join(':');
        this.store.set(fullKey, value);
    }
    async search(namespace) {
        const prefix = namespace.join(':');
        const results = [];
        for (const [key, value] of this.store.entries()) {
            if (key.startsWith(prefix)) {
                results.push({ key: key.split(':').pop() || '', value });
            }
        }
        return results;
    }
    async delete(namespace) {
        const prefix = namespace.join(':');
        const keysToDelete = [];
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
function createMemoryManager(config) {
    return {
        async processMessages(messages, options) {
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
function createMemoryStoreManager(config) {
    return {
        async searchMemories(query, options) {
            return {
                memories: []
            };
        }
    };
}
class LangMemService {
    constructor() {
        this.initialized = false;
        this.memoryStore = new SimpleMemoryStore();
    }
    async initialize() {
        if (this.initialized)
            return;
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
        }
        catch (error) {
            console.error('❌ Failed to initialize LangMem service:', error);
            throw error;
        }
    }
    async processMessages(messages, context, config) {
        await this.initialize();
        try {
            console.log(`🧠 Processing ${messages.length} messages for context ${context.namespace}`);
            const processedMemories = [];
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
                            const memoryEntry = {
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
        }
        catch (error) {
            console.error('❌ Error processing messages:', error);
            return [];
        }
    }
    async searchMemories(query, context, options) {
        await this.initialize();
        try {
            const namespace = this.buildNamespace(context);
            const limit = options?.limit || 5;
            console.log(`🔍 Searching memories for query: "${query}" in namespace: ${namespace.join('.')}`);
            const searchResults = await this.storeManager.searchMemories(query, {
                namespace,
                maxMemories: limit
            });
            const memories = [];
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
        }
        catch (error) {
            console.error('❌ Error searching memories:', error);
            return [];
        }
    }
    async addMemory(content, context, options) {
        await this.initialize();
        const namespace = this.buildNamespace(context);
        const memoryEntry = {
            id: this.generateMemoryId(),
            content,
            type: options?.type || 'fact',
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
    async getContextualMemories(context, options) {
        await this.initialize();
        try {
            const namespace = this.buildNamespace(context);
            const limit = options?.limit || 10;
            console.log(`📖 Retrieving contextual memories for namespace: ${namespace.join('.')}`);
            const allMemories = await this.getAllMemoriesFromStore(namespace);
            let filteredMemories = allMemories;
            if (options?.includeTypes) {
                filteredMemories = allMemories.filter(memory => options.includeTypes.includes(memory.type));
            }
            const sortedMemories = filteredMemories
                .sort((a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime())
                .slice(0, limit);
            console.log(`📚 Retrieved ${sortedMemories.length} contextual memories`);
            return sortedMemories;
        }
        catch (error) {
            console.error('❌ Error getting contextual memories:', error);
            return [];
        }
    }
    async clearMemories(context) {
        await this.initialize();
        try {
            const namespace = this.buildNamespace(context);
            console.log(`🧹 Clearing memories for namespace: ${namespace.join('.')}`);
            await this.memoryStore.delete(namespace);
            console.log(`✅ Cleared all memories for session ${context.sessionId}`);
        }
        catch (error) {
            console.error('❌ Error clearing memories:', error);
        }
    }
    async getMemoryStats(context) {
        await this.initialize();
        try {
            const namespace = this.buildNamespace(context);
            const allMemories = await this.getAllMemoriesFromStore(namespace);
            const typeBreakdown = {};
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
        }
        catch (error) {
            console.error('❌ Error getting memory stats:', error);
            return {
                totalMemories: 0,
                typeBreakdown: {},
                namespaceInfo: 'error'
            };
        }
    }
    buildNamespace(context) {
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
    async storeMemory(memory, namespace) {
        try {
            await this.memoryStore.put(namespace, memory.id, {
                content: memory.content,
                type: memory.type,
                metadata: memory.metadata
            });
        }
        catch (error) {
            console.error('❌ Error storing memory:', error);
            throw error;
        }
    }
    async getExistingMemories(namespace) {
        try {
            const memories = await this.getAllMemoriesFromStore(namespace);
            return memories.map(memory => ({
                content: memory.content,
                type: memory.type,
                relevance: memory.metadata.relevance || 0.5
            }));
        }
        catch (error) {
            console.error('❌ Error getting existing memories:', error);
            return [];
        }
    }
    async getAllMemoriesFromStore(namespace) {
        try {
            const items = await this.memoryStore.search(namespace);
            const memories = [];
            for (const item of items) {
                if (item.value && typeof item.value === 'object') {
                    const value = item.value;
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
        }
        catch (error) {
            console.error('❌ Error getting all memories from store:', error);
            return [];
        }
    }
    classifyMemoryType(memory) {
        if (!memory.content && !memory.text)
            return 'conversation';
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
    generateMemoryId() {
        return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async addRecentMessage(sessionId, message) {
        const context = { sessionId, namespace: 'legacy' };
        await this.processMessages([message], context);
    }
    async getRecentMessages(sessionId) {
        const context = { sessionId, namespace: 'legacy' };
        const memories = await this.getContextualMemories(context, { limit: 10 });
        return memories.map(memory => ({
            role: 'assistant',
            content: memory.content,
            timestamp: memory.metadata.timestamp
        }));
    }
    async hasMemoryForSession(sessionId) {
        try {
            const namespace = ['memories', sessionId];
            const results = await this.memoryStore.search(namespace);
            return results.length > 0;
        }
        catch (error) {
            console.warn('Warning: Error checking memory existence:', error);
            return false;
        }
    }
    async searchMemory(sessionId, query, k = 3) {
        const context = { sessionId, namespace: 'legacy' };
        const memories = await this.searchMemories(query, context, { limit: k });
        return memories.map(memory => ({
            content: memory.content,
            role: 'assistant',
            timestamp: memory.metadata.timestamp,
            relevanceScore: memory.metadata.relevance || 0.5
        }));
    }
    async embedMessage(sessionId, message) {
        const context = { sessionId, namespace: 'legacy' };
        await this.addMemory(message, context, { type: 'conversation' });
    }
    async clearRecentMessages(sessionId) {
        const context = { sessionId, namespace: 'legacy' };
        await this.clearMemories(context);
    }
    async clearAllMemory(sessionId) {
        const context = { sessionId, namespace: 'legacy' };
        await this.clearMemories(context);
    }
    async getAllMessages(sessionId) {
        const context = { sessionId, namespace: 'legacy' };
        const memories = await this.getContextualMemories(context, { limit: 100 });
        return memories.map(memory => ({
            content: memory.content,
            role: 'assistant',
            timestamp: memory.metadata.timestamp
        }));
    }
    async clearLongTermMemory(sessionId) {
        const context = { sessionId, namespace: 'legacy' };
        await this.clearMemories(context);
    }
    async getConversationContext(sessionId, query) {
        const context = { sessionId, namespace: 'legacy' };
        if (query) {
            const memories = await this.searchMemories(query, context, { limit: 10 });
            return memories.map(memory => ({
                role: memory.type === 'conversation' ? 'assistant' : 'system',
                content: memory.content,
                timestamp: memory.metadata.timestamp
            }));
        }
        else {
            const memories = await this.getContextualMemories(context, { limit: 20 });
            return memories.map(memory => ({
                role: memory.type === 'conversation' ? 'assistant' : 'system',
                content: memory.content,
                timestamp: memory.metadata.timestamp
            }));
        }
    }
    async addMessage(sessionId, message) {
        const context = { sessionId, namespace: 'legacy' };
        await this.addMemory(message.content, context, {
            type: 'conversation',
            metadata: {
                role: message.role,
                timestamp: message.timestamp || new Date().toISOString()
            }
        });
    }
}
exports.LangMemService = LangMemService;
exports.langmemService = new LangMemService();
//# sourceMappingURL=langmemService.js.map